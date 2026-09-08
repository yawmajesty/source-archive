-- ═══════════════════════════════════════════════════════════════════
-- Moodboards.
--
-- A client-facing canvas: drop images anywhere, move them around, and
-- attach any of them to a product as a fabric, a trim, a customization
-- or just a photography reference.
--
-- Position is stored on the item rather than derived from an ordering,
-- because the whole point is that the board is spatial — two images side
-- by side means something a list can't express. x/y are unbounded so the
-- board grows in every direction as things are placed.
--
-- Links are their own table: one reference image often applies to
-- several products (a colour direction across a capsule), and squeezing
-- that onto the item as a single product_id would force a choice that
-- doesn't exist in the client's head.
--
-- SAFE TO RE-RUN.
-- ═══════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS public.moodboards (
  id          TEXT PRIMARY KEY DEFAULT ('mb-' || replace(gen_random_uuid()::text, '-', '')),
  agency_id   TEXT NOT NULL REFERENCES public.agencies(id) ON DELETE CASCADE,
  client_id   TEXT NOT NULL REFERENCES public.clients(id)  ON DELETE CASCADE,
  project_id  TEXT REFERENCES public.projects(id) ON DELETE SET NULL,

  title       TEXT NOT NULL DEFAULT 'Moodboard',
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_mb_client ON public.moodboards (client_id);

CREATE TABLE IF NOT EXISTS public.moodboard_items (
  id           TEXT PRIMARY KEY DEFAULT ('mi-' || replace(gen_random_uuid()::text, '-', '')),
  agency_id    TEXT NOT NULL REFERENCES public.agencies(id) ON DELETE CASCADE,
  board_id     TEXT NOT NULL REFERENCES public.moodboards(id) ON DELETE CASCADE,

  image_url    TEXT NOT NULL,
  storage_path TEXT,
  caption      TEXT,
  source_url   TEXT,

  -- Board coordinates. Deliberately signed and unconstrained.
  x            NUMERIC(12,2) NOT NULL DEFAULT 0,
  y            NUMERIC(12,2) NOT NULL DEFAULT 0,
  width        NUMERIC(12,2) NOT NULL DEFAULT 260,
  z            INTEGER NOT NULL DEFAULT 0,

  added_by_name TEXT,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_mi_board ON public.moodboard_items (board_id);

CREATE TABLE IF NOT EXISTS public.moodboard_links (
  id         TEXT PRIMARY KEY DEFAULT ('ml-' || replace(gen_random_uuid()::text, '-', '')),
  agency_id  TEXT NOT NULL REFERENCES public.agencies(id) ON DELETE CASCADE,
  item_id    TEXT NOT NULL REFERENCES public.moodboard_items(id) ON DELETE CASCADE,
  product_id TEXT NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,

  -- What the image is being used FOR on that product.
  link_type  TEXT NOT NULL DEFAULT 'reference'
             CHECK (link_type IN ('fabric', 'trim', 'customization', 'colour',
                                  'silhouette', 'photography', 'reference')),
  note       TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  -- The same image can serve one purpose per product, not three.
  UNIQUE (item_id, product_id, link_type)
);

CREATE INDEX IF NOT EXISTS idx_ml_item    ON public.moodboard_links (item_id);
CREATE INDEX IF NOT EXISTS idx_ml_product ON public.moodboard_links (product_id);

-- ── RLS ───────────────────────────────────────────────────────────
-- Agency members read and write through the same client gate as
-- everything else. The portal has no Clerk session at all, so its reads
-- and writes go through the service-role client in the server actions,
-- which check the portal's own access rules first.

ALTER TABLE public.moodboards       ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.moodboard_items  ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.moodboard_links  ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS mb_select ON public.moodboards;
DROP POLICY IF EXISTS mb_write  ON public.moodboards;
DROP POLICY IF EXISTS mi_select ON public.moodboard_items;
DROP POLICY IF EXISTS mi_write  ON public.moodboard_items;
DROP POLICY IF EXISTS ml_select ON public.moodboard_links;
DROP POLICY IF EXISTS ml_write  ON public.moodboard_links;

CREATE POLICY mb_select ON public.moodboards
  FOR SELECT USING (public.is_agency_member(agency_id)
                AND public.member_sees_client(agency_id, client_id));
CREATE POLICY mb_write ON public.moodboards
  FOR ALL USING (public.is_agency_member(agency_id)
             AND public.member_sees_client(agency_id, client_id))
      WITH CHECK (public.is_agency_member(agency_id)
             AND public.member_sees_client(agency_id, client_id));

CREATE POLICY mi_select ON public.moodboard_items
  FOR SELECT USING (public.is_agency_member(agency_id));
CREATE POLICY mi_write ON public.moodboard_items
  FOR ALL USING (public.is_agency_member(agency_id))
      WITH CHECK (public.is_agency_member(agency_id));

CREATE POLICY ml_select ON public.moodboard_links
  FOR SELECT USING (public.is_agency_member(agency_id));
CREATE POLICY ml_write ON public.moodboard_links
  FOR ALL USING (public.is_agency_member(agency_id))
      WITH CHECK (public.is_agency_member(agency_id));

DROP TRIGGER IF EXISTS touch_moodboards ON public.moodboards;
CREATE TRIGGER touch_moodboards BEFORE UPDATE ON public.moodboards
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

DROP TRIGGER IF EXISTS touch_moodboard_items ON public.moodboard_items;
CREATE TRIGGER touch_moodboard_items BEFORE UPDATE ON public.moodboard_items
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- ── Storage ───────────────────────────────────────────────────────
-- Same shape as product-media: public bucket, written from the portal
-- which has no session. Path scoping is enforced in createUploadTicket.

INSERT INTO storage.buckets (id, name, public)
VALUES ('moodboard-media', 'moodboard-media', true)
ON CONFLICT (id) DO NOTHING;

DROP POLICY IF EXISTS moodboard_public_select ON storage.objects;
DROP POLICY IF EXISTS moodboard_public_insert ON storage.objects;
DROP POLICY IF EXISTS moodboard_public_update ON storage.objects;
DROP POLICY IF EXISTS moodboard_public_delete ON storage.objects;

CREATE POLICY moodboard_public_select ON storage.objects
  FOR SELECT USING (bucket_id = 'moodboard-media');
CREATE POLICY moodboard_public_insert ON storage.objects
  FOR INSERT WITH CHECK (bucket_id = 'moodboard-media');
CREATE POLICY moodboard_public_update ON storage.objects
  FOR UPDATE USING (bucket_id = 'moodboard-media');
CREATE POLICY moodboard_public_delete ON storage.objects
  FOR DELETE USING (bucket_id = 'moodboard-media');
