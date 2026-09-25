# Zone 1 / Phase 6 — Cross-branch `warehouse.location` deep-link/QR — Closeout

**Starting SHA:** 9ecb08d1da74a81e1d168037c75b41702633d1fb
**Branch:** zone3-zone5-integration-audit
**Original implementation date:** 2026-09-24
**Correction pass date:** 2026-09-24 (same day, pre-commit review)

## Correction pass summary

Before commit, review identified two contract gaps in the original implementation:

1. **Correction A.** An inaccessible cross-branch target still showed a "Switch branch" confirmation dialog, relying on `changeBranch()` to reject it only after the user clicked Confirm. Not a leak, but not the accepted contract (no switch offer should ever be shown for a target that can never succeed). Fixed by extracting `isBranchAccessible()` — the exact check `changeBranch()` itself performs — into a shared helper (`apps/web/src/lib/utils/branch-access.ts`) and gating the resolver's `crossBranch` hint on it. An inaccessible target now returns the existing `TARGET_NOT_FOUND` shape instead.
2. **Correction B.** The logged-out flow was only proven to preserve the redirect _string_ unchanged; tracing the real flow found that `dashboard/layout.tsx`'s own returnUrl mechanism only preserves the request pathname (excludes the query string), so an anonymous caller's `selected=<id>` (and any `crossBranch` hint) would have been silently dropped on the sign-in round trip, and the branch-aware logic would never have run under an authenticated context. Fixed by redirecting anonymous callers to sign-in with a `returnUrl` pointing back at the QR page itself (`/qr/<token>`), which has no query string to lose, guaranteeing `resolvePublicQrToken` re-runs in full once authenticated.

Both corrections are scoped exactly to `warehouse.location` (same gate — `validation.branchId` — as the original implementation), touch no DB/schema/RLS, add no container/per-part QR, and do not modify `dashboard/layout.tsx` or `signInAction`'s existing, already-tested auth-gate/returnUrl-validation logic.

## Ending working-tree state

Intentionally dirty, containing the original Phase 6 implementation plus this correction (left for review, not committed, per explicit instruction):

- `apps/web/messages/en.json` (unchanged by correction)
- `apps/web/messages/pl.json` (unchanged by correction)
- `apps/web/src/app/[locale]/dashboard/warehouse/locations/_components/ambra-locations-client.tsx` (unchanged by correction)
- `apps/web/src/app/[locale]/dashboard/warehouse/locations/page.tsx` (unchanged by correction)
- `apps/web/src/app/actions/shared/changeBranch.ts` (**correction** — refactored to use the shared `isBranchAccessible()` helper)
- `apps/web/src/lib/utils/branch-access.ts` (**correction, new** — the shared `isBranchAccessible()` helper)
- `apps/web/src/server/qr/public-token-resolver.ts` (**correction** — Correction A + B logic)
- `apps/web/src/server/qr/target-registry.ts` (unchanged by correction)
- `apps/web/src/app/[locale]/dashboard/warehouse/locations/_components/__tests__/ambra-locations-client.cross-branch.test.tsx` (**correction** — new inaccessible-target test added)
- `apps/web/src/server/qr/__tests__/public-token-resolver.test.ts` (**correction** — rewritten, 13 tests)
- `docs/mvp/zones/01-auth-org-branch-access-implementation-plan.md` (**correction** — annotated)
- `docs/mvp/zones/01-auth-org-branch-access-progress.md` (**correction** — annotated)
- `docs/mvp/reviews/zone1-phase6-cross-branch-location-qr-2026-09-24/` (this bundle, updated)

Zero other files touched. Zero files under `packages/` or `supabase/` touched. Zero files related to `inventory.container`/Phase 10D touched.

## Files changed

See "Ending working-tree state" above. Full diff in `diff.patch`.

## Test results

92 total tests across the 8-file regression set: 90 pass, 2 pre-existing/unrelated skips. 20/20 Phase-6-specific tests pass (13 resolver + 7 client). `pnpm type-check`: clean. `pnpm lint`: clean (0 errors, 0 new warnings). Full detail in `test-results.md`.

## Final acceptance criteria (per the correction task's own 21-item list)

1. **Same-branch exact target still works.** PASS — `public-token-resolver.test.ts` "same branch..."; `ambra-locations-client.cross-branch.test.tsx` "same-branch flow".
2. **Accessible cross-branch shows confirm.** PASS — unchanged, "accessible cross-branch flow" / "renders a confirmation dialog...".
3. **Cancel preserves current branch.** PASS — unchanged, "CANCEL: no branch switch occurs...".
4. **Confirm uses `changeBranch`.** PASS — unchanged, "CONFIRM: calls the authoritative changeBranch...".
5. **Successful confirm opens exact target.** PASS — unchanged, same test.
6. **Failed switch preserves old branch.** PASS — unchanged, "failed switch" test (now representing a race/revocation scenario, not the normal path to an inaccessible target).
7. **Inaccessible cross-branch shows NO switch dialog.** PASS — `ambra-locations-client.cross-branch.test.tsx` "inaccessible cross-branch target" test; structurally guaranteed since the resolver never emits `crossBranch` for this case.
8. **Inaccessible cross-branch cannot open target.** PASS — the resolver returns `{ok:false}` before any dashboard redirect is computed; the user never reaches `/dashboard/warehouse/locations` for this target.
9. **Inaccessible cross-branch does not call `changeBranch`.** PASS — same test, asserts `mockChangeBranch` not called.
10. **Logged-out flow is proven to re-enter authenticated branch/access evaluation before target open.** PASS — `public-token-resolver.test.ts`'s "Correction B — logged-out caller" describe block, specifically the 3 "real auth-return integration" tests (same resolver call, re-invoked after simulated login, correctly reaches same-branch / accessible / inaccessible outcomes).
11. **Open-redirect protection remains intact.** PASS — new dedicated test asserting the produced `returnUrl` is same-origin-safe; `signInAction`'s own existing validation untouched; see `security-review.md` §3.
12. **No client branchId becomes auth input.** PASS — unchanged principle, now enforced at two independent points (hint decision + `changeBranch()` itself), both via the same `isBranchAccessible()` helper. See `security-review.md` §1.
13. **No metadata leak.** PASS — Correction A closes the one identified gap; denial shape verified to contain only `{error, ok, token}`. See `security-review.md` §2.
14. **No silent switch.** PASS — unchanged, further reinforced (no dialog surface exists at all for inaccessible targets). See `security-review.md` §4.
15. **No container QR.** PASS — confirmed via `git status`.
16. **No per-part QR.** PASS — confirmed via registry inspection (`target-registry.ts` unchanged by this correction).
17. **Tests pass.** PASS — 90/90 non-skipped (2 pre-existing/unrelated skips), 20/20 Phase-6-specific.
18. **Type-check passes.** PASS.
19. **Lint passes.** PASS — 0 errors, 0 new warnings.
20. **No DB/schema/RLS changes.** PASS — confirmed via `git status`; `isBranchAccessible()` and `loadDashboardContextV2()` read only already-fetched in-memory data / pre-existing queries `changeBranch()` already performs.
21. **Phase 7 remains NOT STARTED.** PASS — confirmed below.

**All 21 acceptance criteria: PASS.**

## Original Phase 6 acceptance criteria (unaffected by this correction, still PASS)

All 5 original acceptance criteria from the implementation plan, and the original 18-item extended checklist from the first closeout pass, remain satisfied — Cases A and B are byte-for-byte unchanged in their externally-observable client behavior; only the server-side computation of WHEN to show the hint (Correction A) and WHERE to send an anonymous caller first (Correction B) changed.

## Bug found and fixed during the ORIGINAL implementation (unaffected by this correction)

Radix UI's `AlertDialogAction`/`AlertDialogCancel` auto-close bug — found and fixed before the original Phase 6 report, unrelated to and unaffected by this correction pass. See the original writeup preserved in `docs/mvp/zones/01-auth-org-branch-access-progress.md`'s Phase 6 detailed-tracking section.

## Known remaining Zone 1 gaps (unchanged by this phase/correction, tracked in the progress tracker)

BLOCKER-Z1-005 (2 test/mock-drift fixes, Phase 7) remains open. All PILOT-track blockers (BLOCKER-Z1-006 through BLOCKER-Z1-013) remain open and deliberately deferred. BLOCKER-Z1-004 and BLOCKER-Z1-018 remain resolved (now with the corrected contract).

## Confirmation: Phase 7 NOT started

No `organization-rls.test.ts` mock fix, no `load-app-context.v2.test.ts` fixture fix, and no whole-repo type-check/lint closeout pass beyond what this correction itself required were performed. Confirmed via `git status` — zero files outside this phase's own scope (listed in "Ending working-tree state" above) are modified.

## Confirmation: Phase 10D NOT touched

No `apps/web/src/**` file related to Container QR / Zone 3 Phase 10D was touched by the original implementation or this correction. `docs/mvp/zones/03-repair-orders-implementation-plan.md`'s own Phase 10D header carries no `DONE` suffix — unchanged.

## Not committed

Per explicit instruction, this correction pass's work is left uncommitted, exactly like the original implementation it corrects. Nothing was staged or committed at any point in this correction pass.
