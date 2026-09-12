# Zone 3 Phase 8 — Changed File Manifest

Scope: **only** "Phase 8 — Logical RepairOrder lines." 10 files, all captured verbatim in
`zone3-phase8.diff`.

Baseline: `HEAD` (commit `78bfe6c1`, "Zone 3 Phase 7: header/advisor/lifecycle/manual creation +
two correction passes") — the exact repository state after Phase 7's final narrow correction
pass and before any Phase 8 work. No reconstruction was needed: `git status` before Phase 8 work
began showed a fully clean working tree at this exact commit (verified — see
`review-context.md`'s "Baseline" section).

**This is a regenerated bundle** (superseding an earlier version of this same bundle that
predated the post-review `loadError` correction below). The diff is `HEAD` → the CURRENT working
tree, which now includes both the original Phase 8 implementation and that correction — nothing
in this bundle is sourced from the earlier, now-stale bundle content.

No DB migration was introduced by this phase (see "Supabase changes" in the implementation
plan's own Phase 8 section) — there is therefore no `migration-summary.md` in this bundle, per
the explicit instruction not to create an empty one.

---

### `apps/web/src/server/services/repair-orders.service.ts`

- **Status**: MODIFIED
- **Category**: service
- **What changed**: adds `RepairOrderLineReadModel` (exported type), `RepairOrderLineMovementLinkDbRow`/`RepairOrderLineDbRow` (internal DB-row shapes), `mapRepairOrderLine` (mapper), and the new `RepairOrdersService.listRepairOrderLines(supabase, orgId, branchId, repairOrderId)` method. Also widens the top-of-file type import to include `RepairOrderLineStatus`.
- **Why Phase 8 needed it**: the canonical read model and its single service method, per this phase's explicit scope.
- **Business/security behavior affected**: read-only — no new write path. Scoped identically to `getByIdForWorkshop`'s own established convention (explicit org+branch pre-check on the parent `repair_orders` row, never trusting client-supplied org/branch, not relying on RLS alone); an inaccessible/wrong-org/wrong-branch/soft-deleted parent yields an empty list, never an error, never an existence leak. All derived quantities (`receivedQuantity`/`issuedQuantity`/`outstandingToReceive`/`availableForIssue`) are computed strictly by `repair_order_line_id`, never by SKU/`product_code` — the method's own doc comment states this rule explicitly and the reasoning behind it. Errors normalized via the existing `normalizeRepairOrderCrudError` convention (no raw DB error ever reaches the caller).
- **Tests**: `repair-orders.service.test.ts`'s new `RepairOrdersService.listRepairOrderLines` describe block (12 tests, listed below).

### `apps/web/src/server/services/__tests__/repair-orders.service.test.ts`

- **Status**: MODIFIED
- **Category**: unit/service test
- **What changed**: adds a `RepairOrderLineReadModel` type import, and a new `describe("RepairOrdersService.listRepairOrderLines")` block — 12 tests: list mapping, "not grouped by source document" (asserts the SELECT string never references `workshop_source_document`), same-SKU independence, the worked example, one-line-many-receipt-links, one-line-many-issue-links, zero-links, reversal-exclusion, branch isolation (org+branch `.eq()` calls on the parent check), parent-not-accessible (lines table never queried), and two error-normalization tests (parent-check error, lines-query error). Reuses the pre-existing `makeTableQueryMock` helper (already established for `getMaterializationStatusForSession`'s own two-sequential-`.from()`-calls shape) — no new test infrastructure needed.
- **Why Phase 8 needed it**: this phase's own stated unit/service testing requirement, including the two mandatory acceptance tests (same-SKU independence; one-line-many-movement-links).
- **Tests covering it**: itself.

### `apps/web/src/app/[locale]/dashboard/workshop/[id]/_components/repair-order-lines-list.tsx`

- **Status**: NEW
- **Category**: UI/component
- **What changed**: the logical RepairOrderLine list — a plain async server component (no client hook/action, since this is pure read-only display with zero interactivity, unlike Phase 7's header editor). Desktop table (SKU, Part/Description, Ordered, Received, Outstanding, Available, Unit) + mobile stacked cards, following the existing Workshop list page's own established `hidden md:block` / `md:hidden` responsive pattern exactly. Renders a real empty state when a RepairOrder has zero lines; renders `"—"` for a null SKU/unit; deliberately does NOT render a source-document column or a status indicator (see `review-context.md` §B and §J for why). **Post-review correction included**: `Props` now also declares `loadError?: boolean` (default `false`); the component renders a THREE-way branch — `loadError` → a compact, section-local destructive-bordered box calling `t("errors.loadFailed")` → `lines.length === 0` → the real empty state → otherwise the populated table/cards — so a failed read can no longer render identically to a genuinely empty order.
- **Why Phase 8 needed it**: the line-list UI, per this phase's explicit scope. The `loadError` branch was added after external review found the original two-way (empty-or-populated) branching collapsed "query failed" and "confirmed zero lines" into the same UI — a factually misleading conflation.
- **Business/security behavior affected**: none beyond display — reads only the `RepairOrderLineReadModel[]` already fetched server-side by the detail page; no new data access path of its own. The error branch renders only the already-normalized, translated `errors.loadFailed` string — never a raw DB error.
- **Tests**: `repair-order-lines-list.test.tsx` (**13 tests**, listed below).

### `apps/web/src/app/[locale]/dashboard/workshop/[id]/_components/__tests__/repair-order-lines-list.test.tsx`

- **Status**: NEW
- **Category**: unit/component test
- **What changed**: **13 tests total.** The original 8: empty state (no fake/demo lines ever rendered), basic row rendering, derived-quantity column values, same-SKU lines render as two separate rows with independent quantities (never a merged "5"), null-SKU renders `"—"` rather than a fabricated value, no source-document column, no raw `status` rendered as an indicator, and both desktop+mobile representations render for the same data. Plus **5 new post-review tests** in a `describe("loadError state...")` block: (1) a successful empty result (`loadError: false`, `lines: []`) renders the real empty state, not the error state; (2) a failed read (`loadError: true`) renders the load-error state with the translated `"Failed to load parts lines"` message; (3) a failed read does NOT also render the empty-state message (the two states are proven mutually exclusive, never conflated); (4) a normal populated result (`loadError: false`, real lines) renders unchanged, not the error state; (5) `loadError` omitted defaults to non-error behavior (backward-compatible prop). Follows the existing `warehouse/page.test.tsx` convention for testing an async server component that uses `next-intl/server`'s `getTranslations` (mock the module, `await Component(props)`, then `render()` the resolved element).
- **Why Phase 8 needed it**: this phase's own stated component testing requirement; the 5 new tests are the required coverage for the post-review correction (proving the four states named in that review: success+empty, success+lines, error, and the error/empty mutual exclusion).
- **Tests covering it**: itself. **13/13 passing.**

### `apps/web/src/app/[locale]/dashboard/workshop/[id]/page.tsx`

- **Status**: MODIFIED
- **Category**: UI/page
- **What changed**: imports and renders the new `RepairOrderLinesList` component, adds a fourth parallel `Promise.all` entry calling `RepairOrdersService.listRepairOrderLines`, and updates the page's own doc comment plus the `detail.futurePhasesNote` copy (see the i18n entry below) to reflect that lines now exist (no longer listed as "not available yet"). **Post-review correction included**: computes `const linesLoadError = !linesResult.success;` and passes it through as `<RepairOrderLinesList lines={lines} loadError={linesLoadError} />` — only this boolean crosses into the UI; the underlying (already-normalized) error string never does. A failed lines read does NOT fail the rest of the page — `orderResult`/`advisorCandidatesResult`/`ownAdvisorResult` are independent `Promise.all` entries, so the header renders normally regardless of whether the lines read succeeded.
- **Why Phase 8 needed it**: wires the new read model and component into the existing detail page — the only page this phase touches. The `linesLoadError` computation was added post-review, for the same reason as the component's own `loadError` branch above.
- **Business/security behavior affected**: none beyond adding one more parallel, already-scoped read to a page that already performs several — no new client-trusted input, no permission change (uses the same `workshop.repair_orders.read` gate already enforced at the top of this page for the whole route).
- **Tests**: covered indirectly by `repair-order-lines-list.test.tsx` (the component's own prop-driven tests, including the 5 new `loadError`-focused ones) — this page's own data-fetching wiring (the `!linesResult.success` computation itself) is not independently unit-tested, matching this repo's existing convention for server-component pages (see the equivalent note for Phase 7's own page changes in the earlier Phase 7 review bundles).

### `apps/web/messages/en.json`

- **Status**: MODIFIED
- **Category**: i18n
- **What changed**: updates `modules.workshop.repairOrders.detail.futurePhasesNote` (drops "Parts lines" from the "not yet available" list); adds a new `modules.workshop.repairOrders.lines` namespace (`title`, `subtitle`, `columns.*` for the 7 rendered columns, `emptyStateTitle`/`emptyStateSubtitle`, `errors.loadFailed`). `errors.loadFailed` was defined from the start of this phase but was unused by any code path until the post-review correction — it now backs the component's new error branch.
- **Why Phase 8 needed it**: all user-facing strings for the new line-list UI, following this repo's established next-intl convention (no hardcoded UI copy).
- **Tests**: the component tests supply their own translation mock (per the established `getTranslations` mock pattern) rather than depending on the real message file content — this file's own correctness (valid JSON, keys present) is implicitly verified by every component test that renders successfully.

### `apps/web/messages/pl.json`

- **Status**: MODIFIED
- **Category**: i18n
- **What changed**: the exact Polish-language mirror of the `en.json` changes above.
- **Why Phase 8 needed it**: this repo ships both locales for every module; Zone 3's own existing convention (every prior Phase 7 i18n key already has a Polish counterpart) is continued here, not newly established.

### `apps/web/supabase/tests/095_repair_order_lines_phase8_test.sql`

- **Status**: NEW
- **Category**: pgTAP/DB test
- **What changed**: 11 pgTAP assertions run live as the genuinely-RLS-enforced `authenticated` role (real JWT claim simulation) — same-SKU independence (2 real persisted `repair_order_lines` rows sharing a `product_code`, proven fully independent), the worked example (ordered=5, receipts 2+2+1=5, issues 2+1=3 → outstandingToReceive=0/availableForIssue=2) computed via a raw SQL aggregation mirroring the service's own logic, one-line-many-receipt-links, one-line-many-issue-links, zero-links-aggregates-to-0-not-NULL, a `'reversal'`-typed row not netting against the receipt sum, and branch isolation (a RepairOrder — and its lines — in a branch the actor has no permission for is completely invisible). Uses transaction-scoped fixture `repair_order_line_movement_links` rows (Phase 10 does not exist yet to create these through a real receiving/issuing flow — explicitly anticipated by this phase's own scope boundary) wrapped in `BEGIN;...ROLLBACK;`, zero residual data confirmed after the run.
- **Why Phase 8 needed it**: this phase's own stated DB/integration testing requirement — verifying the actual persisted movement-link aggregation against real schema/RLS, not only mocked service output.
- **Security/business behavior affected**: none (test-only) — proves the read boundary and aggregation correctness that the service method's own code implements.

### `docs/mvp/zones/03-repair-orders-implementation-plan.md`

- **Status**: MODIFIED
- **Category**: documentation/tracker
- **What changed**: Phase 8's section header updated to `✅ DONE (2026-09-12)`; a new verify-first blockquote note documenting every stale/underspecified assumption found and corrected in the plan's own original Phase 8 text (identity model, the ambiguous `remaining_quantity` formula, the `status` column, the read-model architecture, reversal semantics); the Objective/Dependencies/Repository-areas/Supabase-changes/Implementation-tasks/Testing-requirements/Acceptance-criteria subsections all rewritten to reflect what was actually verified and built, with every implementation task checked off.
- **Why Phase 8 needed it**: this phase's own planning record, kept current per the tracker-discipline instruction.

### `docs/mvp/zones/03-repair-orders-progress.md`

- **Status**: MODIFIED
- **Category**: documentation/tracker
- **What changed**: top-of-file `Runtime status`/`Current phase`/`Pitch readiness`/`Last updated` updated; the mechanical task-count line (76→82 of 165); the Phase 8 row in the "Phase tracker" summary table (⬜ NOT STARTED, 0/7 → ✅ DONE, 6/6, with a real summary); a new detailed `### Phase 8` section under Phase 7's own (matching the established per-phase convention: a verify-first note, one `[x]` bullet per major area with Evidence/Fix/Tests sub-bullets, a query-architecture-chosen paragraph, a Phase-10-boundary paragraph, a Phase-7-frozen confirmation paragraph, a browser-verification-honestly-disclosed paragraph, a no-migration paragraph, and a closing status paragraph); the DEMO READY gate's "Logical order lines" line updated from "unstarted" to built-and-tested-but-manual-UAT-outstanding; two change-log entries at the end of the file (the original Phase 8 build, and the post-review `loadError` correction). **Post-review addition**: a `#### 2026-09-12 external-review fix` subsection under Phase 8's own section, documenting the original bug (query failure indistinguishable from a confirmed-empty order), the fix, the 5 new tests, and the updated **13/13** / **171/171** counts (superseding this section's own earlier **166/166**, which is no longer current).
- **Why Phase 8 needed it**: this file is the authoritative, continuously-updated execution log for Zone 3 — the detailed per-phase record belongs here, matching every prior phase's own convention, including its corrections.

---

## Bundle validation

- **Files in `zone3-phase8.diff`**: 10 — verified via `git diff HEAD --name-status` over the exact same file list, one-to-one match with this manifest's 10 sections. Unchanged file SET from the original bundle (this is a regeneration reflecting updated CONTENT, not a scope change).
- **Diff line count**: 1,581 lines (was 1,493 before the post-review correction).
- **Diff byte size**: 111,045 bytes (~108 KB) (was 102,712 bytes).
- **Net change**: larger than the original bundle by the `loadError` correction's own diff (the three-way render branch, the `linesLoadError` computation/prop-pass, and the 5 new tests).
- **Regeneration verified to include the correction**: `grep -c "loadError"` / `"linesLoadError"` / `"errors.loadFailed"` against the regenerated `zone3-phase8.diff` return 18 / 4 / 5 matches respectively (all > 0).
