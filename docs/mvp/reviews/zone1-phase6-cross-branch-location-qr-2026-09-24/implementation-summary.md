# Zone 1 / Phase 6 — Cross-branch `warehouse.location` deep-link / QR — Implementation Summary

**Starting SHA:** 9ecb08d1da74a81e1d168037c75b41702633d1fb
**Branch:** zone3-zone5-integration-audit
**Date:** 2026-09-24 (original implementation), corrected same day (pre-commit review), commit finalized 2026-09-24
**Status:** DONE, CORRECTED — this is the FINAL, post-correction architecture description. See `phase6-closeout.md` for the full before/after narrative of what the correction changed and why.

## Objective

Scanning/opening a `warehouse.location` QR/deep-link for an object in a different branch than the current active one prompts a confirm-then-switch dialog when the caller has access to the target branch, instead of silently falling back to the current branch's first location. An inaccessible-branch target is safely denied with no switch offer at all. A logged-out scan is routed through sign-in and back to this same resolution logic, now running under an authenticated context, before any dashboard redirect is ever computed.

## Design (final, corrected)

Two independent layers, each reusing existing, already-accepted infrastructure:

1. **Server: `resolvePublicQrToken` gains an access-aware UX hint, never an authorization decision.** After the existing (unchanged) QR/target/org validation succeeds, the resolver calls `loadDashboardContextV2()` — the same authoritative, request-cached context loader every dashboard page and `changeBranch()` itself already use — which supplies `activeBranchId`, `accessibleBranches`, and `permissionSnapshot` for the caller. Three outcomes:
   - **Anonymous caller** (`loadDashboardContextV2()` returns `null`): redirected to `/sign-in?returnUrl=/qr/<token>` (or the localized `/<locale>/qr/<token>` equivalent) — the QR page itself, not the pre-computed dashboard path, so the deep-link intent survives the sign-in round trip losslessly (the QR page's URL has no query string to lose). After login, the browser re-requests the QR page, which calls this same resolver again — now authenticated — before any dashboard redirect is computed.
   - **Same branch, or different branch the caller cannot access:** for the latter, the resolver calls the shared `isBranchAccessible(branchId, accessibleBranches, permissionSnapshot)` helper (`@/lib/utils/branch-access.ts`) — the exact same check `changeBranch()` itself performs. When it returns false, the resolver returns the existing `{ok:false, error:"TARGET_NOT_FOUND", token}` shape: no `crossBranch` hint, no dashboard redirect, no switch dialog, no `changeBranch` call. Same branch simply proceeds with the unmodified redirect.
   - **Different branch, accessible:** a `crossBranch=<targetBranchId>` query param is appended to the redirect — a UX hint only, never authorization evidence.
2. **Client: `AmbraLocationsClient` interprets the hint.** On mount, if both `selected` and `crossBranch` are present in the URL, the target location ID is held in a `pendingCrossBranch` state (deliberately kept OUT of `treeSelectedId`, so the pre-existing reset-effect can never silently fall back before the user responds) and a shadcn/ui `AlertDialog` is shown. Confirming calls the existing, authoritative `changeBranch()` server action — the same one used by Phase 1's sidebar switcher, and internally now using the same `isBranchAccessible()` helper the resolver's hint decision used — and only on `result.success` does it update the Zustand branch store and navigate to the exact target location. Cancelling clears the pending state and the `crossBranch` URL param with no branch mutation. The exact target location survives the switch via `router.replace`'s explicit `query.selected`. `key={branchId}` on the Server Component parent forces a full remount after a same-route branch switch (`router.refresh()` alone does not reset an already-mounted client component's `useState`). Both dialog buttons call `event.preventDefault()` to stop Radix's `AlertDialogAction`/`AlertDialogCancel` (internally `DialogPrimitive.Close`) from auto-closing the dialog before the app's own state transitions run.

**Critical invariant preserved:** the `crossBranch` hint is a UI signal only, and it is now itself gated by the same authorization check that guards the real switch. The server never trusts client input for authorization, and neither does the client — `changeBranch()` remains the single point that re-validates access fresh on every call. A client-supplied or QR-derived branchId is never authorization evidence anywhere in this flow. `isBranchAccessible()` is shared, not duplicated, between the resolver's hint decision and `changeBranch()`'s own real decision, so the two can never drift apart.

## Factual correction to the plan (original implementation, still accurate)

The plan's original interception point (`LocationsPage.tsx`'s reset-effect) is a purely presentational, controlled child — confirmed via grep that it has exactly one consumer, `AmbraLocationsClient`. All new state and UI landed in `ambra-locations-client.tsx` instead. `LocationsPage.tsx` was not modified. See the implementation plan's Phase 6 section and the progress tracker's Phase 6 detailed tracking for the full correction, preserved alongside the original wording.

## Issues found and fixed during implementation and correction

1. **`page.tsx` needed a `key={branchId}` prop** (original implementation). `router.refresh()` re-executes Server Components but does not reset an already-mounted client component's own `useState`. Phase 1's sidebar switch always navigates to a different route, guaranteeing a natural remount; this QR flow deliberately stays on the same route to preserve the deep-link target, so nothing would otherwise force `AmbraLocationsClient` to reset its state after a same-route branch switch. Caught by reasoning about Next.js's documented semantics before writing a test.
2. **Radix `AlertDialogAction`/`AlertDialogCancel` auto-close bug** (original implementation). Both are thin wrappers over `DialogPrimitive.Close`, which fires the dialog's own `onOpenChange(false)` on every click via `composeEventHandlers`, independent of any custom `onClick`. Fixed with `event.preventDefault()` in both buttons' click handlers — see `security-review.md` and `cross-branch-flow.md` for detail.
3. **Inaccessible cross-branch target showed an impossible switch offer** (found in pre-commit review, fixed in the correction pass). The original implementation appended `crossBranch` for any same-org branch mismatch, regardless of whether the caller could access the target branch, relying on `changeBranch()` to reject it only after the user clicked Confirm. Fixed by gating the hint on the new shared `isBranchAccessible()` helper — see "Design" above.
4. **Logged-out flow silently dropped deep-link intent on the sign-in round trip** (found in pre-commit review, fixed in the correction pass). Tracing the real flow found `dashboard/layout.tsx`'s returnUrl mechanism preserves only the request pathname (excludes the query string), so an anonymous caller's `selected=<id>` would have been dropped, and the branch-aware hint logic would never have run under an authenticated context. Fixed by routing anonymous callers through `/qr/<token>` instead of the pre-computed dashboard path — see "Design" above.

## Files changed

See `changed-files.md` and `diff.patch` for the complete, final file list (including the correction's `apps/web/src/lib/utils/branch-access.ts` and the refactored `apps/web/src/app/actions/shared/changeBranch.ts`).

## Out of scope (confirmed untouched)

- `inventory.container` / Phase 10D container QR — zero files touched.
- Per-part QR — not added.
- `helpdesk.ticket` / `planning.task` generalization — the resolver's access-aware hint mechanism is generic (keyed off `validation.branchId`, present for any registry entry with a branch), but no other target type's destination page reads or interprets the param, so this phase has zero behavioral effect on those target types.
- No DB/schema/RLS change.

## Next phase

Phase 7 — Automated closeout.
