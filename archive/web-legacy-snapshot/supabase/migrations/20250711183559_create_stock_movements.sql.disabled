create table stock_movements (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null,
  branch_id uuid not null,
  movement_type_id uuid not null references movement_types(id),
  product_variant_id uuid not null,
  quantity numeric not null,
  unit_id uuid not null,
  from_location_id uuid,
  to_location_id uuid,
  comment text,
  created_by uuid,
  created_at timestamp with time zone default now()
);
