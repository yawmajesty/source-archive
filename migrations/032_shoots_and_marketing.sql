-- ═══════════════════════════════════════════════════════════════════
-- Shoot briefs and marketing plans.
--
-- Both hang off a collection (projects), because that is the unit a
-- brand actually launches. A shoot with no collection is possible —
-- always-on content is real work — so project_id stays nullable and
-- client_id is what scopes access.
--
-- The shot list is its own table rather than jsonb on the shoot: rows
-- get ticked off on the day, reordered, and assigned per product, and
-- all three are miserable inside a blob.
--
-- References are one table with a `slot` rather than a column per kind.
-- The list of things a brief references (angle, model, hair, lighting…)
-- grows every time someone runs a shoot, and a new slot should not be a
-- migration.
--
-- SAFE TO RE-RUN.
-- ═══════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS public.shoots (
  id          TEXT PRIMARY KEY DEFAULT ('sh-' || replace(gen_random_uuid()::text, '-', '')),
  agency_id   TEXT NOT NULL REFERENCES public.agencies(id) ON DELETE CASCADE,
  client_id   TEXT NOT NULL REFERENCES public.clients(id)  ON DELETE CASCADE,
  project_id  TEXT REFERENCES public.projects(id) ON DELETE SET NULL,

  title       TEXT NOT NULL DEFAULT 'Untitled shoot',
  shoot_type  TEXT NOT NULL DEFAULT 'ecom'
              CHECK (shoot_type IN ('ecom', 'campaign', 'lookbook', 'video', 'social')),
  status      TEXT NOT NULL DEFAULT 'planning'
              CHECK (status IN ('planning', 'booked', 'shot', 'delivered', 'cancelled')),

  shoot_date  DATE,
  call_time   TEXT,
  location    TEXT,
  duration    TEXT,

  -- The brief proper.
  objective       TEXT,
  photo_style     TEXT,
  video_style     TEXT,
  model_style     TEXT,
  hair_makeup     TEXT,
  styling_notes   TEXT,
  lighting_notes  TEXT,
  background      TEXT,
  retouching      TEXT,
  usage_rights    TEXT,
  deliverables    TEXT,
  budget          NUMERIC(12,2),
  currency        TEXT NOT NULL DEFAULT 'GBP',

  -- Crew, as name/role pairs. Free text on purpose: most of these people
  -- are not users of this system and never will be.
  crew        JSONB NOT NULL DEFAULT '[]'::jsonb,

  notes       TEXT,
  created_by  TEXT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_shoots_client  ON public.shoots (client_id, shoot_date DESC);
CREATE INDEX IF NOT EXISTS idx_shoots_project ON public.shoots (project_id);

-- Which garments are on the call sheet.
CREATE TABLE IF NOT EXISTS public.shoot_products (
  id         TEXT PRIMARY KEY DEFAULT ('sp-' || replace(gen_random_uuid()::text, '-', '')),
  agency_id  TEXT NOT NULL REFERENCES public.agencies(id) ON DELETE CASCADE,
  shoot_id   TEXT NOT NULL REFERENCES public.shoots(id)   ON DELETE CASCADE,
  product_id TEXT NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  colourway  TEXT,
  notes      TEXT,
  UNIQUE (shoot_id, product_id)
);

-- The shot list. Ticked off on the day.
CREATE TABLE IF NOT EXISTS public.shoot_shots (
  id          TEXT PRIMARY KEY DEFAULT ('ss-' || replace(gen_random_uuid()::text, '-', '')),
  agency_id   TEXT NOT NULL REFERENCES public.agencies(id) ON DELETE CASCADE,
  shoot_id    TEXT NOT NULL REFERENCES public.shoots(id)   ON DELETE CASCADE,
  product_id  TEXT REFERENCES public.products(id) ON DELETE SET NULL,

  angle       TEXT NOT NULL,
  medium      TEXT NOT NULL DEFAULT 'photo' CHECK (medium IN ('photo', 'video')),
  description TEXT,
  reference_url TEXT,
  position    INTEGER NOT NULL DEFAULT 0,
  done        BOOLEAN NOT NULL DEFAULT FALSE,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_shots_shoot ON public.shoot_shots (shoot_id, position);

-- Reference images, filed by what they are an example of.
CREATE TABLE IF NOT EXISTS public.shoot_references (
  id         TEXT PRIMARY KEY DEFAULT ('sr-' || replace(gen_random_uuid()::text, '-', '')),
  agency_id  TEXT NOT NULL REFERENCES public.agencies(id) ON DELETE CASCADE,
  shoot_id   TEXT NOT NULL REFERENCES public.shoots(id)   ON DELETE CASCADE,
  slot       TEXT NOT NULL DEFAULT 'general',
  image_url  TEXT NOT NULL,
  storage_path TEXT,
  note       TEXT,
  position   INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_shootrefs_shoot ON public.shoot_references (shoot_id, slot, position);

-- A saved brief, reusable for the next thing of the same sort.
CREATE TABLE IF NOT EXISTS public.shoot_templates (
  id         TEXT PRIMARY KEY DEFAULT ('st-' || replace(gen_random_uuid()::text, '-', '')),
  agency_id  TEXT NOT NULL REFERENCES public.agencies(id) ON DELETE CASCADE,
  name       TEXT NOT NULL,
  category   TEXT,
  shoot_type TEXT NOT NULL DEFAULT 'ecom',
  -- The brief fields and the shot list, frozen. Reference images are
  -- carried by URL, so applying a template never re-uploads anything.
  payload    JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_by TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_shoottpl_agency ON public.shoot_templates (agency_id, name);

-- ── Marketing ─────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.campaigns (
  id          TEXT PRIMARY KEY DEFAULT ('cm-' || replace(gen_random_uuid()::text, '-', '')),
  agency_id   TEXT NOT NULL REFERENCES public.agencies(id) ON DELETE CASCADE,
  client_id   TEXT NOT NULL REFERENCES public.clients(id)  ON DELETE CASCADE,
  -- Null means always-on: the work that isn't tied to a drop.
  project_id  TEXT REFERENCES public.projects(id) ON DELETE SET NULL,

  name        TEXT NOT NULL DEFAULT 'Untitled campaign',
  kind        TEXT NOT NULL DEFAULT 'collection'
              CHECK (kind IN ('collection', 'always_on')),
  launch_date DATE,
  objective   TEXT,
  audience    TEXT,
  budget      NUMERIC(12,2),
  currency    TEXT NOT NULL DEFAULT 'GBP',
  notes       TEXT,

  created_by  TEXT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_campaigns_client ON public.campaigns (client_id, launch_date);

CREATE TABLE IF NOT EXISTS public.campaign_items (
  id          TEXT PRIMARY KEY DEFAULT ('ci-' || replace(gen_random_uuid()::text, '-', '')),
  agency_id   TEXT NOT NULL REFERENCES public.agencies(id)  ON DELETE CASCADE,
  campaign_id TEXT NOT NULL REFERENCES public.campaigns(id) ON DELETE CASCADE,
  shoot_id    TEXT REFERENCES public.shoots(id) ON DELETE SET NULL,

  -- Where it sits relative to the drop. This is the spine of the plan.
  phase       TEXT NOT NULL DEFAULT 'pre_drop'
              CHECK (phase IN ('always_on', 'teaser', 'pre_drop', 'launch_week', 'post_launch', 'remarketing')),
  channel     TEXT NOT NULL DEFAULT 'instagram',
  format      TEXT,

  title       TEXT NOT NULL,
  brief       TEXT,
  copy        TEXT,
  cta         TEXT,
  owner       TEXT,
  due_date    DATE,
  publish_at  TIMESTAMPTZ,

  status      TEXT NOT NULL DEFAULT 'idea'
              CHECK (status IN ('idea', 'briefed', 'in_progress', 'ready', 'scheduled', 'live', 'done')),
  position    INTEGER NOT NULL DEFAULT 0,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_campitems_campaign ON public.campaign_items (campaign_id, phase, position);

-- ── RLS ───────────────────────────────────────────────────────────
-- Same gate as clients throughout: membership plus client scope to read,
-- client.edit to change. Child tables inherit through the agency check,
-- which is what every other child table here does.

ALTER TABLE public.shoots            ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.shoot_products    ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.shoot_shots       ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.shoot_references  ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.shoot_templates   ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.campaigns         ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.campaign_items    ENABLE ROW LEVEL SECURITY;

DO $$
DECLARE t TEXT;
BEGIN
  FOREACH t IN ARRAY ARRAY['shoot_products','shoot_shots','shoot_references','shoot_templates','campaign_items']
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I_select ON public.%I', t, t);
    EXECUTE format('DROP POLICY IF EXISTS %I_write  ON public.%I', t, t);
    EXECUTE format(
      'CREATE POLICY %I_select ON public.%I FOR SELECT USING (public.is_agency_member(agency_id))', t, t);
    EXECUTE format(
      'CREATE POLICY %I_write ON public.%I FOR ALL USING (public.has_agency_permission(agency_id, ''client.edit''))'
      ' WITH CHECK (public.has_agency_permission(agency_id, ''client.edit''))', t, t);
  END LOOP;
END $$;

DROP POLICY IF EXISTS shoots_select ON public.shoots;
DROP POLICY IF EXISTS shoots_write  ON public.shoots;
CREATE POLICY shoots_select ON public.shoots
  FOR SELECT USING (public.is_agency_member(agency_id)
                AND public.member_sees_client(agency_id, client_id));
CREATE POLICY shoots_write ON public.shoots
  FOR ALL USING (public.has_agency_permission(agency_id, 'client.edit')
             AND public.member_sees_client(agency_id, client_id))
      WITH CHECK (public.has_agency_permission(agency_id, 'client.edit')
             AND public.member_sees_client(agency_id, client_id));

DROP POLICY IF EXISTS campaigns_select ON public.campaigns;
DROP POLICY IF EXISTS campaigns_write  ON public.campaigns;
CREATE POLICY campaigns_select ON public.campaigns
  FOR SELECT USING (public.is_agency_member(agency_id)
                AND public.member_sees_client(agency_id, client_id));
CREATE POLICY campaigns_write ON public.campaigns
  FOR ALL USING (public.has_agency_permission(agency_id, 'client.edit')
             AND public.member_sees_client(agency_id, client_id))
      WITH CHECK (public.has_agency_permission(agency_id, 'client.edit')
             AND public.member_sees_client(agency_id, client_id));

DROP TRIGGER IF EXISTS touch_shoots ON public.shoots;
CREATE TRIGGER touch_shoots BEFORE UPDATE ON public.shoots
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

DROP TRIGGER IF EXISTS touch_campaigns ON public.campaigns;
CREATE TRIGGER touch_campaigns BEFORE UPDATE ON public.campaigns
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

DROP TRIGGER IF EXISTS touch_campaign_items ON public.campaign_items;
CREATE TRIGGER touch_campaign_items BEFORE UPDATE ON public.campaign_items
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- Storage for shoot reference images.
INSERT INTO storage.buckets (id, name, public)
VALUES ('shoot-media', 'shoot-media', true)
ON CONFLICT (id) DO NOTHING;

DROP POLICY IF EXISTS shoot_media_select ON storage.objects;
DROP POLICY IF EXISTS shoot_media_insert ON storage.objects;
DROP POLICY IF EXISTS shoot_media_delete ON storage.objects;
CREATE POLICY shoot_media_select ON storage.objects
  FOR SELECT USING (bucket_id = 'shoot-media');
CREATE POLICY shoot_media_insert ON storage.objects
  FOR INSERT WITH CHECK (bucket_id = 'shoot-media');
CREATE POLICY shoot_media_delete ON storage.objects
  FOR DELETE USING (bucket_id = 'shoot-media');
