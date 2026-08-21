-- ═══════════════════════════════════════════════════════════════════
-- Client members — the client's own people
--
-- Distinct from agency_members.client_scope, which limits OUR staff to
-- certain brands. This is the brand's side: the founder, their designer,
-- whoever they want on their portal, each with their own login.
--
-- Until now a portal was protected only by knowing its URL, and the id is a
-- timestamp rather than a secret. Adding members turns that client's portal
-- into something you sign in to.
--
-- Backwards compatible by design: a client with NO members keeps working
-- exactly as before, open to anyone with the link. Enforcement begins the
-- moment you add the first person, so no existing client is locked out.
--
-- Invites are by email, because a person can't be added before they exist:
-- the row is created with user_id NULL, and claimed the first time someone
-- signs in with that address.
--
-- SAFE TO RE-RUN.
-- ═══════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS public.client_members (
  id          TEXT PRIMARY KEY DEFAULT ('cmem-' || replace(gen_random_uuid()::text, '-', '')),
  agency_id   TEXT NOT NULL REFERENCES public.agencies(id) ON DELETE CASCADE,
  client_id   TEXT NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,

  email       TEXT NOT NULL,
  user_id     TEXT,                 -- filled in when they first sign in
  role        TEXT NOT NULL DEFAULT 'member' CHECK (role IN ('owner', 'member')),

  invited_by  TEXT,
  claimed_at  TIMESTAMPTZ,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Addresses are matched case-insensitively when someone signs in.
CREATE UNIQUE INDEX IF NOT EXISTS idx_client_members_email
  ON public.client_members (client_id, lower(email));
CREATE INDEX IF NOT EXISTS idx_client_members_user   ON public.client_members (user_id);
CREATE INDEX IF NOT EXISTS idx_client_members_client ON public.client_members (client_id);

ALTER TABLE public.client_members ENABLE ROW LEVEL SECURITY;

-- Agency staff manage them; the portal itself reads through the service-role
-- client, as it does for everything else on that surface.
DROP POLICY IF EXISTS cmem_select ON public.client_members;
DROP POLICY IF EXISTS cmem_write  ON public.client_members;

CREATE POLICY cmem_select ON public.client_members
  FOR SELECT USING (
    public.is_agency_member(agency_id) AND public.member_sees_client(agency_id, client_id)
  );

CREATE POLICY cmem_write ON public.client_members
  FOR ALL USING (
    public.has_agency_permission(agency_id, 'client.edit')
    AND public.member_sees_client(agency_id, client_id)
  ) WITH CHECK (
    public.has_agency_permission(agency_id, 'client.edit')
    AND public.member_sees_client(agency_id, client_id)
  );
