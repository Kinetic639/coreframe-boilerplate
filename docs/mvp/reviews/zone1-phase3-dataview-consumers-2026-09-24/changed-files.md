# Zone 1 / Phase 3 — Changed Files

## Generic DataView plumbing (runtime)

1. `apps/web/src/lib/data-view/types.ts` — added `branchId?: string | null` to `DataViewProps`.
2. `apps/web/src/components/data-view/data-view.tsx` — forwards `branchId` to `DataViewProvider`.
3. `apps/web/src/components/data-view/data-view-provider.tsx` — threads `branchId` into `useDataViewListQuery` and `useDataViewSidebarInfiniteQuery`.

## Generic DataView plumbing (tests)

4. `apps/web/src/components/data-view/__tests__/data-view.test.tsx` — added a new `T-DV-BRANCH` describe block (4 tests); all 38 pre-existing tests unmodified.

## Consumer files (runtime)

5. `apps/web/src/app/[locale]/dashboard/warehouse/locations/_components/locations-data-view.tsx` — reads live `activeBranchId`, passes `branchId` to `<DataView>`.
6. `apps/web/src/app/[locale]/dashboard/warehouse/inventory/_components/inventory-client.tsx` — same.
7. `apps/web/src/app/[locale]/dashboard/warehouse/inventory/movements/_components/inventory-movements-client.tsx` — same, via a new distinct `liveActiveBranchId` local (the pre-existing `activeBranchId` prop is unchanged).
8. `apps/web/src/app/[locale]/dashboard/warehouse/items/_components/inventory-products-client.tsx` — same.

## Consumer files (new tests)

9. `apps/web/src/app/[locale]/dashboard/warehouse/locations/_components/__tests__/locations-data-view.branch-wiring.test.tsx` (new, 2 tests)
10. `apps/web/src/app/[locale]/dashboard/warehouse/inventory/_components/__tests__/inventory-client.branch-wiring.test.tsx` (new, 2 tests)
11. `apps/web/src/app/[locale]/dashboard/warehouse/inventory/movements/_components/__tests__/inventory-movements-client.branch-wiring.test.tsx` (new, 3 tests)
12. `apps/web/src/app/[locale]/dashboard/warehouse/items/_components/__tests__/inventory-products-client.branch-wiring.test.tsx` (new, 2 tests)

## Documentation

13. `docs/mvp/zones/01-auth-org-branch-access-implementation-plan.md` — Phase 3's 5 tasks marked done; 2 factual corrections recorded (Inventory Products file path; branchId-as-separate-prop, not concatenated into the base queryKey constant).
14. `docs/mvp/zones/01-auth-org-branch-access-progress.md` — Phase 3 marked DONE with full evidence; BLOCKER-Z1-002 marked RESOLVED; new 2026-09-24 change-log entry added; mechanical task counts recomputed to 24/95 (24/49 pitch, 0/46 pilot).
15. `docs/mvp/reviews/zone1-phase3-dataview-consumers-2026-09-24/` (this closeout bundle: `implementation-summary.md`, `consumer-wiring-matrix.md`, `mutation-invalidation-review.md`, `test-results.md`, `phase3-closeout.md`, `changed-files.md`, `diff.patch`).

## What was explicitly NOT changed

`DataViewListParams`, `useDataViewDetailQuery`, `use-data-view-query.ts` (Phase 2's own foundation — untouched, confirmed via `git diff` showing zero changes since the Phase 2 commit). No file under `apps/web/src/hooks/queries/tools/` (Matcher). No file under `apps/web/src/server/qr/`. No file under `apps/web/src/app/actions/` or `apps/web/src/server/` (no server-side logic touched). No migration, SQL, or RLS file. No file related to Zone 3 Phase 10D. Zero commits made.
