-- ═══════════════════════════════════════════════════════════════════
-- Fabric codes, tiers, and the standardised photo pair
--
-- Every fabric gets a unique code generated from two dimensions — tier
-- (Premium / Standard) and fabric type — so a style developed a year from
-- now can reference exactly the same material. Format:
--
--     P-CLW-001   Premium, Cotton/Linen Base Woven, first of its kind
--     S-DNM-014   Standard, Denim, fourteenth
--
-- Numbering is per (agency, tier, category) and allocated by a counter row
-- rather than max()+1, so two people entering fabrics at the same time can
-- never be handed the same code.
--
-- Photos are standardised into a pair: a close-up of the texture and a shot
-- of the colour. Both are what a brand actually judges a fabric on.
--
-- SAFE TO RE-RUN.
-- ═══════════════════════════════════════════════════════════════════

-- ── tier + code ──────────────────────────────────────────────────

ALTER TABLE public.fabrics
  ADD COLUMN IF NOT EXISTS tier TEXT NOT NULL DEFAULT 'standard';

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fabrics_tier_check') THEN
    ALTER TABLE public.fabrics
      ADD CONSTRAINT fabrics_tier_check CHECK (tier IN ('premium', 'standard'));
  END IF;
END $$;

ALTER TABLE public.fabrics
  ADD COLUMN IF NOT EXISTS code TEXT;

-- The code is the durable identifier a tech pack or PO will quote, so it
-- must be unique within the agency.
CREATE UNIQUE INDEX IF NOT EXISTS idx_fabrics_code
  ON public.fabrics (agency_id, code) WHERE code IS NOT NULL;

-- category_code is the short form of the fabric type (CLW, DNM, KJS…).
-- Stored so the code survives any later relabelling of the category itself.
ALTER TABLE public.fabrics
  ADD COLUMN IF NOT EXISTS category_code TEXT;

-- ── atomic code allocation ───────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.fabric_code_counters (
  agency_id     TEXT NOT NULL REFERENCES public.agencies(id) ON DELETE CASCADE,
  tier          TEXT NOT NULL,
  category_code TEXT NOT NULL,
  next_seq      INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (agency_id, tier, category_code)
);

ALTER TABLE public.fabric_code_counters ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS fcc_all ON public.fabric_code_counters;
CREATE POLICY fcc_all ON public.fabric_code_counters FOR ALL
  USING (public.is_agency_member(agency_id))
  WITH CHECK (public.is_agency_member(agency_id));

-- INSERT ... ON CONFLICT DO UPDATE ... RETURNING is atomic, so concurrent
-- callers are serialised on the counter row and each gets a distinct number.
CREATE OR REPLACE FUNCTION public.next_fabric_code(ag_id TEXT, p_tier TEXT, p_cat TEXT)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  seq    INTEGER;
  prefix TEXT;
BEGIN
  IF p_tier NOT IN ('premium', 'standard') THEN
    RAISE EXCEPTION 'Unknown tier %', p_tier;
  END IF;
  IF p_cat IS NULL OR p_cat = '' THEN
    RAISE EXCEPTION 'A category code is required';
  END IF;

  prefix := CASE WHEN p_tier = 'premium' THEN 'P' ELSE 'S' END;

  INSERT INTO public.fabric_code_counters (agency_id, tier, category_code, next_seq)
  VALUES (ag_id, p_tier, p_cat, 1)
  ON CONFLICT (agency_id, tier, category_code)
  DO UPDATE SET next_seq = public.fabric_code_counters.next_seq + 1
  RETURNING next_seq INTO seq;

  RETURN prefix || '-' || upper(p_cat) || '-' || lpad(seq::text, 3, '0');
END;
$$;

-- ── the standardised photo pair ──────────────────────────────────
-- texture = close-up of the surface; color = the fabric's colour as it reads.

DO $$
DECLARE
  con_name TEXT;
BEGIN
  SELECT conname INTO con_name
  FROM pg_constraint
  WHERE conrelid = 'public.fabric_media'::regclass
    AND contype = 'c'
    AND pg_get_constraintdef(oid) ILIKE '%shot%';

  IF con_name IS NOT NULL THEN
    EXECUTE format('ALTER TABLE public.fabric_media DROP CONSTRAINT %I', con_name);
  END IF;

  ALTER TABLE public.fabric_media
    ADD CONSTRAINT fabric_media_shot_check
    CHECK (shot IN ('texture', 'color', 'swatch', 'drape', 'detail', 'garment', 'other'));
END $$;
