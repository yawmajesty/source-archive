-- ═══════════════════════════════════════════════════════════════════
-- Outbound email: the log, and the switches that govern it.
--
-- Every message is recorded whether or not it actually goes out. A row
-- with status 'skipped' because no provider is configured is more use
-- than no row at all — it shows exactly what would have been sent and
-- why it wasn't, which is the difference between "email is broken" and
-- "email needs an API key".
--
-- SAFE TO RE-RUN.
-- ═══════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS public.email_messages (
  id           TEXT PRIMARY KEY DEFAULT ('em-' || replace(gen_random_uuid()::text, '-', '')),
  agency_id    TEXT NOT NULL REFERENCES public.agencies(id) ON DELETE CASCADE,

  to_email     TEXT NOT NULL,
  to_name      TEXT,
  reply_to     TEXT,
  subject      TEXT NOT NULL,
  body_html    TEXT NOT NULL,
  body_text    TEXT NOT NULL,

  -- Which automation produced it, so the log can be filtered by cause.
  template     TEXT NOT NULL,
  -- What it was about: 'lead' | 'product' | 'client' | null.
  related_type TEXT,
  related_id   TEXT,

  status       TEXT NOT NULL DEFAULT 'queued'
               CHECK (status IN ('queued', 'sent', 'failed', 'skipped')),
  provider_id  TEXT,
  error        TEXT,

  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  sent_at      TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_email_agency  ON public.email_messages (agency_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_email_status  ON public.email_messages (agency_id, status);
CREATE INDEX IF NOT EXISTS idx_email_related ON public.email_messages (related_type, related_id);

ALTER TABLE public.email_messages ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS email_select ON public.email_messages;
DROP POLICY IF EXISTS email_write  ON public.email_messages;

-- Reading the log means reading what was said to clients, so it is
-- admin-only. Writes come from the service-role client inside the
-- automations, which bypasses RLS — no insert policy is needed and
-- deliberately none is granted.
CREATE POLICY email_select ON public.email_messages
  FOR SELECT USING (public.agency_role_of(agency_id) = 'admin');

-- ── Switches ──────────────────────────────────────────────────────

-- Where "a brief just came in" lands. Null falls back to the agency's
-- admins, so a fresh agency still gets its leads.
ALTER TABLE public.agency_settings
  ADD COLUMN IF NOT EXISTS notification_email TEXT;

-- A client who asks to be left alone. Stage emails check this; nothing
-- else changes for them.
ALTER TABLE public.clients
  ADD COLUMN IF NOT EXISTS email_updates_enabled BOOLEAN NOT NULL DEFAULT TRUE;
