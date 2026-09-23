# IC-1 — Changed Files

Branch: `zone3-zone5-integration-audit`. Baseline: HEAD at the start of the
IC-1 implementation turn (`docs/inventory/inventory-core-progress.md` showed
IC-0 planning-only as the last committed state). This file now also covers
the same-day correction pass (external review + `negative_stock_policy`
conflict investigation) AND the subsequent finalization pass (product-owner
decision: OPTION A) — all against the **same IC-1 baseline**. No new IC-2
bundle was created, per explicit instruction.

## Finalization-pass files (modified — product-owner decision recorded, no migration)

| File                                                                    | Change                                                                                                                                                                                                  |
| ----------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `docs/inventory/inventory-core-architecture.md`                         | New closed decision #20 (§0) recording the product-owner decision verbatim; §5 invariant #1 row updated to "ALWAYS, with no exception" and cites the decision.                                          |
| `docs/inventory/inventory-core-implementation-plan.md`                  | **New this pass** (not listed in earlier bundle versions). IC-6 (Legacy Writer/Helper Removal) scope gained one item: retiring `negative_stock_policy`'s dead `'allow'`/`'allow_with_approval'` values. |
| `docs/inventory/inventory-core-progress.md`                             | Runtime status → IC-1 fully FINAL; new finalization-pass change-log entry recording the product decision, evidence, and full regression.                                                                |
| `apps/web/supabase/tests/102_ic1_reserved_only_hard_invariant_test.sql` | Extended with Scenario C (T7-T14, plan 6→14): the FINAL, permanent regression proving `negative_stock_policy` cannot bypass the hard invariant for either `'allow'` or `'block'`. Live-verified 14/14.  |
| `docs/inventory/reviews/ic-1-review/negative-stock-policy-conflict.md`  | Marked **RESOLVED** with the product-owner decision and date; original investigation preserved below as historical record.                                                                              |
| `docs/inventory/reviews/ic-1-review/review-context.md`                  | Update notice revised: IC-1 is now fully final, no open questions remain.                                                                                                                               |
| `docs/inventory/reviews/ic-1-review/test-and-concurrency-evidence.md`   | pgTAP/Vitest tables updated (133→141 total; 102 6/6→14/14); diagnostic section reframed as the final, permanent regression.                                                                             |
| `docs/inventory/reviews/ic-1-review/changed-files.md`                   | This file.                                                                                                                                                                                              |
| `docs/inventory/reviews/ic-1-review/diff.patch`                         | Regenerated to include all changes across all three passes.                                                                                                                                             |

**No migration was applied.** The already-applied CHECK and P0003 invariant
already implemented the product-owner's chosen contract exactly.
`migration-summary.md` remains unchanged — it still accurately describes the
3 migrations that were, and remain, the only ones applied for IC-1.

## Correction-pass files (new, this pass — no migration applied)

| File                                                                   | Purpose                                                                                                                            |
| ---------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------- |
| `docs/inventory/reviews/ic-1-review/negative-stock-policy-conflict.md` | Full investigation of the `negative_stock_policy` conflict; evidence; proposed corrections per outcome; not resolved unilaterally. |

## Correction-pass files (modified, this pass)

| File                                                                                                   | Change                                                                                                                                                                                                                                                                                                                                                                                             |
| ------------------------------------------------------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `docs/inventory/inventory-core-progress.md`                                                            | Corrected "235/235" → "395/395" test-count drift; IC-1 phase-tracker row marked "accepted core, one open contract question"; new change-log entry for this pass, including the receiving-location fixture finding below.                                                                                                                                                                           |
| `docs/inventory/reviews/ic-1-review/review-context.md`                                                 | Added an update notice at the top pointing to the new conflict file.                                                                                                                                                                                                                                                                                                                               |
| `docs/inventory/reviews/ic-1-review/test-and-concurrency-evidence.md`                                  | Added the `negative_stock_policy` live diagnostic section (allow vs. block, both P0003).                                                                                                                                                                                                                                                                                                           |
| `docs/inventory/reviews/ic-1-review/changed-files.md`                                                  | This file — updated to describe the correction pass.                                                                                                                                                                                                                                                                                                                                               |
| `docs/inventory/reviews/ic-1-review/diff.patch`                                                        | Regenerated to include all of this pass's changes.                                                                                                                                                                                                                                                                                                                                                 |
| `apps/web/supabase/tests/101_zone3_zone5_movement_engine_reserved_blindspot_characterization_test.sql` | **Test-fixture robustness fix** (not a logic/invariant change): now creates its own fresh, isolated branch instead of reusing the shared org/branch pair, which IC-1's own genuine concurrency test permanently left with a real, non-zero-balance receiving-location residual (see `negative-stock-policy-conflict.md`'s sibling note in the progress doc's change log). Re-verified live: 17/17. |
| `apps/web/supabase/tests/102_ic1_reserved_only_hard_invariant_test.sql`                                | Same fresh-branch fixture fix. Re-verified live: 6/6.                                                                                                                                                                                                                                                                                                                                              |

No migration was applied this pass. No `inventory_finalize_posting` change.
No CHECK constraint change. `migration-summary.md` is unchanged from the
original IC-1 submission — it describes the 3 migrations already applied and
accepted; nothing new to add since none were applied this pass.

---

## Original IC-1 submission (unchanged, for reference)

## New files (5)

| File                                                                                                                    | Purpose                                                                                               |
| ----------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------- |
| `apps/web/supabase-target/supabase/migrations/20260915062211_ic1_inventory_balances_on_hand_nonnegative_check.sql`      | Adds `inventory_balances_on_hand_nonnegative` CHECK constraint.                                       |
| `apps/web/supabase-target/supabase/migrations/20260915062244_ic1_inventory_finalize_posting_hard_invariant.sql`         | `CREATE OR REPLACE` on `inventory_finalize_posting`: balance-helper replacement + new hard invariant. |
| `apps/web/supabase-target/supabase/migrations/20260915062422_ic1_inventory_finalize_posting_fix_ambiguous_overload.sql` | Same-day forward fix for a genuine `42725` overload-ambiguity bug in the prior migration.             |
| `apps/web/supabase/tests/102_ic1_reserved_only_hard_invariant_test.sql`                                                 | New pgTAP file: proves the hard invariant protects reserved-only (zero-allocation) stock. 6/6.        |
| `docs/inventory/reviews/ic-1-review/` (this directory)                                                                  | Review bundle.                                                                                        |

## Modified files (3)

| File                                                                                                   | Change                                                                                                                                                  |
| ------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `apps/web/supabase/tests/101_zone3_zone5_movement_engine_reserved_blindspot_characterization_test.sql` | Rewritten: expectations inverted (the old blind-spot SUCCESS case is now a REJECTION proof), plus a new valid-movement control case. 11→17 assertions.  |
| `docs/inventory/inventory-core-architecture.md`                                                        | §5 invariant #1, #6 rows and §6's default-rule formula/rationale corrected to the verified SUM formula (see `review-context.md` for why this mattered). |
| `docs/inventory/inventory-core-progress.md`                                                            | IC-0 phase-tracker row/notes finalized; IC-1 phase-tracker row and full change-log entry added; header status updated.                                  |

## No changes to

- `inventory_create_reservation`, `inventory_release_reservation`,
  `inventory_create_allocation`, `inventory_release_allocation` (untouched,
  per explicit hard scope boundary).
- Any Phase 10C container RPC.
- `repair_order_line_locations`, `ambra-location-inventory.ts`, movement code
  311, branch-transfer RPCs, reversal, receiving consolidation, QR, container
  relocation, WZ/201 — none in scope for IC-1, none touched.
- Any TypeScript application code. IC-1's fix is entirely inside
  `inventory_finalize_posting`'s own PL/pgSQL body; no service, action, or
  hook required a change.

See `diff.patch` in this directory for the complete unified diff.
