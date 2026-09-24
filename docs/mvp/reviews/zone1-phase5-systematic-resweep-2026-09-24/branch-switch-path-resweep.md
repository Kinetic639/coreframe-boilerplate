# Zone 1 / Phase 5 — Branch-Switch Path Re-Sweep

## Method

Exhaustive app-wide grep for every call to `changeBranch(` and `setActiveBranch(`, per the task's own explicit instruction not to limit the search to previously-known files.

```
grep -rn "changeBranch(" src/ --include="*.ts" --include="*.tsx" | grep -v "__tests__"
grep -rn "setActiveBranch(" src/ --include="*.ts" --include="*.tsx" | grep -v "__tests__"
```

## Results

### `changeBranch(` — 2 matches

1. `src/app/actions/shared/changeBranch.ts:22` — the server action's own definition (not a caller).
2. `src/app/[locale]/dashboard/_components/sidebar-branch-switcher.tsx:57` — the ONE caller in the entire app. This is `SidebarBranchSwitcher.handleBranchSelect`, the Phase-1-fixed centralized transition (`changeBranch()` → `setActiveBranch()` → `router.replace(SAFE_ROUTE)` → `router.refresh()`).

### `setActiveBranch(` — 2 matches

1. `src/app/[locale]/dashboard/_components/sidebar-branch-switcher.tsx:67` — the switcher's own call, part of the single accepted transition above.
2. `src/app/[locale]/dashboard/_providers.tsx:70` — `useAppStoreV2.getState().setActiveBranch(sessionBranchId)`, inside a `useEffect` with dependency `[context]`.

## Classification of the second `setActiveBranch` call

Read `_providers.tsx` in full. This effect fires whenever the SSR-derived `context` prop changes (i.e., after a hard navigation or an already-completed `router.refresh()` — meaning it runs strictly _after_ fresh server context exists, never before). Its purpose, per the file's own inline documentation: reconcile the per-tab `sessionStorage`-persisted branch preference (`session-branch.ts`, already confirmed correct in the pre-implementation audit) against the SSR-derived default — specifically to prevent another client's own branch switch (which writes `user_preferences.default_branch_id`) from silently overriding _this_ tab's own working branch on a routine refresh.

**This is not a second user-facing switch path.** It never originates a switch — it only reconciles which of two already-known-valid values (`sessionStorage` vs. SSR default) the Zustand store should hold, and only in response to context that is already fresh. It does not bypass Phase 1's redirect-and-refresh transition, because it isn't a switch trigger at all — no button, no user action, calls this function.

**Compatibility with Phases 2-4 confirmed structurally**: since this call updates the same reactive `activeBranchId` Zustand field that every Phase 2-4 consumer subscribes to via `useAppStoreV2((s) => s.activeBranchId)`, and since branch identity is now part of every relevant query key, ANY change to this field — regardless of which code path triggers it — automatically produces the correct new cache identity for every fixed consumer. This is not a special case requiring its own fix; it is exactly what the Phase 2-4 architecture was designed to handle generically.

## Verdict

**Exactly one accepted, user-facing branch-switch transition path exists in the app: `SidebarBranchSwitcher`.** No alternate path bypasses it. The `_providers.tsx` call is a session-hydration reconciliation mechanism, already established correct in the pre-implementation audit, confirmed here to remain safe and structurally compatible with every fix made in Phases 1-4.

## Deferred cross-check

The implementation plan's own task wording for this item includes "cross-check against Phase 6's own QR flow once that lands." Phase 6 (Cross-branch `warehouse.location` deep-link/QR) has not started. This specific cross-check cannot be performed yet and is explicitly deferred to Phase 6's own implementation — not a gap in this phase's own closure, since no QR-driven switch path exists yet to check against.
