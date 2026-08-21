-- ═══════════════════════════════════════════════════════════════════
-- Fix: adding a client member failed with
--   "there is no unique or exclusion constraint matching the ON CONFLICT
--    specification"
--
-- Migration 021 created the uniqueness index on (client_id, lower(email)) —
-- an expression index. addClientMember upserts with onConflict
-- "client_id,email", and Postgres cannot match a plain column list against an
-- expression index, so every add failed.
--
-- Emails are already normalised to lowercase in the action before insert, so
-- a plain unique index on (client_id, email) gives the same guarantee and is
-- matchable. Existing rows are lowercased first, though there are none yet.
--
-- SAFE TO RE-RUN.
-- ═══════════════════════════════════════════════════════════════════

UPDATE public.client_members SET email = lower(email) WHERE email <> lower(email);

DROP INDEX IF EXISTS public.idx_client_members_email;

CREATE UNIQUE INDEX IF NOT EXISTS idx_client_members_email
  ON public.client_members (client_id, email);
