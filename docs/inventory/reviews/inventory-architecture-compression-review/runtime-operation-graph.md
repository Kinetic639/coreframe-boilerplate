# Runtime Operation Graph — 17 Inventory Core Operations

Live-verified (branch checkout + live `supabase-target` DB via `pg_proc`/
`pg_get_functiondef`/`information_schema.triggers`), not copied from docs.
Where a doc claim conflicted with what was found live, it is flagged
explicitly inline.

Methodology note on "triggers fired": distinct trigger **bindings** that
can fire on the happy path are counted, not raw per-row firing counts
(a movement with 3 lines fires the ledger-sync trigger 3 times; counted
as "1 binding"). Live-confirmed via `information_schema.triggers`:
`inventory_container_lines`, `inventory_allocation_container_links`,
`inventory_reservation_lines`, `inventory_allocation_lines`,
`inventory_branch_transfer_lines`, `inventory_branch_transfer_
discrepancies`, `repair_order_line_movement_links`, `repair_order_
location_attribution_uncertain` all carry **zero triggers** — every
"touch" on those child tables is a hand-written `updated_at = now()`
inline in RPC bodies, inconsistent with the pattern used on their own
parent tables. Not a bug; a real consistency note (see dry-review.md).

## 1. Create / Save / Finalize Movement

**UI** → `createDraftMovementAction`/`finalizePostingAction`/
`createAndPostMovementAction`/`saveDraftMovementAction`
(`src/app/actions/warehouse/inventory/index.ts:1289/1340/1609/1514`) →
**service** `InventoryMovementsService.createDraft`/`.finalizePosting`/
`.createAndFinalize`/`.saveDraft` → **public RPC**:
`inventory_create_draft`, `inventory_finalize_posting`,
`inventory_create_and_finalize`, `inventory_save_draft`.

Internal call graph (live): `inventory_create_and_finalize` →
`inventory_create_draft` → (if not an idempotent hit) `inventory_
finalize_posting`. `inventory_finalize_posting` (2-arg public wrapper)
→ **`inventory_finalize_posting_internal`** (internal-only, the actual
engine). `inventory_save_draft` soft-deletes existing lines, re-inserts
new ones, no nested RPC.

Tables: `inventory_movement_headers`, `inventory_movement_lines`,
`inventory_balances`, `inventory_stock_ledger_entries`, `inventory_
document_sequences`, `inventory_movement_audit_log`, `inventory_
settings` (7).

Triggers (7): `inventory_balances_engine_only`, `inventory_balances_
updated_at`, `inventory_movement_lines_immutable_v2` (pass-through —
header still draft), `inventory_movement_lines_updated_at`, `inventory_
movement_headers_immutable_v2` (pass-through — draft→posted is not
restricted), `inventory_movement_headers_updated_at`, and
`repair_order_line_locations_ledger_sync` (fires on **every** ledger
insert, including fully generic movements with no RepairOrder
involvement — no-ops via its own confidence inference in that case).

GUCs (1): `ambra.inventory_movement_engine`, set `'on'` independently
by `create_draft`/`save_draft`/`finalize_posting_internal`.

**Metrics**: hops=4, public RPCs=4, internal RPCs=1, triggers=7, GUCs=1, tables=7.

## 2. Cancel Movement

**UI** (`inventory-movement-detail-panel.tsx:201`) → `cancelMovementAction`
(`index.ts:1369`) → `InventoryMovementsService.cancelMovement` →
`inventory_cancel_movement(p_movement_id, p_actor_user_id, p_reason)`.

No nested RPC. Body: actor check (`28000`) → permission check (`42501`,
IC-7-added) → row-lock header → idempotent no-op if already cancelled →
reject if not draft → `UPDATE` status→cancelled → `INSERT` audit log.

Tables (2): `inventory_movement_headers`, `inventory_movement_audit_log`
— **no `inventory_balances` write** (draft movements never touched
balances).

Triggers (2): `inventory_movement_headers_immutable_v2` (pass-through),
`inventory_movement_headers_updated_at`.

GUC (1, vestigial): sets `ambra.inventory_movement_engine='on'` even
though this RPC never writes `inventory_balances` — a defensive,
now-unnecessary touch left over from before IC-7 removed the GUC as an
_authorization_ signal for headers.

**Metrics**: hops=4, public RPCs=1, internal=0, triggers=2, GUCs=1 (vestigial), tables=2.

## 3. Reverse Movement

**No UI, no action, no service caller anywhere in the repo** —
confirmed by grep; the only hit is a migration-text assertion in a test
file. Matches `application-entry-point-matrix.md`'s own disclosure —
verified true, not stale.

RPC `inventory_reverse_movement`: actor check → mandatory reason →
row-lock original, must be `posted` (`P0007`), not itself a reversal
(`P0005`), not already reversed (`P0006`) → resolve type `900` → sets
both GUCs → INSERT new draft header (type 900, `original_movement_id`
set) → mirror lines with inverted-direction explicit effects → calls
**`inventory_finalize_posting_internal` directly** (bypassing the
public 2-arg wrapper — reachable only via same-owner `SECURITY
DEFINER` nesting) → narrow `UPDATE` on the original header (only the
4 reversal-lifecycle columns, the sole transition the redesigned
immutability trigger permits) → audit log INSERT.

Tables (6): headers, lines, balances, ledger, document_sequences,
audit_log.

Triggers (7): same set as Operation 1, plus the reversal-aware branch
inside the ledger-sync trigger (detects `original_movement_id IS NOT
NULL`, mirrors the original's own attribution links onto the reversal
line, rebuilds both affected buckets).

GUCs (2): `ambra.inventory_movement_engine` + `ambra.repair_order_
attribution_authoritative` — the second exists solely so a reversal of
a RepairOrder-attributed receipt doesn't corrupt the projection via a
double-write with the trigger's own generic-inference path.

**Metrics**: hops=0 (no callers), public RPCs=1, internal=1, triggers=7, GUCs=2, tables=6.

## 4. Receive Stock (generic)

Two genuinely different live paths:

**(a) "Quick receipt" UI** — `quickReceiptAction` → `InventoryMovements
Service.createDraft` (type `101`) → `.finalizePosting` — literally
Operation 1's chain, **not** a call to `inventory_receive_stock`
(zero TS hits for that function name anywhere). Architecture doc §7A
documents this as a deliberate decision (Option A) — confirmed true.

**(b) `inventory_receive_stock` itself** — real SQL-level callers
(`inventory_receive_purchase_order`, `receive_repair_order_stock`) but
**zero direct TypeScript caller**. `SECURITY DEFINER`, delegates to
`inventory_create_and_finalize` (type `101`, single destination-increase
effect, catalog-only).

Tables/triggers/GUCs: identical to Operation 1 (both paths route
through the same engine).

**Metrics** (path a, the reachable one): hops=4, public RPCs=2
(effectively create_draft+finalize_posting), internal=1, triggers=7,
GUCs=1, tables=7.

## 5. Opening Stock (product creation flow)

**UI** → `createEnhancedInventoryProductAction` (`index.ts:221`) →
`InventoryProductsService.createEnhancedProduct` (`:484`) — when
`track_inventory && branch_id && opening_location_id` — → **private**
`createOpeningStockMovement` (`:2276`) → `inventory_create_and_finalize`
(type `401`, `:2323`).

**Correction vs. `inventory-core-architecture.md` §9D**: that section
still documents this as a _currently-live production bug_ calling two
nonexistent RPCs. **Live code shows this was already fixed** (code
comment: "IC-6A: opening stock... posted through the canonical engine's
single atomic entry point") — a later, undocumented-in-that-section fix.
**The architecture doc is stale on this one point; the code is
correct.** (`createProduct`, the simpler path, does NOT call opening
stock at all; `createEnhancedProductLegacy` also calls it but is
confirmed dead code — see dry-review.md.)

Tables/triggers/GUCs: identical engine chain to Operation 1 (type `401`,
destination-only, no source location).

**Metrics**: hops=5, public RPCs=1, internal=1, triggers=7, GUCs=1, tables=7.

## 6. Reservation (create)

Two real callers, one RPC: generic (`createInventoryReservationAction`
→ `InventoryEnterpriseService.createReservation`) and RepairOrder-line
(`reserveRepairOrderLineAction` → `RepairOrdersService.reserveForLine`,
passing `p_reference_type='repair_order_line'`). Both →
`inventory_create_reservation`.

No internal RPC nested (calls `inventory_get_or_create_balance_for_
update`, a shared, `authenticated`-grantable helper — functionally
internal), row-locks `inventory_settings` for numbering, checks
`available_quantity >= v_quantity` (hard-reservation invariant), INSERT
reservation lines, UPDATE balances.

Tables (4): reservations, reservation_lines, balances, settings.

Triggers (4): `inventory_balances_engine_only`, `inventory_balances_
updated_at`, `inventory_settings_updated_at`, `inventory_settings_
write_guard`. (`inventory_reservations`/`_reservation_lines` carry
zero triggers, live-confirmed.)

GUC (1): `ambra.inventory_movement_engine='on'`.

**Metrics**: hops=4, public RPCs=1, internal=0, triggers=4, GUCs=1, tables=4.

## 7. Release Reservation

Generic + RepairOrder-line callers, both → `inventory_release_
reservation(p_reservation_id, p_actor_user_id, p_cancel default true)`.
Also called internally (same-owner nesting) by `inventory_decline_
branch_transfer` and `inventory_cancel_branch_transfer`.

Body: per un-released remainder line, `UPDATE` balances (`reserved_
quantity -= remaining`) + reservation_lines (`released_quantity +=
remaining`); if `p_cancel`, flips reservation status.

Tables (3): balances, reservation_lines, reservations.

Triggers (3): `inventory_balances_engine_only`, `inventory_balances_
updated_at`, `inventory_reservations_updated_at` (only if cancelling).

GUC (1): `ambra.inventory_movement_engine='on'`.

**Metrics**: hops=4, public RPCs=1, internal=0, triggers=3, GUCs=1, tables=3.

## 8. Allocation (create)

Generic + RepairOrder-line callers, both → `inventory_create_
allocation`. Row-locks settings for numbering, INSERT allocation
header, per line: `get_or_create_balance_for_update`, then either (a)
reservation-backed — checks reservation-line remainder, moves
`reserved_quantity → allocated_quantity` additively (the exact
non-overlapping-bucket move the architecture invariant describes), or
(b) unreserved — checks `available_quantity`, `UPDATE allocated_
quantity` directly.

Tables (5): allocations, allocation_lines, reservation_lines
(conditional), balances, settings.

Triggers (4): same shape as reservation (`inventory_allocations`/
`_allocation_lines`/`_reservation_lines` all carry zero triggers,
live-confirmed).

GUC (1): `ambra.inventory_movement_engine='on'`.

**Metrics**: hops=4, public RPCs=1, internal=0, triggers=4, GUCs=1, tables=5.

## 9. Release Allocation

**Finding**: generic-only caller (`releaseInventoryAllocationAction` →
`InventoryEnterpriseService.releaseAllocation`) → `inventory_release_
allocation`. **No RepairOrder-line-specific release-allocation action
exists** — `RepairOrdersService` has container place/remove but no
`releaseAllocationForLine`, an entry-point asymmetry vs. reservation
(which does have a line-specific release action). The generic RPC
still works fine for a RepairOrder allocation (reference-type-agnostic)
— this is a UI/action gap, not an RPC-design problem.

Body: per line, `UPDATE` balances (`allocated_quantity -= remaining`);
flips allocation status to `released`. **Does not restore `reserved_
quantity`** — releasing an allocation does not un-consume the
reservation it fulfilled (deliberate: reservation/allocation are
separate, additive, non-overlapping buckets by design, not a bug).

Tables (2): balances, allocations.

Triggers (3): `inventory_balances_engine_only`, `inventory_balances_
updated_at`, `inventory_allocations_updated_at`.

GUC (1): `ambra.inventory_movement_engine='on'`.

**Metrics**: hops=4, public RPCs=1, internal=0, triggers=3, GUCs=1, tables=2.

## 10. Branch Transfer (create / send / accept / decline / cancel)

**Live UI-wiring gap, not previously surfaced by the docs**: only 3 of
5 sub-operations have a real UI caller.

| Sub-op  | RPC                                 | UI caller                              |
| ------- | ----------------------------------- | -------------------------------------- |
| create  | `inventory_create_branch_transfer`  | ✅ `movements/new/...:209`             |
| send    | `inventory_send_branch_transfer`    | ❌ **zero callers anywhere in `src/`** |
| accept  | `inventory_accept_branch_transfer`  | ✅ `movement-detail-panel.tsx:96`      |
| decline | `inventory_decline_branch_transfer` | ✅ `movement-detail-panel.tsx:109`     |
| cancel  | `inventory_cancel_branch_transfer`  | ❌ **zero callers anywhere in `src/`** |

**Practical consequence**: nothing in the current UI can ever transition
a transfer `prepared → in_transit` (that's `send`'s only job) — so the
accept/decline UI paths are only reachable today via direct RPC
invocation (tests, curl), not through the shipped product surface.
`application-entry-point-matrix.md` does not surface this specific gap
(it names only the RepairOrder receive/putaway/rebuild/reverse group as
zero-caller).

Internal call graph: `create` → nests `inventory_create_reservation`
(reserve at source). `send` → hand-rolled balance/reservation-line
consumption (not via `release_reservation` — bespoke, by design, to
decrement exactly the committed remainder), hand-builds a `311`-type
draft (bypasses `create_draft` since 311 disallows manual entry), posts
via `finalize_posting_internal` directly. `accept` → resolves per-line
acceptances (full/partial), conditionally builds a `312`-type draft,
inserts discrepancy rows for shortfall, posts via `finalize_posting_
internal` directly. `decline`/`cancel` (pre-shipment only) → call
`inventory_release_reservation(..., true)`.

Tables (union, 12): branch*transfers, branch_transfer_lines,
reservations, reservation_lines, balances, settings, movement_headers,
movement_lines, ledger, document_sequences, branch_transfer*
discrepancies, audit_log.

Triggers: up to 9 distinct bindings across the full lifecycle (send/
accept hit the full engine's 7 + their own `_updated_at`).

GUCs (1, touched redundantly): `ambra.inventory_movement_engine='on'`
set independently in every one of the 5 RPCs (4 of 5 set it directly
even when they'd get it transitively through a nested call).

**Metrics**: hops=4 per sub-op (2/5 have no real UI hop), public
RPCs=5, internal=0, triggers=up to 9, GUCs=1×5, tables=12 (union).

## 11. Container (create / add / remove / seal)

All four: `SECURITY DEFINER`, actor+permission check, no nested RPC, no
`inventory_balances` touch (by design — container repacking without
relocation is never a physical movement), **zero triggers** (live-
confirmed on `inventory_containers`/`_container_lines`/`_allocation_
container_links`).

- **create**: `RepairOrdersService.createContainerForRepairOrder` →
  `inventory_create_container` (also reachable from generic warehouse
  UI per docs, not independently re-verified this pass).
- **add**: `RepairOrdersService.placeAllocationInContainer` →
  `inventory_add_to_container` — locks container+allocation line,
  checks location match, checks (if RepairOrder-owned) the allocation
  traces to the SAME RepairOrder via a 3-table JOIN to `repair_order_
lines` (the one disclosed generic-core/RepairOrder coupling), checks
  the quantity cap.
- **remove**: `RepairOrdersService.removeAllocationFromContainer` →
  `inventory_remove_from_container`.
- **seal**: **zero TypeScript caller found anywhere** — same class of
  gap as reversal/RepairOrder-receive/putaway/rebuild.

Tables (union, 3): containers, container_lines, allocation_container_links.

**Metrics**: hops=4 (create/add/remove) / 0 (seal), public RPCs=4,
internal=0, triggers=0, GUCs=0 (none of the four touch the engine
GUC — correctly, none write a GUC-gated table), tables=3.

## 12. RepairOrder Receiving

**Zero current TS callers** — confirmed live (only a doc-comment
cross-reference). Matches `application-entry-point-matrix.md`.

RPC `receive_repair_order_stock`: resolves the branch's receiving
location (internal helper), optionally resolves provenance (hard-reject
on 0/>1 candidates), sets the attribution-authoritative GUC, calls
`inventory_receive_stock` (nests create_draft+finalize, type `101`),
then for every resolved line: `attach_repair_order_line_movement`
(same-owner nesting) + direct upsert of `repair_order_line_locations`
(incremental fast path).

Tables (9): Operation 1's set + `repair_order_line_movement_links` +
`repair_order_line_locations`.

Triggers (7): Operation 1's 7 — the ledger-sync trigger's own inference
path is the only active projection writer since the GUC suppresses
`attach`'s own conditional rebuild call, no redundant double-write.

GUCs (2): `ambra.repair_order_attribution_authoritative` (set at top) +
`ambra.inventory_movement_engine` (transitive).

**Metrics**: hops=0 (no callers), public RPCs=3, internal=1 (+1 helper), triggers=7, GUCs=2, tables=9.

## 13. RepairOrder Putaway

**Zero current TS callers** — confirmed live. RPC `putaway_repair_
order_stock`: resolves receiving location, validates destination is a
real stockable bin ≠ receiving location, validates the bucket is not
already `repair_order_location_attribution_uncertain` (hard-reject —
"UNKNOWN gate"), validates sufficient attributed quantity at the
receiving location, sets the attribution GUC, posts an `801` relocation
via `inventory_create_and_finalize`, then per line: correlates the
posted line, decrements/re-inserts `repair_order_line_locations`
directly, calls `write_repair_order_line_movement_link_internal`
directly (relation `'relocation'`, a different call path than
Receiving above — direct, not via `attach`).

Tables (8): Operation 1's set (type `801`) + `repair_order_line_
locations` + `repair_order_line_movement_links`.

Triggers (7): same as Operation 1 — putaway's own direct writes happen
in application code, not the trigger, so no double-write.

GUCs (2): attribution-authoritative + engine (transitive).

**Metrics**: hops=0, public RPCs=2, internal=2 (+1 helper), triggers=7, GUCs=2, tables=8.

## 14. RepairOrder Attribution (`attach_repair_order_line_movement`)

**Finding — contradicts `application-entry-point-matrix.md`**, which
lists the caller as "(RepairOrder detail-page actions)". **Live grep
disproves this**: the only callers of `RepairOrdersService.
attachMovementToRepairOrderLine` are its own Vitest suite (7 sites) —
**zero action-layer or component-layer caller anywhere**. The method
exists, is fully implemented, but has no server action or UI surface.
Its only real (indirect) production caller today is `receive_repair_
order_stock` (which calls the RPC directly at the SQL level, not
through the TS service) — and that orchestrator itself has zero UI
callers (Operation 12). **Net effect: this RPC has no reachable path
from the live product today, at any layer.**

Body: actor+permission checks → resolve line/movement/header →
`relation_type IN ('receipt','issue')` only (`22023` otherwise —
system types `relocation`/`reversal` unreachable through this public
entry) → category/reference-type cross-checks → `write_repair_order_
line_movement_link_internal` → if the attribution-authoritative GUC is
NOT on, conditionally rebuilds the affected bucket directly (skipped
when called from inside an orchestrator that already has the GUC set).

Tables (1-3): `repair_order_line_movement_links` + conditionally the
projection tables.

Triggers: 0 directly (the write is RPC-code-driven when called this way).

GUC (1, read-only): reads the attribution-authoritative GUC.

**Metrics**: hops=0 (service method exists, zero real callers), public RPCs=1, internal=2, triggers=0, GUCs=1, tables=1-3.

## 15. RepairOrder Projection Rebuild

**Zero current TS callers** — confirmed live. `rebuild_repair_order_
location_projection`: actor+permission check, resolves every DISTINCT
`(location,variant)` bucket the order's own attribution history ever
touched, calls `rebuild_repair_order_projection_bucket_internal` once
per bucket.

That internal primitive (also reachable from Operations 3/14):
row-locks the balance bucket (reentrant-safe, same lock every other
writer takes), `DELETE`s existing projection rows, recomputes each
line's net contribution from ledger×link joins, raises `P0008` on
negative/over-physical inconsistency (never silently clamped), re-
derives the UNKNOWN marker.

Tables (2, +1 read-locked): projection tables (DELETE+INSERT), balances
(FOR UPDATE, read-only).

Triggers: 0 (both target tables carry zero triggers, live-confirmed).

**Metrics**: hops=0, public RPCs=1, internal=1 (×N buckets), triggers=0, GUCs=0, tables=2.

## 16. PurchaseOrder Receive

`receiveInventoryPurchaseOrderAction` → `InventoryEnterpriseService.
receivePurchaseOrder` → `inventory_receive_purchase_order`.

Body: actor+permission checks → derives a PO-scoped idempotency key and
short-circuits on a repeat WITHOUT re-mutating any PO line (a real,
deliberate fast path distinct from the primitive's own idempotency
handling) → status guard → per line: lock, over-receipt check, resolve
destination, `UPDATE received_quantity` → one batched call to
`inventory_receive_stock` (nests create_draft+finalize, type `101`) →
recompute PO status → `UPDATE inventory_purchase_orders`.

Tables (9): Operation 1's set + purchase_order_lines + purchase_orders.

Triggers (9): Operation 1's 7 + 2 `_updated_at` triggers.

GUC (1, transitive): engine GUC set inside the nested chain, not
directly by this RPC.

**Metrics**: hops=4, public RPCs=2, internal=1, triggers=9, GUCs=1, tables=9.

## 17. Count Session Approve

`approveInventoryCountSessionAction` → `InventoryCountSessionsService.
approveCountSession` → `inventory_approve_count_session`.

**`SECURITY INVOKER`, not DEFINER** (unchanged by IC-7, deliberately —
nested calls into the hardened engine already provide the real
boundary). Body: actor+permission checks → status guard → reject if
any unreviewed lines exist → `PERFORM inventory_seed_movement_types`
(real call, ensures 401/402 exist for the org) → partitions approved
variance into increase(401)/decrease(402) buckets → up to 2 full
create_draft+finalize_posting cycles → `UPDATE` session status.

Because INVOKER, nested calls execute as the real caller's own role
(not elevated) — works only because the caller already holds the
required permission (checked once, redundantly, inside each nested
call too).

Tables (7): movement_types (seed upsert), headers/lines (×0-2),
balances, ledger, document_sequences, audit_log, count_sessions.

Triggers (up to 8): Operation 1's 7 (×0-2) + `inventory_count_
sessions_guard_status_trigger`.

GUC (1, transitive ×2): set inside each nested create_draft call, not
by this RPC itself.

**Metrics**: hops=4, public RPCs=3, internal=0, triggers=8, GUCs=1, tables=7.

## Summary table

| #   | Operation                      | UI→…→RPC hops | Public RPCs | Internal | Triggers | GUCs          | Tables |
| --- | ------------------------------ | ------------- | ----------- | -------- | -------- | ------------- | ------ |
| 1   | Create/save/finalize movement  | 4             | 4           | 1        | 7        | 1             | 7      |
| 2   | Cancel movement                | 4             | 1           | 0        | 2        | 1 (vestigial) | 2      |
| 3   | Reverse movement               | **0**         | 1           | 1        | 7        | 2             | 6      |
| 4   | Receive stock (generic)        | 4             | 2           | 1        | 7        | 1             | 7      |
| 5   | Opening stock                  | 5             | 1           | 1        | 7        | 1             | 7      |
| 6   | Reservation (create)           | 4             | 1           | 0        | 4        | 1             | 4      |
| 7   | Release reservation            | 4             | 1           | 0        | 3        | 1             | 3      |
| 8   | Allocation (create)            | 4             | 1           | 0        | 4        | 1             | 5      |
| 9   | Release allocation             | 4             | 1           | 0        | 3        | 1             | 2      |
| 10  | Branch transfer (5 sub-ops)    | 4 (3/5 wired) | 5           | 0        | ≤9       | 1×5           | 12     |
| 11  | Container (4 sub-ops)          | 4 (3/4 wired) | 4           | 0        | 0        | 0             | 3      |
| 12  | RepairOrder receiving          | **0**         | 3           | 2        | 7        | 2             | 9      |
| 13  | RepairOrder putaway            | **0**         | 2           | 2        | 7        | 2             | 8      |
| 14  | RepairOrder attribution        | **0**         | 1           | 2        | 0        | 1             | 1-3    |
| 15  | RepairOrder projection rebuild | **0**         | 1           | 1×N      | 0        | 0             | 2      |
| 16  | PO receive                     | 4             | 2           | 1        | 9        | 1             | 9      |
| 17  | Count session approve          | 4             | 3           | 0        | 8        | 1             | 7      |

**Headline pattern**: of 17 operations, **6 have zero reachable UI/
action entry point today** (reverse, RepairOrder receive, RepairOrder
putaway, RepairOrder attribution, RepairOrder projection rebuild,
container-seal), and **2 of the 5 branch-transfer sub-operations**
(send, cancel) are similarly orphaned despite the other 3 being wired —
a materially larger "built but unreachable" surface than
`application-entry-point-matrix.md` discloses (it names only 4
zero-caller RPCs; live grep found 8 distinct zero-TS-caller canonical
RPCs, plus a 9th at the TS-service-method level). See
`rpc-helper-trigger-review.md` for the per-RPC KEEP/DEFER UI
classification this drives.
