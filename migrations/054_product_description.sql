-- ─────────────────────────────────────────────────────────────
-- 054 — A description on a product.
--
-- products has `notes` and `notes_zh`, which are working notes: what the
-- factory needs told, what went wrong last round. Neither is a
-- description of the thing itself, and the product page had nowhere to
-- say what a style actually is in the words you would use to a client.
--
-- Separate column rather than reusing notes, because the two are read by
-- different people for different reasons and merging them would put
-- internal remarks in front of a client.
--
-- SAFE TO RE-RUN.
-- ─────────────────────────────────────────────────────────────

ALTER TABLE public.products ADD COLUMN IF NOT EXISTS description TEXT;

COMMENT ON COLUMN public.products.description IS
  'What the product is, in client-facing words. Working notes stay in notes / notes_zh.';
