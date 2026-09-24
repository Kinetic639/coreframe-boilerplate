# Zone 1 / Phase 7 — Test/Mock/Fixture Drift Fixes

Both fixes are the smallest correction necessary to complete the mock/expectation to match the current, already-correct runtime interface. Neither weakens an assertion; neither touches runtime code.

## Fix 1 — `apps/web/src/server/services/__tests__/organization-rls.test.ts`

Added an `.rpc()` stub to `makeRlsDeniedClient()`:

```ts
return {
  from: vi.fn().mockImplementation(() => makeChainable()),
  storage: { from: vi.fn() },
  // createBranch() now reserves a branch_number via RPC before the INSERT
  // (reserve_organization_entity_number) -- under RLS denial this call
  // itself is expected to fail the same way a direct table operation
  // would, so createBranch's own early-return on numberError still
  // exercises the "RLS denies" path this client models.
  rpc: vi.fn().mockResolvedValue(errResult),
};
```

`errResult` is the same `{ data: null, error: { code: "42501", message: "permission denied..." } }` shape the rest of `makeRlsDeniedClient()` already uses for every other operation — the RPC call now fails the same way an RLS-denied table operation does, which is exactly what this mock client is meant to model. `createBranch`'s own early-return on `numberError` (`organization.service.ts:1234`) then produces the `{success: false}` result the test asserts — unchanged assertion, now actually reachable.

**Assertion unchanged:** `expect(result.success).toBe(false)` — still the exact same check.

## Fix 2 — `apps/web/src/server/loaders/v2/__tests__/load-app-context.v2.test.ts`

Added the 2 missing fields to the one affected test's own expected-object literal:

```ts
expect(result!.availableBranches[0]).toEqual({
  id: BRANCH_1.id,
  name: BRANCH_1.name,
  organization_id: BRANCH_1.organization_id,
  slug: BRANCH_1.slug,
  created_at: BRANCH_1.created_at,
  // loadAppContextV2 now selects and maps these 2 additional branch
  // fields (see load-app-context.v2.ts); BRANCH_1's own fixture doesn't
  // set branch_number, so it maps through as undefined, and
  // public_warehouse_maps_enabled falls back to its `?? false` default.
  branch_number: undefined,
  public_warehouse_maps_enabled: false,
});
```

**Deliberate scoping decision:** the shared `BRANCH_1`/`BRANCH_2` fixture constants (used by ~10 other assertions in this same file, most of which check only `.id`, not the full object shape) were left untouched, rather than adding `branch_number`/`public_warehouse_maps_enabled` to the fixtures themselves. Grepped every other usage of `BRANCH_1`/`BRANCH_2` in the file first to confirm none of them does a `toEqual` on the full object that would be affected either way — this is the narrower of the two possible fixes, touching only the one test that actually needed it.

**Assertion unchanged in strength:** still a full `toEqual` on the mapped object — now complete rather than partial.

## Runtime code changed: NONE

`apps/web/src/server/services/organization.service.ts` and `apps/web/src/server/loaders/v2/load-app-context.v2.ts` were both READ (to establish root cause) but NOT modified. Confirmed via `git status` — only the 2 test files listed above are touched by this phase.

## Verification

```
pnpm vitest run src/server/services/__tests__/organization-rls.test.ts src/server/loaders/v2/__tests__/load-app-context.v2.test.ts
```

Result: `2 test files passed, 50 tests passed` (0 failed, 0 skipped in these 2 files).
