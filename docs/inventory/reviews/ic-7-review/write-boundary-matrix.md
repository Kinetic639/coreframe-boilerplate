# IC-7 Write-Boundary Matrix

Every production write path affecting the tables named in the IC-7 task's
own §2, live-verified against `pg_proc`/`pg_policies`/`pg_trigger`
(not inferred from migration text). Columns match the task's own required
schema: function/RPC, direct DML or nested RPC, SECURITY DEFINER/INVOKER,
owner, PUBLIC/anon/authenticated/service_role grants, actor-identity
check, org/branch permission check, raw-table RLS protection, whether
frontend/application code calls it directly, and classification (public
business API / internal-only / legacy-removed / read-only).

## `inventory_movement_headers` / `inventory_movement_lines`

| Writer                                              | DML/nested                                                     | DEFINER?                | Owner    | anon                                                  | auth               | actor check          | permission check        | RLS (final)                                                         | App caller                                                                                           | Class                                 |
| --------------------------------------------------- | -------------------------------------------------------------- | ----------------------- | -------- | ----------------------------------------------------- | ------------------ | -------------------- | ----------------------- | ------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------- | ------------------------------------- |
| `inventory_create_draft`                            | direct INSERT                                                  | DEFINER                 | postgres | ❌ (IC-7A)                                            | ✅                 | ✅ (28000)           | ✅ (42501)              | INSERT restricted to `status='draft'` (IC-7, new)                   | `InventoryMovementsService.createDraft`                                                              | Public business API                   |
| `inventory_finalize_posting` (2-arg public wrapper) | → internal                                                     | DEFINER                 | postgres | ❌ (IC-7A)                                            | ✅                 | ✅                   | ✅                      | n/a (delegates)                                                     | `InventoryMovementsService.finalizePosting`                                                          | Public business API                   |
| `inventory_finalize_posting_internal` (3-arg)       | UPDATE (status/doc#/snapshot)                                  | DEFINER                 | postgres | ❌                                                    | ❌ (internal-only) | ✅                   | ✅                      | n/a                                                                 | none (internal only)                                                                                 | **Internal only**                     |
| `inventory_create_and_finalize`                     | → create_draft + finalize                                      | DEFINER                 | postgres | ❌ (IC-7A)                                            | ✅                 | ✅                   | ✅                      | n/a                                                                 | `InventoryMovementsService.createAndFinalize`, `InventoryProductsService.createOpeningStockMovement` | Public business API                   |
| `inventory_save_draft`                              | UPDATE header + soft-delete/re-INSERT lines                    | DEFINER                 | postgres | ❌ (IC-7, new)                                        | ✅                 | ✅ (28000, IC-7 new) | ✅ (42501, IC-7 new)    | UPDATE/INSERT both draft-scoped                                     | `InventoryMovementsService.saveDraft`                                                                | Public business API                   |
| `inventory_cancel_movement`                         | UPDATE (draft→cancelled)                                       | DEFINER                 | postgres | ❌ (IC-7, new)                                        | ✅                 | ✅ (28000, IC-7 new) | ✅ (42501, IC-7 new)    | n/a                                                                 | `InventoryMovementsService.cancelMovement`                                                           | Public business API                   |
| `inventory_reverse_movement`                        | INSERT (new 900 movement) + narrow UPDATE (4 cols on original) | DEFINER                 | postgres | ❌ (IC-2)                                             | ✅                 | ✅ (28000)           | ✅ (42501)              | header UPDATE now structurally validated (IC-7, new)                | not yet wired to any action (no UI)                                                                  | Public business API                   |
| `inventory_receive_stock`                           | → create_and_finalize                                          | DEFINER                 | postgres | ❌ (IC-3)                                             | ✅                 | ✅                   | ✅                      | n/a                                                                 | (none directly — wrapped)                                                                            | Public business API                   |
| `receive_repair_order_stock`                        | → receive_stock + attach                                       | DEFINER                 | postgres | ❌                                                    | ✅                 | ✅                   | ✅                      | n/a                                                                 | **zero current TS callers** (confirmed live, see `application-entry-point-matrix.md`)                | Public business API, currently unused |
| `inventory_receive_purchase_order`                  | → receive_stock + PO bookkeeping                               | DEFINER                 | postgres | ❌ (IC-3, fixed from implicit INVOKER/no-actor-check) | ✅                 | ✅                   | ✅ (procurement.manage) | n/a                                                                 | `InventoryEnterpriseService.receivePurchaseOrder`                                                    | Public business API                   |
| `inventory_send_branch_transfer`                    | → finalize_posting_internal (311)                              | DEFINER                 | postgres | ❌ (IC-4)                                             | ✅                 | ✅                   | ✅                      | n/a                                                                 | `InventoryEnterpriseService` branch-transfer methods                                                 | Public business API                   |
| `inventory_accept_branch_transfer`                  | → finalize_posting_internal (312)                              | DEFINER                 | postgres | ❌ (IC-4)                                             | ✅                 | ✅                   | ✅                      | n/a                                                                 | same                                                                                                 | Public business API                   |
| `inventory_approve_count_session`                   | → create_draft + finalize_posting (401/402)                    | **INVOKER** (unchanged) | n/a      | ❌ (IC-7, new)                                        | ✅                 | ✅ (28000, IC-7 new) | ✅                      | n/a                                                                 | `InventoryCountSessionsService.approveCountSession`                                                  | Public business API                   |
| Raw client `INSERT`                                 | direct                                                         | n/a                     | n/a      | n/a                                                   | n/a                | n/a                  | RLS permission-gated    | **status='draft' only (IC-7, new)**                                 | none (blocked)                                                                                       | Closed this phase                     |
| Raw client `UPDATE`/`DELETE` on posted rows         | direct                                                         | n/a                     | n/a      | n/a                                                   | n/a                | n/a                  | RLS permission-gated    | **structurally denied except the exact reversal delta (IC-7, new)** | none (blocked)                                                                                       | Closed this phase                     |

## `inventory_balances`

| Writer                                                | Mechanism                                               | Notes                                                                                                                                                                          |
| ----------------------------------------------------- | ------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `inventory_finalize_posting_internal`                 | `UPDATE ... SET on_hand_quantity`                       | Sole `on_hand_quantity` writer, confirmed via `prosrc` scan (IC-6)                                                                                                             |
| `inventory_create_reservation`/`_release_reservation` | `UPDATE ... SET reserved_quantity`                      | Now DEFINER (IC-7)                                                                                                                                                             |
| `inventory_create_allocation`/`_release_allocation`   | `UPDATE ... SET allocated_quantity`/`reserved_quantity` | Now DEFINER (IC-7)                                                                                                                                                             |
| `inventory_send_branch_transfer`                      | reservation consumption                                 | unchanged (IC-4)                                                                                                                                                               |
| `inventory_get_or_create_balance_for_update`          | `INSERT ... ON CONFLICT` (row creation)                 | Internal-only helper, `anon`/`PUBLIC` revoked this phase (IC-7)                                                                                                                |
| Raw client write                                      | direct                                                  | **Blocked by `inventory_guard_balance_write` trigger — NULL-comparison bug fixed this phase (IC-7); previously failed OPEN for any session that never touched the GUC at all** |

## `inventory_stock_ledger_entries`

Append-only (`inventory_ledger_append_only` trigger, unconditional
`RAISE EXCEPTION` — no GUC dependency, confirmed NOT affected by the
NULL-comparison bug class). Written exclusively by `inventory_finalize_
posting_internal`. No UPDATE/DELETE RLS policy exists at all (implicit
deny under FORCE RLS) — correctly backed by the trigger regardless.

## `inventory_reservations` / `inventory_reservation_lines`

| Writer                          | Mechanism                          | RLS (final)                                                                                |
| ------------------------------- | ---------------------------------- | ------------------------------------------------------------------------------------------ |
| `inventory_create_reservation`  | direct INSERT                      | Now DEFINER (IC-7); RESTRICTIVE deny added to backing table (IC-7)                         |
| `inventory_release_reservation` | UPDATE (status, released_quantity) | Now DEFINER (IC-7)                                                                         |
| `inventory_create_allocation`   | UPDATE (fulfilled_quantity)        | Now DEFINER (IC-7)                                                                         |
| Raw client write                | direct                             | **Closed this phase** — was PERMISSIVE-ALL-only, empirically confirmed exploitable pre-fix |

## `inventory_allocations` / `inventory_allocation_lines`

| Writer                         | Mechanism       | RLS (final)                                            |
| ------------------------------ | --------------- | ------------------------------------------------------ |
| `inventory_create_allocation`  | direct INSERT   | Now DEFINER (IC-7); RESTRICTIVE deny added (IC-7)      |
| `inventory_release_allocation` | UPDATE (status) | Now DEFINER (IC-7)                                     |
| Raw client write               | direct          | **Closed this phase** — same gap class as reservations |

## `inventory_containers` / `inventory_container_lines`

| Writer                                        | Mechanism                 | RLS (final)                                                                                                                                                                                   |
| --------------------------------------------- | ------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `inventory_create_container`                  | direct INSERT             | DEFINER, already correctly authenticated-only (Phase 10C)                                                                                                                                     |
| `inventory_add_to_container`                  | direct INSERT/UPDATE      | DEFINER, already correct; contains one disclosed generic-core/RepairOrder-domain coupling (see `module-boundary-audit.md`)                                                                    |
| `inventory_remove_from_container`             | direct UPDATE/soft-delete | DEFINER, already correct                                                                                                                                                                      |
| `inventory_seal_container`                    | direct UPDATE             | DEFINER, already correct                                                                                                                                                                      |
| RepairOrder-owned rows, raw write             | direct                    | RESTRICTIVE deny, Phase 10C's own correction (unchanged)                                                                                                                                      |
| **Generic (non-RepairOrder) rows, raw write** | direct                    | **Closed this phase (IC-7)** — was openly PERMISSIVE ALL; safe to close only because IC-6 already deleted the sole legacy direct-writer (`ambra-location-inventory.ts`'s own 4 write actions) |

## `inventory_branch_transfers` / `_lines` / `_discrepancies`

Already fully closed by IC-4 (RESTRICTIVE `USING(false)`/`WITH CHECK
(false)` on all three tables). Re-verified live this phase: unchanged,
correctly still denying raw writes. **KEEP, not touched.**

## `repair_order_line_movement_links`

Already closed since an earlier IC-2-era migration; re-confirmed
unbroken by IC-5's own internal-writer refactor. Sole writer: `write_
repair_order_line_movement_link_internal` (internal-only, `anon`/
`authenticated`/`service_role`/`PUBLIC` all revoked). **KEEP, not
touched.**

## `repair_order_line_locations` / `repair_order_location_attribution_uncertain`

Already closed by IC-5 (explicit RESTRICTIVE deny, self-documenting the
pre-existing implicit deny). Sole writers: the reversal-aware sync
trigger and `rebuild_repair_order_projection_bucket_internal` (internal-
only). **KEEP, not touched.**

## Summary

| Table                                                  | Pre-IC-7 status                                           | Post-IC-7 status                  |
| ------------------------------------------------------ | --------------------------------------------------------- | --------------------------------- |
| `inventory_movement_headers`/`_lines`                  | UPDATE: GUC-bypassable (structural); INSERT: status-blind | **Both closed**                   |
| `inventory_balances`                                   | Guard trigger failed OPEN by default (NULL bug)           | **Closed**                        |
| `inventory_stock_ledger_entries`                       | Already correctly closed                                  | Unchanged (confirmed correct)     |
| `inventory_reservations`/`_lines`                      | PERMISSIVE-ALL-only, fully raw-writable                   | **Closed**                        |
| `inventory_allocations`/`_lines`                       | PERMISSIVE-ALL-only, fully raw-writable                   | **Closed**                        |
| `inventory_containers`/`_lines` (generic rows)         | PERMISSIVE-ALL-only                                       | **Closed** (newly safe post-IC-6) |
| `inventory_containers`/`_lines` (RepairOrder rows)     | Already closed (Phase 10C)                                | Unchanged                         |
| `inventory_branch_transfers`/`_lines`/`_discrepancies` | Already closed (IC-4)                                     | Unchanged                         |
| `repair_order_line_movement_links`                     | Already closed                                            | Unchanged                         |
| `repair_order_line_locations`/`_attribution_uncertain` | Already closed (IC-5)                                     | Unchanged                         |

**Architecture doc §9's own table is now 100% "Keep"/"Closed" across
every row it lists**, satisfying IC-7's own acceptance criteria per
`inventory-core-implementation-plan.md`.
