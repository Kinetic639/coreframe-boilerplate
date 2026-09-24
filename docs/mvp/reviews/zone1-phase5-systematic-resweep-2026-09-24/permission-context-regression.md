# Zone 1 / Phase 5 — Permission-Context Regression Check

## Scenario (per the task's own explicit spec)

Branch A: Manager role. Branch B: Warehouse Worker role. Switch A → B. Expected: active branch changes; permission query/context resolves B; no logout/manual refresh; no permissions from A remain authoritative.

## Method

Not a redesign or re-derivation — a regression check confirming the already-verified-correct chain (established in the pre-implementation audit's `authorization-model-verification.md`) was not accidentally broken by any of Phases 1-4's own changes.

1. `git log --oneline -3 -- permissions-sync.tsx use-branch-permissions-query.ts` — confirmed both files' last touching commit is `ddf6acdc` (the original monorepo conversion), predating Zone 1 Phase 1 entirely. **Neither file has been modified by this session's own Zone 1 work at all.**
2. Read `permissions-sync.tsx` in full — confirmed its logic is unchanged: reads `activeBranchId` reactively from `useAppStoreV2()`, feeds it into `useBranchPermissionsQuery({orgId, branchId, enabled})`, syncs the result into the user store via `setPermissionSnapshot` on every `data`/`isFetched` change.
3. Confirmed `use-branch-permissions-query.ts`'s own query key is unchanged: `["v2", "permissions", orgId, branchId]` — `branchId` was already correctly part of the key before this session's work began, and remains so.
4. Re-ran both files' existing test suites: `permissions-sync.test.tsx` and `use-branch-permissions-query.test.tsx` — both pass (part of the 118/118 full regression run this phase).

## Chain, re-traced

```
SidebarBranchSwitcher (user clicks Branch B)
  → changeBranch(branchId) [server, unchanged, re-validates access]
  → setActiveBranch(branchId) [Zustand update — activeBranchId now Branch B's ID]
  → PermissionsSync re-renders (subscribed to activeBranchId)
  → useBranchPermissionsQuery's key becomes ["v2", "permissions", orgId, "branch-b"]
    — a DIFFERENT cache key than Branch A's own ["v2", "permissions", orgId, "branch-a"]
  → fresh fetch for Branch B's permissions (never reuses Branch A's cached snapshot)
  → setPermissionSnapshot(Branch B's permissions) — user store now holds Branch B's snapshot
```

No logout or manual refresh is required at any point in this chain — it is entirely reactive, driven by the Zustand `activeBranchId` change alone, and was already correct before this session's work began.

## Verdict

**Permission-context-after-switch remains correct.** No regression introduced by Phases 1-4. Confirmed via unchanged source (git log), unchanged query-key contract, and a passing test re-run — not merely re-asserted from the prior audit's own conclusion.
