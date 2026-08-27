-- ═══════════════════════════════════════════════════════════════════
-- Allow 'maker' on invitations
--
-- agency_invites was created in 007, before the maker role existed, so its
-- CHECK still only permitted admin and team. agency_members was widened in
-- 014 and this was missed — inviting a workshop maker failed outright.
--
-- Caught by exercising the real insert rather than trusting the build.
--
-- SAFE TO RE-RUN.
-- ═══════════════════════════════════════════════════════════════════

DO $$
DECLARE
  con_name TEXT;
BEGIN
  SELECT conname INTO con_name
  FROM pg_constraint
  WHERE conrelid = 'public.agency_invites'::regclass
    AND contype = 'c'
    AND pg_get_constraintdef(oid) ILIKE '%role%';

  IF con_name IS NOT NULL THEN
    EXECUTE format('ALTER TABLE public.agency_invites DROP CONSTRAINT %I', con_name);
  END IF;

  ALTER TABLE public.agency_invites
    ADD CONSTRAINT agency_invites_role_check
    CHECK (role IN ('admin', 'team', 'maker'));
END $$;
