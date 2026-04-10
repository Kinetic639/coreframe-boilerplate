# Event System Architecture

> **Status:** Canonical Reference — Source of Truth
> **Audience:** Developers, AI agents, future maintainers, architecture and security reviewers
> **Branch:** `event-system`

---

## Table of Contents

1. [Purpose](#purpose)
2. [Core Concept](#core-concept)
3. [Activity vs Audit](#activity-vs-audit)
4. [Goals](#goals)
5. [Non-Goals](#non-goals)
6. [Architectural Principles](#architectural-principles)
7. [Event Depth Tiers](#event-depth-tiers)
8. [Canonical Event Model](#canonical-event-model)
   - [Event Ordering](#event-ordering)
9. [Actor Model](#actor-model)
10. [Canonical Database Table](#canonical-database-table)
11. [Final Stored Event Row](#final-stored-event-row)
12. [Required Indexes](#required-indexes)
13. [Recommended RLS Strategy](#recommended-rls-strategy)
14. [Enforcing Append-Only Guarantees](#enforcing-append-only-guarantees)
15. [Summary Generation](#summary-generation)
16. [Metadata Strategy](#metadata-strategy)
17. [Event Registry](#event-registry)
18. [User Visibility vs Field Visibility](#user-visibility-vs-field-visibility)
19. [Projection Model](#projection-model)
20. [Personal Activity vs Organization Activity vs Audit Detail](#personal-activity-vs-organization-activity-vs-audit-detail)
21. [Request Correlation](#request-correlation)
22. [Security Model](#security-model)
23. [Backend Architecture — Emission Layers](#backend-architecture--emission-layers)
    - [Transactional Emission Requirement](#transactional-emission-requirement)
24. [Frontend Architecture](#frontend-architecture)
25. [Module Integration Contract](#module-integration-contract)
26. [Action Key Naming](#action-key-naming)
27. [Deep Modules: Warehouse, Workshop, VMI](#deep-modules-warehouse-workshop-vmi)
    - [Critical Forensic Warning — Do Not Overwrite Historical State](#critical-forensic-warning--do-not-overwrite-historical-state)
    - [Forensic Modules Require Versioned State History](#forensic-modules-require-versioned-state-history)
    - [Mistakes Forensic Modules Must Avoid](#mistakes-forensic-modules-must-avoid)
28. [System Boundaries](#system-boundaries)
29. [Retention and Archival](#retention-and-archival)
30. [Implementation Phases](#implementation-phases)
31. [Enterprise-Grade Requirements Checklist](#enterprise-grade-requirements-checklist)
32. [Common Mistakes This Architecture Explicitly Avoids](#common-mistakes-this-architecture-explicitly-avoids)
33. [Fit Within Current Platform Architecture](#fit-within-current-platform-architecture)
34. [Implementation Guardrails](#implementation-guardrails)
35. [Summary](#summary)

---

## Purpose

This document defines the canonical architecture of the platform **Event System**, also referred to as the **Audit System**.

It is the source of truth for:

- Developers implementing features
- AI agents working on this codebase
- Future maintainers extending the system
- Architecture and security reviews

This system must work safely within the platform's existing architecture:

- SSR-first
- Security-first
- RLS-first
- Permission-driven
- Entitlement-aware
- Multi-tenant
- Organization-scoped
- Branch-aware where relevant

---

## Core Concept

There is **one canonical backend event system**.

There are **not** separate storage systems for:

- Activity logs
- Audit logs
- Security logs
- Per-module logs

Instead, there is one canonical **event stream**, and **different views** of it.

This means:

- One backend event store
- One event can be shown as personal activity, organization activity, admin activity, audit detail, or security detail — depending on the viewer and their permissions

**Short definition:**

| Term         | Meaning                                   |
| ------------ | ----------------------------------------- |
| **Event**    | Raw structured backend record             |
| **Activity** | Human-friendly presentation of that event |

---

## Activity vs Audit

Activity and audit are **not separate storage systems**.

They are **different projections of the same event**.

### Example

**Raw event:** `org.member.invited`

| View         | Presentation                                                                                             |
| ------------ | -------------------------------------------------------------------------------------------------------- |
| **Activity** | `Michał invited john@example.com to the organization`                                                    |
| **Audit**    | Full structured record with actor id, entity id, request id, ip address, user agent, metadata, timestamp |

The storage system stays the same. The presentation changes depending on:

- Viewer role
- Viewer permissions
- Event visibility rules
- Field sensitivity rules

---

## Goals

The event system must:

- Support all current modules
- Support future modules
- Support all event depth tiers
- Support different viewers seeing different detail levels
- Support human-readable activity timelines
- Support detailed audit investigation
- Support security-sensitive fields safely
- Remain generic and module-agnostic
- Fit current platform architecture without weakening security
- Be enterprise production-grade

---

## Non-Goals

The event system is **not**:

- A per-module custom logging table collection
- A client-owned system
- A free-form JSON dumping ground
- A replacement for version history where forensic reconstruction is needed
- A replacement for presence/realtime state
- A frontend filtering system

---

## Architectural Principles

### 1. Backend-owned

Events are created only by trusted backend layers. Never by client-side direct insert.

### 2. Canonical and generic

One event store for all modules.

### 3. Append-only

Events are inserted only. They must not be updated or deleted in normal operation.

### 4. Secure by default

Low-privilege users must never receive raw event rows. All event visibility and field visibility must be backend-controlled.

### 5. Module-agnostic

The top-level event structure stays stable across modules. Module-specific detail lives in validated metadata.

### 6. Projection-based visibility

The same raw event can be shown differently to different viewers.

### 7. Code-defined rules

Visibility, field sensitivity, metadata schemas, and projection rules must live in **backend code**, not in the database.

### 8. Extensible

New modules must plug into the event system through a defined integration contract.

---

## Event Depth Tiers

Not every module needs the same level of traceability. The event system supports three depth tiers.

### Baseline

Used for simple, common business actions.

**Examples:**

- Profile updated
- Comment created
- Invite created
- Item created
- Basic state changes

### Enhanced

Used for more sensitive or operational actions.

**Examples:**

- Role created
- Permission changed
- Invite accepted
- Member removed
- Branch created
- Approval transitions
- Org settings changed

### Forensic

Used for modules that need deep traceability.

**Examples:**

- Warehouse movement unlocked
- Warehouse movement approved
- Warehouse document printed
- Workshop repair order revision
- VMI stock correction
- Document correction chain

> **Important:** The canonical event system is universal. Forensic modules may also require version history, document history, snapshots, and change diffs. These are **complementary systems**, not replacements for the event system.

---

## Canonical Event Model

The database row stores **immutable facts only**.

The fields `summary`, `visibility`, and `sensitivity` do **not** exist in the database row. They are not stored.

- **`summary`** is generated dynamically at read time from backend templates. See [Summary Generation](#summary-generation).
- **`visibility`** (event visibility rule) is defined per `action_key` in the backend Event Registry. See [Event Registry](#event-registry).
- **`sensitivity`** (field sensitivity rule) is defined per `action_key` in the backend Event Registry. See [Event Registry](#event-registry).

Storing these in the database would couple the canonical fact record to presentation and policy logic, which must remain in code.

### TypeScript DB Row Type

```ts
interface PlatformEventRow {
  id: string;
  created_at: string;
  organization_id: string | null; // null for global/auth/platform events
  branch_id: string | null;
  actor_user_id: string | null;
  actor_type: "user" | "system" | "api" | "worker" | "scheduler" | "automation";
  module_slug: string;
  action_key: string;
  entity_type: string;
  entity_id: string; // text — not restricted to UUID
  target_type: string | null;
  target_id: string | null; // text — not restricted to UUID
  metadata: Record<string, unknown>;
  event_tier: "baseline" | "enhanced" | "forensic";
  request_id: string | null;
  ip_address: string | null;
  user_agent: string | null;
}
```

### Field Reference

| Field             | Description                                                                                                                                                                                                  |
| ----------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `organization_id` | Tenant boundary. **Nullable.** Org-scoped and branch-scoped events populate this. Auth, platform, or pre-org-resolution events may leave it null. See [Canonical Database Table](#canonical-database-table). |
| `branch_id`       | Optional secondary scope when the event belongs to a branch context.                                                                                                                                         |
| `actor_user_id`   | The user who initiated the event, if the actor is a human user. Null for system/worker actors.                                                                                                               |
| `actor_type`      | The category of actor that produced the event. Valid values: `user`, `system`, `api`, `worker`, `scheduler`, `automation`. See [Actor Model](#actor-model).                                                  |
| `module_slug`     | The module that owns the event. E.g. `auth`, `organization-management`, `warehouse`.                                                                                                                         |
| `action_key`      | Canonical machine-readable action identifier. E.g. `auth.login`, `org.member.invited`.                                                                                                                       |
| `entity_type`     | Primary affected object type. E.g. `user`, `invitation`, `role`, `stock_movement`.                                                                                                                           |
| `entity_id`       | Primary affected object identifier. **Stored as `text`** — not constrained to UUID. See note below.                                                                                                          |
| `target_type`     | Optional secondary affected object type.                                                                                                                                                                     |
| `target_id`       | Optional secondary affected object identifier. **Stored as `text`** — not constrained to UUID.                                                                                                               |
| `metadata`        | Structured module-specific detail. Validated by the event service before insert.                                                                                                                             |
| `event_tier`      | `baseline`, `enhanced`, or `forensic`.                                                                                                                                                                       |
| `request_id`      | Useful for correlating multiple events within one request or operation. See [Request Correlation](#request-correlation).                                                                                     |
| `ip_address`      | Security-sensitive. Typically not visible to ordinary users.                                                                                                                                                 |
| `user_agent`      | Security-sensitive. Typically not visible to ordinary users.                                                                                                                                                 |

> **Note on `entity_id` and `target_id` types:** These fields are stored as `text`, not `uuid`. This is intentional. See [Canonical Database Table](#canonical-database-table) for the full rationale.

> **Note on visibility and sensitivity:** Event visibility rules and field sensitivity rules are **not stored in the DB**. They are defined in the Event Registry (`src/server/audit/event-registry.ts`) and applied at read time by the projection layer.

### Event Ordering

Events are ordered by `created_at`. Within an organization, event timelines must be reconstructed using:

```sql
ORDER BY created_at ASC
```

`created_at` is the canonical ordering field for the event system. It represents the database-assigned server timestamp at the moment of insert. Because events are immutable and append-only, `created_at` is authoritative — no event record can be back-dated or reordered after insertion.

When displaying event timelines in the UI, always sort ascending by `created_at` unless the interface is explicitly an activity feed sorted newest-first (descending).

---

## Actor Model

The event system records **all sources of activity**, not only direct user actions. This is a deliberate enterprise design decision: systems that only capture human user actions produce incomplete audit trails and miss a large class of operationally significant events.

### The two actor fields

| Field           | Type            | Meaning                                                                                        |
| --------------- | --------------- | ---------------------------------------------------------------------------------------------- |
| `actor_user_id` | `uuid \| null`  | Populated only when the actor is a known human user. **Must be null for all non-user actors.** |
| `actor_type`    | `text not null` | The category of actor. Always populated — even when there is no associated user.               |

### Why `actor_user_id` is nullable

Many events are generated without a human initiating them. A background job that expires invitations has no `actor_user_id`. A scheduler that triggers a daily stock reconciliation has no `actor_user_id`. A webhook handler from an external integration has no `actor_user_id`. Requiring a user ID on every event would force fabricated or sentinel values, which would corrupt the audit trail.

The correct model: populate `actor_user_id` only when a real, identified human user is the direct initiator. Leave it null for everything else.

### Valid `actor_type` values

| Value        | Description                                                                                                                            |
| ------------ | -------------------------------------------------------------------------------------------------------------------------------------- |
| `user`       | A human user operating through the UI or API. `actor_user_id` must be populated.                                                       |
| `system`     | An internal system action with no external trigger — e.g. a platform integrity check, automated data correction.                       |
| `api`        | A request arriving through an API integration or external client. `actor_user_id` may or may not be present depending on auth context. |
| `worker`     | A backend background worker processing a queue job.                                                                                    |
| `scheduler`  | A scheduled task running on a timer or cron boundary — e.g. nightly reconciliation, expiry sweeps.                                     |
| `automation` | A workflow automation or rules engine acting on behalf of the organization — e.g. auto-approval rules, inventory threshold triggers.   |

### Why this matters

An audit system that only captures `user` actors will silently miss:

- Automated batch corrections that alter inventory
- Scheduled jobs that expire or promote records
- API integrations that create or modify data on behalf of external systems
- Internal system reconciliation that adjusts state

These events are often the **most important** events to capture from a compliance and forensic perspective — because they happen without a human in the loop and are otherwise invisible.

### Example: system-generated event

```ts
await eventService.emit({
  organizationId: context.orgId,
  branchId: null,
  actorUserId: null, // no human actor
  actorType: "scheduler", // automated nightly job
  actionKey: "warehouse.audit.scheduled_run",
  entityType: "audit_schedule",
  entityId: schedule.id,
  metadata: {
    triggered_by: "nightly_cron",
    branch_ids: affectedBranchIds,
  },
  eventTier: "baseline",
  requestId,
  ipAddress: null,
  userAgent: null,
});
```

### Example: API integration event

```ts
await eventService.emit({
  organizationId: context.orgId,
  branchId: context.branchId ?? null,
  actorUserId: null, // external API client, no user context
  actorType: "api",
  actionKey: "vmi.stock.replenishment_confirmed",
  entityType: "replenishment_order",
  entityId: order.reference, // external reference, not a UUID
  metadata: {
    supplier_id: order.supplierId,
    quantity: order.quantity,
    source: "shopify_webhook",
  },
  eventTier: "enhanced",
  requestId,
  ipAddress: context.ipAddress ?? null,
  userAgent: context.userAgent ?? null,
});
```

---

## Canonical Database Table

The `platform_events` table stores immutable event facts only. It contains no presentation fields, no visibility rules, and no sensitivity classifications. Those concerns live entirely in backend code.

```sql
create table platform_events (
  id               uuid        primary key default gen_random_uuid(),
  created_at       timestamptz not null default now(),

  organization_id  uuid        null,
  branch_id        uuid        null,

  actor_user_id    uuid        null,
  actor_type       text        not null,

  module_slug      text        not null,
  action_key       text        not null,

  entity_type      text        not null,
  entity_id        text        not null,

  target_type      text        null,
  target_id        text        null,

  metadata         jsonb       not null default '{}',

  event_tier       text        not null,

  request_id       uuid        null,
  ip_address       inet        null,
  user_agent       text        null
);
```

### Design constraints

**`organization_id` is nullable — architectural decision:**

The system is designed to be generic enough to store both org-scoped and non-org-scoped events. This means:

- **Org-scoped events** (most business events) must populate `organization_id`
- **Branch-scoped events** must also populate `organization_id` — branch context is always within an org
- **Auth, global, and platform-level events** (e.g. `auth.login`, `auth.password.reset_requested`) may leave `organization_id` null, because they occur before or outside of org resolution
- This design avoids forcing a fake or synthetic org assignment onto truly global events

Most business events on this platform will have a non-null `organization_id`. Null is reserved for events that genuinely precede or exist outside org context.

**`entity_id` and `target_id` are `text` — architectural decision:**

These fields are intentionally stored as `text`, not `uuid`. An enterprise-grade generic event system must not assume that all entity identifiers are UUIDs. Future event targets may include:

- External provider IDs (e.g. Shopify order IDs, Allegro listing IDs)
- Session identifiers
- Auth-related tokens or references
- Warehouse document numbers (e.g. `MM-00991`, `PZ-2026-0044`)
- Composite domain identifiers (e.g. `org_1:branch_2:product_99`)
- Non-UUID identifiers from integrated third-party systems

The `entity_type + entity_id` pair forms the stable identity of the affected object. The type provides the domain context; the id is an opaque string within that domain. Constraining it to UUID would break compatibility with any domain that does not use UUID primary keys.

**Other constraints:**

- **No `summary` column** — summaries are generated dynamically from templates at read time.
- **No `visibility` column** — event visibility rules are defined in the Event Registry in code.
- **No `sensitivity` column** — field sensitivity rules are defined in the Event Registry in code.
- **`metadata` is `NOT NULL`** — always at minimum an empty object `{}`. Never `null`.
- **`actor_user_id` is nullable** — system-initiated events have no user actor.
- **`branch_id` is nullable** — not every event is branch-scoped.
- **`target_type` / `target_id` are nullable** — only used when the action involves a secondary affected entity.
- **RLS must enforce append-only** — no client-side `UPDATE` or `DELETE` allowed on this table under any normal operation path. See [Recommended RLS Strategy](#recommended-rls-strategy).

---

## Final Stored Event Row

This section exists to remove all ambiguity about what is and is not stored in the database.

### Stored in DB (`platform_events` columns)

| Field             | Type          | Notes                                                                                                     |
| ----------------- | ------------- | --------------------------------------------------------------------------------------------------------- |
| `id`              | `uuid`        | Primary key, auto-generated                                                                               |
| `created_at`      | `timestamptz` | Immutable insert timestamp                                                                                |
| `organization_id` | `uuid`        | Nullable — see design constraints                                                                         |
| `branch_id`       | `uuid`        | Nullable                                                                                                  |
| `actor_user_id`   | `uuid`        | Nullable — null for all non-user actors (system, worker, scheduler, automation, api without user context) |
| `actor_type`      | `text`        | `user`, `system`, `api`, `worker`, `scheduler`, `automation` — see [Actor Model](#actor-model)            |
| `module_slug`     | `text`        | E.g. `auth`, `warehouse`                                                                                  |
| `action_key`      | `text`        | E.g. `org.member.invited`                                                                                 |
| `entity_type`     | `text`        | E.g. `invitation`, `stock_movement`                                                                       |
| `entity_id`       | `text`        | Text, not UUID — any domain identifier                                                                    |
| `target_type`     | `text`        | Nullable                                                                                                  |
| `target_id`       | `text`        | Nullable, text not UUID                                                                                   |
| `metadata`        | `jsonb`       | Validated structured detail                                                                               |
| `event_tier`      | `text`        | `baseline`, `enhanced`, `forensic`                                                                        |
| `request_id`      | `uuid`        | Nullable — correlation identifier                                                                         |
| `ip_address`      | `inet`        | Nullable — security-sensitive                                                                             |
| `user_agent`      | `text`        | Nullable — security-sensitive                                                                             |

### Not stored in DB

| Concept           | Where it lives                                                      |
| ----------------- | ------------------------------------------------------------------- |
| `summary`         | Generated at read time by projection layer using registry templates |
| `visibility`      | Defined per `action_key` in Event Registry code                     |
| `sensitivity`     | Defined per `action_key` in Event Registry code                     |
| Metadata schema   | Defined as Zod schema per `action_key` in Event Registry code       |
| Projection rules  | Defined per `action_key` in Event Registry code                     |
| Summary templates | Defined per `action_key` in Event Registry code                     |

---

## Required Indexes

The following indexes are required for production-scale performance. They must be created alongside the table migration.

```sql
-- Primary query pattern: activity timeline for an organization, ordered by time
create index idx_events_org_time
  on platform_events (organization_id, created_at desc);

-- Entity history queries: show all events for a specific record
create index idx_events_entity
  on platform_events (entity_type, entity_id);

-- Actor history: show all events by a specific user
create index idx_events_actor
  on platform_events (actor_user_id);

-- Action-type queries: filter events by action key (e.g. all login events)
create index idx_events_action
  on platform_events (action_key);

-- Request correlation: group events from the same request for debugging
create index idx_events_request
  on platform_events (request_id);
```

### Why these indexes are required

| Index                 | Purpose                                                                          |
| --------------------- | -------------------------------------------------------------------------------- |
| `idx_events_org_time` | Organization activity timeline queries. Without this, full table scans at scale. |
| `idx_events_entity`   | Efficient entity history lookup — e.g. all events for movement `MM-00991`.       |
| `idx_events_actor`    | My Activity view — all events performed by a given user.                         |
| `idx_events_action`   | Filter by event type — e.g. all `org.member.invited` events across the org.      |
| `idx_events_request`  | Debugging correlation — group related events from a single request or workflow.  |

> **Note:** Do not use `CREATE INDEX CONCURRENTLY` inside Supabase MCP migrations — it cannot run inside a transaction. Use regular `CREATE INDEX IF NOT EXISTS` instead.

---

## Recommended RLS Strategy

Row Level Security on `platform_events` is a critical part of the security model. The following rules must be implemented and must not be weakened.

### Core rules

**Inserts:**

- Regular authenticated app clients must **not** be able to insert event rows directly.
- All inserts must go through the trusted backend `event.service.ts`, which runs under `service_role` or a privileged server-side context.
- Client-initiated RLS paths must not include an `INSERT` policy for normal users.

**Updates:**

- No update policy should exist for normal users or regular app clients.
- The event store is append-only. Row mutations are not permitted under any normal operation.

**Deletes:**

- No delete policy should exist for normal users or regular app clients.
- Append-only integrity is non-negotiable. Deletes may only ever occur under explicit compliance-driven admin procedures, never as part of normal application logic.

**Reads:**

- Raw table reads should **not** be exposed to normal users directly.
- Most event reads must go through backend projection logic — the service layer applies visibility and field filtering before returning data.
- If any direct raw table reads are ever permitted (e.g. for a privileged internal admin tool), they must be tightly scoped by:
  - Authenticated role check (`auth.uid()` is a known admin or auditor)
  - Organization boundary enforcement (`organization_id = <viewer's org>`)
  - Never returning rows from other organizations

### Summary of required RLS posture

| Operation      | Regular user | Service role / backend                          |
| -------------- | ------------ | ----------------------------------------------- |
| `INSERT`       | ❌ Denied    | ✅ Allowed via `event.service.ts`               |
| `UPDATE`       | ❌ Denied    | ❌ Denied — append-only                         |
| `DELETE`       | ❌ Denied    | ❌ Denied — append-only                         |
| `SELECT` (raw) | ❌ Denied    | ✅ Allowed — projection applied before response |

### Why this matters

The append-only, backend-owned model is only enforced if RLS actively prevents clients from bypassing the service layer. Without these policies, a misconfigured or compromised client could:

- Insert fabricated events
- Delete inconvenient audit records
- Update event details to cover traces

These are not theoretical risks. They are the exact failure modes that enterprise audit systems are designed to prevent.

---

## Enforcing Append-Only Guarantees

Stating that the event store is "append-only" is not sufficient. The guarantee must be **actively enforced** at the database access layer. Without enforcement, any code path that inadvertently or maliciously calls `UPDATE` or `DELETE` on `platform_events` will silently corrupt the audit trail.

### What append-only means for `platform_events`

- Event rows are **immutable after insert**
- **No `UPDATE`** operation is permitted on any event row under any normal application path
- **No `DELETE`** operation is permitted on any event row under any normal application path
- **`INSERT`** is the only write operation allowed — and only through the privileged backend event service

This is not a coding convention. It is an operational contract enforced by the database.

### Why this must be enforced at the DB layer, not just in code

Application-level conventions are not sufficient for an audit system. Any of the following could bypass code-level conventions:

- A misconfigured admin script running a bulk correction
- A future developer unaware of the policy
- A compromised server action bypassing the event service
- An RPC function calling `UPDATE` on the wrong table by mistake
- Direct database access during an incident response

The database must refuse these operations regardless of which code path issues them. RLS policies that deny `UPDATE` and `DELETE` on `platform_events` for all roles except a privileged maintenance path are the correct mechanism.

### Conceptual enforcement model

```
platform_events permissions:

  INSERT  → allowed only via service_role / privileged backend path
  UPDATE  → denied for all roles (no UPDATE policy exists)
  DELETE  → denied for all roles (no DELETE policy exists)
  SELECT  → allowed only via backend projection layer (no raw client reads)
```

There is no legitimate application scenario where an existing event row should be mutated. If a mistake occurred, the correct response is to emit a **corrective event** — not to update or delete the original.

### Corrective events, not mutations

If an event was recorded incorrectly (e.g. wrong metadata, misattributed actor), the right approach is:

1. Leave the original event intact — it is a fact that the action was recorded at that time
2. Emit a new corrective event (e.g. `org.event.correction_noted`) with the corrected information in `metadata`
3. The projection layer can surface the correction to auditors as part of the event timeline

This preserves complete history, including the error and its correction, which is exactly what a forensic audit trail requires.

### Database-Level Enforcement

Append-only immutability must be enforced **at the database level**, not only in application logic. Application-level conventions, code reviews, and service layer patterns are important, but they are not a substitute for database-enforced constraints.

The database must actively prevent `UPDATE` and `DELETE` operations on `platform_events` by revoking those privileges at the permission level:

```sql
-- Revoke mutation rights from all roles on the event ledger
REVOKE UPDATE ON platform_events FROM PUBLIC;
REVOKE DELETE ON platform_events FROM PUBLIC;
```

When these privileges are revoked:

- Any `UPDATE` statement against `platform_events` — regardless of which code path issues it — will fail with a permission error at the database layer
- Any `DELETE` statement against `platform_events` — regardless of origin — will be refused
- The table behaves as an **immutable event ledger**: rows can be written once and never changed

The only permitted write operation is `INSERT`, and it must occur through the trusted backend event service running under an appropriately privileged role.

This means that even if a developer accidentally writes update logic against the wrong table, or a misconfigured script targets `platform_events`, or a future code path introduces a regression — the database will refuse the operation and the audit trail will remain intact.

**The `platform_events` table is not a normal application table. It is an immutable ledger. Its database permissions must reflect that.**

### Immutability is the audit guarantee

The value of an audit trail comes precisely from the fact that it cannot be altered after the fact. An audit log that can be edited is not an audit log — it is a mutable record that provides no forensic guarantee. Append-only enforcement is what makes `platform_events` trustworthy as an audit system.

---

## Summary Generation

Human-readable summaries are **not stored** in the database. They are **generated dynamically** at read time by the backend projection layer.

### How it works

Each `action_key` in the Event Registry defines a summary template. When the projection layer renders an event for a viewer, it uses the template together with the event's `metadata` and actor context to produce a human-readable string.

### Template example

```ts
// In the event registry entry for "org.member.invited":
summaryTemplate: (event) =>
  `${event.actorName} invited ${event.metadata.email}`,

// For the self/actor projection:
summaryTemplate: (event) =>
  `You invited ${event.metadata.email}`,
```

**Rendered outputs:**

| Viewer       | Generated summary                 |
| ------------ | --------------------------------- |
| Actor (self) | `You invited john@example.com`    |
| Manager      | `Michał invited john@example.com` |
| Auditor      | `Michał invited john@example.com` |

The projection layer selects the appropriate template variant based on the viewer's relationship to the event (self vs other).

### Why summaries are not stored

| Reason                               | Explanation                                                                                                                            |
| ------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------- |
| **Avoids stale text**                | Stored summaries become outdated if actor display names change or templates are improved.                                              |
| **Enables localization**             | Dynamic generation allows summaries to be rendered in the viewer's locale. Stored text would be locked to the language at insert time. |
| **Avoids data migrations**           | Updating summary templates does not require backfilling millions of existing rows.                                                     |
| **Keeps the canonical row minimal**  | The DB row stores only immutable facts. Derived presentation belongs in code.                                                          |
| **Consistent with projection model** | Summary is a projection output — it is produced alongside field projection, not before it.                                             |

---

## Metadata Strategy

The system must be generic, but metadata must not be uncontrolled.

### Rule

> Top-level event shape is **stable**. Module-specific detail goes into `metadata`.

### Examples

**Invite event metadata:**

```json
{
  "email": "john@example.com",
  "roles": ["branch_manager"],
  "branch_ids": ["br_1"]
}
```

**Warehouse movement unlock metadata:**

```json
{
  "document_number": "MM-00991",
  "reason": "Wrong product name",
  "version_before": 3
}
```

**Workshop repair order assignment metadata:**

```json
{
  "technician_id": "u_55",
  "repair_order_number": "RO-443",
  "vehicle_plate": "PO1234K"
}
```

### Required Consistency Rule

Metadata for each `action_key` **must be validated before insert**.

This means:

- Required metadata fields must be enforced
- Optional fields must be explicit
- Malformed metadata must be rejected
- Unknown field shapes must not silently pass if the action schema disallows them

### Enforcement Method: Centralized Event Service

All events **must** be emitted through the dedicated backend event service:

```
src/server/services/event.service.ts
```

**Module code must never insert events directly** into `platform_events`. No direct `supabase.from('platform_events').insert(...)` calls from module services, server actions, or API routes.

The event service is the single controlled path for all event writes. It is responsible for:

1. Loading the registry entry for the given `action_key`
2. Validating `metadata` against the Zod schema defined in that registry entry
3. **Rejecting the insert if metadata is invalid** — throwing a typed error back to the caller
4. Inserting the validated event row into `platform_events`

This guarantees metadata consistency across all modules. It also means the registry and its schemas are the single authority for what a valid event looks like.

```ts
// ✅ CORRECT — emit through event service
await eventService.emit({
  organizationId: context.orgId,        // string | null — null for global/auth events
  branchId: context.branchId ?? null,
  actorUserId: context.userId,
  actorType: 'user',
  actionKey: 'org.member.invited',
  entityType: 'invitation',
  entityId: invitation.id,              // string — any domain identifier, not just UUID
  metadata: {
    email: input.email,
    roles: input.roleIds,
    branch_ids: input.branchIds ?? [],
  },
  eventTier: 'enhanced',
  requestId: context.requestId ?? null,
  ipAddress: context.ipAddress ?? null,
  userAgent: context.userAgent ?? null,
});

// ❌ WRONG — never do this from module code
await supabase.from('platform_events').insert({ ... });
```

The database stores validated results. The database must not be responsible for full JSON schema enforcement per action — that responsibility belongs to the event service and the registry schemas.

### Event Metadata Versioning

Metadata schemas will evolve over time as modules grow, new fields become required, and business rules change. The event system must accommodate this evolution without breaking the ability to read, project, or interpret historical events.

**The problem without versioning:**

If the metadata schema for `auth.login` is updated to require a new field, all historical events stored under the old schema will fail validation or produce incorrect projections when read through the new schema. This is the metadata equivalent of a database migration with no backwards compatibility.

**The solution: versioned schemas in the registry**

The registry should support versioned schemas per `action_key`. There are two valid approaches:

**Option A — Versioned action keys:**

```ts
// Registry entries per version
"auth.login.v1": {
  metadataSchema: z.object({ method: z.string().optional() }),
  summaryTemplate: () => "You logged in",
  // ...
},
"auth.login.v2": {
  metadataSchema: z.object({ method: z.string(), mfa_used: z.boolean() }),
  summaryTemplate: () => "You logged in",
  // ...
},
```

New events are emitted under `auth.login.v2`. Historical events stored as `auth.login.v1` continue to be read and projected through their original schema.

**Option B — Schema version field in the registry entry:**

```ts
"auth.login": {
  schemaVersions: {
    1: z.object({ method: z.string().optional() }),
    2: z.object({ method: z.string(), mfa_used: z.boolean() }),
  },
  currentVersion: 2,
  summaryTemplate: () => "You logged in",
  // ...
},
```

The event service emits new events with `metadata_version: 2`. The projection layer selects the correct schema version when reading historical rows.

**Which approach to use:**

Both options are valid. Option A is simpler to implement and reason about. Option B keeps action keys stable and may be preferable for systems with many versions or strict action key governance. The choice should be made consistently across the registry.

**Key invariant regardless of approach:**

Historical events must always be readable under the schema version active at the time they were written. The projection layer must never apply a newer schema to an event recorded under an older one. Breaking this invariant causes silent metadata misinterpretation on older events.

---

## Event Registry

The system requires a backend **event registry**.

This registry must live in **backend code**, not in the database.

**Canonical location:** `src/server/audit/event-registry.ts`

### Why the Registry Lives in Backend Code

Security rules must not be:

- User-editable
- Admin-UI editable
- Database-configured in a way that risks accidental exposure

Storing security-sensitive visibility rules in backend code ensures:

- Version control
- Code review
- Safe deployment process
- Lower risk of accidental exposure

### Registry Entry Shape

The registry defines, per action:

- `action_key`
- `module_slug`
- `event_tier`
- `default_visibility` — which viewer scope may see this event at all
- `fieldSensitivity` — which fields of a visible event may be shown to which viewer scope
- `metadataSchema` — Zod schema used by the event service to validate metadata before insert
- `summaryTemplate` — function that generates the human-readable summary at projection time

### Example Registry Entry

```ts
// src/server/audit/event-registry.ts

import { z } from "zod";

export const EventRegistry = {
  "auth.login": {
    moduleSlug: "auth",
    eventTier: "baseline",
    visibility: "self",
    metadataSchema: z.object({
      method: z.string().optional(),
    }),
    summaryTemplate: () => "You logged in",
    fieldSensitivity: {
      ip_address: "security_sensitive",
      user_agent: "security_sensitive",
    },
  },

  "org.member.invited": {
    moduleSlug: "organization-management",
    eventTier: "enhanced",
    visibility: "managers",
    metadataSchema: z.object({
      email: z.string().email(),
      roles: z.array(z.string()),
      branch_ids: z.array(z.string()).optional(),
    }),
    summaryTemplate: (event, viewer) =>
      viewer === "self"
        ? `You invited ${event.metadata.email}`
        : `${event.actorName} invited ${event.metadata.email}`,
    fieldSensitivity: {
      metadata: "internal",
      ip_address: "security_sensitive",
    },
  },
} as const;
```

> **Important:** This is a conceptual example. The exact code structure can vary, but the architecture must preserve: backend-only registry, code-defined rules, no client influence, no database-stored visibility or sensitivity policy.

---

## User Visibility vs Field Visibility

These are **separate concerns**.

| Concern              | Question                                                 |
| -------------------- | -------------------------------------------------------- |
| **Event visibility** | Is this viewer allowed to see this event at all?         |
| **Field visibility** | Which fields within a visible event may this viewer see? |

### This distinction is mandatory.

A viewer may be allowed to know that an invite was created, but **not** allowed to know the inviter's IP or internal security notes.

### Viewer Scopes

| Scope            | Description                           |
| ---------------- | ------------------------------------- |
| `self`           | The user who performed the action     |
| `org_member`     | Any member of the organization        |
| `org_manager`    | Managers within the organization      |
| `org_owner`      | Organization owners                   |
| `auditor`        | Designated audit role                 |
| `platform_admin` | Super-admins across all organizations |

> Not every system needs every role immediately, but the model must support them.

### Event Visibility Tiers

| Tier       | Description                        |
| ---------- | ---------------------------------- |
| `self`     | Only the actor can see this event  |
| `org`      | All org members can see this event |
| `managers` | Managers and above                 |
| `owners`   | Owners and above                   |
| `auditors` | Auditors and platform admins only  |

### Field Sensitivity Tiers

| Tier                 | Description                                    |
| -------------------- | ---------------------------------------------- |
| `safe`               | Visible to all authorized viewers of the event |
| `internal`           | Visible to managers and above                  |
| `restricted`         | Visible to owners and auditors only            |
| `security_sensitive` | Visible to auditors and platform admins only   |

**Examples:**

- Generated `summary` text → `safe` (produced by template, visible to all authorized viewers)
- `branch_ids` within metadata → `internal`
- `ip_address` → `security_sensitive`
- Raw diff payload → `restricted`

---

## Projection Model

The system stores **one full canonical event**, then applies **backend projection** before returning it to any viewer.

This is the core safety pattern.

### Correct Flow

```
1. Select candidate events from DB
2. Filter events by event visibility (look up action_key in registry, check viewer scope)
3. Generate summary using registry summaryTemplate + metadata + actor context
4. Project fields by viewer permission and field sensitivity (strip fields above viewer clearance)
5. Return projected result to client
```

### Never Do This

```
❌ Return raw event rows to the client and let frontend hide fields
❌ Trust frontend to enforce sensitive field visibility
❌ Rely on client-side filtering for security
❌ Store summary, visibility, or sensitivity in the DB row
```

### Example: One Event Seen by Different Viewers

**Raw canonical event (as stored in DB — immutable facts only):**

```json
{
  "id": "evt_abc123",
  "created_at": "2026-03-12T10:00:00Z",
  "actor_user_id": "u_1",
  "organization_id": "org_1",
  "module_slug": "organization-management",
  "action_key": "org.member.invited",
  "entity_type": "invitation",
  "entity_id": "inv_91",
  "metadata": {
    "email": "john@example.com",
    "roles": ["branch_manager"],
    "branch_ids": ["br_2"],
    "internal_note": "High-priority external contractor"
  },
  "event_tier": "enhanced",
  "ip_address": "185.10.10.10",
  "user_agent": "Chrome Mac",
  "request_id": "req_xyz"
}
```

> Note: no `summary`, `visibility`, or `sensitivity` fields in the stored row. These are resolved at read time from the Event Registry. `entity_id` is a plain text identifier — not constrained to UUID format.

**Personal activity projection (actor only):**

```json
{
  "summary": "You invited john@example.com",
  "created_at": "2026-03-12T10:00:00Z"
}
```

**Manager projection:**

```json
{
  "summary": "Michał invited john@example.com",
  "created_at": "2026-03-12T10:00:00Z",
  "roles": ["branch_manager"]
}
```

**Org owner projection:**

```json
{
  "summary": "Michał invited john@example.com",
  "created_at": "2026-03-12T10:00:00Z",
  "roles": ["branch_manager"],
  "branch_ids": ["br_2"]
}
```

**Auditor projection (full detail):**

```json
{
  "summary": "Michał invited john@example.com",
  "created_at": "2026-03-12T10:00:00Z",
  "roles": ["branch_manager"],
  "branch_ids": ["br_2"],
  "ip_address": "185.10.10.10",
  "user_agent": "Chrome Mac",
  "internal_note": "High-priority external contractor"
}
```

The `summary` in all projections is **generated by the projection layer** using the registry template — it is never read from a stored DB column.

---

## Personal Activity vs Organization Activity vs Audit Detail

All three are backed by the **same canonical event store**. They are different projections.

### Personal Activity

**Used for:** Self history, low-noise user timeline.

**Shows:**

- The viewer's own relevant events
- Only safe/user-facing fields
- Not all internal technical events

**Examples of events typically shown:**

- Login, comment created, profile updated, invite accepted, item created

**Examples of events typically hidden:**

- Technical lock/unlock internals
- Sensitive security fields
- Low-level operational details not meant for the user-facing timeline

### Organization Activity

**Used for:** Team/org operational visibility, manager/owner timeline.

**Shows:**

- Broader org events
- Selected actors
- Selected operational actions
- Not necessarily all security-sensitive fields

### Audit Detail

**Used for:** Admins, owners, auditors, incident review, compliance review.

**Shows:**

- More fields
- More technical context
- Security-sensitive data where allowed
- Deeper event detail

---

## Request Correlation

Request correlation is one of the features that separates basic application logging from serious enterprise-grade audit systems.

### What it is

When a single user operation or workflow generates multiple related events, all of those events share the same `request_id`. This shared identifier allows investigators, developers, and auditors to reconstruct exactly what happened during a single workflow — across multiple event records.

### Why it matters

Without request correlation, an audit trail is a flat, disconnected list of individual events. With request correlation, it becomes a queryable workflow history. This is critical for:

- **Debugging** — understand the full chain of what happened in a failed or unexpected operation
- **Incident review** — reconstruct the sequence of actions taken during a security incident
- **Compliance** — demonstrate that a complete, ordered chain of events occurred as required
- **Operational traceability** — trace exactly what steps an automated workflow completed

### Example: onboarding workflow

```
request_id = req_abc123

Events emitted:
  1. org.created          — entity: org_1
  2. branch.created       — entity: branch_1
  3. member.added         — entity: user_1
  4. role.assigned        — entity: user_1, target: org_1
  5. entitlements.initialized — entity: org_1
```

An auditor querying by `request_id = req_abc123` retrieves all five events in sequence, giving a complete picture of the onboarding flow.

### Example: warehouse document approval flow

```
request_id = req_def456

Events emitted:
  1. warehouse.movement.approved     — entity: movement_MM-00991
  2. warehouse.stock.adjusted        — entity: location_A1
  3. warehouse.document.generated    — entity: document_WZ-0201
  4. warehouse.movement.completed    — entity: movement_MM-00991
```

### Generation rule

`request_id` must be generated **exactly once per workflow boundary** and then propagated to every event emission triggered by that operation.

**Valid workflow boundaries include:**

| Boundary                     | Description                                       |
| ---------------------------- | ------------------------------------------------- |
| One HTTP request             | A single API call or page request                 |
| One server action execution  | A Next.js server action from start to finish      |
| One RPC workflow             | A Supabase RPC call that may emit multiple events |
| One background job execution | A single queue job or worker task run             |

The identifier must be generated at the entry point of the workflow — before any work begins — and then passed down through the call chain to every `eventService.emit()` call that occurs within it.

```ts
// ✅ CORRECT — generate once at the workflow entry point
const requestId = crypto.randomUUID();

// Pass the same requestId to every emission in the workflow
await someService.doSomething({ ..., requestId });    // internally calls eventService.emit
await anotherService.doSomethingElse({ ..., requestId }); // same requestId

// ❌ WRONG — generating a new id at each emission breaks correlation
await eventService.emit({ ..., requestId: crypto.randomUUID() }); // disconnected
await eventService.emit({ ..., requestId: crypto.randomUUID() }); // disconnected
```

### Risk: fragmented correlation from independent ID generation

If each subsystem or emission point generates its own `request_id` independently, the events produced by one workflow become unfindable as a group. An auditor or engineer investigating `MM-00991` would find four events from the approval flow — each with a different `request_id` — and have no way to confirm they belong to the same operation or to query them together.

This fragmentation removes the primary value of request correlation. It is the difference between a searchable workflow history and a flat list of unrelated events.

The rule is simple: **one workflow entry, one `request_id`, passed everywhere**.

### How it is captured

The `request_id` is generated at the start of a request or workflow and passed into the event service on every `emit()` call within that operation.

```ts
// Generated once per request / workflow entry point
const requestId = crypto.randomUUID();

// Passed to every event emitted within the same operation
await eventService.emit({ ..., requestId });
await eventService.emit({ ..., requestId });
```

### Query pattern

```sql
select * from platform_events
where request_id = 'req_abc123'
order by created_at asc;
```

This returns all events emitted during one operation, in chronological order.

> **Note:** `request_id` is security-sensitive context, not a user-facing field. It should be available to auditors and platform admins, but not to ordinary users or managers.

---

## Security Model

This system must be safe at enterprise production-grade level.

### 1. Backend-only event creation

Events must be created only by trusted backend code:

- Server actions
- Backend service layer
- API routes
- RPC orchestration points
- Trigger-driven technical history where appropriate

**Never** allow client-side direct insert into event tables.

### 2. Append-only

The canonical event store must be append-only. No normal update or delete paths. This protects history integrity.

### 3. Strong access control

Low-privilege users must not query raw canonical events directly. Most reads should go through backend projection logic.

### 4. Event filtering on backend

The backend decides whether a viewer may see an event. This is resolved by looking up the `action_key` in the Event Registry and comparing the event's defined visibility tier against the viewer's resolved scope.

### 5. Field filtering on backend

The backend decides which fields of a visible event may be seen. This is resolved by the projection layer using per-field sensitivity rules from the Event Registry.

### 6. Registry stored in backend code

Visibility and field rules must not live in DB configuration. They live in `src/server/audit/event-registry.ts`.

### 7. SSR-safe

Because the app is SSR-first, event reads should fit backend-first rendering and server-validated context loading.

### 8. Multi-tenant safe

Event visibility must respect:

- Organization boundaries
- Branch boundaries where relevant
- Viewer role
- Viewer permissions

### 9. Sensitive security context

Fields like `ip_address`, `user_agent`, and request correlation context must be treated as sensitive and only shown to high-privilege viewers.

### 10. No frontend trust

Frontend should **never** decide what sensitive event fields to hide.

---

## Backend Architecture — Emission Layers

Events should be emitted from multiple trusted backend layers depending on event type. All emission paths must go through `event.service.ts` — they must not write to `platform_events` directly.

### A. Service / Server Action / API Layer

**Best for:** Business events.

**Examples:**

- Role created, invite created, org profile updated, warehouse movement approved, comment created, repair order assigned

**Reason:** The service layer knows business intent, not just row changes.

### B. RPC Orchestration Layer

**Best for:** Complex multi-step workflows.

**Examples:**

- Onboarding org creation, invitation acceptance, deep workflow approvals, correction flows, document generation flows

**Reason:** The RPC sees the full trusted workflow and can emit correct business events.

### C. Trigger Layer

**Best for:** Guaranteed technical history where certain changes must never be missed if a row changes.

**Examples:**

- Version snapshot creation, structural revision history, immutable low-level reconstruction trails

> **Important:** Do not force all business activity logging into triggers. Triggers are not the universal answer.

### Recommended Rule

| Event type                   | Emission layer             |
| ---------------------------- | -------------------------- |
| Business event logging       | Service layer or RPC layer |
| Guaranteed technical history | Trigger layer              |

---

### Architectural Invariant — Central Event Emission

**This is a strict invariant. It must not be violated.**

All platform events **must** be emitted through the backend event service (`src/server/services/event.service.ts`). No module, service, server action, RPC, or worker may write directly to the `platform_events` table.

Direct inserts into `platform_events` bypass every guarantee the event system provides:

| Bypassed guarantee         | Why it matters                                                               |
| -------------------------- | ---------------------------------------------------------------------------- |
| Metadata schema validation | Invalid or malformed metadata enters the event store silently                |
| Registry enforcement       | Events can be inserted for unregistered or unknown `action_key` values       |
| Request correlation        | `request_id` may be missing or incorrect — workflow chains become unfindable |
| Actor attribution          | `actor_type` and `actor_user_id` may be set inconsistently or fabricated     |
| Event tier validation      | `event_tier` may be set arbitrarily, bypassing depth classification          |
| Projection rules           | Events without registry entries cannot be projected correctly at read time   |

Violating this invariant does not cause an immediate runtime error in most cases — it silently degrades the integrity and trustworthiness of the entire audit trail.

```ts
// ❌ WRONG — direct insert, bypasses all guarantees
await supabase.from("platform_events").insert({
  action_key: "org.member.invited",
  actor_user_id: userId,
  metadata: { email },
  // ... missing validation, missing request_id, wrong tier, etc.
});

// ✅ CORRECT — central emission path, all guarantees enforced
await eventService.emit({
  actionKey: "org.member.invited",
  actorUserId: userId,
  actorType: "user",
  organizationId: orgId,
  entityType: "invitation",
  entityId: invitation.id,
  metadata: { email, roles, branch_ids },
  eventTier: "enhanced",
  requestId,
  ipAddress,
  userAgent,
});
```

This invariant applies to all emission sources: service layer, server actions, RPC functions, background workers, scheduled tasks, and automation handlers. **No exceptions.**

### Transactional Emission Requirement

Event emission **must** occur inside the same database transaction as the domain state change it records.

**Required transaction boundary:**

```sql
BEGIN;

  -- 1. Apply domain state change
  UPDATE warehouse_movements SET status = 'approved', approved_by = $actor WHERE id = $id;

  -- 2. Capture version snapshot
  INSERT INTO warehouse_movement_versions (movement_id, version, captured_by, snapshot)
  VALUES ($id, $next_version, $actor, $snapshot_json);

  -- 3. Emit event (via event service — insert into platform_events)
  INSERT INTO platform_events (action_key, actor_user_id, entity_id, metadata, ...)
  VALUES ('warehouse.movement.approved', $actor, $id, $metadata, ...);

COMMIT;
```

**Why this matters:**

If event emission happens outside the transaction boundary, a failure at any point can produce two classes of broken state:

| Failure scenario                                   | Result                                                       |
| -------------------------------------------------- | ------------------------------------------------------------ |
| State change succeeds, event emit fails            | Business record is updated — audit trail has no record of it |
| Event emitted, state change transaction rolls back | Audit trail records an action that never happened            |

Both scenarios break forensic traceability. Neither is acceptable in a platform that makes forensic integrity guarantees.

**The rule:**

> Event emission **must be atomic with the state change**. In practice this means the `platform_events` insert must execute inside the same transaction that modifies the domain record and writes the version snapshot.

In the service layer this is achieved by passing a transaction-scoped Supabase client to `eventService.emit()` — the same client that performed the domain write — so all inserts share a single transaction boundary.

---

## Frontend Architecture

The frontend must consume **only projected event views**.

It must never:

- Decide event visibility itself
- Decide field sensitivity itself
- Receive raw canonical events unless the viewer is truly authorized for raw detail

### Expected Frontend Views

1. **My Activity** — Personal timeline of the authenticated user's own events
2. **Organization Activity** — Org-scoped operational timeline for managers/owners
3. **Admin / Audit View** — Full event detail for auditors and admins

### Correct Flow

```
1. Frontend requests a view
2. Backend resolves current user context
3. Backend applies event visibility rules (from registry)
4. Backend generates summaries (from registry templates)
5. Backend applies field projection rules (from registry field sensitivity)
6. Frontend receives already-safe, already-projected result
```

---

## Module Integration Contract

Every module must integrate into the event system in a consistent way.

For each new module, define:

- Module slug
- Event/action keys
- Event tier for each action
- Visibility rule for each action
- Metadata schema for each action (Zod)
- Summary template for each action
- Projection rules / field sensitivity for each action
- Which events are baseline
- Which events are enhanced
- Which events are forensic

This must become part of module development standards.

### Module Onboarding Checklist

When creating a new module, complete the following for the event system:

- [ ] Define `module_slug`
- [ ] Define auditable entity types
- [ ] Define action keys
- [ ] Define metadata schema per action (Zod)
- [ ] Define event tier per action
- [ ] Define event visibility per action
- [ ] Define summary template per action
- [ ] Define field sensitivity per action
- [ ] Add all registry entries to `src/server/audit/event-registry.ts`
- [ ] Define whether module also needs complementary version/document history

---

## Action Key Naming

Use a stable hierarchical naming convention.

**Pattern:** `<module>.<entity>.<action>`

### Established Examples

| Action Key                       | Module                  | Meaning                  |
| -------------------------------- | ----------------------- | ------------------------ |
| `auth.login`                     | auth                    | User logged in           |
| `auth.login.failed`              | auth                    | Login attempt failed     |
| `auth.password.reset_requested`  | auth                    | Password reset requested |
| `auth.password.reset_completed`  | auth                    | Password reset completed |
| `auth.email.verified`            | auth                    | Email address verified   |
| `auth.invite.accepted`           | auth                    | Invitation accepted      |
| `org.member.invited`             | organization-management | Member invited to org    |
| `org.member.removed`             | organization-management | Member removed from org  |
| `org.role.created`               | organization-management | Role created             |
| `org.role.updated`               | organization-management | Role updated             |
| `org.role.deleted`               | organization-management | Role deleted             |
| `org.profile.updated`            | organization-management | Org profile updated      |
| `org.branch.created`             | organization-management | Branch created           |
| `org.branch.updated`             | organization-management | Branch updated           |
| `org.branch.deleted`             | organization-management | Branch deleted           |
| `warehouse.movement.created`     | warehouse               | Movement created         |
| `warehouse.movement.approved`    | warehouse               | Movement approved        |
| `warehouse.movement.unlocked`    | warehouse               | Movement unlocked        |
| `warehouse.document.generated`   | warehouse               | Document generated       |
| `workshop.repair_order.assigned` | workshop                | Repair order assigned    |
| `vmi.stock.threshold_breached`   | vmi                     | Stock threshold breached |

**This naming convention must remain consistent.**

---

## Deep Modules: Warehouse, Workshop, VMI

Some modules require more than activity/audit projections.

### Warehouse

Warehouse often needs:

- Event timeline
- Movement version history
- Document history
- Unlock/lock history
- Print/export history
- Correction chain
- Snapshot preservation

The event system is the global event layer, but warehouse may also require:

- Movement version tables
- Document snapshot tables
- Line-item history
- Forensic diffs

### Workshop

Workshop may require:

- Repair order timeline
- Assignment history
- Status transition history
- Invoice/document generation history
- Revision tracking for contractual records

### VMI

VMI may require:

- Stock sync event history
- Threshold breach history
- Replenishment confirmation history
- Supplier/client traceability
- Correction and reconciliation history

> **Important:** These deep systems **complement** the event system. They do not replace it.

---

### Critical Forensic Warning — Do Not Overwrite Historical State

The event timeline alone **cannot prove** what the exact business state was at a prior point in time when the underlying business records are mutable rows that get overwritten.

**Example — Warehouse movement:**

Imagine a warehouse movement document is created, then later its quantity is edited, then later approved, then later reversed. The event system correctly records all four actions with timestamps and actors. But if the `warehouse_movements` row is an ordinary mutable row, then querying it today returns only the **current state** — not the state at the moment of approval, not the state at the moment of reversal.

If an auditor asks: _"What exact quantity was approved on 14 March?"_ — the event system can confirm approval happened and who approved it. But it **cannot reconstruct the quantity at that moment** unless the state was also frozen at that point.

This is not a defect in the event system. The event system is an **activity ledger**, not a **state snapshot store**. For forensic modules where the historical accuracy of business state matters (legal, financial, compliance, audit), the module must independently preserve historical state.

**The invariant:**

> For every forensic event, the business record version referenced by that event must be immutably preserved at the moment the event is emitted — not merely the fact that the event occurred.

---

### Forensic Modules Require Versioned State History

`platform_events` answers **what happened, who did it, and when**. It does not answer **what exactly changed** or **what state the record was in at version N**.

For forensic modules, a complementary version history layer is required alongside the event system:

| Question                                        | Answered by                                              |
| ----------------------------------------------- | -------------------------------------------------------- |
| "Who approved movement #4821?"                  | Event system (`warehouse.movement.approved`)             |
| "When was movement #4821 approved?"             | Event system (`created_at`)                              |
| "What was the exact quantity at approval time?" | Movement version history (`warehouse_movement_versions`) |
| "What did the printed document look like?"      | Document snapshot table (`warehouse_document_snapshots`) |
| "What was the state before the correction?"     | Version history diff (before/after columns)              |

**Conceptual schema for warehouse forensics:**

```sql
-- Append-only version log per movement
create table warehouse_movement_versions (
  id            uuid primary key default gen_random_uuid(),
  movement_id   uuid not null references warehouse_movements(id),
  version       integer not null,
  captured_at   timestamptz not null default now(),
  captured_by   uuid null,                    -- actor_user_id
  snapshot      jsonb not null,               -- full movement row at this version
  change_reason text null
);

-- Immutable generated document records
create table warehouse_document_snapshots (
  id          uuid primary key default gen_random_uuid(),
  movement_id uuid not null references warehouse_movements(id),
  doc_type    text not null,                  -- 'PZ', 'WZ', 'MM', etc.
  version     integer not null,
  generated_at timestamptz not null default now(),
  generated_by uuid null,
  content     jsonb not null,                 -- full document content at generation time
  file_path   text null                       -- storage path if PDF was rendered
);
```

The event record and the version record are emitted **together**, in the same server action, inside the same logical transaction where possible. An event without a corresponding version snapshot is a forensic gap.

**Responsibility split — a precise statement:**

The event system records **actions performed by actors**. It does not store the full historical state of business entities. Reconstruction of prior entity state must rely on dedicated version history tables (such as `warehouse_movement_versions` or `warehouse_document_snapshots`).

- **Events provide**: who did what and when
- **Version history provides**: what the data looked like at the moment it was done

Both systems must work together to deliver full forensic traceability. Neither alone is sufficient for a forensic module.

---

### Mistakes Forensic Modules Must Avoid

The following are **architectural mistakes** that must not occur in forensic modules (warehouse, workshop, VMI, financial records):

- ❌ **Recording events but not preserving historical record versions** — the event confirms something happened, but the underlying row is later mutated and the historical state is unrecoverable.
- ❌ **Overwriting mutable business records instead of versioning them** — `UPDATE warehouse_movements SET quantity = 50 WHERE id = '...'` destroys prior state. Use append-only version tables or soft versioning instead.
- ❌ **Generating documents from current record state instead of pinned version** — a document printed today from a movement that was edited last week will not match what was printed last week. Documents must be generated from the version snapshot that existed at generation time.
- ❌ **Emitting events outside transaction scope** — if the version snapshot write fails but the event is already emitted (or vice versa), the forensic chain is broken. Emit and persist atomically.
- ❌ **Treating the event system as the sole forensic source** — the event system is an activity ledger. It is necessary but not sufficient for full forensic traceability in deep modules.

---

## System Boundaries

### Event System vs Version History vs Document History

These are different systems with different responsibilities.

| System               | Answers                                                                                                                 |
| -------------------- | ----------------------------------------------------------------------------------------------------------------------- |
| **Event system**     | What happened, who did it, when it happened                                                                             |
| **Version history**  | What changed exactly — before vs after, structural revision chain                                                       |
| **Document history** | What official/generated document existed, which version was printed/exported, which correction/replacement chain exists |

For baseline modules, the event system may be enough.
For forensic modules, the event system plus version/document history may be required.

### Event System vs Presence / Realtime State

Presence is **not** the primary responsibility of the event system.

Do **not** use the canonical event system for high-frequency transient state like:

- Online / away / offline indicators
- Typing indicators
- Active heartbeat

Presence is runtime state, not durable traceability.

| Concern              | System                                                          |
| -------------------- | --------------------------------------------------------------- |
| Durable traceability | Event system                                                    |
| Realtime UX state    | Dedicated presence service (Redis, ephemeral session heartbeat) |

---

## Retention and Archival

Append-only event systems grow continuously. This must be planned for intentionally — not treated as an afterthought.

### First implementation

The initial implementation may start with a single canonical `platform_events` table. This is appropriate for early scale and simplifies the first delivery.

### What must be designed intentionally later

As the platform grows, the following decisions must be addressed:

**Retention policy:**

- How long are events retained in the primary (hot) table?
- Do different event tiers (baseline, enhanced, forensic) have different retention windows?
- Are there regulatory or compliance requirements that mandate minimum retention periods?

**Archival strategy:**

- Events older than the hot retention window should move to cold storage or an archive table
- Archived events must remain queryable for compliance and investigation, even if more slowly
- The archival process must be non-destructive — archival is not deletion

**Table partitioning:**

- At significant scale, `platform_events` may benefit from range partitioning by `created_at`
- Partitioning allows efficient pruning of old partitions without full-table operations
- This should be designed when row counts approach a volume that impacts query performance

**Export support:**

- Compliance and legal investigations may require bulk event export for a given org, time range, or actor
- Export must be a privileged, audited operation — not available to ordinary users
- Export formats should be structured (JSON, CSV) and include all fields the auditor is authorized to see

### Key constraint

Append-only means **archival, not deletion**. Events must not be deleted as part of retention policy. They may be moved to colder storage, but the record must be preserved. Deleting audit records is a compliance and legal risk.

---

## Implementation Phases

### Phase 1 — Core Foundation

Create the canonical event infrastructure:

- [ ] `platform_events` table migration (`entity_id text`, `target_id text`, `organization_id uuid null` — per design constraints)
- [ ] Required performance indexes
- [ ] RLS policies — append-only, no client writes, backend-only inserts
- [ ] Event registry (`src/server/audit/event-registry.ts`) with Zod schemas and summary templates
- [ ] Event types (`src/server/audit/types.ts`)
- [ ] Backend event service (`src/server/services/event.service.ts`) — validates metadata, inserts rows
- [ ] Projection model (`src/server/audit/projection.ts`) — filters by visibility, generates summaries, strips sensitive fields

### Phase 2 — Platform Event Integration

Integrate high-value current platform events:

- [ ] Auth events (login, login failed, password reset, email verified)
- [ ] Onboarding events (org created, first branch created)
- [ ] Invitation events (created, accepted, cancelled)
- [ ] Role and permission events (created, updated, deleted)
- [ ] Organization and account update events
- [ ] Membership change events

### Phase 3 — Frontend Views

Build frontend views:

- [ ] My Activity page
- [ ] Organization Activity page
- [ ] Admin / Audit View page

### Phase 4 — Module Integration

Integrate more modules:

- [ ] Tools module events
- [ ] Support module events
- [ ] Future org/team feature events

### Phase 5 — Forensic Modules

Integrate forensic-grade modules with complementary deep history:

- [ ] Warehouse (movements, documents, corrections)
- [ ] Workshop (repair orders, revisions)
- [ ] VMI (stock sync, thresholds, reconciliation)

---

## Enterprise-Grade Requirements Checklist

Before considering the implementation complete, verify all of the following:

- [ ] Backend-owned event creation — no client direct writes
- [ ] All event writes go through `event.service.ts` — no direct table inserts from module code
- [ ] Append-only canonical event store — RLS actively blocks UPDATE and DELETE for all normal paths, not just by convention
- [ ] Corrective events pattern documented and followed — no mutations, only new correction events
- [ ] `actor_type` populated on every event — non-user actors use `system`, `worker`, `scheduler`, or `automation`
- [ ] `actor_user_id` is null for all non-user actors — no fabricated user IDs on system events
- [ ] `platform_events` table uses `entity_id text` and `target_id text` — not UUID
- [ ] `platform_events` table uses `organization_id uuid null` — not NOT NULL
- [ ] `platform_events` table contains no `summary`, `visibility`, or `sensitivity` columns
- [ ] Metadata validated before insert (Zod schemas per action in event registry)
- [ ] Summaries generated dynamically at read time — never stored
- [ ] Code-defined event registry (not database-stored rules)
- [ ] Code-defined projection rules (not database-stored)
- [ ] Backend event filtering (viewer cannot see events above their scope)
- [ ] Backend field filtering (viewer cannot receive fields above their sensitivity clearance)
- [ ] Organization-safe visibility (no cross-tenant leakage)
- [ ] Branch-safe visibility where relevant
- [ ] No frontend trust for security filtering
- [ ] Required performance indexes in place
- [ ] Request correlation via `request_id` supported and tested
- [ ] `request_id` generated once per workflow boundary — not per emission
- [ ] Retention and archival strategy documented (even if deferred)
- [ ] Generic across all modules
- [ ] Extensible for future modules
- [ ] Compatible with current permissions and entitlements model
- [ ] SSR-safe
- [ ] Safe for enterprise production use

---

## Common Mistakes This Architecture Explicitly Avoids

### Mistake 1 — Trigger-only audit logging

**What it looks like:**
Every audited table has a `BEFORE/AFTER` trigger that inserts a log row. Business events are recorded purely as row-level mutations.

**Why it is wrong:**
Database triggers observe row mutations, not business intent. A trigger sees that `status` changed from `pending` to `approved` — it does not know whether this happened as part of a manual correction, an automated batch job, a user-initiated approval, or an emergency override. The resulting logs are technically accurate but semantically poor: low-value, hard to interpret, missing actor context, missing workflow context.

Trigger-only systems also tightly couple audit logic to schema changes. Adding a column or renaming a table requires auditing the trigger too. At scale, this becomes a maintenance burden and a source of subtle audit gaps.

**What this architecture does instead:**
Business events are emitted from the service or RPC layer, where business intent is known and can be explicitly described in the `action_key` and `metadata`. Triggers are used only where **guaranteed technical history** is needed — i.e. where the record of a mutation must exist regardless of which code path produced it. These are complementary, not equivalent.

---

### Mistake 2 — Separate activity log and audit log storage systems

**What it looks like:**
One table for `activity_logs` (user-facing events), another for `audit_logs` (compliance events), possibly a third for `security_logs`. Each module adds its own table. The data diverges over time. Some events appear in multiple tables with inconsistent structure.

**Why it is wrong:**
Splitting storage creates duplication, inconsistency, and maintenance debt. The same underlying event ends up described differently in each system. It becomes impossible to answer cross-system questions like "show me everything that happened in this workflow." Each system has its own schema, its own query patterns, and its own gaps.

Splitting also implies that the decision of whether an event is "activity" or "audit" is made at write time — but this is a projection concern, not a storage concern. Whether to show an event as personal activity or as a formal audit record depends on who is viewing it and why, not on which table it was written to.

**What this architecture does instead:**
One canonical event store. One schema. One event service. Activity and audit are different projections of the same underlying records, applied at read time based on viewer context.

---

### Mistake 3 — Storing presentation text in the database

**What it looks like:**
Each event row has a `message` or `summary` column populated at insert time with a human-readable string like `"User john@example.com was invited by Michał"`.

**Why it is wrong:**
Stored presentation text becomes stale. If the actor's display name changes, all their historical events show the wrong name. If the template wording is improved, old rows cannot benefit without a migration. If the product adds a second language, the stored text is always locked to the language at insert time.

Storing summaries also bloats the event table with derived data that is computable from the raw facts. It couples the immutable event record to mutable presentation decisions.

**What this architecture does instead:**
The canonical event row stores only immutable facts: `actor_user_id`, `action_key`, `entity_id`, `metadata`. At read time, the projection layer generates the human-readable summary by applying the registered template against the current metadata and actor context. The text is fresh, localizable, and template-driven — with no migration burden when wording changes.

---

## Fit Within Current Platform Architecture

This system fits and complements the existing platform. It does not replace any existing system.

### Complements the Permission System

The current system has roles, permissions, role assignments, compiled effective permissions, permission helpers, and RLS enforcement.

The event system **records actions happening inside that security model**.

### Complements the Entitlements System

The current system has plans, subscriptions, entitlements, module access, and limit logic.

The event system can record entitlement-related actions where desired, but **does not replace entitlements**.

### Complements Organization and Branch Scoping

The platform already uses organization scope and branch scope. The event system preserves that context in events where relevant. The nullable `organization_id` design allows global/auth events (which precede org resolution) to be stored in the same canonical table without requiring a synthetic org assignment.

### Complements SSR-First Architecture

The app is SSR-first. Event access follows the same backend-first, server-validated pattern as the rest of the platform.

### Complements Supabase/RLS Architecture

The platform already uses Supabase/Postgres and RLS as the real security boundary. The event system must not weaken this. The event system integrates safely with it. The RLS strategy for `platform_events` is defined in [Recommended RLS Strategy](#recommended-rls-strategy).

---

## Implementation Guardrails

### Do NOT

```
❌ Create separate storage systems for activity vs audit
❌ Store visibility, sensitivity, or summary fields in the DB row
❌ Store visibility/security rules in the database
❌ Trust frontend to hide sensitive fields
❌ Allow client-side direct inserts into event storage
❌ Allow module code to insert into platform_events directly (bypass event.service.ts)
❌ Dump uncontrolled JSON into metadata without validation
❌ Use presence/online state as primary audit data
❌ Assume all modules need the same forensic depth
❌ Use uuid type for entity_id or target_id — use text
❌ Treat organization_id as NOT NULL — auth and platform events may have no org
❌ Delete event rows as part of retention policy — archive, never delete
❌ Mutate existing event rows to fix mistakes — emit corrective events instead
❌ Use actor_type = 'user' for system/scheduler/automation events — use the correct actor type
❌ Generate a new request_id per emission — generate once per workflow boundary and propagate
```

### DO

```
✅ Keep one canonical event model
✅ Store only immutable facts in the DB row
✅ Use text for entity_id and target_id to support all domain identifier types
✅ Allow organization_id to be null for auth/global/platform events
✅ Validate metadata per action using Zod schemas in the event registry
✅ Generate summaries dynamically at read time from registry templates
✅ Define event/action rules in backend code (event registry)
✅ Route all event writes through event.service.ts
✅ Enforce append-only via RLS — block UPDATE and DELETE for all normal paths at the DB layer
✅ Emit corrective events for mistakes — never mutate existing event rows
✅ Populate actor_type on every event — use the correct non-user type for system/automation actors
✅ Leave actor_user_id null for non-user actors — do not fabricate user IDs
✅ Generate request_id once per workflow boundary and propagate to all emissions in that operation
✅ Project different views for different viewers
✅ Keep the event system generic and module-agnostic
✅ Add deeper history systems only where business risk justifies it
✅ Emit events from the service layer for business actions
✅ Emit events from the RPC layer for complex workflows
✅ Use triggers only for guaranteed technical history
✅ Plan retention and archival strategy before production scale
```

---

## Summary

The correct mental model:

> Store one canonical event (immutable facts only) → classify it via the registry → project it differently depending on who is viewing it, generating summaries and filtering fields at read time.

| Concern                                      | Answer                                                                                            |
| -------------------------------------------- | ------------------------------------------------------------------------------------------------- |
| How many event stores?                       | One                                                                                               |
| Where do events come from?                   | Trusted backend layers only, via `event.service.ts`                                               |
| What is stored in the DB row?                | Immutable facts — no summary, no visibility, no sensitivity                                       |
| What type is `entity_id`?                    | `text` — any domain identifier, not constrained to UUID                                           |
| Can `organization_id` be null?               | Yes — auth and platform events may have no org context                                            |
| What is "activity"?                          | A projected view of events — safe, human-readable, summary generated from template                |
| What is "audit"?                             | A projected view of events — detailed, security-aware, more fields exposed                        |
| Where do summaries come from?                | Generated dynamically by the projection layer using registry templates                            |
| How are security-sensitive fields protected? | Backend projection strips them before the response based on registry rules                        |
| What is `request_id` for?                    | Correlating all events from one workflow for debugging, investigation, and compliance             |
| How is `request_id` generated?               | Once per workflow boundary — propagated to all emissions, never generated per-emission            |
| Who can be an actor?                         | Human users (`user`) and non-human sources (`system`, `api`, `worker`, `scheduler`, `automation`) |
| What if an event was recorded incorrectly?   | Emit a corrective event — never mutate the original row                                           |
| How is append-only guaranteed?               | DB-level RLS denies UPDATE and DELETE — not just application convention                           |
| How do new modules integrate?                | Through the module integration contract and event registry                                        |
| Where do visibility rules live?              | Backend code — event registry                                                                     |
| Can the client influence what it receives?   | No                                                                                                |

That is the architecture that must be implemented.
