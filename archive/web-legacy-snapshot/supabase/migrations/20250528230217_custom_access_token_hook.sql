drop function if exists public.custom_access_token_hook;

create or replace function public.custom_access_token_hook(event jsonb)
returns jsonb
language plpgsql
stable
as $$
declare
  claims jsonb;
  roles jsonb;
begin
  claims := event->'claims';

  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'role', r.slug,
        'org_id', ur.organization_id,
        'branch_id', ur.branch_id,
        'team_id', ur.team_id
      )
    ), '[]'::jsonb
  )
  into roles
  from public.user_roles ur
  join public.roles r on ur.role_id = r.id
  where ur.user_id = (event->>'user_id')::uuid;

  claims := jsonb_set(claims, '{roles}', roles, true);
  event := jsonb_set(event, '{claims}', claims, true);

  return event;
end;
$$;
