-- ============================================================================
-- Which Ambra apps a user may open: ERP, Zapytania (requests portal), VMI
-- ============================================================================
-- One rule, used by the post-sign-in app chooser, the app switcher in every
-- app's header, and each app's own entry check. An app is open to a user in an
-- organization when BOTH hold:
--   * the organization's plan includes it (organization_entitlements), and
--   * the user holds its permission (user_effective_permissions).
--
--   app        plan                          permission
--   erp        every plan                    app.erp.access
--   requests   module 'help-desk'            helpdesk.tickets.read (any branch)
--   vmi        module 'vmi'                  module.vmi.access
--
-- app.erp.access is new and granted to the basic org_member and org_owner
-- roles, so every current member keeps the ERP. A portal-only account (e.g. an
-- advisor who only files requests) is one whose roles lack it.
-- ============================================================================

INSERT INTO public.permissions (slug, name, category, action)
VALUES
  ('app.erp.access', 'App ERP Access', 'app', 'erp.access'),
  ('module.vmi.access', 'VMI Module Access', 'module', 'vmi.access')
ON CONFLICT (slug) DO NOTHING;

-- Every current member keeps the ERP (the insert triggers a recompile).
INSERT INTO public.role_permissions (role_id, permission_id, allowed)
SELECT r.id, p.id, true
FROM public.roles r
CROSS JOIN public.permissions p
WHERE r.is_basic = true
  AND r.name IN ('org_member', 'org_owner')
  AND r.deleted_at IS NULL
  AND p.slug = 'app.erp.access'
  AND NOT EXISTS (
    SELECT 1 FROM public.role_permissions rp
    WHERE rp.role_id = r.id AND rp.permission_id = p.id AND rp.deleted_at IS NULL
  );

-- module.vmi.access is new in the catalog: holders of module.* need a
-- recompile to get it (inserts into permissions fire no compile trigger).
DO $$
DECLARE
  r RECORD;
BEGIN
  FOR r IN
    SELECT DISTINCT user_id, organization_id
    FROM public.user_effective_permissions
    WHERE permission_slug = 'module.*'
  LOOP
    PERFORM public.compile_user_permissions(r.user_id, r.organization_id);
  END LOOP;
END $$;

-- The signed-in user's apps, one row per (organization, app).
CREATE OR REPLACE FUNCTION public.get_my_ambra_apps()
 RETURNS TABLE (organization_id uuid, app text)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
  WITH my_orgs AS (
    SELECT om.organization_id
    FROM public.organization_members om
    WHERE om.user_id = auth.uid()
      AND om.status = 'active'
      AND om.deleted_at IS NULL
  ),
  my_perms AS (
    SELECT DISTINCT uep.organization_id, uep.permission_slug_exact AS slug
    FROM public.user_effective_permissions uep
    WHERE uep.user_id = auth.uid()
      AND uep.permission_slug_exact IN (
        'app.erp.access', 'helpdesk.tickets.read', 'module.vmi.access'
      )
  ),
  candidates (app, module_slug, permission_slug) AS (
    VALUES
      ('erp', NULL, 'app.erp.access'),
      ('requests', 'help-desk', 'helpdesk.tickets.read'),
      ('vmi', 'vmi', 'module.vmi.access')
  )
  SELECT o.organization_id, c.app
  FROM my_orgs o
  CROSS JOIN candidates c
  LEFT JOIN public.organization_entitlements e ON e.organization_id = o.organization_id
  WHERE (c.module_slug IS NULL OR c.module_slug = ANY (COALESCE(e.enabled_modules, ARRAY[]::text[])))
    AND EXISTS (
      SELECT 1 FROM my_perms p
      WHERE p.organization_id = o.organization_id AND p.slug = c.permission_slug
    )
  ORDER BY o.organization_id, array_position(ARRAY['erp', 'requests', 'vmi'], c.app);
$function$;

REVOKE ALL ON FUNCTION public.get_my_ambra_apps() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_my_ambra_apps() TO authenticated;
