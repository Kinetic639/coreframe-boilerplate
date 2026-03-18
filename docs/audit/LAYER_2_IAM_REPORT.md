# Layer 2 — IAM Audit Report

## Identity, Access Control, Authorization, Multi-tenancy, Entitlements

**Audit Date:** 2026-03-18
**Method:** Code-verified, DB-verified, zero-assumption
**Source:** Live Supabase target DB (`rjeraydumwechpjjzrus`) + full codebase read
**Scope:** Authentication, RBAC, RLS, org isolation, entitlements, enforcement

---

## 1. Executive Summary

The IAM layer is **architecturally sound but operationally inconsistent**. The V2 permission model (`compile_user_permissions` → `user_effective_permissions`) is well-designed and functions correctly at the DB level. Multi-tenancy isolation via RLS is solid. However, three independent confirmed defects break real runtime behavior: the live JWT hook produces a payload that no TypeScript code can read; the `user_has_effective_permission` RPC called by `PermissionServiceV2.hasPermission()` does not exist in the DB; and the `admin_entitlements` table does not exist, making the admin portal permanently inaccessible.

**Production readiness:** Conditionally yes — core RBAC and RLS work; broken components degrade gracefully (fail-closed).
**Enterprise readiness:** No — no middleware, JWT roles always empty, stale-permission window on recompile, no MFA, no session invalidation on role change.

---

## 2. IAM Architecture Overview

### Identity Model

```
auth.users (Supabase GoTrue)
    ↓ FK
public.users (id, email, first_name, last_name, avatar_url, avatar_path)
    ↓ FK
public.organization_members (user_id, organization_id, status, deleted_at)
```

- `auth.users` is the canonical identity source.
- `public.users` holds display fields. Missing rows are tolerated via fallback to `authUser.user_metadata`.
- Org membership requires both a `public.users` row and an `organization_members` row (FK chain).

### Permission Model (V2)

```
permissions (slug registry, 43 entries)
    ↓
role_permissions (role_id → permission_id, allowed BOOL)
    ↓
user_role_assignments (user_id, role_id, scope, scope_id, deleted_at)
    ↓ [compile_user_permissions() trigger]
user_effective_permissions (user_id, org_id, permission_slug, permission_slug_exact, branch_id)
```

- "Compile, don't evaluate": DB triggers pre-compute facts at write time.
- Wildcard expansion: `account.*` expands to all matching concrete slugs at compile time.
- `permission_slug_exact` always contains a concrete slug (never a wildcard).
- `has_permission(org_id, slug)` and `has_branch_permission(org_id, branch_id, slug)` read from this table.

### Org Model

```
organizations (id, name, slug, created_by, deleted_at)
    ↓ 1:1
organization_profiles (org_id, name, name_2, slug, logo_url)
    ↓
organization_members (many-to-many with users)
    ↓
branches (id, organization_id, name, slug, deleted_at)
```

### Enforcement Flow

```
HTTP request → Next.js Server Action
    → supabase.auth.getUser()   [JWT validated server-side]
    → loadDashboardContextV2()
        → loadAppContextV2()    [org/branch resolution from preferences]
        → loadUserContextV2()   [PermissionServiceV2.getPermissionSnapshotForUser()]
    → checkPermission(snapshot, slug)   [app-layer gate]
    → OrgService.someMethod(supabase)   [RLS-enforced DB call]
```

---

## 3. Maturity Score

| Area                | Score      | Justification                                                                                                                                                      |
| ------------------- | ---------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Identity            | 6/10       | `getUser()` used in main paths (correct); `getSession()` used in `HasAnyRoleServer` (insecure); no middleware; JWT hook mismatch makes roles always empty          |
| Authorization       | 7/10       | Compile-don't-evaluate V2 model is well-designed; wildcard expansion correct; `permission_slug_exact` on DB functions; `user_has_effective_permission` RPC missing |
| Enforcement         | 6/10       | Consistent server action pattern; RLS as backstop; no route-level middleware; `ORG_ONLY_SLUGS` only at app layer; stale-permission window during recompile         |
| Multi-tenancy       | 8/10       | `is_org_member()` in all table RLS policies; org isolation at DB level; branch isolation correct; soft-delete respected                                            |
| Security Boundaries | 5/10       | `createServiceClient()` used for specific cases only; `HasAnyRoleServer` uses `getSession()`; no session invalidation on role change; no cookie rotation           |
| Entitlements        | 6/10       | Plan + module + limit compile model is solid; `admin_entitlements` table missing in DB; no user-level feature flags                                                |
| **Overall**         | **6.3/10** | Architecturally advanced for a boilerplate, but 3 confirmed operational defects and no middleware                                                                  |

---

## 4. Verified Strengths (Code-Backed)

### S1: Compile-Don't-Evaluate Permission Architecture

**File:** `supabase/migrations/20260304150000_add_permission_slug_exact_compiler_expansion.sql`
**Live DB function:** `compile_user_permissions()` (verified via `pg_get_functiondef`)

The compiler handles BOTH org-scope and branch-scope in a single atomic function call. Wildcard expansion via LEFT JOIN (`p.slug LIKE replace('%*%', '*', '%')`). Advisory lock (`pg_advisory_xact_lock`) prevents concurrent compilation races for the same `(user, org)` pair.

### S2: Two-Layer RLS Design

**Verified by:** DB query across 14 tables — all RLS enabled

Every write policy uses the two-layer pattern:

```sql
is_org_member(organization_id) AND has_permission(organization_id, 'permission.slug')
```

Neither layer is bypassed. 13 of 14 key IAM tables have explicit SELECT/INSERT/UPDATE/DELETE policies. `service_role` bypass is explicit and intentional (seed/migrations).

### S3: `getUser()` Usage in Primary SSR Paths

**File:** `src/server/loaders/v2/load-user-context.v2.ts:51`, `src/server/loaders/v2/load-app-context.v2.ts:46`

Both V2 SSR loaders call `supabase.auth.getUser()` which performs server-side JWT validation against Supabase Auth, not just cookie-read. Comment explicitly explains this:

```typescript
// getUser() is preferred over getSession()
// because getSession() only reads cookies without server-side token validation
```

### S4: Type-Safe Permission Constants

**File:** `src/lib/constants/permissions.ts`

35 named constants with `as const` typing. `PermissionSlug` type union catches typos at compile time. File-level comment enforces discipline:

```typescript
// NEVER use raw permission strings outside this file
```

Server actions import from this file exclusively (verified across `roles.ts`, `members.ts`, `invitations.ts`, `branches.ts`).

### S5: Consistent Server Action Enforcement Pattern

**File:** `src/app/actions/organization/roles.ts:66–93` (representative)

Every action follows: `requireModuleAccess()` → context load → `checkPermission()` → service call. No action shortcuts this sequence. Dual-gate for branch managers is correctly implemented.

### S6: Fail-Closed on Auth Error

**Files:** `src/app/actions/v2/permissions.ts:37–40`, `src/server/loaders/v2/load-user-context.v2.ts:53–55`

All auth paths return empty permission snapshots (not full access) on error. Entitlement checks throw `EntitlementError` rather than silently allowing.

### S7: Branch-Scope Isolation

**DB function verified:** `has_branch_permission()` allows either `branch_id IS NULL` (org-wide grant) or `branch_id = p_branch_id` (exact branch). RLS policies for `user_role_assignments` use subquery to look up `branch.organization_id`, preventing cross-org branch spoofing.

### S8: `ORG_ONLY_SLUGS` Scope Validation

**File:** `src/app/actions/organization/roles.ts:29–41`

Branch-scoped role creation and updates are rejected at the server action level if they contain org-only permissions (`org.read`, `org.update`, `branches.create`, `members.*`, `invites.*`, `module.*.access`).

---

## 5. Critical Gaps (Code-Backed)

### G1: JWT Hook Mismatch — Roles Always Empty in JWT Consumers

**Severity: HIGH**

**Live DB hook output** (verified via `pg_get_functiondef`):

```sql
-- Live hook injects roles into:
claims := jsonb_set(claims, '{app_metadata}', ... || jsonb_build_object('roles', roles_data));
-- Location: jwt.app_metadata.roles
-- Field names: role_id, name, is_basic, scope, scope_id, scope_type
```

**TypeScript reads:**

```typescript
// src/utils/auth/getUserRolesFromJWT.ts:13
const decoded = jwtDecode<DecodedJWT>(accessToken);
return decoded.roles || []; // reads jwt.roles (root level) — WRONG PATH
```

**TypeScript JWTRole type expects:**

```typescript
// src/lib/types/auth.ts:11-18
interface JWTRole {
  role: string; // hook provides 'name'
  org_id: string; // hook provides nothing (only scope_id)
  branch_id: string; // hook provides nothing (only scope_id)
}
```

Migration `20260105115648_update_jwt_custom_hook.sql` exists locally with the correct updated hook but was **never applied to the target DB** (confirmed: target DB uses `target_*` naming convention, not timestamp names; `target_p3_b3_auth_hooks` migration deployed the old hook version).

**Impact:**

- `AuthService.getUserRoles()` → always `[]`
- `AuthService.hasRole()` → always `false`
- `HasAnyRoleClient` and `HasAnyRoleServer` → always show fallback/deny
- `loadUserContextV2`: `roles: []` in all user contexts
- `AuthService.getUserOrganizations()` and `getUserBranches()` → always `[]`
- **Does NOT break permission enforcement** — `PermissionServiceV2` reads from `user_effective_permissions` table directly, not from JWT

### G2: `user_has_effective_permission` RPC Does Not Exist

**Severity: MEDIUM**

`PermissionServiceV2.hasPermission()` calls:

```typescript
// src/server/services/permission-v2.service.ts:239
const { data, error } = await supabase.rpc("user_has_effective_permission", {
  p_user_id: userId,
  p_organization_id: orgId,
  p_permission_slug: permission,
});
```

**DB query result:** Function `user_has_effective_permission` is NOT present in `information_schema.routines` for schema `public`. The full function list was verified (30 functions returned). This call fails with a Supabase RPC error, which is logged and returns `false`.

`currentUserHasPermission()` (calls `has_permission` RPC) **works correctly** — `has_permission` exists.
`getPermissionSnapshotForUser()` (reads table directly) **works correctly**.

Impact: `PermissionServiceV2.hasPermission()` always returns `false`. Check usage: it's primarily a utility for explicit individual permission checks, not the SSR path.

### G3: `admin_entitlements` Table Does Not Exist

**Severity: HIGH (for admin panel)**

```sql
-- DB Query result:
SELECT tablename FROM pg_tables WHERE tablename = 'admin_entitlements'; -- returns 0 rows
```

`AdminEntitlementsService.loadAdminEntitlements()` queries this table. On error, returns `null`. In `loadAdminContextV2`:

```typescript
// src/server/loaders/v2/load-admin-context.v2.ts:86-88
const permissionSnapshot = adminEntitlements?.enabled
  ? { allow: [SUPERADMIN_WILDCARD], deny: [] }
  : { allow: [], deny: [] };
```

`adminEntitlements` is always `null` → `enabled` is `undefined` → snapshot is always `{ allow: [], deny: [] }` → admin panel perpetually blocked for all users. The admin portal layout presumably checks `superadmin.*` permission → never passes.

### G4: No Route-Level Middleware

**Severity: HIGH**

**Verified:** `src/middleware.ts` does not exist (`Glob` returned no results).

There is no Next.js middleware intercepting requests. Session freshness and route protection depend entirely on individual page/layout components calling `loadDashboardContextV2()`. Any page that forgets this call is unprotected.

In contrast, Supabase's official Next.js template requires middleware to refresh session cookies on every request. Without it:

- Short-lived JWT tokens may expire between page loads with no silent refresh
- A protected page rendered without context loading has no auth barrier
- No central redirect-to-login behavior

### G5: `HasAnyRoleServer` Uses `getSession()` Instead of `getUser()`

**Severity: MEDIUM**

```typescript
// src/components/auth/HasAnyRoleServer.tsx:16-17
const {
  data: { session },
} = await supabase.auth.getSession();
const token = session?.access_token;
```

`getSession()` reads the session cookie without server-side token validation. An attacker with a tampered or expired cookie can forge this. The component also suffers from the JWT hook mismatch (G1), so it effectively always renders the fallback regardless.

### G6: Stale Permission Window During Recompile

**Severity: MEDIUM**

`compile_user_permissions` (verified live):

```sql
-- Step 1: DELETE all permissions for user/org
DELETE FROM user_effective_permissions WHERE user_id = p_user_id AND organization_id = p_organization_id;
-- Step 2: INSERT new permissions (two INSERT statements)
INSERT INTO user_effective_permissions ...;
INSERT INTO user_effective_permissions ...; -- branch-scoped
```

Between the DELETE and the final INSERT completion, concurrent requests reading `user_effective_permissions` see an empty permission set. The advisory lock (`pg_advisory_xact_lock`) only prevents concurrent compilation, not concurrent reads. This window is small but real.

After a role assignment change, the user's client-side `permissionSnapshot` is also stale until the next `PermissionsSync` poll or navigation. There is no WebSocket/Realtime notification to invalidate the client snapshot.

### G7: `ORG_ONLY_SLUGS` Not Enforced at DB Level

**Severity: LOW-MEDIUM**

Validation that branch-scoped roles cannot contain org-only permissions exists only in the server action:

```typescript
// src/app/actions/organization/roles.ts:112-119
if (parsed.data.scope_type === "branch" && parsed.data.permission_slugs?.length) {
  const invalid = parsed.data.permission_slugs.filter((s) => ORG_ONLY_SLUGS.has(s));
  if (invalid.length > 0) { return { success: false, error: ... }; }
}
```

The DB has `validate_role_assignment_scope` trigger (verified in function list) that fires BEFORE INSERT OR UPDATE on `user_role_assignments` and checks `scope_type`. However, at the `role_permissions` level (what permissions a role CAN have), there is no DB constraint preventing `members.manage` from being added to a branch-scoped role. A service_role operation or direct DB mutation bypasses this guard.

### G8: No MFA Support

**Severity: MEDIUM (enterprise context)**

No MFA is implemented at the application layer. Supabase Auth supports TOTP, but no code enables or enforces it. No per-org MFA policy. Enterprise customers typically require MFA for privileged roles.

### G9: No Session Invalidation on Role/Permission Change

**Severity: MEDIUM**

When a user's role is removed or a permission is revoked, their JWT (lifetime: typically 1 hour) remains valid and still passes `supabase.auth.getUser()` validation. The permissions in `user_effective_permissions` are immediately updated by the trigger, but the user's active browser session still shows the old permissions from their `permissionSnapshot` store until the next `getBranchPermissions` sync.

Real-time tables are enabled for `organization_members` (migration `20260312130000`) and `invitations` (migration `20260312120000`), but NOT for `user_effective_permissions` or `user_role_assignments`. There is no push mechanism to tell a client "your permissions changed — re-fetch."

### G10: Weak `users` Table RLS — Overly Permissive SELECT

**Severity: LOW**

```sql
-- src/migrations/20260120200000_rls_v2_complete_security.sql, live DB confirmed
CREATE POLICY "users_select_org_member"
  ON public.users FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM organization_members om1
      JOIN organization_members om2 ON om1.organization_id = om2.organization_id
      WHERE om1.user_id = auth.uid() AND om2.user_id = users.id ...
    )
  );
```

Any user who shares ANY organization with another user can read that user's full `public.users` row (including `email`, `first_name`, `last_name`, `avatar_url`, `avatar_path`). There is no `members.read` permission gate on this SELECT policy — co-membership alone is sufficient. A low-privilege `org_member` with zero permissions can enumerate all colleagues' profiles.

---

## 6. Enterprise Comparison

### vs. Slack

| Feature                      | Slack                      | This System                             |
| ---------------------------- | -------------------------- | --------------------------------------- |
| Route protection             | Middleware (every request) | Per-page only, no middleware            |
| JWT roles in token           | SSO SAML, separate         | Broken (app_metadata mismatch)          |
| Permission model             | Channel/workspace ACLs     | RBAC + wildcard, well-designed          |
| MFA enforcement              | Per-workspace policy       | Not implemented                         |
| Session invalidation         | Immediate on role change   | Eventual (next poll)                    |
| Audit trail for role changes | Full                       | Wired (org.member.role_assigned events) |

### vs. GitHub

| Feature                | GitHub                      | This System                    |
| ---------------------- | --------------------------- | ------------------------------ |
| Permission granularity | Repo-level, org-level, team | Org + branch scoped            |
| Wildcard permissions   | Not applicable              | Implemented with compiler      |
| Compiled permissions   | N/A                         | ✓ (user_effective_permissions) |
| RLS at DB level        | Not applicable              | ✓ (13+ tables)                 |
| SCIM provisioning      | Enterprise only             | Not implemented                |
| Permission inheritance | Org → Team → Repo           | Org → Branch (flat)            |

### vs. Notion

| Feature                 | Notion              | This System                               |
| ----------------------- | ------------------- | ----------------------------------------- |
| Workspace isolation     | ✓ Strong            | ✓ Strong (is_org_member in all policies)  |
| Guest access            | Limited             | Not implemented                           |
| Fine-grained page perms | ✓                   | Branch-level only                         |
| Entitlement model       | Plan-gated features | ✓ Compiled org_entitlements               |
| Admin panel             | ✓                   | Broken (admin_entitlements table missing) |

**Key gap vs. all three:** No middleware means session freshness is not guaranteed between page loads. Enterprise platforms universally enforce auth at the request layer.

---

## 7. Risk Analysis

### Privilege Escalation Risk: LOW-MEDIUM

- DB RLS enforces `members.manage` for role writes — hard to bypass without service_role
- `ORG_ONLY_SLUGS` validation is app-only (G7) — bypass possible via service_role or direct DB access
- `user_has_effective_permission` RPC missing (G2) means one explicit check path is silently failing
- Overall: the compile model is sound; escalation requires either a code bug or direct DB access

### Data Leakage Risk: MEDIUM

- Cross-org access: blocked (RLS `is_org_member` universal) — LOW risk
- Within-org: `users` table visible to all co-members without `members.read` — MEDIUM risk (G10)
- JWT roles broken (G1): if any code ever granted elevated access based on JWT roles, it would grant nothing — actually safer in this case
- Branch data: all protected by `branches_select_member` (org member gate) — LOW risk

### Auth Bypass Risk: MEDIUM

- No middleware: a page component that forgets `loadDashboardContextV2()` is unprotected
- `HasAnyRoleServer` uses `getSession()` (G5) — exploitable with cookie manipulation
- JWT token lifespan (default 1h): after role removal, old JWT still passes `getUser()` check because `getUser()` validates signature only, not current permission state
- Session invalidation on password reset: `auth.session.revoked` event is wired (Layer 1 audit) but only emitted; does not force-revoke other sessions in `auth.sessions` table

---

## 8. Required Improvements (Prioritized)

### P0 — Must Fix

**P0-1: Apply updated JWT hook to live DB**
The migration `20260105115648_update_jwt_custom_hook.sql` exists locally but was never applied to the target DB. The hook must set `{claims, {roles}}` (root level) and use fields `role`, `org_id`, `branch_id`. Without this, all `AuthService` methods and `HasAnyRole` components are permanently broken.

**P0-2: Create `admin_entitlements` table in target DB**
The admin portal is completely inaccessible. Migration `20260225073934_admin_v2_foundation.sql` exists locally but was not applied. Apply it or recreate the table via a target migration.

**P0-3: Add Next.js Middleware for session refresh and route protection**
Create `src/middleware.ts` using `@supabase/ssr` `createServerClient` with the standard cookie refresh pattern. At minimum, refresh session cookies on every request. Add `matcher` to protect all `/dashboard/*` routes. Without this, JWT sessions may silently expire.

**P0-4: Replace `getSession()` with `getUser()` in `HasAnyRoleServer`**
`src/components/auth/HasAnyRoleServer.tsx:16` — change to `supabase.auth.getUser()`. This is a one-line fix.

### P1 — Important

**P1-1: Add `user_has_effective_permission` function to live DB OR remove the broken call**
`PermissionServiceV2.hasPermission()` silently returns `false` for every call. Either add the missing RPC or replace all call sites with `currentUserHasPermission()` which calls `has_permission` (which works).

**P1-2: Eliminate the DELETE-before-INSERT recompile window**
Replace the compile pattern with an UPSERT-only approach or use a temporary staging table + atomic REPLACE. The current advisory lock prevents concurrent compilation but not concurrent reads of the empty permission set.

**P1-3: Add Realtime subscription for `user_effective_permissions`**
Enable Realtime on `user_effective_permissions` and add a client-side listener to re-fetch `permissionSnapshot` when a row changes for `auth.uid()`. This closes the stale-permission window between role changes and client re-hydration.

**P1-4: Add DB-level `ORG_ONLY_SLUGS` enforcement**
Add a CHECK constraint or trigger on `role_permissions` that prevents org-only permission slugs from being assigned to roles where `scope_type = 'branch'`. Current app-layer enforcement is bypassable.

### P2 — Nice to Have

**P2-1: Add `members.read` gate to `users_select_org_member` RLS policy**
Require `has_permission(organization_id, 'members.read')` in addition to co-membership for the `users` SELECT policy. Prevents profile enumeration by low-privilege members.

**P2-2: MFA enforcement option**
Add per-org MFA policy stored in `organization_profiles` or a new `org_security_settings` table. Gate admin/owner roles behind MFA requirement.

**P2-3: Force session re-validation on role assignment changes**
When a role assignment changes via `trigger_compile_on_role_assignment`, optionally invalidate the affected user's sessions via Supabase Admin API. This requires service_role and an async job but ensures immediate privilege reduction.

**P2-4: Add TypeScript type for `user_effective_permissions` to generated types**
Currently `eventService.emit()` and three other service files use `(client as any).from(...)` casts because `user_effective_permissions` is not in the generated types. Run `supabase gen types` to include it.

---

## 9. Verified Reference Data

### Live DB: IAM Functions Present

| Function                                         | Security | Purpose                              |
| ------------------------------------------------ | -------- | ------------------------------------ |
| `is_org_member(org_id)`                          | DEFINER  | RLS tenant boundary                  |
| `has_permission(org_id, slug)`                   | DEFINER  | RLS permission check (org-scoped)    |
| `has_branch_permission(org_id, branch_id, slug)` | DEFINER  | RLS permission check (branch-aware)  |
| `compile_user_permissions(user_id, org_id)`      | DEFINER  | Permission compiler (full recompile) |
| `custom_access_token_hook(event)`                | DEFINER  | JWT role injection (OLD format — G1) |
| `validate_role_assignment_scope`                 | INVOKER  | Trigger: scope type check            |

### Live DB: IAM Functions MISSING

| Function                        | Called By                             | Effect of Missing                |
| ------------------------------- | ------------------------------------- | -------------------------------- |
| `user_has_effective_permission` | `PermissionServiceV2.hasPermission()` | Always returns `false`           |
| `compile_org_permissions`       | Migration (v2 foundation)             | No fan-out recompile available   |
| `compile_all_user_permissions`  | Migration (v2 foundation)             | No cross-org recompile available |

### Live DB: RLS Status

| Table                      | RLS | Policies                                                                                                                      |
| -------------------------- | --- | ----------------------------------------------------------------------------------------------------------------------------- |
| organizations              | ✓   | SELECT(member), ALL(service_role)                                                                                             |
| organization_members       | ✓   | SELECT(self+managers), INSERT/UPDATE/DELETE(manage), ALL(service_role)                                                        |
| organization_profiles      | ✓   | SELECT(member), UPDATE(org.update), ALL(service_role)                                                                         |
| branches                   | ✓   | SELECT(member), INSERT(create), UPDATE(update), DELETE(delete), ALL(service_role)                                             |
| roles                      | ✓   | SELECT(system+org-member), INSERT/UPDATE/DELETE(manage)                                                                       |
| permissions                | ✓   | SELECT(authenticated)                                                                                                         |
| role_permissions           | ✓   | SELECT(system+org), INSERT/UPDATE/DELETE(manage)                                                                              |
| user_role_assignments      | ✓   | SELECT(self+managers), INSERT/UPDATE/DELETE(manage+branch.roles.manage), ALL(service_role)                                    |
| user_permission_overrides  | ✓   | SELECT(self+manage), INSERT/UPDATE/DELETE(manage)                                                                             |
| user_effective_permissions | ✓   | SELECT(self + members.read)                                                                                                   |
| invitations                | ✓   | SELECT(invites.read + email-match), INSERT(invites.create), UPDATE(org-cancel + self-accept + self-cancel), ALL(service_role) |
| user_preferences           | ✓   | CRUD(self-only)                                                                                                               |
| organization_entitlements  | ✓   | SELECT(member), ALL(service_role)                                                                                             |
| admin_entitlements         | N/A | Table does not exist                                                                                                          |

### Live DB: Role Permissions

| Role                       | Scope  | Basic | Permission Count |
| -------------------------- | ------ | ----- | ---------------- |
| `org_owner`                | org    | true  | 11               |
| `org_member`               | org    | true  | 9                |
| `org mngm access`          | org    | false | 1                |
| `warehouse employee`       | branch | false | 1                |
| `warehouse employeeEEESSS` | org    | false | 1                |

_Note: Last two entries appear to be test data from manual testing._

---

## 10. Final Verdict

> **The IAM layer is NOT enterprise-grade. It is a well-designed mid-stage system with a critical operations gap.**

The permission architecture (compile-don't-evaluate, wildcard expansion, branch-aware RLS functions) exceeds what most production SaaS products ship in v1. The enforcement pattern in server actions is consistent and well-disciplined. Multi-tenancy isolation via RLS is solid.

However, the system has **three confirmed runtime failures** (JWT hook mismatch, missing RPC, missing admin table) and **zero route-level middleware** — both of which are table-stakes requirements for a production IAM layer. The JWT roles being broken means any code relying on `HasAnyRoleClient/Server` or `AuthService.hasRole()` silently fails to grant access.

For current phase (boilerplate/early users): the system functions because the critical enforcement paths (RLS, `checkPermission(snapshot, ...)`) work correctly even with JWT roles empty.
For enterprise sales or security-sensitive deployments: these gaps must be closed before launch.
