# IC-3 — Changed Files

**Branch**: `zone3-zone5-integration-audit`.
**Baseline SHA**: `b0b84a3872c6d052fe40c3866a5bdf198b1bd740` (commit `ic2`
— IC-2's full submission, including its own security-boundary correction
pass; confirmed clean working tree at IC-3's own starting point via `git
status`).
**Working tree at packaging time**: clean except the exact files listed
below (verified via `git status --short` immediately before packaging).

## New files (5)

| File                                                                                                                    | Purpose                                                                                                                                                 |
| ----------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `apps/web/supabase-target/supabase/migrations/20260915183918_ic3_canonical_receive_primitive.sql`                       | The new `inventory_receive_stock` domain-agnostic physical receiving primitive.                                                                         |
| `apps/web/supabase-target/supabase/migrations/20260915184005_ic3_receive_repair_order_stock_wrapper_refactor.sql`       | Refactors `receive_repair_order_stock` into a thin wrapper over the primitive; all RepairOrder business rules kept byte-for-byte.                       |
| `apps/web/supabase-target/supabase/migrations/20260915184050_ic3_inventory_receive_purchase_order_wrapper_refactor.sql` | Fixes (was dead/broken) and refactors `inventory_receive_purchase_order` onto the primitive; drops the old broken 3-arg overload in the same migration. |
| `apps/web/supabase-target/supabase/migrations/20260915184448_ic3_fix_po_wrapper_idempotency_state_mutation_race.sql`    | Corrective: fixes a self-caught PO-wrapper idempotency/state-mutation-ordering defect, found before any test exercised it.                              |
| `apps/web/supabase/tests/104_ic3_receiving_consolidation_test.sql`                                                      | New pgTAP file: 44/44 — canonical primitive (Scenario F), RepairOrder wrapper (Scenario G), PO wrapper (Scenario H), permission negatives (Scenario J). |

## Modified files (3)

| File                                                   | Change                                                                                                                                                                                                                                                                                                       |
| ------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `docs/inventory/inventory-core-architecture.md`        | New §7A ("Receiving Consolidation") — full RPC contract, security model, line-correlation contract, idempotency proof, both wrapper summaries, the generic-UI decision, the lot/serial disclosure. §9 gained one new CRITICAL table row (the unauthenticated-posting finding, marked top-priority for IC-7). |
| `docs/inventory/inventory-core-implementation-plan.md` | IC-3 section gained a RESULT addendum (original plan preserved as historical record, appended below it, not rewritten).                                                                                                                                                                                      |
| `docs/inventory/inventory-core-progress.md`            | Runtime status → IC-3 DONE; phase-tracker row updated; full IC-3 change-log entry appended.                                                                                                                                                                                                                  |

## No changes to

- `inventory_finalize_posting`, `inventory_finalize_posting_internal`,
  `inventory_reverse_movement`, `inventory_create_and_finalize` —
  IC-2's own frozen security contract is untouched. `inventory_finalize_
posting_internal`'s own EXECUTE grants were re-verified live, unchanged
  (still `anon`/`authenticated`/`service_role` all `false`, only
  `postgres` `true`).
- `inventory_create_reservation`, `inventory_release_reservation`,
  `inventory_create_allocation`, `inventory_release_allocation` —
  untouched.
- Every Phase 10C container RPC — untouched.
- RepairOrder reversal netting, Zone 5 projection semantics — untouched,
  per explicit instruction.
- QR, whole-container relocation, WZ/201, transfer rebuild — none in
  scope, none touched.
- Any TypeScript application code — IC-3 is entirely PL/pgSQL + pgTAP +
  documentation; the generic Warehouse Movements UI's own action/service
  chain was inspected and left unchanged (a deliberate decision, see
  review-context.md).
- `inventory_create_draft`'s own body — the CRITICAL new security finding
  (no actor/permission check, live `anon` EXECUTE) was discovered but NOT
  fixed this pass, per explicit scope; its own function body is byte-for-
  byte unchanged by this phase.

## Diff summary

8 files changed, 1635 insertions(+), 13 deletions(-) against baseline
`b0b84a3872c6d052fe40c3866a5bdf198b1bd740`. Full unified diff in
`diff.patch` (133,473 bytes).
