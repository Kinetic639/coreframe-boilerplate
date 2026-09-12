# Zone 5 — Receiving/Putaway: External Review Context

This bundle covers the Zone 5 implementation, including three correction passes applied after
external review of the first, second, and third bundles, against the architecture approved across
six prior planning/correction rounds (see
`docs/mvp/zones/05-receiving-putaway-implementation-plan.md` for the full design record). Read
`changed-files.md` for the file manifest and `migration-summary.md` for per-migration detail; this
document explains the _why_ behind each piece and lists the reviewer's checklist.

## Corrections applied in the third correction pass (in response to external review of the second-pass bundle)

1. **Fixed a semantic correctness bug: putaway trusted an UNKNOWN source bucket.** The read model
   (`RepairOrderStorageService.getReceivedLines`) offered every positive-quantity
   `repair_order_line_locations` row at the receiving location as a confident "Put away
   &lt;quantity&gt;" candidate, without checking
   `repair_order_location_attribution_uncertain`. Worse, `putaway_repair_order_stock()` itself
   validated quantity-available against the same table alone, treating stale projection as
   authoritative available stock. This directly contradicted the architecture: existence of an
   UNKNOWN marker means the bucket's RepairOrder attribution is unknown, full stop — the
   projection row is then only last-known/stale, never physical proof, and the caller naming an
   exact `repair_order_line_id` is not proof either. Fixed at BOTH layers: the read model now
   excludes any receiving-location bucket flagged UNKNOWN from the actionable `lines` array
   (surfacing a separate `unverifiedLineCount` instead — a compact, honest signal, not a
   reconciliation UI), and the RPC independently re-derives and enforces the same rule
   server-side (never relying on the UI having already filtered it) — see §J below.
2. **Fixed a lock-order inversion / deadlock risk in the putaway RPC.** The prior revision took a
   `FOR UPDATE` lock on `repair_order_line_locations` (its quantity-available check) BEFORE
   calling `inventory_create_and_finalize`, which internally locks `inventory_balances`. Every
   other code path touching both resource families (the ledger-sync trigger, fired from inside
   the engine's own ledger insert) locks balance first and attribution/projection second — two
   transactions contending for the same bucket in opposite orders is a textbook deadlock. Fixed:
   the RPC now never locks either projection/marker table until after the engine call returns —
   see §J and §N below for the full analysis and the new, disclosed live pre-apply gate this
   requires.
3. **Replaced the previous, semantically wrong pgTAP test 5** in file `097` (it asserted that
   putaway from an UNKNOWN bucket _succeeded_) with the correct expectation (HARD ERROR, no
   movement created, source/destination projections unchanged, marker remains) — see §Q. Also
   fixed a latent bug in that same test: a bare `PERFORM putaway_repair_order_stock(...)` is
   invalid top-level SQL (PERFORM is PL/pgSQL-only); never caught because this file has never
   been executed. Added 2 new scenarios (destination-UNKNOWN retention; a best-effort structural
   lock-order proof) and 4 new application-level tests (2 read-model, 2 action-error-normalization).
4. Kept everything else on the "frozen" list untouched — see the bottom of this section.

None of these corrections touch the underlying architecture decisions from the six approved
planning rounds, nor any decision already locked in by the first or second correction passes —
they are implementation-quality fixes, not design changes.

## Corrections applied in the second correction pass (in response to external review of the corrected bundle)

1. **Fixed a critical trigger correctness bug (zero-clear ordering)**: the prior revision deleted
   the source bucket's UNKNOWN marker as its very first act whenever `balance_after = 0`,
   destroying the "was this bucket UNKNOWN before this event" signal before it could gate
   anything — risking either a spurious re-mark or, worse, a coincidental arithmetic match
   propagating a _guessed_ attribution to a transfer's destination. Fixed by capturing
   `v_source_was_unknown` first (before any mutation) and treating `balance_after = 0` as its own
   decisive, physical-truth-authoritative branch — see §E below for the exact resulting
   semantics, and `migration-summary.md` §3 for the full guard-by-guard breakdown.
2. **Added 4 new real regression pgTAP scenarios** (A–D, tests 15–25 in file `095`) plus one
   additional assertion (9b) proving ALL projection rows are wiped on a zero-clear, not just the
   marker — see §Q below. `plan()` in file `095` went from 14 to 26.
3. **Fixed a latent, previously-uncaught `plan()`/assertion-count mismatch** in test file `097`
   (declared `plan(6)`, 7 real assertions existed) — found via a mechanical cross-check run this
   pass, unrelated to the trigger bug itself.
4. **Fixed the RepairOrder detail page conflating a real load error with "zero received lines"**
   — `/dashboard/workshop/[id]` now branches explicitly on success/failure instead of collapsing
   both to an empty array, and shows a compact, non-leaking error banner
   (`data-testid="received-lines-error"`) when the read genuinely fails.
5. **Implemented the receiving-location admin UI control**, previously deferred as a "backend
   fixed, UI deferred" item in the first correction pass. A new, small, self-contained
   `LocationPurposeControl` component (calling `getLocationPurposeAction`/`updateLocationAction`
   directly) is wired into the existing `location-detail-panel.tsx`, deliberately independent of
   the large, pre-existing `LogicalLocation`/capabilities visual model to avoid conflating the new
   `purpose` column with that model's own, unrelated `canReceive` concept. `WarehouseLocationsService.update()`
   also gained constraint-name disambiguation so the new unique/CHECK violations surface distinct,
   safe messages instead of a generic duplicate-code error.
6. **Corrected migration-count wording** throughout this bundle and the progress tracker — five
   migration files, not six.

None of these corrections touch the underlying architecture decisions from the six approved
planning rounds, nor any decision already locked in by the first correction pass — they are
implementation-quality fixes, not design changes.

## Corrections applied in the first correction pass (in response to external review of the first bundle)

1. **Fixed an invalid PostgreSQL construct**: the attribution-sync trigger's ambiguity test
   combined an aggregate (`sum`/`count`) with `FOR UPDATE` in one query — not valid Postgres.
   Fixed by locking rows via a CTE first, then aggregating over the locked set.
2. **Removed fake pgTAP `pass()` placeholders** (tests `093`, `096`) — replaced with real
   fixture-driven tests or an honest `skip()` where genuinely live-only.
3. **Wired the receiving flow** — `use-movement-submission.ts` now routes a RepairOrder-resolvable
   101 through the new RPC; every other case unchanged. 5 new tests prove the routing.
4. **Wired putaway into a real page** — `/dashboard/workshop/[id]` now shows the putaway panel
   when applicable.
5. **Receiving-location admin backend fixed and tested** (`updateLocationSchema` +
   `WarehouseLocationsService.update` now genuinely persist `purpose`); a visible toggle in the
   actual location-edit UI was deferred at this point in the process — implemented in the second
   correction pass, see the section above.
6. **Added a DB-level stockable-receiving invariant.**
7. **Closed an unnecessary cross-tenant metadata-lookup surface** (`resolve_branch_receiving_location`
   no longer grants `authenticated` EXECUTE).
8. **Implemented error normalization** matching this repo's own established, hardened convention.
9. **Replaced the raw location-ID text input** with a real location picker.
10. **Added 13 action tests + 8 component tests** + 5 route-selection tests + 1 service test,
    all real and executed.

None of these corrections touch the underlying architecture decisions from the six approved
planning rounds — they are implementation-quality fixes, not design changes.

## A. Final architecture (one paragraph)

`101` receives into a branch's designated `purpose='receiving'` location (never hardcoded).
Matcher-line provenance resolves server-side to an exact RepairOrderLine, with a hard error on
broken/ambiguous provenance. `repair_order_line_locations` is the current/last-known spatial
projection of where a RepairOrderLine's stock sits; it is written directly (known-true) by two
new orchestration RPCs when they have explicit identity, and by a conservative safety-net
trigger everywhere else — a trigger that only ever acts when the answer is the unique,
mathematically-provable one, never a guess, and that marks a `(location, variant)` bucket
UNKNOWN (via a small separate marker table) rather than silently trusting stale data the moment
a generic movement makes the truth unknowable. `801` remains the only relocation primitive — no
new movement type was created anywhere in this pass. `repair_order_line_movement_links` (Zone
3's own table) remains a business-quantity ledger only; it never receives a `'putaway'` row.

## B. Receiving-location model

`warehouse_locations.purpose` (`'standard' | 'receiving'`), one active receiving location per
branch (partial unique index), resolved server-side on every RPC call via
`resolve_branch_receiving_location()` — never cached, never client-supplied.

## C. Spatial attribution model

`repair_order_line_locations`: one logical row per `(repair_order_line_id, location_id)`,
`quantity >= 0`, three composite FKs closing every org/branch/pair-integrity gap a prior review
round identified (including a corrected finding — a small additive composite-unique constraint
on Zone 3's own `repair_order_lines(id, repair_order_id)`, requiring no new column and no RLS
change on that table).

## D. UNKNOWN semantics

A separate table, `repair_order_location_attribution_uncertain`, keyed at
`(organization_id, branch_id, location_id, variant_id)`. Existence of a row = UNKNOWN, full
stop — never re-derived from live arithmetic. Cleared only by on-hand reaching exactly zero
(automatic) or a future, explicit, full-bucket reconciliation (PILOT, not built). A single
RepairOrder-aware RPC write never clears a bucket-wide marker. **[Third pass]** This marker is now
consulted, not just written, by every consumer that would otherwise treat a projection row as
authoritative: the read model excludes UNKNOWN receiving stock from actionable putaway candidates,
and the putaway RPC independently rejects putaway from a marked-UNKNOWN source bucket — a stale
projection row is never treated as physical proof merely because a caller names an exact
`repair_order_line_id`.

## E. Trigger algorithm

See `migration-summary.md` §3 for the exact ordered list of guards/branches, and the migration
file itself (`20260912092000_...trigger.sql`) for the literal PL/pgSQL, written to match the
approved plan's own pseudocode line-for-line.

**Zero-bucket semantics (final, this pass)** — `NEW.balance_after = 0` is its own decisive branch,
evaluated before and never falling through into the generic marker-gate/math logic, because
whether the source was already UNKNOWN (`v_source_was_unknown`) and whether the math resolved
confidently (`v_confident_known`) are both captured _before_ any row is touched:

- **UNKNOWN + pure decrease to zero** (no destination): marker and all projection rows for the
  bucket are wiped; nothing else happens — there is no destination to consider. (Scenario A,
  tests 15–16.)
- **UNKNOWN + transfer emptying the source** (destination present): source rows/marker wiped, and
  the destination is marked UNKNOWN — never given a guessed attribution row, even though the
  source bucket is now empty and even though the destination may have had zero prior rows of its
  own. (Scenario B, tests 17–20.)
- **KNOWN (unambiguous, single-line) + transfer emptying the source**: source rows wiped cleanly,
  and the destination is credited with the _correct_ known attribution (the one line/RepairOrder
  the pre-wipe locked read resolved to), with no unnecessary destination marker. (Scenario C,
  tests 21–23.)
- **Stale/mismatched quantity while UNKNOWN, decrease reaches zero**: the marker still clears and
  the stale row is still wiped regardless of the mismatch — `balance_after = 0` is authoritative
  over any prior row content, stale or not. (Scenario D, tests 24–25.)

All four scenarios are new real pgTAP fixtures added this pass (file `095`, tests 15–25, using an
isolated `fx2` fixture table) — not fake `pass()` placeholders.

## F. Pre-effect math

`inventory_finalize_posting` updates `inventory_balances` _before_ inserting the ledger row, so
an `AFTER INSERT` trigger always sees the post-effect balance. The trigger reconstructs the
pre-effect value from the ledger row's own `balance_after + quantity` (decrease) — never
re-queries `inventory_balances`. Proven by a dedicated pgTAP assertion (test #2 in file `095`)
using a balance_after value that would fail a naive post-effect comparison but correctly passes
against the reconstructed pre-effect value.

## G. Bypass design

`ambra.repair_order_attribution_authoritative`, `SET LOCAL`-scoped, set only inside the two
orchestration RPCs' own PL/pgSQL bodies — never a function parameter, never reachable via
PostgREST's request surface (no raw `SET` capability exposed to any client). **Duplicate-work
suppression only, never authorization** — real authorization is RLS + the RPCs' own
`has_branch_permission` checks + the projection tables having zero client-writable policy,
independent of this flag's state. A hypothetical misuse could at worst cause attribution
staleness (a correctness question, already disclosed via the UNKNOWN model) — never unauthorized
access, cross-org/branch access, or an RLS bypass.

## H. Receipt RPC (`receive_repair_order_stock`)

Actor-identity check, `has_branch_permission` check, receiving-location resolution, four-way
`source_line_id` contract (null → unattributed; unique → attributed; zero/ambiguous → hard
error), calls `inventory_create_and_finalize('101', ...)` unmodified, writes attribution
directly, atomic (single function invocation).

## I. Provenance resolution

`wdd_matcher_lines.id → workshop_source_document_lines.wdd_matcher_line_id →
repair_order_line_source_links → repair_order_lines`. The middle hop
(`workshop_source_document_lines.wdd_matcher_line_id`) was independently confirmed this session
to carry **no UNIQUE constraint** (direct read of the tracked migration, line 387/401 of
`20260910061711_repair_orders_core_schema.sql`) — meaning the "resolves to more than one
candidate → hard error" branch is defending against a structurally reachable condition, not a
theoretical one.

## J. Putaway RPC (`putaway_repair_order_stock`)

One call = one destination = one `801` document = N lines. Per-line quantity-available
validation against the live projection (reject, never clamp). Writes attribution directly
(operator-named, not inferred). Writes no `repair_order_line_movement_links` row.

**[Third pass — UNKNOWN-source rejection]** Every line's receiving-location+variant bucket is
checked against `repair_order_location_attribution_uncertain` TWICE: once via a plain, non-locking
read _before_ the engine call (the actually-authoritative gate), and once again, `FOR UPDATE`,
_after_ the engine call (defense-in-depth for the narrow pre-check-to-engine-call race window).
Either check finding a marker is a HARD ERROR (SQLSTATE `55000`) — see test 5a–5e in file `097`.
The pre-call check cannot be deferred to after the call: this RPC's own bypass flag suppresses the
ledger-sync trigger's general logic, but its zero-clear branch still runs even under bypass and
would silently clear a stale marker as a side effect of this putaway's own decrease reaching
exactly zero — a post-call-only check could see "no marker" and wrongly let the putaway through
using evidence its own transaction just erased. A destination bucket already marked UNKNOWN is
unaffected by this source-side gate and — unchanged since the first correction pass — still never
gets its own marker cleared just because it gained a real, known contribution (test 6a–6c).

**[Third pass — lock-order fix]** `repair_order_line_locations` /
`repair_order_location_attribution_uncertain` are never locked (`FOR UPDATE`) until _after_ the
engine call returns, matching the generic engine + ledger-sync trigger's own global lock order
(balance, then attribution/projection) everywhere else. The previous revision's opposite order
(projection lock, then implicitly the engine's own balance lock) was a textbook AB-BA deadlock
risk against any concurrent generic movement on the same bucket — see §N and `migration-summary.md`
§5 for the full analysis, and the new, disclosed pre-apply gate this requires (confirming
`inventory_balances`'s exact key shape and `inventory_finalize_posting`'s locking behavior live).

## K. Batch behavior

Proven by pgTAP test #1 in file `097`: two lines (one partial, one full quantity), one
destination, asserted as one movement document with two lines.

## L. Zone 6 interaction

**Zero Zone 6 files were touched.** The safety-net trigger is the entire mechanism by which a
plain, unmodified `801` posted through Zone 6's existing relocation UI keeps
`repair_order_line_locations` correct — proven by pgTAP tests #2/#3 in file `095` (unambiguous
case) and #4–7 (ambiguous case, both-ends marking). Live rehearsal through the actual Zone 6 UI
remains outstanding (BLOCKED ON MCP / no live environment).

## M. `402` behavior

Governed by the identical single ambiguity test as `801` — no special-cased logic. Proven by
pgTAP test #10 in file `095`: a `402` at a location with both attributed and ordinary stock
marks only the source (no destination bucket exists for a pure decrease).

## N. Concurrency

Two layers: the engine's own pre-existing `FOR UPDATE` lock on the `inventory_balances` row
(inherited for free — already serializes concurrent movements on the same
`(org,branch,location,variant)` before either ledger insert can even happen), plus an explicit
`FOR UPDATE` on the specific `repair_order_line_locations` rows inside the trigger and both
RPCs. **Honestly limited, per this repo's own established convention** (found verbatim in
`supabase/tests/091_repair_orders_materialization_rpc_test.sql`): pgTAP proves the lock statement
is present (test #14 in file `095`, via `pg_get_functiondef(...) ~* 'FOR UPDATE'`) and proves
correct sequential behavior; it does **not** prove genuine two-session concurrency. A live-DB,
two-connection integration test is explicitly recorded as outstanding, not fabricated as done.

**[Third pass — lock order]** External review identified a real lock-order inversion in the
putaway RPC: it locked `repair_order_line_locations` BEFORE calling the engine (which locks
`inventory_balances`), while every other path (the ledger-sync trigger, fired from inside the
engine's own insert) locks balance first, attribution/projection second. Two transactions
contending for the same bucket in opposite orders is a textbook AB-BA deadlock (T1 holds the
projection lock, waits on balance; T2 holds balance, waits on projection). Fixed by never taking a
lock on either projection/marker table until after the engine call returns, in `putaway_repair_order_stock`
(see §J and `migration-summary.md` §5). A structural pgTAP assertion (test 7 in file `097`) proves
the function's own source text never places a `FOR UPDATE` clause before the engine call — this is
a source-text proof only; it does **not** prove the absence of a deadlock under real concurrent
load, and does **not** confirm `inventory_finalize_posting`'s actual locking behavior (which this
session could not verify live — see the new pre-apply gate in §P and `migration-summary.md` §5).

**Required live two-session test (still outstanding, now with two scenarios to prove, not one)**:

1. _Pre-existing scenario_: two concurrent putaway/receive calls on the same
   `(location, variant)` bucket must not double-consume or negative-attribute.
2. _New this pass_: a putaway call and a concurrent generic movement (e.g. Zone 6's own
   relocation UI) on the same `(location, variant)` bucket, timed so each is waiting on the lock
   the other holds, must resolve WITHOUT a deadlock under the corrected lock order — and must
   never let either side observe or act on a stale/erased UNKNOWN marker. Neither scenario can be
   exercised by pgTAP; both require a genuine two-connection live session.

## O. RLS/security

Both new tables: RLS enabled + forced, SELECT-only client policy, zero client write path (write
only via the two `SECURITY DEFINER` RPCs and the trigger). Both RPCs independently check
`has_branch_permission` (they cannot rely on RLS alone since they run as `SECURITY DEFINER` and
bypass it internally). No new permission slugs — reuses `warehouse.inventory.operate`/`adjust`,
matching the slug that already gates `repair_order_line_movement_links` INSERT.

## P. Migrations

Five files, all additive (see `migration-summary.md`). **None applied to any live/local
database** — Supabase MCP was unavailable this entire session (confirmed via `ToolSearch`), no
local Postgres/Docker alternative was available (`docker ps` failed — daemon not running), and
this session deliberately did not fall back to the `supabase db push --db-url ...` CLI path that
does exist in `package.json`, since the working rules specify MCP as the approval/audit
mechanism for mutations and substituting a raw CLI push against a live, shared project was
judged outside this session's authority to decide alone.

**[Third pass]** Migration #5 (the putaway RPC) picked up a NEW, disclosed pre-apply gate in
addition to migration #3's pre-existing one: a live/MCP session must independently confirm
`inventory_balances`'s exact key shape and `inventory_finalize_posting`'s exact locking behavior
before the corrected lock order (§J/§N) can be trusted under real concurrency. See
`migration-summary.md` §5 and the migration file's own header.

## Q. Tests

Five pgTAP files (70 assertions total across `093`–`097`, itemized in each file's own header),
none executed (same MCP blocker). File `095` grew from 14 to 26 assertions in the second pass (one
added assertion 9b plus zero-bucket regression scenarios A–D, tests 15–25 — unchanged this pass).
File `097` grew from 7 to 15 assertions THIS pass: test 5 was **replaced** (not merely extended) —
the previous version asserted the wrong semantic model (putaway from an UNKNOWN bucket
_succeeding_); it is now 5 assertions (5a–5e) proving a HARD ERROR, no movement created, source
and destination projections both unchanged, and the marker still present. 3 new assertions (6a–6c)
prove a destination bucket already marked UNKNOWN keeps that marker after gaining a known
contribution. 1 new assertion (7) is a best-effort, honestly-caveated structural proof that no
`FOR UPDATE` clause appears before the engine call in the function's own source (NOT a concurrency
proof). Test 8 (movement-links non-write) is the prior test 6, renumbered only.

Application-side (vitest), **all executed and passing** against real component/action tests, not
mocked-away placeholders. This pass added: 5 new `getReceivedLines` tests (KNOWN stock actionable;
UNKNOWN stock excluded and counted; mixed KNOWN+UNKNOWN; a genuine read error distinct from
empty; no-receiving-location-configured), 2 new RepairOrder detail page tests (the new
`unverifiedLineCount` warning banner, alone and combined with actionable KNOWN lines), and 2 new
`putawayRepairOrderStockAction` tests (the new SQLSTATE `55000` error passes through as-is; the
same code with an unrecognized message does not leak). In addition to the second pass's tests: the
RepairOrder detail page's load-error-vs-empty-state distinction (3 tests), the receiving-location
`LocationPurposeControl` component (5 tests), and 2 `WarehouseLocationsService` constraint-name
disambiguation tests — and the first pass's read-model unit-test file (5 assertions, real
Supabase-client mock, verifying the grouping/ordering/KNOWN-UNKNOWN logic).

## R. Manual/browser verification

**Not performed.** No live Supabase project was reachable this session with the new schema
applied, so there was nothing real to render `repair-order-putaway-panel.tsx` against; running
Playwright against a backend that doesn't have these tables would only prove the component
fails to load data, which is neither useful nor honest to report as "QA passed." This is recorded
as outstanding, not skipped silently.

## S. Pitch limitations (carried into this pass, unresolved)

Ambiguous/commingled RepairOrder stock at a generic (non-RepairOrder-aware) location is a known,
disclosed limitation — the trigger correctly refuses to guess and marks it UNKNOWN, but the
pitch demo's own choreography must avoid creating that condition at any location the script
touches, per the approved plan.

## T. Pilot deferrals (unchanged, not implemented this pass)

Container UI/QR, mobile scanning, expected-vs-confirmed quantities, duplicate-import guard,
reversal, richer Matcher provenance beyond the join already used, location capacity modeling,
auto-bin recommendation, advanced delivery reports — all explicitly out of scope, none started.

---

## A note on a real TypeScript issue found and fixed this pass

While typechecking the new application code, `tsc` reported narrowing failures at several
`if (!result.success) return result;`-style guard clauses across three new files (the read
model's caller, the two RPC-wrapping actions, and the UI component) — TypeScript was not
narrowing a `{success:true}|{success:false,error}` union at those specific call sites, even
though the identical pattern works correctly in dozens of pre-existing files elsewhere in this
codebase. The fix applied (explicit `if (result.success === true) {...} else {...}` instead of
`if (!result.success) return ...;`, plus explicit return-type annotations on the new exported
actions) resolved it cleanly, and the full-repo `tsc --noEmit` now passes with zero errors. The
root cause was not fully isolated (time-boxed given this session's scope) — flagged here in case
it recurs, since it may indicate something about how this specific action-composition pattern
interacts with TypeScript's inference in this project's `tsconfig`, worth a closer look if it
resurfaces on a future file.

## Questions for external reviewer

1. Can any generic movement produce false KNOWN RepairOrder attribution? (Intended answer: no —
   the trigger only ever propagates when the pre-effect math is provably unique; please verify
   against the actual `inventory_stock_ledger_entries` schema once MCP/live access is available,
   given the disclosed column-verification gap in migration file #3.)
2. Can UNKNOWN self-clear incorrectly? (Intended answer: no — only zero-on-hand or a future
   explicit reconciliation clears it; please specifically try to construct a counter-example
   where a later coincidentally-passing math check clears a marker.)
3. Does ambiguous `801` mark both endpoints? (Intended answer: yes — verify via pgTAP tests
   #4–7 in file `095` once executed live.)
4. Does ambiguous `402` mark the source only? (Intended answer: yes — test #10 in file `095`.)
5. Is pre-effect balance reconstruction correct for the _actual_ live ledger ordering? (This is
   the single highest-value thing to re-verify live before trusting anything else in Phase 3.)
6. Can non-`on_hand` ledger effects mutate spatial attribution? (Intended answer: no — the first
   guard statement in the trigger.)
7. Can the bypass flag become an authorization bypass? (Intended answer: no — see §G above;
   please specifically try to reach it via the Data API/PostgREST to confirm the "no raw SET
   capability" claim holds against the actual deployed PostgREST configuration.)
8. Can receipt provenance silently downgrade to unattributed stock? (Intended answer: no — hard
   error on zero/ambiguous resolution, by design; test #3 in file `096`.)
9. Can a `source_line_id` resolve to an incorrect RepairOrderLine? (Intended answer: no — the
   join chain is unique-constrained at the `repair_order_line_source_links` hop; the earlier hop
   is not, which is exactly why ambiguous resolution is a hard error rather than assumed
   impossible.)
10. Are the composite FKs sufficient for org/branch/order/line/location integrity? (Intended
    answer: yes for location and repair_order; `repair_order_line_id`'s own org/branch
    consistency is closed by RPC-level validation plus the pair-FK to `repair_order_id`, not a
    direct composite FK to org/branch — please confirm this reasoning holds.)
11. Can quantities go negative under concurrency? (Intended answer: no — `CHECK(quantity>=0)`
    plus `FOR UPDATE` locking; please stress this with the still-outstanding live two-session
    integration test.)
12. Can two concurrent moves consume the same attribution? (Same as above — this is exactly what
    the deferred live-DB concurrency test needs to prove; pgTAP alone cannot.)
13. Does batch putaway preserve per-line attribution correctly? (Intended answer: yes — test #1–3
    in file `097`.)
14. Does putaway accidentally affect `received_quantity`/the business-quantity ledger? (Intended
    answer: no — putaway never writes `repair_order_line_movement_links`; test #8 in file `097`.)
15. Can Zone 6's generic `801` silently corrupt current location attribution? (Intended answer:
    no in the unambiguous case (propagates correctly), and no in the ambiguous case either
    (marks UNKNOWN rather than corrupting) — but please specifically try to find a movement
    shape this session didn't consider.)
16. Does the UNKNOWN UI ever appear as confident KNOWN data? (Intended answer: no — the putaway
    panel's suggestions filter by `attributionStatus`, AND, as of this pass, `getReceivedLines`
    itself excludes any UNKNOWN receiving bucket from the actionable candidate list before the
    panel ever sees it — see §J and the new `getReceivedLines`/page tests in §Q; please review
    both layers directly, since neither was verified in a real browser this pass.)
17. Does any RLS policy permit direct client writes to either new projection table? (Intended
    answer: no — please confirm directly against the live policies once applied, not just the
    migration file's intent.)
18. Were containers/capacity/reversal accidentally pulled into pitch scope? (Intended answer:
    no — please scan the diff for any reference to `inventory_containers`, capacity
    percentages, or a `reversal` relation_type; there should be none.)
19. Is any existing inventory engine behavior changed unexpectedly? (Intended answer: no —
    `inventory_create_and_finalize`, `inventory_finalize_posting`, and every existing table's
    existing columns/RLS are untouched; the only genuinely new _behavioral_ surface is the
    Phase 3 trigger, called out explicitly as such in `migration-summary.md`.)
20. **[NEW this pass]** Can a caller putaway stock from a receiving bucket flagged UNKNOWN by
    naming an exact `repair_order_line_id`? (Intended answer: no — hard error, SQLSTATE `55000`,
    at both the read model and the RPC; test 5a–5e in file `097`; please specifically try to
    construct a request that reaches the engine call despite an UNKNOWN marker being present.)
21. **[NEW this pass]** Does a destination bucket already marked UNKNOWN lose that marker merely
    by receiving one known putaway contribution? (Intended answer: no — test 6a–6c in file `097`.)
22. **[NEW this pass]** Does the corrected lock order in `putaway_repair_order_stock` actually
    eliminate the deadlock risk under real concurrent load, and does
    `inventory_finalize_posting` lock `inventory_balances` the way this pass assumed? (Intended
    answer: unverified — this is the single highest-value thing to confirm live before trusting
    Phase 6 under concurrency; see §N's two-scenario live test plan and the new pre-apply gate in
    `migration-summary.md` §5. Test 7 in file `097` is a structural, source-text-only proof and
    explicitly does NOT answer this question.)
23. Is Zone 5 technically safe for pitch UAT? (Honest answer, this pass: **not yet** — nothing
    has been applied to any database, and Phase 0/7 live verification plus Playwright QA remain
    fully outstanding. This bundle is for architecture/code review, not a readiness sign-off.)
