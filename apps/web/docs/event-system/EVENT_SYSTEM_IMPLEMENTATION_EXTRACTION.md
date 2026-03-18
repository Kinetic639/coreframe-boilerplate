# Event System Implementation Extraction

**Extraction date**: 2026-03-15
**Branch**: event-system
**Target Supabase project**: rjeraydumwechpjjzrus

---

## 1. Extraction Scope and Evidence Sources

### Files read from repository

| Path                                                                    | Purpose                                |
| ----------------------------------------------------------------------- | -------------------------------------- |
| `src/server/audit/types.ts`                                             | All shared type definitions            |
| `src/server/audit/event-registry.ts`                                    | Registry of all 20 action keys         |
| `src/server/audit/projection.ts`                                        | Projection layer implementation        |
| `src/server/services/event.service.ts`                                  | Emit service (Mode A)                  |
| `src/app/actions/audit/_query.ts`                                       | DB query helpers, pagination constants |
| `src/app/actions/audit/get-personal-activity.ts`                        | Personal feed action                   |
| `src/app/actions/audit/get-org-activity.ts`                             | Org feed action                        |
| `src/app/actions/audit/get-audit-feed.ts`                               | Audit feed action                      |
| `src/app/[locale]/actions.ts`                                           | Auth event wiring                      |
| `src/app/actions/organization/profile.ts`                               | Org profile event wiring               |
| `src/app/actions/organization/invitations.ts`                           | Invitation event wiring                |
| `src/app/actions/organization/members.ts`                               | Member event wiring                    |
| `src/app/actions/organization/roles.ts`                                 | Role event wiring                      |
| `src/app/actions/organization/branches.ts`                              | Branch event wiring                    |
| `src/app/actions/onboarding/index.ts`                                   | Onboarding event wiring                |
| `src/app/[locale]/dashboard/activity/page.tsx`                          | Personal activity page                 |
| `src/app/[locale]/dashboard/organization/activity/page.tsx`             | Org activity page                      |
| `src/app/[locale]/dashboard/organization/audit/page.tsx`                | Audit feed page                        |
| `src/app/[locale]/dashboard/activity/_components/event-feed-client.tsx` | Shared UI component                    |
| `src/components/nav-user.tsx`                                           | Nav component (logout wiring)          |
| `src/server/audit/__tests__/event-registry.test.ts`                     | Registry test suite                    |
| `src/server/audit/__tests__/projection.test.ts`                         | Projection test suite                  |
| `src/server/audit/__tests__/event-system-phase6.test.ts`                | Phase 6 integration tests              |
| `src/app/actions/audit/__tests__/feed-actions.test.ts`                  | Feed actions test suite                |
| `src/app/actions/__tests__/event-wiring.test.ts`                        | Event wiring test suite                |

### Supabase-target queries executed

- Column structure: `information_schema.columns WHERE table_name='platform_events'`
- Index structure: `pg_indexes WHERE tablename='platform_events'`
- Constraints: `information_schema.table_constraints` + `constraint_column_usage`
- RLS policies: `pg_policies WHERE tablename='platform_events'`
- Privileges: `information_schema.role_table_grants WHERE table_name='platform_events'`
- Relevant DB functions: `pg_proc` + `pg_namespace` for `is_org_member`, `has_permission`, `has_branch_permission`, `audit_events_read`, `has_audit_events_read`
- Permissions table: `SELECT slug, name FROM permissions WHERE slug LIKE 'audit%'`
- Migrations list: `supabase-target list_migrations`

---

## 2. Database Table: `public.platform_events`

### Column definitions (17 columns)

| Column            | Type          | Nullable | Default             |
| ----------------- | ------------- | -------- | ------------------- |
| `id`              | `uuid`        | NOT NULL | `gen_random_uuid()` |
| `created_at`      | `timestamptz` | NOT NULL | `now()`             |
| `action_key`      | `text`        | NOT NULL | —                   |
| `module_slug`     | `text`        | NULL     | —                   |
| `event_tier`      | `text`        | NOT NULL | —                   |
| `actor_type`      | `text`        | NOT NULL | —                   |
| `actor_user_id`   | `uuid`        | NULL     | —                   |
| `organization_id` | `uuid`        | NULL     | —                   |
| `branch_id`       | `uuid`        | NULL     | —                   |
| `entity_type`     | `text`        | NULL     | —                   |
| `entity_id`       | `text`        | NULL     | —                   |
| `target_type`     | `text`        | NULL     | —                   |
| `target_id`       | `text`        | NULL     | —                   |
| `metadata`        | `jsonb`       | NULL     | `'{}'::jsonb`       |
| `ip_address`      | `text`        | NULL     | —                   |
| `user_agent`      | `text`        | NULL     | —                   |
| `request_id`      | `uuid`        | NULL     | —                   |

### Indexes (6)

| Index name                            | Columns           | Type                |
| ------------------------------------- | ----------------- | ------------------- |
| `platform_events_pkey`                | `id`              | PRIMARY KEY (btree) |
| `platform_events_actor_user_id_idx`   | `actor_user_id`   | btree               |
| `platform_events_organization_id_idx` | `organization_id` | btree               |
| `platform_events_action_key_idx`      | `action_key`      | btree               |
| `platform_events_created_at_idx`      | `created_at`      | btree               |
| `platform_events_request_id_idx`      | `request_id`      | btree               |

### Constraints (5)

| Constraint                             | Type        | Columns                                              |
| -------------------------------------- | ----------- | ---------------------------------------------------- |
| `platform_events_pkey`                 | PRIMARY KEY | `id`                                                 |
| `platform_events_actor_type_check`     | CHECK       | `actor_type IN ('user', 'system', 'service')`        |
| `platform_events_event_tier_check`     | CHECK       | `event_tier IN ('baseline', 'enhanced', 'forensic')` |
| `platform_events_actor_user_id_fkey`   | FOREIGN KEY | `actor_user_id → auth.users(id)`                     |
| `platform_events_organization_id_fkey` | FOREIGN KEY | `organization_id → organizations(id)`                |

### Row Level Security

RLS is **ENABLED** on `platform_events`.

**Policies:**

| Policy name                       | Command | Roles           | Using expression                                                 |
| --------------------------------- | ------- | --------------- | ---------------------------------------------------------------- |
| `service_role_can_insert`         | INSERT  | `service_role`  | `true`                                                           |
| `users_can_select_own_org_events` | SELECT  | `authenticated` | `organization_id IS NOT NULL AND is_org_member(organization_id)` |

No UPDATE or DELETE policies exist. The table is append-only by RLS enforcement.

### Privilege table

| Grantee         | Privilege | Grantable |
| --------------- | --------- | --------- |
| `service_role`  | INSERT    | NO        |
| `service_role`  | SELECT    | NO        |
| `service_role`  | UPDATE    | NO        |
| `service_role`  | DELETE    | NO        |
| `authenticated` | SELECT    | NO        |
| `anon`          | (none)    | —         |

`authenticated` role has SELECT only. `anon` has no privileges. INSERT is service_role only.

---

## 3. Database Functions (Event-System Relevant)

### `is_org_member(org_id uuid) → boolean`

Used in RLS SELECT policy. Returns TRUE if `auth.uid()` is a member of the given organization.

### `has_permission(org_id uuid, permission text) → boolean`

Used in feed action permission checks. Org-scope only — checks `permission_slug_exact` where `branch_id IS NULL`.

### `has_branch_permission(org_id uuid, branch_id uuid, slug text) → boolean`

Returns TRUE if `branch_id IS NULL OR branch_id = p_branch_id`. Used in RLS for other tables; not directly used in platform_events policies.

### `has_audit_events_read(org_id uuid) → boolean` / audit read functions

At time of extraction, the `audit.events.read` permission gating uses `has_permission(org_id, 'audit.events.read')` called from within server actions (not a separate DB function named `has_audit_events_read`). The server action `getAuditFeedAction` calls `PermissionServiceV2.hasPermission` or `checkPermission(snapshot, AUDIT_EVENTS_READ)`.

---

## 4. Database Permissions (Audit-Related)

From `public.permissions` table:

| slug                | name              |
| ------------------- | ----------------- |
| `audit.events.read` | Read Audit Events |

This permission is granted to the `org_owner` role only (via migration).

Constant in source: `AUDIT_EVENTS_READ = "audit.events.read"` in `src/lib/constants/permissions.ts`.

---

## 5. Applied Migrations (Event System)

From `supabase-target list_migrations`, event-system-specific migrations:

| Migration file                                                | Description                                                 |
| ------------------------------------------------------------- | ----------------------------------------------------------- |
| `20260323000000_target_platform_events_table.sql`             | Creates `platform_events` table, indexes, constraints, RLS  |
| `20260323000001_target_event_registry_permissions.sql`        | Inserts `audit.events.read` permission, grants to org_owner |
| `20260323000010_target_harden_p1_baseline.sql`                | Phase 1 hardening baseline                                  |
| `20260323000011_target_harden_p2_compile_triggers.sql`        | Phase 2 compile trigger hardening                           |
| `20260323000012_target_harden_p3_entitlements_triggers.sql`   | Phase 3 entitlements trigger hardening                      |
| `20260323000013_target_harden_p4_security.sql`                | Phase 4 security hardening                                  |
| `20260323000016_target_corrective_p7_compile_trigger_fix.sql` | Phase 7 corrective compile trigger fix                      |

---

## 6. TypeScript Types (`src/server/audit/types.ts`)

### `PlatformEventRow`

Direct mapping of all 17 DB columns:

```typescript
export type PlatformEventRow = {
  id: string;
  created_at: string;
  action_key: string;
  module_slug: string | null;
  event_tier: "baseline" | "enhanced" | "forensic";
  actor_type: "user" | "system" | "service";
  actor_user_id: string | null;
  organization_id: string | null;
  branch_id: string | null;
  entity_type: string | null;
  entity_id: string | null;
  target_type: string | null;
  target_id: string | null;
  metadata: Record<string, unknown>;
  ip_address: string | null;
  user_agent: string | null;
  request_id: string | null;
};
```

### `EmitEventInput`

```typescript
export type EmitEventInput = {
  actionKey: string;
  actorType: "user" | "system" | "service";
  actorUserId: string | null;
  organizationId: string | null;
  branchId?: string | null;
  entityType?: string | null;
  entityId?: string | null;
  targetType?: string | null;
  targetId?: string | null;
  metadata?: Record<string, unknown>;
  eventTier?: "baseline" | "enhanced" | "forensic";
  requestId?: string;
  ipAddress?: string | null;
  userAgent?: string | null;
};
```

### `EventRegistryEntry`

```typescript
export type EventRegistryEntry = {
  actionKey: string;
  moduleSlug: string | null;
  eventTier: "baseline" | "enhanced" | "forensic";
  metadataSchema: ZodSchema;
  summaryTemplate: string;
  visibleTo: ("self" | "org_member" | "org_admin" | "auditor")[];
  sensitiveFields?: string[];
};
```

### `ProjectionContext`

```typescript
export type ProjectionContext = {
  feedScope: "personal" | "org" | "audit";
  viewerUserId: string;
  viewerOrgId: string | null;
  offset: number;
  limit: number;
};
```

### `ProjectedEvent`

```typescript
export type ProjectedEvent = {
  id: string;
  created_at: string;
  action_key: string;
  module_slug: string | null;
  event_tier: "baseline" | "enhanced" | "forensic";
  actor_type: "user" | "system" | "service";
  actor_user_id: string | null;
  organization_id: string | null;
  branch_id: string | null;
  entity_type: string | null;
  entity_id: string | null;
  target_type: string | null;
  target_id: string | null;
  metadata: Record<string, unknown>;
  summary: string;
  ip_address?: string;
  user_agent?: string;
};
```

Note: `ip_address` and `user_agent` are physically absent (not set to null) on non-audit projections.

### `EventServiceResult<T>`

```typescript
export type EventServiceResult<T = void> =
  | { success: true; data: T }
  | { success: false; error: string };
```

Discriminated union. TypeScript strict mode is `false` in this project — cannot narrow on `!result.success`; requires cast `(result as { success: false; error: string }).error`.

---

## 7. Event Registry (`src/server/audit/event-registry.ts`)

File imports `"server-only"` sentinel. Exports `EVENT_REGISTRY` as `Record<string, EventRegistryEntry>`.

Total registered entries: **20**

### Complete registry listing

| #   | actionKey                       | moduleSlug                  | eventTier  | visibleTo                                        | summaryTemplate                                        |
| --- | ------------------------------- | --------------------------- | ---------- | ------------------------------------------------ | ------------------------------------------------------ |
| 1   | `auth.login`                    | `null`                      | `baseline` | `["self", "auditor"]`                            | `"{{actor}} signed in"`                                |
| 2   | `auth.login.failed`             | `null`                      | `baseline` | `["auditor"]`                                    | `"Failed sign-in attempt for {{actor}}"`               |
| 3   | `auth.logout`                   | `null`                      | `baseline` | `["self", "auditor"]`                            | `"{{actor}} signed out"`                               |
| 4   | `auth.password.reset_requested` | `null`                      | `enhanced` | `["auditor"]`                                    | `"Password reset requested for {{actor}}"`             |
| 5   | `auth.password.reset_completed` | `null`                      | `enhanced` | `["self", "auditor"]`                            | `"{{actor}} completed a password reset"`               |
| 6   | `auth.session.revoked`          | `null`                      | `forensic` | `["auditor"]`                                    | `"Session revoked for {{actor}}"`                      |
| 7   | `org.created`                   | `null`                      | `baseline` | `["self", "org_admin", "auditor"]`               | `"{{actor}} created the organization"`                 |
| 8   | `org.updated`                   | `null`                      | `baseline` | `["self", "org_member", "org_admin", "auditor"]` | `"{{actor}} updated the organization profile"`         |
| 9   | `org.onboarding.completed`      | `null`                      | `baseline` | `["self", "org_admin", "auditor"]`               | `"{{actor}} completed onboarding"`                     |
| 10  | `org.branch.created`            | `"organization-management"` | `baseline` | `["org_member", "org_admin", "auditor"]`         | `"{{actor}} created branch {{entity}}"`                |
| 11  | `org.branch.updated`            | `"organization-management"` | `baseline` | `["org_member", "org_admin", "auditor"]`         | `"{{actor}} updated branch {{entity}}"`                |
| 12  | `org.branch.deleted`            | `"organization-management"` | `enhanced` | `["org_admin", "auditor"]`                       | `"{{actor}} deleted branch {{entity}}"`                |
| 13  | `org.member.invited`            | `"organization-management"` | `enhanced` | `["org_admin", "auditor"]`                       | `"{{actor}} invited {{target}} to the organization"`   |
| 14  | `org.invitation.accepted`       | `"organization-management"` | `baseline` | `["self", "org_admin", "auditor"]`               | `"{{actor}} accepted the invitation"`                  |
| 15  | `org.invitation.cancelled`      | `"organization-management"` | `enhanced` | `["org_admin", "auditor"]`                       | `"{{actor}} cancelled the invitation for {{target}}"`  |
| 16  | `org.member.removed`            | `"organization-management"` | `enhanced` | `["self", "org_admin", "auditor"]`               | `"{{actor}} removed {{target}} from the organization"` |
| 17  | `org.role.created`              | `"organization-management"` | `baseline` | `["org_admin", "auditor"]`                       | `"{{actor}} created role {{entity}}"`                  |
| 18  | `org.role.updated`              | `"organization-management"` | `baseline` | `["org_admin", "auditor"]`                       | `"{{actor}} updated role {{entity}}"`                  |
| 19  | `org.role.deleted`              | `"organization-management"` | `enhanced` | `["org_admin", "auditor"]`                       | `"{{actor}} deleted role {{entity}}"`                  |
| 20  | `org.member.role_assigned`      | `"organization-management"` | `baseline` | `["self", "org_admin", "auditor"]`               | `"{{actor}} assigned role {{entity}} to {{target}}"`   |

Note: `org.member.role_removed` is NOT in the registry as a separate entry; it is covered by emission in `roles.ts` using `org.member.role_assigned` with different metadata, OR — based on wiring — `roles.ts` emits it with a separate action key. See Section 9 for exact wiring.

**Special cases:**

- `auth.login.failed`: `visibleTo: ["auditor"]` — not visible to self
- `auth.password.reset_requested`: `visibleTo: ["auditor"]` — not visible to self
- `auth.session.revoked`: `visibleTo: ["auditor"]` — not visible to self or org
- `auth.logout`: `visibleTo: ["self", "auditor"]` — not visible to org members
- `org.branch.deleted`: `eventTier: "enhanced"` (not baseline)

### Metadata schemas (by actionKey)

All schemas are Zod objects. Required fields only listed where present.

| actionKey                       | Metadata fields                                                                       |
| ------------------------------- | ------------------------------------------------------------------------------------- |
| `auth.login`                    | `{ ip_address?: string, user_agent?: string }`                                        |
| `auth.login.failed`             | `{ ip_address?: string, user_agent?: string, reason?: string }`                       |
| `auth.logout`                   | `{ ip_address?: string, user_agent?: string }`                                        |
| `auth.password.reset_requested` | `{ ip_address?: string, user_agent?: string }`                                        |
| `auth.password.reset_completed` | `{ ip_address?: string, user_agent?: string }`                                        |
| `auth.session.revoked`          | `{ ip_address?: string, user_agent?: string, session_id?: string }`                   |
| `org.created`                   | `{ org_name?: string, org_slug?: string }`                                            |
| `org.updated`                   | `{ updated_fields?: string[] }`                                                       |
| `org.onboarding.completed`      | `{ org_name?: string }`                                                               |
| `org.branch.created`            | `{ branch_id?: string, branch_name?: string }`                                        |
| `org.branch.updated`            | `{ branch_id?: string, branch_name?: string, updated_fields?: string[] }`             |
| `org.branch.deleted`            | `{ branch_id?: string, branch_name?: string }`                                        |
| `org.member.invited`            | `{ invitee_email?: string, invitee_first_name?: string, invitee_last_name?: string }` |
| `org.invitation.accepted`       | `{ invitation_id?: string }`                                                          |
| `org.invitation.cancelled`      | `{ invitation_id?: string, invitee_email?: string }`                                  |
| `org.member.removed`            | `{ removed_user_id?: string }`                                                        |
| `org.role.created`              | `{ role_name?: string }`                                                              |
| `org.role.updated`              | `{ role_name?: string, updated_fields?: string[] }`                                   |
| `org.role.deleted`              | `{ role_name?: string }`                                                              |
| `org.member.role_assigned`      | `{ role_name?: string, scope?: string, scope_id?: string }`                           |

### `sensitiveFields`

Only `auth.*` events have `sensitiveFields`. Value is `["ip_address", "user_agent"]` on all six auth entries.

---

## 8. Event Service (`src/server/services/event.service.ts`)

File imports `"server-only"` sentinel.

Exports: `eventService` (singleton instance), `validateMetadata` (exported separately for Mode B pre-validation).

### `emit(input: EmitEventInput): Promise<EventServiceResult<{ eventId: string }>>`

The emit pipeline has 5 steps:

**Step 1 — Registry lookup**
Looks up `input.actionKey` in `EVENT_REGISTRY`. Returns `{ success: false, error: "Unknown action key: ..." }` if not found.

**Step 2 — Metadata validation**
Calls `registryEntry.metadataSchema.safeParse(input.metadata ?? {})`. Returns `{ success: false, error: "..." }` if validation fails. The `eventTier` stored is taken from the registry entry (caller's `input.eventTier` is ignored).

**Step 3 — Service-role client**
Creates a Supabase service-role client (bypasses RLS). Regular `createClient()` is NOT used.

**Step 4 — DB INSERT**
Inserts one row into `platform_events`. All 17 columns mapped from input. On DB error, returns `{ success: false, error: error.message }`.

**Step 5 — Return**
On success returns `{ success: true, data: { eventId: insertedRow.id } }`.

**Never-throw invariant:** The entire function body is wrapped in try/catch. Any unexpected exception returns `{ success: false, error: exception.message }`. Callers do not need to catch.

### `validateMetadata(actionKey: string, metadata: unknown): EventServiceResult<Record<string, unknown>>`

Exported standalone. Performs registry lookup + schema parse. Returns typed result. Intended for Mode B pre-validation before atomic DB writes.

---

## 9. Emission Sites (All Action Files)

### `src/app/[locale]/actions.ts` — Auth events (5 events)

All 5 auth events use `getRequestContext()` to obtain IP/UA from `headers()` (Next.js `next/headers`). All pass `actorType: "user"` with the Supabase auth user id, except `auth.login.failed` where the user may not exist.

| actionKey                       | actorType | organizationId | Condition                                |
| ------------------------------- | --------- | -------------- | ---------------------------------------- |
| `auth.login`                    | `"user"`  | `null`         | After successful `signInWithPassword`    |
| `auth.login.failed`             | `"user"`  | `null`         | After failed `signInWithPassword`        |
| `auth.password.reset_requested` | `"user"`  | `null`         | After successful `resetPasswordForEmail` |
| `auth.password.reset_completed` | `"user"`  | `null`         | After successful password update         |
| `auth.session.revoked`          | `"user"`  | `null`         | After `auth.signOut()` (logout)          |

All auth events: `organizationId: null`, `branchId: null`, `entityType: null`, `entityId: null`.

IP/UA stored in both `metadata` AND top-level `ip_address`/`user_agent` columns.

### `src/app/actions/onboarding/index.ts` — Onboarding events (2 events)

Both events share one `requestId = crypto.randomUUID()`.

**Actor model guard:** If `onboardingUser?.id` is falsy, both emissions are skipped entirely. A `console.warn` is logged with `organizationId` context. This prevents emitting `actorType: "user"` with null `actorUserId`.

| actionKey                  | actorType | actorUserId         | entityType       | entityId         |
| -------------------------- | --------- | ------------------- | ---------------- | ---------------- |
| `org.created`              | `"user"`  | `onboardingUser.id` | `"organization"` | `organizationId` |
| `org.onboarding.completed` | `"user"`  | `onboardingUser.id` | `"organization"` | `organizationId` |

Both are emitted after `create_organization_for_current_user` RPC succeeds. Both are best-effort (domain action returns success regardless of emit result).

### `src/app/actions/organization/profile.ts` — Org profile events (3 emit sites, 1 actionKey)

`org.updated` is emitted from three separate functions:

| Function                 | Condition                       | metadata.updated_fields      |
| ------------------------ | ------------------------------- | ---------------------------- |
| `updateOrgProfileAction` | After successful profile update | Array of changed field names |
| `uploadOrgLogoAction`    | After successful logo upload    | `["logo"]`                   |
| `removeOrgLogoAction`    | After successful logo removal   | `["logo"]`                   |

All three: `actorType: "user"`, `actorUserId: context.user.user?.id ?? null`, `entityType: "organization"`, `entityId: context.app.activeOrgId`.

### `src/app/actions/organization/invitations.ts` — Invitation events (3 events)

| actionKey                  | Function                 | entityType     | entityId                   | targetType                     | targetId            |
| -------------------------- | ------------------------ | -------------- | -------------------------- | ------------------------------ | ------------------- |
| `org.member.invited`       | `createInvitationAction` | `"invitation"` | `result.data.id`           | `"invitation_email"`           | `result.data.email` |
| `org.invitation.cancelled` | `cancelInvitationAction` | `"invitation"` | `parsed.data.invitationId` | `"invitation_email"` or `null` | email or `null`     |
| `org.invitation.accepted`  | `acceptInvitationAction` | `"user"`       | `acceptingUser.id`         | —                              | —                   |

**`org.invitation.cancelled`:** Email pre-fetched from `invitations` table before cancel operation. `targetType` is `"invitation_email"` if email available, else `null`.

**`org.invitation.accepted`:** Guarded: `if (result.success && acceptingUser?.id)`. Actor is the accepting user (not inviter). `entityType: "user"`, `entityId: acceptingUser.id`.

### `src/app/actions/organization/members.ts` — Member events (1 event)

| actionKey            | Function             | entityType | entityId       | targetType | targetId       |
| -------------------- | -------------------- | ---------- | -------------- | ---------- | -------------- |
| `org.member.removed` | `removeMemberAction` | `"user"`   | removed userId | `"user"`   | removed userId |

Actor: `context.user.user?.id ?? null`. Both `entityId` and `targetId` are the removed user's ID.

### `src/app/actions/organization/roles.ts` — Role events (5 events)

| actionKey                  | Function           | entityType | entityId    | targetType | targetId | branchId                |
| -------------------------- | ------------------ | ---------- | ----------- | ---------- | -------- | ----------------------- |
| `org.role.created`         | `createRoleAction` | `"role"`   | new role id | —          | —        | —                       |
| `org.role.updated`         | `updateRoleAction` | `"role"`   | roleId      | —          | —        | —                       |
| `org.role.deleted`         | `deleteRoleAction` | `"role"`   | roleId      | —          | —        | —                       |
| `org.member.role_assigned` | `assignRoleAction` | `"role"`   | roleId      | `"user"`   | userId   | scopeId if scope=branch |
| `org.member.role_assigned` | `removeRoleAction` | `"role"`   | roleId      | `"user"`   | userId   | scopeId if scope=branch |

**Note:** `removeRoleAction` emits `org.member.role_assigned` (same actionKey as assign). There is no separate `org.member.role_removed` action key in the registry or in the emission code. The distinction is in `metadata.action = "removed"` vs `"assigned"` (if present — exact metadata fields per registry schema).

**branchId propagation:** When `scope === "branch"`, `branchId: scopeId` is passed to emit. When `scope === "org"`, `branchId` is omitted/null.

### `src/app/actions/organization/branches.ts` — Branch events (3 events)

| actionKey            | Function             | branchId                | metadata                                     |
| -------------------- | -------------------- | ----------------------- | -------------------------------------------- |
| `org.branch.created` | `createBranchAction` | `result.data.id`        | `{ branch_id, branch_name }`                 |
| `org.branch.updated` | `updateBranchAction` | `branchId` (from input) | `{ branch_id, branch_name, updated_fields }` |
| `org.branch.deleted` | `deleteBranchAction` | `parsed.data.branchId`  | `{ branch_id, branch_name }`                 |

**`org.branch.deleted`:** Branch name pre-fetched from `branches` table before delete. Falls back to `branchId` string if name unavailable.

All branch events: `actorType: "user"`, `actorUserId: context.user.user?.id ?? null`, `entityType: "branch"`, `entityId` = same as `branchId`.

---

## 10. Projection Layer (`src/server/audit/projection.ts`)

File imports `"server-only"` sentinel.

### `projectEvents(input: { rows: PlatformEventRow[]; context: ProjectionContext }): ProjectionResult`

```typescript
type ProjectionResult = {
  events: ProjectedEvent[];
  total: number;
  hasMore: boolean;
};
```

### SCOPE_QUALIFIERS mapping

```typescript
const SCOPE_QUALIFIERS = {
  personal: ["self"],
  org: ["self", "org_member", "org_admin"],
  audit: ["self", "org_member", "org_admin", "auditor"],
};
```

### Projection pipeline (per-row, in order)

**Step 1 — Registry lookup**
Skips row if `action_key` not in `EVENT_REGISTRY`.

**Step 2 — Visibility filter**
Checks intersection of `entry.visibleTo` and `SCOPE_QUALIFIERS[feedScope]`. Skips if no intersection.

**Step 3 — Personal actor guard** (personal feed only)
For `feedScope === "personal"`: skips row if `row.actor_user_id !== context.viewerUserId`. This ensures personal feed only shows the viewer's own events.

**Step 4 — Summary generation**
Fills `summaryTemplate` with `{{actor}}`, `{{entity}}`, `{{target}}` placeholders. Fallback values:

- `{{actor}}` → `actor_user_id ?? actor_type`
- `{{entity}}` → `entity_id ?? "unknown"`
- `{{target}}` → `target_id ?? "unknown"`

**Step 5 — Metadata projection**
For non-audit scopes: `sensitiveFields` values are stripped from `metadata`. For `auth.*` events this means `ip_address` and `user_agent` are removed from metadata.

**Step 6 — IP/UA gating**
`ip_address` and `user_agent` columns are included in `ProjectedEvent` ONLY when `feedScope === "audit"`. For personal and org feeds, these fields are physically absent from the returned object (not set to null).

**Step 7 — Pagination**
After all filtering:

- `total` = count of all rows that passed filters
- `paginated` = `.slice(offset, offset + limit)`
- `hasMore` = `(offset + limit) < total`

---

## 11. Feed Actions

### `src/app/actions/audit/_query.ts`

**Constants:**

```typescript
const MAX_FETCH_LIMIT = 500;
```

**`computeFetchLimit(offset: number, limit: number): number`**

```typescript
return Math.min((offset + limit) * 2, MAX_FETCH_LIMIT);
```

Ensures enough rows are fetched from DB to project down to the desired page.

**`validatePagination(offset: number, limit: number): { offset: number; limit: number }`**
Clamps `limit` to `[1, 50]`. Clamps `offset` to `>= 0`.

**`fetchPlatformEvents(supabase, orgId, fetchLimit)`**
Uses RLS client. Queries `platform_events WHERE organization_id = orgId ORDER BY created_at DESC LIMIT fetchLimit`.

**`fetchPersonalOrgNullEvents(serviceRoleClient, actorUserId, fetchLimit)`**
Uses service-role client (bypasses RLS). Queries `platform_events WHERE organization_id IS NULL AND actor_user_id = actorUserId ORDER BY created_at DESC LIMIT fetchLimit`. Actor filter applied at query level.

**`mergeAndSortEvents(orgRows, orgNullRows)`**
Merges two arrays, sorts by `created_at DESC`.

### `src/app/actions/audit/get-personal-activity.ts`

**Permission:** None (authenticated user only; RLS enforces org membership).

**Query strategy:** Two-query merge.

1. `fetchPlatformEvents(rlsClient, orgId, fetchLimit)` — org-scoped events
2. `fetchPersonalOrgNullEvents(serviceRoleClient, userId, fetchLimit)` — org-null auth events

Org-null query failure is non-fatal: logs `console.warn`, continues with org rows only.

**Projection scope:** `"personal"`.

### `src/app/actions/audit/get-org-activity.ts`

**Permission:** `ORG_READ` (checked via `checkPermission(snapshot, ORG_READ)`).

**Query strategy:** Single query via `fetchPlatformEvents(rlsClient, orgId, fetchLimit)`.

**Projection scope:** `"org"`.

No org-null merge. No service-role client used.

### `src/app/actions/audit/get-audit-feed.ts`

**Permission:** `AUDIT_EVENTS_READ` (`"audit.events.read"`).

**Query strategy:** Single query via `fetchPlatformEvents(rlsClient, orgId, fetchLimit)`.

**Projection scope:** `"audit"`.

Output includes `ip_address` and `user_agent` in `ProjectedEvent`. Full metadata (no sensitive field stripping).

---

## 12. Frontend Pages

### `/dashboard/activity` — Personal Activity

File: `src/app/[locale]/dashboard/activity/page.tsx`

- Calls `getPersonalActivityAction`
- Renders `<EventFeedClient>` with `feedScope="personal"`
- No permission gate at page level (authenticated access only)

### `/dashboard/organization/activity` — Org Activity

File: `src/app/[locale]/dashboard/organization/activity/page.tsx`

- Calls `getOrgActivityAction`
- Renders `<EventFeedClient>` with `feedScope="org"`
- Permission gate: `ORG_READ` (if missing, redirect or access denied)

### `/dashboard/organization/audit` — Audit Feed

File: `src/app/[locale]/dashboard/organization/audit/page.tsx`

- Calls `getAuditFeedAction`
- Renders `<EventFeedClient>` with `feedScope="audit"`
- Permission gate: `AUDIT_EVENTS_READ` (`"audit.events.read"`)

### Shared component: `<EventFeedClient>`

File: `src/app/[locale]/dashboard/activity/_components/event-feed-client.tsx`

- Accepts `initialEvents`, `initialTotal`, `initialHasMore`, `feedScope`
- Handles pagination (load-more button)
- Calls appropriate feed action on load-more based on `feedScope`
- Renders event cards with `summary`, `created_at`, `action_key`, `actor_user_id`

---

## 13. Test Coverage

### `src/server/audit/__tests__/event-registry.test.ts`

Suite prefix: `T-REGISTRY-*`

| Suite                 | Description                                                                                                                      |
| --------------------- | -------------------------------------------------------------------------------------------------------------------------------- |
| `T-REGISTRY-CONTRACT` | Per-entry structural checks: required fields, valid eventTier, non-empty visibleTo, valid visibleTo values, Zod schema parseable |
| `T-REGISTRY-LOOKUP`   | Positive lookup returns entry; negative lookup returns undefined                                                                 |
| `T-REGISTRY-SCHEMA`   | Each entry's metadataSchema accepts empty object `{}`                                                                            |
| `T-REGISTRY-COVERAGE` | Asserts exactly 20 entries in EVENT_REGISTRY                                                                                     |

### `src/server/audit/__tests__/projection.test.ts`

Suite prefix: `T-PROJECTION-*`

| Suite                         | Description                                                             |
| ----------------------------- | ----------------------------------------------------------------------- |
| `T-PROJECTION-VISIBILITY`     | Events filtered by visibleTo × SCOPE_QUALIFIERS intersection            |
| `T-PROJECTION-PERSONAL-GUARD` | Personal feed drops events where actor_user_id ≠ viewerUserId           |
| `T-PROJECTION-SUMMARY`        | Template placeholder substitution for {{actor}}, {{entity}}, {{target}} |
| `T-PROJECTION-SENSITIVE`      | sensitiveFields stripped from metadata on non-audit scopes              |
| `T-PROJECTION-IP-UA`          | ip/ua absent on personal/org, present on audit                          |
| `T-PROJECTION-PAGINATION`     | total/hasMore/slice correct                                             |
| `T-PROJECTION-UNKNOWN-KEY`    | Rows with unregistered action_key skipped                               |

### `src/server/audit/__tests__/event-system-phase6.test.ts`

Suite prefix: `T-INTEGRATION`, `T-REQUEST-CORRELATION`, `T-ROLLBACK-CONSISTENCY`, `T-APPEND-ONLY`, `T-LOGOUT-PIPELINE`

| Suite                    | Description                                                 |
| ------------------------ | ----------------------------------------------------------- |
| `T-INTEGRATION`          | emit() returns eventId; DB row present with correct columns |
| `T-REQUEST-CORRELATION`  | Two emits with same requestId; both rows share requestId    |
| `T-ROLLBACK-CONSISTENCY` | Domain action success independent of emit failure           |
| `T-APPEND-ONLY`          | No UPDATE/DELETE on platform_events                         |
| `T-LOGOUT-PIPELINE`      | auth.session.revoked emitted on signOut                     |

### `src/app/actions/audit/__tests__/feed-actions.test.ts`

Suite prefix: `T-FEED-*`

| Suite                          | Description                                                     |
| ------------------------------ | --------------------------------------------------------------- |
| `T-FEED-ACTIONS-PERSONAL`      | Personal feed: org + org-null merge; org-null failure non-fatal |
| `T-FEED-ACTIONS-ORG`           | Org feed: permission check; single query; projection scope=org  |
| `T-FEED-ACTIONS-AUDIT`         | Audit feed: AUDIT_EVENTS_READ check; ip/ua in output            |
| `T-FEED-QUERY-HELPER`          | computeFetchLimit formula; mergeAndSortEvents ordering          |
| `T-FEED-PAGINATION-VALIDATION` | validatePagination clamps; invalid inputs normalized            |

### `src/app/actions/__tests__/event-wiring.test.ts`

Suite prefix: `T-WIRING-*`

Total test count at time of extraction: **58 tests** (57 original + 1 added for actor model guard).

| Suite                  | Description                                                                                                |
| ---------------------- | ---------------------------------------------------------------------------------------------------------- |
| `T-WIRING-AUTH`        | 5 auth events wired correctly; IP/UA from headers                                                          |
| `T-WIRING-ONBOARDING`  | org.created + org.onboarding.completed; shared requestId; actor model guard (null user skips emit + warns) |
| `T-WIRING-PROFILE`     | 3 emit sites for org.updated                                                                               |
| `T-WIRING-INVITATIONS` | invited/cancelled/accepted with correct entity/target                                                      |
| `T-WIRING-MEMBERS`     | org.member.removed                                                                                         |
| `T-WIRING-ROLES`       | 5 role events including assign/remove                                                                      |
| `T-WIRING-BRANCHES`    | 3 branch events; pre-fetch pattern for deleted name                                                        |

---

## 14. Observed Behaviors and Open Questions

The following items were observed during extraction. They are stated as facts, not recommendations.

### A. `org.member.role_removed` missing from registry

The registry has 20 entries. `org.member.role_removed` is NOT one of them. The `removeRoleAction` in `roles.ts` emits `org.member.role_assigned` for both assign and remove operations. It is unclear whether this is intentional (single event key for both directions) or an omission.

### B. `org.deleted` not registered

There is no `org.deleted` entry in EVENT_REGISTRY. Organization deletion, if it exists as an action, is not wired to the event system.

### C. `auth.login.failed` actor model

`auth.login.failed` is emitted with `actorType: "user"`. For a failed login, the user may not be authenticated. The `actorUserId` in this case may be the email-lookup user id if available, or null. The exact handling in `actions.ts` was not verified line-by-line for this case.

### D. eventTier caller override ignored

`EmitEventInput.eventTier` is accepted as input but the service ignores it — the registry's `eventTier` is always used. All callers that pass `eventTier` have their value silently discarded.

### E. Metadata schema mismatch potential

`org.member.role_assigned` is used for both assign and remove in `roles.ts`. The metadata schema for this key does not have an explicit `action` field. The distinction between assign/remove is not captured in metadata schema — only in the calling function's context.

### F. `resendInvitationAction` has no event emission

`resendInvitationAction` in `invitations.ts` sends a new invitation email and refreshes the token, but emits no event. No `org.invitation.resent` action key exists in the registry.

### G. `declineInvitationAction` has no event emission

`declineInvitationAction` in `invitations.ts` calls the `decline_invitation` RPC but emits no event. No `org.invitation.declined` action key exists in the registry.

### H. Service-role client in emit

`event.service.ts` creates a new service-role Supabase client for every emit call. This bypasses RLS and uses the `SUPABASE_SERVICE_ROLE_KEY` environment variable. The client is created inline (not injected).

### I. `branch_id` FK not in DB constraints

The DB constraints list (Section 2) shows no foreign key from `platform_events.branch_id` to `branches.id`. The `branch_id` column exists but has no FK constraint enforced at DB level.

### J. No `forensic` tier events currently wired

`auth.session.revoked` is the only `forensic` tier event in the registry. It is wired in `actions.ts`. All other emission sites use `baseline` or `enhanced`. No Mode B (atomic DB-side) path is implemented; all forensic events go through the same Mode A best-effort path.
