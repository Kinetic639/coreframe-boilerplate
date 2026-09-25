# Zone 1 / Phase 7 — BLOCKER-Z1-005 Reproduction (Before Any Fix)

Both failures were reproduced fresh, before any edit, per the explicit instruction to determine root cause before touching anything.

## Command

```
pnpm vitest run src/server/services/__tests__/organization-rls.test.ts src/server/loaders/v2/__tests__/load-app-context.v2.test.ts --reporter=verbose
```

## Result before fix

```
Test Files  2 failed (2)
     Tests  2 failed | 48 passed (50)
```

## Failure 1 — `organization-rls.test.ts` → `OrgBranchesService > createBranch > returns structured failure when RLS denies INSERT`

```
TypeError: supabase.rpc is not a function
  ❯ Function.createBranch src/server/services/organization.service.ts:1230:69
    1228|   ): Promise<ServiceResult<OrgBranch>> {
    1229|     const branchId = crypto.randomUUID();
    1230|     const { data: numberData, error: numberError } = await supabase.rpc(
    1231|       "reserve_organization_entity_number",
    1232|       { org_id: orgId, entity_type: "branch", entity_id: branchId }
    1233|     );
  ❯ src/server/services/__tests__/organization-rls.test.ts:338:47
```

**Investigation:** read `OrgBranchesService.createBranch` (`organization.service.ts:1224-1257`) in full. It calls `supabase.rpc("reserve_organization_entity_number", ...)` to reserve a sequential branch number BEFORE the actual `INSERT` into `branches`. Read the test's own `makeRlsDeniedClient()` mock builder (`organization-rls.test.ts:48-89`): it returns `{ from: vi.fn()..., storage: { from: vi.fn() } }` — no `.rpc` method at all. The mock object simply predates the branch-numbering RPC call being added to `createBranch`.

**Classification: STALE MOCK.** The runtime code's RPC call is legitimate, intentional, already-existing functionality (branch numbering) — not a bug. The test's own mock is incomplete relative to the current interface `createBranch` actually calls.

## Failure 2 — `load-app-context.v2.test.ts` → `loadAppContextV2 > maps branch data fields correctly`

```
AssertionError: expected { Object (id, name, ...) } to deeply equal { Object (id, name, ...) }

- Expected
+ Received

  {
+   "branch_number": undefined,
    "created_at": "2024-01-01T00:00:00Z",
    "id": "branch-456",
    "name": "Main",
    "organization_id": "org-123",
+   "public_warehouse_maps_enabled": false,
    "slug": "main",
  }
  ❯ src/server/loaders/v2/__tests__/load-app-context.v2.test.ts:460:42
```

**Investigation:** read `loadAppContextV2`'s branch-mapping code (`load-app-context.v2.ts:171-193`). It selects `id, name, organization_id, branch_number, slug, public_warehouse_maps_enabled, created_at` from the `branches` table and maps ALL of these fields — including `branch_number` and `public_warehouse_maps_enabled` (defaulting via `?? false`) — into every `availableBranches` entry. Read the test's own `BRANCH_1`/`BRANCH_2` fixtures (lines 73-86): neither includes `branch_number` or `public_warehouse_maps_enabled` at all. The test's expected-object literal (lines 460-466) was written before this 2-field mapping existed and was never updated.

**Classification: STALE EXPECTATION.** The runtime mapping is legitimate, intentional, already-existing behavior — not a bug. The test's own expected-object literal is incomplete relative to what the loader actually (and correctly) returns.

## Conclusion

Both failures are test/mock/fixture drift, confirmed by reading the corresponding runtime code before touching either test. **No actual runtime regression found in either case.** Fixes proceed per the plan's own explicit description of BLOCKER-Z1-005 ("2 confirmed Zone-1-relevant test/mock-drift failures").
