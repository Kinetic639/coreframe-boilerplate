-- ============================================================
-- Audit fixes for TARGET parity with LEGACY:
--
--   1. delete_org_role RPC — was missing on TARGET
--      Called by OrgRolesService.deleteRole() to atomically
--      soft-delete role assignments, permissions, and the role.
--
--   2. organization_profiles UPDATE policy — was missing on TARGET
--      Without it, profile saves silently return 0 rows (RLS blocked).
-- ============================================================

create or replace function public.delete_org_role(p_role_id uuid)
  returns void
  language plpgsql
  security definer
  set search_path = ''
as $$
declare
  v_org_id uuid;
begin
  select organization_id into v_org_id
  from public.roles
  where id = p_role_id
    and is_basic = false
    and organization_id is not null
    and deleted_at is null;

  if v_org_id is null then
    raise exception 'Role not found or cannot be deleted'
      using errcode = 'P0002';
  end if;

  if not public.is_org_member(v_org_id) then
    raise exception 'Unauthorized'
      using errcode = '42501';
  end if;

  if not public.has_permission(v_org_id, 'members.manage') then
    raise exception 'Unauthorized'
      using errcode = '42501';
  end if;

  update public.user_role_assignments
  set deleted_at = now()
  where role_id = p_role_id
    and deleted_at is null;

  update public.role_permissions
  set deleted_at = now()
  where role_id = p_role_id
    and deleted_at is null;

  update public.roles
  set deleted_at = now()
  where id = p_role_id;
end;
$$;

grant execute on function public.delete_org_role(uuid) to authenticated;

create policy "org_update_permission_can_update_profile"
  on public.organization_profiles
  for update
  using (is_org_member(organization_id) and has_permission(organization_id, 'org.update'))
  with check (is_org_member(organization_id) and has_permission(organization_id, 'org.update'));
