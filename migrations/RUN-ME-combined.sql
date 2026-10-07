-- Source Archive · outstanding database changes
-- Safe to run more than once. Covers migrations 039, 040 and 041.

-- ─────────────────────────────────────────────────────────────
-- Three things: the dashboard priorities list, the fields an RFQ sheet
-- needs per style, and the archive of generated sheets.
--
-- Safe to run more than once — every statement is IF NOT EXISTS.
-- ─────────────────────────────────────────────────────────────

-- ── 1. Pinned clients (from 039, repeated so one paste covers everything)
ALTER TABLE public.clients
  ADD COLUMN IF NOT EXISTS pinned_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_clients_pinned
  ON public.clients (agency_id, pinned_at)
  WHERE pinned_at IS NOT NULL;

-- ── 2. What we're on this week
--
-- Deliberately not the tasks table. A task belongs to a project and is
-- grouped by one on the Tasks page; these are free-text lines someone
-- types on the dashboard and ticks off, with no owner and no due date.
-- Forcing them into tasks would mean a row that page cannot group.
CREATE TABLE IF NOT EXISTS public.agency_priorities (
  id          TEXT PRIMARY KEY DEFAULT ('pri-' || replace(gen_random_uuid()::text, '-', '')),
  agency_id   TEXT NOT NULL REFERENCES public.agencies(id) ON DELETE CASCADE,

  body        TEXT NOT NULL,
  done        BOOLEAN NOT NULL DEFAULT FALSE,
  -- Explicit, because the order someone puts their priorities in is part of
  -- what they meant by them.
  position    INTEGER NOT NULL DEFAULT 0,

  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  done_at     TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_priorities_agency
  ON public.agency_priorities (agency_id, done, position);

ALTER TABLE public.agency_priorities ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS priorities_agency_select ON public.agency_priorities;
DROP POLICY IF EXISTS priorities_agency_insert ON public.agency_priorities;
DROP POLICY IF EXISTS priorities_agency_update ON public.agency_priorities;
DROP POLICY IF EXISTS priorities_agency_delete ON public.agency_priorities;

CREATE POLICY priorities_agency_select ON public.agency_priorities
  FOR SELECT USING (public.is_agency_member(agency_id));
CREATE POLICY priorities_agency_insert ON public.agency_priorities
  FOR INSERT WITH CHECK (public.is_agency_member(agency_id));
CREATE POLICY priorities_agency_update ON public.agency_priorities
  FOR UPDATE USING (public.is_agency_member(agency_id))
  WITH CHECK (public.is_agency_member(agency_id));
CREATE POLICY priorities_agency_delete ON public.agency_priorities
  FOR DELETE USING (public.is_agency_member(agency_id));

-- ── 3. The per-style fields an RFQ sheet asks for
--
-- Style name, image, colour and notes already exist on products as name,
-- images, colorways and notes. These are the five that did not.
ALTER TABLE public.products
  ADD COLUMN IF NOT EXISTS style_no        TEXT,
  ADD COLUMN IF NOT EXISTS size_range      TEXT,
  ADD COLUMN IF NOT EXISTS fabric          TEXT,
  ADD COLUMN IF NOT EXISTS composition_gsm TEXT,
  -- The Chinese half of the bilingual note. The English half is products.notes.
  ADD COLUMN IF NOT EXISTS notes_zh        TEXT;

-- ── 4. Every sheet we generate, kept
--
-- The point of a version number is comparing what came back, so the
-- parameters are stored with it: change a lead time, regenerate, and the
-- old sheet still says what it asked for.
CREATE TABLE IF NOT EXISTS public.rfq_sheets (
  id              TEXT PRIMARY KEY DEFAULT ('rfq-' || replace(gen_random_uuid()::text, '-', '')),
  agency_id       TEXT NOT NULL REFERENCES public.agencies(id) ON DELETE CASCADE,
  project_id      TEXT NOT NULL,
  client_id       TEXT,

  rfq_no          TEXT NOT NULL,
  version         INTEGER NOT NULL DEFAULT 1,

  enquiry_date    DATE,
  valid_until     DATE,

  sample_lead_time_days INTEGER,
  sample_trigger        TEXT,
  bulk_lead_time_days   INTEGER,
  bulk_trigger          TEXT,

  -- How many styles it covered, and the styles as they read at the time.
  style_count     INTEGER NOT NULL DEFAULT 0,
  snapshot        JSONB,

  -- Where the generated file lives, once uploaded.
  file_path       TEXT,
  file_url        TEXT,

  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_by      TEXT
);

CREATE INDEX IF NOT EXISTS idx_rfq_sheets_project
  ON public.rfq_sheets (agency_id, project_id, created_at DESC);

-- One version number per RFQ, so two people generating at once cannot
-- both produce "v2".
CREATE UNIQUE INDEX IF NOT EXISTS idx_rfq_sheets_version
  ON public.rfq_sheets (agency_id, rfq_no, version);

ALTER TABLE public.rfq_sheets ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS rfq_sheets_agency_select ON public.rfq_sheets;
DROP POLICY IF EXISTS rfq_sheets_agency_insert ON public.rfq_sheets;
DROP POLICY IF EXISTS rfq_sheets_agency_update ON public.rfq_sheets;
DROP POLICY IF EXISTS rfq_sheets_agency_delete ON public.rfq_sheets;

CREATE POLICY rfq_sheets_agency_select ON public.rfq_sheets
  FOR SELECT USING (public.is_agency_member(agency_id));
CREATE POLICY rfq_sheets_agency_insert ON public.rfq_sheets
  FOR INSERT WITH CHECK (public.is_agency_member(agency_id));
CREATE POLICY rfq_sheets_agency_update ON public.rfq_sheets
  FOR UPDATE USING (public.is_agency_member(agency_id))
  WITH CHECK (public.is_agency_member(agency_id));
CREATE POLICY rfq_sheets_agency_delete ON public.rfq_sheets
  FOR DELETE USING (public.is_agency_member(agency_id));


-- ─────────────────────────────────────────────────────────────
-- Two things: letting a brand reopen the brief they already sent, and
-- linking a client back to the enquiry it came from.
--
-- Safe to run more than once.
-- ─────────────────────────────────────────────────────────────

-- ── 1. Reopening a brief ──
--
-- Asking someone for more detail used to mean asking them to fill the whole
-- form again, which is why the second attempt is usually thinner than the
-- first. A token on the lead lets them open what they already wrote and add
-- to it.
--
-- The token is the credential — the brief form is public and the submitter
-- has no login — so it is long, random, and only minted when we deliberately
-- send it. Same shape as the factory cost-sheet share token.
ALTER TABLE public.leads
  ADD COLUMN IF NOT EXISTS edit_token      TEXT,
  ADD COLUMN IF NOT EXISTS edit_token_at   TIMESTAMPTZ,
  -- When they last sent it back, so the Leads panel can show that the ball
  -- is in our court again.
  ADD COLUMN IF NOT EXISTS revised_at      TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS revision_count  INTEGER NOT NULL DEFAULT 0;

CREATE UNIQUE INDEX IF NOT EXISTS idx_leads_edit_token
  ON public.leads (edit_token)
  WHERE edit_token IS NOT NULL;

-- ── 2. A client remembers where it came from ──
--
-- Converting a lead copied its contents into a client, a project and some
-- products, and then forgot the lead existed. Everything the brand actually
-- wrote — the brief, the files, their own words — stayed behind on a record
-- nobody opens again. One column fixes that.
ALTER TABLE public.clients
  ADD COLUMN IF NOT EXISTS lead_id TEXT;

CREATE INDEX IF NOT EXISTS idx_clients_lead
  ON public.clients (lead_id)
  WHERE lead_id IS NOT NULL;

-- Backfill where it is unambiguous: a converted lead whose email matches
-- exactly one client. Anything less certain is left alone rather than
-- guessed at.
UPDATE public.clients c
SET lead_id = l.id
FROM public.leads l
WHERE c.lead_id IS NULL
  AND l.status = 'converted'
  AND l.agency_id = c.agency_id
  AND lower(trim(l.contact_email)) = lower(trim(c.contact_email))
  AND l.contact_email IS NOT NULL
  AND c.contact_email IS NOT NULL
  AND (
    SELECT count(*) FROM public.clients c2
    WHERE c2.agency_id = l.agency_id
      AND lower(trim(c2.contact_email)) = lower(trim(l.contact_email))
  ) = 1;

-- No new policies needed: both tables already carry the four standard
-- agency policies from 008, and these are more columns on those rows.
