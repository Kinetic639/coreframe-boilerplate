create table if not exists users (
  id uuid primary key references auth.users(id),
  email text unique,
  created_at timestamp default now()
);