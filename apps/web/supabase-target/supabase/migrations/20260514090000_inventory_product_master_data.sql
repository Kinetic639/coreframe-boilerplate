CREATE TABLE IF NOT EXISTS public.inventory_brands (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  name text not null,
  description text null,
  status text not null default 'active',
  created_by uuid null references public.users(id) on delete set null,
  updated_by uuid null references public.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz null,
  constraint inventory_brands_name_not_empty check (length(trim(name)) > 0),
  constraint inventory_brands_status_check check (status in ('active', 'archived'))
);

CREATE UNIQUE INDEX IF NOT EXISTS inventory_brands_org_name_uidx
  ON public.inventory_brands (organization_id, lower(name))
  WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS inventory_brands_org_status_idx
  ON public.inventory_brands (organization_id, status)
  WHERE deleted_at IS NULL;

CREATE TABLE IF NOT EXISTS public.inventory_manufacturers (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  name text not null,
  description text null,
  status text not null default 'active',
  created_by uuid null references public.users(id) on delete set null,
  updated_by uuid null references public.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz null,
  constraint inventory_manufacturers_name_not_empty check (length(trim(name)) > 0),
  constraint inventory_manufacturers_status_check check (status in ('active', 'archived'))
);

CREATE UNIQUE INDEX IF NOT EXISTS inventory_manufacturers_org_name_uidx
  ON public.inventory_manufacturers (organization_id, lower(name))
  WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS inventory_manufacturers_org_status_idx
  ON public.inventory_manufacturers (organization_id, status)
  WHERE deleted_at IS NULL;

ALTER TABLE public.inventory_brands ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.inventory_brands FORCE ROW LEVEL SECURITY;
ALTER TABLE public.inventory_manufacturers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.inventory_manufacturers FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS inventory_brands_select ON public.inventory_brands;
CREATE POLICY inventory_brands_select
  ON public.inventory_brands FOR SELECT
  USING (deleted_at IS NULL AND public.has_permission(organization_id, 'warehouse.products.read'));

DROP POLICY IF EXISTS inventory_brands_manage ON public.inventory_brands;
CREATE POLICY inventory_brands_manage
  ON public.inventory_brands FOR ALL
  USING (public.has_permission(organization_id, 'warehouse.products.manage'))
  WITH CHECK (public.has_permission(organization_id, 'warehouse.products.manage'));

DROP POLICY IF EXISTS inventory_manufacturers_select ON public.inventory_manufacturers;
CREATE POLICY inventory_manufacturers_select
  ON public.inventory_manufacturers FOR SELECT
  USING (deleted_at IS NULL AND public.has_permission(organization_id, 'warehouse.products.read'));

DROP POLICY IF EXISTS inventory_manufacturers_manage ON public.inventory_manufacturers;
CREATE POLICY inventory_manufacturers_manage
  ON public.inventory_manufacturers FOR ALL
  USING (public.has_permission(organization_id, 'warehouse.products.manage'))
  WITH CHECK (public.has_permission(organization_id, 'warehouse.products.manage'));
