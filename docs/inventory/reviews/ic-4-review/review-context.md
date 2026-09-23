# IC-4 Review Context — Branch Transfer / MMJ Rebuild

**Scope**: IC-4 only. IC-0/IC-1/IC-2/IC-3/IC-7A's own accepted
architecture is not reopened. IC-5, full IC-7, Phase 10D, container/QR,
RepairOrder projection consolidation, WZ/201 are NOT started/touched.

**Baseline**: `97f0e9d923cefbf9043eaefcab25d4c1cf9315b1` (commit `ic7a`),
branch `zone3-zone5-integration-audit` — confirmed clean working tree at
this exact commit before any IC-4 work began.

**Product-owner decision under implementation** (closed before this
phase began, stated verbatim in the assigning brief): `in_transit` means
the goods have PHYSICALLY LEFT the source branch — never merely
reserved. The OLD `inventory_create_branch_transfer` set `status=
in_transit` immediately at creation time, with stock only reserved, not
moved — semantically wrong per this decision, corrected in this phase by
introducing a `prepared` pre-shipment status and moving the `in_transit`
transition (plus the real physical `311` movement) to a new, dedicated
`inventory_send_branch_transfer` RPC.

**Why the pre-existing `inventory_accept_branch_transfer`/`inventory_
decline_branch_transfer` needed a full rebuild, not a patch**: live
inspection (not trusted from the pre-IC-1 audit) found both were
genuinely broken beyond the audit's own finding — `accept` called a
nonexistent `inventory_allocate_movement_number` (confirmed, matching
the old audit) AND hand-wrote `inventory_movement_headers`/`_lines`/
`inventory_balances` directly, entirely bypassing the canonical engine
(violating this project's own "no hand-written balances/ledger" rule
established since IC-1). `decline` hand-wrote an automatic "return"
movement for the post-shipment case, which the new product decision
explicitly forbids. Additionally — a genuinely NEW, previously
undisclosed finding — both were `SECURITY DEFINER` with live `anon`
EXECUTE (and `inventory_create_branch_transfer` itself never checked
`p_actor_user_id` against `auth.uid()` at all, `SECURITY INVOKER` at the
time), matching the exact class of gap IC-7A closed on the generic
movement engine, on a completely different set of functions IC-7A's own
narrow scope did not touch.

## Please verify these things

1. **Was the `in_transit` semantic actually corrected, not merely
   relabeled?** Confirm `inventory_create_branch_transfer` now returns
   `status: prepared` (not `in_transit`) and that a real `311` movement
   only exists after `inventory_send_branch_transfer` is called — see
   Scenario A (T A1/A4) in `test-evidence.md` and the live worked
   example transcript below.
2. **Is the reservation-consumption ordering in `inventory_send_branch_
transfer` actually correct, not merely passing by coincidence?**
   Confirm the migration's own comment and code: reservation lines are
   decremented (`reserved_quantity -= remaining`, `fulfilled_quantity
+= remaining`) BEFORE `inventory_finalize_posting_internal` is
   called — this is what allows the physical decrease down to exactly
   the committed boundary without spuriously tripping IC-1's own P0003
   check. Confirm this is also atomic (a failed post rolls back the
   reservation consumption too) by reading the function body — there is
   no intermediate COMMIT.
3. **Does `inventory_finalize_posting_internal(header_id, actor, NULL)`
   genuinely reuse `311`/`312`'s own type-catalog effects, without
   reopening IC-2's frozen "explicit effects only for type 900"
   contract?** Read `inventory_finalize_posting_internal`'s own
   unchanged guard (`IF p_explicit_effects IS NOT NULL AND v_header.
movement_type_code <> '900' THEN RAISE ... END IF`) and confirm both
   new RPCs always pass `NULL` for this parameter.
4. **Is the partial-accept correlation genuinely by `transfer_line_id`,
   never SKU/variant?** See Scenario O in `106_...` — two lines sharing
   the same variant, independently accepted/discrepancy-tracked.
5. **Is the discrepancy arithmetic actually enforced by the database,
   not merely by application discipline?** Confirm the `CHECK (missing_
quantity = sent_quantity - accepted_quantity)` and `CHECK (missing_
quantity > 0)` constraints on `inventory_branch_transfer_
discrepancies` live (`\d inventory_branch_transfer_discrepancies` or
   `pg_get_constraintdef`).
6. **Is post-shipment decline/cancel genuinely a hard rejection, with
   no automatic return movement anywhere in the code path?** Read
   `inventory_decline_branch_transfer`'s own body — confirm the OLD
   `ELSIF v_transfer.source_movement_id IS NOT NULL THEN ... INSERT INTO
inventory_movement_headers ...` branch (the automatic-return logic)
   is genuinely GONE, not merely unreachable.
7. **Are the three concurrency proofs genuinely two independent
   connections, not one transaction pretending to be concurrent?** See
   `concurrency-evidence.md` — confirm the reported wall-clock blocking
   durations (2672ms/3778ms/2628ms) are consistent with real lock
   contention against the other session's own `pg_sleep(4)`, and that
   each test used two separately-invoked `psql` processes (real OS
   connections), not two statements in one script.
8. **Is the raw-write RLS closure genuinely complete, and was the
   silent-UPDATE-vs-raising-INSERT distinction (L2's own self-caught
   test bug) actually understood, not just patched around?** Confirm via
   `pg_policies` that `inventory_branch_transfers`/`_lines` carry zero
   PERMISSIVE policies for INSERT/UPDATE/DELETE plus the new explicit
   RESTRICTIVE-false ones, and re-run Scenario L (L1-L4) independently
   if useful.
9. **Is the 311/312 movement-type decision (redefine 311, seed new 312)
   actually justified by a genuine "zero live rows" check, not
   assumed?** Confirm `SELECT count(*) FROM inventory_movement_headers
WHERE movement_type_code='311'` returns `0` as of the IC-4 baseline
   (the query used and its live result are recorded in
   `migration-summary.md` item 5).
10. **Is IC-1's own commitment invariant genuinely still protected for
    branch transfers specifically, not merely assumed inherited?** See
    Scenario N — an unrelated commitment on the same bucket blocks
    `send` with `P0003`, live-proven, not inferred.

## Known, disclosed limitations (not defects)

- Full IC-7 (posted-header GUC UPDATE bypass, reservation/allocation raw
  -write RLS, the systemic `anon` default-privilege behavior) remains
  fully open — out of this phase's own scope, per explicit instruction.
- No UI wiring was done in this phase (server actions/service methods
  only), per explicit instruction — `send`/`cancel`/partial-accept are
  reachable via the action layer but have no corresponding page/button
  yet.
- The `inventory_cancel_branch_transfer` migration redundantly re-adds
  the `cancelled_by` foreign key that migration 1 already created under
  its own default name — harmless, disclosed in `migration-summary.md`
  item 12, not worth a separate corrective migration.
- No dedicated Vitest unit test exists for `InventoryEnterpriseService`
  itself (matches the pre-existing convention — this service's branch-
  transfer methods are thin RPC wrappers, and the real behavioral proof
  lives in `106_ic4_branch_transfer_test.sql`'s own live pgTAP
  coverage, not in a mocked unit test).

## IC-4 correction pass (2026-09-16) — please additionally verify

External review of the original IC-4 diff found three correctness gaps,
closed in a single new migration (13) plus a TypeScript fix. Please
verify:

11. **Is the orphan-312-draft fix genuinely structural, not a patch that
    merely hides the symptom?** Read `20260916170438_ic4c_...`'s own
    body — confirm the header `INSERT` is now gated on `v_total_
accepted > 0`, computed via a set-based query BEFORE the `INSERT`
    is ever reached, rather than the header being created-then-
    conditionally-cleaned-up. Confirm this by re-running the exact
    100%-missing reproduction in `test-evidence.md`'s own "A" section.
12. **Is the explicit-payload validation genuinely complete and
    ordered before any mutation?** Confirm the validation block (array
    check, duplicate check, unknown/foreign-id check, exactly-one-per-
    line check, quantity-range check) runs entirely BEFORE the
    `UPDATE ... SET destination_location_id` statement — that UPDATE
    was itself a "mutation before validation" gap in the original code
    that needed moving, not just the header/discrepancy inserts.
13. **Does the discrepancy `destination_movement_id` invariant hold in
    both directions?** Confirm live: `NULL` when transfer-wide accepted
    total is `0` (Scenario Q), and equal to the real POSTED header's id
    when accepted total is `> 0` (the mixed-outcome re-verification in
    `test-evidence.md`'s own "A" section) — never a draft, never a
    mismatched movement.
14. **Is the audit-event fix actually reading the RPC's own result, not
    a proxy for it?** Read `acceptInventoryBranchTransferAction`'s own
    updated code — confirm `partial` is derived from `(result.data as
...)?.status === "partially_accepted"`, not from any property of
    `parsed.data` (the input).
15. **Was 106's own plan count exactly re-verified against the actual
    executed assertion count, not just declared?** Confirm `SELECT
plan(87)` and the live run's own `not_ok_count=0, total_
assertions=87` agree exactly (a pgTAP file whose `plan()` doesn't
    match its own executed assertion count fails on its own, so this is
    a low-risk item, but confirm it was not silently adjusted to make a
    wrong count pass).
