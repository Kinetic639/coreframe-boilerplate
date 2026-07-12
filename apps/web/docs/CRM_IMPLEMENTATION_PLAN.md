# CRM / Kontrahenci Implementation Plan

## Progress Tracker

- [x] Pull latest `origin/main` into the CRM branch.
- [x] Preserve and re-apply existing CRM work after pulling main.
- [x] Define CRM domain model and table boundaries.
- [x] Add CRM contracts constants.
- [x] Add CRM permission constants.
- [x] Register CRM in Sidebar V2.
- [x] Add CRM module metadata and local module docs.
- [x] Add CRM database migration foundation.
- [x] Add party/contact validation schemas.
- [x] Add CRM party/contact service layer.
- [x] Add warehouse item supplier service/action foundation.
- [x] Add CRM server actions.
- [x] Add initial SSR CRM routes.
- [x] Add initial parties and contacts client islands.
- [x] Add English and Polish CRM translations.
- [x] Add `/dashboard/crm/settings`.
- [x] Add CRM route-level loading/error boundaries for parties, contacts, and settings.
- [x] Add CRM service unit tests.
- [x] Add CRM action tests.
- [x] Add Sidebar V2 CRM visibility tests.
- [x] Add contracts invariant coverage for CRM constants.
- [x] Run contracts tests.
- [x] Run focused CRM Vitest suite.
- [x] Add Supabase storage buckets/policies/actions for party logos and contact avatars.
- [x] Wire CRM logo/avatar upload actions into party/contact detail UI.
- [x] Add CRM supplier search service/action for warehouse item supplier pickers.
- [x] Add CRM migration invariant tests for storage policies.
- [x] Add CRM supplier management panel to warehouse item edit page.
- [x] Add party detail editing, role editing, contact-person linking, and address add UI.
- [x] Add contact detail editing UI.
- [x] Add party/contact archive affordances backed by soft-delete actions.
- [x] Add party contact/address remove affordances backed by soft-delete actions.
- [x] Add linked organization user selector to CRM contact create/edit flows.
- [x] Add CRM counterparty-number lookup to warehouse movement party fields.
- [x] Store CRM party id, counterparty number, and snapshot in movement party details JSON.
- [x] Add lead time, MOQ, purchase price, and currency fields to warehouse item edit CRM supplier panel.
- [x] Add existing CRM supplier promotion to main supplier on warehouse item edit.
- [x] Show CRM item suppliers on warehouse item detail page.
- [x] Add initial CRM supplier assignment to warehouse item create flow.
- [x] Hide legacy supplier selectors from warehouse item create/edit so CRM suppliers are the visible supplier source.
- [x] Hide variant internals for simple item edit while keeping the hidden default variant as the persistence model.
- [x] Add reusable rich CRM contractor lookup dialog for supplier picking by number, name, tax ID, email, and phone.
- [x] Replace inline warehouse item supplier search forms with the shared contractor lookup dialog.
- [x] Keep contractor lookup selection separate from supplier assignment so item forms can fill terms before adding.
- [x] Reconcile CRM work with the new warehouse audit feature pulled from `main`.
- [x] Add RLS integration coverage through CRM migration invariant tests.
- [x] Complete party create/edit/detail UI polish.
- [x] Complete contact create/edit/detail UI polish.
- [x] Complete initial party contact-person assignment UI.
- [x] Complete initial party address add UI.
- [x] Integrate CRM suppliers into warehouse item create/edit/detail flows.
- [x] Integrate initial kontrahent number lookup into warehouse movement forms.
- [x] Add initial CRM party snapshots to warehouse movement party details JSON.
- [x] Add shared organization entity number registry for CRM parties and branches.
- [x] Backfill existing branches with non-colliding branch numbers.
- [x] Update warehouse movement lookup to resolve either CRM kontrahent numbers or branch numbers.
- [x] Apply CRM DDL through Supabase MCP against the target database when approved.
- [x] Run Supabase advisors through MCP after DDL.
- [x] Regenerate Supabase types.
- [x] Run web type-check after unrelated rich-text `@tiptap/core` package issue is resolved.
- [x] Run full Vitest suite attempt and document unrelated blockers.
- [x] Run production build.
- [x] Update CRM module checklist with verified results.

## Goal

Build a production-grade CRM module that becomes the canonical source of truth for kontrahenci and contacts across the application. The implementation must follow the Coreframe module development guides:

- SSR-first routes.
- TDD-first completion.
- Modular architecture.
- Entitlements V2.
- Permissions V2.
- Sidebar V2.
- Server actions as the app mutation boundary.
- Service layer for database operations.
- RLS-first Supabase schema.
- i18n coverage.
- Module docs and checklist.
- Verification before production use.

## Phase 1: Rebase And Reconcile Current Branch

Status: complete for the CRM implementation scope.

Completed:

- Stashed existing uncommitted CRM work.
- Pulled `origin/main` into the current branch.
- Re-applied the CRM stash without merge conflicts.
- Reviewed the new warehouse audit supplier-scope flow after the pull.

Deliverables:

- Clean working tree with CRM work layered on current main.
- No accidental regressions to stock audit, inventory count, or reorder flows.
- Audit supplier scope remains on legacy inventory supplier ids until `inventory_variants.default_supplier_id` / `inventory_reorder_rules.preferred_supplier_id` are migrated or bridged to CRM parties.

## Phase 2: Database And Supabase Hardening

Status: complete for CRM foundation and target verification.

Existing migration:

- Adds CRM permissions.
- Assigns owner/member defaults.
- Adds `crm` to Professional and Enterprise subscription plans.
- Creates CRM tables.
- Creates `warehouse_item_suppliers`.
- Creates indexes and partial unique indexes.
- Adds updated-at triggers.
- Adds `next_crm_counterparty_number(org_id uuid)`.
- Adds shared `organization_entity_numbers` and `organization_entity_number_sequences` tables for org-wide visible numbers.
- Adds `branches.branch_number` and backfills existing branches without colliding with CRM party `counterparty_number` values.
- Adds `reserve_organization_entity_number(org_id uuid, entity_type text, entity_id uuid)` for safe number reservation across CRM parties and branches.
- Enables and forces RLS on CRM PII tables.
- Denies hard deletes.

Completed verification:

- Applied `20260707120000_crm_module.sql` to `ambra-prod` through Supabase MCP.
- Applied follow-up CRM FK advisor indexes through Supabase MCP.
- Confirmed CRM tables exist on the target project through Supabase MCP.
- Ran Supabase security and performance advisors through Supabase MCP.
- Regenerated `apps/web/supabase/types/target.types.ts`; it now includes `crm_contacts`, `crm_parties`, `warehouse_item_suppliers`, `organization_entity_numbers`, `next_crm_counterparty_number`, and `reserve_organization_entity_number`.
- Accepted advisor finding: `next_crm_counterparty_number(org_id uuid)` is intentionally `SECURITY DEFINER` and executable by `authenticated`; it revokes public execution and performs an organization-membership check before allocating numbers.
- Verified on `ambra-prod` that `organization_entity_numbers` has no duplicate numbers per organization and that existing branches for the test organization have assigned numbers.

Acceptance criteria:

- Migration applies cleanly.
- Advisors return no unresolved CRM critical security/performance issues.
- Generated types include all CRM and warehouse supplier tables.
- Migration invariant tests cover CRM RLS/FORCE RLS, hard-delete denial, branch/private visibility policy structure, secure number allocation, and cross-org link prevention.

## Phase 3: Contracts, Entitlements, Permissions, And Navigation

Status: foundation exists.

Implemented:

- `MODULE_CRM`.
- CRM permission constants.
- CRM added to premium module list.
- Sidebar group and child routes.
- CRM route entitlement guard.
- CRM action entitlement and permission checks.

Remaining work:

- Confirm `module.crm.access` is always required before showing CRM entry points.

Acceptance criteria:

- CRM is visible only when the organization is entitled and the user has CRM module access.
- Parties/contacts/settings children respect their read permissions.
- No raw CRM permission strings appear in TypeScript application code.

## Phase 4: Service Layer

Status: complete for the CRM implementation scope.

Current services:

- `CrmPartiesService`
- `CrmContactsService`
- `WarehouseItemSuppliersService`

Completed:

- Added service tests for party organization scoping, kontrahent number search, server-side number assignment, and soft delete.
- Added service tests for soft-deleting party contact links and party addresses.
- Added contact service tests for organization scoping, private contact ownership, and branch defaulting.
- Added warehouse item supplier tests for CRM party mapping, primary supplier clearing, and soft delete.
- Added CRM supplier search service for warehouse item supplier pickers.
- Added CRM migration invariant tests for private storage buckets and policies.

Acceptance criteria:

- Services are deterministic, organization-scoped, and soft-delete-aware.
- Service tests cover success and database-error paths.
- No service method trusts client-supplied organization scope beyond server context.

## Phase 5: Server Actions

Status: complete for the CRM implementation scope.

Current CRM actions:

- List/get/create/update/delete parties.
- Link party contact.
- Unlink party contact.
- Add party address.
- Delete party address.
- List/get/create/update/delete contacts.
- Get overview counts.

Current warehouse supplier actions:

- List item suppliers.
- Search CRM supplier parties.
- Create item supplier.
- Delete item supplier.

Completed:

- Added action tests for unauthenticated party creation.
- Added action tests for missing party create permission.
- Added action tests for invalid party payloads.
- Added action tests for happy-path party creation with server-owned org/user context.
- Added action tests for branch contact creation.
- Added action tests for overview counts.
- Added action tests for missing CRM entitlement mapping.
- Added action tests for cross-organization list denial.
- Added action tests for party update, party soft delete, contact linking, and party address creation.
- Added action tests for party contact unlinking and party address deletion.
- Added action tests for contact update and contact soft delete.

Acceptance criteria:

- Every action starts from server-owned auth/context.
- Every mutation validates input before calling services.
- Every mutation checks entitlement and permission constants.
- Errors are mapped predictably.

## Phase 6: CRM UI

Status: complete for the CRM implementation scope.

Implemented:

- `/dashboard/crm`
- `/dashboard/crm/parties`
- `/dashboard/crm/contacts`
- `/dashboard/crm/settings`
- CRM root, parties, contacts, and settings loading/error states.
- Party logo upload control in the party detail panel.
- Contact avatar upload control in the contact detail panel.
- Party detail edit form for basic fields, status, notes, and roles.
- Party contact-person linking from existing contacts.
- Party address add form.
- Party contact-person unlink buttons.
- Party address remove buttons.
- Contact detail edit form for basic fields, visibility, and notes.
- Optional linked organization user selector for contact create/edit when the viewer has member read access.
- Party and contact archive buttons backed by existing soft-delete actions.

Deferred enhancements:

- Add create-contact-from-party shortcut if product UX calls for it.
- Add richer update affordances for existing linked contact/address metadata beyond unlink/re-add.

Acceptance criteria:

- Users can manage suppliers, clients, contractors, individual clients, and contacts without leaving CRM.
- Users can create a supplier, add/select contacts, assign them as supplier contact persons, and see that relationship on the party detail.
- Users can manage private, branch, and organization contacts.
- UI does not expose actions the user lacks permission to perform.

## Phase 7: Warehouse Integration

Status: complete for the CRM implementation scope.

Completed:

- Added `CrmPartiesService.searchSuppliers` to return active CRM parties with the `supplier` role.
- Added `searchCrmWarehouseSupplierPartiesAction` guarded by `warehouse.products.read` and `crm.parties.read`.
- Added action tests for warehouse item supplier permissions, CRM supplier search, and item supplier creation context.
- Added `CrmItemSuppliersPanel` to the warehouse item edit purchase section.
- The edit panel can search CRM supplier parties, attach a party to the item, store supplier SKU, lead time, MOQ, purchase price, currency, mark primary supplier, list existing CRM suppliers, and soft-delete supplier links.
- Added SSR CRM supplier visibility on the warehouse item detail page for users with `crm.parties.read`.
- Added initial CRM supplier assignment in the warehouse item create flow; selected suppliers are attached after the product id is created.
- Reconciled the pulled warehouse audit supplier-scope flow; it intentionally remains on legacy inventory supplier ids for now because count sessions and reorder rules filter `inventory_variants.default_supplier_id` / `inventory_reorder_rules.preferred_supplier_id`, not `warehouse_item_suppliers.party_id`.
- Added CRM party lookup by plain integer counterparty number for warehouse movement party fields.
- Movement party details now carry CRM party id, counterparty number, and a compact immutable snapshot in existing sender/recipient details JSON.
- Added shared organization entity-number lookup for warehouse movement party fields; the same integer field can resolve a CRM party or an internal branch.
- Movement party details now also carry branch id, branch number, branch snapshot, and a generic `entityNumber` when the entered number resolves to a branch.

Deferred transition work:

- Show richer supplier contact data once signed URLs/contact links are available in the item context.
- Decide how legacy supplier/business account data migrates or coexists during transition.
- Define the bridge/migration from legacy inventory supplier ids to CRM party ids before changing supplier-scoped stock audits.
- Decide whether movement headers also need physical `party_id`, `counterparty_number_snapshot`, and `counterparty_snapshot` columns for reporting, or whether JSON party details are sufficient for v1.

Acceptance criteria:

- Item suppliers come from CRM parties, not duplicated supplier records.
- Movement forms can resolve supplier/receiver data by a plain integer CRM kontrahent number or branch number.
- Branch-number and kontrahent-number values cannot collide inside the same organization.

## Phase 8: Tests And Verification

Status: complete for CRM gates; project-wide full Vitest remains blocked outside CRM scope.

Completed CRM tests:

- Contracts invariants.
- Sidebar SSR visibility.
- CRM service unit tests.
- CRM action tests.
- Warehouse item supplier service/action tests.
- CRM migration invariant tests covering RLS and storage policy structure.

Completed commands:

- `pnpm --filter @repo/contracts test`
- `pnpm --filter web run test:run -- <focused CRM/service/action/sidebar/RLS files>`
- `pnpm --filter web run type-check`
- `pnpm --filter web run build`

Current verified results:

- Contracts tests pass: 1 file, 9 tests.
- Focused CRM/invariant tests pass: 8 files, 98 tests.
- Web type-check passes.
- Production build passes.
- Full web Vitest was attempted and timed out after 300 seconds with unrelated existing failures in public header, DataView, signup, QR labels/PDF generation, admin sidebar registry, loading tests, branch context, and audit visual taxonomy. No CRM focused tests failed.

Acceptance criteria:

- CRM-required tests pass.
- Type-check passes.
- Build passes.
- Supabase advisors pass or have documented accepted findings.

## Phase 9: Documentation And Release Readiness

Status: complete for this implementation pass.

Acceptance criteria:

- The module docs explain domain ownership, permissions, data model, UI routes, tests, and known limitations.
- The progress tracker accurately reflects completed work.
- The release notes identify any manual Supabase MCP steps.

## Production Readiness Definition

The CRM module is implementation-complete for this pass when:

- The database migration has been applied and verified through Supabase MCP.
- Advisors have been run and findings handled.
- Supabase types are regenerated.
- CRM migration invariant RLS coverage passes.
- Unit/action/sidebar/contracts tests pass.
- Type-check and production build pass.
- Party/contact workflows are complete enough for real business use.
- Warehouse item supplier and movement lookup integration are complete.
- Storage uploads for logos/avatars are implemented without exposing service-role credentials.
