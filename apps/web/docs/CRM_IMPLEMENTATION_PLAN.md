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
- [ ] Reconcile CRM work with the new warehouse audit feature pulled from `main`.
- [ ] Add RLS integration tests.
- [ ] Complete party create/edit/detail UI polish.
- [ ] Complete contact create/edit/detail UI polish.
- [x] Complete initial party contact-person assignment UI.
- [x] Complete initial party address add UI.
- [ ] Integrate CRM suppliers into warehouse item create/edit/detail flows.
- [ ] Integrate kontrahent number lookup into warehouse movement forms.
- [ ] Add CRM party snapshots to warehouse movement persistence where required.
- [ ] Apply CRM DDL through Supabase MCP against the target database when approved.
- [ ] Run Supabase advisors through MCP after DDL.
- [ ] Regenerate Supabase types.
- [ ] Run web type-check after unrelated rich-text `@tiptap/core` package issue is resolved.
- [ ] Run full Vitest suite.
- [ ] Run production build.
- [ ] Update CRM module checklist with verified results.

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

Status: partially complete.

Completed:

- Stashed existing uncommitted CRM work.
- Pulled `origin/main` into the current branch.
- Re-applied the CRM stash without merge conflicts.

Remaining:

- Review the new warehouse audit work from `main`, especially the inventory action refactor and supplier-related UI surfaces.
- Confirm that CRM warehouse supplier actions still fit the updated warehouse action organization.
- Check translation merges in `apps/web/messages/en.json` and `apps/web/messages/pl.json`.
- Check Sidebar V2 ordering after the new warehouse audit navigation changes.

Deliverables:

- Clean working tree with CRM work layered on current main.
- No accidental regressions to stock audit, inventory count, or reorder flows.

## Phase 2: Database And Supabase Hardening

Status: foundation exists, not verified.

Existing migration:

- Adds CRM permissions.
- Assigns owner/member defaults.
- Adds `crm` to Professional and Enterprise subscription plans.
- Creates CRM tables.
- Creates `warehouse_item_suppliers`.
- Creates indexes and partial unique indexes.
- Adds updated-at triggers.
- Adds `next_crm_counterparty_number(org_id uuid)`.
- Enables and forces RLS on CRM PII tables.
- Denies hard deletes.

Remaining work:

- Review migration against current production schema after the `main` pull.
- Confirm helper functions used by policies exist in the target database.
- Review `SECURITY DEFINER` number RPC against Supabase security guidance.
- Apply schema changes through Supabase MCP only when approved.
- Run Supabase advisors through MCP after DDL.
- Regenerate Supabase types and commit the generated type changes.

Acceptance criteria:

- Migration applies cleanly.
- Advisors return no unresolved critical security/performance issues.
- Generated types include all CRM and warehouse supplier tables.
- RLS tests prove tenant isolation and visibility rules.

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

Status: focused unit coverage added; broader generated-type and error-path coverage still pending.

Current services:

- `CrmPartiesService`
- `CrmContactsService`
- `WarehouseItemSuppliersService`

Completed:

- Added service tests for party organization scoping, kontrahent number search, server-side number assignment, and soft delete.
- Added contact service tests for organization scoping, private contact ownership, and branch defaulting.
- Added warehouse item supplier tests for CRM party mapping, primary supplier clearing, and soft delete.
- Added CRM supplier search service for warehouse item supplier pickers.
- Added CRM migration invariant tests for private storage buckets and policies.

Remaining work:

- Add deeper error-path coverage.
- Review service return types against generated Supabase types after regeneration.

Acceptance criteria:

- Services are deterministic, organization-scoped, and soft-delete-aware.
- Service tests cover success and database-error paths.
- No service method trusts client-supplied organization scope beyond server context.

## Phase 5: Server Actions

Status: focused action coverage added; remaining actions still need broader coverage.

Current CRM actions:

- List/get/create/update/delete parties.
- Link party contact.
- Add party address.
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
- Added action tests for contact update and contact soft delete.

Remaining work:

- Confirm action return shape is consistent with existing app conventions.

Acceptance criteria:

- Every action starts from server-owned auth/context.
- Every mutation validates input before calling services.
- Every mutation checks entitlement and permission constants.
- Errors are mapped predictably.

## Phase 6: CRM UI

Status: initial routes and client islands exist; party detail management has first functional pass.

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
- Contact detail edit form for basic fields, visibility, and notes.
- Party and contact archive buttons backed by existing soft-delete actions.

Remaining work:

- Polish party create/edit/detail UI and add update/delete affordances for linked contacts and addresses.
- Add create-contact-from-party flow if it fits the UX.
- Polish contact create/edit/detail UI.
- Add support for linked organization users in contact forms.
- Ensure all client islands receive SSR initial data and permission booleans.
- Validate responsive layout and text overflow.

Acceptance criteria:

- Users can manage suppliers, clients, contractors, individual clients, and contacts without leaving CRM.
- Users can create a supplier, add/select contacts, assign them as supplier contact persons, and see that relationship on the party detail.
- Users can manage private, branch, and organization contacts.
- UI does not expose actions the user lacks permission to perform.

## Phase 7: Warehouse Integration

Status: schema/service/action foundation exists; CRM supplier search action added; edit-page UI panel added; create/detail and movement integration incomplete.

Completed:

- Added `CrmPartiesService.searchSuppliers` to return active CRM parties with the `supplier` role.
- Added `searchCrmWarehouseSupplierPartiesAction` guarded by `warehouse.products.read` and `crm.parties.read`.
- Added action tests for warehouse item supplier permissions, CRM supplier search, and item supplier creation context.
- Added `CrmItemSuppliersPanel` to the warehouse item edit purchase section.
- The edit panel can search CRM supplier parties, attach a party to the item, store supplier SKU, mark primary supplier, list existing CRM suppliers, and soft-delete supplier links.

Remaining work:

- Extend the CRM Suppliers section to warehouse item create/detail pages.
- Add remaining supplier terms to the UI: price, currency, MOQ, and lead time.
- Show richer supplier contact data once signed URLs/contact links are available in the item context.
- Decide how legacy supplier/business account data migrates or coexists during transition.
- Add kontrahent number lookup to warehouse movement forms.
- Store `party_id`, `counterparty_number_snapshot`, and `counterparty_snapshot` where movement documents require immutable party data.
- Keep branch number lookup separate from kontrahent number lookup.

Acceptance criteria:

- Item suppliers come from CRM parties, not duplicated supplier records.
- Movement forms can resolve supplier/receiver data by plain integer kontrahent number.
- Branch-number and kontrahent-number lookups cannot collide.

## Phase 8: Tests And Verification

Status: not complete.

Required tests:

- Contracts invariants.
- Sidebar SSR visibility.
- CRM service unit tests.
- CRM action tests.
- Warehouse item supplier service/action tests.
- RLS integration tests.
- Storage policy tests if storage policies are added.

Required commands:

- `pnpm --filter @repo/contracts test`
- `npm run type-check`
- `npx vitest run`
- `npm run build`

Current blocker:

- Focused CRM tests pass: 7 files, 70 tests.
- Web type-check no longer reports CRM errors, but still fails on unrelated rich-text imports for missing `@tiptap/core`.

Acceptance criteria:

- All required tests pass.
- Type-check passes.
- Build passes.
- Supabase advisors pass or have documented accepted findings.

## Phase 9: Documentation And Release Readiness

Status: in progress.

Remaining work:

- Keep `src/modules/crm/MODULE.md` current as implementation changes.
- Keep `src/modules/crm/MODULE_CHECKLIST.md` aligned with this plan.
- Add migration notes for deploying CRM to production.
- Document old supplier/contact coexistence or migration path.
- Document permission defaults for owners, members, and custom roles.
- Document operational behavior for counterparty number assignment.

Acceptance criteria:

- The module docs explain domain ownership, permissions, data model, UI routes, tests, and known limitations.
- The progress tracker accurately reflects completed work.
- The release notes identify any manual Supabase MCP steps.

## Production Readiness Definition

The CRM module is production-ready only when:

- The database migration has been applied and verified through Supabase MCP.
- Advisors have been run and findings handled.
- Supabase types are regenerated.
- RLS integration tests pass.
- Unit/action/sidebar/contracts tests pass.
- Type-check and production build pass.
- Party/contact workflows are complete enough for real business use.
- Warehouse item supplier and movement lookup integration are complete.
- Storage uploads for logos/avatars are implemented without exposing service-role credentials.
