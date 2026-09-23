# IC-1 Review Context — Canonical Movement Engine / Hard Stock Invariants

> **UPDATE (IC-1 is now FULLY FINAL, 2026-09-15)**: external review accepted
> IC-1's core (commitment invariant, locking, SUM formula, helper
> replacement, pgTAP evidence, concurrency proof) outright. The one open
> question (`negative_stock_policy`'s interaction with the new CHECK) has
> since been resolved by explicit product-owner decision (OPTION A — global
> non-negative on-hand is the permanent contract) — see
> `negative-stock-policy-conflict.md` (marked RESOLVED) for the full
> investigation and decision record. No migration was required to implement
> the decision — the already-applied CHECK/P0003 invariant already matched
> it. A new permanent regression (102's own Scenario C, 14/14) now documents
> the final contract. Everything below this notice describes the original
> IC-1 submission and remains accurate for it.

**Scope**: IC-0 closure (live baseline re-verification) + IC-1 implementation
only, per `docs/inventory/inventory-core-implementation-plan.md`'s own IC-1
section. IC-2 is NOT started. Phase 10D is NOT started. No file outside
IC-0/IC-1's own scope was touched — see `changed-files.md`'s explicit
"No changes to" list, which reproduces the task's hard scope boundary
verbatim.

**Baseline**: HEAD at the start of this turn, branch
`zone3-zone5-integration-audit`.

**What changed, in one paragraph**: the shared, generic movement engine
(`inventory_finalize_posting`) previously had a live-proven blind spot — it
never checked `reserved_quantity`/`allocated_quantity` before reducing
`on_hand_quantity`, so a physical movement could strand committed stock
(leave `on_hand < reserved + allocated` at a balance row). IC-1 closes this:
the engine now rejects (SQLSTATE `P0003`) any decrease that would leave
`on_hand < reserved_quantity + allocated_quantity`, unconditionally, with no
partial writes. It also replaces the engine's internal balance-getter with
the already-established, lot/serial-aware-but-unused-here replacement
(`inventory_get_or_create_balance_for_update`), and adds the one missing
non-negative CHECK constraint IC-0 identified.

## Please verify these 8 things

1. **Commitment-stranding is genuinely impossible.** Read `migration-summary.md`'s
   migration 2, and `test-and-concurrency-evidence.md`'s 101/102 results.
   Confirm the check is unconditional (not gated by `negative_stock_policy`)
   and placed before the balance UPDATE, so no partial mutation can occur.

2. **Reserved-only stock is protected per the HARD-reservation contract**,
   not merely as a side effect of protecting `allocated_quantity`. See
   `102_ic1_reserved_only_hard_invariant_test.sql` and its 6/6 result —
   confirm the SUM formula (not `allocated` alone, not `reserved` alone, not
   their max) is what's actually implemented, and that this matches the
   architecture doc's own corrected §5/§6 (also worth checking that the
   correction I made to the architecture document itself — the original
   text used a weaker OR-of-either formula — is itself correct; the worked
   counter-example is in the architecture doc's own invariant #6 note:
   reserved=6, allocated=4, on_hand=8 passes both individual checks but not
   the SUM check, and the SUM is the one that's actually right).

3. **Legitimate movements remain valid.** See the "Legitimate-movement
   regression" section of `test-and-concurrency-evidence.md` (101/401/402/801
   against genuinely free stock, all still succeed) and the 097-100 pgTAP
   regression (133/133 total including 101/102, 0 failures).

4. **The balance-helper replacement preserved existing call semantics** and
   exposed no new lot/serial behavior. Check migration 2's diff: the call
   passes `NULL, NULL` (via migration 3's 7-arg fix) for lot/serial, matching
   v1's own implicit behavior. Confirm `inventory_v1_get_or_create_balance`
   is NOT dropped (that's IC-6's job) but does have zero remaining
   production callers (stated in the change log, worth spot-checking via
   `prosrc` search yourself if you want independent confirmation).

5. **The non-negative CHECK constraints are correct** and the pre-migration
   data-safety check was real. See migration 1 and IC-0's own change-log
   entry (37 rows checked, zero violations, before the constraint was
   added).

6. **Concurrency is genuinely safe.** Read the "Genuine two-independent-
   connection concurrency proof" section closely — confirm the 3684ms block
   is real blocking (not two independent short calls that happened not to
   race), that Session B's rejection happened only AFTER re-reading Session
   A's committed balance (not against a stale value), and that the "no
   residual data" disclosure for the 2 immutable movement headers / 3
   locations / 2 balance rows is an honest, correctly-reasoned exception
   (the system's own immutability trigger blocked deletion) rather than a
   swept-under-the-rug gap.

7. **No raw-write bypass invalidates the claimed invariant.** IC-0 found two
   genuine raw-write gaps (reservation/allocation tables' permissive-only
   RLS; movement-header status-blind INSERT policy) — confirm the reasoning
   in the progress doc's IC-0 entry for why neither defeats IC-1's own
   guarantee (the new check reads exclusively from the separately
   GUC-protected `inventory_balances` table; no trigger auto-applies a
   balance effect from a raw-inserted movement header/line) still holds, and
   that both are correctly deferred to IC-7 rather than either silently
   ignored or used as an excuse to broaden IC-1's scope.

8. **No Phase 10A/10B/10C behavior was altered.** `inventory_create_
reservation`, `inventory_release_reservation`, `inventory_create_
allocation`, `inventory_release_allocation`, and every Phase 10C
   container RPC are byte-for-byte untouched (verify against
   `changed-files.md`'s "No changes to" list and the 098/099/100 pgTAP
   regression, all passing unchanged).

## Known, disclosed limitations (not defects)

- IC-1 does not implement any sanctioned bypass operation (whole-container
  relocation, allocated loose-stock relocation) — those remain IC-8/future
  work per the architecture doc's own §6. Generic movement therefore
  rejects unconditionally whenever it would strand a commitment; there is
  currently no legitimate way to relocate committed stock at all except by
  first releasing/re-allocating it through the reservation/allocation
  domain. This is intentional for this phase, not an oversight.
- The two IC-0-identified raw-write RLS gaps remain open (IC-7's job).
- The concurrency test's own residual data (2 immutable movement headers +
  3 locations + 2 balance rows) is permanent, by design, and disclosed in
  full in `test-and-concurrency-evidence.md`.
