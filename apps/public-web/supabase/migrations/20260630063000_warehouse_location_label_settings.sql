-- Org-level default label template for warehouse location QR labels.
-- One row per org; label_config stores the LabelConfig JSON shape used by
-- the QR label designer (src/lib/qr/label-config.ts), reused unchanged.

CREATE TABLE IF NOT EXISTS public.warehouse_location_label_settings (
  id               UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id  UUID        NOT NULL UNIQUE REFERENCES public.organizations(id) ON DELETE CASCADE,
  label_config     JSONB       NOT NULL DEFAULT '{}',
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE OR REPLACE TRIGGER warehouse_location_label_settings_updated_at
  BEFORE UPDATE ON public.warehouse_location_label_settings
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

ALTER TABLE public.warehouse_location_label_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "warehouse_location_label_settings_select" ON public.warehouse_location_label_settings
  FOR SELECT TO authenticated
  USING (is_org_member(organization_id));

CREATE POLICY "warehouse_location_label_settings_insert" ON public.warehouse_location_label_settings
  FOR INSERT TO authenticated
  WITH CHECK (is_org_member(organization_id) AND has_permission(organization_id, 'warehouse.locations.manage'));

CREATE POLICY "warehouse_location_label_settings_update" ON public.warehouse_location_label_settings
  FOR UPDATE TO authenticated
  USING (is_org_member(organization_id) AND has_permission(organization_id, 'warehouse.locations.manage'))
  WITH CHECK (is_org_member(organization_id) AND has_permission(organization_id, 'warehouse.locations.manage'));
