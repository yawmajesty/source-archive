-- ═══════════════════════════════════════════════════════════════════
-- Phase 8-B (fixup): drop the legacy `allow_all` policies
--
-- A pre-multi-tenant migration left an `allow_all` policy on every
-- agency-scoped table. Postgres RLS combines policies with OR, so
-- `allow_all` (qual = true) defeats the agency_id filter entirely —
-- anyone signed in sees every agency's data.
--
-- We drop it here. If a table also holds public-portal-accessible rows
-- and needs looser policies later, we add explicit ones — no more
-- catch-alls.
--
-- SAFE TO RE-RUN.
-- ═══════════════════════════════════════════════════════════════════

-- Drop every `allow_all` policy on every public table — no allowlist,
-- because we've discovered a handful of tables not in our original list
-- (milestones, brand_costing_*, brand_expenses, rfq_tiers) that also
-- carry it. Broader-than-necessary is safer than missing one.
DO $$
DECLARE
  r RECORD;
BEGIN
  FOR r IN
    SELECT schemaname, tablename
    FROM pg_policies
    WHERE policyname = 'allow_all'
      AND schemaname = 'public'
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS allow_all ON %I.%I', r.schemaname, r.tablename);
  END LOOP;
END $$;
