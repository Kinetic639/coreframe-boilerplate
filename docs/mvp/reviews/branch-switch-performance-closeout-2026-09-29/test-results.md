# Test Results (2026-09-29)

All commands were run from `apps/web`.

## Focused run

```
pnpm vitest run \
  src/app/[locale]/dashboard/start/__tests__/scope-boundary.test.tsx \
  src/app/[locale]/dashboard/start/__tests__/composition.test.tsx \
  src/app/[locale]/dashboard/_components/__tests__/sidebar-branch-switcher.test.tsx \
  src/app/[locale]/dashboard/warehouse/locations/_components/__tests__/ambra-locations-client.cross-branch.test.tsx
```

Result: **4 files passed, 27 tests passed, 0 failed.**

## Zone 1 branch-switch + loader regression run

This covers every test file referencing `changeBranch`, `setActiveBranch`, `isBranchAccessible`, `hydrateFromServer`, `session-branch`, `BrandLoader` or `LoadingOverlay`, plus the whole `dashboard/start/__tests__` directory:

- `server/qr/__tests__/public-token-resolver.test.ts`
- `actions/shared/__tests__/changeBranch.test.ts`
- `dashboard/_components/__tests__/sidebar-branch-switcher.test.tsx`
- `dashboard/_components/__tests__/permissions-sync.test.tsx`
- `dashboard/__tests__/providers.test.tsx`
- `lib/__tests__/session-branch.test.ts`
- `lib/stores/v2/__tests__/{app,ui,user}-store.test.ts`
- `warehouse/locations/.../ambra-locations-client.cross-branch.test.tsx`
- `account/__tests__/account-components.test.tsx`
- `account/preferences/.../sections.test.tsx`
- `dashboard/start/__tests__/{scope-boundary,composition,data,model,planning-widget}.test.*`

Result: **17 files passed, 214 tests passed, 0 failed.**

## Tests added/updated

File: `apps/web/src/app/[locale]/dashboard/start/__tests__/scope-boundary.test.tsx`.

| Requirement                                                       | Test                                                                                                                                                                                                                                                                                                                                                                        |
| ----------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1. Selecting another branch enters the loading state              | "enters the branded loading state when the shell switches to another branch": store moves A→B while server children are A → `home-branch-loader` present, `aria-busy="true"`                                                                                                                                                                                                |
| 2. The existing branded loader is rendered                        | "renders the existing Ambra BrandLoader, not the old plain text line": the status element is the loader container and contains the brand SVG; the label is its caption                                                                                                                                                                                                      |
| 3. The old plain presentation is no longer the primary loading UI | same test: the `role="status"` element is no longer a bare `<p>`                                                                                                                                                                                                                                                                                                            |
| 4. The loader disappears after a successful transition            | existing "reveals content only after the server branch matches the shell", extended to assert that `home-branch-loader` is gone                                                                                                                                                                                                                                             |
| 5. The error path clears/never enters the loading state           | new "shows no loader and keeps the current branch content when no switch happened": the store is unchanged (as after a failed `changeBranch`) → no loader, content visible, `aria-busy="false"`, no navigation. Plus the **unchanged** switcher test "shows an error toast when the action fails and performs no transition" (no `setActiveBranch` / `replace` / `refresh`) |
| 6. No authorization/navigation behavior changed                   | the unchanged `sidebar-branch-switcher.test.tsx` (replace → refresh ordering, success/error), `changeBranch.test.ts` and the cross-branch QR tests all pass. The existing scope-boundary test for the `?branch=` corrective navigation passes unchanged                                                                                                                     |

The router commit isn't observable in jsdom. The tests therefore assert at the owning boundary: `HomeScopeBoundary`'s store-vs-server branch comparison.

## Static checks

- `pnpm type-check` (`tsc --noEmit`): **exit 0, no errors.**
- `npx eslint` on both changed files: **exit 0, no warnings.**
- `npx prettier --check` on both changed files: **all files use Prettier code style.**
