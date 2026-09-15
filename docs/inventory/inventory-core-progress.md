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
**Runtime status:** 🟢 IC-0 ✅ DONE. IC-1 ✅ DONE AND FINAL — commitment
invariant, locking strategy, SUM formula, helper replacement, pgTAP evidence,
concurrency proof (external review, accepted), AND the `negative_stock_
policy` semantic-contract question (product-owner decision, 2026-09-15,
OPTION A — see the finalization-pass change-log entry below) are all closed.
IC-2 is NOT started.
**Current phase:** IC-1 FINAL → IC-2 (Movement reversal) is the next
authorized phase, NOT yet started.
**Pitch/pilot readiness:** N/A — this is base-engine work, not itself a
pitch-scoped feature; it BLOCKS Phase 10D, which IS pitch-scoped (see the
Zone 3 tracker's own cross-reference).
**Last updated:** 2026-09-15.

---

## Overall execution

- IC phases completed: 2 / 8 (IC-0, IC-1). IC-2 NOT started.
- 3 forward migrations applied for IC-1 (all live-verified, all mirrored
  locally under the exact live version/timestamp — see change log).
- Application code: no TypeScript changes were required for IC-1 (the fix is
  entirely inside `inventory_finalize_posting`'s own PL/pgSQL body); 2 pgTAP
  test files added/rewritten (`101_...` rewritten, `102_...` new).

---

## Phase tracker

| Phase                                                                | Status         | Notes                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                 |
| -------------------------------------------------------------------- | -------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| IC-0 Architecture contract + baseline capture                        | ✅ DONE        | Live verification closed 2026-09-15 — see change log for the exact findings. Gate decision: no contradiction with the accepted architecture; two genuine raw-write gaps found (reservation/allocation tables, movement headers) but neither defeats IC-1's own guarantee — both recorded as IC-7 blockers, not IC-1 blockers.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                         |
| IC-1 Canonical movement engine / hard stock invariants               | ✅ DONE, FINAL | Hard invariant (`on_hand >= reserved_quantity + allocated_quantity`) live-implemented in `inventory_finalize_posting`, SQLSTATE `P0003`. Balance-getter replaced (v1 helper now zero production callers). `on_hand_quantity >= 0` CHECK added — **product-owner FINAL DECISION (2026-09-15, OPTION A)**: global non-negative on-hand is the permanent product contract; `negative_stock_policy='allow'`/`'allow_with_approval'` are superseded/deprecated for on-hand behavior, cannot bypass the invariant, column cleanup owned by IC-6. 133/133 pgTAP (102 extended to 14/14 with the finalized-contract regression) + 395/395 relevant Vitest clean (229 of those 395 re-confirmed live this finalization pass; the file set is identical to the original submission's own 395, not additive). Genuine two-session concurrency proven (3.68s real blocking). Architecture doc §0 (new decision #20) and §5 (invariant #1) updated. See the finalization-pass change-log entry below and `docs/inventory/reviews/ic-1-review/negative-stock-policy-conflict.md` (marked RESOLVED). |
| IC-2 Movement reversal                                               | ⬜ NOT STARTED | Depends on IC-1.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      |
| IC-3 Receiving consolidation                                         | ⬜ NOT STARTED | Depends on IC-1.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      |
| IC-4 Branch transfer / MMJ rebuild                                   | ⬜ NOT STARTED | Depends on IC-1, IC-3. Carries an open product-semantics question (see implementation plan's own IC-4 section: whether "in transit" should mean physically moving vs. merely reserved) that needs product-owner resolution before or during this phase.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                               |
| IC-5 RepairOrder physical-location projection consolidation          | ⬜ NOT STARTED | Depends on IC-1, IC-3.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                |
| IC-6 Legacy writer/helper removal                                    | ⬜ NOT STARTED | Depends on IC-1 (balance-getter replacement), IC-4 (311 disposition), IC-5 (Zone 5 direct-write removal).                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                             |
| IC-7 Inventory security/write-boundary closure                       | ⬜ NOT STARTED | Depends on IC-0's own live findings plus whatever IC-4 already closed.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                |
| IC-8 Full inventory regression / concurrency / performance hardening | ⬜ NOT STARTED | Final phase before the INVENTORY CORE FINAL GATE.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                     |
| **INVENTORY CORE FINAL GATE**                                        | ⬜ NOT REACHED | Required before Phase 10D (Container QR) may resume.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                  |

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
