-- Seeds the e2e account on the throwaway local Supabase (see start.sh).
-- Run with psql -v user_id=<auth user id>. Goes through the same functions the
-- app calls, acting as that user, so the org looks like one made by sign-up.
\set ON_ERROR_STOP on

begin;

-- auth.uid() reads the JWT claims; act as the test user.
select set_config('request.jwt.claims', json_build_object('sub', :'user_id', 'role', 'authenticated')::text, true);

-- Organization, main branch, org_owner role, subscription and permissions.
-- The paid plan enables every module the dashboard quick actions check.
select public.create_organization_for_current_user(
  p_name => 'Ambra E2E',
  p_branch_name => 'Oddział główny',
  p_plan_id => (select id from public.subscription_plans where name = 'enterprise'),
  p_name_2 => null,
  p_slug => 'ambra-e2e'
) as result \gset

select (:'result'::jsonb ->> 'organization_id') as org_id \gset

update public.users set first_name = 'Test', last_name = 'E2E' where id = :'user_id';

-- A second branch, so branch switching is covered.
select gen_random_uuid() as branch_id \gset
insert into public.branches (id, organization_id, branch_number, name, slug)
values (
  :'branch_id', :'org_id',
  public.reserve_organization_entity_number(:'org_id', 'branch', :'branch_id'),
  'Oddział drugi', 'oddzial-drugi'
);

select public.compile_user_permissions(:'user_id', :'org_id');

-- One product, so the catalog has rows to page through.
insert into public.inventory_units (organization_id, code, name, unit_kind, is_system)
values (:'org_id', 'szt', 'sztuka', 'count', true)
returning id as unit_id \gset

select public.inventory_create_product_with_default_variant(
  p_organization_id => :'org_id',
  p_name => 'Produkt testowy',
  p_product_type => 'stocked',
  p_base_unit_id => :'unit_id',
  p_sku => 'E2E-0001',
  p_description => null,
  p_actor_user_id => :'user_id'
);

commit;
