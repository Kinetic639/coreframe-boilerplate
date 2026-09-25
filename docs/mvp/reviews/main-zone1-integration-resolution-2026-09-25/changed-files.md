# Changed Files (Staged, Uncommitted)

**121 files staged: 45 added, 74 modified, 2 deleted.** Full detail in `diff.patch` (13,425 lines) and `git diff --cached --name-status`.

## The 8 files this pass actually made a resolution DECISION on

- `apps/web/src/components/data-view/data-view.tsx` — take main
- `apps/web/src/components/data-view/data-view-provider.tsx` — take main
- `apps/web/src/components/data-view/use-data-view-query.ts` — take main
- `apps/web/src/app/[locale]/dashboard/warehouse/inventory/_components/inventory-client.tsx` — take main
- `apps/web/src/app/[locale]/dashboard/warehouse/inventory/movements/_components/inventory-movements-client.tsx` — take main (after explicit judgment, see `resolved-conflicts.md`)
- `apps/web/src/app/[locale]/dashboard/warehouse/items/_components/inventory-products-client.tsx` — take main
- `apps/web/src/app/[locale]/dashboard/warehouse/locations/page.tsx` — manual combine (both new prop lines)
- `docs/mvp/zones/11-home-operational-dashboard.md` — manual combine (full rewrite reconciling both sides)

## The 4 auto-merged files this pass cleaned up

- `apps/web/src/app/[locale]/dashboard/warehouse/locations/_components/locations-data-view.tsx` — removed dead `branchId` prop + unused `useAppStoreV2` read
- `apps/web/src/lib/data-view/types.ts` — removed dead `branchId?: string | null` field
- `apps/web/src/components/data-view/__tests__/data-view.test.tsx` — removed obsolete `T-DV-BRANCH` block
- `apps/web/src/app/[locale]/dashboard/warehouse/locations/_components/ambra-locations-client.tsx` — verified correct, no change needed

## Deleted (Zone 1's own file, retired, not a git conflict)

- `apps/web/src/components/data-view/__tests__/use-data-view-query.test.ts`

## Fixture drift fixed (found by tsc, not a merge conflict)

- `apps/web/src/app/[locale]/dashboard/warehouse/locations/_components/__tests__/ambra-locations-client.cross-branch.test.tsx` — added missing `organizationId` to `defaultProps`

## Branch-wiring tests updated to the new `scope` contract

- `apps/web/src/app/[locale]/dashboard/warehouse/locations/_components/__tests__/locations-data-view.branch-wiring.test.tsx`
- `apps/web/src/app/[locale]/dashboard/warehouse/inventory/_components/__tests__/inventory-client.branch-wiring.test.tsx`
- `apps/web/src/app/[locale]/dashboard/warehouse/inventory/movements/_components/__tests__/inventory-movements-client.branch-wiring.test.tsx`
- `apps/web/src/app/[locale]/dashboard/warehouse/items/_components/__tests__/inventory-products-client.branch-wiring.test.tsx`

## Everything else (108 files)

Brought in wholesale from `origin/main` by the merge itself — main's own DataView refactor's remaining files (data-view-columns.tsx, data-view-detail.tsx, data-view-layout.tsx, data-view-mobile-layout.tsx, data-view-pagination.tsx, data-view-search-params.ts, data-view-sidebar.tsx, data-view-table.tsx, data-view-toolbar.tsx, data-view-url-state.ts, data-view.types.ts, data-view-query-keys.ts, data-view-ssr.ts, ambra-data-view-scope.ts, README.md, and their own new test files), the full Zone 11 dashboard rebuild (`dashboard/start/**`), main's own migrated org-admin/CRM/Help Desk/Planning/QR DataView consumers, one new migration (`20260912065316_planning_tasks_branch_scope_rls.sql` — main's own pre-existing, already-reviewed Planning Tasks RLS work, not something this pass wrote or modified), and `docs/mvp/reviews/dataview-phase1-review/` + `docs/mvp/zones/08-tickets-*` (main's own review/planning docs). None of these required any decision by this pass — they applied with zero conflict.

## No DB/schema/RLS change introduced BY this resolution pass

The one new migration file listed above came in wholesale from `origin/main`, unmodified, as part of the standard merge — it was not written, edited, or reviewed for correctness by this pass (that already happened when it was originally merged into `main`). This pass itself wrote zero SQL, zero migrations, and touched zero RLS policy.

## Not committed

`git merge --no-commit` was used throughout; no `git commit` was run. The merge remains staged, index-resolved, uncommitted — `git status` shows `A`/`M`/`D` (staged), not `UU` (unresolved). See `merge-result.md`.
