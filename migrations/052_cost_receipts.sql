-- ─────────────────────────────────────────────────────────────
-- 052 · Receipts on cost tracker entries
--
-- NOTHING TO RUN. This bucket already exists on the live project — it was
-- created through the storage API, not the SQL editor. The file is here so
-- a fresh environment comes up with it, and so the bucket is written down
-- somewhere rather than only existing in a dashboard.
--
-- There is no table and no column. The files are the record: each receipt
-- lives at `<agency id>/<cost id>/<when>-<name>`, and "what is attached to
-- this expense?" is a storage listing. See lib/cost-receipts.ts.
--
-- Private, unlike every other bucket here, because a receipt carries a
-- supplier, an amount and sometimes the last four digits of a card. Reads
-- go through short-lived signed URLs minted server-side in
-- app/(app)/costs/receipt-actions.ts, which checks the expense belongs to
-- the caller's agency first. No storage policies, by design: nothing but
-- the service role ever touches this bucket directly.
-- ─────────────────────────────────────────────────────────────

INSERT INTO storage.buckets (id, name, public)
VALUES ('cost-receipts', 'cost-receipts', false)
ON CONFLICT (id) DO NOTHING;
