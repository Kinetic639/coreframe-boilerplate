# Zone 1 / Phase 2 — Branch-Aware DataView/Query-Key Foundation — Implementation Summary

**Date:** 2026-09-24
**Starting SHA:** 10bc8dc454be77c46b4bbf672e601c45dbf18e36 ("fix: complete Zone 1 centralized branch transition")

## Objective

Build ONLY the shared foundation that allows branch-scoped DataView screens to include `branchId` in their React Query cache identity, without migrating any concrete consumer (that is Phase 3's job).

## What was inspected first

`apps/web/src/components/data-view/use-data-view-query.ts` (the 3 query hooks: `useDataViewListQuery`, `useDataViewDetailQuery`, `useDataViewSidebarInfiniteQuery`), `apps/web/src/lib/data-view/types.ts` (`DataViewListParams`, `DataViewProps`), `apps/web/src/components/data-view/data-view.types.ts` (re-export barrel), `apps/web/src/components/data-view/data-view-provider.tsx` and `data-view.tsx` (the wiring that calls the 3 hooks), and two representative org-scoped consumers (`roles-client.tsx`, `tasks-client.tsx`).

## Key finding that shaped the design

`DataViewListParams` is not purely cache-key material — `useDataViewListQuery` passes it directly to `listFetcher(listParams)` as the exact request payload, and `useDataViewSidebarInfiniteQuery` spreads it into its own fetcher call too. This means `DataViewListParams` is simultaneously (a) part of the React Query cache key (`queryKey: [...queryKey, listParams]`) and (b) the literal server request payload. Adding `branchId` to this type, as the plan's original wording suggested, would have silently leaked `branchId` into every `listFetcher` call — violating the task's own explicit "the query key and the server request payload are separate concerns; preserve that separation" requirement.

## Design chosen

- A new pure, exported helper in `use-data-view-query.ts`:
  ```ts
  export function buildDataViewQueryKey(baseKey: string[], branchId?: string | null): string[] {
    return branchId == null ? baseKey : [...baseKey, branchId];
  }
  ```
- `branchId?: string | null` added as an optional field on `UseDataViewListQueryOptions<TListRow>` and `UseDataViewSidebarInfiniteQueryOptions<TListRow>` — the two hooks whose underlying data is the exact same branch-scoped source the confirmed bugs are about.
- `useDataViewListQuery`'s query key changed from `[...queryKey, listParams]` to `[...buildDataViewQueryKey(queryKey, branchId), listParams]`. Same pattern applied to the sidebar infinite query's key.
- `useDataViewDetailQuery` was deliberately left untouched — see rationale in `query-key-contract.md`.
- `DataViewListParams`, `DataViewProps`, `data-view-provider.tsx`, `data-view.tsx`, and every consumer file were left completely untouched.

This keeps the entire change self-contained inside `use-data-view-query.ts` (the task's own "expected primary surface"), makes zero DataView consumer reachable to the new parameter yet (so backward compatibility is not just tested but structurally guaranteed — no existing caller can pass `branchId` since the public `<DataView>`/`DataViewProvider` prop surface doesn't expose it), and leaves Phase 3 with exactly two jobs per consumer: read `activeBranchId` and pass it through (once Phase 3 also threads it through `DataViewProps`/`DataViewProvider`, which was intentionally left for that phase since it is the actual "wiring the consumer" work).

## What was explicitly NOT done

No consumer migrated (Locations, Inventory Balances, Inventory Movements, Inventory Products all remain exactly as broken as before this phase — confirmed unchanged). No Matcher work. No QR work. No global Zustand/store coupling (the hooks accept `branchId` as an explicit parameter; nothing reads `useAppStoreV2()` internally). No authorization change. No DB/schema/RLS change.
