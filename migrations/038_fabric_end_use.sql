
-- ═══════════════════════════════════════════════════════════════════
-- What a fabric is good for.
--
-- A library you can only search by composition and weight makes you
-- already know what you are looking for. Recording the end uses a cloth
-- actually suits turns it into something you can ask a question of —
-- "what have we got that would work for an overshirt" — which is how
-- anyone actually approaches a fabric archive.
--
-- SAFE TO RE-RUN.
-- ═══════════════════════════════════════════════════════════════════

ALTER TABLE public.fabrics
  ADD COLUMN IF NOT EXISTS suitable_for TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  -- The caveat that does not fit in a tag: "lovely but creases",
  -- "needs a lining", "do not use for anything fitted".
  ADD COLUMN IF NOT EXISTS use_notes TEXT;

CREATE INDEX IF NOT EXISTS idx_fabrics_suitable ON public.fabrics USING GIN (suitable_for);
