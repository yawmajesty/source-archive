-- ─────────────────────────────────────────────────────────────
-- 049 — Outsourced tech pack production.
--
-- Tech packs are drawn by an outside studio. Until now the only way for
-- their work to reach the system was somebody on our side downloading an
-- email attachment and re-uploading it against the right product, which
-- is both a chore and a good way to lose a version.
--
-- Two tables. A studio is who we outsource to and holds the standing link
-- they bookmark. A job is one pack we have asked them for: a product, a
-- brief, a due date. Delivered files still land in product_techpacks, so
-- everything downstream — versioning, supersedes, dual sign-off, the
-- client portal — keeps working exactly as it does for our own uploads.
--
-- The studio link carries no Clerk session, so these are read through the
-- service-role client with the token checked in the action, the same
-- arrangement portal_files and the factory RFQ portal already use.
-- ─────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.techpack_studios (
  id            TEXT PRIMARY KEY DEFAULT ('tps-' || replace(gen_random_uuid()::text, '-', '')),
  agency_id     TEXT NOT NULL REFERENCES public.agencies(id) ON DELETE CASCADE,
  name          TEXT NOT NULL,
  contact_email TEXT,

  -- The standing link. Unguessable, and revoked by setting revoked_at
  -- rather than deleting, so delivered work keeps its provenance.
  token         TEXT NOT NULL UNIQUE,
  revoked_at    TIMESTAMPTZ,

  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.techpack_jobs (
  id            TEXT PRIMARY KEY DEFAULT ('tpj-' || replace(gen_random_uuid()::text, '-', '')),
  agency_id     TEXT NOT NULL REFERENCES public.agencies(id) ON DELETE CASCADE,
  studio_id     TEXT REFERENCES public.techpack_studios(id) ON DELETE SET NULL,

  -- Always a real product: a pack attached to a typed-in name would never
  -- appear on the product page, in the portal, or in sign-off.
  product_id    TEXT NOT NULL,
  client_id     TEXT,

  brief         TEXT,
  due_date      DATE,

  -- requested → delivered → accepted. 'cancelled' for work called off.
  status        TEXT NOT NULL DEFAULT 'requested',
  delivered_at  TIMESTAMPTZ,
  accepted_at   TIMESTAMPTZ,

  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_techpack_jobs_agency
  ON public.techpack_jobs (agency_id, status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_techpack_jobs_studio
  ON public.techpack_jobs (studio_id, status);
CREATE INDEX IF NOT EXISTS idx_techpack_studios_token
  ON public.techpack_studios (token);

ALTER TABLE public.techpack_studios ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.techpack_jobs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS tpstudios_agency_select ON public.techpack_studios;
DROP POLICY IF EXISTS tpstudios_agency_insert ON public.techpack_studios;
DROP POLICY IF EXISTS tpstudios_agency_update ON public.techpack_studios;
DROP POLICY IF EXISTS tpstudios_agency_delete ON public.techpack_studios;

CREATE POLICY tpstudios_agency_select ON public.techpack_studios
  FOR SELECT USING (public.is_agency_member(agency_id));
CREATE POLICY tpstudios_agency_insert ON public.techpack_studios
  FOR INSERT WITH CHECK (public.is_agency_member(agency_id));
CREATE POLICY tpstudios_agency_update ON public.techpack_studios
  FOR UPDATE USING (public.is_agency_member(agency_id))
  WITH CHECK (public.is_agency_member(agency_id));
CREATE POLICY tpstudios_agency_delete ON public.techpack_studios
  FOR DELETE USING (public.is_agency_member(agency_id));

DROP POLICY IF EXISTS tpjobs_agency_select ON public.techpack_jobs;
DROP POLICY IF EXISTS tpjobs_agency_insert ON public.techpack_jobs;
DROP POLICY IF EXISTS tpjobs_agency_update ON public.techpack_jobs;
DROP POLICY IF EXISTS tpjobs_agency_delete ON public.techpack_jobs;

CREATE POLICY tpjobs_agency_select ON public.techpack_jobs
  FOR SELECT USING (public.is_agency_member(agency_id));
CREATE POLICY tpjobs_agency_insert ON public.techpack_jobs
  FOR INSERT WITH CHECK (public.is_agency_member(agency_id));
CREATE POLICY tpjobs_agency_update ON public.techpack_jobs
  FOR UPDATE USING (public.is_agency_member(agency_id))
  WITH CHECK (public.is_agency_member(agency_id));
CREATE POLICY tpjobs_agency_delete ON public.techpack_jobs
  FOR DELETE USING (public.is_agency_member(agency_id));

-- product_techpacks.id has a default, but portal_files taught us not to
-- assume: every writer in the app supplies its own id regardless.
