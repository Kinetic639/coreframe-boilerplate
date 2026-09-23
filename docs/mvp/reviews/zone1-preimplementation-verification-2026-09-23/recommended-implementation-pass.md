# Zone 1 — Recommended Next Implementation Pass

Specific enough to execute without another architecture audit. Scoped to DEMO READY items only (Section A of `demo-vs-pilot-boundary.md`) — PILOT items are listed there for later, not designed here.

**Design principle applied**: prefer the smallest coherent fix that resolves the SYSTEMIC problem over per-screen patches, per this task's own instruction — specifically, one centralized branch-transition fix (not 5 separate ad-hoc `router.refresh()` calls scattered across pages) plus a systematic query-key convention (not 4 separate one-off key edits with no guardrail against a 5th instance next month).

## Change 1 — Centralized branch-transition fix (the root-cause fix)

- **File(s)**: `apps/web/src/app/[locale]/dashboard/_components/sidebar-branch-switcher.tsx` (the call site), likely a new small shared helper (e.g. `apps/web/src/lib/branch-transition.ts` or inlined if small enough) that `handleBranchSelect` calls.
- **Function/component**: `SidebarBranchSwitcher.handleBranchSelect`.
- **Change type**: bug fix (small, localized) — add `router.refresh()` after the successful `changeBranch()` call, then navigate to a safe start route (per Zone 1 decision 22's own "redirect to a safe start screen" requirement) rather than leaving the user on a page that may show a now-wrong-branch object (e.g. a Movement/RepairOrder detail page for an id that doesn't exist in the new branch).
- **Why needed**: this is the confirmed root cause behind the RSC-tree staleness half of the systemic bug (RepairOrder list/detail, Movement detail/edit pages have no client cache at all — only `router.refresh()` fixes them).
- **Dependency**: none — can start immediately, in parallel with Change 2.
- **DB mutation/migration required**: No.
- **Architecture impact**: NONE / SMALL LOCAL.
- **Automated tests to add/update**: extend the existing `sidebar-branch-switcher.test.tsx` (currently passing) to assert `router.refresh()`/navigation is called on a successful switch.
- **Manual UAT required**: YES — switch branch while parked on a RepairOrder detail page and a Movement detail page for objects belonging to the OLD branch; confirm the user lands on a safe screen, not a broken/404 page and not stale data.
- **Rollback/risk note**: low risk — this is additive (a new call), doesn't remove any existing behavior. The main risk is over-broad `router.refresh()` triggering more re-fetching than strictly necessary on every switch (a UX/perf concern, not a correctness one) — acceptable for this week's scope.

## Change 2 — Systematic branch-scoped query-key convention

- **File(s)**: `apps/web/src/components/data-view/use-data-view-query.ts` (add an optional `branchId` that's automatically merged into every `DataView`-driven query key), plus the 4 confirmed call sites: `locations-data-view.tsx`, `inventory-client.tsx`, `inventory-movements-client.tsx`, `inventory-products-client.tsx`. Also `apps/web/src/hooks/queries/tools/wdd-matcher.ts` (`wddMatcherKeys.sessions()`, following the exact pattern already proven correct in `workshopKeys.lineReservations(branchId, lineId)`).
- **Function/component**: `use-data-view-query.ts`'s key-building logic; each of the 5 call sites' own `queryKey` prop; the 2-3 `invalidateQueries` call sites in `wdd-matcher.ts` that reference `wddMatcherKeys.sessions()`.
- **Change type**: small refactor (systematic, not per-screen ad-hoc) — the `DataView`-level fix closes this bug class for good (any FUTURE branch-scoped `DataView` screen inherits correct behavior automatically, rather than needing to remember to add `branchId` manually, which is exactly how 4-for-4 existing instances got this wrong).
- **Why needed**: 4 confirmed, structurally-identical `DataView` bugs (one newly found this pass) plus the Matcher sessions bug — all share the same root cause (no `branchId` in the query key), confirmed to recur because the underlying `DataViewListParams` type has no `branchId` field at all.
- **Dependency**: none — can run in parallel with Change 1 (though its own manual UAT is more useful once Change 1 has also landed, so a branch switch doesn't leave the user on a stale-object page even after the list itself correctly refetches).
- **DB mutation/migration required**: No.
- **Architecture impact**: SMALL LOCAL (touches a shared component's own type/logic, but is additive and backward-compatible for any `DataView` instance that doesn't pass `branchId`, i.e. correctly org-scoped screens are unaffected).
- **Automated tests to add/update**: a unit test on `use-data-view-query.ts`'s own key-building function (branch change ⇒ different key); a unit test on the `wddMatcherKeys.sessions` factory (branch change ⇒ different key), matching the existing pattern.
- **Manual UAT required**: YES — for each of the 5 fixed surfaces, switch branch while viewing the list and confirm the content updates without a manual reload.
- **Rollback/risk note**: low risk. The main thing to verify is that adding `branchId` to `DataViewListParams` doesn't accidentally affect the correctly org-scoped `DataView` instances (Tickets, CRM, etc.) — since the field should be OPTIONAL and only populated by callers that pass it, this should be a non-issue, but worth an explicit regression check on 1-2 org-scoped `DataView` screens as part of manual UAT.

## Change 3 — Cross-branch QR/deep-link confirm-then-switch (for `warehouse.location`)

- **File(s)**: `apps/web/src/server/qr/public-token-resolver.ts` (needs to additionally read the caller's current active branch, when logged in, and encode a `crossBranch` flag on the redirect instead of a bare `selected=` param), `apps/web/src/app/[locale]/dashboard/warehouse/locations/_ambra/components/locations/LocationsPage.tsx` (the existing reset-effect at ~line 485-490 is the natural interception point — render a confirm dialog instead of silently falling back to `locations[0]` when a `crossBranch` param is present).
- **Function/component**: `resolvePublicQrToken`; `LocationsPage`'s own location-selection-reset effect.
- **Change type**: small feature addition (UI + minor service change) — NOT a new authorization system. The confirm action calls the ALREADY-CORRECT, already-validated `changeBranch()` server action.
- **Why needed**: the accepted product contract (Decisions 24-27) requires confirm-then-switch for accessible cross-branch objects and safe denial for inaccessible ones; today the deep-link intent is silently dropped in both cases (safe, but not per-spec, and materially worse for the pitch demo's own QR-scan moment).
- **Dependency**: Change 1 should land first (so the confirm→switch flow benefits from the same safe-redirect/refresh fix, rather than confirming into another stale-page situation).
- **DB mutation/migration required**: No.
- **Architecture impact**: SMALL LOCAL — reuses `changeBranch()` entirely; no new authorization primitive.
- **Automated tests to add/update**: extend or add a test for `resolvePublicQrToken`'s new cross-branch-flag behavior; a component test for the new confirm dialog in `LocationsPage`.
- **Manual UAT required**: YES, on the actual presentation phone — scan a location QR belonging to a DIFFERENT branch than the one currently active, confirm the dialog appears, confirm switching works, confirm cancel leaves the user safely on the original branch.
- **Rollback/risk note**: low risk, purely additive UI. If descoped for time, the current silent-fallback behavior remains SAFE (no leak, no unwanted switch) — just not per-spec UX. This is the one item of the three that could reasonably be cut from this week's scope if time runs short, without leaving a security gap behind — only a UX gap.

## Explicitly NOT included in this implementation pass

Every item in `demo-vs-pilot-boundary.md` Section B (owner protection, anti-escalation, RLS hardening for Matcher/HelpDesk, schema reconciliation, one-org DB enforcement, unsaved-work generalization, live-DB RLS test-env fix, auditability) — all PILOT scope, correctly deferred, not designed here per this task's own explicit instruction not to pull PILOT-only IAM hardening into this week's critical path.

## Recommended sequence

1. Change 1 and Change 2 in parallel (both are independent, both are P0-sized S-M work).
2. Change 3 after Change 1 lands (benefits from the safe-redirect behavior); can be descoped under time pressure without leaving a security gap.
3. Manual UAT for all three, in the order above, culminating in a full branch-switch-mid-demo rehearsal across every screen listed in `gap-matrix.md`'s branch-scoped rows.
