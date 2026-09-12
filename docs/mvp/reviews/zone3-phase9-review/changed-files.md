# Zone 3 Phase 9 — Changed File Manifest

Scope: **only** "Phase 9 — Source documents, source lines, and provenance." 13 files, all
captured verbatim in `zone3-phase9.diff`.

Baseline: `HEAD` (commit `51175b67`, "Zone 3 Phase 8: logical RepairOrderLine read model + UI")
— the exact repository state after Phase 8 (fully committed) and before any Phase 9 work.
Verified, not assumed: `git status` before this phase's work began showed a fully clean working
tree at exactly this commit, so no baseline reconstruction/worktree was needed (Phase 8 was
already committed, unlike Phase 7's own review bundles, which needed reconstruction because
Phase 7 was still uncommitted at bundling time).

No DB migration was introduced by this phase (see "Supabase changes" in the implementation
plan's own Phase 9 section) — there is therefore no `migration-summary.md` in this bundle, per
the explicit instruction not to create an empty one.

---

### `apps/web/src/server/services/repair-orders.service.ts`

- **Status**: MODIFIED
- **Category**: service
- **Purpose**: adds the Phase 9 provenance read model — `RepairOrderProvenanceContribution`/
  `RepairOrderProvenanceSourceLine`/`RepairOrderProvenanceDocument` (exported types),
  `ProvenanceDbRow` (internal DB-row shape), `mapProvenanceDocument` (mapper), the exported pure
  helper `groupProvenanceByRepairOrderLine`, and the new `RepairOrdersService.
getRepairOrderProvenance(supabase, orgId, branchId, repairOrderId)` method. Also widens the
  top-of-file type import to include `WorkshopSourceDocumentType`.
- **Exact provenance behavior affected**: read-only, no new write path. Returns the full
  document→source-line→contribution tree for one RepairOrder in one hierarchical PostgREST
  embedded-select (preceded by the same explicit org/branch parent-scope check Phase 7/8 already
  established). `quantity_contribution` is always the persisted DB value. **Cross-order leak
  found and fixed here, in two passes**: (1) because `repair_order_source_document_links` is a
  genuine M:N link and a source line's unique-ownership constraint only guarantees at most ONE
  contribution total (never that a shared document's lines all belong to one order), a naive
  fetch would leak another order's own `repair_order_line_id` inside a document shared between
  two orders — fixed with one additional small, indexed query (this order's own logical-line ids
  from `repair_order_lines`) filtering every source line's `contributions` array to only entries
  this order actually owns; (2) **external review then found pass (1) was itself incomplete** —
  it filtered only the contribution reference, but the FOREIGN SOURCE LINE ITSELF (product code/
  name/quantity/unit/`wddMatcherLineId`) still leaked through with an empty `contributions` array.
  Fixed by filtering `doc.lines` itself in `mapProvenanceDocument`: a source line with ZERO
  contributions to THIS order (never-linked, or linked only elsewhere) is now omitted from the
  tree entirely. The DOCUMENT itself is still always returned (a real, genuine
  `repair_order_source_document_links` row) even if every one of its lines gets filtered out.
- **Security/RLS impact**: no RLS policy changed. `workshop_source_documents`/
  `repair_order_source_document_links`/`workshop_source_document_lines`/
  `repair_order_line_source_links` are all unchanged Tier 1 join-derived-scope tables (Phase 2) —
  reading provenance requires exactly `workshop.repair_orders.read` on the parent RepairOrder,
  the same boundary the parent itself already enforces. Deliberately does NOT join
  `wdd_matcher_lines`/`wdd_matcher_sessions` for content (both require the separate
  `wdd_matcher.read` permission, live-verified) — only the raw `wdd_matcher_line_id` reference is
  exposed, closing off a cross-module RLS dependency rather than working around it.
- **Tests**: `repair-orders.service.test.ts`'s `RepairOrdersService.getRepairOrderProvenance`
  describe block (14 tests, listed below).

### `apps/web/src/server/services/__tests__/repair-orders.service.test.ts`

- **Status**: MODIFIED
- **Category**: unit/service test
- **Purpose**: adds `RepairOrderProvenanceDocument` type import and `groupProvenanceByRepairOrderLine`
  value import, plus a `describe("RepairOrdersService.getRepairOrderProvenance")` block —
  **14 tests** (measured directly, not hand-counted: `grep -c` over the block; was 13 before this
  correction, with 3 of the original tests replaced/rewritten and 5 new/rewritten tests taking
  their place, net +1): list mapping,
  one-order→many-documents, query-scoped-to-this-order, one-logical-line→many-source-lines
  (quantity_contribution preserved exactly), same-SKU independence when grouped by line,
  no-fabricated-Matcher-join (now using a line that genuinely belongs to this order),
  inaccessible-parent (no leak, link table never queried), empty-manual-order, and 2× error
  normalization — plus, for the metadata-leak fix: **a rewritten cross-order test** asserting the
  foreign line is entirely ABSENT (checking its SKU/product name/`wddMatcherLineId`/
  `repair_order_line_id` are absent from the serialized response, not just its contribution), a
  **new inverse test** (RepairOrder B's own provenance symmetrically excludes A's line), a
  **rewritten zero-contribution test** (now asserting omission, not "empty array, not dropped"),
  and a **new test** proving a document linked to this order with zero own-order visible lines is
  still returned. Reuses the pre-existing `makeTableQueryMock` helper.
- **Purpose Phase 9 needed it**: this phase's own stated unit/service testing requirement,
  including the mandatory M:N scenarios and both passes of the cross-order-leak regression proof.
- **Tests covering it**: itself.

### `apps/web/src/app/[locale]/dashboard/workshop/[id]/_components/repair-order-provenance.tsx`

- **Status**: NEW
- **Category**: UI/component
- **Purpose**: the "Source documents" provenance-inspection section — a client component (needs
  local expand/collapse state per document, via the existing `Collapsible` primitive) rendered
  below Phase 8's line list. Lists every linked document (type + external number + line count);
  expanding a document reveals its source lines (SKU/description/quantity) and, for each, which
  logical line it contributed to and how much (`quantity_contribution`).
- **Exact provenance behavior affected**: pure display of data already fetched server-side —
  no new data access path. Distinguishes a genuine empty-provenance state (manually-created
  RepairOrder) from a load-error state, matching the pattern Phase 8's own external review
  already established. Deliberately does NOT render Matcher session navigation (verified no
  stable route exists) and is NOT the final Phase 11 Magazyn/Zamówienia-Przyjęcia sub-view
  composition. **Metadata-leak correction**: the "Not linked to a part on this order" rendering
  branch (and its `sourceLine.unlinked` i18n key, both locales) was removed — every line the
  service now returns always has >= 1 own-order contribution, so that branch was dead code.
- **Security/RLS impact**: none — read-only display.
- **Tests**: `repair-order-provenance.test.tsx` (9 tests, listed below).

### `apps/web/src/app/[locale]/dashboard/workshop/[id]/_components/__tests__/repair-order-provenance.test.tsx`

- **Status**: NEW
- **Category**: unit/component test
- **Purpose**: **9 tests** (8 original, 1 net added for the correction) — empty state, load-error
  state (distinct from empty), one document row per document, multiple documents
  (one-order→many-documents), expand-to-reveal-source-lines (with quantity + quantity\_
  contribution), multiple source lines under one document rendered independently, no Matcher
  session navigation link — plus, replacing the removed "unlinked" test: a **defensive test**
  proving the component does not crash and does not fabricate an "unlinked" placeholder even if a
  zero-contribution line were passed directly (a state the real service no longer produces), and
  a **new test** proving the component never renders a source line absent from its own
  `documents` prop (the metadata-leak fix's own contract, verified end-to-end from service output
  shape to rendered UI).
- **Purpose Phase 9 needed it**: this phase's own stated component testing requirement, plus
  regression coverage for the metadata-leak correction.
- **Tests covering it**: itself.

### `apps/web/src/app/[locale]/dashboard/workshop/[id]/_components/repair-order-line-sources.tsx`

- **Status**: NEW
- **Category**: UI/component
- **Purpose**: the smallest useful line-level provenance affordance — a "Sources (N)" trigger
  (using the existing `Popover` primitive) added to each Phase 8 line row, opening a small
  popover listing exactly which source line(s) contributed to THIS logical line and how much.
  Accepts a small local, plain-data prop shape (`LineSourceEntry[]`) computed server-side by
  `repair-order-lines-list.tsx` — never imports anything (type or value) from
  `repair-orders.service.ts`, keeping this client component fully decoupled from that
  `server-only`-guarded module.
- **Exact provenance behavior affected**: pure display — renders nothing (`null`) when a line
  has zero sources, avoiding clutter on lines with no linked provenance.
- **Security/RLS impact**: none — read-only display of already-fetched, already-scoped data.
- **Tests**: covered via `repair-order-lines-list.test.tsx`'s new "Phase 9 per-line 'Sources (N)'
  affordance" describe block (4 tests, see below) — this component has no dedicated test file of
  its own since its rendering is exercised end-to-end through the line list that hosts it.

### `apps/web/src/app/[locale]/dashboard/workshop/[id]/_components/repair-order-lines-list.tsx`

- **Status**: MODIFIED (Phase 8 file — this is the "two small, additive, backward-compatible
  props" change referenced throughout this bundle's docs)
- **Category**: UI/component
- **Purpose**: adds an optional `provenance?: RepairOrderProvenanceDocument[]` prop (defaults to
  `[]`, fully backward-compatible — every pre-existing Phase 8 caller/test continues to work
  unchanged) and a `sourcesFor(lineId)` helper that calls `groupProvenanceByRepairOrderLine`
  server-side (this file is still a server component, so importing the runtime function from
  `repair-orders.service.ts` is normal) to compute each line's own sources, rendering a
  `<LineSourcesPopover>` beneath the product name/SKU in both the desktop table cell and the
  mobile card.
- **Exact provenance behavior affected**: purely additive rendering — no change to any Phase 8
  derived-quantity logic, column, or existing test's expected output (re-verified: all 13
  pre-existing Phase 8 tests in this file's own test suite still pass unchanged).
- **Security/RLS impact**: none — the provenance data it receives was already independently
  scoped/fetched by `getRepairOrderProvenance` before reaching this component.
- **Tests**: `repair-order-lines-list.test.tsx`'s new "Phase 9 per-line 'Sources (N)' affordance"
  describe block (4 tests, listed below).

### `apps/web/src/app/[locale]/dashboard/workshop/[id]/_components/__tests__/repair-order-lines-list.test.tsx`

- **Status**: MODIFIED
- **Category**: unit/component test
- **Purpose**: adds a `next-intl` client-hook mock (needed because `LineSourcesPopover`, now
  rendered inside this server component's tree, uses `useTranslations`) and a new "Phase 9
  per-line 'Sources (N)' affordance" describe block — 4 tests: a line with a real contribution
  renders the "Sources (N)" trigger with the correct count; a line with zero contributions
  renders no trigger at all; a contribution belonging to a DIFFERENT line does not render a
  trigger on this line (cross-line isolation, mirroring the service's own same-SKU-independence
  guarantee at the UI layer); the `provenance` prop defaults safely to no-trigger when omitted.
- **Purpose Phase 9 needed it**: regression + new-feature coverage for the line-list component's
  own additive Phase 9 change.
- **Tests covering it**: itself. All 13 pre-existing Phase 8 tests in this same file continue to
  pass unchanged (verified, not merely assumed) — 17/17 total in this file now.

### `apps/web/src/app/[locale]/dashboard/workshop/[id]/page.tsx`

- **Status**: MODIFIED (Phase 7/8 file)
- **Category**: UI/page
- **Purpose**: imports and renders the new `RepairOrderProvenance` component; adds a fifth
  parallel `Promise.all` entry calling `RepairOrdersService.getRepairOrderProvenance`; computes
  `provenanceLoadError` (mirroring the exact `linesLoadError` pattern from Phase 8's own
  external-review fix) and passes both `provenance`/`provenanceLoadError` down to
  `RepairOrderProvenance`, and `provenance` down to `RepairOrderLinesList` for its own per-line
  affordance; updates the page's own doc comment and the `detail.futurePhasesNote` copy (see the
  i18n entry below) to reflect that provenance now exists (no longer listed as "not available
  yet").
- **Exact provenance behavior affected**: wires the new read model and both new/modified
  components into the existing detail page — the only page this phase touches.
- **Security/RLS impact**: none beyond adding one more parallel, already-scoped read to a page
  that already performs several — no new client-trusted input, no permission change (same
  `workshop.repair_orders.read` gate already enforced at the top of this route).
- **Tests**: covered indirectly by `repair-order-provenance.test.tsx` and
  `repair-order-lines-list.test.tsx`'s own prop-driven tests — this page's own data-fetching
  wiring is not independently tested, matching this repo's existing convention for
  server-component pages (see the equivalent notes in the Phase 7/8 review bundles).

### `apps/web/supabase/tests/096_repair_order_provenance_phase9_test.sql`

- **Status**: NEW
- **Category**: pgTAP/DB test
- **Purpose**: 15 pgTAP assertions run live as the genuinely-RLS-enforced `authenticated` role
  (real JWT claim simulation) — one-document→many-orders (T1), one-order→many-documents (T2),
  the cross-order-leak scenario proven at the data-shape level (T3), one-logical-line→many-
  source-lines (T4), quantity_contribution exact persistence (T5/T6), a genuine ordered_quantity
  vs. summed-contribution mismatch exposed truthfully rather than normalized (T7), source-line
  unique-ownership negative case with the specific expected SQLSTATE (T8), Matcher traceability
  via the accessible id reference (T9) plus confirmation the SAME actor cannot read the target
  `wdd_matcher_lines` row's own content directly (T9b), a later-arriving document attaching to an
  existing order without creating a duplicate (T10/T11), and branch/RLS isolation for both
  RepairOrders and source documents (T12/T13). Plus one data-integrity check (T-integrity) run as
  the connecting role, independent of RLS, proving the traced id genuinely resolves to a real
  row. Uses transaction-scoped fixture rows (bypassing the materialization RPC, exactly as
  Phase 8's own same-SKU-independence test already did) wrapped in `BEGIN;...ROLLBACK;`, zero
  residual data confirmed after the run. **Not modified in substance by the metadata-leak
  correction** — that fix lives entirely in the TypeScript mapper (`mapProvenanceDocument`),
  which pgTAP (testing raw SQL/RLS/constraints directly) cannot exercise; only a stale header
  comment ("Last run: ... 13/13", left over from an earlier draft before two more assertions were
  added) was corrected to the actual `plan(15)`/15-assertion result, with a note explaining why
  the metadata-leak fix did not require re-running this file.
- **Purpose Phase 9 needed it**: this phase's own stated DB/integration testing requirement —
  verifying the actual persisted M:N/contribution/traceability behavior against real schema/RLS,
  not only mocked service output.
- **Security/RLS impact**: none (test-only) — proves the read boundary and leak-fix correctness
  the service method's own code implements.

### `docs/mvp/zones/03-repair-orders-implementation-plan.md`

- **Status**: MODIFIED
- **Category**: documentation/tracker
- **Purpose**: Phase 9's section header updated to `✅ DONE (2026-09-12)`; a new verify-first
  blockquote note documenting the two stale plan assumptions corrected (method naming; the
  `wdd_matcher_lines`/`wdd_matcher_sessions` RLS boundary) and the cross-order leak found and
  fixed; the Objective/Dependencies/Repository-areas/Supabase-changes/Implementation-tasks/
  Testing-requirements/Acceptance-criteria subsections all rewritten to reflect what was actually
  verified and built, every implementation task checked off. A short **CORRECTION** addendum
  appended to that same verify-first note recording that the first-pass fix was itself
  incomplete (contribution reference filtered, but not the foreign source line's own content) and
  pointing to the progress tracker's own dated entry for the full writeup.
- **Purpose Phase 9 needed it**: this phase's own planning record, kept current per the
  tracker-discipline instruction.

### `docs/mvp/zones/03-repair-orders-progress.md`

- **Status**: MODIFIED
- **Category**: documentation/tracker
- **Purpose**: top-of-file `Runtime status`/`Current phase`/`Pitch readiness`/`Last updated`
  updated; the mechanical task-count line (82→87 of 165); the Phase 9 row in the "Phase tracker"
  summary table (⬜ NOT STARTED, 0/6 → ✅ DONE, 5/5, with a real summary); a new detailed
  `### Phase 9` section under Phase 8's own (matching the established per-phase convention: a
  verify-first note, one `[x]` bullet per major area with Evidence/Fix/Tests sub-bullets, a
  query-architecture-chosen paragraph, a Phase-10/11-boundary paragraph, a Phase-7/8-frozen
  confirmation paragraph, a browser-verification-honestly-disclosed paragraph, a no-migration
  paragraph, and a closing status paragraph); the DEMO READY gate's "Full provenance" line
  updated from "unstarted" to built-and-tested-but-manual-UAT-outstanding; a new change-log entry
  at the end of the file. **Plus, for this correction**: a new `#### 2026-09-12 external-review
fix` subsection under Phase 9's own section (matching Phase 8's own established
  correction-subsection convention) documenting the metadata-leak gap, the fix, updated tests, and
  the updated 198/198 full-suite count; a second change-log entry at the end of the file.
- **Purpose Phase 9 needed it**: this file is the authoritative, continuously-updated execution
  log for Zone 3 — the detailed per-phase record belongs here, matching every prior phase's own
  convention.

### `apps/web/messages/en.json`

- **Status**: MODIFIED
- **Category**: i18n
- **Purpose**: updates `modules.workshop.repairOrders.detail.futurePhasesNote` (drops
  "Source-document provenance" from the "not yet available" list); adds `modules.workshop.
repairOrders.lines.sourcesButton`/`.sourcesPopoverTitle` (for the new line-level affordance);
  adds a new `modules.workshop.repairOrders.provenance` namespace (`title`, `subtitle`,
  `documentLinesCount` — ICU plural, matching this file's already-established convention —
  `emptyStateTitle`/`emptyStateSubtitle`, `errors.loadFailed`, `sourceLine.unlinked`).
- **Purpose Phase 9 needed it**: all user-facing strings for the new provenance UI, following
  this repo's established next-intl convention.

### `apps/web/messages/pl.json`

- **Status**: MODIFIED
- **Category**: i18n
- **Purpose**: the exact Polish-language mirror of the `en.json` changes above (including the
  ICU plural form's `few`/`other` cases for Polish, matching this file's own established
  convention for plural strings elsewhere).
- **Purpose Phase 9 needed it**: this repo ships both locales for every module; continues Zone
  3's own existing convention (every prior Phase 7/8 i18n key already has a Polish counterpart).

---

## Bundle validation

- **Files in `zone3-phase9.diff`**: 13 — verified via `git diff HEAD --name-status` over the
  exact same file list, one-to-one match with this manifest's 13 sections. Unchanged file SET
  from the original bundle (this is a regeneration reflecting updated CONTENT after the
  metadata-leak fix, not a scope change).
- **Diff line count**: 2,388 lines (was 2,109 before the external-review correction).
- **Diff byte size**: 151,404 bytes (~148 KB) (was 131,532 bytes).
- **Net change**: 6 modified Phase 7/8 files (2 with purely additive, backward-compatible
  changes: `repair-order-lines-list.tsx` and its own test file; `page.tsx` gained one new
  `Promise.all` entry and two new lines of JSX), 5 new files, 2 i18n files, 2 doc files.
- **Regeneration verified to include the fix**: `grep -c` for "cross-order metadata leak" /
  "ownContributions" / "docline-theirs" against the regenerated `zone3-phase9.diff` returns 12
  combined matches (> 0).
