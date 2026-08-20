-- ═══════════════════════════════════════════════════════════════════
-- Client-scoped members
--
-- A designer brought in for one brand should see that brand's work and
-- nothing else. Until now agency membership was all-or-nothing: join the
-- agency, see all 16 clients.
--
-- client_scope is a list of client ids. EMPTY MEANS UNRESTRICTED, so every
-- existing member is unaffected and admins bypass the check entirely — the
-- only person who becomes restricted is one you deliberately scope.
--
-- Scoping covers the three tables that drive navigation: clients, projects
-- and products. Child records (samples, costs, updates) are reached through
-- a product, so a scoped member has no route to them in the UI — but they
-- are not individually gated yet, and a crafted request could still read one
-- by id. Worth extending if scoped members ever become common.
--
-- SAFE TO RE-RUN.
-- ═══════════════════════════════════════════════════════════════════

ALTER TABLE public.agency_members
  ADD COLUMN IF NOT EXISTS client_scope TEXT[] NOT NULL DEFAULT '{}';

COMMENT ON COLUMN public.agency_members.client_scope IS
  'Client ids this member is limited to. Empty array = all clients.';

-- SECURITY DEFINER to read agency_members without recursing through its RLS.
CREATE OR REPLACE FUNCTION public.member_sees_client(ag_id TEXT, cl_id TEXT)
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.agency_members m
    WHERE m.agency_id = ag_id
      AND m.user_id = (auth.jwt() ->> 'sub')
      AND (
        m.role = 'admin'                      -- admins see everything
        OR cardinality(m.client_scope) = 0    -- unscoped members see everything
        OR cl_id = ANY(m.client_scope)        -- scoped members see their brands
      )
  );
$$;

-- Resolve a project's client, and a product's client through its project.
CREATE OR REPLACE FUNCTION public.member_sees_project(ag_id TEXT, proj_id TEXT)
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT public.member_sees_client(
    ag_id,
    (SELECT p.client_id FROM public.projects p WHERE p.id = proj_id)
  );
$$;

-- ── clients ──────────────────────────────────────────────────────

DROP POLICY IF EXISTS clients_agency_select ON public.clients;
CREATE POLICY clients_agency_select ON public.clients
  FOR SELECT USING (public.is_agency_member(agency_id) AND public.member_sees_client(agency_id, id));

DROP POLICY IF EXISTS clients_agency_update ON public.clients;
CREATE POLICY clients_agency_update ON public.clients
  FOR UPDATE USING (
    public.has_agency_permission(agency_id, 'client.edit')
    AND public.member_sees_client(agency_id, id)
  ) WITH CHECK (
    public.has_agency_permission(agency_id, 'client.edit')
    AND public.member_sees_client(agency_id, id)
  );

-- ── projects ─────────────────────────────────────────────────────

DROP POLICY IF EXISTS projects_agency_select ON public.projects;
CREATE POLICY projects_agency_select ON public.projects
  FOR SELECT USING (public.is_agency_member(agency_id) AND public.member_sees_client(agency_id, client_id));

DROP POLICY IF EXISTS projects_agency_update ON public.projects;
CREATE POLICY projects_agency_update ON public.projects
  FOR UPDATE USING (public.is_agency_member(agency_id) AND public.member_sees_client(agency_id, client_id))
  WITH CHECK (public.is_agency_member(agency_id) AND public.member_sees_client(agency_id, client_id));

DROP POLICY IF EXISTS projects_agency_delete ON public.projects;
CREATE POLICY projects_agency_delete ON public.projects
  FOR DELETE USING (public.is_agency_member(agency_id) AND public.member_sees_client(agency_id, client_id));

-- ── products ─────────────────────────────────────────────────────

DROP POLICY IF EXISTS products_agency_select ON public.products;
CREATE POLICY products_agency_select ON public.products
  FOR SELECT USING (public.is_agency_member(agency_id) AND public.member_sees_project(agency_id, project_id));

DROP POLICY IF EXISTS products_agency_update ON public.products;
CREATE POLICY products_agency_update ON public.products
  FOR UPDATE USING (public.is_agency_member(agency_id) AND public.member_sees_project(agency_id, project_id))
  WITH CHECK (public.is_agency_member(agency_id) AND public.member_sees_project(agency_id, project_id));

DROP POLICY IF EXISTS products_agency_delete ON public.products;
CREATE POLICY products_agency_delete ON public.products
  FOR DELETE USING (public.is_agency_member(agency_id) AND public.member_sees_project(agency_id, project_id));

DROP POLICY IF EXISTS products_agency_insert ON public.products;
CREATE POLICY products_agency_insert ON public.products
  FOR INSERT WITH CHECK (public.is_agency_member(agency_id) AND public.member_sees_project(agency_id, project_id));
