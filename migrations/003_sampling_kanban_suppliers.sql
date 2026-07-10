-- ═══════════════════════════════════════════════════════════════════
-- Phase 3: Sampling + suppliers
--
-- Adds:
--   sample_rounds        — per-product sampling lifecycle
--   sample_round_comments — threaded feedback per round
--   suppliers             — workspace-scoped factory directory
-- Plus supplier assignment on brand_products and on sample_rounds.
--
-- SAFE TO RE-RUN.
-- ═══════════════════════════════════════════════════════════════════

-- ── Suppliers ─────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.suppliers (
  id             TEXT PRIMARY KEY DEFAULT ('sup-' || replace(gen_random_uuid()::text, '-', '')),
  workspace_id   TEXT NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  name           TEXT NOT NULL,
  country        TEXT,
  city           TEXT,
  contact_name   TEXT,
  contact_email  TEXT,
  contact_phone  TEXT,
  specialties    JSONB NOT NULL DEFAULT '[]'::jsonb,   -- array of category keys or free text
  quote_currency TEXT DEFAULT 'USD',
  lead_time_notes TEXT,
  notes          TEXT,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_by     TEXT
);

CREATE INDEX IF NOT EXISTS idx_suppliers_workspace ON public.suppliers (workspace_id);

-- ── brand_products: supplier link ─────────────────────────────────

ALTER TABLE public.brand_products
  ADD COLUMN IF NOT EXISTS supplier_id TEXT
    REFERENCES public.suppliers(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_brand_products_supplier ON public.brand_products (supplier_id);

-- ── Sample rounds ─────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.sample_rounds (
  id                TEXT PRIMARY KEY DEFAULT ('smp-' || replace(gen_random_uuid()::text, '-', '')),
  workspace_id      TEXT NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  product_id        TEXT NOT NULL REFERENCES public.brand_products(id) ON DELETE CASCADE,
  supplier_id       TEXT REFERENCES public.suppliers(id) ON DELETE SET NULL,
  label             TEXT NOT NULL,
  sort_order        INTEGER NOT NULL DEFAULT 0,
  status            TEXT NOT NULL DEFAULT 'requested'
                      CHECK (status IN (
                        'requested','in_progress','shipped','received',
                        'under_review','approved','rejected_revise'
                      )),
  requested_at      DATE,
  eta_at            DATE,
  shipped_at        DATE,
  received_at       DATE,
  tracking_number   TEXT,
  carrier           TEXT,
  photo_urls        JSONB NOT NULL DEFAULT '[]'::jsonb,
  revision_summary  TEXT,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_by        TEXT
);

CREATE INDEX IF NOT EXISTS idx_sample_rounds_product ON public.sample_rounds (product_id);
CREATE INDEX IF NOT EXISTS idx_sample_rounds_workspace ON public.sample_rounds (workspace_id);

-- ── Sample round comments (feedback thread) ───────────────────────

CREATE TABLE IF NOT EXISTS public.sample_round_comments (
  id               TEXT PRIMARY KEY DEFAULT ('cmt-' || replace(gen_random_uuid()::text, '-', '')),
  workspace_id     TEXT NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  sample_round_id  TEXT NOT NULL REFERENCES public.sample_rounds(id) ON DELETE CASCADE,
  user_id          TEXT NOT NULL,
  body             TEXT NOT NULL,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_sample_comments_round ON public.sample_round_comments (sample_round_id, created_at);

-- ── RLS ───────────────────────────────────────────────────────────

ALTER TABLE public.suppliers            ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sample_rounds        ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sample_round_comments ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS sup_select ON public.suppliers;
DROP POLICY IF EXISTS sup_insert ON public.suppliers;
DROP POLICY IF EXISTS sup_update ON public.suppliers;
DROP POLICY IF EXISTS sup_delete ON public.suppliers;
DROP POLICY IF EXISTS sr_select  ON public.sample_rounds;
DROP POLICY IF EXISTS sr_insert  ON public.sample_rounds;
DROP POLICY IF EXISTS sr_update  ON public.sample_rounds;
DROP POLICY IF EXISTS sr_delete  ON public.sample_rounds;
DROP POLICY IF EXISTS src_select ON public.sample_round_comments;
DROP POLICY IF EXISTS src_insert ON public.sample_round_comments;
DROP POLICY IF EXISTS src_delete ON public.sample_round_comments;

CREATE POLICY sup_select ON public.suppliers
  FOR SELECT USING (public.is_workspace_member(workspace_id));
CREATE POLICY sup_insert ON public.suppliers
  FOR INSERT WITH CHECK (public.is_workspace_member(workspace_id));
CREATE POLICY sup_update ON public.suppliers
  FOR UPDATE USING (public.is_workspace_member(workspace_id))
             WITH CHECK (public.is_workspace_member(workspace_id));
CREATE POLICY sup_delete ON public.suppliers
  FOR DELETE USING (public.is_workspace_member(workspace_id));

CREATE POLICY sr_select ON public.sample_rounds
  FOR SELECT USING (public.is_workspace_member(workspace_id));
CREATE POLICY sr_insert ON public.sample_rounds
  FOR INSERT WITH CHECK (public.is_workspace_member(workspace_id));
CREATE POLICY sr_update ON public.sample_rounds
  FOR UPDATE USING (public.is_workspace_member(workspace_id))
             WITH CHECK (public.is_workspace_member(workspace_id));
CREATE POLICY sr_delete ON public.sample_rounds
  FOR DELETE USING (public.is_workspace_member(workspace_id));

CREATE POLICY src_select ON public.sample_round_comments
  FOR SELECT USING (public.is_workspace_member(workspace_id));
CREATE POLICY src_insert ON public.sample_round_comments
  FOR INSERT WITH CHECK (
    public.is_workspace_member(workspace_id)
    AND (user_id = (auth.jwt() ->> 'sub'))
  );
-- Comments are deletable only by their author.
CREATE POLICY src_delete ON public.sample_round_comments
  FOR DELETE USING (user_id = (auth.jwt() ->> 'sub'));

-- ── updated_at triggers ───────────────────────────────────────────

DROP TRIGGER IF EXISTS trg_suppliers_updated       ON public.suppliers;
DROP TRIGGER IF EXISTS trg_sample_rounds_updated   ON public.sample_rounds;

CREATE TRIGGER trg_suppliers_updated
  BEFORE UPDATE ON public.suppliers
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

CREATE TRIGGER trg_sample_rounds_updated
  BEFORE UPDATE ON public.sample_rounds
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
