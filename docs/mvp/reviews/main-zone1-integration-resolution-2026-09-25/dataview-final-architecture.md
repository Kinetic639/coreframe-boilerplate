# Final DataView Branch-Scoping Architecture

## Single active mechanism, confirmed

Global search post-resolution, in the final integrated tree:

```
buildDataViewQueryKey        → 0 matches anywhere in src/
branchId= on <DataView        → 0 matches anywhere in src/
dataViewScope usages          → 26 files
DataViewScope type definition → exactly 1 place (src/lib/data-view/types.ts)
```

**Confirmed: exactly ONE active generic DataView branch-scoping mechanism remains** — main's `scope: DataViewScope` prop plus the `dataViewScope.branch(organizationId, branchId)` factory (`src/lib/data-view/ambra-data-view-scope.ts`) and the centralized `dataViewKeys` module (`src/components/data-view/data-view-query-keys.ts`). Zone 1's own `branchId`/`buildDataViewQueryKey` mechanism has been fully removed, not left dormant alongside it.

## Traced: consumer → DataView → provider → query hook → query key

Using `LocationsDataView` as the representative example (all 4 warehouse consumers follow the identical pattern):

```
LocationsDataView (consumer)
  props: organizationId: string, branchId: string
  │
  ▼
<DataView scope={dataViewScope.branch(organizationId, branchId)} entity="locations" ...>
  scope = { kind: "branch", organizationId, branchId }
  │
  ▼
<DataViewProvider scope={scope} entity={entity} ...>
  const scopeKey = JSON.stringify(scope)
  const stableScope = useMemo(() => JSON.parse(scopeKey), [scopeKey])
  │
  ▼
useDataViewListQuery({ entity, scope: stableScope, listFetcher, listParams, ... })
useDataViewSidebarInfiniteQuery({ entity, scope: stableScope, ... })
  │
  ▼
dataViewKeys.list(entity, scope, params)
  → ["data-view", entity, "scope", scope, "list", params]
  → e.g. ["data-view", "locations", "scope", {kind:"branch",organizationId:"org-1",branchId:"branch-a"}, "list", {...}]
```

**Branch identity reaches the final React Query cache key** via `scope`, confirmed both by reading the code path above and by the passing test evidence in `test-results.md` (`data-view-foundation.test.ts`'s `"isolates identical list and detail identities between scopes"`, plus all 4 updated branch-wiring tests asserting the exact `scope` object each consumer produces).

## Functional guarantees re-verified (per the task's own explicit list)

| Guarantee                                       | Status | Evidence                                                                                                                                                                                                                                                                                                                                                                                                                                                 |
| ----------------------------------------------- | ------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Locations is branch-aware                       | ✅     | `locations-data-view.branch-wiring.test.tsx` — different `branchId` prop → different `scope` object                                                                                                                                                                                                                                                                                                                                                      |
| Inventory Balances is branch-aware              | ✅     | `inventory-client.branch-wiring.test.tsx` — same                                                                                                                                                                                                                                                                                                                                                                                                         |
| Inventory Movements is branch-aware             | ✅     | `inventory-movements-client.branch-wiring.test.tsx` — same, plus verified the detail panel receives the same value                                                                                                                                                                                                                                                                                                                                       |
| Inventory Products is branch-aware              | ✅     | `inventory-products-client.branch-wiring.test.tsx` — same                                                                                                                                                                                                                                                                                                                                                                                                |
| Switching branch yields distinct cache identity | ✅     | `data-view-foundation.test.ts`'s scope-isolation tests (generic, proven for any 2 distinct scope objects, including branch-shaped ones)                                                                                                                                                                                                                                                                                                                  |
| No stale Branch-A data is reused in Branch B    | ✅     | Same — a different `scope` is, by construction, a different cache key; React Query never conflates two distinct keys                                                                                                                                                                                                                                                                                                                                     |
| Org-scoped DataViews remain unaffected          | ✅     | Every org-scoped consumer (CRM, Help Desk, Organization admin screens, Planning, QR management) migrated by main's own commit to `dataViewScope.organization(orgId)`/`dataViewScope.global()`, unrelated to and unaffected by the branch-scoping question; their own tests (`branches-client.test.tsx`, `invitations-client.test.tsx`, `members-client.test.tsx`, `positions-client.test.tsx`, `roles-client.test.tsx`) all pass — see `test-results.md` |
| No client branchId becomes authorization input  | ✅     | Unchanged principle — `scope` (like the old `branchId` prop before it) is used exclusively to build a React Query cache key; it is never passed to any server action, RPC, or `listFetcher` request payload. Confirmed by reading `dataViewKeys.list`'s own implementation (key construction only) and every migrated consumer's own `listFetcher` (still calls the same, unmodified, already-authorization-checked server actions Zone 1 never altered) |
| Server scoping remains authoritative            | ✅     | Unchanged — `WarehouseLocationsService`/`InventoryProductsService`/etc.'s own server-side branch filtering (the actual data-access authorization layer) was not touched by either side of this integration; `scope` only ever affects the CLIENT's own cache key, never the server query itself                                                                                                                                                          |

## No third branch-scoping mechanism introduced

This resolution pass added zero new abstractions — every change was either "adopt main's existing mechanism" or "delete Zone 1's now-superseded one." No new prop, no new type, no new helper function was invented.
