-- ═══════════════════════════════════════════════════════════════════
-- Phase 1: Brand-dashboard foundation
--
-- Adds workspaces, workspace_members, workspace_invites, subscriptions,
-- plus RLS policies keyed off the Clerk user id (sub claim on the
-- Clerk-issued Supabase JWT).
--
-- Also adds a SECURITY DEFINER function so a brand-new user can create
-- their workspace atomically without loose INSERT policies.
--
-- SAFE TO RE-RUN: everything uses IF NOT EXISTS / CREATE OR REPLACE.
-- ═══════════════════════════════════════════════════════════════════

-- ── Tables ─────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.workspaces (
  id            TEXT PRIMARY KEY DEFAULT ('ws-' || replace(gen_random_uuid()::text, '-', '')),
  mode          TEXT NOT NULL CHECK (mode IN ('managed', 'independent')),
  name          TEXT NOT NULL,
  slug          TEXT NOT NULL UNIQUE,
  base_currency TEXT NOT NULL DEFAULT 'USD',
  logo_url      TEXT,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_by    TEXT  -- Clerk user id
);

CREATE INDEX IF NOT EXISTS idx_workspaces_slug ON public.workspaces (slug);

CREATE TABLE IF NOT EXISTS public.workspace_members (
  workspace_id TEXT NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  user_id      TEXT NOT NULL,  -- Clerk user id
  role         TEXT NOT NULL CHECK (role IN ('sa_admin', 'sa_team', 'brand_owner', 'brand_member')),
  invited_by   TEXT,
  joined_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (workspace_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_workspace_members_user ON public.workspace_members (user_id);

CREATE TABLE IF NOT EXISTS public.workspace_invites (
  id           TEXT PRIMARY KEY DEFAULT ('inv-' || replace(gen_random_uuid()::text, '-', '')),
  workspace_id TEXT NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  email        TEXT NOT NULL,
  role         TEXT NOT NULL CHECK (role IN ('sa_admin', 'sa_team', 'brand_owner', 'brand_member')),
  invited_by   TEXT NOT NULL,
  invited_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  accepted_at  TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_workspace_invites_email ON public.workspace_invites (email);

CREATE TABLE IF NOT EXISTS public.subscriptions (
  workspace_id           TEXT PRIMARY KEY REFERENCES public.workspaces(id) ON DELETE CASCADE,
  stripe_customer_id     TEXT,
  stripe_subscription_id TEXT UNIQUE,
  plan                   TEXT,
  status                 TEXT NOT NULL DEFAULT 'trialing'
                             CHECK (status IN ('trialing', 'active', 'past_due', 'canceled', 'incomplete')),
  current_period_end     TIMESTAMPTZ,
  cancel_at_period_end   BOOLEAN NOT NULL DEFAULT FALSE,
  trial_ends_at          TIMESTAMPTZ,
  updated_at             TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ── Helper: membership check for RLS (avoids policy recursion) ─────

CREATE OR REPLACE FUNCTION public.is_workspace_member(ws_id TEXT)
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.workspace_members
    WHERE workspace_id = ws_id
      AND user_id = (auth.jwt() ->> 'sub')
  );
$$;

-- Membership + role check
CREATE OR REPLACE FUNCTION public.workspace_role_of(ws_id TEXT)
RETURNS TEXT
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT role FROM public.workspace_members
   WHERE workspace_id = ws_id
     AND user_id = (auth.jwt() ->> 'sub')
   LIMIT 1;
$$;

-- ── Atomic workspace creation ─────────────────────────────────────
-- Bypasses RLS via SECURITY DEFINER so a newly-authenticated user with
-- zero existing memberships can create their first workspace and be
-- enrolled as brand_owner in a single transaction.

CREATE OR REPLACE FUNCTION public.create_workspace_with_owner(
  p_mode TEXT,
  p_name TEXT,
  p_slug TEXT,
  p_currency TEXT DEFAULT 'USD'
) RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id TEXT;
  v_ws_id   TEXT;
BEGIN
  v_user_id := auth.jwt() ->> 'sub';
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  IF p_mode NOT IN ('managed', 'independent') THEN
    RAISE EXCEPTION 'Invalid workspace mode: %', p_mode;
  END IF;

  INSERT INTO public.workspaces (mode, name, slug, base_currency, created_by)
  VALUES (p_mode, p_name, p_slug, p_currency, v_user_id)
  RETURNING id INTO v_ws_id;

  INSERT INTO public.workspace_members (workspace_id, user_id, role)
  VALUES (v_ws_id, v_user_id, 'brand_owner');

  -- Every independent workspace gets a 14-day trial subscription record
  -- so gating in the layout has something to read even before Stripe
  -- wires in.
  IF p_mode = 'independent' THEN
    INSERT INTO public.subscriptions (workspace_id, status, trial_ends_at)
    VALUES (v_ws_id, 'trialing', NOW() + INTERVAL '14 days');
  END IF;

  RETURN v_ws_id;
END;
$$;

-- ── Row-level security ────────────────────────────────────────────

ALTER TABLE public.workspaces         ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.workspace_members  ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.workspace_invites  ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.subscriptions      ENABLE ROW LEVEL SECURITY;

-- Drop-and-recreate is safe here since we own every policy in this file.
DROP POLICY IF EXISTS workspaces_select ON public.workspaces;
DROP POLICY IF EXISTS workspaces_update ON public.workspaces;
DROP POLICY IF EXISTS workspaces_delete ON public.workspaces;
DROP POLICY IF EXISTS members_select    ON public.workspace_members;
DROP POLICY IF EXISTS members_insert    ON public.workspace_members;
DROP POLICY IF EXISTS members_update    ON public.workspace_members;
DROP POLICY IF EXISTS members_delete    ON public.workspace_members;
DROP POLICY IF EXISTS invites_select    ON public.workspace_invites;
DROP POLICY IF EXISTS invites_insert    ON public.workspace_invites;
DROP POLICY IF EXISTS invites_delete    ON public.workspace_invites;
DROP POLICY IF EXISTS subs_select       ON public.subscriptions;
DROP POLICY IF EXISTS subs_update       ON public.subscriptions;

-- Workspaces: see workspaces you're a member of
CREATE POLICY workspaces_select ON public.workspaces
  FOR SELECT USING (public.is_workspace_member(id));

CREATE POLICY workspaces_update ON public.workspaces
  FOR UPDATE USING (public.is_workspace_member(id))
             WITH CHECK (public.is_workspace_member(id));

CREATE POLICY workspaces_delete ON public.workspaces
  FOR DELETE USING (public.workspace_role_of(id) IN ('sa_admin', 'brand_owner'));

-- Members: see + write to members of workspaces you belong to
CREATE POLICY members_select ON public.workspace_members
  FOR SELECT USING (public.is_workspace_member(workspace_id));

CREATE POLICY members_insert ON public.workspace_members
  FOR INSERT WITH CHECK (
    public.workspace_role_of(workspace_id) IN ('sa_admin', 'brand_owner')
  );

CREATE POLICY members_update ON public.workspace_members
  FOR UPDATE USING (public.workspace_role_of(workspace_id) IN ('sa_admin', 'brand_owner'));

CREATE POLICY members_delete ON public.workspace_members
  FOR DELETE USING (public.workspace_role_of(workspace_id) IN ('sa_admin', 'brand_owner'));

-- Invites: members of the workspace can see them; owners can create/delete
CREATE POLICY invites_select ON public.workspace_invites
  FOR SELECT USING (public.is_workspace_member(workspace_id));

CREATE POLICY invites_insert ON public.workspace_invites
  FOR INSERT WITH CHECK (
    public.workspace_role_of(workspace_id) IN ('sa_admin', 'brand_owner')
  );

CREATE POLICY invites_delete ON public.workspace_invites
  FOR DELETE USING (
    public.workspace_role_of(workspace_id) IN ('sa_admin', 'brand_owner')
  );

-- Subscriptions: brand_owner can see + update their own workspace's sub
CREATE POLICY subs_select ON public.subscriptions
  FOR SELECT USING (public.is_workspace_member(workspace_id));

CREATE POLICY subs_update ON public.subscriptions
  FOR UPDATE USING (public.workspace_role_of(workspace_id) = 'brand_owner');
