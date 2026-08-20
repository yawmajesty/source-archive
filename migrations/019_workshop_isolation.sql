-- ═══════════════════════════════════════════════════════════════════
-- Workshop isolation
--
-- A maker needs the products they're working on and nothing else. Costing,
-- client records and other brands' work are not theirs to see, and until now
-- both costs and tasks were readable by any agency member.
--
-- Two changes:
--   costs — now needs the `cost.view` capability, which no maker has by
--           default. Margins are the most sensitive thing in the system.
--   tasks — now scoped the same way products are, so a maker limited to one
--           brand sees only that brand's tasks.
--
-- Route-level gating lives in app/(app)/layout.tsx; this is the half that
-- holds even if someone calls the API directly.
--
-- SAFE TO RE-RUN.
-- ═══════════════════════════════════════════════════════════════════

-- ── costs: margin is capability-gated ────────────────────────────
-- Existing team members keep access; only makers are newly excluded.

UPDATE public.agency_members
SET permissions = array_append(permissions, 'cost.view')
WHERE role = 'team' AND NOT ('cost.view' = ANY(permissions));

DROP POLICY IF EXISTS costs_agency_select ON public.costs;
CREATE POLICY costs_agency_select ON public.costs
  FOR SELECT USING (public.has_agency_permission(agency_id, 'cost.view'));

DROP POLICY IF EXISTS costs_agency_insert ON public.costs;
CREATE POLICY costs_agency_insert ON public.costs
  FOR INSERT WITH CHECK (public.has_agency_permission(agency_id, 'cost.view'));

DROP POLICY IF EXISTS costs_agency_update ON public.costs;
CREATE POLICY costs_agency_update ON public.costs
  FOR UPDATE USING (public.has_agency_permission(agency_id, 'cost.view'))
  WITH CHECK (public.has_agency_permission(agency_id, 'cost.view'));

DROP POLICY IF EXISTS costs_agency_delete ON public.costs;
CREATE POLICY costs_agency_delete ON public.costs
  FOR DELETE USING (public.has_agency_permission(agency_id, 'cost.view'));

-- ── tasks: scoped like the products they belong to ───────────────
-- A task with no product falls back to its project; one with neither is
-- agency-wide and stays visible to any member.

DROP POLICY IF EXISTS tasks_agency_select ON public.tasks;
CREATE POLICY tasks_agency_select ON public.tasks
  FOR SELECT USING (
    public.is_agency_member(agency_id)
    AND (
      project_id IS NULL
      OR public.member_sees_project(agency_id, project_id)
    )
  );

DROP POLICY IF EXISTS tasks_agency_update ON public.tasks;
CREATE POLICY tasks_agency_update ON public.tasks
  FOR UPDATE USING (
    public.is_agency_member(agency_id)
    AND (project_id IS NULL OR public.member_sees_project(agency_id, project_id))
  ) WITH CHECK (public.is_agency_member(agency_id));
