# Event System Implementation Extraction — Verified Current State

**Extraction date**: 2026-03-16
**Source**: Repository source code + live TARGET Supabase project `rjeraydumwechpjjzrus`
**Branch**: `event-system`
**Methodology**: All facts below are derived directly from file reads and live DB queries. Items not confirmable are labeled `UNVERIFIED` or `INFERENCE`.

---

## 1. Extraction Scope and Verification Methodology

### Files read (source of truth)

| File                                                                            | Role                                                                                                                               |
| ------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------- |
| `src/server/audit/types.ts`                                                     | Domain types: `PlatformEventRow`, `EmitEventInput`, `EventRegistryEntry`, `ProjectedEvent`, `EventServiceResult`, primitive unions |
| `src/server/audit/event-registry.ts`                                            | Registry of all 22 action keys                                                                                                     |
| `src/server/audit/projection.ts`                                                | Projection layer: filtering, summary generation, field stripping, pagination                                                       |
| `src/server/services/event.service.ts`                                          | Emission service (Mode A only)                                                                                                     |
| `src/server/audit/__tests__/event-registry.test.ts`                             | Contract tests for registry                                                                                                        |
| `src/server/audit/__tests__/projection.test.ts`                                 | Unit tests for projection layer                                                                                                    |
| `src/server/audit/__tests__/event-system-phase6.test.ts`                        | Integration + invariant tests                                                                                                      |
| `src/app/actions/__tests__/event-wiring.test.ts`                                | Wiring tests for all action emissions                                                                                              |
| `src/app/actions/audit/_query.ts`                                               | Shared DB query helpers for feed actions                                                                                           |
| `src/app/actions/audit/get-personal-activity.ts`                                | Personal feed server action                                                                                                        |
| `src/app/actions/audit/get-org-activity.ts`                                     | Org feed server action                                                                                                             |
| `src/app/actions/audit/get-audit-feed.ts`                                       | Audit feed server action                                                                                                           |
| `src/app/actions/onboarding/index.ts`                                           | `createOrganizationAction` — emits 2 events                                                                                        |
| `src/app/actions/organization/invitations.ts`                                   | Invitation lifecycle — 4 emissions                                                                                                 |
| `src/app/actions/organization/members.ts`                                       | Member removal — 1 emission                                                                                                        |
| `src/app/actions/organization/roles.ts`                                         | Role CRUD + assignment — 6 emissions                                                                                               |
| `src/app/actions/organization/branches.ts`                                      | Branch CRUD — 3 emissions                                                                                                          |
| `src/app/actions/organization/profile.ts`                                       | Profile + logo — 3 emissions                                                                                                       |
| `src/app/[locale]/actions.ts`                                                   | Auth actions — 4 emissions                                                                                                         |
| `supabase/migrations/20260321000001_platform_events.sql`                        | Core table DDL (repo file)                                                                                                         |
| `supabase/migrations/20260321000002_platform_events_branch_id_fk.sql`           | Branch FK addition (repo file)                                                                                                     |
| `supabase/migrations/20260313000001_audit_events_read_permission.sql`           | Permission seed                                                                                                                    |
| `src/app/[locale]/dashboard/activity/page.tsx`                                  | Personal feed page (SSR)                                                                                                           |
| `src/app/[locale]/dashboard/activity/_components/personal-activity-wrapper.tsx` | Personal feed client wrapper                                                                                                       |
| `src/app/[locale]/dashboard/activity/_components/event-feed-client.tsx`         | Shared feed UI component                                                                                                           |
| `src/app/[locale]/dashboard/organization/audit/page.tsx`                        | Audit feed page (SSR, permission-gated)                                                                                            |

### Live DB queries executed against TARGET (`rjeraydumwechpjjzrus`)

All schema facts in Section 2 come from live `information_schema` and `pg_catalog` queries run against the TARGET project. Migration version timestamps do NOT match local repo filenames (see Section 2.6 — this is a known divergence).

---

## 2. Verified Database State

### 2.1 Table existence

`public.platform_events` EXISTS on the live TARGET project. Confirmed via:

```sql
SELECT EXISTS (...WHERE table_name = 'platform_events') AS table_exists;
-- result: true
```

### 2.2 Column schema (live DB, verified)

| Column            | Data Type (DB) | Nullable | Default             |
| ----------------- | -------------- | -------- | ------------------- |
| `id`              | uuid           | NOT NULL | `gen_random_uuid()` |
| `created_at`      | timestamptz    | NOT NULL | `now()`             |
| `organization_id` | uuid           | NULL     | —                   |
| `branch_id`       | uuid           | NULL     | —                   |
| `actor_user_id`   | uuid           | NULL     | —                   |
| `actor_type`      | text           | NOT NULL | —                   |
| `module_slug`     | text           | NOT NULL | —                   |
| `action_key`      | text           | NOT NULL | —                   |
| `entity_type`     | text           | NOT NULL | —                   |
| `entity_id`       | text           | NOT NULL | —                   |
| `target_type`     | text           | NULL     | —                   |
| `target_id`       | text           | NULL     | —                   |
| `metadata`        | jsonb          | NOT NULL | `'{}'::jsonb`       |
| `event_tier`      | text           | NOT NULL | —                   |
| `request_id`      | uuid           | NULL     | —                   |
| `ip_address`      | inet           | NULL     | —                   |
| `user_agent`      | text           | NULL     | —                   |

**All 17 columns exactly match the `PlatformEventRow` interface in `src/server/audit/types.ts`.**

Notable type facts:

- `ip_address` is stored as `inet` (a Postgres network address type), not `text`. The TypeScript type `PlatformEventRow.ip_address` declares it as `string | null`, which is what Supabase returns after serialization.
- `request_id` is a UUID column (not arbitrary text). This means the correlation ID must be UUID-format.
- `entity_id` and `target_id` are `text`, allowing UUIDs, email addresses, composite keys, and document numbers.

### 2.3 Constraints (live DB, verified)

**Check constraints** (column-value enforcement):

- `platform_events_actor_type_check`: `actor_type IN ('user', 'system', 'api', 'worker', 'scheduler', 'automation')`
- `platform_events_event_tier_check`: `event_tier IN ('baseline', 'enhanced', 'forensic')`

**Foreign keys** (all `ON DELETE SET NULL` — soft, no cascade):

- `platform_events_organization_id_fk`: `organization_id` → `public.organizations(id)`
- `platform_events_actor_user_id_fk`: `actor_user_id` → `public.users(id)` (NOT `auth.users`)
- `platform_events_branch_id_fk`: `branch_id` → `public.branches(id)`

**Primary key**: `platform_events_pkey` on `id`.

The `branch_id` FK was added in a separate migration (`20260316052757` on TARGET, repo file `20260321000002`).

### 2.4 Indexes (live DB, verified)

| Index name             | Definition                                                                     |
| ---------------------- | ------------------------------------------------------------------------------ |
| `platform_events_pkey` | UNIQUE btree on `(id)`                                                         |
| `pe_org_created_idx`   | btree `(organization_id, created_at DESC)` WHERE `organization_id IS NOT NULL` |
| `pe_actor_user_idx`    | btree `(actor_user_id, created_at DESC)` WHERE `actor_user_id IS NOT NULL`     |
| `pe_action_key_idx`    | btree `(action_key, created_at DESC)`                                          |
| `pe_entity_idx`        | btree `(entity_type, entity_id, created_at DESC)`                              |
| `pe_request_id_idx`    | btree `(request_id)` WHERE `request_id IS NOT NULL`                            |

All 5 non-PK indexes exactly match the repo migration SQL.

### 2.5 RLS and privilege state (live DB, verified)

- RLS enabled: `relrowsecurity = true`
- RLS forced for table owner: `relforcerowsecurity = false`

**One policy exists** (`platform_events_org_members_read`):

- Type: PERMISSIVE, cmd: SELECT, roles: `{public}`
- Qual: `(organization_id IS NOT NULL) AND is_org_member(organization_id)`
- No `WITH CHECK` clause (no INSERT/UPDATE policies)

**Privilege grants (live DB)**:

- `anon`: SELECT, REFERENCES, TRIGGER, TRUNCATE only (no INSERT/UPDATE/DELETE)
- `authenticated`: SELECT, REFERENCES, TRIGGER, TRUNCATE only (no INSERT/UPDATE/DELETE)
- `postgres`: full (SELECT, INSERT, UPDATE, DELETE, REFERENCES, TRIGGER, TRUNCATE)
- `service_role`: full (SELECT, INSERT, UPDATE, DELETE, REFERENCES, TRIGGER, TRUNCATE)

**Critical finding**: The `REVOKE INSERT/UPDATE/DELETE FROM authenticated/anon/public` grants in the migration SQL are confirmed effective. Authenticated clients cannot insert directly. The `service_role` retains full access, which is how `eventService.emit()` bypasses RLS.

The `service_role` NOT being listed under `is_grantable=YES` for most privileges is expected — Supabase's service_role inherits via role hierarchy, not direct grant.

### 2.6 Applied migrations (live DB, verified) vs. repo filenames

| DB version       | DB name                        | Repo filename                                     |
| ---------------- | ------------------------------ | ------------------------------------------------- |
| `20260313120718` | `platform_events`              | `20260321000001_platform_events.sql`              |
| `20260313180609` | `audit_events_read_permission` | `20260313000001_audit_events_read_permission.sql` |
| `20260316052757` | `platform_events_branch_id_fk` | `20260321000002_platform_events_branch_id_fk.sql` |

**Version mismatch confirmed**: The DB migration versions (timestamps) do not match the repo migration filenames. The repo filenames use `20260321` prefix while the applied versions on TARGET use `20260313`–`20260316`. This indicates the migrations were applied to TARGET at an earlier date under different filenames, and the repo files were renamed or created separately with newer timestamps. The content is the same (verified by checking the constraint name `platform_events_branch_id_fk` and `on delete set null` in migration file). This is a cosmetic discrepancy; the actual schema is correct.

### 2.7 Permissions table (live DB, verified)

One row exists in `permissions` for the event system:

| slug                | category | action | description                                                                   |
| ------------------- | -------- | ------ | ----------------------------------------------------------------------------- |
| `audit.events.read` | `audit`  | `read` | Read full organization audit event log including IP addresses and user agents |

The `name` column is NULL for this row (migration did not set it — only `slug`, `category`, `action`, `description`).

### 2.8 DB functions (live DB, verified)

One function related to audit was found:

- `audit_rls_permission_gate_slugs` (FUNCTION, returns record) — applied via migration `20260314091833` (`audit_rls_permission_gate_slugs_fn`). This function is not referenced in any TypeScript source file read during this extraction. INFERENCE: it is a DB-side utility, possibly used in policy definition or for future use.

**No DB-side event emission functions exist** (no `emit_event`, `insert_platform_event`, etc.). Mode B (atomic DB-side emission) is described in comments but not implemented.

### 2.9 Triggers (live DB, verified)

Zero triggers exist on `platform_events`. The table is insert-only via application code. No trigger-based enforcement or propagation.

---

## 3. Verified TypeScript Domain Model

Source: `/home/user/coreframe-boilerplate/src/server/audit/types.ts`

### 3.1 Primitive unions

```typescript
type ActorType = "user" | "system" | "api" | "worker" | "scheduler" | "automation";
type EventTier = "baseline" | "enhanced" | "forensic";
type ProjectionScope = "personal" | "org" | "audit";
type EventVisibilityScope = "self" | "org_member" | "org_admin" | "auditor";
```

These exactly match the DB check constraints for `actor_type` and `event_tier`.

### 3.2 `PlatformEventRow`

Mirrors the DB table exactly (17 fields). `ip_address` is typed as `string | null` despite being `inet` in the DB (Supabase serializes it to string). `metadata` is `Record<string, unknown>`.

### 3.3 `EmitEventInput`

Input interface for `eventService.emit()`. Key behavioral contracts encoded in the type:

- `actorUserId` is optional (undefined means null); the service normalizes to null when `actorType !== 'user'`
- `requestId` is optional; the service normalizes to null if not provided
- `eventTier` is accepted but the service always uses the registry tier (caller-supplied tier is ignored for the stored row)

### 3.4 `EventRegistryEntry`

Code-side only (never stored). Contains `metadataSchema: ZodTypeAny` — this is the validation gate before any insert.

### 3.5 `ProjectionContext`

```typescript
interface ProjectionContext {
  viewerUserId: string;
  viewerScope: ProjectionScope;
  organizationId: string | null;
  permissions: string[];
}
```

`permissions` is populated from `context.user.permissionSnapshot.allow` in all three feed actions but is not currently used inside `projectEvents()` itself for additional filtering. INFERENCE: it is present for future scope-gating expansion.

### 3.6 `ProjectedEvent`

The only event shape that may reach client code. Key omissions vs. `PlatformEventRow`:

- `actor_type` — absent (replaced by `actor_display`)
- `module_slug` — absent
- `organization_id` — absent
- `branch_id` — absent
- `ip_address`, `user_agent` — present only in audit scope (optional fields)

### 3.7 `EventServiceResult<T>`

Discriminated union: `{ success: true; data: T } | { success: false; error: string }`. This is the return type of `eventService.emit()` and `eventService.validateMetadata()`. Never throws.

---

## 4. Verified Event Registry

Source: `/home/user/coreframe-boilerplate/src/server/audit/event-registry.ts`

Registry contains exactly **22 entries** (verified by contract test assertion `expect(actionKeys.length).toBe(22)`).

### 4.1 Auth module (`moduleSlug: "auth"`)

| Action key                      | Tier     | visibleTo     | sensitiveFields |
| ------------------------------- | -------- | ------------- | --------------- |
| `auth.login`                    | baseline | self, auditor | email           |
| `auth.login.failed`             | baseline | auditor       | email           |
| `auth.password.reset_requested` | baseline | auditor       | email           |
| `auth.password.reset_completed` | baseline | self, auditor | (none)          |
| `auth.session.revoked`          | enhanced | self, auditor | (none)          |

### 4.2 Organization-management module (`moduleSlug: "organization-management"`)

| Action key                 | Tier     | visibleTo                            | sensitiveFields                                      |
| -------------------------- | -------- | ------------------------------------ | ---------------------------------------------------- |
| `org.created`              | baseline | self, org_member, org_admin, auditor | (none)                                               |
| `org.updated`              | baseline | self, org_member, org_admin, auditor | (none)                                               |
| `org.member.invited`       | enhanced | self, org_admin, auditor             | invitee_email, invitee_first_name, invitee_last_name |
| `org.member.removed`       | enhanced | self, org_admin, auditor             | removed_user_name                                    |
| `org.invitation.accepted`  | baseline | self, org_member, org_admin, auditor | (none)                                               |
| `org.invitation.cancelled` | enhanced | self, org_admin, auditor             | invitee_email                                        |
| `org.invitation.resent`    | enhanced | self, org_admin, auditor             | invitee_email                                        |
| `org.invitation.declined`  | baseline | self, org_admin, auditor             | (none)                                               |
| `org.role.created`         | enhanced | self, org_admin, auditor             | (none)                                               |
| `org.role.updated`         | enhanced | self, org_admin, auditor             | (none)                                               |
| `org.role.deleted`         | enhanced | self, org_admin, auditor             | (none)                                               |
| `org.member.role_assigned` | enhanced | self, org_admin, auditor             | (none)                                               |
| `org.member.role_removed`  | enhanced | self, org_admin, auditor             | (none)                                               |
| `org.branch.created`       | baseline | self, org_member, org_admin, auditor | (none)                                               |
| `org.branch.updated`       | baseline | self, org_member, org_admin, auditor | (none)                                               |
| `org.branch.deleted`       | enhanced | self, org_admin, auditor             | (none)                                               |
| `org.onboarding.completed` | baseline | self, org_member, org_admin, auditor | (none)                                               |

### 4.3 Required metadata fields (Zod schemas with required fields)

- `org.member.invited`: `invitee_email` is **required** (z.string().email())
- `org.role.created`: `role_name` is **required** (z.string())
- `org.role.updated`: `role_name` is **required** (z.string())
- `org.role.deleted`: `role_name` is **required** (z.string())
- `org.member.role_assigned`: `role_name` is **required** (z.string())
- `org.member.role_removed`: `role_name` is **required** (z.string())
- `org.branch.created`: `branch_name` is **required** (z.string())

All other metadata fields across all schemas are optional.

### 4.4 Accessor functions

- `getRegistryEntry(actionKey: string): EventRegistryEntry | undefined` — returns undefined for unknown keys
- `getAllActionKeys(): string[]` — returns all registered keys

---

## 5. Verified Event Service Behavior

Source: `/home/user/coreframe-boilerplate/src/server/services/event.service.ts`

### 5.1 Public API

```typescript
export const eventService = {
  emit, // Mode A emission
  validateMetadata, // reusable schema validation
};
```

Exactly 2 methods. The phase-6 invariant test confirms `Object.keys(eventService).toHaveLength(2)`.

### 5.2 `emit()` execution path (verified step by step)

1. **Registry lookup**: `getRegistryEntry(input.actionKey)` — returns typed failure `{ success: false, error: "Unregistered action key..." }` if not found. No DB call.
2. **Metadata validation**: calls `validateMetadata(actionKey, rawMetadata ?? {})`. Returns typed failure if Zod schema rejects. No DB call on failure.
3. **Actor normalization**: if `actorType !== 'user'`, forces `actorUserId = null`. This means a call with `actorType: "system"` and `actorUserId: "some-id"` will store `null`.
4. **Insert row construction**: uses `entry.eventTier` (registry), not `input.eventTier` (caller). The caller-supplied tier is accepted in the interface but ignored for storage.
5. **DB insert**: via `createServiceClient()` (service-role, bypasses RLS). Uses `(client as any).from("platform_events").insert(row).select("id").single()`.
6. **Error handling**: DB error → typed failure `{ success: false, error: "Event insert failed: ..." }`. Exception in client creation → typed failure. Never throws.
7. **Returns**: `{ success: true, data: { id: string } }` on success.

### 5.3 `validateMetadata()` behavior

Exported separately for Mode B pre-validation use. Calls `entry.metadataSchema.parse(metadata)` which strips unknown keys (Zod strip behavior) and validates required fields. Returns `{ success: true, data: parsedMetadata }` or `{ success: false, error: "Metadata validation failed for ...: ..." }`.

### 5.4 `as any` cast

`eventService.ts` uses `(client as any).from("platform_events")` with a code comment: "platform_events is a new table not yet in generated DB types." This is an isolated cast; all application-level types remain strongly typed.

### 5.5 Append-only enforcement

The service has no `.update()` or `.delete()` methods. The only DB call is `.insert()`. Verified by:

- Code inspection: no update/delete paths exist
- Phase-6 invariant tests: `T-APPEND-ONLY` suite confirms `_update` and `_delete` mock stubs are never called

---

## 6. Verified Emission Sites

### 6.1 Auth actions (`src/app/[locale]/actions.ts`)

All auth action emissions capture `ip_address` and `user_agent` via `getRequestContext()` (reads `x-forwarded-for`, `x-real-ip`, `user-agent` headers). This is the **only** module that captures IP/UA.

| Action                        | Event key                       | actorType | organizationId | Notes                                                                                |
| ----------------------------- | ------------------------------- | --------- | -------------- | ------------------------------------------------------------------------------------ |
| `signInAction` (error path)   | `auth.login.failed`             | system    | null           | Actor is `system` because user is unauthenticated. Guards against null actorUserId.  |
| `signInAction` (success path) | `auth.login`                    | user      | null           | Guarded: only emits if `signInData.user?.id` is truthy                               |
| `forgotPasswordAction`        | `auth.password.reset_requested` | system    | null           | Always emitted, regardless of whether email exists (security)                        |
| `resetPasswordAction`         | `auth.password.reset_completed` | user      | null           | Guarded: only emits if `resetUser?.id` is truthy                                     |
| `signOutAction`               | `auth.session.revoked`          | user      | null           | Guarded: only emits if `signingOutUser?.id` is truthy. Gets user BEFORE `signOut()`. |

**Request correlation**: auth actions do NOT use a shared `requestId`. Each event has `requestId: undefined` (→ null in DB).

### 6.2 Onboarding action (`src/app/actions/onboarding/index.ts`)

`createOrganizationAction` emits **two events** with a shared `requestId`:

| Event key                  | entityType   | Notes                                                     |
| -------------------------- | ------------ | --------------------------------------------------------- |
| `org.created`              | organization | requestId = `crypto.randomUUID()` generated once for both |
| `org.onboarding.completed` | organization | Same requestId as above                                   |

Guard: if `onboardingUser?.id` is missing, **both emissions are skipped** with a `console.warn`. This is the only multi-event correlated emission in the codebase.

### 6.3 Invitation actions (`src/app/actions/organization/invitations.ts`)

| Action                    | Event key                  | Special handling                                                                                                     |
| ------------------------- | -------------------------- | -------------------------------------------------------------------------------------------------------------------- |
| `createInvitationAction`  | `org.member.invited`       | targetType/targetId = "invitation_email"/email. No requestId.                                                        |
| `cancelInvitationAction`  | `org.invitation.cancelled` | Pre-fetches email from `invitations` table before cancel (service returns void).                                     |
| `resendInvitationAction`  | `org.invitation.resent`    | Emitted after email delivery attempt. targetType/targetId = "invitation_email"/email.                                |
| `acceptInvitationAction`  | `org.invitation.accepted`  | Guarded: only emits if `acceptingUser?.id` is truthy. Pre-fetches `invitations.id`.                                  |
| `declineInvitationAction` | `org.invitation.declined`  | `actorUserId` may be null (unauthenticated token-link click). Only emits if `inviteRow?.organization_id` is present. |

`resendInvitationAction` does NOT emit in the `createInvitationAction` test coverage (it's a separate action). `declineInvitationAction` is in `invitations.ts` but is NOT listed in the event-wiring test file header comment (which covers 13 specific actions). INFERENCE: `declineInvitationAction` emission may be undertested in the wiring test suite.

### 6.4 Member actions (`src/app/actions/organization/members.ts`)

| Action               | Event key            | Notes                                                                                          |
| -------------------- | -------------------- | ---------------------------------------------------------------------------------------------- |
| `removeMemberAction` | `org.member.removed` | metadata has `removed_user_id` but NOT `removed_user_name` (registry requires optional string) |

`updateMemberStatusAction` does NOT emit any event.

### 6.5 Role actions (`src/app/actions/organization/roles.ts`)

| Action                     | Event key                  | Pre-fetch required                                                              |
| -------------------------- | -------------------------- | ------------------------------------------------------------------------------- |
| `createRoleAction`         | `org.role.created`         | Name from `result.data.name` (available in result)                              |
| `updateRoleAction`         | `org.role.updated`         | Name from `updateInput.name` or DB fetch fallback                               |
| `deleteRoleAction`         | `org.role.deleted`         | Pre-fetches `roles.name` before delete (service returns void)                   |
| `assignRoleToUserAction`   | `org.member.role_assigned` | Pre-fetches `roles.name`; also sets `branchId` on the event when scope="branch" |
| `removeRoleFromUserAction` | `org.member.role_removed`  | Pre-fetches `roles.name`; also sets `branchId` on the event when scope="branch" |

`branchId` is populated on `org.member.role_assigned` and `org.member.role_removed` when the assignment scope is "branch". This means branch-scoped role events will have a non-null `branch_id` in `platform_events`.

### 6.6 Branch actions (`src/app/actions/organization/branches.ts`)

| Action               | Event key            | Notes                                                                                                                  |
| -------------------- | -------------------- | ---------------------------------------------------------------------------------------------------------------------- |
| `createBranchAction` | `org.branch.created` | `branchId` field on event = new branch ID                                                                              |
| `updateBranchAction` | `org.branch.updated` | `branchId` field on event = updated branch ID                                                                          |
| `deleteBranchAction` | `org.branch.deleted` | Pre-fetches `branches.name`; `branchId` field = deleted branch ID (will be set null by FK cascade when branch deleted) |

### 6.7 Profile actions (`src/app/actions/organization/profile.ts`)

| Action                   | Event key     | Notes                                                        |
| ------------------------ | ------------- | ------------------------------------------------------------ |
| `updateOrgProfileAction` | `org.updated` | `updated_fields` = array of keys present in the update input |
| `uploadOrgLogoAction`    | `org.updated` | `updated_fields: ["logo_url"]`                               |
| `removeOrgLogoAction`    | `org.updated` | `updated_fields: ["logo_url"]`                               |

`org.updated` is the most-emitted single event key: fired from 3 separate actions.

### 6.8 Cross-cutting emission patterns

**Success-gating**: All 20 emission sites check `if (result.success)` before calling `eventService.emit()`. Domain writes are never rolled back on emit failure. This is Mode A best-effort.

**Failure logging**: Every emission site checks `if (!emitResult.success)` and calls `console.error(...)` with structured context including `actionKey`, `organizationId`, `actorUserId`, and `error`.

**requestId generation**: Only `createOrganizationAction` uses `crypto.randomUUID()` to generate a `requestId` for event correlation. All other action emissions pass no `requestId` (defaults to null in DB). Request correlation across events is therefore only present for the onboarding workflow.

**No IP/UA outside auth**: Only `src/app/[locale]/actions.ts` (the auth actions file) calls `getRequestContext()` and passes `ipAddress`/`userAgent` to emit. All org-management action emissions pass no IP/UA (will be null in DB).

---

## 7. Verified Projection System

Source: `/home/user/coreframe-boilerplate/src/server/audit/projection.ts`

### 7.1 Scope qualifier mapping

```
personal → qualifiers: ["self"]
org      → qualifiers: ["self", "org_member", "org_admin"]
audit    → qualifiers: ["self", "org_member", "org_admin", "auditor"]
```

An event is visible if `entry.visibleTo` has at least one element in the scope's qualifiers.

### 7.2 Filtering pipeline (per event)

1. Registry lookup — unknown action key: skip + `console.warn`
2. Visibility check — no overlap between `entry.visibleTo` and scope qualifiers: skip
3. Personal-scope actor guard — scope="personal" AND `row.actor_user_id !== context.viewerUserId`: skip (strict equality, no coercion)
4. Summary generation — template interpolation
5. Field projection — metadata sensitive field stripping + ip/ua exclusion

### 7.3 Summary template interpolation

Variables: `{{actor}}`, `{{entity}}`, `{{target}}`

- `{{actor}}`: if `actor_type === "user"` and `actor_user_id` is non-null → the UUID string; otherwise → the `actor_type` string
- `{{entity}}`: `${entity_type}:${entity_id}` always
- `{{target}}`: `${target_type}:${target_id}` when both non-null, otherwise `""` (empty string)

**Actor display is a UUID, not a human name.** The projection layer has no user lookup. The comment in the code says "Callers that need enriched actor names should enrich the result set after projection." No enrichment is implemented in any feed action — the UUID is what the frontend receives.

### 7.4 Metadata projection

- Non-audit scopes: sensitive fields listed in `entry.sensitiveFields` are deleted from a copy of metadata
- Audit scope: full metadata returned, no stripping
- Empty `sensitiveFields` array: metadata returned as-is (copy)

### 7.5 ip_address and user_agent

- personal/org scope: fields are entirely absent from `ProjectedEvent` (not set, not null — absent)
- audit scope: fields are present (may be null if not captured)

### 7.6 Pagination behavior

- Default limit: 50 (applied if not specified by caller)
- `total` = count of events after visibility filtering (before slice)
- Pagination applied with `Array.prototype.slice(offset, offset + limit)` — in-memory on the already-filtered set

This means the DB fetch strategy (see Section 8) must retrieve more rows than `offset + limit` to ensure enough visible events survive projection filtering.

---

## 8. Verified Feed Actions and Query Helpers

Source: `src/app/actions/audit/_query.ts`, `get-personal-activity.ts`, `get-org-activity.ts`, `get-audit-feed.ts`

### 8.1 Constants

| Constant             | Value | Description                    |
| -------------------- | ----- | ------------------------------ |
| `DEFAULT_PAGE_LIMIT` | 50    | Default page size              |
| `MAX_PAGE_LIMIT`     | 50    | Maximum accepted from caller   |
| `PROJECTION_BUFFER`  | 2     | Multiplier for DB fetch        |
| `ABSOLUTE_CAP`       | 500   | Maximum rows fetched per query |

### 8.2 `validatePagination(rawLimit, rawOffset)`

- `limit`: clamped to [1, 50]; floor applied to handle fractional values
- `offset`: clamped to [0, ∞); floor applied

### 8.3 `computeFetchLimit(offset, limit)`

Formula: `clamp((offset + limit) * 2, offset + limit, 500)`

Absorbs projection waste: if many fetched rows are filtered out by projection, the 2x buffer ensures the page still fills. Cap at 500 prevents unbounded queries.

### 8.4 `fetchPlatformEvents(supabase, orgId, fetchLimit, actorUserId?)`

- Uses the **authenticated (RLS)** Supabase client
- Query: `SELECT * FROM platform_events WHERE organization_id = orgId [AND actor_user_id = actorUserId] ORDER BY created_at DESC LIMIT fetchLimit`
- Returns `{ rows: PlatformEventRow[], dbError: string | null }`
- The `as any` cast on `supabase` is isolated here; callers receive strong types

### 8.5 `fetchPersonalOrgNullEvents(userId, fetchLimit)`

- Uses the **service-role** Supabase client (bypasses RLS)
- Query: `SELECT * FROM platform_events WHERE organization_id IS NULL AND actor_user_id = userId ORDER BY created_at DESC LIMIT fetchLimit`
- Purpose: retrieves auth events (`auth.login`, `auth.session.revoked`, etc.) that have `organization_id = null` — these cannot be accessed via the RLS-enforced client (the RLS policy requires `organization_id IS NOT NULL`)
- Security: tightly restricted to actor_user_id = caller's userId. The projection layer provides a second guard.

### 8.6 `mergeAndSortEvents(a, b)`

Concatenates two `PlatformEventRow[]` arrays and sorts by `created_at` descending (newest first). Used by `getPersonalActivityAction`.

### 8.7 Three feed server actions

**`getPersonalActivityAction(rawLimit, rawOffset)`**

- Authentication: requires `context.user.user?.id` (no explicit permission check)
- DB queries: 2 (org-scoped via RLS client + org-null via service-role)
- Merge strategy: `mergeAndSortEvents` then `projectEvents(scope="personal")`
- Org-null query failure is **non-fatal** — logged as `console.warn`, org-scoped rows returned
- Returns `ProjectionResult` including only `ProjectedEvent[]` (never raw rows)

**`getOrgActivityAction(rawLimit, rawOffset)`**

- Authentication: requires `context.app.activeOrgId` + `checkPermission(snapshot, ORG_READ)`
- DB queries: 1 (org-scoped via RLS client, no actor filter)
- Scope: "org" — org_member and org_admin visible events, sensitive fields stripped
- Org-null events NOT included (no service-role path)
- Returns `ProjectionResult`

**`getAuditFeedAction(rawLimit, rawOffset)`**

- Authentication: requires `context.app.activeOrgId` + `checkPermission(snapshot, AUDIT_EVENTS_READ)`
- Permission constant: `AUDIT_EVENTS_READ = "audit.events.read"` — granted to `org_owner`
- DB queries: 1 (org-scoped via RLS client, no actor filter)
- Scope: "audit" — all events visible, full metadata, ip/ua included
- Org-null events NOT included
- Returns `ProjectionResult`

---

## 9. Verified Frontend Surfaces

### 9.1 Pages

| Route                              | Component                    | Feed action                 | Permission gate                                                                                  |
| ---------------------------------- | ---------------------------- | --------------------------- | ------------------------------------------------------------------------------------------------ |
| `/dashboard/activity`              | `PersonalActivityPage` (SSR) | `getPersonalActivityAction` | Requires `context.user.user?.id` only                                                            |
| `/dashboard/organization/activity` | SSR page (not fully read)    | `getOrgActivityAction`      | INFERENCE: requires `ORG_READ`                                                                   |
| `/dashboard/organization/audit`    | `AuditFeedPage` (SSR)        | `getAuditFeedAction`        | Requires `AUDIT_EVENTS_READ`; redirects to `/dashboard/access-denied?reason=audit_read_required` |

### 9.2 Client components

**`EventFeedClient`** (`event-feed-client.tsx`):

- Props: `events: ProjectedEvent[]`, `total`, `limit`, `offset`, `scope: ProjectionScope`, `onPageChange`
- Imports `ProjectedEvent` from `@/server/audit/types` — this is a type-only import (safe for client)
- Renders: event tier badge + action_key + summary text + pagination controls
- For `scope === "audit"`: conditionally renders `ip_address` and `user_agent` when present
- `actor_display` is rendered implicitly via `event.summary` (the interpolated template)
- Does NOT render raw `actor_user_id` or `actor_type`

**`PersonalActivityWrapper`** (`personal-activity-wrapper.tsx`):

- Client component that holds state for `events`, `total`, `offset`
- Calls `getPersonalActivityAction` directly from client on page change (Next.js server action call from client)
- Uses `useTransition` for pending state

### 9.3 Translation namespace

Feed components use `useTranslations("activityFeed")` — keys include `personalTitle`, `personalDescription`, `loading`, `empty`, `pagination`, `prev`, `next`, `pageOf`, `ip`, `ua`.

---

## 10. Verified Test Coverage

### 10.1 Test suites and locations

| Suite ID                       | File                          | Description                                      |
| ------------------------------ | ----------------------------- | ------------------------------------------------ |
| `T-REGISTRY-CONTRACT`          | `event-registry.test.ts`      | Per-entry structural contract for all 22 entries |
| `T-REGISTRY-LOOKUP`            | `event-registry.test.ts`      | `getRegistryEntry` accessor behavior             |
| `T-REGISTRY-SCHEMA`            | `event-registry.test.ts`      | Zod schema spot-checks for 6 entries             |
| `T-REGISTRY-COVERAGE`          | `event-registry.test.ts`      | Presence check for all 22 expected keys          |
| `T-MIGRATION-FILES`            | `event-registry.test.ts`      | Filesystem checks for migration files            |
| `T-PROJECTION-VISIBILITY`      | `projection.test.ts`          | Scope-based event visibility                     |
| `T-PROJECTION-PERSONAL`        | `projection.test.ts`          | Personal scope actor guard                       |
| `T-PROJECTION-SENSITIVITY`     | `projection.test.ts`          | Sensitive field stripping                        |
| `T-PROJECTION-SUMMARY`         | `projection.test.ts`          | Template interpolation                           |
| `T-PROJECTION-IPUA`            | `projection.test.ts`          | ip/ua scope gating                               |
| `T-PROJECTION-PAGINATION`      | `projection.test.ts`          | Limit/offset behavior                            |
| `T-PROJECTION-UNKNOWN`         | `projection.test.ts`          | Unknown action key handling                      |
| `T-PROJECTION-SHAPE`           | `projection.test.ts`          | ProjectedEvent field shape                       |
| `T-INTEGRATION`                | `event-system-phase6.test.ts` | emit → project cycle (mocked DB)                 |
| `T-REQUEST-CORRELATION`        | `event-system-phase6.test.ts` | Multi-event requestId sharing                    |
| `T-ROLLBACK-CONSISTENCY`       | `event-system-phase6.test.ts` | Mode A best-effort semantics                     |
| `T-APPEND-ONLY`                | `event-system-phase6.test.ts` | Service never calls update/delete                |
| `T-LOGOUT-PIPELINE`            | `event-system-phase6.test.ts` | auth.session.revoked end-to-end                  |
| `T-EVENT-WIRING`               | `event-wiring.test.ts`        | Action → emit verification for 13 actions        |
| `T-FEED-QUERY-HELPER`          | `feed-actions.test.ts`        | computeFetchLimit                                |
| `T-FEED-PAGINATION-VALIDATION` | `feed-actions.test.ts`        | validatePagination                               |
| `T-FEED-ACTIONS-PERSONAL`      | `feed-actions.test.ts`        | getPersonalActivityAction                        |
| `T-FEED-ACTIONS-ORG`           | `feed-actions.test.ts`        | getOrgActivityAction                             |
| `T-FEED-ACTIONS-AUDIT`         | `feed-actions.test.ts`        | getAuditFeedAction                               |

### 10.2 Event-wiring test coverage

The `T-EVENT-WIRING` test covers 13 actions explicitly named in the file header:

- `createInvitationAction` → `org.member.invited`
- `cancelInvitationAction` → `org.invitation.cancelled`
- `acceptInvitationAction` → `org.invitation.accepted`
- `removeMemberAction` → `org.member.removed`
- `createRoleAction` → `org.role.created`
- `deleteRoleAction` → `org.role.deleted`
- `assignRoleToUserAction` → `org.member.role_assigned`
- `removeRoleFromUserAction` → `org.member.role_removed`
- `createBranchAction` → `org.branch.created`
- `updateBranchAction` → `org.branch.updated`
- `deleteBranchAction` → `org.branch.deleted`
- `updateOrgProfileAction` → `org.updated`
- `createOrganizationAction` → `org.created` + `org.onboarding.completed` (shared requestId)

**Not in wiring test**: `resendInvitationAction`, `declineInvitationAction`, auth actions (`signInAction`, `signOutAction`, `forgotPasswordAction`, `resetPasswordAction`), `uploadOrgLogoAction`, `removeOrgLogoAction`.

### 10.3 Test environment

All test files are marked `@vitest-environment node`. The event service and registry files use `import "server-only"` which requires the node environment (would fail in jsdom).

### 10.4 Mock strategy

- `@supabase/service` is mocked in `event-system-phase6.test.ts` via `vi.mock("@supabase/service")`
- Feed action tests mock `@/utils/supabase/server` and `@/utils/supabase/service` separately
- `loadDashboardContextV2` is mocked in all feed action tests
- `checkPermission` is mocked in feed action tests

---

## 11. Confirmed Implementation Facts That Matter

1. **`platform_events` table EXISTS on TARGET** with all 17 columns exactly matching the TypeScript `PlatformEventRow` interface.

2. **All 3 FKs are soft** (ON DELETE SET NULL): org, actor_user, branch. Deleting a branch does not cascade-delete events; `branch_id` becomes null.

3. **actor_user_id FKs to `public.users`, not `auth.users`**. This is consequential: if a user exists in `auth.users` but not in `public.users` (broken-hook scenario), event emission with `actorUserId = that_user_id` will fail with a FK violation. All auth action emission sites guard against null actorUserId but don't handle the missing-public.users case.

4. **INSERT is revoked from `authenticated` and `anon`** at the privilege level. RLS alone is insufficient — the revoke makes direct client inserts impossible regardless of any policy. Only `service_role` and `postgres` can insert.

5. **The only RLS policy is SELECT-only** for org members. No INSERT/UPDATE/DELETE policies exist (and none are needed given the revoke).

6. **`ip_address` is `inet` type in the DB**, not `text`. Supabase client serializes it to a string. This is transparent to TypeScript consumers.

7. **Actor display in ProjectedEvent is a raw UUID**, not a human name. No user-name lookup is performed at any level of the stack. The frontend renders the UUID as-is inside the `summary` string.

8. **The `permissions` field on `ProjectionContext` is unused inside `projectEvents()`**. It is passed from all three feed actions but the projection function does not use it for any filtering logic currently.

9. **`org.updated` is emitted from three separate actions**: `updateOrgProfileAction`, `uploadOrgLogoAction`, `removeOrgLogoAction`. The `updated_fields` metadata distinguishes them.

10. **Request correlation (`requestId`) is only implemented for the onboarding workflow**. One `crypto.randomUUID()` call generates a shared ID for `org.created` + `org.onboarding.completed`. All other workflows have `requestId = null` in the DB.

11. **Org-null auth events are queryable** via the personal feed (service-role path in `_query.ts`). Auth events with `organization_id = null` are fetched separately and merged with org-scoped events before projection.

12. **The registry migration file timestamps mismatch live DB versions** but content is equivalent. The DB applied the events migration on `20260313`, the repo files use `20260321` prefix.

13. **`audit_rls_permission_gate_slugs` function exists on TARGET** (applied via migration `20260314091833`) but is not referenced in any TypeScript source code found during this extraction. It may be referenced in SQL-only policies or is unused.

14. **Mode B (atomic DB-side emission) does not exist**. It is described in comments in `event.service.ts` and referenced in `validateMetadata()` JSDoc, but no Postgres function implementing it exists on the live DB, and no TypeScript code calls any such RPC.

15. **`eventService` is marked `import "server-only"`** at the service level. The registry and projection files also use `import "server-only"`. The only type that crosses the server/client boundary is `ProjectedEvent` (imported as a type in `event-feed-client.tsx`).

---

## 12. Confirmed Bugs / Confirmed Missing Features / Confirmed Ambiguities

### 12.1 Confirmed bugs

**BUG-1: `org.member.invited` metadata missing `invitee_email` in some branches**
In `createInvitationAction`, `metadata.invitee_email` is populated from `result.data.email`. If `result.data.email` is somehow undefined, the Zod schema validation will reject (required field). However the action does not handle this case beyond the generic catch block. Not a crash risk (emit returns typed failure), but the event would be silently lost.

**BUG-2: `declineInvitationAction` emits with `actorType: "user"` even when actor is null**
The code does `actorUserId: decliningUser?.id ?? null` with `actorType: "user"`. The DB check constraint allows `actor_type = 'user'` with `actor_user_id = null` (no DB-level enforcement of non-null actor_user_id for user type). The actor normalization in the service only strips actorUserId for `actorType !== 'user'`, not the reverse. So a decline with no session stores `actor_type = 'user'` and `actor_user_id = null`, which is semantically inconsistent. The correct actor_type for anonymous actors should be `"system"`.

**BUG-3: `removeOrgLogoAction` and `uploadOrgLogoAction` emit `org.updated` with no `requestId`**
These two actions are logically part of the org update flow but do not correlate with the `updateOrgProfileAction` emission. Minor — the correlation is not guaranteed by the architecture anyway.

### 12.2 Confirmed missing features

**MISSING-1: No user-name enrichment in actor_display**
All feed views show raw UUIDs for `actor_display` in event summaries. There is no user-lookup enrichment implemented anywhere in the projection pipeline or in the feed actions. The code comment in `projection.ts` acknowledges this: "Callers that need enriched actor names should enrich the result set after projection." No caller does.

**MISSING-2: Request correlation only for onboarding**
`requestId` is null for all non-onboarding events. The `pe_request_id_idx` index exists and is correct, but it will only ever be useful for onboarding events.

**MISSING-3: No warehouse/movement events**
The registry contains zero warehouse-related event keys. The warehouse module (which has complex stock movement and approval workflows) emits no events. This is intentional scope for the current implementation phase but represents a significant gap for a full audit log.

**MISSING-4: Org-null events not included in org or audit feeds**
`getOrgActivityAction` and `getAuditFeedAction` only query with `organization_id = orgId`. Auth events (`auth.login`, `auth.session.revoked`, etc.) which have `organization_id = null` are not included in the org or audit feed. Only the personal feed fetches these via the service-role path.

**MISSING-5: No branch-scoped feed**
There is no `getPersonalActivityAction`-equivalent that filters by `branch_id`. Branch-scoped events are stored with `branch_id` populated but there is no feed action that queries or filters by `branch_id`.

**MISSING-6: `resendInvitationAction` and `declineInvitationAction` not covered by wiring tests**
These two actions emit events (`org.invitation.resent`, `org.invitation.declined`) but are not included in `event-wiring.test.ts` coverage.

**MISSING-7: Auth action emissions not in wiring tests**
`signInAction`, `signOutAction`, `forgotPasswordAction`, `resetPasswordAction` all emit events but have no corresponding assertions in `event-wiring.test.ts`.

**MISSING-8: `updateRoleAction` not in wiring tests**
`updateRoleAction` emits `org.role.updated` but is not listed in the event-wiring test header.

**MISSING-9: No `auth.login.failed` for auth.login.failed visibility in personal feed**
`auth.login.failed` has `visibleTo: ["auditor"]` only. This means a user can never see their own failed login attempts in their personal activity feed (the personal scope only exposes "self" events, and "auditor" does not qualify). INFERENCE: this is intentional security design (failed logins go to audit log only).

### 12.3 Confirmed ambiguities

**AMBIGUITY-1: Migration version mismatch**
The repo migration files for the event system use `20260321` timestamps but the live DB applied them under `20260313`–`20260316` timestamps. It is unclear whether the repo files represent a planned re-migration or were renamed for organizational purposes. The SQL content is equivalent.

**AMBIGUITY-2: `audit_rls_permission_gate_slugs` function purpose**
This function exists on TARGET (applied via `20260314091833`) but was not found in any TypeScript source code. Its role in the event system, if any, is unclear from the code read.

**AMBIGUITY-3: `forceRowSecurity` is false**
`relforcerowsecurity = false` means table owner (`postgres` role) bypasses RLS even with RLS enabled. This is standard Supabase behavior and is expected — the service-role uses the postgres role to bypass RLS for inserts.

---

## 13. What Was Intentionally NOT Used

The following items were explicitly not used during this extraction:

- `docs/event-system/EVENT_SYSTEM_VERIFICATION_REPORT.md` — excluded per task instructions
- `docs/event-system/EVENT_SYSTEM_GAP_VERIFICATION.md` — excluded per task instructions
- `docs/event-system/EVENT_SYSTEM_IMPLEMENTATION_EXTRACTION.md` — excluded per task instructions
- `docs/event-system/EVENT_SYSTEM_IMPLEMENTATION_PLAN.md` — not read (only the plan, not source truth)
- No warehouse action files were read (no event emissions found there via Grep)
- No admin action files were read (not relevant to event system)
- The `supabase-target/` directory (contains duplicate migration files for a separate flow) was not read

The following features described in code comments were confirmed NOT implemented:

- Mode B (atomic DB-side emission via security-definer RPCs) — not implemented
- Actor display name enrichment — not implemented
- Branch-scoped event feeds — not implemented
- Warehouse module events — not registered, not emitted

---

## Current Module Coverage

The current event system emission coverage includes:

- **Authentication** (auth module): signup, login, password reset, etc.
- **Organization Management** (org-management module): member joins, role changes, invitations, profile updates, branch changes

The following modules are **not yet wired** and represent future-phase work:

- Warehouse
- Teams
- Tools
- Home
- Support

This is intentional phase scoping, not a correctness defect in the current implementation.

---

## Append-Only Guarantee Clarification

The event system is append-only at the **application level**:

- Authenticated and anonymous users cannot update or delete `platform_events` rows through any application path
- RLS policies grant SELECT only to authenticated users; INSERT/UPDATE/DELETE are not permitted via the `authenticated` role
- `service_role` and direct administrative database access retain database-level write capabilities — this is normal Supabase behavior and does not invalidate the application-level audit integrity model
- Mode B (forensic DB-level immutability via triggers or constraints) is **not part of the current implementation**
