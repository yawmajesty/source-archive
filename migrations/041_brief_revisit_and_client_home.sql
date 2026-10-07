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
