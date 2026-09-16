# IC-3 Review Context — Receiving Consolidation

**Scope**: IC-3 only (the new `inventory_receive_stock` primitive, the
`receive_repair_order_stock` refactor, the `inventory_receive_purchase_
order` fix/refactor). IC-4 is NOT started. Phase 10D is NOT started.
IC-0/IC-1/IC-2 are not reopened — IC-2's own frozen security contract
(public 2-arg `inventory_finalize_posting` catalog-only; explicit effects
internal-only; `inventory_finalize_posting_internal` not executable by
ordinary roles) was re-verified live, unchanged, never touched (see
`changed-files.md`'s "No changes to" list).

**Baseline**: `b0b84a3872c6d052fe40c3866a5bdf198b1bd740` (commit `ic2`),
branch `zone3-zone5-integration-audit` — confirmed clean working tree at
this exact commit before any IC-3 work began.

**What changed, in one paragraph**: a new, domain-agnostic canonical
physical receiving primitive (`inventory_receive_stock`) was built,
delegating every physical effect through the existing, IC-2-frozen
`inventory_create_and_finalize` → public `inventory_finalize_posting`
path. `receive_repair_order_stock` (already working, zero live callers)
was refactored to delegate its own physical-posting step to the new
primitive while keeping every RepairOrder-specific business rule
byte-for-byte. `inventory_receive_purchase_order` was **live-confirmed
dead/broken before this phase** (called two functions that do not exist
in this database, zero UI/service reachability, only a static text-match
test) and was fixed onto the same primitive, with its own genuine
business rules preserved and its security model hardened for the first
time (it previously had no `SECURITY DEFINER` and no actor-identity check
at all). A separate, pre-existing, CRITICAL security finding — the
underlying engine layer (`inventory_create_and_finalize`/`inventory_
create_draft`/public `inventory_finalize_posting`) allows a fully
UNAUTHENTICATED `anon` caller to post an arbitrary movement, live-proven
— was discovered while designing the new primitive's own security model
and was explicitly NOT fixed in this pass; it is assigned to IC-7 as its
top-priority item.

## Please verify these 20 things

1. **Is there exactly one physical receiving implementation?** Read
   `inventory_receive_stock`'s own body (`pg_get_functiondef`) — confirm
   it is the ONLY code path that calls `inventory_create_and_finalize`
   for a 101 receipt from within either wrapper, and that neither
   wrapper does its own direct balance/ledger write.
2. **Is the new primitive domain-agnostic?** Confirm it references no
   RepairOrder table (`repair_order_lines`, `workshop_source_document_
lines`, `repair_order_line_source_links`, `repair_order_line_
locations`, `repair_order_line_movement_links`) and no Purchase Order
   table (`inventory_purchase_orders`/`_lines`) anywhere in its own body.
3. **Does it only perform physical inventory receiving?** Confirm it
   never writes `repair_order_line_movement_links`, never writes
   `repair_order_line_locations`, never mutates `inventory_purchase_
order_lines.received_quantity` or `inventory_purchase_orders.status`.
4. **Does the RepairOrder wrapper retain all provenance rules?** Compare
   `receive_repair_order_stock`'s own body against the pre-IC-3 version
   (in `diff.patch`) — confirm the provenance-resolution block (0/`P0002`,
   > 1/`55000`, wrong branch/`42501`, wrong variant/`22023`) is copied
   > verbatim, not rewritten.
5. **Does the PO wrapper retain all PO-specific rules?** Confirm the
   status guard, over-receipt check, and status-recomputation logic in
   `inventory_receive_purchase_order` match the ORIGINAL (never-working)
   intent exactly, not a newly-invented rule set — cross-check against
   `migration-summary.md` item 3's own side-by-side description.
6. **Can either wrapper partially commit after physical receipt
   failure?** Confirm both wrappers are single PL/pgSQL function bodies
   (one implicit transaction) — a failure inside the primitive call
   necessarily rolls back everything the wrapper had done up to that
   point in the SAME call. See F12-F13/G13-G14 in `test-evidence.md`.
7. **Can physical receipt survive after wrapper-specific attribution/
   state fails?** Confirm the OPPOSITE direction too: if `attach_repair_
order_line_movement` or the PO's own `received_quantity` UPDATE were
   to fail AFTER the primitive's own call succeeds but BEFORE the
   wrapper function returns, the whole transaction (including the
   already-posted movement) rolls back — single-function-body atomicity,
   same mechanism as #6.
8. **Are movement-line identities mapped deterministically?** Confirm
   the primitive's own returned `lines` array is built via `ORDER BY
line_number`, and that `line_number` itself is assigned sequentially
   in `inventory_create_draft`'s own input-array order (unchanged,
   pre-existing behavior) — the correlation is provably ordinal, not
   inferred.
9. **Can same-variant lines cross-contaminate?** See F3-F4 (primitive)
   and G3-G8 (RepairOrder wrapper, two DIFFERENT RepairOrderLines sharing
   one SKU) in `test-evidence.md` — confirm the live assertions genuinely
   prove independent, non-merged attribution.
10. **Is generic receiving unable to fabricate domain linkage?** Confirm
    the primitive's own `p_lines` shape has no `reference_type`/
    `reference_id` parameter at all (deliberately omitted, see
    architecture doc §7A) — there is no mechanism by which a generic
    caller could even attempt to claim RepairOrder/PO ownership.
11. **Is idempotency safe sequentially?** See F5-F6 and H11-H12 in
    `test-evidence.md`.
12. **Is idempotency race-safe if two calls arrive concurrently?** See
    `concurrency-evidence.md` — confirm the timing data genuinely shows
    blocking (not coincidental sequencing) and that the graceful-catch
    mechanism (not a raw error) is what Session B actually received.
13. **Are org/branch/location boundaries enforced?** Confirm `inventory_
create_draft`'s own pre-existing composite-FK validation
    (`destination_location_id, organization_id, branch_id`) still applies
    unconditionally (the primitive adds no bypass), and that `receive_
repair_order_stock`'s own cross-branch provenance check (G11) is
    unchanged.
14. **Did IC-3 preserve IC-1 invariant behavior?** Confirm receiving
    (a pure `on_hand` increase) never triggers the `P0003` stranded-
    commitment check (that check only fires on `decrease` effects) — no
    new test needed, but confirm the reasoning holds by reading `inventory_
finalize_posting_internal`'s own body (unchanged).
15. **Did IC-3 preserve IC-2's security boundary?** Confirm `grep` for
    `inventory_finalize_posting_internal` in every IC-3 file (migrations
    and the pgTAP test) returns zero matches — the primitive and both
    wrappers only ever call the PUBLIC 2-arg `inventory_finalize_
posting` (via `inventory_create_and_finalize`), never the internal
    one.
16. **Was Zone 5 behavior preserved?** Confirm `receive_repair_order_
stock` still sets `ambra.repair_order_attribution_authoritative`
    before posting (unchanged line, just relocated relative to the new
    primitive call) — Zone 5's own trigger reacts to the ledger insert
    regardless of which function issues it, so this GUC must still be
    set by the RepairOrder wrapper itself, not the primitive.
17. **Were PO semantics preserved, given the function never previously
    worked?** This is the one item where "preserved" cannot mean
    "regression-tested against prior live behavior" (there was none) —
    verify instead that the status-transition logic (`ordered` →
    `partially_received` → `received`) and the over-receipt guard match
    the ORIGINAL author's own evident intent in the pre-IC-3 source
    (visible in `diff.patch`), not a reinterpretation.
18. **Did the generic Warehouse receipt path remain compatible?** Confirm
    `createAndPostMovementAction`/`InventoryMovementsService.
createAndFinalize` (TypeScript, untouched by this phase) still calls
    `inventory_create_and_finalize` with the SAME 11-argument signature —
    the primitive's own existence changes nothing about that function's
    contract.
19. **Are no IC-7 issues silently worsened?** Confirm the NEW CRITICAL
    finding (unauthenticated `anon` posting via the raw engine layer) is
    accurately described as PRE-EXISTING (predates IC-1) rather than
    IC-3-introduced, and that IC-3's own 3 new/refactored entry points
    each independently reject `anon`/no-permission callers (Scenario J,
    `test-evidence.md`) — IC-3 does not ADD a new way to reach the
    unguarded layer, it merely didn't (and per explicit scope, could not)
    close the pre-existing one.
20. **Is IC-3 safe to freeze before IC-4?** Confirm regression is
    genuinely green (220/220, with the 098/100/103 anomalies correctly
    diagnosed as non-regressions — the known connection-pooler artifact
    and this session's own concurrency-fixture collision, respectively,
    not IC-3 code defects), and that the CRITICAL new finding is
    prominently disclosed (not buried) so it can be prioritized
    appropriately for IC-7 regardless of whether IC-4 proceeds first.

## Known, disclosed limitations (not defects)

- **Lot/serial**: the primitive's `p_lines` shape does not accept
  `lot_id`/`serial_id` — `inventory_create_draft`'s own `jsonb_to_
recordset` extraction never reads them, and the underlying engine
  hardcodes `NULL` for both when resolving the balance row regardless.
  Pre-existing "v1: on_hand only, lot/serial-blind" limitation, not
  invented or papered over by IC-3.
- **Reference metadata**: `inventory_movement_headers.reference_type`/
  `reference_id` are not threaded through by the primitive — neither
  real wrapper's working behavior ever set them before this phase.
  Deliberately deferred, not invented.
- **Generic Warehouse Movements UI**: left on its own existing direct
  call to `inventory_create_and_finalize` (Option A) — a deliberate,
  documented decision (§16 of the brief), not an oversight.

## The single most important thing to verify

Item 19/20 above, together: **the CRITICAL unauthenticated-posting
finding is real, pre-existing, not introduced by IC-3, and is now
recorded prominently enough that it will not be lost or deprioritized**.
This is, by a wide margin, the most severe finding across every IC phase
to date (IC-1's negative-stock question, IC-2's explicit-effects P0, and
IC-2's own header-immutability GUC bypass all required at least SOME
authenticated session or real permission grant; this one requires
neither). It is disclosed in three places — `inventory-core-
architecture.md` §9 (new table row), `inventory-core-progress.md`'s own
IC-3 change-log entry, and this file's own item 19 — specifically so a
reviewer cannot miss it in any one of them.
