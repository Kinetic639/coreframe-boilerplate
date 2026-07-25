-- ===========================================================================
-- Planning: settings table + planning.settings.manage permission
-- ===========================================================================

-- 1. New permission row only (org_owner gets it via planning.* wildcard — no explicit grant needed)
INSERT INTO public.permissions (slug, name, category, action)
VALUES ('planning.settings.manage', 'Planning Settings Manage', 'planning', 'manage')
ON CONFLICT (slug) DO NOTHING;

-- 2. planning_settings table
CREATE TABLE IF NOT EXISTS public.planning_settings (
  id               UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id  UUID        NOT NULL UNIQUE REFERENCES public.organizations(id) ON DELETE CASCADE,
  status_configs   JSONB       NOT NULL DEFAULT '{}',
  priority_configs JSONB       NOT NULL DEFAULT '{}',
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE OR REPLACE TRIGGER planning_settings_updated_at
  BEFORE UPDATE ON public.planning_settings
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

ALTER TABLE public.planning_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "planning_settings_select" ON public.planning_settings
  FOR SELECT TO authenticated
  USING (is_org_member(organization_id) AND has_permission(organization_id, 'planning.tasks.read'));

CREATE POLICY "planning_settings_insert" ON public.planning_settings
  FOR INSERT TO authenticated
  WITH CHECK (is_org_member(organization_id) AND has_permission(organization_id, 'planning.settings.manage'));

CREATE POLICY "planning_settings_update" ON public.planning_settings
  FOR UPDATE TO authenticated
  USING (is_org_member(organization_id) AND has_permission(organization_id, 'planning.settings.manage'))
  WITH CHECK (is_org_member(organization_id) AND has_permission(organization_id, 'planning.settings.manage'));
