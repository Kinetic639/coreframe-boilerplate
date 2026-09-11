-- Migration: recompile_workshop_wildcard_holders_for_repair_orders
-- Discovered live while testing Phase 3: the compiled cache
-- public.user_effective_permissions is refreshed only by triggers on
-- role_permissions/user_role_assignments/organization_members/
-- user_permission_overrides -- NOT by inserts into the public.permissions
-- catalog itself. The Phase 2 migration added workshop.repair_orders.read/
-- manage_own/manage_all to the catalog but (correctly, per the repo's own
-- "org_owner gets workshop.* wildcard -- do NOT add explicit granular
-- grants" convention) did not touch role_permissions, so no recompile
-- trigger fired. Result: every existing user who already held workshop.*
-- (or any concrete workshop.* permission) before this Zone 3 migration has
-- a STALE compiled cache that does not yet include the 3 new Zone 3
-- permission slugs, even though they are conceptually covered by their
-- existing wildcard grant. This is a one-time backfill recompile, not a
-- schema change -- it only rebuilds derived/cached rows via the existing,
-- unmodified compile_user_permissions() function; it does not touch any
-- source-of-truth role/permission/assignment table.
DO $$
DECLARE
  r RECORD;
BEGIN
  FOR r IN
    SELECT DISTINCT user_id, organization_id
    FROM public.user_effective_permissions
    WHERE permission_slug_exact LIKE 'workshop.%'
       OR permission_slug = 'workshop.*'
  LOOP
    PERFORM public.compile_user_permissions(r.user_id, r.organization_id);
  END LOOP;
END $$;
