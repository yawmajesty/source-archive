-- ═══════════════════════════════════════════════════════════════════
-- Phase 5: Milestones
--
-- Manual milestones live in this table. Auto-derived milestones
-- (product target_sample_date, target_delivery, stage transitions)
-- are computed at read time from existing product/collection columns
-- so no additional storage is needed for them.
--
-- SAFE TO RE-RUN.
-- ═══════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS public.milestones (
  id            TEXT PRIMARY KEY DEFAULT ('mil-' || replace(gen_random_uuid()::text, '-', '')),
  workspace_id  TEXT NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  collection_id TEXT REFERENCES public.collections(id) ON DELETE CASCADE,
  product_id    TEXT REFERENCES public.brand_products(id) ON DELETE CASCADE,
  title         TEXT NOT NULL,
  date          DATE NOT NULL,
  done_at       TIMESTAMPTZ,
  notes         TEXT,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_by    TEXT
);

CREATE INDEX IF NOT EXISTS idx_milestones_workspace ON public.milestones (workspace_id);
CREATE INDEX IF NOT EXISTS idx_milestones_collection ON public.milestones (collection_id) WHERE collection_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_milestones_product ON public.milestones (product_id) WHERE product_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_milestones_date ON public.milestones (workspace_id, date);

ALTER TABLE public.milestones ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS mil_select ON public.milestones;
DROP POLICY IF EXISTS mil_insert ON public.milestones;
DROP POLICY IF EXISTS mil_update ON public.milestones;
DROP POLICY IF EXISTS mil_delete ON public.milestones;

CREATE POLICY mil_select ON public.milestones
  FOR SELECT USING (public.is_workspace_member(workspace_id));
CREATE POLICY mil_insert ON public.milestones
  FOR INSERT WITH CHECK (public.is_workspace_member(workspace_id));
CREATE POLICY mil_update ON public.milestones
  FOR UPDATE USING (public.is_workspace_member(workspace_id))
             WITH CHECK (public.is_workspace_member(workspace_id));
CREATE POLICY mil_delete ON public.milestones
  FOR DELETE USING (public.is_workspace_member(workspace_id));

DROP TRIGGER IF EXISTS trg_milestones_updated ON public.milestones;
CREATE TRIGGER trg_milestones_updated
  BEFORE UPDATE ON public.milestones
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
