-- =============================================
-- Trigger: Assign org_owner role to organization creator
-- =============================================

-- Function to assign org_owner role to the org creator
create or replace function public.handle_new_organization()
returns trigger as $$
declare
  org_owner_role_id uuid;
begin
  -- Get the org_owner role id
  select id into org_owner_role_id from public.roles where slug = 'org_owner';

  -- Insert user_roles entry for the creator as org_owner, only if not already present
  if not exists (
    select 1 from public.user_roles
    where user_id = new.created_by
      and role_id = org_owner_role_id
      and organization_id = new.id
      and deleted_at is null
  ) then
    insert into public.user_roles (user_id, role_id, organization_id, created_at)
    values (new.created_by, org_owner_role_id, new.id, timezone('utc', now()));
  end if;

  return new;
end;
$$ language plpgsql security definer;

-- Drop trigger if it exists (idempotent)
drop trigger if exists on_organization_created on organizations;

-- Create trigger to call the function after insert
create trigger on_organization_created
after insert on organizations
for each row execute function public.handle_new_organization(); 