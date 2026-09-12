# Zone 3 Phase 9 — Review Context

This document lets a reviewer who did not implement Phase 9 evaluate it end to end. Read
alongside `zone3-phase9.diff` (the code) and `changed-files.md` (the per-file manifest).

**Baseline**: `HEAD` (`51175b67`, "Zone 3 Phase 8: logical RepairOrderLine read model + UI") —
Phase 8 was already fully committed before this phase began (verified via `git status`, which
showed a fully clean working tree at exactly this commit), so no baseline reconstruction/
worktree was needed — unlike the two prior Phase 7 review bundles.

**This bundle has been regenerated** against the SAME baseline (`HEAD` `51175b67`, unchanged),
after external review found the phase's own cross-order provenance fix was incomplete (it
filtered the contribution reference but not the foreign source line's own metadata). See "Cross-
order leak — found and fixed in TWO passes" below for the full writeup of both the original fix
and this correction. Superseded figures from the earlier version of this bundle (13 service
tests, 195/195 full-suite) are called out explicitly wherever still relevant below, rather than
silently overwritten.

---

## A. Phase 9 objective

Build the provenance-inspection read model and a compact, reusable UI surface answering "where
did this RepairOrder come from?" — which source document(s) and source line(s) contributed, and
(traced down to a specific level) which original Matcher/WDD line each source line was parsed
from. Explicitly NOT the final Phase 11 Magazyn/Zamówienia-Przyjęcia sub-view composition —
Phase 9 builds the reusable data/UI primitive Phase 11 will later compose.

---

## B. Schema relationships

The canonical hierarchy, unchanged from Phase 2, all live-reverified before writing any code:

```
repair_orders
  └─ repair_order_source_document_links   (M:N link, composite PK, no cardinality restriction)
       └─ workshop_source_documents        (natural key: org+branch+type+external_number+session)
            └─ workshop_source_document_lines
                 ├─ wdd_matcher_line_id ──► wdd_matcher_lines   (deep traceability reference)
                 └─ repair_order_line_source_links   (UNIQUE on workshop_source_document_line_id
                      └─ repair_order_lines            alone -- a source line contributes to AT
                                                        MOST ONE logical line, never more)
```

---

## C. Source-document identity

`workshop_source_documents` (Phase 2, unchanged): `id`, `organization_id`, `branch_id`,
`document_type` (`'zl'|'zw'|'wdd'`), `external_document_number`, `source_session_id` (FK to
`wdd_matcher_sessions`, NOT NULL), `official_warehouse_code`, `block_id`, `created_at`. Natural
key/unique index, live-reverified: `workshop_source_documents_natural_key` on
`(organization_id, branch_id, document_type, external_document_number, source_session_id)` —
exactly the 5-column natural key the architecture doc names, confirmed still live and unchanged.

---

## D. Source-line identity

`workshop_source_document_lines` (Phase 2, unchanged): `id`, `workshop_source_document_id`,
`wdd_matcher_line_id` (nullable FK), `product_code`, `product_name`, `quantity` (NUMERIC, CHECK
`>= 0`), `unit`, `raw_text`, `created_at`. No composite/natural-key uniqueness on this table
itself — a source line's own identity is simply its `id`; its uniqueness AS A MATCHER LINE'S
materialization is enforced one level up, via `workshop_source_document_lines_matcher_line_unique`
(`(workshop_source_document_id, wdd_matcher_line_id) WHERE wdd_matcher_line_id IS NOT NULL`).

---

## E. RepairOrder↔document M:N

`repair_order_source_document_links`: composite PK `(repair_order_id, workshop_source_document_id)`
— genuinely M:N by construction, no additional restriction in either direction. Live-verified
before writing any code: at verification time, live production data showed a perfect 26 = 26 = 26
ratio between documents, orders, and links — no real M:N scenario exists in production yet (every
document currently backs exactly one order). This phase's pgTAP test therefore creates its own
transaction-scoped fixture rows reproducing both directions (one document linked to two orders;
one order linked to three documents, including a later-arriving one) — exactly the same class of
fixture-based proof Phase 8's own same-SKU-independence test already required, for the same
underlying reason (the scenario is structurally supported but not yet naturally occurring).

---

## F. RepairOrderLine↔source-line relationship

`repair_order_line_source_links`: `id`, `repair_order_line_id`, `workshop_source_document_line_id`,
`quantity_contribution` (NUMERIC, CHECK `> 0`), `linked_at`. `repair_order_line_source_links_
source_line_unique` — a live, verified UNIQUE index on `workshop_source_document_line_id` ALONE
— guarantees a source line contributes to at most ONE logical line, ever. The inverse is NOT
restricted: one logical line may legitimately have MANY source-line contributions (across many
documents) — this is the exact mechanism behind Correction 5's worked partial-receipt example and
this phase's own "one logical line → many source lines" requirement.

---

## G. quantity_contribution

Always read as the raw persisted DB value — never recomputed, summed-and-reconciled, or silently
normalized against `repair_order_lines.ordered_quantity`. Live-verified before writing any code
that current production data shows ZERO discrepancy between a line's `ordered_quantity` and the
sum of its own `quantity_contribution` values (they always match exactly today) — but this phase's
own pgTAP test (T7) deliberately constructs a fixture where they legitimately DIVERGE (contributed
sum ≠ ordered_quantity) and asserts the mismatch is exposed truthfully, proving the read model
does not silently paper over real data the way a naive "just show ordered_quantity" implementation
might.

---

## H. Matcher/WDD traceability

`workshop_source_document_lines.wdd_matcher_line_id` is the traceability reference — a plain
column, no join required to expose it. **Deliberately NOT joined to `wdd_matcher_lines` for its
own content**: live-verified before writing any query that both `wdd_matcher_lines` and
`wdd_matcher_sessions` require a separate `wdd_matcher.read` permission for SELECT — a Workshop
caller holding only `workshop.repair_orders.read` is not guaranteed to hold it (the identical
class of cross-module RLS boundary Phase 8 already declined to cross for `inventory_variants`).
The raw id reference alone satisfies this phase's own acceptance criterion ("traceable back to
specific `wdd_matcher_lines` rows") literally, without widening any permission surface. Live-
proven (pgTAP T9/T9b): the reference is genuinely readable via the source line's own (accessible)
RLS, while the exact same actor genuinely cannot read the target row's own content directly —
confirming this is a verified design decision, not an unverified assumption. No stable route to a
specific Matcher session detail page exists anywhere in this codebase today (verified via
repository search before deciding); the UI therefore does not render a dead/fabricated "Open
source session" link.

---

## I. Query/read-model architecture

**Chosen**: ONE hierarchical PostgREST embedded-select (`repair_order_source_document_links` →
nested `workshop_source_documents` → nested `workshop_source_document_lines` → nested
`repair_order_line_source_links`), preceded by the same parent-scope check Phase 7/8 already
established, plus one additional small indexed query for the cross-order-leak fix (this order's
own logical-line ids). **Total: 3 bounded queries** for a full provenance read, independent of
how many documents/lines/contributions exist — no N+1, no per-document or per-line looping.

**Rejected alternatives**: (B) separate document query + on-demand per-document line query —
rejected, since it would need a SECOND round trip for exactly the line-level data the one
hierarchical embed already returns; a new SQL view/RPC — rejected, no DB migration justified for
a query PostgREST's own embed mechanism already resolves in one round trip, given the live data
volumes at verification time (26 documents / 202 lines total across the whole database).

`groupProvenanceByRepairOrderLine` (used for the line-level "Sources (N)" UI affordance) is a
**pure, in-memory function, not a fourth query** — it re-indexes the SAME tree
`getRepairOrderProvenance` already fetched, by logical-line id.

---

## J. RLS/security

No RLS policy was added, changed, or widened. Every table this phase reads
(`workshop_source_documents`/`repair_order_source_document_links`/`workshop_source_document_
lines`/`repair_order_line_source_links`) is an unchanged Phase 2 Tier 1 join-derived-scope table
— reading provenance requires exactly `workshop.repair_orders.read` on the parent RepairOrder's
`organization_id`/`branch_id`, identical to the boundary the parent itself already enforces.

**The one genuine security-relevant finding this phase produced**: a cross-order contribution
leak in this phase's OWN first-draft query (see §E/§F above and the dedicated section below) —
found and fixed during implementation, before it ever shipped, not a pre-existing bug reachable
before this phase.

---

## Cross-order leak — found and fixed in TWO passes (the second by external review)

**The scenario**: `repair_order_source_document_links` is genuinely M:N — one
`workshop_source_documents` row can legitimately be linked to MULTIPLE RepairOrders. Because a
source line's unique-ownership constraint only guarantees at most ONE contribution TOTAL (never
that all of a SHARED document's lines belong to the same order), individual lines within one
shared document can genuinely contribute to DIFFERENT orders' own logical lines.

**Pass 1 (found and fixed during this phase's own implementation, before it ever shipped)**: a
first-draft version of this method, fetching RepairOrder A's provenance for a document A shares
with RepairOrder B, would return ALL of that document's lines — including one whose ONLY
contribution points to a logical line belonging to B, not A. That contribution's
`repairOrderLineId` (a reference to a specific logical line on a DIFFERENT RepairOrder) would
have leaked into A's own provenance response. **Fixed** with an additional small, indexed query
fetching THIS order's own logical-line ids, used to filter every source line's `contributions`
array to only entries this order actually owns.

**Pass 2 (found by external review, this same day)**: pass 1's fix was itself incomplete — it
filtered only the CONTRIBUTION REFERENCE, but the FOREIGN SOURCE LINE ITSELF still leaked
through, with its full content intact (`productCode`/`productName`/`quantity`/`unit`/
`wddMatcherLineId`) and merely an empty `contributions` array. A caller viewing RepairOrder A's
provenance could still see RepairOrder B's own source-line metadata — the actual product question
this phase answers is "which source lines contributed to THIS RepairOrder", not "show every line
contained in every shared document" (no accepted requirement for the latter exists anywhere in
the architecture doc — checked, not assumed, before applying this correction).

**Pass 2 fix**: `mapProvenanceDocument` now filters `doc.lines` itself, not merely each line's
`contributions` — a source line with ZERO contributions belonging to THIS order (whether
never-linked at all, or linked only to a DIFFERENT order) is omitted from the returned `lines`
array entirely. **The document itself is still always returned** even if every one of its lines
gets filtered out this way — its `repair_order_source_document_links` row is real, genuine
document-level provenance ("this document was linked to this order"), independent of which
specific lines within it happen to belong to this order vs. another one it is also shared with.
This state (a document linked to an order with zero of its own visible lines) is not reachable
through today's materialization RPC — verified, not assumed: a document is always created
together with its order link, and ALL of a block's source lines are linked to logical lines under
that SAME order within one materialization call — but it is not schema-prevented either, so
keeping the real link with an empty line list is the truthful choice over silently dropping it.

**Zero-contribution lines are no longer rendered as "unlinked" placeholders either**: a line that
was never linked to ANY logical line at all (a separate, legitimate state Phase 3's materialization
RPC can produce for a zero/null-quantity source line) is likewise omitted from a RepairOrder's own
provenance tree — "provenance of this RepairOrder" means lines that actually contributed to it,
not every line physically present in a linked document. The UI's own "Not linked to a part on this
order" rendering branch (and its `sourceLine.unlinked` i18n key) was removed as dead code — the
service no longer returns anything that branch could render.

**Proof, not just a code change**: dedicated mocked Vitest tests reproduce both the direct scenario
(RepairOrder A's provenance omits B's line entirely — not merely empties its contribution — with
explicit checks that the foreign line's id/SKU/name/`wddMatcherLineId`/`repairOrderLineId` never
appear anywhere in the serialized response) and its inverse (RepairOrder B's own provenance
symmetrically excludes A's line), plus a dedicated test proving a document with zero own-order
visible lines is still returned. Live pgTAP T1-T3 (unchanged by pass 2 — see §N) proves the
underlying M:N data shape that makes both passes' fixes necessary; pass 2's own fix, being pure
TypeScript mapper logic, is proven by the mocked Vitest suite, which pgTAP cannot exercise.

---

## K. Manual orders/no provenance

A manually-created RepairOrder (Phase 7) has zero linked `repair_order_source_document_links`
rows by construction — this is a valid, non-error state. `getRepairOrderProvenance` returns
`{ success: true, data: [] }` for it (mirroring `listRepairOrderLines`'s own established
convention), and the UI renders a genuine, truthful empty state — no fabricated document is ever
shown.

---

## L. Later-arriving document behavior

A second Matcher session's materialization output, arriving after a RepairOrder already exists,
attaches a NEW `workshop_source_documents` row and a NEW `repair_order_source_document_links`
row to the SAME existing RepairOrder (this is Phase 3's own established `ON CONFLICT`-based
idempotency behavior, unchanged by this phase). Live-proven (pgTAP T10/T11): attaching a
later-arriving document to an already-existing order does not create a duplicate order row, and
the later document is listed alongside the original provenance — both old and new are shown
together, neither replacing nor duplicating the other.

---

## M. UI behavior

**"Source documents" section** (`repair-order-provenance.tsx`, client component — needs local
expand/collapse state, via the existing `Collapsible` primitive, matching "reuse existing design
patterns" rather than inventing a new interaction mechanism): compact document rows (type +
external number + line count); expanding reveals source lines with SKU/description/quantity and,
per line, its contribution target's quantity. Every line rendered here always belongs to THIS
RepairOrder — the now-removed "Not linked to a part on this order" rendering branch (external
review, pass 2 of the cross-order fix above) is dead code the service can no longer trigger.

**Line-level affordance** (`repair-order-line-sources.tsx`): a small "Sources (N)" trigger (using
the existing `Popover` primitive) added to each Phase 8 line row — NOT a duplicate of the whole
document section per row, just enough to answer "which source line(s) fed this specific logical
line, and how much?" Renders nothing when a line has zero sources.

**Empty vs. error, explicitly distinguished** (matching the exact pattern Phase 8's own external
review already corrected): a genuinely empty-provenance RepairOrder renders the real empty state;
a failed provenance read renders a distinct, section-local error state — the two are never
conflated, and a provenance-read failure never fails the rest of the page (the header/Phase 8
line list render independently either way, since all detail-page reads are separate `Promise.all`
entries).

**No Matcher session navigation** — verified absent, not assumed: no stable route to a specific
Matcher session detail page exists anywhere in this codebase today.

**Responsive**: no new desktop/mobile split was needed — the document list and expand/collapse
interaction is itself already compact and naturally responsive (no wide table to squeeze), unlike
Phase 8's own logical-line list which needed a dedicated desktop-table/mobile-cards split.

---

## N. Tests

- **Service (Vitest)**: **14 tests** in the `getRepairOrderProvenance` describe block (was 13
  after this phase's initial implementation; net +1 after the external-review correction, with 3
  original tests replaced/rewritten and 5 new/rewritten tests taking their place) — list mapping,
  one-order→many-documents, query-scoping, one-logical-line→many-source-lines
  (`quantity_contribution` preserved exactly), same-SKU independence when grouped by line,
  no-fabricated-Matcher-join (now using a line that genuinely belongs to this order),
  inaccessible-parent, empty-manual-order, 2× error normalization, **a rewritten cross-order
  test** (foreign line entirely absent, not merely empty-contributions — checked via explicit
  string-absence assertions on the serialized response), **a new inverse test** (order B excludes
  order A's line), **a rewritten zero-contribution test** (asserts omission, not "empty array"),
  and **a new zero-visible-lines-but-document-still-returned test**.
- **Component (Vitest + Testing Library)**: **9** `RepairOrderProvenance` tests (was 8; the
  removed "unlinked" test replaced by a defensive no-fabricated-placeholder test plus a new
  never-renders-an-absent-line test, net +1) + 4 tests for the line-level "Sources (N)" affordance
  inside `repair-order-lines-list.test.tsx` (unchanged by the correction — re-verified still
  correct, since the affordance only ever counts contributions actually present in the now
  more-correctly-filtered provenance tree; present-with-correct-count, absent-when-zero,
  cross-line-isolation, safe-default-when-omitted).
- **DB/pgTAP (live, `096_repair_order_provenance_phase9_test.sql`)**: 15 assertions against real
  persisted rows and real RLS, as the genuinely-RLS-enforced `authenticated` role. **Not re-run
  for the correction** — that fix lives entirely in the TypeScript mapper, which pgTAP cannot
  exercise; only a stale header comment was corrected (see `changed-files.md`).
- **Full Zone 3 + CRM sibling Vitest suite**: **198/198 passing** across 14 test files run
  together (was 195 immediately after this phase's initial implementation; +3 net from the
  external-review correction).
- `pnpm type-check`: clean. `pnpm lint`: clean on every new/changed file.

---

## O. Live verification

Via Supabase MCP against `supabase-target`, before writing any code:

- Read the full schema/constraints/indexes/RLS for every provenance-related table (not assumed
  from memory of the Phase 2 migration file alone).
- Confirmed the natural key on `workshop_source_documents` and the unique-ownership index on
  `repair_order_line_source_links` are both live and exactly as the architecture doc describes.
- Confirmed `wdd_matcher_lines`/`wdd_matcher_sessions` both require `wdd_matcher.read` for
  SELECT (the basis for the traceability design decision in §H).
- Confirmed live production data: 26 documents = 26 links = 26 orders, 202 source lines = 202
  line-links (a perfect 1:1:1:1 ratio — no M:N/later-arrival scenario exists naturally yet).
- Confirmed zero pre-existing `ordered_quantity` vs. summed-`quantity_contribution` discrepancies
  in live data (the basis for §G's own fixture design, which deliberately introduces one).
- Ran the new `096_...` pgTAP file live — 15/15 passing, zero residual data after `ROLLBACK`
  (verified via a post-run marker-text query).
- Did NOT re-run `093_...`/`094_...`/`095_...` this phase — zero migrations or DB-object changes
  were made, so nothing in their scope could have regressed.

---

## P. Known limitations

- Manual/browser UAT of this phase's UI has not been performed — Playwright is configured in
  this repository but no browser binaries are cached in this environment, and installing one was
  judged too risky given this same session's earlier disk-space exhaustion incident (re-checked
  at this phase's own start: ~2.2GB free). Honestly disclosed, not fabricated.
- No stable Matcher session navigation exists yet — `sourceSessionId` is exposed on the data
  model but not rendered as a link anywhere in this phase's UI.
- The two pre-existing Phase 7 product decisions (manage_own unassigned creation; advisor-picker
  employee-role semantics) remain open and untouched.
- Full real-world receipt/issue movement attribution remains explicitly Phase 10's own,
  unstarted, dependency (unrelated to provenance, but worth restating this phase did not touch
  it).

---

## Q. Explicit Phase 10/11 boundaries

**Not implemented**: receipt/issue movement attribution, `repair_order_line_movement_links`
writes, WU, reservation/allocation/container work (all Phase 10); final named Magazyn/
Zamówienia-Przyjęcia sub-tabs (Phase 11). This phase built the reusable provenance data + a
compact inspection surface only. No Zone 5/8/11 file was touched. Phase 7 and Phase 8 were not
modified beyond the two small, additive, backward-compatible props (`provenance`, defaulting to
an empty array) this phase added to Phase 8's own `RepairOrderLinesList` — confirmed via `git
diff` that every other line of every Phase 7/8 file is unchanged.

---

## Questions for external reviewer

1. Can a source document from another org/branch leak?
2. Can source lines unrelated to this RepairOrder leak into the read model?
3. Can one source line become linked to two logical RepairOrderLines?
4. Is `quantity_contribution` preserved rather than recomputed heuristically?
5. Does one-document→many-orders work without cross-order line leakage?
6. Does one-order→many-documents work correctly?
7. Does one-logical-line→many-source-lines work?
8. Is provenance actually traceable to specific `wdd_matcher_lines`?
9. Can manual RepairOrders with no provenance render safely?
10. Can query failure masquerade as empty provenance?
11. Is there any N+1 query pattern?
12. Are raw Postgres/PostgREST errors normalized?
13. Does the service trust client-supplied org/branch incorrectly?
14. Did Phase 9 accidentally modify Phase 8 semantics?
15. Did Phase 9 accidentally implement Phase 10 movement attribution?
16. Did Phase 9 accidentally implement Phase 11 final warehouse tabs?
17. Is any new migration actually justified?
18. Is Phase 9 technically ready for manual UAT?
