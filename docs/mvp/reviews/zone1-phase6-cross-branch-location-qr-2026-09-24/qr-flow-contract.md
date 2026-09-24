# Zone 1 / Phase 6 — QR/Deep-link Flow Contract

Scope: `warehouse.location` QR codes / deep links only. Covers every scenario the phase's own task explicitly required.

> **Corrected 2026-09-24.** A pre-commit review found two contract gaps in the original implementation: (1) an inaccessible cross-branch target still showed a "Switch branch" confirmation, relying on `changeBranch()` to reject it only after the user confirmed — an impossible-UX offer, not a leak, but not the accepted contract either; (2) the logged-out flow was only proven to preserve the _redirect string_, not proven to re-evaluate branch access under the authenticated user after login. Both are fixed below (Cases C and D rewritten); Cases A and B are unchanged from the original implementation.

## Case A — Same branch (target's branch == caller's active branch)

1. QR/deep-link resolves via `resolvePublicQrToken` as before this phase.
2. The caller's own active branch (`loadDashboardContextV2().app.activeBranchId` — the same authoritative, re-validated active-branch resolution every dashboard page and `changeBranch()` itself use) is read and compared to the target's branch. They match, so no `crossBranch` param is appended.
3. Redirect lands on `/dashboard/warehouse/locations?selected=<id>&view=tree` — identical shape to pre-Phase-6 behavior.
4. `AmbraLocationsClient` reads `selected` from the URL on mount, passes it straight through as `treeSelectedId`. No dialog. No `changeBranch` call.

**Test:** `ambra-locations-client.cross-branch.test.tsx` → "same-branch flow"; `public-token-resolver.test.ts` → "same branch: no crossBranch hint, target opens directly".

## Case B — Accessible cross-branch (target's branch != caller's active branch, caller HAS access to the target branch)

1. `resolvePublicQrToken` detects the branch mismatch (caller is logged in, has a resolved `activeBranchId`, and `isBranchAccessible()` — the same access check `changeBranch()` itself uses — returns true for the target branch) and appends `crossBranch=<targetBranchId>`.
2. Redirect lands on `/dashboard/warehouse/locations?selected=<id>&crossBranch=<targetBranchId>&view=tree`.
3. `AmbraLocationsClient` reads both params on mount. `treeSelectedId` stays `null` (the target is NOT auto-opened); `pendingCrossBranch = {targetBranchId, targetLocationId}` is set instead.
4. A confirm `AlertDialog` renders: "Switch branch to view this location?" with Cancel/Switch branch actions.
   - **Cancel:** `pendingCrossBranch` cleared, `crossBranch` stripped from the URL via `history.replaceState`. No `changeBranch` call. No branch-state mutation. Current branch (A) remains active and authoritative. No target ever opened.
   - **Confirm:** `changeBranch(targetBranchId)` is called — the same authoritative server action Phase 1's sidebar switcher uses, which re-validates the caller's access to the target branch fresh, server-side, via the exact same `isBranchAccessible()` check the resolver's own hint decision used. Access to the target branch was never assumed from the mere presence of the `crossBranch` hint — the hint is UX-only, confirmed twice independently (once to decide whether to show the hint, once again inside `changeBranch()` before actually switching).
     - **On success:** `useAppStoreV2.getState().setActiveBranch(targetBranchId)` updates the client store; `router.replace({pathname: "/dashboard/warehouse/locations", query: {selected: targetLocationId, view: "tree"}})` preserves the exact deep-link target across the switch; `router.refresh()` re-executes the Server Component. The Server Component's `key={branchId}` on `<AmbraLocationsClient>` forces a full remount, which re-reads the (now `crossBranch`-free) URL and opens the exact target location under the new branch, in-tree.
     - **On failure** (`changeBranch` returns `{success: false}` or throws — e.g. a race where access was revoked between the hint being computed and the confirm click): a safe error toast is shown (`result.error` when present, else a generic fallback message); `isSwitchingBranch` resets to `false`; `pendingCrossBranch` is left untouched, so the dialog remains open for the user to retry or explicitly cancel. No false branch state is ever written to the client store, and no navigation occurs.

**Tests:** `ambra-locations-client.cross-branch.test.tsx` → "accessible cross-branch flow" (dialog appears, cancel, confirm-success, no-silent-switch-on-mount) and "failed switch"; `public-token-resolver.test.ts` → "accessible cross-branch: adds crossBranch..." and "...via wildcard permission".

## Case C — Inaccessible cross-branch (target's branch != caller's active branch, caller does NOT have access) — CORRECTED

**Original (incorrect) behavior:** the `crossBranch` hint was appended for ANY same-org target with a branch mismatch, regardless of whether the caller could actually access that branch. The confirm dialog would appear and offer "Switch branch"; only clicking Confirm and having `changeBranch()` reject it server-side revealed the denial. Not a leak (no protected content was ever rendered, no metadata disclosed beyond "a location exists in another branch" — already implied by the QR/deep-link itself), but not the accepted contract: the dialog should never offer an action that can never succeed.

**Corrected behavior:** the resolver now checks `isBranchAccessible(targetBranchId, accessibleBranches, permissionSnapshot)` — the exact same authorization check `changeBranch()` itself performs, extracted to a shared helper (`@/lib/utils/branch-access.ts`) so the UX-hint decision and the actual authorization decision can never drift apart — BEFORE deciding whether to append `crossBranch`. If the caller cannot access the target branch:

- NO `crossBranch` param is appended.
- The resolver instead returns `{ok: false, error: "TARGET_NOT_FOUND", token}` — the exact same failure shape already used for a cross-org or soft-deleted target. No new error variant, no branch name/slug/metadata disclosed.
- The caller lands on the QR page's own existing, unmodified "not found" card (`/[locale]/qr/[token]/page.tsx`), not on `/dashboard/warehouse/locations` at all.
- `AmbraLocationsClient` never mounts for this scenario, so it never has an opportunity to render a dialog, call `changeBranch`, or open the target — the denial happens entirely server-side, before any dashboard redirect is computed.

**Tests:** `public-token-resolver.test.ts` → "Correction A — inaccessible cross-branch: does NOT add crossBranch, returns safe denial instead of an impossible switch offer" and "...denial reveals nothing beyond the existing TARGET_NOT_FOUND shape"; `ambra-locations-client.cross-branch.test.tsx` → "inaccessible cross-branch target (Correction A)" (documents that the client cannot and need not distinguish this case from Case A, by design).

## Case D — Logged-out scan — CORRECTED

**Original (incomplete) behavior:** the resolver's cross-branch block called `getUser()`, found no user, and skipped the hint — returning the ORIGINAL, unmodified dashboard redirect path (`/dashboard/warehouse/locations?selected=<id>&view=tree`). This was proven byte-for-byte unchanged, but never traced through what actually happens next. Tracing it (this correction) found: `dashboard/layout.tsx`'s own auth gate redirects an unauthenticated request to `/sign-in?returnUrl=<pathname>`, where `<pathname>` comes from the `x-pathname` header set in `proxy.ts` from `request.nextUrl.pathname` — which **excludes the query string** by construction. This means the ORIGINAL flow would have silently dropped `selected=<id>` (and, for a cross-branch target, would never have had a chance to compute `crossBranch` at all, since that computation only ever ran for an already-authenticated caller) the moment the dashboard layout's auth gate fired. This was a real, pre-existing gap in the generic returnUrl mechanism (not introduced by Phase 6), newly surfaced by tracing the real flow as this correction required.

**Corrected behavior:**

1. `resolvePublicQrToken` now calls `loadDashboardContextV2()` (instead of a bespoke `getUser()` + `user_preferences` lookup) for any target with a `branchId`. This returns `null` for an anonymous caller — its own documented contract ("Returns null when no session exists").
2. When `null`, the resolver returns `{ok: true, redirectPath: "/sign-in?returnUrl=<qrPath>"}`, where `qrPath` is `/qr/<token>` (or `/<locale>/qr/<token>` when a locale was supplied) — the QR page itself, NOT the pre-computed dashboard target.
3. The QR page's own redirect string has no query string to lose (the entire intent lives in the `token` path segment), so nothing is dropped on the sign-in round trip.
4. The existing, unmodified `signInAction` (`apps/web/src/app/[locale]/actions.ts`) redirects back to `returnUrl` after a successful login — validated same-origin (`startsWith("/")`, not `startsWith("//")`), unchanged, not touched by this correction.
5. The browser re-requests `/qr/<token>` (or the localized equivalent), which calls `resolvePublicQrToken` again — this time `loadDashboardContextV2()` returns a real, authenticated context, so Cases A/B/C above run exactly as documented, under the caller's real, authenticated, branch-aware context, before any dashboard redirect is ever computed.
6. Only after this re-evaluation does the browser ever reach `/dashboard/warehouse/locations` — by which point the request is already authenticated, so the dashboard layout's own auth gate never fires again and never strips anything.

**Required end state (verified):** same branch → exact target opens; accessible other branch → confirm dialog; inaccessible other branch → safe denial. No silent fallback. No direct post-login bypass of the branch-aware resolver logic — there is no path from an anonymous scan to `/dashboard/warehouse/locations` that does not pass back through `resolvePublicQrToken` under an authenticated context first.

**Tests:** `public-token-resolver.test.ts` → "Correction B — logged-out caller" describe block: sign-in redirect shape, localized variant, open-redirect safety (`returnUrl` starts with `/`, never `//`), plus three "real auth-return integration" tests that call `resolvePublicQrToken` twice with the same token (anonymous, then authenticated) and assert the second call correctly re-evaluates same-branch / accessible-cross-branch / inaccessible-cross-branch outcomes. The final browser-level proof (a real login round trip in a real browser) remains deferred to Phase 8's manual UAT, as originally planned — this correction proves the mechanism end-to-end at the service-integration boundary, the strongest proof available without a running browser.

## Non-scenario: caller has no resolved active branch

If a logged-in caller's `activeBranchId` is `null` (e.g. zero accessible branches in their active org), the mismatch check short-circuits false, and no `crossBranch` param is appended — a safe fallback to pre-Phase-6 behavior rather than guessing intent. Unchanged by this correction.

**Test:** `public-token-resolver.test.ts` → "no resolved active branch: no crossBranch, unmodified redirect (safe fallback, unchanged)".
