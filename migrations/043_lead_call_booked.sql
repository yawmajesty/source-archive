-- ─────────────────────────────────────────────────────────────
-- Marking that a lead has booked a call.
--
-- A timestamp rather than another status value, on purpose. Status is one
-- field holding one answer, so "booked a call" as a status would erase
-- "contacted" or "qualified" — and the question being asked is who has
-- booked, which is a fact that sits alongside wherever they are in the
-- pipeline rather than replacing it.
--
-- Safe to run more than once.
-- ─────────────────────────────────────────────────────────────

ALTER TABLE public.leads
  ADD COLUMN IF NOT EXISTS call_booked_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_leads_call_booked
  ON public.leads (agency_id, call_booked_at)
  WHERE call_booked_at IS NOT NULL;
