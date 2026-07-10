-- ═══════════════════════════════════════════════════════════════════
-- Phase 2: Collections + products (brand dashboard side)
--
-- brand_products is a DIFFERENT table from the existing `products`
-- table used by the agency backend — the two shapes are similar but
-- the brand version follows the archive-category taxonomy, has
-- workspace_id + collection_id tenancy, and stores structured spec
-- notes. Kept separate so agency-side data stays untouched.
--
-- SAFE TO RE-RUN.
-- ═══════════════════════════════════════════════════════════════════

-- ── Collections ───────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.collections (
  id                 TEXT PRIMARY KEY DEFAULT ('col-' || replace(gen_random_uuid()::text, '-', '')),
  workspace_id       TEXT NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  name               TEXT NOT NULL,
  season             TEXT,
  description        TEXT,
  cover_image_url    TEXT,
  status             TEXT NOT NULL DEFAULT 'planning'
                       CHECK (status IN ('planning', 'in_development', 'in_production', 'delivered', 'archived')),
  base_currency      TEXT NOT NULL DEFAULT 'USD',
  fx_rates           JSONB NOT NULL DEFAULT '{}'::jsonb,
  kickoff_date       DATE,
  sample_deadline    DATE,
  production_start   DATE,
  ex_factory_target  DATE,
  launch_date        DATE,
  created_at         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_by         TEXT
);

CREATE INDEX IF NOT EXISTS idx_collections_workspace ON public.collections (workspace_id);

-- ── Brand products ────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.brand_products (
  id                  TEXT PRIMARY KEY DEFAULT ('prd-' || replace(gen_random_uuid()::text, '-', '')),
  workspace_id        TEXT NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  collection_id       TEXT NOT NULL REFERENCES public.collections(id) ON DELETE CASCADE,
  name                TEXT NOT NULL,
  style_code          TEXT NOT NULL,
  category            TEXT NOT NULL
                        CHECK (category IN (
                          'active_wear','leather_jackets','denim','outerwear',
                          'luxury_basics','headwear','accessories','leather_bags'
                        )),
  description         TEXT,
  cover_image_url     TEXT,
  gallery_urls        JSONB NOT NULL DEFAULT '[]'::jsonb,
  colorways           JSONB NOT NULL DEFAULT '[]'::jsonb,
  size_range          JSONB NOT NULL DEFAULT '[]'::jsonb,
  target_quantity     INTEGER,
  stage               TEXT NOT NULL DEFAULT 'concept'
                        CHECK (stage IN (
                          'concept','design','tech_pack','sampling',
                          'approved_for_production','in_production',
                          'quality_check','shipped','delivered'
                        )),
  stage_entered_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  target_sample_date  DATE,
  target_delivery     DATE,
  spec_fabric         TEXT,
  spec_trims          TEXT,
  spec_wash           TEXT,
  spec_customization  TEXT,
  spec_packaging      TEXT,
  -- Costing fields — populated fully in Phase 4
  estimated_cost      NUMERIC(12,2),
  cost_currency       TEXT,
  cost_fx_rate        NUMERIC(12,6),
  cost_breakdown      JSONB,
  sale_price_retail   NUMERIC(12,2),
  sale_price_wholesale NUMERIC(12,2),
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_by          TEXT,
  -- Style code uniqueness per workspace (not globally — different
  -- brands can each have DNM-001)
  UNIQUE (workspace_id, style_code)
);

CREATE INDEX IF NOT EXISTS idx_brand_products_collection ON public.brand_products (collection_id);
CREATE INDEX IF NOT EXISTS idx_brand_products_workspace  ON public.brand_products (workspace_id);
CREATE INDEX IF NOT EXISTS idx_brand_products_stage      ON public.brand_products (stage);

-- ── Style-code sequence per (workspace, category) ─────────────────
-- Auto-generates the numeric suffix in "DNM-004" style codes so we
-- don't have to scan for the next free number at insert time.

CREATE TABLE IF NOT EXISTS public.style_code_seq (
  workspace_id TEXT NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  prefix       TEXT NOT NULL,
  last_seq     INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (workspace_id, prefix)
);

CREATE OR REPLACE FUNCTION public.next_style_code(p_ws_id TEXT, p_prefix TEXT)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_seq INTEGER;
BEGIN
  INSERT INTO public.style_code_seq (workspace_id, prefix, last_seq)
  VALUES (p_ws_id, p_prefix, 1)
  ON CONFLICT (workspace_id, prefix)
  DO UPDATE SET last_seq = public.style_code_seq.last_seq + 1
  RETURNING last_seq INTO v_seq;
  RETURN p_prefix || '-' || LPAD(v_seq::text, 3, '0');
END;
$$;

-- ── Row-level security ────────────────────────────────────────────

ALTER TABLE public.collections    ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.brand_products ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.style_code_seq ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS collections_select ON public.collections;
DROP POLICY IF EXISTS collections_insert ON public.collections;
DROP POLICY IF EXISTS collections_update ON public.collections;
DROP POLICY IF EXISTS collections_delete ON public.collections;
DROP POLICY IF EXISTS bp_select          ON public.brand_products;
DROP POLICY IF EXISTS bp_insert          ON public.brand_products;
DROP POLICY IF EXISTS bp_update          ON public.brand_products;
DROP POLICY IF EXISTS bp_delete          ON public.brand_products;
DROP POLICY IF EXISTS scs_select         ON public.style_code_seq;

-- Collections — any member of the workspace can read + write.
-- Delete is restricted to sa_admin / brand_owner (matches mode-policy).
CREATE POLICY collections_select ON public.collections
  FOR SELECT USING (public.is_workspace_member(workspace_id));

CREATE POLICY collections_insert ON public.collections
  FOR INSERT WITH CHECK (public.is_workspace_member(workspace_id));

CREATE POLICY collections_update ON public.collections
  FOR UPDATE USING (public.is_workspace_member(workspace_id))
             WITH CHECK (public.is_workspace_member(workspace_id));

CREATE POLICY collections_delete ON public.collections
  FOR DELETE USING (public.workspace_role_of(workspace_id) IN ('sa_admin', 'brand_owner'));

-- Brand products — same shape as collections
CREATE POLICY bp_select ON public.brand_products
  FOR SELECT USING (public.is_workspace_member(workspace_id));

CREATE POLICY bp_insert ON public.brand_products
  FOR INSERT WITH CHECK (public.is_workspace_member(workspace_id));

CREATE POLICY bp_update ON public.brand_products
  FOR UPDATE USING (public.is_workspace_member(workspace_id))
             WITH CHECK (public.is_workspace_member(workspace_id));

CREATE POLICY bp_delete ON public.brand_products
  FOR DELETE USING (public.is_workspace_member(workspace_id));

-- Sequence table — read is enough for the RPC; writes only happen
-- inside the SECURITY DEFINER function above.
CREATE POLICY scs_select ON public.style_code_seq
  FOR SELECT USING (public.is_workspace_member(workspace_id));

-- ── Timestamps ────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.touch_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_collections_updated    ON public.collections;
DROP TRIGGER IF EXISTS trg_brand_products_updated ON public.brand_products;

CREATE TRIGGER trg_collections_updated
  BEFORE UPDATE ON public.collections
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

CREATE TRIGGER trg_brand_products_updated
  BEFORE UPDATE ON public.brand_products
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
