-- ============================================================
-- TARGET Phase 1 — Batch 1 / File 22
--
-- Adds the missing SELECT and DML policies for organization_members.
--
-- Migration 20 added only two policies:
--   org_members_select_self  — user sees their own row only
--   org_members_all_service_role — service_role bypass
--
-- The self-SELECT was the keystone that unblocked is_org_member().
-- But it is insufficient for the users panel, which needs admins to
-- see ALL member rows in their org.
--
-- Root cause of users panel showing no members:
--   users_select_org_member (on public.users) does:
--     om1 (requester) JOIN om2 (target) ON same org
--   om2 is a different user's row — invisible under org_members_select_self
--   → JOIN returns nothing → org owner sees zero other users.
--
-- Same gap causes member-related queries throughout the app to fail.
--
-- DML policies added here too:
--   INSERT / UPDATE / DELETE for members.manage holders.
--   Note: onboarding RPC and accept_invitation_and_join_org are
--   SECURITY DEFINER (postgres superuser) and bypass FORCE RLS.
--   These DML policies cover UI-driven member management actions.
-- ============================================================

-- SELECT — members.read holders can see all members in their org
create policy "org_members_select_managers"
  on public.organization_members
  for select
  to authenticated
  using (
    is_org_member(organization_id)
    and has_permission(organization_id, 'members.read')
  );

-- INSERT — members.manage holders can add members directly
create policy "org_members_insert_admin"
  on public.organization_members
  for insert
  to authenticated
  with check (
    is_org_member(organization_id)
    and has_permission(organization_id, 'members.manage')
  );

-- UPDATE — members.manage holders can update member rows
-- (status changes, soft-delete via deleted_at, etc.)
create policy "org_members_update_admin"
  on public.organization_members
  for update
  to authenticated
  using (
    is_org_member(organization_id)
    and has_permission(organization_id, 'members.manage')
  )
  with check (
    is_org_member(organization_id)
    and has_permission(organization_id, 'members.manage')
  );

-- DELETE — members.manage holders can hard-delete member rows
create policy "org_members_delete_admin"
  on public.organization_members
  for delete
  to authenticated
  using (
    is_org_member(organization_id)
    and has_permission(organization_id, 'members.manage')
  );
