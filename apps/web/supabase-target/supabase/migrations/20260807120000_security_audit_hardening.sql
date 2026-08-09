-- Security audit hardening (2026-08-07)
-- Ref: supabase-security-audit findings — see conversation summary.
--
-- 1. handle_user_signup_hook is a Supabase Auth "before user created" hook, not a
--    general-purpose RPC. It was PUBLIC-executable (anon included), letting any
--    unauthenticated caller insert public.users/public.user_preferences rows for an
--    arbitrary user id via `rpc('handle_user_signup_hook', {...})`. Restrict execution
--    to supabase_auth_admin, the role Supabase Auth uses to invoke Auth Hooks.
revoke execute on function public.handle_user_signup_hook(jsonb) from public;
revoke execute on function public.handle_user_signup_hook(jsonb) from anon;
revoke execute on function public.handle_user_signup_hook(jsonb) from authenticated;
revoke execute on function public.handle_user_signup_hook(jsonb) from service_role;
-- supabase_auth_admin keeps its existing EXECUTE grant.

-- 2. recompute_organization_entitlements(org_id) has no internal authorization check
--    and was anon/authenticated-executable, allowing any caller to force an
--    entitlements recompute for an arbitrary organization_id (unauthenticated trigger
--    into another org's billing logic + advisory-lock contention/DoS vector).
--    It's invoked internally by triggers (trigger_recompute_on_plan_update, etc.) as
--    SECURITY DEFINER, which does not require these grants, so revoking them does not
--    break existing internal call sites.
revoke execute on function public.recompute_organization_entitlements(uuid) from anon;
revoke execute on function public.recompute_organization_entitlements(uuid) from authenticated;

-- 3. Low-severity: six functions were missing `SET search_path`, leaving them
--    susceptible to search_path-hijack if a malicious schema is ever created ahead
--    of `public` in the resolution order. Pin search_path without touching function
--    bodies.
alter function public.get_warehouse_location_mapping_status(p_location_id uuid) set search_path = 'public', 'pg_temp';
alter function public.validate_warehouse_location_archive(p_location_id uuid) set search_path = 'public', 'pg_temp';
alter function public.verify_locations_v2_migration() set search_path = 'public', 'pg_temp';
alter function public.inventory_ledger_append_only() set search_path = 'public', 'pg_temp';
alter function public.inventory_prevent_header_modification() set search_path = 'public', 'pg_temp';
alter function public.inventory_prevent_line_modification() set search_path = 'public', 'pg_temp';
