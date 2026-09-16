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
**Current phase:** IC-3 DONE → IC-4 (Branch transfer / MMJ rebuild) is the
next phase in sequence, NOT yet authorized/started.
**Pitch/pilot readiness:** N/A — this is base-engine work, not itself a
pitch-scoped feature; it BLOCKS Phase 10D, which IS pitch-scoped (see the
Zone 3 tracker's own cross-reference).
**Last updated:** 2026-09-16.

---

## Overall execution

- IC phases completed: 4 / 8 (IC-0, IC-1, IC-2, IC-3). IC-4 NOT started.
- 3 forward migrations applied for IC-1; 9 forward migrations applied for
  IC-2 (7 original + 2 from the security-boundary correction pass); 4
  forward migrations applied for IC-3 — all live-verified, all mirrored
  locally under the exact live version/timestamp — see change log.
- Application code: no TypeScript changes were required for IC-1, IC-2, or
  IC-3 (all entirely PL/pgSQL); 2 pgTAP test files added/rewritten for
  IC-1 (`101_...` rewritten, `102_...` new/extended); 1 new pgTAP file for
  IC-2, extended in the security-boundary correction pass (`103_...`,
  35/35); 1 new pgTAP file for IC-3 (`104_...`, 44/44), plus one genuine
  two-PostgreSQL-connection concurrency proof performed outside pgTAP.

---

## Phase tracker

| Phase                                                                | Status         | Notes                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          |
| -------------------------------------------------------------------- | -------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| IC-0 Architecture contract + baseline capture                        | ✅ DONE        | Live verification closed 2026-09-15 — see change log for the exact findings. Gate decision: no contradiction with the accepted architecture; two genuine raw-write gaps found (reservation/allocation tables, movement headers) but neither defeats IC-1's own guarantee — both recorded as IC-7 blockers, not IC-1 blockers.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                  |
| IC-1 Canonical movement engine / hard stock invariants               | ✅ DONE, FINAL | Hard invariant (`on_hand >= reserved_quantity + allocated_quantity`) live-implemented in `inventory_finalize_posting`, SQLSTATE `P0003`. Balance-getter replaced (v1 helper now zero production callers). `on_hand_quantity >= 0` CHECK added — **product-owner FINAL DECISION (2026-09-15, OPTION A)**: global non-negative on-hand is the permanent product contract; `negative_stock_policy='allow'`/`'allow_with_approval'` are superseded/deprecated for on-hand behavior, cannot bypass the invariant, column cleanup owned by IC-6. 133/133 pgTAP (102 extended to 14/14 with the finalized-contract regression) + 395/395 relevant Vitest clean (229 of those 395 re-confirmed live this finalization pass; the file set is identical to the original submission's own 395, not additive). Genuine two-session concurrency proven (3.68s real blocking). Architecture doc §0 (new decision #20) and §5 (invariant #1) updated. See the finalization-pass change-log entry below and `docs/inventory/reviews/ic-1-review/negative-stock-policy-conflict.md` (marked RESOLVED).                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          |
| IC-2 Movement reversal                                               | ✅ DONE        | `inventory_reverse_movement(p_movement_id, p_actor_user_id, p_reason)` implemented and live-proven: receipt (101) and two-leg (801) reversal restore exact pre-movement balances; all negative paths (draft, already-reversed, reversal-of-reversal, IC-1 commitment block, reason validation, wrong actor, cross-org/no-permission indistinguishable) rejected with stable SQLSTATEs; genuine two-session concurrency proven (~5s real blocking, exactly one reversal survives, zero double-compensation); bidirectional linkage and distinct sequential `KOR/...` document numbering live-proven. New minimal movement type `900`/doc type `KOR` (system-only, zero effect rows of its own); `inventory_finalize_posting` gained one backward-compatible optional parameter (`p_explicit_effects`). Product decisions A (no undo-an-undo) and B (no RepairOrder netting) CLOSED. 3 live-caught defects fixed forward (overload ambiguity, reserved SQLSTATE P0004, Zone 5 attribution corruption) plus 1 grant-hardening fix (anon default-privilege re-exposure). **SECURITY-BOUNDARY CORRECTION PASS (2026-09-15)**: external review found `p_explicit_effects` was reachable on the externally-callable `inventory_finalize_posting` — live-confirmed P0 (on-hand doubled by an ordinary authenticated caller), fixed by internalizing the explicit-effects capability into a new EXECUTE-revoked-from-all-ordinary-roles `inventory_finalize_posting_internal`, reachable only via same-owner `SECURITY DEFINER` semantics from `inventory_reverse_movement`. A separate, pre-existing, NOT-fixed-this-pass finding (assigned to IC-7): the posted-header immutability trigger only checks its own GUC is `'on'`, not which columns changed — an ordinary permission-holding actor can self-set that GUC and rewrite any posted header's business content. pgTAP 35/35 (`103_...`, extended with Scenario E). Full regression 176/176. See change log for full evidence. |
| IC-3 Receiving consolidation                                         | ✅ DONE        | New canonical `inventory_receive_stock` primitive (domain-agnostic, delegates through `inventory_create_and_finalize`/public `inventory_finalize_posting`, never touches `_internal`). `receive_repair_order_stock` refactored onto it, all business rules preserved byte-for-byte. `inventory_receive_purchase_order` was **live-confirmed dead/broken** (called two nonexistent functions, zero UI/service reachability) — fixed and refactored onto the primitive, business rules preserved, security model hardened (new `SECURITY DEFINER` + actor check, since there was no working contract before to weaken). Line-correlation by ordinal position only (never SKU/variant). Idempotency structurally safe (pre-existing unique index) AND gracefully handled on a genuine concurrent race (live-proven, real two-connection test: loser blocked 3560.950ms then returned the winner's own movement*id, zero double-post). Self-caught PO-wrapper idempotency/state-mutation-ordering defect fixed before any test ran. **New CRITICAL pre-existing security finding** (fully unauthenticated `anon` can post via the raw engine layer) discovered and assigned to IC-7, NOT fixed here. pgTAP 44/44 (`104*...`). Full regression 220/220. See change log for full evidence.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                           |
| IC-4 Branch transfer / MMJ rebuild                                   | ⬜ NOT STARTED | Depends on IC-1, IC-3. Carries an open product-semantics question (see implementation plan's own IC-4 section: whether "in transit" should mean physically moving vs. merely reserved) that needs product-owner resolution before or during this phase.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        |
| IC-5 RepairOrder physical-location projection consolidation          | ⬜ NOT STARTED | Depends on IC-1, IC-3.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                         |
| IC-6 Legacy writer/helper removal                                    | ⬜ NOT STARTED | Depends on IC-1 (balance-getter replacement), IC-4 (311 disposition), IC-5 (Zone 5 direct-write removal).                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      |
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
