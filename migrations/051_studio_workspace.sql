-- ─────────────────────────────────────────────────────────────
-- 051 — The studio's own workspace.
--
-- This file also re-runs everything in 050. Every statement is written to
-- be safe to run twice, so if 050 has already gone in this changes
-- nothing, and if it has not, this one paste does both. Run only this.
--
-- What is new here is the studio's own side of a job. Until now every
-- field on a job was ours: our priority, our due date. A studio working
-- through fifteen packs has its own view of the same list — what it is
-- actually on today, and when it honestly expects to be finished, which
-- is rarely the date we asked for.
--
-- Those are deliberately separate columns rather than edits to ours. If a
-- studio could move due_date we would lose the thing we agreed, and the
-- gap between the date we asked for and the date they expect is the most
-- useful number on the board — it is the early warning.
-- ─────────────────────────────────────────────────────────────

-- ── from 050 ─────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.techpack_job_notes (
  id          TEXT PRIMARY KEY DEFAULT ('tjn-' || replace(gen_random_uuid()::text, '-', '')),
  agency_id   TEXT NOT NULL REFERENCES public.agencies(id) ON DELETE CASCADE,
  job_id      TEXT NOT NULL REFERENCES public.techpack_jobs(id) ON DELETE CASCADE,
  author      TEXT NOT NULL,
  author_name TEXT,
  body        TEXT NOT NULL,
  asks_for    TEXT,
  resolved_at TIMESTAMPTZ,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_techpack_notes_job
  ON public.techpack_job_notes (job_id, created_at);
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

-- ── new in 051 ───────────────────────────────────────────────

-- The date the studio expects to deliver, set by the studio. Never the
-- same column as due_date, which stays what we asked for.
ALTER TABLE public.techpack_jobs ADD COLUMN IF NOT EXISTS studio_eta        DATE;
ALTER TABLE public.techpack_jobs ADD COLUMN IF NOT EXISTS studio_eta_set_at TIMESTAMPTZ;

-- The studio's own ordering: 'now', 'next' or 'later'. Null means they
-- have not said. Ours is `priority`, and the two are read side by side.
ALTER TABLE public.techpack_jobs ADD COLUMN IF NOT EXISTS studio_rank       TEXT;

-- The board sorts by what the studio is on today, so index it.
CREATE INDEX IF NOT EXISTS idx_techpack_jobs_studio_rank
  ON public.techpack_jobs (studio_id, studio_rank);

-- The studio link carries no Clerk session, so its reads and writes go
-- through the service-role client with the token checked in the action.
