# Zone 1 / Phase 2 — Test Results

Run 2026-09-24 via `pnpm vitest run <files>` from `apps/web`, plus `pnpm type-check` and `eslint` on the touched files. Updated same day by a micro-correction pass that added direct `useDataViewSidebarInfiniteQuery` coverage (the review gap identified before commit: the original suite covered `buildDataViewQueryKey` and `useDataViewListQuery` directly, but `useDataViewSidebarInfiniteQuery` — also modified in Phase 2 — had no dedicated test).

## 1. use-data-view-query.test.ts (12 tests total)

**12/12 PASS.**

`buildDataViewQueryKey` (6 tests): appends branchId when provided; produces different keys for different branchId values; produces the same key for the same branchId (stable identity); omits branchId entirely when undefined, preserving the exact base key (and returns the same array reference — no unnecessary copy); omits branchId entirely when null (identical result to undefined — deterministic); does not mutate the input base key array.

`useDataViewListQuery` (3 integration tests via `renderHook` + `QueryClientProvider`): different branchId values produce 2 distinct cache entries for otherwise-identical params; branchId is never forwarded to `listFetcher`'s request payload (asserted via `expect(listFetcher).toHaveBeenCalledWith(listParams)` and a negative `not.objectContaining({branchId: ...})` check); omitted branchId reproduces the exact pre-Phase-2 query key shape (`["tickets", listParams]`).

`useDataViewSidebarInfiniteQuery` (3 integration tests via `renderHook` + `QueryClientProvider`, added in the micro-correction pass): different branchId values produce 2 distinct infinite-query cache entries for otherwise-identical `search`/`sort`/`filters`/`pageSize` (asserted via `queryClient.getQueryData(["locations", "branch-a"/"branch-b", "sidebar", {...}])`); branchId is never forwarded to the sidebar fetcher's request payload (asserted the same way as the list query's equivalent test); omitted branchId reproduces the exact pre-Phase-2 sidebar query-key shape (`["tickets", "sidebar", {...}]`). All 3 tests deliberately use an `initialPageData` that mismatches `listParams.page`, so `useInfiniteQuery`'s own seed-from-`initialData` short-circuit (`canSeedFromInitialPage`) is skipped and a real fetch runs through `queryFn` — proving the actual integration path, not just seeded cache state. All 3 pass against the existing, unmodified Phase 2 runtime implementation — **zero runtime change was required or made.**

## 2. data-view.test.tsx (regression)

**38/38 PASS, file unmodified.** This is the existing full-component test suite for `<DataView>`, exercising an org-scoped consumer pattern (`queryKey: ["test-products"]`) end-to-end. Zero changes made to this file; zero failures — direct proof that org-scoped DataView behavior is unaffected by Phase 2's additions.

## 3. Type-check

`pnpm type-check` (whole `apps/web`) — **PASS, zero errors.**

## 4. Lint

`eslint` on both touched files (`use-data-view-query.ts`, `use-data-view-query.test.ts`) — **PASS, zero errors, zero warnings.**

## Unrelated failures

None encountered — this phase's test scope (the new foundation test + the one directly-relevant regression suite) required no unrelated test runs.

## Verdict

Zero regressions. The foundation is proven correct and backward-compatible by both direct contract tests (now covering all 3 branch-aware hooks touched in Phase 2's runtime diff, not 2 of 3) and a full untouched regression suite.
