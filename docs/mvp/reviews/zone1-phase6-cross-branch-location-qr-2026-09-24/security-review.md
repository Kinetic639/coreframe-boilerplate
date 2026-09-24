# Zone 1 / Phase 6 — Static Security Review

> **Corrected 2026-09-24.** Re-run in full after the correction pass (Correction A: access-aware cross-branch hint; Correction B: logged-out auth-return re-evaluation). Items below reflect the CORRECTED code. See `phase6-closeout.md` for the acceptance-criteria walkthrough.

Reviewed against the same checklist the phase's own task specified. Every item below is a statement about the code as it exists in this dirty working tree, verified by direct reading of the diff plus the new tests.

## 1. No client-provided branchId is trusted for authorization

Unchanged principle, now enforced at TWO independent points instead of one. The `crossBranch` query param is produced server-side (inside `resolvePublicQrToken`, from `validation.branchId` — derived from the target row via the service-role client, never from client input) and is now only emitted after `isBranchAccessible()` — the same check `changeBranch()` itself performs — has already confirmed the caller can access it. It is still consumed client-side purely to decide whether to _show a dialog_. The one and only place a branch switch is actually authorized remains `changeBranch(pendingCrossBranch.targetBranchId)` — the same pre-existing, unmodified server action Phase 1's sidebar switcher uses, which re-validates the caller's membership/access to the target branch fresh, server-side, on every call, via the exact same `isBranchAccessible()` helper. Neither the resolver's `crossBranch` hint nor the client's `pendingCrossBranch` state is ever passed to any data-fetching or mutation call as if it were pre-authorized.

## 2. No leaked metadata for inaccessible targets — GAP CLOSED (Correction A)

**Before:** the dialog appearing for an inaccessible branch was analyzed as "not itself a leak" since it only revealed "a location exists in another branch" (already implied by the QR/deep-link). That analysis was correct as far as it went, but the accepted product contract required more: no switch-confirm offer at all for a target the user cannot reach, not merely "the offer is safe to show." **After:** the resolver now returns the exact same `{ok: false, error: "TARGET_NOT_FOUND", token}` shape already used for a cross-org or soft-deleted target — verified by test to contain only `{ok, error, token}`, no branch id, name, or slug. The caller cannot distinguish "wrong org", "soft-deleted", and "right org, inaccessible branch" from the response shape, which is a stronger, not weaker, privacy property than before.

## 3. No open redirect introduced

Unchanged: `rawPath` is built exclusively from the pre-existing, already-validated descriptor-resolved path plus a hardcoded `crossBranch=` prefix and the server-derived `validation.branchId` (a UUID from the database, not user input). **New this correction:** the sign-in redirect (`/sign-in?returnUrl=<qrPath>`) is built from a hardcoded `/sign-in` (or `/logowanie` when localized) prefix plus `qrPath = /qr/<token>` (or `/<locale>/qr/<token>`) — `token` is concatenated as a path suffix after a hardcoded `/qr/` prefix, so the resulting string always starts with `/qr/` regardless of token content; it cannot become a protocol-relative (`//`) or cross-origin URL. `encodeURIComponent(qrPath)` additionally prevents the token from breaking out of the `returnUrl` query-value structure. Independently, `signInAction`'s own pre-existing, unmodified validation (`trimmedReturnUrl.startsWith("/") && !trimmedReturnUrl.startsWith("//")`) provides a second, independent layer of protection regardless of what this resolver produces. Verified by a dedicated test asserting the produced `returnUrl` satisfies both conditions.

## 4. No silent branch switch

Unchanged, verified by test (`ambra-locations-client.cross-branch.test.tsx` → "no silent switch occurs on mount"): rendering the confirm dialog alone never calls `changeBranch`. The switch only happens after an explicit user click on "Switch branch" (Confirm). This is now further reinforced: for an inaccessible target, the dialog is never even rendered (Correction A), so there is no UI surface from which a switch could be silently triggered in the first place.

## 5. No `changeBranch` bypass

Unchanged: the flow calls the real, unmodified `changeBranch()` server action — not a reimplementation, not a direct Zustand mutation followed by a fake "success." `useAppStoreV2.getState().setActiveBranch(...)` (the client-side store update) is only ever called AFTER `result.success` is confirmed true. **New this correction:** `changeBranch()`'s own internal authorization check was refactored (not reimplemented) into the shared `isBranchAccessible()` helper — `changeBranch.test.ts` re-run and confirmed passing unchanged, proving this refactor preserved its exact existing behavior.

## 6. No QR token scope expansion

Unchanged: `qr_codes`/`qr_assignments`/target-registry validation logic is untouched by this correction. No new QR target type, no new permission granted by possessing a QR token.

## 7. No `inventory.container` / Phase 10D touch

Confirmed via `git status`: zero files under any container/repair-order/Phase 10D path were modified by this correction.

## 8. No per-part QR added

Confirmed: no new QR target type was added to `QR_TARGET_REGISTRY`.

## 9. No DB/schema/RLS change

Confirmed via `git status`: zero migration files, zero SQL files touched by this correction. `isBranchAccessible()` reads only already-loaded, already-fetched in-memory data (`accessibleBranches`, `permissionSnapshot` from `loadDashboardContextV2()`, which itself performs no new queries beyond what `changeBranch()` already performs on every switch) — no new query, no new table, no new policy.

## Correction B — logged-out flow: authorization impact analysis

**Before:** an anonymous caller's redirect went directly to the dashboard target path, which `dashboard/layout.tsx`'s own pre-existing, unmodified auth gate would intercept and redirect to sign-in anyway (the target was never reachable without a session — no authorization gap existed before this correction). The gap was a UX/data-loss one: the query string (deep-link intent) was silently dropped on that hop, meaning after login the user landed on a generic, unfiltered locations page, not the intended target, and — for a would-be cross-branch target — the branch-aware hint logic never even got a chance to run.

**After:** the anonymous caller is now redirected to sign-in with a `returnUrl` pointing back at the QR page itself. This does not weaken or change WHO can reach the dashboard target — the dashboard layout's own auth gate is completely unchanged and untouched — it only changes WHERE an anonymous caller is sent first, so that the branch-aware resolver logic reliably runs once, under a real authenticated context, before any dashboard path is ever computed. No new authorization surface, no new session/token handling — `signInAction`'s own pre-existing credential check and returnUrl validation are unchanged and unmodified.

## New issue found and fixed during the ORIGINAL Phase 6 implementation (pre-existing this correction, unaffected by it)

Radix UI's `AlertDialogAction`/`AlertDialogCancel` auto-close bug (found and fixed before the original Phase 6 report) remains fixed and unaffected by this correction — see `phase6-closeout.md` for the original writeup. This correction did not touch the dialog's open/close wiring.

## Conclusion

Both contract gaps closed. No new authorization gap introduced by either correction — Correction A tightens an already-safe-but-imperfect UX surface into the exact accepted contract; Correction B fixes a data-loss/UX gap in the logged-out round trip without touching or weakening any existing authorization or open-redirect protection. All 9 checklist items pass, plus the 2 correction-specific analyses above.
