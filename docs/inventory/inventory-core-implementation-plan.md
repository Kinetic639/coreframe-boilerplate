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

**RESULT (2026-09-15, IC-2 implemented and DONE)**: both open questions §7
flagged were resolved as explicit, closed product-owner decisions BEFORE
implementation began (not deferred to mid-implementation discovery):

- **Reversal-of-reversal**: NOT supported for MVP/pitch. A posted original
  may be reversed at most once (`reversal_movement_id IS NULL` required); a
  reversal movement itself can never be reversed (`original_movement_id IS
NOT NULL` on the target is an immediate rejection, SQLSTATE `P0005`).
- **RepairOrder attribution `relation_type`**: NOT implemented. IC-2 does
  not call `attach_repair_order_line_movement` for the reversal and does
  not add a `relation_type='reversal'` link or any business-quantity
  netting. `RepairOrdersService.listRepairOrderLines()`'s own received/
  issued/outstanding/available formulas are untouched. This is an explicit
  deferred integration concern, not an oversight — see the architecture
  doc's own §7 update for the full reasoning.

**Genuine live discovery beyond the original plan's own anticipation**: the
movement-type/effect catalog is TYPE-level, not INSTANCE-level —
`inventory_movement_type_effects` rows are keyed by `movement_type_id`
alone, so no single existing type (101/311/401/402/801) can serve as a
correct, honestly-labeled inverse for every other type (801 in particular
needs a combined source-increase+destination-decrease pair that exists
nowhere in the catalog). Resolved by adding ONE new, minimal, generic,
system-only reversal type (`900`/`KOR`, `is_system=true`, `allows_manual_
entry=false`, zero effect rows of its own) plus a narrow, additive,
backward-compatible extension to `inventory_finalize_posting` itself (one
new optional trailing parameter, `p_explicit_effects jsonb DEFAULT NULL` —
every existing 2-argument caller is completely unaffected). This was
verified live before implementation, per this document's own explicit
"STOP before inventing a shadow type system" instruction — the finding
justified the minimal extension rather than a stop.

**Live-caught defects, fixed forward** (see `docs/inventory/reviews/ic-2-review/`
for full detail): (1) `CREATE OR REPLACE FUNCTION` with an added parameter
created a second overload rather than replacing the 2-arg
`inventory_finalize_posting`, breaking every existing caller — fixed by
dropping the old overload. (2) SQLSTATE `P0004` is a Postgres built-in
reserved condition (`assign_string_too_long`) that is NOT caught by `WHEN
OTHERS` — the "not posted" rejection code was moved to `P0007`. (3) Zone
5's own spatial-attribution trigger reacted to a reversal's compensating
ledger entries by actively corrupting `repair_order_line_locations` (a
delete-then-reinsert of the same, now-physically-absent quantity) — fixed,
without touching Zone 5 itself, by having the reversal RPC set the same
`ambra.repair_order_attribution_authoritative` GUC `receive_repair_order_
stock`/`putaway_repair_order_stock` already use, converting active
corruption into disclosed, known staleness (an IC-5 concern). (4) A
schema-level default-privilege grant re-exposed `inventory_reverse_
movement` to `anon` after each `CREATE OR REPLACE` — fixed with an explicit
final `REVOKE`/`GRANT` matching the established `authenticated`+
`service_role`-only convention.

**SECURITY-BOUNDARY CORRECTION PASS (2026-09-15, external review, P0
found and fixed)**: external review flagged that the 3-arg
`p_explicit_effects` extension above was added to the externally-callable
canonical `inventory_finalize_posting(uuid,uuid,jsonb)`, not restricted to
the internal reversal mechanism. Live investigation (a safe,
transaction-scoped attack probe, `ROLLBACK`, no real data touched)
**confirmed a genuine P0**: an ordinary `authenticated` caller could call
the function directly on their own legitimately-created draft with a
crafted `p_explicit_effects` payload (two real effect ids from unrelated
movement types) and double `on_hand` (10 → 20) with no extra permission.
Two live-caught defects during the fix itself: (5) the same
arity-overload pitfall as defect (1) recurred — recreating a 2-arg
`inventory_finalize_posting` did NOT remove the still-live, still-`anon`/
`authenticated`-callable vulnerable 3-arg overload; fixed with a second
forward migration explicitly dropping the exact old signature, live-
reverified via `pg_proc`/`has_function_privilege` before proceeding.
Fix: logic moved to `inventory_finalize_posting_internal(uuid,uuid,jsonb)`
(`EXECUTE` revoked from every role except owner `postgres`); the public
`inventory_finalize_posting` restored to its original 2-arg,
catalog-effects-only contract; only `inventory_reverse_movement` (itself
`SECURITY DEFINER`, owner `postgres`) can reach the internal function, via
standard same-owner `SECURITY DEFINER` privilege semantics — not a GUC or
"trust the caller" convention. Two defense-in-depth checks added inside
the internal function: explicit effects are only accepted when the
movement's own real (row-read, not caller-supplied) `movement_type_code`
is `'900'`; each effect's `target`/`direction` is validated against its
exact allowed enumeration rather than silently falling through. Live
re-verified post-fix: direct internal-function call → `42501`; old 3-arg
public signature → `42883` (no longer exists); ordinary 2-arg finalize and
full reversal end-to-end unaffected; `anon`/`authenticated` confirmed to
hold zero `EXECUTE` on the internal function. A SEPARATE, broader,
**not-fixed-this-pass** finding surfaced while verifying the "original
header is never edited" claim for documentation purposes: the backing
immutability trigger only checks that its own GUC is `'on'`, never which
columns changed, and the GUC is an ordinary session parameter any
`authenticated` actor already holding `warehouse.inventory.operate` can
set themselves — live-proven this permits a full raw-`UPDATE` rewrite of
any posted header's business content (not just a status-blind INSERT, as
previously scoped). Pre-existing, not IC-2-introduced; explicitly assigned
to IC-7 (see architecture doc §7/§9 for the full finding and required
fix design).

Full test/concurrency evidence, migration list, and security findings are
in `docs/inventory/inventory-core-progress.md`'s own IC-2 change-log entry
and the `docs/inventory/reviews/ic-2-review/` bundle. **IC-2 is DONE,
including the security-boundary correction pass.**

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

**RESULT (2026-09-16, IC-3 implemented and DONE)**: both real receiving
paths were live-verified before any design decision, per this plan's own
requirement — and the finding materially changed the phase's own risk
profile. `receive_repair_order_stock` was working (posted through
`inventory_create_and_finalize` correctly, zero TS/UI callers) and was
refactored cleanly. `inventory_receive_purchase_order` was **live-
confirmed dead/broken** — it called `inventory_create_draft_movement`/
`inventory_post_movement`, neither of which exists in this database
(`42883` on every real call), had zero UI/service reachability (repo-wide
grep), and its only "test coverage" was a static string-match against the
migration file's own text. Per this plan's own instruction not to fake
parity with behavior that never worked, IC-3 fixed the PO wrapper's
physical-posting step while preserving its own already-correct business
rules byte-for-byte, and separately hardened its security model (it had
no `SECURITY DEFINER`, no actor-identity check at all — genuinely new
IC-3 code, not an IC-7 pre-existing-gap fix, since there was no working
contract to weaken).

**New canonical primitive**: `inventory_receive_stock` — domain-agnostic,
delegates every physical effect through the existing `inventory_create_
and_finalize` → `inventory_finalize_posting` (public, frozen IC-2
contract) path. Full signature, security model, and line-correlation
contract in `inventory-core-architecture.md` §7A.

**Live-caught defects, fixed forward** (see `docs/inventory/reviews/
ic-3-review/` for full detail): (1) building the ambiguous-provenance
pgTAP fixture surfaced a real schema fact not previously documented —
`repair_order_line_source_links.workshop_source_document_line_id` has its
own UNIQUE constraint (one link per source line), so genuine ambiguity
requires TWO distinct `workshop_source_document_lines` rows (one per
document) referencing the SAME `wdd_matcher_line_id`, not two links from
one source line — the test fixture was corrected, not the RPC. (2) a
committed concurrency-test fixture's own `branch_number` (970) collided
with an existing, unrelated `103_...` test file's own transaction-scoped
branch number, breaking that file's own regression run — caught
immediately via the regression suite itself and fixed by renumbering the
committed fixture (940), not by touching `103_...`. (3) **self-caught
before any test exercised it**: the PO wrapper's first draft incremented
`received_quantity` BEFORE calling the idempotency-aware primitive, so a
retry with the same derived key would have double-counted PO received
quantity even though the physical movement stayed correctly deduplicated
— fixed by pre-checking for an existing movement under the derived
idempotency key immediately after acquiring the PO row's own pre-existing
`FOR UPDATE` lock, before any PO-line mutation.

**New, severe, pre-existing security finding, NOT fixed this pass**:
verifying the primitive's own security model surfaced that the engine
layer it delegates to (`inventory_create_and_finalize`/`inventory_create_
draft`/public `inventory_finalize_posting`) has **zero actor-identity or
permission check of its own** and carries live `anon` EXECUTE — live-
proven via a safe, rolled-back probe that a fully unauthenticated `anon`
session can post a real movement to any organization/branch it names a
UUID for. Strictly worse than any prior finding this project has made
(no account required at all). Pre-existing (predates IC-1); IC-3's own
new code is unaffected (each of the 3 new/refactored entry points
performs its own actor+permission check first) but the unguarded layer
remains directly reachable regardless. Assigned to IC-7 as its top-
priority item — see architecture doc §9's new table row for full detail.

**Genuine two-PostgreSQL-connection concurrency proof** (idempotency
race, not merely reasoned about): Session A's call succeeded in 46ms,
held its transaction open 5s; Session B, launched ~1.5s later with the
SAME idempotency key, blocked for 3560.950ms on Session A's uncommitted
unique-index entry, then resumed and returned the IDENTICAL `movement_id`
— zero double-post, zero raw/ugly error surfaced to the losing caller,
final balance exactly the single-receipt quantity.

Full test/migration/documentation summary is in `docs/inventory/
inventory-core-progress.md`'s own IC-3 change-log entry and the
`docs/inventory/reviews/ic-3-review/` bundle. **IC-3 is DONE.**

---

## IC-7A — Emergency Movement Engine Security Boundary Closure (2026-09-16)

**This phase was NOT part of the original roadmap order.** It is a
narrow, P0 security pass pulled forward from the full IC-7 phase (§IC-7
below, which remains scheduled after IC-4/IC-5/IC-6 as originally
planned) because IC-3's own live verification proved a CRITICAL,
pre-existing finding: `inventory_create_draft`, the public `inventory_
finalize_posting`, and `inventory_create_and_finalize` carried live
`anon` EXECUTE and performed zero actor-identity or permission check of
their own — a fully unauthenticated caller could post arbitrary physical
inventory movements. This predates IC-1 and was not introduced by IC-3;
IC-3 merely discovered and disclosed it while hardening its own new code.
The severity (zero authentication required, not merely privilege
escalation among legitimate users) was judged too severe to leave open
while IC-4 (a substantial, unrelated rebuild) proceeded.

**Why the roadmap was intentionally interrupted, not merely reordered**:
every other IC phase to date has been built strictly in sequence on an
explicit go-ahead. This phase breaks that sequence deliberately — the
assigning brief itself named it an "EMERGENCY" pass and was explicit that
it is NOT the full IC-7 phase, that IC-4 must NOT start until it
completes, and that the broader IC-7 phase remains later in the roadmap
unchanged. This is recorded here, explicitly, so the roadmap's own
history is honest: IC-7A is a genuine, disclosed exception to the
"strict sequence" rule, not a silent reordering.

**Scope**: hardened exactly 3 functions (`inventory_create_draft`,
`inventory_finalize_posting_internal`, `inventory_create_and_finalize`)
plus one system-movement-type guard. Did NOT touch: receiving,
reversal, reservations, allocations, containers, branch transfer,
RepairOrder attribution, or Zone 5 — none of their own architecture was
reopened. Did NOT fix: the posted-header GUC UPDATE bypass, reservation/
allocation raw-write RLS, container generic raw-write policies, or the
systemic `anon` default-privilege re-grant behavior — all remain
explicitly OPEN, recorded for the full IC-7 phase below.

**RESULT (2026-09-16, IC-7A implemented and DONE)**: full detail —
live-reproduced exploit, caller-graph audit, the internalize-vs-harden-
in-place decision, the self-caught system-type-guard defect, the
103-scenario-reordering regression this pass's own fix surfaced and
fixed, the post-fix exploit replay — is in `inventory-core-architecture.
md` §9A and `docs/inventory/inventory-core-progress.md`'s own IC-7A
change-log entry. Full evidence bundle: `docs/inventory/reviews/
ic-7a-movement-engine-security-review/`. **IC-7A is DONE.** IC-4 may now
proceed once separately authorized.

---

## IC-4 — Branch Transfer / MMJ Rebuild

**✅ DONE (2026-09-16)**. The "in*transit means reserved, not physically
moving" open question below was resolved by an explicit, closed
product-owner decision BEFORE this phase began (stated verbatim in the
assigning brief): `in_transit` means the goods have PHYSICALLY LEFT the
source branch. The plan below (written before that decision existed)
described the OLD, now-superseded semantics as its own target shape —
preserved here for historical record, but superseded in full by the
actual implementation. See `inventory-core-architecture.md` §9B and
`docs/inventory/reviews/ic-4-review/` for the final, as-implemented
design (new `prepared` pre-shipment status, new `inventory_send_branch*
transfer`/`inventory*cancel_branch_transfer`RPCs, redefined`311`+
new`312`movement types, a dedicated`inventory_branch_transfer*
discrepancies` table, and the full live/concurrency evidence).

**Goal (as originally planned)**: repair the broken `inventory_accept_branch_transfer`/`inventory_
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

**✅ DONE (2026-09-16, includes a same-day narrow correction pass)**.
`repair_order_line_locations` is now a genuinely derived projection,
deterministically rebuildable from canonical ledger + attribution
history, reversal-aware without coupling the generic engine to
RepairOrder domain logic. See `inventory-core-architecture.md` §9C
(including its own "IC-5 Narrow Correction Pass" subsection) and
`docs/inventory/reviews/ic-5-review/` for the full as-implemented
design, live evidence, and every live-caught defect (all self-
corrected same session). The correction pass fixed a BLOCKER (reversed
putaway rebuilt the wrong projection bucket set, leaving the source/
receiving bucket stale) and centralized all three direct writers of
`repair_order_line_movement_links` (attach/putaway/reversal-trigger)
behind one internal canonical primitive, after external review found
the original pass's own documentation claim ("attach is the sole
writer") had become false. `getPhysicalStateForLine`/read-model
consumers were NOT touched (no UI/read-model work in this phase, per
explicit scope) — the projection's own external shape
(`repair_order_line_locations` rows + `repair_order_location_
attribution_uncertain` markers) is unchanged, so existing consumers
require no change.

**Goal (as originally planned)**: convert `repair_order_line_locations` from an independently-
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

**✅ DONE (2026-09-17)**. Every candidate named in this phase's own
scope, plus several more surfaced by the required call-graph audit,
were classified via the "four evidence sources" discipline (repo
callers, live `pg_proc`/`prosrc` scan, application-export trace,
tests/migrations/docs) before any deletion. Dropped: `inventory_v1_
get_or_create_balance` (dead balance helper); the stale 5-arg
`inventory_get_or_create_balance_for_update` overload (a genuine
landmine — its own 7-arg replacement's trailing 2 params both carry
DEFAULTs); `inventory_settings.negative_stock_policy` (Option A, full
column drop — proven not just unused but structurally UNREACHABLE, see
`inventory-core-architecture.md` §9D item 3); `ambra-location-
inventory.ts`'s 4 dead write actions (`createLocationContainerAction`,
`addItemsToContainerAction`, `removeItemFromContainerAction`,
`relocateContainerAction` — confirmed zero callers a third time this
session, matching this section's own pre-existing "confirmed twice"
note). Movement code `311` re-confirmed already resolved by IC-4 (not
touched again). Legacy movement-helper/numbering-helper audits (§6/§7)
confirmed already-clean, documented only, nothing to drop. GUC audit
(§10) retained both `ambra.inventory_movement_engine` and `ambra.
repair_order_attribution_authoritative` as live/required — the known
posted-header GUC bypass is explicitly left for full IC-7, not
superficially patched here. A genuine regression was surfaced by the
full-suite rerun: pgTAP `102_...`'s own Scenario C directly `UPDATE`d
the now-dropped `negative_stock_policy` column — fixed by editing the
TEST FILE (not a migration) to remove the now-meaningless two-policy
comparison, collapsing to one unconditional assertion pass (`plan(14)`
→ `plan(11)`), re-verified 11/11 live. New dedicated pgTAP file `108_
ic6_legacy_cleanup_test.sql` (23/23) proves the cleanup boundaries
(dropped functions absent, stale overload absent, canonical helpers
still callable, internal functions still non-executable by ordinary
roles, canonical receive/reverse/putaway/branch-transfer/RepairOrder-
projection paths all still succeed unchanged). `ambra-location-
inventory.ts`'s remaining 3 exported functions (`deletePutawayRuleAction`,
`findContainersByReferenceAction`, `createLocationPutawayRuleAction`)
are also dead but were deliberately RETAINED — out of this phase's
narrow Inventory-Core-balance/ledger-writer charter (they touch
`inventory_putaway_rules`, an unrelated table), disclosed as a future
cleanup candidate rather than silently swept in. See `inventory-core-
architecture.md` §9D and `docs/inventory/reviews/ic-6-review/` for the
full as-implemented dead-path matrix, live evidence, and every finding.

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

**NOTE (2026-09-16, added by IC-7A, does NOT mark this phase done)**: the
single most severe item that was on this phase's own list —
`inventory_create_draft`/public `inventory_finalize_posting`/`inventory_
create_and_finalize` carrying live `anon` EXECUTE with zero actor/
permission check, a full authentication bypass — was pulled forward and
CLOSED early as IC-7A (see the dedicated section above, between IC-3 and
IC-4). This phase's own remaining scope is UNCHANGED and still fully
OPEN: the posted-header GUC UPDATE bypass, reservation/allocation
raw-write RLS, container generic raw-write policies, the systemic `anon`
default-privilege re-grant behavior (root cause confirmed by IC-7A but
deliberately not changed, given its schema-wide blast radius), and
`inventory_branch_transfers`/`_lines` (pending IC-4). **IC-7 itself is
NOT done** — only the one item IC-7A closed early is done.

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
- **HARD GATE, assigned by IC-6/IC-6A (2026-09-17)**: from-scratch
  migration reproducibility. IC-6 confirmed live and precisely that no
  locally-mirrored migration creates `repair_order_line_locations`,
  `repair_order_location_attribution_uncertain`, the attribution-sync
  trigger binding, or the original `receive_repair_order_stock`/
  `resolve_branch_receiving_location` definitions — these came from 7
  live `zone5_*`-named migrations that predate this project's own
  local-mirroring discipline and were never mirrored locally. A
  `supabase db reset` (or equivalent) replayed against only the
  currently-mirrored local migration tree would fail the first time it
  reached a migration referencing one of these objects. IC-8 must
  close this gap (via a safe baseline/snapshot mechanism or another
  repository-supported solution — never by fabricating fake historical
  timestamps) before the INVENTORY CORE FINAL GATE below can be
  reached.

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
after the full suite; **a clean database can be constructed from
repository migrations alone (from-scratch reproducibility restored —
see the HARD GATE bullet above; IC-8 must NOT be marked FINAL while
this remains broken)**; the INVENTORY CORE FINAL GATE report (§below)
is produced.

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
