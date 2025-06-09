-- Create table for available modules
create table public.modules (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  label text not null,
  description text,
  created_at timestamp with time zone default now(),
  deleted_at timestamp with time zone
);

-- Create join table for users and their modules
create table public.user_modules (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id),
  module_id uuid not null references public.modules(id),
  settings jsonb,
  created_at timestamp with time zone default now(),
  deleted_at timestamp with time zone,
  unique (user_id, module_id)
);

-- Optional: separate settings table if needed later (can skip for now)
-- create table public.user_module_settings (
--   id uuid primary key default gen_random_uuid(),
--   user_module_id uuid not null references public.user_modules(id),
--   key text not null,
--   value jsonb not null,
--   created_at timestamp with time zone default now(),
--   deleted_at timestamp with time zone,
--   unique (user_module_id, key)
-- );

-- Seed core modules
insert into public.modules (slug, label, description)
values 
  ('warehouse', 'Moduł magazynowy', 'Zarządzanie produktami i materiałami'),
  ('team', 'Moduł zespołowy', 'Zarządzanie zespołem, czat i tablice'),
  ('catalog', 'Moduł katalogu', 'Tworzenie katalogu produktów dla e-commerce');
