# Inventory Core — A7 Follow-Up Correction Pass — Changed Files

Baseline: HEAD `45074e8a` ("Inventory Core A7 domain-boundary
cleanup"), working tree clean before this pass.

## New migrations (3)

- `apps/web/supabase-target/supabase/migrations/20260922082042_a7_correction_extract_add_to_container_internal.sql`
  — adds `inventory_add_to_container_internal`, EXECUTE revoked from
  all roles including `service_role`.
- `apps/web/supabase-target/supabase/migrations/20260922082057_a7_correction_wrapper_calls_internal.sql`
  — redirects `repair_order_add_allocation_to_container`'s own nested
  call from `inventory_add_to_container` to
  `inventory_add_to_container_internal`.
- `apps/web/supabase-target/supabase/migrations/20260922082141_a7_correction_narrow_public_generic_eligibility.sql`
  — narrows the public `inventory_add_to_container` to add the
  domain-agnostic generic-eligibility gate before delegating to the
  internal helper.

## Modified test files (2)

- `apps/web/supabase/tests/114_a7_repairorder_container_boundary_test.sql`
  — scenario G2 flipped from asserting the old disclosed-tradeoff
  success to asserting `P0002` rejection (a direct call to the generic
  primitive against a RepairOrder-owned container is now rejected);
  J2's expected total corrected `11` -> `10` (G2 no longer contributes
  to `container_a`'s own contents); header comment extended. `plan(18)`
  unchanged. Live-verified 18/18.
- `apps/web/supabase/tests/100_repair_order_container_orchestration_phase10c_test.sql`
  — 5 scenarios (T2, T5, T9, T15, T30) changed from a direct
  `inventory_add_to_container(...)` call to
  `repair_order_add_allocation_to_container(...)`, discovered mid-pass
  as a previously-missed blast-radius gap (see `boundary-evidence.md`
  for the full reasoning). `plan(44)` unchanged — only the function
  called changed at 5 call sites. Live-verified 44/44.

## New test file (1)

- `apps/web/supabase/tests/115_a7_correction_generic_container_eligibility_test.sql`
  — `plan(14)`. Covers: internal-helper ACL lockdown (structural +
  functional proof), domain-agnostic eligibility rejection (both
  RepairOrder-owned and an arbitrary `reference_type='some_other_domain'`),
  partial-reference-state rejection (both directions), a genuinely
  generic container's continued success, check-ordering / non-leaking
  proof, atomicity, and wrapper sanity. Live-verified 14/14.

## Application code

**None.** Zero TypeScript files changed this pass (confirmed via
`git status`). `RepairOrdersService`'s own RPC call target
(`repair_order_add_allocation_to_container`) was already correct from
the A7 base pass — only the SQL-level nested-call target inside that
function changed, which is invisible to the TS caller's own contract.

## Review bundle (this directory, new)

- `review-context.md`
- `changed-files.md` (this file)
- `migration-summary.md`
- `test-evidence.md`
- `boundary-evidence.md`
- `diff.patch`
