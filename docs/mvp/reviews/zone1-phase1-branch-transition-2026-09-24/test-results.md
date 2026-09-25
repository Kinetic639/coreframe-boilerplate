# Zone 1 / Phase 1 — Test Results

Run 2026-09-24 via `pnpm vitest run <files>` from `apps/web`, plus `pnpm type-check` and `eslint` on the touched files.

## 1. sidebar-branch-switcher.test.tsx (updated for Phase 1)

**5/5 PASS.**

- `renders the current active branch` — PASS (pre-existing, unchanged).
- `switches branches successfully and completes the transition` — PASS. Asserts `changeBranch` called, `setActiveBranch` called, success toast shown, `router.replace("/dashboard/start")` called, `router.refresh()` called.
- `navigates to the safe route before refreshing (ordering)` — PASS (new). Proves via `mock.invocationCallOrder` that `replace` is invoked strictly before `refresh`.
- `shows an error toast when the action fails and performs no transition` — PASS (updated). Proves zero calls to `setActiveBranch`, `router.replace`, `router.refresh`, and the success toast on a failed `changeBranch`.
- `does nothing when selecting the already-active branch` — PASS (new, covers pre-existing no-op behavior explicitly). Proves `changeBranch` is never called, and no navigation/refresh occurs, when the currently-active branch is re-selected.

## 2. Regression suite

| File                                    | Result                                                     |
| --------------------------------------- | ---------------------------------------------------------- |
| `changeBranch.test.ts`                  | PASS (all)                                                 |
| `permissions-sync.test.tsx`             | PASS (all)                                                 |
| `use-branch-permissions-query.test.tsx` | PASS (all)                                                 |
| `load-dashboard-context.v2.test.ts`     | PASS (all)                                                 |
| `load-app-context.v2.test.ts`           | **1 FAIL / 18 pass** — `maps branch data fields correctly` |

**Total: 54 passed, 1 failed (55 tests across 4 files).**

The single failure is the pre-existing, already-documented fixture-drift failure identified in the Zone 1 Pre-Implementation Verification (`docs/mvp/reviews/zone1-preimplementation-verification-2026-09-23/test-results.md`) and tracked as `BLOCKER-Z1-005`, owned by Phase 7 (DEMO READY automated closeout) — the loader now returns 2 additional benign fields (`branch_number`, `public_warehouse_maps_enabled`) that the test fixture doesn't yet expect. **Confirmed unrelated to this phase**: `load-app-context.v2.ts` and its test file were not touched by Phase 1's changes. Not fixed here, per this task's own Section 13 instruction not to spend this phase on unrelated known test-infrastructure drift.

## 3. Type-check

`pnpm type-check` (whole `apps/web`) — **PASS, zero errors.**

## 4. Lint

`eslint` on both touched files (`sidebar-branch-switcher.tsx`, `sidebar-branch-switcher.test.tsx`) — **PASS, zero errors, zero warnings.**

## Verdict

Zero new regressions introduced by Phase 1. The one pre-existing failure is accurately recorded, not fixed, and not caused by this phase's changes.
