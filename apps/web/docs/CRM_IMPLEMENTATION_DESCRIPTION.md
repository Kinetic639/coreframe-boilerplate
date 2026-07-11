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
- Focused CRM service and action tests, including entitlement mapping, server-owned context, soft delete, contact linking/unlinking, address creation/removal, and cross-org list denial.
- Private Supabase Storage buckets and server actions for CRM party logos and contact avatars.
- Party/contact detail UI upload controls for CRM logos and avatars.
- CRM supplier search service/action for warehouse item supplier pickers.
- Module metadata and module checklist under `src/modules/crm`.
- English and Polish navigation/UI translations.
- Supabase MCP migration application and advisor verification on `ambra-prod`.
- Regenerated Supabase target types including the CRM tables and number allocator RPC.

The CRM implementation pass is complete. Deferred transition work remains around legacy supplier migration/bridging and whether warehouse movement headers should get physical snapshot columns in addition to the current JSON details.

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

CRM RLS is covered by migration invariant tests for RLS/FORCE RLS, hard-delete denial, branch/private visibility policy structure, secure number allocation, and cross-org link prevention. These tests are structural rather than live multi-user database integration tests.

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

The current UI is a functional management surface. It includes list/detail client islands, settings placeholder coverage, storage-backed logo/avatar upload controls, richer create dialogs, party detail editing, role editing, contact-person linking and unlinking, address creation and removal, contact detail editing, optional linked organization user selection for contacts, party/contact archive affordances, and warehouse item create/edit/detail supplier integration. Future UX enhancements can add a create-contact-from-party shortcut and richer inline metadata editing for existing links/addresses.

## Warehouse Integration

The schema and service/action foundation for item suppliers exists through `warehouse_item_suppliers`.

CRM supplier search is available through a warehouse action that reads active CRM parties with the `supplier` role and requires both warehouse product read access and CRM party read access.

Warehouse item edit now includes a CRM supplier panel in the purchase section. It can search supplier parties, attach them to the item, save supplier SKU, lead time, MOQ, purchase price, currency, mark a primary supplier, list existing item suppliers, and remove links via soft delete.

Warehouse item detail now SSR-renders assigned CRM suppliers for users with CRM party read access, including primary flag, supplier SKU, lead time, MOQ, purchase price, and currency.

Warehouse item create now supports selecting initial CRM suppliers before submit. The product is created first, then the selected CRM suppliers and purchasing terms are attached through the same `warehouse_item_suppliers` action path once the product id exists.

Warehouse movement party fields now support plain integer kontrahent lookup. Entering a CRM counterparty number resolves the party, fills name/tax/phone/address data, and stores CRM party id, counterparty number, and a compact snapshot in the existing `sender_details` / `recipient_details` JSON payload.

The pulled warehouse audit supplier-scope flow was reviewed against the CRM supplier work. It still intentionally uses legacy inventory supplier ids because audit sessions, variant defaults, and reorder rules currently filter through `inventory_variants.default_supplier_id` and `inventory_reorder_rules.preferred_supplier_id`. Switching it to CRM parties requires a bridge or migration path from those legacy ids to `crm_parties` / `warehouse_item_suppliers`.

Still required:

- Define the legacy supplier to CRM party migration/bridge before changing supplier-scoped stock audits.
- Decide whether movement headers need dedicated physical snapshot columns in addition to the JSON party details.

## Verification Status

Completed verified gates:

- Contracts invariant tests pass: 1 file, 9 tests.
- Focused CRM service/action/sidebar/migration/RLS invariant Vitest suite passes: 8 files, 98 tests.
- Web type-check passes.
- Production build passes.
- CRM DDL was applied to `ambra-prod` through Supabase MCP.
- CRM advisor FK indexes were applied to `ambra-prod` through Supabase MCP.
- Supabase security and performance advisors were run through Supabase MCP.
- `apps/web/supabase/types/target.types.ts` was regenerated and includes `crm_contacts`, `crm_parties`, `warehouse_item_suppliers`, and `next_crm_counterparty_number`.

Accepted findings and blockers:

- Supabase security advisor flags `next_crm_counterparty_number(org_id uuid)` because authenticated users can execute a `SECURITY DEFINER` function. This is intentional for safe sequence allocation; public execution is revoked and the function checks organization membership before allocating a number.
- Full web Vitest was attempted and timed out after 300 seconds with unrelated existing failures in public header, DataView, signup, QR labels/PDF generation, admin sidebar registry, loading tests, branch context, and audit visual taxonomy. The focused CRM suite passed.
