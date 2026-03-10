-- ============================================================
-- TARGET Phase 1 — Batch 1 / File 20 (deferred RLS patch)
--
-- Adds the SELECT RLS policies that were deferred in Files 3 and 4
-- ("Policies deferred to Batch 3 — depend on is_org_member,
-- has_permission") but were never delivered in Batch 3 (Files 9–12).
--
-- Without these policies:
--   - organization_members: no SELECT → is_org_member() always FALSE
--   - organizations: no SELECT → loadAppContextV2 always returns null
--   - organization_profiles: no SELECT → org data join always empty
--   - branches: no SELECT → branches query always empty
--
-- Ordering matters:
--   org_members_select_self must be created FIRST because it is the
--   only policy that does not depend on is_org_member(). Once it
--   exists, is_org_member() can see the calling user's membership
--   rows, and all subsequent policies using is_org_member() work.
--
-- Tables affected  : organization_members, organizations,
--                    organization_profiles, branches
-- Schema changes   : none — policies only
-- Applied to       : TARGET project only
-- ============================================================

-- ============================================================
-- 1. organization_members — self-SELECT (foundational)
--    Allows each user to read their own membership rows.
--    Does NOT use is_org_member() — avoids circular dependency.
--    This is the keystone: once it exists, is_org_member() works
--    for all downstream policies.
-- ============================================================
create policy "org_members_select_self"
  on public.organization_members
  for select
  to authenticated
  using (user_id = auth.uid());

-- Service role: full access (admin/backend operations).
create policy "org_members_all_service_role"
  on public.organization_members
  for all
  to service_role
  using (true)
  with check (true);

-- ============================================================
-- 2. organizations — members can read their organization
--    is_org_member(id) now works because of policy 1 above.
-- ============================================================
create policy "organizations_select_member"
  on public.organizations
  for select
  to authenticated
  using (is_org_member(id));

-- Service role: full access.
create policy "organizations_all_service_role"
  on public.organizations
  for all
  to service_role
  using (true)
  with check (true);

-- ============================================================
-- 3. organization_profiles — members can read their org profile
--    Used in loadAppContextV2 via JOIN on organizations.
-- ============================================================
create policy "organization_profiles_select_member"
  on public.organization_profiles
  for select
  to authenticated
  using (is_org_member(organization_id));

-- Service role: full access.
create policy "organization_profiles_all_service_role"
  on public.organization_profiles
  for all
  to service_role
  using (true)
  with check (true);

-- ============================================================
-- 4. branches — members can read branches in their org
--    Used in loadAppContextV2 branch resolution.
-- ============================================================
create policy "branches_select_member"
  on public.branches
  for select
  to authenticated
  using (is_org_member(organization_id));

-- Service role: full access.
create policy "branches_all_service_role"
  on public.branches
  for all
  to service_role
  using (true)
  with check (true);
