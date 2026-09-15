# Inventory Core — Implementation Plan (IC-0 … IC-8)

> Execution plan. Target architecture and invariants live in
> `inventory-core-architecture.md` — this document sequences the work against
> that target. Live status lives in `inventory-core-progress.md`. Naming
> deliberately uses the `IC-` prefix to avoid confusion with Zone 3's own
> Phase 10A-10F numbering — **IC phases are cross-cutting, base-engine work,
> not Zone 3 work.**

**Global rules for every IC phase (not repeated per-phase below):**

- Verify live before writing any migration — never trust a prior audit's own
  finding without re-confirming it still holds (schema drifts).
- Apply migrations via MCP `apply_migration`, then live-verify the result
  (`pg_get_functiondef`/`pg_policies`/`pg_roles`/etc.) — never trust
  `apply_migration`'s own success return alone.
- Mirror every applied migration locally under
  `apps/web/supabase-target/supabase/migrations/` using the exact
  live-reported version/timestamp.
- Zero residual test data confirmed live after every test run.
- `pnpm type-check` and `pnpm lint` clean before a phase is marked done.
- No IC phase may reopen Phase 10C's own accepted contract without a
  verified, reported conflict.
- **No IC phase implementation is authorized by this document.** This
  document is the plan; execution of IC-1 onward requires a separate,
  explicit go-ahead per phase (see §Roadmap Governance).

---

## Roadmap Governance

Each IC phase, when authorized, follows the same discipline every Zone 3
phase in this project has used: verify-first, implement, live-test, document,
package a review bundle if the phase touches migrations, regression, final
report, **then STOP** for external review before the next phase begins. IC
phases are **not** self-authorizing — completing IC-1 does not imply
permission to start IC-2.

---

## IC-0 — Architecture Contract + Baseline Capture

**Goal**: lock in the target architecture and invariant model as the
authoritative reference, and capture a precise, re-verified live baseline of
every fact the later phases will build on — so IC-1 onward starts from
confirmed truth, not from the consolidation audit's own (already largely
re-verified, but not exhaustively) findings.

**Scope**:

- Author `inventory-core-architecture.md`, `inventory-core-implementation-
plan.md`, `inventory-core-progress.md` (this work).
- Re-verify, live, the specific claims the architecture document treats as
  settled fact but that were not independently double-checked this session:
  presence/absence of CHECK constraints for `on_hand_quantity >= 0` /
  `reserved_quantity >= 0` / `allocated_quantity >= 0` on `inventory_
balances`; the exact raw-write RLS policy shape on `inventory_
reservations`/`inventory_allocations` and their own line tables (not
  audited this pass); whether `inventory_movement_headers`' own INSERT
  policy allows a raw client INSERT of an already-`posted`-status row.
- Add the Zone 3 tracker cross-reference (`docs/mvp/zones/03-repair-orders-
progress.md`): Phase 10D is **BLOCKED ON INVENTORY CORE CONSOLIDATION**.

**Tables/functions/files likely affected**: documentation only, plus the Zone
3 tracker's own header line. **No SQL, no application code.**

**What must NOT change**: everything. IC-0 is planning + verification only.

**Migrations expected**: none.

**Invariant changes**: none.

**Tests required**: none (no code changes).

**Live verification required**: the specific CHECK/RLS facts listed above —
via `information_schema`/`pg_constraint`/`pg_policies` queries only, no
writes.

**Concurrency tests**: none.

**Migration/data-reset consequences**: none.

**Rollback/recovery strategy**: N/A (docs only; revert via git if needed).

**Acceptance criteria**: the three docs exist, are internally consistent with
each other and with the live-reverified facts above, and the Zone 3 tracker
carries the BLOCKED note.

**Hard STOP condition before IC-1**: explicit product-owner authorization to
begin IC-1, informed by this plan's own §"Recommended IC-1 scope" below.

---

## IC-1 — Canonical Movement Engine / Hard Stock Invariants

**Goal**: close the core, load-bearing defect this whole consolidation effort
was triggered by — the movement engine's own blindness to
`reserved_quantity`/`allocated_quantity` — by implementing invariant #6
(architecture doc §5) directly inside the posting path, and replace
`inventory_v1_get_or_create_balance` with the lot/serial-aware helper
(decision #10).

**Scope**:

- `inventory_finalize_posting`: before applying an effect with `direction =
'decrease'` against `on_hand`, compute the post-effect `on_hand_quantity`
  and reject (new, specific error code) if it would fall below that bucket's
  own `allocated_quantity` — UNLESS the caller is one of the sanctioned
  atomic operations (architecture doc §6; for IC-1, this means: no caller is
  yet sanctioned to bypass this check, since whole-container relocation
  isn't built until later — so IC-1's own check is unconditional for every
  existing caller).
- Replace every internal call to `inventory_v1_get_or_create_balance` with
  `inventory_get_or_create_balance_for_update` (the no-lot/serial overload,
  to keep today's call sites' own semantics unchanged — lot/serial support
  itself is not newly exposed by this phase).
- Add the CHECK constraints IC-0 confirms are missing (`on_hand_quantity >=
0`, `reserved_quantity >= 0`, `allocated_quantity >= 0`), if IC-0 found
  them absent.
- Re-run the `101_...` characterization test from the prior integration
  branch work — **it must now FAIL exactly the way its own header comment
  predicts** ("If this assertion ever starts failing, the blind spot has
  been closed... update this file's own expectations explicitly") — update
  its own assertions to reflect the NEW, correct behavior (rejection, not
  silent success) as part of this phase, with full disclosure that this is
  an intentional, expected behavior change, not a regression.

**Tables/functions/files likely affected**:
`inventory_finalize_posting` (CREATE OR REPLACE, forward migration),
`inventory_balances` (new CHECK constraints, if needed), `apps/web/
supabase/tests/101_zone3_zone5_movement_engine_reserved_blindspot_
characterization_test.sql` (updated in place, with full disclosure of why).

**What must NOT change**: `inventory_movement_type_effects`' own schema
shape; Phase 10A/10B/10C's own RPCs (reservation/allocation/container);
`inventory_finalize_posting`'s own "v1: on*hand only" scope is **not**
expanded to reserved/allocated effects in this phase — only the \_cross-check
against* those fields is added. Expanding the effect model itself is out of
scope.

**Migrations expected**: 1-2 (the `inventory_finalize_posting` replacement;
the balance-getter replacement can be the same migration or a separate one —
decide live, based on whether both changes land in one `CREATE OR REPLACE` or
two).

**Invariant changes**: invariant #6 (architecture doc §5) goes from
"unenforced" to "enforced."

**Tests required**: new pgTAP proving (a) a movement that would strand an
allocation is rejected, no partial mutation; (b) a movement that does NOT
strand anything still succeeds exactly as before (regression); (c) the
updated `101_...` characterization test's new, correct expectations.

**Live verification required**: `pg_get_functiondef` re-fetch after apply;
re-run of `097`/`098`/`099`/`100`/`101` for regression.

**Concurrency tests**: a real two-connection race repeating the pattern
already proven on this branch (two sessions, one holding a lock via
`pg_sleep`) — this time proving the NEW rejection is itself race-safe (two
concurrent movements against the same bucket, one of which would strand an
allocation, cannot both succeed).

**Migration/data-reset consequences**: none — test data only exists inside
rolled-back pgTAP transactions; no live data is affected.

**Rollback/recovery strategy**: the migration is a `CREATE OR REPLACE`
against a single function plus additive CHECK constraints — reverting means
a further forward migration restoring the prior function body (never edit
the applied migration in place, matching established discipline) and
dropping the CHECK constraints if they prove too strict in practice.

**Acceptance criteria**: the characterization test's own new expectations
pass; no existing 097-100 regression breaks; the two-connection race proves
the rejection itself is atomic.

**Hard STOP condition before IC-2**: full regression green, concurrency
proof delivered, external review of this phase's own bundle accepted.

---

## IC-2 — Movement Reversal

**Goal**: implement `inventory_reverse_movement` per the design in
architecture doc §7.

**Scope**: new RPC; resolve the open questions §7 flags explicitly (can a
reversal-of-a-reversal happen; exact `relation_type` value for RepairOrder
attribution) with the product owner before finalizing the RPC signature.

**Tables/functions/files likely affected**: new `inventory_reverse_movement`
function; `inventory_movement_headers` (populates existing `original_
movement_id`/`reversal_movement_id` columns — no schema change expected);
`inventory_movement_audit_log`; `inventory_stock_ledger_entries` (new rows,
no schema change); `attach_repair_order_line_movement` callers, if the
RepairOrder-attribution question resolves to "yes, call it again for the
reversal."

**What must NOT change**: no existing posted movement is ever edited or
deleted; `inventory_prevent_header_modification`/`_line_modification`
triggers stay exactly as they are (the reversal is a NEW row, not a
modification of the old one, so these triggers correctly continue to block
any attempt to edit the original).

**Migrations expected**: 1 (the new RPC + grants).

**Invariant changes**: invariant #15 (architecture doc §5) goes from
"columns exist, unused" to "enforced by a real RPC."

**Tests required**: pgTAP covering — reverse a posted receipt (101); reverse
a posted relocation (801) and confirm both legs invert correctly; attempt to
reverse a draft (rejected); attempt to reverse an already-reversed movement
(rejected); attempt a reversal that would strand an allocation (rejected,
proving IC-1's own invariant #6 applies here too); confirm ledger/audit-log
entries are correct and complete per architecture doc §11's own field list.

**Live verification required**: full function body re-fetch; live proof the
reversal's own document number is real and sequential, not reused.

**Concurrency tests**: not expected to introduce new race surface beyond
IC-1's own (a reversal is "just another movement" through the same engine) —
confirm this assumption live rather than skip the check.

**Migration/data-reset consequences**: none.

**Rollback/recovery strategy**: new, additive RPC — revert by dropping/
disabling it if a defect is found; no existing data path depends on it yet.

**Acceptance criteria**: every scenario in §Tests required passes live; a
receipt reversed via this RPC, when inspected via `getPhysicalStateForLine`
or a direct balance query, shows the exact pre-receipt state restored.

**Hard STOP condition before IC-3**: regression green, external review
accepted.

---

## IC-3 — Receiving Consolidation

**Goal**: one canonical physical receiving primitive; RepairOrder and
Purchase Order receiving become thin business-context wrappers over it, per
decision #14.

**Scope**: design (and, live-verify against, before committing to) the exact
RPC boundary — the brief's own illustrative `receiveStock({referenceType,
referenceId, destinationLocation, lines, ...})` shape is a reasonable
starting point but must be checked against what `receive_repair_order_stock`
and `inventory_receive_purchase_order` each ACTUALLY need (source-line
provenance resolution differs materially between the two — RepairOrder
receiving resolves via `workshop_source_document_lines`/`repair_order_line_
source_links`; Purchase Order receiving presumably resolves via its own PO
line references — verify live before assuming they can share one exact
input shape unmodified).

**Disposition of existing RPCs**:

- `receive_repair_order_stock`: **REFACTOR INTO WRAPPER** — keep its own
  RepairOrder-specific provenance resolution (source-line lookup, `attach_
repair_order_line_movement` call), but delegate the actual physical
  posting to the new canonical primitive instead of calling `inventory_
create_and_finalize` directly itself.
- `inventory_receive_purchase_order`: **REFACTOR INTO WRAPPER**, same
  pattern, PO-specific provenance kept, physical posting delegated.
- Generic Warehouse Movements UI's own receiving path (`inventory_create_
draft`/`inventory_create_and_finalize` called directly for a 101 movement
  with no business reference): **KEEP**, but confirm live whether it should
  also route through the new named primitive (likely yes, as the "no
  business reference" case) or remain calling the lower-level engine
  directly (acceptable if the new primitive is itself just a thin,
  well-named wrapper over the same engine call with optional reference
  parameters).
- `inventory_finalize_posting`/`inventory_create_and_finalize`: **KEEP**
  unchanged as the underlying engine (already the target per architecture
  doc §2.A) — this phase adds a receiving-specific _entry point_ above it,
  not a replacement for it.

**Tables/functions/files likely affected**: new RPC (name TBD, e.g.
`inventory_receive_stock`); `receive_repair_order_stock` (CREATE OR
REPLACE); `inventory_receive_purchase_order` (CREATE OR REPLACE); their
respective TS service layers (`RepairOrdersService` gets its own TS wrapper
for the first time — currently has none, per the audit's own finding;
`InventoryEnterpriseService`'s existing PO-receiving method).

**What must NOT change**: the RepairOrder-specific provenance-resolution
business rules (broken/ambiguous source-line resolution must still hard-
reject, exactly as `receive_repair_order_stock` does today); the Purchase
Order domain's own business rules (out of this audit's own direct
investigation — verify live before assuming parity).

**Migrations expected**: 2-3 (new primitive; two wrapper refactors).

**Invariant changes**: none new — this phase is a write-path consolidation,
not a new invariant.

**Tests required**: full pgTAP re-run for RepairOrder receiving (extending
`101_...`'s own fixture pattern) and a new equivalent for PO receiving;
regression proving BOTH wrappers still produce identical `inventory_
balances`/ledger/audit-log effects to their pre-refactor behavior.

**Live verification required**: side-by-side comparison of a receipt posted
through the old vs. new path (same inputs, same resulting ledger rows) —
run on the audit's own baseline, not assumed.

**Concurrency tests**: none new expected — receiving is a pure `on_hand`
increase, no commitment-stranding risk (invariant #6 doesn't apply to
increases).

**Migration/data-reset consequences**: none (no live receiving traffic
exists for either wrapped path — audit-confirmed zero UI callers for both).

**Rollback/recovery strategy**: both wrapper functions are `CREATE OR
REPLACE` — revert to the pre-refactor body via a forward migration if a
defect surfaces.

**Acceptance criteria**: both wrappers produce byte-identical `inventory_
balances`/ledger effects to their own pre-refactor behavior for every
existing pgTAP scenario; the new primitive is independently testable without
either business wrapper.

**Hard STOP condition before IC-4**: regression green, external review
accepted.

---

## IC-4 — Branch Transfer / MMJ Rebuild

**Goal**: repair the broken `inventory_accept_branch_transfer`/`inventory_
decline_branch_transfer` (audit §7) by routing their own physical-effect
legs through the now-hardened canonical engine (post-IC-1/IC-3), add
explicit partial-receipt/discrepancy handling (decision #13), and close the
raw-write RLS gap on `inventory_branch_transfers`/`_lines` (architecture doc
§9).

**Target lifecycle** (only statuses justified by the actual workflow — no
completeness-padding):

```
in_transit            -- created; source stock reserved (existing, correct)
  → accepted           -- full quantity received; paired issue+receipt
                           movements posted; reservation released
  → partially_accepted -- less than sent quantity received; accepted
                           quantity posted as above; remaining quantity
                           becomes an explicit, persisted discrepancy;
                           transfer enters a state requiring reconciliation
                           (NOT "accepted" — it must stay visibly distinct
                           until someone resolves the discrepancy)
  → declined            -- destination rejects before accepting; source
                            commitment released (pre-shipment case) — see
                            below for the post-shipment case
  → cancelled            -- ONLY if source cancels before any destination
                             action; releases the reservation; distinct
                             from "declined" (destination's own decision)
```

**"Decline before physical shipment" vs. "reject after goods physically
arrived" — must NOT be collapsed** (explicit instruction): in the CURRENT
design, `inventory_create_branch_transfer` never posts a physical movement —
`in_transit` means "reserved at source, not yet moved." This means, as
currently designed, **there is no "goods physically arrived, then rejected"
case** — the source `issue` movement and destination `receipt` movement are
both posted together, atomically, only at `accepted`/`partially_accepted`
time. **A genuine "physically shipped, then something is wrong on arrival"
scenario is therefore represented by `partially_accepted` (the discrepancy
path), not by a post-hoc "reject after arrival"** — because arrival and
acceptance are the same moment in this model. Flag this to the product owner
explicitly during IC-4: if physical trucks/couriers genuinely leave the
source branch before destination confirmation in Ambra's real operations
(i.e., "in transit" should mean physically moving, not merely reserved),
this model needs revisiting BEFORE implementation, not after — this is a
real business-semantics question this plan cannot resolve on its own.

**Exact operation sequence** (target):

- **CREATE TRANSFER**: validate branches differ and belong to the org
  (existing, correct); reserve source stock via `inventory_create_
reservation` (existing, correct); create the transfer document
  (existing, correct — no change needed here).
- **DESTINATION RECEIVE, full accept**: release the reservation; post ONE
  canonical `issue`-class movement at source and ONE canonical
  `receipt`-class movement at destination, through `inventory_finalize_
posting` (via the IC-3 receiving primitive for the destination leg, and a
  new equivalent "issue" primitive or direct engine call for the source
  leg — decide live whether a dedicated "ship" primitive is warranted or a
  direct `inventory_create_and_finalize` call suffices); mark `accepted`.
- **DESTINATION RECEIVE, partial accept**: post the accepted quantity as
  above; persist the remaining (sent − accepted) quantity as an explicit
  discrepancy record (new table or new columns on `inventory_branch_
transfer_lines` — decide live which fits the existing schema better);
  mark `partially_accepted`.
- **DECLINE (pre-accept)**: release the reservation (existing, correct
  behavior already, once the crash is fixed — the decline path's own logic
  is otherwise sound); mark `declined`.

**Movement-code decision (§Movement Catalog, this document, resolves this
in full)**: 311 is retired; the source-issue leg reuses whatever final code
is assigned in the movement catalog below (likely a redefined/renamed
transfer-issue code, NOT 311 as currently shaped).

**Tables/functions/files likely affected**: `inventory_accept_branch_
transfer`, `inventory_decline_branch_transfer` (both CREATE OR REPLACE);
possibly a new `inventory_partially_accept_branch_transfer` or a single
accept RPC taking a per-line accepted-quantity parameter (decide live —
simpler API surface vs. explicit separate operation, product-owner input
needed); `inventory_branch_transfer_lines` (new discrepancy columns, likely)
or a new `inventory_branch_transfer_discrepancies` table; new RESTRICTIVE
RLS policies on `inventory_branch_transfers`/`_lines`; `InventoryEnterpriseService`
(existing methods, `createBranchTransfer`/`acceptBranchTransfer`/
`declineBranchTransfer` — extend, don't replace); the existing, already-
built action layer (`createInventoryBranchTransferAction` etc. — reuse, no
UI work in this phase per the roadmap's own final "UI wiring" phase, item 9
in the audit's own §22).

**What must NOT change**: `inventory_create_branch_transfer`'s own
create/reserve logic (already correct, live-proven to succeed) — do not
touch unless IC-1's own new invariant #6 check requires a compatible update
(verify live, do not assume).

**Migrations expected**: 3-5 (accept fix; decline fix if needed; discrepancy
schema; RESTRICTIVE RLS policies).

**Invariant changes**: none new beyond what IC-1 already added (the accept/
decline paths must now respect invariant #6 like every other physical
movement).

**Tests required**: pgTAP covering the full lifecycle — create; full accept;
decline (pre-accept); partial accept with discrepancy persisted and visible;
idempotent retry of accept (does not double-post); cross-org denial;
cross-branch permission checks (source-branch permission required to
create, destination-branch permission required to accept/decline); raw-write
bypass denial on the newly-RESTRICTED tables.

**Live verification required**: re-run the exact empirical proof from the
consolidation audit (`inventory_create_branch_transfer` → `inventory_
accept_branch_transfer`) and confirm it now SUCCEEDS end-to-end, live, not
just via mocked/text-matching tests (the audit's own finding that the
existing "tests" never actually execute the SQL must not repeat — IC-4's own
tests must be real pgTAP, live-executed).

**Concurrency tests**: two concurrent accept attempts on the SAME transfer
(only one should succeed, matching the idempotency-key pattern); a transfer
accept racing a generic movement at the same destination bucket.

**Migration/data-reset consequences**: none (zero real transfer data exists
today, audit-confirmed).

**Rollback/recovery strategy**: `CREATE OR REPLACE` on both RPCs; new
discrepancy schema is additive and can be dropped if unused.

**Acceptance criteria**: the full lifecycle works live, end-to-end, proven
by real pgTAP (not text-matching); partial-receipt discrepancy is explicit,
persisted, and queryable; raw-write bypass is closed.

**Hard STOP condition before IC-5**: regression green, external review
accepted, **and explicit product-owner confirmation of the "in-transit
means reserved, not physically moving" semantic question flagged above.**

---

## IC-5 — RepairOrder Physical-Location Projection Consolidation

**Goal**: convert `repair_order_line_locations` from an independently-
written table into a derived projection (decision #7), and simplify/replace
`getPhysicalStateForLine` accordingly (decision #8).

**Scope**:

- **Source data**: the canonical ledger (`inventory_stock_ledger_entries`)
  cross-referenced with RepairOrder attribution (`repair_order_line_
movement_links` + the reservation/allocation reference chain) — exactly
  the two sources `repair_order_location_attribution_sync`'s own trigger
  logic already reconciles, but currently only for movements NOT posted
  through a RepairOrder-aware RPC; post-consolidation, ALL RepairOrder stock
  movement (receive, putaway, and any future relocation) goes through the
  canonical engine, so the trigger's own "safety net for generic movements"
  role becomes its ONLY role, simplifying its own logic.
- **Update mechanism**: keep the existing `AFTER INSERT ON inventory_stock_
ledger_entries` trigger pattern — it is already the right shape (event-
  driven, transactional, correct lock ordering) — but remove the DIRECT
  writes `receive_repair_order_stock`/`putaway_repair_order_stock` currently
  also perform (the trigger becomes the SOLE writer).
- **Confidence/unknown semantics**: preserve `repair_order_location_
attribution_uncertain` exactly as designed — it is a genuinely valuable,
  already-correct piece of engineering (per the audit's own assessment) and
  the brief's own explicit instruction to preserve it.
- **Pattern**: maintained projection table (keep `repair_order_line_
locations` as a real table, trigger-maintained), **not** a plain SQL view
  — a view would need to recompute from the full ledger on every read,
  which does not scale; the existing trigger-maintained-table pattern is
  already correct and should be kept, just with its write-ownership
  narrowed to the trigger alone.
- **Indexing**: existing indexes (`rol_locations_repair_order_idx`, `rol_
locations_lookup_idx`) are adequate; no change expected.
- **RepairOrder UI query path**: `getPhysicalStateForLine` is simplified —
  once `repair_order_line_locations` is the SOLE, trusted spatial answer
  (no more separate allocation/container reconciliation needed for the
  _location_ question, since the projection itself is now fed by the same
  canonical ledger everything else reads), the method's own job shrinks to
  enriching that projection with container/allocation detail for display,
  not reconciling two disagreeing sources. Full replacement vs. simplification
  decided live, once the projection rebuild's own exact shape is confirmed
  working.

**Tables/functions/files likely affected**: `repair_order_location_
attribution_sync` (CREATE OR REPLACE — remove the "authoritative bypass" GUC
branch, since there's no longer a second direct writer to coordinate with);
`receive_repair_order_stock`/`putaway_repair_order_stock` (remove their own
direct `repair_order_line_locations` INSERT — now IC-3's own consolidated
engine call is the only path, and the trigger picks it up automatically);
`RepairOrdersService.getPhysicalStateForLine` (simplified).

**What must NOT change**: the `repair_order_location_attribution_uncertain`
table's own schema and semantics; Phase 10C's own container RPCs (still
never touch balances, still unaware of `repair_order_line_locations`
entirely — no new coupling introduced, per architecture doc's own explicit
"no hard schema coupling" rule, restated).

**Migrations expected**: 2-3.

**Invariant changes**: decision #7 fully realized — `repair_order_line_
locations` is no longer independently writable by any RPC other than the
one maintaining trigger.

**Tests required**: full re-run of the 9 `getPhysicalStateForLine` scenarios
(now testing the simplified version); new pgTAP proving the trigger alone
correctly reconstructs `repair_order_line_locations` after a receive +
putaway performed entirely through the (by now) consolidated engine, with
NO direct writes from either RPC.

**Live verification required**: confirm `receive_repair_order_stock`/
`putaway_repair_order_stock` no longer contain any direct `INSERT INTO
repair_order_line_locations` after the refactor (`pg_get_functiondef`
re-fetch, grep the body for the table name).

**Concurrency tests**: not expected to introduce new race surface (the
trigger already runs inside the same transaction as the ledger insert that
fires it).

**Migration/data-reset consequences**: `repair_order_line_locations` is
currently empty (0 rows, audit-confirmed) — no data migration needed.

**Rollback/recovery strategy**: `CREATE OR REPLACE` on the trigger function
and the two Zone 5 RPCs.

**Acceptance criteria**: `location_mismatch` becomes structurally
unreachable for any stock that moved exclusively through the consolidated
engine (the two sources can no longer disagree, because there is only one
source) — proven by a live test attempting to reproduce the old divergence
scenario and confirming it can no longer occur.

**Hard STOP condition before IC-6**: regression green, external review
accepted.

---

## IC-6 — Legacy Writer/Helper Removal

**Goal**: delete the confirmed-dead paths (decision #9, #10, #11).

**Scope**:

- Delete `ambra-location-inventory.ts`'s write actions (`createLocation
ContainerAction`, `addItemsToContainerAction`, `removeItemFromContainer
Action`, `relocateContainerAction`) — confirmed zero UI callers, twice,
  across two separate audits.
- Delete `inventory_v1_get_or_create_balance` (already unused after IC-1's
  own replacement).
- Remove movement code `311` from the seeded catalog (or repurpose per
  IC-4's own final decision — do not delete if IC-4 chose to reuse the code
  number for the rebuilt transfer-issue leg; delete only if a new/different
  code was chosen instead).
- Re-confirm zero live callers for everything on this list immediately
  before deleting (a repository/live re-check, not a re-use of this
  document's own now-possibly-stale claim).
- **Added during IC-1's finalization pass (product-owner decision,
  see `inventory-core-progress.md`'s own IC-1 change log)**: retire
  `inventory_settings.negative_stock_policy`'s `'allow'`/`'allow_with_
approval'` values. IC-1 made global non-negative `on_hand_quantity` the
  final product contract; these values have been behaviorally superseded
  since IC-1 (both now produce byte-identical rejection to `'block'`) and
  carry zero live usage (confirmed: exactly 1 `inventory_settings` row
  exists, already `'block'`) and zero production reachability (confirmed:
  no UI/action anywhere reads or writes this column). Options at that time:
  narrow the CHECK to `negative_stock_policy = 'block'` only (simplest,
  matches the now-single supported value), or drop the column entirely if
  nothing else depends on its 3-state shape by then — re-verify live before
  choosing, per this phase's own established discipline.

**Tables/functions/files likely affected**: `ambra-location-inventory.ts`
(file edit — remove the 4 write actions, keep read-only exports if any UI
depends on them); `inventory_v1_get_or_create_balance` (`DROP FUNCTION`);
`inventory_movement_types` (soft-delete or hard-delete the 311 row,
per whatever this project's own established convention for retiring a
seeded config row turns out to be — verify live before choosing).

**What must NOT change**: any READ-only export from `ambra-location-
inventory.ts`, if one exists and has real callers — verify live before
touching the file, do not assume the whole file is dead just because the
four write actions are.

**Migrations expected**: 1-2 (function drop; movement-type retirement).

**Invariant changes**: none — pure removal of already-unreachable code.

**Tests required**: existing test suite must still pass with these paths
removed (proving nothing secretly depended on them); remove or update any
test file that directly tested the deleted functions.

**Live verification required**: re-confirm zero callers immediately before
deletion (grep + live DB check that the function/row is genuinely unused).

**Concurrency tests**: none (removal, not new behavior).

**Migration/data-reset consequences**: none (all confirmed-unused).

**Rollback/recovery strategy**: deletions are the LAST IC phase before the
final gate specifically so they carry the least risk of needing to be
undone — if something unexpected depended on a "dead" path, restoring it is
a straightforward revert of this phase's own migration/file diff.

**Acceptance criteria**: full regression green with the legacy paths
removed; no dangling references anywhere in the codebase (grep-clean).

**Hard STOP condition before IC-7**: regression green, external review
accepted.

---

## IC-7 — Inventory Security / Write-Boundary Closure

**Goal**: close every remaining raw-write gap identified across IC-0 through
IC-6 (architecture doc §9's own table), in one consolidated security pass.

**Scope**: apply Phase 10C's own proven RESTRICTIVE-policy pattern to any
table IC-0's own verification (or any later phase) found still open;
re-verify every canonical RPC's own grant/ownership/search_path hardening
one final time, end-to-end, across the WHOLE Inventory Core (not just the
tables touched by IC-1 through IC-6 individually).

**Tables/functions/files likely affected**: whichever tables IC-0/IC-4's own
findings flagged (`inventory_reservations`/`_lines`, `inventory_
allocations`/`_lines` if a gap is confirmed; `inventory_branch_transfers`/
`_lines` if IC-4 did not already close it).

**What must NOT change**: any already-correct RESTRICTIVE policy (Phase
10C's own, IC-4's own if already applied) — this phase closes remaining
gaps, it does not re-litigate settled ones.

**Migrations expected**: depends entirely on IC-0's own findings — 0 if
everything was already closed by earlier phases, up to several otherwise.

**Invariant changes**: architecture doc §9's own table becomes fully "Keep"
across every row.

**Tests required**: raw-write bypass pgTAP for every newly-closed table,
matching Phase 10C's own T35-T44 pattern exactly (empirically verify
UPDATE/DELETE silent-0-row semantics vs. INSERT explicit-exception
semantics before writing assertions, per the established discipline).

**Live verification required**: `pg_policies` sweep across every Inventory
Core table, confirmed against the architecture doc's own target table.

**Concurrency tests**: none new.

**Migration/data-reset consequences**: none.

**Rollback/recovery strategy**: new RESTRICTIVE policies are additive and
narrowly scoped (deny-only) — reverting means dropping the policy, a
low-risk operation.

**Acceptance criteria**: architecture doc §9's own table is 100% "Keep"
status, live-verified.

**Hard STOP condition before IC-8**: regression green, external review
accepted.

---

## IC-8 — Full Inventory Regression / Concurrency / Performance Hardening

**Goal**: a single, comprehensive validation pass across the ENTIRE
consolidated Inventory Core before declaring the INVENTORY CORE FINAL GATE
reached.

**Scope**:

- Full regression: every pgTAP file across Zone 3 (097-101 and any added in
  IC-1 through IC-7), plus the full Vitest suite, run together, in one pass.
- A genuine multi-connection concurrency suite covering every scenario
  listed in the assigning brief's own Test Strategy section (§below) that
  has not already been covered by an individual IC phase's own concurrency
  tests.
- A performance sanity pass against the architecture doc's own §10 plan —
  confirm no new N+1 pattern was introduced by any IC phase, confirm the new
  transfer-inbox index (IC-4) and any other new index actually gets used
  (`EXPLAIN` on the real query shapes).
- Design (not build) the whole-container-relocation operation's own exact
  RPC shape, now that the engine underneath it (IC-1 through IC-4) is
  trustworthy — this is preparatory design work for Phase 10E, explicitly
  NOT Phase 10E's own implementation (which remains gated behind the
  INVENTORY CORE FINAL GATE below).

**Tables/functions/files likely affected**: none new — this is a validation
phase, not a feature phase. Any defect found gets its own small, targeted
fix, live-verified the same way as every other phase.

**What must NOT change**: nothing is deliberately changed in this phase
beyond defect fixes surfaced by the validation itself.

**Migrations expected**: 0, unless a defect requires one.

**Invariant changes**: none, unless a defect requires one.

**Tests required**: the full matrix in §Test Strategy below, end to end.

**Live verification required**: everything, one final time, together.

**Concurrency tests**: the full concurrency matrix (§Test Strategy).

**Migration/data-reset consequences**: none expected.

**Rollback/recovery strategy**: N/A (validation phase).

**Acceptance criteria**: the full test matrix passes; zero residual data
after the full suite; the INVENTORY CORE FINAL GATE report (§below) is
produced.

**Hard STOP condition — INVENTORY CORE FINAL GATE**: explicit product-owner
sign-off that the Inventory Core is complete and correct, before Phase 10D
(Container QR) resumes.

---

## Final Minimal Movement-Code Catalog

**Not a giant SAP catalog — the smallest set that covers Ambra's own actual
scope**, resolved from live evidence (audit §5/§6), not historical attachment
to any number.

| Code                                    | Business name                         | Category                   | Source req.? | Dest req.?                            | Effects                                                  | Document type | Reversal                                                          | Workflow                                                                                              |
| --------------------------------------- | ------------------------------------- | -------------------------- | ------------ | ------------------------------------- | -------------------------------------------------------- | ------------- | ----------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------- |
| **101**                                 | Przyjęcie (Receipt)                   | receipt                    | no           | yes                                   | dest `on_hand` +qty                                      | PZ            | via `inventory_reverse_movement` (IC-2), inverse 101-shape effect | Generic Movements UI, RepairOrder receiving (IC-3 wrapper), PO receiving (IC-3 wrapper)               |
| **201**                                 | Wydanie (Issue)                       | issue                      | yes          | no                                    | source `on_hand` −qty                                    | WZ            | via `inventory_reverse_movement`                                  | Phase 10F (not built) — reserved slot, no seeding until 10F                                           |
| **401**                                 | Korekta — nadwyżka (count surplus)    | adjustment                 | no           | yes                                   | dest `on_hand` +qty                                      | INW           | via `inventory_reverse_movement`                                  | Inventory Audits module                                                                               |
| **402**                                 | Korekta — niedobór (count shortage)   | adjustment                 | yes          | no                                    | source `on_hand` −qty                                    | INW           | via `inventory_reverse_movement`                                  | Inventory Audits module                                                                               |
| **801**                                 | Przesunięcie BIN (bin relocation)     | bin_operation              | yes          | yes                                   | source `on_hand` −qty, dest `on_hand` +qty, ONE document | MM            | via `inventory_reverse_movement` (both legs inverted together)    | Zone 5 putaway; future whole-container relocation (Phase 10E)                                         |
| **TBD (transfer-issue)** — replaces 311 | Transfer międzyoddziałowy — wydanie   | transfer                   | yes          | no (destination branch, not location) | source `on_hand` −qty                                    | MM/MMJ-       | via `inventory_reverse_movement`                                  | IC-4's own rebuilt `inventory_accept_branch_transfer`, posted server-side, never directly by a caller |
| **TBD (transfer-receipt)**              | Transfer międzyoddziałowy — przyjęcie | receipt (transfer variant) | no           | yes                                   | dest `on_hand` +qty                                      | MM/MMJ+       | via `inventory_reverse_movement`                                  | Same — the paired leg                                                                                 |

**311 resolution** (explicit, per instruction): **311, as currently
seeded (one-sided, `requires_destination_location=false`, zero real usage),
is retired.** It is **not reused verbatim** — IC-4's own rebuilt accept path
needs a properly two-sided-aware pair of codes (one issue-class at source,
one receipt-class at destination, both linked via the SAME transfer
document), which 311's own current definition cannot express on its own
(it only ever defined the source half). Whether the new pair reuses the
numeral "311"/"312" or is assigned new numbers is an IC-4 implementation
detail, not an architectural decision — **base it on coherent semantics
(a real two-sided pair, matching 801's own already-correct two-sided
shape), not on preserving the number 311 for its own sake**, per explicit
instruction.

**Mapping to Autostacja's own MMJ-/MMJ+ is business equivalence only** —
Ambra's own transfer-issue/transfer-receipt pair is the functional
counterpart of Autostacja's MMJ-/MMJ+ document pair; this is a naming/
business mapping, not a claim that Ambra's own schema needs to literally
replicate Autostacja's own document structure.

---

## Receiving Consolidation — Proposed API Boundary

**Illustrative shape** (per the assigning brief's own suggestion, to be
confirmed/adjusted live during IC-3 against what each business wrapper
actually needs — do not force this exact shape if repository reality
disagrees):

```
inventory_receive_stock(
  p_actor_user_id,
  p_organization_id,
  p_branch_id,
  p_destination_location_id,
  p_lines,              -- [{ variant_id, unit_id, quantity, lot_id?, serial_id? }]
  p_reference_type,      -- e.g. 'repair_order_line', 'purchase_order_line', null
  p_reference_id,
  p_operation_date, p_document_date, p_external_reference, p_note,
  p_idempotency_key
)
```

- **`receive_repair_order_stock`**: REFACTOR INTO WRAPPER — keeps its own
  RepairOrder-specific source-line provenance resolution (the
  `workshop_source_document_lines`/`repair_order_line_source_links` chain,
  and the mandatory-resolution/ambiguous-resolution hard-reject rules,
  unchanged), keeps its own call to `attach_repair_order_line_movement`,
  but delegates the actual `on_hand` posting to the new primitive instead of
  calling `inventory_create_and_finalize` itself.
- **`inventory_receive_purchase_order`**: REFACTOR INTO WRAPPER, same
  pattern — PO-specific provenance/business rules kept, physical posting
  delegated. (Its own current business rules were not deeply audited this
  pass — verify live during IC-3 before assuming full parity with the
  RepairOrder wrapper's own shape.)
- **Generic Warehouse Movements UI's own receiving**: KEEP calling
  `inventory_create_and_finalize` directly for the no-business-reference
  case, OR route it through the new primitive with `p_reference_type=NULL`
  — decide live during IC-3 based on which keeps the Movements UI's own
  existing behavior most stable.
- **`inventory_create_and_finalize`/`inventory_finalize_posting`**: KEEP,
  unchanged, as the underlying engine — this new primitive is an entry
  point above it, not a replacement.

---

## Handling Unit (Container) Operations Plan

**Preserve Phase 10C's own correct fundamentals unchanged.** Plan the
following operations (design only — build only what a real Phase 10E/10F
need requires, when authorized):

| Operation                                           | Status                                                                                                                                                                                                                                                                                                     | Physical movement?                            |
| --------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------- |
| Create container                                    | **Built** (Phase 10C)                                                                                                                                                                                                                                                                                      | No                                            |
| Place/remove allocation                             | **Built** (Phase 10C)                                                                                                                                                                                                                                                                                      | No                                            |
| Seal/open (where valid)                             | **Built** (`inventory_seal_container`; no "open"/unseal RPC exists — evaluate need live, do not build speculatively)                                                                                                                                                                                       | No                                            |
| Split contents (same location, container→container) | **Not built** — planned. Pure Handling Unit operation: remove from container A's own link, add to container B's own link, same allocation line, same location — no physical movement                                                                                                                       | No                                            |
| Repack between containers                           | Same as split — same operation, different framing                                                                                                                                                                                                                                                          | No                                            |
| Empty container                                     | **Built implicitly** (removing all contents transitions `status='empty'`, Phase 10C)                                                                                                                                                                                                                       | No                                            |
| Whole-container relocation                          | **Not built** — the ONE sanctioned atomic operation (architecture doc §6.1): physical movement of every distinct (variant, lot, serial) inside, through the canonical engine, PLUS the container pointer update, in one transaction. Planned for Phase 10E, gated behind the INVENTORY CORE FINAL GATE     | **Yes**                                       |
| Branch-transfer a container                         | **Not built, not scoped this pass** — a real future need (a whole container physically shipped between branches) but requires IC-4's own transfer engine AND the whole-container-relocation operation to both exist first; flag as a residual open question for after Phase 10E, not designed further here | Yes (via the transfer's own paired movements) |

**No nested containers/pallet hierarchies** are planned — Phase 10C's own
model (one container, flat contents) is sufficient for every current
business requirement found in this audit; do not design hierarchy
speculatively.

---

## Test Strategy — Unified Matrix

| Category        | Scenarios                                                                                                                                                                                                                                          |
| --------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Receipt**     | standard 101; duplicate idempotent retry (no double-post)                                                                                                                                                                                          |
| **Relocation**  | bin→bin, free stock; attempt to move allocated stock (must reject, IC-1); permitted sanctioned relocation (whole-container, IC-8 design/Phase 10E build)                                                                                           |
| **Reservation** | normal; over-reservation (rejected); concurrent reservation (real 2-connection race)                                                                                                                                                               |
| **Allocation**  | normal; over-allocation (rejected); release; concurrent allocation (real 2-connection race)                                                                                                                                                        |
| **Container**   | add/remove; split/repack (same location, no movement); location mismatch (rejected, already proven Phase 10C); cross-RepairOrder protection (already proven Phase 10C); concurrency quantity conservation (already proven, real 2-connection race) |
| **Transfer**    | create; source reservation; full accept; decline (pre-accept); partial receipt; discrepancy persisted; retry/idempotency; cross-org denial; cross-branch permission checks                                                                         |
| **Reversal**    | receipt reversal; move reversal; issue reversal (once 201/WZ exists); cannot double-reverse                                                                                                                                                        |
| **Audit**       | actor/document/reference traceability across every operation type                                                                                                                                                                                  |
| **Security**    | direct raw writes rejected, for every table in architecture doc §9's own final table                                                                                                                                                               |
| **Concurrency** | genuine independent DB sessions (not merely reasoned about) for every "real race" scenario above                                                                                                                                                   |

**Every live suite run must end with an explicit zero-residual-data check**,
matching the established convention.

---

## Recommended IC-1 Scope (for the next authorization)

**Exact prompt/scope to hand back for the first implementation phase:**

> Implement IC-1 (Canonical Movement Engine / Hard Stock Invariants) exactly
> as scoped in `docs/inventory/inventory-core-implementation-plan.md`'s own
> IC-1 section: (a) add the `on_hand < allocated` strand-prevention check
> inside `inventory_finalize_posting`; (b) replace `inventory_v1_get_or_
create_balance` with `inventory_get_or_create_balance_for_update`
> throughout the engine; (c) add the missing non-negative CHECK constraints
> on `inventory_balances` if IC-0's own live verification confirms they are
> absent; (d) update `101_zone3_zone5_movement_engine_reserved_blindspot_
characterization_test.sql`'s own expectations to reflect the new, correct
> (rejecting) behavior, with full disclosure that this is an intentional
> behavior change; (e) prove the new invariant is race-safe under a genuine
> two-connection test, matching the methodology already established on this
> branch. Do not touch Phase 10A/10B/10C's own RPCs. Do not start IC-2. Do
> not start Phase 10D. Verify live before every change. Package a review
> bundle and a final report exactly matching this project's own established
> per-phase discipline.

This scope is deliberately narrow — it is the single highest-leverage,
lowest-ambiguity phase (the defect and its fix are both already precisely
characterized), and every later phase (IC-2 through IC-8) depends on IC-1's
own invariant actually being enforced before it can be safely built on top
of.
