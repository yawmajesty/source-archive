-- ═══════════════════════════════════════════════════════════════════
-- The connections the planner was missing.
--
-- A shoot brief that can't reach the moodboard makes someone retype
-- twelve references a client already chose, and an approval that lives
-- in a WhatsApp thread isn't a record of anything when a shoot goes
-- wrong.
--
-- SAFE TO RE-RUN.
-- ═══════════════════════════════════════════════════════════════════

-- Where a reference came from. A moodboard-sourced reference keeps a
-- pointer home so the two stay recognisably the same thing.
ALTER TABLE public.shoot_references
  ADD COLUMN IF NOT EXISTS moodboard_item_id TEXT REFERENCES public.moodboard_items(id) ON DELETE SET NULL;

-- Approvals, recorded the way stage changes are: an event, not a
-- conversation. Who agreed, to what, and when.
CREATE TABLE IF NOT EXISTS public.plan_approvals (
  id          TEXT PRIMARY KEY DEFAULT ('pa-' || replace(gen_random_uuid()::text, '-', '')),
  agency_id   TEXT NOT NULL REFERENCES public.agencies(id) ON DELETE CASCADE,
  subject     TEXT NOT NULL CHECK (subject IN ('shoot', 'campaign')),
  subject_id  TEXT NOT NULL,
  client_id   TEXT REFERENCES public.clients(id) ON DELETE CASCADE,

  decision    TEXT NOT NULL CHECK (decision IN ('approved', 'changes_requested')),
  note        TEXT,
  -- The portal has no accounts for link-holders, so who approved is a
  -- name they typed, recorded as given rather than dressed up as an
  -- authenticated identity.
  approved_by_name  TEXT,
  approved_by_email TEXT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_approvals_subject ON public.plan_approvals (subject, subject_id, created_at DESC);

ALTER TABLE public.plan_approvals ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS approvals_select ON public.plan_approvals;
CREATE POLICY approvals_select ON public.plan_approvals
  FOR SELECT USING (public.is_agency_member(agency_id));
-- Writes come from the portal through the service-role client, which
-- checks portal access itself. No insert policy is granted deliberately.

-- Who to tell, and whether they've been told. A crew member is not a
-- user of this system, so notification state lives on the shoot.
ALTER TABLE public.shoots
  ADD COLUMN IF NOT EXISTS crew_notified_at TIMESTAMPTZ;
