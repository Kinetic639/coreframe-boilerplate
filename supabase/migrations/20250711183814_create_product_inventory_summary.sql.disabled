create table product_inventory_summary (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null,
  branch_id uuid not null,
  location_id uuid not null,
  product_variant_id uuid not null,
  quantity numeric not null default 0,
  unit_id uuid not null,
  constraint unique_summary_per_variant_per_location
    unique (organization_id, branch_id, location_id, product_variant_id, unit_id)
);
