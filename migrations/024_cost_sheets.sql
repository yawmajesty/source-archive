-- ═══════════════════════════════════════════════════════════════════
-- Production cost sheets
--
-- The breakdown behind a quote: every fabric, every trim, and the factory's
-- CMT, priced per garment and rolled up to a run. A garment shell using two
-- fabrics records them as two lines, each with its own supplier, item number,
-- composition, bulk price and consumption — the same for lining.
--
-- Sheets can be shared with a factory by link so they fill in their own
-- prices, which is the point: a filled-in breakdown is what makes a
-- negotiation about numbers rather than a single total.
--
-- SAFE TO RE-RUN.
-- ═══════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS public.product_cost_sheets (
  id                TEXT PRIMARY KEY DEFAULT ('cs-' || replace(gen_random_uuid()::text, '-', '')),
  agency_id         TEXT NOT NULL REFERENCES public.agencies(id) ON DELETE CASCADE,
  product_id        TEXT NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,

  title             TEXT NOT NULL DEFAULT 'Cost sheet',
  currency          TEXT NOT NULL DEFAULT 'USD',
  quantity          INTEGER NOT NULL DEFAULT 100 CHECK (quantity > 0),

  -- The factory's own quote for cut, make, trim.
  labor_cmt         NUMERIC(12,2),
  labor_notes       TEXT,

  -- Everything after the factory gate. Kept separate so the negotiable part
  -- (materials + CMT) stays legible on its own.
  freight_per_unit  NUMERIC(12,2),
  duty_pct          NUMERIC(6,3),
  overhead_pct      NUMERIC(6,3),
  target_margin_pct NUMERIC(6,3),

  status            TEXT NOT NULL DEFAULT 'draft'
                      CHECK (status IN ('draft', 'awaiting_factory', 'received', 'final')),

  -- Share link. Null until shared; revoking is setting it back to null.
  share_token       TEXT UNIQUE,
  shared_at         TIMESTAMPTZ,
  share_expires_at  TIMESTAMPTZ,
  factory_name      TEXT,

  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_cost_sheets_product ON public.product_cost_sheets (product_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_cost_sheets_agency  ON public.product_cost_sheets (agency_id);

DROP TRIGGER IF EXISTS trg_cost_sheets_updated ON public.product_cost_sheets;
CREATE TRIGGER trg_cost_sheets_updated
  BEFORE UPDATE ON public.product_cost_sheets
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- ── lines ────────────────────────────────────────────────────────
-- One row per material. `section` separates shell from lining from trims so
-- the sheet reads the way a factory quotes.

CREATE TABLE IF NOT EXISTS public.cost_sheet_lines (
  id           TEXT PRIMARY KEY DEFAULT ('csl-' || replace(gen_random_uuid()::text, '-', '')),
  sheet_id     TEXT NOT NULL REFERENCES public.product_cost_sheets(id) ON DELETE CASCADE,

  section      TEXT NOT NULL DEFAULT 'shell'
                 CHECK (section IN ('shell', 'lining', 'trim', 'other')),
  label        TEXT NOT NULL,

  supplier     TEXT,
  item_number  TEXT,
  composition  TEXT,

  unit_price   NUMERIC(12,4),
  unit         TEXT NOT NULL DEFAULT 'metre'
                 CHECK (unit IN ('metre', 'yard', 'sqft', 'kg', 'piece', 'set')),
  consumption  NUMERIC(12,4),

  -- Set when this line has been pushed into the fabric library, so a second
  -- save updates that fabric instead of creating a duplicate.
  fabric_id    TEXT REFERENCES public.fabrics(id) ON DELETE SET NULL,

  position     INTEGER NOT NULL DEFAULT 0,
  notes        TEXT,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_cost_sheet_lines_sheet ON public.cost_sheet_lines (sheet_id, section, position);

-- ── RLS ──────────────────────────────────────────────────────────
-- Costing is margin data, so reading a sheet needs cost.view. The factory
-- link is served through the service-role client, which bypasses RLS and
-- resolves the token itself.

ALTER TABLE public.product_cost_sheets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cost_sheet_lines    ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS cs_all ON public.product_cost_sheets;
CREATE POLICY cs_all ON public.product_cost_sheets FOR ALL
  USING (public.has_agency_permission(agency_id, 'cost.view'))
  WITH CHECK (public.has_agency_permission(agency_id, 'cost.view'));

DROP POLICY IF EXISTS csl_all ON public.cost_sheet_lines;
CREATE POLICY csl_all ON public.cost_sheet_lines FOR ALL
  USING (EXISTS (
    SELECT 1 FROM public.product_cost_sheets s
    WHERE s.id = sheet_id AND public.has_agency_permission(s.agency_id, 'cost.view')
  ))
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.product_cost_sheets s
    WHERE s.id = sheet_id AND public.has_agency_permission(s.agency_id, 'cost.view')
  ));
