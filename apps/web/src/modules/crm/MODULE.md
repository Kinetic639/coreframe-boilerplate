# CRM / Kontrahenci (`crm`)

## Purpose

- **What this module does:** Owns kontrahenci, billable parties, suppliers, contractors, clients, individual clients, and human contacts.
- **Who uses it:** Organization members with CRM access. Owners get the full CRM wildcard; members get read access by default.
- **Primary workflows:**
  - Create a kontrahent with an auto-assigned plain integer number.
  - Assign business roles such as supplier, client, contractor, receiver, or payer.
  - Manage scoped human contacts: private, branch, and organization-wide.
  - Link contacts to kontrahenci as billing, primary, technical, owner, or representative contacts.
  - Reference CRM supplier parties from warehouse item supplier records.

## Status

- **Implementation:** in progress
- **Last updated:** 2026-07-07
- **Owner:** coreframe

---

## Entitlements

- **Plan-gated:** yes, Professional and Enterprise.
- **Module constant:** `MODULE_CRM`
- **Entitlements source of truth:** `organization_entitlements.enabled_modules`
- **Where enforced:**
  - Page guard: `crm/layout.tsx` uses `entitlements.requireModuleOrRedirect(MODULE_CRM)`
  - Server actions: `src/app/actions/crm/index.ts` uses `entitlements.requireModuleAccess(MODULE_CRM)`

---

## Permissions

| Action          | Permission constant   | DB slug               |
| --------------- | --------------------- | --------------------- |
| Module access   | `MODULE_CRM_ACCESS`   | `module.crm.access`   |
| Read module     | `CRM_READ`            | `crm.read`            |
| Read parties    | `CRM_PARTIES_READ`    | `crm.parties.read`    |
| Create parties  | `CRM_PARTIES_CREATE`  | `crm.parties.create`  |
| Update parties  | `CRM_PARTIES_UPDATE`  | `crm.parties.update`  |
| Delete parties  | `CRM_PARTIES_DELETE`  | `crm.parties.delete`  |
| Read contacts   | `CRM_CONTACTS_READ`   | `crm.contacts.read`   |
| Create contacts | `CRM_CONTACTS_CREATE` | `crm.contacts.create` |
| Update contacts | `CRM_CONTACTS_UPDATE` | `crm.contacts.update` |
| Delete contacts | `CRM_CONTACTS_DELETE` | `crm.contacts.delete` |

`org_owner` receives `crm.*`. `org_member` receives read access and module access.

---

## Data Model

- `crm_number_sequences` — per-organization counterparty sequence.
- `crm_parties` — kontrahenci and invoice-capable parties.
- `crm_party_roles` — supplier/client/contractor/etc. roles.
- `crm_contacts` — human contacts, optionally linked to app users.
- `crm_party_contacts` — relationship links between people and parties.
- `crm_party_addresses` — registered, billing, shipping, correspondence addresses.
- `warehouse_item_suppliers` — warehouse-owned product supplier terms referencing CRM parties.

Kontrahent numbers are plain integers, unique per organization.

---

## RLS

All CRM PII tables have RLS enabled and forced. RLS uses:

- `is_org_member(organization_id)`
- `has_permission(organization_id, 'crm...')`
- `has_branch_permission(organization_id, branch_id, 'crm.contacts.read')` for branch contacts.

Hard delete is denied for normal users. Delete actions soft-delete via `deleted_at`.

---

## API Surface

### Server actions

- `listCrmPartiesForDataViewAction`
- `getCrmPartyDetailAction`
- `createCrmPartyAction`
- `updateCrmPartyAction`
- `deleteCrmPartyAction`
- `linkCrmPartyContactAction`
- `addCrmPartyAddressAction`
- `listCrmContactsForDataViewAction`
- `getCrmContactDetailAction`
- `createCrmContactAction`
- `updateCrmContactAction`
- `deleteCrmContactAction`

### Services

- `crm-parties.service.ts`
- `crm-contacts.service.ts`
- `warehouse-item-suppliers.service.ts`

---

## UI

Routes:

- `/dashboard/crm`
- `/dashboard/crm/parties`
- `/dashboard/crm/contacts`

Sidebar V2 registry is the only navigation source of truth.

---

## Tests

Required coverage:

- Sidebar visibility for CRM entitlement and permission combinations.
- Service unit tests for org scoping, soft delete, number allocation, role filtering, and private contact handling.
- Action tests for auth, entitlement, permissions, validation, and creation.
- RLS integration tests for cross-tenant isolation, private contacts, branch contacts, and hard-delete denial.

---

## Changelog

- 2026-07-07 — Initial CRM module foundation: contracts, schema migration, services, actions, routes, Sidebar V2 registration, and module docs.
