-- VMI Client Portal database schema draft.
-- This is intentionally stored outside supabase/migrations while the mocked
-- MVP is still changing. Convert this to a real migration only after schema
-- freeze and apply it through Supabase MCP.
--
-- Original draft migration name: 20260720215325_vmi_foundation.sql
--
-- VMI Client Portal foundation.
-- Buyer-facing users are external VMI client users, not Ambra org members.
-- Vendor-side access is still controlled by Ambra organization permissions.

-- ---------------------------------------------------------------------------
-- Permissions and plan entitlement
-- ---------------------------------------------------------------------------

insert into public.permissions (slug, name, label, category, action, is_system, description)
values
  ('module.vmi.access', 'VMI Module Access', 'VMI', 'module', 'access', true, 'Enter the VMI module'),
  ('vmi.*', 'VMI Wildcard', 'VMI (All)', 'vmi', '*', true, 'Grants all VMI permissions'),
  ('vmi.read', 'VMI Read', 'View VMI', 'vmi', 'read', true, 'View the VMI module shell and overview'),
  ('vmi.clients.read', 'VMI Clients Read', 'View VMI Clients', 'vmi', 'clients.read', true, 'View VMI client accounts and relationships'),
  ('vmi.clients.manage', 'VMI Clients Manage', 'Manage VMI Clients', 'vmi', 'clients.manage', true, 'Create and manage VMI client accounts and relationships'),
  ('vmi.invitations.manage', 'VMI Invitations Manage', 'Manage VMI Invitations', 'vmi', 'invitations.manage', true, 'Invite buyer users into the VMI portal'),
  ('vmi.locations.read', 'VMI Locations Read', 'View VMI Locations', 'vmi', 'locations.read', true, 'View buyer VMI locations'),
  ('vmi.locations.manage', 'VMI Locations Manage', 'Manage VMI Locations', 'vmi', 'locations.manage', true, 'Manage buyer VMI locations'),
  ('vmi.inventory.read', 'VMI Inventory Read', 'View VMI Inventory', 'vmi', 'inventory.read', true, 'View buyer inventory state'),
  ('vmi.inventory.manage', 'VMI Inventory Manage', 'Manage VMI Inventory', 'vmi', 'inventory.manage', true, 'Manage buyer inventory settings'),
  ('vmi.stock_counts.read', 'VMI Stock Counts Read', 'View VMI Stock Counts', 'vmi', 'stock_counts.read', true, 'View stock count submissions'),
  ('vmi.stock_counts.manage', 'VMI Stock Counts Manage', 'Manage VMI Stock Counts', 'vmi', 'stock_counts.manage', true, 'Create and review stock counts'),
  ('vmi.proposals.read', 'VMI Proposals Read', 'View VMI Proposals', 'vmi', 'proposals.read', true, 'View replenishment proposals'),
  ('vmi.proposals.manage', 'VMI Proposals Manage', 'Manage VMI Proposals', 'vmi', 'proposals.manage', true, 'Create and manage replenishment proposals'),
  ('vmi.orders.read', 'VMI Orders Read', 'View VMI Orders', 'vmi', 'orders.read', true, 'View replenishment orders'),
  ('vmi.orders.manage', 'VMI Orders Manage', 'Manage VMI Orders', 'vmi', 'orders.manage', true, 'Create and manage replenishment orders'),
  ('vmi.messages.read', 'VMI Messages Read', 'View VMI Messages', 'vmi', 'messages.read', true, 'View VMI message threads'),
  ('vmi.messages.send', 'VMI Messages Send', 'Send VMI Messages', 'vmi', 'messages.send', true, 'Send VMI messages'),
  ('vmi.settings.manage', 'VMI Settings Manage', 'Manage VMI Settings', 'vmi', 'settings.manage', true, 'Manage VMI vendor-side settings')
on conflict (slug) do update
set
  name = excluded.name,
  label = excluded.label,
  category = excluded.category,
  action = excluded.action,
  is_system = excluded.is_system,
  description = excluded.description;

do $$
declare
  v_owner_id uuid;
  v_member_id uuid;
begin
  select id into v_owner_id from public.roles where name = 'org_owner' and is_basic = true limit 1;
  select id into v_member_id from public.roles where name = 'org_member' and is_basic = true limit 1;

  if v_owner_id is not null then
    insert into public.role_permissions (role_id, permission_id, allowed)
    select v_owner_id, p.id, true
    from public.permissions p
    where p.slug = 'vmi.*'
    on conflict (role_id, permission_id) do nothing;
  end if;

  if v_member_id is not null then
    insert into public.role_permissions (role_id, permission_id, allowed)
    select v_member_id, p.id, true
    from public.permissions p
    where p.slug in (
      'module.vmi.access',
      'vmi.read',
      'vmi.clients.read',
      'vmi.locations.read',
      'vmi.inventory.read',
      'vmi.stock_counts.read',
      'vmi.proposals.read',
      'vmi.orders.read',
      'vmi.messages.read'
    )
    on conflict (role_id, permission_id) do nothing;
  end if;
end $$;

update public.subscription_plans
set enabled_modules = array(
  select distinct module_slug
  from unnest(enabled_modules || array['vmi']::text[]) as module_slug
  order by module_slug
)
where name in ('professional', 'enterprise')
  and not ('vmi' = any(enabled_modules));

-- ---------------------------------------------------------------------------
-- Tables
-- ---------------------------------------------------------------------------

create table if not exists public.vmi_client_accounts (
  id uuid primary key default gen_random_uuid(),
  vendor_organization_id uuid not null references public.organizations(id) on delete cascade,
  client_party_id uuid references public.crm_parties(id) on delete set null,
  display_name text not null,
  legal_name text,
  tax_id text,
  email text,
  phone text,
  website text,
  status text not null default 'pending',
  notes text,
  created_by uuid references public.users(id),
  updated_by uuid references public.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  constraint vmi_client_accounts_status_check
    check (status in ('pending', 'active', 'suspended', 'archived'))
);

create table if not exists public.vmi_client_users (
  id uuid primary key default gen_random_uuid(),
  client_account_id uuid not null references public.vmi_client_accounts(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null default 'member',
  status text not null default 'active',
  invited_by uuid references public.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  constraint vmi_client_users_role_check check (role in ('owner', 'admin', 'member', 'viewer')),
  constraint vmi_client_users_status_check check (status in ('invited', 'active', 'disabled')),
  constraint vmi_client_users_unique_active_user unique (client_account_id, user_id)
);

create table if not exists public.vmi_client_invitations (
  id uuid primary key default gen_random_uuid(),
  vendor_organization_id uuid not null references public.organizations(id) on delete cascade,
  client_account_id uuid not null references public.vmi_client_accounts(id) on delete cascade,
  email text not null,
  token_hash text not null unique,
  role text not null default 'member',
  status text not null default 'pending',
  expires_at timestamptz not null,
  accepted_by uuid references auth.users(id),
  accepted_at timestamptz,
  created_by uuid references public.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  constraint vmi_client_invitations_role_check check (role in ('owner', 'admin', 'member', 'viewer')),
  constraint vmi_client_invitations_status_check check (status in ('pending', 'accepted', 'expired', 'cancelled'))
);

create table if not exists public.vmi_client_locations (
  id uuid primary key default gen_random_uuid(),
  vendor_organization_id uuid not null references public.organizations(id) on delete cascade,
  client_account_id uuid not null references public.vmi_client_accounts(id) on delete cascade,
  name text not null,
  location_code text,
  address_line1 text,
  address_line2 text,
  city text,
  postal_code text,
  region text,
  country text not null default 'PL',
  latitude numeric,
  longitude numeric,
  status text not null default 'active',
  created_by uuid references public.users(id),
  updated_by uuid references public.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  constraint vmi_client_locations_status_check check (status in ('active', 'inactive', 'archived')),
  constraint vmi_client_locations_code_unique unique (client_account_id, location_code)
);

create table if not exists public.vmi_vendor_client_relationships (
  id uuid primary key default gen_random_uuid(),
  vendor_organization_id uuid not null references public.organizations(id) on delete cascade,
  client_account_id uuid not null references public.vmi_client_accounts(id) on delete cascade,
  supplier_party_id uuid references public.crm_parties(id) on delete set null,
  status text not null default 'prospect',
  terms jsonb not null default '{}'::jsonb,
  approved_by uuid references public.users(id),
  approved_at timestamptz,
  created_by uuid references public.users(id),
  updated_by uuid references public.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  constraint vmi_relationships_status_check
    check (status in ('prospect', 'invited', 'active', 'paused', 'ended')),
  constraint vmi_relationships_unique_client_vendor unique (vendor_organization_id, client_account_id)
);

create table if not exists public.vmi_catalog_exposures (
  id uuid primary key default gen_random_uuid(),
  vendor_organization_id uuid not null references public.organizations(id) on delete cascade,
  client_account_id uuid references public.vmi_client_accounts(id) on delete cascade,
  item_id uuid not null references public.inventory_products(id) on delete cascade,
  supplier_party_id uuid references public.crm_parties(id) on delete set null,
  item_supplier_id uuid references public.warehouse_item_suppliers(id) on delete set null,
  visibility_scope text not null default 'client',
  status text not null default 'active',
  price_mode text not null default 'hidden',
  created_by uuid references public.users(id),
  updated_by uuid references public.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  constraint vmi_catalog_exposures_scope_check check (visibility_scope in ('public', 'client')),
  constraint vmi_catalog_exposures_status_check check (status in ('active', 'inactive', 'archived')),
  constraint vmi_catalog_exposures_price_mode_check check (price_mode in ('hidden', 'visible', 'request_only'))
);

create table if not exists public.vmi_inventory_items (
  id uuid primary key default gen_random_uuid(),
  vendor_organization_id uuid not null references public.organizations(id) on delete cascade,
  client_account_id uuid not null references public.vmi_client_accounts(id) on delete cascade,
  client_location_id uuid not null references public.vmi_client_locations(id) on delete cascade,
  catalog_exposure_id uuid references public.vmi_catalog_exposures(id) on delete set null,
  item_id uuid references public.inventory_products(id) on delete set null,
  client_sku text,
  display_name text not null,
  unit text,
  current_quantity numeric not null default 0,
  minimum_quantity numeric,
  maximum_quantity numeric,
  reorder_quantity numeric,
  status text not null default 'active',
  last_counted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  constraint vmi_inventory_items_status_check check (status in ('active', 'inactive', 'archived'))
);

create table if not exists public.vmi_stock_count_sessions (
  id uuid primary key default gen_random_uuid(),
  vendor_organization_id uuid not null references public.organizations(id) on delete cascade,
  client_account_id uuid not null references public.vmi_client_accounts(id) on delete cascade,
  client_location_id uuid references public.vmi_client_locations(id) on delete set null,
  status text not null default 'draft',
  notes text,
  submitted_by uuid references auth.users(id),
  submitted_at timestamptz,
  reviewed_by uuid references public.users(id),
  reviewed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  constraint vmi_stock_count_sessions_status_check
    check (status in ('draft', 'submitted', 'reviewed', 'cancelled'))
);

create table if not exists public.vmi_stock_count_lines (
  id uuid primary key default gen_random_uuid(),
  stock_count_session_id uuid not null references public.vmi_stock_count_sessions(id) on delete cascade,
  vendor_organization_id uuid not null references public.organizations(id) on delete cascade,
  client_account_id uuid not null references public.vmi_client_accounts(id) on delete cascade,
  inventory_item_id uuid not null references public.vmi_inventory_items(id) on delete cascade,
  expected_quantity numeric,
  counted_quantity numeric,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

create table if not exists public.vmi_proposals (
  id uuid primary key default gen_random_uuid(),
  vendor_organization_id uuid not null references public.organizations(id) on delete cascade,
  client_account_id uuid not null references public.vmi_client_accounts(id) on delete cascade,
  client_location_id uuid references public.vmi_client_locations(id) on delete set null,
  status text not null default 'draft',
  currency_code text not null default 'PLN',
  notes text,
  created_by uuid references public.users(id),
  submitted_at timestamptz,
  responded_by uuid references auth.users(id),
  responded_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  constraint vmi_proposals_status_check check (status in ('draft', 'sent', 'accepted', 'rejected', 'expired'))
);

create table if not exists public.vmi_proposal_lines (
  id uuid primary key default gen_random_uuid(),
  proposal_id uuid not null references public.vmi_proposals(id) on delete cascade,
  vendor_organization_id uuid not null references public.organizations(id) on delete cascade,
  client_account_id uuid not null references public.vmi_client_accounts(id) on delete cascade,
  inventory_item_id uuid references public.vmi_inventory_items(id) on delete set null,
  item_id uuid references public.inventory_products(id) on delete set null,
  description text not null,
  quantity numeric not null,
  unit_price numeric,
  currency_code text not null default 'PLN',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

create table if not exists public.vmi_orders (
  id uuid primary key default gen_random_uuid(),
  vendor_organization_id uuid not null references public.organizations(id) on delete cascade,
  client_account_id uuid not null references public.vmi_client_accounts(id) on delete cascade,
  client_location_id uuid references public.vmi_client_locations(id) on delete set null,
  proposal_id uuid references public.vmi_proposals(id) on delete set null,
  order_number text,
  status text not null default 'draft',
  currency_code text not null default 'PLN',
  notes text,
  created_by_client_user_id uuid references auth.users(id),
  accepted_by_vendor_user_id uuid references public.users(id),
  accepted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  constraint vmi_orders_status_check
    check (status in ('draft', 'submitted', 'accepted', 'fulfilled', 'cancelled')),
  constraint vmi_orders_unique_number unique (vendor_organization_id, order_number)
);

create table if not exists public.vmi_order_lines (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.vmi_orders(id) on delete cascade,
  vendor_organization_id uuid not null references public.organizations(id) on delete cascade,
  client_account_id uuid not null references public.vmi_client_accounts(id) on delete cascade,
  item_id uuid references public.inventory_products(id) on delete set null,
  description text not null,
  quantity numeric not null,
  unit_price numeric,
  currency_code text not null default 'PLN',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

create table if not exists public.vmi_message_threads (
  id uuid primary key default gen_random_uuid(),
  vendor_organization_id uuid not null references public.organizations(id) on delete cascade,
  client_account_id uuid not null references public.vmi_client_accounts(id) on delete cascade,
  subject text not null,
  status text not null default 'open',
  created_by_vendor_user_id uuid references public.users(id),
  created_by_client_user_id uuid references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  constraint vmi_message_threads_status_check check (status in ('open', 'closed', 'archived'))
);

create table if not exists public.vmi_messages (
  id uuid primary key default gen_random_uuid(),
  thread_id uuid not null references public.vmi_message_threads(id) on delete cascade,
  vendor_organization_id uuid not null references public.organizations(id) on delete cascade,
  client_account_id uuid not null references public.vmi_client_accounts(id) on delete cascade,
  sender_kind text not null,
  sender_vendor_user_id uuid references public.users(id),
  sender_client_user_id uuid references auth.users(id),
  body text not null,
  created_at timestamptz not null default now(),
  deleted_at timestamptz,
  constraint vmi_messages_sender_kind_check check (sender_kind in ('vendor', 'client')),
  constraint vmi_messages_sender_check check (
    (sender_kind = 'vendor' and sender_vendor_user_id is not null and sender_client_user_id is null)
    or
    (sender_kind = 'client' and sender_client_user_id is not null and sender_vendor_user_id is null)
  )
);

-- ---------------------------------------------------------------------------
-- Indexes
-- ---------------------------------------------------------------------------

create index if not exists vmi_client_accounts_vendor_idx on public.vmi_client_accounts (vendor_organization_id, status) where deleted_at is null;
create index if not exists vmi_client_users_user_idx on public.vmi_client_users (user_id, status) where deleted_at is null;
create index if not exists vmi_client_invitations_email_idx on public.vmi_client_invitations (lower(email), status) where deleted_at is null;
create index if not exists vmi_client_locations_account_idx on public.vmi_client_locations (client_account_id, status) where deleted_at is null;
create index if not exists vmi_relationships_vendor_idx on public.vmi_vendor_client_relationships (vendor_organization_id, status) where deleted_at is null;
create index if not exists vmi_catalog_exposures_vendor_idx on public.vmi_catalog_exposures (vendor_organization_id, status) where deleted_at is null;
create index if not exists vmi_catalog_exposures_client_idx on public.vmi_catalog_exposures (client_account_id, status) where deleted_at is null;
create index if not exists vmi_inventory_items_location_idx on public.vmi_inventory_items (client_location_id, status) where deleted_at is null;
create index if not exists vmi_stock_count_sessions_client_idx on public.vmi_stock_count_sessions (client_account_id, status) where deleted_at is null;
create index if not exists vmi_proposals_client_idx on public.vmi_proposals (client_account_id, status) where deleted_at is null;
create index if not exists vmi_orders_client_idx on public.vmi_orders (client_account_id, status) where deleted_at is null;
create index if not exists vmi_message_threads_client_idx on public.vmi_message_threads (client_account_id, status) where deleted_at is null;
create index if not exists vmi_messages_thread_idx on public.vmi_messages (thread_id, created_at) where deleted_at is null;

-- ---------------------------------------------------------------------------
-- Updated-at triggers
-- ---------------------------------------------------------------------------

drop trigger if exists update_vmi_client_accounts_updated_at on public.vmi_client_accounts;
create trigger update_vmi_client_accounts_updated_at before update on public.vmi_client_accounts
for each row execute function public.set_updated_at();

drop trigger if exists update_vmi_client_users_updated_at on public.vmi_client_users;
create trigger update_vmi_client_users_updated_at before update on public.vmi_client_users
for each row execute function public.set_updated_at();

drop trigger if exists update_vmi_client_invitations_updated_at on public.vmi_client_invitations;
create trigger update_vmi_client_invitations_updated_at before update on public.vmi_client_invitations
for each row execute function public.set_updated_at();

drop trigger if exists update_vmi_client_locations_updated_at on public.vmi_client_locations;
create trigger update_vmi_client_locations_updated_at before update on public.vmi_client_locations
for each row execute function public.set_updated_at();

drop trigger if exists update_vmi_relationships_updated_at on public.vmi_vendor_client_relationships;
create trigger update_vmi_relationships_updated_at before update on public.vmi_vendor_client_relationships
for each row execute function public.set_updated_at();

drop trigger if exists update_vmi_catalog_exposures_updated_at on public.vmi_catalog_exposures;
create trigger update_vmi_catalog_exposures_updated_at before update on public.vmi_catalog_exposures
for each row execute function public.set_updated_at();

drop trigger if exists update_vmi_inventory_items_updated_at on public.vmi_inventory_items;
create trigger update_vmi_inventory_items_updated_at before update on public.vmi_inventory_items
for each row execute function public.set_updated_at();

drop trigger if exists update_vmi_stock_count_sessions_updated_at on public.vmi_stock_count_sessions;
create trigger update_vmi_stock_count_sessions_updated_at before update on public.vmi_stock_count_sessions
for each row execute function public.set_updated_at();

drop trigger if exists update_vmi_stock_count_lines_updated_at on public.vmi_stock_count_lines;
create trigger update_vmi_stock_count_lines_updated_at before update on public.vmi_stock_count_lines
for each row execute function public.set_updated_at();

drop trigger if exists update_vmi_proposals_updated_at on public.vmi_proposals;
create trigger update_vmi_proposals_updated_at before update on public.vmi_proposals
for each row execute function public.set_updated_at();

drop trigger if exists update_vmi_proposal_lines_updated_at on public.vmi_proposal_lines;
create trigger update_vmi_proposal_lines_updated_at before update on public.vmi_proposal_lines
for each row execute function public.set_updated_at();

drop trigger if exists update_vmi_orders_updated_at on public.vmi_orders;
create trigger update_vmi_orders_updated_at before update on public.vmi_orders
for each row execute function public.set_updated_at();

drop trigger if exists update_vmi_order_lines_updated_at on public.vmi_order_lines;
create trigger update_vmi_order_lines_updated_at before update on public.vmi_order_lines
for each row execute function public.set_updated_at();

drop trigger if exists update_vmi_message_threads_updated_at on public.vmi_message_threads;
create trigger update_vmi_message_threads_updated_at before update on public.vmi_message_threads
for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- RLS helpers
-- ---------------------------------------------------------------------------

create or replace function public.vmi_is_client_user(p_client_account_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.vmi_client_users vcu
    where vcu.client_account_id = p_client_account_id
      and vcu.user_id = auth.uid()
      and vcu.status = 'active'
      and vcu.deleted_at is null
  );
$$;

create or replace function public.vmi_can_read(p_vendor_organization_id uuid, p_client_account_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select
    public.vmi_is_client_user(p_client_account_id)
    or (
      public.is_org_member(p_vendor_organization_id)
      and public.has_permission(p_vendor_organization_id, 'vmi.read')
    );
$$;

create or replace function public.vmi_can_manage(p_vendor_organization_id uuid, p_permission text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select
    public.is_org_member(p_vendor_organization_id)
    and public.has_permission(p_vendor_organization_id, p_permission);
$$;

revoke all on function public.vmi_is_client_user(uuid) from public;
revoke all on function public.vmi_can_read(uuid, uuid) from public;
revoke all on function public.vmi_can_manage(uuid, text) from public;
grant execute on function public.vmi_is_client_user(uuid) to authenticated, service_role;
grant execute on function public.vmi_can_read(uuid, uuid) to authenticated, service_role;
grant execute on function public.vmi_can_manage(uuid, text) to authenticated, service_role;

-- ---------------------------------------------------------------------------
-- Row level security
-- ---------------------------------------------------------------------------

alter table public.vmi_client_accounts enable row level security;
alter table public.vmi_client_accounts force row level security;
alter table public.vmi_client_users enable row level security;
alter table public.vmi_client_users force row level security;
alter table public.vmi_client_invitations enable row level security;
alter table public.vmi_client_invitations force row level security;
alter table public.vmi_client_locations enable row level security;
alter table public.vmi_client_locations force row level security;
alter table public.vmi_vendor_client_relationships enable row level security;
alter table public.vmi_vendor_client_relationships force row level security;
alter table public.vmi_catalog_exposures enable row level security;
alter table public.vmi_catalog_exposures force row level security;
alter table public.vmi_inventory_items enable row level security;
alter table public.vmi_inventory_items force row level security;
alter table public.vmi_stock_count_sessions enable row level security;
alter table public.vmi_stock_count_sessions force row level security;
alter table public.vmi_stock_count_lines enable row level security;
alter table public.vmi_stock_count_lines force row level security;
alter table public.vmi_proposals enable row level security;
alter table public.vmi_proposals force row level security;
alter table public.vmi_proposal_lines enable row level security;
alter table public.vmi_proposal_lines force row level security;
alter table public.vmi_orders enable row level security;
alter table public.vmi_orders force row level security;
alter table public.vmi_order_lines enable row level security;
alter table public.vmi_order_lines force row level security;
alter table public.vmi_message_threads enable row level security;
alter table public.vmi_message_threads force row level security;
alter table public.vmi_messages enable row level security;
alter table public.vmi_messages force row level security;

create policy vmi_client_accounts_select on public.vmi_client_accounts
for select to authenticated
using (deleted_at is null and public.vmi_can_read(vendor_organization_id, id));

create policy vmi_client_accounts_insert on public.vmi_client_accounts
for insert to authenticated
with check (public.vmi_can_manage(vendor_organization_id, 'vmi.clients.manage'));

create policy vmi_client_accounts_update on public.vmi_client_accounts
for update to authenticated
using (public.vmi_can_manage(vendor_organization_id, 'vmi.clients.manage'))
with check (public.vmi_can_manage(vendor_organization_id, 'vmi.clients.manage'));

create policy vmi_client_accounts_service_role on public.vmi_client_accounts
for all to service_role using (true) with check (true);

create policy vmi_client_users_select on public.vmi_client_users
for select to authenticated
using (
  deleted_at is null
  and (
    user_id = (select auth.uid())
    or exists (
      select 1 from public.vmi_client_accounts vca
      where vca.id = client_account_id
        and public.vmi_can_manage(vca.vendor_organization_id, 'vmi.clients.manage')
    )
  )
);

create policy vmi_client_users_insert on public.vmi_client_users
for insert to authenticated
with check (
  exists (
    select 1 from public.vmi_client_accounts vca
    where vca.id = client_account_id
      and public.vmi_can_manage(vca.vendor_organization_id, 'vmi.clients.manage')
  )
);

create policy vmi_client_users_update on public.vmi_client_users
for update to authenticated
using (
  exists (
    select 1 from public.vmi_client_accounts vca
    where vca.id = client_account_id
      and public.vmi_can_manage(vca.vendor_organization_id, 'vmi.clients.manage')
  )
)
with check (
  exists (
    select 1 from public.vmi_client_accounts vca
    where vca.id = client_account_id
      and public.vmi_can_manage(vca.vendor_organization_id, 'vmi.clients.manage')
  )
);

create policy vmi_client_users_service_role on public.vmi_client_users
for all to service_role using (true) with check (true);

create policy vmi_client_invitations_select on public.vmi_client_invitations
for select to authenticated
using (
  deleted_at is null
  and (
    lower(email) = lower(coalesce((select auth.jwt() ->> 'email'), ''))
    or public.vmi_can_manage(vendor_organization_id, 'vmi.invitations.manage')
  )
);

create policy vmi_client_invitations_insert on public.vmi_client_invitations
for insert to authenticated
with check (public.vmi_can_manage(vendor_organization_id, 'vmi.invitations.manage'));

create policy vmi_client_invitations_update on public.vmi_client_invitations
for update to authenticated
using (public.vmi_can_manage(vendor_organization_id, 'vmi.invitations.manage'))
with check (public.vmi_can_manage(vendor_organization_id, 'vmi.invitations.manage'));

create policy vmi_client_invitations_service_role on public.vmi_client_invitations
for all to service_role using (true) with check (true);

create policy vmi_client_locations_select on public.vmi_client_locations
for select to authenticated
using (deleted_at is null and public.vmi_can_read(vendor_organization_id, client_account_id));

create policy vmi_client_locations_insert on public.vmi_client_locations
for insert to authenticated
with check (public.vmi_can_manage(vendor_organization_id, 'vmi.locations.manage'));

create policy vmi_client_locations_update on public.vmi_client_locations
for update to authenticated
using (public.vmi_can_manage(vendor_organization_id, 'vmi.locations.manage'))
with check (public.vmi_can_manage(vendor_organization_id, 'vmi.locations.manage'));

create policy vmi_relationships_select on public.vmi_vendor_client_relationships
for select to authenticated
using (deleted_at is null and public.vmi_can_read(vendor_organization_id, client_account_id));

create policy vmi_relationships_insert on public.vmi_vendor_client_relationships
for insert to authenticated
with check (public.vmi_can_manage(vendor_organization_id, 'vmi.clients.manage'));

create policy vmi_relationships_update on public.vmi_vendor_client_relationships
for update to authenticated
using (public.vmi_can_manage(vendor_organization_id, 'vmi.clients.manage'))
with check (public.vmi_can_manage(vendor_organization_id, 'vmi.clients.manage'));

create policy vmi_catalog_exposures_select on public.vmi_catalog_exposures
for select to authenticated
using (
  deleted_at is null
  and (
    visibility_scope = 'public'
    or (client_account_id is not null and public.vmi_can_read(vendor_organization_id, client_account_id))
    or public.vmi_can_manage(vendor_organization_id, 'vmi.inventory.read')
  )
);

create policy vmi_catalog_exposures_insert on public.vmi_catalog_exposures
for insert to authenticated
with check (public.vmi_can_manage(vendor_organization_id, 'vmi.inventory.manage'));

create policy vmi_catalog_exposures_update on public.vmi_catalog_exposures
for update to authenticated
using (public.vmi_can_manage(vendor_organization_id, 'vmi.inventory.manage'))
with check (public.vmi_can_manage(vendor_organization_id, 'vmi.inventory.manage'));

create policy vmi_inventory_items_select on public.vmi_inventory_items
for select to authenticated
using (deleted_at is null and public.vmi_can_read(vendor_organization_id, client_account_id));

create policy vmi_inventory_items_insert on public.vmi_inventory_items
for insert to authenticated
with check (public.vmi_can_manage(vendor_organization_id, 'vmi.inventory.manage'));

create policy vmi_inventory_items_update on public.vmi_inventory_items
for update to authenticated
using (public.vmi_can_manage(vendor_organization_id, 'vmi.inventory.manage'))
with check (public.vmi_can_manage(vendor_organization_id, 'vmi.inventory.manage'));

create policy vmi_stock_count_sessions_select on public.vmi_stock_count_sessions
for select to authenticated
using (deleted_at is null and public.vmi_can_read(vendor_organization_id, client_account_id));

create policy vmi_stock_count_sessions_client_insert on public.vmi_stock_count_sessions
for insert to authenticated
with check (public.vmi_is_client_user(client_account_id) and submitted_by = (select auth.uid()));

create policy vmi_stock_count_sessions_manage on public.vmi_stock_count_sessions
for update to authenticated
using (public.vmi_can_manage(vendor_organization_id, 'vmi.stock_counts.manage'))
with check (public.vmi_can_manage(vendor_organization_id, 'vmi.stock_counts.manage'));

create policy vmi_stock_count_lines_select on public.vmi_stock_count_lines
for select to authenticated
using (deleted_at is null and public.vmi_can_read(vendor_organization_id, client_account_id));

create policy vmi_stock_count_lines_client_insert on public.vmi_stock_count_lines
for insert to authenticated
with check (public.vmi_is_client_user(client_account_id));

create policy vmi_stock_count_lines_manage on public.vmi_stock_count_lines
for update to authenticated
using (public.vmi_can_manage(vendor_organization_id, 'vmi.stock_counts.manage'))
with check (public.vmi_can_manage(vendor_organization_id, 'vmi.stock_counts.manage'));

create policy vmi_proposals_select on public.vmi_proposals
for select to authenticated
using (deleted_at is null and public.vmi_can_read(vendor_organization_id, client_account_id));

create policy vmi_proposals_insert on public.vmi_proposals
for insert to authenticated
with check (public.vmi_can_manage(vendor_organization_id, 'vmi.proposals.manage'));

create policy vmi_proposals_update on public.vmi_proposals
for update to authenticated
using (public.vmi_can_manage(vendor_organization_id, 'vmi.proposals.manage'))
with check (public.vmi_can_manage(vendor_organization_id, 'vmi.proposals.manage'));

create policy vmi_proposal_lines_select on public.vmi_proposal_lines
for select to authenticated
using (deleted_at is null and public.vmi_can_read(vendor_organization_id, client_account_id));

create policy vmi_proposal_lines_insert on public.vmi_proposal_lines
for insert to authenticated
with check (public.vmi_can_manage(vendor_organization_id, 'vmi.proposals.manage'));

create policy vmi_proposal_lines_update on public.vmi_proposal_lines
for update to authenticated
using (public.vmi_can_manage(vendor_organization_id, 'vmi.proposals.manage'))
with check (public.vmi_can_manage(vendor_organization_id, 'vmi.proposals.manage'));

create policy vmi_orders_select on public.vmi_orders
for select to authenticated
using (deleted_at is null and public.vmi_can_read(vendor_organization_id, client_account_id));

create policy vmi_orders_client_insert on public.vmi_orders
for insert to authenticated
with check (public.vmi_is_client_user(client_account_id) and created_by_client_user_id = (select auth.uid()));

create policy vmi_orders_manage on public.vmi_orders
for update to authenticated
using (public.vmi_can_manage(vendor_organization_id, 'vmi.orders.manage'))
with check (public.vmi_can_manage(vendor_organization_id, 'vmi.orders.manage'));

create policy vmi_order_lines_select on public.vmi_order_lines
for select to authenticated
using (deleted_at is null and public.vmi_can_read(vendor_organization_id, client_account_id));

create policy vmi_order_lines_client_insert on public.vmi_order_lines
for insert to authenticated
with check (public.vmi_is_client_user(client_account_id));

create policy vmi_order_lines_manage on public.vmi_order_lines
for update to authenticated
using (public.vmi_can_manage(vendor_organization_id, 'vmi.orders.manage'))
with check (public.vmi_can_manage(vendor_organization_id, 'vmi.orders.manage'));

create policy vmi_message_threads_select on public.vmi_message_threads
for select to authenticated
using (deleted_at is null and public.vmi_can_read(vendor_organization_id, client_account_id));

create policy vmi_message_threads_insert on public.vmi_message_threads
for insert to authenticated
with check (
  (created_by_client_user_id = (select auth.uid()) and public.vmi_is_client_user(client_account_id))
  or
  (created_by_vendor_user_id = (select auth.uid()) and public.vmi_can_manage(vendor_organization_id, 'vmi.messages.send'))
);

create policy vmi_messages_select on public.vmi_messages
for select to authenticated
using (deleted_at is null and public.vmi_can_read(vendor_organization_id, client_account_id));

create policy vmi_messages_insert on public.vmi_messages
for insert to authenticated
with check (
  (sender_kind = 'client' and sender_client_user_id = (select auth.uid()) and public.vmi_is_client_user(client_account_id))
  or
  (sender_kind = 'vendor' and sender_vendor_user_id = (select auth.uid()) and public.vmi_can_manage(vendor_organization_id, 'vmi.messages.send'))
);

do $$
declare
  v_table text;
begin
  foreach v_table in array array[
    'vmi_client_locations',
    'vmi_vendor_client_relationships',
    'vmi_catalog_exposures',
    'vmi_inventory_items',
    'vmi_stock_count_sessions',
    'vmi_stock_count_lines',
    'vmi_proposals',
    'vmi_proposal_lines',
    'vmi_orders',
    'vmi_order_lines',
    'vmi_message_threads',
    'vmi_messages'
  ]
  loop
    execute format('create policy %I on public.%I for all to service_role using (true) with check (true)', v_table || '_service_role', v_table);
  end loop;
end $$;

grant usage on schema public to authenticated;
grant select, insert, update on
  public.vmi_client_accounts,
  public.vmi_client_users,
  public.vmi_client_invitations,
  public.vmi_client_locations,
  public.vmi_vendor_client_relationships,
  public.vmi_catalog_exposures,
  public.vmi_inventory_items,
  public.vmi_stock_count_sessions,
  public.vmi_stock_count_lines,
  public.vmi_proposals,
  public.vmi_proposal_lines,
  public.vmi_orders,
  public.vmi_order_lines,
  public.vmi_message_threads,
  public.vmi_messages
to authenticated;

comment on table public.vmi_client_accounts is 'Buyer/client accounts connected to a vendor organization for the VMI portal.';
comment on table public.vmi_client_users is 'External buyer users attached to VMI client accounts.';
comment on table public.vmi_vendor_client_relationships is 'Vendor-client partnership state for VMI replenishment.';
comment on table public.vmi_catalog_exposures is 'Vendor catalog items exposed to public or specific VMI clients.';
