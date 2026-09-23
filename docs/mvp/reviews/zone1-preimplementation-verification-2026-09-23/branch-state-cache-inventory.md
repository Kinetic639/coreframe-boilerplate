# Zone 1 — Systematic Branch-State/Cache Inventory, Switch-Path Trace, Unsaved-Work Check

Fresh, code-level re-verification of the 3 previously-known bugs PLUS a systematic sweep beyond them, per this task's own explicit instruction not to assume they were the full problem.

## 1. Full branch-switch path trace

```
UI (SidebarBranchSwitcher.handleBranchSelect, sidebar-branch-switcher.tsx:44-61)
  → changeBranch(branchId) server action (changeBranch.ts:22-82) — CORRECT, re-confirmed
  → persistence: user_preferences.default_branch_id + session-branch.ts sessionStorage — CORRECT, re-confirmed
  → client state update: app-store.ts:99-118 setActiveBranch() — updates Zustand synchronously
  → permission-context: permissions-sync.tsx + use-branch-permissions-query.ts — CORRECT, self-heals (query key includes branchId)
  → cache invalidation: ABSENT — no queryClient.invalidateQueries()/resetQueries() call anywhere
  → route/navigation: ABSENT — no router.push/replace/refresh, no redirect; user stays on current URL
  → server component reload: BROKEN — Next.js App Router layouts persist across client-side transitions; dashboard/layout.tsx's loadDashboardContextV2() only re-executes on hard navigation or explicit router.refresh()
  → final rendered branch data: split-brain — sidebar (Zustand) shows new branch correctly; any RSC-rendered page body or branch-agnostic-keyed React Query cache keeps showing the OLD branch's data
```

**Where it breaks, precisely**: at the missing cache-invalidation step AND the missing server-component-refresh step — both stemming from the single missing call in `SidebarBranchSwitcher.handleBranchSelect`, but affecting **two structurally different data-fetching mechanisms for two different reasons**:

- RSC-rendered pages (RepairOrder list/detail, Movement detail/edit) hold no client cache at all — they need `router.refresh()` to re-execute server-side with the new `activeBranchId`.
- Branch-agnostic-keyed React Query caches (the DataView bugs below) need either cache invalidation or (better) a `branchId` in their own key.

**Compounding finding**: movement detail/edit pages call `notFound()` when the object doesn't belong to the new branch's context (`movements/[movementId]/page.tsx:53`) — a `router.refresh()`-only fix would produce a 404, not the accepted "redirect to a safe start screen." An explicit redirect step is required, not merely a refresh-in-place.

**Recommendation (reasoned, not designed in detail — implementation is a future task)**: a **centralized fix is warranted, not per-screen ad-hoc patches**. Evidence: the identical static-key bug pattern recurred in a 4th, previously-unflagged location found this pass (see below) — a structural pattern, not a one-off, rooted in `DataViewListParams`/`use-data-view-query.ts` having no `branchId` field at all, so every caller must remember to add it manually (4 for 4 branch-scoped DataView callers have forgotten so far). Two independent fixes are needed: (a) `SidebarBranchSwitcher` should call `router.refresh()` + navigate to a safe start route (fixes every RSC-tree page in one place), and (b) a systematic `branchId`-in-every-key convention for the React Query layer (a shared helper or a `DataView`-level `branchId` prop that's automatically merged into every query key) — `router.refresh()` alone cannot fix client-mounted React Query components, since TanStack Query state is independent of the RSC tree.

## 2. Branch-scoped state/cache inventory

### Matcher

| Surface                                                                                    | File:line              | Classification                                                                                                                                                                                        |
| ------------------------------------------------------------------------------------------ | ---------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `wddMatcherKeys.sessions()`                                                                | `wdd-matcher.ts:33`    | **CONFIRMED BUG** (re-verified) — no branchId; server action is branch-scoped                                                                                                                         |
| `wddMatcherKeys.results/.extractedData/.enhancedPdfData/.materializationStatus(sessionId)` | `wdd-matcher.ts:34-40` | POTENTIAL STALE STATE — keyed by globally-unique sessionId (no cross-branch leak), but a stale-session detail view staying mounted post-switch is a symptom of the root cause, not an independent bug |

### Locations

| Surface                                                                                                        | File:line                                  | Classification                                                                               |
| -------------------------------------------------------------------------------------------------------------- | ------------------------------------------ | -------------------------------------------------------------------------------------------- |
| `locations-data-view.tsx` `queryKey={["locations"]}`                                                           | `locations-data-view.tsx:302`              | **CONFIRMED BUG** (re-verified)                                                              |
| `warehouseKeys.locationsByBranch/.locationGroupsByBranch/.layoutsByBranch/.placedLocationIds/.publishedLayout` | `hooks/queries/warehouse/index.ts:133-677` | CORRECTLY BRANCH-KEYED                                                                       |
| `warehouseKeys.location(id)` (detail)                                                                          | `hooks/queries/warehouse/index.ts:190`     | ORGANIZATION-SCOPED BY DESIGN (id-disambiguated, location permanently belongs to one branch) |
| `location-detail-panel.tsx` and dialogs                                                                        | —                                          | No own `useQuery`; inherits the parent DataView's `["locations"]` bug via props              |

### Inventory Balances

| Surface                                                                                 | File:line                              | Classification                                                                                                                                                                                                                                                                       |
| --------------------------------------------------------------------------------------- | -------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `inventory-client.tsx` `queryKey={["inventory-balances"]}`                              | `inventory-client.tsx:335`             | **CONFIRMED BUG** (re-verified)                                                                                                                                                                                                                                                      |
| `inventory-products-client.tsx` `INVENTORY_PRODUCTS_QUERY_KEY = ["inventory-products"]` | `inventory-products-client.tsx:42,324` | **CONFIRMED BUG — NEW, found this pass, not in the prior audit.** Server-side per-branch stock enrichment (`InventoryProductsService.listProducts` → `enrichProducts(..., branchId)`) means stale stock-quantity columns from the OLD branch remain cached/displayed after a switch. |

### Inventory Movements

| Surface                                                               | File:line                                  | Classification                                                                                                                                                                    |
| --------------------------------------------------------------------- | ------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `inventory-movements-client.tsx` `queryKey={["inventory-movements"]}` | `inventory-movements-client.tsx:191`       | **CONFIRMED BUG** (re-verified)                                                                                                                                                   |
| Movement detail page                                                  | `movements/[movementId]/page.tsx:25,39-53` | CORRECT VIA FULL REFRESH — currently BROKEN today (pure RSC, no client cache; a `router.refresh()` fix would fully repair it, but see the `notFound()` compounding finding above) |
| Movement edit page                                                    | same file, 27-48                           | Same as above                                                                                                                                                                     |

### RepairOrders

| Surface                                           | File:line                                                     | Classification                                                                                                                                                                                                                                  |
| ------------------------------------------------- | ------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `workshopKeys.lineReservations(branchId, lineId)` | `hooks/queries/workshop/index.ts:28-44,133-144`               | CORRECTLY BRANCH-KEYED (re-verified — the prior "Phase 10A correction" fix, complete for this one instance)                                                                                                                                     |
| `workshopKeys.advisorCandidates()`                | `hooks/queries/workshop/index.ts:30`                          | ORGANIZATION-SCOPED BY DESIGN (org-wide, no branch filter anywhere)                                                                                                                                                                             |
| RepairOrder list page                             | `dashboard/workshop/page.tsx:45,70`                           | CORRECT VIA FULL REFRESH — currently BROKEN today (pure RSC, no client cache — confirms the prior fix only ever needed to cover the ONE cached instance; everything else in this module was never a query-key bug, only an RSC-refresh problem) |
| RepairOrder detail page (header/lines/provenance) | `dashboard/workshop/[id]/page.tsx:41,60` + related components | CORRECT VIA FULL REFRESH — currently BROKEN today (same RSC pattern; only the reservations dialog uses `useQuery` at all)                                                                                                                       |

**RepairOrders verdict**: the prior Phase 10A fix is genuinely complete for its own scope — no other client-cached, branch-scoped RepairOrder query remains unfixed, because nothing else in the module is cached client-side. All remaining exposure here is attributable to the RSC-staleness root cause, not a missed query-key fix.

### Other Warehouse (Audits/count-sessions)

| Surface                                           | File:line                                         | Classification                                                                        |
| ------------------------------------------------- | ------------------------------------------------- | ------------------------------------------------------------------------------------- |
| `auditKeys.list/.reorderReport(branchId, params)` | `hooks/queries/warehouse/audits.ts:45-74,300-323` | CORRECTLY BRANCH-KEYED — explicit `branchId` param directly in the key, well-designed |
| `auditKeys.detail(id)`                            | `audits.ts:51`                                    | ORGANIZATION-SCOPED BY DESIGN (id-disambiguated)                                      |

### Help Desk

| Surface                            | File:line                                                      | Classification                                                                                                                                                                                                                                       |
| ---------------------------------- | -------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `helpdeskKeys.*`, tickets DataView | `hooks/queries/help-desk/index.ts:27-37`, `tickets-client.tsx` | ORGANIZATION-SCOPED BY DESIGN — confirmed the underlying action never passes `activeBranchId`; tickets carry an OPTIONAL `branch_id` exposed as a manual, user-selectable filter, not automatic active-branch scoping. Deliberate design, not a bug. |

### Central dashboard/layout provider

| Surface                                   | File:line                    | Classification                                                                                                                                                          |
| ----------------------------------------- | ---------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `dashboard/layout.tsx` (Server Component) | 104-173                      | **Confirmed contributor to root cause** — `loadDashboardContextV2()` only re-executes on hard nav/`router.refresh()`, not on the client-side Zustand update             |
| `_providers.tsx` (`DashboardV2Providers`) | 28-97                        | Partially correct but gated on the stale SSR `context` prop — `SidebarBranchSwitcher` bypasses this hydration path entirely via a separate, parallel direct-store-write |
| `PermissionsSync`                         | `permissions-sync.tsx:21-41` | CORRECTLY BRANCH-KEYED (re-verified) — reads `activeBranchId` live from the store, not the stale prop                                                                   |

## 3. Confirmed bug count

**Total: 6 confirmed bugs** — the 3 previously-known root-cause/file groupings (5 distinct file locations: the switcher itself + Matcher sessions + 3 DataView instances) re-verified present, **plus 1 newly discovered this pass** (`inventory-products-client.tsx`, structurally identical to the 3 known DataView bugs, found by systematically walking all 13 DataView call sites in the codebase).

## 4. Unsaved-work mechanism

**Genuinely absent as a shared/reusable mechanism.** Zero `beforeunload` listeners anywhere in `apps/web/src`. Exactly one local, non-reusable instance exists: the Warehouse Map editor's own `isDirty` `useState` flag (`map-editor.tsx`), gating only its own Save button — not wired to navigation or branch-switching at all. `react-hook-form` (which would provide `formState.isDirty` for free) is used only in auth forms, not in any warehouse/workshop transactional flow — the Movement Editor and the new-RepairOrder form both use plain per-field `useState` with zero dirty-tracking.

**Demo-path risk**: real but choreography-dependent. The Movement Editor and RepairOrder creation form are both genuine multi-field forms with zero protection — a presenter mid-edit who switches branches loses their draft silently AND (per the root-cause bug) stays on a now-stale page. **DEMO READY minimum**: if this week's rehearsed choreography never has the presenter open one of these forms and then use the branch switcher mid-edit, nothing needs to ship for this reason alone — but this depends on disciplined rehearsal, not a structural guarantee. **PILOT READY target**: a shared "is this form dirty" hook wired into the branch-switch handler (confirm-before-switch), plus ideally a generic `beforeunload` guard for hard navigation/tab-close, neither of which exist today.

## 5. Overall verdict: the 3 known bugs were symptoms of a larger systemic problem, not the full problem

Two independent lines of evidence:

1. **A 4th, structurally identical React-Query bug was found by systematic sweep** (`inventory-products-client.tsx`) — confirming the pattern recurs because the root cause is structural (no `branchId` field anywhere in `DataViewListParams`/`use-data-view-query.ts`), not a set of isolated oversights. 4 of 4 branch-scoped `DataView` callers checked have the bug; 0 have it correctly fixed.
2. **A second, entirely separate failure mode was found**: RSC-tree staleness. RepairOrder list/detail and Inventory-Movement detail/edit pages are pure Server Components with no client cache to be "wrong" about — their bug is that nothing ever calls `router.refresh()`, so the whole server-rendered subtree simply never re-executes after a client-side Zustand branch switch. **Fixing every React Query key in the app would NOT fix these pages.** This half of the problem was entirely unaddressed by the prior, narrower 3-bug audit.

**Positive counter-evidence for scope containment** (this is not an unbounded problem): CRM, Organization management, Planning, Help Desk, and QR management are all genuinely org-scoped by design (verified: their underlying server actions never reference `activeBranchId` at all) — these are correctly out of scope, not undiscovered bugs. The Warehouse Map page, `useBranchPermissionsQuery`, and `workshopKeys.lineReservations` remain confirmed-correct reference implementations proving the intended pattern works when followed. The systemic pattern is real but concentrated in exactly two mechanisms — `DataView`-based screens with server-derived branch data, and RSC pages/layouts reading `activeBranchId` without a client-triggered refresh path — both addressable by one centralized fix each, not an open-ended per-screen audit.
