create table if not exists public.roles (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid references public.organizations(id) on delete set null,
  name text not null,
  is_basic boolean default false not null,
  deleted_at timestamp with time zone
);
