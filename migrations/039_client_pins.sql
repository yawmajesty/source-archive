-- ─────────────────────────────────────────────────────────────
-- Pinning a client to the sidebar.
--
-- The sidebar lists every client an agency has ever had — twenty-four of
-- them here, seven inactive — in the order they were created, under
-- seventeen navigation items. The three or four you touch every day are
-- somewhere in the middle of that.
--
-- A timestamp rather than a boolean, so the order you pinned them in is
-- the order they appear. Nullable, because not pinned is the normal case.
-- ─────────────────────────────────────────────────────────────

ALTER TABLE public.clients
  ADD COLUMN IF NOT EXISTS pinned_at TIMESTAMPTZ;

-- Only ever read for the handful that are set, so the index covers just those.
CREATE INDEX IF NOT EXISTS idx_clients_pinned
  ON public.clients (agency_id, pinned_at)
  WHERE pinned_at IS NOT NULL;

-- No new RLS policy needed: clients already carries the four standard
-- agency policies from 008, and this is one more column on those rows.
