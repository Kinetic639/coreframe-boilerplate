# Zone 1 / Phase 2 — Branch-Aware DataView Query-Key Contract

This is the contract Phase 3 (and any future branch-scoped DataView consumer) must follow. It does not change until a later phase explicitly revises it — treat this file as the authoritative reference for that wiring work.

## The helper

```ts
// apps/web/src/components/data-view/use-data-view-query.ts
export function buildDataViewQueryKey(baseKey: string[], branchId?: string | null): string[];
```

- `baseKey`: the DataView's own static query key array (e.g. `["locations"]`), exactly as consumers already provide today.
- `branchId`: optional. `undefined` or `null` → returns `baseKey` unchanged (same array reference, no copy). Any string → returns `[...baseKey, branchId]`.
- Pure function. No side effects, no global state reads, deterministic for identical inputs.

## Where it's wired in today (Phase 2 scope)

| Hook                              | Accepts `branchId`?              | Query key shape when provided                                                                  |
| --------------------------------- | -------------------------------- | ---------------------------------------------------------------------------------------------- |
| `useDataViewListQuery`            | Yes                              | `[...buildDataViewQueryKey(queryKey, branchId), listParams]`                                   |
| `useDataViewSidebarInfiniteQuery` | Yes                              | `[...buildDataViewQueryKey(queryKey, branchId), "sidebar", {search, sort, filters, pageSize}]` |
| `useDataViewDetailQuery`          | **No — deliberately not wired.** | Unchanged: `[...queryKey, "detail", selectedId]`                                               |

### Why `useDataViewDetailQuery` was left out

Detail queries are keyed by `selectedId`, which is a record's own primary-key/UUID — globally unique across branches by construction. There is no cross-branch collision risk for a detail fetch the way there is for a LIST fetch (which returns "all rows visible from wherever branchId happens to be cached"). This mirrors the already-verified-safe pattern the pre-implementation audit found for Matcher's `results`/`extractedData` query keys (keyed by globally-unique `sessionId`, correctly excluded from that bug class). If a future phase discovers a genuine detail-level branch-leak bug, that would be new evidence requiring its own decision — not something this contract silently assumes today.

## What Phase 3 (or any future consumer) must do to opt in

1. Read the live active branch (e.g. `useAppStoreV2().activeBranchId`) at the consumer/provider call site — **never inside `use-data-view-query.ts` itself** (see "No global store coupling" below).
2. Pass it as `branchId` to `useDataViewListQuery`/`useDataViewSidebarInfiniteQuery`. Today this means either calling these hooks directly with `branchId`, or — if going through `<DataView>`/`DataViewProvider` — first threading a `branchId` prop through `DataViewProps` → `DataViewProvider` → these two hook calls (this plumbing was intentionally left for Phase 3, since it is consumer-facing wiring, not foundation work).
3. Do not pass `branchId` into `listFetcher`'s own params — it must never appear inside `DataViewListParams`. If a `listFetcher` implementation genuinely needs server-side branch filtering, that is a separate, explicit parameter to that specific fetcher function — not something inferred from cache-key participation.

## Hard invariants (do not violate in later phases)

1. **`branchId` is cache identity ONLY.** It must never be forwarded to a `listFetcher`/`detailFetcher` call as part of the request payload. Verified today by a dedicated test (`use-data-view-query.test.ts`, "branchId is never forwarded to listFetcher").
2. **`branchId` is never trusted authorization input.** Server-side branch scope must always come from the authoritative server context (`loadDashboardContextV2` and friends) — this mechanism has no bearing on, and must never be treated as evidence for, what a user is actually allowed to see.
3. **No global store coupling inside `use-data-view-query.ts`.** The hooks never read `useAppStoreV2()` or any other global branch state internally. `branchId` must always be passed in explicitly by the caller. This keeps every DataView org-scoped by default; branch-scoping is always an opt-in choice made at the call site, never an implicit framework behavior.
4. **Omitting `branchId` must always reproduce the exact pre-Phase-2 key shape.** This is what makes the change backward compatible for every existing org-scoped screen with zero code changes on their part.
5. **`branchId` must be a plain string identifier for the query key, not an object.** Passing a branch object or any non-primitive would break the "deterministic, serializable, structurally stable" requirement.

## Non-goals of this contract

Migrating the 4 confirmed consumers (Phase 3). Fixing Matcher (Phase 4, uses its own `wddMatcherKeys` module, not this contract). Any QR/deep-link work (Phase 6). Any change to how `DataViewListParams` itself is shaped or validated.
