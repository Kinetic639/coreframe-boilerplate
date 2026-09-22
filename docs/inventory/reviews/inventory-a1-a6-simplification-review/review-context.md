# Inventory Core — A1–A6 Simplification Pass — Context

**Scope**: exactly the 6 SAFE simplification items from the architecture
compression review's own `simplification-plan.md` (A1–A6). IC-0 through
IC-7, the IC-7 closing pass, the architecture compression review, and
PRE-IC8 P0 are accepted and final, not reopened. A7 and A8 (each their
own, larger, separately-scheduled pieces of work per the plan's own
explicit instruction) are NOT started. IC-8 and Phase 10D are NOT
started. No Inventory Core business semantics, no movement/reservation/
allocation/transfer/reversal behavior, and no RepairOrder projection
architecture were touched.

## Starting state

- Branch: `zone3-zone5-integration-audit`.
- HEAD at start: `96faa009` ("ic7-closing, architecture compression
  review, pre-ic8-p0") — **verified committed**, working tree clean
  (`git status --porcelain` returned 0 lines) before any edit this pass.
  This satisfies the task's own explicit precondition ("If the accepted
  state is still uncommitted: STOP and report that clearly") — it was
  not, so work proceeded.
- A7: confirmed not started (`repair_order_add_allocation_to_container`
  does not exist anywhere in the repo).
- A8: confirmed not started (no docs/migrations reference removing the
  RepairOrder incremental projection).
- IC-8: confirmed not started (no `docs/inventory/reviews/*ic8*` or
  `*ic-8*` bundle exists — only `pre-ic8-guc-boundary-correction-review`,
  which is a prior, already-accepted, differently-scoped pass).
- Phase 10D: confirmed not started (no matching docs/migrations).

## Source of truth re-read in full before implementing

`docs/inventory/reviews/inventory-architecture-compression-review/`:
`simplification-plan.md`, `service-boundary-review.md`, `dry-review.md`,
`rpc-helper-trigger-review.md`, `module-boundary-review.md`,
`final-proposed-architecture.md`.

**Two stale claims caught by live re-verification, not blindly trusted**:

1. `simplification-plan.md`/`service-boundary-review.md` both name
   `releaseReservationForLine`, `allocateForLine`, and
   `placeAllocationInContainer` as the 3 sites sharing A2's duplicated
   ownership check. Live re-inspection found this is **not accurate as
   of this pass**: the byte-identical `belongsToThisLine` check (an
   `inventory_reservations` row's `organization_id`/`branch_id`/
   `reference_type`/`reference_id` compared against scope +
   `repairOrderLineId`) exists ONLY in `releaseReservationForLine` and
   `allocateForLine`. `placeAllocationInContainer` has a structurally
   different check (`belongsToThisRepairOrder`, comparing an
   `inventory_containers` row's `reference_type`/`reference_id` against
   `scope.repairOrderId` — a different table, different fields, different
   semantics). A THIRD, similar-but-not-identical pattern (checking
   `inventory_allocation_container_links` via Set-membership, not
   reference-type/id equality) exists in `removeAllocationFromContainer`
   — a method never mentioned by the task or the audit doc at all. See
   `simplification-evidence.md` for the full analysis and why only the
   genuinely byte-identical 2 sites were merged.
2. No second stale-line-number issue was found for A1/A3/A4/A6 — those
   matched live code exactly once re-verified (see
   `simplification-evidence.md` for each item's own live re-confirmation
   evidence).

## What this pass did, in order

1. Verified starting state (above) — clean, committed baseline.
2. Re-read all 6 source docs in full; re-ran every caller search live
   rather than trusting stale line numbers (per the task's own explicit
   instruction).
3. **A1**: re-confirmed all 6 dead-code candidates live (repo grep in
   both `apps/web`/`apps/public-web`, zero dynamic `.rpc()` risk,
   zero test references) — all still genuinely dead, no new caller had
   appeared. Removed 2 TS service methods, 3 dead server actions (the
   whole `apps/web` action file was deleted since 100% of its remaining
   content was dead once those 3 were gone; `apps/public-web`'s copy was
   surgically trimmed since it also hosts 4 unrelated, still-referenced,
   deliberately-not-fixed legacy actions from the PRE-IC8 P0 pass's own
   disclosed decision), and 1 SQL function (`DROP FUNCTION`, one forward
   migration). A pre-existing, already-accepted test file
   (`111_ic7_closing_security_test.sql`) required one disclosed forward
   correction (see `changed-files.md`).
4. **A2**: extracted the genuinely-duplicated ownership check (2 sites,
   not 3 — see above) into one private helper, `belongsToRepairOrderLine`.
   Pure predicate, no error message, no side effect — each call site
   keeps its own (already-different) failure message unchanged.
5. **A3**: extracted the 5 duplicated `normalize*RpcError` functions'
   identical 4-line matching shape into one generic
   `normalizeKnownRpcError(error, knownErrors)`; each of the 5 named
   functions becomes a 4-line wrapper preserving its own fallback
   message and call signature — zero call-site changes anywhere.
6. **A4**: live-confirmed pre-fix grant state, live-confirmed exactly 6
   real callers (all `SECURITY DEFINER` owned by `postgres`, same-owner
   nesting), live-confirmed zero real TS/application callers. Applied
   one forward migration revoking `authenticated`/`PUBLIC`/`anon`
   EXECUTE on `inventory_get_or_create_balance_for_update`. Live-proved
   both directions: a direct `authenticated` call now denied (`42501`),
   a representative canonical caller (`inventory_create_reservation`)
   still succeeds end-to-end.
7. **A5**: compared all 3 candidate rollup implementations line-by-line.
   Found genuine, material semantic differences (which fields are
   summed, and — critically — `enrichProducts` sums org-wide when no
   `branchId` is given while `listVariantOptions` returns zero for
   everything in the same case). Per the task's own explicit rule,
   **REJECTED** — zero code changes to any of the 3 methods.
8. **A6**: moved the 7 confirmed catalog-domain methods from
   `InventoryEnterpriseService` to `InventoryProductsService`, byte-for-
   byte except swapping the shared `errorMessage` helper for a local
   copy (required — `errorMessage` stays in `InventoryEnterpriseService`
   too, since ~25 other, non-catalog methods there still depend on it).
   Updated all 7 real call sites (one action file) and the one dedicated
   test file for `updateVariantDetails`.
9. Ran relevant Vitest (6 files, 218 tests, all passing), `pnpm
type-check` (clean), `pnpm lint` (0 errors, 319 pre-existing
   warnings, unchanged baseline).
10. Wrote one new, narrow pgTAP file (`113_a1_a4_simplification_security_
test.sql`, plan(7)) proving A1's DROP and A4's REVOKE, both
    directions, live. Self-caught and fixed a bug in the first draft
    (a top-level `PERFORM` instead of `SELECT`, and a `plan(8)`/7-
    assertion mismatch) before trusting the result.
11. Ran the full 097–113 pgTAP regression (17 files) — see
    `test-evidence.md`.
12. Ran `pnpm build` — clean.
13. Ran `git diff --check` — caught and fixed one genuine trailing-
    blank-line issue in the `apps/public-web` action file (a failed
    `python3`-based trim attempt earlier in the pass, corrected with a
    working `sed` command) before the final, clean check.

## Bundle contents

- `review-context.md` (this file)
- `changed-files.md` — full file-by-file change list
- `migration-summary.md` — both migrations' full detail
- `test-evidence.md` — full regression + Vitest + static-gate results
- `simplification-evidence.md` — the A1–A6 per-item evidence, including
  A2's stale-claim correction and A5's rejection reasoning
- `diff.patch` — the complete diff against baseline (HEAD `96faa009`)
