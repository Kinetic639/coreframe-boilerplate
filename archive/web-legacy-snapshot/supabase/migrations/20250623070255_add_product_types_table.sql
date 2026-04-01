create table if not exists public.product_types (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text not null unique,
  icon text,
  organization_id uuid not null references public.organizations(id) on delete cascade,
  created_at timestamp with time zone default now()
);
