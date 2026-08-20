-- ═══════════════════════════════════════════════════════════════════
-- Fabric library
--
-- Answers the single most common question an emerging brand asks. Filterable
-- by what a new brand actually knows — price, MOQ, lead time — rather than by
-- what they don't (GSM, hand-feel, construction).
--
-- Two audiences, one table. The portal shows the full spec including our cost
-- and mill notes; the future public calculator on sourcearchive.studio shows
-- category, weight, hand-feel and an indicative band only. `our_cost_usd` and
-- `mill_notes` are the internal-only columns and must never be selected into
-- a public read.
--
-- Entries are unpublished by default: a half-populated library signals we
-- lack depth, so nothing is visible to clients until it is deliberately
-- published, one fabric at a time.
--
-- SAFE TO RE-RUN.
-- ═══════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS public.fabrics (
  id                   TEXT PRIMARY KEY DEFAULT ('fab-' || replace(gen_random_uuid()::text, '-', '')),
  agency_id            TEXT NOT NULL REFERENCES public.agencies(id) ON DELETE CASCADE,

  -- Identity
  name                 TEXT NOT NULL,
  category             TEXT NOT NULL,            -- jersey, fleece, denim, twill, shell, canvas, hide…
  composition          TEXT,                     -- "100% organic cotton", "80/20 cotton poly"
  gsm                  INTEGER,                  -- weight; null for hides, which use sq ft
  mill                 TEXT,

  -- What it feels like. Prose, because a founder can't read a spec sheet.
  hand_feel            TEXT,
  stretch              TEXT,                     -- none | 2-way | 4-way, or a description
  drape                TEXT,

  -- What a brand actually filters on
  price_per_unit_usd   NUMERIC(10,2),
  price_unit           TEXT NOT NULL DEFAULT 'metre' CHECK (price_unit IN ('metre', 'yard', 'sqft', 'kg')),
  price_band           TEXT CHECK (price_band IS NULL OR price_band IN ('$', '$$', '$$$', '$$$$')),
  moq                  NUMERIC(10,2),
  moq_unit             TEXT DEFAULT 'metre',
  lead_time_days       INTEGER,
  stock_status         TEXT NOT NULL DEFAULT 'made_to_order'
                         CHECK (stock_status IN ('in_stock', 'made_to_order', 'deadstock', 'discontinued')),

  -- Typical consumption, so "what this costs you" can be computed:
  -- consumption_per_unit x quantity x price_per_unit_usd
  consumption_per_unit NUMERIC(10,3),

  sustainability       TEXT[] NOT NULL DEFAULT '{}',   -- GOTS, GRS, recycled, deadstock, OEKO-TEX…
  swatch_url           TEXT,
  notes                TEXT,

  -- Internal only. Never expose on a public surface.
  our_cost_usd         NUMERIC(10,2),
  mill_notes           TEXT,

  -- Release gate, same model as the production log.
  is_published         BOOLEAN NOT NULL DEFAULT FALSE,
  published_at         TIMESTAMPTZ,

  created_at           TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at           TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_fabrics_agency    ON public.fabrics (agency_id);
CREATE INDEX IF NOT EXISTS idx_fabrics_category  ON public.fabrics (category);
CREATE INDEX IF NOT EXISTS idx_fabrics_published ON public.fabrics (agency_id) WHERE is_published;

DROP TRIGGER IF EXISTS trg_fabrics_updated ON public.fabrics;
CREATE TRIGGER trg_fabrics_updated
  BEFORE UPDATE ON public.fabrics
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- ── which archive products used it ───────────────────────────────
-- The proof-of-depth link: "used in 7 products you can look at".

CREATE TABLE IF NOT EXISTS public.fabric_products (
  fabric_id  TEXT NOT NULL REFERENCES public.fabrics(id) ON DELETE CASCADE,
  product_id TEXT NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (fabric_id, product_id)
);

CREATE INDEX IF NOT EXISTS idx_fabric_products_product ON public.fabric_products (product_id);

-- ── swatch requests ──────────────────────────────────────────────
-- "Request swatches" has to create a real request, or the library is a
-- catalogue rather than a tool.

CREATE TABLE IF NOT EXISTS public.fabric_swatch_requests (
  id          TEXT PRIMARY KEY DEFAULT ('swr-' || replace(gen_random_uuid()::text, '-', '')),
  agency_id   TEXT NOT NULL REFERENCES public.agencies(id) ON DELETE CASCADE,
  client_id   TEXT REFERENCES public.clients(id) ON DELETE SET NULL,
  fabric_ids  TEXT[] NOT NULL DEFAULT '{}',
  note        TEXT,
  ship_to     TEXT,
  status      TEXT NOT NULL DEFAULT 'requested'
                CHECK (status IN ('requested', 'sent', 'delivered', 'cancelled')),
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_swatch_requests_agency ON public.fabric_swatch_requests (agency_id, created_at DESC);

-- ── RLS ──────────────────────────────────────────────────────────

ALTER TABLE public.fabrics                ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.fabric_products        ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.fabric_swatch_requests ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS fab_select ON public.fabrics;
DROP POLICY IF EXISTS fab_insert ON public.fabrics;
DROP POLICY IF EXISTS fab_update ON public.fabrics;
DROP POLICY IF EXISTS fab_delete ON public.fabrics;

CREATE POLICY fab_select ON public.fabrics FOR SELECT USING (public.is_agency_member(agency_id));
CREATE POLICY fab_insert ON public.fabrics FOR INSERT WITH CHECK (public.is_agency_member(agency_id));
CREATE POLICY fab_update ON public.fabrics FOR UPDATE
  USING (public.is_agency_member(agency_id)) WITH CHECK (public.is_agency_member(agency_id));
CREATE POLICY fab_delete ON public.fabrics FOR DELETE
  USING (public.is_agency_member(agency_id) AND public.agency_role_of(agency_id) IN ('admin', 'team'));

DROP POLICY IF EXISTS fabprod_all ON public.fabric_products;
CREATE POLICY fabprod_all ON public.fabric_products FOR ALL
  USING (EXISTS (SELECT 1 FROM public.fabrics f WHERE f.id = fabric_id AND public.is_agency_member(f.agency_id)))
  WITH CHECK (EXISTS (SELECT 1 FROM public.fabrics f WHERE f.id = fabric_id AND public.is_agency_member(f.agency_id)));

DROP POLICY IF EXISTS swr_all ON public.fabric_swatch_requests;
CREATE POLICY swr_all ON public.fabric_swatch_requests FOR ALL
  USING (public.is_agency_member(agency_id)) WITH CHECK (public.is_agency_member(agency_id));

-- The client portal reads published fabrics through the service-role client
-- (lib/portal-data.ts), which bypasses RLS by design and filters on
-- is_published, exactly as it does for the production log.
