# CRM / Kontrahenci Implementation Description

## Purpose

The CRM module is the source of truth for kontrahenci, suppliers, contractors, business clients, individual clients, and human contacts. It is designed as an SSR-first Coreframe module with database-enforced tenant isolation, Entitlements V2 gating, Permissions V2 checks, Sidebar V2 registration, service-layer mutations, and server actions as the application boundary.

The module intentionally separates invoice-capable entities from people:

- `crm_parties` are kontrahenci: companies, suppliers, contractors, business clients, receivers, payers, and individual clients that can appear on documents or warehouse movements.
- `crm_contacts` are people: private contacts, branch contacts, organization-wide contacts, and optional links to existing organization users.
- `crm_party_roles` model supplier/client/contractor/vendor/etc. as roles, not as separate duplicated entity tables.
- `crm_party_contacts` links people to parties as primary, billing, sales, technical, owner, representative, or other contacts.
- `crm_party_addresses` stores registered, billing, shipping, correspondence, and other addresses.
- `warehouse_item_suppliers` connects warehouse items to CRM supplier parties.

## Current Implementation State

The foundation has been implemented in the working tree:

- Contracts constants for the `crm` module and CRM permission slugs.
- Sidebar V2 registration for CRM overview, parties, contacts, and settings links.
- CRM migration with schema, permissions, entitlement update, RLS policies, indexes, triggers, and number allocation RPC.
- Zod validation schemas for parties, contacts, party-contact links, addresses, and warehouse item supplier links.
- Service layer for parties, contacts, and warehouse item suppliers.
- CRM server actions with entitlement checks, dashboard context loading, auth checks, permission checks, validation, and service calls.
- SSR routes for `/dashboard/crm`, `/dashboard/crm/parties`, and `/dashboard/crm/contacts`.
- Initial client islands for parties and contacts with SSR initial data.
- CRM settings route scaffold with matching sidebar and translation keys.
- Focused CRM service and action tests, including entitlement mapping, server-owned context, soft delete, contact linking, address creation, and cross-org list denial.
- Private Supabase Storage buckets and server actions for CRM party logos and contact avatars.
- Party/contact detail UI upload controls for CRM logos and avatars.
- CRM supplier search service/action for warehouse item supplier pickers.
- Module metadata and module checklist under `src/modules/crm`.
- English and Polish navigation/UI translations.

The work is not production-complete yet. The biggest remaining gaps are RLS integration tests, Supabase type regeneration, Supabase MCP verification/advisors, richer editing workflows, warehouse item UI integration, warehouse movement lookup by kontrahent number, and final build gates.

## Database Model

### `crm_number_sequences`

Stores per-organization integer sequences. The current sequence key is `counterparty`.

Kontrahent numbers are plain integers such as `6`, `12`, and `81`. They are unique inside an organization and are assigned by the server/database path, not by normal client input.

### `crm_parties`

Stores all invoice-capable parties. This includes business entities and individual clients. Key fields include:

- `organization_id`
- `counterparty_number`
- `party_kind`
- `display_name`
- legal/tax identifiers such as `tax_id`, `vat_id`, `regon`, `krs`
- contact fields such as `email`, `phone`, `website`
- `logo_storage_path`
- lifecycle fields such as `status`, `created_by`, `updated_by`, `deleted_at`

The table has a unique constraint on `(organization_id, counterparty_number)`.

### `crm_party_roles`

Stores party roles:

- `supplier`
- `client`
- `contractor`
- `vendor`
- `partner`
- `receiver`
- `payer`
- `other`

Roles are attached to `crm_parties`, which avoids separate supplier/client/contractor tables and lets one kontrahent be both a supplier and a client when real business workflows need that.

### `crm_contacts`

Stores people. Contacts can be:

- `private`: visible only to the owner user.
- `branch`: visible according to branch permission/access rules.
- `organization`: visible to permitted organization users.

Contacts can optionally point to an existing app user through `linked_user_id`, which allows organization members to appear as contacts without duplicating their identity model.

### `crm_party_contacts`

Links contacts to parties with relationship metadata. This supports workflows such as creating a supplier, creating or selecting existing people, and assigning those people as billing or primary contacts for that supplier.

### `crm_party_addresses`

Stores party addresses by type. The schema supports registered, billing, shipping, correspondence, and other address types with a per-type default constraint.

### `warehouse_item_suppliers`

Connects warehouse inventory items to CRM parties that have supplier behavior. It stores supplier-specific purchasing data such as SKU, lead time, minimum order quantity, purchase price, currency, and primary supplier flag.

## Numbering

The `next_crm_counterparty_number(org_id uuid)` RPC allocates plain integer kontrahent numbers per organization. It:

- validates that an organization id was provided,
- checks organization membership,
- creates the sequence row if missing,
- locks the sequence row with `FOR UPDATE`,
- returns the current value,
- increments `next_value`.

This is the mechanism that lets warehouse or document forms accept a simple kontrahent number and resolve the full party record. Branch numbers remain a separate namespace and are not mixed with CRM party numbering.

## Security And RLS

The migration enables RLS on all CRM tables and forces RLS on PII-heavy CRM tables:

- `crm_parties`
- `crm_party_roles`
- `crm_contacts`
- `crm_party_contacts`
- `crm_party_addresses`

Core security rules:

- Hard delete is denied to authenticated users.
- Application delete actions soft-delete with `deleted_at`.
- Parties require CRM party permissions.
- Contacts require CRM contact permissions.
- Private contacts are scoped to `owner_user_id`.
- Branch contacts require branch permission checks.
- Link/address tables are scoped by organization and parent visibility/permissions.
- The number allocation RPC revokes public execution and grants execution only to `authenticated`.

The implementation still needs real RLS integration tests before it should be considered production-ready.

## Entitlements And Permissions

The module slug is `crm`. It is intended for Professional and Enterprise plans.

Implemented permission constants include:

- `MODULE_CRM_ACCESS`
- `CRM_WILDCARD`
- `CRM_READ`
- `CRM_PARTIES_READ`
- `CRM_PARTIES_CREATE`
- `CRM_PARTIES_UPDATE`
- `CRM_PARTIES_DELETE`
- `CRM_CONTACTS_READ`
- `CRM_CONTACTS_CREATE`
- `CRM_CONTACTS_UPDATE`
- `CRM_CONTACTS_DELETE`

The migration assigns `crm.*` to `org_owner`. It assigns `module.crm.access`, `crm.read`, `crm.parties.read`, and `crm.contacts.read` to `org_member`.

## Application Architecture

The module follows the Coreframe module structure:

- `src/modules/crm/config.ts`
- `src/modules/crm/MODULE.md`
- `src/modules/crm/MODULE_CHECKLIST.md`
- `src/lib/validations/crm.ts`
- `src/server/services/crm-parties.service.ts`
- `src/server/services/crm-contacts.service.ts`
- `src/server/services/warehouse-item-suppliers.service.ts`
- `src/app/actions/crm/index.ts`
- `src/app/actions/warehouse/item-suppliers.ts`
- `src/app/[locale]/dashboard/crm/*`

Server actions are the mutation boundary. They require module access, load dashboard context, verify the authenticated user, check permission snapshots with constants, validate input with Zod, and then call services.

Services receive the Supabase client as their first argument and scope every query by `organization_id`.

## UI Surface

Implemented routes:

- `/dashboard/crm`
- `/dashboard/crm/parties`
- `/dashboard/crm/settings`

The current UI is an initial management surface. It includes list/detail client islands, settings placeholder coverage, storage-backed logo/avatar upload controls, party detail editing, role editing, contact-person linking, address creation, contact detail editing, party/contact archive affordances, and a warehouse item edit supplier panel. It still needs linked contact/address update/delete affordances, create-contact-from-party flow if desired, and full warehouse item create/detail integration.

## Warehouse Integration

The schema and service/action foundation for item suppliers exists through `warehouse_item_suppliers`.

CRM supplier search is available through a warehouse action that reads active CRM parties with the `supplier` role and requires both warehouse product read access and CRM party read access.

Warehouse item edit now includes a CRM supplier panel in the purchase section. It can search supplier parties, attach them to the item, save supplier SKU, mark a primary supplier, list existing item suppliers, and remove links via soft delete.

Still required:

- Extend the Suppliers section/tab to warehouse item create/detail flows.
- Add UI fields for price, currency, MOQ, and lead time.
- Add movement form lookup by kontrahent number.
- Store CRM party references and snapshots where warehouse movements need immutable document data.

## Verification Status

The implementation has not passed the final verification gates yet. Current verified gates:

- Focused CRM service/action/sidebar/migration Vitest suite passes: 7 files, 70 tests.
- Contracts invariant tests pass.
- CRM-specific type-check errors have been fixed.

Required remaining gates include:

- Supabase migration application through MCP.
- Supabase advisors after DDL.
- Supabase type regeneration.
- RLS integration tests.
- Full `npm run type-check`.
- Full `npx vitest run`.
- `npm run build`.

Full web type-check currently fails on unrelated rich-text imports for missing `@tiptap/core`, not on CRM code.
