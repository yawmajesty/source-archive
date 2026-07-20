-- ═══════════════════════════════════════════════════════════════════
-- Phase 8-A: Agency multi-tenancy foundation
--
-- Adds the tenant tables (agencies + agency_members), permission helpers,
-- and a self-service RPC to create an agency + become its owner. Also
-- backfills the existing Source Archive agency and assigns your user as
-- owner so the retrofit migration in 008 has somewhere to point every
-- existing row at.
--
-- SAFE TO RE-RUN.
-- ═══════════════════════════════════════════════════════════════════

-- ── agencies ─────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.agencies (
  id            TEXT PRIMARY KEY DEFAULT ('ag-' || replace(gen_random_uuid()::text, '-', '')),
  name          TEXT NOT NULL,
  slug          TEXT NOT NULL UNIQUE,
  owner_user_id TEXT NOT NULL,             -- Clerk user id of the founder
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_agencies_slug ON public.agencies (slug);
CREATE INDEX IF NOT EXISTS idx_agencies_owner ON public.agencies (owner_user_id);

DROP TRIGGER IF EXISTS trg_agencies_updated ON public.agencies;
CREATE TRIGGER trg_agencies_updated
  BEFORE UPDATE ON public.agencies
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- ── agency_members ───────────────────────────────────────────────
-- One row per (agency, user). Role is used both for legacy
-- publicMetadata compatibility (admin/team) and future scope.

CREATE TABLE IF NOT EXISTS public.agency_members (
  agency_id  TEXT NOT NULL REFERENCES public.agencies(id) ON DELETE CASCADE,
  user_id    TEXT NOT NULL,
  role       TEXT NOT NULL CHECK (role IN ('admin', 'team')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (agency_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_agency_members_user ON public.agency_members (user_id);

-- ── agency_invites (skeleton for later) ──────────────────────────

CREATE TABLE IF NOT EXISTS public.agency_invites (
  id         TEXT PRIMARY KEY DEFAULT ('agi-' || replace(gen_random_uuid()::text, '-', '')),
  agency_id  TEXT NOT NULL REFERENCES public.agencies(id) ON DELETE CASCADE,
  email      TEXT NOT NULL,
  role       TEXT NOT NULL CHECK (role IN ('admin', 'team')),
  token      TEXT NOT NULL UNIQUE,
  invited_by TEXT NOT NULL,
  accepted_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_agency_invites_agency ON public.agency_invites (agency_id);
CREATE INDEX IF NOT EXISTS idx_agency_invites_email ON public.agency_invites (email);

-- ── Permission helpers ───────────────────────────────────────────
-- SECURITY DEFINER so they can consult agency_members without hitting
-- that table's RLS (avoids policy recursion). STABLE so PG can cache
-- results within a single query.

CREATE OR REPLACE FUNCTION public.is_agency_member(ag_id TEXT)
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.agency_members
    WHERE agency_id = ag_id
      AND user_id = (auth.jwt() ->> 'sub')
  );
$$;

CREATE OR REPLACE FUNCTION public.agency_role_of(ag_id TEXT)
RETURNS TEXT
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT role FROM public.agency_members
  WHERE agency_id = ag_id
    AND user_id = (auth.jwt() ->> 'sub')
  LIMIT 1;
$$;

-- Convenience: the ONE agency the current caller belongs to. NULL if
-- none, first if multiple. Server code should prefer looking up
-- explicit membership; this exists for RLS shortcuts.
CREATE OR REPLACE FUNCTION public.current_user_agency()
RETURNS TEXT
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT agency_id FROM public.agency_members
  WHERE user_id = (auth.jwt() ->> 'sub')
  ORDER BY created_at ASC
  LIMIT 1;
$$;

-- ── RLS on the tenant tables themselves ──────────────────────────

ALTER TABLE public.agencies       ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.agency_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.agency_invites ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS agencies_select ON public.agencies;
DROP POLICY IF EXISTS agencies_update ON public.agencies;
DROP POLICY IF EXISTS agencies_delete ON public.agencies;
DROP POLICY IF EXISTS members_select ON public.agency_members;
DROP POLICY IF EXISTS members_insert ON public.agency_members;
DROP POLICY IF EXISTS members_update ON public.agency_members;
DROP POLICY IF EXISTS members_delete ON public.agency_members;
DROP POLICY IF EXISTS invites_select ON public.agency_invites;
DROP POLICY IF EXISTS invites_insert ON public.agency_invites;
DROP POLICY IF EXISTS invites_delete ON public.agency_invites;

CREATE POLICY agencies_select ON public.agencies
  FOR SELECT USING (public.is_agency_member(id));
CREATE POLICY agencies_update ON public.agencies
  FOR UPDATE USING (public.is_agency_member(id))
             WITH CHECK (public.is_agency_member(id));
CREATE POLICY agencies_delete ON public.agencies
  FOR DELETE USING (public.agency_role_of(id) = 'admin');

CREATE POLICY members_select ON public.agency_members
  FOR SELECT USING (public.is_agency_member(agency_id));
CREATE POLICY members_insert ON public.agency_members
  FOR INSERT WITH CHECK (public.agency_role_of(agency_id) = 'admin');
CREATE POLICY members_update ON public.agency_members
  FOR UPDATE USING (public.agency_role_of(agency_id) = 'admin')
             WITH CHECK (public.agency_role_of(agency_id) = 'admin');
CREATE POLICY members_delete ON public.agency_members
  FOR DELETE USING (public.agency_role_of(agency_id) = 'admin');

CREATE POLICY invites_select ON public.agency_invites
  FOR SELECT USING (public.is_agency_member(agency_id));
CREATE POLICY invites_insert ON public.agency_invites
  FOR INSERT WITH CHECK (public.agency_role_of(agency_id) = 'admin');
CREATE POLICY invites_delete ON public.agency_invites
  FOR DELETE USING (public.agency_role_of(agency_id) = 'admin');

-- ── Self-service RPC: create agency + become owner ───────────────
-- SECURITY DEFINER so the caller doesn't need the members-insert
-- permission (which requires being an admin, which they can't be yet).

CREATE OR REPLACE FUNCTION public.create_agency_with_owner(
  p_name TEXT,
  p_slug TEXT
)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid TEXT := auth.jwt() ->> 'sub';
  v_id  TEXT;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;
  IF trim(p_name) = '' OR trim(p_slug) = '' THEN
    RAISE EXCEPTION 'Name and slug are required';
  END IF;

  INSERT INTO public.agencies (name, slug, owner_user_id)
  VALUES (trim(p_name), trim(p_slug), v_uid)
  RETURNING id INTO v_id;

  INSERT INTO public.agency_members (agency_id, user_id, role)
  VALUES (v_id, v_uid, 'admin');

  RETURN v_id;
END;
$$;

-- ── Backfill Source Archive as an existing agency ────────────────
-- The retrofit migration (008) points every existing row at this id.
-- SEED_USER_ID in .env.local is the Clerk id of the founder — we use
-- a hard-coded literal here because SQL doesn't read .env.local.
-- If your Clerk user id differs, update the WHERE clause below and
-- re-run.

INSERT INTO public.agencies (id, name, slug, owner_user_id)
VALUES ('ag-source-archive', 'Source Archive', 'source-archive', 'user_3Cq4VAMupG5cO31QqWmMB1DWgRV')
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.agency_members (agency_id, user_id, role)
VALUES ('ag-source-archive', 'user_3Cq4VAMupG5cO31QqWmMB1DWgRV', 'admin')
ON CONFLICT (agency_id, user_id) DO NOTHING;
