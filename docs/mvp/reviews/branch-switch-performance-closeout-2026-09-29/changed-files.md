# Changed Files

**Base:** `main` @ `1e86d66c`. The working branch `zone3-zone5-integration-audit` is @ `da109ae8`, whose tree is identical to `main`.

## Runtime (1 file)

| File                                                                       | Change                                                                                                                                                                                                                                       |
| -------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `apps/web/src/app/[locale]/dashboard/start/_components/scope-boundary.tsx` | The mismatch placeholder `<p role="status">{loadingLabel}</p>` is replaced by the existing `BrandLoader` (import from `@/components/branding`), with `PageLoader`'s presentation, inside the same `role="status"` container. No logic change |

## Tests (1 file)

| File                                                                          | Change                                                                                                                                                          |
| ----------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `apps/web/src/app/[locale]/dashboard/start/__tests__/scope-boundary.test.tsx` | 3 new tests (enter loading state, branded loader rendered / not a plain `<p>`, no loader without a switch); 1 existing test extended (loader gone after commit) |

## Documentation

| File                                                                         | Change                                                                                                                                           |
| ---------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------ |
| `docs/mvp/reviews/branch-switch-performance-closeout-2026-09-29/*` (8 files) | new closeout bundle                                                                                                                              |
| `docs/mvp/zones/01-auth-org-branch-access-progress.md`                       | new log entry: branch-switch performance RESOLVED FOR DEMO (region `dub1`, Supabase `eu-west-1`, Fluid Compute ON, ~1–2 s, deeper work deferred) |
| `docs/mvp/presentation-demo-setup.md`                                        | new "Deployment topology" section (co-location requirement)                                                                                      |

## Not changed

- `SidebarBranchSwitcher`, `changeBranch`, `_providers.tsx`, stores, `PermissionsSync`, the status-bar poll, loaders, layout, routing.
- Any DB/RLS/migration.
- Tickets/Tasks.
- The historical bundles `branch-switch-performance-audit-2026-09-28/` and `branch-switch-performance-design-2026-09-28/`: not rewritten (still untracked, as left by the earlier tasks).
- No commit. Phase 10D not started.
