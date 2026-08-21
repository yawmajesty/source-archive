-- ═══════════════════════════════════════════════════════════════════
-- Project-scoped members
--
-- client_scope limits someone to a brand. This narrows it further: put a
-- person on specific collections and they see those, not everything the
-- client has.
--
-- Precedence, most specific wins:
--   project_scope non-empty  → exactly those collections
--   else client_scope non-empty → every collection of those clients
--   else                     → everything
--
-- Empty still means unrestricted at both levels, so nobody is silently
-- locked out and admins bypass entirely.
--
-- SAFE TO RE-RUN.
-- ═══════════════════════════════════════════════════════════════════

ALTER TABLE public.agency_members
  ADD COLUMN IF NOT EXISTS project_scope TEXT[] NOT NULL DEFAULT '{}';

COMMENT ON COLUMN public.agency_members.project_scope IS
  'Project (collection) ids this member is limited to. Empty = fall back to client_scope.';

-- A project is visible when it is named directly, or when no project scope is
-- set and its client is allowed.
CREATE OR REPLACE FUNCTION public.member_sees_project(ag_id TEXT, proj_id TEXT)
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
        m.role = 'admin'
        OR (
          CASE
            WHEN cardinality(m.project_scope) > 0
              THEN proj_id = ANY(m.project_scope)
            WHEN cardinality(m.client_scope) > 0
              THEN (SELECT p.client_id FROM public.projects p WHERE p.id = proj_id) = ANY(m.client_scope)
            ELSE TRUE
          END
        )
      )
  );
$$;

-- A client is visible when they are named directly, or when they own a
-- collection this member is scoped to — otherwise a project-scoped person
-- would lose sight of whose brand they are working on.
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
        m.role = 'admin'
        OR (cardinality(m.project_scope) = 0 AND cardinality(m.client_scope) = 0)
        OR cl_id = ANY(m.client_scope)
        OR EXISTS (
          SELECT 1 FROM public.projects p
          WHERE p.id = ANY(m.project_scope) AND p.client_id = cl_id
        )
      )
  );
$$;
