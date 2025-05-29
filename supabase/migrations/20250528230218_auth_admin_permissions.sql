grant usage on schema public to supabase_auth_admin;
grant execute on function public.custom_access_token_hook(jsonb) to supabase_auth_admin;
revoke execute on function public.custom_access_token_hook(jsonb) from public, authenticated, anon;

grant select on public.user_roles to supabase_auth_admin;
grant select on public.roles to supabase_auth_admin;

create policy "Enable read for Supabase Auth on user_roles"
on public.user_roles
for select
to supabase_auth_admin
using (true);

create policy "Enable read for Supabase Auth on roles"
on public.roles
for select
to supabase_auth_admin
using (true);
