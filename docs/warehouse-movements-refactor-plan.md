# Warehouse Movements Refactor — Full Plan & Progress Tracker

> **Old movement system is removed.** No production data exists. No backfill needed. Old dev movement data is cleared. The new system is built from scratch on the correct final architecture.

---

## Overview & Goals

Replace the old hardcoded movement system (5 `movement_kind` values, global INV-000001 numbering, basic RPCs) with an enterprise-grade warehouse movement architecture that:

- Uses a **movement type registry** with configurable stock effects per type
- Uses a **document type registry** for Polish warehouse document conventions (PZ, WZ, MM, RW, KP, KN, INW, etc.)
- Assigns **document numbers at posting time only** (gap-free, per-type, per-year)
- Maintains an **append-only stock ledger** as the source of truth (`inventory_balances` is a current-state cache)
- Enforces **immutability** on posted movements, lines, ledger, and audit log
- Supports **configurable approval policies** with separation of duties
- Supports **inventory periods** with closed-period controls
- Supports **FIFO and weighted-average costing** with cost layers
- Captures **immutable document snapshots** for rendering posted documents
- Maintains a **tamper-evident audit trail** with hash chain
- Separates warehouse documents from invoices (PZ/WZ are NOT VAT invoices — invoice/KSeF references are for linking only)

Polish document types are established accounting conventions, not directly mandated by name in the Accounting Act. The legal requirement is to produce complete, reliable, immutable source documents (dowody ksiegowe) with: document type and number, parties, operation description, quantities, values, dates, responsible persons/approvals, and durable retention.

---

## Why Phase 1 (v1) Exists

The full system is too large to implement at once. The warehouse locations/bins feature needs only two movement flows to be useful:

1. **PZ receipt** — put stock into a bin
2. **Bin-to-bin move** — move stock between bins

v1 implements these two flows on the correct final architecture, so everything built on top (containers, putaway rules, order allocation) has a trustworthy foundation. The remaining movement types, approval engine, costing, etc. are added in later phases without rearchitecting.

---

## Old System Cleanup

### Truncated (dev-only, no data to preserve)

- `inventory_movement_lines` (CASCADE)
- `inventory_movement_headers` (CASCADE)
- `inventory_balances` — reset quantities to 0

### Dropped

- RPCs: `inventory_create_draft_movement()`, `inventory_post_movement()`, `inventory_reverse_movement()`, `inventory_get_or_create_balance_for_update()`
- Trigger: `inventory_movement_lines_validate`
- Columns from headers: `movement_kind`, `adjustment_direction`, `movement_number`, `reason_id`, `reason_code`
- Columns from settings: `movement_number_prefix`, `movement_number_next`

### TypeScript Replaced

- `InventoryMovementsService` — rewritten
- Movement types in `inventory-types.ts` — rewritten
- Movement actions and schemas — replaced
- Movement UI pages — rebuilt

---

## Decisions Made & Why

| Decision                                                      | Why                                                                                                                          |
| ------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------- |
| Normalized effects table instead of JSONB                     | DB constraints, reporting JOINs, posting safety                                                                              |
| Separate document_types table                                 | Proper numbering templates, correction/reversal flags, extensibility                                                         |
| Document number at posting only                               | Gap-free sequences, cancelled drafts don't waste numbers                                                                     |
| No `posting_date` column                                      | `posted_at` (timestamptz) is sufficient; `document_date` and `operation_date` cover the other needs                          |
| Reversal deferred from v1                                     | Requires per-type reversal semantics; PZ reversal is not the same as bin-move reversal                                       |
| Hash chain columns deferred entirely to Phase 4               | No nullable unused columns cluttering v1; clean add when audit hardening is the focus                                        |
| Cost fields nullable in v1                                    | Architecture ready but no FIFO/weighted-average logic runs                                                                   |
| No cost_layer_id in v1                                        | Table doesn't exist yet; column added in Phase 3                                                                             |
| Line immutability via separate trigger checking parent header | Lines have no status column; dedicated trigger function looks up header status                                               |
| `document_type_id` FK on sequences                            | Per-org custom types possible; cleaner than text code                                                                        |
| `negative_stock_policy` on settings                           | Per-org control; v1 checks `on_hand` only                                                                                    |
| v1 reconciliation checks `on_hand` only                       | Other fields (reserved, blocked, consignment) reconciled when effects use them                                               |
| Line-level snapshot fields in v1                              | Product name, SKU, unit code, location names frozen at posting — enough for basic rendered views without full snapshot table |
| Engine bypass via `SET LOCAL` only                            | `ambra.inventory_movement_engine` flag set only inside `SECURITY DEFINER` RPCs, never from client/application                |
| `branch_id` + `series` on sequences                           | Nullable — org-wide by default, branch-specific numbering ready for later                                                    |

---

## Movement Core v1 Scope

### Tables

**New:**

1. `inventory_document_types` — PZ, MM
2. `inventory_movement_types` — 101 (PZ receipt), 801 (bin-to-bin)
3. `inventory_movement_type_effects` — 3 effect rows
4. `inventory_document_sequences` — per-type per-year numbering (with branch_id + series ready)
5. `inventory_stock_ledger_entries` — append-only, source of truth
6. `inventory_movement_audit_log` — append-only, minimal in v1 (no hash chain columns)

**Altered:**

- `inventory_movement_headers` — drop old columns, add type/document/counterparty fields
- `inventory_movement_lines` — add snapshot fields + lot_id, serial_id, exchange_rate (nullable)
- `inventory_balances` — add blocked, consignment fields
- `inventory_settings` — replace sequence columns, add negative_stock_policy

### v1 Movement Types

| Code | Name                  | Doc Type | Category | Src Loc        | Dst Loc        | Cost Impact |
| ---- | --------------------- | -------- | -------- | -------------- | -------------- | ----------- |
| 101  | Goods Receipt (PZ)    | PZ       | receipt  | no             | yes (required) | increase    |
| 801  | Bin-to-Bin Move (MMZ) | MM       | transfer | yes (required) | yes (required) | neutral     |

### v1 Effects

| Type | Order | Target      | Field   | Direction |
| ---- | ----- | ----------- | ------- | --------- |
| 101  | 1     | destination | on_hand | increase  |
| 801  | 1     | source      | on_hand | decrease  |
| 801  | 2     | destination | on_hand | increase  |

### RPCs

- `inventory_create_draft()` — draft with draft_number
- `inventory_finalize_posting()` — document number, balance updates, ledger entries, line snapshot freeze
- `inventory_cancel_movement()` — draft → cancelled
- `inventory_get_or_create_balance()` — helper with FOR UPDATE
- `inventory_reconcile_balances()` — diagnostic: compare `on_hand` in balances vs ledger
- `inventory_seed_movement_types()` — seed PZ, MM, 101, 801, effects

### State Machine (v1)

```
draft → posted     (via inventory_finalize_posting)
draft → cancelled  (via inventory_cancel_movement)
```

No submitted/pending_approval/approved/reversed in v1.

### v1 UI

- Movement list page (table with filters)
- New movement page (type picker → PZ or bin-to-bin → form → create/post)
- Movement detail page (header, lines, audit log, post/cancel buttons)

---

## v1 Table Schemas

### `inventory_document_types`

```
id uuid PK
organization_id uuid FK NOT NULL
code text NOT NULL                          -- "PZ", "MM"
name text NOT NULL
name_pl text
name_en text
description text
category text NOT NULL                      -- CHECK (receipt, issue, transfer, adjustment, other)
numbering_template text NOT NULL DEFAULT '{code}/{year}/{seq:6}'
is_correction boolean NOT NULL DEFAULT false
corrects_document_type_code text            -- nullable
is_system boolean NOT NULL DEFAULT false
is_active boolean NOT NULL DEFAULT true
created_at, updated_at, deleted_at timestamptz
UNIQUE (organization_id, code) WHERE deleted_at IS NULL
RLS enabled
```

### `inventory_movement_types`

```
id uuid PK
organization_id uuid FK NOT NULL
code text NOT NULL                          -- "101", "801"
document_type_id uuid FK NOT NULL → inventory_document_types
name, name_pl, name_en, description text
category text NOT NULL                      -- CHECK (receipt, issue, transfer, adjustment, reservation, quality, bin_operation, consignment, other)
requires_source_location boolean NOT NULL DEFAULT false
requires_destination_location boolean NOT NULL DEFAULT false
requires_reference boolean NOT NULL DEFAULT false
requires_note boolean NOT NULL DEFAULT false
cost_impact text NOT NULL DEFAULT 'none'    -- CHECK (increase, decrease, neutral, none)
is_system boolean NOT NULL DEFAULT false
allows_manual_entry boolean NOT NULL DEFAULT true
is_active boolean NOT NULL DEFAULT true
metadata jsonb DEFAULT '{}'
created_at, updated_at, deleted_at timestamptz
UNIQUE (organization_id, code) WHERE deleted_at IS NULL
RLS enabled
```

### `inventory_movement_type_effects`

```
id uuid PK
movement_type_id uuid FK CASCADE NOT NULL
effect_order integer NOT NULL
target text NOT NULL                        -- CHECK (source, destination)
balance_field text NOT NULL                 -- CHECK (on_hand, reserved, allocated, blocked, consignment)
direction text NOT NULL                     -- CHECK (increase, decrease)
is_required boolean NOT NULL DEFAULT true
description text
UNIQUE (movement_type_id, effect_order)
RLS enabled (inherits org access via movement_type join)
```

### `inventory_document_sequences`

```
id uuid PK
organization_id uuid FK NOT NULL
document_type_id uuid FK NOT NULL → inventory_document_types
branch_id uuid FK                           -- nullable: NULL = org-wide sequence
series text                                 -- nullable: for optional sub-series
year integer NOT NULL
next_number bigint NOT NULL DEFAULT 1
UNIQUE (organization_id, document_type_id, coalesce(branch_id, nil_uuid), coalesce(series, ''), year)
RLS enabled
```

v1 uses org-wide sequences (branch_id = NULL, series = NULL). Branch-specific numbering ready for later.

### `inventory_stock_ledger_entries`

```
id uuid PK
organization_id, branch_id uuid NOT NULL
location_id, variant_id uuid NOT NULL
lot_id, serial_id uuid                      -- nullable, future-ready
movement_id uuid FK NOT NULL → headers
movement_line_id uuid FK NOT NULL → lines
movement_type_code text NOT NULL
document_number text                        -- set at posting
document_type_code text
effect_id uuid FK NOT NULL → effects
balance_field text NOT NULL
direction text NOT NULL
quantity numeric(18,6) NOT NULL             -- always positive
balance_after numeric(18,6) NOT NULL
unit_cost numeric(18,6)                     -- nullable, passive in v1
value_delta numeric(18,6)                   -- nullable, passive in v1
currency text                               -- nullable
exchange_rate numeric(18,8)                 -- nullable
posted_at timestamptz NOT NULL
created_at timestamptz NOT NULL DEFAULT now()
UNIQUE (movement_line_id, effect_id)        -- prevents duplicate posting effects
Append-only trigger (blocks UPDATE + DELETE)
Indexes: (org, branch, location, variant, balance_field, posted_at), (movement_id)
RLS enabled
```

### `inventory_movement_audit_log`

```
id uuid PK
organization_id, movement_id uuid NOT NULL
action text NOT NULL                        -- created, posted, cancelled
old_status, new_status text                 -- nullable
entity_type text                            -- header, line
entity_id uuid
changes jsonb                               -- [{field, old, new}]
actor_user_id uuid
actor_user_name text                        -- snapshot
source_channel text                         -- nullable (web, api, system)
request_id text                             -- nullable
transaction_id text                         -- nullable
reason_code, reason_text text               -- nullable
created_at timestamptz NOT NULL DEFAULT now()
Append-only trigger (blocks UPDATE + DELETE)
Index: (movement_id, created_at)
RLS enabled
```

No hash chain columns in v1. Added in Phase 4 as `previous_entry_id uuid` and `entry_hash text`.

### `inventory_movement_headers` — After Cleanup

**Dropped columns:** `movement_kind`, `adjustment_direction`, `movement_number`, `reason_id`, `reason_code`

**Added columns:**

```
movement_type_id uuid FK → inventory_movement_types     -- nullable (old rows truncated; new RPC always sets it)
movement_type_code text                                 -- nullable (same reasoning)
draft_number text                                       -- assigned at creation
document_number text                                    -- assigned at posting ONLY
document_type_code text                                 -- set at posting
document_date date                                      -- date printed on document
operation_date date                                     -- physical event date
counterparty_name text                                  -- supplier/customer
counterparty_id text                                    -- external party ID
external_reference text                                 -- PO number, etc.
source_document_reference text                          -- originating doc ref
invoice_reference text                                  -- for linking
ksef_reference text                                     -- placeholder
total_value numeric(18,6)                               -- nullable
currency text                                           -- nullable
exchange_rate numeric(18,8)                             -- nullable
```

**Kept:** `id`, `organization_id`, `branch_id`, `status`, `reference_type`, `reference_id`, `idempotency_key`, `original_movement_id`, `reversal_movement_id`, `created_by`, `posted_by`, `cancelled_by`, `reversed_by`, `note`, `created_at`, `updated_at`, `posted_at`, `cancelled_at`, `reversed_at`, `deleted_at`.

**Idempotency constraint:** `UNIQUE (organization_id, idempotency_key) WHERE idempotency_key IS NOT NULL` (may already exist — verify and add if missing).

### `inventory_movement_lines` — Updates

**Verified existing:** `source_location_id uuid FK → warehouse_locations` (nullable), `destination_location_id uuid FK → warehouse_locations` (nullable). Both must exist for bin-to-bin. Only destination for PZ receipt.

**Added columns:**

```
lot_id uuid                     -- nullable, future-ready
serial_id uuid                  -- nullable, future-ready
exchange_rate numeric(18,8)     -- nullable
-- Snapshot fields (frozen at posting, populated by finalize_posting RPC):
snapshot_product_name text      -- product name at posting time
snapshot_sku text               -- variant SKU at posting time
snapshot_unit_code text         -- unit code at posting time
snapshot_source_location_name text      -- source location name at posting (nullable)
snapshot_destination_location_name text -- destination location name at posting (nullable)
```

Snapshot fields are NULL while in draft. Set by `inventory_finalize_posting()` by joining live tables at posting time. After posting, these are the canonical values for display — live tables may change later.

### `inventory_balances` — Updates

```
blocked numeric(18,6) NOT NULL DEFAULT 0
consignment numeric(18,6) NOT NULL DEFAULT 0
-- Update available_quantity generated column:
-- available_quantity = on_hand_quantity - reserved_quantity - allocated_quantity - blocked - consignment
```

### `inventory_settings` — Updates

**Dropped:** `movement_number_prefix`, `movement_number_next`

**Added:**

```
draft_number_prefix text NOT NULL DEFAULT 'DRF'
draft_number_next bigint NOT NULL DEFAULT 1
negative_stock_policy text NOT NULL DEFAULT 'block' CHECK (IN ('block', 'allow', 'allow_with_approval'))
```

---

## v1 RPCs — Detailed

### `inventory_create_draft` — `SECURITY DEFINER`

Parameters: `p_organization_id, p_branch_id, p_movement_type_code, p_lines jsonb, p_operation_date date, p_document_date date, p_counterparty_name text, p_external_reference text, p_note text, p_idempotency_key text, p_actor_user_id uuid`

1. Validate type code exists, is active, belongs to org.
2. Validate lines: ≥1, each has variant_id, unit_id, quantity > 0.
3. For each line: validate source/destination location per type requirements. Locations must have `can_store_inventory = true` and belong to the branch.
4. Check idempotency_key — if exists, return existing movement (idempotent).
5. `SET LOCAL ambra.inventory_movement_engine = 'on'`.
6. Lock `inventory_settings` FOR UPDATE. Generate draft_number: `{prefix}-{lpad(next, 6, '0')}`. Increment.
7. INSERT header with `status = 'draft'`.
8. INSERT lines with sequential `line_number`.
9. INSERT audit log: `action = 'created'`, `transaction_id = txid_current()::text`.
10. Return `{movement_id, draft_number, status: 'draft'}`.

### `inventory_finalize_posting` — `SECURITY DEFINER`

Parameters: `p_movement_id uuid, p_actor_user_id uuid`

1. `SET LOCAL ambra.inventory_movement_engine = 'on'`.
2. Lock header FOR UPDATE. If `status = 'posted'`, return idempotently (no duplicate effects).
3. Validate `status = 'draft'`.
4. Load movement type + effects from `inventory_movement_type_effects` ORDER BY `effect_order`.
5. Lock or create `inventory_document_sequences` row FOR UPDATE for this doc type + year (branch_id NULL, series NULL for v1). Generate document_number from numbering_template. Increment.
6. **Freeze line snapshots**: for each line, JOIN to `inventory_variants`, `inventory_products`, `inventory_units`, `warehouse_locations` and UPDATE the `snapshot_*` columns with current names.
7. Collect all (location_id, variant_id) pairs from lines × effects. **Sort by (location_id::text, variant_id::text)** for deterministic lock ordering to prevent deadlocks.
8. For each line × each effect (in effect_order):
   a. Resolve target location (source or destination from the line).
   b. Call `inventory_get_or_create_balance()` — INSERT ON CONFLICT, then SELECT FOR UPDATE.
   c. Apply: increase or decrease the `balance_field` by `quantity`.
   d. **Negative stock check (v1: `on_hand` only)**: if `on_hand_quantity < 0` after update and `negative_stock_policy = 'block'`, RAISE EXCEPTION.
   e. INSERT `inventory_stock_ledger_entries` with `balance_after` = new `on_hand_quantity` for that field.
9. Update header: `status = 'posted'`, `posted_at = now()`, `posted_by`, `document_number`, `document_type_code`.
10. INSERT audit log: `action = 'posted'`, `old_status = 'draft'`, `new_status = 'posted'`, `transaction_id = txid_current()::text`.
11. Return `{movement_id, document_number, status: 'posted'}`.

### `inventory_cancel_movement` — `SECURITY DEFINER`

Parameters: `p_movement_id uuid, p_actor_user_id uuid, p_reason text`

1. `SET LOCAL ambra.inventory_movement_engine = 'on'`.
2. Lock header FOR UPDATE. If `status = 'cancelled'`, return idempotently.
3. Validate `status = 'draft'`.
4. Update: `status = 'cancelled'`, `cancelled_at = now()`, `cancelled_by`.
5. INSERT audit log: `action = 'cancelled'`, reason_text = p_reason.
6. Return `{movement_id, status: 'cancelled'}`.

### `inventory_get_or_create_balance` — `SECURITY DEFINER`

Parameters: `p_org, p_branch, p_location, p_variant`

`INSERT INTO inventory_balances (...) VALUES (...) ON CONFLICT DO NOTHING; SELECT * FROM inventory_balances WHERE ... FOR UPDATE;`

### `inventory_reconcile_balances` — `SECURITY DEFINER`

Parameters: `p_org_id, p_branch_id`

Compares `inventory_balances.on_hand_quantity` against `SUM(CASE WHEN direction='increase' THEN quantity ELSE -quantity END)` from `inventory_stock_ledger_entries` WHERE `balance_field = 'on_hand'`. Returns rows where they differ. **v1 checks `on_hand` only.** Other fields added when reservation/QC/consignment effects are implemented.

### `inventory_seed_movement_types` — `SECURITY DEFINER`

Parameters: `p_org_id, p_actor_user_id`

Idempotent: INSERTs PZ + MM document types, 101 + 801 movement types, 3 effect rows. Skips if codes already exist for this org.

### Immutability — Two Separate Trigger Functions

**`inventory_prevent_header_modification()`** — on `inventory_movement_headers`:

```sql
IF OLD.status IN ('posted', 'cancelled') THEN
  IF TG_OP = 'DELETE' THEN RAISE EXCEPTION ...; END IF;
  IF current_setting('ambra.inventory_movement_engine', true) != 'on' THEN RAISE EXCEPTION ...; END IF;
END IF;
```

**`inventory_prevent_line_modification()`** — on `inventory_movement_lines`:

```sql
DECLARE v_status text;
SELECT status INTO v_status FROM inventory_movement_headers WHERE id = OLD.movement_id;
IF v_status IN ('posted', 'cancelled') THEN
  IF TG_OP = 'DELETE' THEN RAISE EXCEPTION ...; END IF;
  IF current_setting('ambra.inventory_movement_engine', true) != 'on' THEN RAISE EXCEPTION ...; END IF;
END IF;
```

**Engine bypass flag:** `ambra.inventory_movement_engine` is set ONLY via `SET LOCAL` inside `SECURITY DEFINER` RPCs. It is transaction-scoped and cannot be set by client/application SQL. Regular Supabase client calls (PostgREST) do not set this flag, so direct table modifications from the client are always blocked on posted data.

---

## v1 Migration Order

1. **Dev Reset** — truncate movement data, drop old RPCs/triggers/columns
2. **Document Types + Movement Types + Effects** — create 3 tables, seed PZ/MM + 101/801 + effects, RLS
3. **Header + Line + Balance + Settings Schema** — ALTER existing tables (including line snapshot columns)
4. **Document Sequences** — create table with branch_id + series readiness, RLS
5. **Stock Ledger** — create table, append-only trigger, unique constraint on (line_id, effect_id), indexes, RLS
6. **Audit Log** — create table, append-only trigger, indexes, RLS
7. **Immutability Triggers** — two functions: header trigger + line trigger (checks parent)
8. **New RPCs** — create_draft, finalize_posting, cancel, get_or_create_balance, reconcile, seed

---

## Phase 2 — More Movement Types + Approval + Reversal

### Movement Types to Add

- WZ, RW, PW, ZW, KP, KN, INW, LZ, QC-BLOCK, QC-REL document types
- 102 PZ-K, 201 WZ, 202 WZ-K, 203 WZ-ZD, 204 RW-P, 205 RW, 206 RW-S, 301 MM-W, 302 MM-P, 311 MM-O, 312 MM-O, 401 KP, 402 KN, 403 INW, 411 MM-Q, 501/502 reservations, 701-703 QC, 802-808 bin ops, 901-903 consignment

### Reversal System

- Per-type reversal semantics (reversal_type_code on movement_types)
- `inventory_reverse_movement()` RPC
- Reversed state added to state machine

### Approval Engine

- `inventory_approval_policies` table
- `inventory_movement_approvals` table
- Submit/approve/reject RPCs
- States: submitted, pending_approval, approved, rejected
- Separation of duties enforcement
- Threshold-based policies

### Approval UI

- Approval queue page
- Approve/reject buttons on movement detail
- Approval history in audit log

---

## Phase 3 — Costing, Snapshots, Periods

### Costing

- `inventory_cost_layers` table
- FIFO: layer created on receipt, consumed on issue (oldest first)
- Weighted average: computed from all non-consumed layers
- `cost_layer_id` column added to ledger entries and movement lines
- Cost fields become active (unit_cost, value_delta, currency, exchange_rate)

### Document Snapshots

- `inventory_document_snapshots` table (full JSONB snapshot)
- Captured at posting time: all header, line, actor, org, product, location data
- PDF/printable document rendering from snapshot only
- v1 line-level snapshot fields remain as quick-access cache; full snapshot adds org/counterparty/actor details

### Inventory Periods

- `inventory_periods` table (open/closing/closed per org+branch+year+month)
- `inventory_close_period()` RPC
- Posting blocked in closed periods
- Corrections must be new documents in open period referencing original
- Period management UI

---

## Phase 4 — Enterprise Hardening

### Audit

- Add `previous_entry_id uuid` and `entry_hash text` columns to audit log
- Full hash-chain implementation in posting RPCs
- `inventory_verify_audit_chain()` RPC
- Periodic verification job

### Diagnostics

- `inventory_repair_balances_from_ledger()` admin RPC
- Observability: posting failures, balance drift, sequence conflicts, period violations
- Admin diagnostics dashboard

### Integrations

- KSeF/invoice reference linking
- Accounting export status tracking
- E-commerce movement types (600-series)

### Advanced Features

- Lot/serial enforcement
- Movement type admin settings UI
- Advanced reporting (stock valuation, movement history by type/period)

---

## Risks & Tradeoffs

| Risk                                        | Mitigation                                                                         |
| ------------------------------------------- | ---------------------------------------------------------------------------------- |
| Large schema change                         | Dev-only, clean slate, no migration compatibility needed                           |
| RPC complexity                              | Each RPC has single responsibility; extensive tests                                |
| v1 has no reversal                          | Acceptable: cancel draft, or fix manually. Reversal in Phase 2                     |
| v1 has no approval                          | Acceptable for dev. Added in Phase 2                                               |
| Cost fields unused in v1                    | Architecture ready; no wasted effort when Phase 3 arrives                          |
| Hash chain deferred entirely                | Clean add in Phase 4; no unused nullable columns in v1                             |
| Line snapshot fields vs full snapshot table | v1 freezes names on lines; Phase 3 adds full JSONB snapshot for complete rendering |

---

## Implementation Notes

- All migrations applied via Supabase MCP (target project)
- Local migration files saved in `apps/web/supabase-target/supabase/migrations/`
- TypeScript type-check must pass after each phase
- Movement UI rebuilt using existing shadcn/ui components and DataView pattern
- react-toastify for notifications (per CLAUDE.md)
- All new tables get RLS policies matching existing permission model
- Engine bypass flag (`ambra.inventory_movement_engine`) used ONLY inside SECURITY DEFINER RPCs via SET LOCAL

---

## v1 Known Limitations

- No reversal — must cancel drafts or wait for Phase 2
- No approval workflow — all authorized users can post directly
- No closed-period controls — posting allowed in any period
- No FIFO/weighted-average costing — cost fields exist but are passive
- No full document snapshot table — line-level snapshot fields only
- No hash-chain audit — audit log is append-only but not tamper-evident via hashing
- Reconciliation checks `on_hand` only — other fields added when effects use them
- Negative stock check on `on_hand` only — available quantity policy expanded later
- Only 2 movement types (101 PZ, 801 MMZ) — others added in Phase 2

---

## Progress Tracker

### Phase 1 — Movement Core v1

#### Migrations

- [x] Dev reset (truncate data, drop old RPCs/triggers/columns)
- [x] Document types table + seed PZ, MM
- [x] Movement types table + seed 101, 801
- [x] Movement type effects table + seed 3 effect rows
- [x] Document sequences table (with branch_id + series readiness)
- [x] Header schema cleanup (drop old columns, add new including idempotency constraint)
- [x] Line schema updates (lot_id, serial_id, exchange_rate, snapshot fields, verify source/destination location FKs)
- [x] Balance schema updates (blocked, consignment — available_quantity unchanged in v1)
- [x] Settings schema updates (draft sequence, negative_stock_policy)
- [x] Stock ledger table + append-only trigger + unique (line_id, effect_id)
- [x] Audit log table + append-only trigger (no hash chain columns)
- [x] Immutability trigger: header function
- [x] Immutability trigger: line function (checks parent header status)
- [x] Create draft RPC (SECURITY DEFINER)
- [x] Finalize posting RPC (SECURITY DEFINER, freezes line snapshots)
- [x] Cancel movement RPC (SECURITY DEFINER)
- [x] Get-or-create balance helper (SECURITY DEFINER)
- [x] Reconcile balances RPC (on_hand only)
- [x] Seed movement types RPC

#### TypeScript

- [x] Rewrite movement types in inventory-types.ts
- [x] Rewrite InventoryMovementsService
- [x] Rewrite movement server actions
- [x] Rewrite movement action schemas

#### UI

- [x] Movement list page (adapted from existing, uses new field names)
- [x] New PZ receipt form (rebuilt as MovementDocumentForm with type picker)
- [x] New bin-to-bin move form (same form, type picker switches between PZ/bin-move)
- [x] Movement detail page (adapted, shows new fields + audit log)
- [x] Edit draft page route (/movements/[id]/edit)
- [x] MovementDocumentForm supports create/edit modes
- [x] Draft detail page has Edit Draft / Post / Cancel buttons
- [x] saveDraftMovementAction (update header + replace lines)
- [x] saveAndPostDraftMovementAction (save then post same movement)
- [x] Movement type locked in edit mode
- [x] Inline draft editor removed from detail page (replaced by Edit Draft button)
- [x] 801 picker filters variants by selected source location stock (listVariantsInLocationAction)
- [x] 801 picker disabled until source location is selected
- [x] 801 line shows available on_hand quantity
- [x] 801 quantity validation blocks quantity > available stock (frontend + backend)
- [x] Changing source location clears lines after confirmation
- [x] Save & Post is atomic (inventory_create_and_finalize RPC, no orphan drafts)
- [x] Backend still rejects insufficient stock during finalizePosting

#### Reusable Item Picker

- [x] InventoryItemPickerDialog reusable component (allItems + stockInLocation modes)
- [x] Server-side searchPickerItemsAction with SKU/name/barcode/brand search
- [x] Picker shows SKU, product name, brand, unit, barcode, stock columns
- [x] Picker supports allItems mode for PZ
- [x] Picker supports stockInLocation mode for 801 (only items with stock)
- [x] Debounced search, loading state, empty state, error retry
- [x] Rich line preview in form (SKU, name, brand, barcode, unit, available qty)
- [x] Quantity validation with inline error for 801 (exceeds available)
- [x] Old simple select removed from movement form

#### Compact ERP-Style Form Layout

- [x] Compact 48px sticky document toolbar
- [x] Compact movement type selector (horizontal buttons, not huge cards)
- [x] Dense document metadata grid (2-4 columns, 32px inputs)
- [x] Locations integrated into document data grid
- [x] Positions/items table as main focus (proper table with columns)
- [x] Table columns: #, SKU, Product, Unit, Available (801), Qty, Remove
- [x] Inline quantity editing in table
- [x] Row hover delete button
- [x] Quantity over-limit highlighted with red border + max hint
- [x] Compact footer with effect summary
- [x] Reduced card padding, spacing, and vertical bloat
- [x] Form usable without excessive scrolling

#### Movement Type Picker

- [x] Reusable MovementTypePicker component (popover with search + category groups)
- [x] Compact selected type display (code + doc type badge + name)
- [x] Search by code, document type, Polish name, English name, category
- [x] Group movement types by category (Receipts, Transfers, Bin Operations, etc.)
- [x] Show document type badge per type
- [x] Show effect/requirement summary per type
- [x] MovementTypeEffectPreview companion component
- [x] Integrated into MovementDocumentForm (replaces hardcoded cards)
- [x] Read-only mode for draft editing (type locked)
- [x] Scales to many types (not hardcoded to 101/801)

#### Batch Item Picker

- [x] Picker supports selecting multiple items before closing
- [x] Quantity input on each picker row
- [x] Row Add (+) button adds item to selected panel without closing dialog
- [x] Selected items panel inside picker with qty +/- controls and remove
- [x] Selected item quantity editable before confirming
- [x] Add Items (n) button inserts all selected items at once
- [x] Duplicate items merge quantities (same variant + location)
- [x] Existing movement lines merge with added items
- [x] 801 validates picker quantity against remaining available
- [x] 801 "Available" column shows remaining after selected deductions
- [x] Already-selected rows highlighted in results table
- [x] Picker preserves search state after adding items

#### Testing & Verification

- [ ] PZ receipt: draft → post → document number → balance → ledger → line snapshots populated
- [ ] Bin-to-bin: draft → post → both bins → ledger → line snapshots
- [ ] Sequential document numbering (PZ and MM independent sequences)
- [ ] Cancelled draft consumes no document number
- [ ] Immutability: posted header blocked, posted line blocked (via parent check)
- [ ] Ledger + audit log: UPDATE/DELETE blocked
- [ ] Negative stock policy=block: bin move beyond on_hand → error
- [ ] Idempotency: duplicate idempotency_key → same draft; duplicate post → same result
- [ ] Idempotency: unique (line_id, effect_id) prevents duplicate ledger entries
- [ ] Concurrent posts → different document numbers, no gaps, no deadlocks
- [ ] RLS isolation: org A cannot see org B data
- [ ] Reconciliation: balances.on_hand matches ledger-derived on_hand

#### Plan Maintenance

- [x] Update tracker after each migration applied
- [x] Update tracker after TS service/actions complete
- [x] Update tracker after UI complete
- [x] Record deviations from plan if any
- [x] Record discovered v1 limitations — see "v1 Known Limitations" section

### Phase 2 — More Movement Types + Approval + Reversal

- [ ] Add WZ/RW/PW/ZW/KP/KN/INW document types
- [ ] Seed remaining movement types (102-903 excluding 600s)
- [ ] Seed remaining effects
- [ ] Implement reversal RPC with per-type semantics
- [ ] Add reversed state to state machine
- [ ] Add approval policies table
- [ ] Add approval records table
- [ ] Add submitted/pending_approval/approved/rejected states
- [ ] Add submit/approve/reject RPCs
- [ ] Separation of duties enforcement
- [ ] Approval queue UI
- [ ] Approve/reject buttons on detail page
- [ ] Phase 2 tests

### Phase 3 — Costing, Snapshots, Periods

- [ ] Cost layers table
- [ ] FIFO: layer creation on receipt
- [ ] FIFO: layer consumption on issue
- [ ] Weighted average costing
- [ ] cost_layer_id column on ledger entries + movement lines
- [ ] Document snapshots table (full JSONB)
- [ ] Snapshot capture in posting RPC
- [ ] Document rendering from snapshot
- [ ] PDF generation
- [ ] Inventory periods table
- [ ] Close period RPC
- [ ] Posting validation against closed periods
- [ ] Period management UI
- [ ] Phase 3 tests

### Phase 4 — Enterprise Hardening

- [ ] Add hash-chain columns to audit log (previous_entry_id, entry_hash)
- [ ] Full hash-chain implementation in RPCs
- [ ] Audit verification RPC
- [ ] Periodic verification job
- [ ] Balance repair from ledger RPC
- [ ] Admin diagnostics
- [ ] KSeF/invoice reference integration
- [ ] Accounting export status
- [ ] E-commerce movement types (600-series)
- [ ] QC movement types (700-series)
- [ ] Consignment movement types (900-series)
- [ ] Lot/serial enforcement
- [ ] Movement type admin UI
- [ ] Phase 4 tests
