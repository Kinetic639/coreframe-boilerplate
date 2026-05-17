-- Tax presets and explicit product tax rate values for inventory products.

ALTER TABLE public.inventory_products
  ADD COLUMN IF NOT EXISTS tax_rate_percent numeric(7, 4) null;

CREATE TABLE IF NOT EXISTS public.inventory_tax_rates (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  name text not null,
  code text not null,
  rate_percent numeric(7, 4) not null default 0,
  is_default boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz null,
  created_by uuid null references auth.users(id),
  updated_by uuid null references auth.users(id),
  constraint inventory_tax_rates_name_not_empty check (length(trim(name)) > 0),
  constraint inventory_tax_rates_code_not_empty check (length(trim(code)) > 0),
  constraint inventory_tax_rates_rate_non_negative check (rate_percent >= 0)
);

CREATE UNIQUE INDEX IF NOT EXISTS inventory_tax_rates_code_unique_idx
  ON public.inventory_tax_rates (organization_id, lower(code))
  WHERE deleted_at IS NULL;

ALTER TABLE public.inventory_tax_rates ENABLE ROW LEVEL SECURITY;

CREATE POLICY inventory_tax_rates_select
  ON public.inventory_tax_rates FOR SELECT
  USING (public.has_permission(organization_id, 'warehouse.products.read'));

CREATE POLICY inventory_tax_rates_manage
  ON public.inventory_tax_rates FOR ALL
  USING (public.has_permission(organization_id, 'warehouse.products.manage'))
  WITH CHECK (public.has_permission(organization_id, 'warehouse.products.manage'));
