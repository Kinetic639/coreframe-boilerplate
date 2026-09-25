# Zone 1 — Branch-Switch / Session-Context Deep Audit

Fresh, code-level trace of the full path: UI branch selector → `changeBranch` action → persisted branch → server context/loaders → permission context → React Query cache/query keys → Zustand/local stores → Matcher caches → route/data reload. This does NOT carry forward the old Zone 1 audit's "mostly done" framing — it is a from-scratch re-verification, confirming the product owner's own suspicion of real branch-switch bugs.

## Overall verdict: HAS CONFIRMED BUGS THAT WOULD BE VISIBLE IN A DEMO

Not merely "risky" — three concrete, named, file-and-line-cited bugs were found and confirmed live against current code. The underlying data isolation itself is sound (RLS + server-side re-derivation of org/branch on every write and every server-rendered page load) — so the risk is confined to **stale/wrong-branch information displayed in the UI until reload**, not data corruption or cross-tenant leakage. A correct pattern already exists elsewhere in the same codebase (Warehouse Map page, permission query), so the fix is small, localized, and low-risk.

## CONFIRMED BUG #1 (ROOT CAUSE) — Branch switch never triggers a refresh or cache invalidation

- **File**: `apps/web/src/app/[locale]/dashboard/_components/sidebar-branch-switcher.tsx`
- **Function**: `SidebarBranchSwitcher.handleBranchSelect`
- **Current behavior**: after a successful `changeBranch(branchId)` call, only `setActiveBranch(branchId)` (a Zustand store update) runs. No `router.refresh()`, no `queryClient.invalidateQueries()`/`resetQueries()`, no navigation of any kind. Confirmed via a full-repo grep for `router.refresh()` — every hit belongs to unrelated mutation flows, none wired to branch switching.
- **Expected behavior**: switching branches should guarantee every consumer of branch-scoped data gets fresh data — at minimum a `router.refresh()` after a successful switch.
- **Reproduction path**: on any server-rendered dashboard page (e.g. `/dashboard/workshop`, `/dashboard/workshop/[id]`), without navigating, switch branches via the sidebar. The main content pane keeps showing the branch you just left.
- **Pitch impact**: **HIGH** — this is the mechanism that makes bugs #2 and #3 below actually visible on screen; a presenter clicking the branch switcher on almost any page will see nothing update.
- **Likely narrow fix**: call `router.refresh()` (or a broad `queryClient.invalidateQueries()` predicate) inside `handleBranchSelect` right after `setActiveBranch` succeeds.
- **Test needed**: manual browser UAT (switch branch while parked on each major list/detail page) + a Playwright/e2e regression asserting DOM content changes after a branch switch without a full page reload.

## CONFIRMED BUG #2 — Matcher session list cache key has no branch segment

- **File**: `apps/web/src/hooks/queries/tools/wdd-matcher.ts:31-63`, consumed by `apps/web/src/components/tools/svwms-wdd-matcher/index.tsx:53`
- **Function**: `wddMatcherKeys.sessions()` / `useSessionsQuery()`
- **Current behavior**: `sessions: () => [...wddMatcherKeys.all, "sessions"]` — no `branchId`. The server action (`listSessionsAction`) and service (`WddMatcherService.listSessions`) DO correctly re-derive and filter by branch on every call — but the client cache key never changes, `staleTime` is 2 minutes, and the app's default `QueryClient` has `refetchOnWindowFocus: false`. Combined with Bug #1, the "Past uploads" list shows the wrong branch's sessions indefinitely.
- **Expected behavior**: `wddMatcherKeys.sessions(branchId)`, mirroring the sibling `workshopKeys.lineReservations(branchId, lineId)` pattern, which was itself patched for exactly this bug class in an earlier "Phase 10A correction."
- **Reproduction path**: open Matcher in Branch A, note "Past uploads." Switch to Branch B via the sidebar without navigating. The list still shows Branch A's sessions; uploading a new file in Branch B visually mixes with Branch A's stale history in the same list.
- **Pitch impact**: **HIGH** — this is precisely the area the product owner explicitly named as suspect, and Matcher is a headline pitch feature (confirmed as GREEN/central in `pitch-script-truth-matrix.md`).
- **Likely narrow fix**: thread live `activeBranchId` into the key factory and `useSessionsQuery`; update the 3 `invalidateQueries` call sites accordingly.
- **Test needed**: unit test on the key factory (branch change ⇒ different key) + manual/Playwright UAT.

## CONFIRMED BUG #3 — Warehouse Locations / Inventory Movements / Inventory Balances lists are not branch-scoped in their cache keys

- **Files**: `locations-data-view.tsx:302` (`queryKey={["locations"]}`), `inventory-movements-client.tsx:191` (`queryKey={["inventory-movements"]}`), `inventory-client.tsx:335` (`queryKey={["inventory-balances"]}`) — root cause in the shared `use-data-view-query.ts:14-33`, whose `listParams` never includes `branchId`.
- **Current behavior**: all three DataView instances pass a static, branch-agnostic literal as `queryKey`. Server actions correctly re-derive branch server-side, but the client cache key never changes (`staleTime: 30s`, no window-focus refetch), so tables keep rendering the previous branch's rows after a switch — indefinitely, given Bug #1. `InventoryMovementsClient` additionally receives `activeBranchId` as a frozen SSR prop rather than reading it live from the Zustand store (contrast with the correctly-implemented `map-list-client.tsx:185`, which reads it live).
- **Expected behavior**: `queryKey` should include live `activeBranchId` for every branch-scoped entity (e.g. `["locations", activeBranchId]`).
- **Reproduction path**: open `/dashboard/warehouse/locations` (or `.../inventory`, `.../inventory/movements`) in Branch A, switch to Branch B without navigating — the table keeps showing Branch A's data.
- **Pitch impact**: **HIGH** — Warehouse is this product's flagship module and these are exactly the screens most likely to be shown live.
- **Likely narrow fix**: thread live `activeBranchId` into each `queryKey` prop; consider making `DataViewProvider` require a `branchId` prop it always appends internally, so future instances can't omit it.
- **Test needed**: manual/Playwright UAT on all three pages; consider a lint rule/unit test asserting every branch-scoped `<DataView queryKey=...>` call site includes `activeBranchId`.

## RISK (same root cause as #1, lower severity) — RepairOrder detail page frozen on stale branch

- **File**: `apps/web/src/app/[locale]/dashboard/workshop/[id]/page.tsx`
- **Current behavior**: a pure Server Component with correct branch-scoping and cross-branch `notFound()` logic — but only on a fresh render. Because of Bug #1, if a user is viewing a RepairOrder in Branch A and switches to Branch B without navigating, the page does not re-render and keeps showing Branch A's order under a UI now claiming Branch B is active.
- **Pitch impact**: MEDIUM — requires parking on a specific record then switching, a less likely default demo path than a list page; self-heals on any real navigation (no client cache holding it hostage).
- **Likely narrow fix**: fully covered by the Bug #1 fix — no separate work needed.

## Verified CLEAN — no bug found, with evidence

- **`changeBranch` server action** (`src/app/actions/shared/changeBranch.ts:22-82`): uses JWT-validated `getUser()`, validates target-branch membership/authorization before persisting. No privilege-escalation path via branch switching.
- **Server loaders** (`load-app-context.v2.ts`, `load-dashboard-context.v2.ts`): only React's per-request `cache()` (dedupes within one request, never across requests) — no `unstable_cache`/fetch-cache layer that could serve a stale org/branch across requests. Middleware does only auth-session refresh + locale rewriting.
- **Deterministic branch resolution / inaccessible-branch handling**: `resolveActiveBranch` (`packages/domain/src/branch.ts:23-31`) is a pure, tested fallback (preferred → first accessible → null); `loadDashboardContextV2` re-validates on every load and reloads the permission snapshot on fallback — a user whose active branch was deleted/revoked lands safely, no crash/loop.
- **Permission snapshot re-resolution**: `useBranchPermissionsQuery` correctly keys by `["v2","permissions",orgId,branchId]`, auto-refetches on switch — this is the architecture's own reference implementation of "do it right."
- **Session-local branch isolation** (`session-branch.ts`): sessionStorage keyed per-org, per-tab, explicitly designed so one tab's DB write doesn't hijack another tab's working branch; covered by its own test file.
- **Zustand stores**: only 3 exist (`app-store.v2`, `user-store.v2`, `ui-store.v2`) — `app-store.v2`/`user-store.v2` are NOT persisted (in-memory, rehydrated per load); `ui-store.v2` IS localStorage-persisted but holds only UI prefs (theme, sidebar state), no branch-scoped domain data, zero leakage risk.
- **A correct branch-scoped query-key pattern already exists and works**: the Warehouse Map page (`map-list-client.tsx:185`) reads `activeBranchId` live and self-heals correctly on branch switch without any navigation — proof the intended pattern works when followed, and that the team has previously identified and fixed this exact bug class (`workshopKeys.lineReservations`'s own "Phase 10A correction") without applying it consistently everywhere.
- **No cross-branch data-corruption risk**: every write-path server action checked re-derives org/branch fresh from `loadDashboardContextV2()` server-side, never trusting a client-supplied branch value — confirming the bugs found are display/staleness-only, never a wrong-branch WRITE risk.

## Zone 1 classification (final, this audit)

**PITCH BLOCKER.** Three confirmed, HIGH-pitch-impact bugs, all touching screens/features explicitly central to the current master pitch script (Matcher, Warehouse Locations/Movements/Balances). All three share one root cause (Bug #1) and one already-proven-correct fix pattern elsewhere in the codebase — this is a small, well-scoped, low-risk fix, not a rearchitecture, but it must be done and manually re-verified on the current build before Zone 1 can be called DEMO READY per its own doc's own "Status change rules" (static inspection and passing tests alone cannot promote Zone 1 — only fresh current-build manual verification can).
