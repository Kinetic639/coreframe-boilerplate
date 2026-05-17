do $$
begin
  if not exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'inventory_units'
      and policyname = 'inventory_units_select_manage_all'
  ) then
    create policy inventory_units_select_manage_all
      on public.inventory_units
      for select
      to authenticated
      using (has_permission(organization_id, 'warehouse.products.manage'::text));
  end if;

  if not exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'inventory_unit_conversions'
      and policyname = 'inventory_unit_conversions_select_manage_all'
  ) then
    create policy inventory_unit_conversions_select_manage_all
      on public.inventory_unit_conversions
      for select
      to authenticated
      using (has_permission(organization_id, 'warehouse.products.manage'::text));
  end if;
end $$;
