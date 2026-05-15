# Ambra Inventory V2 Production-Ready Specification

## Implementation Progress Tracker

Overall implementation status: **53 / 62 full-plan items complete**.

Current active phase: **Phase 4 - Extensions**.

Phase progress:

- Phase 1 - Inventory MVP: **24 / 24 complete**
- Phase 2 - Core Enterprise Layer: **13 / 13 complete**
- Phase 3 - Advanced Features: **15 / 15 complete**
- Phase 4 - Extensions: **1 / 10 complete**

Phase 1 database safety status: **10 / 10 invariants complete**.

Last updated: **2026-05-10**

Tracking rule:

- checked items are implemented in code or database and have at least focused verification
- unchecked items remain planned, even if they are described in this specification
- Phase 1 is the active implementation slice, but the tracker covers the full enterprise roadmap

### Phase 1 - Inventory MVP

- [x] Inventory settings table
- [x] Permission constants and seeds
- [x] Minimal product table
- [x] Minimal variant table
- [x] Default variant creation transaction
- [x] Basic units
- [x] Movement reasons
- [x] Inventory balances
- [x] Movement headers
- [x] Movement lines
- [x] Movement number generation
- [x] SKU generation fallback
- [x] Posting RPC
- [x] Reversal RPC
- [x] Receive stock action
- [x] Issue stock action
- [x] Transfer stock action
- [x] Adjustment action
- [x] Product DataView
- [x] Inventory DataView
- [x] Movement DataView
- [x] RLS policies
- [x] Audit events
- [x] Phase 1 tests

### Phase 2 - Core Enterprise Layer

- [x] Variant option groups
- [x] Variant option values
- [x] Variant generator
- [x] Reservations
- [x] Allocations
- [x] Lots
- [x] Serials
- [x] Basic procurement
- [x] Purchase orders
- [x] Partial receiving
- [x] Basic pricing
- [x] Weighted average cost
- [x] Phase 2 tests

### Phase 3 - Advanced Features

- [x] Advanced SKU patterns
- [x] Variant spreadsheet table UX
- [x] Copy column / fill down
- [x] Unit conversions
- [x] Product-specific unit conversions
- [x] Custom fields
- [x] Searchable/filterable custom fields
- [x] Collections
- [x] Saved views
- [x] Analytics dashboards
- [x] Imports
- [x] Exports
- [x] Inventory counts / cycle counts
- [x] Reports
- [x] Phase 3 tests

### Phase 4 - Extensions

- [ ] Showrooms
- [ ] Offers / quotes
- [ ] Bundles / kits
- [ ] Manufacturing readiness
- [ ] Rental readiness
- [x] Cross-branch transfer
- [ ] Approval workflows
- [ ] FEFO recommendations
- [ ] FIFO costing
- [ ] Phase 4 tests

### Phase 1 Safety Checklist

- [x] No direct writes to `inventory_balances` outside movement engine
- [x] No `product_id` stored on movement lines
- [x] Movement line unit must equal product base unit
- [x] Adjustment direction is explicit
- [x] Normal issue checks available stock, not just on-hand
- [x] Transfer checks available stock at source
- [x] Cost fields do not affect Phase 1 posting
- [x] Movement posting is idempotent
- [x] Movement posting locks affected balance rows
- [x] Posted movements are immutable

Next implementation slice:

- [ ] Manual smoke pass against the target database
- [ ] Resolve or isolate existing non-inventory type-check blockers

## Executive Summary

Ambra Inventory V2 is a ledger-based, enterprise-grade inventory system built on
the current warehouse V2 architecture. It uses organization-wide product master
data, branch/location-specific inventory state, and immutable posted stock
movements. The system is designed to reach Odoo/Zoho-level capability without
forcing a large first release.

The first production release must be a working inventory system, not a catalog
configuration project. Phase 1 therefore delivers only the critical path:
minimal products, default variants, basic units, balances, stock movements,
posting, core DataViews, and basic operational actions.

The long-term architecture remains intentionally extensible:

- products define what an item is
- variants are the only stock-bearing entity
- inventory balances represent current stock state
- movements change `on_hand`
- reservations reserve future stock and affect availability
- allocations assign exact stock and affect availability
- procurement, pricing, analytics, showrooms, and offers build on top

This specification replaces earlier broader planning with a build-safe,
phase-correct plan. It keeps the selected direction and removes contradictions,
especially around reservations and allocations being both movement kinds and
separate operational systems.

## Core Principles

### 1. Variants Are The Only Stock Entity

All stock, balances, movement lines, reservations, allocations, lots, serials,
barcodes, costs, and pricing rows reference `inventory_variants`.

Products are catalog containers. A product can be simple in the UI, but it still
has one default variant internally.

Rule:

```text
inventory entity = variant
product = product master / grouping / shared metadata
```

### 2. Ledger-Based Inventory

Users never directly edit stock balances. Every stock change happens through a
posted movement.

Balances are a projection of posted stock-changing operations plus reservation
and allocation counters. Completed movement records are immutable.

### 3. Separation Of Concerns

Do not mix product modeling, stock movement logic, reservations, procurement,
pricing, and analytics into one service or one schema concept.

Subsystem boundaries:

- Product system: product and variant master data
- Inventory state: balances and stock visibility
- Movement engine: stock-changing ledger operations
- Reservation system: future demand hold
- Allocation system: exact stock assignment
- Procurement: purchase intent and receiving flow
- Pricing: commercial price resolution
- Analytics: reporting, snapshots, and derived metrics

### 4. Organization-Wide Catalog, Branch-Specific Inventory

Products and variants are scoped to an organization. Stock state is scoped to a
branch and location.

This supports:

- one SKU catalog per organization
- branch-specific inventory levels
- branch-specific reorder rules
- branch-specific permissions
- clean transfers and reporting

### 5. Current Architecture Alignment

The implementation must align with the current repo:

- `public.warehouse_locations` is the operational location tree
- `public.warehouse_layouts` and `public.warehouse_layout_shapes` are visual map
  documents
- warehouse module access is gated by `MODULE_WAREHOUSE`
- user access is gated by `MODULE_WAREHOUSE_ACCESS`
- branch-aware access uses `has_branch_permission(organization_id, branch_id, slug)`
- services live under `apps/web/src/server/services`
- actions live under `apps/web/src/app/actions/warehouse`
- list/detail UX uses `apps/web/src/components/data-view`

Inventory V2 must not reference legacy location table names. All inventory
location references use:

```sql
references public.warehouse_locations(id)
```

## System Architecture

### Runtime Layers

```text
UI routes and components
  -> server actions
    -> server-only services
      -> Supabase authenticated client
        -> RLS-protected tables and RPCs
```

### Service Pattern

Inventory services follow the existing warehouse service style:

- import `"server-only"`
- accept an authenticated Supabase client
- never bypass RLS for normal user operations
- return `ServiceResult<T>`
- scope by `organization_id`
- scope branch operations by `branch_id`
- fail closed
- avoid throwing to callers for expected validation failures
- emit audit events after successful state changes

Example:

```ts
import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

export type ServiceResult<T> = { success: true; data: T } | { success: false; error: string };

export class InventoryMovementsService {
  static async postMovement(
    supabase: SupabaseClient,
    orgId: string,
    branchId: string,
    movementId: string,
    userId: string,
    idempotencyKey?: string
  ): Promise<ServiceResult<{ id: string; status: "posted" }>> {
    const { data, error } = await supabase.rpc("inventory_post_movement", {
      p_org_id: orgId,
      p_branch_id: branchId,
      p_movement_id: movementId,
      p_user_id: userId,
      p_idempotency_key: idempotencyKey ?? null,
    });

    if (error) return { success: false, error: error.message };
    return { success: true, data };
  }
}
```

### Action Guard Pattern

All inventory actions must use module entitlement, module permission, broad
warehouse read, and feature-specific permission checks.

```ts
async function requireInventoryContext(requiredPermission: string) {
  await entitlements.requireModuleAccess(MODULE_WAREHOUSE);

  const context = await loadDashboardContextV2();
  if (!context?.app.activeOrgId) {
    return { success: false as const, error: "No active organization" };
  }
  if (!context.app.activeBranchId) {
    return { success: false as const, error: "No active branch" };
  }
  if (!checkPermission(context.user.permissionSnapshot, MODULE_WAREHOUSE_ACCESS)) {
    return { success: false as const, error: "Unauthorized" };
  }
  if (!checkPermission(context.user.permissionSnapshot, WAREHOUSE_READ)) {
    return { success: false as const, error: "Unauthorized" };
  }
  if (!checkPermission(context.user.permissionSnapshot, requiredPermission)) {
    return { success: false as const, error: "Unauthorized" };
  }

  return { success: true as const, context };
}
```

## Data Model

This section defines the target schema. It is intentionally split by subsystem so
Phase 1 can ship a working inventory system without implementing all enterprise
features immediately.

Use the `inventory_` prefix for all new V2 inventory tables. This avoids
confusion with older partial migrations.

### Inventory Settings

Inventory settings are organization-scoped defaults. Branch/product overrides may
exist later, but the organization settings define baseline behavior.

```sql
create table public.inventory_settings (
  organization_id uuid primary key references public.organizations(id) on delete cascade,

  allow_negative_stock boolean not null default false,
  default_currency text not null default 'PLN',
  cost_method text not null default 'none',
  rounding_precision integer not null default 4,

  movement_number_prefix text not null default 'INV',
  movement_number_next integer not null default 1,

  sku_generation_enabled boolean not null default true,
  sku_prefix text null,
  sku_pattern text not null default '{PRODUCT}-{SEQ}',
  sku_next integer not null default 1,

  expiry_enforcement text not null default 'warn',

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint inventory_settings_cost_method_check check (
    cost_method in ('none', 'weighted_average', 'fifo')
  ),
  constraint inventory_settings_rounding_precision_check check (
    rounding_precision between 0 and 8
  ),
  constraint inventory_settings_expiry_enforcement_check check (
    expiry_enforcement in ('off', 'warn', 'block')
  ),
  constraint inventory_settings_movement_next_positive check (movement_number_next > 0),
  constraint inventory_settings_sku_next_positive check (sku_next > 0)
);
```

Phase behavior:

- Phase 1 defaults `cost_method = 'none'`.
- Phase 2 introduces `weighted_average`.
- `fifo` is reserved for future compatibility and must not be selectable until
  FIFO cost layers exist.

### Products

Products define shared catalog information. They do not hold stock directly.

```sql
create table public.inventory_products (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,

  name text not null,
  description text null,
  product_type text not null default 'stocked',
  status text not null default 'active',

  base_unit_id uuid null,
  default_variant_id uuid null,

  category_id uuid null,
  brand_id uuid null,

  created_by uuid null references public.users(id) on delete set null,
  updated_by uuid null references public.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz null,

  constraint inventory_products_name_not_empty check (length(trim(name)) > 0),
  constraint inventory_products_type_check check (
    product_type in ('stocked', 'consumable', 'service', 'serialized', 'lot_tracked', 'bundle')
  ),
  constraint inventory_products_status_check check (
    status in ('active', 'archived', 'discontinued')
  )
);

create index inventory_products_org_status_idx
  on public.inventory_products (organization_id, status)
  where deleted_at is null;
```

`default_variant_id` is nullable during creation because the product row and
default variant row are created in one transaction. The service must update it
before returning success.

### Variants

Variants are the stock entity. A simple product gets one default variant.

```sql
create table public.inventory_variants (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  product_id uuid not null references public.inventory_products(id) on delete restrict,

  name text not null,
  sku text not null,
  status text not null default 'active',
  is_default boolean not null default false,

  default_purchase_price numeric(18, 6) null,
  default_sales_price numeric(18, 6) null,
  default_currency text not null default 'PLN',

  created_by uuid null references public.users(id) on delete set null,
  updated_by uuid null references public.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz null,

  constraint inventory_variants_name_not_empty check (length(trim(name)) > 0),
  constraint inventory_variants_sku_not_empty check (length(trim(sku)) > 0),
  constraint inventory_variants_status_check check (
    status in ('active', 'archived', 'discontinued')
  )
);

create unique index inventory_variants_org_sku_unique_idx
  on public.inventory_variants (organization_id, lower(sku))
  where deleted_at is null;

create unique index inventory_variants_one_default_per_product_idx
  on public.inventory_variants (product_id)
  where is_default = true and deleted_at is null;

create index inventory_variants_product_idx
  on public.inventory_variants (product_id)
  where deleted_at is null;
```

Required validation:

```text
variant.organization_id == product.organization_id
variant.product_id belongs to product.id
```

Because this is cross-row validation, enforce it in a trigger or in transactional
service/RPC logic. Do not rely only on application forms.

### Basic Units

Phase 1 needs only basic units. Unit conversions are Phase 3.

```sql
create table public.inventory_units (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  name text not null,
  symbol text not null,
  unit_type text not null default 'count',
  precision_scale integer not null default 4,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz null,

  constraint inventory_units_type_check check (
    unit_type in ('count', 'weight', 'length', 'volume', 'area', 'custom')
  ),
  constraint inventory_units_precision_check check (precision_scale between 0 and 8)
);

create unique index inventory_units_org_symbol_unique_idx
  on public.inventory_units (organization_id, lower(symbol))
  where deleted_at is null;
```

Seed per organization on inventory initialization:

- `pcs`
- `kg`
- `g`
- `l`
- `m`

Phase 1 does not convert between them. Movement lines must use the product base
unit unless conversions are added in Phase 3.

### Inventory Balances

Balances store current branch/location stock state. They are not user-editable.
They are attached to the concrete stock entity, `variant_id`. Product context is
derived through `inventory_variants.product_id`.

Reasoning:

- `variant_id` already points to the product.
- storing `product_id` directly on balances creates a second source of truth
- stock must always attach to the concrete variant
- product-level reporting should join `balance -> variant -> product`

```sql
create table public.inventory_balances (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  branch_id uuid not null references public.branches(id) on delete cascade,
  location_id uuid not null references public.warehouse_locations(id) on delete restrict,
  variant_id uuid not null references public.inventory_variants(id) on delete restrict,

  lot_id uuid null,
  serial_id uuid null,

  on_hand_quantity numeric(18, 6) not null default 0,
  reserved_quantity numeric(18, 6) not null default 0,
  allocated_quantity numeric(18, 6) not null default 0,
  available_quantity numeric(18, 6) generated always as (
    on_hand_quantity - reserved_quantity - allocated_quantity
  ) stored,

  last_movement_id uuid null,
  last_movement_at timestamptz null,
  updated_at timestamptz not null default now(),

  constraint inventory_balances_nonnegative_counters check (
    on_hand_quantity >= 0
    and reserved_quantity >= 0
    and allocated_quantity >= 0
  )
);

create unique index inventory_balances_natural_unique_idx
  on public.inventory_balances (
    organization_id,
    branch_id,
    location_id,
    variant_id,
    coalesce(lot_id, '00000000-0000-0000-0000-000000000000'::uuid),
    coalesce(serial_id, '00000000-0000-0000-0000-000000000000'::uuid)
  );

create index inventory_balances_variant_branch_idx
  on public.inventory_balances (organization_id, branch_id, variant_id);

create index inventory_balances_location_idx
  on public.inventory_balances (location_id);

create index inventory_balances_available_idx
  on public.inventory_balances (organization_id, branch_id, available_quantity);
```

`lot_id` and `serial_id` become foreign keys after Phase 2 lot/serial tables are
introduced. They are present in Phase 1 to avoid future balance-table rewrites.

`last_movement_id` should get its foreign key after
`inventory_movement_headers` exists:

```sql
alter table public.inventory_balances
  add constraint inventory_balances_last_movement_id_fkey
  foreign key (last_movement_id)
  references public.inventory_movement_headers(id)
  on delete set null;
```

### Balance Creation Rule

Users never create balance rows manually. Balance rows are created automatically
by stock-affecting operations.

A balance row is created on the first posted stock operation for the natural key:

```text
organization_id
branch_id
location_id
variant_id
lot_id
serial_id
```

Rules:

- movement posting creates missing balance rows
- movement posting locks balance rows before updating them
- the unique balance index prevents duplicate rows
- if concurrent insert hits a unique conflict, retry selecting the balance row
  `for update`
- product context is always derived through `variant_id`

This keeps balance state deterministic under concurrency and avoids manual stock
setup screens that could bypass ledger rules.

### Cost And Valuation Storage

Phase 1 balances are quantity-only. They do not store:

- `average_unit_cost`
- `total_value`
- `currency`

Reasoning:

- Phase 1 must prove stock correctness first.
- costing introduces separate correctness rules and a wider test matrix.
- weighted average cost must be implemented intentionally, not as a side effect
  of balance posting.

Phase model:

```text
Phase 1 = quantity correctness
Phase 2/3 = cost and valuation correctness
```

When weighted average cost is introduced, use separate cost/valuation tables
rather than adding financial truth directly into the Phase 1 balance row.

### Movement Reasons

Structured reasons are required for audit, adjustment analysis, scrap/loss
reporting, and operational analytics.

```sql
create table public.inventory_movement_reasons (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  code text not null,
  name text not null,
  description text null,
  applies_to text[] not null default '{}',
  requires_note boolean not null default false,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz null
);

create unique index inventory_movement_reasons_org_code_unique_idx
  on public.inventory_movement_reasons (organization_id, lower(code))
  where deleted_at is null;
```

Movement headers store both:

- `reason_id`: configured reason reference
- `reason_code`: denormalized code snapshot at posting time

`reason_code` is kept intentionally so historic movement reports still show the
reason code even if the configured reason is later renamed, archived, or deleted.

### Movement Headers

Movements change `on_hand_quantity`. They do not represent reservations or
allocations.

```sql
create table public.inventory_movement_headers (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete restrict,
  branch_id uuid not null references public.branches(id) on delete restrict,

  movement_number text not null,
  movement_kind text not null,
  status text not null default 'draft',

  reference_type text null,
  reference_id uuid null,
  reference_number text null,

  reason_id uuid null references public.inventory_movement_reasons(id) on delete set null,
  reason_code text null,
  notes text null,
  metadata jsonb not null default '{}',

  idempotency_key text null,

  posted_at timestamptz null,
  posted_by uuid null references public.users(id) on delete set null,

  reversed_movement_id uuid null references public.inventory_movement_headers(id) on delete restrict,
  reversal_of_movement_id uuid null references public.inventory_movement_headers(id) on delete restrict,

  created_by uuid null references public.users(id) on delete set null,
  updated_by uuid null references public.users(id) on delete set null,
  cancelled_by uuid null references public.users(id) on delete set null,
  cancelled_at timestamptz null,
  cancellation_reason text null,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz null,

  constraint inventory_movement_kind_check check (
    movement_kind in (
      'receipt',
      'issue',
      'transfer',
      'adjustment',
      'opening_balance'
    )
  ),
  constraint inventory_movement_status_check check (
    status in ('draft', 'posted', 'cancelled', 'reversed')
  ),
  constraint inventory_movement_posted_fields_check check (
    (status <> 'posted') or (posted_at is not null and posted_by is not null)
  )
);

create unique index inventory_movement_number_org_unique_idx
  on public.inventory_movement_headers (organization_id, movement_number);

create unique index inventory_movement_idempotency_unique_idx
  on public.inventory_movement_headers (organization_id, idempotency_key)
  where idempotency_key is not null;

create index inventory_movement_branch_status_idx
  on public.inventory_movement_headers (organization_id, branch_id, status, created_at desc)
  where deleted_at is null;

create index inventory_movement_reference_idx
  on public.inventory_movement_headers (organization_id, reference_type, reference_id)
  where reference_type is not null and reference_id is not null;
```

### Movement Number Generation

Movement numbers are user-facing identifiers. UUIDs remain the internal primary
keys and integration-safe identifiers.

Expected sequence:

```text
INV-000001
INV-000002
INV-000003
```

Rules:

- movement numbers are generated server-side only
- generation is atomic
- generation locks the `inventory_settings` row for the organization
- `movement_number_next` increments in the same transaction that creates the
  movement header
- movement numbers are unique per organization
- clients cannot submit trusted movement numbers
- idempotent retries with the same idempotency key must return the already
  created movement and must not consume another number

Generation flow:

1. Start transaction.
2. Check whether `organization_id + idempotency_key` already created a movement.
3. If found, return that movement.
4. Lock `inventory_settings` for the organization `for update`.
5. Format movement number from `movement_number_prefix` and `movement_number_next`.
6. Insert movement header.
7. Increment `movement_number_next`.
8. Commit transaction.

Reasoning: movement numbers are visible in warehouse workflows and reports, so
they need stable ordering and uniqueness. They must not be generated in the UI or
with a non-locked "select max + 1" query because concurrent users could receive
duplicate numbers.

Movement kinds intentionally exclude:

- reservation
- allocation
- release

Those belong to separate operational systems.

### Movement Lines

Movement lines store only `variant_id` as stock identity. Product context is
derived through `inventory_variants.product_id`.

Reasoning:

- `variant_id` already points to the product
- storing `product_id` on movement lines creates a duplicate source of truth
- duplicate product/variant identity can drift under bugs or manual data repair
- this matches the balance-table rule: stock state belongs to variants
- movement validation becomes simpler because the engine validates one stock
  identity and derives product behavior from the variant relationship

```sql
create table public.inventory_movement_lines (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete restrict,
  branch_id uuid not null references public.branches(id) on delete restrict,
  movement_id uuid not null references public.inventory_movement_headers(id) on delete restrict,
  line_number integer not null,

  variant_id uuid not null references public.inventory_variants(id) on delete restrict,

  source_location_id uuid null references public.warehouse_locations(id) on delete restrict,
  destination_location_id uuid null references public.warehouse_locations(id) on delete restrict,

  quantity numeric(18, 6) not null,
  unit_id uuid not null references public.inventory_units(id) on delete restrict,

  lot_id uuid null,
  serial_id uuid null,

  unit_cost numeric(18, 6) null,
  total_cost numeric(18, 6) null,
  currency text not null default 'PLN',

  notes text null,
  metadata jsonb not null default '{}',
  created_at timestamptz not null default now(),

  constraint inventory_movement_line_quantity_positive check (quantity > 0),
  constraint inventory_movement_line_cost_check check (
    (unit_cost is null and total_cost is null)
    or (unit_cost >= 0 and total_cost >= 0)
  ),
  unique (movement_id, line_number)
);

create index inventory_movement_lines_variant_idx
  on public.inventory_movement_lines (organization_id, variant_id, created_at desc);

create index inventory_movement_lines_source_location_idx
  on public.inventory_movement_lines (source_location_id)
  where source_location_id is not null;

create index inventory_movement_lines_destination_location_idx
  on public.inventory_movement_lines (destination_location_id)
  where destination_location_id is not null;
```

`lot_id` and `serial_id` become foreign keys in Phase 2. They exist from Phase 1
to preserve table shape.

In Phase 1, `unit_cost`, `total_cost`, and `currency` are captured metadata only:

- they do not update balances
- they do not update valuation
- they do not affect posting logic beyond basic nonnegative validation
- they are stored so later valuation/reporting can use historic receipt costs

Phase 2/3 valuation uses dedicated cost tables. The balance table remains
quantity-first.

### Phase 2 Lot And Serial Tables

```sql
create table public.inventory_lots (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  product_id uuid not null references public.inventory_products(id) on delete restrict,
  variant_id uuid not null references public.inventory_variants(id) on delete restrict,
  lot_number text not null,
  manufactured_at date null,
  expires_at date null,
  supplier_reference text null,
  status text not null default 'active',
  metadata jsonb not null default '{}',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz null,
  constraint inventory_lots_status_check check (
    status in ('active', 'quarantined', 'expired', 'recalled', 'archived')
  )
);

create unique index inventory_lots_variant_number_unique_idx
  on public.inventory_lots (organization_id, variant_id, lower(lot_number))
  where deleted_at is null;

create table public.inventory_serials (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  product_id uuid not null references public.inventory_products(id) on delete restrict,
  variant_id uuid not null references public.inventory_variants(id) on delete restrict,
  serial_number text not null,
  lot_id uuid null references public.inventory_lots(id) on delete set null,
  current_branch_id uuid null references public.branches(id) on delete set null,
  current_location_id uuid null references public.warehouse_locations(id) on delete set null,
  warranty_starts_at date null,
  warranty_ends_at date null,
  status text not null default 'in_stock',
  metadata jsonb not null default '{}',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz null,
  constraint inventory_serials_status_check check (
    status in ('in_stock', 'reserved', 'allocated', 'issued', 'scrapped', 'archived')
  )
);

create unique index inventory_serials_org_number_unique_idx
  on public.inventory_serials (organization_id, lower(serial_number))
  where deleted_at is null;
```

Lots and serials intentionally keep `product_id` alongside `variant_id` as a
denormalized convenience for tracking screens and reporting. This is acceptable
only because validation must guarantee:

```text
lot.product_id == lot.variant.product_id
serial.product_id == serial.variant.product_id
```

Stock identity remains `variant_id`.

After these tables exist, add foreign keys:

```sql
alter table public.inventory_balances
  add constraint inventory_balances_lot_id_fkey
  foreign key (lot_id) references public.inventory_lots(id) on delete restrict;

alter table public.inventory_balances
  add constraint inventory_balances_serial_id_fkey
  foreign key (serial_id) references public.inventory_serials(id) on delete restrict;

alter table public.inventory_movement_lines
  add constraint inventory_movement_lines_lot_id_fkey
  foreign key (lot_id) references public.inventory_lots(id) on delete restrict;

alter table public.inventory_movement_lines
  add constraint inventory_movement_lines_serial_id_fkey
  foreign key (serial_id) references public.inventory_serials(id) on delete restrict;
```

### Reservations

Reservations hold future demand. They do not change `on_hand_quantity`.

```sql
create table public.inventory_reservations (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  branch_id uuid not null references public.branches(id) on delete cascade,
  reservation_number text not null,
  status text not null default 'active',
  reference_type text null,
  reference_id uuid null,
  reference_number text null,
  expires_at timestamptz null,
  priority integer not null default 0,
  notes text null,
  created_by uuid null references public.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  cancelled_at timestamptz null,
  cancelled_by uuid null references public.users(id) on delete set null,
  deleted_at timestamptz null,
  constraint inventory_reservations_status_check check (
    status in ('active', 'partial', 'fulfilled', 'expired', 'cancelled')
  )
);

create unique index inventory_reservations_number_org_unique_idx
  on public.inventory_reservations (organization_id, reservation_number);

create table public.inventory_reservation_lines (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  branch_id uuid not null references public.branches(id) on delete cascade,
  reservation_id uuid not null references public.inventory_reservations(id) on delete cascade,
  product_id uuid not null references public.inventory_products(id) on delete restrict,
  variant_id uuid not null references public.inventory_variants(id) on delete restrict,
  location_id uuid null references public.warehouse_locations(id) on delete restrict,
  lot_id uuid null references public.inventory_lots(id) on delete restrict,
  serial_id uuid null references public.inventory_serials(id) on delete restrict,
  reserved_quantity numeric(18, 6) not null,
  released_quantity numeric(18, 6) not null default 0,
  fulfilled_quantity numeric(18, 6) not null default 0,
  created_at timestamptz not null default now(),
  constraint inventory_reservation_line_qty_check check (
    reserved_quantity > 0
    and released_quantity >= 0
    and fulfilled_quantity >= 0
    and released_quantity + fulfilled_quantity <= reserved_quantity
  )
);
```

### Allocations

Allocations assign exact stock from a location, lot, or serial. They do not
change `on_hand_quantity` until fulfilled by an issue movement.

```sql
create table public.inventory_allocations (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  branch_id uuid not null references public.branches(id) on delete cascade,
  allocation_number text not null,
  status text not null default 'active',
  reservation_id uuid null references public.inventory_reservations(id) on delete set null,
  reference_type text null,
  reference_id uuid null,
  reference_number text null,
  created_by uuid null references public.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz null,
  constraint inventory_allocations_status_check check (
    status in ('active', 'released', 'fulfilled', 'cancelled')
  )
);

create table public.inventory_allocation_lines (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  branch_id uuid not null references public.branches(id) on delete cascade,
  allocation_id uuid not null references public.inventory_allocations(id) on delete cascade,
  reservation_line_id uuid null references public.inventory_reservation_lines(id) on delete set null,
  product_id uuid not null references public.inventory_products(id) on delete restrict,
  variant_id uuid not null references public.inventory_variants(id) on delete restrict,
  location_id uuid not null references public.warehouse_locations(id) on delete restrict,
  lot_id uuid null references public.inventory_lots(id) on delete restrict,
  serial_id uuid null references public.inventory_serials(id) on delete restrict,
  allocated_quantity numeric(18, 6) not null,
  fulfilled_quantity numeric(18, 6) not null default 0,
  created_at timestamptz not null default now(),
  constraint inventory_allocation_line_qty_check check (
    allocated_quantity > 0
    and fulfilled_quantity >= 0
    and fulfilled_quantity <= allocated_quantity
  )
);
```

## Movement System

### Correct Conceptual Model

```text
movements    -> change on_hand stock
reservations -> reserve future stock and reduce available
allocations  -> assign exact stock and reduce available
```

Movement kinds:

- `receipt`
- `issue`
- `transfer`
- `adjustment`
- `opening_balance`

Not movement kinds:

- reservation
- allocation
- release

Reservations and allocations can emit audit events and write operational rows,
but they are not stock ledger movements because they do not change `on_hand`.

### Movement Status Flow

```text
draft -> posted
draft -> cancelled
posted -> reversed
```

Rules:

- Draft movements are editable.
- Posted movements are immutable.
- Cancelled draft movements have no stock effect.
- Reversal creates a new posted movement with opposite stock effects.
- The original posted movement is marked `reversed`.

### Movement Line Validation Matrix

| Operation                                           | `source_location_id` | `destination_location_id` | Stock effect                                                |
| --------------------------------------------------- | -------------------- | ------------------------- | ----------------------------------------------------------- |
| `receipt`                                           | must be null         | required                  | increases destination `on_hand`                             |
| `opening_balance`                                   | must be null         | required                  | increases destination `on_hand`                             |
| `issue`                                             | required             | must be null              | decreases source `on_hand`                                  |
| `transfer`                                          | required             | required                  | decreases source `on_hand`, increases destination `on_hand` |
| `adjustment` with `adjustment_direction = increase` | must be null         | required                  | increases destination `on_hand`                             |
| `adjustment` with `adjustment_direction = decrease` | required             | must be null              | decreases source `on_hand`                                  |

Rules:

- `quantity` is always positive
- `movement_kind` remains `adjustment`
- adjustment operation input must include `adjustment_direction`
- valid adjustment directions are `increase` and `decrease`
- `adjustment_direction = increase` requires `destination_location_id` and no
  `source_location_id`
- `adjustment_direction = decrease` requires `source_location_id` and no
  `destination_location_id`
- service products cannot be used in stock-changing movement lines
- bundle products cannot be used in stock-changing movement lines during Phase 1
- serialized and lot-tracked products cannot be posted until Phase 2 tracking
  tables and validation are implemented
- all source/destination locations must belong to the same organization and
  branch as the movement in Phase 1

Reasoning: positive-only quantities make movement math easier to audit. The
movement kind plus explicit adjustment direction explains the stock effect; the
quantity value only states magnitude. This avoids negative-quantity bugs and
makes adjustment intent clear in audit logs.

### Future Cross-Branch Transfers

Phase 1 only supports same-branch transfers. Source and destination locations
must belong to the active branch.

Future cross-branch transfers should be modeled as a two-step flow:

1. source branch dispatch
2. stock held in a transit location/state
3. destination branch receive

Do not fake cross-branch transfer by directly decreasing one branch balance and
increasing another branch balance in one simple transfer line. Cross-branch
transfer should create linked outbound and inbound movements so each branch keeps
clear responsibility, audit history, and permission boundaries.

Reasoning: cross-branch inventory has custody and authorization implications.
Treating it as two linked operations keeps branch RLS, receiving accountability,
and in-transit reporting clean.

### Basic UI Actions In Phase 1

Phase 1 UI must support:

- create product
- edit minimal product fields
- archive product
- receive stock
- issue stock
- transfer stock
- adjust stock with explicit increase/decrease direction
- import or manually enter opening balance
- view products
- view inventory balances
- view movement history
- open movement detail
- reverse posted movement if user has permission

## Inventory Logic Rules

### Quantity Rules

- Quantities are decimal, using `numeric(18, 6)`.
- Phase 1 movements use the product base unit only.
- Phase 3 adds conversions.
- Balance counters cannot be negative.
- Available quantity is generated:

```text
available = on_hand - reserved - allocated
```

Phase 1 has no reservations or allocations, so:

```text
available = on_hand
```

The movement engine should still be designed around available-stock checks so
Phase 2 can enforce reservations and allocations without redesign.

### Phase 1 Unit Rule

Phase 1 movement line units must match the product base unit of the line's
variant:

```text
movement_line.unit_id == movement_line.variant.product.base_unit_id
```

If the provided `unit_id` does not equal the product base unit:

- reject draft creation or posting
- do not attempt implicit conversion
- do not silently accept the line

Reasoning: conversions are Phase 3. Allowing non-base units before conversion
logic exists would corrupt stock because the engine would not know whether `1`
means one piece, one box, or one pallet.

### Adjustment Direction Rule

Adjustment operations must explicitly include:

```text
adjustment_direction = increase | decrease
```

Rules:

- `movement_kind` remains `adjustment`
- `quantity` is always positive
- `adjustment_direction = increase` increases destination `on_hand`
- `adjustment_direction = decrease` decreases source `on_hand`
- negative quantities are never used

Reasoning: quantity represents magnitude only. Direction is business meaning.
Keeping them separate prevents negative-quantity bugs and makes reversals easier
to audit.

### Negative Stock Rules

Default:

```text
negative stock blocked
```

Override sources:

1. `inventory_settings.allow_negative_stock`
2. future branch/product override

Phase 1 only uses organization setting.

If negative stock is disabled, posting outbound stock must fail when:

```text
on_hand_quantity - outbound_quantity < 0
```

For normal issue operations not fulfilling a reservation or allocation, the check
is:

```text
source.available_quantity >= issue_quantity
```

This means normal issue cannot consume stock that is already reserved or
allocated.

For normal transfer operations, the source check is:

```text
source.available_quantity >= transfer_quantity
```

This means normal transfer cannot move stock already promised to another
workflow.

Phase 1 has no reservations or allocations, so available equals on-hand. The same
available-check contract still applies.

Only explicit reservation/allocation fulfillment flows may consume reserved or
allocated stock.

### Product Type Behavior

| Product type  | Stock allowed          | Requires lot | Requires serial | Movement behavior                                       |
| ------------- | ---------------------- | ------------ | --------------- | ------------------------------------------------------- |
| `stocked`     | yes                    | no           | no              | normal stock movements                                  |
| `consumable`  | yes                    | no           | no              | stock can be tracked, may be expensed/issued frequently |
| `service`     | no                     | no           | no              | cannot appear on stock-changing movement lines          |
| `serialized`  | yes                    | no           | yes             | each unit requires serial identity                      |
| `lot_tracked` | yes                    | yes          | no              | each movement line requires lot                         |
| `bundle`      | no direct stock in MVP | no           | no              | Phase 4 kit/BOM behavior                                |

Rules:

- `service` products still have a default variant for catalog/pricing, but that
  variant cannot be used on stock-changing movements.
- `bundle` products exist for future commercial/kit flows. Phase 1 and Phase 2
  must reject bundle variants on stock-changing movement lines.
- `serialized` products require Phase 2 serial support before they can be moved.
  If created in Phase 1, they are catalog-only until Phase 2.
- `lot_tracked` products require Phase 2 lot support before they can be moved.
  If created in Phase 1, they are catalog-only until Phase 2.

Phase 1 UI should either hide `serialized`, `lot_tracked`, and `bundle` product
types or mark them as not operational until Phase 2/4.

## Product System

### MVP Product Model

Phase 1 product fields:

- name
- description
- product type
- status
- base unit
- default SKU
- default variant

Phase 1 intentionally excludes:

- variant option groups
- generated combinations
- custom fields
- collections
- media
- supplier-specific data
- advanced SKU patterns

### SKU Generation Rules

SKU rules:

- SKU is required for stock-tracked variants.
- SKU is unique per organization.
- SKU can be manually entered.
- If SKU is not entered and SKU generation is enabled, the system generates it.
- SKU changes after creation are allowed but audited.
- Historical movement lines keep variant IDs, so SKU changes do not corrupt
  movement history.
- Advanced pattern-based generation and bulk SKU generation are Phase 3 features.

Phase 1 fallback generation:

- Phase 1 default pattern: `{PRODUCT}-{SEQ}`.
- `{PRODUCT}` is a sanitized product name prefix.
- `{SEQ}` uses `inventory_settings.sku_next`.
- generation happens server-side
- generation locks the `inventory_settings` row for the organization
- `sku_next` increments atomically in the same transaction that creates the
  variant
- generated SKU is still validated against the organization unique index
- if the generated SKU collides, retry with the next sequence inside the same
  transaction
- clients cannot reserve SKU numbers outside the creation transaction

Example:

```text
Product: Brake Pad Set
Pattern: {PRODUCT}-{SEQ}
Generated SKU: BRAKE-PAD-SET-000001
```

SKU edit rules:

- cannot be blank for stock-tracked variants
- must remain unique per organization
- creates audit event
- does not rewrite historic movement numbers or references

Reasoning: users need manual SKU control for enterprise data migration and
supplier/customer conventions, but generated fallback SKUs keep product creation
fast. Locking `inventory_settings` prevents two concurrent product creations
from receiving the same generated sequence.

### Phase 2 Variant System

Phase 2 adds:

- option groups
- option values
- generated combinations
- excluded combinations
- independent variant archive
- variant-specific barcode/media fields

Variant option schema:

```sql
create table public.inventory_option_groups (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  name text not null,
  display_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz null
);

create unique index inventory_option_groups_org_name_unique_idx
  on public.inventory_option_groups (organization_id, lower(name))
  where deleted_at is null;

create table public.inventory_option_values (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  option_group_id uuid not null references public.inventory_option_groups(id) on delete cascade,
  value text not null,
  display_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz null
);

create unique index inventory_option_values_group_value_unique_idx
  on public.inventory_option_values (option_group_id, lower(value))
  where deleted_at is null;

create table public.inventory_variant_option_values (
  variant_id uuid not null references public.inventory_variants(id) on delete cascade,
  option_group_id uuid not null references public.inventory_option_groups(id) on delete restrict,
  option_value_id uuid not null references public.inventory_option_values(id) on delete restrict,
  created_at timestamptz not null default now(),
  primary key (variant_id, option_group_id)
);
```

## Inventory State

Inventory state is read from `inventory_balances`.

Balance dimensions:

- organization
- branch
- location
- variant
- lot, optional from Phase 2
- serial, optional from Phase 2

Product information is read through:

```text
balance -> variant -> product
```

Stock can exist at any active `warehouse_locations` node. UI should encourage
operationally precise locations but must not enforce leaf-only stock.

### Inventory DataView

Phase 1 inventory DataView columns:

- SKU
- product name, derived through variant
- location
- on hand
- available
- unit
- last movement

Phase 2 adds:

- reserved
- allocated
- lot
- serial

Phase 3 adds:

- average cost, from valuation tables
- total value, from valuation tables
- aging
- last received
- last issued

## Reservations & Allocations

Reservations and allocations are separate from stock movements.

### Reservation Rules

Reservations:

- reduce `available_quantity`
- do not change `on_hand_quantity`
- can be split across locations
- can expire
- can be linked to an external reference
- can be partially released
- can be partially fulfilled

Creating a reservation increases `inventory_balances.reserved_quantity`.

Releasing or expiring a reservation decreases `reserved_quantity`.

### Future Enhancement: Soft vs Hard Reservations

Phase 2 starts with one reservation type: a guaranteed stock hold that reduces
available stock.

Future versions may add reservation strength:

- soft reservation: planning hold or forecasted demand
- hard reservation: guaranteed stock hold

Soft reservations are useful for forecasting and planning, but they should not be
introduced until reporting and availability semantics are ready. Phase 2 should
avoid this complexity and treat reservations as hard reservations.

### Allocation Rules

Allocations:

- assign exact stock at location, lot, or serial level
- reduce `available_quantity`
- do not change `on_hand_quantity`
- can be linked to a reservation
- can be released
- can be fulfilled by a stock issue

If allocation is created from reservation:

```text
reserved_quantity decreases
allocated_quantity increases
```

This prevents double-counting demand.

If allocation is created without reservation:

```text
allocated_quantity increases
```

Fulfilling allocation:

```text
allocated_quantity decreases
on_hand_quantity decreases via posted issue movement
```

### Reserved And Allocated Stock Consumption Rules

Reserved and allocated stock must not be consumed accidentally by unrelated
operations.

Rules:

- normal issue cannot consume allocated stock unless explicitly fulfilling that
  allocation
- normal issue should not consume reserved stock unless explicitly fulfilling
  that reservation
- normal issue must check `available_quantity >= issue_quantity` when it is not
  fulfilling a reservation or allocation
- transfer should not move allocated stock unless the allocation is moved or
  released first
- transfer should not move reserved stock unless the reservation is released or a
  future reservation-aware transfer flow updates the reservation location
- normal transfer must check source `available_quantity >= transfer_quantity`
- allocation fulfillment creates an issue movement linked to the allocation
  reference
- reservation fulfillment decreases reserved quantity and reduces `on_hand`
  through an issue movement
- allocation from reservation decreases `reserved_quantity` and increases
  `allocated_quantity` to prevent double counting

Reference examples:

```json
{
  "reference_type": "allocation",
  "reference_id": "allocation-id",
  "reference_number": "ALLOC-2026-00001"
}
```

```json
{
  "reference_type": "reservation",
  "reference_id": "reservation-id",
  "reference_number": "RSV-2026-00001"
}
```

Reasoning: enterprise inventory frequently has stock promised to orders, jobs,
repairs, or projects. These rules prevent a normal warehouse issue or transfer
from silently consuming stock assigned to another workflow.

## Units & Conversions

### Phase 1

Phase 1 supports basic units only. Product base unit is required for stock-tracked
products. Movement lines must use the base unit.

Implementation rule:

```text
movement_line.unit_id must equal movement_line.variant.product.base_unit_id
```

If the unit does not match, the system rejects the draft or posting. It must not
perform implicit conversion and must not store the movement as if the quantity
were valid.

Reasoning: Phase 1 quantity math must be simple and safe. Unit conversions are
introduced only after explicit conversion tables, rounding rules, and tests exist
in Phase 3.

### Phase 3

Phase 3 adds:

- unit categories
- global conversions
- product-specific conversions
- purchase unit
- sales unit
- base unit
- rounding rules
- precision rules

Conversion schema:

```sql
create table public.inventory_unit_conversions (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  from_unit_id uuid not null references public.inventory_units(id) on delete restrict,
  to_unit_id uuid not null references public.inventory_units(id) on delete restrict,
  factor numeric(24, 12) not null,
  created_at timestamptz not null default now(),
  deleted_at timestamptz null,
  constraint inventory_unit_conversion_factor_positive check (factor > 0)
);

create table public.inventory_product_unit_conversions (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  product_id uuid not null references public.inventory_products(id) on delete cascade,
  from_unit_id uuid not null references public.inventory_units(id) on delete restrict,
  to_unit_id uuid not null references public.inventory_units(id) on delete restrict,
  factor numeric(24, 12) not null,
  rounding_mode text not null default 'half_up',
  created_at timestamptz not null default now(),
  deleted_at timestamptz null,
  constraint inventory_product_unit_conversion_factor_positive check (factor > 0),
  constraint inventory_product_unit_rounding_check check (
    rounding_mode in ('half_up', 'up', 'down')
  )
);
```

Movement lines should later store:

- entered quantity
- entered unit
- base quantity
- base unit
- conversion factor used

Do not add these extra movement fields in Phase 1 unless conversions are also
implemented.

## Procurement

Procurement starts in Phase 2 with basic purchase orders.

Phase 2 procurement:

- suppliers
- purchase order headers
- purchase order lines
- partial receiving
- receipt movement creation

```sql
create table public.inventory_suppliers (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  name text not null,
  email text null,
  phone text null,
  status text not null default 'active',
  created_by uuid null references public.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz null,
  constraint inventory_suppliers_status_check check (
    status in ('active', 'inactive', 'archived')
  )
);

create table public.inventory_purchase_orders (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete restrict,
  branch_id uuid not null references public.branches(id) on delete restrict,
  po_number text not null,
  supplier_id uuid not null references public.inventory_suppliers(id) on delete restrict,
  status text not null default 'draft',
  order_date date not null default current_date,
  expected_delivery_date date null,
  delivery_location_id uuid null references public.warehouse_locations(id) on delete set null,
  currency text not null default 'PLN',
  total numeric(18, 6) not null default 0,
  notes text null,
  created_by uuid null references public.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz null,
  constraint inventory_po_status_check check (
    status in ('draft', 'ordered', 'partially_received', 'received', 'closed', 'cancelled')
  )
);
```

Receiving a PO creates a receipt movement with:

```json
{
  "reference_type": "purchase_order",
  "reference_id": "purchase-order-id",
  "reference_number": "PO-2026-00001"
}
```

The movement engine remains the only way stock enters inventory.

## Pricing

Phase 2 pricing is basic:

- default purchase price on variant
- default sales price on variant
- default currency from inventory settings

Phase 3 adds price lists:

- sales
- purchase
- wholesale
- customer-specific
- quantity tiers
- effective dates

Price lists do not affect stock correctness. They must stay outside the movement
engine except when a movement line stores a captured unit cost.

## Cost And Valuation

Costing is intentionally separated from Phase 1 quantity correctness.

Phase 1:

- movement lines may capture optional unit cost for future reporting
- balances do not store cost fields
- posting does not recalculate weighted average cost
- inventory correctness is measured only by quantities
- `unit_cost`, `total_cost`, and `currency` do not affect posting logic except
  basic nonnegative validation

Phase 2:

- introduce weighted average cost
- update cost rows on posted receipts and opening balances
- use current average cost for issues, transfers, scrap, and negative
  adjustments
- add dedicated tests for cost updates, reversals, and partial receiving
- valuation logic may read captured movement costs

Phase 3:

- add valuation snapshots and reports
- add stock aging and inventory valuation dashboards
- evaluate FIFO only if required by a real accounting or compliance need

Recommended Phase 2 cost table:

```sql
create table public.inventory_variant_costs (
  organization_id uuid not null references public.organizations(id) on delete cascade,
  branch_id uuid not null references public.branches(id) on delete cascade,
  variant_id uuid not null references public.inventory_variants(id) on delete restrict,
  currency text not null default 'PLN',
  average_unit_cost numeric(18, 6) not null default 0,
  total_quantity numeric(18, 6) not null default 0,
  total_value numeric(18, 6) not null default 0,
  updated_at timestamptz not null default now(),
  primary key (organization_id, branch_id, variant_id, currency)
);
```

Reasoning: quantity mistakes and valuation mistakes have different failure modes.
Shipping quantity-only balances first makes the ledger testable before financial
logic increases complexity.

## Analytics

Analytics are Phase 3.

Core metrics:

- stock by location
- stock by branch
- movement history
- low stock
- overstock
- dead stock
- fast-moving items
- slow-moving items
- last received date
- last issued date
- valuation after weighted average is enabled

Operational screens use live balances. Analytics can use snapshots.

Phase 3 snapshot table:

```sql
create table public.inventory_valuation_snapshots (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  branch_id uuid null references public.branches(id) on delete cascade,
  snapshot_date date not null,
  variant_id uuid null references public.inventory_variants(id) on delete restrict,
  location_id uuid null references public.warehouse_locations(id) on delete restrict,
  quantity_on_hand numeric(18, 6) not null,
  average_unit_cost numeric(18, 6) not null,
  total_value numeric(18, 6) not null,
  currency text not null default 'PLN',
  created_at timestamptz not null default now()
);
```

### Inventory Counts / Cycle Counts

Inventory counts are Phase 3. They verify physical stock against system stock.

Required concepts:

- count sessions
- count lines
- expected quantity snapshot
- counted quantity
- variance
- approval
- adjustment movement generated from approved count
- optional location lock during counting

Inventory counts must never directly overwrite balances. Approved variances
create adjustment movements through the normal movement engine.

Example:

```text
Expected: 10 pcs
Counted: 8 pcs
Variance: -2 pcs
Approved result: create negative adjustment movement for 2 pcs
```

Reasoning: counts are operational evidence, not balance edits. Using adjustment
movements preserves auditability and keeps the ledger as the source of truth.

## Collections And Saved Views

These are separate concepts.

Collections:

- product grouping
- can be manual or dynamic
- used for catalog organization, showrooms, offers, and product browsing
- belong to inventory/product domain

Saved views:

- UI filter/sort/column configuration
- apply to DataView screens
- do not group products as business objects
- belong to user experience/preferences

Phase 3 collection schema:

```sql
create table public.inventory_collections (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  name text not null,
  description text null,
  collection_type text not null default 'manual',
  filter_json jsonb null,
  created_by uuid null references public.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz null,
  constraint inventory_collections_type_check check (collection_type in ('manual', 'dynamic'))
);
```

Saved views should reuse existing user preference infrastructure if possible. If a
dedicated table is needed:

```sql
create table public.inventory_saved_views (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  user_id uuid null references public.users(id) on delete cascade,
  entity text not null,
  name text not null,
  config jsonb not null,
  is_shared boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz null
);
```

## Security & RLS

### Permission Slugs

Add constants in `packages/contracts/src/permissions.ts` and re-export them
through `apps/web/src/lib/constants/permissions.ts`.

```ts
export const WAREHOUSE_PRODUCTS_READ = "warehouse.products.read" as const;
export const WAREHOUSE_PRODUCTS_MANAGE = "warehouse.products.manage" as const;
export const WAREHOUSE_PRODUCTS_ARCHIVE = "warehouse.products.archive" as const;

export const WAREHOUSE_INVENTORY_READ = "warehouse.inventory.read" as const;
export const WAREHOUSE_INVENTORY_OPERATE = "warehouse.inventory.operate" as const;
export const WAREHOUSE_INVENTORY_ADJUST = "warehouse.inventory.adjust" as const;
export const WAREHOUSE_INVENTORY_REVERSE = "warehouse.inventory.reverse" as const;

export const WAREHOUSE_RESERVATIONS_READ = "warehouse.reservations.read" as const;
export const WAREHOUSE_RESERVATIONS_MANAGE = "warehouse.reservations.manage" as const;

export const WAREHOUSE_PROCUREMENT_READ = "warehouse.procurement.read" as const;
export const WAREHOUSE_PROCUREMENT_MANAGE = "warehouse.procurement.manage" as const;

export const WAREHOUSE_PRICING_READ = "warehouse.pricing.read" as const;
export const WAREHOUSE_PRICING_MANAGE = "warehouse.pricing.manage" as const;

export const WAREHOUSE_REPORTS_READ = "warehouse.reports.read" as const;
export const WAREHOUSE_IMPORTS_MANAGE = "warehouse.imports.manage" as const;
export const WAREHOUSE_SETTINGS_MANAGE = "warehouse.settings.manage" as const;
```

Default grants:

- `org_owner`: covered by `warehouse.*`
- `org_member`: read-only inventory/product/report access
- custom roles: receive operational/manage permissions explicitly

### RLS Patterns

Catalog tables are org-scoped:

```sql
create policy inventory_products_select
  on public.inventory_products for select
  using (
    public.has_permission(organization_id, 'warehouse.products.read')
    and deleted_at is null
  );
```

Operational tables are branch-scoped:

```sql
create policy inventory_balances_select
  on public.inventory_balances for select
  using (
    public.has_branch_permission(
      organization_id,
      branch_id,
      'warehouse.inventory.read'
    )
  );
```

Mutation policies use exact concrete slugs:

```sql
create policy inventory_movement_headers_insert
  on public.inventory_movement_headers for insert
  with check (
    public.has_branch_permission(
      organization_id,
      branch_id,
      'warehouse.inventory.operate'
    )
  );
```

Hard delete is denied for movement and operational history tables:

```sql
create policy inventory_movement_headers_delete_deny
  on public.inventory_movement_headers for delete
  using (false);
```

RLS policies must never use wildcard slugs.

### Audit Events

Emit audit events for:

- product created/updated/archived
- variant created/updated/archived
- SKU changed
- movement created
- movement posted
- movement reversed
- reservation created/released/expired
- allocation created/released/fulfilled
- PO created/received
- import completed
- settings changed

Event metadata should include IDs, reference type/id, branch ID, and changed
fields. Do not duplicate full row payloads.

### Domain Events And Future Automation

Phase 1 only needs audit events. Later phases can add domain events as stable
automation hooks.

Future domain events:

- `inventory.movement.posted`
- `inventory.reservation.created`
- `inventory.allocation.created`
- `inventory.stock.low`
- `inventory.stock.replenishment_suggested`
- `inventory.count.approved`

Domain events can power:

- notifications
- analytics pipelines
- external integrations
- automated replenishment
- workflow automation

Reasoning: audit events answer "what happened and who did it." Domain events
answer "what should react to this business fact." Keeping Phase 1 to audit events
avoids adding automation infrastructure before the core ledger is proven.

## Phased Implementation Plan

### Phase 1 - Inventory MVP

Goal: ship a working inventory system.

Included:

- inventory settings
- minimal products
- default variants
- SKU required and unique per organization
- SKU generation fallback
- basic units
- movement reasons
- inventory balances
- movement headers
- movement lines
- movement number generation
- posting engine
- movement kinds: receipt, issue, transfer, adjustment, opening balance
- reversal for posted movement
- products DataView
- inventory DataView
- movements DataView
- basic UI actions
- RLS, permissions, audit events

Not included:

- variant option generation
- reservations
- allocations
- lots
- serials
- purchase orders
- unit conversions
- custom fields
- collections
- imports/exports
- advanced analytics
- showrooms/offers/bundles

Acceptance:

- user can create a product
- system creates default variant
- user can receive stock into a `warehouse_locations` node
- user can issue stock
- user can transfer stock
- user can adjust stock with explicit increase/decrease direction
- balances update correctly
- posted movements are immutable
- inventory can be viewed by product, variant, branch, and location, with product
  context derived through variants

### Phase 2 - Core Enterprise Layer

Goal: add enterprise control and operational precision.

Included:

- variant option groups
- variant generator
- reservations
- allocations
- lots
- serials
- basic procurement
- purchase orders
- partial receiving
- basic pricing
- weighted average cost tracking

Acceptance:

- generated variants can be created safely
- reservations reduce available stock
- allocations assign exact stock
- lots are required for lot-tracked products
- serials are required for serialized products
- PO receiving creates stock receipt movement
- weighted average cost updates on receipt

### Phase 3 - Advanced Features

Goal: improve scale, configurability, and reporting.

Included:

- SKU automation patterns
- variant table spreadsheet UX
- unit conversions
- custom fields
- searchable/filterable custom fields
- collections
- saved views
- analytics
- inventory counts / cycle counts
- imports
- exports
- reports
- low stock alerts
- overstock alerts
- valuation snapshots

Acceptance:

- CSV product import works
- opening stock import creates opening balance movements
- DataView saved views persist
- custom fields can be filtered when marked filterable
- low stock and overstock reports match branch settings

### Phase 4 - Extensions

Goal: build commercial and advanced operational modules on the inventory core.

Included:

- showrooms
- offers/quotes
- bundles/kits
- manufacturing readiness
- rental readiness
- FEFO recommendations
- two-step transfers
- cross-branch transfer
- approval workflow policies
- FIFO cost method if required

Acceptance:

- extensions use variants and inventory references without changing core stock
  schema
- bundles do not require redesign of movement engine
- offers and showrooms use collections/price lists without duplicating catalog

## Movement Engine Contract

The movement engine is the only subsystem allowed to change
`inventory_balances.on_hand_quantity`.

### Create Draft Responsibilities

The draft creation function must:

1. Verify caller has `warehouse.inventory.operate`.
2. Validate organization and active branch context.
3. Validate idempotency key if provided.
4. Generate movement number server-side.
5. Lock `inventory_settings` while incrementing `movement_number_next`.
6. Create movement header and lines in one transaction.
7. Validate movement reason if provided.
8. Validate Phase 1 line unit equals product base unit.
9. Validate adjustment direction when movement kind is `adjustment`.
10. Return the draft movement.

### Responsibilities

The posting function must:

1. Verify movement exists for organization and branch.
2. Lock movement header with `for update`.
3. Return success if the same idempotency key already posted the same movement.
4. Reject if movement is not `draft`.
5. Verify caller has `warehouse.inventory.operate`.
6. Load and lock movement lines.
7. Validate movement kind.
8. Validate every line has correct source/destination locations.
9. Validate all locations belong to same organization and branch.
10. Validate variant identity and derive product through `inventory_variants.product_id`.
11. Validate variant is active.
12. Validate product type allows stock movement.
13. Validate unit equals derived product base unit in Phase 1.
14. Validate explicit `adjustment_direction` for adjustments.
15. Validate lot/serial rules when Phase 2 tracking is enabled.
16. Create missing affected balance rows.
17. Lock affected balance rows in deterministic order.
18. Validate sufficient available stock unless negative stock is allowed.
19. For normal issues, check source `available_quantity >= issue_quantity`.
20. For normal transfers, check source `available_quantity >= transfer_quantity`.
21. Apply balance deltas.
22. Ignore cost fields for Phase 1 posting except nonnegative validation.
23. Apply cost updates only when a later cost method is enabled.
24. Mark movement `posted`.
25. Store `posted_at` and `posted_by`.
26. Emit or enable server action to emit audit event.

### Idempotency

Posting must accept an optional idempotency key.

Rules:

- same organization plus same idempotency key can only create one posted result
- retrying the same post after a network failure returns the posted movement
- retrying with same key but different movement fails

### Reversal Contract

The reversal function must:

1. Lock original movement.
2. Verify original status is `posted`.
3. Verify original is not already reversed.
4. Create reversal movement with opposite stock effects.
5. Post reversal through the same engine.
6. Mark original as `reversed`.
7. Cross-link original and reversal movement IDs.

## Validation Rules

### Organization Consistency

Must hold:

```text
variant.organization_id == product.organization_id
movement.organization_id == line.organization_id
movement.organization_id == variant.organization_id
movement line product is derived as movement_line -> variant -> product
location.organization_id == movement.organization_id
balance.organization_id == location.organization_id
balance.organization_id == variant.organization_id
balance product is derived as balance -> variant -> product
reservation.organization_id == reservation_line.organization_id
allocation.organization_id == allocation_line.organization_id
movement reason organization_id == movement.organization_id when reason_id exists
```

### Branch Consistency

Must hold:

```text
movement.branch_id == line.branch_id
movement.branch_id == source_location.branch_id when source exists
movement.branch_id == destination_location.branch_id when destination exists
balance.branch_id == location.branch_id
reservation.branch_id == reservation_line.branch_id
allocation.branch_id == allocation_line.branch_id
reservation line location belongs to reservation branch
allocation line location belongs to allocation branch
```

Single-branch transfer in Phase 1 requires source and destination locations in
the same branch. Cross-branch transfer is a later two-step transfer feature.

### Variant/Product Consistency

Must hold:

```text
movement_line.variant_id is the stock identity
movement line product context is derived through inventory_variants.product_id
reservation_line.variant_id belongs to reservation_line.product_id
allocation_line.variant_id belongs to allocation_line.product_id
lot.variant_id belongs to line.variant_id
serial.variant_id belongs to line.variant_id
```

`product_id` may exist alongside `variant_id` only where explicitly justified as
denormalized convenience, such as lots, serials, reservation lines, and
allocation lines. In those cases validation must guarantee:

```text
denormalized product_id == variant.product_id
```

Movement lines do not store `product_id`.

### Unit Validation

Phase 1 must hold:

```text
movement_line.unit_id == movement_line.variant.product.base_unit_id
```

If this fails, reject draft creation or posting. Do not convert implicitly.

### Available Stock Validation

For normal issue and transfer operations that are not fulfilling reservations or
allocations:

```text
source.available_quantity >= outbound_quantity
```

Phase 1 has no reservations or allocations, so this is equivalent to checking
`on_hand_quantity`. The available-stock rule is still the contract so Phase 2 can
enforce reservation/allocation protection without changing the movement engine.

### Location Validation

All stock-changing operation locations must:

- exist
- not be soft-deleted
- belong to the active organization
- belong to the active branch
- be readable by the caller through branch permission

### Nullability Rules

- `inventory_products.default_variant_id` is nullable only to support
  transactional creation.
- `inventory_balances.lot_id` and `serial_id` are nullable because not all stock
  is tracked.
- `inventory_movement_lines.lot_id` and `serial_id` are nullable in schema, but
  required by product type rules when applicable.
- `source_location_id` and `destination_location_id` are nullable in schema
  because required location side depends on movement kind.
- Movement posting validates nullable location logic.

### Custom Field Integrity

Custom fields are Phase 3. When implemented, lot/serial custom field values must
have real foreign keys:

```sql
lot_id uuid null references public.inventory_lots(id) on delete cascade,
serial_id uuid null references public.inventory_serials(id) on delete cascade
```

Do not leave unreferenced `lot_id` or `serial_id` columns in the custom field
value table.

## Concurrency Strategy

### Posting Lock Order

Posting must lock rows in deterministic order:

1. movement header
2. movement lines
3. inventory settings if number/idempotency updates are needed
4. affected balance rows ordered by natural key
5. cost rows ordered by variant ID when weighted average is enabled

This prevents deadlocks between concurrent postings.

### Balance Row Locking

Affected balance rows must be selected `for update` before applying deltas. If a
row does not exist, insert it, then lock it.

Use the unique balance index to prevent duplicate rows under concurrent inserts.
On unique conflict, retry select `for update`.

### Double-Posting Prevention

Double posting is prevented by:

- `for update` lock on movement header
- status check requiring `draft`
- idempotency key support
- transaction boundary around validation and updates

### Safe Retries

A client can safely retry posting when:

- it sends the same idempotency key
- the first request timed out or connection failed
- the movement ID is the same

The server must return the already-posted result if the same operation succeeded.

### Isolation Level

Default Postgres `read committed` is acceptable if all affected balance rows are
locked before checks and updates. If later tests reveal write skew in complex
reservation/allocation flows, use explicit advisory locks or serializable
transactions for those RPCs.

## DataView Integration

Use the existing DataView system for:

- products
- inventory balances
- movement history
- purchase orders
- reservations
- allocations
- reports

Phase 1 product DataView:

- product name
- SKU
- product type
- status
- on hand
- available
- updated at

Phase 1 inventory DataView:

- SKU
- product name
- location
- on hand
- available
- unit
- last movement

Phase 1 movement DataView:

- movement number
- kind
- adjustment direction for adjustment movements
- status
- reference
- lines count
- product name derived through line variant
- created by
- posted at

DataView fetchers must be server-side paginated, sorted, and filtered.

## Implementation Progress Checklist

The canonical full progress tracker is at the top of this document so status is
visible immediately. Update that tracker as each implementation slice is
completed and verified.

## Final Acceptance Criteria

The system is production-ready for Phase 1 when:

- product creation always creates exactly one default variant
- SKU is required and unique per organization
- SKU fallback generation is atomic and audited
- stock can be received, issued, transferred, adjusted, and opened
- all stock changes go through posted movements
- movement lines store `variant_id`, not `product_id`
- movement line unit must equal product base unit in Phase 1
- adjustment direction is explicit and quantity is always positive
- normal issue checks available stock, not just on-hand
- transfer checks available stock at source
- movement cost fields are captured metadata only in Phase 1
- balances update transactionally
- balances are quantity-only in Phase 1
- balances store `variant_id`, not `product_id`
- posted movements cannot be edited or hard-deleted
- reversals preserve original movement history
- negative stock is blocked by default
- stock can be held at any active `warehouse_locations` node
- all movement locations are validated against org and branch
- movement lines derive product context through variant relationship
- RLS blocks cross-org and cross-branch data access
- all RLS policies use exact permission slugs
- DataViews work for products, inventory, and movements
- audit events are emitted for product and movement changes
- movement numbers are generated server-side and atomically
- concurrent posting cannot double-apply stock deltas

The system is production-ready for enterprise expansion when:

- reservations and allocations are separate from movements
- reservations and allocations update availability without changing on-hand
- lots and serials are enforced by product type
- purchase receiving uses the movement engine
- weighted average cost is isolated from Phase 1 quantity correctness
- advanced features can be added without changing the Phase 1 movement and
  balance table fundamentals
