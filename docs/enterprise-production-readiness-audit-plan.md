# Enterprise Production Readiness Audit Plan

This document is the reusable pre-production audit plan for major features in Ambra.
It is intentionally generic, but the first concrete target is the Inventory / Warehouse
implementation on the `inventory-feature` branch.

Use this plan when a feature feels functionally complete and the next step is deciding
whether it is safe to merge, release, or expose to real customers.

Related repo guidance:

- `docs/package-ownership.md` — package and app boundary rules
- `docs/change-control.md` — shared contract and schema change control
- `docs/verification-workflow.md` — permission/module constant verification
- `docs/security-review.md` — backend/auth security posture
- `docs/release-rollback.md` — release and rollback workflow

---

## Audit Target

| Field            | Value                                         |
| ---------------- | --------------------------------------------- |
| Feature / module | Inventory / Warehouse                         |
| Branch           | `inventory-feature`                           |
| Audit owner      | TBD                                           |
| Audit started    | TBD                                           |
| Audit completed  | TBD                                           |
| Release decision | Blocked until all S1/S2 findings are resolved |

For future features, copy this table into the feature-specific section below and update
the scope.

---

## Severity Rules

Every finding must be assigned one severity. Release gates are strict.

| Severity   | Meaning                                                                                                              | Release rule                                      |
| ---------- | -------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------- |
| S1 Blocker | Data leak, auth bypass, broken migration, destructive data risk, production build failure, or core workflow unusable | Must be fixed before merge/release                |
| S2 High    | Serious correctness, performance, transaction, RLS, permission, or test gap that can break real customers at scale   | Must be fixed before production release           |
| S3 Medium  | Important hardening, maintainability, observability, UX, or edge-case gap                                            | May merge only with explicit follow-up owner/date |
| S4 Low     | Cosmetic, documentation, or non-blocking improvement                                                                 | Track normally; does not block release            |

No feature is production-ready while unresolved S1 or S2 findings remain.

---

## Progress Tracker

Use this tracker for the current Inventory audit. For another feature, duplicate this
section and reset all checkboxes.

| Area                                  | Status          | Evidence / notes |
| ------------------------------------- | --------------- | ---------------- |
| 1. Scope and diff baseline            | [ ] Not started |                  |
| 2. Architecture and boundaries        | [ ] Not started |                  |
| 3. SSR-first data flow                | [ ] Not started |                  |
| 4. Server actions and service layer   | [ ] Not started |                  |
| 5. Database schema and migrations     | [ ] Not started |                  |
| 6. RLS and tenant isolation           | [ ] Not started |                  |
| 7. Permissions and entitlements       | [ ] Not started |                  |
| 8. Storage and file handling          | [ ] Not started |                  |
| 9. Validation and data integrity      | [ ] Not started |                  |
| 10. Transactions and concurrency      | [ ] Not started |                  |
| 11. Performance and caching           | [ ] Not started |                  |
| 12. TDD and test coverage             | [ ] Not started |                  |
| 13. UI, accessibility, and i18n       | [ ] Not started |                  |
| 14. Observability and audit trail     | [ ] Not started |                  |
| 15. Import/export and bulk workflows  | [ ] Not started |                  |
| 16. Release, rollback, and operations | [ ] Not started |                  |
| 17. Final production gate             | [ ] Not started |                  |

Status values:

- `[ ] Not started`
- `[~] In progress`
- `[x] Passed`
- `[!] Failed / blocked`
- `[-] Deferred with owner`

---

## Evidence Ledger

Every checked item needs evidence. Add links, commands, screenshots, database advisor
output, test output, or code references here.

| Date | Area | Evidence | Result | Follow-up |
| ---- | ---- | -------- | ------ | --------- |
| TBD  | TBD  | TBD      | TBD    | TBD       |

---

## 1. Scope and Diff Baseline

Goal: understand exactly what changed and what must be reviewed.

- [ ] Identify the feature branch and merge base.
- [ ] List all changed files.
- [ ] Classify changed files by ownership: app route, server action, service, migration,
      shared package, UI component, tests, docs, generated file.
- [ ] Confirm the working tree is clean before audit starts.
- [ ] Confirm no unrelated feature work is mixed into the branch.
- [ ] Confirm generated files are intentional, reproducible, and reviewed.
- [ ] Confirm package lock changes are explained by package changes.
- [ ] Identify all public URLs/routes added by the feature.
- [ ] Identify all DB tables, views, RPCs, storage buckets, functions, triggers, and policies
      added or changed.

Recommended commands:

```bash
git status --short
git branch --show-current
git merge-base main HEAD
git diff --name-status main...HEAD
git diff --stat main...HEAD
```

Exit criteria:

- There is a complete review inventory.
- The audit scope is explicit.
- Mixed unrelated work is either removed or documented.

---

## 2. Architecture and Boundaries

Goal: make sure the implementation fits the repo architecture and does not create future
maintenance debt.

- [ ] App-specific runtime code stays in `apps/*`.
- [ ] Shared packages contain only platform-neutral types, constants, and pure logic.
- [ ] No shared package imports `next/*`, `expo-*`, server actions, cookies, Supabase clients,
      or app-local code.
- [ ] Service-role client usage is app-local and server-only.
- [ ] Server actions are thin orchestration layers, not large business-logic containers.
- [ ] Business rules that are server-only live in `apps/web/src/server/services/`.
- [ ] Pure reusable rules that are genuinely cross-platform are candidates for `@repo/domain`.
- [ ] Database contract types are regenerated when schema changes.
- [ ] New constants for permissions/modules match migrations and live target DB state.
- [ ] No circular dependencies or package-tier violations were introduced.

Recommended checks:

```bash
rg -n "from ['\"]next/|from ['\"]expo-|createServiceClient|SUPABASE_SERVICE_ROLE_KEY" packages apps
rg -n "from ['\"].*apps/" packages
pnpm --filter contracts run check-types
pnpm --filter domain run check-types
pnpm --filter supabase run check-types
```

Exit criteria:

- The feature respects `docs/package-ownership.md`.
- Any intentional boundary exception is documented with owner and reason.

---

## 3. SSR-First Data Flow

Goal: preserve the web app's SSR-first architecture and avoid pushing server work into
client components.

- [ ] Every route has a server component/page responsible for auth, permission checks,
      initial data loading, and not-found/redirect behavior.
- [ ] Client components receive preloaded data and perform interaction only.
- [ ] Client components do not perform initial privileged reads that should be SSR.
- [ ] No service-role or privileged server logic is imported into client components.
- [ ] Heavy browser-only libraries are lazy-loaded or isolated to the route that needs them.
- [ ] Search params, pagination, selected records, and filters have stable SSR-compatible state.
- [ ] Server actions are used for mutations, not client-side direct privileged writes.
- [ ] Suspense/loading/error boundaries exist for slow or failure-prone areas.
- [ ] Metadata and route-level access control work with localized routes.

Recommended checks:

```bash
rg -n "\"use client\"|createBrowserClient|createClient|xlsx|papaparse" apps/web/src/app apps/web/src/components
rg -n "requirePermission|hasPermission|redirect\\(|notFound\\(" apps/web/src/app
```

Exit criteria:

- First render is secure and meaningful without client-side privileged fetching.
- Client-only code is justified and contained.

---

## 4. Server Actions and Service Layer

Goal: make every backend entry point explicit, secure, typed, and easy to reason about.

- [ ] Every server action authenticates the user before doing work.
- [ ] Every server action resolves organization and branch context explicitly when required.
- [ ] Every mutation checks the required permission before touching data.
- [ ] Server actions validate input with schemas before calling services.
- [ ] Server actions never trust client-provided organization, branch, user, storage path, public URL,
      status, price, quantity, or permission state without verification.
- [ ] Services accept explicit context objects and do not infer tenant context unsafely.
- [ ] Service methods return typed success/error results or throw consistently.
- [ ] Errors shown to users are safe and do not leak internals.
- [ ] All RPC calls are wrapped in typed service methods.
- [ ] All service-role usage is documented and justified.

Recommended checks:

```bash
rg -n "\"use server\"|requirePermission|parse\\(|safeParse\\(|createServiceClient|rpc\\(" apps/web/src/app/actions apps/web/src/server/services
```

Exit criteria:

- Every backend entry point has auth, authorization, validation, and tenant scoping.

---

## 5. Database Schema and Migrations

Goal: make schema changes repeatable, typed, indexed, and safe to apply.

- [ ] Every DB change exists as a local migration before it is applied.
- [ ] Migrations are idempotent where appropriate and safe to re-run in CI-like workflows.
- [ ] Migrations apply cleanly to the target database.
- [ ] Generated Supabase types are updated after schema changes.
- [ ] New tables have primary keys, tenant columns, audit columns, timestamps, and sensible defaults.
- [ ] Foreign keys are indexed unless a deliberate exception is documented.
- [ ] Unique constraints exist for business-critical uniqueness.
- [ ] Check constraints exist for enum-like text fields and numeric invariants.
- [ ] Soft-delete behavior is consistent and indexed where needed.
- [ ] Views are reviewed for `security_invoker` / `security_definer` behavior.
- [ ] Triggers and functions have explicit `search_path`.
- [ ] RPCs validate tenant context and permissions or are protected by RLS plus action-level checks.
- [ ] Migrations do not silently disable RLS.

Supabase operations:

- Always use the target Supabase MCP for remote Supabase inspection/application.
- Always keep the local migration file in `apps/web/supabase-target/supabase/migrations/`.
- Never apply a remote migration that is not represented locally.

Recommended checks:

```bash
pnpm --filter web supabase:db:push:target
pnpm --filter supabase run check-types
rg -n "create table|alter table|create policy|enable row level security|force row level security|security definer|security_invoker|create index|references" apps/web/supabase-target/supabase/migrations
```

Exit criteria:

- Target schema and repo migrations agree.
- Schema can support production usage without obvious integrity or index gaps.

---

## 6. RLS and Tenant Isolation

Goal: make the database itself enforce organization/branch isolation.

- [ ] Every tenant-owned table has RLS enabled.
- [ ] Every tenant-owned table has `FORCE ROW LEVEL SECURITY` unless there is a documented reason.
- [ ] Every table has policies for read/write/delete appropriate to the feature.
- [ ] Policies scope rows by organization and branch where applicable.
- [ ] Write policies use `WITH CHECK`, not only `USING`.
- [ ] Policies use permission checks or safe helper functions consistently.
- [ ] Service-role bypasses are minimized and documented.
- [ ] Storage bucket policies enforce tenant ownership and do not allow broad object listing.
- [ ] Supabase security advisors have no unresolved S1/S2 findings for the feature.
- [ ] Cross-org and cross-branch access attempts are covered by integration tests.

Target DB checks to run with Supabase target MCP:

```sql
select schemaname, tablename, rowsecurity, force_rowsecurity
from pg_tables
where schemaname = 'public'
  and tablename like '<feature_prefix>%'
order by tablename;
```

```sql
select schemaname, tablename, policyname, permissive, roles, cmd, qual, with_check
from pg_policies
where schemaname = 'public'
  and tablename like '<feature_prefix>%'
order by tablename, policyname;
```

Exit criteria:

- RLS is active, forced, tested, and advisor-clean for feature-owned tables.

---

## 7. Permissions and Entitlements

Goal: ensure UI gating, server authorization, DB policies, and plan access all agree.

- [ ] Every route checks module/entitlement access if the feature is plan-gated.
- [ ] Every route checks the minimum read permission.
- [ ] Every mutation checks the exact required permission.
- [ ] Permission slugs exist in target migrations and TypeScript constants.
- [ ] `packages/contracts/MISMATCHES.md` is updated for any known drift.
- [ ] UI-only gates are treated as convenience, not authorization.
- [ ] Server action checks and RLS checks are both present for sensitive operations.
- [ ] Branch-scoped operations require an active branch or an explicit branch selection.
- [ ] Cross-branch workflows validate source and destination access separately.
- [ ] Negative permission tests exist for unauthorized users.

Recommended references:

- `docs/verification-workflow.md`
- `docs/change-control.md`

Exit criteria:

- Permission drift is checked.
- Authorization is enforced server-side and by RLS, not only by UI.

---

## 8. Storage and File Handling

Goal: avoid file upload abuse, data leaks, and broken ownership models.

- [ ] Upload actions validate MIME type, file extension, file size, and expected file shape server-side.
- [ ] Image uploads validate dimensions or decodeability when relevant.
- [ ] File names and paths are generated server-side.
- [ ] Client-provided public URLs or storage paths are never trusted without ownership verification.
- [ ] File records are linked to organization, product/entity, user, and storage object.
- [ ] Deleting or replacing records handles orphaned storage objects.
- [ ] Storage buckets are private by default unless public access is intentional.
- [ ] Public buckets do not allow broad object listing.
- [ ] Variant/item/gallery image ownership rules are documented and enforced.
- [ ] Upload failures do not leave inconsistent parent records without a cleanup path.

Exit criteria:

- Files cannot be attached across tenants or entities.
- File validation is server-side and storage policies are tight.

---

## 9. Validation and Data Integrity

Goal: prevent bad data before it reaches production tables.

- [ ] All server actions use strict schema validation.
- [ ] Form validation and server validation share the same business rules where possible.
- [ ] Required fields, formats, lengths, and numeric bounds match database constraints.
- [ ] SKU/code/name normalization rules are consistent across create, edit, import, and duplicate checks.
- [ ] Duplicate detection uses the same canonical representation as uniqueness constraints.
- [ ] Optional fields are really optional; generated defaults are intentional.
- [ ] Custom fields are strongly typed and values are validated against their field definitions.
- [ ] Tax, unit, tag, status, and preset fields use controlled IDs/codes instead of arbitrary text.
- [ ] Error states identify the exact invalid field.
- [ ] Import and bulk-edit flows validate the same invariants as single-item forms.

Exit criteria:

- Invalid data is rejected consistently across all entry points.

---

## 10. Transactions and Concurrency

Goal: avoid partial writes, race conditions, and inventory inconsistencies.

- [ ] Multi-table mutations are transactional through RPCs or database functions.
- [ ] Stock-affecting operations use database-side locks or atomic updates.
- [ ] Duplicate checks are backed by unique indexes, not only preflight queries.
- [ ] Imports are staged or transactional enough to recover from partial failure.
- [ ] Status transitions are validated atomically.
- [ ] Cross-branch transfers cannot be accepted/declined twice.
- [ ] Quantity updates cannot go negative unless explicitly allowed.
- [ ] Idempotency is considered for retries, double-clicks, and network failures.
- [ ] Concurrent writes are covered by tests or database constraints.

Exit criteria:

- Correctness does not depend on a single browser session behaving perfectly.

---

## 11. Performance and Caching

Goal: keep feature performance predictable with real customer data volumes.

- [ ] Initial SSR queries are paginated and bounded.
- [ ] Client-side pagination is not applied after fetching unbounded datasets.
- [ ] Search/filter/sort happen in the database for large collections.
- [ ] N+1 query patterns are eliminated or batched safely.
- [ ] Filter indexes exist for common list queries.
- [ ] Foreign keys used in joins are indexed.
- [ ] Expensive aggregations use views/materialized views/RPCs with indexes where appropriate.
- [ ] Large libraries are split from common client bundles.
- [ ] Cache behavior is explicit: static, dynamic, `revalidatePath`, `revalidateTag`, or no-store.
- [ ] Mutations invalidate only the affected routes/tags.
- [ ] Performance advisors have no unresolved S1/S2 findings.
- [ ] The feature has an agreed realistic data-volume test scenario.

Recommended checks:

```bash
pnpm --filter web build
rg -n "\\.select\\(|\\.range\\(|\\.limit\\(|revalidatePath|revalidateTag|unstable_cache|no-store|dynamic =" apps/web/src
```

Exit criteria:

- The feature remains bounded, indexed, and cache-aware at expected enterprise scale.

---

## 12. TDD and Test Coverage

Goal: make the implementation provably correct and safe to change.

- [ ] Critical business rules were described as tests before or alongside implementation.
- [ ] Unit tests cover pure transformation and validation rules.
- [ ] Server action tests cover auth, permission failures, validation failures, and success paths.
- [ ] Service tests cover normal flows, edge cases, and database errors.
- [ ] Migration tests verify tables, constraints, indexes, RLS, and policies.
- [ ] RLS integration tests prove cross-org/cross-branch denial.
- [ ] UI tests cover primary workflows and broken/empty/loading states.
- [ ] Import/export tests cover malformed files, duplicate data, large-ish files, and mapping errors.
- [ ] Regression tests exist for every serious bug found during audit.
- [ ] Tests avoid over-mocking the exact behavior they are meant to prove.
- [ ] CI runs the relevant tests before merge.

Minimum commands:

```bash
pnpm --filter web lint
pnpm --filter web check-types
pnpm --filter web test
pnpm --filter web build
```

Exit criteria:

- Tests fail when the main feature guarantees are broken.
- No known S1/S2 behavior relies only on manual testing.

---

## 13. UI, Accessibility, and i18n

Goal: make the feature understandable, accessible, localized, and consistent with the app.

- [ ] Routes are registered for every supported locale.
- [ ] User-facing text is localized or intentionally shared.
- [ ] Forms have labels, errors, keyboard support, focus management, and sensible tab order.
- [ ] Dialogs/popovers/menus are accessible and do not trap users incorrectly.
- [ ] Loading, empty, error, forbidden, and success states are implemented.
- [ ] Data tables handle dense data, overflow, resizing, and long text.
- [ ] Mobile/tablet/desktop layouts are checked where relevant.
- [ ] Light and dark themes are readable.
- [ ] UI does not expose implementation details that should remain hidden.
- [ ] Destructive actions require confirmation or undo where appropriate.
- [ ] Screenshots or Playwright checks verify the main workflows.

Exit criteria:

- The UI is professional, localized, accessible, and does not confuse internal mechanics
  with user concepts.

---

## 14. Observability and Audit Trail

Goal: make production behavior debuggable and accountable.

- [ ] Sensitive mutations emit audit events.
- [ ] Audit payloads include organization, branch, actor, target entity, and action result.
- [ ] Logs avoid secrets, tokens, full file contents, and sensitive personal data.
- [ ] Unexpected server errors are captured with enough context to debug.
- [ ] Long-running imports/jobs expose status and failure details.
- [ ] Metrics or counters exist for high-risk workflows where useful.
- [ ] Admin/support users can trace who changed critical records.
- [ ] Failed authorization attempts are observable where appropriate.

Exit criteria:

- Production incidents can be investigated without database guesswork.

---

## 15. Import, Export, and Bulk Workflows

Goal: make batch operations safe, transparent, and recoverable.

- [ ] Import format, limits, and accepted encodings are documented in UI or docs.
- [ ] Import parsing is bounded by file size and row count.
- [ ] Field mapping supports required fields, presets, custom fields, and default values.
- [ ] Preview shows exactly what will be imported.
- [ ] Users can correct import values before committing.
- [ ] Duplicate handling is explicit: skip, overwrite, merge, or fail.
- [ ] Duplicate detection uses normalized/canonical values.
- [ ] Import is staged, resumable, or transactional enough to handle partial failures.
- [ ] Export respects permissions, filters, and tenant boundaries.
- [ ] Exported data does not leak hidden/internal fields.

Exit criteria:

- Bulk operations cannot silently corrupt data or surprise users.

---

## 16. Release, Rollback, and Operations

Goal: make release and rollback predictable.

- [ ] All S1/S2 findings are fixed.
- [ ] S3 findings have owner, deadline, and accepted risk.
- [ ] Migrations have been applied to target and verified.
- [ ] Rollback strategy is known for code and schema changes.
- [ ] Destructive migrations have backup/restore notes.
- [ ] Feature flags or entitlement gates are configured if gradual rollout is needed.
- [ ] Environment variables and operational settings are documented.
- [ ] Post-release monitoring checks are defined.
- [ ] Support/admin docs exist for operationally complex workflows.

Exit criteria:

- The team can release, monitor, and roll back without improvising.

---

## 17. Final Production Gate

The feature is production-ready only when all of the following are true:

- [ ] Scope is reviewed and no unrelated work is mixed in.
- [ ] Architecture boundaries pass.
- [ ] SSR-first rules pass.
- [ ] Server actions and services pass auth, permission, validation, and tenant-scope review.
- [ ] Target DB schema matches repo migrations and generated types.
- [ ] RLS is enabled, forced, policy-complete, and tested for feature tables.
- [ ] Permissions and entitlements are verified against target DB.
- [ ] File/storage handling is server-validated and tenant-safe.
- [ ] Data integrity rules are consistent across create, edit, import, and API paths.
- [ ] Multi-table and stock-affecting writes are transactional or safely recoverable.
- [ ] Performance is bounded, indexed, and cache-aware.
- [ ] TDD/test coverage proves critical behavior and regression cases.
- [ ] UI is accessible, localized, theme-safe, and workflow-complete.
- [ ] Audit events and operational debugging paths exist.
- [ ] Import/export/bulk flows are bounded and recoverable.
- [ ] Release and rollback notes are ready.
- [ ] `pnpm --filter web lint` passes.
- [ ] `pnpm --filter web check-types` passes or only has documented unrelated baseline errors.
- [ ] `pnpm --filter web test` passes.
- [ ] `pnpm --filter web build` passes.
- [ ] Supabase security and performance advisors have no unresolved S1/S2 findings.

Release decision:

- [ ] Approved for merge
- [ ] Approved for production release
- [ ] Blocked
- [ ] Deferred

Approver:

- TBD

---

## Finding Template

Use this format when recording audit findings.

```markdown
### S<severity> - <short title>

- **Area:** <security/performance/testing/etc.>
- **Files:** `<path>:<line>`, `<path>:<line>`
- **Issue:** <what is wrong>
- **Impact:** <why it matters in production>
- **Required fix:** <what must change>
- **Verification:** <test/query/command that proves the fix>
- **Owner:** TBD
- **Status:** Open
```

---

## Inventory-Specific Audit Starting Points

Use these as the first files/areas to inspect for the current Inventory audit. This list
does not replace the generic checklist above; it only makes the current scope easier to start.

### App Routes and UI

- `apps/web/src/app/[locale]/dashboard/warehouse/items/page.tsx`
- `apps/web/src/app/[locale]/dashboard/warehouse/items/import/page.tsx`
- `apps/web/src/app/[locale]/dashboard/warehouse/items/new/page.tsx`
- `apps/web/src/app/[locale]/dashboard/warehouse/items/[productId]/page.tsx`
- `apps/web/src/app/[locale]/dashboard/warehouse/items/[productId]/edit/page.tsx`
- `apps/web/src/app/[locale]/dashboard/warehouse/settings/page.tsx`
- `apps/web/src/app/[locale]/dashboard/warehouse/inventory/page.tsx`
- `apps/web/src/app/[locale]/dashboard/warehouse/inventory/movements/page.tsx`
- `apps/web/src/app/[locale]/dashboard/warehouse/inventory/transfers/page.tsx`

### Client Components

- `apps/web/src/app/[locale]/dashboard/warehouse/items/_components/inventory-products-client.tsx`
- `apps/web/src/app/[locale]/dashboard/warehouse/items/new/_components/inventory-product-create-client.tsx`
- `apps/web/src/app/[locale]/dashboard/warehouse/items/[productId]/edit/_components/inventory-product-edit-client.tsx`
- `apps/web/src/app/[locale]/dashboard/warehouse/settings/warehouse-inventory-settings-client.tsx`
- `apps/web/src/app/[locale]/dashboard/warehouse/inventory/_components/inventory-client.tsx`
- `apps/web/src/app/[locale]/dashboard/warehouse/inventory/movements/_components/inventory-movements-client.tsx`
- `apps/web/src/app/[locale]/dashboard/warehouse/inventory/transfers/_components/branch-transfers-client.tsx`

### Actions and Services

- `apps/web/src/app/actions/warehouse/inventory/index.ts`
- `apps/web/src/app/actions/warehouse/inventory/schemas.ts`
- `apps/web/src/server/services/inventory-products.service.ts`
- `apps/web/src/server/services/inventory-balances.service.ts`
- `apps/web/src/server/services/inventory-movements.service.ts`
- `apps/web/src/server/services/inventory-enterprise.service.ts`

### Database and Policies

- `apps/web/supabase-target/supabase/migrations/*inventory*.sql`
- `packages/supabase/src/database.types.ts`
- `packages/contracts/src/permissions.ts`
- `packages/contracts/MISMATCHES.md`

### Tests

- `apps/web/src/app/actions/warehouse/inventory/__tests__/inventory-actions.test.ts`
- `apps/web/src/server/services/__tests__/inventory-products.service.test.ts`
- `apps/web/src/server/services/__tests__/inventory-cross-branch-transfers.test.ts`
- `apps/web/src/server/services/__tests__/inventory-phase1-migrations.test.ts`
- `apps/web/src/server/services/__tests__/inventory-phase2-migrations.test.ts`
- `apps/web/src/server/services/__tests__/inventory-phase3-migrations.test.ts`
- `apps/web/src/server/services/__tests__/inventory-product-creation-enhancements.test.ts`
- `apps/web/src/lib/constants/__tests__/rls-permission-invariants.test.ts`
