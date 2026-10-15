-- ─────────────────────────────────────────────────────────────
-- Design and tech pack, as phases a product can opt into.
--
-- Some clients buy design and a tech pack, most do not. Making them global
-- stages would put two empty steps on every product's timeline; leaving
-- them out entirely means the work that matters most on the products that
-- do have them is invisible. So they are flags, and the timeline is
-- assembled per product.
--
-- Safe to run more than once.
-- ─────────────────────────────────────────────────────────────

ALTER TABLE public.products
  ADD COLUMN IF NOT EXISTS needs_design   BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS needs_techpack BOOLEAN NOT NULL DEFAULT FALSE;

-- ── The tech pack itself, versioned ──
--
-- A row per version rather than a column on the product, because the whole
-- point is that a change supersedes what was signed: "we are sampling from
-- v2" is only meaningful if v1 is still on record with its signature
-- attached.
--
-- Two signatures, because the request is a sign-off on both sides. Ours
-- says the pack is complete and correct; theirs says the specification is
-- what they want built. A sample should be cut from a version that carries
-- both.
CREATE TABLE IF NOT EXISTS public.product_techpacks (
  id            TEXT PRIMARY KEY DEFAULT ('tp-' || replace(gen_random_uuid()::text, '-', '')),
  agency_id     TEXT NOT NULL REFERENCES public.agencies(id) ON DELETE CASCADE,
  product_id    TEXT NOT NULL,
  client_id     TEXT,

  version       INTEGER NOT NULL DEFAULT 1,
  title         TEXT,
  -- What changed in this version. The reason a re-sign is being asked for.
  change_note   TEXT,

  file_url      TEXT NOT NULL,
  file_path     TEXT,
  file_name     TEXT,

  -- 'agency' or 'client' — either side may be the one holding the pack.
  uploaded_by   TEXT NOT NULL DEFAULT 'agency',
  uploader_name TEXT,

  agency_signed_at   TIMESTAMPTZ,
  agency_signed_by   TEXT,
  client_signed_at   TIMESTAMPTZ,
  -- Typed by whoever ticked the box. A name against a signature is worth
  -- more than a timestamp on its own.
  client_signed_name TEXT,

  -- Set when a later version replaces this one.
  superseded_at TIMESTAMPTZ,

  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_techpacks_product
  ON public.product_techpacks (agency_id, product_id, version DESC);

-- One row per version of a product's pack, so two uploads cannot both
-- claim to be v3.
CREATE UNIQUE INDEX IF NOT EXISTS idx_techpacks_version
  ON public.product_techpacks (product_id, version);

ALTER TABLE public.product_techpacks ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS techpacks_agency_select ON public.product_techpacks;
DROP POLICY IF EXISTS techpacks_agency_insert ON public.product_techpacks;
DROP POLICY IF EXISTS techpacks_agency_update ON public.product_techpacks;
DROP POLICY IF EXISTS techpacks_agency_delete ON public.product_techpacks;

CREATE POLICY techpacks_agency_select ON public.product_techpacks
  FOR SELECT USING (public.is_agency_member(agency_id));
CREATE POLICY techpacks_agency_insert ON public.product_techpacks
  FOR INSERT WITH CHECK (public.is_agency_member(agency_id));
CREATE POLICY techpacks_agency_update ON public.product_techpacks
  FOR UPDATE USING (public.is_agency_member(agency_id))
  WITH CHECK (public.is_agency_member(agency_id));
CREATE POLICY techpacks_agency_delete ON public.product_techpacks
  FOR DELETE USING (public.is_agency_member(agency_id));

-- The client portal has no Clerk session, so it reads and signs through
-- the service-role client with its own ownership check in the action —
-- the same arrangement portal_files and portal_visits already use.
