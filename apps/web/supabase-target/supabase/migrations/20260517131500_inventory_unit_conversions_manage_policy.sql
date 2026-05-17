do $$
begin
  if not exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'inventory_unit_conversions'
      and policyname = 'inventory_unit_conversions_manage'
  ) then
    create policy inventory_unit_conversions_manage
      on public.inventory_unit_conversions
      for all
      using (public.has_permission(organization_id, 'warehouse.products.manage'::text))
      with check (public.has_permission(organization_id, 'warehouse.products.manage'::text));
  end if;
end $$;
