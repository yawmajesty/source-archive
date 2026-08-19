-- ═══════════════════════════════════════════════════════════════════
-- Production log — the workshop diary
--
-- A maker (our in-house designer/sample machinist) documents what they did
-- on a product each day: drafting the pattern, cutting it, sewing the
-- sample. Each entry carries a stage, a date, a short summary and photos.
--
-- Two deliberate choices:
--
-- 1. Entries are INVISIBLE TO CLIENTS BY DEFAULT. The workshop writes daily;
--    the agency decides when a stretch of that story is ready for the client
--    to see. Nothing reaches a portal until it is explicitly released.
--
-- 2. Photos are NOT a new media table. They are product_media rows carrying
--    a log_entry_id, so a released workshop photo appears in the product's
--    gallery alongside everything else instead of living in a silo.
--
-- SAFE TO RE-RUN.
-- ═══════════════════════════════════════════════════════════════════

-- ── the maker role ───────────────────────────────────────────────
-- A maker is an agency member who can write the diary and upload its
-- photos, and has no reason to see costing, invoices or client records.

DO $$
DECLARE
  con_name TEXT;
BEGIN
  SELECT conname INTO con_name
  FROM pg_constraint
  WHERE conrelid = 'public.agency_members'::regclass
    AND contype = 'c'
    AND pg_get_constraintdef(oid) ILIKE '%role%';

  IF con_name IS NOT NULL THEN
    EXECUTE format('ALTER TABLE public.agency_members DROP CONSTRAINT %I', con_name);
  END IF;

  ALTER TABLE public.agency_members
    ADD CONSTRAINT agency_members_role_check
    CHECK (role IN ('admin', 'team', 'maker'));
END $$;

-- ── production_log_entries ───────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.production_log_entries (
  id                TEXT PRIMARY KEY DEFAULT ('plog-' || replace(gen_random_uuid()::text, '-', '')),
  agency_id         TEXT NOT NULL REFERENCES public.agencies(id) ON DELETE CASCADE,
  product_id        TEXT NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  -- Optional: ties the day's work to a specific sample round.
  sample_id         TEXT REFERENCES public.samples(id) ON DELETE SET NULL,

  stage             TEXT NOT NULL CHECK (stage IN (
                      'pattern', 'cutting', 'sewing', 'fitting', 'finishing', 'qc', 'other'
                    )),
  work_date         DATE NOT NULL DEFAULT CURRENT_DATE,
  summary           TEXT NOT NULL,
  minutes_spent     INTEGER CHECK (minutes_spent IS NULL OR minutes_spent >= 0),
  blocked_reason    TEXT,

  author_user_id    TEXT NOT NULL,
  author_name       TEXT,

  -- Release gate. False until the agency publishes it to the client portal.
  visible_to_client BOOLEAN NOT NULL DEFAULT FALSE,
  published_at      TIMESTAMPTZ,

  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_plog_product  ON public.production_log_entries (product_id, work_date DESC);
CREATE INDEX IF NOT EXISTS idx_plog_agency   ON public.production_log_entries (agency_id, work_date DESC);
CREATE INDEX IF NOT EXISTS idx_plog_author   ON public.production_log_entries (author_user_id);
CREATE INDEX IF NOT EXISTS idx_plog_visible  ON public.production_log_entries (product_id) WHERE visible_to_client;

DROP TRIGGER IF EXISTS trg_plog_updated ON public.production_log_entries;
CREATE TRIGGER trg_plog_updated
  BEFORE UPDATE ON public.production_log_entries
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

ALTER TABLE public.production_log_entries ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS plog_select ON public.production_log_entries;
DROP POLICY IF EXISTS plog_insert ON public.production_log_entries;
DROP POLICY IF EXISTS plog_update ON public.production_log_entries;
DROP POLICY IF EXISTS plog_delete ON public.production_log_entries;

-- Everyone in the agency reads the whole diary, makers included: seeing
-- yesterday's entry is how you know where to pick up.
CREATE POLICY plog_select ON public.production_log_entries
  FOR SELECT USING (public.is_agency_member(agency_id));

CREATE POLICY plog_insert ON public.production_log_entries
  FOR INSERT WITH CHECK (
    public.is_agency_member(agency_id)
    AND author_user_id = (auth.jwt() ->> 'sub')
  );

-- Makers may correct their own entries; admin/team may edit any, which is
-- also what makes releasing to the client an admin action rather than one
-- the workshop can take on its own.
CREATE POLICY plog_update ON public.production_log_entries
  FOR UPDATE USING (
    public.is_agency_member(agency_id)
    AND (
      public.agency_role_of(agency_id) IN ('admin', 'team')
      OR author_user_id = (auth.jwt() ->> 'sub')
    )
  ) WITH CHECK (public.is_agency_member(agency_id));

CREATE POLICY plog_delete ON public.production_log_entries
  FOR DELETE USING (
    public.is_agency_member(agency_id)
    AND public.agency_role_of(agency_id) IN ('admin', 'team')
  );

-- ── product_media: carry log photos and a release flag ───────────

ALTER TABLE public.product_media
  ADD COLUMN IF NOT EXISTS log_entry_id TEXT REFERENCES public.production_log_entries(id) ON DELETE CASCADE;

-- Existing media stays client-visible; workshop photos default to hidden
-- and are flipped when their entry is released.
ALTER TABLE public.product_media
  ADD COLUMN IF NOT EXISTS visible_to_client BOOLEAN NOT NULL DEFAULT TRUE;

CREATE INDEX IF NOT EXISTS idx_product_media_log ON public.product_media (log_entry_id);

-- 'maker' joins agency/client as a media author.
DO $$
DECLARE
  con_name TEXT;
BEGIN
  SELECT conname INTO con_name
  FROM pg_constraint
  WHERE conrelid = 'public.product_media'::regclass
    AND contype = 'c'
    AND pg_get_constraintdef(oid) ILIKE '%uploaded_by_role%';

  IF con_name IS NOT NULL THEN
    EXECUTE format('ALTER TABLE public.product_media DROP CONSTRAINT %I', con_name);
  END IF;

  ALTER TABLE public.product_media
    ADD CONSTRAINT product_media_uploaded_by_role_check
    CHECK (uploaded_by_role IN ('agency', 'client', 'maker'));
END $$;
