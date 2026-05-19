create or replace view public.inventory_product_list_rows_v1
with (security_invoker = true)
as
select
  p.organization_id,
  p.id as product_id,
  v.id as variant_id,
  p.name as product_name,
  v.name as variant_name,
  v.sku as variant_sku,
  p.product_type,
  p.status,
  p.updated_at,
  (count(v.id) over (partition by p.id) > 1) as is_variant_row
from public.inventory_products p
join public.inventory_variants v
  on v.organization_id = p.organization_id
  and v.product_id = p.id
  and v.deleted_at is null
where p.deleted_at is null;

grant select on public.inventory_product_list_rows_v1 to authenticated;
