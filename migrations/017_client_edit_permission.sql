-- ═══════════════════════════════════════════════════════════════════
-- Gate client edits on a capability
--
-- Every clients policy was membership-only, so anyone added to the agency —
-- including a workshop maker who only needs the production log — could edit
-- client records.
--
-- Reading stays with membership: being on the team is what gives you sight of
-- the client list, which is the point of having a team. Writing now needs an
-- explicit `client.edit` grant, so an admin decides who works on client pages.
--
-- Admins bypass this, as has_agency_permission returns true for them.
--
-- SAFE TO RE-RUN.
-- ═══════════════════════════════════════════════════════════════════

-- Existing non-admin members keep the access they had — this must not
-- silently take editing away from someone mid-project.
UPDATE public.agency_members
SET permissions = array_append(permissions, 'client.edit')
WHERE role = 'team' AND NOT ('client.edit' = ANY(permissions));

DROP POLICY IF EXISTS clients_agency_insert ON public.clients;
DROP POLICY IF EXISTS clients_agency_update ON public.clients;
DROP POLICY IF EXISTS clients_agency_delete ON public.clients;

CREATE POLICY clients_agency_insert ON public.clients
  FOR INSERT WITH CHECK (public.has_agency_permission(agency_id, 'client.edit'));

CREATE POLICY clients_agency_update ON public.clients
  FOR UPDATE USING (public.has_agency_permission(agency_id, 'client.edit'))
  WITH CHECK (public.has_agency_permission(agency_id, 'client.edit'));

-- Deleting a client is destructive and cascades; keep it to admins.
CREATE POLICY clients_agency_delete ON public.clients
  FOR DELETE USING (public.agency_role_of(agency_id) = 'admin');

-- clients_agency_select is deliberately left as-is: membership grants sight.
