-- ─────────────────────────────────────────────────────────────
-- 050 — Talking to the studio, and asking for changes.
--
-- 049 gave the studio a link and somewhere to put a file. What it had no
-- room for is the conversation around the work: the studio asking us for
-- a logo before they can finish, us asking for a change once a pack has
-- landed, and either side saying anything at all.
--
-- One thread per job, written from both ends. A note can also be a
-- request — "we need the embroidery file" — which stays open until
-- somebody marks it supplied, so it shows as outstanding rather than
-- scrolling away.
--
-- The job gains what the board and the revision loop need: a priority, a
-- count of how many times a pack has come back, the note saying what to
-- change, and when the studio actually started. Versions themselves stay
-- in product_techpacks, where they already work.
-- ─────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.techpack_job_notes (
  id          TEXT PRIMARY KEY DEFAULT ('tjn-' || replace(gen_random_uuid()::text, '-', '')),
  agency_id   TEXT NOT NULL REFERENCES public.agencies(id) ON DELETE CASCADE,
  job_id      TEXT NOT NULL REFERENCES public.techpack_jobs(id) ON DELETE CASCADE,

  -- 'agency' or 'studio'. Which end of the link wrote it.
  author      TEXT NOT NULL,
  author_name TEXT,
  body        TEXT NOT NULL,

  -- Set when the note is a request for something from us, e.g. 'logo'.
  -- A plain comment leaves this null.
  asks_for    TEXT,
  resolved_at TIMESTAMPTZ,

  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_techpack_notes_job
  ON public.techpack_job_notes (job_id, created_at);
-- Outstanding requests, which is the only query the board runs across jobs.
CREATE INDEX IF NOT EXISTS idx_techpack_notes_open
  ON public.techpack_job_notes (agency_id, resolved_at)
  WHERE asks_for IS NOT NULL;

ALTER TABLE public.techpack_jobs ADD COLUMN IF NOT EXISTS priority       TEXT;
ALTER TABLE public.techpack_jobs ADD COLUMN IF NOT EXISTS revision_note  TEXT;
ALTER TABLE public.techpack_jobs ADD COLUMN IF NOT EXISTS revision_count INTEGER NOT NULL DEFAULT 0;
ALTER TABLE public.techpack_jobs ADD COLUMN IF NOT EXISTS started_at     TIMESTAMPTZ;

ALTER TABLE public.techpack_job_notes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS tpnotes_agency_select ON public.techpack_job_notes;
DROP POLICY IF EXISTS tpnotes_agency_insert ON public.techpack_job_notes;
DROP POLICY IF EXISTS tpnotes_agency_update ON public.techpack_job_notes;
DROP POLICY IF EXISTS tpnotes_agency_delete ON public.techpack_job_notes;

CREATE POLICY tpnotes_agency_select ON public.techpack_job_notes
  FOR SELECT USING (public.is_agency_member(agency_id));
CREATE POLICY tpnotes_agency_insert ON public.techpack_job_notes
  FOR INSERT WITH CHECK (public.is_agency_member(agency_id));
CREATE POLICY tpnotes_agency_update ON public.techpack_job_notes
  FOR UPDATE USING (public.is_agency_member(agency_id))
  WITH CHECK (public.is_agency_member(agency_id));
CREATE POLICY tpnotes_agency_delete ON public.techpack_job_notes
  FOR DELETE USING (public.is_agency_member(agency_id));

-- The studio link carries no Clerk session, so its reads and writes go
-- through the service-role client with the token checked in the action.
