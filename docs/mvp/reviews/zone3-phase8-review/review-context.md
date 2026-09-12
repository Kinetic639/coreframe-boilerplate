# Zone 3 Phase 8 — Review Context

This document lets a reviewer who did not implement Phase 8 evaluate it end to end, without
needing to have reviewed the underlying code line by line first. Read alongside
`zone3-phase8.diff` (the code) and `changed-files.md` (the per-file manifest).

**Baseline**: `HEAD` (`78bfe6c1`) — the exact repository state after Phase 7's final narrow
correction pass, before any Phase 8 work. Verified, not assumed: `git status` before Phase 8
work began showed a fully clean working tree at exactly this commit, so no baseline
reconstruction was needed (unlike the two prior Phase 7 review bundles, which needed a temporary
worktree because Phase 7 and its corrections had not yet been committed at bundling time).

**This bundle has been regenerated.** An earlier version of this same bundle was created
immediately after Phase 8's initial implementation, before a subsequent external-review pass
found the empty-state/load-error conflation bug described in "Post-review narrow correction"
below. That earlier bundle predated the fix and reported 8 component tests / 166 total Zone 3
tests — both counts are superseded and no longer current; this regeneration diffs `HEAD` against
the CURRENT working tree, which includes the fix, and is the only version that should be relied
upon going forward.

---

## A. Phase 8 objective

Build the logical RepairOrderLine read model and its UI: a durable, non-source-document-grouped
list of the parts a RepairOrder needs, with SKU, product name, ordered quantity, unit, and
derived received/outstanding/available quantities computed from real linked movement data. This
is the "Pozycje" (parts lines) section of the frozen audit pitch checklist.

---

## B. Authoritative logical-line identity rule: same SKU does NOT imply same line

`repair_order_lines.id` is the ONLY identity/grouping key this phase's read model ever uses.
Two important, distinct facts, verified independently and not conflated:

1. **Phase 3's materialization RPC (unrelated, unchanged, out of this phase's scope) already
   merges same-SKU SOURCE lines into one logical line, but only AT CREATE TIME, within a single
   materialization call** — confirmed by reading `materialize_repair_orders_from_session`
   (`20260910075814`): when a source line's `product_code` matches an EXISTING logical line
   under the same RepairOrder, that existing line's `ordered_quantity` is incremented rather than
   a new line being created. This is an existing, accepted Phase 3 design choice this phase does
   not change or need to change.
2. **This does NOT mean two independent `repair_order_lines` rows can never share a `product_code`
   in general** — a source line with `product_code IS NULL` always gets its own new logical line
   (no key to match by); a hypothetical future manual-line-entry feature could create two lines
   with the same SKU on purpose. Live-verified before writing any code: zero of the 167 currently
   real materialized lines share a `product_code` with another line on the same order today — but
   that is a CONSEQUENCE of fact #1, not something Phase 8's read model may rely on or assume.

Phase 8's read model therefore never re-groups, re-merges, or cross-attributes by `product_code`
anywhere in its own query or mapping code — every aggregation is keyed strictly by
`repair_order_line_id`. This was proven, not merely asserted, with two REAL, directly-inserted
`repair_order_lines` rows sharing a `product_code` (bypassing the materialization RPC, exactly as
a future manual-entry path could) — both a mocked service test and a live pgTAP test confirm they
remain fully independent (see §K).

---

## C. Schema/data sources used

- `repair_order_lines` (Phase 2, unchanged): `id`, `repair_order_id`, `variant_id` (nullable FK
  to `inventory_variants`), `product_code`, `product_name` (NOT NULL), `ordered_quantity`
  (NUMERIC, default 0), `unit` (nullable), `status` (see §J), `created_at`/`updated_at`/`deleted_at`.
- `repair_order_line_movement_links` (Phase 2, unchanged): `id`, `repair_order_line_id`,
  `inventory_movement_line_id`, `applied_quantity` (NUMERIC, CHECK `> 0`), `relation_type`
  (CHECK IN `'receipt'`, `'issue'`, `'reversal'`), `created_at`. `UNIQUE (repair_order_line_id,
inventory_movement_line_id, relation_type)`.
- **`inventory_variants` was evaluated and deliberately NOT joined**: live-verified 100% of
  currently-materialized lines (167/167) have `variant_id IS NULL` — no existing materialization
  or creation path resolves/assigns a real variant. Joining would (a) return nothing for any real
  row today, and (b) introduce a cross-module RLS dependency (`inventory_variants`' own SELECT
  policy requires `warehouse.products.read`, a permission Workshop callers are not guaranteed to
  hold) for zero current benefit. `product_code`/`product_name`, already correctly scoped through
  the parent RepairOrder, are the correct source of truth today.

---

## D. Exact derived quantity formulas

```
receivedQuantity     = SUM(applied_quantity) WHERE relation_type = 'receipt'
issuedQuantity       = SUM(applied_quantity) WHERE relation_type = 'issue'
outstandingToReceive = orderedQuantity - receivedQuantity
availableForIssue    = receivedQuantity - issuedQuantity
```

All four grouped strictly by `repair_order_line_id`.

**Why this resolves, rather than guesses at, the architecture doc's own flagged ambiguity**:
`docs/mvp/zones/03-repair-orders.md` (Correction 5) explicitly states `remaining_quantity =
received_quantity - issued_quantity` OR `ordered_quantity - issued_quantity`, "per final product
definition of 'remaining' — needs one product-owner confirmation," and lists this exact question
under its own "Remaining technical unknowns" section, still unresolved as of this phase. Rather
than picking one interpretation, Phase 8 exposes BOTH underlying quantities under their own
unambiguous names — `outstandingToReceive` (unambiguously "how much of the order is not yet
received") and `availableForIssue` (unambiguously "how much received stock has not yet been
issued"). This still reproduces the architecture doc's own worked example exactly (see §K), since
in that specific example the order is fully received (`ordered = received = 5`), making both
candidate "remaining" formulas coincide at `2` — the ambiguity simply doesn't manifest in the one
example the architecture doc names, but WOULD in a partially-received scenario, which is exactly
why exposing both named quantities (rather than one ambiguous "remaining") is the correct,
non-guessing choice.

**Not clamped to zero**: `applied_quantity` is always `> 0` (DB CHECK) and the two relation-type
buckets are disjoint, but nothing today (Phase 10 does not exist yet) prevents receiving more
than ordered or issuing more than received. A negative `outstandingToReceive`/`availableForIssue`
is a genuine, meaningful over-receipt/over-issue signal, not an error state to hide — no
established convention anywhere in this codebase says to clamp derived quantities like this, so
none was invented.

---

## E. Relation-type semantics

`relation_type` is a flat, disjoint 3-way classification (`'receipt'`, `'issue'`, `'reversal'`).
`receivedQuantity` and `issuedQuantity` are computed independently, each filtered to exactly one
bucket — there is no cross-bucket arithmetic (e.g. `'issue'` rows never subtract from
`receivedQuantity`, nor vice versa).

---

## F. Reversal limitations (disclosed, not invented)

`'reversal'` is a valid live CHECK-constraint value, but:

- No column anywhere identifies WHICH receipt or issue a given reversal row is reversing (no
  `reverses_link_id` or similar).
- The architecture doc's own literal derived-quantity formula only ever sums `'receipt'` or
  `'issue'` rows — it does not mention netting a `'reversal'` bucket against either.
- Nothing in this codebase writes `'reversal'` rows yet — live-verified 0 rows exist in
  `repair_order_line_movement_links` in production today (Phase 10, which will eventually
  populate this table at all, does not exist yet).

Phase 8's read model therefore EXCLUDES `'reversal'` rows from both sums entirely — proven live
(pgTAP T10: a line with a 5-unit receipt and a 3-unit reversal still reads `receivedQuantity = 5`,
not `2`). This is a disclosed limitation: a future phase that defines real reversal semantics
(most likely a linkage column identifying what a reversal reverses) must add that column and
update this aggregation accordingly. Phase 8 does not guess at what that design should be.

---

## G. Query architecture

**Chosen: one PostgREST embedded-select** (`repair_order_lines` with a nested
`repair_order_line_movement_links(applied_quantity, relation_type)` array), preceded by one
lightweight parent-scope check. Total: **2 bounded queries** for a full lines read, independent
of how many lines or movement links exist — not one query per line (no N+1).

**Rejected alternatives, with reasoning**:

- **(A) N-per-line queries**: rejected — would be genuine N+1 for no benefit.
- **(C) a new SQL view**: rejected — no DB migration is justified for a query Postgres/PostgREST
  already resolves in a single round trip via a standard has-many embed; the plan's own
  "TO VERIFY DURING PHASE" note explicitly left this open, and this phase closes it with evidence
  rather than defaulting to a view "because it looks more enterprise."
- **A raw new RPC**: not needed — no cross-table write, no transaction boundary, and no
  aggregation Postgres/PostgREST's own embed mechanism cannot already express in one query.

**Why the same-SKU-independence guarantee holds "for free"**: PostgREST nests each
`repair_order_lines` ROW's own movement links under that specific row's `id`, via the
`repair_order_line_id` foreign key — never across rows that happen to share a `product_code`.
There is no code path in this method that re-groups by anything other than the row's own primary
key.

---

## H. Permission/RLS model

No RLS policy was added, changed, or widened. `repair_order_lines` and
`repair_order_line_movement_links` are both unchanged Phase 2 Tier-1 join-derived-scope tables —
reading either requires exactly `workshop.repair_orders.read` on the PARENT RepairOrder's
`organization_id`/`branch_id` (via `has_branch_permission`), the identical boundary the parent
RepairOrder itself already enforces. The service method's own parent-scope pre-check (mirroring
`getByIdForWorkshop`'s established convention) never trusts a client-supplied org/branch value —
both are always sourced from the caller's own server-trusted active context, exactly like every
other Phase 6/7 read method.

`inventory_variants` — the one table considered for a join and declined (see §C) — was evaluated
specifically so as not to widen the required permission surface for this read (it would have
required `warehouse.products.read` in addition to `workshop.repair_orders.read`, a permission
this phase's callers are not guaranteed to hold).

---

## I. Phase 10 boundary — what is intentionally not wired yet

Phase 8 explicitly does NOT:

- Implement WU or 101 RepairOrder attribution.
- Modify `inventory_finalize_posting` or any other inventory-movement RPC.
- Touch Zone 5 Receiving.
- Add putaway logic, `repair_order_line_locations`, new movement types, or container logic.

Phase 8 only READS the existing `repair_order_line_movement_links` table. Populating it from
real receiving/issuing warehouse actions is entirely Phase 10's job, not started here. This is
why the pgTAP test (§K, §L) had to create its own transaction-scoped fixture movement-link rows
directly rather than exercising a real receiving/issuing flow — explicitly anticipated and
permitted by this phase's own scope boundary, not a shortcut taken silently.

---

## J. UI behavior desktop/mobile

A plain async server component (no client hook/action — this is pure read-only display with zero
interactivity for Phase 8; Phase 7's header editor is a client component only because IT needs
interactivity for editing/lifecycle actions, which this list does not). Follows the Workshop list
page's own established `hidden ... md:block` (desktop table) / `flex ... md:hidden` (mobile
stacked cards) responsive convention exactly, including its `data-testid` naming pattern.

Columns rendered: SKU, Part/Description, Ordered, Received, Outstanding, Available, Unit.
Deliberately NOT rendered:

- **A source-document column** — that is Phase 9's own provenance concern; including it here
  would blur the logical-line/provenance boundary the architecture doc itself draws between
  these two phases.
- **The real `status` column as a status indicator** — `repair_order_lines.status` genuinely
  exists as a persisted column (not fabricated), but live-verified 100% of currently-materialized
  lines (167/167) read the DB default `'pending'` — nothing (no trigger, no service method, no
  Phase-10 wiring yet) ever transitions it. Rendering it would misrepresent every real line as
  permanently "pending" regardless of its true received/issued state. The numeric
  received/outstanding/available columns are this phase's truthful signal instead. The field is
  still exposed on the service's own read model (for completeness and any future phase that
  legitimately needs it) — it is simply not surfaced in THIS phase's UI.

Empty state: a real, compact dashed-border panel (matching the Workshop list page's own empty
state visual language) shown only when a RepairOrder genuinely has zero lines — never a
hardcoded/demo line anywhere in the component.

Load-error state (post-review correction — see "Post-review narrow correction" below for the
full writeup): a distinct, section-local, destructive-bordered panel shown only when
`RepairOrdersService.listRepairOrderLines` itself failed, rendered instead of (never alongside)
the empty state — the two are mutually exclusive branches, never conflated.

Null handling: a null SKU or unit renders `"—"`, never a fabricated placeholder string.
`product_name` is NOT NULL at the DB layer and already carries the established `'Unknown part'`
fallback from Phase 3 materialization when no better value exists — Phase 8 renders this
truthfully as-is, it does not invent its own separate "Unknown product" string.

---

## K. Tests and exact counts

- **Service (Vitest)**: 12 new tests in a new `describe("RepairOrdersService.listRepairOrderLines")`
  block — list mapping, "not grouped by source document" (asserts the SELECT string never
  references `workshop_source_document`), same-SKU independence, the worked example (ordered=5,
  receipts 2+2+1=5, issues 2+1=3 → outstandingToReceive=0/availableForIssue=2), one-line-many-
  receipt-links, one-line-many-issue-links, zero-links-yields-zero (not undefined/NaN),
  reversal-exclusion, branch isolation (`organization_id`+`branch_id` `.eq()` calls on the parent
  check), parent-not-accessible (lines table never even queried), and two error-normalization
  tests.
- **Component (Vitest + Testing Library)**: **13 tests total** — the original 8 (empty state,
  basic rendering, derived-quantity column values, same-SKU lines render as two separate rows
  with independently correct quantities, null-SKU renders `"—"`, no source-document column, no
  raw `status` rendered as an indicator, desktop+mobile both render for the same data) plus **5
  post-review tests** for the `loadError` correction (successful-empty → real empty state, not
  error; failed read → error state with the translated message; failed read does NOT also render
  the empty-state message; normal populated result unchanged; `loadError` omitted defaults to
  non-error). See "Post-review narrow correction" below.
- **DB/pgTAP (live, `095_repair_order_lines_phase8_test.sql`)**: 11 assertions against real
  persisted rows and real RLS, as the genuinely-RLS-enforced `authenticated` role — same-SKU
  independence (T1-T4), the worked example (T5-T8), zero-links (T9), reversal-exclusion (T10),
  and branch isolation (T11). Unaffected by the post-review UI correction (that fix is
  presentation-only; no DB-level behavior changed) — not re-run for this regeneration.
- **Full Zone 3 + CRM sibling Vitest suite**: **171/171 passing** across 13 test files run
  together (146 before this phase; +20 from the original Phase 8 build; +5 from the post-review
  correction — **166/166 was this bundle's own earlier, now-superseded count**).
- `pnpm type-check`: clean. `pnpm lint`: clean on every new/changed file (re-verified after the
  post-review correction, not just at original Phase 8 completion).

---

## L. Live Supabase verification performed

Via Supabase MCP against `supabase-target`:

- Read the full `repair_order_lines`/`repair_order_line_movement_links` schema, constraints, and
  RLS policies before writing any code (not assumed from memory of Phase 2's migration file
  alone).
- Confirmed `inventory_variants.sku` exists but `variant_id IS NULL` on 100% of 167 real
  materialized lines, and confirmed `inventory_variants`' own RLS requires `warehouse.products.read`
  (the join-avoidance decision in §C).
- Confirmed 0 pre-existing rows in `repair_order_line_movement_links` (Phase 10 has not been
  built).
- Confirmed 0 pre-existing duplicate `product_code`s within the same `repair_order_id` (a
  consequence of Phase 3's own upstream merging, not something Phase 8 relies on).
- Confirmed all 167 real lines have `status = 'pending'` (the basis for §J's status decision).
- Ran the new `095_...` pgTAP file live — 11/11 passing, zero residual data after `ROLLBACK`
  (verified via a post-run `count(*)` query for the test's own fixture marker text).
- Did NOT re-run `093_...`/`094_...` this phase — zero migrations or DB-object changes were made,
  so nothing in their scope could have regressed; re-running them would have added no new
  evidence.

---

## M. Browser verification performed

**None — honestly disclosed, not fabricated.** Playwright is configured in this repository
(`apps/web/playwright.config.ts`) but no browser binaries were cached in this environment at the
time of this phase, and this same session had earlier hit a disk-space exhaustion incident (an
accidental `pnpm install` inside a temporary git worktree, used for an unrelated prior bundling
task, filled the disk to 99% before being cleaned up). Installing a fresh Chromium binary
(typically 150-300MB) against the ~1.9GB free at the time was judged too risky to justify for
this phase, per the explicit instruction to report a genuine tooling limitation honestly rather
than block on it or fabricate verification. DB/domain correctness does not depend on this — it
stands independently on the Vitest + live pgTAP evidence in §K/§L.

---

## N. Known limitations

- Full real-world receipt/issue end-to-end proof (an actual warehouse action populating
  `repair_order_line_movement_links` through a genuine UI flow) remains dependent on Phase 10,
  which does not exist yet — not claimed here, matching this phase's own acceptance criteria.
- `'reversal'` relation-type rows have no defined netting semantics (§F) — a real, disclosed gap
  for a future phase to design, not a bug in this phase's own scope.
- Manual/browser UAT of this phase's UI has not been performed (§M).
- The two pre-existing Phase 7 product decisions (manage_own unassigned creation; advisor-picker
  employee-role semantics) remain open and untouched — Phase 8 did not attempt to resolve them.

---

## O. Explicit confirmation Phase 9+ was untouched

No Phase 9 (source-document provenance), Phase 10 (movement-line wiring), Phase 11 (Magazyn/
Zamówienia-Przyjęcia sub-views), Phase 12 (attachments), or Phase 13 (pitch gate) work was
started. No Zone 5/8/11 file was touched. Phase 7 itself (its RLS policies, triggers, header/
advisor/lifecycle code, and its own tests) was not modified in any way during this phase — `git
diff HEAD` (the full, unrestricted diff, not just this bundle's scoped one) contains zero changes
to any Phase 7 file, confirming this bundle's 10-file scope is the complete set of what changed,
with nothing left out and nothing extra silently included.

---

## Post-review narrow correction

**Original issue**: `RepairOrderDetailPage` computed `const lines = linesResult.success ?
linesResult.data : [];` — a failed `listRepairOrderLines` call and a genuinely successful read
that simply found zero lines both produced the identical empty array, and therefore the
identical empty-state UI. This is factually misleading: "we could not check" and "we checked and
there are none" are different claims, and a reviewer/user had no way to tell them apart. The
`lines.errors.loadFailed` i18n key had already been defined for exactly this case but was never
actually used by any code path.

**Fix**: `RepairOrderLinesList` gained a `loadError?: boolean` prop (default `false`) and now
renders a genuine three-way branch instead of two:

```
loadError === true        -> compact, section-local error panel (t("errors.loadFailed"))
loadError === false
  && lines.length === 0   -> the real empty state
loadError === false
  && lines.length > 0     -> the populated table/cards
```

`RepairOrderDetailPage` computes `const linesLoadError = !linesResult.success;` and passes it
through unchanged: `<RepairOrderLinesList lines={lines} loadError={linesLoadError} />`.

**Raw DB error is not exposed**: only the boolean `linesLoadError` crosses from server to
client-visible markup. The underlying error string — itself already passed through
`normalizeRepairOrderCrudError` inside `listRepairOrderLines`, never the raw Postgres/PostgREST
error — is read (`!linesResult.success`) but never rendered; the UI's own error text is the
static, pre-translated `t("errors.loadFailed")`, identical every time regardless of what
specifically failed.

**Page header/rest remain independently usable**: the four detail-page reads
(`getByIdForWorkshop`, `listAdvisorCandidates`, `getOwnAdvisorContactId`, `listRepairOrderLines`)
are four independent entries in one `Promise.all` — a `listRepairOrderLines` failure has no
bearing on whether the other three succeeded. The header, advisor section, and lifecycle actions
render exactly as before; only the lines section itself degrades to its own local error state.

**Tests added**: 5 new component tests (see §K above for the full list) — proving, with real
rendered output rather than by inspection alone, that (1) a successful empty result still shows
the real empty state, (2) a failed read shows the error state with the correct message, (3) a
failed read never ALSO shows the empty-state message (the two are mutually exclusive), and (4) a
normal populated result is completely unaffected by the new prop.

**Final automated counts** (superseding this bundle's own earlier, now-stale figures):

- Component (`repair-order-lines-list.test.tsx`): **13/13 passing** (was 8/8).
- Full Zone 3 + CRM sibling Vitest suite: **171/171 passing** (was 166/166).
- `pnpm type-check` / `pnpm lint`: clean, re-verified after this correction.
- DB/pgTAP (`095_...`): unaffected and not re-run — this correction is presentation-only, no
  database behavior changed.
- Manual/browser UAT: still not performed (§M) — unchanged by this correction, same disclosed
  tooling limitation.

---

## Questions for external reviewer

1. Can same-SKU logical lines ever accidentally merge?
2. Are quantities aggregated strictly by `repair_order_line_id`?
3. Are receipt/issue relation types interpreted correctly?
4. Can reversal rows produce double counting?
5. Can a line from another RepairOrder/branch leak into this read model?
6. Is there an N+1 query problem?
7. Are numeric quantities handled safely?
8. Does the service trust any client-provided org/branch value incorrectly?
9. Does RLS remain authoritative?
10. Are raw DB errors normalized?
11. Does the UI truthfully distinguish unavailable Phase-10 data from zero?
12. Did Phase 8 accidentally implement Phase 9/10 concerns?
13. Are tests using real persisted link rows where required rather than only mocks?
14. Is there any pitch-blocking defect before moving to Phase 9?
