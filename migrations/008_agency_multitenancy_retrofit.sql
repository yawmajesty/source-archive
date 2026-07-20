-- ═══════════════════════════════════════════════════════════════════
-- Phase 8-B: Agency multi-tenancy retrofit
--
-- For every agency-scoped table:
--   1. Add agency_id column (nullable at first)
--   2. Backfill every existing row to the "Source Archive" agency
--   3. Set NOT NULL + add FK + index
--   4. Enable RLS + is_agency_member() policies
--
-- Tables covered:
--   Core:     clients, projects, products, factories, leads, tasks
--   Costs:    costs, product_price_history, sampling_invoices, contracts
--   Samples:  samples, techpack_submissions, reference_samples
--   RFQ:      rfqs, rfq_invites, rfq_submissions, rfq_quoted_products
--   Portal:   portal_files, portal_visits (RLS enabled but read is
--             also allowed via service_role for the public portal flow)
--   Updates:  updates
--   Settings: agency_settings (special: was singleton with id='default')
--
-- SAFE TO RE-RUN.
-- ═══════════════════════════════════════════════════════════════════

-- The list of tables that get the standard agency_id + RLS treatment.
-- agency_settings and portal_* have extra handling further down.
DO $$
DECLARE
  t TEXT;
  standard_tables TEXT[] := ARRAY[
    'clients', 'projects', 'products', 'factories', 'leads', 'tasks',
    'costs', 'product_price_history', 'sampling_invoices', 'contracts',
    'samples', 'techpack_submissions', 'reference_samples',
    'rfqs', 'rfq_invites', 'rfq_submissions', 'rfq_quoted_products',
    'updates'
  ];
BEGIN
  FOREACH t IN ARRAY standard_tables LOOP
    -- 1. Add the column if missing
    EXECUTE format(
      'ALTER TABLE public.%I ADD COLUMN IF NOT EXISTS agency_id TEXT',
      t
    );

    -- 2. Backfill existing rows to Source Archive
    EXECUTE format(
      'UPDATE public.%I SET agency_id = %L WHERE agency_id IS NULL',
      t, 'ag-source-archive'
    );

    -- 3. FK + NOT NULL + index. Drop the constraint first in case of
    --    a partial prior run.
    EXECUTE format(
      'ALTER TABLE public.%I DROP CONSTRAINT IF EXISTS %I',
      t, t || '_agency_fk'
    );
    EXECUTE format(
      'ALTER TABLE public.%I
         ADD CONSTRAINT %I FOREIGN KEY (agency_id)
         REFERENCES public.agencies(id) ON DELETE CASCADE',
      t, t || '_agency_fk'
    );
    EXECUTE format(
      'ALTER TABLE public.%I ALTER COLUMN agency_id SET NOT NULL',
      t
    );
    EXECUTE format(
      'CREATE INDEX IF NOT EXISTS %I ON public.%I (agency_id)',
      'idx_' || t || '_agency', t
    );

    -- 4. Enable RLS + apply the four standard policies
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', t);
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', t || '_agency_select', t);
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', t || '_agency_insert', t);
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', t || '_agency_update', t);
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', t || '_agency_delete', t);
    EXECUTE format(
      'CREATE POLICY %I ON public.%I FOR SELECT USING (public.is_agency_member(agency_id))',
      t || '_agency_select', t
    );
    EXECUTE format(
      'CREATE POLICY %I ON public.%I FOR INSERT WITH CHECK (public.is_agency_member(agency_id))',
      t || '_agency_insert', t
    );
    EXECUTE format(
      'CREATE POLICY %I ON public.%I FOR UPDATE USING (public.is_agency_member(agency_id)) WITH CHECK (public.is_agency_member(agency_id))',
      t || '_agency_update', t
    );
    EXECUTE format(
      'CREATE POLICY %I ON public.%I FOR DELETE USING (public.is_agency_member(agency_id))',
      t || '_agency_delete', t
    );
  END LOOP;
END $$;

-- ── portal_files, portal_visits ──────────────────────────────────
-- These are readable/writable by the PUBLIC client portal (no Clerk
-- auth), so we can't gate them purely on is_agency_member. We still
-- add agency_id for organization + defense in depth, but SELECT
-- policies also allow anon reads for a specific client_id. The app
-- layer handles the token check.

DO $$
DECLARE
  t TEXT;
  portal_tables TEXT[] := ARRAY['portal_files', 'portal_visits'];
BEGIN
  FOREACH t IN ARRAY portal_tables LOOP
    EXECUTE format('ALTER TABLE public.%I ADD COLUMN IF NOT EXISTS agency_id TEXT', t);
    EXECUTE format(
      'UPDATE public.%I SET agency_id = %L WHERE agency_id IS NULL',
      t, 'ag-source-archive'
    );
    EXECUTE format(
      'ALTER TABLE public.%I DROP CONSTRAINT IF EXISTS %I',
      t, t || '_agency_fk'
    );
    EXECUTE format(
      'ALTER TABLE public.%I
         ADD CONSTRAINT %I FOREIGN KEY (agency_id)
         REFERENCES public.agencies(id) ON DELETE CASCADE',
      t, t || '_agency_fk'
    );
    EXECUTE format(
      'ALTER TABLE public.%I ALTER COLUMN agency_id SET NOT NULL',
      t
    );
    EXECUTE format(
      'CREATE INDEX IF NOT EXISTS %I ON public.%I (agency_id)',
      'idx_' || t || '_agency', t
    );

    -- Enable RLS. Only add member-gated policies — the portal flow
    -- uses the service_role key which bypasses RLS entirely.
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', t);
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', t || '_agency_select', t);
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', t || '_agency_insert', t);
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', t || '_agency_update', t);
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', t || '_agency_delete', t);
    EXECUTE format(
      'CREATE POLICY %I ON public.%I FOR SELECT USING (public.is_agency_member(agency_id))',
      t || '_agency_select', t
    );
    EXECUTE format(
      'CREATE POLICY %I ON public.%I FOR INSERT WITH CHECK (public.is_agency_member(agency_id))',
      t || '_agency_insert', t
    );
    EXECUTE format(
      'CREATE POLICY %I ON public.%I FOR UPDATE USING (public.is_agency_member(agency_id)) WITH CHECK (public.is_agency_member(agency_id))',
      t || '_agency_update', t
    );
    EXECUTE format(
      'CREATE POLICY %I ON public.%I FOR DELETE USING (public.is_agency_member(agency_id))',
      t || '_agency_delete', t
    );
  END LOOP;
END $$;

-- ── agency_settings (was singleton) ──────────────────────────────
-- Previously keyed by id='default'. Now each agency has its own row.

ALTER TABLE public.agency_settings
  ADD COLUMN IF NOT EXISTS agency_id TEXT;

-- Backfill: the existing "default" row becomes Source Archive's row
UPDATE public.agency_settings
   SET agency_id = 'ag-source-archive'
 WHERE agency_id IS NULL;

ALTER TABLE public.agency_settings
  DROP CONSTRAINT IF EXISTS agency_settings_agency_fk;
ALTER TABLE public.agency_settings
  ADD CONSTRAINT agency_settings_agency_fk
  FOREIGN KEY (agency_id) REFERENCES public.agencies(id) ON DELETE CASCADE;
ALTER TABLE public.agency_settings
  ALTER COLUMN agency_id SET NOT NULL;

-- Ensure exactly one settings row per agency
DROP INDEX IF EXISTS agency_settings_agency_uidx;
CREATE UNIQUE INDEX agency_settings_agency_uidx
  ON public.agency_settings (agency_id);

ALTER TABLE public.agency_settings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS agency_settings_agency_select ON public.agency_settings;
DROP POLICY IF EXISTS agency_settings_agency_insert ON public.agency_settings;
DROP POLICY IF EXISTS agency_settings_agency_update ON public.agency_settings;
DROP POLICY IF EXISTS agency_settings_agency_delete ON public.agency_settings;

CREATE POLICY agency_settings_agency_select ON public.agency_settings
  FOR SELECT USING (public.is_agency_member(agency_id));
CREATE POLICY agency_settings_agency_insert ON public.agency_settings
  FOR INSERT WITH CHECK (public.is_agency_member(agency_id));
CREATE POLICY agency_settings_agency_update ON public.agency_settings
  FOR UPDATE USING (public.is_agency_member(agency_id))
             WITH CHECK (public.is_agency_member(agency_id));
CREATE POLICY agency_settings_agency_delete ON public.agency_settings
  FOR DELETE USING (public.is_agency_member(agency_id));
