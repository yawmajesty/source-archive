-- ═══════════════════════════════════════════════════════════════════
-- Phase 8-B (fixup): retrofit agency_id on the Studio tables
--
-- These tables (brand_expenses, brand_costing_products, brand_costing_items)
-- power the agency's internal expense + costing tracker. They were
-- omitted from migration 008 because their names suggest they belong
-- to the brand dashboard — they don't, they're agency-scoped.
--
-- SAFE TO RE-RUN.
-- ═══════════════════════════════════════════════════════════════════

DO $$
DECLARE
  t TEXT;
  studio_tables TEXT[] := ARRAY['brand_expenses', 'brand_costing_products', 'brand_costing_items'];
BEGIN
  FOREACH t IN ARRAY studio_tables LOOP
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
    EXECUTE format('ALTER TABLE public.%I ALTER COLUMN agency_id SET NOT NULL', t);
    EXECUTE format(
      'CREATE INDEX IF NOT EXISTS %I ON public.%I (agency_id)',
      'idx_' || t || '_agency', t
    );
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
