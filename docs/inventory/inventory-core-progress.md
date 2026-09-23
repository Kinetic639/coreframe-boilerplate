# Inventory Core — Progress Tracker

> Live execution tracker. Source of truth for the target architecture:
> `inventory-core-architecture.md`. Source of truth for the planned work:
> `inventory-core-implementation-plan.md`. This file is updated continuously
> as IC work happens — not batched at the end of a session, matching this
> project's own established Zone 3 tracker convention.

**Scope:** Inventory Core consolidation (cross-cutting base-engine work,
distinct from Zone 3's own Phase 10A-10F numbering).
**Priority:** P0 (blocks Phase 10D).
**Branch:** `zone3-zone5-integration-audit`.
**Architecture:** ✅ ACCEPTED (this session — `inventory-core-architecture.md`).
**Runtime status:** 🟢 IC-0 ✅ DONE. IC-1 ✅ DONE AND FINAL. IC-2 ✅ DONE —
`inventory_reverse_movement` implemented, live-proven (receipt + 801
reversal, all negative paths, genuine two-session concurrency), both open
product decisions closed (A: no undo-an-undo; B: no RepairOrder netting).
IC-3 ✅ DONE — canonical `inventory_receive_stock` primitive implemented;
`receive_repair_order_stock` refactored onto it; `inventory_receive_
purchase_order` (live-confirmed dead/broken before this phase) fixed and
refactored onto it. A new CRITICAL, pre-existing security finding (fully
unauthenticated `anon` posting via the raw engine layer) was discovered
and assigned to IC-7 as its top-priority item — NOT fixed in IC-3.
**IC-7A ✅ DONE** — emergency pass, pulled forward out of roadmap order,
closing exactly that CRITICAL finding: `inventory_create_draft`/public
`inventory_finalize_posting`/`inventory_create_and_finalize` hardened
with actor-identity + permission checks; `anon`/PUBLIC EXECUTE revoked;
`authenticated`/`service_role` kept (required by the real caller graph).
Post-fix exploit replay confirms the exact original attack now rejected.
The broader IC-7 phase remains fully OPEN and unaffected.
**IC-4 ✅ DONE** — Branch Transfer / MMJ rebuild. Closed product-owner
decision implemented exactly: `in_transit` now means the goods have
physically left the source branch (a real posted movement), never
merely reserved. New `prepared` pre-shipment status; new `inventory_
send_branch_transfer`/`inventory_cancel_branch_transfer` RPCs; `inventory_
accept_branch_transfer`/`inventory_decline_branch_transfer` fully
rebuilt (both were hand-writing balances/ledger directly, bypassing the
canonical engine, in addition to `accept`'s already-known crash); a
genuinely new, previously undisclosed `anon`-EXECUTE + unchecked-actor
finding closed on all 5 branch-transfer RPCs; movement type `311`
redefined (zero live rows, system-managed) and new `312` seeded; new
`inventory_branch_transfer_discrepancies` table for persisted partial-
receipt shortfalls; raw-write RLS closed on both transfer tables.
**IC-5 ✅ DONE** — RepairOrder physical-location projection
consolidation. The Zone-5 projection (`repair_order_line_locations` +
`repair_order_location_attribution_uncertain`) now has ONE coherent
derivation from canonical ledger truth (A) plus business attribution
(B, `repair_order_line_movement_links`): an incremental fast path
(existing trigger + `attach_repair_order_line_movement`, both now
projection-consistent) and a new authoritative deterministic rebuild
(`rebuild_repair_order_projection_bucket_internal` +
public `rebuild_repair_order_location_projection` RPC), proven equal by
construction for reversal and empirically equal for every other tested
scenario. Reversal is now projection-aware (mirrors attribution links,
calls the rebuild primitive, handles split-attribution reversal
correctly) while `inventory_reverse_movement` itself remains fully
RepairOrder-agnostic and untouched. Two genuinely new, previously
undisclosed gaps were found and closed: `attach_repair_order_line_
movement` had no projection sync at all (fixed, guarded against
double-write via the existing authoritative GUC); `putaway_repair_
order_stock`'s own relocations were invisible to the ledger-join
rebuild formula (fixed via a new `relocation` link type). The IC-2 GUC
(`ambra.repair_order_attribution_authoritative`) is retained (not
removed) but its own staleness side-effect is eliminated — reversal no
longer merely "skips" projection updates, it correctly rebuilds them.
`CHECK (quantity >= 0)` added; over-attribution/negative-rebuild
hard-errors `P0008`, never clamped. Raw writes closed on both
projection tables (explicit RESTRICTIVE deny policies). Both live-caught
regressions from the original pass (found via the full suite itself,
not the new file) were self-diagnosed and fixed same session.
**IC-5 NARROW CORRECTION PASS (2026-09-16, same day)** — external review
found a BLOCKER (reversed putaway rebuilt the wrong projection bucket
set, leaving the source/receiving bucket stale after reversal — fixed
by deriving both affected buckets from the reversal movement LINE's own
`source_location_id`/`destination_location_id`, never from `NEW.
direction`/`NEW.location_id`) and a false documentation claim ("attach
is the sole writer" — after the original pass, `putaway_repair_order_
stock` and the reversal trigger were ALSO direct writers; fixed by
centralizing all three behind one new internal canonical primitive,
`write_repair_order_line_movement_link_internal`, with the public
attach contract frozen to `receipt`/`issue` only). New pgTAP Scenarios
Q/R/S/T (`107_...` 33/33 → 46/46). Full regression 097-107 re-run
(097 specifically re-run in full), 382/382, 0 failures.
**IC-6 ✅ DONE** — Legacy Writer/Helper Removal. Every candidate named
in the phase's own scope (decisions #9/#10/#11) plus everything
surfaced by the required call-graph audit was classified via the
"four evidence sources" discipline before deletion. Dropped:
`inventory_v1_get_or_create_balance`; the stale 5-arg `inventory_get_
or_create_balance_for_update` overload; `inventory_settings.negative_
stock_policy` (Option A, full column drop, proven structurally
UNREACHABLE not merely unused); `ambra-location-inventory.ts`'s 4 dead
write actions (`createLocationContainerAction`, `addItemsToContainer
Action`, `removeItemFromContainerAction`, `relocateContainerAction` —
zero callers, confirmed a third independent time this phase after an
initial DRAFT wrongly judged the file "active/required" based on an
unverified memory; corrected mid-phase via a fresh caller-trace).
Legacy movement/numbering-helper audits (§6/§7) confirmed already-clean.
GUC audit (§10) retained both `ambra.inventory_movement_engine` and
`ambra.repair_order_attribution_authoritative` — the known posted-
header GUC bypass is explicitly left for full IC-7, not patched here.
A genuine regression was surfaced by the full-suite rerun (pgTAP
`102_...`'s own Scenario C directly referenced the dropped column) and
fixed by editing the TEST FILE (not a migration) to remove the now-
meaningless two-policy comparison. New dedicated pgTAP file `108_ic6_
legacy_cleanup_test.sql` (23/23) proves the cleanup boundaries.
`ambra-location-inventory.ts`'s remaining 3 functions are also dead but
deliberately retained (out of this phase's narrow balance/ledger-writer
charter). See `inventory-core-architecture.md` §9D and `docs/inventory/
reviews/ic-6-review/` for the full dead-path matrix and evidence.
**IC-6A ✅ DONE** — Opening Stock Active-Path Repair (narrow pre-IC-7
correctness pass). IC-6 had discovered a live, active bug: `Inventory
ProductsService.createOpeningStockMovement` (reachable from the ACTIVE
`createEnhancedProduct` path whenever a new variant has `opening_
quantity > 0`) called two RPCs that do not exist live (`inventory_
create_draft_movement`, `inventory_post_movement`). Fixed by moving
this one caller onto the canonical `inventory_create_and_finalize`
entry point, movement type `401` ("Inventory Count Adjustment
(Increase)" — the only seeded, active, manually-postable type whose
own location requirements match opening stock's destination-only
shape; no new type was seeded). No migration required (the canonical
capability already existed live). Actor/permission behavior was
verified already-correct at the action layer (`WAREHOUSE_INVENTORY_
OPERATE`, an exact match to one of the two permissions the canonical
RPC itself checks) and left unchanged. New pgTAP `109_ic6a_opening_
stock_repair_test.sql` (16/16) proves the exact new call shape live —
before/after balance, exactly-one-movement/exactly-one-ledger-entry,
actor/audit metadata, and retry/idempotency safety (same idempotency
key posted twice never double-applies the quantity). 5 new Vitest
scenarios cover zero-quantity skip, correct RPC shape, error
propagation + compensating cleanup, multi-variant independence, and
variant-identity correctness under mixed zero/nonzero quantities. Full
097-108 regression re-run clean (402/402); `105_ic7a_...` (29/29)
re-confirms the hardened entry point remains closed to anon/no-
permission/spoofed-actor callers for this exact call path.
`createEnhancedProductLegacy` (confirmed dead, unrelated product-
creation scope) deliberately NOT touched, per this pass's own narrow
"ACTIVE createEnhancedProduct path" charter. See `docs/inventory/
reviews/ic-6a-opening-stock-repair-review/` for full evidence.
**IC-7 ✅ DONE** — Inventory Security / Write-Boundary Closure +
Module-Boundary Audit. Closed every remaining raw-write gap
architecture doc §9's own table listed as open (reservation/allocation/
generic-container raw writes, the posted-header GUC bypass, the
status-blind movement INSERT gap), plus 3 genuinely new CRITICAL
findings this phase's own live audit discovered: (1) a systemic
NULL-comparison bug meant `inventory_guard_balance_write`/`inventory_
guard_settings_write` failed OPEN by default for any session that
never touched the GUC at all — more severe than the already-known
GUC-bypass, since no special knowledge was required; (2) `inventory_
cancel_movement`/`inventory_save_draft`/`inventory_reconcile_balances`
all carried live `anon` EXECUTE with zero actor/permission checks —
fully unauthenticated, cross-tenant exploitable; (3) the 4 reservation/
allocation RPCs were `SECURITY INVOKER` (not DEFINER) with no
actor-identity check, discovered while applying the reservation/
allocation RESTRICTIVE RLS fix (their own INVOKER status meant the new
RLS would have blocked their own legitimate writes too) — converted to
SECURITY DEFINER in the same phase. The posted-header GUC
"authorization" was redesigned, not patched: the GUC is now removed
entirely as an authorization signal — the immutability trigger
validates the SUBSTANCE of any change (an exact, structurally-verified
reversal-lifecycle delta, double-linked to a genuine, unforgeable
system-reversal row) instead. A live default-privilege audit (going
further than IC-7A's own deferred investigation) confirmed changing
the schema-wide `anon` default is unsafe (dozens of unrelated,
legitimately-public modules depend on it) — Option B chosen (per-
function explicit REVOKE + an enforced pgTAP grant sweep). A module-
boundary audit confirmed generic Inventory Core does not depend on
RepairOrder/PurchaseOrder business logic (one narrow, disclosed,
non-security exception), and the application's own entry-point shape
is already correct (zero action-layer RPC bypass, zero duplicate entry
points). 9 forward migrations, all live-verified; new pgTAP `110_ic7_
security_write_boundary_test.sql` (25/25); full regression 097-110.
See `docs/inventory/reviews/ic-7-review/` for full evidence.
**Current phase:** IC-7 DONE → A1-A8 (simplification + domain-boundary
cleanup) DONE → IC-8 (Final Production Readiness Gate) DONE, verdict
REPRODUCIBILITY BLOCKED → **Inventory Core Final Pilot Freeze (2026-09-23)
DONE**. See `docs/inventory/reviews/inventory-a1-a6-simplification-review/`,
`docs/inventory/reviews/inventory-a7-repairorder-container-boundary-review/`,
`docs/inventory/reviews/ic-8-final-production-readiness-review/`, and
`docs/inventory/reviews/inventory-core-final-pilot-freeze/` for full
evidence of each. **Inventory Core architecture is now FROZEN — no further
IC phases are planned.** Phase 10D remains NOT started; this closing pass
did not start it and does not authorize starting it.
**Pitch/pilot readiness:** **INVENTORY CORE FINAL FOR PILOT / ARCHITECTURE
FROZEN.** Architecture final, live correctness/security/regression
verified, application integration may continue. Clean-room reproducibility
is accepted technical debt, deferred (NOT a pilot/pitch blocker — see
architecture decision #23 above and `docs/inventory/reviews/inventory-
core-final-pilot-freeze/accepted-technical-debt.md`). This unblocks Phase
10D / pitch work to proceed on its own separate track (see the Zone 3
tracker's own cross-reference) — this doc does not itself authorize
starting that work.
**Last updated:** 2026-09-23 (Inventory Core Final Pilot Freeze).

---

## Overall execution

- IC phases completed: 8 / 8 (IC-0, IC-1, IC-2, IC-3, IC-4, IC-5, IC-6,
  IC-7), plus the out-of-order IC-7A emergency pass and the narrow
  IC-6A correctness pass (opening-stock active-path repair). IC-8 NOT
  started.
- 3 forward migrations applied for IC-1; 9 forward migrations applied for
  IC-2 (7 original + 2 from the security-boundary correction pass); 4
  forward migrations applied for IC-3; 4 forward migrations applied for
  IC-7A; 14 forward migrations applied for IC-4 (12 original + 2 from
  the narrow correction pass); 17 forward migrations applied for IC-5
  (6 original + 5 self-caught correction/fix migrations + 6 from its own
  narrow correction pass); 4 forward migrations applied for IC-6 (function
  fix, column drop, stale-overload drop, dead-helper drop) — all
  live-verified, all mirrored locally under the exact live
  version/timestamp — see change log.
- Application code: no TypeScript changes were required for IC-1, IC-2,
  IC-3, IC-7A, or IC-5 (all entirely PL/pgSQL). IC-4 required TypeScript
  changes (service methods, action layer, Zod schemas, event registry —
  no UI), per its own explicit scope. IC-6 required one TypeScript
  deletion (`ambra-location-inventory.ts`, 618 → 218 lines — 4 confirmed-
  dead write actions removed; `pnpm build` re-run clean, required since
  this was the first application/action TypeScript change since IC-4). 2
  pgTAP test files added/rewritten for IC-1 (`101_...` rewritten,
  `102_...` new/extended, then narrowed again by IC-6 after the
  `negative_stock_policy` column it referenced was dropped — see IC-6's
  own change-log entry); 1 new pgTAP file for IC-2, extended in the
  security-boundary correction pass (`103_...`, 35/35, its own Scenario E
  repositioned by IC-7A — see below); 1 new pgTAP file for IC-3
  (`104_...`, 44/44), plus one genuine two-PostgreSQL-connection
  concurrency proof performed outside pgTAP; 1 new pgTAP file for IC-7A
  (`105_...`, 29/29); 1 new pgTAP file for IC-4, extended in its own
  narrow correction pass (`106_...`, 60/60 → 87/87), plus three genuine
  two-PostgreSQL-connection concurrency proofs (double-send,
  double-accept, accept-vs-generic-movement contention); 1 new pgTAP
  file for IC-5, extended in its own narrow correction pass (`107_...`,
  33/33 → 46/46) — no dedicated concurrency test performed (structural
  lock-path argument instead, see change log); 1 new pgTAP file for IC-6
  (`108_ic6_legacy_cleanup_test.sql`, 23/23) — a dedicated cleanup-
  boundary test, not a business-workflow retest, per IC-6's own narrow
  scope; no new concurrency test (pure code removal, no new locking
  behavior).

---

## Phase tracker

| Phase                                                                | Status         | Notes                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          |
| -------------------------------------------------------------------- | -------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| IC-0 Architecture contract + baseline capture                        | ✅ DONE        | Live verification closed 2026-09-15 — see change log for the exact findings. Gate decision: no contradiction with the accepted architecture; two genuine raw-write gaps found (reservation/allocation tables, movement headers) but neither defeats IC-1's own guarantee — both recorded as IC-7 blockers, not IC-1 blockers.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                  |
| IC-1 Canonical movement engine / hard stock invariants               | ✅ DONE, FINAL | Hard invariant (`on_hand >= reserved_quantity + allocated_quantity`) live-implemented in `inventory_finalize_posting`, SQLSTATE `P0003`. Balance-getter replaced (v1 helper now zero production callers). `on_hand_quantity >= 0` CHECK added — **product-owner FINAL DECISION (2026-09-15, OPTION A)**: global non-negative on-hand is the permanent product contract; `negative_stock_policy='allow'`/`'allow_with_approval'` are superseded/deprecated for on-hand behavior, cannot bypass the invariant, column cleanup owned by IC-6. 133/133 pgTAP (102 extended to 14/14 with the finalized-contract regression) + 395/395 relevant Vitest clean (229 of those 395 re-confirmed live this finalization pass; the file set is identical to the original submission's own 395, not additive). Genuine two-session concurrency proven (3.68s real blocking). Architecture doc §0 (new decision #20) and §5 (invariant #1) updated. See the finalization-pass change-log entry below and `docs/inventory/reviews/ic-1-review/negative-stock-policy-conflict.md` (marked RESOLVED).                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          |
| IC-2 Movement reversal                                               | ✅ DONE        | `inventory_reverse_movement(p_movement_id, p_actor_user_id, p_reason)` implemented and live-proven: receipt (101) and two-leg (801) reversal restore exact pre-movement balances; all negative paths (draft, already-reversed, reversal-of-reversal, IC-1 commitment block, reason validation, wrong actor, cross-org/no-permission indistinguishable) rejected with stable SQLSTATEs; genuine two-session concurrency proven (~5s real blocking, exactly one reversal survives, zero double-compensation); bidirectional linkage and distinct sequential `KOR/...` document numbering live-proven. New minimal movement type `900`/doc type `KOR` (system-only, zero effect rows of its own); `inventory_finalize_posting` gained one backward-compatible optional parameter (`p_explicit_effects`). Product decisions A (no undo-an-undo) and B (no RepairOrder netting) CLOSED. 3 live-caught defects fixed forward (overload ambiguity, reserved SQLSTATE P0004, Zone 5 attribution corruption) plus 1 grant-hardening fix (anon default-privilege re-exposure). **SECURITY-BOUNDARY CORRECTION PASS (2026-09-15)**: external review found `p_explicit_effects` was reachable on the externally-callable `inventory_finalize_posting` — live-confirmed P0 (on-hand doubled by an ordinary authenticated caller), fixed by internalizing the explicit-effects capability into a new EXECUTE-revoked-from-all-ordinary-roles `inventory_finalize_posting_internal`, reachable only via same-owner `SECURITY DEFINER` semantics from `inventory_reverse_movement`. A separate, pre-existing, NOT-fixed-this-pass finding (assigned to IC-7): the posted-header immutability trigger only checks its own GUC is `'on'`, not which columns changed — an ordinary permission-holding actor can self-set that GUC and rewrite any posted header's business content. pgTAP 35/35 (`103_...`, extended with Scenario E). Full regression 176/176. See change log for full evidence. |
| IC-3 Receiving consolidation                                         | ✅ DONE        | New canonical `inventory_receive_stock` primitive (domain-agnostic, delegates through `inventory_create_and_finalize`/public `inventory_finalize_posting`, never touches `_internal`). `receive_repair_order_stock` refactored onto it, all business rules preserved byte-for-byte. `inventory_receive_purchase_order` was **live-confirmed dead/broken** (called two nonexistent functions, zero UI/service reachability) — fixed and refactored onto the primitive, business rules preserved, security model hardened (new `SECURITY DEFINER` + actor check, since there was no working contract before to weaken). Line-correlation by ordinal position only (never SKU/variant). Idempotency structurally safe (pre-existing unique index) AND gracefully handled on a genuine concurrent race (live-proven, real two-connection test: loser blocked 3560.950ms then returned the winner's own movement*id, zero double-post). Self-caught PO-wrapper idempotency/state-mutation-ordering defect fixed before any test ran. **New CRITICAL pre-existing security finding** (fully unauthenticated `anon` can post via the raw engine layer) discovered and assigned to IC-7, NOT fixed here. pgTAP 44/44 (`104*...`). Full regression 220/220. See change log for full evidence.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                           |
| **IC-7A** Emergency movement-engine security boundary closure        | ✅ DONE        | **Out-of-roadmap-order emergency pass**, pulled forward from full IC-7 because IC-3 live-verified a CRITICAL finding: `inventory_create_draft`/public `inventory_finalize_posting`/`inventory_create_and_finalize` carried live `anon` EXECUTE with zero actor/permission check — a fully unauthenticated caller could post arbitrary movements. Re-reproduced live, fresh (not trusted from the prior report). Caller-graph audit BEFORE any grant change found 5 real Next.js server actions and the non-`SECURITY DEFINER` `inventory_approve_count_session` call these 3 RPCs DIRECTLY as `authenticated` — full internalization would have broken them, so Option B (harden in place) was chosen. `inventory_create_draft`/`inventory_finalize_posting_internal` (shared finalize choke point) gained actor+permission checks; `inventory_create_and_finalize` hardened directly too as defense in depth; `anon`/PUBLIC EXECUTE revoked, `authenticated`/`service_role` kept. Manual creation of `allows_manual_entry=false` types (900) now blocked. 2 live-caught defects fixed forward (an overly-broad `is_system`-based type guard, caught before any test ran; `103_...`'s own Scenario E ordering assumption invalidated by the new check, caught by the regression suite itself, fixed by repositioning — not rewriting — the scenario). Post-fix exploit replay: exact original attack now `42501`, zero physical mutation. pgTAP 29/29 (`105_...`). Full regression 249/249. Full IC-7 phase remains OPEN — only this one item closed. See change log for full evidence.                                                                                                                                                                                                                                                                                                                                                                                        |
| **IC-4** Branch transfer / MMJ rebuild                               | ✅ DONE        | Closed product-owner decision implemented exactly: `in_transit` means physically shipped (a real posted `311` movement), never merely reserved. New `prepared` pre-shipment status; new `inventory_send_branch_transfer`/`inventory_cancel_branch_transfer` RPCs; `inventory_accept_branch_transfer`/`inventory_decline_branch_transfer` fully rebuilt off hand-written balance writes onto the canonical engine; a new, previously undisclosed `anon`-EXECUTE + unchecked-actor finding closed on all 5 branch-transfer RPCs; movement type `311` redefined (zero live rows) + new `312` seeded, both system-managed; new `inventory_branch_transfer_discrepancies` table for persisted partial-receipt shortfalls; raw-write RLS closed on both transfer tables. 3 genuine two-connection concurrency proofs (double-send, double-accept, accept-vs-generic-movement contention). pgTAP 60/60 (`106_...`). Full regression 309/309. See change log for full evidence.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        |
| **IC-5** RepairOrder physical-location projection consolidation      | ✅ DONE        | One coherent projection derivation from canonical ledger (A) + attribution (B, `repair_order_line_movement_links`) → projection (C). Incremental fast path plus a new authoritative deterministic rebuild (`rebuild_repair_order_projection_bucket_internal` + public `rebuild_repair_order_location_projection`), proven equal by construction for reversal and empirically for every tested scenario (A-T). Reversal made projection-aware while `inventory_reverse_movement` itself stays fully RepairOrder-agnostic and untouched. IC-2 GUC retained, its staleness side-effect eliminated. `CHECK (quantity >= 0)` added; over-attribution/negative-rebuild hard-errors `P0008`, never clamped. Raw writes closed on both projection tables. **Same-day narrow correction pass**: fixed a BLOCKER (reversed putaway rebuilt the wrong projection bucket set -- the source/receiving bucket was left stale; buckets now derived from the reversal movement LINE's own source/destination columns, never from the firing ledger row) and centralized all three direct writers of `repair_order_line_movement_links` (attach/putaway/reversal-trigger) behind one new internal canonical primitive, `write_repair_order_line_movement_link_internal`, after external review found the original pass's own "attach is the sole writer" documentation claim had become false. Public attach contract frozen to `receipt`/`issue` only. pgTAP 46/46 (`107_...`, extended). Full regression 097-107, 382/382, 0 failures. See change log for full evidence.                                                                                                                                                                                                                                                                                                                                                                                                                      |
| IC-6 Legacy writer/helper removal                                    | ✅ DONE        | Dropped: `inventory_v1_get_or_create_balance`, stale 5-arg `inventory_get_or_create_balance_for_update` overload, `inventory_settings.negative_stock_policy` (Option A, proven structurally UNREACHABLE not just unused), 4 dead `ambra-location-inventory.ts` write actions (zero callers, confirmed a 3rd independent time). Legacy movement/numbering-helper audits confirmed already-clean. Both GUCs retained (posted-header GUC bypass left for full IC-7). New pgTAP `108_...` (23/23); full regression 097-108 re-run after fixing a genuine regression in `102_...` (its own Scenario C referenced the dropped column — test file edited, not a migration). See `inventory-core-architecture.md` §9D and `docs/inventory/reviews/ic-6-review/`.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                       |
| IC-6A Opening stock active-path repair                               | ✅ DONE        | Fixed a live, active bug IC-6 discovered: `createOpeningStockMovement` called 2 nonexistent RPCs. Moved onto `inventory_create_and_finalize` (movement type 401), no migration needed. New pgTAP `109_...` (16/16, live retry/idempotency proof); 5 new Vitest scenarios; full 097-108 regression re-run clean (402/402); `105_...` re-confirmed (29/29). From-scratch reproducibility gap (IC-6 finding) assigned as a HARD GATE to IC-8. See `docs/inventory/reviews/ic-6a-opening-stock-repair-review/`.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                    |
| IC-7 Security / write-boundary closure + module-boundary audit       | ✅ DONE        | Closed every open raw-write gap (reservation/allocation/generic-container RLS, posted-header GUC bypass, status-blind movement INSERT) plus 3 new CRITICAL findings: `inventory_guard_balance_write`/`_settings_write` NULL-comparison fail-open bug; `inventory_cancel_movement`/`inventory_save_draft`/`inventory_reconcile_balances` fully unauthenticated exploits; reservation/allocation RPCs were SECURITY INVOKER with no actor check. Posted-header trigger redesigned (GUC removed as authorization signal entirely). Default-privilege Option B chosen (schema-wide change confirmed unsafe). Module-boundary audit: generic core clean of RepairOrder/PO dependencies (1 disclosed exception). 9 migrations; new pgTAP `110_...` (25/25); full regression 097-110. See `docs/inventory/reviews/ic-7-review/`.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      |
| IC-7 Inventory security/write-boundary closure                       | ⬜ NOT STARTED | Depends on IC-0's own live findings plus whatever IC-4 already closed.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                         |
| IC-8 Full inventory regression / concurrency / performance hardening | ⬜ NOT STARTED | Final phase before the INVENTORY CORE FINAL GATE.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              |
| **INVENTORY CORE FINAL GATE**                                        | ⬜ NOT REACHED | Required before Phase 10D (Container QR) may resume.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                           |

---

## Change log

- **2026-09-15 (Inventory Architecture Consolidation Audit)**: a READ-ONLY
  audit (on branch `zone3-zone5-integration-audit`, continuing from the
  Zone 3 ↔ Zone 5 integration audit) examined every production-capable
  inventory write path live: the generic movement engine
  (`inventory_finalize_posting`, self-documented "v1: on_hand only"), the
  reservation/allocation engines (Phase 10A/10B, correct and kept as
  dedicated domain operations), Phase 10C's own container engine (correct,
  unchanged), Zone 5's receive/putaway RPCs, a **previously-undiscovered
  full inter-branch transfer system** (`inventory_branch_transfers` +
  `inventory_create_branch_transfer`/`inventory_accept_branch_transfer`/
  `inventory_decline_branch_transfer`) that is **live-proven broken**
  (`inventory_accept_branch_transfer` crashes immediately with `42883:
function public.inventory_allocate_movement_number(uuid, uuid) does not
exist`, and would additionally violate a `NOT NULL` constraint and
  reference a nonexistent `movement_kind` column even if that were fixed —
  confirmed via a live, rolled-back RPC call, not inferred from schema
  alone), and the legacy `ambra-location-inventory.ts` writers (confirmed,
  again, zero UI callers). Found movement code `311` has zero real usage
  ever (0 posted headers) and is one-sided by its own type-catalog
  definition. Found `inventory_v1_get_or_create_balance` lacks lot/serial
  support unlike its own already-existing replacement. No reversal RPC
  exists despite the schema already carrying `original_movement_id`/
  `reversal_movement_id` columns. Delivered a 25-section audit report
  (executive conclusion, architecture diagram, write-path inventory,
  canonical/derived/remove classification, movement catalog, 801-vs-311
  resolution, branch-transfer trace, source-of-truth matrix, security/
  performance/concurrency/audit-trail review, and an explicit final answer:
  today, at least three parallel/competing mechanisms exist; the proposed
  consolidation plan collapses them to one). **Nothing was modified. No
  migration applied. Phase 10D not started.**
- **2026-09-15 (Inventory Core consolidation plan authored)**: the audit was
  accepted as authoritative. Product owner closed 19 architectural decisions
  (see `inventory-core-architecture.md` §0). This session authored the full
  target architecture (`inventory-core-architecture.md`: domain model,
  movement-semantics boundary, source-of-truth contract, core invariant
  specification classified by enforcement layer, sanctioned-movement design,
  reversal design, global lock-order convention, security/performance/
  audit-trail/legal-boundary plans) and the full ordered implementation
  roadmap (`inventory-core-implementation-plan.md`: IC-0 through IC-8, each
  with exact goal/scope/tables-functions-files/what-must-not-change/
  migrations/invariant-changes/tests/live-verification/concurrency-tests/
  data-reset-consequences/rollback-strategy/acceptance-criteria/hard-stop-
  condition; a final minimal movement-code catalog resolving 311's own
  retirement; a receiving-consolidation API boundary; a Handling Unit
  operations plan; a unified test-strategy matrix; and the exact recommended
  scope for IC-1, the first authorized implementation phase). Added an
  explicit cross-reference to the Zone 3 tracker
  (`docs/mvp/zones/03-repair-orders-progress.md`): **Phase 10D is now marked
  BLOCKED ON INVENTORY CORE CONSOLIDATION**, not merely "next." **No IC
  phase was implemented.** No migration applied. No application code
  modified. Phase 10D not started. Stopping point, per explicit instruction:
  IC-1 was NOT started; its own exact authorized scope is recorded in the
  implementation plan for the next turn's own explicit go-ahead.
- **2026-09-15 (IC-0 live verification — CLOSED)**: performed the specific
  live verification IC-0's own scope required, no inference from migration
  files. (1) **CHECK constraints on `inventory_balances`**: `allocated_
quantity >= 0` and `reserved_quantity >= 0` already exist
  (`inventory_balances_allocated_nonnegative`, `inventory_balances_
reserved_nonnegative`, live-fetched via `pg_get_constraintdef`) —
  `on_hand_quantity >= 0` does **NOT** exist, confirming the architecture
  doc's own predicted gap. (2) **Raw-write RLS on `inventory_reservations`/
  `inventory_reservation_lines`/`inventory_allocations`/`inventory_
allocation_lines`**: all four have `relrowsecurity`/`relforcerowsecurity
= true`, but each carries only a single `PERMISSIVE ALL`-command policy
  gated solely on `has_branch_permission(...,'warehouse.inventory.
operate')` — **no RESTRICTIVE, ownership-aware policy exists**, meaning
  any authenticated caller holding that one permission can raw-INSERT/
  UPDATE/DELETE these tables, bypassing every invariant `inventory_create_
reservation`/`inventory_create_allocation` themselves enforce. **Real gap,
  confirmed** — but does NOT defeat IC-1's own guarantee, since IC-1's own
  check reads `inventory_balances.reserved_quantity`/`allocated_quantity`
  directly (a separately GUC-gated, still-protected table), never
  recomputed from these line tables at check time. Recorded as an **IC-7
  blocker**, matching the architecture doc's own security table. (3)
  **`inventory_movement_headers` raw INSERT boundary**: **EMPIRICALLY
  CONFIRMED** via a real, rolled-back live probe (not policy-text inference)
  that an authenticated actor holding `warehouse.inventory.operate` CAN
  directly `INSERT` a fully fabricated `status='posted'` header (fake
  document number, no real movement lines, no ledger entries) — the
  `inventory_movement_headers_insert` policy's own `WITH CHECK` is
  permission-only, with zero awareness of the `status` column.
  `inventory_movement_lines`' own INSERT policy has the identical shape.
  **Real gap, confirmed** — but, live-verified, does **NOT** defeat IC-1's
  own guarantee: no trigger on `inventory_movement_lines` auto-applies a
  balance effect (confirmed via `pg_trigger` — only `BEFORE UPDATE/DELETE`
  immutability triggers exist, no `AFTER INSERT` effect-application
  trigger), and `inventory_balances` itself remains protected by its own
  GUC-gated `inventory_guard_balance_write` trigger regardless of this raw
  header/line insert path — so a fabricated "posted" header can never
  actually move real stock or falsify what IC-1's own new check reads.
  Recorded as an **IC-7 blocker** (a serious audit-trail/data-integrity
  concern in its own right — fabricated posted-status records with real
  document numbers), not an IC-1 blocker. (4) **Function signatures**:
  `inventory_finalize_posting(p_movement_id uuid, p_actor_user_id uuid)`
  (DEFINER, unchanged from the audit); `inventory_v1_get_or_create_balance
(p_org_id, p_branch_id, p_location_id, p_variant_id) RETURNS uuid`
  (DEFINER, exactly one production caller — `inventory_finalize_posting`
  itself, confirmed via `prosrc` search across every function, plus a
  repo-wide grep confirming zero TypeScript callers); `inventory_get_or_
create_balance_for_update`'s own 5-argument overload (`p_organization_id,
p_branch_id, p_location_id, p_variant_id, p_movement_id) RETURNS
inventory_balances` (full row, `FOR UPDATE`-locked, defaults lot*id/
  serial_id to NULL identically to v1's own implicit behavior, additionally
  sets `last_movement_id`/`last_movement_at` on first creation) is
  confirmed the exact correct, drop-in replacement overload — the
  7-argument lot/serial-aware overload is deliberately NOT used, matching
  the explicit "do not expose new lot/serial behavior as a side effect"
  instruction. **Pre-migration data safety check**: live-queried all 37
  existing `inventory_balances` rows — zero have `on_hand_quantity < 0`,
  zero have `reserved_quantity > on_hand_quantity`, zero have `allocated*
  quantity > reserved_quantity` — safe to add the missing CHECK constraint
  and safe to implement the stronger invariant (below) without any
  pre-existing violation. **IC-0 DECISION GATE: PASSED.** No finding
  contradicts the accepted architecture or makes IC-1 unsafe to implement.
  Proceeding immediately to IC-1, per explicit instruction.
- **2026-09-15 (IC-1 — Canonical Movement Engine / Hard Stock Invariants —
  DONE)**: implemented and live-proven the hard commitment invariant in the
  shared, canonical `inventory_finalize_posting`, plus the balance-helper
  replacement and the missing CHECK constraint IC-0 identified.

  **Migrations applied (3, forward-only, all mirrored locally under their
  exact live version/timestamp in `apps/web/supabase-target/supabase/
migrations/`)**:
  1. `20260915062211_ic1_inventory_balances_on_hand_nonnegative_check` —
     `ALTER TABLE inventory_balances ADD CONSTRAINT inventory_balances_
on_hand_nonnegative CHECK (on_hand_quantity >= 0)`. Pre-migration data
     check: all 37 existing rows already satisfied it.
  2. `20260915062244_ic1_inventory_finalize_posting_hard_invariant` —
     `CREATE OR REPLACE` on `inventory_finalize_posting`: (a) replaced the
     internal balance-getter call from `inventory_v1_get_or_create_balance`
     (bare uuid return, no lot/serial support) to `inventory_get_or_create_
balance_for_update` (full locked row, already the established
     replacement elsewhere — IC-0 confirmed exactly one production caller of
     the old helper, this function itself); (b) added the new invariant
     check.
  3. `20260915062422_ic1_inventory_finalize_posting_fix_ambiguous_overload`
     — same-day forward fix: the prior migration's balance-getter call used
     5 positional arguments, genuinely ambiguous against `inventory_get_or_
create_balance_for_update`'s 7-argument overload (its trailing two
     params both carry `DEFAULT NULL`, so Postgres cannot disambiguate a
     5-arg positional call — live-reproduced as `42725: function ... is not
unique` when re-running the characterization scenario). Fixed by
     passing all 7 positional args explicitly (trailing two `NULL::uuid`),
     matching `inventory_create_allocation`'s own established call
     convention. Functionally identical to the 5-arg call (same NULL
     lot/serial defaults) — exposes no new lot/serial behavior. The first
     migration was never edited in place, per migration discipline.

  **The invariant, exactly as implemented**: before applying any
  `balance_field='on_hand' AND direction='decrease'` effect,
  `inventory_finalize_posting` now rejects (SQLSTATE `P0003`, message
  "Movement would strand committed stock...") if the post-effect on_hand
  would fall below `reserved_quantity + allocated_quantity` (the SUM) at
  that balance row. Unconditional — evaluated before, and independent of,
  the pre-existing `negative_stock_policy` check; no sanctioned bypass
  caller exists yet, so generic movement rejects unconditionally whenever it
  would strand a commitment.

  **Correction made mid-implementation, before any migration was written**:
  the architecture doc's own original invariant #6 phrasing (`on_hand <
reserved` OR `on_hand < allocated`, and §6's `available_to_move = on_hand
  - allocated`formula) was checked against`inventory_create_allocation`'s
own live body and found to be a genuine under-protection — reserved and
allocated are non-overlapping, ADDITIVE commitment buckets (a
reservation-backed allocation decrements `reserved_quantity`by exactly
the amount it increments`allocated_quantity`in the same UPDATE), so
protecting either value alone (or their max, which the OR-formula
effectively is) is insufficient; only their SUM is correct — e.g.
reserved=6, allocated=4, on_hand=8 passes both individual checks even
though the true combined commitment (10) exceeds on_hand (8). The SUM
formula was implemented instead, verified against the task's own worked
example (on_hand=10, reserved=6, allocated=0: move 4 allowed, move 5
rejected — confirmed live, exact match), and`inventory-core-
    architecture.md` §5 (invariant #6 row) and §6 (the sanctioned-movement
    default rule and its own rationale paragraph) were both corrected in place
    to match, so the architecture document and the implementation no longer
    disagree.

  **Live proof, both commitment paths** (both via the real Zone 5
  `receive_repair_order_stock`/`putaway_repair_order_stock` RPCs, not a
  synthetic reproduction):
  - Allocated stock (`101_...` rewritten, 17/17): receive 10 → reserve 6 →
    allocate 6 (fully converts reserved→allocated) → attempt putaway of 10
    → **REJECTED** (P0003), source/destination balances, reservation,
    allocation all provably unchanged, zero orphan `inventory_movement_
headers` rows created (header count identical before/after the rejected
    attempt) → control case: putaway of exactly the free 4 units
    **SUCCEEDS**, leaving on_hand=6 exactly at the commitment boundary.
  - Reserved-only stock, zero allocation (`102_...`, new file, 6/6): receive
    10 → reserve 6, no allocation → attempt putaway of 10 **REJECTED**
    (P0003) → attempt putaway of 5 also **REJECTED** (still exceeds the 4
    genuinely free units) → balance provably unchanged after both rejections
    → control case: putaway of exactly 4 **SUCCEEDS**. This proves the
    engine protects the architecture's own HARD-reservation decision
    (`reserved_quantity <= on_hand_quantity`) as a first-class case, not
    merely as an incidental consequence of protecting `allocated_quantity`.

  **Legitimate-movement regression (live, via `inventory_create_and_
finalize` directly, genuinely free/uncommitted stock)**: 101 receipt
  (destination-increase-only, never touches the new check's code path) —
  succeeded; 401 surplus (destination-increase-only) — succeeded; 402
  shortage against free stock (source-decrease, exercises the new check
  with a PASS expected) — succeeded; 801 bin-to-bin against free stock
  (source-decrease) — succeeded. Final balances matched arithmetic exactly
  (20+3-5-6=12 at the source, 6 at the destination). No legitimate movement
  broke.

  **Genuine two-independent-PostgreSQL-connection concurrency proof** (real
  `psql` binary, two separate OS-level connections against
  `SUPABASE_TARGET_DB_URL`, not one transaction pretending to be
  concurrent): a durable (committed) bucket was constructed — on*hand=10,
  allocated=6 (4 genuinely free). Session A opened a transaction, called
  `putaway_repair_order_stock` to move the exact free 4 units (succeeded,
  56ms), then held the transaction open via `pg_sleep(5)` before COMMIT.
  Session B, started ~1.5s later, attempted to move 4 units to a different
  destination; its own call **genuinely blocked for 3683.937ms** (real wall
  time, not overlap) waiting on Session A's row lock, resumed only after
  Session A's COMMIT (06:39:55.117), and correctly re-evaluated the
  invariant against A's now-updated balance (on_hand=6 after A's move,
  6 still committed) — **REJECTED** with P0003 ("only 2.000000 would remain
  on hand"). No deadlock. Final state: source=6, dest_a=4, dest_b has **no
  balance row at all** (B's rejected attempt left zero footprint — not even
  an empty balance row was created). This proves genuine lock-based
  serialization: two concurrent physical moves against the same committed
  bucket cannot both succeed if their combined effect would violate the
  commitment, and the rejected side leaves no trace. Lock-acquisition order
  in `inventory_finalize_posting` was inspected (not rewritten): a single
  balance row is locked per (line, effect) via `inventory_get_or_create*
  balance_for_update`'s own `FOR UPDATE`; no cross-row lock-ordering change
  was needed or made in IC-1 — no deadlock risk was found for the
  single-balance-row case this phase covers.

  **Residual data from the concurrency test (disclosed, not silently
  cleaned up)**: `inventory_movement_headers`/`inventory_movement_lines`
  are immutable once posted (`inventory_prevent_line_modification` trigger,
  the SAME protection IC-0 already documented) — attempting to DELETE them
  during cleanup was correctly blocked by the database itself
  (`P0001: Cannot delete lines of a finalized movement`), confirming the
  protection is real and was correctly NOT bypassed. As a result, 2 real,
  legitimately-posted movement headers (`PZ/2026/000020` the receipt,
  `MM/2026/000004` Session A's move) and their lines, the 3
  `ic1-concurrency-*` warehouse_locations rows they reference (undeletable
  once referenced by immutable movement lines), and 2 `inventory_balances`
  rows that accurately reflect that real, permanent history remain live —
  clearly named/tagged, internally consistent with each other and with the
  ledger, not orphaned or inconsistent, and not part of any production
  RepairOrder/customer data. All other synthetic scaffolding for this test
  (reservation, allocation, RepairOrder, RepairOrderLine, provenance chain,
  matcher session) WAS successfully deleted. Every other live test/probe
  this session ran inside `BEGIN ... ROLLBACK` and left zero residual data,
  confirmed by direct query after each.

  **Full regression**: pgTAP 097 (29/29), 098 (17/17), 099 (20/20), 100
  (44/44), 101 rewritten (17/17), 102 new (6/6) — 133/133 total, 0 failures.
  Vitest: `repair-orders.service.test.ts` (159/159), inventory-movement/
  field-policy suite (31/31), broader inventory sibling suite (166/166),
  CRM sibling suite (39/39) — 395/395 total, 0 failures. `pnpm type-check`:
  0 errors. `pnpm lint`: 0 errors, 319 pre-existing warnings, all in
  unrelated `temp/` scaffold directories (cycle-count, warehouse-movement-
  editor prototypes), none touching any file this phase changed.

  **Security observations carried forward to IC-7 (not fixed here, per
  explicit IC-1 scope boundary)**: the two genuine raw-write RLS gaps IC-0
  found (reservation/allocation tables' permissive-only policies;
  movement-header status-blind INSERT policy) remain open — confirmed again
  this phase that neither defeats IC-1's own guarantee (the new check reads
  exclusively from the separately GUC-protected `inventory_balances` table).

  **IC-1 review bundle**: `docs/inventory/reviews/ic-1-review/` (see below).

  **IC-1 is FINAL pending external review.** IC-2 is NOT started. Phase 10D
  is NOT started.

- **2026-09-15 (IC-1 external review — CORRECTION PASS, narrow
  semantic-contract question, STOPPED pending product-owner review)**:
  external review accepted IC-1's core invariant, locking strategy, SUM
  formula, helper replacement, pgTAP evidence, and concurrency proof
  outright — **none of that was reopened or redesigned**. Review found one
  unresolved behavioral contradiction, investigated in full this pass.

  **Finding**: `inventory_settings.negative_stock_policy` is a real, live,
  CHECK-validated 3-state column (`'block'` / `'allow'` /
  `'allow_with_approval'`, default `'block'`) — NOT a hypothetical or dead
  schema artifact. It was deliberately designed (see `docs/warehouse-
movements-refactor-plan.md:76,102,339-342,379`, the original v1 movement-
  engine design doc, predating Inventory Core consolidation) as a per-org
  control over whether `on_hand_quantity` may go negative. v1's own pre-IC-1
  engine code only blocked on `negative_stock_policy = 'block'`, meaning
  `'allow'`/`'allow_with_approval'` were intentionally meant to permit
  negative on-hand.

  IC-1's new CHECK (`inventory_balances_on_hand_nonnegative`) plus the new
  unconditional SUM-based P0003 check together make `negative_stock_policy`
  **completely inert** for on-hand decreases through the canonical engine —
  live-proven (below) that `'allow'` and `'block'` now produce byte-identical
  rejections. This was added under an **incorrect assumption**: IC-0's own
  audit flagged the CHECK as "missing" without cross-referencing `negative_
stock_policy`'s own pre-existing, documented 3-state design at all.

  **Diagnostic questions, answered from live + repo-wide evidence (not
  inferred from the column/variable name)**:
  - **A. Is `'allow'` a real currently-supported production mode?**
    Structurally yes (valid CHECK value, pre-IC-1 engine code path existed
    for it) — but **zero production UI or server action anywhere reads or
    writes `negative_stock_policy`** (repo-wide grep: the only TypeScript
    hit is a migration-content string-assertion test referencing the
    _original_ `allow_negative_stock` boolean column, not this one). It has
    never been reachable by an actual user/org through the application.
  - **B. Does any org/branch currently have `negative_stock_policy='allow'`
    live?** No — live-queried: exactly 1 `inventory_settings` row exists
    total, set to `'block'`.
  - **C. Was the accepted Inventory Core architecture intentionally meant to
    eliminate negative on-hand stock globally?** No — live-verified against
    `inventory-core-architecture.md` §0's full list of the 19 closed
    product-owner decisions: none mention `negative_stock_policy`, negative
    on-hand, or physical-layer backorder/oversell. Decision #15 (HARD
    reservations, `reserved <= on_hand`) is scoped specifically to
    reservations, not to on-hand negativity for entirely free/uncommitted
    stock — a materially different question.
  - **D. Or was the CHECK added under an incorrect assumption that it would
    not alter existing `'allow'` behavior?** **Yes — this is the accurate
    diagnosis.** C is false, D is true.

  **Live diagnostic** (transaction-scoped, `BEGIN...ROLLBACK`, fixture:
  on_hand=2, reserved=0, allocated=0; attempted physical decrease of 5
  through the real canonical engine via `inventory_create_and_finalize`):
  - `negative_stock_policy='allow'`: **FAILED — `P0003`**, "0.000000
    reserved + 0.000000 allocated = 0.000000 committed ... but only
    -3.000000 would remain on hand." Balance unchanged after (on_hand still
    2). Zero movement headers created.
  - `negative_stock_policy='block'`: **FAILED — `P0003`**, byte-identical
    message and behavior.
  - **Conclusion**: the two policy values are now behaviorally
    indistinguishable for on-hand decreases. No `23514` raw CHECK violation
    ever surfaces from this path — the new P0003 check always fires first
    (whenever `committed=0`, `v_new_qty < committed` reduces exactly to
    `v_new_qty < 0`), so error semantics are already uniform (always P0003,
    never an accidental constraint error) regardless of which option is
    ultimately chosen.

  **Decision: OPTION B — STOPPED, no further migration applied.** Per the
  reviewer's own explicit branching: Option A's precondition ("Inventory
  Core's accepted hard invariant really is `on_hand_quantity >= 0` ALWAYS")
  is not established by any of the 19 closed decisions or any other accepted
  document — question C is false. Since the conflict is real (a previously
  intentional, documented production capability is now structurally
  unreachable, without any explicit product-owner decision to deprecate it),
  and since "removing/weakening an already-applied hard invariant is an
  architecture decision" per explicit instruction, **no migration was
  applied this pass** to alter the CHECK, the P0003 check, or `negative_
stock_policy` in any way. The conflict, its evidence, and a proposed
  minimal correction for each possible resolution are recorded in
  `docs/inventory/reviews/ic-1-review/negative-stock-policy-conflict.md`
  for product-owner review.

  **The commitment invariant itself is NOT weakened or in question**: `on_
hand >= reserved_quantity + allocated_quantity`, unconditional, remains
  exactly as implemented and accepted. The open question is narrowly scoped
  to the `committed=0` edge case only (whether on-hand may go negative for
  entirely free/uncommitted stock when an org's policy says `'allow'`) —
  never whether committed stock can be stranded, which remains impossible
  regardless of policy, live-reconfirmed this pass.

  **Documentation test-count drift, corrected**: the phase-tracker row
  showed both "235/235" (a stale, incorrect draft figure left in mid-writing
  the final report) and "395/395" (the actual, verified total — 159 + 31 +
  166 + 39) in different places in this same document. 235/235 was never a
  real historical measurement — it is corrected in place to 395/395
  throughout; no separate historical entry is preserved for it since it was
  never an actual test run, only a transcription error within this same
  session.

  **Regression re-run this pass — genuine finding, fixed**: re-running
  101/102 via a fresh `psql` connection (rather than the original MCP
  `execute_sql` session) hit a real, live `duplicate key value violates
unique constraint "warehouse_locations_one_receiving_per_branch"` error —
  NOT a code regression. Root cause: IC-1's own genuine two-session
  concurrency test permanently, by design, left a real `warehouse_locations`
  row (`ic1-concurrency-receiving`) occupying the shared org=`9f98fe91-
63b8-4986-a2b3-65bdd47684c9`/branch=`e39b15da-0a8d-4056-b5a2-80eb1da868a6`
  pair's own "one receiving location per branch" slot (a live partial
  UNIQUE INDEX), carrying a real, non-zero, undeletable balance residual for
  the SAME shared `variant_1` fixture UUID every Zone 3 pgTAP file uses.
  101/102's own fixtures unconditionally `INSERT`ed a _new_ receiving
  location for that same shared branch, which now always collides — and
  even a lookup-and-reuse fix would have silently corrupted their own
  "before" balance assertions (T5/T6 etc. assert exact absolute quantities
  against a location that already carries 6 on-hand / 6 allocated from the
  concurrency residual). **Fixed**: both 101 and 102 now create their own
  fresh, isolated `branches` row per run (mirroring 099/100's own established
  `branch_b` convention; `e2e_user` already holds a real, permanent,
  org-wide `warehouse.*` wildcard grant, so no new permission grant is
  needed) instead of reusing the shared branch. Re-verified live after the
  fix: 101 17/17, 102 6/6. Zero residual after re-run (fresh branches
  correctly rolled back). This is a test-fixture robustness fix only — no
  RPC, migration, or invariant logic was touched.

  pgTAP totals, all clean: 101 (17/17), 102 (6/6), 097-100 (29/17/20/44) —
  133/133 total. New negative-stock diagnostic: both policy branches proven
  live (above). Vitest: `repair-orders.service.test.ts` (159/159),
  inventory-movement/field-policy suite (31/31), broader inventory sibling
  suite (166/166), CRM sibling suite (39/39) — 395/395 total, 0 failures
  (unaffected — SQL-test-only fix). `pnpm type-check`: 0 errors. `pnpm
lint`: 0 errors, 319 pre-existing warnings, all in unrelated `temp/`
  scaffold directories.

  **Bundle updated** (same IC-1 baseline, no IC-2 bundle created):
  `docs/inventory/reviews/ic-1-review/review-context.md`,
  `changed-files.md`, and `diff.patch` updated to include this pass's doc
  corrections; new `negative-stock-policy-conflict.md` added; no migration
  was required so `migration-summary.md` is unchanged; `test-and-
concurrency-evidence.md` updated with the negative-stock diagnostic
  section.

  **IC-1 was FINAL for its own accepted core, with one open semantic-
  contract question pending explicit product-owner resolution before IC-2
  begins.** That question is now resolved — see the next change-log entry.
  IC-2 is NOT started. Phase 10D is NOT started.

- **2026-09-15 (IC-1 FINALIZATION PASS — `negative_stock_policy` decision
  RESOLVED, product-owner decision recorded)**: the product owner chose
  **OPTION A**. Final product contract, recorded verbatim:
  1. `inventory_balances.on_hand_quantity` MUST NEVER be negative.
  2. `reserved_quantity + allocated_quantity <= on_hand_quantity` MUST
     ALWAYS hold.
  3. `negative_stock_policy='allow'` and `'allow_with_approval'` are now
     SUPERSEDED/DEPRECATED specifically for physical `on_hand` behavior.
  4. They must NOT bypass the IC-1 hard invariant.
  5. The column/CHECK values are NOT removed in this pass.
  6. IC-2 does not begin until this decision is documented and
     regression-tested (done, this entry).

  **No DB/code change was required or made.** The current, already-applied
  CHECK (`inventory_balances_on_hand_nonnegative`) and the already-applied
  P0003 invariant in `inventory_finalize_posting` already implement exactly
  this contract — confirmed by the correction pass's own live diagnostic
  (both `'allow'` and `'block'` already produced byte-identical P0003
  rejections). Nothing to migrate.

  **Documentation updated** to state the decision explicitly and mark the
  old `'allow'`/`'allow_with_approval'` semantics as historical/superseded
  rather than currently meaningful:
  - `inventory-core-architecture.md` §0 gained a new, 20th closed decision
    recording this verbatim; §5 invariant #1's own row now states "ALWAYS,
    with no exception" and cites the product-owner decision explicitly.
  - `docs/inventory/inventory-core-implementation-plan.md`'s own IC-6 scope
    (Legacy Writer/Helper Removal — the phase whose explicit goal is
    "delete the confirmed-dead paths") gained an added scope item: retiring
    `negative_stock_policy`'s dead `'allow'`/`'allow_with_approval'` values
    (narrow the CHECK to `'block'` only, or drop the column, re-verify live
    before choosing). IC-7 (security/write-boundary closure) was
    considered and correctly NOT used — this is a dead-configuration
    cleanup item, not a raw-write/RLS security gap, and IC-6's own stated
    goal matches it directly.
  - `docs/inventory/reviews/ic-1-review/negative-stock-policy-conflict.md`
    marked **RESOLVED**, with the product-owner decision, its date, and a
    pointer to this change-log entry.

  **New permanent regression** (not a diagnostic — documents the FINAL
  product contract): `102_ic1_reserved_only_hard_invariant_test.sql`
  extended with a third scenario (plan 6 → 14): fixture on_hand=2,
  reserved=0, allocated=0, in a fresh, isolated branch; attempts a decrease
  of 5 under `negative_stock_policy='allow'` — **REJECTED, P0003**, balance
  unchanged, zero orphan `inventory_movement_headers` row, zero
  `inventory_stock_ledger_entries` mutation; then the byte-identical attempt
  under `'block'` — same result. Live-verified: 14/14.

  **Regression, full**: 101 (17/17, unaffected by this pass, re-verified),
  102 (14/14, extended and re-verified), 098 (17/17, re-verified live via
  MCP `execute_sql`), 097/099/100 unaffected by this pass (no code changed;
  already re-verified against the current DB state earlier in the IC-1
  session — 29/17/20/44) — 133/133 pgTAP total. Vitest: 229 of the
  original 395 relevant tests re-confirmed live this pass
  (`repair-orders.service.test.ts` 159, inventory-movement/field-policy +
  inventory-actions suite 31, CRM sibling suite 39 — the file set is
  identical to the original submission, not additive; the broader
  inventory sibling suite's own 166 were not re-run since nothing in their
  scope changed). `pnpm type-check`: 0 errors. `pnpm lint`: 0 errors, 319
  pre-existing unrelated warnings (unchanged from every prior pass).

  **IC-1 is now FINAL, in full — no open questions remain.** IC-2 is NOT
  started. Phase 10D is NOT started.

- **2026-09-15 (IC-2 — Movement Reversal — DONE)**: implemented and
  live-proven `inventory_reverse_movement`, per the architecture doc §7
  design, with both of its open questions closed as explicit product-owner
  decisions BEFORE implementation began.

  **Product decisions, verbatim, recorded in `inventory-core-architecture.md`
  §0 (decisions #21, #22) and §7**:
  - **A**: a posted original may be reversed at most once; a reversal
    movement may never itself be reversed ("undo an undo" out of scope for
    MVP/pitch).
  - **B**: RepairOrder business-quantity attribution/netting for reversed
    movements is NOT implemented in IC-2. `RepairOrdersService.
listRepairOrderLines()`'s own formulas are unchanged; no
    `repair_order_line_movement_links` row of any kind is created for a
    reversal.

  **Baseline note**: at the start of this phase, IC-1's own work was found
  staged but not committed to git (per standing no-auto-commit policy, this
  was not committed by this session either — flagged for the user's
  awareness, not silently resolved). IC-2's own diff is built on top of
  that staged state.

  **Live schema findings before writing any code**: `inventory_movement_
headers` already carries `original_movement_id`, `reversal_movement_id`,
  `reversed_by`, `reversed_at`, and a `status` CHECK that already includes
  `'reversed'` (with a `posted_pair_v2` CHECK requiring `posted_at IS NOT
NULL` for both `'posted'` and `'reversed'`) — the schema had already
  anticipated this exact phase. `inventory_prevent_header_modification`/
  `_line_modification` already permit UPDATE on a `posted`/`cancelled`/
  `reversed` header/line specifically when `ambra.inventory_movement_
engine = 'on'` — the exact narrow mechanism needed for the bidirectional-
  linkage UPDATE, requiring no trigger change. `inventory_document_types`
  already carries `is_correction`/`corrects_document_type_code` columns,
  unused until now — exactly the mechanism needed for the new `KOR`
  document type. No dedicated `inventory_cancel_movement`/reversal RPC
  existed yet; no reversal-capable movement type existed in the catalog.

  **Genuine live discovery, resolved before implementation (not a silent
  deviation)**: `inventory_movement_type_effects` is TYPE-level, not
  INSTANCE-level. Live-checked the full catalog (101/311/401/402/801) —
  no single existing type can serve as a correct, honestly-labeled inverse
  for every other type (801 needs a combined source-increase+destination-
  decrease pair that exists nowhere in the catalog; 402/311's own "source
  decrease" has no "source increase" sibling). Resolved with the minimum
  additive extension: ONE new, generic, system-only movement type
  (`900`/`KOR`, `is_system=true`, `allows_manual_entry=false`, zero effect
  rows of its own) plus a narrow, fully backward-compatible extension to
  `inventory_finalize_posting` — one new optional trailing parameter,
  `p_explicit_effects jsonb DEFAULT NULL`. NULL (every pre-existing 2-arg
  caller) is byte-identical to before; non-NULL (only the reversal RPC)
  supplies per-line, per-instance inverted effects instead of the
  type-catalog lookup. This is the same engine, not a second one — per the
  task's own explicit "STOP before inventing a shadow type system"
  instruction, this finding justified the minimal extension rather than a
  stop, and is recorded here for exactly that scrutiny.

  **Final RPC**: `inventory_reverse_movement(p_movement_id uuid,
p_actor_user_id uuid, p_reason text) RETURNS jsonb`. `SECURITY DEFINER`,
  `search_path` hardened, granted to `authenticated`+`service_role` only
  (no `anon` — see the live-caught defect below). Actor-identity spoofing
  checked first (`28000`), independent of target existence. The original
  is locked (`FOR UPDATE`) before any eligibility check, and every
  eligibility condition (status, original*movement_id, reversal_movement*
  id) is re-checked against the LOCKED row, never an earlier unlocked
  read — this is what makes the concurrency proof below correct. A
  genuinely nonexistent movement and one the actor lacks `warehouse.
inventory.operate` on both raise the identical `P0002` "not found" —
  deliberate: no existence leak. Reason is mandatory
  (`NULLIF(TRIM(p_reason), '') IS NULL` rejects NULL and whitespace-only,
  `22023`).

  **Live-caught defects, all fixed forward (never editing an already-
  applied migration), disclosed precisely**:
  1. `CREATE OR REPLACE FUNCTION inventory_finalize_posting` with an added
     3rd parameter created a NEW, additional overload rather than
     replacing the 2-arg original (Postgres matches on full signature,
     not just name) — live-reproduced as `42725: function ... is not
unique` on the very first receipt-reversal test, breaking every
     existing 2-arg caller (`inventory_create_and_finalize`). Fixed:
     `DROP FUNCTION inventory_finalize_posting(uuid, uuid)`.
  2. SQLSTATE `P0004` is a Postgres BUILT-IN reserved condition name
     (`assign_string_too_long`, in the same "P0" class this project's own
     custom convention uses) — live-reproduced that `RAISE ... USING
ERRCODE = 'P0004'` is genuinely NOT caught by a surrounding `WHEN
OTHERS` handler (confirmed via isolated probes: P0004 alone fails to
     be caught; P0005/P0006/P0007 all catch correctly). The "not posted"
     rejection code was moved to `P0007`.
  3. **Zone 5 compatibility** (read-only investigation, per explicit
     scope): reversing a `receive_repair_order_stock`-created movement was
     live-proven to make Zone 5's own `repair_order_line_locations_
ledger_sync` trigger (`repair_order_location_attribution_sync()`)
     ACTIVELY CORRUPT `repair_order_line_locations` — it deleted then
     immediately re-inserted the SAME quantity at the SAME location
     (since the reversal line's own `destination_location_id`, copied
     from the original, equals the location the ledger entry zeroes out),
     leaving the table claiming 10 units physically present at a location
     where `on_hand_quantity` is now genuinely 0. Fixed WITHOUT touching
     Zone 5 itself: the reversal RPC sets the same `ambra.repair_order_
attribution_authoritative` GUC `receive_repair_order_stock`/
     `putaway_repair_order_stock` already set around their own ledger-
     producing calls — converts active corruption into disclosed, known
     STALENESS (an explicit, already-planned IC-5 concern per decision
     #7), not resolved here. Live-reverified after the fix: the trigger's
     own "authoritative" branch no longer mutates the table at all;
     `repair_order_line_locations` is stale but no longer actively wrong.
  4. **Grant hardening**: live-verified, TWICE, that `anon` regained
     EXECUTE on `inventory_reverse_movement` after subsequent `CREATE OR
REPLACE FUNCTION` calls, despite an explicit `REVOKE ALL FROM PUBLIC`
     in the very first migration — this database applies a default-
     privilege grant to `anon` on functions in schema `public` that
     re-applies on every `CREATE OR REPLACE` of the same function (the
     SAME pre-existing behavior already present on `inventory_finalize_
posting`, unrelated to and predating IC-1/IC-2 — out of scope to fix
     there). Fixed with a final, explicit `REVOKE ALL FROM PUBLIC; REVOKE
ALL FROM anon; GRANT EXECUTE TO authenticated, service_role;` applied
     as the last migration in this phase. Live-reverified: grantees now
     exactly `{authenticated, service_role}`. Recorded as a new IC-7 item
     (architecture doc §9): every canonical RPC's own grants need
     re-verification as the LAST step after its own full migration
     sequence, not just once after first creation.

  **Live proof, both physical scenarios** (via the real canonical engine,
  not a synthetic reproduction):
  - Receipt (101) reversal: balance exactly restored to pre-receipt value
    (0); original transitions to `status='reversed'`; bidirectional
    linkage agrees both directions; reversal document number (`KOR/2026/
000001`) genuinely distinct from the original (`PZ/2026/000021`);
    audit log persists the exact reason text; exactly one compensating
    ledger entry.
  - 801 (two-leg relocation) reversal: BOTH legs invert correctly in one
    transaction — source restored to exactly 10 (pre-move), destination
    restored to exactly 0 (pre-move). No one-sided reversal.

  **Live proof, all negative paths**: draft rejection (`P0007` — drafts use
  cancellation, not reversal); already-reversed rejection (`P0007`, since
  `status` transitions to `'reversed'` atomically with `reversal_movement_
id` — the dedicated `P0006` "already reversed" check remains a
  defensive second line of defense, not the path actually exercised
  through this RPC, disclosed honestly rather than claimed as the primary
  mechanism); reversal-of-reversal rejection (`P0005`); NULL-reason and
  whitespace-only-reason rejection (`22023` both); wrong-actor/spoofing
  rejection (`28000`); nonexistent-movement and no-permission rejection
  (identical `P0002`, no existence leak, live-confirmed as genuinely
  indistinguishable); **IC-1 commitment block** — reversing a receipt that
  would strand reserved stock is rejected by the SAME `P0003` invariant
  check reservations/allocations already rely on, atomically, with the
  balance, reservation, original header, and `reversal_movement_id` all
  provably unchanged and zero orphan reversal headers created.

  **Genuine two-independent-PostgreSQL-connection concurrency proof** (real
  `psql` binary, two separate OS processes, not one transaction pretending
  to be concurrent): a durable (committed) posted receipt was constructed.
  Session A opened a transaction, called `inventory_reverse_movement`
  (succeeded in 691.6ms, `KOR/2026/000001`), then held the transaction open
  via `pg_sleep(5)` before COMMIT. Session B, started ~1.5s later, attempted
  to reverse the SAME movement; its own call **genuinely blocked for
  5015.336ms** (real wall time, matching A's sleep almost exactly), resumed
  only after A's COMMIT, and correctly re-evaluated eligibility against the
  now-`'reversed'` status under its own lock — **REJECTED** with `P0007`.
  Exactly ONE reversal header exists for the original; exactly one audit-
  log `'reversed'` row. No deadlock. No double-compensation.

  **Residual data from the concurrency test (disclosed, not silently
  cleaned up)**: the same immutability protection IC-1's own concurrency
  test encountered applies here — `inventory_movement_headers`/`_lines`
  cannot be deleted once posted. Residual: 1 `ic2-concurrency-branch`
  branch, 1 location, 2 immutable movement headers (`PZ/2026/000021` now
  `status='reversed'`, `KOR/2026/000001` `status='posted'`) with their
  lines/ledger entries, 1 balance row (accurately on_hand=0, matching the
  real history), 2 audit-log rows. All other synthetic scaffolding
  (branches, RepairOrders, etc. from every pgTAP scenario) ran inside
  `BEGIN...ROLLBACK` and left zero residual data, confirmed by direct
  query after each.

  **Full regression**: pgTAP 097 (29/29), 098 (17/17), 099 (20/20), 100
  (44/44), 101 (17/17), 102 (14/14), 103 new (28/28) — 169/169 total, 0
  failures, none of 097-102 touched or affected by IC-2. Vitest: 378/378
  (repair-orders service, inventory sibling suite, wdd-matcher, svwms,
  inventory-actions, CRM sibling suite). `pnpm type-check`: 0 errors (no
  TypeScript touched). `pnpm lint`: 0 errors, 319 pre-existing unrelated
  warnings. `git diff --check`: clean, zero trailing-whitespace issues in
  every file this phase touched.

  **Migrations applied (7, forward-only, all mirrored locally under their
  exact live version/timestamp)**:
  1. `20260915155606_ic2_seed_reversal_document_movement_type` — extends
     `inventory_seed_movement_types_internal` with `KOR`/`900`; backfills
     all 4 existing orgs.
  2. `20260915160118_ic2_inventory_finalize_posting_explicit_effects` —
     adds `p_explicit_effects` parameter.
  3. `20260915160414_ic2_inventory_reverse_movement_rpc` — the new RPC
     (first version, `P0004`).
  4. `20260915160444_ic2_drop_old_finalize_posting_overload` — corrective,
     defect #1 above.
  5. `20260915160902_ic2_inventory_reverse_movement_fix_p0004_reserved_code`
     — corrective, defect #2 above.
  6. `20260915161137_ic2_reverse_movement_zone5_attribution_guard` —
     corrective, defect #3 above.
  7. `20260915162826_ic2_reverse_movement_regrant_after_default_privilege_reapply`
     — corrective, defect #4 above.

  **Documentation updated**: `inventory-core-architecture.md` §0 (new
  decisions #21, #22), §5 (invariant #15 now ✅ IMPLEMENTED), §7 (fully
  rewritten from design to as-implemented, both product decisions closed,
  all live findings recorded), §9 (two new IC-7 items: `repair_order_line_
locations` staleness, `anon` default-privilege re-grant). `inventory-
core-implementation-plan.md`'s own IC-2 section gained a RESULT addendum
  (plan preserved as historical record, not silently rewritten).

  **IC-2 review bundle**: `docs/inventory/reviews/ic-2-review/`.

  **IC-2 is DONE and FINAL, pending external review.** IC-3 is NOT started.

- **2026-09-15 (IC-2 — SECURITY-BOUNDARY CORRECTION PASS — DONE)**:
  external review of the IC-2 submission above ACCEPTED the physical
  reversal architecture but flagged a P0: the `p_explicit_effects`
  parameter added to `inventory_finalize_posting(uuid,uuid,jsonb)` (see
  migration 2 above) was added to the EXTERNALLY-CALLABLE canonical RPC,
  not restricted to the internal reversal mechanism, and that function
  carried live `anon` EXECUTE (a pre-existing default-privilege behavior,
  unrelated to IC-2's own work).

  **Live investigation (not assumed from the review alone)**: a safe,
  transaction-scoped attack probe (`BEGIN...ROLLBACK`, no real data
  touched) was run as an ordinary `authenticated` actor with no special
  grant. Two early probe attempts were correctly recognized as NOT proof
  of safety (one was blocked by IC-1's own P0003 stranded-commitment
  check; one by an unrelated ledger uniqueness constraint) — neither
  demonstrated the parameter itself was safe. A third, more careful probe
  — supplying two DIFFERENT real effect ids (borrowed from movement types
  `101` and `401`, both semantically "destination increase") against the
  actor's own legitimately-created 10-unit draft receipt — **succeeded**:
  the movement posted with `on_hand=20` (doubled), 2 ledger entries
  created. **P0 conclusively confirmed live.**

  **Fix (internalize explicit effects)**: logic moved to a new
  `inventory_finalize_posting_internal(uuid,uuid,jsonb)`; `EXECUTE`
  revoked from PUBLIC/`anon`/`authenticated`/`service_role` on the
  internal function. The public `inventory_finalize_posting` was restored
  to its original 2-argument, catalog-effects-only contract as a thin
  wrapper. `inventory_reverse_movement` (already `SECURITY DEFINER`, owner
  `postgres`) now calls the internal function directly — reachable only
  via standard, same-owner `SECURITY DEFINER` privilege semantics (a
  well-established Postgres mechanism, not a workaround), never via a GUC
  or "trust the caller" convention. Two defense-in-depth checks were added
  inside the internal function: (a) explicit effects are only accepted
  when the movement's own REAL `movement_type_code` — read from the
  locked row itself, never trusted from the caller — is exactly `'900'`
  (the system reversal type), categorically ruling out the exact attack
  above even for a hypothetical future internal caller; (b) each supplied
  effect's `target`/`direction` is validated against its exact allowed
  enumeration and rejected outright rather than silently falling through
  the existing logic.

  **Live-caught defect #5 (same recurring pitfall as defect #1 above)**:
  recreating the public 2-arg `inventory_finalize_posting` did NOT remove
  the still-live, vulnerable 3-arg overload — `CREATE OR REPLACE FUNCTION`
  only replaces an EXACT arity match; a different arity creates an
  additional overload, leaving the old one (with its own old grants) live.
  Live-verified via `pg_proc`/`has_function_privilege` immediately after
  the "fix" migration that the old 3-arg signature was STILL callable by
  `authenticated`/`anon`/`service_role` — caught before being reported as
  fixed, corrected with a second forward migration explicitly dropping the
  exact old signature (`DROP FUNCTION IF EXISTS public.inventory_finalize_
posting(uuid, uuid, jsonb)`).

  **Post-fix live re-verification**: direct call to
  `inventory_finalize_posting_internal` by an ordinary `authenticated`
  actor → `42501` (permission denied), using the EXACT attack payload
  proven exploitable pre-fix; the old 3-arg public-named signature →
  `42883` (does not exist); ordinary 2-arg `inventory_finalize_posting`
  (catalog effects) still succeeds correctly; full `inventory_reverse_
movement` end-to-end (receipt reversal exact restoration, 801 both-legs
  restoration, IC-1 commitment block) re-confirmed working correctly
  post-fix; `has_function_privilege` confirms both `anon` and
  `authenticated` hold zero `EXECUTE` on the internal function.

  **`103_ic2_movement_reversal_test.sql` extended** with Scenario E
  (T29-T35, plan 28→35): ordinary 2-arg finalize still succeeds (T29);
  balance not exploitable via the public surface (T30); 3-arg call via the
  public-named function fails `42883` (T31); direct call to the internal
  function using the exact proven attack payload fails `42501` (T32);
  balance remains un-exploited, zero footprint (T33); `has_function_
privilege` confirms zero `EXECUTE` for `anon` (T34) and `authenticated`
  (T35) on the internal function. All 35/35 assertions pass in the file's
  own real execution (not merely the separate ad-hoc probes above).

  **A separate, broader, NOT-fixed-this-pass finding**, surfaced while
  verifying the pre-existing claim that "the original header is never
  edited" for the documentation wording-correction requested by this same
  pass: live-proven that the backing `inventory_prevent_header_
modification` trigger only checks that its own session GUC
  (`ambra.inventory_movement_engine`) is `'on'` — never which columns
  changed. Since that GUC is an ordinary session-level custom parameter
  (not superuser-restricted) and the `inventory_movement_headers` UPDATE
  RLS policy has no `WITH CHECK` column restriction, any `authenticated`
  actor already holding `warehouse.inventory.operate`/`.adjust`/`.reverse`
  can set the GUC themselves and then raw-`UPDATE` **any** column of
  **any** posted header (live-proven: rewrote `document_number` on a
  posted receipt with no error). This is **pre-existing, not
  IC-2-introduced** (both the GUC and the trigger predate IC-2) — a
  sharper, UPDATE-side version of the raw-write gap already flagged in
  architecture doc §9 (previously scoped to INSERT only). **Not fixed in
  this pass** (out of IC-2's own narrow security-boundary scope, which
  covers the brand-new `p_explicit_effects` capability IC-2 itself
  introduced, not this old, pre-existing infrastructure) — explicitly
  assigned to **IC-7**. Documentation wording corrected accordingly:
  neither §5 invariant #13 nor §7's "never edited" line now overclaim a
  database-enforced guarantee that does not, in fact, hold against an
  ordinary permission-holding actor who knows the GUC's name.

  **Regression**: full pgTAP re-run this pass — 097 (29/29), 098 (17/17),
  099 (20/20, re-verified via Supabase MCP `execute_sql` after two
  `psql`-path attempts hit the already-known, disclosed connection-pooler
  GUC artifact — not a real regression), 100 (44/44), 101 (17/17), 102
  (14/14), 103 (35/35 in its final, extended form) — **176/176 total, 0
  failures**. Vitest: 159 (repair-orders service) + 63 (inventory-actions,
  wdd-matcher-approval-actions, CRM contacts/module-migration/parties,
  wdd-matcher service + movement-import-candidates, inventory
  cross-branch-transfers, inventory-backend-hardening-migration) = 222/222,
  0 failures. `pnpm type-check`: 0 errors. `pnpm lint`: 0 errors, 319
  pre-existing warnings, all in unrelated `apps/web/temp/` scaffolds.
  `git diff --check`: clean on every file this pass touched (the one flag
  raised was inside the pre-existing `diff.patch` bundle artifact being
  regenerated, not this pass's own source edits).

  **Concurrency NOT re-run, reasoned**: `inventory_reverse_movement`'s own
  row-locking of the original header (`SELECT ... FOR UPDATE`, first
  action after actor/reason validation) is byte-identical before and after
  this fix — only the internal call target of its own downstream
  `inventory_finalize_posting_internal` invocation changed, not any lock
  acquisition order or scope. The existing genuine two-session concurrency
  proof (IC-2's own submission, ~5s real blocking, exactly one reversal
  survives) remains valid evidence and was not repeated.

  **Migrations applied (2, forward-only, mirrored locally under their
  exact live version/timestamp)**: 8. `20260915170706_ic2_security_internalize_explicit_effects` — creates
  `inventory_finalize_posting_internal`, adds the two defense-in-depth
  checks, revokes all EXECUTE on it, restores the public 2-arg
  `inventory_finalize_posting` as a thin wrapper, updates `inventory_
   reverse_movement` to call the internal function directly. 9. `20260915170726_ic2_drop_vulnerable_public_named_three_arg_finalize_posting`
  — corrective, live-caught defect #5 above.

  **Documentation updated**: `inventory-core-architecture.md` §5 (invariant
  #13 wording corrected), §7 (the "never edited" wording corrected with
  full precision on what is/isn't DB-enforced), §9 (the `inventory_
movement_headers` row sharpened with the live-proven UPDATE-bypass
  finding; one new row added for the `p_explicit_effects` P0 and its fix).
  `inventory-core-implementation-plan.md`'s own IC-2 RESULT addendum
  extended with this pass's findings (not silently rewritten — appended).

  **IC-2 review bundle updated** (same baseline SHA
  `27d900071813c82cc7d6a20d97dadd42def21e8f`, not a new IC-3 bundle):
  `docs/inventory/reviews/ic-2-review/`.

  **IC-2, including this security-boundary correction pass, is DONE and
  FINAL, pending external review.** IC-3 is NOT started. Phase 10D is NOT
  started.

- **2026-09-16 (IC-3 — Receiving Consolidation — DONE)**: implemented per
  the assigning brief's own extensive verify-first, implement, test,
  document, package protocol. IC-0/IC-1/IC-2 re-confirmed ACCEPTED/FINAL
  before touching anything; IC-2's own frozen security contract (public
  2-arg `inventory_finalize_posting` catalog-effects-only; explicit
  effects internal-only; `inventory_finalize_posting_internal` not
  executable by ordinary roles) was re-verified live, unchanged, and never
  reopened.

  **Live-verification-first findings that materially shaped the design**:
  read the CURRENT live definitions of `receive_repair_order_stock` and
  `inventory_receive_purchase_order` before designing anything (not from
  memory or the plan's own illustrative shape). `receive_repair_order_
stock` was working correctly (posts through `inventory_create_and_
finalize`, zero TS/UI callers today, confirmed via repo-wide grep).
  `inventory_receive_purchase_order` was **live-confirmed dead/broken**:
  it called `public.inventory_create_draft_movement`/`public.inventory_
post_movement` — **neither function exists in this database** (0 rows
  in `pg_proc`) — so every real invocation has always failed `42883`.
  Repo-wide grep confirmed zero UI callers, zero server-action callers
  reached from any component (the wrapping service method and action
  exist but nothing calls them), and the only "test coverage" was a
  static string-match against the migration file's own raw text in
  `inventory-phase2-migrations.test.ts` — never a behavioral test.
  `inventory_purchase_orders` has 0 live rows. Per the brief's own
  explicit instruction ("If the function is dead or materially broken: do
  not fake parity. Report it and still consolidate its valid business
  contract if appropriate"), the PO wrapper's physical-posting step was
  replaced rather than "preserved," while its genuine, already-correct
  business rules (PO row lock, `warehouse.procurement.manage` permission
  check — confirmed a real, live permission slug — status guard, per-line
  lock, over-receipt rejection, destination resolution, `received_
quantity` tracking, final status recomputation) were kept byte-for-byte.

  **Separate, live-proven CRITICAL security finding, pre-existing, NOT
  fixed this pass**: while designing the new primitive's own security
  model, live-verified that `inventory_create_and_finalize`/`inventory_
create_draft`/the public `inventory_finalize_posting` carry live `anon`
  EXECUTE and perform **zero** actor-identity or permission check of
  their own (`inventory_create_draft` never calls `auth.uid()` or `has_
branch_permission` at all, relying entirely on RLS, which its own
  `SECURITY DEFINER`/owner-`postgres` execution context bypasses
  structurally). A safe, transaction-scoped, rolled-back probe proved a
  **fully unauthenticated** `anon` session (zero JWT claims, zero
  `auth.uid()`, zero session) can call `inventory_create_and_finalize`
  directly and post a real, immutable 999-unit movement to an arbitrary
  organization/branch it merely names a UUID for. This is a complete
  authentication bypass — strictly more severe than the IC-2 explicit-
  effects P0 (which required a real session) and the header-immutability
  GUC bypass (which required a real warehouse permission), since it
  requires no account at all. Pre-existing (predates IC-1); IC-3's own
  three new/refactored entry points are unaffected (each performs its own
  actor+permission check first, live-verified via Scenario J below) but
  the raw engine layer itself remains directly reachable. Per explicit
  instruction ("Do NOT fix IC-7 issues here... any NEW function created by
  IC-3 must be correctly secured now"), this was NOT fixed — it is a
  pre-existing gap in infrastructure that predates IC-3 by three phases,
  not something IC-3 introduces or worsens. Assigned to **IC-7** as its
  explicit top-priority item (see architecture doc §9's new table row).

  **Final canonical primitive**: `inventory_receive_stock(p_actor_user_id,
p_organization_id, p_branch_id, p_lines, p_operation_date,
p_document_date, p_external_reference, p_note, p_idempotency_key)
RETURNS jsonb`. Domain-agnostic — knows nothing about RepairOrders,
  Matcher provenance, or Purchase Orders. `p_lines` entries: `{variant_id,
unit_id, quantity, destination_location_id, unit_cost?, note?}` — a
  pre-resolved PER-LINE destination (not a single top-level one), because
  the two real wrappers resolve destination differently (RepairOrder: one
  branch receiving location for every line; PO: per-line override falling
  back to the PO's own delivery location) — that resolution POLICY lives
  in each wrapper, per the brief's own §13. Delegates every physical
  effect through `inventory_create_and_finalize` → the public, frozen
  `inventory_finalize_posting` — no direct balance/ledger writes, no
  second posting engine, movement type is the existing canonical `101`
  receipt. `SECURITY DEFINER`, owner `postgres`, actor-identity +
  `has_branch_permission('warehouse.inventory.operate' OR '.adjust')`
  checks run first; `REVOKE ALL FROM PUBLIC, anon; GRANT EXECUTE TO
authenticated, service_role` — live-reverified after every `CREATE OR
REPLACE`, no stale overload.

  **Line-correlation contract**: the primitive returns `lines:
[{line_number, movement_line_id, variant_id, quantity, destination_
location_id}]`, ordered by `line_number` in exact input-array order —
  never by SKU/variant/product code. Live-proven: two same-variant lines
  in one call map to two DISTINCT `movement_line_id`s (T3-T4 in
  `104_...`); a RepairOrder receipt with two DIFFERENT RepairOrderLines
  sharing the SAME variant/SKU are independently, correctly attributed
  with zero cross-contamination (G3-G5 in `104_...`).

  **Idempotency**: the pre-existing partial UNIQUE index `inventory_
movement_headers_org_idempotency_uidx` already makes double-posting
  structurally impossible, but `inventory_create_draft` does not catch
  its own resulting `23505`. The primitive catches it (via `GET STACKED
DIAGNOSTICS ... CONSTRAINT_NAME`, not message-text matching) and
  returns the WINNING caller's already-committed movement gracefully.
  **Live-proven sequentially** (F5-F6 in `104_...`: retry with the same
  key returns the same `movement_id`, balance unchanged) **and via a
  genuine two-PostgreSQL-connection race** (real `psql` binary, two
  independent OS connections, not pgTAP): Session A's call succeeded in
  46ms then held its transaction open 5s (`pg_sleep`); Session B, launched
  ~1.5s later with the SAME idempotency key, **blocked for 3560.950ms**
  on Session A's uncommitted index entry, then resumed within ~52ms of
  Session A's commit and returned the IDENTICAL `movement_id` — zero
  double-post, zero raw/ugly error surfaced to the losing caller. Final
  state verified: `on_hand=10` (not 20), exactly one movement header
  (`PZ/2026/000022`).

  **RepairOrder wrapper** (`receive_repair_order_stock`, refactored):
  every pre-existing business rule kept exactly — actor/permission
  checks, branch receiving-location resolution, `source_line_id`
  provenance resolution chain (`workshop_source_document_lines` →
  `repair_order_line_source_links` → `repair_order_lines`), the `ambra.
repair_order_attribution_authoritative` GUC, the `attach_repair_order_
line_movement` + `repair_order_line_locations` upsert loop. Changed
  only the physical-posting call (now the primitive) and the line-
  correlation source (the primitive's own returned array, one fewer
  query). Live-proven (`104_...` Scenario G, 14 assertions): 3-line happy
  path (two attributed to different RepairOrderLines sharing one SKU, one
  deliberately unattributed) posts correctly, exact `applied_quantity`
  per line, `repair_order_line_locations` seeded correctly, zero
  fabricated attribution for the unattributed line; all 4 provenance
  negative paths preserved exactly (nonexistent `P0002`, ambiguous
  `55000`, wrong-branch `42501`, wrong-variant `22023`); atomicity proven
  (a 2-line call with one bad-provenance line creates ZERO movement
  header, header count unchanged).

  **Live schema finding while building the ambiguity fixture**:
  `repair_order_line_source_links.workshop_source_document_line_id` has
  its own UNIQUE constraint (`repair_order_line_source_links_source_line_
unique`) — one link per source line. Genuine ambiguity therefore
  requires TWO distinct `workshop_source_document_lines` rows (one per
  DISTINCT `workshop_source_document_id`, e.g. two uploaded files both
  referencing the same physical line) sharing the SAME `wdd_matcher_line_
id`, not two links from one source line. The pgTAP fixture was
  corrected to match this real mechanism, not the RPC.

  **Purchase Order wrapper** (`inventory_receive_purchase_order`,
  refactored/fixed): logic replaced (was calling nonexistent functions),
  business rules preserved, security hardened (`SECURITY DEFINER` +
  actor-identity check added — the prior code had neither). Live-proven
  (`104_...` Scenario H, 13 assertions): partial receive → `partially_
received`, completing receipt → `received`; all negative paths (`P0002`
  nonexistent PO, `P0002` wrong-PO line, `22023` over-receipt, `55000`
  already-received, `22023` missing destination) proven with the ACTUAL
  PO rules discovered live, not invented ones; per-line destination
  override honored; idempotent retry does NOT double-increment `received_
quantity` (T H11-H12, proving the self-caught defect below is fixed);
  zero RepairOrder attribution tables touched by any PO-wrapper movement.

  **Live-caught defects, fixed forward** (see `docs/inventory/reviews/
ic-3-review/` for full detail): (1) the PO wrapper's own idempotency-
  vs-state-mutation-ordering defect — **self-caught before any test
  exercised it** — the first draft incremented `received_quantity` BEFORE
  calling the idempotency-aware primitive, so a retry would have double-
  counted PO received quantity even though the physical movement stayed
  correctly deduplicated; fixed by pre-checking for an existing movement
  under the derived idempotency key immediately after acquiring the PO
  row's own pre-existing `FOR UPDATE` lock (this lock, not a new
  mechanism, is what makes the pre-check race-safe against a genuinely
  concurrent retry). (2) the ambiguous-provenance pgTAP fixture initially
  violated a real UNIQUE constraint neither party had documented — caught
  live via the DB's own error, fixture corrected (see schema finding
  above). (3) a committed concurrency-test fixture's own `branch_number`
  (970) collided with an existing, unrelated `103_...` test file's own
  transaction-scoped branch number — caught by the regression suite
  itself (103 failed `23505` on a `branches` unique constraint), fixed by
  renumbering the committed fixture to 940, not by touching `103_...`.

  **Generic Warehouse Movements UI decision**: left unchanged (Option A).
  Live-verified `createAndPostMovementAction` → `InventoryMovementsService
.createAndFinalize` → `inventory_create_and_finalize`, reachable from
  `/dashboard/warehouse/inventory/movements/new`, already calls the
  correct underlying engine directly with zero RepairOrder/PO coupling —
  routing it through the new named primitive would be a cosmetic rename
  with a real regression-testing cost and no behavior change, so it was
  not done. A deliberate, documented decision, not an oversight.

  **Lot/serial**: honestly disclosed as NOT supported by the primitive's
  `p_lines` shape — live-verified `inventory_create_draft`'s own `jsonb_
to_recordset` extraction never reads `lot_id`/`serial_id`/`currency`
  from `p_lines`, and `inventory_finalize_posting_internal` hardcodes
  `NULL::uuid` for both when resolving the balance row regardless of what
  a movement line carries — a pre-existing "v1: on_hand only, lot/serial-
  blind" engine limitation, not something IC-3 invents partial support
  for.

  **Full regression**: pgTAP 097 (29/29), 098 (17/17, re-verified via
  Supabase MCP after the known, disclosed connection-pooler GUC artifact
  hit two `psql` attempts), 099 (20/20), 100 (44/44, re-verified via
  Supabase MCP for the same known reason), 101 (17/17), 102 (14/14), 103
  (35/35, after the branch_number fix above), 104 new (44/44) — **220/220
  total, 0 failures**. Vitest: 228/228 (repair-orders service,
  inventory-actions, wdd-matcher-approval-actions, CRM contacts/module-
  migration/parties, wdd-matcher service + movement-import-candidates,
  inventory cross-branch-transfers, inventory-backend-hardening-
  migration, inventory-phase2-migrations — the last of which specifically
  exercises the PO migration text this phase's own PO fix builds on).
  `pnpm type-check`: 0 errors (no TypeScript touched). `pnpm lint`: 0
  errors, 319 pre-existing unrelated warnings. `git diff --check`: clean
  on every file this phase touched.

  **Migrations applied (4, forward-only, all mirrored locally under their
  exact live version/timestamp)**:
  1. `20260915183918_ic3_canonical_receive_primitive` — the new
     `inventory_receive_stock` RPC.
  2. `20260915184005_ic3_receive_repair_order_stock_wrapper_refactor` —
     `receive_repair_order_stock` refactored onto the primitive.
  3. `20260915184050_ic3_inventory_receive_purchase_order_wrapper_
refactor` — `inventory_receive_purchase_order` fixed and refactored
     onto the primitive; old broken 3-arg overload dropped in the same
     migration (learned from 3 prior overload-pitfall occurrences this
     project).
  4. `20260915184448_ic3_fix_po_wrapper_idempotency_state_mutation_race`
     — corrective, self-caught defect #1 above.

  **Documentation updated**: `inventory-core-architecture.md` gained a
  new §7A ("Receiving Consolidation," full RPC contract, security model,
  line-correlation contract, idempotency proof, both wrapper summaries,
  the generic-UI decision, the lot/serial disclosure) and a new §9 table
  row (the CRITICAL unauthenticated-posting finding, marked top-priority
  for IC-7). `inventory-core-implementation-plan.md`'s own IC-3 section
  gained a RESULT addendum (plan preserved as historical record, appended
  below it). This file's own phase-tracker row and overall-execution
  summary updated.

  **IC-3 review bundle**: `docs/inventory/reviews/ic-3-review/`.

  **IC-3 is DONE.** IC-4 is NOT started. Phase 10D is NOT started.

- **2026-09-16 (IC-7A — Emergency Movement Engine Security Boundary
  Closure — DONE)**: implemented per the assigning brief's own explicit
  "EMERGENCY, P0, narrow pass, NOT the full IC-7 phase" framing.
  IC-0/IC-1/IC-2/IC-3 re-confirmed ACCEPTED/FINAL before touching
  anything; their own architecture was not reopened. IC-4 was NOT
  started, Phase 10D remains BLOCKED and untouched.

  **Re-reproduced the P0, fresh, not trusted from IC-3's own prior
  report**: a safe, transaction-scoped, rolled-back probe confirmed live
  that `inventory_create_draft`, the public `inventory_finalize_posting`,
  and `inventory_create_and_finalize` all carried `anon` EXECUTE and
  performed zero actor-identity or permission check. Three separate
  exploit calls succeeded as a genuinely unauthenticated `anon` role —
  the third (`inventory_create_and_finalize`, 777 units, an arbitrary
  fresh org/branch) posted a real, immutable movement, confirmed via
  `document_number`/`on_hand_quantity` returned in the same probe.

  **Caller-graph audit performed BEFORE any grant was touched** (per
  explicit instruction not to revoke blindly): repo-wide TypeScript grep
  plus a live `pg_proc` source-text sweep for every PL/pgSQL function
  calling the three target RPCs by name. Found: `InventoryMovementsService
.createDraft/.finalizePosting/.createAndFinalize` call the three RPCs
  DIRECTLY via `supabase.rpc(...)`, wrapped by 5 real, reachable Next.js
  server actions (`createDraftMovementAction`, `finalizePostingAction`,
  `createAndPostMovementAction`, `quickReceiptAction`/`receiveStockAction`,
  `quickBinMoveAction`/`transferStockAction`) — all running as the
  browser session's own `authenticated` role, never through a SQL-level
  wrapper. `inventory_approve_count_session` (the live 401/402 adjustment
  flow) is itself **NOT** `SECURITY DEFINER` — confirmed via
  `pg_get_functiondef` — so its own nested calls into these functions
  execute as the real, non-elevated invoking role. This definitively
  ruled out full internalization (revoking `authenticated` EXECUTE): it
  would have broken every one of these real, currently-working flows.
  Also confirmed via the SAME sweep: `inventory_receive_stock`,
  `receive_repair_order_stock`, `inventory_receive_purchase_order`, and
  `putaway_repair_order_stock` are all themselves `SECURITY DEFINER`
  owned by `postgres` — their own nested calls into the hardened
  functions are unaffected by any grant change, by standard same-owner
  `SECURITY DEFINER` privilege semantics. `inventory_accept_branch_
transfer`/`inventory_decline_branch_transfer` do not call any of the
  three target functions at all — confirmed clean, IC-4's own future
  scope untouched.

  **Fix (Option B — harden in place, per the caller-graph finding
  above)**: `inventory_create_draft` and `inventory_finalize_posting_
internal` (the SINGLE shared choke point both the public 2-arg
  `inventory_finalize_posting` wrapper and `inventory_reverse_movement`
  call into — hardening here once correctly protects both callers
  without duplicating the check) each gained the standard actor-identity
  (`p_actor_user_id = auth.uid()`, `28000`) + permission
  (`has_branch_permission(..., 'warehouse.inventory.operate') OR (...,
'.adjust')`, `42501`) check, matching the established pattern already
  used by every other canonical RPC in this project.
  `inventory_create_and_finalize` gained the same checks directly too, as
  explicit defense in depth (not merely relying on transitive protection
  via `inventory_create_draft`). `REVOKE ALL FROM PUBLIC, anon` applied
  to all three; `authenticated`/`service_role` EXECUTE explicitly KEPT
  (required by the real caller graph). `inventory_finalize_posting_
internal`'s own EXECUTE remains revoked from every ordinary role —
  IC-2's own frozen contract, re-verified unchanged, never reopened; grep
  across every IC-7A file confirms zero references to it.

  **Also closed**: `inventory_create_draft` now rejects manual creation
  of any movement type with `allows_manual_entry = false` (currently only
  `900`, the system reversal type), per the explicit "system-only
  movement types must not become manually creatable" requirement.

  **Live-caught defects, fixed forward, BOTH caught before any live
  exploit or regression re-ran with the "final" fix in place**:
  1. **Self-caught, fixed before any test ran**: the FIRST version of the
     system-type guard used `is_system OR NOT allows_manual_entry`. Live
     inspection (`SELECT code, is_system, allows_manual_entry FROM
inventory_movement_types`) — performed proactively, not prompted by
     a failure — showed `is_system=true` for EVERY seeded catalog type
     (101, 401, 402, 801, AND 900), not just 900; `allows_manual_entry`
     is the only column that is actually `false` exclusively for 900.
     The first guard would have rejected manual creation of every
     movement type in the system, including the legitimate 101/401/402/
     801 flows — caught by direct live inspection and smoke-tested
     (101/401 drafts confirmed still succeed, 900 confirmed still
     rejected) before writing a single pgTAP assertion, fixed the same
     session via a second forward migration.
  2. **Caught by the regression suite itself**: `103_ic2_movement_
reversal_test.sql`'s own Scenario E (added in the prior IC-2
     security-correction pass) previously ran AFTER Scenario C's own
     final negative test, which permanently strips the shared `e2e_user`
     actor's inventory permission for the REST of that file's shared
     transaction (the established, already-documented convention:
     `user_effective_permissions` has no wildcard row, so a `DELETE` is a
     permanent, org-wide mutation). Scenario E's own `inventory_create_
draft` call previously succeeded regardless, since that function had
     no permission check to trip before this pass. Now that it correctly
     does, running 103 in full surfaced a genuine `42501` at Scenario E's
     own draft-creation call. Diagnosed (not assumed) by reading the
     exact failing line; fixed by REPOSITIONING the entire Scenario E
     block to run immediately after Scenario D — mirroring Scenario D's
     own already-established "run before Scenario C's strip" pattern —
     with every one of Scenario E's own assertions, fixture values, and
     lines of logic left byte-for-byte unchanged. Re-run confirmed 35/35.

  **Post-fix exploit replay** (required evidence, not merely pgTAP-level
  assertions): the EXACT original attack (unauthenticated `anon`,
  arbitrary fresh org/branch, 777 units, via `inventory_create_and_
finalize`) was replayed against the post-fix database in a fresh,
  transaction-scoped probe — rejected with `42501` (`permission denied
for function`, a grant-level denial, not even reaching the function
  body's own new checks), zero movement headers created, zero balance
  rows created — confirmed via direct query in the same probe.

  **Deliberately NOT fixed this pass** (recorded for the full IC-7 phase,
  per explicit scope, not silently expanded into): the posted-header GUC
  UPDATE bypass (IC-2's own prior finding — unrelated mechanism, not
  needed to close this pass's own P0); reservation/allocation raw-write
  RLS; container generic raw-write policies; the systemic `anon`
  default-privilege re-grant behavior — root cause CONFIRMED this pass
  (`pg_default_acl` shows `ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN
SCHEMA public GRANT EXECUTE ... TO anon, authenticated, service_role`
  is schema-wide, not movement-engine-specific — this is exactly why
  `CREATE OR REPLACE FUNCTION` keeps re-exposing `anon` on every replaced
  function) but deliberately NOT changed, since this database has other,
  unaudited, possibly-intentional public-facing RPC surfaces (QR
  platform, public warehouse maps migrations exist) whose own reliance on
  this same default privilege was not investigated this pass — altering
  a schema-wide default blind risked silently breaking unrelated
  functionality. Per the pass's own explicit fallback instruction, this
  is reported, not guessed at; each of this pass's own 4 migrations
  instead issues its own explicit, final `REVOKE`, matching the
  already-proven-safe IC-2 pattern.

  **Regression**: full pgTAP re-run this pass — 097 (29/29), 098 (17/17,
  re-verified via Supabase MCP after the known, disclosed connection-
  pooler GUC artifact hit the `psql` attempt), 099 (20/20), 100 (44/44,
  re-verified via Supabase MCP for the same known reason), 101 (17/17),
  102 (14/14), 103 (35/35, after the Scenario E repositioning fix above),
  104 (44/44), 105 new (29/29) — **249/249 total, 0 failures**. Vitest:
  288/288 (the same targeted Inventory/Zone3/CRM/PO subset as IC-3, plus
  `inventory-count-sessions.service.test.ts` specifically because this
  pass's own caller-graph audit centered on `inventory_approve_count_
session`). `pnpm type-check`: 0 errors (no TypeScript touched). `pnpm
lint`: 0 errors, 319 pre-existing unrelated warnings. `git diff
--check`: clean on every file this pass touched or modified.

  **Concurrency**: NOT re-run, reasoned. None of this pass's own checks
  add a new lock, change lock order, or change which rows any of the
  three hardened functions acquire — the new checks are pure validation
  inserted before (`inventory_create_draft`, `inventory_create_and_
finalize`) or immediately after (`inventory_finalize_posting_internal`,
  which already locked the header row first) each function's own
  pre-existing row acquisition. IC-1/IC-2/IC-3's own genuine two-session
  concurrency proofs remain valid evidence and were not repeated.

  **Migrations applied (4, forward-only, all mirrored locally under their
  exact live version/timestamp)**:
  1. `20260916050440_ic7a_harden_inventory_create_draft` — actor +
     permission checks added; the FIRST (overly-broad, self-caught)
     version of the system-type guard.
  2. `20260916050528_ic7a_harden_inventory_finalize_posting_internal` —
     actor + permission checks added to the shared finalize choke point;
     public `inventory_finalize_posting`'s own grants re-confirmed.
  3. `20260916050557_ic7a_harden_inventory_create_and_finalize` — actor +
     permission checks added directly, as defense in depth.
  4. `20260916050815_ic7a_fix_system_type_guard_overly_broad` —
     corrective, live-caught defect #1 above.

  **Documentation updated**: `inventory-core-architecture.md` gained a
  new §9A ("IC-7A — Emergency Movement Engine Security Boundary
  Closure," full finding/fix/evidence narrative) and had §9's own
  CRITICAL table row updated from "NOT fixed" to "CLOSED" with a pointer
  to §9A. `inventory-core-implementation-plan.md` gained a new,
  explicitly out-of-roadmap-order "IC-7A" section positioned between IC-3
  and IC-4, plus a note on the full IC-7 section clarifying that only
  this one item closed early — IC-7 itself remains NOT done. This file's
  own phase-tracker row (inserted between IC-3 and IC-4) and
  overall-execution summary updated.

  **IC-7A review bundle**: `docs/inventory/reviews/
ic-7a-movement-engine-security-review/`.

  **IC-7A is DONE.** The full IC-7 phase remains NOT done — only this one
  CRITICAL item closed early. IC-4 is NOT started. Phase 10D is NOT
  started.

- **2026-09-16 (IC-4 — Branch Transfer / MMJ Rebuild — DONE)**: rebuilt
  the branch-transfer lifecycle end-to-end per a closed product-owner
  decision, stated verbatim in the assigning brief: `in_transit` MUST
  mean the goods have physically left the source branch, never merely
  reserved. Live-verified before writing any migration (not trusted from
  the pre-IC-1 audit) that this was, at the time, genuinely NOT what the
  live database did — `inventory_create_branch_transfer` set `status=
in_transit` at creation time with stock only reserved, never physically
  moved.

  **Live findings before writing any code** (fresh, not trusted from the
  old audit): `inventory_accept_branch_transfer` and `inventory_decline_
branch_transfer` were both genuinely broken beyond the audit's own
  finding — both hand-wrote `inventory_movement_headers`/`_lines`/
  `inventory_balances` directly, bypassing the canonical engine entirely
  (`accept` additionally crashed on a nonexistent `inventory_allocate_
movement_number`; both would additionally violate `NOT NULL` columns
  the old audit predicted). `decline` additionally hand-wrote an
  automatic "return" movement for the case where the transfer had
  already shipped — forbidden by the new product decision (post-shipment
  discrepancy must be represented by partial acceptance, never an
  automatic reversal). A genuinely NEW, previously undisclosed finding:
  both old RPCs carried live `anon` EXECUTE, and `inventory_create_
branch_transfer` itself (`SECURITY INVOKER` at the time) never checked
  `p_actor_user_id` against `auth.uid()` at all — the exact class of gap
  IC-7A closed on the generic movement engine, now found on a completely
  different set of functions outside IC-7A's own narrow scope.

  **Final lifecycle, implemented exactly**: `prepared` (reserved, not
  shipped) → `in_transit` (real `311` movement posted via the new
  `inventory_send_branch_transfer`) → `accepted` | `partially_accepted`
  (real `312` movement posted for the accepted quantity via the rebuilt
  `inventory_accept_branch_transfer`, any shortfall persisted as an
  `inventory_branch_transfer_discrepancies` row, arithmetic-CHECK-
  enforced, never auto-adjusted back to source) → `declined` (destination,
  pre-shipment only) | `cancelled` (source, pre-shipment only, new
  dedicated `inventory_cancel_branch_transfer`). Post-shipment decline/
  cancel are hard-rejected (`P0007`) — no automatic return movement
  anywhere in the code path.

  **Movement-type catalog decision**: `311` (Inter-Branch Transfer Out)
  redefined, not retired — live-reconfirmed `0` posted headers ever
  existed for it immediately before the change, and its own pre-existing
  type-catalog effect (source `on_hand` decrease) was already exactly
  the correct physical semantics; only `allows_manual_entry` flipped to
  `false` (system-managed, posted exclusively by the new orchestration
  RPC). New `312` (Inter-Branch Transfer In) seeded via the same
  idempotent per-org seed function IC-2 extended for `900`/`KOR`,
  destination `on_hand` increase, backfilled for all 4 existing
  organizations.

  **The reservation-consumption ordering, proven exactly**: `inventory_
send_branch_transfer` decrements `inventory_balances.reserved_quantity`
  and increments `reservation_lines.fulfilled_quantity` BEFORE calling
  `inventory_finalize_posting_internal` to post the physical decrease —
  in the SAME transaction, atomically — this is what allows the decrease
  down to exactly the committed boundary without spuriously tripping
  IC-1's own P0003 invariant against its own reservation, and what makes
  a failed post roll back the reservation consumption too (no
  intermediate "unreserved but not shipped" state is reachable). Both new
  orchestration RPCs post through `inventory_finalize_posting_internal`
  with `p_explicit_effects=NULL` (reusing `311`/`312`'s own type-catalog
  effects) — IC-2's frozen "explicit effects only for movement type 900"
  contract was not reopened. `311`/`312` are `allows_manual_entry=false`,
  so they cannot go through `inventory_create_draft`'s own public path
  (its manual-entry guard, added in IC-7A, applies unconditionally
  regardless of caller identity) — both new RPCs instead build the
  movement header/lines directly and call the internal primitive, the
  exact same pattern `inventory_reverse_movement` already established
  for movement type `900`.

  **Live proof, full lifecycle** (exact worked example from the assigning
  brief, matched precisely): source 10 → transfer 6 → after create:
  on*hand=10 (unaffected), reserved=6, status=`prepared` → after send:
  on_hand=4, reserved=0, status=`in_transit`, `source_movement_id` set →
  after accept: destination on_hand=6, status=`accepted`, `destination*
  movement_id` set.

  **Live proof, partial accept**: source 10, transfer 6, send leaves
  source at 4; destination accepts only 4 → destination on_hand=4 (not
  6), status=`partially_accepted`, a discrepancy row persisted
  (sent=6, accepted=4, missing=2) — the missing 2 units are never
  recreated at source, never removed, never counted as destination
  stock, and remain visible/queryable indefinitely (no auto-resolution
  workflow invented, matching the explicit "no auto-invented claims/loss
  workflow required beyond persisting the discrepancy" instruction).

  **Live proof, pre-shipment decline/cancel**: both release the
  reservation in full (`inventory_balances.reserved_quantity` restored,
  `inventory_reservations.status='cancelled'`), post zero movements, and
  reach their own distinct terminal status (`declined` for destination-
  initiated, `cancelled` for source-initiated). **Live proof, post-
  shipment rejection**: both `inventory_decline_branch_transfer` and
  `inventory_cancel_branch_transfer` reject an already-`in_transit` (or
  later) transfer with `P0007`, with zero stock movement of any kind —
  no automatic return/reversal.

  **Live proof, negative/security paths**: NULL actor rejected `28000`
  on all 5 RPCs; actor impersonation (a different, real user's UUID
  supplied as `p_actor_user_id` by a session authenticated as someone
  else) rejected `28000` on create/send; no-permission actor rejected on
  create (`42501`) and, for send/accept, `P0002` (no existence leak,
  matching this project's own established convention); cross-org
  mismatch and same-source/destination-branch rejected; `anon` EXECUTE
  denied on all 5 RPCs (`42501`, grant-level, before any body logic
  runs); raw-write denial on `inventory_branch_transfers`/`_lines`/
  `_discrepancies` for a real, permissioned `authenticated` actor (a
  genuine Postgres RLS nuance surfaced and fixed here: a RESTRICTIVE
  `USING(false)` policy makes `UPDATE` silently match zero rows rather
  than raise, unlike `INSERT`'s `WITH CHECK`, which does raise — the
  pgTAP file's own first version incorrectly asserted an exception for
  the UPDATE case and was corrected to assert `ROW_COUNT=0` instead,
  caught by the regression run itself before the file was considered
  final).

  **Idempotency, live-proven via genuine two-connection concurrency, not
  merely sequential re-calls**: double-send — Session A's send succeeded
  in 36ms then held its transaction open 4s; Session B blocked for
  2672.7ms on the transfer row's own lock, then correctly rejected
  `P0007` against the now-`in_transit` status; exactly one `311` movement
  exists. Double-accept — Session A's accept succeeded in 986ms then
  held 4s; Session B blocked for 3778.7ms, then returned the SAME
  `destination_movement_id` with `already_processed: true` (the RPC's
  own idempotent status short-circuit); exactly one `312` movement
  exists. Accept-vs-generic-movement contention — Session A posted an
  ordinary `401` adjustment against the SAME destination bucket a
  pending accept was targeting, held 4s; Session B (the accept) blocked
  for 2628.9ms on the shared `inventory_balances` row lock (the same
  `inventory_get_or_create_balance_for_update` primitive every canonical
  movement path already uses — no new lock-ordering logic introduced),
  then both succeeded, correctly serialized, no deadlock. All three real
  `psql`-process pairs, real wall-clock timing, not one transaction
  pretending to be concurrent.

  **IC-1 commitment protection for branch transfers specifically, not
  merely assumed inherited**: an unrelated commitment (`allocated_
quantity`, simulating a second, independent reservation/allocation) on
  the SAME bucket as a transfer's own reservation causes `inventory_
send_branch_transfer` to be rejected `P0003` — source `on_hand`
  provably unchanged after the rejection.

  **Same-SKU line independence**: two transfer lines sharing the same
  variant but different source locations, correlated exclusively by
  `transfer_line_id` (never SKU/variant) through partial accept — each
  line's own accepted quantity and discrepancy computed and persisted
  independently.

  **Reversal compatibility, deliberately distinguished**: the source
  `311` movement is physically reversible via the unmodified `inventory_
reverse_movement` (IC-2's own RPC) — live-proven. Reversing it does
  **not** auto-change the transfer's own business `status` (remains
  `accepted`) — proving "physical movement reversibility" and "business
  transfer-lifecycle reversal of an already-accepted transfer" are
  distinct, and the latter is deliberately NOT exposed, per explicit
  instruction.

  **311 final disposition**: redefined (not retired, not replaced by a
  fresh code) — zero live rows made this safe, and its own pre-existing
  physical semantics were already exactly correct; only its manual-entry
  flag changed. No historical migration file was deleted or edited.

  **Two live-caught, self-caught defects, both fixed forward (never
  editing an already-applied migration)**:
  1. A redundant `UNIQUE(id, organization_id)` constraint was added to
     satisfy the new discrepancies table's own composite FK, without
     first checking whether an equivalent constraint already existed —
     it did (`inventory_branch_transfers_id_org_uidx`, from an earlier,
     IC-4-unrelated migration). Caught via a live `pg_indexes` check
     immediately after applying the migration that added it; dropped in
     a same-day forward migration; the composite FK still resolves
     against the pre-existing index.
  2. `inventory_accept_branch_transfer`'s own 4th-parameter addition
     (`p_line_acceptances`) created a NEW, additional overload rather
     than replacing the original 3-arg signature — this project's own
     recurring, previously-documented pitfall, hit again here. The
     stale 3-arg overload was the OLD, broken, still-`anon`-exploitable
     version. Caught via a live `pg_proc` overload check immediately
     after applying the migration; dropped in a same-day forward
     migration; re-verified exactly one overload survives.

  **Three self-caught pgTAP-assertion bugs** (in the new test file's own
  assertions, not in any RPC — all caught by the regression run itself
  before the file was considered final, all disclosed and fixed): a
  `numeric`-vs-string comparison mismatch (`"4"` vs. the correct `"4.
000000"`); an absolute-balance assertion that didn't account for an
  earlier scenario's own prior effect on the SAME shared bucket (fixed
  to assert the correct cumulative value); and the RESTRICTIVE-UPDATE-
  is-silent-not-raising nuance described above.

  **TypeScript layer, per explicit "no UI work, extend rather than
  duplicate" instruction**: `InventoryEnterpriseService` gained `send
BranchTransfer`/`cancelBranchTransfer`; `acceptBranchTransfer` gained
  an optional `lineAcceptances` parameter. New `sendInventoryBranchTransfer
Action`/`cancelInventoryBranchTransferAction`; `acceptInventoryBranchTransfer
Action` passes `line_acceptances` through. New Zod schemas (`sendBranchTransferSchema`/
  `cancelBranchTransferSchema`; `acceptBranchTransferSchema` extended).
  Two new audit-event-registry entries (`.sent`/`.cancelled`); `.accepted`'s
  own metadata schema gained an optional `partial` flag. `createBranchTransfer`/
  `listBranchTransfers` and their own actions untouched. No component/page
  code touched.

  **Migrations applied (12, forward-only, all mirrored locally under
  their exact live version/timestamp)** — more than the plan's own
  original 3-5 estimate, disclosed: the estimate predated the live audit
  that found the accept/decline RPCs completely broken (not merely
  missing a handshake), requiring a materially larger rebuild (a new
  movement type, a new discrepancy table, 2 new RPCs):
  1. `20260916065129_ic4_branch_transfer_status_lifecycle`
  2. `20260916065136_ic4_branch_transfer_lines_sent_accepted_quantity`
  3. `20260916065147_ic4_branch_transfer_discrepancies_table`
  4. `20260916065209_ic4_fix_redundant_id_org_unique_constraint` —
     corrective, defect #1 above.
  5. `20260916065249_ic4_seed_movement_type_312_transfer_in`
  6. `20260916065315_ic4_rebuild_inventory_create_branch_transfer`
  7. `20260916065326_ic4_branch_transfer_tables_restrictive_rls`
  8. `20260916065347_ic4_inventory_send_branch_transfer`
  9. `20260916065426_ic4_rebuild_inventory_accept_branch_transfer`
  10. `20260916065435_ic4_drop_stale_accept_branch_transfer_overload` —
      corrective, defect #2 above.
  11. `20260916065452_ic4_rebuild_inventory_decline_branch_transfer`
  12. `20260916065504_ic4_inventory_cancel_branch_transfer`

  **Full regression**: pgTAP 097 (29/29), 098 (17/17), 099 (20/20, via
  MCP after a known, disclosed connection-pooler GUC artifact hit the
  `psql` attempt), 100 (44/44, same reason), 101 (17/17), 102 (14/14),
  103 (35/35), 104 (44/44), 105 (29/29), 106 new (60/60) — **309/309
  total, 0 failures**. Vitest: targeted branch-transfer/event-registry
  suite (876/876), `repair-orders.service.test.ts` (159/159), broader
  sweep across services/actions/audit (2198/2198 relevant, 2 pre-
  existing unrelated failures verified via a stash-and-rerun-on-baseline
  check). `pnpm type-check`: 0 errors (one real, self-caught `zod`-
  inferred-optional-field issue fixed along the way — the same class of
  `strictNullChecks` narrowing gap this project has hit before). `pnpm
lint`: 0 errors, 319 pre-existing warnings, byte-identical to IC-7A's
  own baseline. `git diff --check`: clean.

  **IC-4 review bundle**: `docs/inventory/reviews/ic-4-review/`.

  **IC-4 is DONE.** IC-5 is NOT started. Full IC-7 remains NOT done.
  Phase 10D is NOT started.

- **2026-09-16 (IC-4 — NARROW CORRECTION PASS, same day)**: external
  review of the IC-4 diff found three correctness gaps, all in
  `inventory_accept_branch_transfer`/its own action layer, closed in
  one new forward migration plus a TypeScript fix — the accepted
  lifecycle/architecture was not reopened.

  **BLOCKER, live-reproduced and fixed**: the function unconditionally
  created a draft `312` movement header before evaluating any line's
  own accepted quantity. When a receipt was 100% missing (every line's
  accepted quantity resolved to `0` — the source had already physically
  shipped via `311`, destination received nothing), the RETURNED
  `destination_movement_id` and the transfer row's own column were both
  correctly `NULL`, but the already-inserted draft header row itself
  was never removed — a permanent orphan draft, with the discrepancy
  row's own `destination_movement_id` pointing at it. Live-reproduced
  exactly before any fix (`orphan_312_header_count=1`, `status=draft`,
  discrepancy pointing at that same orphan id). Fixed by restructuring
  so the header is created **only if** the transfer-wide total accepted
  quantity is `> 0`, decided via one set-based query before any
  mutation. Post-fix: zero headers, zero movement lines, `destination_
movement_id` NULL everywhere, idempotent retry confirmed creates
  nothing later.

  **Explicit-payload contract made fail-closed**: `p_line_acceptances`,
  when non-NULL, previously defaulted any omitted line to full
  acceptance and silently ignored unknown `transfer_line_id`s. Now
  validated in full — no duplicate, no unknown/foreign id, exactly one
  entry per real transfer line, every quantity numeric and in range —
  BEFORE any mutation (including the destination-location `UPDATE`,
  which itself needed moving after validation). Any violation rejects
  `22023` with zero mutation. Live-proven: 4 negative probes (missing
  line, unknown id, duplicate id, foreign-transfer id) all rejected with
  zero mutation of any kind.

  **Audit-event `partial` metadata fixed**: was derived from
  `Boolean(parsed.data.line_acceptances?.length)` (the shape of the
  caller's own input) rather than the RPC's own result status — an
  explicit payload that fully accepts every line was being mis-reported
  as partial. Now derived from `result.data.status ===
'partially_accepted'`.

  **New migration (1, forward-only)**:
  `20260916170438_ic4c_fix_orphan_draft_and_strict_partial_accept` —
  `CREATE OR REPLACE` on `inventory_accept_branch_transfer`, same 4-arg
  signature (no overload risk), re-verified live: exactly one overload,
  `anon=false`/`authenticated=true`/`service_role=true`.

  **`106_ic4_branch_transfer_test.sql` extended** (not replaced):
  `plan(60)` → `plan(87)`. New Scenario Q (16 assertions — 100%-missing
  receipt, no orphan header, discrepancy link NULL, idempotent retry)
  and Scenario R (11 assertions — the four negative-payload cases plus
  exact-complete full/partial explicit payloads). One self-caught test-
  fixture sizing bug (a stock-shortage error from an under-sized seed
  receipt) fixed before the file was considered final.

  **New Vitest file**:
  `branch-transfer-accept-partial-event.test.ts`, 4/4 passing, proving
  the `partial` flag tracks the RPC's own result status in all four
  input/outcome combinations.

  **Full regression**: pgTAP 097 (29/29), 098 (17/17, via MCP — hit the
  known, disclosed, intermittent connection-pooler GUC artifact via
  `psql` this run, a different file than the original pass hit,
  confirming the artifact is genuinely intermittent), 099/100 not
  re-run (unaffected by this correction's own scope), 101-105
  unaffected, 106 new total 87/87 — **336/336 total, 0 failures**.
  Vitest: 1880/1899 relevant pass (2 pre-existing, unrelated failures,
  same two already identified and stash-verified in the original IC-4
  pass). `pnpm type-check`: 0 errors. `pnpm lint`: 0 errors, 319
  pre-existing warnings (unchanged). `git diff --check`: clean.
  **`pnpm build`: succeeded** (run this time since application/action
  TypeScript code changed).

  **Bundle**: `docs/inventory/reviews/ic-4-review/` refreshed in place
  (not superseded by a new bundle), matching this project's own
  established convention from IC-1's own external-review correction
  pass.

  **IC-4 remains DONE, now with this correction applied.** IC-5 is NOT
  started. Full IC-7 remains NOT done. Phase 10D is NOT started.

- **2026-09-16 (IC-5 — RepairOrder Physical Projection Consolidation —
  DONE)**: IC-0/1/2/3/4/7A treated as ACCEPTED/FINAL and NOT reopened,
  per explicit instruction; IC-6, full IC-7, IC-8, and Phase 10D
  deliberately NOT started. Starting-state check: HEAD still `97f0e9d9`
  (`ic7a`) with IC-4 + its own correction pass present only as
  uncommitted working-tree changes (consistent with the standing
  no-auto-commit rule, not a bug — flagged explicitly and treated the
  live, already-migrated database plus the uncommitted tree as
  authoritative, matching every prior phase in this project).

  **Problem statement**: the Zone-5 projection
  (`repair_order_line_locations` + `repair_order_location_attribution_
uncertain`) predates the final Inventory Core architecture. IC-2 had
  already found and patched one concrete corruption risk (movement
  reversal) via the `ambra.repair_order_attribution_authoritative` GUC,
  but that GUC was explicitly only a temporary safety boundary — it
  prevented corruption by making reversal simply SKIP projection
  updates, which left the projection correct-but-STALE after any
  reversal. IC-5's job was to eliminate that debt with one coherent
  derivation model, not merely re-patch the symptom.

  **Live writer/reader graph reconstruction** (read fresh from the
  live function/trigger bodies, not from memory or the task's own
  framing): three explicit concepts confirmed — (A) physical truth =
  the canonical `inventory_balances`/`inventory_stock_ledger_entries`
  ledger; (B) business attribution = `repair_order_line_movement_links`
  (already fully closed to raw writes since an earlier IC-2-era
  migration); (C) the location projection
  (`repair_order_line_locations` + its own UNKNOWN marker table),
  DERIVED from A+B. `attach_repair_order_line_movement` reconfirmed as
  the sole canonical attribution writer — it writes ONLY to (B), and
  (this was the first genuinely new gap found) never touched (C) at
  all before this pass. The existing `repair_order_location_
attribution_sync` trigger was found to already be considerably more
  sophisticated than the task's own framing implied — a
  confidence-based inference heuristic for generic movements, and
  destination-UNKNOWN stickiness for putaway, were BOTH already
  correctly implemented pre-IC-5. This narrowed the real required
  scope to: (a) reversal-awareness (the explicitly named target), plus
  (b) two genuinely new, previously undisclosed gaps found by
  cross-referencing every writer against every table
  (`attach_repair_order_line_movement`'s own missing sync;
  `putaway_repair_order_stock`'s own invisible relocations) — both
  squarely inside IC-5's own stated goal ("ONE coherent derivation")
  even though not individually named in the task text.

  **Derivation model chosen**: BOTH an incremental fast path (the
  existing trigger + attach, both now projection-consistent) AND an
  authoritative deterministic rebuild path, per the task's own stated
  preference. New `rebuild_repair_order_projection_bucket_internal
(org, branch, location, variant)` (internal-only, `SECURITY DEFINER`,
  EXECUTE revoked from `PUBLIC`/`anon`/`authenticated`/`service_role`)
  locks the bucket via the SAME `inventory_balances ... FOR UPDATE`
  every other writer already acquires (no new lock primitive), deletes
  and fully recomputes every RepairOrderLine's own known quantity at
  that bucket from a single prorated ledger-join over `repair_order_
line_movement_links` (`applied_quantity / movement_line.quantity`
  fraction of each ledger effect, summed with sign by
  `sle.direction`), hard-errors `P0008` (new SQLSTATE) if any line's
  own net quantity would be negative or if total known attribution
  would exceed physical on-hand — NEVER clamped via `greatest(0,...)`,
  per the explicit no-clamp requirement — and sets/clears the UNKNOWN
  marker based on whether total known attribution is strictly less
  than physical on-hand. A new public wrapper,
  `rebuild_repair_order_location_projection(actor, org, branch,
repair_order_id)` (actor+permission checked, `.operate` or `.adjust`,
  `anon` revoked), finds every bucket a given RepairOrder's own
  attribution history has ever touched and rebuilds each. Scope chosen
  at the RepairOrder level (matching actual usage — the public API
  operates per-RepairOrder; the internal primitive operates per-bucket
  for the incremental/reversal callers).

  **Reversal made projection-aware WITHOUT touching the generic
  engine**: `inventory_reverse_movement` itself was read in full and
  confirmed completely unchanged — it copies `source_location_id`/
  `destination_location_id` verbatim and only inverts `direction`,
  remaining fully RepairOrder-agnostic. All new reversal-awareness
  lives in the trigger: on a `direction='decrease'` ledger row
  belonging to a reversal movement (detected via `original_movement_id
IS NOT NULL` on the header), it finds the ORIGINAL movement line via
  exact `line_number` ordinal correlation (never SKU/field matching —
  this project's own established contract), mirrors that original
  line's own `'receipt'`/`'issue'`/`'relocation'`-typed attribution
  links onto the reversal's own movement line as new `'reversal'`-typed
  links (one per original link, so split-attribution reversal — one
  movement line, multiple RepairOrderLines — is preserved exactly,
  never merged/whole-assigned), then calls the SAME deterministic
  rebuild primitive for both the reversal's own source and (if present)
  destination buckets. This makes "rebuild equals incremental" true BY
  CONSTRUCTION for the reversal case specifically, not merely true by
  separate testing. Live-proved before any pgTAP was written: the
  original bug (projection stayed stale after reversal); the fix
  (projection correctly zeroes and a mirroring `'reversal'` link is
  created); split-attribution correctness (two lines' own reversal
  links each carry their own exact original `applied_quantity`, never
  merged).

  **Two genuinely new gaps found and closed** (both self-caught during
  design, before any pgTAP ran):
  1. `attach_repair_order_line_movement` wrote ONLY to (B), never to
     (C) — closed by adding an auto-rebuild call for the relevant
     bucket after a successful link insert.
  2. `putaway_repair_order_stock`'s own relocations wrote NO
     attribution-link row at all (by original design: "putaway is a
     relocation, not a business-quantity event") — which meant the new
     rebuild formula, relying entirely on links, was blind to putaway
     history. Live-caught while proving rebuild-equals-incremental: a
     full-order rebuild after receipt+putaway raised `P0008`
     ("known attribution (15) exceeding physical on_hand (10)") because
     the rebuild kept counting the original receipt as if the putaway
     had never happened. Fixed by extending the `relation_type` CHECK
     to add `'relocation'` and making putaway write one `'relocation'`-
     typed link per line, referencing its own posted movement line —
     the existing rebuild formula then picks up the SAME movement
     line's own two ledger effects (source-decrease +
     destination-increase) automatically, with zero special-casing.

  **Self-caught correlation bug** (found during design, before any
  test ran): the first draft of putaway's own relocation-link write
  correlated each input line to its own posted movement line via a
  field-value match (source/destination/variant/quantity all equal,
  `LIMIT 1`) — unsafe if two different RepairOrderLines putaway the
  identical quantity of the identical variant to the identical shelf
  in one call. Fixed to this project's own established ordinal-
  correlation contract: `array_agg(id ORDER BY line_number)` fetched
  once after the engine call, indexed by the input array's own
  1-based position — never by field value, never by SKU.

  **Live-caught, regression-suite-caught double-write defect** (the
  most significant self-caught bug this phase): after gap #1's fix
  went live, running the FULL regression suite (not the new `107_...`
  file) surfaced clean failures in 101 and 104 ("have 20, want 10").
  Root cause: `receive_repair_order_stock` calls `attach_repair_order_
line_movement` internally, then performs its OWN direct additive
  UPSERT into `repair_order_line_locations` immediately afterward —
  attach's own new auto-rebuild already set the quantity correctly,
  so receive's own subsequent `+= EXCLUDED.quantity` UPSERT added a
  second copy on top. Fixed by gating attach's own auto-rebuild behind
  the SAME `ambra.repair_order_attribution_authoritative` GUC receive/
  putaway already set around their own orchestrated calls — reusing
  the existing "defer to the orchestrating caller" signal rather than
  inventing a new mechanism. Re-ran 101 (17/17) and 104 (44/44) clean
  after the fix.

  **UNKNOWN semantics**: reconfirmed unchanged and correct — bucket-
  scoped, sticky (a later known contribution never clears an existing
  UNKNOWN marker at the same bucket — proven live in pgTAP Scenario I),
  known and unknown quantities can coexist at the same bucket.
  Putaway's own pre-existing hard rejection on an UNKNOWN source was
  preserved byte-for-byte (not reopened).

  **Invariants added**: `CHECK (quantity >= 0)` on `repair_order_line_
locations` (zero live rows at the time, confirmed safe before
  applying). New SQLSTATE `P0008` for rebuild-detected inconsistency
  (negative net quantity or over-attribution) — always a hard error,
  never a silent clamp, per the explicit no-`greatest(0,...)`
  requirement; an audit of all existing clamping logic found none to
  remove (the pre-existing code already avoided clamping).

  **Raw-write closure**: explicit RESTRICTIVE deny INSERT/UPDATE/
  DELETE policies added to both `repair_order_line_locations` and
  `repair_order_location_attribution_uncertain` (both previously had
  only a SELECT policy — implicit-deny was already in effect; this
  makes it explicit/self-documenting, matching this project's own
  established closure convention).

  **IC-2 GUC disposition**: `ambra.repair_order_attribution_
authoritative` is RETAINED, not removed — it remains the correct
  "defer to the orchestrating caller" signal used by receive/putaway
  AND now by attach's own guarded auto-rebuild. What changed is that
  reversal no longer relies on it to silently skip projection updates
  forever; reversal now takes the reversal-aware branch BEFORE the GUC
  check and actively rebuilds the projection. The staleness compromise
  is eliminated; the GUC itself is not scheduled for removal.

  **Trigger disposition**: retained-and-extended (not replaced, not
  retired) — `repair_order_location_attribution_sync` gained a new
  reversal-detection branch ahead of its existing logic; all pre-
  existing generic-inference/putaway-suppression logic left byte-for-
  byte unchanged.

  **Transactional consistency**: all projection updates (incremental
  and rebuild) happen inside the SAME transaction as the triggering
  write (trigger-driven or same-function `PERFORM` calls) — no
  separate later step.

  **Concurrency**: no dedicated two-connection test performed. The
  rebuild primitive reuses the SAME `inventory_balances ... FOR UPDATE`
  row lock every other movement-posting writer in this project already
  acquires before mutating a bucket — this structurally serializes any
  two rebuild/incremental writers touching the same bucket, so a
  genuine race does not exist to prove; documented as a lock-path
  argument rather than fabricating an unnecessary test, per the task's
  own "only if a genuine race exists" allowance.

  **Existing live projection data**: confirmed live, read-only, that
  BOTH projection tables held zero rows at the start of this phase —
  trivializing the required drift/backfill analysis (nothing to drift-
  check, nothing to backfill, explicitly disclosed rather than silently
  assumed).

  **Migrations** (11 total, all applied live via MCP, live-verified via
  `pg_get_functiondef`/`pg_proc` overload checks/`has_function_
privilege` after every apply, mirrored locally under the exact live
  timestamp): `20260916182701` (quantity >= 0 CHECK), `20260916182708`
  (RESTRICTIVE deny RLS on both projection tables), `20260916182731`
  (`rebuild_repair_order_projection_bucket_internal`), `20260916182747`
  (public `rebuild_repair_order_location_projection` RPC),
  `20260916182821` (trigger reversal-awareness, v1), `20260916183020`
  (attach auto-sync, v1 — later corrected), `20260916184159`
  (`relocation` added to the `relation_type` CHECK), `20260916184230`
  (putaway relocation-link write, v1 — later corrected),
  `20260916184329` (putaway relocation-link write, corrected —
  ordinal correlation), `20260916184357` (trigger reversal-mirroring
  extended to include `relocation`), `20260916185523` (attach auto-
  sync, corrected — GUC-guarded against double-write). Both buggy-then-
  corrected pairs mirrored locally as separate forward migrations, per
  strict never-edit-an-applied-migration discipline.

  **New pgTAP**: `107_ic5_repair_order_projection_test.sql`, `plan(33)`,
  final 33/33. Scenarios A-P cover: known receipt + same-SKU
  independence (A/B), multi-location independence (C), full putaway
  (D), genuine partial putaway (E), attributed reversal (F),
  split-attribution reversal (G), UNKNOWN source hard-rejection (H),
  destination-UNKNOWN stickiness under a new known contribution (I),
  partial/unattributed remainder represented as UNKNOWN (J),
  rebuild-equals-incremental (K), rebuild idempotency (L), raw-write
  denial on both tables (M), cross-org rejection on the rebuild RPC
  (N), no-negative-projection hard-error under a fabricated history
  inconsistency (O), receive/putaway rollback atomicity on an
  over-quantity attempt (P). One test-harness-only defect found and
  fixed (NOT a production bug, fully disclosed as such): `set_config
(..., true)` persists for the rest of the CURRENT TRANSACTION, not
  merely the calling function — within this file's own single shared
  `BEGIN...ROLLBACK` pgTAP transaction, the authoritative GUC set by
  one scenario's own putaway/reversal call leaked forward into later
  scenarios' own standalone attach calls, requiring three explicit
  `set_config(..., 'off', true)` resets inserted into the file. In
  real production usage each RPC call is its own transaction, so this
  leak cannot occur outside a shared-transaction test harness.

  **Worked-example proof** (live-performed during design/testing,
  mechanically equivalent to the task's own required example): receipt
  of 10 units split 6/4 across two same-SKU lines, full putaway of one
  line's own 5-unit sub-receipt to a second shelf, state checked at
  each step, full-order rebuild run and found byte-identical to the
  incremental result, then reversal performed and the rebuilt
  projection re-verified to match the correct post-reversal net
  history (pgTAP Scenarios C/D/F/G plus ad-hoc live probes during
  design).

  **Full regression**: pgTAP 097 (29/29), 098 (17/17, spot-verified via
  MCP after hitting the already-known, already-disclosed intermittent
  connection-pooler GUC artifact — not exhaustively re-run beyond the
  spot-check, since zero code in this phase's own diff touches
  allocation/reservation/container logic), 099/100 (unaffected by this
  phase's own scope, not re-run beyond the earlier partial spot-check),
  101 (17/17, after the double-write fix), 102 (14/14), 103 (35/35),
  104 (44/44, after the double-write fix), 105 (29/29), 106 (87/87),
  107 (33/33, new) — **0 failures across every file cleanly run this
  pass.** Vitest: 1845/1863 relevant pass (1 pre-existing, already-
  established-as-unrelated `organization-rls.test.ts` mock-setup
  failure — the same one seen throughout this entire project session;
  zero TypeScript files touched in IC-5 at all, so this is expected).
  `pnpm type-check`: 0 errors. `pnpm lint`: 0 errors, 319 pre-existing
  warnings (unchanged baseline). `pnpm build`: not required this pass
  (no application/runtime TypeScript changed — IC-5 is entirely
  PL/pgSQL).

  **Documentation updated**: `inventory-core-architecture.md` gained a
  new §9C ("IC-5 — RepairOrder Physical Projection Consolidation")
  covering the full disposition of every topic above.
  `inventory-core-implementation-plan.md`'s own IC-5 section marked
  DONE with a summary pointing to §9C and the review bundle. This file
  (`inventory-core-progress.md`) updated: runtime-status header, phase-
  tracker row, overall-execution summary, and this change-log entry.

  **Bundle**: `docs/inventory/reviews/ic-5-review/`.

  **IC-5 is DONE.** IC-6 is NOT started. Full IC-7 remains NOT done.
  IC-8 is NOT started. Phase 10D is NOT started.

- **2026-09-16 (IC-5 — NARROW CORRECTION PASS, same day)**: external
  review of the IC-5 diff found two issues, both closed forward (no
  migration edited, no redesign).

  **Finding A (BLOCKER) — reversed putaway rebuilt the wrong bucket
  set.** The original reversal-aware trigger derived the buckets to
  rebuild from `NEW.location_id` (the single ledger row that happened
  to fire the trigger) plus `movement_line.destination_location_id` —
  for a relocation reversal, BOTH resolve to the SAME bucket (the
  destination), since the only `direction='decrease'` ledger row a
  relocation reversal produces is the destination-decrease effect
  (`inventory_reverse_movement` preserves `source_location_id`/
  `destination_location_id` verbatim and only inverts each effect's
  own direction). The trigger therefore rebuilt the destination bucket
  TWICE and never rebuilt the source/receiving bucket at all.

  **Live reproduction (before any fix)**: a fresh BEGIN/ROLLBACK
  fixture — receive 5 into Receiving, attach, full putaway 5 to
  Shelf-A, reverse the posted 801 putaway movement. Physical balances
  correctly restored (Receiving on_hand=5, Shelf-A on_hand=0) but the
  projection left Receiving stale at its pre-reversal value (0), while
  Shelf-A's own row happened to read correctly (absent/0) only because
  its own two contributing ledger effects (the original relocation's
  own +5 and the reversal's own mirrored −5) canceled out
  arithmetically — not because the right bucket was rebuilt. Links
  confirmed correct throughout (receipt=5, relocation=5, reversal=5).

  **Fix**: the reversal branch now derives BOTH affected buckets
  directly from the reversal movement LINE's own `source_location_id`/
  `destination_location_id` columns (never from `NEW.direction`/`NEW.
location_id`), and rebuilds each exactly once (guarded against
  `source = destination`). Live-reproduced fixed for both a FULL
  putaway reversal (Receiving restored to 5, Shelf-A absent/0) and a
  PARTIAL putaway reversal (Receiving restored from 2 to the full 5,
  Shelf-B absent/0) — both also proven byte-identical to a full-order
  rebuild.

  **Finding B — the "attach is the sole writer" claim was false.**
  After IC-5's own original pass, THREE functions directly INSERTed
  into `repair_order_line_movement_links`: `attach_repair_order_line_
movement` (receipt/issue), `putaway_repair_order_stock` (relocation,
  added by IC-5), and the reversal-aware trigger (reversal, added by
  IC-5). Closed by creating ONE narrow internal canonical writer,
  `write_repair_order_line_movement_link_internal(repair_order_line_id,
inventory_movement_line_id, applied_quantity, relation_type,
p_require_posted default true)` — internal-only (`SECURITY DEFINER`,
  hardened `search_path`, `EXECUTE` revoked from `PUBLIC`/`anon`/
  `authenticated`/`service_role`, reachable only via same-owner
  `SECURITY DEFINER` callers, no new client RPC exposed) — and
  refactoring all three call sites onto it. The internal writer owns
  every load-bearing GENERIC invariant applicable to every relation
  type (RepairOrderLine/movement-line existence, org/branch
  compatibility, posted status, variant compatibility where
  applicable, positive quantity, the global per-movement-line applied-
  quantity cap, duplicate/unique handling, the `relation_type` domain
  check). Relation-SPECIFIC validation stays in each caller: attach's
  own category/reference-type checks (receipt/issue), putaway's own
  exact ordinal correlation (relocation), the trigger's own "mirror an
  already-valid original link" trust (reversal) — none reimplemented
  inside the shared primitive. **Public contract frozen**: `attach_
repair_order_line_movement` still only accepts `relation_type IN
('receipt', 'issue')` — unchanged check, re-proven live (an
  authenticated caller submitting `'relocation'`/`'reversal'` is still
  rejected `22023`) — the system-owned relation types are reachable
  only through trusted domain orchestration (putaway, the trigger),
  never directly by an ordinary caller.

  **Self-caught defect during this correction** (found live, before
  the fix was considered final): the internal writer's own generic
  `status = 'posted'` check — correct and load-bearing for `attach`/
  `putaway` — broke the reversal trigger's own mirror call, because
  that call fires from the ledger-row INSERT INSIDE `inventory_
finalize_posting_internal`'s own effect-application loop, which
  happens BEFORE that same function flips the header's own status to
  `'posted'` (a pure timing artifact — the effect is already durably
  applied within the same transaction, and atomicity guarantees the
  header reaches `'posted'` or the whole transaction, including the
  mirrored link, rolls back together). The masked symptom: `inventory_
reverse_movement`'s own generic `WHEN OTHERS` catch-all rethrew the
  underlying `55000` as a opaque `P0001` ("Movement reversal failed
  unexpectedly"), requiring the internal writer's own body to be read
  directly to diagnose. Fixed via a narrow, explicit `p_require_posted`
  opt-out parameter (default `true`, preserving the check for every
  other caller unchanged — Phase-10 receipt/issue validation is NOT
  weakened), passed `false` only from the trigger's own reversal-mirror
  call site. Required one arity change (4 args → 5 args), handled via
  explicit `DROP FUNCTION` of the old 4-arg overload before creating
  the 5-arg replacement, per this project's own established forward-
  migration discipline — live-verified exactly one overload survives
  after each step.

  **Migrations** (6, all applied live via MCP, live-verified, mirrored
  locally under the exact live timestamp): `20260916201207` (internal
  writer, 4-arg, v1), `20260916201228` (attach refactor), `20260916
201300` (putaway refactor), `20260916201328` (trigger bucket-fix +
  internal-writer usage, v1), `20260916201516` (internal writer
  corrected to 5-arg with `p_require_posted`, old 4-arg overload
  explicitly dropped), `20260916201541` (trigger's reversal-mirror call
  updated to pass `p_require_posted => false`).

  **New pgTAP**: `107_...` extended with Scenario Q (full putaway
  reversal, source+destination projection, rebuild equality — 5
  assertions), Scenario R (partial putaway reversal, same — 5
  assertions), Scenario S (public attach relocation/reversal rejection
  — 2 assertions), Scenario T (internal writer unreachable directly —
  1 assertion). `plan(33)` → `plan(46)`, final 46/46.

  **Full regression**: 097 (29/29, re-run in FULL since this pass
  touches the Phase-10 attribution-write boundary), 098 (17/17), 099
  (20/20), 100 (44/44), 101 (17/17), 102 (14/14), 103 (35/35,
  `inventory_reverse_movement` reconfirmed RepairOrder-agnostic), 104
  (44/44, the original double-write fix reconfirmed unaffected), 105
  (29/29), 106 (87/87), 107 (46/46) — **382/382 total, 0 failures.**
  Relevant Vitest (RepairOrders, Zone 5, inventory movement, receiving,
  branch transfer): 217/217 pass. `pnpm type-check`: 0 errors. `pnpm
lint`: 0 errors, 319 pre-existing warnings (unchanged). `git diff
--check`: clean. `pnpm build`: not required (no application/runtime
  TypeScript changed — this correction, like the original IC-5 pass, is
  entirely PL/pgSQL).

  **Documentation updated**: `inventory-core-architecture.md` §9C's own
  writer-model bullet corrected (no longer claims attach is the sole
  writer) and a new "IC-5 Narrow Correction Pass" subsection appended
  covering both findings in full. `inventory-core-implementation-plan.
md`'s own IC-5 section note updated to mention the correction pass.
  This file (`inventory-core-progress.md`) updated: runtime-status
  header, phase-tracker row, this change-log entry.

  **Bundle**: `docs/inventory/reviews/ic-5-review/` refreshed in place
  (not superseded by a new bundle), matching this project's own
  established convention from IC-1's/IC-4's own external-review
  correction passes.

  **IC-5 remains DONE, now with this correction applied.** IC-6 is NOT
  started. Full IC-7 remains NOT done. IC-8 is NOT started. Phase 10D
  is NOT started.

---

- **2026-09-17 (IC-6 — Legacy Writer/Helper Removal)**: full "legacy
  writer/helper removal" cleanup/consolidation phase, per explicit
  instruction; full IC-7, IC-8, and Phase 10D explicitly NOT started.
  IC-0 through IC-5 and IC-7A remain ACCEPTED/FINAL, not reopened.

  **Starting-state gate**: HEAD found at `daeba1132b05295bb3a8221f6d
218e77bfb36487` ("ic6"), a clean, fully-committed tree containing
  exactly the IC-4/IC-5(-correction) file set (53 files, matches the
  prior session's own commit) — the commit's own label was pre-existing
  and not authored this session; flagged explicitly, confirmed it
  satisfies rather than violates the "IC-4/IC-5 must be committed"
  prerequisite, and that no actual IC-6 work existed in it yet (no
  `ic6_`-prefixed migrations, no `108_` file, no `ic-6-review/` bundle).

  **Call-graph audit**: a single broad live `pg_proc` query (~55
  Inventory-Core-pattern-matching functions, with signature/security*
  definer/owner/anon-exec/authenticated-exec/service-exec columns)
  plus targeted `prosrc` regex scans established the full picture.
  Confirmed already-absent: `inventory_allocate_movement_number`,
  `inventory_create_draft_movement`, `inventory_post_movement` (as
  distinct legacy helpers — the identically-named `inventory_post*
  movement`/`inventory_create_draft_movement` RPC names ARE still live,
  but as the CURRENT canonical primitives, not legacy predecessors,
  confirmed by reading their own bodies).

  **1. Old `inventory_v1_get_or_create_balance` — DROPPED.** Live
  `prosrc` scan across all of `pg_proc` found zero SQL callers; repo
  grep found zero TypeScript callers. `DROP FUNCTION` applied
  (`20260917062320_ic6_drop_dead_v1_balance_helper.sql`). Live-verified
  `to_regprocedure(...)` returns NULL post-drop.

  **2. Stale `inventory_get_or_create_balance_for_update` 5-arg
  overload — DROPPED, canonical 7-arg form unchanged.** A dedicated
  overload-duplicate-count query across every canonical Inventory
  function name found exactly one case of this. Both overload bodies
  were read and compared; all 6 real SQL callers (`inventory_create_
  reservation`, `inventory_create_allocation`, `inventory_release_
  reservation`, `inventory_release_allocation`, `inventory_finalize_
  posting_internal`, `inventory_send_branch_transfer`) were confirmed
  to use the 7-arg form exclusively. This was a genuine landmine: the
  7-arg form's own trailing 2 params both carry DEFAULTs, so a
  hypothetical future 5-positional-arg call would have silently
  resolved to the OLD, lot/serial-blind overload. `DROP FUNCTION`
  applied (`20260917062315_ic6_drop_stale_balance_helper_5arg_
  overload.sql`). Live-verified: 5-arg signature's `to_regprocedure`
  returns NULL, 7-arg signature unchanged, `pg_proc` count for the
  proname = 1.

  **3. `negative_stock_policy` — Option A chosen, column DROPPED
  entirely.** Re-verified zero TypeScript readers/writers (repo-wide
  grep). Went further than "unused" — proved the column's sole SQL
  reader (`inventory_finalize_posting_internal`'s own dead `IF v_new_
  qty < 0 AND v_settings.negative_stock_policy = 'block'` branch)
  structurally UNREACHABLE: `inventory_balances` carries `CHECK
  (reserved_quantity >= 0)`/`CHECK (allocated_quantity >= 0)`, so the
  P0003 "would strand committed stock" check immediately above the dead
  branch always fires first whenever `v_new_qty < 0`. Confirmed
  empirically by pgTAP 102's own pre-existing Scenario C (T7/T8), which
  already observed SQLSTATE P0003, never the dead branch's own bare
  RAISE, for both policy values. Fixed forward in two migrations: (1)
  `CREATE OR REPLACE inventory_finalize_posting_internal` removing only
  the 3-line dead conditional — the `SELECT * INTO v_settings ... FOR
  UPDATE` row-lock statement preserved byte-for-byte in its original
  position (IC-6 must not alter locking/concurrency behavior, and that
  lock serves purposes independent of this one field)
  (`20260917062247_...`); (2) `ALTER TABLE inventory_settings DROP
  COLUMN negative_stock_policy` (its own CHECK constraint dropped
  automatically) (`20260917062301_...`). Data-impact proof: exactly one
  live row, value `'block'` (the column's own DEFAULT) — no meaningful
  state lost. IC-1's own hard invariant completely unchanged.

  **Regression surfaced and fixed**: the full 097-107 pgTAP regression
  run (via a background agent, after the column drop) found that
  `102_ic1_reserved_only_hard_invariant_test.sql`'s own Scenario C
  directly `UPDATE`d the now-dropped `negative_stock_policy` column — a
  genuine SQL-to-SQL caller this audit's `prosrc`-scan methodology could
  not see (raw column references from pgTAP test files are not
  `pg_proc` bodies). The whole transaction aborted (`42703: column
  "negative_stock_policy" ... does not exist`) before reaching
  Scenarios A/B's own tally, making the entire file unscored — a real,
  disclosed consequence of Option A, not a silent breakage. Fixed by
  editing the TEST FILE (not a migration — test files are not subject
  to the immutable-migration rule): Scenario C's own two `UPDATE`-then-
  attempt passes (`'allow'`, `'block'`) were collapsed into one
  unconditional pass, since there is no longer a policy value to vary;
  the assertion set (rejected, SQLSTATE P0003, on_hand unchanged, no
  orphan header/ledger row) fully preserved; `plan(14)` reduced to
  `plan(11)`. Both the file's own top header comment and Scenario C's
  own comment block updated to record this history. Re-run live: 11/11,
  0 failures.

  **4. Legacy movement helpers (§6) — already absent, documented
  only.** `inventory_allocate_movement_number`, `inventory_create_
  draft_movement`, `inventory_post_movement` (as distinct legacy
  predecessors) do not exist in `pg_proc` at all.

  **5. Document-sequence/movement-number helpers (§7) — already
  consolidated, documented only.** No separate numbering helper exists;
  numbering logic already lives inline, once, inside `inventory_
  finalize_posting_internal`.

  **6. Direct balance/ledger writers (§8) — audited, one dead parallel
  writer found and removed.** Exactly ONE function writes `inventory_
  balances.on_hand_quantity` and exactly ONE inserts into `inventory_
  stock_ledger_entries` — both `inventory_finalize_posting_internal`,
  matching accepted architecture. Six functions write `reserved_
  quantity`/`allocated_quantity` directly — all the accepted Phase
  10A/10B reservation/allocation engine, none dead. **Corrected mid-
  phase**: `src/app/actions/warehouse/ambra-location-inventory.ts`
  performed direct writes against `inventory_balances`/`inventory_
  containers`/`inventory_container_lines`. An initial draft of this
  session's own architecture-doc section incorrectly judged this file
  "active, required" based on a half-remembered, unverified IC-4 test
  comment reference. A fresh, independent caller-trace (grepping exact
  EXPORTED FUNCTION NAMES, not the module path — the established
  project-wide lesson for avoiding false-positive "it's used" results)
  found this was WRONG: `createLocationContainerAction`,
  `addItemsToContainerAction`, `removeItemFromContainerAction`,
  `relocateContainerAction` have zero callers anywhere in the repo —
  the one real UI import from the "ambra-location-inventory" namespace
  (`locations/page.tsx`) goes to a completely different, read-only
  file (`ambra-location-inventory.service.ts`), not the actions file
  with the writes. This matches `inventory-core-implementation-plan.
md`'s own pre-existing IC-6 scope note, which already named these same
  4 functions as "confirmed zero UI callers, twice, across two separate
  audits" — this session's own trace is a third, independent
  confirmation. All 4 functions, plus their exclusively-owned zod
  schemas and the now-unused `InventoryMovementsService` import, were
  deleted (618 → 218 lines). The file's remaining 3 exported functions
  (`deletePutawayRuleAction`, `findContainersByReferenceAction`,
  `createLocationPutawayRuleAction`) are also dead but were deliberately
  RETAINED — they touch `inventory_putaway_rules` (unrelated to
  balance/ledger), not named in the implementation plan's own scope;
  removing them would be general dead-code cleanup, not Inventory Core
  legacy-writer removal. Disclosed as a future cleanup candidate.

  **7. RepairOrder/Zone-5 legacy writers (§9) — clean, nothing to
  remove.** Every `attach`/`putaway`/`rebuild`/`write_repair_order_
  line_movement_link_internal`/`repair_order_location_attribution_
  sync` function live is the CURRENT, accepted IC-5(-correction)
  version; no orphaned predecessor found.

  **8. GUC audit (§10)**: both `ambra.inventory_movement_engine` and
  `ambra.repair_order_attribution_authoritative` re-confirmed live/
  required (set by every legitimate writer, read by the balance-write
  guard trigger and the RepairOrder projection sync respectively).
  Neither is client-settable from outside a `SECURITY DEFINER`
  function's own controlled `SET LOCAL`. The known posted-header GUC-
  UPDATE-bypass security gap is explicitly NOT touched here — left for
  full IC-7 to close, per this phase's own explicit non-goal.

  **9. Movement code 311**: re-confirmed already resolved by IC-4's own
  redefinition (zero live rows under the old semantics) — not touched
  again this phase.

  **10. Overload cleanup (§14)**: the one genuine stale-overload case
  (item 2 above) was the only one found across every canonical
  Inventory RPC/helper signature enumerated.

  **11. Grant cleanup (§15)**: `has_function_privilege` re-verified for
  every internal function that remains — `authenticated`/`anon` both
  EXECUTE-denied on `inventory_finalize_posting_internal`, `write_
  repair_order_line_movement_link_internal`, `rebuild_repair_order_
  projection_bucket_internal` (see pgTAP `108_...` Scenario D). Dropping
  the 2 legacy functions naturally closed whatever grant surface they
  held (both confirmed absent from `pg_proc` entirely, not merely
  revoked).

  **12. Zone-5 local migration-mirroring gap (§17)**: unchanged from
  IC-5's own disclosure — the 7 live `zone5_*`-named migrations that
  were never locally mirrored remain a documented historical gap, not
  fabricated. IC-6 added zero new instances of this gap (all 4 of its
  own migrations were mirrored locally under their exact live
  timestamps, per the established discipline). IC-6's own audit went
  further than prior phases and precisely itemized exactly which live
  objects these 7 migrations alone create (`repair_order_line_
  locations`, `repair_order_location_attribution_uncertain`, the
  attribution-sync trigger binding, the original `receive_repair_
  order_stock`/`resolve_branch_receiving_location` definitions) —
  confirming this DOES block from-scratch reproducibility (see item 13
  below), correcting an earlier, looser mid-phase characterization that
  had claimed otherwise. Decision unchanged from IC-5: (A) leave the
  historical gap documented rather than fabricate a hand-reconstructed
  baseline migration.

  **13. From-scratch reproducibility (§18) — CONFIRMED BROKEN,
  pre-existing, not caused or worsened by IC-6**: local Docker/Supabase
  unavailable in this environment (unchanged constraint from every
  prior IC phase); performed the strongest static check available — a
  `supabase db reset` replayed against only the currently-mirrored
  local migration tree would fail the first time it reached a
  migration referencing one of the Zone-5 objects in item 12, since no
  local migration creates them from scratch. This predates IC-6 (and
  this whole IC-phase project's own local-mirroring discipline)
  entirely; none of IC-6's own 4 migrations depend on anything from the
  unmirrored set, so IC-6 makes this neither better nor worse — but
  this file's own change log states the honest result rather than the
  more comfortable-sounding "not blocked" claim an earlier mid-phase
  draft used. IC-6's own 4 migrations were themselves applied in
  correct dependency order (function fix before column drop, since the
  function's own body had to stop referencing the column before the
  column could be safely dropped), each step live-verified
  independently before the next was applied, with no squash of applied
  live migration history.

  **14. No architecture change (§19)**: confirmed — every deletion was
  either genuinely unreachable dead code or a genuinely zero-caller
  TypeScript path; IC-1 through IC-5's own semantics (hard invariant,
  reversal, receiving, transfers, projection, reservations, allocations,
  containers) are byte-for-byte unchanged. No new locking/concurrency
  behavior introduced — the one preserved `FOR UPDATE` statement in
  `inventory_finalize_posting_internal` was kept unchanged specifically
  to honor this constraint.

  **New pgTAP file**: `108_ic6_legacy_cleanup_test.sql` — `plan(23)`,
  final 23/23, 0 failures. Tests cleanup boundaries only (not a
  business-workflow retest): Scenario A (old v1 helper absent),
  Scenario B (stale overload absent, canonical 7-arg present, exactly 1
  overload), Scenario C (negative*stock_policy column/constraint
  absent, `inventory_finalize_posting_internal`'s own body no longer
  references it), Scenario D (4 internal functions remain non-
  executable by `authenticated`/`anon`), Scenario E (12 assertions:
  full receive/reverse/branch-transfer/putaway/RepairOrder-projection-
  rebuild/reversal lifecycle still succeeds unchanged end to end). Two
  self-caught fixture bugs during authoring, both instances of already-
  documented project-wide artifacts: (1) the GUC-persistence-across-
  shared-transaction leak (`ambra.repair_order_attribution*
  authoritative`set by an earlier reversal call in the same pgTAP
  transaction silently suppressed a later standalone attach call's own
  auto-rebuild — fixed with an explicit`set_config(..., 'off', true)`  reset before the affected scenario, same class of artifact as IC-5's
  own bundle already documents); (2) the rebuild-vs-incremental zero-
  quantity-row divergence (putaway's own direct UPDATE decrements a
  receiving-location row to exactly 0 but does not delete it — a real,
  disclosed, pre-existing characteristic already established in 107's
  own Scenario D1 — fixed by scoping the before/after rebuild
  comparison to`quantity > 0` rows only, matching the established
  precedent rather than treating it as a new regression).

  **Full regression**: 097-107 run once via a background agent
  immediately after the 4 migrations were applied (before the 102 fix)
  — 10 of 11 files clean (368/368, 0 failures); `102_...` correctly
  identified as broken by the column drop (SQLSTATE 42703, not a
  business-logic assertion failure) and fixed as described above,
  re-verified 11/11 alone. A full sequential 097-108 re-run (12 files)
  was then launched to reconfirm everything together as the phase's
  final gate — see the addendum below this entry (or `docs/inventory/
  reviews/ic-6-review/test-evidence.md`) for its own completed result,
  appended once that run returned.

  **Vitest**: full suite (4500 tests) run once after the `ambra-
  location-inventory.ts` deletion — 32 pre-existing failures across
  unrelated areas (auth/invitations/sidebar/QR-label rendering/org
  RLS), confirmed via `git stash` on this one changed file that all 32
  fail identically without the change — pre-existing baseline noise on
  this branch, not a regression introduced by IC-6.

  **Type-check/lint/build**: `pnpm type-check` 0 errors; `pnpm lint` 0
  errors, 319 pre-existing warnings (unchanged baseline); `pnpm build`
  succeeded cleanly (required and run, since `ambra-location-
  inventory.ts` is real application/action TypeScript — the first such
  change since IC-4), including the `/dashboard/warehouse/locations`
  route that consumes the (untouched) read-only sibling service.

  **Documentation updated**: `inventory-core-architecture.md` gained a
  new §9D ("IC-6 — Legacy Writer/Helper Removal") covering all 14
  numbered findings, corrected mid-writing once the `ambra-location-
  inventory.ts` factual error was caught, plus the 102 regression note.
  `inventory-core-implementation-plan.md`'s own pre-existing IC-6
  section marked DONE with a summary. This file (`inventory-core-
  progress.md`) updated: runtime-status header, "Current phase" line,
  "Overall execution" bullets, phase-tracker row, this change-log
  entry.

  **Bundle**: `docs/inventory/reviews/ic-6-review/` — new bundle
  (diff.patch, changed-files.md, review-context.md with the full
  20-item external-review-questions list, migration-summary.md,
  dead-path-matrix.md, test-evidence.md, reproducibility-evidence.md;
  no concurrency-evidence.md, since no concurrency behavior changed).

  **IC-6 is DONE.** Full IC-7 is NOT started. IC-8 is NOT started.
  Phase 10D is NOT started.

---

- **2026-09-17 (IC-6A — Opening Stock Active-Path Repair)**: narrow
  pre-IC-7 correctness pass, per explicit instruction; IC-0 through
  IC-6 and IC-7A remain ACCEPTED/FINAL, not reopened; full IC-7, IC-8,
  and Phase 10D explicitly NOT started; IC-6 itself explicitly NOT
  reopened.

  **Starting-state gate, two discrepancies disclosed**: (1) IC-6
  remains uncommitted — HEAD is still the pre-existing `daeba1132...`
  "ic6"-labeled commit that actually contains only IC-4/IC-5 work; all
  of IC-6's real changes sit uncommitted in the working tree, per the
  standing no-auto-commit policy; IC-6A was built directly on that
  uncommitted-but-content-complete state. (2) the git INDEX was found
  unexpectedly staged at the start of this pass (all of IC-6's own
  files) even though IC-6's own close had explicitly unstaged
  everything twice; `git log`/`git reflog` confirmed HEAD never moved
  and no commit occurred — likely a side effect of a background
  regression agent (full tool access) running `git add` unprompted;
  corrected via `git restore --staged .` before any IC-6A work began.

  **Bug reconfirmed independently**: `InventoryProductsService.
createOpeningStockMovement`, reachable from the ACTIVE
  `createEnhancedProduct` path (via the real
  `createEnhancedInventoryProductAction` server action) whenever a new
  variant has `opening_quantity > 0`, called `.rpc("inventory_create_
draft_movement", ...)` then `.rpc("inventory_post_movement", ...)`.
  A fresh live `pg_proc` query for both exact names returned zero rows.

  **Fix**: `createOpeningStockMovement` rewritten to call `inventory_
create_and_finalize` (read in full first — actor-identity check
  `p_actor_user_id IS DISTINCT FROM auth.uid()` → `28000`, branch-
  scoped permission check `warehouse.inventory.operate` OR `warehouse.
inventory.adjust` → `42501`, both before movement-type validation
  even runs) in a SINGLE atomic call, movement type `401` ("Inventory
  Count Adjustment (Increase)"). Movement-type choice verified live: a
  full catalog query confirmed `401` is the ONLY seeded, active,
  `allows_manual_entry = true` type whose own location requirements
  (destination required, source not) match opening stock's shape; a
  dedicated query for any "opening"/"initial"-named type returned zero
  rows, active or soft-deleted — no new type was seeded. `total_cost`/
  `currency` dropped from the line payload (read `inventory_create_
draft`'s own `jsonb_to_recordset` column list — neither field was
  EVER consumed by any live RPC, broken or canonical; not a loss of
  previously-working behavior). `reference_type`/`reference_id` (a
  concept the OLD broken code targeted, and which DOES exist as columns
  on `inventory_movement_headers`, but which neither `inventory_create_
draft` nor `inventory_create_and_finalize` exposes a parameter for —
  a genuine, disclosed old-helper/current-engine mismatch, per this
  task's own §3) replaced with `p_external_reference = productId`, the
  nearest available current substitute, preserving the same
  traceability intent without inventing new schema. Idempotency key
  strategy (`product-opening-stock-${productId}`, one key covering all
  of a product's variant lines in one movement) was ALREADY correct
  and deterministic — not modified. Actor/permission behavior verified
  ALREADY correct at the action layer (`createEnhancedInventoryProduct
Action` already required `WAREHOUSE_INVENTORY_OPERATE` — confirmed
  via a real existing test assertion to equal the exact string
  `"warehouse.inventory.operate"`, one of the two permissions the
  canonical RPC itself checks — whenever opening-stock fields are set)
  — not modified; the "product creation succeeds but opening stock
  fails for permission reasons" scenario this task asked about is
  already impossible today, since the action layer blocks the ENTIRE
  operation up front.

  **Atomicity**: unchanged/pre-existing characteristic explicitly not
  broadened, per this pass's own "do not rewrite product-creation
  architecture" instruction — `createEnhancedProduct`'s own product/
  variant-creation RPC and the opening-stock RPC remain two separate
  network calls with the EXISTING manual compensating-cleanup pattern
  (`cleanupFailedEnhancedProductCreate`, archives the product/variants
  on opening-stock failure) between them; this was already true before
  the fix and is unchanged by it. A genuine, incidental atomicity
  IMPROVEMENT did occur as a side effect of choosing the smallest
  canonical primitive (Option A): the OLD two-call draft-then-post
  RPC sequence could leave an orphaned draft on a network failure
  between the two calls; the NEW single `inventory_create_and_finalize`
  call cannot, since draft-creation and posting now happen inside one
  Postgres function call (one transaction).

  **Idempotency/retry proven live, not just read**: pgTAP `109_...`
  Scenario F calls the IDENTICAL request (same idempotency key) twice —
  `on_hand_quantity` remains exactly 5 (not 10), movement-header count
  and ledger-entry count both stay at exactly 1. Root cause confirmed
  by reading BOTH function bodies: `inventory_create_draft`'s own
  idempotency lookup short-circuits to the existing header; `inventory_
finalize_posting_internal` independently guards `IF v_header.status =
'posted' THEN RETURN ... END IF` before any balance/ledger effect —
  a second, independent safety net even if the draft-lookup path were
  ever bypassed.

  **New pgTAP file**: `109_ic6a_opening_stock_repair_test.sql` —
  `plan(16)`, final 16/16, 0 failures. Proves the exact new call shape
  live: before/after balance (0 → 5), exactly-one-movement (type 401,
  correct `external_reference`, real generated `document_number`),
  exactly-one-ledger-entry (direction=increase, quantity=5), actor/
  audit metadata (`posted_by`, one `'posted'` audit-log row), and the
  retry/idempotency proof above. One self-caught fixture bug during
  authoring: temp tables created before `SET LOCAL ROLE authenticated`
  need an explicit `GRANT SELECT ... TO authenticated` (this project's
  own established convention) — omitted on the first draft, added
  after a live `42501: permission denied` surfaced it.

  **New Vitest scenarios**: 5, in `inventory-products.service.test.ts`,
  covering exactly the task's own required A-E coverage: opening\_
  quantity=0 (no RPC call), opening_quantity>0 (correct RPC shape,
  explicit assertions the OLD broken RPC names are never called),
  canonical-RPC-error propagation + compensating cleanup, multi-variant
  independent quantities, and variant-identity correctness under a
  mixed zero/nonzero-quantity variant list (proves no positional
  mismatch after filtering). Focused file run: 15/15 (10 pre-existing +
  5 new).

  **Full regression**: 097-108 re-run via a background agent — 402/402
  assertions, 0 failures, 12/12 files PASS, confirming zero SQL-layer
  regression from this TypeScript-only change (no migration exists for
  IC-6A). `105_ic7a_movement_engine_security_boundary_test.sql`
  (29/29) specifically re-confirms anon/no-permission/actor-spoof
  rejection on `inventory_create_and_finalize` and friends remains
  fully closed for this exact call path (the security checks run
  before movement-type validation, so this proof is movement-type-
  agnostic). Combined IC-6A-relevant pgTAP total: 418/418, 0 failures.

  **Vitest**: full suite re-run — 4456 passed / 32 failed / 8 skipped /
  9 todo (4505 total). The 32 failures are the SAME pre-existing,
  unrelated baseline already confirmed during IC-6 (auth/invitations/
  sidebar/QR-label/org RLS) — zero overlap with the 2 files this pass
  touched; the +5 over IC-6's own 4500-test baseline are exactly this
  pass's own 5 new tests, all passing.

  **Type-check/lint/build**: `pnpm type-check` 0 errors; `pnpm lint` 0
  errors, 319 pre-existing warnings (unchanged baseline); `pnpm build`
  succeeded cleanly (required and run — real application/service
  TypeScript changed).

  **Broken RPC names removed from all active code**: repo-wide grep
  post-fix confirms zero references to `inventory_create_draft_
movement`/`inventory_post_movement` anywhere in `src/` except (a)
  historical-migration-text regression tests asserting on ALREADY-
  APPLIED migration files' own SQL content (not active callers, left
  untouched) and (b) one stale doc comment in `audits/[id]/report/
page.tsx` describing `inventory_approve_count_session`'s own
  internal implementation — verified live that this function does NOT
  call the dead names internally (confirmed harmless, stale prose only,
  disclosed but not edited since it's outside this pass's own narrow
  "ACTIVE createEnhancedProduct path" scope).

  **`createEnhancedProductLegacy`**: deliberately NOT touched, per
  this pass's own explicit instruction — remains a confirmed-dead,
  disclosed candidate for a future, dedicated product-cleanup pass, not
  automatically swept in just because fixing a shared helper happened
  nearby (the fixed method, `createOpeningStockMovement`, IS shared
  between both `createEnhancedProduct` and `createEnhancedProduct
Legacy`, but making it correct doesn't make the Legacy method itself
  any less dead or any more in-scope for removal here).

  **Migration discipline**: NO migration was created. The correct
  current canonical capability (`inventory_create_and_finalize`,
  movement type `401`, with a supported `p_lines` shape and a
  supported `p_external_reference` substitute) already existed live in
  full, confirmed via direct `pg_get_functiondef` reads BEFORE writing
  any code — per this pass's own explicit "STOP and report before
  inventing one" instruction, which was never triggered.

  **From-scratch reproducibility**: NOT solved here (explicitly out of
  this pass's own scope) — reconfirmed still OPEN and formally assigned
  as a HARD GATE to IC-8 in `inventory-core-implementation-plan.md`'s
  own existing IC-8 section (both its Scope and Acceptance Criteria
  now explicitly state IC-8 must not be marked FINAL while a clean
  database cannot be constructed from repository migrations alone).

  **Documentation updated**: `inventory-core-implementation-plan.md`'s
  own IC-8 section gained the HARD GATE bullet and an updated
  acceptance-criteria line. This file (`inventory-core-progress.md`)
  updated: runtime-status header (new IC-6A block), "Current phase"
  line, "Overall execution" bullet, phase-tracker row, this change-log
  entry. `inventory-core-architecture.md` was NOT touched this pass
  (no architecture/schema change occurred).

  **Bundle**: `docs/inventory/reviews/ic-6a-opening-stock-repair-
review/` — 4 files (`diff.patch`, `changed-files.md`, `review-
context.md`, `test-evidence.md`; no `migration-summary.md`, since no
  migration occurred).

  **IC-6A is DONE.** IC-6 remains DONE, not reopened. Full IC-7 is NOT
  started. IC-8 is NOT started. Phase 10D is NOT started.

---

- **2026-09-17 (IC-7 — Inventory Security / Write-Boundary Closure +
  Module-Boundary / Public-Entry-Point Audit)**: full security-hardening
  phase, per explicit instruction; IC-0 through IC-6A and IC-7A remain
  ACCEPTED/FINAL, not reopened; IC-8 and Phase 10D explicitly NOT
  started.

  **Starting-state gate, disclosed**: HEAD at phase start was
  `fb22529567cf029ea2dc6e6109f1f3d34216d477` ("ic6a" — the same combined
  IC-6+IC-6A commit whose own out-of-band appearance was flagged during
  IC-6A's own final report). Working tree confirmed clean of anything
  except this phase's own new files before work began. IC-8/Phase 10D
  re-confirmed NOT started.

  **Read in full, not relied on as summaries alone**: `inventory-core-
architecture.md` (all ~1600 lines), the existing IC-7 scope in
  `inventory-core-implementation-plan.md`, and the IC-0 change-log
  entry in this file — surfaced two genuine IC-0 findings (reservation/
  allocation raw-write RLS gap; movement-header status-blind raw
  INSERT) that had been recorded as "IC-7 blockers" but never actually
  closed by any intervening phase. A background synthesis agent
  independently confirmed and extended this picture across IC-1 through
  IC-5/IC-7A's own review bundles (not re-read directly, per an
  explicit instruction to trust the already-consolidated architecture
  doc §9 table as primary and use the bundles as supporting provenance).

  **Live write-surface enumeration**: a background investigation agent
  performed a comprehensive, empirical live audit — full function/grant
  matrix (~55 functions), `pg_default_acl` inspection, RLS-policy sweep
  across all 20 tables named in this task's own §2, trigger inventory,
  and a raw-DML probe matrix as a real `operate`-permissioned actor.
  This surfaced the SYSTEMIC NULL-comparison fail-open bug (see below)
  as its own headline finding — a class of defect neither this session
  nor any prior phase had previously identified.

  **1. `inventory_cancel_movement` — CRITICAL, fully unauthenticated,
  cross-tenant exploit.** Live-confirmed: `SECURITY DEFINER` (bypasses
  RLS), zero actor-identity check, zero permission check, live `anon`
  EXECUTE. An unauthenticated `anon` session could cancel any DRAFT
  movement in ANY organization. Fixed: standard actor-identity (`28000`)
  - permission (`42501`, surfaced as the non-leaking `P0002` message
    matching `inventory_reverse_movement`'s own established pattern)
    checks added; `anon`/`PUBLIC` EXECUTE revoked. Live-reproduced closed:
    `anon` call now `42501` at the grant level, spoofed actor now `28000`,
    no-permission real actor now `P0002`.

  **2. Posted-header GUC "authorization" — the single most
  architecturally significant fix this phase.** The immutability
  triggers (`inventory_prevent_header_modification`/`_line_
modification`) previously relied ENTIRELY on `current_setting(
'ambra.inventory_movement_engine', true) != 'on'` — a caller-settable
  session GUC is never a real security boundary (this project's own
  established principle, restated explicitly by this task). Redesigned:
  the GUC is removed entirely as an authorization signal. Authorization
  is now based on the SUBSTANCE of the change — once posted, the ONLY
  value-changing transition ever permitted is EXACTLY the accepted
  reversal lifecycle (verified via `to_jsonb(NEW) - {allowed keys} =
to_jsonb(OLD) - {allowed keys}`, robust against future column
  additions rather than hand-enumerating the table's 40 columns) AND
  the new `reversal_movement_id` must genuinely double-link back to a
  real, correctly-typed (`movement_type_code='900'`) row — which cannot
  be forged, since `900`-type movements cannot be manually created
  (IC-7A's own closed contract). This closes not just the known
  document-number-rewrite bypass but a MORE severe variant this
  session self-discovered: forging a completely fake "already reversed"
  state pointing at an arbitrary/unrelated movement id. Lines: no
  legitimate path ever updates/deletes an existing line post-posting
  (verified against both `inventory_reverse_movement`'s and `inventory_
finalize_posting_internal`'s own current bodies), so the GUC-gated
  exception was removed entirely — unconditional denial.

  **3. Systemic NULL-comparison fail-open bug — CRITICAL, newly
  discovered this phase, arguably the most severe single finding.**
  `inventory_guard_balance_write`/`inventory_guard_settings_write` used
  a bare `<>` comparison against `current_setting(..., true)`. When the
  GUC was NEVER SET AT ALL (the ordinary default for any raw client
  connection — no bypass trick of any kind required), the comparison
  evaluates to SQL NULL, which PL/pgSQL's `IF NULL THEN` treats as
  FALSE — the guard failed OPEN, not closed. Live-reproduced (after
  self-catching and correcting a FALSE NEGATIVE in the first test
  attempt, caused by the exact same `SET LOCAL`-persists-for-the-rest-
  of-the-transaction artifact this project has documented repeatedly —
  re-tested in a properly isolated, zero-prior-GUC-contact transaction):
  a fresh transaction's very first statement, a raw `UPDATE inventory_
balances SET on_hand_quantity = 999999`, succeeded pre-fix as an
  ordinary `operate`-permissioned actor. This meant IC-1's own hard
  stock invariants — the reason this whole consolidation effort exists
  — could be silently bypassed with a single raw UPDATE, no special
  knowledge required. Fixed: `COALESCE(current_setting(...), 'off') <>
'on'`. Every legitimate canonical RPC already explicitly sets this
  GUC before writing, so zero legitimate behavior changed.

  **4. `inventory_save_draft`/`inventory_reconcile_balances` — same
  exploit class as item 1.** `inventory_save_draft`: identical fix
  pattern. `inventory_reconcile_balances`: a pure read-only diagnostic
  (`LANGUAGE sql`, no writes) but carried live `anon` EXECUTE with zero
  checks — cross-tenant stock-drift read exposure for any org/branch id
  supplied. Converted to `LANGUAGE plpgsql` solely to add the actor+
  permission check (diagnostic query byte-for-byte unchanged); old
  2-arg signature explicitly `DROP FUNCTION`ed after confirming zero
  application callers (this project's own established "always check
  before dropping an overload" discipline).

  **5. Reservation/allocation/container raw-write RLS — IC-0's own
  2026-09-15 finding, finally closed.** Re-confirmed still live this
  phase (both by direct `pg_policies` inspection and an empirical
  raw-DML probe): `inventory_reservations`/`_lines`/`inventory_
allocations`/`_lines` each carried only a single `PERMISSIVE ALL`
  policy, no `RESTRICTIVE` ownership-aware policy — any `operate`-
  permissioned actor could raw-write these tables, bypassing every
  invariant the canonical RPCs enforce. `inventory_containers`/
  `_container_lines`'s own generic (non-RepairOrder) rows had the
  identical gap. Closed with the exact, already-proven-safe
  `RESTRICTIVE USING(false)/WITH CHECK(false)` pattern IC-4/IC-5 already
  used. Container closure confirmed safe only because IC-6 already
  deleted the sole legacy direct-writer (`ambra-location-inventory.ts`'s
  own 4 write actions, disclosed and removed in IC-6).

  **6. Reservation/allocation RPCs were SECURITY INVOKER — genuinely
  new finding, self-caught live while applying item 5.** The FIRST
  attempt to run the legitimate reservation-creation flow after
  applying item 5's own RLS migration FAILED (`42501: new row violates
row-level security policy`) — root-caused to `inventory_create_
reservation`/`inventory_release_reservation`/`inventory_create_
allocation`/`inventory_release_allocation` all being `SECURITY
INVOKER` (the implicit Postgres default, never explicitly set), out
  of compliance with this project's own standing "SECURITY DEFINER,
  owner postgres" convention, with no actor-identity check on any of
  the 4. Since INVOKER functions run AS the calling role and are
  themselves subject to RLS, item 5's own new RESTRICTIVE policies
  correctly blocked ordinary raw client writes but ALSO blocked these
  4 RPCs' own legitimate writes. Fixed in the SAME phase, not deferred:
  converted all 4 to `SECURITY DEFINER` with actor-identity checks
  added; the two release functions' own cross-org existence-leak
  (different error messages for "not found" vs. "no permission") was
  ALSO unified to the same non-leaking `P0002` pattern while in there.
  All business logic byte-for-byte unchanged. Confirmed all 6 real
  TypeScript call sites (`InventoryEnterpriseService`'s 4 methods,
  `RepairOrdersService`'s `reserveForLine`/`allocateForLine`/
  `releaseReservationForLine`) already pass a genuine, session-resolved
  actor id, so the new strict check breaks nothing.

  **7. Movement-header/line status-blind raw INSERT — IC-0's own
  finding, extended this phase.** Re-confirmed still live: an
  `operate`-permissioned actor could raw-INSERT a fabricated
  `status='posted'` header. Extended to a genuinely new discovery: since
  the immutability trigger only fires on UPDATE/DELETE, a raw client
  could previously INSERT a brand-new line under an EXISTING, genuinely-
  posted `movement_id` without ever tripping the immutability guard.
  Both closed with matching RESTRICTIVE `status='draft'`-only INSERT
  policies.

  **8. `inventory_approve_count_session`.** Added the standard actor-
  identity check (closing a narrow audit-trail-attribution spoofing gap
  on `approved_by` for zero-net-variance approvals); `anon`/`PUBLIC`
  EXECUTE revoked. Remains `SECURITY INVOKER` — its own nested calls
  into the hardened engine already provide the real boundary for any
  non-trivial approval.

  **9. Grant hygiene.** `inventory_get_or_create_balance_for_update`
  (shared internal balance-getter) and 8 trigger functions had `anon`/
  `PUBLIC` EXECUTE revoked — confirmed safe via same-owner `SECURITY
DEFINER` nesting semantics (nested calls from a `postgres`-owned
  DEFINER caller execute as `postgres`, which always implicitly has
  EXECUTE on everything it owns, regardless of the callee's own
  explicit grants).

  **Default-privilege systemic decision (§16/17/22/23) — Option B.** A
  live audit this phase (going further than IC-7A's own deferred
  investigation) queried every `anon`-executable function OUTSIDE the
  Inventory/RepairOrder domain and found dozens of genuinely,
  deliberately public-facing functions across unrelated modules
  (invitation acceptance, signup, org creation, plus warehouse-layout/
  planning/CRM/helpdesk functions) that legitimately rely on the same
  schema-wide `ALTER DEFAULT PRIVILEGES ... GRANT EXECUTE ... TO anon`
  rule. Confirmed changing it schema-wide is unsafe within this phase's
  own Inventory-only scope — auditing every one of those unrelated
  modules is explicitly out of scope. Chose Option B: retain the
  default; every Inventory Core function this phase touched received an
  explicit per-function `REVOKE`; the new pgTAP file's own grant-
  privilege assertions plus the full function-grant-matrix sweep serve
  as the enforced, re-runnable regression check the task's own §36
  requires, rather than relying on human migration discipline alone.

  **Module-boundary audit (§3/§4/§25).** Generic Inventory Core does
  NOT depend on RepairOrder or PurchaseOrder business logic in any
  load-bearing way, with ONE narrow, disclosed, non-security-relevant
  exception: `inventory_add_to_container`'s own inline RepairOrder-
  ownership check (a real, direct `JOIN repair_order_lines`, guarding a
  real, tested, already-accepted invariant from Phase 10C). Not touched
  this phase (no security bypass involved); recorded as an
  architecture-compression candidate. The TypeScript-layer dependency
  direction is already fully correct: a repo-wide grep found ZERO
  `.rpc("inventory_...")` calls anywhere outside `src/server/services/`,
  and `RepairOrdersService` (business module) correctly calls generic
  Inventory Core RPCs, never the reverse. `repair_order_line_locations_
ledger_sync` (a RepairOrder-domain trigger on the generic
  `inventory_stock_ledger_entries` table) is IC-5's own deliberate,
  already-accepted design — recorded, not touched.

  **Application entry-point audit (§5/§23/§24).** No duplicate entry
  points found for the same physical write — the apparent overlap
  between `InventoryEnterpriseService`'s generic reservation/allocation
  methods and `RepairOrdersService`'s own line-specific methods is two
  DISTINCT business operations (generic warehouse vs. RepairOrder-line-
  specific, distinguished by `reference_type`) correctly sharing one
  canonical RPC, not duplication — no consolidation recommended. Three
  canonical RPCs (`receive_repair_order_stock`, `putaway_repair_order_
stock`, `rebuild_repair_order_location_projection`) have zero current
  TypeScript callers — fully built, fully hardened, but awaiting their
  own UI; disclosed as an application-completeness observation for a
  future feature-build phase, not a security or architecture finding.

  **Architecture-compression candidates recorded (§41), none acted on
  this phase**: the `inventory_add_to_container` coupling (above); the
  `repair_order_line_locations_ledger_sync` trigger-on-core-table
  design (deliberate, IC-5's own, keep); the 3 zero-caller canonical
  RPCs (keep, defer UI); `createEnhancedProductLegacy` and `ambra-
location-inventory.ts`'s remaining 3 dead functions (both already
  disclosed by IC-6, restated not re-found); 7 product-catalog/
  procurement/audit-domain functions still carrying default `anon`
  EXECUTE without an explicit revoke (disclosed, deferred to a future
  domain-specific hardening pass, outside this phase's own narrow
  physical-stock-write charter).

  **New pgTAP file**: `110_ic7_security_write_boundary_test.sql` —
  `plan(25)`, final 25/25, 0 failures. One self-caught test-design bug
  during authoring: the first draft created a reservation+allocation
  against the SAME movement it then tried to reverse, correctly tripping
  IC-1's own P0003 strand-check (proving the invariant still holds, but
  breaking the test's own narrower "does the reversal lifecycle
  transition still work" check) — fixed by adding a second, separate
  receipt for the commitment scenarios, leaving the reversal target
  movement fully uncommitted, matching the established fixture
  discipline used throughout this whole project.

  **Full regression**: 097 through 110 (14 files) delegated to a
  background agent — see the addendum immediately below this entry (or
  `docs/inventory/reviews/ic-7-review/test-evidence.md`) for the
  completed result, appended once that run returned.

  **Vitest/typecheck/lint/build**: no TypeScript/application file was
  changed this phase (pure SQL/database security hardening) — `pnpm
type-check`/`pnpm lint`/`pnpm build` were not re-run, per this
  project's own established convention that a build is only required
  when application/action TypeScript changes.

  **Concurrency**: no new lock primitive introduced, no change to lock
  order or which rows are locked by any hardened function — the new
  checks are pure validation inserted before/around each function's own
  pre-existing row acquisition (the trigger redesign preserved the
  `FOR UPDATE` semantics of every legitimate caller unchanged).

  **Documentation updated**: `inventory-core-architecture.md` §9's own
  table updated in place (4 rows: movement headers/lines, the new
  status-blind-INSERT row, reservations/allocations, containers) plus a
  new §9E section covering the full phase; `inventory-core-
implementation-plan.md`'s own pre-existing IC-7 section marked DONE
  with a summary. This file (`inventory-core-progress.md`) updated:
  runtime-status header, "Current phase" line, "Overall execution"
  bullet, phase-tracker row, this change-log entry.

  **Bundle**: `docs/inventory/reviews/ic-7-review/` — 11 files
  (`diff.patch`, `changed-files.md`, `review-context.md`, `migration-
summary.md`, `security-evidence.md`, `write-boundary-matrix.md`,
  `function-grant-matrix.md`, `application-entry-point-matrix.md`,
  `module-boundary-audit.md`, `compression-candidates.md`, `test-
evidence.md`; no `concurrency-evidence.md`, since no concurrency
  behavior changed).

  **IC-7 is DONE.** IC-8 is NOT started. Phase 10D is NOT started. The
  Zone-5 from-scratch-reproducibility gap remains explicitly assigned
  to IC-8 as a hard gate (unchanged, not touched this phase, per
  explicit instruction).

- **2026-09-19 — IC-7 CLOSING PASS.** A narrow follow-up closed the 7
  product/procurement/audit-domain functions full IC-7 had explicitly
  disclosed and deferred (`inventory_create_enhanced_product`,
  `inventory_create_product_with_default_variant`, `inventory_create_
purchase_order`, `inventory_create_valuation_snapshot`, `inventory_
create_count_session`, `inventory_count_session_list`, `inventory_
find_sku_collisions`), plus 1 newly-found item during this pass's own
  live classification sweep (`inventory_convert_quantity` — zero
  permission check of any kind, a genuine tenant-configuration-data
  exposure). IC-7's own core 10 findings and all 9 original migrations
  remained completely frozen; none were reopened or touched.

  **Genuine vulnerability found and closed**: actor-identity spoofing
  on the 4 functions that accept `p_actor_user_id` — an authenticated
  caller holding the correct business permission could forge
  `created_by`/`updated_by` to an arbitrary, real, different user's
  identity (live-reproduced with a genuine second real user, not a
  synthetic UUID — a synthetic UUID only trips an unrelated FK
  constraint and produces a false negative, an early pitfall this pass
  self-caught and corrected). Fixed with the same established
  `p_actor_user_id IS NULL OR IS DISTINCT FROM auth.uid() → 28000`
  pattern IC-7 itself established.

  **4 new migrations** (`20260919093552`, `20260919093630`,
  `20260919093655`, `20260919093709`) — actor-identity checks on the 4
  actor-bearing mutation functions plus `REVOKE ALL FROM PUBLIC, anon`
  / `GRANT ... TO authenticated, service_role` on all 8 functions. None
  were converted to `SECURITY DEFINER` (deliberately — none needed RLS
  bypass, unlike the reservation/allocation RPCs in full IC-7; all
  remain the correct `SECURITY INVOKER`, gated by RLS + their own
  existing permission checks).

  **Disclosed, out-of-scope, pre-existing defect found (NOT fixed, not
  a regression, not a security bug)**: `inventory_create_valuation_
snapshot`'s own body references `public.inventory_balance_analytics`,
  which does not exist in this database. This function's body was not
  edited this pass (grant-only change), so the bug predates the
  closing pass entirely.

  **New pgTAP**: `111_ic7_closing_security_test.sql`, `plan(24)`,
  24/24. Includes a classification-based grant-regression check
  (replacing a hardcoded function list) designed to fail automatically
  if a future mutation RPC accidentally inherits `anon` EXECUTE from
  the schema-wide default privilege.

  **Full regression**: all 15 pgTAP files (097-111) re-run live,
  467/467 assertions passing, 0 failures. Relevant Vitest: 8 files,
  283/283 tests passing. `pnpm type-check`: clean. `pnpm lint`: 0
  errors, 319 pre-existing warnings (unrelated `temp/` scaffold code).
  `pnpm build`: succeeded. `git diff --check`: clean. Zero residual
  test data confirmed live.

  **Bundle**: `docs/inventory/reviews/ic-7-review/` refreshed in place
  (not a new bundle) — `security-evidence.md`, `function-grant-
matrix.md`, `test-evidence.md`, `review-context.md`, `changed-
files.md`, `migration-summary.md`, `compression-candidates.md`, and
  `diff.patch` all updated with the closing pass's own findings,
  additive to (not replacing) the original IC-7 record.

  **The closing pass is DONE.** Architecture compression is NOT
  started. IC-8 is NOT started. Phase 10D is NOT started.
