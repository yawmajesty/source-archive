-- ─────────────────────────────────────────────────────────────
-- Pricing by composition, alongside pricing by volume.
--
-- A cashmere scarf is not one price. It is a price for 100% cashmere,
-- another for 70/30 with wool, another for 50/50 — and the brand chooses
-- the blend before it chooses the quantity. Volume tiers cannot express
-- that, because the thing that varies is the cloth, not the order size.
--
-- Mirrors the volume columns exactly: one list the client sees, one the
-- agency keeps to itself.
--
-- Safe to run more than once.
-- ─────────────────────────────────────────────────────────────

ALTER TABLE public.products
  ADD COLUMN IF NOT EXISTS composition_tiers          JSONB,
  ADD COLUMN IF NOT EXISTS internal_composition_tiers JSONB;

-- No new policies: products already carries the four standard agency
-- policies from 008, and these are two more columns on those rows.
