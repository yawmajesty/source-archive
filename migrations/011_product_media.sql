-- ═══════════════════════════════════════════════════════════════════
-- Product media: attributed photos, video, and notes
--
-- Until now every product photo lived in products.images — an untyped
-- jsonb array of URLs with no record of who added it, no way to store a
-- video, and no caption. The client portal and the agency backend both
-- appended to the same array, so a photo the client uploaded was
-- indistinguishable from one we uploaded.
--
-- product_media replaces that with one row per item, carrying its kind
-- (image/video) and who contributed it (agency/client). products.images
-- is kept in sync as a denormalized list of image URLs, because product
-- cards, portal previews and the P&L views still read it.
--
-- Also adds updates.author_role so client notes are attributed the same
-- way as client media.
--
-- SAFE TO RE-RUN.
-- ═══════════════════════════════════════════════════════════════════

-- ── product_media ────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.product_media (
  id               TEXT PRIMARY KEY DEFAULT ('pm-' || replace(gen_random_uuid()::text, '-', '')),
  agency_id        TEXT NOT NULL REFERENCES public.agencies(id) ON DELETE CASCADE,
  product_id       TEXT NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  url              TEXT NOT NULL,
  kind             TEXT NOT NULL DEFAULT 'image' CHECK (kind IN ('image', 'video')),
  uploaded_by_role TEXT NOT NULL CHECK (uploaded_by_role IN ('agency', 'client')),
  uploaded_by_name TEXT,
  caption          TEXT,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_product_media_product ON public.product_media (product_id, created_at);
CREATE INDEX IF NOT EXISTS idx_product_media_agency  ON public.product_media (agency_id);

-- One row per (product, url) so the backfill and re-uploads stay idempotent.
CREATE UNIQUE INDEX IF NOT EXISTS idx_product_media_unique ON public.product_media (product_id, url);

ALTER TABLE public.product_media ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS pmedia_select ON public.product_media;
DROP POLICY IF EXISTS pmedia_insert ON public.product_media;
DROP POLICY IF EXISTS pmedia_update ON public.product_media;
DROP POLICY IF EXISTS pmedia_delete ON public.product_media;

CREATE POLICY pmedia_select ON public.product_media
  FOR SELECT USING (public.is_agency_member(agency_id));
CREATE POLICY pmedia_insert ON public.product_media
  FOR INSERT WITH CHECK (public.is_agency_member(agency_id));
CREATE POLICY pmedia_update ON public.product_media
  FOR UPDATE USING (public.is_agency_member(agency_id))
  WITH CHECK (public.is_agency_member(agency_id));
CREATE POLICY pmedia_delete ON public.product_media
  FOR DELETE USING (public.is_agency_member(agency_id));

-- The public client portal has no Clerk session and reads through the
-- service-role client (lib/portal-data.ts), which bypasses RLS by design.

-- ── backfill from products.images ────────────────────────────────
-- Client uploads have always been written to `<product-id>/client-<ts>-…`
-- by the portal, so that prefix is how we recover attribution for
-- everything uploaded before this table existed.

INSERT INTO public.product_media (agency_id, product_id, url, kind, uploaded_by_role, created_at)
SELECT
  p.agency_id,
  p.id,
  img.url,
  CASE WHEN img.url ~* '\.(mp4|mov|webm|m4v|avi)(\?|$)' THEN 'video' ELSE 'image' END,
  CASE WHEN img.url ILIKE '%/client-%' THEN 'client' ELSE 'agency' END,
  COALESCE(p.created_at, NOW())
FROM public.products p
CROSS JOIN LATERAL jsonb_array_elements_text(
  CASE WHEN jsonb_typeof(p.images) = 'array' THEN p.images ELSE '[]'::jsonb END
) AS img(url)
WHERE img.url <> ''
  AND p.agency_id IS NOT NULL
ON CONFLICT (product_id, url) DO NOTHING;

-- ── updates.author_role ──────────────────────────────────────────
-- Existing rows can't be attributed retroactively (the portal wrote the
-- client's own name into `author`, same column the agency uses), so they
-- default to 'agency'. New rows are tagged at insert time.

ALTER TABLE public.updates
  ADD COLUMN IF NOT EXISTS author_role TEXT NOT NULL DEFAULT 'agency';

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'updates_author_role_check'
  ) THEN
    ALTER TABLE public.updates
      ADD CONSTRAINT updates_author_role_check CHECK (author_role IN ('agency', 'client'));
  END IF;
END $$;
