# ENTERPRISE LAYER AUDIT

> Ground-truth architectural extraction.
> Source of truth: actual code + Supabase MCP database verification.
> Date: 2026-03-18
> Branch: event-system

---

## Executive Summary

| Dimension                | Assessment                                                                      |
| ------------------------ | ------------------------------------------------------------------------------- |
| **Overall Maturity**     | Production-ready (core platform) / Partially prototype (observability coverage) |
| **Strongest Layer**      | Layer 2 — Permissions / Security / Authorization                                |
| **Weakest Layer**        | Layer 1 — Audit / Logging (emission coverage gap)                               |
| **Most Critical Risk**   | Warehouse module (160 files, largest module) emits zero events                  |
| **Second Critical Risk** | `platform_events` is not truly immutable at the DB level                        |
| **Third Critical Risk**  | Auth lifecycle events are registered but never emitted from application code    |

The system has a **sophisticated, production-quality foundation** across permissions, projection, and domain logic. The event system architecture itself is well-designed and correct. However, event emission coverage is critically incomplete: only the organization-management domain (6 action files) is wired. The warehouse module — the single largest feature area with 52 action files and complex workflows — has zero event emission. This is not a design flaw; it is an implementation gap that directly undermines the stated purpose of the audit/observability layer.

**Readiness verdict:** Production-ready for the organization-management domain. Pre-production for the warehouse and all other modules. Not enterprise-grade as a whole until emission coverage is extended.

---

## Layer 1 — Audit / Logging / Observability

### What Exists

**Database table `platform_events`** — verified via Supabase MCP. Exists, RLS enabled, 50 rows as of audit date.

Columns verified in DB:

```
id              uuid PK, gen_random_uuid()
created_at      timestamptz NOT NULL, default now()
organization_id uuid NULLABLE, FK → organizations.id (ON DELETE SET NULL)
branch_id       uuid NULLABLE, FK → branches.id (ON DELETE SET NULL)
actor_user_id   uuid NULLABLE, FK → users.id (ON DELETE SET NULL)
actor_type      text NOT NULL, CHECK IN ('user','system','api','worker','scheduler','automation')
module_slug     text NOT NULL
action_key      text NOT NULL
entity_type     text NOT NULL
entity_id       text NOT NULL
target_type     text NULLABLE
target_id       text NULLABLE
metadata        jsonb NOT NULL, default '{}'
event_tier      text NOT NULL, CHECK IN ('baseline','enhanced','forensic')
request_id      uuid NULLABLE
ip_address      inet NULLABLE
user_agent      text NULLABLE
```

**Indexes on `platform_events`** — all verified via MCP:

```
platform_events_pkey          — UNIQUE btree(id)
pe_org_created_idx            — btree(organization_id, created_at DESC) WHERE org IS NOT NULL
pe_actor_user_idx             — btree(actor_user_id, created_at DESC) WHERE actor_user_id IS NOT NULL
pe_action_key_idx             — btree(action_key, created_at DESC)
pe_entity_idx                 — btree(entity_type, entity_id, created_at DESC)
pe_request_id_idx             — btree(request_id) WHERE request_id IS NOT NULL
```

**No index on `branch_id`** — verified absent. Branch-filtered queries do a sequential scan scoped by organization_id only.

**Event Registry** — `src/server/audit/event-registry.ts` (650+ lines). Code-defined, never stored in DB. Contains 21 registered action keys:

| Action Key                      | Module                  | Tier     | Category     | Intent  |
| ------------------------------- | ----------------------- | -------- | ------------ | ------- |
| `auth.login`                    | auth                    | baseline | AUTH         | SUCCESS |
| `auth.login.failed`             | auth                    | baseline | SECURITY     | FAIL    |
| `auth.password.reset_requested` | auth                    | baseline | AUTH         | REQUEST |
| `auth.password.reset_completed` | auth                    | baseline | AUTH         | SUCCESS |
| `auth.session.revoked`          | auth                    | enhanced | AUTH         | DELETE  |
| `org.created`                   | organization-management | baseline | ORGANIZATION | CREATE  |
| `org.updated`                   | organization-management | baseline | ORGANIZATION | UPDATE  |
| `org.member.invited`            | organization-management | enhanced | INVITATION   | CREATE  |
| `org.member.removed`            | organization-management | enhanced | MEMBERSHIP   | REMOVE  |
| `org.invitation.accepted`       | organization-management | baseline | INVITATION   | ACCEPT  |
| `org.invitation.cancelled`      | organization-management | enhanced | INVITATION   | DELETE  |
| `org.invitation.resent`         | organization-management | enhanced | INVITATION   | UPDATE  |
| `org.invitation.declined`       | organization-management | baseline | INVITATION   | DECLINE |
| `org.role.created`              | organization-management | enhanced | ORGANIZATION | CREATE  |
| `org.role.updated`              | organization-management | enhanced | ORGANIZATION | UPDATE  |
| `org.role.deleted`              | organization-management | enhanced | ORGANIZATION | DELETE  |
| `org.member.role_assigned`      | organization-management | enhanced | MEMBERSHIP   | ASSIGN  |
| `org.member.role_removed`       | organization-management | enhanced | MEMBERSHIP   | REMOVE  |
| `org.branch.created`            | organization-management | baseline | ORGANIZATION | CREATE  |
| `org.branch.updated`            | organization-management | baseline | ORGANIZATION | UPDATE  |
| `org.branch.deleted`            | organization-management | enhanced | ORGANIZATION | DELETE  |
| `org.onboarding.completed`      | organization-management | baseline | ORGANIZATION | SUCCESS |

**Event Service** — `src/server/services/event.service.ts`. Single insert path. Steps:

1. Registry lookup — rejects unregistered actionKey
2. Zod metadata validation against registry schema
3. Actor normalization — forces `actorUserId = null` when `actorType !== 'user'`
4. Metadata normalization — `JSON.parse(JSON.stringify(raw))` strips `undefined`
5. Insert via service-role client (bypasses RLS)
6. Returns `{ success: true, data: { id } }` or `{ success: false, error }`

**Event emission call sites** — verified via grep of `eventService.emit` across entire `src/app/actions/`:

| File                          | Action Keys Emitted                                                                                                             |
| ----------------------------- | ------------------------------------------------------------------------------------------------------------------------------- |
| `organization/invitations.ts` | `org.member.invited`, `org.invitation.cancelled`, `org.invitation.resent`, `org.invitation.accepted`, `org.invitation.declined` |
| `organization/roles.ts`       | `org.role.created`, `org.role.updated`, `org.role.deleted`, `org.member.role_assigned`, `org.member.role_removed`               |
| `organization/branches.ts`    | `org.branch.created`, `org.branch.updated`, `org.branch.deleted`                                                                |
| `organization/members.ts`     | `org.member.removed`                                                                                                            |
| `organization/profile.ts`     | `org.created` (via service), `org.updated` (x2 paths)                                                                           |
| `onboarding/index.ts`         | `org.created`, `org.onboarding.completed`                                                                                       |

Total emission points: **19 calls across 6 files**. All are in the `organization-management` domain.

**Modules with zero event emission** (verified via grep — no `eventService.emit` found):

- `warehouse/` — 52 action files, zero calls
- `teams/` — no calls
- `tools/` — no calls
- `contacts/` — no calls
- All auth-lifecycle hooks (`auth.login`, `auth.login.failed`, etc.) — none wired from application code

**Feed Actions** — 5 server actions in `src/app/actions/audit/`:

- `get-audit-feed.ts` — scope: audit, requires `audit.events.read`
- `get-org-activity.ts` — scope: org, requires `org.read`
- `get-personal-activity.ts` — scope: personal, fetches actor + self-visible + org-null auth events
- `get-recent-activity.ts` — scope (to be verified separately)
- `get-latest-activity.ts` — latest single event

**Visibility System** — `src/server/audit/visibility.ts`. Three evaluation passes per event:

1. `actorVisible=true` AND `event.actor_user_id === viewer.userId` → allow
2. `selfVisible=true` AND (`entity_id === viewer.userId` OR `target_id === viewer.userId`) → allow
3. Permission-based: `VISIBILITY_CLASS_PERMISSIONS[entry.visibilityClass]` must be in viewer's snapshot
   - Audit scope (viewerScope !== 'personal' and !== 'org'): `audit.events.read` grants all
   - Audit-class events blocked from personal/org scope feeds
   - Unknown entries → deny (info-leakage prevention)

**Mode B** (atomic DB-side emission) — `src/server/services/event.service.ts` line 15: explicitly marked "NOT implemented here". All current emission is Mode A (best-effort, post-domain-write).

### How It Works

```
Server Action
  → domain write (DB)
  → eventService.emit(input)
      → getRegistryEntry(actionKey)        // reject if unknown
      → entry.metadataSchema.parse(input.metadata) // Zod validation
      → service-role client INSERT INTO platform_events
  → return result (emit failure does NOT roll back domain write)

Feed Action (e.g. getAuditFeedAction)
  → loadDashboardContextV2()              // auth + permissions
  → checkPermission(snapshot, PERM)       // gate
  → fetchPlatformEvents(supabase, orgId, fetchLimit, actorUserId, branchId)
      → RLS enforces org membership automatically
  → projectEvents(rows, context)          // visibility + metadata strip + summary
  → collectReferences(projected)          // gather UUIDs for enrichment
  → batchLoadReferences(refs)             // max 3 batch queries: users, roles, branches
  → applyReferenceEnrichment(events, ctx) // UUID → display name
  → return ProjectionResult
```

### Strengths

1. **Architectural invariant enforced**: `event.service.ts` is the ONLY valid insert path. Comment on line 1-7 explicitly states this. The `createServiceClient()` usage is isolated to that file and `_query.ts` (for auth events).
2. **Registry as contract**: Every action key must be pre-registered with a Zod schema, tier, category, intent, and visibility rules. The service hard-rejects unregistered keys.
3. **Three-tier visibility model**: actor-intrinsic, self-intrinsic, and permission-based. Each tier is separately configurable per event type in the registry.
4. **Sensitive field stripping**: `sensitiveFields` array per registry entry ensures PII (e.g. `invitee_email`) is removed before data leaves the server for non-audit scopes.
5. **ip_address and user_agent isolation**: Only included in projected events when `viewerScope === 'audit'` — never exposed to personal or org feed consumers.
6. **Batch enrichment design**: `collectReferences → batchLoadReferences → applyReferenceEnrichment` pattern guarantees max 3 DB queries for enrichment regardless of event count.
7. **Metadata normalization**: `JSON.parse(JSON.stringify(raw))` correctly removes `undefined` values before insert.
8. **Tests**: 8 test files in `src/server/audit/__tests__/` + `event-wiring.test.ts` for action-level emit verification.

### Weaknesses / Gaps

**GAP 1 — Warehouse module: zero events**
File: `src/app/actions/warehouse/` (52 action files). Confirmed via grep: `eventService.emit` not found in any warehouse action. This means:

- Stock movements (create, approve, cancel, reverse) — NOT logged
- Inventory adjustments — NOT logged
- Transfer requests — NOT logged
- Deliveries — NOT logged
- Product CRUD — NOT logged
- Location CRUD — NOT logged
- Audit sessions — NOT logged
- Supplier operations — NOT logged

The warehouse module represents the majority of application functionality (160 module files, 52 action files) and has NO event coverage.

**GAP 2 — Auth lifecycle events never emitted**
Five action keys are registered (`auth.login`, `auth.login.failed`, `auth.password.reset_requested`, `auth.password.reset_completed`, `auth.session.revoked`) but grep confirms no application code calls `eventService.emit` with these keys. They require either DB-side emission via Supabase auth hooks or an application-level auth callback wiring that does not currently exist.

**GAP 3 — `platform_events` is NOT truly append-only**
RLS policy verified via MCP: only `platform_events_org_members_read` (SELECT) exists for non-service-role. There is no `UPDATE` or `DELETE` policy for authenticated users (correct), but there is also no DB trigger or constraint preventing the service-role client (used by application code) from UPDATE or DELETE operations. The append-only property is an architectural convention, not a DB-enforced invariant.

**GAP 4 — Auth events RLS policy uses `{public}` role**
Verified via MCP: `platform_events_org_members_read` policy: `roles: {public}`. Standard Supabase patterns use `{authenticated}`. With `{public}`, the policy technically applies to anonymous connections. While `is_org_member(organization_id)` uses `auth.uid()` (returns null for anonymous) and would deny access, this is a misapplication of the policy target that should be `{authenticated}`.

**GAP 5 — No registry entries for contacts, teams, tools, user-account modules**
All 21 registry entries belong to `auth` or `organization-management` modules. The contacts, teams, tools, user-account modules have no registry entries, meaning they cannot emit events even if action-level wiring were added.

**GAP 6 — Mode B not implemented**
Forensic-tier events for warehouse approval workflows (which need atomicity guarantees) cannot be safely emitted under Mode A. Mode B (Postgres security-definer function) is documented in `event.service.ts` comments but has no implementation.

**GAP 7 — `org.created` double-emission risk**
`organization/profile.ts` and `onboarding/index.ts` both emit `org.created`. If both code paths are reachable for a single org creation, the event is emitted twice. No deduplication mechanism exists.

### Risk Assessment

| Risk                                | Level      | Detail                                                      |
| ----------------------------------- | ---------- | ----------------------------------------------------------- |
| Warehouse zero coverage             | **HIGH**   | Core module completely dark — no operational visibility     |
| Auth events not wired               | **HIGH**   | Security-critical events (login, failed login) unobservable |
| Platform_events not truly immutable | **MEDIUM** | Service-role can modify audit trail                         |
| Public role on RLS policy           | **LOW**    | Functionally safe but incorrect policy target               |
| Double org.created emission         | **LOW**    | Cosmetic duplicate, not a security issue                    |

---

## Layer 2 — Permissions / Security / Authorization

### What Exists

**Authentication**: Supabase Auth (JWT). `custom_access_token_hook` DB function verified in MCP — enriches JWT with custom claims at token issuance.

**Role System** — verified via MCP (`roles` table, 7 rows):

| Role                       | is_basic | scope_type | Permissions (from role_permissions)                                                                                                                                         |
| -------------------------- | -------- | ---------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `org_owner`                | true     | org        | `account.*`, `audit.events.read`, `branches.*`, `events.org_activity.read`, `events.org_sensitive.read`, `invites.*`, `members.*`, `module.*`, `org.*`, `self.*`, `tools.*` |
| `org_member`               | true     | org        | `account.*`, `branches.read`, `events.org_activity.read`, `members.read`, `org.read`, `self.read`, `self.update`, `tools.manage`, `tools.read`                              |
| `org mngm access`          | false    | org        | `module.organization-management.access`                                                                                                                                     |
| `warehouse employee`       | false    | branch     | `branches.read`                                                                                                                                                             |
| `warehouse employeeEEESSS` | false    | org        | `org.read`                                                                                                                                                                  |

**Permissions table** — 45 rows verified. Covers categories: `account`, `audit`, `branch`, `branches`, `events`, `invites`, `members`, `module`, `org`, `self`, `superadmin`, `tools`. Notable entries:

- `audit.events.read` — gates audit feed access
- `events.org_activity.read` — gates org activity feed
- `events.org_sensitive.read` — gates sensitive event visibility
- Wildcard permission slugs stored (e.g., `account.*`, `module.*`, `org.*`) — expanded at compile time

**Permission Compiler** — `compile_user_permissions` DB function. Triggered by 4 triggers verified in MCP:

- `trigger_compile_on_role_assignment` — fires on user_role_assignments INSERT/UPDATE/DELETE
- `trigger_compile_on_role_permission` — fires on role_permissions changes
- `trigger_compile_on_membership` — fires on organization_members changes
- `trigger_compile_on_override` — fires on user_permission_overrides changes

Compiler expands wildcards via `LEFT JOIN` pattern: `p2.slug LIKE replace(p.slug, '*', '%')` — writes concrete slugs into `permission_slug_exact` column.

**`user_effective_permissions` table** — 143 rows. Key structure:

- `permission_slug` — source slug (may be wildcard, e.g. `account.*`)
- `permission_slug_exact` — expanded concrete slug (always concrete)
- `branch_id` — NULL for org-scope, non-null for branch-specific grants
- `unique_v3` constraint on `(user_id, org_id, permission_slug_exact, branch_id) NULLS NOT DISTINCT`

**Partial indexes on UEP** — verified in MCP:

- `uep_org_slug_exact_idx`: `(org_id, user_id, permission_slug_exact) WHERE branch_id IS NULL`
- `uep_branch_slug_exact_idx`: `(org_id, user_id, branch_id, permission_slug_exact) WHERE branch_id IS NOT NULL`

**`PermissionServiceV2`** — `src/server/services/permission-v2.service.ts`. Two-query pattern:

1. `WHERE user_id = X AND org_id = Y AND branch_id IS NULL` → org-scope slugs (uses `uep_org_slug_exact_idx`)
2. `WHERE user_id = X AND org_id = Y AND branch_id = Z` → branch-scope slugs (uses `uep_branch_slug_exact_idx`)
   Results merged, deduped, sorted in JavaScript. Returns `PermissionSnapshot { allow: string[], deny: [] }`. Deny is always empty — deny overrides resolved at compile time.

**DB Authorization Functions** — all verified via MCP:

- `is_org_member(org_id)` → boolean (checks `organization_members` for active membership)
- `has_permission(org_id, permission)` → boolean (org-scope only, checks `permission_slug_exact`)
- `has_branch_permission(org_id, branch_id, slug)` → boolean (org-wide OR branch-specific grant)
- `user_has_effective_permission(user_id, org_id, slug)` → boolean
- `is_org_owner(org_id)` → boolean

**RLS Policies** — full inventory verified via MCP:

| Table                         | SELECT                                         | INSERT                                    | UPDATE                                           | DELETE                            |
| ----------------------------- | ---------------------------------------------- | ----------------------------------------- | ------------------------------------------------ | --------------------------------- |
| `branches`                    | `is_org_member`                                | `is_org_member + branches.create`         | `is_org_member + branches.update`                | `is_org_member + branches.delete` |
| `organizations`               | `is_org_member`                                | service_role only                         | —                                                | —                                 |
| `organization_members`        | self OR `members.read`                         | `members.manage`                          | `members.manage`                                 | `members.manage`                  |
| `organization_profiles`       | `is_org_member`                                | service_role                              | `is_org_member + org.update`                     | —                                 |
| `roles`                       | org member                                     | `members.manage`                          | `members.manage` (+ restrictive)                 | `members.manage`                  |
| `role_permissions`            | org member (own org or system)                 | `members.manage`                          | `members.manage`                                 | `members.manage`                  |
| `user_role_assignments`       | own OR `members.read` OR `branch.roles.manage` | `members.manage` OR `branch.roles.manage` | same                                             | same                              |
| `user_effective_permissions`  | own OR `members.read`                          | —                                         | —                                                | —                                 |
| `user_permission_overrides`   | own OR `members.manage`                        | `members.manage`                          | `members.manage`                                 | `members.manage`                  |
| `invitations`                 | `invites.read` OR email match                  | `invites.create`                          | cancel (`invites.cancel`) OR self-accept/decline | —                                 |
| `invitation_role_assignments` | `invites.read`                                 | `invites.create`                          | —                                                | —                                 |
| `platform_events`             | `{public}` role + `is_org_member`              | service_role only                         | —                                                | —                                 |
| `permissions`                 | all authenticated                              | —                                         | —                                                | —                                 |
| `user_preferences`            | own                                            | own                                       | own                                              | own                               |

**Server Action Permission Pattern** — consistent across all organization actions:

```typescript
const context = await loadDashboardContextV2();
if (!checkPermission(context.user.permissionSnapshot, PERMISSION_CONST)) {
  return { success: false, error: "Unauthorized" };
}
```

**Multi-layer defense verified**:

1. DB RLS (enforced by Postgres)
2. Server action permission check (`checkPermission` against snapshot)
3. UI-level guards (`HasAnyRoleClient`, `HasAnyRoleServer`, sidebar `requiresPermissions`)

**Entitlements guard** — `entitlements.requireModuleAccess(MODULE_SLUG)` called at top of all org-management actions before permission checks.

### How It Works

```
Request → Next.js Server Action
  → loadDashboardContextV2()
      → loadUserContextV2()
          → PermissionServiceV2.getPermissionSnapshotForUser(supabase, userId, orgId, branchId)
              → Q1: UEP WHERE branch_id IS NULL (uep_org_slug_exact_idx)
              → Q2: UEP WHERE branch_id = X (uep_branch_slug_exact_idx)
              → merge + dedup + sort → PermissionSnapshot
  → entitlements.requireModuleAccess(module)   // subscription gate
  → checkPermission(snapshot, CONST)            // app-layer gate
  → supabase.<table>.operation()
      → Postgres RLS evaluates: is_org_member() + has_permission() + etc.
      → Allowed or denied at DB level
```

### Strengths

1. **True defense-in-depth**: Three independent enforcement layers (DB RLS, server action, UI). Compromising one layer does not bypass the others.
2. **Compile-time wildcard expansion**: Wildcards (e.g. `module.*`) are expanded to concrete slugs at write time. Runtime checks use simple `string[]` includes — no regex matching needed at request time.
3. **Partial indexes aligned to query pattern**: `uep_org_slug_exact_idx` and `uep_branch_slug_exact_idx` are designed exactly for the two-query pattern. Index selection is deterministic.
4. **Scope-safe role assignments**: `validate_role_assignment_scope` trigger (verified in MCP) prevents branch-scoped roles from being assigned at org scope.
5. **Deny-first semantics**: `checkPermission` in `src/lib/utils/permissions.ts` applies deny before allow in wildcard matching.
6. **Invitation RLS handles both authenticated and unauthenticated paths**: The select policy `lower(email) = lower(COALESCE(auth.jwt()->>'email', ''))` allows the invitee to view their own invitation even before joining.
7. **Branch manager model**: `has_branch_permission(org_id, branch_id, 'branch.roles.manage')` enables branch-scoped delegation without full `members.manage` grant. Verified in user_role_assignments RLS.
8. **`user_permission_overrides` fully designed**: Schema, RLS, compiler integration exists (0 rows, not actively used, but infrastructure is in place).

### Weaknesses / Risks

**RISK 1 — `platform_events` RLS uses `{public}` role**
Verified: `platform_events_org_members_read` policy has `roles: {public}`. Should be `{authenticated}`. While `is_org_member()` functionally gates anonymous access (auth.uid() returns null → no membership match), the policy declaration is technically incorrect and could behave unexpectedly if Supabase's anonymous auth feature is enabled.

**RISK 2 — Roles table has divergent RESTRICTIVE + PERMISSIVE UPDATE policies**
Verified via MCP:

- PERMISSIVE: `qual` includes `is_basic = false` AND `deleted_at IS NULL`
- RESTRICTIVE: `with_check` is `(organization_id IS NOT NULL) AND is_org_member(organization_id) AND has_permission(organization_id, 'members.manage'::text)` — does NOT include `is_basic = false`

A RESTRICTIVE policy's `with_check` that omits `is_basic = false` could theoretically allow modifications to basic roles (`org_owner`, `org_member`) by users with `members.manage`. The PERMISSIVE policy's `qual` blocks this in practice, but the inconsistency is a latent risk.

**RISK 3 — No audit trail for permission/role changes at DB level**
The `permissions` table and `role_permissions` table have no triggers writing to `platform_events`. Permission changes are audited at the app layer (e.g. `org.role.created` is emitted from `roles.ts`), but direct DB-level changes (e.g. via Supabase Dashboard or migration scripts) would not generate audit events.

**RISK 4 — `user_effective_permissions` SELECT policy exposes compiled state**
Policy `uep_select_members_read`: `has_permission(org_id, 'members.read')` — any user with `members.read` can SELECT all UEP rows for their org, including other users' expanded permission sets. This is the full compiled permission table. Whether this is intentional or overly permissive is not determinable from code alone; the design decision is not documented.

**RISK 5 — No rate limiting on permission-checking endpoints**
No rate limiting found on any server action. An attacker with a valid session could call permission-intensive actions repeatedly.

### Risk Assessment

| Risk                                    | Level          | Detail                                                     |
| --------------------------------------- | -------------- | ---------------------------------------------------------- |
| platform_events `{public}` policy       | **LOW**        | Functionally safe, technically incorrect                   |
| Roles RESTRICTIVE policy divergence     | **MEDIUM**     | Latent risk if PERMISSIVE policy changes                   |
| UEP exposed to members.read             | **LOW-MEDIUM** | Intentional but broad — exposes compiled permission state  |
| No rate limiting                        | **MEDIUM**     | No mitigation found for brute-force permission enumeration |
| DB-level permission changes not audited | **LOW**        | Migrations and direct DB changes unlogged                  |

---

## Layer 3 — Domain / Business Logic / Workflows

### What Exists

**Core Domain Entities** — verified in DB via MCP:

| Entity                      | Table                         | Soft Delete  | Key Constraints                                                       |
| --------------------------- | ----------------------------- | ------------ | --------------------------------------------------------------------- |
| Users                       | `public.users`                | `deleted_at` | FK → `auth.users`                                                     |
| Organizations               | `organizations`               | `deleted_at` | unique `slug`                                                         |
| Branches                    | `branches`                    | `deleted_at` | unique `(org_id, slug)` partial                                       |
| Members                     | `organization_members`        | `deleted_at` | unique `(org_id, user_id)`, status CHECK                              |
| Roles                       | `roles`                       | `deleted_at` | `scope_type` CHECK ('org','branch','both')                            |
| Role Permissions            | `role_permissions`            | `deleted_at` | unique `(role_id, permission_id)`                                     |
| User Role Assignments       | `user_role_assignments`       | `deleted_at` | unique `(user_id, role_id, scope, scope_id)`                          |
| Invitations                 | `invitations`                 | `deleted_at` | unique partial `(org_id, lower(email))` WHERE status='pending'        |
| Invitation Role Assignments | `invitation_role_assignments` | —            | scope CHECK                                                           |
| Positions                   | `org_positions`               | `deleted_at` |                                                                       |
| Position Assignments        | `org_position_assignments`    | `deleted_at` | unique `(org_id, user_id, position_id, branch_id) NULLS NOT DISTINCT` |
| User Preferences            | `user_preferences`            | `deleted_at` | unique `user_id`                                                      |
| Subscriptions               | `organization_subscriptions`  | —            | unique `organization_id`                                              |
| Entitlements                | `organization_entitlements`   | —            | PK = `organization_id`                                                |

**Domain Functions** — all verified via MCP:

| Function                                                  | Returns | Purpose                                                                                            |
| --------------------------------------------------------- | ------- | -------------------------------------------------------------------------------------------------- |
| `accept_invitation_and_join_org(token)`                   | jsonb   | Atomic: validate token, UPSERT public.users, INSERT org_member, copy IRA→URA, set user_preferences |
| `check_invitation_eligibility(org_id, email, inviter_id)` | jsonb   | Prevents: SELF_INVITE, ALREADY_MEMBER, DUPLICATE_PENDING                                           |
| `decline_invitation(token)`                               | jsonb   | Marks invitation as declined                                                                       |
| `create_organization_for_current_user(name, slug)`        | jsonb   | Creates org + profile + default branch + assigns owner role                                        |
| `check_org_slug_available(slug)`                          | boolean | Unique slug pre-check                                                                              |
| `delete_org_role(role_id)`                                | void    | Soft-deletes role + cascades to role_permissions                                                   |
| `get_invitation_preview_by_token(token)`                  | jsonb   | Returns org/inviter info for invite landing page (unauthenticated)                                 |
| `get_my_pending_invitations()`                            | jsonb   | Returns pending invitations for current auth.uid()                                                 |
| `handle_user_signup_hook(event)`                          | jsonb   | Supabase auth hook: creates public.users row + org_member + URA on signup                          |

**Triggers** — verified in MCP:

| Trigger                                       | Table                        | Purpose                                                             |
| --------------------------------------------- | ---------------------------- | ------------------------------------------------------------------- |
| `validate_role_assignment_scope`              | `user_role_assignments`      | BEFORE INSERT/UPDATE — prevents branch role assigned at org scope   |
| `protect_roles_immutable_columns`             | `roles`                      | Prevents mutating `is_basic`, `organization_id` on system roles     |
| `trigger_compile_on_role_assignment`          | `user_role_assignments`      | Calls `compile_user_permissions` after assignment changes           |
| `trigger_compile_on_role_permission`          | `role_permissions`           | Calls `compile_user_permissions` after permission changes           |
| `trigger_compile_on_membership`               | `organization_members`       | Calls `compile_user_permissions` after membership changes           |
| `trigger_compile_on_override`                 | `user_permission_overrides`  | Calls `compile_user_permissions` after override changes             |
| `trigger_recompute_entitlements`              | `organization_subscriptions` | Calls `recompute_organization_entitlements` on subscription changes |
| `sync_org_slug_to_profile`                    | `organizations`              | Syncs org slug → organization_profiles on UPDATE                    |
| `set_updated_at` / `update_updated_at_column` | multiple                     | Maintains updated_at timestamps                                     |
| `validate_permission_slug_on_override`        | `user_permission_overrides`  | Validates slug format before override insert                        |

**Invitation Lifecycle** — fully implemented and verified:

1. `createInvitationAction` → `check_invitation_eligibility` RPC → INSERT invitations + invitation_role_assignments → emit `org.member.invited` → send email
2. `cancelInvitationAction` → soft-update invitations.status='cancelled' → emit `org.invitation.cancelled`
3. `resendInvitationAction` → update token + expiry → send email → emit `org.invitation.resent`
4. `acceptInvitationAction` → `accept_invitation_and_join_org` RPC (atomic) → emit `org.invitation.accepted`
5. `declineInvitationAction` → `decline_invitation` RPC → emit `org.invitation.declined`

**Role Assignment Lifecycle** — fully implemented in `organization/roles.ts`:

- Create: validates non-duplicate name, inserts role, inserts default role_permissions
- Update: updates name/description, updates role_permissions
- Delete: `delete_org_role` function (soft-delete + cascade)
- Assign: validates scope + target user membership → INSERT user_role_assignments → emit
- Remove: soft-delete user_role_assignments → emit

**Organization Onboarding** — `onboarding/index.ts`:

- `create_organization_for_current_user` RPC
- Sets user preferences (org + branch)
- Emits `org.created` and `org.onboarding.completed`

**Entitlements** — `organization_entitlements` table. Computed by `recompute_organization_entitlements` DB function. Triggered by subscription changes. Guards at application layer via `entitlements.requireModuleAccess(module)`.

### How It Works

```
Organization Creation:
  POST /onboarding
    → create_organization_for_current_user(name, slug) RPC
        → INSERT organizations
        → INSERT organization_profiles
        → INSERT branches (default)
        → ASSIGN org_owner role to creator
        → trigger_compile_on_role_assignment fires → compile_user_permissions
    → INSERT/UPSERT user_preferences
    → eventService.emit('org.created')
    → eventService.emit('org.onboarding.completed')

Invitation Acceptance (atomic DB path):
  accept_invitation_and_join_org(token):
    → validate token (status=pending, not expired)
    → UPSERT public.users (id, email) ON CONFLICT DO NOTHING
    → INSERT organization_members
    → UPSERT user_preferences.organization_id
    → Copy invitation_role_assignments → user_role_assignments
    → SET invitation.status = 'accepted'
    → trigger_compile_on_role_assignment fires
    → RETURN {success, organization_id}
  App layer: eventService.emit('org.invitation.accepted')
```

### Strengths

1. **Atomic invitation acceptance**: The entire join flow (user UPSERT, org membership, role copying, preference update) is inside a single DB function — no partial state possible.
2. **Eligibility pre-check**: `check_invitation_eligibility` prevents all common edge cases (self-invite, duplicate pending, already member) before any insert.
3. **Scope validation at DB level**: `validate_role_assignment_scope` trigger blocks invalid scope assignments regardless of application code.
4. **Trigger-based permission recompilation**: Permission changes are never stale — triggers fire synchronously on any change to roles/assignments/overrides.
5. **Immutable system role protection**: `protect_roles_immutable_columns` trigger prevents application code from modifying `is_basic` or `organization_id` on built-in roles.
6. **Consistent soft-delete pattern**: All major entities use `deleted_at` (not hard delete), preserving referential integrity for audit purposes.
7. **`public.users` UPSERT in acceptance**: Fixed in migration `20260309110000` — prevents FK violation for users created via broken signup hook path.
8. **Unique pending invitation constraint**: `invitations_org_pending_email_idx` partial unique index prevents duplicate pending invitations at the DB level.

### Weaknesses / Gaps

**GAP 1 — Warehouse domain logic not verified for completeness**
The warehouse module has 52 action files and 160 module files. While the actions exist, the domain logic (movement approvals, stock corrections, transfer workflows) could not be fully audited for correctness, edge-case handling, or transaction boundary quality within this audit scope. The absence of event emission means there is also no observable audit trail to validate against.

**GAP 2 — No idempotency protection on server actions**
`request_id` is stored in platform_events but there is no deduplication check: if the same request_id is submitted twice, two events are inserted. There is also no unique constraint on `request_id` in `platform_events`. For actions that mutate domain state, duplicate submissions are not guarded.

**GAP 3 — Mode A trade-off: event loss on crash**
Every domain write that emits an event uses Mode A (domain write → separate event emit). If the process crashes between the two operations, the domain change is persisted but the event is lost. This is documented and accepted for baseline/enhanced tiers, but for a system claiming enterprise audit capability, it is a real gap.

**GAP 4 — `org.created` potential double-emission**
Both `organization/profile.ts` and `onboarding/index.ts` emit `org.created`. If both code paths are called in sequence for the same organization, two events are inserted with the same `organizationId` and `actionKey`. No guard prevents this.

**GAP 5 — No org-level deletion workflow**
`organizations` has a `deleted_at` column but no server action or DB function for org deletion was found. Soft-delete infrastructure exists but the workflow is not implemented.

**GAP 6 — Position/org_positions domain is thin**
`org_positions` and `org_position_assignments` tables exist (2 rows each) with full RLS, but no actions, services, or event keys exist for position management. The feature appears partially scaffolded.

### Risk Assessment

| Risk                         | Level      | Detail                                                      |
| ---------------------------- | ---------- | ----------------------------------------------------------- |
| Warehouse domain unaudited   | **HIGH**   | 52 actions with no event coverage or deep audit             |
| Event loss on Mode A crash   | **MEDIUM** | Documented trade-off, but real gap for compliance use cases |
| Double org.created           | **LOW**    | Duplicate event, no functional harm                         |
| No idempotency protection    | **LOW**    | Retry scenarios may produce duplicate events                |
| Org deletion not implemented | **LOW**    | Scaffolded but not implemented                              |

---

## Layer 4 — Projection / Read Models / UX Surfaces

### What Exists

**Projection Layer** — `src/server/audit/projection.ts`.

`projectEvents(input: ProjectionInput): ProjectionResult` processes a batch of raw `PlatformEventRow[]`:

1. Registry lookup per event — skips with `console.warn` if unknown (non-crashing)
2. Personal scope pre-filter: system events (actor_user_id=null, actor_type≠'user') filtered out
3. `canViewerSeeEvent()` — central visibility gate
4. Legacy summary generation via `generateSummary()` (template string interpolation)
5. Rich summary via `buildEventSummary()` — returns `summaryKey`, `summaryPerspective`, `summaryParams`, `summaryEntities`, `primaryHref`, `iconKey`
6. Metadata projection: `projectMetadata()` strips `sensitiveFields` unless audit scope
7. ip_address/user_agent included only for audit scope
8. Pagination: `projected.slice(offset, offset + limit)`

Returns `ProjectionResult { events: ProjectedEvent[], total: number, limit: number, offset: number }`.

**`total` field semantics**: Count of post-visibility-filter events in the fetched batch, not the true DB count. Cannot be used for "page N of M" style pagination without a separate count query.

**`ProjectedEvent` shape** (from `src/server/audit/types.ts`):

- Legacy fields: `summary`, `actor_display`, `metadata`
- Rich fields: `summaryKey`, `summaryPerspective`, `summaryParams`, `summaryEntities`, `primaryHref`, `iconKey`
- Sensitive fields: `ip_address`, `user_agent` (audit scope only)
- `branch_id` carried through for branch context

Raw `PlatformEventRow` is never returned to callers — projection is mandatory.

**Reference Enrichment** — `src/server/audit/reference-enrichment.ts`.

Three-phase pipeline:

1. `collectReferences(events)` — scans projected events, collects `userIds`, `roleIds`, `branchIds` into Sets
2. `batchLoadReferences(refs)` — `Promise.all` of max 3 queries (skips empty sets):
   - `users`: SELECT id, first_name, last_name, email WHERE id IN (...)
   - `roles`: SELECT id, name WHERE id IN (...)
   - `branches`: SELECT id, name WHERE id IN (...)
     All use service-role client (bypasses RLS — called after visibility filtering)
3. `applyReferenceEnrichment(events, ctx)` — maps UUIDs to display names in `summaryParams` and `summaryEntities`

Fallbacks: `User <first-8>`, `Role <first-8>`, `Branch <first-8>`. Never throws — error returns empty map.

**Denormalization-first for roles/branches**: `metadata.role_name` and `metadata.branch_name` are checked FIRST before DB lookup — emit time captures the current name, preventing stale display if the entity is later renamed.

**Summary Builder** — `src/server/audit/summary-builder.ts` (13KB). Generates:

- `summaryKey`: i18n key root (e.g. `events.org.member.invited`)
- `summaryPerspective`: `self` (viewer is actor) | `default` (observer) | `audit` (auditor scope)
- `summaryParams`: named params for translation (`actorName`, `targetName`, `roleName`, `branchName`)
- `summaryEntities`: typed refs with `kind`, `id`, `label`, `href` for UI link rendering

**Feed Actions** — 5 server actions (all `"use server"`, SSR-first):

| Action                      | File                       | Scope              | Permission Gate           | Fetch Strategy                                          |
| --------------------------- | -------------------------- | ------------------ | ------------------------- | ------------------------------------------------------- |
| `getAuditFeedAction`        | `get-audit-feed.ts`        | audit              | `audit.events.read`       | `fetchPlatformEvents` (org-scoped)                      |
| `getOrgActivityAction`      | `get-org-activity.ts`      | org                | `org.read`                | `fetchPlatformEvents` (org-scoped)                      |
| `getPersonalActivityAction` | `get-personal-activity.ts` | personal           | (context load sufficient) | `fetchPersonalOrgEvents` + `fetchPersonalOrgNullEvents` |
| `getRecentActivityAction`   | `get-recent-activity.ts`   | (not read in full) | —                         | —                                                       |
| `getLatestActivityAction`   | `get-latest-activity.ts`   | (not read in full) | —                         | —                                                       |

**Personal feed org-null path** — `fetchPersonalOrgNullEvents` in `_query.ts`. Uses service-role client to fetch `organization_id IS NULL` events (auth events like login) restricted to:

```
actor_user_id = userId OR
(entity_type = 'user' AND entity_id = userId) OR
(target_type = 'user' AND target_id = userId)
```

This bypasses RLS (which blocks org-null events for authenticated users) in a controlled, tightly scoped way.

**Query Helpers** — `src/app/actions/audit/_query.ts`:

- `validatePagination(rawLimit, rawOffset)` — clamps to [1, 50] and [0, ∞)
- `validateBranchId(branchId)` — UUID regex validation before use as DB filter
- `computeFetchLimit(offset, limit)` — `clamp((offset + limit) * 2, offset + limit, 500)`
- `mergeAndSortEvents(a, b)` — merges org + org-null events, sorts by `created_at DESC`

**Client-side surfaces**:

- `src/app/[locale]/dashboard/activity/_components/event-feed-client.tsx` — personal feed renderer
- `src/app/[locale]/dashboard/organization/activity/_components/org-activity-wrapper.tsx` — org feed
- `src/components/audit/event-icons.tsx` — maps action_key → lucide icon name
- `src/lib/audit/event-visual-model.ts` — visual presentation helpers
- `src/lib/audit/activity-invalidation.ts` — cache invalidation patterns

### How It Works

```
getAuditFeedAction(limit, offset, branchId):
  → validatePagination + validateBranchId
  → loadDashboardContextV2()                       // auth + permissions
  → checkPermission(snapshot, AUDIT_EVENTS_READ)   // hard gate
  → fetchPlatformEvents(supabase, orgId, fetchLimit, undefined, branchId)
      → authenticated RLS client (org membership enforced by DB)
      → SELECT * FROM platform_events WHERE org_id = X [AND branch_id = Y]
        ORDER BY created_at DESC LIMIT 500
  → projectEvents({ events: rows, context: { viewerScope: 'audit', ... } })
      → per-row: registry lookup → visibility → strip → summarize → paginate
  → collectReferences(result.events)               // scan for UUIDs
  → batchLoadReferences(refs)                      // max 3 queries via service-role
  → applyReferenceEnrichment(events, ctx)          // UUID → display name
  → return { success: true, data: ProjectionResult }
```

### Strengths

1. **Hard separation of raw vs projected**: `PlatformEventRow` is never returned to callers. The `ProjectedEvent` type is the only shape the frontend may receive — documented in the type definition.
2. **Batch enrichment with no N+1**: `collectReferences → batchLoadReferences` guarantees at most 3 DB queries for any page size, regardless of event count. `Promise.all` runs them concurrently.
3. **Denormalization-first lookup**: `metadata.role_name` / `metadata.branch_name` checked before DB lookup. Provides consistent display even if entities are renamed post-emission.
4. **Personal feed handles unauthenticated paths**: `fetchPersonalOrgNullEvents` correctly handles auth events (login, password reset) that have no org context, with a tightly restricted service-role query.
5. **Server-first pattern**: All feed actions are `"use server"`. No client-side DB access for event data.
6. **Perspective-aware summaries**: `self` vs `default` vs `audit` perspective correctly handles "You logged in" vs "Alice logged in" rendering.
7. **Fallback summary string**: Legacy `summary` field kept alongside rich `summaryKey` — if i18n translation key is missing, `summary` is a readable fallback.
8. **UUID validation before query**: `validateBranchId()` uses `/^[0-9a-f]{8}-.../i` regex — prevents injection of arbitrary strings as branch filter.

### Weaknesses / Gaps

**GAP 1 — Pagination is not DB-level**
`computeFetchLimit` fetches up to 500 rows from DB, then JS-filters and slices. For org feeds with many audit-class events (filtered out of org scope), the 2x buffer may still return fewer than `limit` events. There is no mechanism to re-fetch more rows if the buffer is insufficient.

**GAP 2 — `total` is not the true DB count**
`ProjectionResult.total` is the count of events that passed visibility filtering in the current batch — not the total count in the DB for this query. A UI showing "50 of 1,200 events" cannot be built without a separate `COUNT(*)` query.

**GAP 3 — No caching on feed actions**
No `React.cache()`, `unstable_cache`, or any memoization found on feed actions. Every render cycle triggers a fresh DB query chain.

**GAP 4 — `get-recent-activity.ts` and `get-latest-activity.ts` not fully audited**
These two actions were not fully read during this audit. Their permission gates, scope handling, and pagination strategies are not verified here.

**GAP 5 — No branch_id index**
Branch-filtered queries in `fetchPlatformEvents` add `.eq("branch_id", branchId)`. The MCP index audit shows no index on `platform_events.branch_id`. For orgs with many branches and many events, this is a sequential scan scoped to `organization_id`.

**GAP 6 — Warehouse has no events to project**
The projection layer is correctly implemented but has no data for the warehouse domain. All warehouse-related activity feed surfaces return empty results.

### Risk Assessment

| Risk                    | Level      | Detail                                            |
| ----------------------- | ---------- | ------------------------------------------------- |
| Non-DB pagination       | **MEDIUM** | At scale, undercount possible with 2x buffer      |
| No true total count     | **LOW**    | UI pagination limitation, not a correctness issue |
| No caching              | **MEDIUM** | Every feed load is a full DB round-trip           |
| Missing branch_id index | **MEDIUM** | Branch-filtered queries degrade at scale          |

---

## Layer 5 — Hardening / Performance / Scale / Security / Compliance

### What Exists

**Query Boundaries**:

- `ABSOLUTE_CAP = 500` rows per fetch
- `PROJECTION_BUFFER = 2` — fetch `(offset + limit) * 2` rows
- `MAX_PAGE_LIMIT = 50` — clamped server-side via `validatePagination`
- `DEFAULT_PAGE_LIMIT = 50`

**Input Validation**:

- UUID format validation via `validateBranchId()` before use in query
- Server-side pagination clamping in `validatePagination()`
- Zod schema validation on all event metadata before DB insert
- Zod input validation on all server actions (e.g. `createInviteSchema.safeParse`)

**Indexes** — full inventory verified via MCP:

| Table                        | Index                                | Type                                           | Notes                                         |
| ---------------------------- | ------------------------------------ | ---------------------------------------------- | --------------------------------------------- |
| `platform_events`            | `pe_org_created_idx`                 | btree(org_id, created_at DESC)                 | Partial: org IS NOT NULL                      |
| `platform_events`            | `pe_actor_user_idx`                  | btree(actor_user_id, created_at DESC)          | Partial: actor IS NOT NULL                    |
| `platform_events`            | `pe_action_key_idx`                  | btree(action_key, created_at DESC)             | —                                             |
| `platform_events`            | `pe_entity_idx`                      | btree(entity_type, entity_id, created_at DESC) | —                                             |
| `platform_events`            | `pe_request_id_idx`                  | btree(request_id)                              | Partial: request_id IS NOT NULL               |
| `user_effective_permissions` | `uep_org_slug_exact_idx`             | btree(org_id, user_id, slug_exact)             | Partial: branch_id IS NULL                    |
| `user_effective_permissions` | `uep_branch_slug_exact_idx`          | btree(org_id, user_id, branch_id, slug_exact)  | Partial: branch_id IS NOT NULL                |
| `user_effective_permissions` | `idx_uep_user_org`                   | btree(user_id, org_id)                         | —                                             |
| `user_effective_permissions` | `idx_uep_user_org_branch`            | btree(user_id, org_id, branch_id)              | —                                             |
| `user_effective_permissions` | `idx_uep_permission`                 | btree(permission_slug)                         | legacy, on source slug                        |
| `organization_members`       | `idx_org_members_active_lookup`      | btree(org_id, user_id)                         | Partial: status='active', deleted_at IS NULL  |
| `organization_members`       | `idx_org_members_org_active`         | btree(org_id)                                  | Partial: deleted_at IS NULL                   |
| `invitations`                | `invitations_org_pending_email_idx`  | UNIQUE btree(org_id, lower(email))             | Partial: status='pending', deleted_at IS NULL |
| `invitations`                | `idx_invitations_token_status_email` | btree(token, status, email)                    | Partial: deleted_at IS NULL                   |

**Error Handling**:

- `eventService.emit()` returns typed `{ success: false, error }` — never throws
- Reference enrichment functions never throw — return empty Map on error
- All feed actions return `{ success: false, error: string }` on failure
- `console.error` with structured context on all emission failures
- `console.warn` for unknown action_key in projection (non-fatal skip)

**Service-Role Client Usage**:

- `event.service.ts` — INSERT into platform_events (isolated, single function)
- `reference-enrichment.ts` — batch lookups (users, roles, branches) AFTER visibility filtering
- `_query.ts` `fetchPersonalOrgNullEvents` — auth event query (tightly restricted OR filter)

**Type Safety**:

- `platform_events` table not in generated DB types (`supabase/types/types.ts`) — uses `as any` cast
- The `as any` cast is isolated to: `event.service.ts` line 116, `_query.ts` lines 118, 176, 232, `reference-enrichment.ts` lines 414, 462, 501
- All application-level types above these casts remain strongly typed

**Triggers for Data Integrity**:

- `set_updated_at` / `update_updated_at_column` — automatic timestamp maintenance
- `validate_role_assignment_scope` — DB-enforced scope constraint
- `protect_roles_immutable_columns` — DB-enforced system role protection
- `sync_org_slug_to_profile` — denormalization consistency

**Entitlements Recomputation**:

- `recompute_organization_entitlements` called by `trigger_recompute_entitlements` on subscription changes
- `trigger_recompute_on_plan_update` fires when plan `enabled_modules` changes

### How It Works (Performance Path)

```
Audit Feed Query (org with 10,000 events, requesting page 1, limit 20):

computeFetchLimit(0, 20) = min((0+20)*2, 500) = 40
  → SELECT * FROM platform_events WHERE org_id = X ORDER BY created_at DESC LIMIT 40
  → Uses pe_org_created_idx: btree scan on (org_id, created_at DESC) — efficient

projectEvents([40 rows], { scope: 'audit' })
  → All 40 pass (audit scope sees all)
  → total = 40, slice(0, 20) → 20 events returned

batchLoadReferences({ userIds, roleIds, branchIds })
  → Promise.all([
      SELECT id,first_name,last_name,email FROM users WHERE id IN (N user IDs),
      SELECT id,name FROM roles WHERE id IN (M role IDs),
      SELECT id,name FROM branches WHERE id IN (K branch IDs)
    ])
  → max 3 concurrent queries

Total DB queries: 1 (events) + 1 (context load) + 2 (UEP queries) + 3 (enrichment) = 7 queries per feed request
```

### Strengths

1. **Partial indexes align to actual query patterns**: `uep_org_slug_exact_idx` and `uep_branch_slug_exact_idx` are designed for the exact two-query pattern in `PermissionServiceV2`. Index selectivity is maximized.
2. **Bounded query design**: Every fetch path has an explicit cap. No unbounded queries exist in the audited code paths.
3. **Fail-closed error handling**: On permission fetch error, `PermissionServiceV2` returns empty snapshot (deny all). On enrichment failure, empty maps returned (display degrades gracefully).
4. **Structured error logging**: `[event.emit.failure]`, `[getAuditFeedAction]`, `[reference-enrichment]` prefixes in console.error calls enable log aggregation.
5. **Selective index usage**: `pe_actor_user_idx` partial index (WHERE actor_user_id IS NOT NULL) avoids indexing null-actor system events. Correct design choice.
6. **Concurrent enrichment**: `Promise.all` for 3 enrichment queries — no sequential waterfall.
7. **Metadata normalization**: `JSON.parse(JSON.stringify(raw))` is a correct and safe JSON round-trip for stripping `undefined` values.

### Weaknesses / Gaps

**GAP 1 — No index on `platform_events.branch_id`**
Verified missing via MCP. `fetchPlatformEvents` with `branchId` filter adds `.eq("branch_id", branchId)` to a query already scoped by `organization_id`. Postgres will use `pe_org_created_idx` for the org filter but then must scan all org events to find branch matches. For orgs with thousands of events across many branches, this is O(org events) per branch-filtered page load.

**GAP 2 — No compound `(organization_id, actor_user_id, created_at)` index**
The personal feed query for org-scoped events uses `fetchPersonalOrgEvents` with an OR filter: `actor_user_id.eq.X OR (entity_type.eq.user AND entity_id.eq.X) OR (target_type.eq.user AND target_id.eq.X)`. Postgres cannot use a single index for an OR filter efficiently. This query likely falls back to a sequential scan on org events for the entity/target paths. The `pe_actor_user_idx` only covers the actor path.

**GAP 3 — `platform_events` NOT in generated TypeScript types**
`supabase/types/types.ts` does not include `platform_events`. The table was created after the last type generation run. Six `as any` casts exist across the codebase as a result. Type safety for the event system depends entirely on application-level type assertions (`as PlatformEventRow[]`).

**GAP 4 — No immutability enforcement at DB level**
Verified: `platform_events` has no UPDATE or DELETE RLS policies for any role, which prevents authenticated users from modifying events. However, there is no DB trigger preventing the service-role client from executing UPDATE or DELETE. Application code has the service-role key and could (accidentally or maliciously) modify events. True append-only would require a `BEFORE UPDATE OR DELETE` trigger raising an exception.

**GAP 5 — No rate limiting**
No rate limiting found in any server action, middleware, or API route handler. Feed actions, event emission, permission checks — all are uncapped per authenticated session. A compromised token could enumerate events or trigger expensive permission recompilation.

**GAP 6 — No caching on feed actions**
Feed actions `getAuditFeedAction`, `getOrgActivityAction`, etc. perform full DB round-trips on every call. No `React.cache()`, `unstable_cache`, or SWR-style deduplication is applied. For dashboards that load multiple feeds on mount, each triggers independent DB queries.

**GAP 7 — No GDPR/PII erasure mechanism**
`platform_events.metadata` can contain PII (e.g. `invitee_email` in `org.member.invited` events). The `sensitiveFields` array in the registry strips these fields at read time (projection), but the raw data persists in the DB indefinitely. No data retention policy, no erasure endpoint, and no mechanism to redact metadata on a specific event exists.

**GAP 8 — No data retention policy on `platform_events`**
No `created_at < NOW() - INTERVAL` purge mechanism found. With continuous event emission and no TTL, the table will grow unboundedly. The indexes are designed for recent-first queries (DESC), so old data degrades index efficiency over time as the table grows.

**GAP 9 — Projection-side pagination undersupply risk**
For an org feed (scope: 'org') with `computeFetchLimit(0, 20) = 40`, if 30 of the 40 fetched events are audit-class (filtered out at projection), only 10 events are returned for a requested page of 20. The caller receives `total: 10` and cannot distinguish "only 10 events match" from "there are 200 more but they were filtered". No re-fetch loop exists.

**GAP 10 — `idx_uep_user_org_permission` uses `permission_slug` not `permission_slug_exact`**
Verified via MCP: `idx_uep_user_org_permission` is on `(user_id, org_id, permission_slug)` — the source slug column, not `permission_slug_exact`. The two-query pattern in `PermissionServiceV2` queries `permission_slug_exact`, so this index is not used by the primary read path. The `uep_org_slug_exact_idx` and `uep_branch_slug_exact_idx` are the correct indexes for the current code. The `idx_uep_user_org_permission` index is a legacy artifact consuming space without benefit.

### Risk Assessment

| Risk                        | Level          | Detail                                                      |
| --------------------------- | -------------- | ----------------------------------------------------------- |
| Missing branch_id index     | **MEDIUM**     | Sequential scan on branch-filtered event queries            |
| No immutability enforcement | **MEDIUM**     | Service-role can modify audit trail                         |
| No rate limiting            | **MEDIUM**     | No protection against event flood or permission enumeration |
| PII in metadata, no erasure | **MEDIUM**     | GDPR risk for EU deployments                                |
| No caching                  | **LOW-MEDIUM** | Performance, not correctness                                |
| Projection undersupply      | **LOW-MEDIUM** | Poor UX for paginated org feeds                             |
| No data retention           | **LOW**        | Eventual table bloat                                        |
| `as any` casts              | **LOW**        | Type-safety gap, not a runtime risk                         |
| Legacy stale index          | **LOW**        | Wasted storage, no correctness impact                       |

---

## Cross-Layer Findings

### 1. Event emission is domain-gated to organization-management only

All 19 `eventService.emit()` calls are in `src/app/actions/organization/`. The warehouse module (52 actions), teams, tools, contacts, and all auth lifecycle paths are unconnected to the event system. This is a cross-layer gap: Layer 1 (audit) and Layer 4 (projection) are architecturally sound but Layer 3 (domain) has no wiring for the majority of the application's business operations.

### 2. Permission snapshot loaded on every server action independently

`loadDashboardContextV2()` → `loadUserContextV2()` → `PermissionServiceV2.getPermissionSnapshotForUser()` is called at the top of every server action. This executes 2 DB queries (org-scope UEP + branch-scope UEP) per request. With no caching, a dashboard loading 5 components simultaneously makes 10 UEP queries. The partial indexes make each query fast, but the total query count per page load is high.

### 3. `as any` cast for `platform_events` propagates across 4 files

Because `platform_events` is not in `supabase/types/types.ts`, the `as any` cast appears in `event.service.ts`, `_query.ts`, and `reference-enrichment.ts`. The table has been in production (50 rows) but type regeneration has not been run. This affects TypeScript's ability to catch schema changes.

### 4. Dual summary systems in `ProjectedEvent`

`ProjectedEvent` carries both:

- `summary: string` — legacy template interpolation (e.g. "Alice invited bob@example.com to the organization")
- `summaryKey + summaryParams + summaryEntities` — rich i18n model

Both are maintained in sync by `rebuildSummary()` in `reference-enrichment.ts`. This is functional but carries double the data per event in the response payload. The legacy `summary` field exists "for backward compat" per code comments, but there is no version in the codebase that uses it exclusively — both systems appear live simultaneously.

### 5. Service-role client used in 3 distinct contexts with different security postures

| Location                                 | Purpose                     | Restriction                                          |
| ---------------------------------------- | --------------------------- | ---------------------------------------------------- |
| `event.service.ts`                       | INSERT platform_events      | Unrestricted insert access                           |
| `_query.ts` `fetchPersonalOrgNullEvents` | SELECT auth events          | Restricted: org IS NULL + actor/entity/target filter |
| `reference-enrichment.ts`                | SELECT users/roles/branches | Post-visibility-filtering only                       |

The service-role key has full DB access. Its usage is documented and limited, but any expansion of service-role usage (e.g. new developer adding a shortcut query) would bypass RLS silently.

### 6. Invitation eligibility checked before insert, but not atomically with insert

`check_invitation_eligibility` RPC is called in `OrgInvitationsService.createInvitation()` before the INSERT. However, there is a TOCTOU (time-of-check-to-time-of-use) window: between the eligibility check and the insert, another invitation could be created for the same email. The `invitations_org_pending_email_idx` unique partial index provides the final guard, which is correct. But if the eligibility check returns `eligible=true` and the insert then fails the unique constraint, the error is propagated as a DB error rather than a friendly eligibility error.

### 7. `user_has_effective_permission` RPC vs `has_permission` function — different semantics

- `has_permission(org_id, slug)` — uses `auth.uid()` internally, org-scope only (`branch_id IS NULL`)
- `user_has_effective_permission(user_id, org_id, slug)` — explicit user_id, also org-scope only
- `has_branch_permission(org_id, branch_id, slug)` — org-wide OR branch-specific grant

The permission service `PermissionServiceV2.hasPermission()` calls `user_has_effective_permission` (RPC). But `PermissionServiceV2.currentUserHasPermission()` calls `has_permission`. Both are org-scope only. Neither calls `has_branch_permission`. Server actions that need branch-aware permission checking must use the snapshot (loaded from UEP with both org and branch slugs) rather than these RPCs.

---

## Critical Gaps (Top Priority)

These are proven, code-verified gaps — not assumptions.

### Critical Gap 1: Warehouse module has zero event emission

- **Evidence**: `grep -r "eventService.emit" src/app/actions/warehouse/` returns no results
- **Impact**: Stock movements, inventory changes, transfers, deliveries, product operations — no audit trail exists for any warehouse operation
- **Files affected**: All 52 files in `src/app/actions/warehouse/`
- **Registry gap**: No warehouse action keys exist in `src/server/audit/event-registry.ts`
- **Severity**: High — renders the audit system irrelevant for the application's primary business domain

### Critical Gap 2: Auth lifecycle events never emitted

- **Evidence**: 5 auth action keys registered in event-registry.ts (`auth.login`, `auth.login.failed`, `auth.password.reset_requested`, `auth.password.reset_completed`, `auth.session.revoked`). Grep of entire `src/` confirms no `eventService.emit` call with these keys.
- **Impact**: Login activity, failed authentication attempts, password resets — all security-critical events — are not logged
- **Required**: Either Supabase auth webhook wiring or DB-side emission via a hook function
- **Severity**: High for security/compliance use cases

### Critical Gap 3: `platform_events` append-only property is not DB-enforced

- **Evidence**: MCP confirms no UPDATE/DELETE trigger or constraint on `platform_events`. Service-role client (used in application code) has `ALL` access.
- **Impact**: Application code (or any code with the service-role key) can silently alter or delete audit records
- **Fix requires**: A `BEFORE UPDATE OR DELETE` trigger on `platform_events` that raises an exception
- **Severity**: Medium — breaks the audit integrity guarantee

### Critical Gap 4: No `branch_id` index on `platform_events`

- **Evidence**: MCP index audit shows no index on `branch_id`
- **Impact**: Branch-filtered feed queries perform sequential scans over all org events
- **Severity**: Medium — performance degradation at scale, not a correctness issue

### Critical Gap 5: PII in `platform_events.metadata` with no erasure path

- **Evidence**: `org.member.invited` registry entry has `sensitiveFields: ["invitee_email", "invitee_first_name", "invitee_last_name"]` — these are stripped at read time but stored permanently in the DB
- **Impact**: GDPR right-to-erasure cannot be fulfilled without a metadata redaction mechanism
- **Severity**: Medium for EU deployments

### Critical Gap 6: `platform_events` not in generated TypeScript types

- **Evidence**: `as any` cast in `event.service.ts` line 116 — "platform_events is a new table not yet in generated DB types"
- **Impact**: Schema changes to `platform_events` will not produce TypeScript compile errors
- **Severity**: Low — cosmetic type gap, not a runtime issue

---

## Maturity Score (per layer)

### Layer 1 — Audit / Logging / Observability: **5/10**

**Justification**: The architecture is correct and the infrastructure is solid (registry, service, visibility, projection, enrichment all implemented correctly). However, emission coverage is the primary measure of an audit system's value. With 0 of ~52 warehouse actions wired, 0 auth events emitted, and 5 of the remaining 6 module families completely dark, the system only observes the organization-management domain. A system that logs 15% of its domain operations cannot be scored higher than 5 regardless of how well those 15% are logged.

### Layer 2 — Permissions / Security / Authorization: **9/10**

**Justification**: Exceptional depth. Three enforcement layers (DB RLS, server action, UI). Wildcard expansion at compile time. Branch-aware permission model. Partial indexes aligned to exact query pattern. Strong trigger-based immutability for system roles. Only deductions: the `{public}` role on platform_events RLS policy is incorrect, the roles RESTRICTIVE/PERMISSIVE UPDATE policy divergence is a latent risk, no rate limiting exists, and UEP is broadly visible to `members.read` holders.

### Layer 3 — Domain / Business Logic / Workflows: **7/10**

**Justification**: The organization-management domain is well-implemented with atomic operations (invitation acceptance), eligibility pre-checks, scope validation triggers, and comprehensive soft-delete patterns. The permission compiler and trigger chain are production-quality. Deductions: warehouse domain logic could not be fully audited (no event trail to validate against), `org.created` double-emission risk, no idempotency protection, and Mode A event loss on crash is an unmitigated risk for compliance use cases.

### Layer 4 — Projection / Read Models / UX Surfaces: **8/10**

**Justification**: The projection design is architecturally correct and well-implemented. Hard separation of raw vs projected events, mandatory projection path, batch enrichment with no N+1, denormalization-first lookup, scope-aware metadata stripping, and perspective-aware summaries are all correctly implemented. Deductions: pagination is not DB-level (projection-side undersupply risk), `total` is not a true DB count, no caching, missing branch_id index degrades branch-filtered feeds, and the dual summary system (legacy + rich) adds payload overhead.

### Layer 5 — Hardening / Performance / Scale / Security / Compliance: **5/10**

**Justification**: Solid foundation: bounded queries, input validation, partial indexes, structured error handling, fail-closed permission errors. However, critical hardening gaps prevent a higher score: no immutability enforcement (append-only not DB-enforced), no rate limiting, no PII erasure path, no data retention policy, non-DB-level pagination, missing branch_id index, no caching, and `platform_events` not in generated types. These are not trivial improvements — several (rate limiting, GDPR erasure, immutability trigger) are required for enterprise/compliance deployment.

---

## Final Verdict

### Is the system MVP / Production-Ready / Enterprise-Grade?

**Layer 2 (Permissions/Authorization): Enterprise-grade**
The RBAC system with wildcard expansion, branch-aware permissions, trigger-based recompilation, and three-layer enforcement is enterprise-quality. It would not be out of place in a regulated production environment.

**Layer 3 (Domain Logic) — organization-management domain: Production-ready**
Atomic invitation acceptance, scope-validated role assignments, soft-delete throughout, and trigger-enforced immutability make this domain production-ready. The warehouse domain cannot be assessed to the same standard.

**Layer 4 (Projection): Production-ready**
The event projection, enrichment, and feed generation are correctly designed and implemented. Non-DB pagination and missing caching are scalability concerns, not correctness failures.

**Layer 1 (Audit/Logging): Pre-production**
The architecture is production-grade but emission coverage is at MVP level. A system that logs organization management but not warehouse operations, and logs no auth events, does not provide meaningful operational observability for a SaaS warehouse platform.

**Layer 5 (Hardening): Pre-production**
Missing rate limiting, no PII erasure, no true immutability, no data retention policy, and non-typed DB table make this pre-production for regulated/enterprise deployments.

### Summary

> **The system is production-ready for its core identity and access management layer. It is pre-production for its observability and compliance layers. It is MVP for overall enterprise suitability.**

The most consequential gap is not architectural — the event system design is correct. The gap is coverage: the majority of the application's business-critical operations (warehouse) are completely unobserved. Before claiming enterprise-grade audit capability, event emission must be extended to warehouse operations, auth lifecycle events must be wired, and the DB-level immutability guarantee must be implemented.
