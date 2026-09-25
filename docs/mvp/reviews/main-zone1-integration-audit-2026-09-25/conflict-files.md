# Actual Merge Conflicts (Non-Destructive Dry-Run)

Computed via `git merge-tree --write-tree HEAD origin/main` — a read-only Git 2.47 command that computes a merge result without touching the working tree, the index, or `HEAD`. Confirmed non-destructive: `git status --porcelain` was empty and `git rev-parse HEAD` was unchanged (`2593714c`) both before and after running it.

## 14 files changed on both sides → 8 real conflicts, 6 clean textual auto-merges

| #   | File                                                                                                           | Conflict?                                  | Classification        |
| --- | -------------------------------------------------------------------------------------------------------------- | ------------------------------------------ | --------------------- |
| 1   | `apps/web/src/app/[locale]/dashboard/warehouse/inventory/_components/inventory-client.tsx`                     | **CONFLICT**                               | RUNTIME               |
| 2   | `apps/web/src/app/[locale]/dashboard/warehouse/inventory/movements/_components/inventory-movements-client.tsx` | **CONFLICT**                               | RUNTIME               |
| 3   | `apps/web/src/app/[locale]/dashboard/warehouse/items/_components/inventory-products-client.tsx`                | **CONFLICT**                               | RUNTIME               |
| 4   | `apps/web/src/app/[locale]/dashboard/warehouse/locations/page.tsx`                                             | **CONFLICT**                               | RUNTIME               |
| 5   | `apps/web/src/components/data-view/data-view-provider.tsx`                                                     | **CONFLICT**                               | RUNTIME               |
| 6   | `apps/web/src/components/data-view/data-view.tsx`                                                              | **CONFLICT**                               | RUNTIME               |
| 7   | `apps/web/src/components/data-view/use-data-view-query.ts`                                                     | **CONFLICT**                               | RUNTIME               |
| 8   | `docs/mvp/zones/11-home-operational-dashboard.md`                                                              | **CONFLICT**                               | DOCS                  |
| 9   | `apps/web/messages/en.json`                                                                                    | clean auto-merge                           | CONFIG (i18n strings) |
| 10  | `apps/web/messages/pl.json`                                                                                    | clean auto-merge                           | CONFIG (i18n strings) |
| 11  | `apps/web/src/app/[locale]/dashboard/warehouse/locations/_components/ambra-locations-client.tsx`               | clean auto-merge, **but see caveat below** | RUNTIME               |
| 12  | `apps/web/src/app/[locale]/dashboard/warehouse/locations/_components/locations-data-view.tsx`                  | clean auto-merge, **but see caveat below** | RUNTIME               |
| 13  | `apps/web/src/components/data-view/__tests__/data-view.test.tsx`                                               | clean auto-merge, **but see caveat below** | TEST                  |
| 14  | `apps/web/src/lib/data-view/types.ts`                                                                          | clean auto-merge, **but see caveat below** | RUNTIME (types)       |

**Runtime conflicts: 7** (rows 1-7). **Docs conflicts: 1** (row 8). **Config (clean): 2** (rows 9-10). **Runtime (clean, needs cleanup): 3** (rows 11, 12, 14). **Test (clean, needs cleanup): 1** (row 13).

## Important caveat: "clean auto-merge" is not the same as "correct"

Rows 11, 12, 14 auto-merge without git conflict markers because the two sides' edits sit on non-overlapping lines within the same file — but the RESULT is semantically stale in a specific, identified way: it leaves Zone 1's own now-superseded `branchId` prop/field sitting alongside `origin/main`'s own newer, independently-built `scope`/`dataViewScope.branch(...)` mechanism that already achieves the same correctness goal. See `three-way-resolution-matrix.md` for the exact line-level detail and `zone1-protection-notes.md` for the full architectural finding. Row 13 (`data-view.test.tsx`) auto-merges because Zone 1's own 59 new lines (testing the now-superseded `branchId`/`queryKey` mechanism) and main's own 210 new lines (testing the new `scope`/`entity` mechanism) don't textually overlap — but Zone 1's own additions test behavior that this audit recommends removing (see `three-way-resolution-matrix.md`).

**None of rows 9-14 requires a manual conflict-marker resolution — but rows 11, 12, 13, 14 require a small, deliberate follow-up edit after the merge lands cleanly**, not a "trust the auto-merge and move on."
