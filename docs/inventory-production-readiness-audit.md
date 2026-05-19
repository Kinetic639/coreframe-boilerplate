# Inventory Production Readiness Audit

This is the working audit document for the Inventory / Warehouse implementation on
`inventory-feature`.

The reusable, clean checklist lives in
`docs/enterprise-production-readiness-audit-plan.md`. This file applies that checklist
to the actual branch contents, tracks evidence, and records findings.

---

## Audit Target

| Field                        | Value                                         |
| ---------------------------- | --------------------------------------------- |
| Feature / module             | Inventory / Warehouse                         |
| Branch                       | `inventory-feature`                           |
| Merge base                   | `d87b853926053c274d0a583af00efe9330b55d94`    |
| Branch commits reviewed from | `main...HEAD`                                 |
| Changed files in branch      | 106                                           |
| Diff size                    | 38,824 insertions / 2,956 deletions           |
| Audit owner                  | TBD                                           |
| Audit started                | 2026-05-18                                    |
| Audit completed              | TBD                                           |
| Release decision             | Blocked until all S1/S2 findings are resolved |

---

## Progress Tracker

| Area                                  | Status               | Evidence / notes                                                                                                                                                                                                                                                                                                                                                                                                                                                                          |
| ------------------------------------- | -------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1. Scope and diff baseline            | [x] Passed           | Full branch scope is accepted for this release: Inventory is primary scope; DataView/i18n/sidebar/package changes are supporting scope; WDD/QR/docs/tooling side work is accepted companion scope.                                                                                                                                                                                                                                                                                        |
| 2. Architecture and boundaries        | [x] Passed           | Neutral DataView and Inventory DTO modules now own shared contracts; inventory services no longer import UI component types and inventory clients no longer import server-only service DTOs. Product list display/import and CSV import/export ownership have been split into bounded modules. Re-audit on 2026-05-19 confirms the normal product list no longer owns import-wizard runtime code. Large create/action/service modules remain S3 maintainability debt, tracked separately. |
| 3. SSR-first data flow                | [x] Passed           | Inventory pages perform server-side context/permission checks and load initial data before rendering clients.                                                                                                                                                                                                                                                                                                                                                                             |
| 4. Server actions and service layer   | [!] Failed / blocked | Permission checks exist broadly, but image actions and CSV import path have production blockers.                                                                                                                                                                                                                                                                                                                                                                                          |
| 5. Database schema and migrations     | [!] Failed / blocked | Target DB state differs from production readiness requirements: RLS disabled on multiple inventory tables and advisors report security errors.                                                                                                                                                                                                                                                                                                                                            |
| 6. RLS and tenant isolation           | [!] Failed / blocked | Target MCP confirms multiple inventory tables with `rls_enabled=false`.                                                                                                                                                                                                                                                                                                                                                                                                                   |
| 7. Permissions and entitlements       | [!] Failed / blocked | Permission constants and seeded slugs exist, but cross-branch transfer line RLS policy resolves an org correlation incorrectly on target.                                                                                                                                                                                                                                                                                                                                                 |
| 8. Storage and file handling          | [!] Failed / blocked | Product image upload/assignment needs stricter server validation, ownership checks, and cleanup behavior.                                                                                                                                                                                                                                                                                                                                                                                 |
| 9. Validation and data integrity      | [!] Failed / blocked | SKU collision checks are not canonical across create/edit/import paths.                                                                                                                                                                                                                                                                                                                                                                                                                   |
| 10. Transactions and concurrency      | [!] Failed / blocked | CSV import can partially write products before later rows fail.                                                                                                                                                                                                                                                                                                                                                                                                                           |
| 11. Performance and caching           | [x] Passed           | Top-level XLSX bundle issue is closed; import wizard is isolated to `/items/import`; inventory FK index warnings are closed; ungrouped variant listing now pages through `inventory_product_list_rows_v1` before enrichment; key product list/detail/import/create render helpers use memoized values and stable callbacks. Remaining performance work belongs to later bundle measurement rather than known S2 blockers.                                                                 |
| 12. TDD and test coverage             | [!] Failed / blocked | Tests exist for migration text and some actions, but not for major product/import/image UI and service paths.                                                                                                                                                                                                                                                                                                                                                                             |
| 13. UI, accessibility, and i18n       | [!] Failed / blocked | Inventory UI contains many hard-coded English strings in localized route files.                                                                                                                                                                                                                                                                                                                                                                                                           |
| 14. Observability and audit trail     | [!] Failed / blocked | Audit events cover products and stock movements only; import/settings/image/transfer-specific events are not covered.                                                                                                                                                                                                                                                                                                                                                                     |
| 15. Import/export and bulk workflows  | [!] Failed / blocked | Import UI exists, but legacy CSV service path is not staged/transactional enough for production.                                                                                                                                                                                                                                                                                                                                                                                          |
| 16. Release, rollback, and operations | [!] Failed / blocked | Branch-wide type-check currently fails; failures must be fixed or proven pre-existing before release.                                                                                                                                                                                                                                                                                                                                                                                     |
| 17. Final production gate             | [!] Failed / blocked | S1/S2 findings and type-check failure block merge.                                                                                                                                                                                                                                                                                                                                                                                                                                        |

Status values:

- `[ ] Not started`
- `[~] In progress`
- `[x] Passed`
- `[!] Failed / blocked`
- `[-] Deferred with owner`

---

## Evidence Ledger

| Date       | Area            | Evidence                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                         | Result                                                                                                                                                                                                                                                                             | Follow-up                                                                           |
| ---------- | --------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------- |
| 2026-05-18 | Scope           | `git branch --show-current`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      | `inventory-feature`                                                                                                                                                                                                                                                                | None                                                                                |
| 2026-05-18 | Scope           | `git merge-base main HEAD`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                       | `d87b853926053c274d0a583af00efe9330b55d94`                                                                                                                                                                                                                                         | None                                                                                |
| 2026-05-18 | Scope           | `git diff --name-status main...HEAD`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                             | 106 changed files                                                                                                                                                                                                                                                                  | Full scope listed below                                                             |
| 2026-05-18 | Scope           | `git diff --stat main...HEAD`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                    | 38,824 insertions / 2,956 deletions                                                                                                                                                                                                                                                | Audit must include large shared changes                                             |
| 2026-05-18 | Scope           | User scope decision                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              | WDD, QR, and similar side work should not be reverted and should be included in current implementation                                                                                                                                                                             | Scope finding closed as accepted                                                    |
| 2026-05-18 | Scope           | `git log --oneline main..HEAD`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                   | Inventory, DataView, WDD, QR, and support commits are all intentionally part of the branch history                                                                                                                                                                                 | Release scope documented below                                                      |
| 2026-05-18 | Formatting      | `git diff --check main...HEAD`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                   | Passed                                                                                                                                                                                                                                                                             | None                                                                                |
| 2026-05-18 | Working tree    | `git status --short`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                             | Audit docs are untracked                                                                                                                                                                                                                                                           | Commit docs when accepted                                                           |
| 2026-05-18 | Architecture    | `rg -n "from ['\"]next/                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          | from ['\"]expo-                                                                                                                                                                                                                                                                    | createServiceClient                                                                 | SUPABASE_SERVICE_ROLE_KEY" packages apps/web/src/app/actions/warehouse/inventory apps/web/src/server/services 'apps/web/src/app/[locale]/dashboard/warehouse'` | No inventory service/action direct service-role usage; no package app imports found in paired check                            | Continue with detailed service review                                                                                      |
| 2026-05-18 | Architecture    | `rg -n "from ['\"].\*apps/                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                       | from ['\"]next/                                                                                                                                                                                                                                                                    | from ['\"]expo-                                                                     | createServiceClient                                                                                                                                            | SUPABASE_SERVICE_ROLE_KEY                                                                                                      | cookies\\(                                                                                                                 | headers\\(" packages`                                                                                            | No package source imports app code, Next, Expo, cookies, headers, or service-role runtime. Only `packages/supabase/CLAUDE.md` documentation mentions `createServiceClient`. | Package-tier boundary passed |
| 2026-05-18 | Architecture    | `pnpm --filter contracts check-types`, `pnpm --filter domain check-types`, `pnpm --filter supabase check-types`                                                                                                                                                                                                                                                                                                                                                                                                                  | All passed                                                                                                                                                                                                                                                                         | Shared package type boundary passed                                                 |
| 2026-05-18 | Architecture    | `rg -n "from ['\"]@/components                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                   | from ['\"]@/app                                                                                                                                                                                                                                                                    | from ['\"]@/server                                                                  | from ['\"]@/hooks                                                                                                                                              | from ['\"]@/lib                                                                                                                | from ['\"]@/utils" apps/web/src/server/services/inventory-\*.ts`                                                           | Inventory services import `DataViewListParams` / `PaginatedResult` from `@/components/data-view/data-view.types` | S3 boundary coupling finding opened                                                                                                                                         |
| 2026-05-18 | Architecture    | `rg -n "from ['\"]@/server                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                       | from ['\"]@/utils/supabase                                                                                                                                                                                                                                                         | createClient\\(                                                                     | createServiceClient                                                                                                                                            | SUPABASE_SERVICE_ROLE_KEY" 'apps/web/src/app/[locale]/dashboard/warehouse' --glob '_client.tsx' --glob '_\_components/\*.tsx'` | Client components only use server service imports as type-only DTO imports; no runtime Supabase/service-role imports found | Type-only DTO coupling documented as S3; runtime boundary passed                                                 |
| 2026-05-18 | Architecture    | `wc -l` over inventory clients/actions/services                                                                                                                                                                                                                                                                                                                                                                                                                                                                                  | Product list client 3,018 LOC; product create client 3,299 LOC; product edit client 1,756 LOC; product service 3,313 LOC; inventory actions 2,263 LOC                                                                                                                              | Existing S3 maintainability finding confirmed                                       |
| 2026-05-18 | SSR             | Manual read of inventory route pages                                                                                                                                                                                                                                                                                                                                                                                                                                                                                             | Inventory pages load dashboard context and check permissions server-side before rendering client components                                                                                                                                                                        | Passed initial SSR gate                                                             |
| 2026-05-18 | RLS             | Supabase target MCP `execute_sql` against `pg_class`                                                                                                                                                                                                                                                                                                                                                                                                                                                                             | 12 inventory tables have RLS disabled; 2 more have RLS enabled but not forced                                                                                                                                                                                                      | S1/S2 findings opened                                                               |
| 2026-05-18 | Security        | Supabase target MCP `get_advisors` security                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      | Security errors for RLS-disabled inventory tables and `inventory_balance_analytics` security-definer view                                                                                                                                                                          | S1 findings opened                                                                  |
| 2026-05-18 | Performance     | Supabase target MCP `get_advisors` performance                                                                                                                                                                                                                                                                                                                                                                                                                                                                                   | Many inventory foreign keys lack covering indexes; many multiple permissive policies                                                                                                                                                                                               | S2/S3 findings opened                                                               |
| 2026-05-18 | Storage         | Manual read of image upload/assignment actions                                                                                                                                                                                                                                                                                                                                                                                                                                                                                   | Upload path trusts file metadata; gallery assignment accepts client-provided storage/public URL metadata                                                                                                                                                                           | S2 finding opened                                                                   |
| 2026-05-18 | Performance     | Manual read of product listing service                                                                                                                                                                                                                                                                                                                                                                                                                                                                                           | Ungrouped variants mode fetches all products before in-memory pagination                                                                                                                                                                                                           | S2 finding opened                                                                   |
| 2026-05-18 | Validation      | Manual read of SKU collision service                                                                                                                                                                                                                                                                                                                                                                                                                                                                                             | Create/edit collision check trims only and uses exact DB `.in("sku")` comparison                                                                                                                                                                                                   | S2 finding opened                                                                   |
| 2026-05-18 | Import          | Manual read of CSV preview/import service path                                                                                                                                                                                                                                                                                                                                                                                                                                                                                   | Import parses full CSV in memory, writes incrementally, and can leave partial imports                                                                                                                                                                                              | S2 finding opened                                                                   |
| 2026-05-18 | Permissions     | Supabase target MCP `execute_sql` over `permissions`                                                                                                                                                                                                                                                                                                                                                                                                                                                                             | Warehouse permission slugs are seeded in target DB                                                                                                                                                                                                                                 | Continue policy-level review                                                        |
| 2026-05-18 | RLS             | Supabase target MCP `execute_sql` over `pg_policies` and local migration read                                                                                                                                                                                                                                                                                                                                                                                                                                                    | Branch transfer line policy compiles `t.organization_id = t.organization_id` on target                                                                                                                                                                                             | S1 finding opened                                                                   |
| 2026-05-18 | Tests           | `rg` over inventory test files                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                   | Coverage is mostly migration text tests plus a narrow action/service set                                                                                                                                                                                                           | S2 finding opened                                                                   |
| 2026-05-18 | Tests           | `pnpm --filter web test:run src/server/services/__tests__/inventory-products.service.test.ts src/app/actions/warehouse/inventory/__tests__/inventory-actions.test.ts src/server/services/__tests__/inventory-cross-branch-transfers.test.ts`                                                                                                                                                                                                                                                                                     | Passed: 3 files, 14 tests                                                                                                                                                                                                                                                          | Keep as smoke, expand coverage                                                      |
| 2026-05-18 | Tests           | `pnpm --filter web test:run` over all inventory migration/action/service tests plus RLS permission invariant                                                                                                                                                                                                                                                                                                                                                                                                                     | Passed: 8 files, 66 tests                                                                                                                                                                                                                                                          | Existing inventory suite is green but not broad enough                              |
| 2026-05-18 | Type-check      | `pnpm --filter web type-check`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                   | Failed with existing branch-wide TS errors outside the inventory files inspected so far                                                                                                                                                                                            | S1 production-gate finding opened                                                   |
| 2026-05-18 | Maintainability | `wc -l` over inventory clients/actions/services                                                                                                                                                                                                                                                                                                                                                                                                                                                                                  | Product list client 3,018 LOC; product create client 3,299 LOC; product service 3,313 LOC; inventory actions 2,263 LOC                                                                                                                                                             | S3 finding opened                                                                   |
| 2026-05-18 | Formatting      | `git diff --check -- docs/enterprise-production-readiness-audit-plan.md docs/inventory-production-readiness-audit.md`                                                                                                                                                                                                                                                                                                                                                                                                            | Passed                                                                                                                                                                                                                                                                             | None                                                                                |
| 2026-05-18 | Observability   | `rg -n "eventService\\.emit                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      | warehouse\\.inventory"` over inventory actions and event registry                                                                                                                                                                                                                  | Audit registry covers product created/updated/archived and movement posted/reversed | S3 finding opened                                                                                                                                              |
| 2026-05-18 | Architecture    | Refactor inventory product workflows                                                                                                                                                                                                                                                                                                                                                                                                                                                                                             | Product list client split to 338 LOC; display/detail moved to `inventory-product-display.tsx`; import wizard moved to `_components/import-wizard/*`; product create controls/utils/styles extracted; CSV import/export moved to `InventoryProductImportsService`                   | Area 2 ownership improved; residual S3 maintainability remains                      |
| 2026-05-18 | Architecture    | `wc -l` after split                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              | Product list client 338 LOC; import wizard 1,736 LOC; product create client 2,307 LOC; inventory action file 2,204 LOC; product service 2,670 LOC; product import/export service 501 LOC                                                                                           | Continue future finer splits during hardening                                       |
| 2026-05-18 | Architecture    | `rg -n "from ['\"]@/components" apps/web/src/server/services/inventory*.service.ts apps/web/src/app/actions/warehouse/inventory`                                                                                                                                                                                                                                                                                                                                                                                                 | No matches                                                                                                                                                                                                                                                                         | Service-to-UI boundary remains clean                                                |
| 2026-05-18 | Architecture    | `rg -n "from ['\"]@/server/services/inventory" 'apps/web/src/app/[locale]/dashboard/warehouse' --glob '*client.tsx' --glob '*_components/*.tsx'`                                                                                                                                                                                                                                                                                                                                                                                 | No matches                                                                                                                                                                                                                                                                         | Client-to-server-service boundary remains clean                                     |
| 2026-05-18 | Performance     | `rg -n "from \"xlsx\"                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                            | from 'xlsx'                                                                                                                                                                                                                                                                        | require\\(\"xlsx\"\\)                                                               | import\\(\"xlsx\"\\)" 'apps/web/src/app/[locale]/dashboard/warehouse/items' apps/web/src/server/services`                                                      | `xlsx` appears only as dynamic imports inside import utilities/wizard handlers                                                 | Product list top-level bundle issue closed                                                                                 |
| 2026-05-18 | Performance     | Supabase target MCP `apply_migration`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                            | Applied `inventory_fk_performance_indexes` and `inventory_remaining_fk_performance_indexes` to target                                                                                                                                                                              | Inventory FK index finding closed after advisor rerun                               |
| 2026-05-18 | Performance     | Supabase target MCP `get_advisors` performance                                                                                                                                                                                                                                                                                                                                                                                                                                                                                   | No remaining inventory `unindexed_foreign_keys` findings observed; remaining inventory warnings are `multiple_permissive_policies`                                                                                                                                                 | Policy consolidation tracked under RLS/security hardening                           |
| 2026-05-18 | Performance     | Supabase target MCP `apply_migration`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                            | Applied `inventory_product_list_rows_view` to target                                                                                                                                                                                                                               | Enables paged ungrouped product/variant listing                                     |
| 2026-05-18 | Performance     | Manual read of `InventoryProductsService.listProducts` after refactor                                                                                                                                                                                                                                                                                                                                                                                                                                                            | Ungrouped variant mode now queries `inventory_product_list_rows_v1` with `.range(from, to)` before enriching only products needed for the page                                                                                                                                     | Ungrouped pagination finding closed                                                 |
| 2026-05-18 | Tests           | Focused inventory test run after Area 2/11 refactor                                                                                                                                                                                                                                                                                                                                                                                                                                                                              | Passed: 5 files, 35 tests                                                                                                                                                                                                                                                          | Smoke coverage stayed green                                                         |
| 2026-05-18 | Type-check      | `pnpm --filter web type-check` after Area 2/11 refactor                                                                                                                                                                                                                                                                                                                                                                                                                                                                          | Still fails only with known non-inventory errors listed in production gate                                                                                                                                                                                                         | Inventory refactor did not introduce new TS errors in inspected output              |
| 2026-05-18 | UI/i18n         | `rg` for user-visible English strings in inventory route files                                                                                                                                                                                                                                                                                                                                                                                                                                                                   | Product/import/settings UI has many hard-coded labels/messages                                                                                                                                                                                                                     | S2 finding opened                                                                   |
| 2026-05-19 | Architecture    | `rg -n "InventoryProductImportWizard\|importOnly\|InventoryTagRow\|InventoryTaxRateRow\|InventoryUnitRow" 'apps/web/src/app/[locale]/dashboard/warehouse/items/_components/inventory-products-client.tsx' 'apps/web/src/app/[locale]/dashboard/warehouse/items/import/page.tsx'`                                                                                                                                                                                                                                                 | Product list no longer imports the import wizard or import-only master-data props; only `/items/import/page.tsx` owns `InventoryProductImportWizard`                                                                                                                               | Product list/import ownership split reverified                                      |
| 2026-05-19 | Performance     | `rg -n "from ['\"]xlsx\|require\\(['\"]xlsx\|await import\\(['\"]xlsx" 'apps/web/src/app/[locale]/dashboard/warehouse/items' apps/web/src/server/services`                                                                                                                                                                                                                                                                                                                                                                       | `xlsx` remains dynamic-import only inside import utilities/wizard handlers                                                                                                                                                                                                         | Normal product list bundle remains clean                                            |
| 2026-05-19 | Performance     | Client render helper review and patch                                                                                                                                                                                                                                                                                                                                                                                                                                                                                            | Product list render props are stable callbacks; product display uses memoized sidebar/expanded rows and memoized detail derivations; product create SKU helpers and import preview/mapping helpers now use `useMemo`/`useCallback` where they feed expensive table/modal rendering | Avoidable render churn reduced                                                      |
| 2026-05-19 | Performance     | Supabase target MCP `get_advisors` performance                                                                                                                                                                                                                                                                                                                                                                                                                                                                                   | No inventory `unindexed_foreign_keys` findings observed; inventory `multiple_permissive_policies` warnings remain and are tracked under RLS/security hardening rather than Area 11 query indexing                                                                                  | Area 11 DB indexing remains closed                                                  |
| 2026-05-19 | Tests           | `pnpm --filter web test:run src/app/actions/warehouse/inventory/__tests__/inventory-actions.test.ts src/server/services/__tests__/inventory-phase1-migrations.test.ts src/server/services/__tests__/inventory-phase2-migrations.test.ts src/server/services/__tests__/inventory-phase3-migrations.test.ts src/server/services/__tests__/inventory-product-creation-enhancements.test.ts src/server/services/__tests__/inventory-products.service.test.ts src/server/services/__tests__/inventory-cross-branch-transfers.test.ts` | Passed: 7 files, 49 tests                                                                                                                                                                                                                                                          | Area 2/11 refactor smoke stayed green                                               |
| 2026-05-19 | Type-check      | `pnpm --filter web exec tsc --noEmit --pretty false`                                                                                                                                                                                                                                                                                                                                                                                                                                                                             | Failed only with known non-inventory errors in auth/organization/font/feedback/site-settings files; no inventory files appeared in the error output                                                                                                                                | Branch-wide production gate still blocked outside Area 2/11                         |

---

## Scope Decision Record

### Decision

The full `main...HEAD` diff on `inventory-feature` is accepted release scope for this audit.
No WDD, QR, DataView, or planning-doc changes should be reverted as part of scope cleanup.

The branch scope is therefore:

- **Primary feature scope:** Inventory / Warehouse product catalog, inventory movements,
  branch transfers, settings, import workflows, actions, services, migrations, generated
  target types, permissions, sidebar/routing, audit registry, and tests.
- **Supporting platform scope:** Shared DataView upgrades, dashboard layout/header updates,
  org branch/user DataView migrations, package/lockfile changes, i18n routing, messages, and
  sidebar registry changes needed by or affected by the Inventory work.
- **Accepted companion scope:** WDD matcher parser/enhanced PDF fixes, QR generator/DataView
  flow changes, planning documents, tracked Supabase CLI metadata, and local editor settings
  already present in the branch.

### Scope Evidence

| Check                   | Result                                                                                               |
| ----------------------- | ---------------------------------------------------------------------------------------------------- |
| Branch                  | `inventory-feature`                                                                                  |
| Merge base              | `d87b853926053c274d0a583af00efe9330b55d94`                                                           |
| Diff command            | `git diff --name-status main...HEAD`                                                                 |
| Changed files           | 106                                                                                                  |
| Diff size               | 38,824 insertions / 2,956 deletions                                                                  |
| Commit scope            | Inventory, DataView, WDD, QR, and support commits                                                    |
| Working tree scope docs | `docs/enterprise-production-readiness-audit-plan.md`, `docs/inventory-production-readiness-audit.md` |

### Scope Boundaries For The Rest Of This Audit

- Any file listed in **Branch File Inventory** below is in audit scope.
- WDD and QR changes are accepted in this branch, but they are not inventory correctness
  blockers unless they break shared production gates such as type-check, build, lint, or
  shared DataView behavior.
- Shared DataView changes are full audit scope because Inventory depends on them and they
  affect existing organization/QR pages.
- Planning docs are accepted branch artifacts. They do not need runtime hardening, but they
  must remain accurate enough not to mislead future implementation work.
- The tracked `apps/web/supabase-target/supabase/.temp/cli-latest` change is accepted as
  branch-local Supabase tooling metadata because it is already tracked in the repo; it should
  be rechecked during the final release gate if the team decides generated tooling metadata
  should not ship.

### Resolved Scope Finding

#### S3 - Branch Scope Mixes Inventory With Other Feature Work

- **Area:** Scope / release control
- **Files:** Branch-wide diff from `main...HEAD`
- **Previous issue:** The branch contains Inventory work plus shared DataView work, WDD
  matcher changes, QR generator changes, and planning docs.
- **Decision:** Accepted. The user explicitly confirmed the WDD/QR side work should stay and
  be included in the current implementation.
- **Verification:** The full `git diff --name-status main...HEAD` file set is now the
  accepted audit/release scope.
- **Status:** Closed / accepted

---

## Area 2 Architecture And Boundaries Re-Audit

Area 2 was re-audited after the scope decision and then remediated. The previous green
status was too broad because shared DTOs crossed UI and server ownership boundaries. The
runtime package/app boundary was healthy already; the code now also has neutral DTO
ownership for the DataView and Inventory contracts.

### Verification Matrix

| Check                                                                 | Result                                                                                                                                                                                                                                      | Decision                           |
| --------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------- |
| App-specific runtime code stays in `apps/*`                           | Passed. Inventory runtime code lives under `apps/web/src/...`; shared package changes are constants/types.                                                                                                                                  | OK                                 |
| Shared packages are platform neutral                                  | Passed. Package scan found no `next/*`, `expo-*`, cookies, headers, app imports, or service-role runtime in package source.                                                                                                                 | OK                                 |
| No package imports from `apps/*`                                      | Passed. No package source import violations found.                                                                                                                                                                                          | OK                                 |
| Service-role usage is app-local and server-only                       | Passed for Inventory. Inventory actions/services do not import `createServiceClient` or `SUPABASE_SERVICE_ROLE_KEY`.                                                                                                                        | OK                                 |
| Server actions are thin orchestration layers                          | Passed for Area 2 ownership. Actions remain server-only orchestration over services and schema validation. The single action file is still too large, but that is tracked as S3 maintainability debt rather than a tier boundary violation. | OK with S3 maintainability finding |
| Server-only business rules live in services                           | Passed for core inventory domains. Product, movement, balance, branch-transfer, and enterprise rules live in services. Upload/gallery and import hardening are tracked in the file-handling/import areas.                                   | OK with S2/S3 hardening findings   |
| Pure reusable cross-platform rules are candidates for shared packages | Not yet needed. Current inventory rules are app-local because they query Supabase and depend on app context.                                                                                                                                | OK                                 |
| Database contract types regenerated                                   | Passed evidence. `apps/web/supabase/types/target.types.ts` changed in branch and package type checks pass. Full schema correctness is covered in DB/RLS areas.                                                                              | OK for Area 2                      |
| Permission/module constants match migrations                          | Passed initial invariant. `@repo/contracts/permissions` includes Inventory slugs and local invariant tests assert expected slug strings. Live target verification continues in permissions/RLS areas.                                       | OK for Area 2                      |
| No circular/tier violations introduced                                | No package-tier violation found. Full circular dependency tooling was not run; current import scans did not reveal package/app cycles.                                                                                                      | OK with tooling gap noted          |
| Server services do not depend on UI component layer                   | Passed. Inventory services import `DataViewListParams` / `PaginatedResult` from `apps/web/src/lib/data-view/types.ts`; the component module only re-exports the neutral contract for UI compatibility.                                      | OK                                 |
| Client components do not depend on `server-only` modules              | Passed. Inventory client components import DTOs from `apps/web/src/lib/warehouse/inventory-types.ts`; static scan shows no `@/server/services/inventory*` imports in inventory client components.                                           | OK                                 |

### Area 2 Decision

Area 2 is **passed** for architecture and boundary ownership:

- DataView request/response DTOs now live in `apps/web/src/lib/data-view/types.ts`.
- Inventory read/write DTOs consumed by clients and services now live in
  `apps/web/src/lib/warehouse/inventory-types.ts`.
- Product list rendering/detail concerns now live in
  `apps/web/src/app/[locale]/dashboard/warehouse/items/_components/inventory-product-display.tsx`.
- Import wizard UI/import parsing concerns now live in
  `apps/web/src/app/[locale]/dashboard/warehouse/items/_components/import-wizard/*`.
- CSV import/export service concerns now live in
  `apps/web/src/server/services/inventory-product-imports.service.ts`.
- Inventory services no longer import from `@/components/*`.
- Inventory client components no longer import from `@/server/services/inventory*`.
- Package scans still show no package-tier, platform, cookies/headers, or service-role
  runtime violations; the only `createServiceClient` package hit is documentation in
  `packages/supabase/CLAUDE.md`.

Verification run:

- `rg -n "from ['\"]@/components" apps/web/src/server/services/inventory-*.ts apps/web/src/app/actions/warehouse/inventory/index.ts` returned no matches.
- `rg -n "from ['\"]@/server/services/inventory" 'apps/web/src/app/[locale]/dashboard/warehouse' --glob '*client.tsx' --glob '*_components/*.tsx'` returned no matches.
- `rg -n "@/components/data-view/data-view\.types" apps/web/src/server apps/web/src/app/actions/warehouse/inventory apps/web/src/lib` returned no matches.
- `wc -l` after remediation: product list client 338 LOC; import wizard 1,736 LOC;
  product creation client 2,307 LOC; inventory action file 2,204 LOC; product service
  2,670 LOC; product import/export service 501 LOC.
- `pnpm --filter contracts check-types`, `pnpm --filter domain check-types`, and
  `pnpm --filter supabase check-types` passed, confirming shared package type boundaries
  remain healthy.
- `pnpm --filter web test:run src/server/services/__tests__/inventory-products.service.test.ts src/app/actions/warehouse/inventory/__tests__/inventory-actions.test.ts src/server/services/__tests__/inventory-cross-branch-transfers.test.ts src/server/services/__tests__/inventory-product-creation-enhancements.test.ts src/lib/constants/__tests__/rls-permission-invariants.test.ts` passed: 5 files, 35 tests.
- `pnpm --filter web type-check` still fails only on existing non-inventory files listed in Area 16; no inventory file errors were reported.

---

## Open Findings

### S1 - Target Inventory Tables Have RLS Disabled

- **Area:** RLS / tenant isolation
- **Files:** `apps/web/supabase-target/supabase/migrations/20260508090000_inventory_phase3_advanced_features.sql:1008`
- **Issue:** The target database has RLS disabled for these public inventory tables:
  `inventory_collection_items`, `inventory_collections`, `inventory_count_lines`,
  `inventory_count_sessions`, `inventory_custom_field_values`, `inventory_custom_fields`,
  `inventory_export_jobs`, `inventory_import_jobs`, `inventory_product_unit_conversions`,
  `inventory_report_runs`, `inventory_saved_views`, and `inventory_valuation_snapshots`.
- **Impact:** These tables are exposed through PostgREST without database-enforced tenant
  isolation. In a multi-tenant app, that is a production-blocking data isolation risk.
- **Required fix:** Add and apply a local target migration that enables and forces RLS on
  every inventory-owned public table, creates/repairs policies for each table, and verifies
  the applied target state. Investigate why the existing phase 3 migration did not leave
  the target DB in the intended state.
- **Verification:** Supabase target MCP query must return `rls_enabled=true` and
  `rls_forced=true` for all tenant-owned `inventory_%` tables. Supabase security advisor
  must have no `rls_disabled_in_public` errors for inventory tables.
- **Advisor remediation:** https://supabase.com/docs/guides/database/database-linter?lint=0013_rls_disabled_in_public
- **Owner:** TBD
- **Status:** Open

### S1 - Inventory Analytics View Runs As Security Definer

- **Area:** RLS / view security
- **Files:** `apps/web/supabase-target/supabase/migrations/20260508090000_inventory_phase3_advanced_features.sql:622`
- **Issue:** Supabase security advisor reports `public.inventory_balance_analytics` as a
  security-definer view.
- **Impact:** Security-definer views can bypass the querying user's normal Postgres
  permissions and RLS behavior. For inventory balances, this can leak cross-tenant or
  cross-branch stock data if the view is exposed or queried from app code.
- **Required fix:** Recreate the view with safe security behavior, preferably
  `security_invoker=true` where supported, or replace it with an RPC that validates
  tenant/branch permissions explicitly.
- **Verification:** Supabase security advisor has no `security_definer_view` error for
  `inventory_balance_analytics`; cross-org/cross-branch tests prove denial.
- **Advisor remediation:** https://supabase.com/docs/guides/database/database-linter?lint=0010_security_definer_view
- **Owner:** TBD
- **Status:** Open

### S1 - Branch Transfer Line RLS Loses Organization Correlation

- **Area:** RLS / tenant isolation / branch permissions
- **Files:** `apps/web/supabase-target/supabase/migrations/20260510090000_inventory_cross_branch_transfers.sql:534`,
  `apps/web/supabase-target/supabase/migrations/20260510090000_inventory_cross_branch_transfers.sql:550`
- **Issue:** The migration writes branch transfer line policies with
  `t.organization_id = organization_id`. In the target DB, Supabase reports the compiled policy
  as `t.organization_id = t.organization_id`, which is a tautology. The line table also stores
  `organization_id` separately while `transfer_id` references only `inventory_branch_transfers(id)`.
- **Impact:** The policy no longer proves that the line row organization matches the transfer
  organization. This is a production-blocking RLS correctness issue for cross-branch transfer
  detail rows.
- **Required fix:** Qualify all outer-row references explicitly in transfer line policies, for
  example `inventory_branch_transfer_lines.organization_id`. Prefer composite FKs that include
  `(transfer_id, organization_id)` and tenant-owned referenced entities where possible.
- **Verification:** Supabase target `pg_policies` output must show a non-tautological
  organization comparison, and cross-org/cross-branch policy tests must prove denial.
- **Owner:** TBD
- **Status:** Open

### S2 - Inventory Storage Bucket Allows Broad Public Listing

- **Area:** Storage / data exposure
- **Files:** `apps/web/supabase-target/supabase/migrations/20260510094000_inventory_product_creation_enhancements.sql`
- **Issue:** Supabase security advisor reports the public `inventory-item-images` bucket
  has a broad storage object SELECT policy named `inventory_item_images_storage_public_read`.
- **Impact:** Public URLs may be intentional for product images, but broad object listing is
  usually not needed and can expose inventory image paths, product IDs, or tenant structure.
- **Required fix:** Remove broad bucket listing and rely on object public URLs or narrowly
  scoped object policies. Confirm image records still enforce organization ownership.
- **Verification:** Supabase security advisor has no `public_bucket_allows_listing` warning
  for `inventory-item-images`, and image display still works.
- **Advisor remediation:** https://supabase.com/docs/guides/database/database-linter?lint=0025_public_bucket_allows_listing
- **Owner:** TBD
- **Status:** Open

### S2 - Inventory Foreign Keys Need Covering Indexes Before Scale

- **Area:** Database performance
- **Files:** `apps/web/supabase-target/supabase/migrations/20260518190000_inventory_fk_performance_indexes.sql`,
  `apps/web/supabase-target/supabase/migrations/20260518193000_inventory_remaining_fk_performance_indexes.sql`
- **Issue:** Supabase performance advisor reported many unindexed inventory foreign keys,
  including stock balances, allocations, branch transfers, and transfer lines.
- **Impact:** Deletes/updates on referenced rows and joins across inventory tables can become
  slow or lock-heavy as data grows. Inventory is expected to accumulate high-volume records,
  so this is production hardening work, not polish.
- **Fix:** Added covering indexes for all inventory foreign keys reported by the
  performance advisor.
- **Verification:** Supabase target MCP migrations were applied and the performance advisor
  no longer showed inventory `unindexed_foreign_keys` findings. Remaining inventory
  performance advisor warnings are `multiple_permissive_policies` and are tracked under
  RLS/security hardening.
- **Advisor remediation:** https://supabase.com/docs/guides/database/database-linter?lint=0001_unindexed_foreign_keys
- **Owner:** Inventory
- **Status:** Closed

### S3 - Product List Client Bundles XLSX At Top Level

- **Area:** Performance / bundle size
- **Files:** `apps/web/src/app/[locale]/dashboard/warehouse/items/_components/inventory-products-client.tsx`,
  `apps/web/src/app/[locale]/dashboard/warehouse/items/_components/import-wizard/*`
- **Issue:** `xlsx` was imported at the top of the product list client component even though
  it is only needed for import/sample-file workflows.
- **Impact:** The normal products page can pay for a heavy spreadsheet dependency even when
  the user is only browsing products.
- **Fix:** Split the import wizard out of the product list client and moved `xlsx` usage to
  dynamic imports inside import/sample generation utilities.
- **Verification:** `rg` only finds `await import("xlsx")` inside import wizard/utilities; no
  top-level spreadsheet import remains in the normal product list client path.
- **Owner:** Inventory
- **Status:** Closed

### S3 - Inventory Product Workflow Files Are Too Large For Long-Term Maintainability

- **Area:** Architecture / maintainability
- **Files:** `apps/web/src/app/[locale]/dashboard/warehouse/items/_components/inventory-products-client.tsx`,
  `apps/web/src/app/[locale]/dashboard/warehouse/items/new/_components/inventory-product-create-client.tsx`,
  `apps/web/src/server/services/inventory-products.service.ts`,
  `apps/web/src/app/actions/warehouse/inventory/index.ts`
- **Issue:** Several inventory files had grown into multi-thousand-line modules:
  product list client 3,018 LOC, product creation client 3,299 LOC, product service 3,313 LOC,
  and inventory actions 2,263 LOC. Area 2 remediation has reduced the worst ownership
  violations, but product creation, actions, and product service still need further splits
  before the module is pleasant to maintain long term.
- **Impact:** Large files make review, testing, bundle splitting, ownership boundaries, and
  future Zoho-like workflow changes harder. This is not automatically a runtime bug, but it is
  below the desired enterprise maintainability bar. After the DTO boundary cleanup, this is
  no longer blocking Area 2; it remains a focused maintainability/hardening follow-up.
- **Remediation completed:** Product list/detail display moved to
  `inventory-product-display.tsx`; import wizard moved to `_components/import-wizard/*`;
  product create controls/utils/styles were extracted; CSV import/export moved to
  `InventoryProductImportsService`.
- **Remaining fix:** Continue splitting by workflow and responsibility: product image gallery,
  SKU modal internals, product create sections, settings presets, product read service, and
  product write service.
- **Verification:** Each extracted module has focused tests and no page-level client component
  owns unrelated import/list/edit/settings behavior.
- **Owner:** TBD
- **Status:** Open

### S3 - Inventory DTOs Cross UI And Server Module Boundaries

- **Area:** Architecture / boundaries
- **Files:** `apps/web/src/server/services/inventory-balances.service.ts:4`,
  `apps/web/src/server/services/inventory-movements.service.ts:4`,
  `apps/web/src/server/services/inventory-products.service.ts:4`,
  `apps/web/src/app/[locale]/dashboard/warehouse/items/_components/inventory-products-client.tsx:45`,
  `apps/web/src/app/[locale]/dashboard/warehouse/items/new/_components/inventory-product-create-client.tsx`,
  `apps/web/src/app/[locale]/dashboard/warehouse/items/[productId]/edit/_components/inventory-product-edit-client.tsx:26`,
  `apps/web/src/app/[locale]/dashboard/warehouse/inventory/_components/inventory-client.tsx:16`,
  `apps/web/src/app/[locale]/dashboard/warehouse/inventory/movements/_components/inventory-movements-client.tsx:18`,
  `apps/web/src/app/[locale]/dashboard/warehouse/inventory/transfers/_components/branch-transfers-client.tsx:14`,
  `apps/web/src/app/[locale]/dashboard/warehouse/settings/warehouse-inventory-settings-client.tsx:22`
- **Issue:** Inventory services import DataView list/pagination DTOs from the UI component
  tree (`@/components/data-view/data-view.types`). Inventory client components also import
  DTOs directly from `server-only` service files. These imports are type-only and do not
  currently create a runtime server leak, but they couple service contracts to UI modules and
  client contracts to server-only modules.
- **Impact:** This makes future refactors brittle: moving DataView UI, splitting services,
  or enforcing stricter import boundaries can break unrelated inventory code. It also blurs
  ownership of DTO contracts that are shared by server actions, SSR pages, and clients.
- **Required fix:** Move shared DataView DTOs to a neutral non-UI module, and move Inventory
  DTOs consumed by clients into a neutral app-local inventory contract/type module. Services,
  pages, actions, and clients should import those DTOs from the neutral module rather than
  crossing UI/server ownership boundaries.
- **Verification:** Static scan confirms inventory services no longer import from
  `@/components/*`, and inventory client components no longer import any type from
  `@/server/services/*`.
- **Remediation:** Added `apps/web/src/lib/data-view/types.ts` and
  `apps/web/src/lib/warehouse/inventory-types.ts`. The DataView component type module now
  re-exports the neutral DataView contract. Inventory services import shared list/pagination
  DTOs from the neutral DataView module, inventory public DTOs are sourced from the neutral
  inventory module, and inventory client components consume only that neutral module.
- **Verification completed:** Static scans returned no inventory service-to-UI imports and no
  inventory client-to-server-service imports. Focused inventory tests passed: 5 files, 35 tests.
- **Owner:** Inventory
- **Status:** Closed

### S2 - Image Upload And Variant Gallery Assignment Need Stronger Server Guarantees

- **Area:** Storage / validation / tenant isolation
- **Files:** `apps/web/src/app/actions/warehouse/inventory/index.ts:393`,
  `apps/web/src/app/actions/warehouse/inventory/index.ts:437`
- **Issue:** `uploadInventoryItemImageAction` accepts the uploaded file's name, extension,
  MIME type, and size without server-side image validation, size limits, or decode checks.
  `assignInventoryVariantGalleryImageAction` accepts client-provided `storage_path`,
  `public_url`, `file_name`, `content_type`, and `file_size` and forwards them directly to
  image record creation.
- **Impact:** A user with product manage permission can create image records whose metadata
  is not proven to belong to the product/variant being edited. Uploads can also leave storage
  objects behind if DB recording fails. This is risky for tenant isolation, storage hygiene,
  and future channel integrations that will trust image metadata.
- **Required fix:** Validate file type, size, and extension on the server; verify the product
  and variant belong to the active organization before upload/assignment; only allow gallery
  assignment from existing organization-owned image records; clean up storage objects when DB
  recording fails.
- **Verification:** Unit/integration tests cover invalid MIME, oversized file, cross-product
  variant assignment, cross-org image assignment, and upload cleanup on DB failure.
- **Owner:** TBD
- **Status:** Open

### S2 - Ungrouped Product List Paginates After An Unbounded Fetch

- **Area:** Performance / scalability
- **Files:** `apps/web/src/server/services/inventory-products.service.ts`,
  `apps/web/supabase-target/supabase/migrations/20260518200000_inventory_product_list_rows_view.sql`
- **Issue:** In ungrouped variant mode, `listProducts` previously executed the sorted product query
  without `.range(from, to)`, enriches all returned products, flattens variants in memory,
  applies the optional `is_variant` filter, and only then slices the page.
- **Impact:** The product list can become slow and memory-heavy as the catalog grows. This is
  especially risky because ungrouped variant browsing is a core list mode and may be used with
  imports from large external catalogs.
- **Fix:** Added `inventory_product_list_rows_v1`, a security-invoker list index view that
  returns one visible row per variant/default item with exact count support. Ungrouped list
  mode now pages that view first and enriches only products present on the current page.
- **Verification:** Target MCP migration applied successfully. Focused inventory service/action
  smoke tests passed after the change. Manual query inspection confirms ungrouped mode now
  calls `.range(from, to)` against the list index before enrichment.
- **Owner:** Inventory
- **Status:** Closed

### S2 - SKU Collision Checks Are Not Canonical Across Create/Edit/Import

- **Area:** Validation / data integrity
- **Files:** `apps/web/src/server/services/inventory-products.service.ts:1926`
- **Issue:** `checkSkuCollisions` only trims input SKUs and queries exact `inventory_variants.sku`
  values. Import preview has separate fingerprint logic, so create/edit/import can disagree
  about whether `N90 619 802`, `N90619802`, and `n90-619-802` collide.
- **Impact:** Duplicate SKUs can slip through depending on which workflow creates the item.
  That undermines inventory identity, future marketplace integrations, and import reliability.
- **Required fix:** Store or compute a canonical SKU fingerprint consistently for every
  variant, enforce uniqueness per organization at the database level, and make all create,
  edit, generated SKU, and import flows call the same normalization/collision function.
- **Verification:** Tests cover case, whitespace, dash, slash, and special-character variants
  across simple item creation, variant creation, edit, and import.
- **Owner:** TBD
- **Status:** Open

### S2 - CSV Import Service Path Is Not Transactional Enough For Enterprise Imports

- **Area:** Import / transactions / reliability
- **Files:** `apps/web/src/server/services/inventory-products.service.ts:2095`,
  `apps/web/src/server/services/inventory-products.service.ts:2193`
- **Issue:** The CSV preview/import service parses the whole file in memory, then the import
  method creates the import job and writes product groups one by one. If a later product fails,
  previous products remain imported and the job is marked failed. Rows with missing unit IDs
  can be silently skipped by `continue`.
- **Impact:** Failed imports can leave partial catalog state without an obvious rollback path.
  For large Autostacja/Excel imports, users need deterministic validation, staging, and clear
  failure accounting before any production data is written.
- **Required fix:** Use a staged import model: upload/parse into an import job, normalize and
  validate all rows, store editable preview rows, and perform final import inside a transaction
  or resumable batch process with explicit row outcomes. Remove silent skips.
- **Verification:** Tests cover all-valid import, duplicate handling, missing unit handling,
  mid-import failure rollback or resumable status, and large-file limits.
- **Owner:** TBD
- **Status:** Open

### S2 - Inventory Test Coverage Is Not Yet TDD-Level For The New Product Workflows

- **Area:** TDD / regression coverage
- **Files:** `apps/web/src/server/services/__tests__/inventory-products.service.test.ts`,
  `apps/web/src/app/actions/warehouse/inventory/__tests__/inventory-actions.test.ts`,
  `apps/web/src/server/services/__tests__/inventory-*.test.ts`
- **Issue:** Current inventory tests are heavily weighted toward migration text assertions and
  a narrow set of movement/product action delegations. There are no targeted tests for the
  import wizard data model, SKU normalization/collisions, image upload/gallery assignment,
  product DataView grouping/ungrouping, custom field quick-add behavior, unit/tax/tag settings,
  or large-list pagination.
- **Impact:** The most recently changed product workflows are the least protected. This makes
  future polish risky and does not meet the stated TDD/enterprise-readiness bar.
- **Required fix:** Add unit and component tests around every production workflow in the
  inventory-specific checklist, then add integration/RLS tests for critical tenant/branch
  boundaries.
- **Verification:** The inventory test matrix in this document has explicit tests for each
  create/edit/import/list/settings/storage branch, and CI runs them reliably.
- **Owner:** TBD
- **Status:** Open

### S3 - Inventory Audit Trail Does Not Cover All Production Workflows

- **Area:** Observability / audit trail
- **Files:** `apps/web/src/server/audit/event-registry.ts:643`,
  `apps/web/src/app/actions/warehouse/inventory/index.ts`
- **Issue:** The audit registry currently covers product created/updated/archived and
  movement posted/reversed. Recent production workflows such as imports, image upload/assignment,
  unit/tax/tag/custom-field settings changes, SKU template changes, and branch-transfer
  lifecycle actions do not have explicit audit event types.
- **Impact:** Enterprise users cannot reconstruct who changed catalog configuration, who ran
  an import, or who altered product media/settings from the central audit trail.
- **Required fix:** Add registry entries and action emissions for every state-changing
  inventory workflow, with payloads that include organization, branch where relevant, entity ID,
  row/job counts for imports, and before/after summaries for settings.
- **Verification:** Event registry tests include all new inventory action keys, and action
  tests assert emission on successful mutations.
- **Owner:** TBD
- **Status:** Open

### S2 - Inventory UI Is Not Fully Localized

- **Area:** UI / i18n
- **Files:** `apps/web/src/app/[locale]/dashboard/warehouse/items/_components/inventory-products-client.tsx`,
  `apps/web/src/app/[locale]/dashboard/warehouse/items/new/_components/inventory-product-create-client.tsx`,
  `apps/web/src/app/[locale]/dashboard/warehouse/items/[productId]/edit/_components/inventory-product-edit-client.tsx`,
  `apps/web/src/app/[locale]/dashboard/warehouse/settings/warehouse-inventory-settings-client.tsx`
- **Issue:** Localized inventory routes still contain many hard-coded English labels and
  messages such as `Products`, `Map Fields`, `Preview`, `Generate SKU`, `Add unit`, `Tags`,
  `No description`, and validation/status messages.
- **Impact:** The `/[locale]` inventory experience is not production-ready for Polish/English
  localization and will be difficult to maintain consistently.
- **Required fix:** Move all user-visible strings into `apps/web/messages/en.json` and
  `apps/web/messages/pl.json`, and wire components through the app's established translation
  helpers.
- **Verification:** Static scan of inventory route files finds no user-visible hard-coded
  strings except approved technical constants, and both locales render key flows.
- **Owner:** TBD
- **Status:** Open

### S1 - Branch Does Not Pass The Web Type-Check Gate

- **Area:** Release gate / TypeScript correctness
- **Files:** Branch-wide `apps/web` type-check
- **Issue:** `pnpm --filter web type-check` currently exits with code 2. The visible errors
  are in auth tests, organization tests, font route typing, feedback/form tests, organization
  service tests, and `site-settings.service.ts`.
- **Impact:** Even if several errors are outside the inventory folder, the branch cannot be
  treated as production-ready while the web app fails its TypeScript gate.
- **Required fix:** Fix the type errors or document, with evidence, that they are pre-existing
  baseline failures intentionally accepted outside this inventory release. A production merge
  should prefer a clean type-check.
- **Verification:** `pnpm --filter web type-check` exits 0.
- **Owner:** TBD
- **Status:** Open

---

## Branch File Inventory

These are all files changed on `inventory-feature` relative to `main`. Every file is in
accepted scope for this audit and release gate.

### Inventory Routes, Pages, and Client Components

- `apps/web/src/app/[locale]/dashboard/warehouse/inventory/_components/inventory-client.tsx`
- `apps/web/src/app/[locale]/dashboard/warehouse/inventory/movements/_components/inventory-movements-client.tsx`
- `apps/web/src/app/[locale]/dashboard/warehouse/inventory/movements/page.tsx`
- `apps/web/src/app/[locale]/dashboard/warehouse/inventory/page.tsx`
- `apps/web/src/app/[locale]/dashboard/warehouse/inventory/transfers/_components/branch-transfers-client.tsx`
- `apps/web/src/app/[locale]/dashboard/warehouse/inventory/transfers/page.tsx`
- `apps/web/src/app/[locale]/dashboard/warehouse/items/[productId]/edit/_components/inventory-product-edit-client.tsx`
- `apps/web/src/app/[locale]/dashboard/warehouse/items/[productId]/edit/page.tsx`
- `apps/web/src/app/[locale]/dashboard/warehouse/items/[productId]/page.tsx`
- `apps/web/src/app/[locale]/dashboard/warehouse/items/_components/inventory-products-client.tsx`
- `apps/web/src/app/[locale]/dashboard/warehouse/items/custom-fields/inventory-custom-fields-client.tsx`
- `apps/web/src/app/[locale]/dashboard/warehouse/items/custom-fields/page.tsx`
- `apps/web/src/app/[locale]/dashboard/warehouse/items/import/page.tsx`
- `apps/web/src/app/[locale]/dashboard/warehouse/items/new/_components/inventory-product-create-client.tsx`
- `apps/web/src/app/[locale]/dashboard/warehouse/items/new/page.tsx`
- `apps/web/src/app/[locale]/dashboard/warehouse/items/page.tsx`
- `apps/web/src/app/[locale]/dashboard/warehouse/settings/page.tsx`
- `apps/web/src/app/[locale]/dashboard/warehouse/settings/warehouse-inventory-settings-client.tsx`

### Inventory Actions, Schemas, Services, and Tests

- `apps/web/src/app/actions/warehouse/inventory/__tests__/inventory-actions.test.ts`
- `apps/web/src/app/actions/warehouse/inventory/index.ts`
- `apps/web/src/app/actions/warehouse/inventory/schemas.ts`
- `apps/web/src/server/services/__tests__/inventory-cross-branch-transfers.test.ts`
- `apps/web/src/server/services/__tests__/inventory-phase1-migrations.test.ts`
- `apps/web/src/server/services/__tests__/inventory-phase2-migrations.test.ts`
- `apps/web/src/server/services/__tests__/inventory-phase3-migrations.test.ts`
- `apps/web/src/server/services/__tests__/inventory-product-creation-enhancements.test.ts`
- `apps/web/src/server/services/__tests__/inventory-products.service.test.ts`
- `apps/web/src/server/services/inventory-balances.service.ts`
- `apps/web/src/server/services/inventory-enterprise.service.ts`
- `apps/web/src/server/services/inventory-movements.service.ts`
- `apps/web/src/server/services/inventory-products.service.ts`

### Inventory Database Migrations and Generated Types

- `apps/web/supabase-target/supabase/migrations/20260505090000_inventory_phase1_permissions.sql`
- `apps/web/supabase-target/supabase/migrations/20260505091000_inventory_phase1_core.sql`
- `apps/web/supabase-target/supabase/migrations/20260505092000_inventory_phase1_rpcs.sql`
- `apps/web/supabase-target/supabase/migrations/20260505093000_inventory_phase1_recompile_permissions.sql`
- `apps/web/supabase-target/supabase/migrations/20260506090000_inventory_phase2_enterprise_core.sql`
- `apps/web/supabase-target/supabase/migrations/20260508090000_inventory_phase3_advanced_features.sql`
- `apps/web/supabase-target/supabase/migrations/20260510090000_inventory_cross_branch_transfers.sql`
- `apps/web/supabase-target/supabase/migrations/20260510094000_inventory_product_creation_enhancements.sql`
- `apps/web/supabase-target/supabase/migrations/20260514090000_inventory_product_master_data.sql`
- `apps/web/supabase-target/supabase/migrations/20260514100000_inventory_product_mvp_completion.sql`
- `apps/web/supabase-target/supabase/migrations/20260516120000_inventory_product_accounting_fields.sql`
- `apps/web/supabase-target/supabase/migrations/20260516133000_inventory_tax_rates_and_product_rate.sql`
- `apps/web/supabase-target/supabase/migrations/20260517070000_fix_inventory_units_soft_delete_rls.sql`
- `apps/web/supabase-target/supabase/migrations/20260517131500_inventory_unit_conversions_manage_policy.sql`
- `apps/web/supabase-target/supabase/migrations/20260517133000_enable_inventory_unit_conversions_rls.sql`
- `apps/web/supabase/types/target.types.ts`

### Inventory Permissions, Audit Events, i18n, Routing, and Sidebar Wiring

- `apps/web/messages/en.json`
- `apps/web/messages/pl.json`
- `apps/web/src/i18n/routing.ts`
- `apps/web/src/lib/constants/__tests__/rls-permission-invariants.test.ts`
- `apps/web/src/lib/sidebar/admin-v2/registry.ts`
- `apps/web/src/lib/sidebar/v2/registry.ts`
- `apps/web/src/server/audit/__tests__/event-registry.test.ts`
- `apps/web/src/server/audit/event-registry.ts`
- `packages/contracts/src/permissions.ts`

### Shared DataView and Layout Changes Used by Inventory

- `apps/web/src/app/[locale]/admin/data-view-demo/page.tsx`
- `apps/web/src/app/[locale]/dashboard/__tests__/sidebar-ssr.test.tsx`
- `apps/web/src/app/[locale]/dashboard/_components/dashboard-shell.tsx`
- `apps/web/src/app/[locale]/layout.tsx`
- `apps/web/src/components/data-view/data-view-columns.tsx`
- `apps/web/src/components/data-view/data-view-filters.tsx`
- `apps/web/src/components/data-view/data-view-provider.tsx`
- `apps/web/src/components/data-view/data-view-sidebar.tsx`
- `apps/web/src/components/data-view/data-view-table.tsx`
- `apps/web/src/components/data-view/data-view-toolbar.tsx`
- `apps/web/src/components/data-view/data-view.tsx`
- `apps/web/src/components/data-view/data-view.types.ts`
- `apps/web/src/components/v2/layout/dashboard-header.tsx`

### Other DataView Consumers Affected by Shared Changes

- `apps/web/src/app/[locale]/dashboard/organization/branches/__tests__/branches-client.test.tsx`
- `apps/web/src/app/[locale]/dashboard/organization/branches/_components/branches-client.tsx`
- `apps/web/src/app/[locale]/dashboard/organization/branches/_utils/branches-data-view.ts`
- `apps/web/src/app/[locale]/dashboard/organization/branches/page.tsx`
- `apps/web/src/app/[locale]/dashboard/organization/users/invitations/__tests__/invitations-client.test.tsx`
- `apps/web/src/app/[locale]/dashboard/organization/users/invitations/_components/invitations-client.tsx`
- `apps/web/src/app/[locale]/dashboard/organization/users/invitations/_utils/data-view.ts`
- `apps/web/src/app/[locale]/dashboard/organization/users/invitations/page.tsx`
- `apps/web/src/app/[locale]/dashboard/organization/users/members/__tests__/members-client.test.tsx`
- `apps/web/src/app/[locale]/dashboard/organization/users/members/_components/members-client.tsx`
- `apps/web/src/app/[locale]/dashboard/organization/users/members/_utils/data-view.ts`
- `apps/web/src/app/[locale]/dashboard/organization/users/members/page.tsx`
- `apps/web/src/app/[locale]/dashboard/organization/users/positions/__tests__/positions-client.test.tsx`
- `apps/web/src/app/[locale]/dashboard/organization/users/positions/_components/positions-client.tsx`
- `apps/web/src/app/[locale]/dashboard/organization/users/positions/_utils/data-view.ts`
- `apps/web/src/app/[locale]/dashboard/organization/users/positions/page.tsx`
- `apps/web/src/app/[locale]/dashboard/organization/users/roles/__tests__/roles-client.test.tsx`
- `apps/web/src/app/[locale]/dashboard/organization/users/roles/_components/roles-client.tsx`
- `apps/web/src/app/[locale]/dashboard/organization/users/roles/_utils/data-view.ts`
- `apps/web/src/app/[locale]/dashboard/organization/users/roles/page.tsx`
- `apps/web/src/app/[locale]/dashboard/qr/_components/qr-management-client.tsx`
- `apps/web/src/app/[locale]/dashboard/qr/_utils/data-view.ts`
- `apps/web/src/app/[locale]/dashboard/qr/page.tsx`

### Accepted Companion Scope: WDD, QR, Tooling, Package, and Planning

- `.vscode/settings.json`
- `apps/web/package.json`
- `apps/web/src/app/actions/organization/branches.ts`
- `apps/web/src/app/actions/tools/wdd-matcher-public.ts`
- `apps/web/src/app/actions/tools/wdd-matcher.ts`
- `apps/web/src/components/tools/qr-generator/index.tsx`
- `apps/web/src/lib/tools/registry.tsx`
- `apps/web/src/lib/tools/svwms-wdd-matcher/enhanced-delivery-pdf.tsx`
- `apps/web/src/lib/tools/svwms-wdd-matcher/parser_v4.ts`
- `apps/web/src/server/services/wdd-matcher.service.ts`
- `apps/web/supabase-target/supabase/.temp/cli-latest`
- `pnpm-lock.yaml`
- `warehouse-inventory-v2-enterprise-plan.md`
- `warehouse-product-creation-zoho-enhancement-plan.md`

---

## Next Audit Steps

1. Continue with the Architecture and Boundaries checks from the generic plan.
2. Run the SSR-first checks for every inventory route.
3. Run Supabase target MCP checks for migrations, RLS, policies, security advisors,
   and performance advisors.
4. Convert every S1/S2 finding into a fix task before release.
