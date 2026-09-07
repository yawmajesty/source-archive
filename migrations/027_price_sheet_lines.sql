-- ═══════════════════════════════════════════════════════════════════
-- Bill of materials on a price sheet.
--
-- A garment whose shell uses two fabrics has to record both separately,
-- with their own supplier, price per metre and consumption — a single
-- "fabric cost" number can't be checked against a factory's quote.
--
-- Stored as jsonb rather than a child table on purpose: the lines are
-- only ever read and written as a whole sheet, they are never queried
-- across sheets, and the public calculator has to be able to hand the
-- same shape around without a database at all.
--
-- The existing materials / trims columns stay put so sheets written
-- before this migration still total correctly; buildCost() prefers
-- lines whenever there are any.
--
-- SAFE TO RE-RUN.
-- ═══════════════════════════════════════════════════════════════════

ALTER TABLE public.brand_price_sheets
  ADD COLUMN IF NOT EXISTS lines JSONB NOT NULL DEFAULT '[]'::jsonb;
