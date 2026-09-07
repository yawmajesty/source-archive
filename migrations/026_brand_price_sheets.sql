-- ═══════════════════════════════════════════════════════════════════
-- Brand price sheets — the standalone pricing calculator.
--
-- Deliberately NOT hung off brand_products: a brand owner signs up to
-- answer "what should I sell this for?" and must be able to answer it
-- before they have created a collection or a product. A sheet can be
-- attached to a product later via product_id, which stays nullable.
--
-- Every input is stored rather than only the result, so a sheet can be
-- reopened and argued with. Money columns are NUMERIC, never float.
--
-- SAFE TO RE-RUN.
-- ═══════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS public.brand_price_sheets (
  id             TEXT PRIMARY KEY DEFAULT ('ps-' || replace(gen_random_uuid()::text, '-', '')),
  workspace_id   TEXT NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  product_id     TEXT REFERENCES public.brand_products(id) ON DELETE SET NULL,

  name           TEXT NOT NULL DEFAULT 'Untitled style',
  currency       TEXT NOT NULL DEFAULT 'USD',
  quantity       INTEGER NOT NULL DEFAULT 100 CHECK (quantity > 0),

  -- Per-garment cost
  materials      NUMERIC(12,2),
  trims          NUMERIC(12,2),
  labour         NUMERIC(12,2),
  packaging      NUMERIC(12,2),
  other_per_unit NUMERIC(12,2),

  -- Getting it here
  freight        NUMERIC(12,2),
  duty_pct       NUMERIC(6,2),

  -- One-offs, spread across the run
  sampling       NUMERIC(12,2),
  tooling        NUMERIC(12,2),

  -- What selling costs
  discount_pct        NUMERIC(6,2) DEFAULT 15,
  payment_fee_pct     NUMERIC(6,2) DEFAULT 2.9,
  returns_pct         NUMERIC(6,2) DEFAULT 8,
  fulfilment_per_unit NUMERIC(12,2),

  -- How they want to price
  target_margin_pct  NUMERIC(6,2) DEFAULT 60,
  wholesale_multiple NUMERIC(6,2) DEFAULT 2,
  retail_multiple    NUMERIC(6,2) DEFAULT 2.2,

  -- The price they settled on, if they settled on one
  chosen_price   NUMERIC(12,2),
  notes          TEXT,

  created_by     TEXT,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_bps_workspace ON public.brand_price_sheets (workspace_id, updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_bps_product   ON public.brand_price_sheets (product_id);

ALTER TABLE public.brand_price_sheets ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS bps_select ON public.brand_price_sheets;
DROP POLICY IF EXISTS bps_insert ON public.brand_price_sheets;
DROP POLICY IF EXISTS bps_update ON public.brand_price_sheets;
DROP POLICY IF EXISTS bps_delete ON public.brand_price_sheets;

-- Pricing is commercially sensitive but it is the workspace's own data,
-- and every member of a brand workspace already sees costing. Same shape
-- as collections: membership is the gate.
CREATE POLICY bps_select ON public.brand_price_sheets
  FOR SELECT USING (public.is_workspace_member(workspace_id));

CREATE POLICY bps_insert ON public.brand_price_sheets
  FOR INSERT WITH CHECK (public.is_workspace_member(workspace_id));

CREATE POLICY bps_update ON public.brand_price_sheets
  FOR UPDATE USING (public.is_workspace_member(workspace_id))
             WITH CHECK (public.is_workspace_member(workspace_id));

CREATE POLICY bps_delete ON public.brand_price_sheets
  FOR DELETE USING (public.is_workspace_member(workspace_id));

DROP TRIGGER IF EXISTS touch_brand_price_sheets ON public.brand_price_sheets;
CREATE TRIGGER touch_brand_price_sheets
  BEFORE UPDATE ON public.brand_price_sheets
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
