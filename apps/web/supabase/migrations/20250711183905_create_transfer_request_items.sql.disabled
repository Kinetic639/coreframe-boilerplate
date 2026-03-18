create table transfer_request_items (
  id uuid primary key default gen_random_uuid(),
  transfer_request_id uuid not null references transfer_requests(id) on delete cascade,
  product_variant_id uuid not null,
  quantity numeric not null,
  unit_id uuid not null,
  from_location_id uuid,
  to_location_id uuid,
  comment text,
  created_at timestamp with time zone default now()
);
