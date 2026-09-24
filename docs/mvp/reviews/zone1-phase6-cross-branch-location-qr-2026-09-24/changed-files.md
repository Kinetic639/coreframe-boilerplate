# Zone 1 / Phase 6 — Changed Files

> **Corrected 2026-09-24.** Updated for the correction pass (Correction A: access-aware cross-branch hint; Correction B: logged-out auth-return re-evaluation). Two additional files touched beyond the original implementation: `apps/web/src/lib/utils/branch-access.ts` (new) and `apps/web/src/app/actions/shared/changeBranch.ts` (refactored).

Exact working-tree diff at time of writing (`git status --porcelain` from repo root), all attributable to Phase 6's original implementation plus this correction:

```
 M apps/web/messages/en.json
 M apps/web/messages/pl.json
 M apps/web/src/app/[locale]/dashboard/warehouse/locations/_components/ambra-locations-client.tsx
 M apps/web/src/app/[locale]/dashboard/warehouse/locations/page.tsx
 M apps/web/src/app/actions/shared/changeBranch.ts
 M apps/web/src/server/qr/public-token-resolver.ts
 M apps/web/src/server/qr/target-registry.ts
 M docs/mvp/zones/01-auth-org-branch-access-implementation-plan.md
 M docs/mvp/zones/01-auth-org-branch-access-progress.md
?? apps/web/src/app/[locale]/dashboard/warehouse/locations/_components/__tests__/ambra-locations-client.cross-branch.test.tsx
?? apps/web/src/lib/utils/branch-access.ts
?? apps/web/src/server/qr/__tests__/public-token-resolver.test.ts
?? docs/mvp/reviews/zone1-phase6-cross-branch-location-qr-2026-09-24/
```

## Runtime changes — original implementation (unchanged by this correction)

- `apps/web/src/app/[locale]/dashboard/warehouse/locations/_components/ambra-locations-client.tsx` — `pendingCrossBranch`/`isSwitchingBranch` state, confirm-then-switch `AlertDialog`, `handleCancelCrossBranch`/`handleConfirmCrossBranch` handlers, Radix `preventDefault()` fix.
- `apps/web/src/app/[locale]/dashboard/warehouse/locations/page.tsx` — `key={branchId ?? "no-branch"}` on `<AmbraLocationsClient>`.
- `apps/web/messages/en.json` / `apps/web/messages/pl.json` — `crossBranchDialog` translation strings.

## Runtime changes — THIS CORRECTION

- **`apps/web/src/lib/utils/branch-access.ts` (new)** — `isBranchAccessible(branchId, accessibleBranches, permissionSnapshot)`, extracted from `changeBranch()`'s own inline authorization check so the QR resolver's UX-hint decision and the actual authorization decision can never drift apart. Pure function, no new query, no new table.
- **`apps/web/src/app/actions/shared/changeBranch.ts`** — refactored (not behaviorally changed) to call the new shared `isBranchAccessible()` helper instead of its own inline `canSwitchToAny`/`isAccessible` check. `changeBranch.test.ts` re-run unchanged and passes, confirming the refactor is behavior-preserving.
- **`apps/web/src/server/qr/public-token-resolver.ts`** — Correction A: the cross-branch hint block now calls `loadDashboardContextV2()` (replacing the original's bespoke `createClient()` + raw `user_preferences` read) and gates the `crossBranch` hint on `isBranchAccessible()`; an inaccessible target now returns `{ok:false, error:"TARGET_NOT_FOUND"}` instead of emitting the hint. Correction B: an anonymous caller (`loadDashboardContextV2()` returns `null`) is now redirected to `/sign-in?returnUrl=/qr/<token>` (or the localized equivalent) instead of the pre-computed dashboard path, so the deep-link intent survives the sign-in round trip and the branch-aware logic always re-runs under an authenticated context.

## Test changes

- `apps/web/src/server/qr/__tests__/public-token-resolver.test.ts` (rewritten, 13 tests — was 5) — now mocks `loadDashboardContextV2()`; adds Correction A tests (inaccessible target denial, denial shape, wildcard-permission access), Correction B tests (sign-in redirect shape, localization, open-redirect safety, 3 real auth-return integration tests).
- `apps/web/src/app/[locale]/dashboard/warehouse/locations/_components/__tests__/ambra-locations-client.cross-branch.test.tsx` (7 tests — was 6) — adds a dedicated "inaccessible cross-branch target" test documenting that this scenario now collapses to the same client-observable behavior as same-branch, by design.

## Documentation changes — THIS CORRECTION

- `docs/mvp/zones/01-auth-org-branch-access-implementation-plan.md` — Phase 6 section annotated with the correction (implementation tasks unchanged/still DONE; correction recorded as a factual addendum, history preserved).
- `docs/mvp/zones/01-auth-org-branch-access-progress.md` — Phase 6 detailed-tracking section updated with the correction's evidence; Phase 6 remains ✅ DONE (corrected before commit).
- `docs/mvp/reviews/zone1-phase6-cross-branch-location-qr-2026-09-24/` — all 9 files updated: `qr-flow-contract.md` (Cases C/D rewritten), `cross-branch-flow.md` (Case C sequence corrected), `security-review.md` (re-run in full, correction analysis added), `test-results.md` (rewritten), `phase6-closeout.md` (correction section added), `changed-files.md` (this file), `diff.patch` (regenerated), `implementation-summary.md` (rewritten to describe the final corrected architecture — a documentation-consistency pass found it still described the original, pre-correction design), `same-branch-flow.md` (one stale test-name citation corrected to match the final resolver test suite).

## Zero other files touched

- Zero files under `inventory.container` / Phase 10D.
- Zero migration/SQL files.
- Zero files under `packages/` (the shared `checkPermission`/`BRANCHES_VIEW_UPDATE_ANY` constants were read, not modified).
- Zero Phase 7+ files.
- `dashboard/layout.tsx` and `actions.ts` (`signInAction`) were READ and traced (to understand the returnUrl mechanism) but NOT modified — Correction B works entirely by changing what `resolvePublicQrToken` redirects an anonymous caller TO, not by changing the existing auth-gate or sign-in mechanisms themselves.

## Not committed

Per explicit instruction, none of the above is staged or committed. The working tree is left exactly as shown for review.
