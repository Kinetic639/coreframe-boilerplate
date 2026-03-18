create table movement_types (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  code text not null unique, -- np. 'INTERNAL', 'PURCHASE', 'RETURN', 'TRANSFER_OUT', 'TRANSFER_IN'
  is_internal boolean default false,
  created_at timestamp with time zone default now()
);
