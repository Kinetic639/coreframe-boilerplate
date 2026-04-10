create table if not exists public.user_permission_overrides (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete restrict,
  permission_id uuid not null references public.permissions(id) on delete restrict,
  allowed boolean not null default true,
  scope text check (scope in ('org', 'branch')) not null,
  scope_id uuid not null,
  deleted_at timestamp with time zone,

  unique (user_id, permission_id, scope, scope_id)
);
