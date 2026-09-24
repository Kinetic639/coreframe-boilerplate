# Zone 1 / Phase 1 — Centralized Branch Transition — Closeout

**Starting SHA:** 3e7ffce0b5158d3f8a02cda323aca3625b7a1163
**Branch:** zone3-zone5-integration-audit
**Date:** 2026-09-24

## Ending working-tree state

Intentionally dirty, containing only this phase's changes (left for review, not committed, per explicit instruction):

- `apps/web/CLAUDE.md` (1 line changed — stale project-ref housekeeping fix)
- `apps/web/src/app/[locale]/dashboard/_components/sidebar-branch-switcher.tsx` (the fix)
- `apps/web/src/app/[locale]/dashboard/_components/__tests__/sidebar-branch-switcher.test.tsx` (test coverage)
- `docs/mvp/zones/01-auth-org-branch-access-implementation-plan.md` (Phase 1 task added, PILOT Phase E scope corrected)
- `docs/mvp/zones/01-auth-org-branch-access-progress.md` (Phase 1 marked DONE, evidence recorded, blockers resolved, change log updated)
- `docs/mvp/reviews/zone1-phase1-branch-transition-2026-09-24/` (this closeout bundle)

Zero other files touched. Zero files under `packages/` or `supabase/` touched.

## Exact safe route selected

`/dashboard/start` — see `implementation-summary.md` for the full rationale (static, branch-neutral, zero data dependency, already the codebase's own canonical "go home" destination).

## Exact router transition behavior

On a server-confirmed successful `changeBranch()`: `setActiveBranch(branchId)` (client store) → `toast.success(...)` → `router.replace("/dashboard/start")` → `router.refresh()`. `replace` (not `push`) to avoid leaving a stale-branch-object page as a valid back-button target; `replace` before `refresh` to move the user off the abandoned route before any refetch is attempted, matching the codebase's own one existing precedent for this combination.

## Files changed

See "Ending working-tree state" above. Full diff in `diff.patch`.

## Tests added/changed

`sidebar-branch-switcher.test.tsx`: added a `useRouter` (`@/i18n/navigation`) mock; updated the success test to assert `replace`/`refresh`; added an ordering test; updated the failure test to assert zero transition side effects; added a same-branch no-op test. Full detail in `test-results.md`.

## Test results

54/55 regression tests pass (1 pre-existing, unrelated, already-documented failure — see `test-results.md`). 5/5 new/updated `sidebar-branch-switcher` tests pass. `pnpm type-check`: clean. `eslint`: clean.

## Acceptance criteria result

1. **Successful branch switch uses existing server-authoritative `changeBranch`.** PASS — unchanged, still the sole switch mechanism.
2. **After successful switch the user is moved to the selected safe branch-neutral route.** PASS — `router.replace("/dashboard/start")`.
3. **Server Components are re-rendered against the new active branch without manual browser refresh.** PASS — `router.refresh()` invalidates the Router Cache for the current route tree.
4. **A user switching while on a branch-specific object/detail/edit route is not left viewing or resolving the old-branch object.** PASS — the replace navigation unconditionally moves the user to `/dashboard/start` regardless of the route they switched from.
5. **A failed `changeBranch` leaves the previous branch/context intact.** PASS — early `return` before any state/navigation call on `!result.success`; covered by a dedicated test.
6. **No authorization architecture changed.** PASS — `changeBranch`, RLS, permission compilation, `PermissionsSync`, and all other named "already correct" foundations untouched.
7. **No DB/schema/RLS change occurred.** PASS — zero SQL/migration files touched.
8. **Focused automated tests for the branch transition pass.** PASS — 5/5.
9. **Type-check passes.** PASS.
10. **Relevant lint produces no new error.** PASS — 0 errors/warnings on both touched files.
11. **Phase 2+ remains NOT STARTED.** PASS — confirmed below.

**All 11 acceptance criteria: PASS.**

## Known remaining Zone 1 gaps (unchanged by this phase, tracked in the progress tracker)

Every DEMO-track gap except BLOCKER-Z1-001 (closed by this phase) remains open: BLOCKER-Z1-002 (DataView/query-key foundation, Phases 2-3), BLOCKER-Z1-003 (Matcher query key, Phase 4), BLOCKER-Z1-004 (QR confirm-then-switch, Phase 6), BLOCKER-Z1-005 (2 test/mock-drift fixes, Phase 7). All PILOT-track blockers (BLOCKER-Z1-006 through 013) remain open and deliberately deferred. BLOCKER-Z1-016 (CLAUDE.md stale ref) is now resolved, ahead of its originally-planned PILOT Phase E — see the progress tracker's change log for the full rationale.

## Confirmation: Phase 2 NOT started

No `DataViewListParams`, `use-data-view-query.ts`, or any of the 4 confirmed DataView consumer files were touched. Confirmed via `git status` — zero files outside this phase's own scope are modified.

## Confirmation: Phase 10D NOT started

No `apps/web/src/**` file related to Container QR / Zone 3 Phase 10D was touched. `docs/mvp/zones/03-repair-orders-implementation-plan.md`'s own Phase 10D header carries no `DONE` suffix — unchanged by this task.
