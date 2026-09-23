# IC-7 Changed Files

**Baseline**: `fb22529567cf029ea2dc6e6109f1f3d34216d477` (commit `ic6a`
— the combined IC-6 + IC-6A commit; see `review-context.md` item 0 for
the full disclosure of how this commit came to exist).

**Total**: 13 new migrations (9 original IC-7 + 4 from the closing
pass) + 2 new pgTAP test files (110, 111) + 3 pre-existing pgTAP test
files fixture-corrected (098, 099, 100 — see below) + this review
bundle (11 files). **Zero TypeScript/application files changed** —
both IC-7 and its closing pass are pure SQL/database security-
hardening work; no server action, service, or component was touched.

## New migrations (9, all applied live via MCP, mirrored locally under

their exact live timestamp)

1. `20260917145915_ic7_cancel_movement_add_actor_and_permission_check.sql`
2. `20260917150029_ic7_close_posted_header_guc_bypass.sql`
3. `20260917150202_ic7_fix_null_comparison_fail_open_guard_triggers.sql`
4. `20260917150506_ic7_harden_save_draft_and_reconcile_balances.sql`
5. `20260917150706_ic7_reservation_allocation_container_restrictive_rls.sql`
6. `20260917150959_ic7_harden_reservation_allocation_rpcs.sql`
7. `20260917151236_ic7_close_status_blind_insert_gap.sql`
8. `20260917151417_ic7_harden_approve_count_session.sql`
9. `20260917151537_ic7_grant_hygiene_internal_helper_and_triggers.sql`

See `migration-summary.md` for the full per-migration detail.

## Closing-pass migrations (4, applied 2026-09-19, mirrored locally)

10. `20260919093552_ic7_closing_harden_product_po_count_session_actor_and_grants.sql`
11. `20260919093630_ic7_closing_harden_enhanced_product_actor_and_grants.sql`
12. `20260919093655_ic7_closing_harden_purchase_order_and_count_session_actor_and_grants.sql`
13. `20260919093709_ic7_closing_grant_hardening_valuation_and_sensitive_reads.sql`

See `migration-summary.md`'s own "IC-7 CLOSING PASS" section for the
full per-migration detail.

## New test files

- `apps/web/supabase/tests/110_ic7_security_write_boundary_test.sql` —
  `plan(25)`, 25/25 live. Covers scenarios A through T per the task's
  own required §35 coverage (GUC bypass before/after, forbidden header
  UPDATE, allowed reversal transition, line-mutation denial, cancel
  wrong-actor/no-permission/anon/spoof/NULL-actor, reservation/
  allocation/container raw-write denial, internal-helper EXECUTE
  denial, legitimate movement/reservation/allocation success).
- `apps/web/supabase/tests/111_ic7_closing_security_test.sql` —
  `plan(24)`, 24/24 live. Covers the closing pass's own 8 hardened
  functions: anon grant denial (A1-A8), intentionally-public pure
  utility unaffected (N1), actor-spoof/NULL-actor rejection (F1-F4,
  G1), no-permission-but-real-actor rejection (H1-H2, V1), legitimate
  operations with non-forgeable `created_by` (I1-I2, J1, K1),
  valuation-snapshot authz-boundary proof distinguishing "denied by
  design" from the disclosed pre-existing missing-relation bug (V2),
  a classification-based grant regression (not a hardcoded list), and
  a stale-overload check.

## Pre-existing test files corrected (3, discovered during the full

097-110 regression run, see `test-evidence.md` for the full account)

- `apps/web/supabase/tests/098_repair_order_line_reservation_phase10a_test.sql`
  — fixture-only: added `SET LOCAL ambra.inventory_movement_engine =
'on';` before the raw `inventory_balances` seed INSERT, required by
  IC-7's own NULL-comparison fail-open fix to `inventory_guard_
balance_write()`. No assertion changed. 17/17 after fix.
- `apps/web/supabase/tests/099_repair_order_line_allocation_phase10b_test.sql`
  — same fixture-only fix, applied at both of the file's own two raw
  `inventory_balances` seed INSERTs. No assertion changed. 20/20 after
  fix.
- `apps/web/supabase/tests/100_repair_order_container_orchestration_phase10c_test.sql`
  — the same fixture-only fix, PLUS two assertion corrections: T41/T42
  previously expected a direct raw UPDATE against a GENERIC
  (non-RepairOrder) container to succeed (1 row) — this was Phase 10C's
  own original, now-superseded expectation. IC-7 deliberately closed
  raw writes on `inventory_containers`/`_container_lines` for ALL
  rows, not just RepairOrder-owned ones (migration `20260917150706_
ic7_reservation_allocation_container_restrictive_rls.sql`, already
  documented in `write-boundary-matrix.md` as "Closed (newly safe
  post-IC-6)" before this regression run surfaced the stale
  assertions). T41/T42 now correctly expect 0 rows, with an inline
  comment recording the full history. 44/44 after both fixes.

## Documentation (done)

`docs/inventory/inventory-core-architecture.md` (new §9E section +
§9 table rows rewritten to CLOSED), `docs/inventory/inventory-core-
implementation-plan.md` (IC-7 DONE summary block), `docs/inventory/
inventory-core-progress.md` (runtime-status header, phase-tracker row,
and full change-log entry) — all 3 updated with this phase's own
findings.

## Review bundle

`docs/inventory/reviews/ic-7-review/` — this bundle itself (11 files:
`diff.patch`, `changed-files.md`, `review-context.md`, `migration-
summary.md`, `security-evidence.md`, `write-boundary-matrix.md`,
`function-grant-matrix.md`, `application-entry-point-matrix.md`,
`module-boundary-audit.md`, `compression-candidates.md`, `test-
evidence.md`; no `concurrency-evidence.md`, since no concurrency
behavior changed — confirmed, see `test-evidence.md`).

## Not touched this phase

- Every already-correctly-closed table/function from IC-1 through IC-6
  and IC-7A (branch transfers, RepairOrder attribution/projection
  tables, the movement engine's own core posting logic, reservation/
  allocation business math, container business math) — confirmed
  unchanged via the full regression run (see `test-evidence.md`).
- `inventory_reverse_movement`'s own body — read in full, confirmed
  unchanged (only its own DOWNSTREAM effect — the header trigger it
  writes through — was hardened).
- Every one of IC-7's own original 9 migrations/10 numbered security
  findings — the closing pass touched ZERO of them; the entire
  physical-stock-movement write boundary (reservations, allocations,
  containers, posted-header/line immutability, cancel/save-draft/
  reverse) remains exactly as IC-7 left it.
- Any TypeScript file, server action, or React component.
- IC-0 through IC-6A's own accepted business semantics — not reopened.
- `inventory_receive_purchase_order` (PO receiving) — not touched;
  only PO _creation_ was in this closing pass's own scope.
- The architecture-compression/simplification pass — not started.
