# Zone 1 / Phase 4 — Changed Files

## Runtime files

1. `apps/web/src/hooks/queries/tools/wdd-matcher.ts` — `wddMatcherKeys.sessions` now takes `branchId: string | null`; `useSessionsQuery` accepts `branchId` (required) + `enabled: !!branchId`; `useCreateAutoSessionMutation`, `useRunMatchingMutation`, `useApproveAndMaterializeSessionMutation` all accept `branchId` and invalidate the branch-scoped key.
2. `apps/web/src/components/tools/svwms-wdd-matcher/index.tsx` — reads live `activeBranchId` via `useAppStoreV2`, passes it to `useSessionsQuery` and both direct `setQueryData` cache-write call sites; `activeBranchId` added to both affected `useCallback` dependency arrays.
3. `apps/web/src/components/tools/svwms-wdd-matcher/extraction-review-view.tsx` (a second consumer file, discovered this phase, not named in the plan's original repository-areas note) — reads live `activeBranchId` via `useAppStoreV2`, passes it to `useRunMatchingMutation`/`useApproveAndMaterializeSessionMutation`.

## Test files

4. `apps/web/src/hooks/queries/tools/__tests__/wdd-matcher.test.ts` (new, 12 tests) — key-factory contract tests, `useSessionsQuery` integration tests, mutation invalidation tests including a cross-branch-isolation test.

## Documentation

5. `docs/mvp/zones/01-auth-org-branch-access-implementation-plan.md` — Phase 4's 4 tasks marked done; 1 factual correction recorded (actual consumer surface was 6 call sites across 3 files, not "2-3 invalidateQueries call sites" across 2 files as originally estimated).
6. `docs/mvp/zones/01-auth-org-branch-access-progress.md` — Phase 4 marked DONE with full evidence; BLOCKER-Z1-003 marked RESOLVED; new 2026-09-24 change-log entry added; mechanical task counts recomputed to 28/95 (28/49 pitch, 0/46 pilot).
7. `docs/mvp/reviews/zone1-phase4-matcher-query-key-2026-09-24/` (this closeout bundle: `implementation-summary.md`, `matcher-key-contract.md`, `consumer-invalidation-matrix.md`, `test-results.md`, `phase4-closeout.md`, `changed-files.md`, `diff.patch`).

## What was explicitly NOT changed

`wddMatcherKeys.results/.extractedData/.enhancedPdfData/.materializationStatus` (all correctly sessionId-keyed, out of scope). `useRetryMaterializationMutation` (never invalidated the session list). `extraction-review-view.tsx`'s own direct `listSessionsAction()` call at line ~338 (local-state only, not a cache consumer). Any file under `apps/web/src/app/actions/tools/wdd-matcher.ts` (server actions), `apps/web/src/components/data-view/` (Phase 2/3's own foundation), `apps/web/src/server/qr/` (Phase 6), or any migration/SQL/RLS file. Zero commits made.
