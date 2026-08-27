-- ═══════════════════════════════════════════════════════════════════
-- Primary agency
--
-- getAgencyContext picked a user's OLDEST membership. Signing up creates an
-- agency of your own, so anyone later added to a real agency still had their
-- accidental one as context — and everything they created was stamped with
-- it, invisible to the team.
--
-- That is exactly what happened to Sam: three Fiche Technique products landed
-- under "SAM YANG" and Yaw couldn't see them.
--
-- is_primary makes the choice explicit rather than incidental. Being added to
-- an agency by an admin sets it, because that is the deliberate act; the
-- accidental signup agency is not.
--
-- SAFE TO RE-RUN.
-- ═══════════════════════════════════════════════════════════════════

ALTER TABLE public.agency_members
  ADD COLUMN IF NOT EXISTS is_primary BOOLEAN NOT NULL DEFAULT FALSE;

COMMENT ON COLUMN public.agency_members.is_primary IS
  'The agency this user works in. getAgencyContext prefers it over the oldest membership.';

-- At most one primary per user.
CREATE UNIQUE INDEX IF NOT EXISTS idx_agency_members_one_primary
  ON public.agency_members (user_id) WHERE is_primary;

-- Backfill. For anyone in more than one agency, the one holding actual
-- products is the real one — an empty agency is the signup artefact.
WITH ranked AS (
  SELECT
    m.user_id,
    m.agency_id,
    ROW_NUMBER() OVER (
      PARTITION BY m.user_id
      ORDER BY (SELECT COUNT(*) FROM public.products p WHERE p.agency_id = m.agency_id) DESC,
               m.created_at ASC
    ) AS rn
  FROM public.agency_members m
)
UPDATE public.agency_members am
SET is_primary = TRUE
FROM ranked r
WHERE am.user_id = r.user_id
  AND am.agency_id = r.agency_id
  AND r.rn = 1
  AND NOT EXISTS (
    SELECT 1 FROM public.agency_members x WHERE x.user_id = am.user_id AND x.is_primary
  );
