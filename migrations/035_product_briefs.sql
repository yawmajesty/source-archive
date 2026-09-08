-- ═══════════════════════════════════════════════════════════════════
-- Product briefs from the client.
--
-- Adding a garment to a collection was an agency-only act, so a client
-- who wanted something new sent an email and someone retyped it. This
-- lets them fill the brief in themselves and have it land in their
-- collection as a real product.
--
-- The brief is kept as its own record rather than flattened onto the
-- product. The product is what the agency then works on and edits; the
-- brief is what the client actually asked for, and the two need to stay
-- separately readable when they later disagree.
--
-- SAFE TO RE-RUN.
-- ═══════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS public.product_briefs (
  id           TEXT PRIMARY KEY DEFAULT ('pb-' || replace(gen_random_uuid()::text, '-', '')),
  agency_id    TEXT NOT NULL REFERENCES public.agencies(id) ON DELETE CASCADE,
  client_id    TEXT NOT NULL REFERENCES public.clients(id)  ON DELETE CASCADE,
  project_id   TEXT NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  -- Set once the product is created from it.
  product_id   TEXT REFERENCES public.products(id) ON DELETE SET NULL,

  name         TEXT NOT NULL,
  category     TEXT,
  description  TEXT,

  -- What it should be
  fabric_notes    TEXT,
  fit_notes       TEXT,
  fit_type        TEXT[] NOT NULL DEFAULT '{}',
  size_range      TEXT,
  colourways      TEXT,
  trims_notes     TEXT,
  print_notes     TEXT,
  packaging_notes TEXT,

  -- Commercials
  target_quantity INTEGER,
  target_price    NUMERIC(12,2),
  currency        TEXT NOT NULL DEFAULT 'USD',
  needed_by       DATE,

  reference_urls  TEXT[] NOT NULL DEFAULT '{}',
  notes           TEXT,

  status       TEXT NOT NULL DEFAULT 'submitted'
               CHECK (status IN ('draft', 'submitted', 'accepted', 'declined')),

  -- The portal has no accounts for link-holders, so this is a name they
  -- typed, stored as given rather than dressed up as an identity.
  submitted_by_name  TEXT,
  submitted_by_email TEXT,

  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_pbriefs_client  ON public.product_briefs (client_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_pbriefs_project ON public.product_briefs (project_id);
CREATE INDEX IF NOT EXISTS idx_pbriefs_product ON public.product_briefs (product_id);

-- Reference photos, filed by what they're showing — the same shape the
-- shoot brief uses, for the same reason: one undifferentiated pile of
-- images makes the reader guess which part each one is about.
CREATE TABLE IF NOT EXISTS public.product_brief_media (
  id           TEXT PRIMARY KEY DEFAULT ('bm-' || replace(gen_random_uuid()::text, '-', '')),
  agency_id    TEXT NOT NULL REFERENCES public.agencies(id) ON DELETE CASCADE,
  brief_id     TEXT NOT NULL REFERENCES public.product_briefs(id) ON DELETE CASCADE,
  slot         TEXT NOT NULL DEFAULT 'reference',
  image_url    TEXT NOT NULL,
  storage_path TEXT,
  note         TEXT,
  position     INTEGER NOT NULL DEFAULT 0,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_pbmedia_brief ON public.product_brief_media (brief_id, slot, position);

-- Which fabrics from the library the client picked, if any were
-- published to them.
CREATE TABLE IF NOT EXISTS public.product_brief_fabrics (
  brief_id   TEXT NOT NULL REFERENCES public.product_briefs(id) ON DELETE CASCADE,
  fabric_id  TEXT NOT NULL REFERENCES public.fabrics(id) ON DELETE CASCADE,
  PRIMARY KEY (brief_id, fabric_id)
);

-- ── RLS ───────────────────────────────────────────────────────────
-- Agency members read through the client gate. Writes come from the
-- portal via the service-role client, which checks portal access
-- itself — no insert policy is granted, deliberately.

ALTER TABLE public.product_briefs       ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.product_brief_media  ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.product_brief_fabrics ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS pbriefs_select ON public.product_briefs;
DROP POLICY IF EXISTS pbriefs_write  ON public.product_briefs;
CREATE POLICY pbriefs_select ON public.product_briefs
  FOR SELECT USING (public.is_agency_member(agency_id)
                AND public.member_sees_client(agency_id, client_id));
CREATE POLICY pbriefs_write ON public.product_briefs
  FOR ALL USING (public.has_agency_permission(agency_id, 'product.edit')
             AND public.member_sees_client(agency_id, client_id))
      WITH CHECK (public.has_agency_permission(agency_id, 'product.edit')
             AND public.member_sees_client(agency_id, client_id));

DROP POLICY IF EXISTS pbmedia_select ON public.product_brief_media;
CREATE POLICY pbmedia_select ON public.product_brief_media
  FOR SELECT USING (public.is_agency_member(agency_id));

DROP POLICY IF EXISTS pbfabrics_select ON public.product_brief_fabrics;
CREATE POLICY pbfabrics_select ON public.product_brief_fabrics
  FOR SELECT USING (EXISTS (
    SELECT 1 FROM public.product_briefs b
    WHERE b.id = brief_id AND public.is_agency_member(b.agency_id)));

DROP TRIGGER IF EXISTS touch_product_briefs ON public.product_briefs;
CREATE TRIGGER touch_product_briefs BEFORE UPDATE ON public.product_briefs
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- Storage for the client's reference photos.
INSERT INTO storage.buckets (id, name, public)
VALUES ('brief-media', 'brief-media', true)
ON CONFLICT (id) DO NOTHING;

DROP POLICY IF EXISTS brief_media_select ON storage.objects;
DROP POLICY IF EXISTS brief_media_insert ON storage.objects;
DROP POLICY IF EXISTS brief_media_delete ON storage.objects;
CREATE POLICY brief_media_select ON storage.objects
  FOR SELECT USING (bucket_id = 'brief-media');
CREATE POLICY brief_media_insert ON storage.objects
  FOR INSERT WITH CHECK (bucket_id = 'brief-media');
CREATE POLICY brief_media_delete ON storage.objects
  FOR DELETE USING (bucket_id = 'brief-media');
