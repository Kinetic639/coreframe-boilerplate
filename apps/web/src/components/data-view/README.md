# DataView architecture

DataView is the shared SSR-first list/detail primitive used by dashboard screens. Domain screens own columns, filters, fetchers, row identity, detail rendering, and mutations. DataView owns normalized URL state, canonical query keys, list/detail loading semantics, selection, and layout.

## SSR and hydration

Server pages parse search parameters with `parseDataViewSearchParams`, create a request-scoped QueryClient with `createDataViewServerQueryClient`, and prefetch `dataViewKeys.list(entity, scope, params)`. When `selected` is present, the page may also prefetch `dataViewKeys.detail(entity, scope, selected)`. The dehydrated state is rendered through `HydrationBoundary` inside the dashboard's application-level `QueryClientProvider`.

Client DataView queries use the same keys and a 60-second stale time. Fresh hydrated data therefore renders immediately without a duplicate mount request. `initialData` remains as a compatibility fallback for consumers that have not yet adopted route hydration, and is applied only to the exact parameter and scope snapshot present when that DataView mounted.

DataView never creates a QueryClient. The dashboard provider owns the cache used by DataView, consumer queries, and mutations.

## Canonical keys and invalidation

- `dataViewKeys.list(entity, scope, normalizedParams)` includes entity, an opaque primitive-only scope record, search, sort, filters, page, and page size. DataView treats scope only as query identity and does not interpret application domains.
- `dataViewKeys.detail(entity, scope, id)` identifies one scoped detail record.
- `dataViewKeys.sidebar(...)` contains the scoped infinite-sidebar extension cache. Its initial page is seeded only from an exact, non-placeholder list result.
- `invalidateDataViewList`, `invalidateDataViewDetail`, and `invalidateDataViewEntity` invalidate only the current scope. `invalidateDataViewEntityAllScopes` is the explicit cross-scope boundary.
- When a mutation invalidates a multi-page sidebar, synchronization resets it to the known-fresh current page. Adjacent pages are fetched again on demand; ordinary list synchronization preserves valid adjacent pages.

Consumers should not construct DataView query keys or create separate DataView cache families. They may pass any primitive-only scope record, such as `{ projectId, workspaceId }`, without changing DataView core.

## URL state

`DATA_VIEW_PARSERS` is shared by the nuqs client hook and server loader. Pages are normalized to at least 1, page size is limited to 10, 25, 50, or 100, filters accept only string, string-array, boolean, or null values, and filter values are never decoded twice.

Opening the first detail pushes history. Switching from A to B replaces the selected entry. Closing replaces `selected` with an empty value. This deterministic policy avoids hidden history counters and selection-entry spam. Browser Back/Forward remains driven by URL state.

If a successful list result reports fewer pages than the requested page, DataView replaces the URL with the nearest valid page. Selected detail remains open when search, filters, or pagination hide the selected row.

## State and rendering contract

Semantic detail visibility is exactly `selected != null`. Animation may change width, opacity, or position but never decides whether detail content exists.

List states are distinct:

- initial load: no data; render a local table/card skeleton;
- transition fetch: keep previous rows temporarily and show a subtle progress state;
- background refresh: keep content visible;
- empty: successful response with zero rows;
- error: failed list request.

Detail states are distinct:

- initial load or A-to-B transition: stable detail shell with a skeleton and no previous record shown as the new selection;
- background refresh: retain detail and announce refresh subtly;
- success;
- request error;
- not found/deleted: successful `null` detail result;
- selected outside current results: valid detail remains open while the current list does not contain its ID.

## Phase 2 boundary

Phase 1 intentionally retains the existing viewport breakpoint and current desktop/mobile layouts. Container-query layout selection, tablet list-to-detail replacement, mobile navigation and focus restoration, 44px touch controls, mobile expanded rows, toolbar reflow, and nested-scroll cleanup belong to Phase 2.
