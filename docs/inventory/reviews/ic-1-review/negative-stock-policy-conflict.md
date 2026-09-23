# IC-1 Correction Pass — `negative_stock_policy` Semantic-Contract Conflict

**Status: ✅ RESOLVED — product-owner decision, 2026-09-15, OPTION A.**

## Product-owner decision (2026-09-15)

**OPTION A chosen.** Final product contract, recorded verbatim:

1. `inventory_balances.on_hand_quantity` MUST NEVER be negative.
2. `reserved_quantity + allocated_quantity <= on_hand_quantity` MUST ALWAYS
   hold.
3. `negative_stock_policy='allow'` and `'allow_with_approval'` are
   SUPERSEDED/DEPRECATED specifically for physical `on_hand` behavior.
4. They must NOT bypass the IC-1 hard invariant.
5. The column/CHECK values are not removed in this pass.
6. IC-2 does not begin until this decision is documented and
   regression-tested — done, see `inventory-core-progress.md`'s own IC-1
   finalization-pass change-log entry (same date).

**No DB/code change was required.** The already-applied CHECK and P0003
invariant already implement this contract exactly — confirmed by this
document's own diagnostic below (both `'allow'` and `'block'` already
produced byte-identical rejections before this decision was even made).

**Cleanup ownership assigned**: retiring `negative_stock_policy`'s dead
`'allow'`/`'allow_with_approval'` values is now IC-6's scope (Legacy
Writer/Helper Removal — its own stated goal is "delete the confirmed-dead
paths"; see the implementation plan's own IC-6 section for the added item).
IC-7 (security/write-boundary closure) was considered and not used — this
is dead-configuration cleanup, not a raw-write/RLS security gap.

**New permanent regression** (documents the final contract, not a
diagnostic): `102_ic1_reserved_only_hard_invariant_test.sql`'s own Scenario
C (T7-T14, plan extended 6→14) — live-verified 14/14.

---

## Original investigation (below), preserved as historical record

## The conflict, in one paragraph

IC-1 added `CHECK (on_hand_quantity >= 0)` on `inventory_balances` and a new
unconditional check in `inventory_finalize_posting` rejecting any decrease
that would leave `on_hand < reserved_quantity + allocated_quantity`. When
`reserved_quantity + allocated_quantity = 0`, that condition reduces exactly
to `on_hand_quantity < 0` — meaning the new check now _also_ prevents on-hand
from ever going negative, for **any** stock, committed or not, regardless of
`inventory_settings.negative_stock_policy`. That setting is a real, live,
CHECK-validated 3-state column (`'block'` / `'allow'` / `'allow_with_
approval'`) that was deliberately designed, in the original v1 movement
engine plan, to let an org choose to permit negative on-hand. IC-1's own
change makes `'allow'`/`'allow_with_approval'` behaviorally identical to
`'block'` — the setting is now inert.

## Evidence gathered (all live or repo-wide, not inferred)

- **Schema**: `inventory_settings.negative_stock_policy text NOT NULL
DEFAULT 'block'`, `CHECK (negative_stock_policy = ANY (ARRAY['block',
'allow', 'allow_with_approval']))`. Live-confirmed via `pg_get_
constraintdef`.
- **Design intent**: `docs/warehouse-movements-refactor-plan.md` (the
  original v1 engine design doc) explicitly defines this column
  (line 339-342) and its pre-IC-1 engine semantics (line 379): "Negative
  stock check (v1: `on_hand` only): if `on_hand_quantity < 0` after update
  **and** `negative_stock_policy = 'block'`, RAISE EXCEPTION" — i.e. `'allow'`
  and `'allow_with_approval'` were designed to let the update through.
- **Live usage**: exactly 1 `inventory_settings` row exists across the whole
  database; it is set to `'block'`.
- **Production reachability**: repo-wide grep (`src/`) finds zero server
  actions, UI components, or hooks that read or write `negative_stock_
policy`. The only TypeScript reference is a migration-content string
  assertion in `inventory-phase1-migrations.test.ts`, and it asserts the
  presence of the _original_ `allow_negative_stock` boolean column (phase 1
  naming), not this later `negative_stock_policy` text column — meaning this
  setting has never had an application-layer path to actually be changed by
  a real org.
- **Accepted architecture**: `inventory-core-architecture.md` §0's full list
  of 19 closed product-owner decisions contains zero mentions of `negative_
stock_policy`, negative on-hand, or physical-layer backorder/oversell.
  Decision #15 ("Ambra uses HARD reservations: `reserved <= on_hand` always")
  is scoped to reservations specifically, not to on-hand negativity for
  entirely free stock — a different question. No decision anywhere
  establishes "on_hand_quantity >= 0 ALWAYS" as an intentional global target.

## Live diagnostic (transaction-scoped, rolled back)

Fixture: on_hand=2, reserved=0, allocated=0. Attempted a real physical
decrease of 5 via `inventory_create_and_finalize` (the same path
`putaway_repair_order_stock` and every other physical-movement caller uses).

| `negative_stock_policy` | Result | SQLSTATE | Balance after | Orphan headers |
| ----------------------- | ------ | -------- | ------------- | -------------- |
| `'allow'`               | FAILED | `P0003`  | unchanged (2) | 0              |
| `'block'`               | FAILED | `P0003`  | unchanged (2) | 0              |

Both produce the byte-identical message: `"0.000000 reserved + 0.000000
allocated = 0.000000 committed at this location, but only -3.000000 would
remain on hand"`. No `23514` raw CHECK violation ever surfaces — the P0003
check always fires first. Error semantics are already uniform regardless of
which option below is chosen.

## Why this was not decided unilaterally

Diagnostic question C ("was the accepted architecture intentionally meant to
eliminate negative on-hand globally?") is **false** — nothing in the 19
closed decisions addresses it. Diagnostic question D ("was the CHECK added
under an incorrect assumption?") is **true** — it was added purely because
IC-0's audit flagged it as a missing constraint, without cross-referencing
`negative_stock_policy`'s own pre-existing design. Since Option A's own
stated precondition ("if Inventory Core's accepted hard invariant really is
on_hand_quantity >= 0 ALWAYS") is not met, and removing/weakening an
already-applied hard invariant is explicitly an architecture decision, this
was reported rather than resolved unilaterally.

## Proposed minimal correction, per outcome (NOT applied — for product-owner review)

**If Option A is chosen (global non-negative is the final contract)**:

- No further DB change is needed — the CHECK and P0003 check already
  achieve this.
- Update `inventory-core-architecture.md` and `inventory-core-progress.md`
  to explicitly classify `negative_stock_policy='allow'`/`'allow_with_
approval'` as **superseded/deprecated for on-hand** (the column itself
  may remain, e.g. for future use against a different field, or be
  scheduled for removal in a later IC phase — record the cleanup owner/
  phase at that time).
- Add one regression assertion (e.g. appended to `102_...` or a new small
  file) proving `'allow'` cannot bypass the hard invariant, mirroring the
  diagnostic in `test-and-concurrency-evidence.md`.
- Given zero live usage and zero production reachability, this is very low
  risk to adopt.

**If Option B is chosen (`'allow'`/`'allow_with_approval'` must remain
functional for uncommitted stock)**:

- The unconditional table CHECK (`inventory_balances_on_hand_nonnegative`)
  would need to be dropped or replaced, since a plain CHECK cannot read
  `inventory_settings` (a different table) to make itself policy-aware.
- `inventory_finalize_posting`'s own new invariant would need to become
  policy-aware: **the commitment-protection half must remain absolutely
  unconditional** (`on_hand >= reserved_quantity + allocated_quantity` can
  never be bypassed by any policy value — this is the accepted, unchanged
  IC-1 core) — only the _residual_ `committed=0` case (bare on-hand
  negativity with nothing reserved/allocated) would be gated by `negative_
stock_policy IN ('allow','allow_with_approval')`.
- This is a real code change to an already-accepted, already-live function
  and constraint — exactly the kind of migration this pass declined to apply
  without product-owner sign-off.

## Recommendation (historical — matches the decision actually made)

Given (a) zero live usage, (b) zero production reachability today, and
(c) the setting's original design predates Inventory Core consolidation
entirely, Option A carries materially lower risk and requires no further
database change. **The product owner subsequently chose Option A, 2026-09-
15 — see the RESOLVED section at the top of this document.**
