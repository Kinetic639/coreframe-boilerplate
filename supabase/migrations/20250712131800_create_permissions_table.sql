create table if not exists public.permissions (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  label text,
  deleted_at timestamp with time zone
);
