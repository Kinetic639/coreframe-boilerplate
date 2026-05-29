# MODULE_IMPLEMENTATION_CHECKLIST.md — Help Desk

> Copied from `apps/web/docs/MODULE_CHECKLIST_TEMPLATE.md` on 2026-05-26.
> Do not mark a box unless it is verifiably true.

---

## 1. Purpose & Non-Negotiables

### SSR-First Invariants

- [x] Server Components are authoritative. They compute data, authorization, and sidebar model before the page renders.
- [x] Client Components are dumb renderers. They accept pre-computed props. They do not re-evaluate permissions.
- [x] The dashboard layout loads the authoritative context once (`loadDashboardContextV2()`), not repeated per page.
- [x] `buildSidebarModel()` runs server-side. Production uses the `React.cache()`-wrapped version.
- [x] `React.cache()` provides per-request memoization — never a global singleton cache.
- [x] No `createClient()` / Supabase client instantiation in Client Components for org-scoped data.

### TDD-First Invariants

- [x] Tests are written alongside the implementation.
- [x] Every access-control decision has at least one negative test (hd-2, hd-3, hd-5 prove fail-closed).
- [x] Sidebar integration tests use `buildSidebarModelUncached`.
- [ ] RLS tests run against real Postgres — deferred to feature implementation phase.
- [x] `clearPermissionRegexCache()` is called in `afterEach` in the sidebar test file.

### UX vs. Security Boundary

- [x] Understood: the sidebar is a UX boundary, not a security boundary.
- [x] Hiding a sidebar item never prevents direct URL access.
- [x] Every route has a server-side guard (layout + page).

### Fail-Closed Principles

- [x] Missing entitlements → access denied (hd-5 confirms fail-closed).
- [x] Missing permissions → access denied (hd-3 confirms).
- [x] Permission checks use deny-first semantics.

### No Raw Strings Rule

- [x] No raw permission strings in TypeScript. All use `@/lib/constants/permissions`.
- [x] No raw module strings in TypeScript. All use `@/lib/constants/modules`.

---

## 2. Module Specification Inputs

### Identity

```
Module name (human):       Help Desk
Module slug (kebab-case):  help-desk
Constant name:             MODULE_HELPDESK
File prefix:               helpdesk
v2_ready status:           [x] v2_ready
```

### Routes

```
Route path                               Guard type
/dashboard/help-desk                     both (module entitlement + permission)
/dashboard/help-desk/tickets             permission (helpdesk.tickets.read)
/dashboard/help-desk/ticket-types        permission (helpdesk.ticket-types.manage)
```

### Permissions

```
Slug                           Constant                       Granted to
helpdesk.*                     HELPDESK_WILDCARD              org_owner (wildcard)
helpdesk.read                  HELPDESK_READ                  org_member (explicit)
helpdesk.manage                HELPDESK_MANAGE                (via wildcard expansion)
helpdesk.tickets.read          HELPDESK_TICKETS_READ          org_member (explicit)
helpdesk.tickets.create        HELPDESK_TICKETS_CREATE        org_member (explicit)
helpdesk.tickets.manage        HELPDESK_TICKETS_MANAGE        (via wildcard expansion)
helpdesk.ticket-types.manage   HELPDESK_TICKET_TYPES_MANAGE   (via wildcard expansion)
helpdesk.settings.manage       HELPDESK_SETTINGS_MANAGE       (via wildcard expansion)
module.helpdesk.access         MODULE_HELPDESK_ACCESS         org_member (explicit)
```

### Entitlements

```
Module slug in subscription_plans.enabled_modules:   help-desk
Plans with access:   professional, enterprise
Plans without:       free, starter
```

---

## 3. Database Schema

- [x] `helpdesk_ticket_types` table created in migration.
- [x] `helpdesk_tickets` table created with ticket number sequence.
- [x] `helpdesk_ticket_references` cross-module reference table created.
- [x] `helpdesk_ticket_comments` table created with soft delete.
- [x] `helpdesk_ticket_activity` append-only audit table created.
- [x] `helpdesk_settings` per-org settings table created.
- [x] Indexes on org_id, status, created_by, assigned_to fields.
- [x] Soft delete (`deleted_at`) pattern on tickets and comments.
- [x] Ticket number sequence `helpdesk_ticket_number_seq` created.

---

## 4. RLS Policies

- [x] `helpdesk_ticket_types`: SELECT / INSERT / UPDATE / DELETE policies.
- [x] `helpdesk_tickets`: SELECT / INSERT / UPDATE / DELETE policies.
- [x] `helpdesk_ticket_references`: SELECT / INSERT / DELETE policies.
- [x] `helpdesk_ticket_comments`: SELECT / INSERT / UPDATE / DELETE policies.
- [x] `helpdesk_ticket_activity`: SELECT / INSERT policies (no UPDATE/DELETE — immutable).
- [x] `helpdesk_settings`: SELECT / ALL policies.

---

## 5. Permissions (RBAC V2)

- [x] `helpdesk.*` permission slug seeded in `permissions` table.
- [x] `helpdesk.read` permission slug seeded.
- [x] `helpdesk.manage` permission slug seeded.
- [x] `helpdesk.tickets.read` permission slug seeded.
- [x] `helpdesk.tickets.create` permission slug seeded.
- [x] `helpdesk.tickets.manage` permission slug seeded.
- [x] `helpdesk.ticket-types.manage` permission slug seeded.
- [x] `helpdesk.settings.manage` permission slug seeded.
- [x] `module.helpdesk.access` permission slug seeded.
- [x] `org_owner` granted `helpdesk.*` wildcard via migration.
- [x] `org_member` granted `helpdesk.read`, `helpdesk.tickets.read`, `helpdesk.tickets.create`, `module.helpdesk.access` via migration.
- [x] Constants added to `packages/contracts/src/permissions.ts`.
- [x] Constants added to `PermissionSlug` union type.
- [x] Constants added to `ALL_PERMISSION_SLUGS` array.

---

## 6. Entitlements

- [x] `MODULE_HELPDESK` constant added to `packages/contracts/src/modules.ts`.
- [x] Added to `ModuleSlug` union type.
- [x] Added to `PREMIUM_MODULES` array.
- [x] `professional` plan updated to include `'help-desk'` in `enabled_modules`.
- [x] `enterprise` plan updated to include `'help-desk'` in `enabled_modules`.
- [x] `entitlements.requireModuleOrRedirect(MODULE_HELPDESK)` called in `layout.tsx`.

---

## 7. Server Guards

- [x] Layout `layout.tsx`: Gate 1 — `entitlements.requireModuleOrRedirect(MODULE_HELPDESK)`.
- [x] Layout `layout.tsx`: Gate 2 — `checkPermission(snapshot, MODULE_HELPDESK_ACCESS)`.
- [x] Page `page.tsx` (overview): `checkPermission(snapshot, HELPDESK_READ)`.
- [x] Page `tickets/page.tsx`: `checkPermission(snapshot, HELPDESK_TICKETS_READ)`.
- [x] Page `ticket-types/page.tsx`: `checkPermission(snapshot, HELPDESK_TICKET_TYPES_MANAGE)`.
- [x] Redirects to `/dashboard/access-denied` with appropriate `reason` query param.

---

## 8. Sidebar V2 Registry

- [x] Help Desk entry added to `src/lib/sidebar/v2/registry.ts`.
- [x] Group: `workspace` (after Workshop, before Tools).
- [x] `requiresModules: [MODULE_HELPDESK]` — plan gate.
- [x] `requiresPermissions: [MODULE_HELPDESK_ACCESS]` — user gate.
- [x] `iconKey: "lifeBuoy"` — new icon added to `IconKey` type and `ICON_MAP`.
- [x] Children: overview (HELPDESK_READ), tickets (HELPDESK_TICKETS_READ), ticket-types (HELPDESK_TICKET_TYPES_MANAGE).
- [x] No raw strings in registry.

---

## 9. Tests

- [x] hd-1: Help Desk visible when entitled + user has access + children visible.
- [x] hd-2: Help Desk hidden when not in `enabled_modules`.
- [x] hd-3: Help Desk hidden when user lacks `module.helpdesk.access`.
- [x] hd-4: `help-desk.ticket-types` hidden when user lacks `helpdesk.ticket-types.manage`.
- [x] hd-5: Help Desk hidden when entitlements are `null` (fail-closed).
- [ ] Page guard tests — deferred (requires route-level integration test setup).
- [ ] RLS integration tests — deferred to feature implementation phase.

---

## 10. i18n Keys

- [x] `modules.helpDesk.title` — EN + PL.
- [x] `modules.helpDesk.titleSidebar` — EN + PL.
- [x] `modules.helpDesk.description` — EN + PL.
- [x] `modules.helpDesk.items.overview` — EN + PL.
- [x] `modules.helpDesk.items.tickets` — EN + PL.
- [x] `modules.helpDesk.items.ticketTypes` — EN + PL.
- [x] `modules.helpDesk.pages.*` — EN + PL (overview, tickets, ticketTypes).
- [x] `modules.helpDesk.tickets.status.*` — EN + PL (5 statuses).
- [x] `modules.helpDesk.tickets.priority.*` — EN + PL (4 priorities).
- [x] `modules.helpDesk.features.*` — EN + PL (6 feature cards + comingSoon).
- [x] `modules.helpDesk.empty.*` — EN + PL.
- [x] `modules.helpDesk.errors.*` — EN + PL.
- [x] i18n routes added to `routing.ts`.

---

## 11. Release Verification

- [x] `pnpm type-check` passes (help-desk specific).
- [x] Help Desk sidebar tests (hd-1 through hd-5) pass.
- [ ] Migration applied to target DB — pending.
- [ ] Feature smoke-test in browser — pending (requires running dev server).
- [ ] Org entitlement manually updated for dev/test org — pending.

---

## 12. Known Future Work

- Ticket detail page with full comment thread
- Create ticket form (modal + full page)
- Status workflow transitions with validation
- Email notifications on ticket create/update
- Cross-module reference UI (e.g., link a Workshop repair order to a ticket)
- Ticket assignment and escalation workflows
- Help Desk settings page
- Ticket search and advanced filtering
- Bulk ticket operations
- SLA tracking and due date alerts
- Reporting and analytics integration
- Mobile-responsive ticket list and detail views
