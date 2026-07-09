# Stock Audit ("Cycle Count") — Production Implementation Plan

> Source of truth for progress. Check items off as they land. The static original plan (pre-progress-tracking, pre-hardening) lives at `/home/user/.claude/plans/ok-i-switched-to-binary-knuth.md` for historical reference — this file is the one to keep updated during implementation.

---

## Non-negotiable implementation constraints

These override any convenience shortcut, any "while I'm here" cleanup, and any ambiguity elsewhere in this document. If a future instruction during implementation seems to conflict with one of these, stop and confirm with the user rather than assuming.

1. `apps/web/temp/cycle-count` is a **UX/workflow reference only** — it defines the interaction design to preserve, not code to copy wholesale. Every line ported gets rewritten to this app's architecture.
2. Do **not** create a parallel stock-adjustment system. The only path that mutates stock is the existing movement engine (`inventory_create_draft_movement` → `inventory_post_movement`).
3. Do **not** directly `UPDATE public.inventory_balances` anywhere in new code, migrations, or RPCs.
4. All final stock corrections must go through the existing movement engine, unchanged in its own semantics.
5. Do **not** refactor unrelated warehouse modules (products, movements, locations, suppliers) beyond the one explicitly-scoped addition in §10 (default supplier field).
6. Do **not** change global theme tokens, sidebar architecture, auth architecture, QR gateway behavior, movement-engine behavior, or unrelated Supabase tables.
7. Do **not** delete `apps/web/temp/cycle-count`. It must remain available for side-by-side visual QA through the entire implementation. The user deletes it manually after final approval.
8. Preserve the mobile-first audit UX from the prototype: guided count screen, tactile counter, sticky progress header, horizontal position tracker, status icons, active-position indicator, note badge, reason modal, skipped/recount flow, review screen, final report. See §9 "No generic CRUD redesign."
9. The UI may be split into small production components and converted to Ambra design tokens, but the _flow_ must not be redesigned and must not degrade into a generic shadcn CRUD table screen.
10. Replace hardcoded structural colors with Ambra design tokens (§6).
11. Keep semantic status colors (shortage/match/surplus/recount) centralized in one mapping file — not re-declared per component.
12. Extract all user-facing copy to `messages/pl.json` and `messages/en.json` — no hardcoded strings.
13. Use SSR-first pages for route-level permission checks and initial data loading (§8).
14. Use client components only for interactive flows: wizard state, mobile counting, scanner UI, optimistic updates, reason modals, review actions.
15. Use React Query for interactive mutations and optimistic updates, but never bypass server actions/services for protected data — no direct client-side Supabase calls for audit data.
16. Use `useMemo`/`useCallback` only where there is real, demonstrable value (§2 memoization guidance below). Do not blanket-memoize trivial values.
17. Reuse the existing QR/scanner infrastructure (`qr_codes`/`qr_assignments`, `QR_TARGET_REGISTRY`, the `zxing-wasm`-based camera scanner). Do **not** implement the prototype's fake `setTimeout`-simulated scanner.
18. Supplier audit MVP uses `inventory_variants.default_supplier_id` only. Do **not** implement many-to-many supplier sourcing in this task (§10).
19. Multi-counter concurrent counting is **out of scope** unless the existing backend already safely supports it (§6).
20. Every database change must include RLS policies, permission checks, indexes, migration regression tests, and Supabase advisor verification (§7, §11).
21. Every implementation layer is **TDD-first**: failing test written first, implementation second, verification third. No exceptions for "simple" changes.

---

## Progress Tracker

### 1. Database migration(s)

- [x] 1a. `inventory_variants.default_supplier_id` column + index
- [x] 1b. `inventory_count_lines` — add `status`/`reason_code`/`source`/`sequence_no` columns + constraints + index
- [x] 1c. Document `inventory_count_sessions.scope` jsonb shape (`CountSessionScope` TS type — `src/lib/warehouse/count-session-types.ts`)
- [x] 1d. `inventory_create_count_session` rewrite (scope filter, zero-stock branch, sequence_no, permission swap)
- [x] 1e. `inventory_approve_count_session` rewrite — all-or-nothing posting gate (§5 state machine + partial-posting rules), `status='approved'` filter, preserve no-direct-UPDATE invariant, preserve inner `warehouse.inventory.adjust` check
- [x] 1f. New read RPC `inventory_count_session_list`
- [x] 1g. Permissions: `warehouse.audits.read` / `warehouse.audits.manage` (contracts constants, DB rows, role seeding, RLS policy swap, `compile_user_permissions` re-run) — MODULE.md/MODULE_CHECKLIST.md doc update still outstanding
- [x] 1h. New table `inventory_reorder_suggestion_actions` (accept/ignore decisions)
- [x] Migration regression test `inventory-audits-migration.test.ts` — 12/12 assertions green
- [x] Applied via `mcp__supabase-target__apply_migration` (name: `inventory_audits_workflow`), verified with `get_advisors` — zero new security warnings; a few expected INFO/WARN performance items documented in the implementation report (unindexed new FKs, multiple-permissive-policies from the intentional read/manage policy split)

### 2. Service layer

- [x] New `src/server/services/inventory-count-sessions.service.ts`, moved existing 3 methods in
- [x] `listSessions`
- [x] `getSessionDetail`
- [x] `createCountSession` (extended input + location-subtree expansion via `expandLocationIds`)
- [x] `updateCountLine` (status transitions per §4 state machine + validation, `isValidCountLineTransition`)
- [x] `addUnexpectedLine` (single-counter assumption documented, §6; sequence_no computed server-side)
- [x] `bulkApproveLines`
- [x] `approveCountSession` (moved; enforces all-or-nothing posting gate via the RPC, §5)
- [x] `updateSessionStatus` (added mid-implementation, not in the original plan — small necessary gap fill: a plain RLS-gated `draft→counting`/`counting→submitted` UPDATE the guided-count screen's "finish counting" action needs; `submitted→approved` remains exclusively via `approveCountSession`'s RPC, which is the only transition with real integrity rules)
- [x] `getReorderReport`
- [x] `inventory-count-sessions.service.test.ts` — 42 tests, all green (incl. T-RLS and T-BRANCH/T-ORG groups, plus 3 new `updateSessionStatus` tests)
- [x] Pure logic extracted + unit-tested: `count-session-scope.ts` (`expandLocationIds`, 8 tests), `reorder-math.ts` (`calculateSuggestedOrderQuantity`/`isBelowReorderPoint`, 6 tests), `count-line-grouping.ts` (`groupCountLines`, 8 tests), `count-session-types.ts` (`isValidCountLineTransition`, 11 tests)

### 3. Server actions & schemas

- [x] New `src/app/actions/warehouse/inventory/count-sessions.ts`
- [x] `listInventoryCountSessionsAction`, `getInventoryCountSessionAction`
- [x] `createInventoryCountSessionAction`, `updateInventoryCountLineAction` (extended)
- [x] `addUnexpectedCountLineAction`, `bulkApproveCountLinesAction`
- [x] `approveInventoryCountSessionAction` (permission swap; posting still separately enforces `warehouse.inventory.adjust` inside the RPC, not duplicated at the action layer)
- [x] `updateInventoryCountSessionStatusAction` (added mid-implementation alongside the service method above; `WAREHOUSE_AUDITS_MANAGE`-gated, `status` restricted to `"counting"|"submitted"` via `updateCountSessionStatusSchema`)
- [x] `getReorderReportAction`
- [x] Schema extensions in `schemas.ts` (`countSessionScopeSchema.strict()`, extended `updateCountLineSchema`, `addUnexpectedCountLineSchema`, `bulkApproveCountLinesSchema`, `listCountSessionsSchema`, `getReorderReportSchema`, `updateCountSessionStatusSchema`)
- [x] `count-sessions.test.ts` — 29 tests, all green (permission-deny, strict-schema rejection incl. unknown-key, happy-path + event emission, no-duplicate-adjust-check proof, plus 4 new `updateInventoryCountSessionStatusAction` tests)
- [x] `emitInventoryEvent`/`textFromRecord` relocated from `index.ts` to the shared `action-context.ts` (behavior unchanged) so both `index.ts` and `count-sessions.ts` reuse them without duplication

### 4. React Query hooks

- [x] New `src/hooks/queries/warehouse/audits.ts` + `auditKeys` factory
- [x] `useCountSessionsQuery`, `useCountSessionDetailQuery`
- [x] `useCreateCountSessionMutation`
- [x] `useUpdateCountLineMutation` (optimistic, with tested/verified rollback — 14 hook tests incl. the optimistic-patch + rollback pair)
- [x] `useAddUnexpectedLineMutation`, `useBulkApproveLinesMutation`
- [x] `useApproveCountSessionMutation`
- [x] `useUpdateCountSessionStatusMutation` (added mid-implementation alongside the action above; invalidates detail + list caches on success)
- [x] `useReorderReportQuery`
- [x] `audits.test.tsx` hook test file — 16 tests, all green (incl. 2 new `useUpdateCountSessionStatusMutation` tests)

### 5. Routes & components

- [x] `/audits` dashboard page + `audits-dashboard-client.tsx` + `audit-status-badge.tsx` — SSR gate (`WAREHOUSE_AUDITS_READ`), stat cards, searchable session list, status-aware action buttons (resume/review/report); `count-status-colors.ts` (session + line-position status derivation, matches prototype's tracker exactly) and `count-reason-codes.ts` (dynamic shortage/surplus reason ordering) also landed here since both are shared across screens; typed routing entries added to `src/i18n/routing.ts`; `CountSessionListRow`/`CountSessionDetail`/etc. types consolidated into `count-session-types.ts` (single source, service + hooks both import); 12 new tests (5 component + 7 status-derivation), pre-existing `placeholder-pages.test.tsx` updated to drop the now-real audits route (confirmed unrelated to this feature: that file also fails on a clean HEAD checkout due to a pre-existing pnpm/next-intl module-resolution issue, not something introduced here)
- [x] `/audits/new` wizard: `index.tsx` orchestrator — 4-step flow (type → scope → protocol → preview), real QR scanning via the shared scanner (not simulated), `alert()` avoided in favor of `toast.error` per §12
- [x] `wizard-step-type-branch.tsx` (branch selector dropped — this app scopes sessions to the already-active branch via global context, unlike the prototype's multi-branch demo dropdown)
- [x] `wizard-step-scope-location-tree.tsx` (inherited-selection dimming via new `isDescendantOf` helper, QR scan-to-select)
- [x] `wizard-step-scope-supplier.tsx`
- [x] `wizard-step-protocol.tsx` (blind mode forces require-reason off, matching prototype's dependent-toggle exactly)
- [x] `wizard-step-preview.tsx` — scope summary only, no live per-line count (the RPC has no dry-run mode; a real preview would need a new endpoint — flagged as a known simplification vs. the prototype's in-memory live preview, not built here)
- [x] `wizard-step-indicator.tsx`
- [x] `use-wizard-state.ts`, `use-wizard-scope-preview.ts` (local scope summary, no server round-trip), `use-wizard-submission.ts` (redirects to `/audits/[id]/count` on success) — 4 component tests (step-gating for both location and supplier paths, blind-mode dependent toggle) + `isDescendantOf` unit tests (5)
- [x] `/audits/[id]/count` guided-count: `index.tsx` orchestrator (SSR `page.tsx` gates `WAREHOUSE_AUDITS_MANAGE`, fetches session detail + ad-hoc variant/product/location/unit enrichment selects — mirrors `InventoryBalancesService`'s separate-selects-then-join pattern; redirects to `/review` or `/report` if the session is already `submitted`/`approved`/`cancelled`; auto-transitions `draft`→`counting` on mount via `updateSessionStatus`)
- [x] `count-progress-header.tsx` (sticky progress bar + location button + scan triggers)
- [x] `count-position-tracker.tsx` (horizontal scroll, auto-center active item via `scrollIntoView`, reuses `count-status-colors.ts`)
- [x] `count-item-card.tsx`, `count-tactile-counter.tsx` (large tap targets, ±1/5/10/50/100 step selector), `count-not-found-action.tsx` (also houses `CountPrimaryActions` — notes/skip/save-next)
- [x] `count-reason-modal.tsx` (reuses `count-reason-codes.ts`'s dynamic shortage/surplus ordering), `count-notes-modal.tsx` (note badge stays visible on the primary-actions row), `count-interrupt-dialog.tsx`, `count-location-jump-sheet.tsx`
- [x] `count-scan-trigger.tsx` (uses shared real `QrCameraScanner`, not a fake overlay — verifies scanned location/SKU against the current line via the same direct decode+lookup pattern as the wizard)
- [x] `use-count-session-state.ts` (sort/filter/current-index state), `count-navigation.ts` (pure sort/filter/next-unresolved/prev-unresolved/progress-stats logic, 9 unit tests), `use-count-submission.ts` (save/skip/not-found/finish-counting wired to the mutations; `variance_quantity` is never sent to the server — it's a DB-generated stored column)
- [x] Disclosed simplifications vs. the prototype: no 3-way item image view-mode toggle / fullscreen image zoom (no product-image asset wired into this feature); location display is code/name only, not a full ancestor breadcrumb; "exit without saving" simply navigates away since lines are persisted immediately on save (no client-only draft to roll back)
- [x] `index.test.tsx` — 4 component tests (SKU/name render, empty state, reason-modal gating on variance, direct save when quantity matches expected)
- [x] `/audits/[id]/review` variance review: `index.tsx` orchestrator (SSR `page.tsx` gates `WAREHOUSE_AUDITS_MANAGE`; redirects to `/count` if still `draft`/`counting`, to `/report` if already `approved`/`cancelled`)
- [x] `variance-group-section.tsx`, `variance-line-row.tsx`, `variance-bulk-approve-bar.tsx`, `variance-approve-session-button.tsx` (client-side `blocked` flag mirrors the RPC's all-or-nothing gate as a UX convenience only — the RPC itself remains the authoritative check, not duplicated/trusted blindly)
- [x] `use-variance-grouping.ts` (wraps the already-existing pure `groupCountLines` from `count-line-grouping.ts` in `useMemo`)
- [x] Shared `_lib/enrich-count-lines.server.ts` extracted (moved out of the guided-count page, now reused by both `/count` and `/review` SSR pages — single source for the variant/product/location/unit ad-hoc-select enrichment, including its disclosed simplifications)
- [x] Sidebar registration: `warehouse.audits` added to `src/lib/sidebar/v2/registry.ts` (gated `WAREHOUSE_AUDITS_READ`, icon `checkSquare`); legacy unused placeholder i18n object `modules.warehouse.items.audits.{title,overview,schedule,history}` collapsed to a single string (verified unreferenced elsewhere before removing)
- [x] Verified in production DB: `lovable639@gmail.com` (org_owner) already had `warehouse.audits.read`/`.manage` correctly compiled into `user_effective_permissions` via the `warehouse.*` wildcard — the sidebar item was simply never registered until now; permissions layer was correct all along
- [x] `/audits/[id]/report` final report: `index.tsx` orchestrator (SSR `page.tsx` gates `WAREHOUSE_AUDITS_READ`; redirects to `/count` or `/review` if not yet `approved`/`cancelled`; loads adjustment movements via `reference_type='inventory_count'`/`reference_id=<session id>` — the only documented link between a posted audit and the movements it created)
- [x] `report-kpi-tiles.tsx` (locations checked, processed/total, surplus/shortage totals — computed client-side from real enriched lines, no fabricated numbers), `report-audit-trail.tsx` (built from real `created_at`/`updated_at`/`approved_at` only, never mocked like the prototype's timeline; disclosed simplification: no dedicated `submitted_at` column exists, so `updated_at` approximates the submit event), `report-adjustments-list.tsx` (real posted movement lines, not simulated), `report-reorder-panel.tsx` (pre-filtered to the session's variant ids, links out to the full standalone report)
- [x] `index.test.tsx` — 3 component tests (count number/badge render, empty-adjustments state, empty-reorder state)
- [x] Shared `src/components/qr/qr-camera-scanner.tsx` extracted from duplicated dialogs (`onDecode` callback API + `extractQrToken`, 8 tests; the two existing dialogs left as-is, not retrofitted — see implementation report)

### 6. Design tokens & i18n

- [x] `src/lib/warehouse/count-status-colors.ts` (single source for status color classes, built during §5 guided-count work)
- [x] All ported components use `bg-background`/`bg-card`/`border-border`/`text-foreground`/`text-muted-foreground`/`bg-primary` etc. instead of hardcoded hex/orange
- [x] Status-semantic colors (red/emerald/blue/amber) kept literal per documented exception
- [x] Copy extracted to `messages/en.json` / `messages/pl.json` under `warehouseInventory.audits` (`.count`, `.review`, `.report` namespaces) and top-level `warehouseReports.reorder` for the standalone report

### 7. Reorder / low-stock report

- [x] Reorder-math pure function (`reorder_quantity` vs. fallback) extracted + tested (`src/lib/warehouse/reorder-math.ts`, 6 tests)
- [x] `getReorderReport` service method + `getReorderReportAction` + `useReorderReportQuery`
- [x] `InventoryCountSessionsService.getReorderSuggestionActions`/`setReorderSuggestionAction` (append-only accept/ignore decision log against `inventory_reorder_suggestion_actions`; "current" status = latest row per variant/location key) + `setReorderSuggestionActionAction` + `updateCountSessionStatusSchema`-sibling `setReorderSuggestionActionSchema` + `useSetReorderSuggestionActionMutation` — 4 service tests, 2 action tests, 2 hook tests
- [x] Shared `_lib/enrich-reorder-report.server.ts` (warehouse-level, not audits-level — reused by both the standalone report and the audit final-report panel) + shared `_components/reorder-suggestions-panel.tsx` display component
- [x] Standalone `/dashboard/warehouse/reports/reorder` page (`WAREHOUSE_REPORTS_READ`-gated)
- [x] Audit final-report → reorder-report deep link (pre-filtered to the session's variant ids client-side, not a new RPC filter param; "View full report" link to the unfiltered standalone page)

### 8. Product/variant edit form

- [x] "Default supplier" field added to product/variant create+edit form, wired to `default_supplier_id` — create form (simple single-variant mode + attribute-based variant table) and edit form (variant table); schema/service/action layer extended (`enhancedVariantSchema`, `updateInventoryVariantSchema`, `updateVariantDetails`, `createEnhancedProduct` follow-up UPDATE loop since the RPC payload doesn't persist it directly); 22 new/updated tests green

### 9. Sidebar & wiring

- [x] `warehouse.audits` sidebar child added to `src/lib/sidebar/v2/registry.ts`, gated on `WAREHOUSE_AUDITS_READ`
- [x] Placeholder `dashboard/warehouse/audits/page.tsx` replaced

### 10. Verification

- [x] `pnpm type-check` clean
- [x] `pnpm lint` clean (0 errors repo-wide; all warnings pre-existing, none in touched files)
- [x] All new/changed tests green — full targeted run (services, actions, hooks, sidebar, all `audits`/`reports` routes) = 911/911 passing. Full-repo `pnpm vitest run` also done: 30 pre-existing failing files (signup/org-members/QR-labels/zpl/admin-sidebar/etc.), none overlapping this feature's files — confirmed via the `rls-permission-invariants` failure diff (missing `analytics.*`/`helpdesk.*`/`planning.*`/`workshop.*`, unrelated to `warehouse.*`) and by cross-checking every failing path against the file list touched this session
- [x] RLS/permission boundary tests green, including the "audits.manage without inventory.adjust is blocked from posting" case (`approveInventoryCountSessionAction` tests + service tests)
- [ ] Manual end-to-end walkthrough: by-location audit (create → count incl. QR scan + unexpected item → review incl. blocked-posting case → post → verify movement + balance)
- [ ] Manual end-to-end walkthrough: by-supplier audit (same flow)
- [ ] Manual walkthrough: blind audit, skipped-item audit, needs-recount audit
- [ ] Reorder report reflects post-audit low-stock items
- [ ] Mobile QA pass at 360px + tablet pass (full checklist in §3)
- [ ] Light/dark + at least one alternate theme visual check
- [ ] Final side-by-side visual QA vs. `apps/web/temp/cycle-count` for all 5 screens
- [ ] Forbidden-changes review (§12) — confirm no unrelated files touched
- [ ] `apps/web/temp/cycle-count` deleted by user (not by implementation)

---

## Context

`apps/web/temp/cycle-count` is a throwaway React+Vite UI prototype (localStorage-backed, mock data, hardcoded dark-theme colors) demonstrating a mobile-first stock-audit workflow: create an audit session scoped by **location** or by **supplier**, walk through counting items with a guided mobile UI, review variances, post the corrections, and see reorder suggestions. The user wants this ported into the real `warehouse` module of this Next.js 15 + Supabase app as a production "Stock Audit" feature, then the temp folder deleted **by the user, manually, after approval** — not as part of this implementation (see constraint #7).

Critically, this repo **already has 80% of the backend for this**, entirely unused: `inventory_count_sessions` / `inventory_count_lines` tables, `inventory_create_count_session` / `inventory_approve_count_session` RPCs, and `InventoryEnterpriseService.createCountSession/updateCountLine/approveCountSession` + 3 server actions — built correctly (stock correction happens by posting real adjustment movements through the existing movement engine, never by directly `UPDATE`ing `inventory_balances`; a regression test enforces this). Nothing in the app references any of it. The placeholder route `dashboard/warehouse/audits` already exists (unwired, no sidebar entry). This plan extends that backend rather than building parallel infrastructure, and replaces the placeholder route.

Decisions already confirmed with the user (do not re-litigate):

1. Add `inventory_variants.default_supplier_id` as the source of truth for "which supplier delivers this item" (audit-by-supplier scoping) — **and build the UI field for it now**, on the existing product/variant edit form, since supplier audits are unusable without it. MVP only — see §10.
2. Add new granular permissions `warehouse.audits.read` / `warehouse.audits.manage`, replacing the `warehouse.inventory.adjust`/`.read` gate on the count tables/RPCs.
3. **Separation of duties**: `warehouse.audits.manage` covers creating/counting/reviewing an audit. The final "post to stock" step still additionally requires `warehouse.inventory.adjust` — confirmed necessary because `inventory_create_draft_movement`/`inventory_post_movement` (called by `inventory_approve_count_session`) are `SECURITY INVOKER` and independently check `has_branch_permission(..., 'warehouse.inventory.adjust')` for adjustment-kind movements. This is not optional — verified by reading both RPC bodies in `20260506090000_inventory_phase2_enterprise_core.sql`.
4. Scanning: this app already has a real, working scan system (`qr_codes`/`qr_assignments` tables + `QR_TARGET_REGISTRY` in `src/server/qr/target-registry.ts` + the `/qr/[token]` gateway route + a camera-decode component using `zxing-wasm`, currently duplicated in two dialogs). Reuse it — do not build the prototype's fake/simulated scanner.

---

## 1. Database migration(s)

One primary migration: `supabase-target/supabase/migrations/<next-timestamp>_inventory_audits_workflow.sql` (check `mcp__supabase-target__list_migrations` for the true latest timestamp before naming it). Contents:

**a. `inventory_variants.default_supplier_id`**

```sql
ALTER TABLE public.inventory_variants
  ADD COLUMN IF NOT EXISTS default_supplier_id uuid NULL
    REFERENCES public.inventory_suppliers(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS inventory_variants_default_supplier_idx
  ON public.inventory_variants (organization_id, default_supplier_id)
  WHERE default_supplier_id IS NOT NULL;
```

**b. `inventory_count_lines` — add workflow columns**

```sql
ALTER TABLE public.inventory_count_lines
  ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'pending',
  ADD COLUMN IF NOT EXISTS reason_code text NULL,
  ADD COLUMN IF NOT EXISTS source text NOT NULL DEFAULT 'generated',
  ADD COLUMN IF NOT EXISTS sequence_no integer NULL;

ALTER TABLE public.inventory_count_lines
  ADD CONSTRAINT inventory_count_lines_status_check
    CHECK (status IN ('pending','counted','skipped','needs_recount','approved')),
  ADD CONSTRAINT inventory_count_lines_source_check
    CHECK (source IN ('generated','unexpected_found'));

CREATE INDEX IF NOT EXISTS inventory_count_lines_status_idx
  ON public.inventory_count_lines (count_session_id, status);
```

`reason_code` stays free-text (no DB check constraint) — the taxonomy (damaged/placement_error/theft/supplier_shortage/unexpected_surplus, differently ordered for shortage vs surplus) lives in a new app-layer constant `src/lib/warehouse/count-reason-codes.ts` so it can be localized/extended without a migration. Status semantics are defined precisely in §4 and must be enforced at the DB layer per §5, not only in UI.

**c. `inventory_count_sessions.scope` jsonb — no new columns, documented shape**
Keep all wizard config (count_type, location_ids, include_children, supplier_id, location_filter_ids, include_zero_stock, show_expected_quantity, require_reason_for_variance) inside the existing `scope jsonb` column. Justification: these are always read together with the session row, never filtered on individually in SQL, and `scope jsonb` is already the established RPC contract — avoids a migration every time the wizard grows a toggle. Document the canonical shape as a TS type `CountSessionScope` in `src/lib/warehouse/count-session-types.ts`, validated at the zod layer (not DB CHECK). This is a **closed, exhaustive** list of keys — no `allow_partial_posting` or any other undocumented key exists in the type or the schema (see §3: the zod schema is `.strict()`).

**d. `inventory_create_count_session` — `CREATE OR REPLACE`, rewritten filter + zero-stock branch + sequence_no**

- Set `status='pending'`, `source='generated'`, `sequence_no` (via `row_number() OVER (ORDER BY location_id, variant_id)`) on insert.
- Filter predicate uses `scope->>'count_type'`: for `'location'`, match `b.location_id = ANY(scope->'location_ids')` — **location subtree expansion happens in TypeScript before calling the RPC** (using `buildLocationTree` from `src/lib/warehouse/location-tree.ts`), not in SQL, so `location_ids` passed to the RPC is always the final expanded list. For `'supplier'`, match `v.default_supplier_id = (scope->>'supplier_id')::uuid`, optionally further filtered by `scope->'location_filter_ids'` if present. See §10 for the supplier-scoping MVP boundary.
- Add a second `INSERT ... SELECT` branch, only when `scope->>'include_zero_stock' = 'true'`, that inserts catalog variants matching the scope with no existing balance row (`expected_quantity = 0`), guarded by `NOT EXISTS` against the first branch's rows to avoid violating `inventory_count_lines_natural_uidx`.
- Change the permission check from `warehouse.inventory.adjust` to `warehouse.audits.manage`.

**e. `inventory_approve_count_session` — `CREATE OR REPLACE` — enforces the all-or-nothing posting gate (see §5 for full rule set)**

- Keep its existing internal `warehouse.inventory.adjust` check as-is (do not remove — per decision #3, posting still requires it) but this call now happens _in addition to_ the caller already having passed `warehouse.audits.manage` at the action layer.
- Add pre-loop guards (`RAISE EXCEPTION` on violation, all must pass before any movement is created):
  - Reject if any line has `status = 'pending'`. Always — there is no escape hatch, toggle, or scope flag that bypasses this in MVP.
  - Reject if any line has `status = 'needs_recount'`.
  - Reject if any line has `status = 'counted' AND variance_quantity <> 0` (a counted variance line that was never explicitly approved in review).
  - Reject if any line has `status = 'approved' AND variance_quantity <> 0 AND reason_code IS NULL` when the session's `scope->>'require_reason_for_variance'` is `true`.
- Only include lines with `status = 'approved'` (in addition to existing `variance_quantity <> 0`) in the increase/decrease arrays sent to the movement engine. `skipped` lines are excluded entirely and must never contribute to increase/decrease arrays.
- Do **not** touch the balance-mutation path (still exclusively via `inventory_create_draft_movement` → `inventory_post_movement`) — preserve the existing "no direct UPDATE on inventory_balances" invariant.

**f. New read RPC: `inventory_count_session_list`**
`SECURITY INVOKER`, returns session rows plus aggregated `total_lines`/`counted_lines`/`variance_lines` per session in one round trip (avoids N+1 in the dashboard list). Gated on `warehouse.audits.read`. Backed by the index from §1b so the aggregation doesn't full-scan.

**g. Permissions**

- `packages/contracts/src/permissions.ts`: add `WAREHOUSE_AUDITS_READ = "warehouse.audits.read"`, `WAREHOUSE_AUDITS_MANAGE = "warehouse.audits.manage"` alongside the other `warehouse.*` slugs (~line 123), add to the permission union type (~line 306) and export list (~line 412). Re-export via `src/lib/constants/permissions.ts`.
- Migration inserts both into `permissions` table (mirror `20260401120000_warehouse_locations.sql`'s pattern for `warehouse.locations.manage`), seeds `role_permissions`: `warehouse.audits.read` to whatever roles currently have `warehouse.inventory.read`; `warehouse.audits.manage` to whatever roles have `warehouse.inventory.adjust` (inspect current seed data before writing — do not assume). `org_owner`'s `warehouse.*` wildcard already covers both automatically.
- `DROP POLICY IF EXISTS` + recreate `inventory_count_sessions_select/adjust` and `inventory_count_lines_select/adjust` using `has_branch_permission(..., 'warehouse.audits.read')` / `'warehouse.audits.manage'`.
- Re-run the `compile_user_permissions` loop for all active org members at the end of the migration (same tail-block pattern as existing migrations).
- Update `src/modules/warehouse/MODULE.md` / `MODULE_CHECKLIST.md` with the two new slugs, following the existing prose pattern for `warehouse.locations.*`.

**h. New small table for reorder accept/ignore decisions** (see §7): `inventory_reorder_suggestion_actions (id, organization_id, branch_id, variant_id, location_id nullable, status 'accepted'|'ignored', actor_user_id, created_at, count_session_id nullable FK)`, RLS gated on `warehouse.audits.read`/`.manage` (or `warehouse.reports.read` for select — decide during implementation based on which permission the reorder report page ultimately uses).

**Regression test**: `src/server/services/__tests__/inventory-audits-migration.test.ts` (mirrors `inventory-phase3-migrations.test.ts`) — full assertion list in §11.

Apply via `mcp__supabase-target__apply_migration`, verify with `mcp__supabase-target__get_advisors` for RLS gaps and slow-query risk before moving on. Do not proceed to §2 until this gate is clean (§13).

---

## 2. Service layer

New dedicated file `src/server/services/inventory-count-sessions.service.ts` (class `InventoryCountSessionsService`) — **move** the 3 existing methods (`createCountSession`, `updateCountLine`, `approveCountSession`) out of `inventory-enterprise.service.ts` here (only the 3 existing actions call them — low-risk import-path move), plus add:

- `listSessions(supabase, orgId, branchId, params)` → calls the new `inventory_count_session_list` RPC.
- `getSessionDetail(supabase, orgId, sessionId)` → session row + lines ordered by `sequence_no`.
- `createCountSession(...)` — extended input (`count_type`, `location_ids` pre-expansion, `supplier_id`, `location_filter_ids`, `include_zero_stock`, `show_expected_quantity`, `require_reason_for_variance`, `notes`); location-subtree expansion happens here via a new pure helper (see §5, testable independent of Supabase).
- `updateCountLine(...)` — writes `status`/`reason_code` per the state machine in §4; validates `reason_code` is present when `status='approved'` and `variance_quantity <> 0` and the session requires it; rejects invalid transitions (e.g. `approved` → `pending` directly) at the service layer, not just relying on the DB check.
- `addUnexpectedLine(supabase, sessionId, input)` — plain insert, `source='unexpected_found'`, `status='counted'`, `expected_quantity=0`, `sequence_no = max(sequence_no)+1`, computed server-side inside the service (never trust a client-supplied sequence number). Single-counter assumption applies — see §6.
- `bulkApproveLines(supabase, lineIds, actorUserId)` — supports "approve all," rejects lines missing a required `reason_code`, never touches `skipped`/`needs_recount`/`pending` lines.
- `approveCountSession(...)` — moved; the all-or-nothing gate in §1e/§5 is enforced by the RPC, but the service should surface the RPC's rejection reason cleanly to the action layer (do not swallow/generalize the error).
- `getReorderReport(supabase, orgId, branchId, params?)` — see §7.

Test file `src/server/services/__tests__/inventory-count-sessions.service.test.ts`, mirroring `warehouse-locations.service.test.ts`'s structure — full assertion list in §11.

---

## 3. Server actions & schemas

File `src/app/actions/warehouse/inventory/count-sessions.ts` (split out of the already-3000+-line `index.ts`, importing `requireWarehouseContext`/`hasPermission`/`requireActiveBranch`/`userIdFrom` from the existing `action-context.ts`). All checks swap from `WAREHOUSE_INVENTORY_ADJUST` to `WAREHOUSE_AUDITS_READ` (reads) / `WAREHOUSE_AUDITS_MANAGE` (writes):

- `listInventoryCountSessionsAction`, `getInventoryCountSessionAction` — new, `WAREHOUSE_AUDITS_READ`.
- `createInventoryCountSessionAction`, `updateInventoryCountLineAction` — extended schemas, `WAREHOUSE_AUDITS_MANAGE`.
- `addUnexpectedCountLineAction`, `bulkApproveCountLinesAction` — new, `WAREHOUSE_AUDITS_MANAGE`.
- `approveInventoryCountSessionAction` — unchanged shape, permission swapped to `WAREHOUSE_AUDITS_MANAGE` (the RPC itself still separately enforces `warehouse.inventory.adjust` per decision #3 — do not add that check redundantly at the action layer, let the RPC be the enforcement point so the error surfaces clearly if a user lacks it).
- `getReorderReportAction` — new, gated on `WAREHOUSE_REPORTS_READ` (existing constant).

Schema extensions in `src/app/actions/warehouse/inventory/schemas.ts`: replace `createCountSessionSchema`'s `scope: z.record(unknown)` with a fully-typed `countSessionScopeSchema` (`count_type` enum, conditional `location_ids`/`supplier_id` via `.refine()`), extend `updateCountLineSchema` with `status`/`reason_code`, add `addUnexpectedCountLineSchema`, `bulkApproveCountLinesSchema`, `listCountSessionsSchema`. (This is a breaking change to the currently-unused schema — acceptable, nothing in prod calls it yet.) `countSessionScopeSchema` must be built with `z.object({...}).strict()` so any unknown key (including a future `allow_partial_posting` or similar) is rejected at validation time rather than silently passed through to the RPC — add a schema test asserting an unknown key causes `safeParse` to fail.

Test file `src/app/actions/warehouse/inventory/__tests__/count-sessions.test.ts`, mirroring `locations.test.ts` — full assertion list in §11.

---

## 4. Audit line state machine

`inventory_count_lines.status` is the single source of truth for line state. No status is inferable from other columns alone — always use `status`, never re-derive it from `counted_quantity IS NULL` the way the old unused RPC implicitly did.

| Status                              | Meaning                                                                                                                                              | Blocks posting?                                                        | Movement-eligible?                                                                                 |
| ----------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------- |
| `pending`                           | Line generated by the session (or added as an unexpected find) but not yet counted.                                                                  | **Yes, always.**                                                       | No.                                                                                                |
| `counted`, `variance_quantity = 0`  | User entered a counted quantity that exactly matches the expected quantity. This is a **resolved, exact match** — nothing further is required of it. | **No.** Does not block posting and does not need to become `approved`. | No movement needed — there's no variance to post.                                                  |
| `counted`, `variance_quantity <> 0` | User entered a counted quantity that differs from expected. **Unresolved** until reviewed.                                                           | **Yes**, until moved to `approved`.                                    | Not yet — only after becoming `approved`.                                                          |
| `skipped`                           | User intentionally skipped the line. Terminal, resolved state.                                                                                       | **No.**                                                                | Never — must not create movements under any circumstance.                                          |
| `needs_recount`                     | User flagged the line for a second physical count.                                                                                                   | **Yes, always**, until moved to `counted`/`skipped`.                   | No.                                                                                                |
| `approved`                          | A `counted` line with nonzero variance that was reviewed and explicitly approved. If the session requires reasons, `reason_code` must be non-null.   | No (this is the resolved state for variance lines).                    | **Yes** — only `approved` lines with nonzero variance generate increase/decrease movement entries. |

Note the important distinction: **not every `counted` line needs to become `approved`.** An exact-match count (`variance_quantity = 0`) is already fully resolved the moment it's counted — review/approval is only a gate for lines that have a discrepancy to reconcile. Treating every counted line as needing explicit approval would be incorrect and would make ordinary exact counts unnecessarily block posting.

Valid transitions: `pending → counted`, `pending → skipped`, `counted → needs_recount`, `counted → approved` (only meaningful for `variance_quantity <> 0` — approving a zero-variance line is a no-op the UI shouldn't even offer), `needs_recount → counted`, `needs_recount → skipped`. Enforce these both in `updateCountLine`'s service-layer logic and rely on the DB CHECK constraint (§1b) as the outer boundary — the CHECK only validates the enum, not the transition graph, so the transition rules live in TypeScript and must be unit-tested (§11).

---

## 5. Final-posting rules (all-or-nothing, MVP decision)

**Decision: for MVP, final posting is all-or-nothing.** A session either posts completely or not at all — there is no partial posting of "the lines that are ready" while leaving others open.

Concretely, `inventory_approve_count_session` (and the action/service wrapping it) must reject posting when:

- Any line has `status = 'pending'` (nothing counts as "reviewed" while lines are unresolved).
- Any line has `status = 'needs_recount'`.
- Any line has `status = 'counted'` **with nonzero variance** — i.e. a discrepancy that was counted but never explicitly approved in review. A `counted` line with `variance_quantity = 0` is already resolved and does **not** block posting (see §4) — do not write the guard as "any status='counted' line blocks posting," that would incorrectly reject exact-match counts that were never meant to go through approval.
- Any line has `status = 'approved'` with nonzero variance and a missing `reason_code`, when the session's `require_reason_for_variance` is `true`.

And must guarantee when it does post:

- `skipped` lines never create movements (they're excluded from both the rejection checks above — skipped is a resolved state — and from the increase/decrease arrays).
- `counted` lines with zero variance never create movements either (there's nothing to adjust) and are not required to become `approved` first.
- Only `approved` lines with nonzero variance create adjustment movement entries.

This is enforced primarily in the RPC (§1e) so it cannot be bypassed by a client that skips UI validation — the UI's "post" button being disabled is a UX convenience, not the enforcement boundary. If this rule set turns out to conflict with any existing backend behavior discovered during implementation (e.g. an existing caller of `inventory_approve_count_session` that relies on the current, looser behavior), **stop and document the conflict** rather than silently loosening the rule; propose the smallest safe adjustment to the user before proceeding.

Partial posting does **not exist in this MVP at all** — not in the RPC, not in the scope schema, not as a hidden or forward-compatibility flag. There is no `allow_partial_posting` key anywhere: not in `CountSessionScope`, not in `countSessionScopeSchema` (which must be `.strict()` and reject unknown keys — see §1c/§3), not in the RPC's guard logic. Partial posting is a distinct future feature that would require its own explicit user approval, UI design (which lines to post vs. hold back), schema and action changes, migration and RPC changes, new tests, and a full review cycle before any implementation — it must not be pre-built, stubbed, or left as a "documented escape hatch" in this work.

---

## 6. Multi-counter concurrency (out of scope, single-counter assumption)

**Product decision for MVP: a count session is operated by a single active counter at a time.** Multi-counter collaborative counting (two people counting different locations in the same session simultaneously) is explicitly out of scope for this implementation.

Implementation notes:

- Document this assumption directly in a comment on `InventoryCountSessionsService` and in this plan (here).
- Do **not** build real-time collaboration: no presence indicators, no locking, no CRDTs, no websockets/Realtime subscriptions, no assignment-to-user workflow for count lines.
- Before adding anything for concurrency, check whether `inventory_count_sessions`/`inventory_count_lines` already has a usable field (e.g. `created_by`/`counted_by`) that's sufficient — it does (`counted_by` on lines, `created_by`/`approved_by` on sessions) — and do not add a new owner/assignee column unless a genuine, specific requirement surfaces during implementation that these existing columns can't satisfy.
- `addUnexpectedLine`'s `sequence_no = max(sequence_no)+1` computation must be done **server-side inside the service method**, never trust a client-supplied value, and must be covered by a test asserting it's computed from the current DB state, not passed through. The small race window (two near-simultaneous unexpected-line inserts computing the same max+1) is an accepted, documented limitation under the single-counter assumption — do not add advisory locks or `SELECT ... FOR UPDATE` for this unless the existing codebase already has a lightweight established pattern for it (check `inventory_create_draft_movement`'s use of `FOR UPDATE` on `inventory_movement_headers` as a reference — if a similarly cheap `FOR UPDATE` on the session row is trivial to add during implementation of `addUnexpectedLine`, prefer that over leaving the race open; if it requires new locking infrastructure, don't build it).

---

## 7. RLS & Supabase security requirements

Every migration and service/action change touching audit data must satisfy all of the following before being considered done:

- **Existing tables** (`inventory_count_sessions`, `inventory_count_lines`, `inventory_variants`): preserve their existing RLS posture exactly as-is except for the one explicitly-scoped change in this plan — swapping `inventory_count_sessions`/`inventory_count_lines`' SELECT/write policies from `warehouse.inventory.read`/`.adjust` to `warehouse.audits.read`/`.manage` (§1g). Do **not** touch `ENABLE ROW LEVEL SECURITY` / `FORCE ROW LEVEL SECURITY` state on any existing table, and do not alter `inventory_variants`' RLS policies or forced/enabled state at all — adding the `default_supplier_id` column (§1a) is a plain `ALTER TABLE ... ADD COLUMN`, it does not touch that table's RLS in any way.
- **New tables** (`inventory_reorder_suggestion_actions`): must have RLS **enabled and forced** from creation, matching the existing pattern (`ENABLE ROW LEVEL SECURITY` + `FORCE ROW LEVEL SECURITY`), with policies scoped per §1h.
- RLS policies use exactly `warehouse.audits.read`, `warehouse.audits.manage`, and (inside the RPC only, not as a table-level RLS policy) the existing `warehouse.inventory.adjust` — no new permission slugs invented beyond what's specified in this plan.
- Read access (`warehouse.audits.read`) and manage access (`warehouse.audits.manage`) are enforced by **separate** policies — never collapse them into one `ALL` policy gated on the weaker permission.
- Final posting must still require `warehouse.inventory.adjust` through the movement-RPC path (§1e, decision #3) — a user with only `warehouse.audits.manage` can create/count/review but is blocked at posting. This exact boundary must have a passing test (§11) that proves both directions: allowed to count without `inventory.adjust`, blocked from posting without it.
- All policies are both branch-scoped and organization-scoped (`has_branch_permission(org_id, branch_id, slug)`, never a bare `has_permission` on tables that have a `branch_id` column).
- Indexes must support the actual RLS predicates and the dashboard/review query patterns (`count_session_id, status`, `organization_id, branch_id`, the new `default_supplier_id` partial index) — verify with `EXPLAIN` during development if a query looks like it could full-scan.
- Run `mcp__supabase-target__get_advisors` after applying the migration and again after any later migration in this feature (§1h's table); zero new warnings introduced.
- Watch for accidental recursive RLS lookups (a policy on table A calling a function that itself queries table A under RLS) — none of the planned policies should do this since they all resolve through `has_branch_permission`, which does not touch the audit tables, but verify this holds once the policies are actually written.

Add this checklist to the verification section (§ Verification, already reflected in the tracker).

---

## 8. SSR-first / client boundary

- Every route under `dashboard/warehouse/audits/**` and `dashboard/warehouse/reports/reorder` is a **Server Component by default** (`page.tsx`).
- Server pages perform the permission check (`loadDashboardContextV2()` → `checkPermission(...)` → redirect to `/dashboard/access-denied?reason=...` on failure) and the initial data load (via the service, not the client hooks) before anything renders.
- Client components (`_components/*-client.tsx`, wizard/guided-count/review/report orchestrators) receive **typed initial data as props** from the server page — they do not independently re-fetch on mount to get data they were already given.
- React Query is used for interactive mutations, optimistic updates, refetching after a mutation, and mobile-workflow responsiveness (the tactile counter, review approvals) — not for the initial page load.
- Protected audit data must never be fetched via a client-side `createClient()` Supabase call. All reads/writes go through server actions.
- Server actions and services remain the only protected mutation/read boundary — no exceptions for "just this one quick lookup."
- Client state (wizard step, active count-line index, local form fields, modal open/closed) stays local to the client component tree and workflow-specific — it does not leak into a global store.

Apply this identically across dashboard, wizard, guided-count, review, and report routes (§5's route tree).

---

## 9. No generic CRUD redesign

**Do not turn the audit experience into a generic table-first CRUD screen.** The production version must keep, unmodified in spirit:

- dashboard overview (stat cards + session list);
- audit creation wizard (4 steps: type/branch, scope, protocol, preview);
- location/supplier scope selection (tree picker with include-children, or supplier picker with optional location filter);
- protocol configuration (blind mode, zero-stock inclusion, require-reason toggle);
- preview before starting;
- guided mobile count screen (one line at a time, tactile counter, quick-set buttons);
- position-by-position horizontal tracker with status icons and active-item indicator;
- note badge on lines with notes;
- reason modal gated on variance;
- skipped / needs-recount handling with dedicated navigation (jump to next unresolved);
- variance review grouped by result type (shortages/surpluses/needs-recount/skipped/matches);
- final report (KPI tiles, real audit trail, adjustments list, reorder panel);
- reorder report link.

Existing Ambra primitives (`Badge`, `Dialog`, `DataView` for the session list only, shadcn form controls) may be used for chrome and consistency, but never at the cost of collapsing the guided, position-by-position mobile counting flow into a flat editable table. If a specific screen (e.g. the dashboard list) benefits from `DataView`, that's fine — the _counting workflow itself_ (wizard, guided-count, review) must not be.

---

## 10. Supplier audit MVP boundary

Confirmed decision: `inventory_variants.default_supplier_id` is the sole source of truth for "which supplier delivers this item," for this feature, for now.

- This is explicitly MVP behavior, not the final supplier-sourcing model.
- Do **not** introduce many-to-many supplier sourcing (no `inventory_variant_suppliers` join table, no per-location supplier overrides) in this task.
- Do **not** try to infer supplier from historical purchase-order or receiving-movement history — only the explicit `default_supplier_id` field counts, unless a many-to-many model already exists elsewhere in the schema (it doesn't, per prior research) and is explicitly reused rather than newly built.
- Supplier-scoped audits include exactly the variants whose `default_supplier_id` matches the selected supplier.
- An optional location filter (`scope.location_filter_ids`) may further narrow a supplier audit to specific locations — this is a filter on top of the supplier match, not an alternate scoping mechanism.
- The product/variant create+edit form must expose the default-supplier field as part of this implementation (§ Progress Tracker item 8) — supplier audits are not usable without it, and this was confirmed in scope by the user.

---

## 11. Test plan (TDD — write tests alongside each layer, not after)

### Migration tests (`inventory-audits-migration.test.ts`, reads raw migration SQL)

- New audit permission slugs (`warehouse.audits.read`, `warehouse.audits.manage`) are inserted into `permissions`.
- RLS policies on `inventory_count_sessions`/`inventory_count_lines` reference the new audit slugs, not `warehouse.inventory.adjust`/`.read`.
- `inventory_approve_count_session` body does not contain `UPDATE public.inventory_balances`.
- `inventory_approve_count_session` body still calls `inventory_create_draft_movement`/`inventory_post_movement` (final posting stays on the movement-engine path).
- `inventory_count_lines` has `status`/`reason_code`/`source`/`sequence_no` columns with the expected CHECK constraints.
- `inventory_variants.default_supplier_id` FK to `inventory_suppliers` exists.
- Expected indexes exist (`inventory_count_lines_status_idx`, `inventory_variants_default_supplier_idx`, etc.) for the dashboard/review query patterns.

### Service/action tests

- Create session scoped by location.
- Create session scoped by supplier.
- Location scope with `include_children` expansion (nested tree).
- `include_zero_stock` branch includes catalog items with no balance row.
- Blind mode (`show_expected_quantity=false`) — expected quantity hidden from returned data where applicable.
- `require_reason_for_variance` mode on and off.
- Update counted quantity → `status='counted'`.
- Mark line `skipped`.
- Mark line `needs_recount`.
- Add unexpected line (`source='unexpected_found'`, correct sequence assignment computed server-side).
- Approve a variance line (`status='approved'`, reason required if configured).
- Reject approve-without-reason when `require_reason_for_variance=true` and variance is nonzero.
- Reject `createCountSessionSchema`/`countSessionScopeSchema` input containing an unknown key (e.g. a hypothetical `allow_partial_posting`) — proves `.strict()` is actually wired up, not just documented.
- Reject final post while any line is `pending` (no partial-posting escape hatch exercised).
- Reject final post while any line is `needs_recount`.
- Reject final post while any counted variance line is unapproved.
- Reject final post while an approved variance line is missing `reason_code` when required.
- Confirm `skipped` lines are excluded from posting and never appear in the movement increase/decrease arrays.
- Block final posting when the acting user has `warehouse.audits.manage` but **not** `warehouse.inventory.adjust` — must fail at the RPC layer with a clear permission error.
- Allow create/count/review (everything except final posting) when the user has `warehouse.audits.manage` only.
- Branch isolation: a session/line from branch A is not visible/actionable when scoped to branch B.
- Organization isolation: same, across orgs.
- RLS-denial simulation tests (42501) for select/insert/update on both count tables.

### Component tests

- Wizard step navigation blocks "Next" until required scope selected; `count_type=supplier` requires `supplier_id`, `count_type=location` requires at least one location.
- Guided counter increment/decrement respects the selected step size (1/5/10/50/100).
- Quick-set quantity actions (set to expected, set to zero) work.
- "Not found" action sets quantity to zero with a fixed reason.
- Reason modal opens only when there's a variance and `require_reason_for_variance=true`; blocks save until a reason is chosen.
- Note badge appears once a note is entered and persists across navigation to other lines.
- Position tracker highlights the active item and auto-scrolls it into view; status icons reflect line status correctly.
- Variance grouping (`use-variance-grouping.ts`) correctly buckets shortages/surpluses/matches/needs-recount/skipped; zero-variance lines excluded from variance groups; unexpected-found lines always grouped as surplus.
- Bulk "approve all" skips lines missing a required reason and reports how many were skipped, matching prototype behavior.
- Final "post" button is disabled/blocked exactly per the §5 rule set (pending lines present, needs-recount present, unapproved variance present, missing required reason) and enabled only when all are satisfied.
- Mobile-layout smoke test where practical (e.g. verifying sticky header doesn't overlay content, position tracker container has horizontal-scroll classes) — full manual pass is still required per §3, this is a lightweight automated backstop only.

### Manual E2E tests

- Full by-location audit, start to finish.
- Full by-supplier audit, start to finish.
- Blind audit (expected quantity hidden).
- Audit with an unexpected-found item added mid-count.
- Audit with a skipped item — confirm it never posts a movement.
- Audit with a needs-recount item — confirm posting is blocked until resolved.
- Blocked-posting case exercised deliberately (leave a line unresolved, confirm the UI and the server both reject posting with a clear reason).
- Successful final posting — confirm the session moves to the posted state.
- Movement-record verification: a real `inventory_movement_headers`/`inventory_movement_lines` row exists with `reference_type='inventory_count'`, `reference_id=<session id>`.
- Balance verification: `inventory_balances.on_hand_quantity` reflects the posted correction.
- Reorder report verification: an item pushed below its reorder point by the audit shows up in the low-stock report afterward.
- Light/dark theme verification on at least the guided-count and review screens.
- Mobile/tablet visual QA — full checklist in §3.
- Side-by-side comparison against the live prototype (`apps/web/temp/cycle-count`) for all 5 screens.

---

## 12. Forbidden changes

The following are **forbidden unless explicitly approved by the user in-conversation**, even if they would seem like a natural improvement while working on adjacent code:

- Introducing a new state manager (Redux, Jotai, Recoil, etc.) — this app already uses Zustand + React Query; do not add another.
- Introducing a new UI library or component kit alongside shadcn/Ambra primitives.
- Changing global app theme tokens (`globals.css`, `color-themes.ts`) to accommodate this feature — if a needed color genuinely doesn't exist, use a literal Tailwind palette class per §6's documented exception, don't add a new global token.
- Changing movement-engine semantics (`inventory_create_draft_movement`, `inventory_post_movement`, or any other existing movement RPC) beyond what's already explicitly specified in this plan (nothing — the movement engine itself is untouched; only `inventory_count_sessions`/`inventory_count_lines`-adjacent RPCs change).
- Changing QR token/gateway semantics (`resolvePublicQrToken`, `QR_TARGET_REGISTRY`'s existing entries, `qr_codes`/`qr_assignments` schema) — only _additive_ use of the existing scanner-decode component is in scope; the gateway itself is untouched.
- Changing unrelated inventory-movement screens (`/dashboard/warehouse/inventory/movements/**`).
- Changing unrelated product/location behavior beyond the one explicitly-scoped default-supplier field addition (§10).
- Changing unrelated RLS policies on tables not touched by this plan.
- Adding many-to-many supplier sourcing (§10).
- Adding real-time collaboration of any kind (§6).
- Adding AI/Gemini features carried over from the prototype's dependencies (`@google/genai`) — not part of this feature at all.
- Keeping/reintroducing unused prototype dependencies (`@google/genai`, `express`, `dotenv`, `motion`) anywhere in the production app — none of these get added to `apps/web/package.json`.
- Using `alert()` / `confirm()` in production UI — use the app's existing dialog/toast primitives (shadcn `Dialog`, `react-toastify`) instead, matching how the prototype's `alert()`/`confirm()` calls must be replaced, not ported.
- Using fake `setTimeout`-simulated scanner flows — real scanner only (§17 of the constraints list, §5 of the routes section).
- Adding `localStorage` persistence for production audit state — all state is server-backed.
- Creating direct client-side Supabase writes for audit mutations — server actions only (§8).

---

## 13. Design-token conversion (visual output must stay pixel-for-pixel)

Apply mechanically across every ported file:

| Prototype (hardcoded)                                                              | Production (token-based)                                                                     | Why                                                                                                                                                                                                                                                                                        |
| ---------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `bg-[#0A0A0C]` (page bg)                                                           | `bg-background`                                                                              | structural                                                                                                                                                                                                                                                                                 |
| dark panel bg (`#111113` etc.)                                                     | `bg-card`                                                                                    | structural                                                                                                                                                                                                                                                                                 |
| `border-[#1A1A1A]` / `border-[#2A2A2A]`                                            | `border-border`                                                                              | structural                                                                                                                                                                                                                                                                                 |
| `text-white`                                                                       | `text-foreground`                                                                            | structural                                                                                                                                                                                                                                                                                 |
| `text-gray-400/500` (secondary copy)                                               | `text-muted-foreground`                                                                      | structural                                                                                                                                                                                                                                                                                 |
| `bg-orange-500/600`, `text-orange-500`, `border-orange-500` (brand/primary accent) | `bg-primary`/`text-primary`/`border-primary` (+ `text-primary-foreground` on filled buttons) | This app's `--primary` token is itself `hsl(40 96% 48%)` (amber/orange) in both light and dark — near-zero perceptible change, now theme-aware                                                                                                                                             |
| destructive/cancel actions                                                         | `bg-destructive`/`text-destructive`                                                          | actual destructive actions only                                                                                                                                                                                                                                                            |
| shortage/match/surplus/recount **status** colors (red/emerald/blue/amber)          | keep literal `text-red-500`, `text-emerald-500`, `text-blue-500`, `text-amber-500`           | Confirmed no `--success`/`--warning`/`--info` token exists anywhere in `globals.css` — this matches how the codebase's own existing movement-status badges already handle status semantics (literal Tailwind palette, not tokens). Not a gap, an intentional match to existing convention. |
| spacing/radius/shadows                                                             | unchanged                                                                                    | not part of the token system                                                                                                                                                                                                                                                               |

Define the status-color mapping exactly once in `src/lib/warehouse/count-status-colors.ts` (`COUNT_LINE_STATUS_COLOR_CLASSES: Record<CountLineStatus, {text, bg, border}>`), imported everywhere it's needed (position tracker, variance groups, item cards) instead of re-declared per component.

**i18n**: port all inline copy through `useTranslations("warehouseInventory.audits")` into `messages/en.json`/`messages/pl.json`, following the `warehouseInventory.movementEditor` precedent — required, not optional, since hardcoded strings would violate this app's established `next-intl` convention everywhere else. Do this per-component as each is built, not as one giant extraction pass at the end.

---

## 14. Memoization guidance (no fake optimization)

Performance in this feature comes primarily from **correct SSR boundaries, small components, query-key discipline, optimistic mutations, proper database indexes, and avoiding unnecessary client state** — not from wrapping everything in `useMemo`/`useCallback`. Memoize deliberately, with a reason, not reflexively.

**Good candidates** (real, measurable cost or real referential-identity requirement):

- Variance grouping over potentially hundreds of count lines (`use-variance-grouping.ts`).
- Location-tree filtering and subtree expansion (wizard scope step, `count-session-scope` helper).
- Position-tracker stats (counts per status, progress percentage) recomputed on every line change.
- Unresolved-line navigation (next/prev unresolved index lookup).
- Reorder-suggestion math (rounding/fallback calculation, run over potentially many variants).
- Callbacks passed into memoized child components where identity stability actually prevents a re-render cascade (e.g. a callback passed to `React.memo`-wrapped position-tracker items).
- Scanner decode handlers and tactile-counter increment/decrement handlers, where re-renders during rapid taps would visibly hurt UX.
- Optimistic-update boundaries in the React Query mutation hooks (stable query keys, stable `onMutate`/`onError` references).

**Bad candidates** (do not memoize these — the memoization itself costs more than the computation, or there's no referential-identity payoff):

- Simple booleans (`isValid`, `hasNote`, `isSelected`).
- Simple className string concatenation.
- One-line label/date formatting.
- Local callbacks that are not passed to a memoized child and are cheap to recreate every render.
- Any value that is cheaper to recompute inline than to diff a dependency array for.

When in doubt, check how `movement-positions-tab.tsx` or `inventory-movements-client.tsx` in this codebase actually use `useMemo`/`useCallback` before adding one — match that granularity, don't exceed it.

---

## 15. Mobile-first acceptance criteria

This feature is used on mobile/tablet ~99% of the time. Mobile UX is a **hard requirement**, not a design preference, and is part of the definition of done for every guided-count/review/wizard screen.

- Must work correctly at 360px viewport width (no horizontal overflow, no clipped controls).
- The sticky progress header must never cover interactive content beneath it (verify actual rendered offset, not just visually similar spacing).
- The primary bottom CTA (save/next, post) must be thumb-reachable — bottom-anchored, not requiring a scroll to reach on a typical phone screen.
- The horizontal position tracker must scroll and auto-center the active item on navigation (matches prototype's `scrollIntoView` behavior).
- Status icons in the position tracker must stay legibly sized and distinguishable at mobile scale.
- The note badge must remain visible on small screens without crowding the SKU/name text.
- Tactile counter buttons (+/-) must be large enough for fast, low-error warehouse use (finger-sized targets, not compact icon buttons).
- The ± step-size control must be easy to tap and clearly show the current step.
- Modals/sheets (reason modal, notes modal, interrupt dialog, location-jump sheet) must fit the mobile viewport without requiring awkward internal scrolling for their primary controls.
- The QR scanner UI must work correctly inside the mobile layout (camera view sized appropriately, not clipped by surrounding chrome).
- No interaction may depend on `:hover` only — every action must have a tap-equivalent affordance.
- The full count flow (open line → count → save → next) must be usable one-handed.
- Tablet layout may use the extra width (e.g. wider cards, side-by-side panels where it clearly helps) but must not become a desktop-first redesign — the guided, one-line-at-a-time workflow stays intact at tablet width too.

These checks are added to the Verification section and to §11's manual E2E list; each UI route also gets a mobile check as part of its build-sequence gate (§16).

---

## 16. Build sequence (with gates)

1. **Migration + RLS + permission seeding** (§1) — sequential internally, must land first. Apply via `mcp__supabase-target__apply_migration`, check `get_advisors`.
   - **Gate**: migration regression test green; advisors show zero new warnings; no RLS policy regressions on pre-existing tables. Do not proceed past this gate with any red state.
2. In parallel: permission constants (§1g's TS side); `InventoryCountSessionsService` + its tests (§2, can start once schema is final).
3. Server actions + schemas + tests (§3) — depends on 2.
   - **Gate**: permission tests green (including the `audits.manage`-without-`inventory.adjust` posting-blocked case); branch/org isolation tests green.
4. React Query hooks (§4) — depends on 3.
   - **Gate**: optimistic-update behavior tested (rollback-on-error) or, at minimum, manually verified against a real mutation failure before building UI on top of it.
5. Pure logic utils + tests (location-tree expansion, variance grouping, reorder math) — independent of 2–4, start early, de-risks the trickiest logic first.
6. Extract shared `qr-camera-scanner.tsx` (§5's scanning integration) — independent, can happen any time before step 9/10 need it.
7. Product/variant edit form: add "Default supplier" field wired to `default_supplier_id` — independent, needed before supplier-scoped audits are testable end-to-end.
8. Dashboard/list screen (`/audits`) — depends on 3+4.
   - **Gate** (applies to every UI route from here on): visual comparison against the equivalent prototype screen; mobile-width check at 360px; light/dark token check.
9. Wizard (`/audits/new`) — depends on 4, 5, 6, 7. Same per-route gate as step 8.
10. Guided-count screen — depends on 4, 5, 6. Can build in parallel with 9 once 4/5/6 are stable. Same per-route gate.
11. Variance review screen — depends on 4, 5. Can build in parallel with 10. Same per-route gate.
12. Final report + standalone reorder report (§7, including the small `inventory_reorder_suggestion_actions` table — fold into the step-1 migration if not yet applied, otherwise a fast-follow migration) — depends on 10+11 being functionally complete. Same per-route gate.
13. Sidebar registration (`src/lib/sidebar/v2/registry.ts` — add a `warehouse.audits` child under the `warehouse` group, gated on `WAREHOUSE_AUDITS_READ`) + i18n messages — threaded through continuously per-component, not deferred to the end.
14. **Final gate before considering the feature complete**: full test suite green; `pnpm type-check` clean; `pnpm lint` clean; full mobile QA pass (§15); light/dark + at least one alternate theme check; side-by-side QA against the prototype for all 5 screens; forbidden-changes review (§12) confirming no unrelated files were touched (`git diff --stat` reviewed against the expected file list below). Only after this gate passes does the user manually delete `apps/web/temp/cycle-count`.

---

## Verification

- After the migration: `mcp__supabase-target__get_advisors` (security/RLS) shows no new issues on the touched tables; `inventory-audits-migration.test.ts` passes with the full assertion list from §11.
- `pnpm type-check` and `pnpm lint` clean after each layer.
- `pnpm vitest run` (or the project's test command) green for all new/changed test files listed in §11, including the negative-permission tests (prove `warehouse.audits.read/manage` actually gate access, and that a `warehouse.audits.manage`-only user is correctly blocked from the final posting step without `warehouse.inventory.adjust`, per decision #3).
- RLS boundary re-verified per §7's checklist, not just "tests pass" — actually check the policy SQL matches the intended read/manage split.
- Manual: run the dev server, walk both audit flows end-to-end (by-location and by-supplier) as a real user — create → count (including scanning a real location QR label and an "unexpected item found" line) → review (including a blocked-posting case with an unapproved variance line, a needs-recount line, and a pending line) → post → verify a real `inventory_movement_headers`/`lines` row was created with `reference_type='inventory_count'` and `inventory_balances` reflects the correction → check the reorder report picks up the newly-low item.
- Full mobile-first QA pass per §15, on an actual 360px viewport (device or emulator), plus a tablet-width pass.
- Light/dark theme check, plus at least one alternate selectable theme, on the guided-count and review screens.
- Final side-by-side comparison against `apps/web/temp/cycle-count` for each of the 5 screens before considering the port complete.
- Forbidden-changes review (§12): confirm the diff touches only the files listed under "Expected files to modify" below, plus the new files this plan creates — no unrelated warehouse/product/movement/theme/sidebar-architecture edits.
- `apps/web/temp/cycle-count` is still present and untouched — confirm it was not deleted or modified during implementation.
