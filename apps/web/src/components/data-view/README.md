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

## Responsive presentation

DataView observes its own inline-size with one `ResizeObserver`; viewport width never selects presentation. The initial server and hydration render use the same wide markup, then a layout effect measures before the first client paint. Presentation changes do not alter URL state, query keys, fetchers, or cache identity.

- **Wide (840px and above):** the full table is shown until detail opens, then a stable `clamp(280px, 30cqw, 320px)` compact master sits beside a detail pane with at least about 520px at the boundary.
- **Medium (560–839px):** list-only uses the desktop table and compact filter toolbar. Selected detail replaces the list within the same DataView surface.
- **Narrow (below 560px):** list-only uses touch-oriented cards and compact pagination. Selected detail replaces the cards at full surface width.

The 840px split threshold comes from the minimum readable 280–320px master plus a practical 520px arbitrary-detail region. The 560px table threshold keeps a useful multi-column table; below it cards avoid compressing table semantics into an unusable viewport.

Consumers may provide `renderMobileItem(row)` for a purpose-built card body. DataView falls back to `renderCompactItem(row)`, then to the first visible column plus up to three secondary columns. `renderExpandedRow(row)` appears beneath its card in a bounded horizontal scroll region, so domain content remains consumer-owned.

Replacement detail provides a localized 44px Back-to-list button. Opening replacement detail moves focus to Back. If replacement presentation is being closed, focus returns to the initiating row when it still exists and otherwise moves to the list surface; this also covers direct selected URLs and details that changed from split to replacement after a resize. Wide split avoids focus stealing. DataView does not own Escape because arbitrary detail content may contain an interaction that does. Table rows open with Enter, mobile and sidebar rows use native buttons, and all focus targets retain visible focus styles.

Wide split owns one scroll surface for the compact master and one for arbitrary detail. Medium and narrow replacement modes expose one detail scroll surface. The DataView shell clips accidental outer overflow; desktop tables retain internal horizontal scrolling and sticky headers. Mobile search remains visible, filters use a viewport-bounded popover, consumer actions wrap into a secondary toolbar row, and pagination retains page size plus explicit previous/next controls.

The master and arbitrary consumer-detail subtrees stay mounted while replacement detail is visible, so container-mode changes do not restart consumer effects or remote queries. Framer transitions are disabled when `prefers-reduced-motion` is active. Animation never controls whether detail exists; `selected` remains the semantic authority. Loading, transition, error, empty, not-found, and selected-outside-results states use the same Phase-1 query state in every presentation.

## Accessibility and keyboard contract

Rows remain ordinary focusable table rows that open with Enter; cards and compact-master items are native buttons. Sortable headers are native buttons inside semantic column headers, and `aria-sort` stays on the header. Selection is exposed with `aria-selected` on table rows and `aria-current` on button-based card/master choices. Loading regions expose `aria-busy` plus a polite status, request failures use alerts, and empty/not-found states use statuses. Filters have programmatic labels and active-filter clear actions are separate buttons. Replacement detail moves focus to Back and restores the initiating row or list surface. DataView intentionally does not implement spreadsheet arrow navigation. Reduced motion removes decorative transition duration and shimmer animation.

## Runtime and performance contract

TanStack Query owns concurrency. Every generic list/detail fetcher receives `{ signal }`; consumers using an abortable transport should pass that signal through. Canonical keys isolate list inputs, detail IDs, and opaque scopes, so obsolete completions may fill only their own cache entry and cannot replace the visible newer query. Search keeps a local draft and commits one canonical URL change after 250 ms; blur, close, and Escape flush immediately, while Back/Forward cancels an obsolete pending draft.

DataView keeps server pagination and renders at most the selected page (10/25/50/100 rows). Production measurements showed no material 25-to-100-row slowdown, so the desktop table and mobile cards are intentionally not virtualized. Compact master virtualization remains enabled above 30 items with fixed-height rows and stable domain IDs. Detail prefetch remains deferred because measured selection latency did not justify extra network/cache pressure. Inactive entries use the dashboard QueryClient policy (TanStack's five-minute default `gcTime`); the 60-second stale time enables useful scope-return reuse without global invalidation.

Behavioral regression budgets are: resize causes zero data requests; selection does not refetch the list; one uncached selection causes at most one detail request; rapid search causes one canonical list request after debounce; explicit list refresh causes one list request; fresh SSR hydration causes no duplicate client request; and one ResizeObserver is installed per mounted root, updates only on 560/840 capability crossings, and disconnects on unmount. React Profiler coverage guards same-band resize from committing the DataView tree.

Future consumers can import `createDataViewContractFixture` from `__tests__/data-view-contract-harness.tsx` as the reference fixture for list, selection URL, detail, close, mobile rendering, replacement mode, scope identity, loading, and error expectations. Runtime tests separately cover AbortSignal cancellation, hostile list/detail completion order, error recovery, background-refresh retention, and A→B→C→A scope reuse.

## Phase 4 boundary

Broad consumer migration, Repair Orders adoption, persisted splitter widths, and convergence with the divergent public-web DataView remain deferred. The public-web copy is explicit technical debt and is not synchronized by this implementation.
