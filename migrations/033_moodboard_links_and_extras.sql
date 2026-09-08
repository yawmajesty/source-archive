-- ═══════════════════════════════════════════════════════════════════
-- Pasted links as a board block, plus the pieces the planner needs.
--
-- 'link' joins the block kinds. Its content holds the unfurled preview —
-- title, thumbnail, provider — captured at paste time. Deliberately a
-- snapshot rather than a live fetch on every render: a board with forty
-- Pinterest pins would otherwise make forty outbound requests each time
-- someone opens it, and a deleted pin would blank the board rather than
-- leave the note of what used to be there.
--
-- SAFE TO RE-RUN.
-- ═══════════════════════════════════════════════════════════════════

ALTER TABLE public.moodboard_items DROP CONSTRAINT IF EXISTS moodboard_items_kind_check;
ALTER TABLE public.moodboard_items
  ADD CONSTRAINT moodboard_items_kind_check
  CHECK (kind IN ('image', 'note', 'heading', 'list', 'swatch', 'link'));

-- ── Shoot ↔ money, and shoot ↔ delivered assets ───────────────────

-- Where the images come back to. A brief with no home for the results
-- leaves the loop open at the far end.
CREATE TABLE IF NOT EXISTS public.shoot_assets (
  id           TEXT PRIMARY KEY DEFAULT ('sa-' || replace(gen_random_uuid()::text, '-', '')),
  agency_id    TEXT NOT NULL REFERENCES public.agencies(id) ON DELETE CASCADE,
  shoot_id     TEXT NOT NULL REFERENCES public.shoots(id)   ON DELETE CASCADE,
  shot_id      TEXT REFERENCES public.shoot_shots(id) ON DELETE SET NULL,
  product_id   TEXT REFERENCES public.products(id)    ON DELETE SET NULL,

  image_url    TEXT NOT NULL,
  storage_path TEXT,
  kind         TEXT NOT NULL DEFAULT 'photo' CHECK (kind IN ('photo', 'video')),
  caption      TEXT,
  -- Released assets are the ones the client may see.
  released     BOOLEAN NOT NULL DEFAULT FALSE,
  position     INTEGER NOT NULL DEFAULT 0,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_shootassets_shoot   ON public.shoot_assets (shoot_id, position);
CREATE INDEX IF NOT EXISTS idx_shootassets_product ON public.shoot_assets (product_id);

ALTER TABLE public.shoot_assets ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS shoot_assets_select ON public.shoot_assets;
DROP POLICY IF EXISTS shoot_assets_write  ON public.shoot_assets;
CREATE POLICY shoot_assets_select ON public.shoot_assets
  FOR SELECT USING (public.is_agency_member(agency_id));
CREATE POLICY shoot_assets_write ON public.shoot_assets
  FOR ALL USING (public.has_agency_permission(agency_id, 'client.edit'))
      WITH CHECK (public.has_agency_permission(agency_id, 'client.edit'));

-- Whether a shoot or campaign has been pushed to the cost tracker, so
-- pressing the button twice doesn't bill the client twice.
ALTER TABLE public.shoots     ADD COLUMN IF NOT EXISTS cost_id TEXT;
ALTER TABLE public.campaigns  ADD COLUMN IF NOT EXISTS cost_id TEXT;

-- Clients see a shoot brief only once it's deliberately shared, the same
-- way the production log works.
ALTER TABLE public.shoots     ADD COLUMN IF NOT EXISTS shared_with_client BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE public.campaigns  ADD COLUMN IF NOT EXISTS shared_with_client BOOLEAN NOT NULL DEFAULT FALSE;

-- Brand workspaces get shoots too, as a paid extra. A workspace-owned
-- shoot has no agency client, so client_id becomes nullable and
-- workspace_id carries the ownership instead.
ALTER TABLE public.shoots    ADD COLUMN IF NOT EXISTS workspace_id TEXT REFERENCES public.workspaces(id) ON DELETE CASCADE;
ALTER TABLE public.campaigns ADD COLUMN IF NOT EXISTS workspace_id TEXT REFERENCES public.workspaces(id) ON DELETE CASCADE;
ALTER TABLE public.shoots    ALTER COLUMN client_id DROP NOT NULL;
ALTER TABLE public.campaigns ALTER COLUMN client_id DROP NOT NULL;

-- Exactly one owner, never neither and never both.
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'shoots_one_owner') THEN
    ALTER TABLE public.shoots ADD CONSTRAINT shoots_one_owner
      CHECK ((client_id IS NOT NULL) <> (workspace_id IS NOT NULL));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'campaigns_one_owner') THEN
    ALTER TABLE public.campaigns ADD CONSTRAINT campaigns_one_owner
      CHECK ((client_id IS NOT NULL) <> (workspace_id IS NOT NULL));
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_shoots_workspace    ON public.shoots (workspace_id);
CREATE INDEX IF NOT EXISTS idx_campaigns_workspace ON public.campaigns (workspace_id);

-- Workspace members reach their own shoots; the agency policies already
-- cover the client-owned ones and are left untouched.
DROP POLICY IF EXISTS shoots_ws_select ON public.shoots;
DROP POLICY IF EXISTS shoots_ws_write  ON public.shoots;
CREATE POLICY shoots_ws_select ON public.shoots
  FOR SELECT USING (workspace_id IS NOT NULL AND public.is_workspace_member(workspace_id));
CREATE POLICY shoots_ws_write ON public.shoots
  FOR ALL USING (workspace_id IS NOT NULL AND public.is_workspace_member(workspace_id))
      WITH CHECK (workspace_id IS NOT NULL AND public.is_workspace_member(workspace_id));

DROP POLICY IF EXISTS campaigns_ws_select ON public.campaigns;
DROP POLICY IF EXISTS campaigns_ws_write  ON public.campaigns;
CREATE POLICY campaigns_ws_select ON public.campaigns
  FOR SELECT USING (workspace_id IS NOT NULL AND public.is_workspace_member(workspace_id));
CREATE POLICY campaigns_ws_write ON public.campaigns
  FOR ALL USING (workspace_id IS NOT NULL AND public.is_workspace_member(workspace_id))
      WITH CHECK (workspace_id IS NOT NULL AND public.is_workspace_member(workspace_id));

-- The child tables are reached through their parent, so a workspace
-- member needs a way in that doesn't go through agency membership.
DROP POLICY IF EXISTS shoot_shots_ws ON public.shoot_shots;
CREATE POLICY shoot_shots_ws ON public.shoot_shots
  FOR ALL USING (EXISTS (SELECT 1 FROM public.shoots s
                         WHERE s.id = shoot_id AND s.workspace_id IS NOT NULL
                           AND public.is_workspace_member(s.workspace_id)))
      WITH CHECK (EXISTS (SELECT 1 FROM public.shoots s
                         WHERE s.id = shoot_id AND s.workspace_id IS NOT NULL
                           AND public.is_workspace_member(s.workspace_id)));

DROP POLICY IF EXISTS shoot_references_ws ON public.shoot_references;
CREATE POLICY shoot_references_ws ON public.shoot_references
  FOR ALL USING (EXISTS (SELECT 1 FROM public.shoots s
                         WHERE s.id = shoot_id AND s.workspace_id IS NOT NULL
                           AND public.is_workspace_member(s.workspace_id)))
      WITH CHECK (EXISTS (SELECT 1 FROM public.shoots s
                         WHERE s.id = shoot_id AND s.workspace_id IS NOT NULL
                           AND public.is_workspace_member(s.workspace_id)));

DROP POLICY IF EXISTS campaign_items_ws ON public.campaign_items;
CREATE POLICY campaign_items_ws ON public.campaign_items
  FOR ALL USING (EXISTS (SELECT 1 FROM public.campaigns c
                         WHERE c.id = campaign_id AND c.workspace_id IS NOT NULL
                           AND public.is_workspace_member(c.workspace_id)))
      WITH CHECK (EXISTS (SELECT 1 FROM public.campaigns c
                         WHERE c.id = campaign_id AND c.workspace_id IS NOT NULL
                           AND public.is_workspace_member(c.workspace_id)));
