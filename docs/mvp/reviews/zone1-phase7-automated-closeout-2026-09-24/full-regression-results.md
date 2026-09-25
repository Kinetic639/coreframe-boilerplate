# Zone 1 / Phase 7 — Complete Zone 1 Automated Regression Results

## Command (21 files, single run)

```
pnpm vitest run \
  src/app/[locale]/dashboard/_components/__tests__/sidebar-branch-switcher.test.tsx \
  src/app/actions/shared/__tests__/changeBranch.test.ts \
  src/app/[locale]/dashboard/_components/__tests__/permissions-sync.test.tsx \
  src/hooks/queries/v2/__tests__/use-branch-permissions-query.test.tsx \
  src/server/services/__tests__/permission-v2.service.test.ts \
  src/components/data-view/__tests__/use-data-view-query.test.ts \
  src/components/data-view/__tests__/data-view.test.tsx \
  src/app/[locale]/dashboard/warehouse/locations/_components/__tests__/locations-data-view.branch-wiring.test.tsx \
  src/app/[locale]/dashboard/warehouse/inventory/_components/__tests__/inventory-client.branch-wiring.test.tsx \
  src/app/[locale]/dashboard/warehouse/inventory/movements/_components/__tests__/inventory-movements-client.branch-wiring.test.tsx \
  src/app/[locale]/dashboard/warehouse/items/_components/__tests__/inventory-products-client.branch-wiring.test.tsx \
  src/hooks/queries/tools/__tests__/wdd-matcher.test.ts \
  src/components/tools/svwms-wdd-matcher/__tests__/extraction-review-approval.test.tsx \
  src/components/tools/svwms-wdd-matcher/__tests__/movement-import-boundary.test.ts \
  src/server/qr/__tests__/public-token-resolver.test.ts \
  src/app/[locale]/dashboard/warehouse/locations/_components/__tests__/ambra-locations-client.cross-branch.test.tsx \
  src/components/auth/forms/__tests__/sign-in-form.test.tsx \
  "src/app/[locale]/(public)/(auth)/sign-in/__tests__/page.test.tsx" \
  src/server/loaders/v2/__tests__/load-app-context.v2.test.ts \
  src/server/loaders/v2/__tests__/load-dashboard-context.v2.test.ts \
  src/server/services/__tests__/organization-rls.test.ts
```

## Result

```
Test Files  21 passed (21)
     Tests  262 passed | 2 skipped (264)
```

Zero failures. Zero unexpected skips.

## Per-file breakdown, grouped by the phase/area each file covers

| Area                                           | File                                                | Result                                                                                                     |
| ---------------------------------------------- | --------------------------------------------------- | ---------------------------------------------------------------------------------------------------------- |
| Phase 1                                        | `sidebar-branch-switcher.test.tsx`                  | 5/5 pass                                                                                                   |
| Phase 1                                        | `changeBranch.test.ts`                              | pass (all — now also directly exercises the Phase 6 correction's `isBranchAccessible()` extraction)        |
| Permissions                                    | `permissions-sync.test.tsx`                         | pass (all)                                                                                                 |
| Permissions                                    | `use-branch-permissions-query.test.tsx`             | pass (all)                                                                                                 |
| Permissions                                    | `permission-v2.service.test.ts`                     | pass, **2 skipped** (`T-REVOKE-DB`, `T-10K-DB` — see `static-check-results.md`... see below, live-DB-only) |
| Phase 2/3 DataView                             | `use-data-view-query.test.ts`                       | pass (all)                                                                                                 |
| Phase 2/3 DataView                             | `data-view.test.tsx`                                | pass (all)                                                                                                 |
| Phase 3 — Locations                            | `locations-data-view.branch-wiring.test.tsx`        | 2/2 pass                                                                                                   |
| Phase 3 — Inventory Balances                   | `inventory-client.branch-wiring.test.tsx`           | pass (all)                                                                                                 |
| Phase 3 — Inventory Movements                  | `inventory-movements-client.branch-wiring.test.tsx` | pass (all)                                                                                                 |
| Phase 3 — Inventory Products                   | `inventory-products-client.branch-wiring.test.tsx`  | pass (all)                                                                                                 |
| Phase 4 Matcher                                | `wdd-matcher.test.ts`                               | pass (all)                                                                                                 |
| Phase 4 Matcher                                | `extraction-review-approval.test.tsx`               | pass (all)                                                                                                 |
| Phase 4 Matcher                                | `movement-import-boundary.test.ts`                  | pass (all)                                                                                                 |
| Phase 6 QR                                     | `public-token-resolver.test.ts`                     | 13/13 pass                                                                                                 |
| Phase 6 QR                                     | `ambra-locations-client.cross-branch.test.tsx`      | 7/7 pass                                                                                                   |
| Phase 6 QR (returnUrl dependency)              | `sign-in-form.test.tsx`                             | pass (all)                                                                                                 |
| Phase 6 QR (returnUrl dependency)              | `sign-in/page.test.tsx`                             | pass (all)                                                                                                 |
| Context/Access                                 | `load-app-context.v2.test.ts`                       | pass (all, **fixed this phase**)                                                                           |
| Context/Access (Phase 6 correction dependency) | `load-dashboard-context.v2.test.ts`                 | 11/11 pass                                                                                                 |
| Context/Access                                 | `organization-rls.test.ts`                          | pass (all, **fixed this phase**)                                                                           |

## Skipped tests — exact and reasoned

Both skips are in `permission-v2.service.test.ts`, pre-existing (not introduced or affected by this phase), and live-DB-only:

- `T-REVOKE-DB: Revoke-under-wildcard proof (live DB) > revoking account.profile.read suppresses that expanded slug but not others`
- `T-10K-DB: UEP partial indexes exist on live DB (DB-backed) > audit_uep_partial_indexes() returns both partial indexes with correct predicates`

Classification: **SKIPPED — ENVIRONMENT UNAVAILABLE** (require a live Supabase DB connection not available in this sandboxed test environment; not something Phase 7's own task scope includes fixing — see `static-check-results.md` for the live-DB-test policy applied).

## Files re-confirmed still crashing (NOT part of the pass count above, intentionally excluded, documented separately)

`roles-client.test.tsx`, `invitations-client.test.tsx`, `members-client.test.tsx` — all 3 still fail with `TypeError: parseAsJson is not a function` (BLOCKER-Z1-017, unrelated nuqs library version mismatch in the shared `data-view-url-state.ts` module). Re-run fresh this phase to confirm the failure is unchanged; not fixed, per the plan's own explicit "Out of scope" instruction. See `blocker-closeout.md`.
