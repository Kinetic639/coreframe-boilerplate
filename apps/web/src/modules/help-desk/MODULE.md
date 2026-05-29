# Help Desk Module

## Identity

| Field             | Value                     |
| ----------------- | ------------------------- |
| Module name       | Help Desk                 |
| Module slug       | `help-desk`               |
| Constant          | `MODULE_HELPDESK`         |
| Color theme       | `#6366f1` (Indigo)        |
| Icon              | `LifeBuoy` (lucide-react) |
| Plan gating       | Professional, Enterprise  |
| Permission prefix | `helpdesk.*`              |

## Purpose

Cross-module ticket and request hub for the Ambra platform. Any module can link a ticket to its own entities (repair orders, warehouse items, etc.) via the `helpdesk_ticket_references` cross-module reference table. The Help Desk module itself contains no domain-specific logic — it is intentionally generic.

## Routes

| Path                                | Guard                                          |
| ----------------------------------- | ---------------------------------------------- |
| `/dashboard/help-desk`              | layout: entitlement + `module.helpdesk.access` |
| `/dashboard/help-desk/tickets`      | page: `helpdesk.tickets.read`                  |
| `/dashboard/help-desk/ticket-types` | page: `helpdesk.ticket-types.manage`           |

## Permissions

| Slug                           | Constant                       | Granted to              |
| ------------------------------ | ------------------------------ | ----------------------- |
| `helpdesk.*`                   | `HELPDESK_WILDCARD`            | `org_owner` (wildcard)  |
| `helpdesk.read`                | `HELPDESK_READ`                | `org_member` (explicit) |
| `helpdesk.manage`              | `HELPDESK_MANAGE`              | via wildcard expansion  |
| `helpdesk.tickets.read`        | `HELPDESK_TICKETS_READ`        | `org_member` (explicit) |
| `helpdesk.tickets.create`      | `HELPDESK_TICKETS_CREATE`      | `org_member` (explicit) |
| `helpdesk.tickets.manage`      | `HELPDESK_TICKETS_MANAGE`      | via wildcard expansion  |
| `helpdesk.ticket-types.manage` | `HELPDESK_TICKET_TYPES_MANAGE` | via wildcard expansion  |
| `helpdesk.settings.manage`     | `HELPDESK_SETTINGS_MANAGE`     | via wildcard expansion  |
| `module.helpdesk.access`       | `MODULE_HELPDESK_ACCESS`       | `org_member` (explicit) |

## Database Tables

| Table                        | Purpose                                |
| ---------------------------- | -------------------------------------- |
| `helpdesk_ticket_types`      | Ticket categories with color/icon      |
| `helpdesk_tickets`           | Main ticket records (HD-000001 format) |
| `helpdesk_ticket_references` | Cross-module entity links              |
| `helpdesk_ticket_comments`   | Comments and internal notes            |
| `helpdesk_ticket_activity`   | Append-only audit/activity log         |
| `helpdesk_settings`          | Per-org settings (one row per org)     |

## Cross-Module Reference Model

Any module can link its entities to a Help Desk ticket via `helpdesk_ticket_references`:

```sql
source_module  TEXT  -- e.g. 'workshop'
source_type    TEXT  -- e.g. 'repair_order'
source_id      TEXT  -- e.g. UUID or string ID of the entity
context_snapshot JSONB -- optional snapshot of entity state at link time
```

This design keeps the Help Desk module generic — it has no imports from Workshop, Warehouse, or any other domain module.

## Services

| File                               | Purpose                     |
| ---------------------------------- | --------------------------- |
| `helpdesk-ticket-types.service.ts` | CRUD for ticket types       |
| `helpdesk-tickets.service.ts`      | CRUD for tickets + comments |

## Server Actions

All actions are in `src/app/actions/help-desk/index.ts`:

- `listTicketTypesAction` / `createTicketTypeAction` / `updateTicketTypeAction` / `deleteTicketTypeAction`
- `listTicketsAction` / `getTicketAction` / `createTicketAction` / `updateTicketAction` / `deleteTicketAction`
- `listCommentsAction` / `addCommentAction`

## Migration

`supabase/migrations/20260526100000_helpdesk_module.sql`
