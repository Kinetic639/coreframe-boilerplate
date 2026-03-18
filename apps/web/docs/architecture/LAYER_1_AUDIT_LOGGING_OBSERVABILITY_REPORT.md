# Layer 1 — Audit / Logging / Observability Report

> **Status:** Deep verification pass — read-only, zero-assumption
> **Date:** 2026-03-18
> **DB verified via:** Supabase Target MCP (project: rjeraydumwechpjjzrus)
> **Evidence basis:** Code, DB schema, live DB state, test files

---

## 1. Executive Summary

Layer 1 is a **purpose-built event audit trail** with a well-defined architecture, clean read/write separation, and active use in production. It is architecturally coherent for the auth and org-management domains it covers.

**Strongest aspect:** The read pipeline (projection → visibility → enrichment → feeds) is the most mature segment. It correctly enforces three-tier scoping, strips PII by scope, and implements a well-designed permission-based visibility evaluator. The code is consistent, well-commented, and thoroughly unit tested.

**Weakest aspect:** The write side (emission coverage) has a critical blind spot: the entire warehouse module — the primary business-value domain of this product — produces **zero audit events**. Additionally, the append-only guarantee is only architectural/code-level, not database-enforced: the `service_role` retains `UPDATE` and `DELETE` privileges with no DB trigger blocking mutation. There is no immutability trigger.

**Key risks:**

1. Service-role can silently UPDATE or DELETE audit records — no DB enforcement prevents it
2. Warehouse domain (movements, deliveries, transfers, approvals) is completely dark
3. No structured logging — all diagnostic output goes through `console.*` with no aggregation capability
4. Activity invalidation signal (`notifyActivityProduced`) is **defined but never wired** — status bar preview cannot refresh on event production
5. No retention policy, no export, no PII erasure path — compliance surface is unaddressed

**Enterprise readiness verdict for Layer 1:** NOT ENTERPRISE GRADE
The layer is well-designed and production-ready for its current scope, but scope coverage is too narrow, immutability is not enforced at the DB level, and operational/compliance features are absent.

---

## 2. Audit/Event Architecture Overview

### 2.1 System Components

The application has one unified audit infrastructure:

```
platform_events (DB table)
       │
       ├── WRITE PATH (Mode A only)
       │     src/server/services/event.service.ts
       │       ← Registry lookup (event-registry.ts)
       │       ← Zod metadata validation
       │       ← Actor normalization
       │       ← service_role INSERT
       │
       ├── EMISSION SITES (all server actions)
       │     src/app/[locale]/actions.ts          — auth events (5 keys)
       │     src/app/actions/onboarding/index.ts  — org.created, org.onboarding.completed
       │     src/app/actions/organization/
       │       profile.ts     — org.updated (3 call sites)
       │       invitations.ts — 5 invitation event keys
       │       roles.ts       — 5 role event keys
       │       members.ts     — org.member.removed
       │       branches.ts    — 3 branch event keys
       │
       └── READ PATH
             src/app/actions/audit/
               _query.ts              — DB fetch helpers (3 query patterns)
               get-personal-activity  — personal scope (org + org-null merge)
               get-org-activity       — org scope
               get-audit-feed         — audit scope (full fields)
               get-latest-activity    — 1-item personal preview
               get-recent-activity    — 10-item personal preview
             src/server/audit/
               projection.ts          — visibility filter + field projection
               visibility.ts          — canViewerSeeEvent() evaluator
               summary-builder.ts     — rich summary model (i18n params + entity refs)
               reference-enrichment.ts — batch UUID → display name resolution
             UI surfaces:
               /dashboard/activity                    — personal feed page
               /dashboard/organization/activity       — org feed page
               /dashboard/organization/audit          — audit feed page
```

### 2.2 Pipeline Execution Order

**Write (Mode A):**

1. Server action performs domain write (e.g., create role)
2. On success: `eventService.emit({ actionKey, ... })`
3. Service: registry lookup → Zod validation → actor normalization → metadata normalization → service-role INSERT
4. On failure: `console.error(...)`, domain write is NOT rolled back (best-effort)

**Read (any scope):**

1. Feed action loads viewer context + permission snapshot
2. Permission gate check (scope-appropriate)
3. `fetchPlatformEvents()` or `fetchPersonalOrgEvents()` + `fetchPersonalOrgNullEvents()` — bounded fetch
4. `projectEvents()` — per-event: registry lookup → `canViewerSeeEvent()` → metadata strip → summary → pagination
5. `collectReferences()` + `batchLoadReferences()` + `applyReferenceEnrichment()` — max 3 concurrent queries
6. Return `ProjectionResult` to caller

### 2.3 Mode B Status

Mode B (atomic DB-side emission via security-definer RPC) is **documented in the architecture** (`event.service.ts` lines 15–19, `EmitEventInput.requestId` comment) but **NOT implemented**. No `CREATE FUNCTION ... SECURITY DEFINER` exists for event insertion. `validateMetadata()` is exported for Mode B pre-validation but has no active Mode B callers.

---

## 3. Database-Level Audit Infrastructure

### 3.1 Table: `public.platform_events`

**Status: FOUND. 17 columns. Matches migration spec exactly.**

| Column            | Type        | Nullable | Default             |
| ----------------- | ----------- | -------- | ------------------- |
| `id`              | uuid        | NOT NULL | `gen_random_uuid()` |
| `created_at`      | timestamptz | NOT NULL | `now()`             |
| `organization_id` | uuid        | YES      | null                |
| `branch_id`       | uuid        | YES      | null                |
| `actor_user_id`   | uuid        | YES      | null                |
| `actor_type`      | text        | NOT NULL | —                   |
| `module_slug`     | text        | NOT NULL | —                   |
| `action_key`      | text        | NOT NULL | —                   |
| `entity_type`     | text        | NOT NULL | —                   |
| `entity_id`       | text        | NOT NULL | —                   |
| `target_type`     | text        | YES      | null                |
| `target_id`       | text        | YES      | null                |
| `metadata`        | jsonb       | NOT NULL | `'{}'::jsonb`       |
| `event_tier`      | text        | NOT NULL | —                   |
| `request_id`      | uuid        | YES      | null                |
| `ip_address`      | inet        | YES      | null                |
| `user_agent`      | text        | YES      | null                |

**Notable design decisions:**

- `entity_id` and `target_id` are `text` (not uuid) — deliberately flexible, supports composite keys and non-UUID identifiers
- `ip_address` is native `inet` type — proper PostgreSQL IP address type, not text
- `metadata` is `jsonb` with empty-object default — correct for append-only log tables
- All FK references are nullable with `ON DELETE SET NULL` (soft FKs) — preserves event row when referenced entity is deleted

### 3.2 Constraints

**Status: FOUND. 6 constraints.**

| Name                                 | Type        | Definition                                                                |
| ------------------------------------ | ----------- | ------------------------------------------------------------------------- |
| `platform_events_pkey`               | PRIMARY KEY | `id`                                                                      |
| `platform_events_actor_type_check`   | CHECK       | `actor_type IN ('user','system','api','worker','scheduler','automation')` |
| `platform_events_event_tier_check`   | CHECK       | `event_tier IN ('baseline','enhanced','forensic')`                        |
| `platform_events_organization_id_fk` | FOREIGN KEY | `organization_id → organizations(id) ON DELETE SET NULL`                  |
| `platform_events_actor_user_id_fk`   | FOREIGN KEY | `actor_user_id → users(id) ON DELETE SET NULL`                            |
| `platform_events_branch_id_fk`       | FOREIGN KEY | `branch_id → branches(id) ON DELETE SET NULL`                             |

**Notable:** All FKs reference `public.users` (not `auth.users`) — consistent with the application's public identity anchor pattern.

### 3.3 Indexes

**Status: FOUND. 6 indexes (pkey + 5 operational).**

| Name                   | Definition                                                 |
| ---------------------- | ---------------------------------------------------------- |
| `platform_events_pkey` | UNIQUE on `id`                                             |
| `pe_org_created_idx`   | `(organization_id, created_at DESC)` WHERE org IS NOT NULL |
| `pe_actor_user_idx`    | `(actor_user_id, created_at DESC)` WHERE actor IS NOT NULL |
| `pe_action_key_idx`    | `(action_key, created_at DESC)`                            |
| `pe_entity_idx`        | `(entity_type, entity_id, created_at DESC)`                |
| `pe_request_id_idx`    | `(request_id)` WHERE request_id IS NOT NULL                |

**CONFIRMED GAP — No `branch_id` index.**
No index on `branch_id` exists in the DB. The audit and org activity feeds support optional `rawBranchId` filtering (passed to `fetchPlatformEvents()` as `query.eq("branch_id", branchId)`). With the 52 current rows this is negligible, but at scale branch-filtered queries against a table with millions of rows will perform full scans. The migration file `20260321000001_platform_events.sql` does not include a branch_id index.

### 3.4 Row Level Security

**Status: FOUND. RLS enabled. 1 policy.**

```
relrowsecurity = true
relforcerowsecurity = false   ← table owner (postgres role) bypasses RLS
```

**Policy: `platform_events_org_members_read`**

- Command: SELECT
- USING: `organization_id IS NOT NULL AND is_org_member(organization_id)`
- No INSERT policy — direct inserts revoked at privilege level
- No UPDATE policy — updates are architecturally forbidden
- No DELETE policy — deletes are architecturally forbidden

**Important implication of `relforcerowsecurity = false`:**
The `postgres` superuser role bypasses RLS entirely and can read all rows — including auth events where `organization_id IS NULL`. This is the expected behavior for Supabase's postgres role but means RLS does not apply to the DB superuser.

### 3.5 Privilege Grants (Verified)

| Grantee         | INSERT  | UPDATE  | DELETE  | SELECT |
| --------------- | ------- | ------- | ------- | ------ |
| `anon`          | NO      | NO      | NO      | YES    |
| `authenticated` | NO      | NO      | NO      | YES    |
| `service_role`  | **YES** | **YES** | **YES** | YES    |
| `postgres`      | YES     | YES     | YES     | YES    |

**Critical finding: Append-only is NOT enforced at the DB privilege level.**

The migration file (`20260321000001_platform_events.sql`) correctly REVOKEs INSERT, UPDATE, DELETE from `public`, `authenticated`, and `anon`. However:

1. `service_role` retains INSERT (required for emission), UPDATE, and DELETE — the REVOKE statements do not target `service_role`
2. No database trigger exists (`platform_events` has 0 non-internal triggers — confirmed by empty trigger query result)
3. No DB function prevents mutation via service_role

**What this means:** Any code path that uses the service-role client (which bypasses RLS) can UPDATE or DELETE `platform_events` rows. The append-only guarantee is purely a **code-level architectural convention** enforced by the fact that `event.service.ts` is the only code path that uses service_role for this table, and it only does INSERT. There is no database-level enforcement that would prevent a developer from adding an update or delete call using the service client.

**Comparison to what is stated in migration comments:**

> "No UPDATE policy — updates are architecturally forbidden (append-only)."
> "No DELETE policy — deletes are architecturally forbidden (append-only)."

These comments describe the RLS-enforced path. The service-role path is unconstrained at the DB level.

### 3.6 Triggers

**Status: NONE. Zero non-internal triggers on `platform_events`.**

No append-only enforcement trigger (e.g., `BEFORE UPDATE OR DELETE RAISE EXCEPTION`) exists.

### 3.7 Audit-Related DB Functions

**Status: PARTIAL. Only 1 relevant function found: `audit_rls_permission_gate_slugs`.**

This function exists in the `public` schema but is not invoked by the audit pipeline directly. No other event-specific DB functions (e.g., Mode B security-definer insert functions, immutability triggers) exist.

### 3.8 Live DB State

**Verified: 52 total events. Date range: 2026-03-14 to 2026-03-18.**

| Action Key                      | Org-Null | Count |
| ------------------------------- | -------- | ----- |
| `auth.login`                    | YES      | 21    |
| `auth.session.revoked`          | YES      | 5     |
| `auth.password.reset_completed` | YES      | 1     |
| `org.updated`                   | NO       | 13    |
| `org.branch.updated`            | NO       | 3     |
| `org.member.invited`            | NO       | 2     |
| `org.role.created`              | NO       | 2     |
| `org.branch.created`            | NO       | 1     |
| `org.created`                   | NO       | 1     |
| `org.member.role_assigned`      | NO       | 1     |
| `org.onboarding.completed`      | NO       | 1     |
| `org.role.deleted`              | NO       | 1     |

**Zero rows for:** `auth.login.failed`, `auth.password.reset_requested`, `org.member.removed`, `org.member.role_removed`, `org.role.updated`, `org.branch.deleted`, `org.invitation.accepted`, `org.invitation.cancelled`, `org.invitation.declined`, `org.invitation.resent`.

These are either: (a) events that simply haven't occurred in this environment, or (b) events that have occurred but failed to emit. The emission code for all these keys IS present and correct — this appears to be (a).

---

## 4. Registry / Schema / Taxonomy

### 4.1 Registry Structure

**Status: FOUND. 22 registered action keys.**

File: `src/server/audit/event-registry.ts`

The registry is a `Readonly<Record<string, EventRegistryEntry>>` constant (`EVENT_REGISTRY`) at module scope. It is server-only (enforced via `import "server-only"`). Access is through two exported functions: `getRegistryEntry(actionKey)` and `getAllActionKeys()`.

**Per-entry fields (all verified present for all 22 entries):**

| Field             | Type                                                      | Purpose                                                   |
| ----------------- | --------------------------------------------------------- | --------------------------------------------------------- |
| `actionKey`       | string                                                    | Canonical event identifier (matches DB `action_key`)      |
| `moduleSlug`      | string                                                    | Source module identifier                                  |
| `eventTier`       | `'baseline' \| 'enhanced' \| 'forensic'`                  | Data sensitivity level                                    |
| `category`        | `EventCategory`                                           | Domain classification (9 valid values)                    |
| `intent`          | `EventIntent`                                             | Action classification (10 valid values)                   |
| `description`     | string                                                    | Developer documentation                                   |
| `metadataSchema`  | `ZodTypeAny`                                              | Validated at emit time                                    |
| `summaryTemplate` | string                                                    | Legacy fallback (`{{actor}}`, `{{entity}}`, `{{target}}`) |
| `i18nKey`         | string                                                    | next-intl translation root key                            |
| `iconKey`         | string (optional)                                         | lucide-react icon name                                    |
| `scope`           | `'platform' \| 'organization' \| 'branch'`                | Contextual scope                                          |
| `actorVisible`    | boolean                                                   | Actor always sees their own event                         |
| `selfVisible`     | boolean (optional)                                        | Subject sees event about themselves                       |
| `visibilityClass` | `'org_activity' \| 'org_sensitive' \| 'audit'` (optional) | Permission class                                          |
| `visibleTo`       | `EventVisibilityScope[]`                                  | **Legacy — deprecated, kept for compat**                  |
| `sensitiveFields` | `string[]`                                                | Metadata keys stripped for non-audit scope                |

### 4.2 The 22 Registered Events

**Auth module (5 entries, `moduleSlug: "auth"`, all `scope: "platform"`):**

| Key                             | Tier     | Category | Intent  | visibilityClass | sensitiveFields |
| ------------------------------- | -------- | -------- | ------- | --------------- | --------------- |
| `auth.login`                    | baseline | AUTH     | SUCCESS | audit           | `["email"]`     |
| `auth.login.failed`             | baseline | SECURITY | FAIL    | audit           | `["email"]`     |
| `auth.password.reset_requested` | baseline | AUTH     | REQUEST | audit           | `["email"]`     |
| `auth.password.reset_completed` | baseline | AUTH     | SUCCESS | audit           | `[]`            |
| `auth.session.revoked`          | enhanced | AUTH     | DELETE  | audit           | `[]`            |

**Org management module (17 entries, `moduleSlug: "organization-management"`):**

| Key                        | Tier     | Category     | Intent  | Scope        | visibilityClass |
| -------------------------- | -------- | ------------ | ------- | ------------ | --------------- |
| `org.created`              | baseline | ORGANIZATION | CREATE  | organization | org_activity    |
| `org.updated`              | baseline | ORGANIZATION | UPDATE  | organization | org_activity    |
| `org.member.invited`       | enhanced | INVITATION   | CREATE  | organization | org_sensitive   |
| `org.member.removed`       | enhanced | MEMBERSHIP   | REMOVE  | organization | org_sensitive   |
| `org.invitation.accepted`  | baseline | INVITATION   | ACCEPT  | organization | org_activity    |
| `org.invitation.cancelled` | enhanced | INVITATION   | DELETE  | organization | org_sensitive   |
| `org.invitation.resent`    | enhanced | INVITATION   | UPDATE  | organization | org_sensitive   |
| `org.invitation.declined`  | baseline | INVITATION   | DECLINE | organization | org_sensitive   |
| `org.role.created`         | enhanced | ORGANIZATION | CREATE  | organization | org_sensitive   |
| `org.role.updated`         | enhanced | ORGANIZATION | UPDATE  | organization | org_sensitive   |
| `org.role.deleted`         | enhanced | ORGANIZATION | DELETE  | organization | org_sensitive   |
| `org.member.role_assigned` | enhanced | MEMBERSHIP   | ASSIGN  | organization | org_sensitive   |
| `org.member.role_removed`  | enhanced | MEMBERSHIP   | REMOVE  | organization | org_sensitive   |
| `org.branch.created`       | baseline | ORGANIZATION | CREATE  | **branch**   | org_activity    |
| `org.branch.updated`       | baseline | ORGANIZATION | UPDATE  | **branch**   | org_activity    |
| `org.branch.deleted`       | enhanced | ORGANIZATION | DELETE  | **branch**   | org_sensitive   |
| `org.onboarding.completed` | baseline | ORGANIZATION | SUCCESS | organization | org_activity    |

### 4.3 Schema / Metadata Consistency

**Status: STRONG. All schemas are Zod objects. All accept empty object or have explicit optional fields.**

Notable schema patterns:

- Most fields are `.optional()` — allows partial metadata without emission failure
- `org.member.invited.invitee_email` is REQUIRED (`.email()` without `.optional()`) — strongest validation in the registry
- `org.role.created.role_name`, `org.role.updated.role_name`, `org.role.deleted.role_name`, `org.member.role_assigned.role_name` are REQUIRED strings — ensures role name is always captured
- UUID fields use `z.string().uuid()` — validates format before DB insert
- Enum fields (`scope: z.enum(["org","branch"])`) are properly constrained

**eventTier distribution:**

- `baseline`: 11 events (auth.login, auth.password.\*, auth.session.revoked excluded from baseline — wait: auth.session.revoked is `enhanced`)
  - Confirmed baseline: auth.login, auth.login.failed, auth.password.reset_requested, auth.password.reset_completed, org.created, org.updated, org.invitation.accepted, org.invitation.declined, org.branch.created, org.branch.updated, org.onboarding.completed
- `enhanced`: 11 events (auth.session.revoked, org.member.invited, org.member.removed, org.invitation.cancelled, org.invitation.resent, org.role.created, org.role.updated, org.role.deleted, org.member.role_assigned, org.member.role_removed, org.branch.deleted)
- `forensic`: 0 events — no forensic-tier events registered

**Tier inconsistency observation:** `auth.login.failed` (a security event, potentially critical for brute-force detection) is `baseline`. This tier assignment means it does not receive elevated forensic treatment. This is a design choice but worth noting.

### 4.4 Taxonomy Usage

**Categories used:** AUTH, SECURITY, MEMBERSHIP, ORGANIZATION, INVITATION (5 of 9 defined categories)
**Not used:** USER, SYSTEM, DATA, STATE, AUTOMATION

**Intents used:** SUCCESS, FAIL, REQUEST, CREATE, UPDATE, DELETE, ASSIGN, REMOVE, ACCEPT, DECLINE (all 10 — complete coverage)

The category/intent taxonomy is consistent. Categories map cleanly to domains, intents are orthogonal to categories. The visual model (`src/lib/audit/event-visual-model.ts`) provides icon and color mappings for all 9 categories and all 10 intents.

---

## 5. Event Emission Coverage by Domain

### 5.1 Auth Domain

**File:** `src/app/[locale]/actions.ts`
**Coverage: 5/5 registered events. COMPLETE.**

| Event                           | Trigger                         | actorType | Notes                                                         |
| ------------------------------- | ------------------------------- | --------- | ------------------------------------------------------------- |
| `auth.login`                    | `signInAction` — success path   | user      | IP + UA captured                                              |
| `auth.login.failed`             | `signInAction` — error path     | system    | IP + UA captured; actor is "system" because user is unauth    |
| `auth.password.reset_requested` | `forgotPasswordAction`          | system    | IP + UA captured; actor is "system" (unauthenticated request) |
| `auth.password.reset_completed` | `resetPasswordAction` — success | user      | IP + UA captured; skipped if session expired                  |
| `auth.session.revoked`          | `signOutAction`                 | user      | IP + UA captured; skipped if user ID unavailable              |

**Quality observations:**

- All emit calls are gated: actor guard prevents null actorUserId with actorType="user"
- All failures are console.error logged with structured context (actionKey, actorUserId, entityId, error)
- All are best-effort — emit failure does not block the sign-in/sign-out redirect
- `request_id` is NOT passed for any auth event — all auth events have `request_id = null` in the DB. No auth workflow correlation is possible.
- Email metadata is passed for login/reset events — email is in sensitiveFields and will be stripped for non-audit consumers

**MISSING — not registered, not emitted:**

- No `auth.signup` event — `signUpAction` has no event emission. A user registration produces no audit record.

### 5.2 Organization / Profile Domain

**File:** `src/app/actions/organization/profile.ts`
**Coverage: 1/1 registered event wired in 3 call sites. COMPLETE for registered events.**

| Event         | Trigger                  | Notes                              |
| ------------- | ------------------------ | ---------------------------------- |
| `org.updated` | `updateOrgProfileAction` | `updated_fields` array in metadata |
| `org.updated` | `uploadOrgLogoAction`    | `updated_fields: ["logo_url"]`     |
| `org.updated` | `removeOrgLogoAction`    | `updated_fields: ["logo_url"]`     |

**No requestId on any of these calls.** Logo operations are identical action keys — distinguishable only by metadata.

### 5.3 Onboarding Domain

**File:** `src/app/actions/onboarding/index.ts`
**Coverage: 2/2 registered events. COMPLETE.**

| Event                      | Notes                                                               |
| -------------------------- | ------------------------------------------------------------------- |
| `org.created`              | Emitted after successful `create_organization_for_current_user` RPC |
| `org.onboarding.completed` | Emitted immediately after `org.created`                             |

**Notable:** Both events share the same `requestId = crypto.randomUUID()` — the only place in the codebase where request correlation is used. Both events are skipped (with `console.warn`) if `onboardingUser?.id` is null.

### 5.4 Invitation Domain

**File:** `src/app/actions/organization/invitations.ts`
**Coverage: 5/5 registered invitation events. COMPLETE.**

| Event                      | Trigger                   | Notes                                                     |
| -------------------------- | ------------------------- | --------------------------------------------------------- |
| `org.member.invited`       | `createInvitationAction`  | Invitee PII in metadata; `invitee_email` required         |
| `org.invitation.accepted`  | `acceptInvitationAction`  | Skipped if user ID unavailable                            |
| `org.invitation.cancelled` | `cancelInvitationAction`  | Invitee email fetched before cancel, included in metadata |
| `org.invitation.resent`    | `resendInvitationAction`  | Email in metadata                                         |
| `org.invitation.declined`  | `declineInvitationAction` | Handles unauthenticated decline (actorType="system")      |

**Pattern:** All invitation events use best-effort emission — failure is logged but does not block the domain action.

### 5.5 Role Domain

**File:** `src/app/actions/organization/roles.ts`
**Coverage: 5/5 registered role events. COMPLETE.**

| Event                      | Trigger                    | Metadata captured                                   |
| -------------------------- | -------------------------- | --------------------------------------------------- |
| `org.role.created`         | `createRoleAction`         | `role_id`, `role_name`                              |
| `org.role.updated`         | `updateRoleAction`         | `role_id`, `role_name`, `updated_fields`            |
| `org.role.deleted`         | `deleteRoleAction`         | `role_id`, `role_name` (fetched before delete)      |
| `org.member.role_assigned` | `assignRoleToUserAction`   | `target_user_id`, `role_name`, `scope`, `branch_id` |
| `org.member.role_removed`  | `removeRoleFromUserAction` | (confirmed at line 438)                             |

**Quality observation:** `deleteRoleAction` and `updateRoleAction` pre-fetch the role name before the domain operation — this ensures the role name is captured even if the entity is subsequently deleted.

**MISSING — not registered, not emitted:**

- No event when permissions are added/removed from a role (role permission set changes produce `org.role.updated` but with `updated_fields: ["permission_slugs"]` — partial coverage)
- No event for `updateMemberStatusAction` (member active/inactive status changes produce no event)

### 5.6 Branch Domain

**File:** `src/app/actions/organization/branches.ts`
**Coverage: 3/3 registered branch events. COMPLETE.**

| Event                | Trigger              | Notes                                   |
| -------------------- | -------------------- | --------------------------------------- |
| `org.branch.created` | `createBranchAction` | `branch_id` + `branch_name` in metadata |
| `org.branch.updated` | `updateBranchAction` | `updated_fields` included               |
| `org.branch.deleted` | `deleteBranchAction` | Branch name pre-fetched before delete   |

### 5.7 Membership Domain

**File:** `src/app/actions/organization/members.ts`
**Coverage: 1/1 registered membership event. PARTIAL — missing member status change.**

| Event                | Trigger                    | Emits                            |
| -------------------- | -------------------------- | -------------------------------- |
| `org.member.removed` | `removeMemberAction`       | YES — emits `org.member.removed` |
| Member status change | `updateMemberStatusAction` | **NO EVENT**                     |

`updateMemberStatusAction` (active/inactive status toggle) performs a DB write and returns but emits no event. This is a gap — member status changes are significant access-control events (deactivating a member removes access) with no audit trail.

### 5.8 Warehouse Domain

**Coverage: ZERO. Complete absence of audit events.**

The warehouse module — the primary business-value domain of this application — has no event coverage whatsoever. This is confirmed by:

1. **DB live data:** No rows in `platform_events` with any warehouse-related `module_slug` or `action_key`
2. **Registry:** No warehouse event keys registered in `EVENT_REGISTRY`
3. **Code grep:** No `eventService.emit` calls in any warehouse action file (`src/app/actions/warehouse/`)

**Warehouse actions with zero event coverage:**

- `create-movement.ts` — stock movement creation (CRITICAL)
- `approve-movement.ts` — stock movement approval (CRITICAL)
- `cancel-movement.ts` — movement cancellation
- `create-delivery.ts` — delivery creation
- `process-delivery-receipt.ts` — receipt processing
- `create-transfer-request.ts` — transfer request
- `approve-transfer.ts` — transfer approval
- `ship-transfer.ts` — transfer shipment
- `receive-transfer.ts` — transfer receipt
- `create-sales-order.ts` — sales order creation
- `update-sales-order.ts` — sales order update
- `delete-sales-order.ts` — sales order deletion
- `save-draft-delivery.ts` — draft delivery save
- `validate-delivery.ts` — delivery validation

**Impact:** Any stock discrepancy, unauthorized movement, or inventory manipulation in the warehouse produces no audit record. A forensic investigation into a warehouse event is impossible with the current system.

### 5.9 Other Modules

- **Home/News module:** No events. `getNewsAction`, `createNewsAction` etc. produce no events.
- **Support module:** No events.
- **Teams module:** No events.
- **Tools module:** No events.
- **Admin module:** No events (admin entitlement changes produce no audit events).

---

## 6. Projection / Feed / Read Surfaces

### 6.1 Projection Layer

**File:** `src/server/audit/projection.ts`
**Status: FOUND. Well-implemented.**

`projectEvents(input: ProjectionInput): ProjectionResult` is the canonical output gate. It accepts raw `PlatformEventRow[]` and returns `ProjectedEvent[]` — the only shape the application may expose.

**Processing pipeline per event:**

1. Registry lookup → skip with `console.warn` if unknown action_key
2. Personal scope guard: skip null-actor system events that can never be personal
3. `canViewerSeeEvent()` visibility evaluation (delegation, no inline rules)
4. Legacy `summary` string generation from `summaryTemplate`
5. `buildEventSummary()` for rich i18n summary model
6. Metadata projection (sensitive field strip for non-audit)
7. ip/ua injection only for audit scope
8. Pagination applied at the end

**Important design note:** `total` in `ProjectionResult` is the post-visibility-filter count, not a DB-level count. This means pagination is computed in-memory over the projection buffer. The stated `total` may differ from actual total rows if the projection buffer was insufficient. With `PROJECTION_BUFFER = 2` and `ABSOLUTE_CAP = 500`, this is a reasonable trade-off for current scale.

### 6.2 Visibility Evaluator

**File:** `src/server/audit/visibility.ts`
**Status: FOUND. Single-function, three-pass evaluation.**

`canViewerSeeEvent()` evaluation order:

1. **Intrinsic actor:** `entry.actorVisible && viewer.userId === event.actor_user_id` → ALLOW
2. **Intrinsic self:** `entry.selfVisible && (entity_id === viewer.userId || target_id === viewer.userId)` → ALLOW
3. **Audit superpower:** viewer has `audit.events.read` AND viewerScope is "audit" (or unspecified) → ALLOW
4. **Audit-class exclusion:** `visibilityClass === "audit"` in org/personal scope → DENY
5. **Permission check:** `viewer.permissions.includes(VISIBILITY_CLASS_PERMISSIONS[entry.visibilityClass])` → conditional ALLOW
6. **Scope resolution:** platform → always allow; organization → always allow; branch → delegation to snapshot (includes() handles it) → ALLOW or fallthrough
7. Unknown scope → DENY

**Critical design feature:** Audit-class events (`visibilityClass: "audit"`) are exclusive to the audit feed. Even if a viewer has `audit.events.read`, auth events do not appear in their org or personal feeds — only in the audit feed. This prevents security-sensitive events from leaking into lower-security surfaces.

### 6.3 Personal Activity Feed

**Action:** `src/app/actions/audit/get-personal-activity.ts`
**Status: FOUND. Two-query merge pattern.**

- Query 1 (`fetchPersonalOrgEvents`): RLS-enforced client, org-scoped, OR filter for actor/entity-self/target-self
- Query 2 (`fetchPersonalOrgNullEvents`): Service-role client (bypasses RLS for org-null events), same OR filter but WHERE `organization_id IS NULL`
- Merge: sorted by `created_at DESC`
- Scope passed to projection: `"personal"`
- No permission gate — any authenticated user can see their own events

**Security model:** Both queries apply personal-relevant filters at DB level. The projection layer is the final gatekeeper (canViewerSeeEvent).

### 6.4 Org Activity Feed

**Action:** `src/app/actions/audit/get-org-activity.ts`
**Status: FOUND. Single-query.**

- Permission gate: requires `org.read` (`ORG_READ` constant)
- RLS-enforced client
- Scope: `"org"`
- No actor filter — all org events

### 6.5 Audit Feed

**Action:** `src/app/actions/audit/get-audit-feed.ts`
**Status: FOUND. Single-query. Full fields.**

- Permission gate: requires `audit.events.read` (`AUDIT_EVENTS_READ` constant) — org_owner only by default
- RLS-enforced client
- Scope: `"audit"` — enables ip/ua inclusion and audit superpower in visibility evaluator
- Optional `rawBranchId` filter (UUID-validated before use)

### 6.6 Peripheral Actions

**`get-latest-activity.ts`** — delegates to `getPersonalActivityAction(1, 0)`. Returns single most-recent personal event. Used by status-bar preview.

**`get-recent-activity.ts`** — delegates to `getPersonalActivityAction(10, 0)`. Returns 10 most-recent personal events. Used by the Recent Activity Drawer.

### 6.7 Reference Enrichment

**File:** `src/server/audit/reference-enrichment.ts`
**Status: FOUND. Three-phase batch enrichment.**

`collectReferences()` → `batchLoadReferences()` → `applyReferenceEnrichment()`

**Enrichment targets:** actor users, target users, roles (by entity_id or summaryEntities.role), branches (by entity_id, summaryEntities.branch, or event.branch_id).

**Batch strategy:** At most 3 concurrent DB queries via `Promise.all`. Each query uses service-role client (bypasses RLS — safe because only post-visibility-filtered events are enriched). Failures per resource type are non-fatal (empty map returned, console.warn logged).

**Denormalization-first:** `metadata.role_name` and `metadata.branch_name` are checked before DB lookup — reduces DB round trips when role/branch names are already in event metadata.

**Fallback strategy:** users → `"User <first-8>"`, roles → `"Role <first-8>"`, branches → `"Branch <first-8>"`

**Legacy `summary` rebuild:** After enrichment, raw UUID tokens in the legacy `summary` field are replaced with resolved display names (substitution map pattern) — ensures the fallback render path shows human-readable names.

**Functional `as any` casts:** 3 (lines 414, 462, 500) — all at service client `.from()` for tables not in generated types. All are isolated; callers receive typed results.

### 6.8 Activity Invalidation Signal

**File:** `src/lib/audit/activity-invalidation.ts`
**Status: DEFINED. NOT WIRED.**

`notifyActivityProduced()` is a lightweight browser `CustomEvent` dispatcher intended to trigger same-tab refresh of the status-bar preview after an event is produced.

**Critical gap:** `grep -r "notifyActivityProduced"` returns exactly 1 result — the definition file itself. No action or component in the codebase imports or calls this function. The status-bar preview's same-tab refresh path is dead code. The preview can only refresh via polling or window focus/visibility events (if such listeners are implemented elsewhere).

### 6.9 UI Pages

| Route                              | Permission Required  | Feed Used                              |
| ---------------------------------- | -------------------- | -------------------------------------- |
| `/dashboard/activity`              | authenticated        | Personal (`getPersonalActivityAction`) |
| `/dashboard/organization/activity` | `org.read` (implied) | Org (`getOrgActivityAction`)           |
| `/dashboard/organization/audit`    | `audit.events.read`  | Audit (`getAuditFeedAction`)           |

All pages do SSR initial load with `DEFAULT_LIMIT = 50` and `offset = 0`. Client-side pagination is handled by respective wrapper components (`PersonalActivityWrapper`, `OrgActivityWrapper`, `AuditFeedWrapper`).

---

## 7. Logging / Diagnostics / Runtime Observability

### 7.1 Runtime Error Logging

The application uses **only `console.*` for all diagnostic output** — no structured logging library (no winston, pino, bunyan, etc.). All logging goes to stdout/stderr.

**Structured logging pattern (consistent):** Every `console.error` on emit failure includes a structured object with:

- `actionKey`
- `organizationId` (where applicable)
- `actorUserId`
- `entityType` / `entityId`
- `requestId` (where applicable)
- `error` (string message)

This is a consistent and readable pattern, but not machine-parseable in production without a log aggregator that can extract JSON from console output.

**Total console.error/warn in audit pipeline:**

- `event.service.ts`: 2 (emit DB failure, emit unexpected error)
- `projection.ts`: 1 (unknown action_key → console.warn)
- `reference-enrichment.ts`: 6 (3 warn + 3 warn — one pair per resource type: query failed, fetch threw)
- `get-personal-activity.ts`: 2 (org-scoped query failure → error; org-null query failure → warn)
- `get-org-activity.ts`: 1 (DB failure → error)
- `get-audit-feed.ts`: 1 (DB failure → error)
- Each emission site in server actions: 1 console.error per failed emit (13 distinct emitters × at least 1 each)

### 7.2 Request Correlation

**Request ID (within event system):** Present in `platform_events.request_id` column. Indexed for fast lookup (`pe_request_id_idx`).

**Coverage of request_id use:**

- Onboarding: USED — both `org.created` and `org.onboarding.completed` share one generated `requestId`, enabling workflow correlation
- Auth actions: NOT USED — `signInAction`, `signOutAction`, `forgotPasswordAction`, `resetPasswordAction` do not generate or pass `requestId`. All auth events have `request_id = null`.
- Organization actions (profile, roles, branches, members, invitations): NOT USED — no `requestId` passed in any of these emission sites.

**Impact:** The `pe_request_id_idx` index is used by exactly one workflow (onboarding). Multi-step operations like "invite user → user accepts → role assigned" cannot be correlated via `request_id`. An administrator investigating a flow must correlate events manually by timestamps and actor IDs.

### 7.3 IP Address and User Agent

**Captured for:** All auth events (`auth.login`, `auth.login.failed`, `auth.password.reset_requested`, `auth.password.reset_completed`, `auth.session.revoked`) — via `getRequestContext()` in `src/app/[locale]/actions.ts`

**NOT captured for:** All org management events (`org.*`) — profile, role, branch, invitation, member actions do not call `getRequestContext()`. IP/UA fields for these events are null in the DB.

**getRequestContext() implementation:**

- Reads `x-forwarded-for` (first IP, trimmed) → falls back to `x-real-ip` → null
- Reads `user-agent` header → null if absent
- Non-throwing: returns `{null, null}` if headers() throws (e.g., tests)

**Note:** For org management events, the `ip_address` and `user_agent` columns are NULL even in audit scope. An auditor can see WHAT was done but not WHERE FROM for non-auth events.

### 7.4 Observability Weaknesses (Proven)

1. **No log aggregation integration:** No Sentry, Datadog, OpenTelemetry, or similar. console.\* output only. Server-side errors are invisible unless logs are captured by hosting infrastructure (e.g., Vercel's log drain).

2. **No alerting on security events:** `auth.login.failed` is stored (when it occurs) but no mechanism exists to alert on brute-force patterns (N failures from one IP, N failures against one account). The data exists in `platform_events` but is not monitored.

3. **No distributed tracing:** No trace IDs beyond `request_id` (which is sparsely used). Multi-service or multi-action workflows cannot be traced.

4. **No health checks or monitoring on the event pipeline itself:** If `eventService.emit` starts failing systematically, there is no monitoring or alerting — only per-request `console.error` entries.

5. **Activity invalidation dead:** `notifyActivityProduced` is never called. Status bar cannot reflect real-time event production in the same tab.

6. **No warehouse observability:** All warehouse operations — stock movements, deliveries, transfers, approvals — are observability black holes.

---

## 8. Test Coverage for Layer 1

### 8.1 Test Files Found

| File                                                      | Suite IDs                                                                                                                                                        | What It Tests                                                                         |
| --------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------- |
| `src/server/audit/__tests__/event-registry.test.ts`       | T-REGISTRY-CONTRACT, T-REGISTRY-LOOKUP, T-REGISTRY-SCHEMA, T-REGISTRY-COVERAGE, T-MIGRATION-FILES                                                                | Registry structure, schema validation, coverage completeness, migration files on disk |
| `src/server/audit/__tests__/projection.test.ts`           | T-PROJECTION-VISIBILITY, T-PROJECTION-PERSONAL, T-PROJECTION-SENSITIVITY, T-PROJECTION-SUMMARY, T-PROJECTION-IPUA, T-PROJECTION-PAGINATION, T-PROJECTION-UNKNOWN | Projection logic, visibility, sensitivity, ip/ua, pagination                          |
| `src/server/audit/__tests__/visibility.test.ts`           | T-VIS-ACTOR, T-VIS-SELF, T-VIS-PERMISSION, T-VIS-SCOPE, T-VIS-DENY                                                                                               | canViewerSeeEvent() all paths                                                         |
| `src/server/audit/__tests__/summary-builder.test.ts`      | (unknown suites)                                                                                                                                                 | Summary builder logic                                                                 |
| `src/server/audit/__tests__/reference-enrichment.test.ts` | (unknown suites)                                                                                                                                                 | Reference enrichment                                                                  |
| `src/server/audit/__tests__/event-visual-model.test.ts`   | (unknown suites)                                                                                                                                                 | Visual model taxonomy                                                                 |
| `src/server/audit/__tests__/event-system-phase6.test.ts`  | T-INTEGRATION, T-REQUEST-CORRELATION, T-ROLLBACK-CONSISTENCY, T-APPEND-ONLY                                                                                      | Cross-layer integration, correlation, best-effort model                               |
| `src/server/services/__tests__/event.service.test.ts`     | T-EVENT-SERVICE, T-EVENT-VALIDATE, T-EVENT-INVARIANT                                                                                                             | Emit pipeline, metadata validation                                                    |
| `src/app/actions/audit/__tests__/feed-actions.test.ts`    | T-FEED-ACTIONS                                                                                                                                                   | Personal/org/audit feed actions, pagination, security boundaries                      |
| `src/app/actions/__tests__/event-wiring.test.ts`          | T-EVENT-WIRING                                                                                                                                                   | 13 server actions verified for correct event keys/payloads                            |
| `src/app/[locale]/__tests__/actions.test.ts`              | (unknown suites)                                                                                                                                                 | Auth actions                                                                          |

### 8.2 What Is Tested

- **Registry structure:** All 22 entries verified for structural contract (actionKey, metadataSchema, summaryTemplate, visibleTo, sensitiveFields, description, eventTier, moduleSlug, category, intent)
- **Schema validation:** Spot-checks for 7 event types — valid/invalid inputs verified
- **Projection:** Visibility filtering by scope, personal guard, sensitive stripping, ip/ua gate, pagination, unknown key skip
- **Visibility:** Actor intrinsic, self intrinsic, permission-based, scope-aware, denial cases
- **Integration (mocked DB):** Emit → project cycle, request correlation, best-effort fail-through
- **Code-level append-only:** T-APPEND-ONLY verifies `update` and `delete` are never called by `eventService.emit()` (via mock assertions)
- **Feed actions:** Personal/org/audit actions, auth event isolation (other user not leaked), ip/ua scope gate, sensitive metadata strip, unauthorized access blocking, pagination clamping
- **Event wiring:** 13 of 22 events verified for correct actionKey and payload shape in integration-style tests (mocked DB + mocked context)

### 8.3 What Is NOT Tested

- **Auth action events:** `signInAction`, `signOutAction`, `forgotPasswordAction`, `resetPasswordAction` event wiring is NOT in `event-wiring.test.ts`. The file `src/app/[locale]/__tests__/actions.test.ts` exists but its contents were not read — may cover this partially.
- **DB-level append-only:** T-APPEND-ONLY only verifies at the code level (mocked Supabase). No test actually attempts an UPDATE or DELETE against the real DB to confirm it fails.
- **Enrichment against real data:** All enrichment tests use mocked DB clients. No real-DB enrichment round-trip is tested.
- **notifyActivityProduced wiring:** No test verifies the invalidation signal is dispatched after event production.
- **Branch-filtered feeds:** The optional `branchId` filter path in audit/org feeds has no test coverage.
- **Pagination buffer exhaustion:** Edge case where projection filters out enough events that the buffered result is smaller than the requested page — no test.
- **Large event volumes:** No performance or load tests for the bounded fetch strategy.
- **Summary builder completeness:** All 22 action_key cases in `buildParamsAndEntities` — UNVERIFIED whether all cases are covered by test.

### 8.4 Confidence Level

| Area                          | Confidence                                                |
| ----------------------------- | --------------------------------------------------------- |
| Registry contract             | HIGH — per-entry structural tests for all 22              |
| Projection logic              | HIGH — seven test suites covering major code paths        |
| Visibility evaluator          | HIGH — all evaluation paths tested                        |
| Event service emit            | HIGH — success, failure, validation, actor normalization  |
| Feed actions (scope/security) | HIGH — boundaries and security invariants tested          |
| Event wiring (org actions)    | MEDIUM-HIGH — 13 actions verified, auth actions uncertain |
| DB-level append-only          | LOW — code-level only, no real-DB test                    |
| Enrichment                    | MEDIUM — unit tests with mocked DB, no real-DB            |
| Invalidation signal           | NOT TESTED                                                |
| Warehouse coverage            | N/A — not in scope of current tests                       |

---

## 9. Critical Gaps

### 9.1 Architecture Gaps

**G-ARCH-1: Mode B not implemented**
All event emission is Mode A (best-effort). For `forensic` tier events or high-stakes workflows, atomic DB-side emission (Mode B) is documented as the intended pattern but has no implementation. Any emission failure after a successful domain write creates a divergence between the actual system state and the audit log.

**G-ARCH-2: notifyActivityProduced never wired**
`src/lib/audit/activity-invalidation.ts` exports `notifyActivityProduced()` but it is imported nowhere. Same-tab event invalidation does not function.

**G-ARCH-3: No structured logging infrastructure**
All operational output uses `console.*`. In any cloud environment, these logs are unstructured text. No log aggregation, filtering, or alerting is possible without additional infrastructure not configured in this codebase.

### 9.2 Coverage Gaps

**G-COV-1: Warehouse domain — zero coverage (CRITICAL)**
No event registry entries and no emission calls for the entire warehouse domain. Stock movements, deliveries, transfers, approvals, cancellations — all produce zero audit records. This is the most severe coverage gap for a warehouse-focused application.

**G-COV-2: User signup not recorded**
`signUpAction` produces no event. A user's account creation has no audit trail.

**G-COV-3: Member status change not recorded**
`updateMemberStatusAction` (active/inactive toggle) produces no event. Deactivating a member's access leaves no audit record.

**G-COV-4: Auth events have no request_id**
All 5 auth events have `request_id = NULL` in the DB. Multi-step auth workflows (e.g., password reset: requested → completed) cannot be correlated.

**G-COV-5: Org management events have no IP/UA**
All org.\* events are stored with `ip_address = NULL` and `user_agent = NULL`. An auditor cannot determine the network origin of role assignments, branch deletions, or member removals.

**G-COV-6: No forensic-tier events**
Zero events registered at `forensic` tier. The tier exists in the schema and check constraint but is unused.

**G-COV-7: No home/support/teams/tools/admin events**
These modules produce no audit events. Admin entitlement changes (granting superadmin) leave no record.

### 9.3 Integrity Gaps

**G-INT-1: service_role has UPDATE and DELETE on platform_events (CRITICAL)**
Confirmed via `has_table_privilege('service_role', 'public.platform_events', 'UPDATE') = true`. The append-only guarantee is code-level only. A developer with access to the service-role key can mutate or delete audit records with no DB-level prevention.

**G-INT-2: No DB trigger enforcing immutability**
Zero triggers exist on `platform_events`. A `BEFORE UPDATE OR DELETE RAISE EXCEPTION` trigger would DB-enforce append-only regardless of which client or role performs the write. This does not exist.

**G-INT-3: relforcerowsecurity = false**
The postgres superuser bypasses RLS. Direct superuser access to the DB can read all rows including org-null auth events without going through the application's visibility layer.

**G-INT-4: No cryptographic integrity**
Event rows have no checksum, hash chain, or signature. There is no mechanism to detect whether a row was silently modified after storage.

**G-INT-5: No branch_id index**
Branch-filtered queries (`getAuditFeedAction(rawBranchId)` and `getOrgActivityAction(rawBranchId)`) perform sequential scans on the full table when `branch_id` is filtered. At scale this is a performance and implicit correctness risk.

### 9.4 Operational / Observability Gaps

**G-OPS-1: No retention policy**
The `platform_events` table has no TTL, partition, or archival strategy. At the current growth rate (52 events in ~4 days for one org), a production system with thousands of orgs will accumulate millions of rows with no automated management.

**G-OPS-2: No export capability**
There is no API endpoint, admin action, or tooling to export audit records to CSV, JSON, or SIEM formats. Compliance audits require manual DB access.

**G-OPS-3: No anomaly detection or alerting**
`auth.login.failed` events are stored but not monitored. No alerting on brute force patterns, unusual access patterns, or bulk role changes.

**G-OPS-4: No pagination accuracy guarantee**
The `total` field in `ProjectionResult` reflects post-projection count over a limited buffer, not true total. Consumers relying on `total` for exact pagination UI may see incorrect page counts when the projection buffer is insufficient.

**G-OPS-5: No warehouse domain observability**
See G-COV-1. Warehouse operations are completely unobservable via the audit system.

### 9.5 Compliance Gaps

**G-COMP-1: No PII erasure path (GDPR right-to-erasure)**
Email addresses are stored in `metadata` for several event types (`auth.login`, `auth.login.failed`, `auth.password.reset_requested`, `org.member.invited`, `org.invitation.cancelled`, `org.invitation.resent`). The `sensitiveFields` mechanism strips these at read time but does not erase them from storage. There is no API to fulfill a GDPR erasure request for a specific user's data in `platform_events`.

**G-COMP-2: No audit of admin-level system actions**
Admin entitlement grants/revocations in the `admin_entitlements` table produce no `platform_events` rows.

**G-COMP-3: No retention enforcement**
Regulatory frameworks typically require audit log retention for 1–7 years. The current system has no retention floor or ceiling.

---

## 10. Maturity Assessment

### 10.1 Sub-scores

| Dimension                 | Score | Rationale                                                                                                                                           |
| ------------------------- | ----- | --------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Architecture**          | 7/10  | Well-structured, clean separation, mode-aware design, good patterns throughout. Deducted for: Mode B unimplemented, notifyActivityProduced unwired. |
| **Coverage**              | 3/10  | 22 events cover auth + org management well. Zero warehouse coverage. Zero for 5 other modules. Signup not recorded. Member status not recorded.     |
| **Integrity**             | 4/10  | RLS + REVOKE correctly blocks authenticated/anon. service_role has unconstrained UPDATE/DELETE. No trigger, no checksum, no hash chain.             |
| **Observability**         | 3/10  | console.\* only, no structured logging, no alerting, no trace IDs across workflows. IP/UA only for auth events. request_id only for onboarding.     |
| **Operations/Compliance** | 1/10  | No retention, no export, no erasure path, no anomaly detection. Compliance surface completely unaddressed.                                          |

### 10.2 Overall Score: **4/10**

The architecture score pulls this up significantly. The implementation of what exists is solid. The read pipeline (projection/visibility/enrichment) is production-quality. However, the coverage gaps — particularly the entire warehouse domain — mean Layer 1 cannot fulfill its core purpose for the majority of the application's business operations. The integrity and compliance scores reflect that enterprise-grade requirements have not been addressed.

---

## 11. Final Verdict

**Layer 1 is: ADEQUATE (approaching STRONG) within its current scope, but WEAK across the full application surface.**

**What makes it adequate:**

- The audit architecture is well-designed and internally consistent
- The read pipeline correctly implements three-scope visibility with PII stripping
- All 22 registered events are correctly wired to their emission sites
- Test coverage for the implemented portion is high-quality and meaningful
- Service-role inserts function correctly in production (52 live events confirmed)
- Auth events capture IP/UA and are correctly classified as audit-only

**What must exist before Layer 1 can be called enterprise-grade:**

1. **Warehouse coverage** — register and emit events for all stock movements, deliveries, transfers, and approvals. Without this, the audit layer does not cover the primary business domain.

2. **DB-level immutability** — add a `BEFORE UPDATE OR DELETE RAISE EXCEPTION` trigger on `platform_events`. The service_role bypass is a real architectural risk.

3. **Branch_id index** — add `CREATE INDEX pe_branch_id_idx ON public.platform_events (branch_id, created_at DESC) WHERE branch_id IS NOT NULL`.

4. **request_id propagation** — generate and propagate `requestId` at auth and org management entry points so multi-step workflows can be correlated.

5. **IP/UA for org management events** — call `getRequestContext()` in org management actions and pass ipAddress/userAgent to event emission.

6. **notifyActivityProduced wiring** — call this function after any action that successfully emits an event so the status bar preview refreshes.

7. **Structured logging** — replace `console.*` with a structured logger (e.g., pino) that produces machine-parseable output for production log aggregation.

8. **PII erasure path** — implement a server action that scrubs known PII fields from `metadata` for a given user ID to support GDPR right-to-erasure.

9. **Retention strategy** — implement a table partition strategy or a scheduled cleanup job with a defined retention window.

10. **User signup event** — register `auth.signup` and emit it from `signUpAction`.
