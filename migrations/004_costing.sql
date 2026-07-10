-- ═══════════════════════════════════════════════════════════════════
-- Phase 4: Costing config
--
-- brand_products already has the costing fields from Phase 2
-- (estimated_cost, cost_currency, cost_fx_rate, cost_breakdown jsonb,
--  sale_price_retail, sale_price_wholesale). Collections already have
-- base_currency + fx_rates. This migration only adds:
--   collections.target_margin_pct  — used to flag underperforming
--                                     products in the rollup
--
-- SAFE TO RE-RUN.
-- ═══════════════════════════════════════════════════════════════════

ALTER TABLE public.collections
  ADD COLUMN IF NOT EXISTS target_margin_pct NUMERIC(5,2) NOT NULL DEFAULT 60.00;
