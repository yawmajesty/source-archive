-- ─────────────────────────────────────────────────────────────
-- 053 — The cost ledger, all in dollars.
--
-- costs.amount_gbp was built when the ledger was kept in pounds: every
-- entry was converted to GBP on the way in. The base currency later
-- changed to dollars — the cost tracker now converts to USD, and both
-- automated paths (the portal and the Stripe webhook) write dollars at
-- a rate of 1 — but the rows written under the old rule were never
-- converted. The column has held a mix of the two ever since, and
-- anything summing it has been adding pounds to dollars.
--
-- On this database that was 23 rows in pounds against 8 in dollars, so
-- the ledger total was not wrong by a little; it was not a quantity.
--
-- The column keeps its name. Renaming it would break the running app
-- between the deploy and this script, and these are not always run
-- together. The comment at the bottom records what it actually holds.
--
-- Safe to run twice: each statement rewrites fx_rate to the dollar-base
-- rate, which is exactly what its own WHERE clause excludes, so a second
-- run matches nothing.
-- ─────────────────────────────────────────────────────────────

-- A copy of the ledger as it stands, before anything is touched. Drop it
-- once the figures look right:  DROP TABLE costs_backup_pre_053;
CREATE TABLE IF NOT EXISTS public.costs_backup_pre_053 AS
  SELECT * FROM public.costs;

-- ── Rows entered in dollars and then converted to pounds ─────
-- The original amount is still on the row, so this is exact: no rate is
-- applied and nothing is estimated.
UPDATE public.costs
   SET amount_gbp = ROUND(amount::numeric, 2),
       fx_rate    = 1
 WHERE currency = 'USD'
   AND amount IS NOT NULL
   AND fx_rate <> 1;

-- ── Rows entered in pounds and stored unconverted ────────────
-- These need a rate, and the rate that applied on the day is not
-- recorded, so the current one is used. The figures are therefore right
-- in aggregate rather than to the penny on each historical line.
UPDATE public.costs
   SET amount_gbp = ROUND(amount::numeric * 1.27, 2),
       fx_rate    = 1.27
 WHERE currency = 'GBP'
   AND amount IS NOT NULL
   AND fx_rate = 1;

-- ── Rows entered in yuan at the old pound rate ───────────────
UPDATE public.costs
   SET amount_gbp = ROUND(amount::numeric * 0.14, 2),
       fx_rate    = 0.14
 WHERE currency = 'CNY'
   AND amount IS NOT NULL
   AND fx_rate <> 0.14;

-- ── Euros, for completeness — none on this database today ────
UPDATE public.costs
   SET amount_gbp = ROUND(amount::numeric * 1.09, 2),
       fx_rate    = 1.09
 WHERE currency = 'EUR'
   AND amount IS NOT NULL
   AND fx_rate <> 1.09;

COMMENT ON COLUMN public.costs.amount_gbp IS
  'US dollars, despite the name. Kept from when the ledger was in pounds; migration 053 converted the remaining pound rows. Every write converts to USD.';
