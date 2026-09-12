# Zone 5 — Migration Summary

**None of the six migrations below have been applied to any live or local database.** Supabase
MCP was unavailable for this entire implementation session; there was no running local
Postgres/Docker stack either (see `review-context.md` for the exact evidence). Every row's
"Live verification" and "Local/live parity" columns are therefore **BLOCKED ON MCP**, not
performed, not fabricated.

## 1. `20260912090000_zone5_receiving_location_purpose.sql`

- **Object changed**: `warehouse_locations` (ALTER — add `purpose` column); new index
  `warehouse_locations_one_receiving_per_branch`; new function
  `resolve_branch_receiving_location(uuid, uuid)`.
- **Before**: no semantic role/purpose concept existed anywhere on this table (verified across
  every tracked ALTER on `warehouse_locations` in both migration directories, in a prior session
  of this same work).
- **After**: `purpose TEXT NOT NULL DEFAULT 'standard' CHECK (purpose IN ('standard','receiving'))`;
  at most one non-deleted `purpose='receiving'` row per `(organization_id, branch_id)`.
- **Why required**: approved plan §5 — the branch receiving buffer needs a DB-enforced, non-hardcoded
  semantic location role.
- **RLS**: none added/changed on `warehouse_locations` itself (existing policies apply
  unchanged — `purpose` is just another column on an already-RLS'd table).
- **Constraints/FKs**: one `CHECK`, one partial `UNIQUE` index. No FKs.
- **Function/RPC**: `resolve_branch_receiving_location` — `SECURITY DEFINER`, `STABLE`, revoked
  from `PUBLIC`/`anon`, granted to `authenticated`. Re-validates
  org/branch/purpose/`can_store_inventory`/`deleted_at` on every call.
- **Live verification**: BLOCKED ON MCP.
- **Local/live parity**: BLOCKED ON MCP — file exists only locally.

## 2. `20260912091000_zone5_repair_order_spatial_attribution_schema.sql`

- **Objects changed**: `repair_orders` (ALTER — add `repair_orders_id_org_branch_unique`
  composite-unique constraint, no new column); `repair_order_lines` (ALTER — add
  `repair_order_lines_id_repair_order_id_unique` composite-unique constraint, no new column);
  new table `repair_order_line_locations`; new table
  `repair_order_location_attribution_uncertain`.
- **Before**: `repair_orders`/`repair_order_lines` had no composite-unique constraints beyond
  their own PKs and Zone 3's own `repair_orders_identity_unique`; no spatial-attribution or
  uncertainty-marker table existed anywhere.
- **After**: both composite-unique constraints exist (mirroring the exact pre-existing pattern
  `warehouse_locations_id_org_branch_unique`/`branches_id_organization_id_unique`); both new
  tables exist with full composite-FK integrity (§11.2 of the plan) and RLS.
- **Why required**: approved plan §11 — DB-enforced pair/org/branch integrity for the new
  projection table, closing a gap an earlier review round found (RPC-only enforcement was
  judged insufficient).
- **RLS**: both new tables — `ENABLE ROW LEVEL SECURITY` + `FORCE ROW LEVEL SECURITY`; one
  SELECT policy each (`workshop.repair_orders.read` OR `warehouse.inventory.read`); **zero**
  INSERT/UPDATE/DELETE policy on either table (write-only via `SECURITY DEFINER` functions).
- **Constraints/FKs**: `repair_order_line_locations` — `UNIQUE(repair_order_line_id,
location_id)` + 3 composite FKs (to `warehouse_locations`, `repair_orders`,
  `repair_order_lines`) + `CHECK(quantity >= 0)`.
  `repair_order_location_attribution_uncertain` — composite PK
  `(organization_id, branch_id, location_id, variant_id)` + 1 composite FK to
  `warehouse_locations`.
- **Trigger/RPC**: none in this file (a small `updated_at`-touch trigger utility,
  `zone5_touch_updated_at()`, is added and attached to `repair_order_line_locations` only).
- **Live verification**: BLOCKED ON MCP.
- **Local/live parity**: BLOCKED ON MCP.

## 3. `20260912092000_zone5_attribution_sync_trigger.sql`

- **Object changed**: new function `repair_order_location_attribution_sync()`; new trigger
  `repair_order_line_locations_ledger_sync` `AFTER INSERT ON inventory_stock_ledger_entries FOR
EACH ROW`.
- **Before**: no such trigger existed; `inventory_stock_ledger_entries` had only its own
  append-only (UPDATE/DELETE-blocking) trigger, per prior sessions' findings.
- **After**: every `on_hand`-affecting ledger insert, from any caller, is inspected by this
  trigger.
- **Why required**: approved plan §1/§13 — the conservative safety net that keeps
  `repair_order_line_locations` correct for movements not posted through a RepairOrder-aware RPC
  (chiefly Zone 6's existing, unmodified relocation UI).
- **RLS**: N/A (trigger function, not a table).
- **Constraints/FKs**: none added by this file.
- **Trigger/RPC body — key behaviors implemented, matching the approved algorithm exactly**:
  1. Guard: ignores any `balance_field <> 'on_hand'`.
  2. Zero-clears rule: unconditionally deletes any uncertainty marker for a bucket whose
     `balance_after = 0`, even under the bypass flag.
  3. Bypass check: `current_setting('ambra.repair_order_attribution_authoritative', true) =
'on'` short-circuits the rest (duplicate-work suppression only, not authorization — see
     `review-context.md` §G).
  4. Fast no-op path when neither a projection row nor a marker exists for the bucket.
  5. Marker-gate: an existing marker is re-affirmed/extended (never re-tested by math) — the
     specific mechanism that makes "UNKNOWN is sticky, never self-heals from arithmetic
     coincidence" true.
  6. Pre-effect reconstruction from `NEW.balance_after`/`NEW.quantity`/`NEW.direction` only —
     never a re-query of `inventory_balances`.
  7. On ambiguity: marks source, and destination too if transfer-shaped, UNKNOWN.
  8. On unambiguity: decrements the one attributable row, credits the destination (if any) with
     the same `repair_order_line_id`.
- **⚠ Disclosed verification gap (the single most important entry in this table)**: this
  migration's column references for `inventory_stock_ledger_entries`
  (`organization_id, branch_id, location_id, variant_id, movement_line_id, balance_field,
direction, quantity, balance_after`) and for `inventory_movement_lines`
  (`destination_location_id`) are based on two convergent sources —
  `docs/warehouse-movements-refactor-plan.md`'s own design, and
  `docs/mvp/zones/07-normal-issue-movement-audit.md`'s prior-session LIVE VERIFIED trace (via
  `pg_get_functiondef`) — **not this session's own live confirmation**, because a direct repo
  search this session found **zero tracked migrations anywhere** containing a `CREATE TABLE` for
  `inventory_stock_ledger_entries` (nor `inventory_movement_audit_log`). This is a deeper
  instance of the schema-drift category already accepted as tech debt for the RPC bodies, now
  found to extend to the ledger table itself. **A live/MCP session must independently confirm
  every column this trigger references before this migration is applied**, per the migration's
  own header comment.
- **Live verification**: BLOCKED ON MCP (and additionally gated on the column-verification item
  above, which is itself a live-only check).
- **Local/live parity**: BLOCKED ON MCP.

## 4. `20260912093000_zone5_receive_repair_order_stock_rpc.sql`

- **Object changed**: new function `receive_repair_order_stock(...)`.
- **Before**: did not exist.
- **After**: a `SECURITY DEFINER` orchestration RPC that resolves the branch's receiving
  location, resolves Matcher-line provenance to an exact `repair_order_line_id` (or leaves a
  line unattributed if no `source_line_id` was given), hard-errors on zero/ambiguous
  resolution, calls the existing `inventory_create_and_finalize('101', ...)` unmodified, and
  writes `repair_order_line_movement_links` (`relation_type='receipt'`) +
  `repair_order_line_locations` directly in the same transaction.
- **Why required**: approved plan §8/§9 — RepairOrder-aware receiving with server-authoritative
  provenance resolution.
- **RLS**: N/A (function); relies on its own internal `has_branch_permission` check (it bypasses
  RLS internally as `SECURITY DEFINER`, so it must and does check permission itself, unlike the
  generic engine's own `inventory_finalize_posting` which was found in a prior session to rely
  on RLS alone).
- **Constraints/FKs**: none added; relies on Phase 2's constraints to reject bad writes even if
  this function had a bug.
- **Dependency, not modification**: calls `public.inventory_create_and_finalize(...)` — a
  function this repo has **no tracked migration for at all** (confirmed, accepted pre-existing
  tech debt, not reconstructed by this migration, which only calls it by name with the exact
  named-parameter shape found in tracked application code,
  `apps/web/src/server/services/inventory-movements.service.ts`).
- **Live verification**: BLOCKED ON MCP.
- **Local/live parity**: BLOCKED ON MCP.

## 5. `20260912094000_zone5_putaway_repair_order_stock_rpc.sql`

- **Object changed**: new function `putaway_repair_order_stock(...)`.
- **Before**: did not exist.
- **After**: a `SECURITY DEFINER` orchestration RPC — one call, N lines, one destination, one
  `801` document (always sourced from the resolved receiving location), quantity-available
  validated against the live projection before posting, writes spatial attribution directly
  (never infers), writes **no** `repair_order_line_movement_links` row, and does **not** clear
  any pre-existing bucket-wide UNKNOWN marker.
- **Why required**: approved plan §4/§9 (batch putaway contract) + the final correction pass
  (marker non-clearing).
- **RLS/Constraints/dependency**: same posture as file #4 above.
- **Live verification**: BLOCKED ON MCP.
- **Local/live parity**: BLOCKED ON MCP.

## 6. Application-layer files (not migrations, listed here for completeness of the "required

before live use" picture)

`repair-order-storage.service.ts`, `repair-order-receiving.ts`, and
`repair-order-putaway-panel.tsx` all assume migrations 1–5 above are applied. Calling any of the
three new server actions against a live environment before that happens will fail cleanly with a
Postgres "function/relation does not exist" error — an expected, disclosed consequence of the
MCP blocker, not a defect in the application code itself (which independently typechecks, lints,
and — for the read model — passes its own mocked unit tests).

## Required order of application (when a live/MCP session picks this up)

1. `20260912090000_...purpose.sql`
2. `20260912091000_...schema.sql`
3. `20260912092000_...trigger.sql` — **only after independently confirming the ledger-table
   column list disclosed above**
4. `20260912093000_...receive_rpc.sql`
5. `20260912094000_...putaway_rpc.sql`

Then: run pgTAP files `093`–`097` in order (they are independent of each other except that `096`
and `097` assume `093`/`094`/`095` have already been applied, since they exercise the RPCs that
depend on that schema); re-run this repo's own `090`–`092` Zone 3 tests to confirm no regression
(none is expected — no Zone 3 file was modified, only two additive constraints added to two
Zone 3 tables); then proceed to the still-outstanding Phase 0/7 live verification and Playwright
work listed in `docs/mvp/zones/05-receiving-putaway-progress.md`.
