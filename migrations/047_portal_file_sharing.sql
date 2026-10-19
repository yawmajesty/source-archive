-- ─────────────────────────────────────────────────────────────
-- Finishing the portal's Files tab.
--
-- portal_files has existed since the beginning with filename, size_kb and
-- source — and no column saying where the file is. So nothing could ever
-- be uploaded to it or linked from it: the portal's upload box was a styled
-- div with no handler, and "Shared by agency" could never fill up because
-- there was no write path on either side.
--
-- Safe to run more than once.
-- ─────────────────────────────────────────────────────────────

ALTER TABLE public.portal_files
  ADD COLUMN IF NOT EXISTS file_url         TEXT,
  ADD COLUMN IF NOT EXISTS file_path        TEXT,
  ADD COLUMN IF NOT EXISTS content_type     TEXT,
  -- Who put it there, in words. The source column already says which side,
  -- but "Hana" is more use than "client" when three people share a login.
  ADD COLUMN IF NOT EXISTS uploaded_by_name TEXT,
  -- A line from whoever shared it: what it is, what to do with it.
  ADD COLUMN IF NOT EXISTS note             TEXT;

CREATE INDEX IF NOT EXISTS idx_portal_files_client
  ON public.portal_files (client_id, uploaded_at DESC);

-- portal_files already carries the arrangement 008 gave it: agency members
-- read and write through RLS, and the public portal goes through the
-- service-role client with its own ownership check in the action. These are
-- more columns on those rows, so no policy changes.
