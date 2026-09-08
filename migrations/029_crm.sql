-- ═══════════════════════════════════════════════════════════════════
-- CRM: contacts, touchpoints, and follow-ups.
--
-- A client currently has exactly one contact_name / contact_email pair,
-- which is fine for sending a portal link and useless for a
-- relationship — real accounts have a founder, a production person and
-- whoever handles invoices, and you talk to each about different things.
--
-- Touchpoints are the manual half of the timeline: calls, meetings,
-- notes, a WhatsApp exchange. The automatic half already exists
-- elsewhere (email_messages, product_stage_events, portal_visits) and is
-- merged at read time rather than copied in here — one record of a thing,
-- in the table that owns it.
--
-- SAFE TO RE-RUN.
-- ═══════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS public.client_contacts (
  id          TEXT PRIMARY KEY DEFAULT ('cc-' || replace(gen_random_uuid()::text, '-', '')),
  agency_id   TEXT NOT NULL REFERENCES public.agencies(id) ON DELETE CASCADE,
  client_id   TEXT NOT NULL REFERENCES public.clients(id)  ON DELETE CASCADE,

  name        TEXT NOT NULL,
  email       TEXT,
  phone       TEXT,
  role        TEXT,                       -- "Founder", "Production", "Accounts"
  is_primary  BOOLEAN NOT NULL DEFAULT FALSE,
  notes       TEXT,

  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_cc_client ON public.client_contacts (client_id);

CREATE TABLE IF NOT EXISTS public.client_touchpoints (
  id           TEXT PRIMARY KEY DEFAULT ('tp-' || replace(gen_random_uuid()::text, '-', '')),
  agency_id    TEXT NOT NULL REFERENCES public.agencies(id) ON DELETE CASCADE,
  client_id    TEXT NOT NULL REFERENCES public.clients(id)  ON DELETE CASCADE,
  contact_id   TEXT REFERENCES public.client_contacts(id) ON DELETE SET NULL,

  kind         TEXT NOT NULL DEFAULT 'note'
               CHECK (kind IN ('call', 'meeting', 'note', 'whatsapp', 'email', 'other')),
  -- Who started it. A call you made and a call you received say very
  -- different things about an account.
  direction    TEXT NOT NULL DEFAULT 'outbound'
               CHECK (direction IN ('outbound', 'inbound', 'internal')),

  summary      TEXT NOT NULL,
  detail       TEXT,
  occurred_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  created_by   TEXT,
  created_by_name TEXT,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_tp_client ON public.client_touchpoints (client_id, occurred_at DESC);

-- ── Client-level CRM fields ───────────────────────────────────────

ALTER TABLE public.clients
  ADD COLUMN IF NOT EXISTS phone             TEXT,
  ADD COLUMN IF NOT EXISTS crm_notes         TEXT,
  ADD COLUMN IF NOT EXISTS next_follow_up_at DATE,
  ADD COLUMN IF NOT EXISTS follow_up_note    TEXT;

-- ── RLS ───────────────────────────────────────────────────────────
-- Both tables carry what was said to a client, so they follow the same
-- gate as the client record itself: any agency member may read, and
-- changing them needs the client.edit permission.

ALTER TABLE public.client_contacts    ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.client_touchpoints ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS cc_select ON public.client_contacts;
DROP POLICY IF EXISTS cc_write  ON public.client_contacts;
DROP POLICY IF EXISTS tp_select ON public.client_touchpoints;
DROP POLICY IF EXISTS tp_write  ON public.client_touchpoints;

-- Mirrors the clients table's own policies exactly: membership plus the
-- client-scope check to read, and client.edit to change. A member scoped
-- to one brand must not read another brand's call notes.
CREATE POLICY cc_select ON public.client_contacts
  FOR SELECT USING (public.is_agency_member(agency_id)
                 AND public.member_sees_client(agency_id, client_id));

CREATE POLICY cc_write ON public.client_contacts
  FOR ALL USING (public.has_agency_permission(agency_id, 'client.edit')
                 AND public.member_sees_client(agency_id, client_id))
        WITH CHECK (public.has_agency_permission(agency_id, 'client.edit')
                 AND public.member_sees_client(agency_id, client_id));

CREATE POLICY tp_select ON public.client_touchpoints
  FOR SELECT USING (public.is_agency_member(agency_id)
                 AND public.member_sees_client(agency_id, client_id));

CREATE POLICY tp_write ON public.client_touchpoints
  FOR ALL USING (public.has_agency_permission(agency_id, 'client.edit')
                 AND public.member_sees_client(agency_id, client_id))
        WITH CHECK (public.has_agency_permission(agency_id, 'client.edit')
                 AND public.member_sees_client(agency_id, client_id));

DROP TRIGGER IF EXISTS touch_client_contacts ON public.client_contacts;
CREATE TRIGGER touch_client_contacts
  BEFORE UPDATE ON public.client_contacts
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
