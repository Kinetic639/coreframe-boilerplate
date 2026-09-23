# IC-5 Review Context — RepairOrder Physical Projection Consolidation

**Scope**: IC-5 only. IC-0/IC-1/IC-2/IC-3/IC-4/IC-7A's own accepted
architecture is NOT reopened. IC-6, full IC-7, IC-8, and Phase 10D are
deliberately NOT started.

**Baseline**: `97f0e9d923cefbf9043eaefcab25d4c1cf9315b1` (commit
`ic7a`), branch `zone3-zone5-integration-audit`. IC-4 and IC-4's own
narrow correction pass exist only as uncommitted working-tree changes
at the time IC-5 began (consistent with the standing no-auto-commit
policy in this project — the live database was already fully migrated
for both, and this is not itself an IC-5 defect).

**Problem statement**: the Zone-5 projection (`repair_order_line_
locations` + `repair_order_location_attribution_uncertain`) predates
the final Inventory Core architecture. IC-2 had already found and
patched one concrete corruption risk (movement reversal could corrupt
the projection) via the `ambra.repair_order_attribution_authoritative`
GUC — but that GUC was explicitly only a temporary safety boundary: it
prevented corruption by making reversal simply skip projection updates
entirely, which left the projection correct-but-STALE after any
reversal. IC-5's job was to give the projection ONE coherent derivation
from the canonical inventory movement/ledger plus the RepairOrder
attribution model, eliminating that staleness debt rather than
re-patching the symptom again.

## Please verify these things

1. **Is the inventory ledger/balance (`inventory_balances` +
   `inventory_stock_ledger_entries`) still the ONLY source of physical
   stock truth?** Confirm the rebuild primitive
   (`rebuild_repair_order_projection_bucket_internal`) reads
   `on_hand_quantity` and ledger effects only, and writes nothing back
   to the ledger itself — projection is purely downstream.
2. **Are the three concepts (A = physical ledger truth, B = business
   attribution via `repair_order_line_movement_links`, C = the location
   projection) genuinely kept separate, with C strictly derived from
   A+B?** Read the rebuild formula in migration 3
   (`20260916182731_...`) and confirm it never reads or writes `C`
   except to recompute it from `A` and `B`.
3. **[CORRECTED by the narrow correction pass — see its own section
   below] Is there now exactly ONE internal canonical writer of
   `repair_order_line_movement_links`, with every direct writer
   (`attach_repair_order_line_movement`, `putaway_repair_order_stock`,
   the reversal-aware trigger) funneling through it?** The original
   claim here ("attach is the sole writer") was found FALSE by external
   review — confirm `write_repair_order_line_movement_link_internal`
   is the only function performing the actual `INSERT`, and that raw
   client writes remain closed (unchanged since an earlier IC-2-era
   migration).
4. **Can the projection genuinely be destroyed and deterministically
   rebuilt, with zero loss of business truth?** Confirm `rebuild_
repair_order_projection_bucket_internal` only `DELETE`s and
   recomputes rows in `repair_order_line_locations`/`repair_order_
location_attribution_uncertain` — never touches `repair_order_line_
movement_links` (the business-attribution history) at all. See
   pgTAP Scenarios K/L and `projection-reconciliation-evidence.md`.
5. **Did generic movement reversal (`inventory_reverse_movement`)
   genuinely remain RepairOrder-agnostic?** Read its own function body
   (unchanged this phase) and confirm it contains no reference to any
   `repair_order_*` table. All new reversal-awareness lives in the
   trigger, not the generic engine.
6. **Is split-attribution reversal (one movement line, multiple
   RepairOrderLines) handled correctly — by exact attribution identity,
   never by SKU?** See pgTAP Scenario G (G1-G4) and the trigger's own
   `line_number`-ordinal correlation in migration 10
   (`20260916184357_...`).
7. **Was the accepted putaway UNKNOWN-source hard-rejection behavior
   preserved byte-for-byte, not reopened?** Diff `putaway_repair_
order_stock` against its pre-IC-5 body — confirm the only additions
   are the relocation-link write (migration 9) and the ordinal-
   correlation fix; the UNKNOWN-check logic itself is untouched. See
   pgTAP Scenario H.
8. **Does the generic-movement inference path in the trigger still
   never GUESS attribution beyond its own pre-existing confidence
   heuristic?** Confirm no new code path in migration 5/10
   (`...reversal_aware.sql` / `...mirror_relocation_on_reversal.sql`)
   weakens the "exactly one distinct line + sum matches pre-effect
   on_hand" confidence check for non-reversal cases.
9. **Does unattributed receiving genuinely create no fabricated
   ownership?** See pgTAP Scenario J (a 10-unit receipt, only 6
   attached — the remaining 4 is represented as UNKNOWN, never
   auto-assigned to the one line present).
10. **Is the architecture actually capable of consuming issue-category
    attribution later, without requiring further schema changes, even
    though zero issue-category movement types exist live today?**
    Confirm `attach_repair_order_line_movement`'s own `relation_type
= 'issue'` branch and the rebuild formula's own generic ledger-
    direction handling (`sle.direction = 'increase'`/`'decrease'`) are
    not receipt-specific. Confirm no Phase 10F work was invented (zero
    `category='issue'` movement types live, verified read-only).
11. **Is the new rebuild mechanism at the right scope, matching actual
    usage?** Confirm the internal primitive operates per-bucket
    (`org, branch, location, variant`) and the public wrapper operates
    per-RepairOrder (finding every bucket that RepairOrder's own
    attribution history has touched) — not some other granularity.
12. **Is the rebuild genuinely idempotent and does it genuinely equal
    the incremental result, for real (not merely by construction)
    scenarios?** See pgTAP Scenarios K/L and the worked-example
    narrative in `projection-reconciliation-evidence.md`.
13. **Is `quantity >= 0` actually enforced at the DB level, not just by
    application discipline, and is there truly no `greatest(0,...)`
    clamp anywhere in the new or touched code?** Confirm the CHECK
    constraint (migration 1) and grep the rebuild primitive/trigger/
    putaway for any clamping pattern — none should exist; violations
    must hard-error `P0008` instead. See pgTAP Scenario O.
14. **Is UNKNOWN stickiness genuinely preserved — does a later known
    contribution at an already-UNKNOWN bucket ever silently clear the
    marker?** See pgTAP Scenario I (I1-I3): a bucket seeded UNKNOWN
    stays UNKNOWN even after a real 2-unit known contribution lands at
    the same bucket.
15. **Is the IC-2 GUC's own staleness compromise genuinely eliminated,
    not merely relabeled?** Confirm reversal no longer relies on the
    GUC to skip projection updates — read the trigger's own reversal
    branch (migration 5/10) and confirm it runs BEFORE the `authoritative
= 'on'` short-circuit, so a reversal always rebuilds regardless of
    the GUC's current value.
16. **Is the GUC's disposition (retained, not removed) actually
    justified, and not merely "reversal is safe because we skip
    projection updates forever"?** Confirm the GUC's remaining role is
    purely the pre-existing "defer to orchestrating caller"
    double-write-prevention signal (used by receive/putaway/attach),
    unrelated to reversal correctness after this phase.
17. **Is the trigger's own retain-and-extend disposition (vs.
    replace/retire) justified by genuine transactional-correctness/
    coupling analysis, not just convenience?** Confirm the change-log/
    architecture-doc §9C's own stated rationale and that no dead code
    path was left behind in the trigger.
18. **Is every projection update genuinely inside the SAME transaction
    as the triggering receive/putaway/attach/reversal call — never a
    later, separate step?** Confirm all rebuild calls are synchronous
    `PERFORM` calls or trigger-driven, with no queuing/deferred
    mechanism introduced.
19. **Is the "no genuine race, therefore no dedicated concurrency
    test" argument actually sound, not just asserted?** Read
    `concurrency-evidence.md` and independently confirm the `FOR
UPDATE` clause in `rebuild_repair_order_projection_bucket_internal`
    is present, targets the correct bucket columns, and is the FIRST
    statement in the function body (no read-before-lock window).
20. **Is writer closure genuinely complete — are there truly zero
    remaining production writers of `repair_order_line_locations`/
    `repair_order_location_attribution_uncertain` outside the trigger,
    the rebuild primitive, and the (unchanged) putaway/receive direct-
    write paths?** Confirm via `pg_policies` that raw INSERT/UPDATE/
    DELETE are RESTRICTIVE-denied for `authenticated` on both tables
    (migration 2) and re-run pgTAP Scenario M independently if useful.

## IC-5 narrow correction pass (2026-09-16, same day) — please additionally verify

External review of the original IC-5 diff found two issues: a BLOCKER
(reversed putaway rebuilt the wrong projection bucket set) and a false
documentation claim ("attach is the sole writer"). Both closed forward
(no migration edited, no redesign). Please verify:

21. **Is the reversed-putaway BLOCKER genuinely fixed, not merely
    patched around?** Read the trigger's own reversal branch in
    migration `20260916201541_...` — confirm it derives BOTH buckets
    from `SELECT source_location_id, destination_location_id ... FROM
inventory_movement_lines WHERE id = NEW.movement_line_id` (the
    reversal movement LINE itself), never from `NEW.location_id` or
    `NEW.direction`, and rebuilds each exactly once (guarded by `v_dest
IS DISTINCT FROM v_source`). Re-run pgTAP Scenarios Q (full putaway
    reversal) and R (partial putaway reversal) independently if useful
    — both assert the SOURCE bucket is correctly restored, not merely
    the destination.
22. **Was the BLOCKER genuinely live-reproduced BEFORE any fix, not
    assumed from the reviewer's own report?** See `test-evidence.md`'s
    own "Pre-fix reproduction" section for the exact live transcript
    (physical balances correct, projection's own Receiving bucket
    stale at 0, Shelf-A's own bucket correct only by arithmetic
    coincidence).
23. **Is there now genuinely exactly ONE internal writer of
    `repair_order_line_movement_links`, with attach/putaway/the trigger
    all funneling through it?** Confirm `write_repair_order_line_
movement_link_internal` is `SECURITY DEFINER`, `EXECUTE`-revoked
    from `PUBLIC`/`anon`/`authenticated`/`service_role` (migration
    `20260916201516_...`'s own final `REVOKE ALL`), and that `attach_
repair_order_line_movement`/`putaway_repair_order_stock`/the
    trigger each call it rather than performing their own `INSERT`.
    Re-run pgTAP Scenario T (direct call denied for `authenticated`)
    independently if useful.
24. **Is the public `attach_repair_order_line_movement` contract
    genuinely frozen — can an ordinary authenticated caller submit
    `relation_type='relocation'` or `'reversal'`?** It must still be
    rejected `22023`. Re-run pgTAP Scenario S independently if useful.
25. **Does the internal writer's own generic invariant set still
    apply correctly to attach/putaway (both should still require
    `status='posted'`), while the ONE documented exception (the
    trigger's own reversal-mirror call, `p_require_posted=false`) is
    narrowly scoped and justified, not a general weakening?** Read the
    trigger's own call site in migration `20260916201541_...` — confirm
    `false` is passed ONLY there, and confirm 097's own T10 (draft
    movement line rejected `55000` via attach) still passes, proving
    attach's own posted-check was not weakened.
26. **Does the internal writer still enforce every other generic
    invariant (org/branch compatibility, variant compatibility, the
    per-movement-line quantity cap, duplicate/unique handling)
    identically for all three callers?** Re-run pgTAP Scenario J (cap/
    partial attribution) and Scenario O (no-negative-projection) from
    the original pass, plus 097's own T5/T6b/T20-T25 (cap/duplicate),
    independently if useful — all should be unaffected by the
    centralization.
27. **Was 097 (Phase-10's own attach test) genuinely re-run in FULL,
    not merely spot-checked, given this correction touches the
    canonical attribution-write boundary Phase 10 established?**
    Confirm `test-evidence.md`'s own reported 29/29 for 097 and that no
    assertion's own expected value was adjusted to make a wrong result
    pass.

## Known, disclosed limitations (not defects)

- No dedicated two-connection concurrency test was performed — see
  `concurrency-evidence.md` for the structural lock-path argument
  (§34 of the assigning task explicitly allows this).
- Both projection tables held zero live rows at the start of this
  phase — no drift analysis beyond a read-only row count, and no
  backfill, was required or performed.
- No UI/read-model work was done this phase (server/DB layer only),
  per explicit instruction — `getPhysicalStateForLine` and any other
  UI consumer were not touched and their semantic shape is unchanged.
- The historical Zone-5 migrations (`zone5_receiving_location_
purpose`, `zone5_repair_order_spatial_attribution_schema`,
  `zone5_attribution_sync_trigger`, `zone5_attribution_sync_trigger_
max_uuid_fix`, `zone5_receive_repair_order_stock_rpc_v2`, `zone5_
putaway_repair_order_stock_rpc`, `zone5_receive_repair_order_stock_
use_canonical_attach`) exist live but were never locally mirrored
  under this project's own migration-mirroring discipline — pre-dates
  this IC-phase project. Flagged as a finding, not backfilled this
  phase (out of IC-5's own narrow scope; IC-5's own forward migrations
  against the live functions/triggers are unaffected by this gap).
- Two buggy-then-corrected migration pairs (the trigger's reversal-
  mirroring filter, and `attach_repair_order_line_movement`'s own
  double-write) were each applied as TWO separate forward migrations
  rather than one — per this project's own never-edit-an-applied-
  migration discipline, not a packaging oversight.
- `pnpm build` was not run this phase — no application/runtime
  TypeScript changed (IC-5 is entirely PL/pgSQL).
