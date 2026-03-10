-- ============================================================
-- TARGET Phase 1 — Batch 1 / File 21
--
-- Adds INSERT, UPDATE, DELETE RLS policies for the branches table.
-- File 20 added SELECT + service_role ALL. The service_role ALL
-- policy covers onboarding (SECURITY DEFINER RPC runs as postgres,
-- which bypasses RLS on non-forced tables — but branches uses FORCE,
-- so the service_role ALL policy is what covers the RPC).
--
-- These three policies cover UI-driven branch management by
-- authenticated users. Permission slugs mirror the constants in
-- src/lib/constants/permissions.ts and the server-action gates in
-- src/app/actions/organization/branches.ts.
-- ============================================================

-- INSERT — requires branches.create at org scope
create policy "branches_insert_admin"
  on public.branches
  for insert
  to authenticated
  with check (
    is_org_member(organization_id)
    and has_permission(organization_id, 'branches.create')
  );

-- UPDATE — requires branches.update at org scope
create policy "branches_update_admin"
  on public.branches
  for update
  to authenticated
  using (
    is_org_member(organization_id)
    and has_permission(organization_id, 'branches.update')
  )
  with check (
    is_org_member(organization_id)
    and has_permission(organization_id, 'branches.update')
  );

-- DELETE — requires branches.delete at org scope
-- branches use soft-delete (deleted_at), so this covers
-- hard-delete paths only; soft-deletes go through UPDATE.
create policy "branches_delete_admin"
  on public.branches
  for delete
  to authenticated
  using (
    is_org_member(organization_id)
    and has_permission(organization_id, 'branches.delete')
  );
