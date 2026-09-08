-- ═══════════════════════════════════════════════════════════════════
-- Replies on briefs, per-client fabric access, and backup records.
--
-- SAFE TO RE-RUN.
-- ═══════════════════════════════════════════════════════════════════

-- ── Talking about a brief ─────────────────────────────────────────
-- A client sends a brief and there is no way to say "this needs a
-- higher MOQ" without falling back to email — the thing the brief was
-- meant to replace.

CREATE TABLE IF NOT EXISTS public.product_brief_replies (
  id          TEXT PRIMARY KEY DEFAULT ('br-' || replace(gen_random_uuid()::text, '-', '')),
  agency_id   TEXT NOT NULL REFERENCES public.agencies(id) ON DELETE CASCADE,
  brief_id    TEXT NOT NULL REFERENCES public.product_briefs(id) ON DELETE CASCADE,

  -- Which side of the table it came from. Not a user id: the portal has
  -- link-holders with no account, and pretending otherwise would make
  -- the thread lie about who said what.
  side        TEXT NOT NULL CHECK (side IN ('agency', 'client')),
  author_name TEXT,
  body        TEXT NOT NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_brreplies_brief ON public.product_brief_replies (brief_id, created_at);

ALTER TABLE public.product_brief_replies ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS brreplies_select ON public.product_brief_replies;
DROP POLICY IF EXISTS brreplies_write  ON public.product_brief_replies;
CREATE POLICY brreplies_select ON public.product_brief_replies
  FOR SELECT USING (public.is_agency_member(agency_id));
CREATE POLICY brreplies_write ON public.product_brief_replies
  FOR ALL USING (public.has_agency_permission(agency_id, 'product.edit'))
      WITH CHECK (public.has_agency_permission(agency_id, 'product.edit'));

-- A brief someone is still waiting on an answer to.
ALTER TABLE public.product_briefs
  ADD COLUMN IF NOT EXISTS last_reply_side TEXT,
  ADD COLUMN IF NOT EXISTS last_reply_at   TIMESTAMPTZ;

-- ── Fabric library, per client ────────────────────────────────────
-- Off by default. The library is commercially sensitive and not every
-- client is paying for access to it.
ALTER TABLE public.clients
  ADD COLUMN IF NOT EXISTS fabric_library_enabled BOOLEAN NOT NULL DEFAULT FALSE;

-- ── Backups ───────────────────────────────────────────────────────
-- A record of what was taken and when. The file itself lives in storage;
-- this is the index, so a missing backup is visible rather than merely
-- absent.

CREATE TABLE IF NOT EXISTS public.backup_runs (
  id          TEXT PRIMARY KEY DEFAULT ('bk-' || replace(gen_random_uuid()::text, '-', '')),
  agency_id   TEXT NOT NULL REFERENCES public.agencies(id) ON DELETE CASCADE,
  storage_path TEXT,
  table_counts JSONB NOT NULL DEFAULT '{}'::jsonb,
  row_total   INTEGER NOT NULL DEFAULT 0,
  bytes       INTEGER NOT NULL DEFAULT 0,
  status      TEXT NOT NULL DEFAULT 'ok' CHECK (status IN ('ok', 'failed')),
  error       TEXT,
  trigger     TEXT NOT NULL DEFAULT 'manual' CHECK (trigger IN ('manual', 'scheduled')),
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_backups_agency ON public.backup_runs (agency_id, created_at DESC);

ALTER TABLE public.backup_runs ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS backups_select ON public.backup_runs;
CREATE POLICY backups_select ON public.backup_runs
  FOR SELECT USING (public.agency_role_of(agency_id) = 'admin');

-- Private on purpose: a backup contains every client's costs, contacts
-- and pricing, and a public bucket would put the whole business behind a
-- guessable URL.
INSERT INTO storage.buckets (id, name, public)
VALUES ('backups', 'backups', false)
ON CONFLICT (id) DO NOTHING;

-- No storage policies are granted. Reads and writes happen through the
-- service-role key inside the server, which bypasses them — nobody
-- reaches a backup with an anon key, by design.
