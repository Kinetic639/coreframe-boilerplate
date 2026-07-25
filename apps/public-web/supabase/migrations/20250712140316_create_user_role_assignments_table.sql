create table if not exists public.user_role_assignments (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete restrict,
  role_id uuid not null references public.roles(id) on delete restrict,
  scope text check (scope in ('org', 'branch')) not null,
  scope_id uuid not null,
  deleted_at timestamp with time zone,

  unique (user_id, role_id, scope, scope_id)
);
