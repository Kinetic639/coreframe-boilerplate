# DataView Phase 3 changed files

Baseline: `0680b88fb1145b30a1356227f7018f81d78f4bcc` (committed final Phase 2).

The implementation patch contains 16 paths. Review-bundle files are excluded.

| Path                                                                         | Purpose                                                                                           |
| ---------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------- |
| `apps/web/e2e/data-view-runtime.spec.ts`                                     | Production browser race, request-budget, resize, recovery, keyboard, and reduced-motion coverage. |
| `apps/web/messages/en.json`                                                  | English list-loading announcement.                                                                |
| `apps/web/messages/pl.json`                                                  | Polish list-loading announcement.                                                                 |
| `apps/web/src/components/data-view/README.md`                                | Accessibility, runtime, cache, performance, testing, and Phase 4 contracts.                       |
| `apps/web/src/components/data-view/__tests__/data-view-contract-harness.tsx` | Reusable domain-neutral future-consumer fixture.                                                  |
| `apps/web/src/components/data-view/__tests__/data-view-runtime.test.tsx`     | Cancellation, stale-response, detail-race, scope, and recovery regressions.                       |
| `apps/web/src/components/data-view/__tests__/data-view.test.tsx`             | Accessibility, debounce, URL, observer, profiler, and contract-harness regressions.               |
| `apps/web/src/components/data-view/data-view-detail.tsx`                     | Accessible detail busy/loading/empty/not-found states.                                            |
| `apps/web/src/components/data-view/data-view-filters.tsx`                    | Programmatic filter labels and valid separate clear controls.                                     |
| `apps/web/src/components/data-view/data-view-mobile-layout.tsx`              | Mobile busy/status semantics and native current-item state.                                       |
| `apps/web/src/components/data-view/data-view-search-control.tsx`             | Measured 250 ms canonical search debounce and URL-race cancellation.                              |
| `apps/web/src/components/data-view/data-view-sidebar.tsx`                    | Sidebar busy semantics and native current-item state.                                             |
| `apps/web/src/components/data-view/data-view-table.tsx`                      | Native sortable buttons and accessible list states.                                               |
| `apps/web/src/components/data-view/data-view.types.ts`                       | Public query-context type re-export.                                                              |
| `apps/web/src/components/data-view/use-data-view-query.ts`                   | TanStack AbortSignal propagation for list/detail/sidebar requests.                                |
| `apps/web/src/lib/data-view/types.ts`                                        | Generic fetcher query-context contract.                                                           |
