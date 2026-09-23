# Inventory Core — A7 Domain-Boundary Cleanup — Changed Files

**Baseline**: HEAD `7df19e01` ("Inventory Core A1-A6 simplification
pass"). **Total**: 2 new migrations + 1 new pgTAP test file + 1
pre-existing pgTAP test file corrected (1 disclosed scenario) + 2
TypeScript files modified (1 source, 1 test) + this review bundle.

## New migrations (2 — exactly the 2 the task specified, no more)

1. `20260922072503_a7_add_repair_order_container_wrapper.sql` —
   creates `repair_order_add_allocation_to_container`.
2. `20260922072704_a7_narrow_inventory_add_to_container.sql` —
   `CREATE OR REPLACE` on `inventory_add_to_container`, removing only
   the RepairOrder-ownership branch.

See `migration-summary.md` for full detail.

## New pgTAP test file

`apps/web/supabase/tests/114_a7_repairorder_container_boundary_test.sql`
— `plan(18)`, 18/18 live. Covers: A (same-RepairOrder success), B
(cross-RepairOrder rejection), C (foreign-branch rejection, non-
leaking), D (spoofed-actor rejection), E (no-permission rejection), F
(generic primitive still succeeds for a non-RepairOrder container), G1
(structural proof — zero real FROM/JOIN references to
`repair_order_lines` in the generic primitive) + G2 (behavioral proof
— a direct call to the generic primitive no longer enforces ownership,
the disclosed tradeoff), H1/H2 (quantity and location validation still
enforced via the wrapper → nested generic call), I1/I2 (no duplicate
placement / over-placement regression), J1/J2 (atomic rollback — a
rejected wrapper call leaves zero partial mutation), plus 3
security-model checks (stale-overload ×2, anon denial).

## Pre-existing test file corrected (1, required by this exact change — not scope creep)

- `apps/web/supabase/tests/100_repair_order_container_orchestration_
phase10c_test.sql` — scenario T19 previously called `inventory_add_
to_container` directly, expecting cross-RepairOrder rejection. Since
  the generic primitive no longer enforces this on its own, T19 now
  calls `repair_order_add_allocation_to_container` instead — the real
  production enforcement point post-A7. T19 continues proving the
  exact same guarantee (cross-RepairOrder placement is rejected, same
  `P0002` SQLSTATE) without weakening coverage. **T20 and everything
  downstream (T21–T44) is completely unchanged** — the wrapper still
  rejects this exact case, so every quantity/status/linked-sum
  assertion the file already made remains true. Assertion COUNT
  unchanged (still 44, matching `plan(44)`); only T19's own function
  call and message wording changed. Header comment updated to document
  the correction, matching this project's own established convention
  for disclosed forward corrections to accepted test files.

## TypeScript files changed

- `apps/web/src/server/services/repair-orders.service.ts` —
  `placeAllocationInContainer` now calls `repair_order_add_allocation_
to_container` instead of `inventory_add_to_container` via
  `supabase.rpc(...)`. Same 6 parameters, same names, same values,
  same result-shape handling, same error normalization
  (`normalizeContainerRpcError` — its own allowlist already covered
  every message the wrapper can raise, zero allowlist changes needed
  since the wrapper's messages are byte-identical to what the removed
  inline branch used to raise), same event emission. Only the RPC name
  string and one `console.error` label changed.
- `apps/web/src/server/services/__tests__/repair-orders.service.test.ts`
  — one test's own title and its `expect(supabase.rpc).
toHaveBeenCalledWith(...)` assertion updated from `"inventory_add_to_
container"` to `"repair_order_add_allocation_to_container"` (the
  test over-specified an internal implementation detail — which RPC
  gets called — that legitimately changed as part of this pass's own
  explicit design; the params/mock/result assertions are completely
  unchanged). One doc comment near the top of the `placeAllocation
InContainer`/`removeAllocationFromContainer` test block updated for
  accuracy (now documents the wrapper's own existence).

## Review bundle

`docs/inventory/reviews/inventory-a7-repairorder-container-boundary-
review/` — this bundle (`review-context.md`, `changed-files.md`,
`migration-summary.md`, `test-evidence.md`, `boundary-evidence.md`,
`diff.patch`).

## Not touched this pass

- A8 (RepairOrder incremental projection removal,
  `repair_order_line_locations_ledger_sync`/`repair_order_location_
attribution_sync`/`repair_order_line_locations`/`repair_order_
location_attribution_uncertain`/projection-rebuild logic) — not
  started, not touched.
- IC-8, Phase 10D — not started.
- Reservation/allocation semantics, container lifecycle semantics
  (create/remove/seal), generic container caller behavior — all
  unchanged, re-confirmed by the full 097–114 regression.
- `apps/public-web`'s own broken raw-write container feature — not
  touched, not migrated, not fixed.
- Any DEFER item from prior passes (valuation snapshot, document-
  numbering duplication, idempotency refactor, custom-field writer
  duplication, branch-transfer UI gaps, indexes, ledger partitioning,
  A5's own rejected rollup divergence) — none touched.
- `inventory_remove_from_container`/`inventory_seal_container`/
  `inventory_create_container` — confirmed to have no equivalent
  RepairOrder-table knowledge of their own (repo-wide `prosrc` scan);
  none modified.
