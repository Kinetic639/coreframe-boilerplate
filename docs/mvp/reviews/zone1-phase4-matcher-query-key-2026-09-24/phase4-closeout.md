# Zone 1 / Phase 4 — Matcher Branch-Aware Query Key — Closeout

**Starting SHA:** 713b2d53d6152eb56391a14b0a6745d5e68e38bf
**Branch:** zone3-zone5-integration-audit
**Date:** 2026-09-24

## Ending working-tree state

Intentionally dirty, containing only this phase's changes (left for review, not committed, per explicit instruction):

**Runtime:**

- `apps/web/src/hooks/queries/tools/wdd-matcher.ts` (the key factory + hooks)
- `apps/web/src/components/tools/svwms-wdd-matcher/index.tsx` (consumer 1)
- `apps/web/src/components/tools/svwms-wdd-matcher/extraction-review-view.tsx` (consumer 2, discovered this phase)

**Tests:**

- `apps/web/src/hooks/queries/tools/__tests__/wdd-matcher.test.ts` (new, 12 tests)

**Documentation:**

- `docs/mvp/zones/01-auth-org-branch-access-implementation-plan.md` (Phase 4 tasks marked done, 1 factual correction recorded)
- `docs/mvp/zones/01-auth-org-branch-access-progress.md` (Phase 4 marked DONE with full evidence; mechanical counts recomputed: 28/95)
- `docs/mvp/reviews/zone1-phase4-matcher-query-key-2026-09-24/` (this closeout bundle)

Zero other files touched. Zero DataView, QR, warehouse consumer, SidebarBranchSwitcher, or DB/schema/RLS files touched.

## Exact session-list key shape before

`wddMatcherKeys.sessions()` → `["svwms-wdd-matcher", "sessions"]` — one shared bucket for every branch.

## Exact session-list key shape after

`wddMatcherKeys.sessions(branchId)` → `["svwms-wdd-matcher", "sessions", branchId]` — Branch A: `["svwms-wdd-matcher", "sessions", "branch-a"]`; Branch B: `["svwms-wdd-matcher", "sessions", "branch-b"]`; no active branch: `["svwms-wdd-matcher", "sessions", null]` (deterministic, never populated since `useSessionsQuery` gates on `enabled: !!branchId`).

## BranchId source

`useAppStoreV2((s) => s.activeBranchId)`, read independently at the top level of both `SvwmsWddMatcher` (`index.tsx`) and `ExtractionReviewView` (`extraction-review-view.tsx`), then passed explicitly into every hook that needs it — matching the already-proven `workshopKeys.lineReservations`/`useRepairOrderLineReservationsQuery` convention of explicit, caller-supplied `branchId`, never read internally inside the query-hook module itself.

## Null/initial branch behavior

`branchId: string | null`, not optional. `useSessionsQuery` adds `enabled: !!branchId` — the query does not fire while no branch is active, avoiding any ambiguous or silently-wrong fetch. Mutations accept `branchId: string | null` unconditionally and invalidate `wddMatcherKeys.sessions(branchId)` regardless (a `null`-branch invalidation is a harmless no-op against a bucket that was never populated).

## Consumer-level results

See `consumer-invalidation-matrix.md` for the complete table. Summary: 1 query consumer, 3 invalidation consumers, 2 direct cache-write consumers, across 3 files — all reconciled. 1 additional call site (`useRetryMaterializationMutation`) confirmed correctly out of scope. 1 additional call site (`extraction-review-view.tsx`'s direct `listSessionsAction()` call) confirmed not a cache consumer at all.

## Other Matcher keys — inspected, intentionally left unchanged

`results`/`extractedData`/`enhancedPdfData`/`materializationStatus(sessionId)` — all keyed by a globally-unique `sessionId`, no cross-branch leak possible by construction. Matches the pre-implementation audit's own classification. Not touched, per the plan's own explicit "Out of scope" section.

## Confirmation: branchId remains cache identity only

Confirmed structurally (no hook or component passes `branchId`/`activeBranchId` into any server action call — `listSessionsAction()`, `createAutoSessionAction()`, `runMatchingAction(sessionId)`, `approveAndMaterializeSessionAction({sessionId})` all keep their exact pre-existing argument shapes) and by a dedicated test (`branchId is never forwarded to listSessionsAction`).

## Confirmation: Matcher authorization/RLS untouched

No file under `apps/web/src/app/actions/tools/wdd-matcher.ts` (the server action module) touched. No RLS, RPC, or permission-check code touched. Confirmed via `git status`.

## Tests added/updated

1 new file, 12 tests. No existing test file modified (both existing Matcher test files continue to pass unmodified against the new hook signatures, since they mock the hooks rather than exercising the real module).

## Test results

12/12 new tests pass. 14/14 existing tests pass, unmodified. `pnpm type-check`: clean (and load-bearing — see `test-results.md`). `eslint`: 0 errors, 0 warnings on all 4 touched files.

## Matcher static re-sweep result

Re-grepped after implementation for: zero-arg `wddMatcherKeys.sessions()` calls (none found), hard-coded `["svwms-wdd-matcher", "sessions"]`/`["wdd-matcher", "sessions"]` arrays (none found), invalidation paths missing branch identity (none — all 3 confirmed branch-aware), alternate session-list hooks bypassing the key factory (none — `listSessionsAction` is called directly in exactly one place, `extraction-review-view.tsx`'s own local-state fetch, which never touches the React Query cache and is correctly not a consumer of the key factory). The Matcher session-list bug class is closed inside Matcher.

## Acceptance criteria result

1. **Matcher session-list key includes branch identity.** PASS.
2. **Different branches produce different session-list cache keys.** PASS — proven directly and via the query-level integration test.
3. **Same branch produces stable key identity.** PASS.
4. **All current session-list query consumers use the branch-aware key.** PASS — confirmed via the consumer-invalidation matrix and load-bearing type-check.
5. **All relevant invalidation/cache-write callers are reconciled.** PASS — 6 call sites across 3 files, all updated.
6. **BranchId remains cache identity only.** PASS — structural + test confirmation.
7. **No authorization/RLS behavior changes.** PASS — confirmed via `git status`.
8. **Other already-safe sessionId-keyed Matcher queries remain unchanged.** PASS — confirmed via diff scope.
9. **Focused automated tests pass.** PASS — 12/12 new, 14/14 regression.
10. **Type-check passes.** PASS.
11. **Relevant lint passes.** PASS — 0 errors, 0 warnings.
12. **No DB/schema/RLS change occurs.** PASS — zero SQL/migration files touched.
13. **DataView remains untouched.** PASS.
14. **QR remains untouched.** PASS.
15. **Phase 5+ remains NOT STARTED.** PASS — confirmed below.

**All 15 acceptance criteria: PASS.**

## Confirmation: Phase 5+ NOT started

No file related to Phase 5 (branch-state re-sweep, verification-only), Phase 6 (QR), or Zone 3 Phase 10D was touched. Phase 5, 6, 7, 8, and all PILOT phases remain `NOT STARTED` in the progress tracker.

## Confirmation: Zone 3 Phase 10D NOT started

`docs/mvp/zones/03-repair-orders-implementation-plan.md`'s own Phase 10D header carries no `DONE` suffix — unchanged by this task.
