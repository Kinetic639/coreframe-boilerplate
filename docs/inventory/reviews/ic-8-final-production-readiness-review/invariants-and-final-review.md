# IC-8 — Sections 17-19, 21-23, 25-26: Synthesis Review

Per this task's own instruction, these sections synthesize/cite evidence
already produced by earlier IC phases (and this pass's own Sections 6-16)
rather than re-deriving it from scratch, where that evidence still
applies to the accepted, current architecture.

## Section 17 — Lock order

Full live evidence already in `concurrency-evidence.md` (Section 16).
Summary: every canonical writer acquires locks in one fixed order —
`inventory_get_or_create_balance_for_update`'s balance-row `FOR UPDATE`
is always the first (or only) contended row per writer; `inventory_
reverse_movement`/branch-transfer RPCs additionally lock their own
single header/transfer row before ever reaching the balance primitive;
`inventory_add_to_container_internal` locks container → allocation-line
→ container-line, in that fixed order, every call. No cross-row
lock-ordering hazard was found in this pass or any prior IC phase — every
scenario tested constructs at most one genuinely cross-function
contended row per session. No deadlock was observed in any of the five
genuine live two-session tests (IC-1 through IC-4).

## Section 18 — Idempotency

**Receiving**: `inventory_receive_stock`'s idempotency key is enforced by
a real partial unique index (`inventory_movement_headers_org_idempotency_
uidx`), proven under genuine two-session concurrency (IC-3): both
sessions return the identical `movement_id`, no double-post, no raw
error surfaced to the loser (`GET STACKED DIAGNOSTICS ... CONSTRAINT_
NAME` catch). Unchanged since IC-3 (confirmed via `pg_get_functiondef`
this pass).

**Branch-transfer accept**: idempotent by design at the RPC level — a
second `inventory_accept_branch_transfer` call on an already-`accepted`/
`partially_accepted` transfer short-circuits and returns the same
`destination_movement_id` with `already_processed: true`, proven live
under genuine two-session concurrency (IC-4).

**Movement posting itself is NOT separately idempotent** beyond the
draft-header idempotency key — re-finalizing an already-posted movement
is prevented by status checks (`P0007`-class rejections), not a separate
idempotency mechanism, which is the correct design (a posted movement is
immutable; there is nothing to "retry" once posted).

## Section 19 — Reversal final review

IC-2's reversal design (`inventory_reverse_movement`) is unchanged in its
core locking/validation logic since its own original implementation and
its later security-boundary correction (confirmed via `pg_get_
functiondef` this pass — the only historical change was which internal
function it calls, not any lock/validation logic, per IC-2's own
disclosure). Double-reversal is proven blocked under genuine live
concurrency (`concurrency-evidence.md`, item C). This pass's own ledger
fix was regression-verified to leave reversal working end-to-end
(`security-evidence.md`). **Known gap, not a defect**: `inventory_
reverse_movement` has zero TypeScript callers in either app (caller-audit
agent finding) — the DB-layer capability is correct and secure, but there
is no product entry point to actually invoke it. See `deferred-debt.md`
item 3.

## Section 21 — Source-of-truth check

Confirmed live this pass (`test-evidence.md`, file 116): the append-only
`inventory_stock_ledger_entries` table plus `inventory_balances` (the
maintained aggregate) are the sole persisted physical truth; A8 removed
the entire persisted RepairOrder-attribution projection layer
(`repair_order_line_locations`, `repair_order_location_attribution_
uncertain`, their trigger, and both rebuild RPCs — all confirmed
structurally gone). `repair_order_line_movement_links` is the sole
persisted attribution source, unaffected by A8. `get_repair_order_line_
physical_state` is a live, on-demand, `SECURITY INVOKER` read over the
canonical link table plus current balances — not a second, potentially-
divergent source of truth. A generic movement at an already-attributed
bucket creates zero new attribution rows (test 116, assertion I1) and the
live read correctly surfaces the resulting inconsistency as `P0008`
(assertion I3) rather than silently misrepresenting it — the
architecture has exactly one persisted truth (the ledger/balances) and
one derived, always-fresh read (the live-state function), with no
opportunity for the two to drift out of sync the way the old
incremental-projection design could.

## Section 22 — Negative-stock / commitment invariant

**DB-level backstop** (interleaving-proof by construction, verified live
this pass): `inventory_balances_on_hand_nonnegative`, `_reserved_
nonnegative`, `_allocated_nonnegative` CHECK constraints — see
`concurrency-evidence.md`'s own CHECK-constraint section.

**Cross-field invariant** (`reserved + allocated <= on_hand`): enforced
by the application-level `P0003` check inside `inventory_finalize_
posting_internal`, proven correct under genuine live concurrency in IC-1
(both the `allocated`-only and `reserved`-only cases, and the permanent
`negative_stock_policy` product-decision regression, 14/14 in pgTAP file
102 — re-confirmed passing this pass via the full 42/42 pgTAP run,
`test-evidence.md`).

**Product contract** (resolved 2026-09-15, IC-1): global non-negative
on-hand is the permanent contract; `negative_stock_policy`'s `'allow'`/
`'allow_with_approval'` values are superseded for on-hand behavior. No
code change was required for this pass — the already-applied CHECK/P0003
invariant matches the decision exactly, re-confirmed still true.

## Section 23 — RLS / tenant isolation

Full live adversarial evidence in `security-evidence.md` (Section 7):
cross-org and cross-branch access denied on every table tested via
`has_branch_permission`/RLS org+branch scoping; `anon` write denied
everywhere (table-privilege revokes checked before RLS, un-bypassable by
GUC manipulation); actor spoofing (`28000`) rejected on every RPC
checked. The one false alarm (`inventory_container_lines` RESTRICTIVE-
policy AND-semantics misread) was resolved via direct adversarial
re-probe, not left as an open question. The one real gap found
(`inventory_stock_ledger_entries` raw-insert bypass) was fixed and
regression-verified — see `security-evidence.md` for the full transcript.

## Section 25 — Valuation-snapshot defect

Pre-existing finding from the architecture compression review (not
rediscovered or newly investigated in IC-8 itself): `inventory_balance_
analytics` view is defined in a tracked migration that appears to have
never been applied to (or was lost from) the live database — a
migration/DB-drift bug with zero current callers, recommended DEFER by
that review. Not independently re-verified live in this pass (out of
scope — no evidence this relates to any of IC-8's own hard-blocker
criteria for the accepted architecture). Carried forward in
`deferred-debt.md`, item 10.

## Section 26 — Branch-transfer / reversal UI completeness

**Branch-transfer**: genuinely wired end-to-end. `acceptInventoryBranch
TransferAction`/`declineInventoryBranchTransferAction` are imported and
invoked from `inventory-movement-detail-panel.tsx` (confirmed by the
caller-audit agent); the full create→send→accept/decline/cancel
lifecycle has real UI paths in the generic Movements UI (embedded rather
than a standalone "Transfers" page — a minor discoverability wrinkle, not
a completeness gap).

**Reversal**: **NOT complete.** `inventory_reverse_movement` — the only
capability that can undo an already-posted movement — has zero
TypeScript callers in either app. The only reachable "undo" from the
shipped product today is `inventory_cancel_movement`, which only applies
to still-draft, never-posted movements. This is a genuine product-
completeness gap (not a DB-layer defect — the RPC itself is correct,
secure, and tested), carried forward in `deferred-debt.md`, item 3, and
flagged prominently for the final readiness assessment: **a real user who
posts an incorrect movement today has no UI path to reverse it.**
