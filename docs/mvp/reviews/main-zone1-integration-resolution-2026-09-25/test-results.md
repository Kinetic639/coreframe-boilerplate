# Test Results

## 1. DataView-focused tests (run first, per the task's own ordering)

```
data-view.test.tsx, data-view-foundation.test.ts, data-view-hydration.test.tsx, data-view-url-state.test.tsx,
locations-data-view.branch-wiring.test.tsx, inventory-client.branch-wiring.test.tsx,
inventory-movements-client.branch-wiring.test.tsx, inventory-products-client.branch-wiring.test.tsx
→ 8 files, 74 tests, 0 failures
```

**4 branch-wiring tests updated**, per the task's own expectation that they'd fail against the old `branchId` prop contract — each rewritten to assert the FINAL main `scope`/`dataViewScope.branch` contract instead (exact `scope` object shape: `{kind: "branch", organizationId, branchId}`), preserving the original test intent (a branch-scoped consumer explicitly supplies branch identity to the generic DataView system) without weakening any assertion. See `resolved-conflicts.md` for the file-by-file list.

**1 test file retired**, not updated: `use-data-view-query.test.ts` (Zone 1's own file). Its entire purpose — proving `buildDataViewQueryKey`/the old `queryKey`-array hook signatures worked — no longer applies once those were removed. Confirmed main's own `data-view-foundation.test.ts` already proves the equivalent property (different `scope` → different cache identity, generically, for any scope shape including branch-shaped ones) before deleting — no duplicate coverage was written.

**1 obsolete describe block removed** from `data-view.test.tsx` (kept, not retired — main's own new content in this file was preserved): the `T-DV-BRANCH` block (4 tests), which exercised the removed `branchId` prop and (in one case) the removed per-mount `QueryClientProvider` semantics.

## 2. Full Zone 1 + DataView + main-side regression (comprehensive final run)

```
37 test files, 356 passed, 2 skipped, 358 total. 0 failures.
```

This single run combines: the original Phase 7 Zone 1 regression set (minus the 1 retired file, plus the 3 new main DataView foundation/hydration/url-state files), the dashboard's own 5-file test suite, 4 other main-side-affected test files (`compound-selection-ssr.test.tsx`, `data-view-invalidation.test.tsx`, `helpdesk-tickets.service.test.ts`, `planning-tasks-scope-rls.test.ts`), and the 5 organization-admin DataView consumers (`branches-client`, `invitations-client`, `members-client`, `positions-client`, `roles-client`).

### Skips — exact and expected

Both in `permission-v2.service.test.ts`, pre-existing, live-DB-only, unrelated to this integration:

- `T-REVOKE-DB: Revoke-under-wildcard proof (live DB) > revoking account.profile.read suppresses that expanded slug but not others`
- `T-10K-DB: UEP partial indexes exist on live DB (DB-backed) > audit_uep_partial_indexes() returns both partial indexes with correct predicates`

**No other failures or skips occurred anywhere in this run.**

## 3. Unplanned positive finding: BLOCKER-Z1-017 appears resolved as a side effect

`roles-client.test.tsx`, `invitations-client.test.tsx`, `members-client.test.tsx` — the 3 suites previously known (since Phase 5's own systematic re-sweep) to crash with `TypeError: parseAsJson is not a function` due to an unrelated `nuqs` version mismatch — **now pass cleanly, 12/12 tests, 3/3 files, verified in isolation with `--reporter=verbose`, zero skips, zero crashes.** Main's own DataView refactor heavily modified `data-view-url-state.ts` (86 insertions/deletions per its own commit stat) — this appears to have fixed the underlying `nuqs`/`parseAsJson` incompatibility as a byproduct of its own, unrelated work. This was NOT something this integration pass set out to fix, and no code was written to fix it — it is a genuine, verified, welcome side effect worth flagging for whoever owns BLOCKER-Z1-017's tracking (currently "owner: none assigned, out of Zone 1 scope" in the Zone 1 progress tracker).

## 4. Fixture drift found and fixed

`ambra-locations-client.cross-branch.test.tsx` — `tsc --noEmit` caught a missing `organizationId` prop in the test's own `defaultProps` fixture (main added this as a new required prop on `AmbraLocationsClient`). Fixed with a 1-line addition; all 7 tests in this file re-confirmed passing after the fix.
