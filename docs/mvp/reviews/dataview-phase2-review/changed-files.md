# DataView Phase 2 changed files

- Baseline: `bde5f453a2a9095ec1d3881c1c3a26c5537c0616` (committed final Phase 1).
- Implementation files: 18.
- Review-bundle files are excluded from the implementation patch.

| Status   | Path                                                                       | Phase 2 relevance                                                                                                    |
| -------- | -------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------- |
| Modified | `apps/web/messages/en.json`                                                | Localized Back and responsive-control labels.                                                                        |
| Modified | `apps/web/messages/pl.json`                                                | Polish Back and responsive-control labels.                                                                           |
| Added    | `apps/web/e2e/data-view-responsive.spec.ts`                                | Products and Help Desk viewport, history, and focus-restoration matrix.                                              |
| Modified | `apps/web/src/components/data-view/README.md`                              | Responsive contract and Phase 3 boundary.                                                                            |
| Modified | `apps/web/src/components/data-view/__tests__/data-view-foundation.test.ts` | Container threshold boundary coverage.                                                                               |
| Modified | `apps/web/src/components/data-view/__tests__/data-view-url-state.test.tsx` | More resilient real-nuqs timing under parallel load.                                                                 |
| Modified | `apps/web/src/components/data-view/__tests__/data-view.test.tsx`           | Responsive, focus, Escape ownership, motion, loading, error, expansion, and remount regressions.                     |
| Modified | `apps/web/src/components/data-view/data-view-detail.tsx`                   | Replacement Back control, cooperative nested-interaction ownership, scrolling, and reduced-motion-safe detail shell. |
| Modified | `apps/web/src/components/data-view/data-view-filters.tsx`                  | Inline/dropdown modes and bounded narrow popover.                                                                    |
| Modified | `apps/web/src/components/data-view/data-view-layout.tsx`                   | Container modes, stable master/detail subtrees, and presentation-aware focus restoration.                            |
| Modified | `apps/web/src/components/data-view/data-view-mobile-layout.tsx`            | Mobile cards, toolbar, pagination, loading/error states, and expanded content.                                       |
| Modified | `apps/web/src/components/data-view/data-view-pagination.tsx`               | Reduced-motion-safe pagination transition.                                                                           |
| Modified | `apps/web/src/components/data-view/data-view-search-control.tsx`           | Persistent mobile search and transform/opacity animation.                                                            |
| Modified | `apps/web/src/components/data-view/data-view-sidebar.tsx`                  | Generic row-open focus handoff and contained scrolling.                                                              |
| Modified | `apps/web/src/components/data-view/data-view-table.tsx`                    | Keyboard-openable rows, focus styles, and observable list-surface focus fallback.                                    |
| Modified | `apps/web/src/components/data-view/data-view-toolbar.tsx`                  | Mode-aware toolbar and filter reflow.                                                                                |
| Deleted  | `apps/web/src/components/data-view/use-media-query.ts`                     | Removes viewport-only presentation selection.                                                                        |
| Added    | `apps/web/src/components/data-view/use-data-view-container-mode.ts`        | Hydration-safe ResizeObserver mode selection and capability thresholds.                                              |
