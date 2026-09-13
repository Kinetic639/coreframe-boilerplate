# DataView Phase 2 external review context

## A. Objective

Phase 2 makes the accepted generic DataView an adaptive master/detail surface for wide, medium, and narrow containers. Phase 1 data architecture is frozen: scope, SSR prefetch/hydration, QueryClient ownership, canonical keys, parsers, URL-selected authority, loading/error semantics, page recovery, sidebar invalidation, history policy, and Products compound IDs are unchanged.

## B–C. Container architecture and thresholds

Each DataView observes only its own root inline-size through one `ResizeObserver`. The responsive mode is presentation state and never enters query identity.

| Mode   | Container width | Capability rationale                                                                  |
| ------ | --------------: | ------------------------------------------------------------------------------------- |
| Wide   |      `>= 840px` | Supports a 280–320px compact master plus at least about 520px for arbitrary detail.   |
| Medium |     `560–839px` | Supports a useful multi-column table, but not a readable split master/detail pair.    |
| Narrow |       `< 560px` | Uses cards because a desktop table is no longer a useful primary interaction surface. |

The measured Ambra chrome leaves DataView 1104px at a 1440px viewport and 688px at a 1024px viewport. The former supports split; the latter now correctly uses replacement detail. No `window.innerWidth` or viewport media query remains in web-app DataView core.

## D–H. Responsive modes

- **Desktop list:** full existing table, sticky header, internal horizontal scrolling, full pagination.
- **Desktop split:** compact master is `clamp(280px, 30cqw, 320px)`; arbitrary detail receives the remaining width and its own scroll surface.
- **Tablet replacement:** list-only keeps the table with dropdown filters; selected detail replaces the list inside the DataView surface.
- **Mobile list:** intentional cards, persistent search, filter trigger, wrapping consumer actions, selection controls, and compact pagination.
- **Mobile detail:** selected detail replaces cards at full DataView width with no fixed content height or domain schema.

## I. Mobile renderer API

The existing small generic API is retained. `renderMobileItem(row)` has first priority, `renderCompactItem(row)` is the second fallback, and DataView otherwise renders the first visible column plus up to three secondary columns. No product/ticket fields are interpreted in core.

## J–L. Back, focus, and keyboard

Replacement detail renders a localized Back-to-list native button with a 44px target. It calls the existing `closeDetail` contract, so selection clearing still uses history replacement and page-return recovery. DataView does not own Escape because arbitrary consumer detail may contain the interaction that owns it.

When replacement detail opens, focus moves to Back. Focus restoration depends on the presentation being closed: replacement close returns to the initiating row if present, otherwise to the list scroll surface. This covers direct selected URLs and wide detail that becomes replacement after a resize. Wide split does not steal focus. Desktop rows are tabbable and open with Enter; sidebar/mobile rows and Back use native buttons. There is no focus trap.

## M. Reduced motion

Framer layout/search transitions use zero duration when reduced motion is requested; CSS height/opacity transitions opt out with `motion-reduce:transition-none`; loading decoration stops. Detail existence remains synchronously controlled by `selected`, never by an animation callback.

## N–O. Toolbar, filters, and pagination

Wide toolbars retain inline filters. Medium uses one dropdown trigger. Narrow keeps search visible, constrains filter popovers to the viewport, and moves consumer controls to a wrapping second row. Mobile pagination retains result range, page size, current/total page, and 44px previous/next controls. Page recovery is unchanged.

## P. Expanded rows

`renderExpandedRow` remains consumer-owned. On narrow cards its result appears below the card body in a bounded internal horizontal scroll region. Products behavior is reused without a core entity conditional.

## Q. Scroll ownership

Wide split has one compact-master scroll surface and one detail scroll surface. Medium/narrow replacement has one detail scroll surface. Table/card lists own their list scrolling; all primary inner surfaces use contained overscroll. Root shells prevent accidental document overflow.

## R. Loading and error states

The same Phase 1 query state drives all modes. Mobile has stable list skeleton cards. Detail pending loads only the detail surface; A-to-B never presents A as B. List transition keeps rows, background refresh keeps content, and list error, empty, detail error, not-found, and selected-outside-results remain distinct in split and replacement modes.

## S–T. SSR, hydration, and performance

Server and initial hydration both render the same wide presentation. A layout effect measures the mounted container before the first client paint, then the observer responds only when a threshold is crossed. DataView remains SSR-rendered. Mode is absent from query keys and fetch arguments, so resizing does not remount the provider, reset selection, or create a new cache identity. The master and keyed arbitrary-detail subtrees remain mounted while replacement detail is visible. Component regressions prove no extra detail fetch and exactly one consumer-detail mount across wide-to-medium-to-narrow transitions. An authenticated network diagnostic recorded zero fetch/XHR requests for both Products and Help Desk while resizing 1440→1024→390→1440 after detail settled.

## U–X. Consumer and test evidence

- Products and Help Desk were exercised at 1440×900, 1280×800, 1024×768, 768×1024, 430×932, 390×844, and 360×800.
- Every viewport verified usable list/detail, the expected container mode, Back where required, and zero document horizontal overflow.
- Interaction coverage includes direct selected URLs, reload, Back-to-list, browser Back/Forward, rapid A→B→C, search while selected, selected-outside-results, and page recovery.
- Ten required visual screenshots were inspected with loaded domain detail content at wide, medium, and narrow sizes. Products image/metadata and Help Desk editor/sidebar content fit without shell clipping.
- DataView component suite: 87 tests across 4 files. Products regression: 25 tests across 3 files. Help Desk regression: 22 tests across 2 files; the combined focused run passed 134 tests across 9 files.
- The required Playwright suite passed 4 tests in Chromium: one seven-viewport layout/history matrix and one selection/search/page-recovery flow for each consumer.
- TypeScript and changed-file ESLint passed. Next.js 16.1.7 compiled successfully and generated all 188 static pages.

## Y. Phase 3 deferrals

Advanced grid keyboard navigation, broad virtualization changes, speculative prefetch, deep render profiling, persisted split widths, broad consumer migration, Repair Orders adoption, and public-web convergence remain deferred. The divergent public-web DataView was not modified.

## Z. Repair Orders suitability

The current Repair Order list already supplies table fields and a mobile card composition; these map directly to columns plus `renderMobileItem`. Its arbitrary header editor, lines list, and provenance sections can render through `renderDetail` with wide split, medium replacement, and narrow full-width detail. No Phase 2 core limitation or entity-specific extension is required. Repair Orders was not migrated.

## Baseline and isolation

- Exact Phase 2 baseline: `bde5f453a2a9095ec1d3881c1c3a26c5537c0616` (committed final Phase 1).
- Phase 2 diff is generated through an isolated temporary Git index against that commit.
- Review-bundle files are excluded from the implementation diff.
- No migrations and no public-web files are included.
- The patch contains 18 implementation paths, 1,768 lines, and 74,686 bytes.
- Patch generation used an isolated temporary index. The existing user-managed staged Phase 2 state was preserved rather than reset.
- `git apply --check` passed in a detached temporary worktree at the exact Phase 1 baseline.

## External-review corrections

The final narrow correction changes focus restoration to depend on the presentation being closed. Direct replacement deep links fall back to the list surface, and split detail that becomes replacement after resizing returns to its initiating row when available. DataView no longer installs a document Escape listener; arbitrary nested detail interactions retain Escape ownership, while the visible Back control remains authoritative. No URL, history, query, responsive-mode, or threshold behavior changed.

## Questions for the external reviewer

1. Is responsive mode based on container capability rather than viewport-only?
2. Can mode switching cause data refetch or cache identity changes?
3. Is SSR/hydration still safe?
4. Can detail semantic visibility still depend on animation?
5. Is mobile a genuine interaction model rather than a compressed desktop table?
6. Is tablet replacement preferable to an unusable split width?
7. Does Back-to-list preserve URL/history semantics?
8. Is focus restored correctly?
9. Are touch targets adequate?
10. Is reduced motion respected?
11. Is there any document-level horizontal overflow?
12. Are toolbar/filter controls usable at 360–430px?
13. Does pagination remain usable?
14. Do expanded rows work generically on narrow widths?
15. Can arbitrary consumer detail content render without clipping?
16. Are loading/error/not-found states correct in every mode?
17. Are Products-specific assumptions absent from core?
18. Are Help Desk-specific assumptions absent from core?
19. Can Repair Orders adopt this architecture without core changes?
20. Did Phase 2 alter any Phase 1 data/query semantic?
21. Is the implementation ready for Phase 3 hardening?
