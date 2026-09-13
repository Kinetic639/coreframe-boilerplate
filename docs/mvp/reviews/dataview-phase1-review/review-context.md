# DataView Phase 1 external review context

## Review scope and baseline

- Branch: `codex/frontend-polish`.
- Baseline and current `HEAD`: `be2bf1ca88e1292e5d3825c53dd040394c506679`.
- Phase 1 remains an uncommitted working-tree change.
- The patch contains 67 implementation files: 56 modified and 11 added. Review-bundle files are excluded.
- Phase 2 work is excluded. No database migration is present.

The previously accepted Phase 1 architecture remains in place: the dashboard owns the QueryClient, server routes prefetch and dehydrate canonical queries, the browser hydrates those same queries, stale time remains 60 seconds, URL parsing remains shared, `selected` remains the semantic detail authority, and existing loading/error/empty/history/page-recovery/column-default behavior remains unchanged.

## External-review corrections

### 1. Explicit, domain-agnostic cache scope

The final genericity/API refinement makes `DataViewScope` an opaque, primitive-only record:

```ts
type DataViewScopePrimitive = string | number | boolean | null;
type DataViewScope = Readonly<Record<string, DataViewScopePrimitive>>;
```

DataView core treats this object only as part of TanStack Query identity. It contains no organization or branch vocabulary, accepts no functions, Dates, or class instances at the type boundary, and can be extended by consumers without editing DataView. A regression uses `{ projectId, workspaceId }` and proves that changing either value changes list query identity.

Ambra-specific convenience constructors now live outside core in `apps/web/src/lib/data-view/ambra-data-view-scope.ts`. `dataViewScope.global()`, `.organization(id)`, and `.branch(orgId, branchId)` return the exact object values used before this refinement, preserving all existing cache isolation and consumer behavior. The same scope is required by `DataView`, list/detail/sidebar hooks, server prefetch helpers, and mutation invalidation helpers. Initial fallback data is bound to the scope present at mount, preventing a later scope from rendering the former scope's fallback.

Canonical families now have these shapes:

```ts
["data-view", entity][("data-view", entity, "scope")][("data-view", entity, "scope", scope)][
  ("data-view", entity, "scope", scope, "list", normalizedParams)
][("data-view", entity, "scope", scope, "sidebar", sidebarParams)][
  ("data-view", entity, "scope", scope, "detail", selectedId)
];
```

`invalidateDataViewList`, `invalidateDataViewDetail`, and `invalidateDataViewEntity` operate on one explicit scope. `invalidateDataViewEntityAllScopes` is the deliberate entity-wide helper. Help Desk accept/close invalidates only the ticket's organization scope.

### Consumer scope audit

| Scope        | Current consumers                                                                                                                                                   | Fetch dependency evidence                                                                                                    |
| ------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------- |
| Global       | DataView demo                                                                                                                                                       | In-memory mock data has no tenant input.                                                                                     |
| Organization | CRM contacts, CRM parties, Help Desk ticket types, Help Desk tickets, organization branches/invitations/members/positions/roles, planning tasks, QR management/tool | Server services/actions or in-memory server snapshots depend on `activeOrgId`/`orgId`, not the active branch.                |
| Branch       | Products, inventory balances, inventory movements, warehouse locations                                                                                              | Fetches depend on organization plus active branch, explicitly in services or implicitly through branch-aware server actions. |

Products and Help Desk server prefetch, dehydrated state, browser list/detail/sidebar queries, and mutation invalidation use the same scope objects and key factory.

### 2. Products compound selection

The bug was confirmed: the client normalized `productId::variantId`, while the server passed the compound string to `getProductDetail`. `getInventoryProductIdFromSelection` is now the shared Products-domain translator used by both paths. The server-specific `prefetchInventoryProductDetail` adapter calls the domain fetch with the product ID while `prefetchDataViewDetail` caches the response under the complete compound selected ID.

The regression constructs a direct compound selection, asserts that the server fetch receives `product-1`, checks the cache under `product-1::variant-9`, dehydrates and hydrates it, renders the selected detail, and proves the client fetcher was not called.

### 3. Sidebar freshness after mutation

The bug was confirmed: replacing only the current page in an invalidated `InfiniteData` value cleared invalidation while retaining adjacent pages from the old snapshot.

`invalidateDataViewList` marks the scoped sidebar invalid before refetching the list. When the exact fresh list page arrives, `synchronizeDataViewSidebarPage` checks the pre-update invalidation state. An invalidated sidebar is rebuilt as `{ pages: [freshPage], pageParams: [freshPage.page] }`; adjacent pages are discarded and fetch again when requested. An ordinary non-mutation synchronization replaces only the matching page and preserves valid adjacent pages. This follows TanStack Query's documented reset-to-one-page cache pattern and performs immutable updates.

The regression starts with pages 1 and 2, invalidates, synchronizes fresh page 1, proves old page 2 is absent, then uses `InfiniteQueryObserver.fetchNextPage()` and proves page 2 is fetched again. A second test proves ordinary synchronization retains page 2.

## SSR and hydration lifecycle

```text
server route
  -> parse normalized URL state
  -> derive explicit DataViewScope from actual fetch inputs
  -> prefetch list and optional detail with (entity, scope, params/id)
  -> dehydrate request QueryClient
  -> HydrationBoundary
  -> client DataView reads identical scoped keys
```

List/detail stale time remains 60 seconds. A successful prefetch hydrates as fresh without an immediate duplicate client request. A failed list prefetch still provides timestamp-zero fallback data so the browser retries. Detail not-found remains successful `null`; transport/service failures remain query errors.

## Verification evidence

- Scope/key/sidebar/SSR focused set: 18 tests passed across 4 files.
- Complete DataView suite: 65 tests passed across 4 files, including the non-Ambra `{ projectId, workspaceId }` key regression.
- Products regression: 25 tests passed across 3 files, including service, server-action, and compound SSR hydration coverage.
- Help Desk regression: 22 tests passed across 2 files, including scoped mutation invalidation and service behavior.
- TypeScript: `pnpm type-check` passed.
- Changed-file ESLint: passed with zero errors and 13 existing warnings in Phase 1 consumer files.
- Patch whitespace: `git diff --check` passed.
- Production build: Next.js 16.1.7 compiled and generated 188 static pages successfully.
- Authenticated Products browser smoke: heading/table visible, 51 table rows including header, “Showing 1–50 of 169 results”, selection opened detail, zero list/detail errors.
- Authenticated Help Desk browser smoke: heading/table visible, 27 rows including header, “Showing 1–26 of 26 results”, selected detail opened with 26 sidebar rows, zero list/detail errors.
- The repository Products Playwright spec was invoked but both tests were skipped by its fixture guard. Direct authenticated Playwright CLI verification supplied the browser evidence above.
- The branch selector exposed multiple branches, but an alternate selection did not persist in the current dev session. Browser branch-isolation is therefore not claimed; the hydration integration test proves Branch A cache is never returned for the identical Branch B query and that Branch B fetches independently.

## Bundle integrity

- Implementation paths in `changed-files.md`: 67.
- Unique paths in `dataview-phase1.diff`: 67.
- Patch size: 4,037 lines and 170,801 bytes.
- Manifest and diff path sets match exactly.
- Patch applicability is checked against a detached worktree at the baseline commit.

## Phase boundary

No container queries, tablet detail replacement, mobile cards/full-screen detail redesign, Back control, focus restoration, toolbar reflow, or nested-scroll cleanup was added. Those remain Phase 2.
