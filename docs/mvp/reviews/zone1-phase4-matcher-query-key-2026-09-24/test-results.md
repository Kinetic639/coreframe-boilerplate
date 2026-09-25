# Zone 1 / Phase 4 — Test Results

Run 2026-09-24 via `pnpm vitest run <files>` from `apps/web`, plus `pnpm type-check` and `eslint` on all touched files.

## 1. New Matcher key-factory/query/invalidation tests (`wdd-matcher.test.ts`)

**12/12 PASS.**

`wddMatcherKeys.sessions` (4 tests): different branches produce different keys; same branch produces a stable key; `null` produces a deterministic key distinct from any real branch; exact key shape matches `["svwms-wdd-matcher", "sessions", branchId]`.

`useSessionsQuery` (4 tests): different branchId values produce distinct cache entries for the same query; the query stays disabled (`fetchStatus: "idle"`, `listSessionsAction` never called) when branchId is null; `listSessionsAction` is called with zero arguments — branchId never leaks into the request payload; switching the branchId argument on an already-mounted hook triggers a new fetch (call count 1 → 2), proving the cache identity genuinely changed.

Mutation invalidation (4 tests): `useCreateAutoSessionMutation`, `useRunMatchingMutation`, and `useApproveAndMaterializeSessionMutation` each invalidate only `wddMatcherKeys.sessions(<their own branchId>)`, proven via `vi.spyOn(queryClient, "invalidateQueries")`; a dedicated cross-branch-isolation test seeds Branch B's session-list cache, runs a Branch-A `useRunMatchingMutation`, and confirms Branch B's cached query state remains un-invalidated (`isInvalidated: false` before and after).

## 2. Existing Matcher regression (`extraction-review-approval.test.tsx`, `movement-import-boundary.test.ts`)

**14/14 PASS, both files unmodified.** `extraction-review-approval.test.tsx` mocks `useRunMatchingMutation`/`useApproveAndMaterializeSessionMutation` with generic `vi.fn()` mocks that don't assert on arguments, and does not mock `useAppStoreV2` (so `extraction-review-view.tsx`'s new `useAppStoreV2((s) => s.activeBranchId)` call resolves against the real Zustand store's own default `activeBranchId: null` state) — confirmed this causes no crash and no behavior change, validating that `branchId: string | null` (not required non-null) was the correct signature choice.

## 3. Type-check

`pnpm type-check` (whole `apps/web`) — **PASS, zero errors.** Notable: since `branchId` is a required parameter (no default) on every changed hook, a missed caller anywhere in the codebase would have produced a compile error here — this is direct, load-bearing evidence that every real caller was found and updated, not merely a generic clean-build check.

## 4. Lint

All 4 touched files — **PASS, zero errors, zero warnings.**

## Unrelated failures

None encountered.

## Verdict

Zero regressions. The Matcher session-list branch-cache bug is closed and verified at 3 levels: the pure key-factory contract, the query hook's actual cache behavior, and every mutation's invalidation targeting.
