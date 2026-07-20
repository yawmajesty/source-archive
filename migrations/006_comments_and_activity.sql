-- ═══════════════════════════════════════════════════════════════════
-- Phase 6: Comments + Activity
--
-- Two tables:
--   comments        — user-authored threads attached to a collection or
--                     product. Sample-round comments still live in
--                     sample_round_comments (they carry per-round state).
--   activity_events — append-only feed of anything that happened in
--                     the workspace. Written by server actions after
--                     successful mutations. Denormalised summary so
--                     the feed can render without joins.
--
-- SAFE TO RE-RUN.
-- ═══════════════════════════════════════════════════════════════════

-- ── comments ─────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.comments (
  id            TEXT PRIMARY KEY DEFAULT ('cmt-' || replace(gen_random_uuid()::text, '-', '')),
  workspace_id  TEXT NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  collection_id TEXT REFERENCES public.collections(id) ON DELETE CASCADE,
  product_id    TEXT REFERENCES public.brand_products(id) ON DELETE CASCADE,
  user_id       TEXT NOT NULL,
  body          TEXT NOT NULL,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- A comment must be pinned to at least one target — otherwise it has
-- no thread to live in. Product comments are also transitively
-- attached to their collection; enforce that here so per-collection
-- queries don't have to walk products.
ALTER TABLE public.comments
  DROP CONSTRAINT IF EXISTS comments_target_check;
ALTER TABLE public.comments
  ADD CONSTRAINT comments_target_check
  CHECK (collection_id IS NOT NULL OR product_id IS NOT NULL);

CREATE INDEX IF NOT EXISTS idx_comments_workspace ON public.comments (workspace_id);
CREATE INDEX IF NOT EXISTS idx_comments_collection ON public.comments (collection_id) WHERE collection_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_comments_product ON public.comments (product_id) WHERE product_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_comments_recent ON public.comments (workspace_id, created_at DESC);

ALTER TABLE public.comments ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS cmt_select ON public.comments;
DROP POLICY IF EXISTS cmt_insert ON public.comments;
DROP POLICY IF EXISTS cmt_update ON public.comments;
DROP POLICY IF EXISTS cmt_delete ON public.comments;

CREATE POLICY cmt_select ON public.comments
  FOR SELECT USING (public.is_workspace_member(workspace_id));
CREATE POLICY cmt_insert ON public.comments
  FOR INSERT WITH CHECK (
    public.is_workspace_member(workspace_id)
    AND user_id = (auth.jwt() ->> 'sub')
  );
-- Only the author can edit/delete their own comment. Workspace admins
-- can also delete via a permissions check in the server action using
-- the service role — that path is intentionally not in RLS.
CREATE POLICY cmt_update ON public.comments
  FOR UPDATE USING (
    public.is_workspace_member(workspace_id)
    AND user_id = (auth.jwt() ->> 'sub')
  ) WITH CHECK (
    public.is_workspace_member(workspace_id)
    AND user_id = (auth.jwt() ->> 'sub')
  );
CREATE POLICY cmt_delete ON public.comments
  FOR DELETE USING (
    public.is_workspace_member(workspace_id)
    AND user_id = (auth.jwt() ->> 'sub')
  );

DROP TRIGGER IF EXISTS trg_comments_updated ON public.comments;
CREATE TRIGGER trg_comments_updated
  BEFORE UPDATE ON public.comments
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- ── activity_events ──────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.activity_events (
  id            TEXT PRIMARY KEY DEFAULT ('act-' || replace(gen_random_uuid()::text, '-', '')),
  workspace_id  TEXT NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  actor_id      TEXT,     -- Clerk user id, NULL for system-triggered events
  verb          TEXT NOT NULL,
  target_type   TEXT,     -- 'collection' | 'product' | 'sample_round' | 'milestone' | 'comment'
  target_id     TEXT,
  collection_id TEXT REFERENCES public.collections(id) ON DELETE CASCADE,
  product_id    TEXT REFERENCES public.brand_products(id) ON DELETE CASCADE,
  summary       TEXT NOT NULL,
  meta          JSONB,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_activity_workspace ON public.activity_events (workspace_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_activity_collection ON public.activity_events (collection_id, created_at DESC) WHERE collection_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_activity_product ON public.activity_events (product_id, created_at DESC) WHERE product_id IS NOT NULL;

ALTER TABLE public.activity_events ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS act_select ON public.activity_events;
DROP POLICY IF EXISTS act_insert ON public.activity_events;
-- No update/delete policies — activity_events is append-only. Cascading
-- deletes from the target rows are the only removal path.

CREATE POLICY act_select ON public.activity_events
  FOR SELECT USING (public.is_workspace_member(workspace_id));
CREATE POLICY act_insert ON public.activity_events
  FOR INSERT WITH CHECK (public.is_workspace_member(workspace_id));
