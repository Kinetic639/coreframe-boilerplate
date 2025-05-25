-- =============================================
-- Create custom_access_token_hook to add all roles with scope to JWT
-- =============================================

create or replace function public.custom_access_token_hook(event jsonb)
returns jsonb
language plpgsql
stable
as $$
declare
  claims jsonb;
  user_roles jsonb;
begin
  -- Build a JSONB array of all roles and their scopes for the user
  select coalesce(jsonb_agg(jsonb_build_object(
    'role', r.slug,
    'organization_id', ur.organization_id,
    'branch_id', ur.branch_id,
    'team_id', ur.team_id
  ) order by r.slug), '[]'::jsonb)
  into user_roles
  from public.user_roles ur
  join public.roles r on ur.role_id = r.id
  where ur.user_id = (event->>'user_id')::uuid
    and ur.deleted_at is null;

  claims := event->'claims';
  claims := jsonb_set(claims, '{roles}', user_roles);

  event := jsonb_set(event, '{claims}', claims);

  return event;
end;
$$;

grant usage on schema public to supabase_auth_admin;
grant execute on function public.custom_access_token_hook to supabase_auth_admin;
revoke execute on function public.custom_access_token_hook from authenticated, anon, public;

grant select on table public.user_roles to supabase_auth_admin;
revoke all on table public.user_roles from authenticated, anon, public;

create policy "Allow auth admin to read user roles" ON public.user_roles
as permissive for select
to supabase_auth_admin
using (true); 