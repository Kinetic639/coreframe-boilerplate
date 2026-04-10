create table if not exists public.role_permissions (
  id uuid primary key default gen_random_uuid(),
  role_id uuid not null references public.roles(id) on delete restrict,
  permission_id uuid not null references public.permissions(id) on delete restrict,
  allowed boolean not null default true,
  deleted_at timestamp with time zone,

  unique (role_id, permission_id)
);
