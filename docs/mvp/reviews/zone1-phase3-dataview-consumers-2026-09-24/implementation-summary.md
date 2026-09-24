# Zone 1 / Phase 3 — Migrate Confirmed Branch-Scoped DataView Consumers — Implementation Summary

**Date:** 2026-09-24
**Starting SHA:** 02992cbcdef22fdc0f97ac7cb564c03feb0c9509 ("fix: add branch-aware DataView query-key foundation")

## Objective

Wire the already-approved Phase 2 branch-aware DataView query-key foundation into the 4 confirmed branch-scoped warehouse DataView consumers: Locations, Inventory Balances, Inventory Movements, Inventory Products.

## What was inspected first

Phase 2's finalized contract (`query-key-contract.md`), the 4 confirmed-consumer findings in `branch-state-cache-inventory.md`, and each of the 4 actual current consumer files (not assumed from the prior audit's filenames — one path discrepancy was found this way, see below).

## Plumbing required (and added)

Phase 2 deliberately did not expose `branchId` through `DataViewProps`/`DataView`/`DataViewProvider` — that consumer-facing wiring was left for Phase 3. Added:

- `branchId?: string | null` on `DataViewProps<TListRow, TDetail>` (`apps/web/src/lib/data-view/types.ts`).
- Threaded unchanged through `DataView` (`apps/web/src/components/data-view/data-view.tsx`) into `DataViewProvider`.
- `DataViewProvider` (`apps/web/src/components/data-view/data-view-provider.tsx`) now passes `branchId` into both `useDataViewListQuery` and `useDataViewSidebarInfiniteQuery` (both already accepted it since Phase 2).
- The `refreshToken`-based invalidation effect inside `DataViewProvider` was left untouched — it calls `queryClient.invalidateQueries({queryKey})` with the raw, un-branched `queryKey` prop, which still correctly invalidates the new, longer, branch-scoped keys via React Query v5's default prefix-matching (`exact: false`) behavior.

This plumbing is fully additive and backward compatible: every existing `<DataView>` consumer that doesn't pass `branchId` is completely unaffected (the prop is optional throughout the chain).

## The 4 consumers

Each consumer now reads `const activeBranchId = useAppStoreV2((s) => s.activeBranchId)` (the exact selector pattern already established in `map-list-client.tsx`) and passes `branchId={activeBranchId}` to its own `<DataView>` call, alongside its existing, unchanged `queryKey`.

`InventoryMovementsClient` is the one structurally different case: it already had an `activeBranchId` PROP (a frozen SSR value forwarded to `InventoryMovementDetailPanel`). A new, separate live-read local variable (`liveActiveBranchId`) was added specifically for the DataView's own cache identity; the existing prop and its downstream forwarding were left completely unchanged, since fixing the detail panel's own branch-awareness was not part of this phase's named scope.

## What was NOT done, and why

- `DataViewListParams` was not touched (Phase 2's own established contract).
- `useDataViewDetailQuery` was not touched (Phase 2's own established decision — detail queries are keyed by globally-unique IDs).
- No server-side list fetcher gained a `branchId` parameter — `branchId` remains cache-identity-only throughout; server-side branch scoping continues to derive entirely from authoritative server context, unchanged.
- Matcher and QR were not touched — out of this phase's scope (Phases 4 and 6 respectively).
- No mutation logic was redesigned. A pre-existing gap was discovered (see `mutation-invalidation-review.md`) and explicitly left unfixed, since it predates and is unrelated to branch-awareness.

## Two factual corrections made to the plan (evidence-based, not scope changes)

1. `inventory-products-client.tsx`'s actual path is `apps/web/src/app/[locale]/dashboard/warehouse/items/_components/`, not `warehouse/inventory/_components/` as the plan originally stated.
2. The plan's task wording "fixing `INVENTORY_PRODUCTS_QUERY_KEY` ... to include branchId" was not implemented literally — per the Phase 2 contract, `branchId` must always be a separate, explicit prop, never concatenated into a consumer's own base `queryKey` array. The actual fix passes `branchId` as its own prop alongside the unchanged constant.

Both are recorded in the implementation plan with history preserved (strikethrough + note, not deletion) and in the progress tracker's change log.
