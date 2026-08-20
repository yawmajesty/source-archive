-- ═══════════════════════════════════════════════════════════════════
-- Granular permissions + product stage history
--
-- Two related needs:
--
-- 1. Makers and studio staff need to move products between stages
--    (brief -> sourcing, sourcing -> sampling) as work actually progresses,
--    without being handed admin. Who gets that is set per person by an
--    admin, not baked into the role — a studio machinist in Berlin sampling
--    with a manufacturer needs it; a freelance pattern cutter may not.
--
-- 2. Those transitions are the clearest signal of progress a client gets,
--    so each one is recorded with who moved it and why, and surfaces in the
--    client portal.
--
-- Permissions are additive on top of role: admins always have everything,
-- everyone else has exactly what is granted here.
--
-- SAFE TO RE-RUN.
-- ═══════════════════════════════════════════════════════════════════

-- ── per-member capabilities ──────────────────────────────────────

ALTER TABLE public.agency_members
  ADD COLUMN IF NOT EXISTS permissions TEXT[] NOT NULL DEFAULT '{}';

COMMENT ON COLUMN public.agency_members.permissions IS
  'Capability keys granted to this member on top of their role. See lib/permissions.ts for the canonical list.';

-- Existing team members keep working exactly as before; only makers are
-- newly constrained, and they start with the diary they already had.
UPDATE public.agency_members
SET permissions = ARRAY['log.write']
WHERE role = 'maker' AND cardinality(permissions) = 0;

-- SECURITY DEFINER so policies can consult it without recursing through
-- agency_members' own RLS, matching is_agency_member.
CREATE OR REPLACE FUNCTION public.has_agency_permission(ag_id TEXT, perm TEXT)
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.agency_members
    WHERE agency_id = ag_id
      AND user_id = (auth.jwt() ->> 'sub')
      AND (role = 'admin' OR perm = ANY(permissions))
  );
$$;

-- ── product stage history ────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.product_stage_events (
  id                TEXT PRIMARY KEY DEFAULT ('pse-' || replace(gen_random_uuid()::text, '-', '')),
  agency_id         TEXT NOT NULL REFERENCES public.agencies(id) ON DELETE CASCADE,
  product_id        TEXT NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,

  from_stage        TEXT,
  to_stage          TEXT NOT NULL,
  note              TEXT,

  changed_by        TEXT NOT NULL,
  changed_by_name   TEXT,

  -- Unlike the workshop diary, a stage move is factual progress rather than
  -- internal chatter, so it reaches the client by default. Still overridable.
  visible_to_client BOOLEAN NOT NULL DEFAULT TRUE,

  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_pse_product ON public.product_stage_events (product_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_pse_agency  ON public.product_stage_events (agency_id, created_at DESC);

ALTER TABLE public.product_stage_events ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS pse_select ON public.product_stage_events;
DROP POLICY IF EXISTS pse_insert ON public.product_stage_events;
DROP POLICY IF EXISTS pse_update ON public.product_stage_events;
DROP POLICY IF EXISTS pse_delete ON public.product_stage_events;

CREATE POLICY pse_select ON public.product_stage_events
  FOR SELECT USING (public.is_agency_member(agency_id));

-- Writing history requires the same permission as making the change.
CREATE POLICY pse_insert ON public.product_stage_events
  FOR INSERT WITH CHECK (
    public.has_agency_permission(agency_id, 'stage.change')
    AND changed_by = (auth.jwt() ->> 'sub')
  );

CREATE POLICY pse_update ON public.product_stage_events
  FOR UPDATE USING (public.agency_role_of(agency_id) IN ('admin', 'team'))
  WITH CHECK (public.is_agency_member(agency_id));

CREATE POLICY pse_delete ON public.product_stage_events
  FOR DELETE USING (public.agency_role_of(agency_id) = 'admin');

-- ── products.stage: gate the write in the database ───────────────
-- RLS is row-level, not column-level, so a policy can't express "may edit
-- this row but not this column". A trigger can. Without it, anyone who can
-- update a product could move its stage and bypass the history entirely.

CREATE OR REPLACE FUNCTION public.guard_product_stage_change()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
BEGIN
  IF NEW.stage IS DISTINCT FROM OLD.stage THEN
    -- Service-role callers (the client portal, webhooks) have no JWT subject
    -- and are trusted by design; skip the check for them.
    IF (auth.jwt() ->> 'sub') IS NOT NULL
       AND NOT public.has_agency_permission(NEW.agency_id, 'stage.change') THEN
      RAISE EXCEPTION 'You do not have permission to change the stage of this product'
        USING ERRCODE = 'insufficient_privilege';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_guard_product_stage ON public.products;
CREATE TRIGGER trg_guard_product_stage
  BEFORE UPDATE ON public.products
  FOR EACH ROW EXECUTE FUNCTION public.guard_product_stage_change();
