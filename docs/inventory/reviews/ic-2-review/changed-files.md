# IC-2 — Changed Files

**Branch**: `zone3-zone5-integration-audit`.
**Baseline SHA**: `27d900071813c82cc7d6a20d97dadd42def21e8f` (commit `ic1` —
IC-1's own work, previously staged/uncommitted during this session, was
committed externally by the user partway through IC-2's own implementation.
IC-2's diff is cleanly isolated against this baseline — it contains ONLY
IC-2's own changes, no IC-1 content mixed in).
**Working tree at packaging time**: clean except the exact files listed
below (verified via `git status --short` immediately before packaging).

**Updated 2026-09-15 for the SECURITY-BOUNDARY CORRECTION PASS** — same
baseline SHA, not a new IC-3 bundle. Adds 2 new migrations and updates the
already-listed `103_...` test file and all 3 already-listed doc files (see
each row's own note below for what's new in this pass specifically).

## New files (10)

| File                                                                                                                                                            | Purpose                                                                                                                                                                                                                                                  |
| --------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `apps/web/supabase-target/supabase/migrations/20260915155606_ic2_seed_reversal_document_movement_type.sql`                                                      | Extends the per-org seeding function with the new `KOR` document type + `900` movement type; backfills all 4 existing orgs.                                                                                                                              |
| `apps/web/supabase-target/supabase/migrations/20260915160118_ic2_inventory_finalize_posting_explicit_effects.sql`                                               | Adds `p_explicit_effects` optional parameter to `inventory_finalize_posting`.                                                                                                                                                                            |
| `apps/web/supabase-target/supabase/migrations/20260915160414_ic2_inventory_reverse_movement_rpc.sql`                                                            | The new `inventory_reverse_movement` RPC (first version).                                                                                                                                                                                                |
| `apps/web/supabase-target/supabase/migrations/20260915160444_ic2_drop_old_finalize_posting_overload.sql`                                                        | Corrective: drops the stale 2-arg `inventory_finalize_posting` overload.                                                                                                                                                                                 |
| `apps/web/supabase-target/supabase/migrations/20260915160902_ic2_inventory_reverse_movement_fix_p0004_reserved_code.sql`                                        | Corrective: `P0004`→`P0007` (P0004 is a Postgres-reserved condition name).                                                                                                                                                                               |
| `apps/web/supabase-target/supabase/migrations/20260915161137_ic2_reverse_movement_zone5_attribution_guard.sql`                                                  | Corrective: GUC-gates the reversal against Zone 5's own attribution-sync trigger.                                                                                                                                                                        |
| `apps/web/supabase-target/supabase/migrations/20260915162826_ic2_reverse_movement_regrant_after_default_privilege_reapply.sql`                                  | Corrective: re-hardens EXECUTE grants (`anon` had been silently re-exposed).                                                                                                                                                                             |
| `apps/web/supabase-target/supabase/migrations/20260915170706_ic2_security_internalize_explicit_effects.sql` **(NEW, security-boundary pass)**                   | Creates `inventory_finalize_posting_internal` (EXECUTE revoked from all ordinary roles) with 2 defense-in-depth checks; restores public 2-arg `inventory_finalize_posting`; updates `inventory_reverse_movement` to call the internal function directly. |
| `apps/web/supabase-target/supabase/migrations/20260915170726_ic2_drop_vulnerable_public_named_three_arg_finalize_posting.sql` **(NEW, security-boundary pass)** | Corrective: drops the still-live vulnerable 3-arg public-named overload (same arity-overload pitfall as defect #1, recurred and caught again).                                                                                                           |
| `apps/web/supabase/tests/103_ic2_movement_reversal_test.sql`                                                                                                    | pgTAP file, 28/28 originally, **extended to 35/35 this pass** — receipt reversal, 801 reversal, all negative paths, IC-1 commitment block, plus new Scenario E (T29-T35) proving the P0 fix.                                                             |

## Modified files (3)

| File                                                   | Change                                                                                                                                                                                                                                                                                                                                                                        |
| ------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `docs/inventory/inventory-core-architecture.md`        | §0 gained decisions #21/#22 (product decisions A/B); §5 invariant #15 now ✅ IMPLEMENTED, invariant #13 wording corrected this pass; §7 rewritten from design to as-implemented, "never edited" wording corrected with full precision this pass; §9 gained 2 new IC-7 items originally, `inventory_movement_headers` row sharpened + 1 new row (the P0 fix itself) this pass. |
| `docs/inventory/inventory-core-implementation-plan.md` | IC-2 section gained a RESULT addendum (original plan preserved as historical record); **extended this pass** with the security-boundary correction findings (appended, not rewritten).                                                                                                                                                                                        |
| `docs/inventory/inventory-core-progress.md`            | Runtime status → IC-2 DONE; new phase-tracker row; full IC-2 change-log entry; **new dated change-log entry appended this pass** for the security-boundary correction.                                                                                                                                                                                                        |

## No changes to

- `inventory_create_reservation`, `inventory_release_reservation`,
  `inventory_create_allocation`, `inventory_release_allocation` — untouched.
- Every Phase 10C container RPC — untouched.
- `repair_order_line_locations`, any Zone 5 RPC, the Zone 5 attribution
  trigger itself — untouched (the reversal RPC works around it via an
  existing GUC, never modifying Zone 5 code).
- QR, container relocation, branch-transfer rebuild, receiving
  consolidation, WZ/201, movement code 311 — none in scope, none touched.
- Any TypeScript application code — IC-2 is entirely PL/pgSQL + pgTAP +
  documentation; no service, action, or hook required a change.
- `RepairOrdersService.listRepairOrderLines()`'s own received/issued/
  outstanding/available formulas — untouched (product decision B).

## Diff summary

13 files changed, 2614 insertions(+), 60 deletions(-) against the same
baseline `27d900071813c82cc7d6a20d97dadd42def21e8f`. Full unified diff in
`diff.patch` (180,332 bytes).
