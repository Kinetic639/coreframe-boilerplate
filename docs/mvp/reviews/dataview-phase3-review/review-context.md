# DataView Phase 3 external review context

## Scope and baseline

Phase 3 hardens the accepted Phase 1/2 DataView without changing its SSR-first architecture, cache ownership, query identities, URL/history model, responsive modes, loading model, focus model, or consumer classification. The exact baseline is committed Phase 2: `0680b88fb1145b30a1356227f7018f81d78f4bcc` (`phase 2 complete pass`). Repair Orders and Phase 4 migration are excluded.

## A. Measured performance baseline

Authenticated production-build measurements were taken before optimization on Products and Help Desk. Products rendered 25, 50, and 100-row pages in about 2.5 seconds end-to-end with no material growth between page sizes. Help Desk had 26 records, rendered 25 or 26 depending on page size, in about 2.4 seconds. These timings include navigation/server work and are comparative rather than a synthetic render-only SLA. DOM size stayed around 1.5k nodes. No console error occurred. Rapid `a→ab→abc` search produced three server requests. Explicit refresh after network idle produced one request. Wide→medium→narrow→wide produced zero fetch/XHR requests.

React Profiler regression instrumentation confirms same-capability-band ResizeObserver notifications add no DataView commit. Existing context separation means detail query state is not read by toolbar/filter regions. A selected-mode presentation necessarily changes the master subtree; no measured row-render hotspot justified further memoization.

## B. Observed bottlenecks

The only repeatable production bottleneck was one canonical URL/list request per rapid search keystroke. Theoretical concerns that were not observed include 100-row desktop rendering cost, resize network traffic, duplicate explicit refreshes, or a need to virtualize mobile cards.

## C. Changes actually made

The generic fetcher contract now receives TanStack's `AbortSignal`; list, detail, and infinite-sidebar query functions pass it through. Search uses a 250 ms local draft debounce, flushes on blur/close/Escape, and cancels pending drafts when canonical URL state changes. Sort headers became native buttons. Loading/busy/status semantics and filter labels were tightened, and nested filter interactions were removed. Tests and documentation carry most of the Phase 3 change.

## D. Rerender findings

DataView already splits static, URL, list, detail, column, and selection contexts and memoizes provider values. Column configuration is consumer-owned; DataView's TanStack definitions are memoized from it. Container mode updates return the existing state inside a capability band. A Profiler test proves 1000→980→920→850 causes no additional commit, while the observer remains singular and disconnects on unmount. No broad `memo`/`useMemo` pass was warranted.

## E. Virtualization decision

Desktop table virtualization was intentionally not added: server pagination caps a rendered page at 100 and production comparison found no material 25→100 slowdown. Mobile card virtualization was intentionally not added for the same bounded-page reason and to retain straightforward focus semantics. Existing compact-sidebar virtualization is retained only above 30 items; it uses fixed 56 px rows and stable domain IDs. No recycling selection jump was observed in browser A→B→C checks.

## F. Race and cancellation model

TanStack Query remains the sole concurrency system. Query functions receive its signal and generic fetchers can pass it to an abortable transport. Current server-action consumers cannot abort an already-serialized server action transport, but observer cancellation still prevents obsolete work from controlling visible state. Canonical keys isolate every list parameter, scope, and detail ID. There is no parallel cancellation registry.

## G. Search behavior

Baseline rapid typing made three requests. Phase 3 commits a single canonical search value 250 ms after the last input, reducing the production `a→ab→abc` case to one request. Blur, close, and Escape commit immediately. Direct URL and Back/Forward changes replace the local draft and cancel an obsolete timer, preserving the server-rendered URL as authority.

## H. Detail-selection race behavior

Deterministic deferred fetchers run A→B→C and complete C→A→B. The selected query continues to expose C. Production Playwright also delays the first obsolete detail request and confirms the URL/current item ends on C. Earlier results may populate their own cache entries and never render as C.

## I. Cache and memory behavior

List caches are bounded by canonical search/filter/page identities and inactive queries use the dashboard QueryClient's TanStack default five-minute garbage collection. Detail and sidebar entries follow the same inactive cleanup. Stale time remains 60 seconds. No global lifetime reduction was supported by evidence. Prefetch was not added because selection latency did not outweigh network, mobile-data, and cache-pressure costs.

## J. Scope-switch behavior

A deterministic A→B→C→A test renders only each active scope and reuses fresh A cache on return, with one fetch per new scope and no full-cache invalidation. This verifies client cache isolation only; server authorization and RLS remain authoritative.

## K. Mutation invalidation

Existing helpers remain unchanged: list, detail, and entity invalidation require the exact scope; all-scope invalidation remains explicit. Help Desk's accepted mutation regression passes and invalidates only canonical list/sidebar/selected-detail targets. Production refresh is exactly one list request when no detail is open. No destructive pilot mutation was performed.

## L. Error recovery

Tests cover detail failure followed by a healthy selection and a failed background refresh retaining good rows. Existing coverage retains distinct initial list error, detail error, not-found, and narrow replacement error states. Production browser testing forces a temporary offline search failure, restores the network, and reaches a settled valid list again. Back remains a native control in mobile detail error state.

## M. ResizeObserver behavior

One observer is created per mounted root and disconnected on unmount. Functional state updates return the existing mode inside a band, avoiding feedback commits. Threshold crossings remain exactly 560 and 840. Production resizing causes zero data requests and preserves the provider/query identities.

## N. Accessibility findings

Click-only sortable headers and a nested active-filter interaction were confirmed and fixed with native buttons. Filter inputs now have programmatic labels. Table rows use `aria-selected`; button-based master/card choices use `aria-current`. Initial loading surfaces expose `aria-busy` and polite status text, failures use alerts, and empty/not-found states use statuses. Native table/list/button semantics are retained without redundant roles.

## O. Keyboard model

The accepted model remains sufficient: Tab reaches a row, Enter opens it, cards/master items and Back are native buttons, and sortable headers are keyboard targets with visible focus. Replacement detail focuses Back and restores the initiating row or list surface. Spreadsheet arrow navigation would add a second interaction model without measured need and was not added.

## P. Reduced-motion behavior

Existing Framer transitions use zero duration and CSS loading/height animations opt out under reduced motion. Skeletons are bounded to the current page and use lightweight primitives. Browser verification runs the runtime path with reduced motion enabled.

## Q. Diagnostics

Existing React Query Devtools expose query key/status in development, while `data-layout-mode` on the root and canonical URL expose mode and selection for tests and DevTools. No production logging was added.

## R. Performance budget

- Resize across capability modes: zero data requests.
- Selection change: no list refetch; at most one uncached detail request.
- Rapid search: one canonical list request after debounce.
- Explicit list refresh: one list request.
- Fresh SSR hydration: zero duplicate client fetches.
- Mode change: no provider/query remount.
- ResizeObserver: one per mounted root, no same-band commit, disconnect on unmount.

## S. Products evidence

The 25-test Products regression passes. Production runtime checks pass rapid A→B→C with delayed obsolete work, page 1→2→3 at page size 10, repeated open/close, debounced search, resize neutrality, one refresh, offline recovery, keyboard entry, reduced motion, and no unexpected console errors.

## T. Help Desk evidence

The 22-test Help Desk regression passes, including scoped mutation invalidation. The same production runtime scenarios pass against its 26-record representative dataset, including page 1→2→3 at page size 10 and recovery after temporary network loss.

## U. Repair Orders readiness

Repair Orders currently returns a bounded server-rendered list with desktop rows and mobile cards. Its detail owns a header editor, logical lines, provenance, receiving/putaway-related quantity sections, and scoped mutations. These map to existing columns, `renderMobileItem`, and arbitrary `renderDetail`. Server pagination/search adaptation is consumer work for Phase 4; no core API, focus, performance, or query-architecture blocker was found. Repair Orders was not modified.

## V. Remaining Phase 4 work

Migrate Repair Orders and then other approved consumers, delete superseded bespoke views only after parity, and separately decide public-web convergence. Phase 3 does not begin any of that work.

## Bundle integrity and isolation

- Exact baseline: `0680b88fb1145b30a1356227f7018f81d78f4bcc`, the committed final Phase 2 state; no baseline reconstruction was required.
- The implementation diff was generated through an isolated temporary Git index seeded from that commit. The real index remained unchanged.
- Review-bundle files are excluded from the implementation patch.
- The manifest and patch contain the same 16 implementation paths.
- Final patch size: 1,328 lines and 59,267 bytes.
- Patch applicability passed against a filesystem archive extracted directly from the exact baseline commit.
- No migration, Repair Orders implementation, public-web file, or Phase 4 work is included.
- Isolation caveat: implementation and bundle remain uncommitted working-tree files; the baseline itself is a stable real commit.

## External-review questions

1. Are there measurable rerender hotspots?
2. Is any virtualization actually required?
3. Can stale requests overwrite newer visible state?
4. Does rapid A→B→C always render C?
5. Is request cancellation correctly delegated to TanStack/fetch?
6. Does search produce unnecessary request volume?
7. Is prefetch justified by evidence?
8. Can cache growth become unbounded in realistic use?
9. Can scope switching show stale cross-scope data?
10. Do mutation invalidations stay scoped?
11. Can network errors leave DataView in an invalid state?
12. Can ResizeObserver cause render loops?
13. Are responsive mode changes still network-neutral?
14. Does SSR-first hydration remain intact?
15. Is keyboard behavior sufficient without spreadsheet-style navigation?
16. Are focus semantics accessible?
17. Are reduced-motion guarantees preserved?
18. Are loading/error states accessible?
19. Can future consumers reuse a generic contract test?
20. Is DataView ready to become the standard list/detail primitive?
21. Can Repair Orders migrate in Phase 4 without core changes?
22. Did Phase 3 introduce unnecessary complexity?
