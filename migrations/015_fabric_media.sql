-- ═══════════════════════════════════════════════════════════════════
-- Fabric photos
--
-- One swatch image isn't enough to judge a fabric. A brand needs the flat
-- swatch, the drape, the surface up close, and ideally a garment made from
-- it — that last one is what turns the library from a catalogue into
-- evidence of depth.
--
-- Mirrors product_media: same shape, same publish gate, so the same upload
-- helper and gallery patterns work here.
--
-- SAFE TO RE-RUN.
-- ═══════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS public.fabric_media (
  id          TEXT PRIMARY KEY DEFAULT ('fmd-' || replace(gen_random_uuid()::text, '-', '')),
  fabric_id   TEXT NOT NULL REFERENCES public.fabrics(id) ON DELETE CASCADE,
  url         TEXT NOT NULL,
  kind        TEXT NOT NULL DEFAULT 'image' CHECK (kind IN ('image', 'video')),

  -- What the photo shows, so the grid can lead with the right one.
  shot        TEXT NOT NULL DEFAULT 'swatch'
                CHECK (shot IN ('swatch', 'drape', 'detail', 'garment', 'other')),
  caption     TEXT,
  position    INTEGER NOT NULL DEFAULT 0,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_fabric_media_fabric ON public.fabric_media (fabric_id, position, created_at);
CREATE UNIQUE INDEX IF NOT EXISTS idx_fabric_media_unique ON public.fabric_media (fabric_id, url);

ALTER TABLE public.fabric_media ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS fabmedia_all ON public.fabric_media;
CREATE POLICY fabmedia_all ON public.fabric_media FOR ALL
  USING (EXISTS (SELECT 1 FROM public.fabrics f WHERE f.id = fabric_id AND public.is_agency_member(f.agency_id)))
  WITH CHECK (EXISTS (SELECT 1 FROM public.fabrics f WHERE f.id = fabric_id AND public.is_agency_member(f.agency_id)));

-- Backfill: the single swatch_url captured before this table existed becomes
-- the fabric's first photo, so nothing entered so far is lost.
INSERT INTO public.fabric_media (fabric_id, url, kind, shot, position)
SELECT id, swatch_url, 'image', 'swatch', 0
FROM public.fabrics
WHERE swatch_url IS NOT NULL AND swatch_url <> ''
ON CONFLICT (fabric_id, url) DO NOTHING;
