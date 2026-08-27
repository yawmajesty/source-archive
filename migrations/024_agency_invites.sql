-- ═══════════════════════════════════════════════════════════════════
-- A real invite flow
--
-- agency_invites has existed since 007 and was never used. Without it the
-- only way in was to sign up — which handed everyone an agency of their own.
-- Seven empty ones accumulated, and work done inside them was invisible to
-- the team.
--
-- With invites, being added is the normal path: an admin invites an email,
-- Clerk mails them, and accepting joins them to the right agency with the
-- right role. No accidental agency, nothing to adopt afterwards.
--
-- SAFE TO RE-RUN.
-- ═══════════════════════════════════════════════════════════════════

-- Emails are lowercased in the action before writing, so a plain unique index
-- is both sufficient and matchable by ON CONFLICT — the mistake made on
-- client_members in 021 and fixed in 022.
CREATE UNIQUE INDEX IF NOT EXISTS idx_agency_invites_pending
  ON public.agency_invites (agency_id, email);

CREATE INDEX IF NOT EXISTS idx_agency_invites_email ON public.agency_invites (email);

ALTER TABLE public.agency_invites
  ADD COLUMN IF NOT EXISTS permissions TEXT[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS client_scope TEXT[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS project_scope TEXT[] NOT NULL DEFAULT '{}';

COMMENT ON TABLE public.agency_invites IS
  'Pending invitations. Accepting one creates the agency_members row, carrying the role, permissions and scoping decided at invite time.';

ALTER TABLE public.agency_invites ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS ainv_select ON public.agency_invites;
DROP POLICY IF EXISTS ainv_write  ON public.agency_invites;

CREATE POLICY ainv_select ON public.agency_invites
  FOR SELECT USING (public.is_agency_member(agency_id));

-- Only admins invite; the accept path runs service-role, since the invitee is
-- by definition not yet a member and RLS would hide their own invitation.
CREATE POLICY ainv_write ON public.agency_invites
  FOR ALL USING (public.agency_role_of(agency_id) = 'admin')
  WITH CHECK (public.agency_role_of(agency_id) = 'admin');
