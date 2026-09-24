# Zone 1 / Phase 6 — Test Results

> **Corrected 2026-09-24.** Both `public-token-resolver.test.ts` and `ambra-locations-client.cross-branch.test.tsx` were substantially rewritten for this correction. This file reflects the final, corrected test suite. See `phase6-closeout.md` for the acceptance-criteria walkthrough.

## `apps/web/src/server/qr/__tests__/public-token-resolver.test.ts` (13 tests, all new/rewritten this correction)

Now mocks `loadDashboardContextV2()` (the shared, authoritative context loader) instead of a bespoke `createClient()` + `user_preferences` lookup, matching the corrected implementation.

1. Same branch: no crossBranch hint, target opens directly — PASS.
2. Accessible cross-branch: adds crossBranch when caller has an accessible-branch assignment — PASS.
3. Accessible cross-branch via wildcard permission (`BRANCHES_VIEW_UPDATE_ANY`): adds crossBranch even without a direct branch assignment — PASS. New this correction; proves `isBranchAccessible()`'s wildcard path is genuinely exercised, not just array membership.
4. **Correction A** — inaccessible cross-branch: does NOT add crossBranch, returns safe `{ok:false, error:"TARGET_NOT_FOUND"}` instead of an impossible switch offer — PASS. New this correction.
5. **Correction A** — inaccessible cross-branch denial reveals nothing beyond the existing `TARGET_NOT_FOUND` shape (asserts the result object has exactly `{error, ok, token}` keys, no branch metadata) — PASS. New this correction.
6. No resolved active branch: no crossBranch, unmodified redirect (safe fallback, unchanged behavior) — PASS.
7. **Correction B** — logged-out caller redirects to sign-in with `returnUrl` pointing at `/qr/<token>`, not the dashboard target — PASS. New this correction.
8. **Correction B** — localizes the sign-in path (`/logowanie`) and the qr returnUrl target (`/pl/qr/<token>`) when a locale is provided — PASS. New this correction.
9. **Correction B** — the produced `returnUrl` is same-origin and safe (`startsWith("/")`, never `startsWith("//")`) — no open-redirect regression — PASS. New this correction.
10. **Correction B, real auth-return integration** — the SAME resolver call, re-invoked with the same token after a simulated login, correctly re-evaluates and reaches the accessible-cross-branch confirm-hint outcome — PASS. New this correction.
11. **Correction B, real auth-return integration** — an inaccessible target reaches safe denial after login (not the dashboard target) — PASS. New this correction.
12. **Correction B, real auth-return integration** — a same-branch target opens normally after login — PASS. New this correction.
13. Cross-org rejection remains unaffected by the branch-access lookup; asserts `loadDashboardContextV2` is never even called for an already-rejected target — PASS.

## `apps/web/src/app/[locale]/dashboard/warehouse/locations/_components/__tests__/ambra-locations-client.cross-branch.test.tsx` (7 tests)

1. **Same-branch flow** — opens the exact target normally with no confirmation dialog when no `crossBranch` hint is present — PASS.
2. **Inaccessible cross-branch target (new this correction)** — renders no switch dialog, calls no `changeBranch`, opens no target, exposes no target-branch metadata. Documents explicitly that this collapses to the same code path as same-branch, by design, since Correction A moved the access decision fully server-side — PASS.
3. **Accessible cross-branch — dialog appears** — PASS (unchanged).
4. **Accessible cross-branch — CANCEL** — PASS (unchanged).
5. **Accessible cross-branch — CONFIRM** — PASS (unchanged).
6. **Accessible cross-branch — no silent switch on mount** — PASS (unchanged).
7. **Failed switch** — leaves the old branch authoritative, opens nothing, shows a safe error, dialog remains open for retry — PASS (unchanged; this now represents a race/revocation scenario rather than the normal path to an inaccessible target, since Correction A intercepts that case earlier — see `cross-branch-flow.md`).

## Full regression suite re-run after correction

```
pnpm vitest run \
  src/server/qr/__tests__/public-token-resolver.test.ts \
  ".../ambra-locations-client.cross-branch.test.tsx" \
  ".../locations-data-view.branch-wiring.test.tsx" \
  ".../sidebar-branch-switcher.test.tsx" \
  src/app/actions/shared/__tests__/changeBranch.test.ts \
  src/server/services/__tests__/permission-v2.service.test.ts \
  src/components/auth/forms/__tests__/sign-in-form.test.tsx \
  ".../sign-in/__tests__/page.test.tsx"
```

**Result: 8 test files, 90 passed, 2 skipped (92 total).**

| File                                           | Purpose in this regression set                                                                                                                                                                                                                   | Result                                                                                                                                                                                                                                                  |
| ---------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `public-token-resolver.test.ts`                | Corrected — resolver cross-branch hint, Corrections A+B                                                                                                                                                                                          | 13/13 pass                                                                                                                                                                                                                                              |
| `ambra-locations-client.cross-branch.test.tsx` | Corrected — client confirm/switch flow + inaccessible-target contract                                                                                                                                                                            | 7/7 pass                                                                                                                                                                                                                                                |
| `locations-data-view.branch-wiring.test.tsx`   | Phase 3 — Locations branch-wiring, unaffected                                                                                                                                                                                                    | 2/2 pass                                                                                                                                                                                                                                                |
| `sidebar-branch-switcher.test.tsx`             | Phase 1 — sidebar switch regression, `changeBranch()` shared by both flows                                                                                                                                                                       | 5/5 pass                                                                                                                                                                                                                                                |
| `changeBranch.test.ts`                         | **Directly exercises the refactored `isBranchAccessible()` extraction** — confirms the refactor preserved exact existing behavior (including the two tests explicitly named for accessible-branch and `BRANCHES_VIEW_UPDATE_ANY`-wildcard paths) | pass (all, including "returns error when branch not accessible and no BRANCHES_VIEW_UPDATE_ANY permission", "succeeds when branch is in accessibleBranches", "succeeds when user has BRANCHES_VIEW_UPDATE_ANY permission even for inaccessible branch") |
| `permission-v2.service.test.ts`                | Branch/permission regression                                                                                                                                                                                                                     | pass, 2 skipped (pre-existing, live-DB-only tests, unrelated — `T-REVOKE-DB` and `T-10K-DB`)                                                                                                                                                            |
| `sign-in-form.test.tsx`                        | Sign-in/returnUrl regression — proves the existing, unmodified `returnUrl` hidden-field/redirect mechanism this correction's Case D now relies on                                                                                                | pass (all)                                                                                                                                                                                                                                              |
| `sign-in/page.test.tsx`                        | Sign-in redirect regression                                                                                                                                                                                                                      | pass (all)                                                                                                                                                                                                                                              |

Zero failures, zero new skips.

## Type-check

```
pnpm type-check
```

Clean — 0 errors.

## Lint

```
pnpm lint                                                  # whole repo: 0 errors, 319 pre-existing warnings, none in any file touched
pnpm exec eslint <5 correction-touched files individually>  # 0 errors, 0 warnings
```

## Files touched by this correction, individually lint-clean

- `apps/web/src/lib/utils/branch-access.ts` (new)
- `apps/web/src/app/actions/shared/changeBranch.ts` (refactored to use the new shared helper)
- `apps/web/src/server/qr/public-token-resolver.ts` (Corrections A + B)
- `apps/web/src/server/qr/__tests__/public-token-resolver.test.ts` (rewritten)
- `apps/web/src/app/[locale]/dashboard/warehouse/locations/_components/__tests__/ambra-locations-client.cross-branch.test.tsx` (new inaccessible-target test added)
