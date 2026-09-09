
-- ═══════════════════════════════════════════════════════════════════
-- Fabric width.
--
-- Consumption is meaningless without it. A garment that takes 1.4m of
-- 150cm goods takes closer to 1.9m at 110cm, because the marker has to
-- be laid out differently — so a library that records consumption but
-- not the width it was measured at records a number nobody can reuse.
--
-- Stored in centimetres, integer. Mills quote in cm or inches and the
-- conversion is lossy in inches, so cm is the one to keep.
--
-- SAFE TO RE-RUN.
-- ═══════════════════════════════════════════════════════════════════

ALTER TABLE public.fabrics
  ADD COLUMN IF NOT EXISTS width_cm INTEGER,
  -- Whether the width includes the selvedge. It matters when a cutter
  -- works out usable width, and it is the first thing they ask.
  ADD COLUMN IF NOT EXISTS usable_width_cm INTEGER;
