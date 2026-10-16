-- ─────────────────────────────────────────────────────────────
-- Giving a dashboard task an owner and a subject.
--
-- "What we're on" started as a shared scratchpad: a line of text and a
-- tick. That is the right shape for three things this week and the wrong
-- shape the moment two people are working from it and half the lines are
-- about a particular client's particular product.
--
-- The name is stored alongside the id on purpose. A task assigned to
-- somebody who later leaves the agency should still read "Sam" rather than
-- a dangling Clerk id nobody can resolve.
--
-- Safe to run more than once.
-- ─────────────────────────────────────────────────────────────

ALTER TABLE public.agency_priorities
  ADD COLUMN IF NOT EXISTS assignee_user_id TEXT,
  ADD COLUMN IF NOT EXISTS assignee_name    TEXT,
  ADD COLUMN IF NOT EXISTS client_id        TEXT,
  ADD COLUMN IF NOT EXISTS product_id       TEXT;

-- Filtering the board by person or by client is the point of having them.
CREATE INDEX IF NOT EXISTS idx_priorities_assignee
  ON public.agency_priorities (agency_id, assignee_user_id)
  WHERE assignee_user_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_priorities_client
  ON public.agency_priorities (agency_id, client_id)
  WHERE client_id IS NOT NULL;

-- No new policies: agency_priorities already carries its four from 040, and
-- these are more columns on those rows.
