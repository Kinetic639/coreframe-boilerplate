# Zone 1 / Phase 2 — Branch-Aware DataView/Query-Key Foundation — Closeout

**Starting SHA:** 10bc8dc454be77c46b4bbf672e601c45dbf18e36
**Branch:** zone3-zone5-integration-audit
**Date:** 2026-09-24

## Ending working-tree state

Intentionally dirty, containing only this phase's changes (left for review, not committed, per explicit instruction):

- `apps/web/src/components/data-view/use-data-view-query.ts` (the foundation)
- `apps/web/src/components/data-view/__tests__/use-data-view-query.test.ts` (new test file)
- `docs/mvp/zones/01-auth-org-branch-access-implementation-plan.md` (Phase 2 tasks/acceptance criteria marked done, one factual correction recorded)
- `docs/mvp/zones/01-auth-org-branch-access-progress.md` (Phase 2 marked DONE with evidence; Phase 1's own checkbox-state bug caught and fixed; mechanical counts recomputed: 19/95)
- `docs/mvp/reviews/zone1-phase2-dataview-foundation-2026-09-24/` (this closeout bundle)

Zero other files touched. Zero consumer files, Matcher files, QR files, migration/SQL/RLS files, or Phase 10D files touched.

## Branch-aware query-key contract

See `query-key-contract.md` for the full, authoritative contract Phase 3 must follow. Summary: `buildDataViewQueryKey(baseKey, branchId)` — a pure, exported helper — merges an optional `branchId` into a DataView's base query key for cache-identity purposes only; wired into `useDataViewListQuery` and `useDataViewSidebarInfiniteQuery`; `useDataViewDetailQuery` deliberately excluded (detail queries are keyed by globally-unique IDs, no evidenced bug there); `DataViewListParams` (the request payload) was deliberately NOT touched, correcting the plan's original task wording once inspection showed doing so would have leaked `branchId` into server requests.

## Backward compatibility

Structurally guaranteed, not just tested: the new `branchId` parameter exists only on the internal hook option types (`UseDataViewListQueryOptions`, `UseDataViewSidebarInfiniteQueryOptions`) inside `use-data-view-query.ts`. No consumer file, `DataViewProps`, `DataView`, or `DataViewProvider` was touched, so no existing call site can even reach the new parameter yet — omission is the only possible state for every current consumer. Verified additionally via the full, unmodified 38-test `data-view.test.tsx` regression suite (all pass) and 2 spot-checked org-scoped consumers (`roles-client.tsx`, `tasks-client.tsx`).

## No concrete warehouse consumer migrated

Confirmed via `git status` — none of `locations-data-view.tsx`, `inventory-client.tsx`, `inventory-movements-client.tsx`, `inventory-products-client.tsx` were touched.

## Matcher and QR untouched

Confirmed via `git status` — no file under `hooks/queries/tools/`, `components/tools/svwms-wdd-matcher/`, or `server/qr/` was touched.

## Tests added/changed

New file `use-data-view-query.test.ts` (12 tests, after a same-day micro-correction pass added 3 dedicated `useDataViewSidebarInfiniteQuery` tests — the original 9 covered `buildDataViewQueryKey` and `useDataViewListQuery` directly but left the sidebar hook, also modified in this phase's runtime diff, without direct coverage). No existing test file modified. Zero runtime code changed by the micro-correction — all 3 new tests passed against the already-approved Phase 2 implementation unmodified.

## Test results

12/12 new tests pass. 38/38 regression tests pass (unmodified file). `pnpm type-check`: clean. `eslint`: clean.

## Acceptance criteria result

1. **DataView has a clear optional branch identity mechanism.** PASS — `branchId?: string | null` on 2 hook option types, backed by `buildDataViewQueryKey`.
2. **Effective query key differs when branchId differs.** PASS — proven directly (unit test) and at the hook/cache level (integration test: 2 distinct `getQueryData` entries).
3. **Effective query key remains stable when branchId is unchanged.** PASS — `buildDataViewQueryKey(baseKey, "branch-a")` equals itself across calls (referential-value equality via `toEqual`).
4. **Existing callers without branchId preserve current behavior.** PASS — omission returns the exact same array reference as the input `baseKey`; integration test confirms the exact pre-Phase-2 key shape (`["tickets", listParams]`) is reproduced.
5. **branchId is not treated as authorization input.** PASS — the helper and both hooks are pure cache-key plumbing; nothing in this diff performs or influences any authorization check; contract explicitly documents this invariant for future phases.
6. **branchId is not implicitly read from global state.** PASS — no `useAppStoreV2` or other global-store import anywhere in the touched file; `branchId` is always an explicit parameter.
7. **No concrete Phase 3 consumer is migrated yet.** PASS — confirmed via `git status`.
8. **Focused automated tests pass.** PASS — 12/12 new (all 3 branch-aware hooks directly covered), 38/38 regression.
9. **Type-check passes.** PASS.
10. **Relevant lint passes.** PASS — 0 errors/warnings.
11. **No DB/schema/RLS change occurs.** PASS — zero SQL/migration files touched.
12. **Phase 3+ remains NOT STARTED.** PASS — confirmed below.

**All 12 acceptance criteria: PASS.**

## Confirmation: Phase 3+ NOT started

No consumer files touched. Phase 3, 4, 5, 6, 7, 8 and all PILOT phases remain `NOT STARTED` in the progress tracker.

## Confirmation: Phase 10D NOT started

`docs/mvp/zones/03-repair-orders-implementation-plan.md`'s own Phase 10D header carries no `DONE` suffix — unchanged by this task.
