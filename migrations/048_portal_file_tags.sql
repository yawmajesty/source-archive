-- ─────────────────────────────────────────────────────────────
-- Tagging what a client uploads.
--
-- Files arriving with a filename and nothing else have to be opened to be
-- identified, and "URA_FINAL_v3.pdf" identifies nothing. Two columns: what
-- the file is, and which product it belongs to if any.
--
-- product_id is nullable and meant to be — "no product yet" is a real
-- answer when somebody is sending a logo, or sending artwork before the
-- style it belongs to exists.
--
-- Safe to run more than once.
-- ─────────────────────────────────────────────────────────────

ALTER TABLE public.portal_files
  ADD COLUMN IF NOT EXISTS tag        TEXT,
  ADD COLUMN IF NOT EXISTS product_id TEXT;

CREATE INDEX IF NOT EXISTS idx_portal_files_tag
  ON public.portal_files (client_id, tag)
  WHERE tag IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_portal_files_product
  ON public.portal_files (product_id)
  WHERE product_id IS NOT NULL;
