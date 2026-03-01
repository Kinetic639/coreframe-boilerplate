# Organization Management (`organization-management`)

## Purpose

- **What this module does:** Administrative control panel for managing the organization and its members. Covers org profile (name, logo, slug, description, website), member management (list, activate/deactivate, remove), invitation workflow (send, resend, cancel), custom roles and permissions, member positions (job titles), branch management (org sub-units), and subscription/billing overview.
- **Who uses it (roles):** `org_owner` (full access), `org_member` with elevated roles (partial access per permission). Gated by the `organization-management` entitlement module present on all standard plans.
- **Primary workflows:**
  - View and update organization profile (name, logo, slug, bio, website)
  - Upload / remove org logo
  - List, activate, deactivate, and remove org members
  - View member detail page (info + access: all assigned roles with scope)
  - Send, resend, and cancel member invitations
  - Create, update, delete custom roles with scope (`org` | `branch`) and permission assignment
  - View system (basic) roles
  - Assign roles to members with scope selection (branch multiselect for `branch`/`both` roles)
  - Create, update, delete job positions
  - Assign positions to members
  - List, create, update, delete branches
  - View billing overview (plan, enabled modules)

## Status

- **Implementation:** ✅ done
- **Last updated:** 2026-02-28 (Module access permission gate added: `module.organization-management.access` enforced at layout, actions, and sidebar)
- **Owner:** coreframe

---

## Entitlements

- **Plan-gated:** ❌ (available on all standard plans; free, professional, enterprise all include `"organization-management"`)
- **Module constant:** `MODULE_ORGANIZATION_MANAGEMENT` (`"organization-management"`) — `src/lib/constants/modules.ts`
- **Entitlements source of truth:** `organization_entitlements.enabled_modules` — slug `"organization-management"` present in all standard plan tiers
- **Where enforced:**
  - Page layout gate (plan): ✅ `src/app/[locale]/dashboard/organization/layout.tsx` → `entitlements.requireModuleOrRedirect(MODULE_ORGANIZATION_MANAGEMENT)` — redirects to `/upgrade` on denial
  - Page layout gate (user): ✅ same layout checks `MODULE_ORGANIZATION_MANAGEMENT_ACCESS` permission — redirects to `/dashboard/start` on denial
  - Server actions: ✅ All 7 action files check `MODULE_ORGANIZATION_MANAGEMENT_ACCESS` after the `activeOrgId` guard, before capability checks

### Verification checklist

- [x] Module slug `"organization-management"` present in `organization_entitlements.enabled_modules` for all plans
- [x] Module layout gate enforced via `entitlements.requireModuleOrRedirect`
- [x] User-level module access enforced via `MODULE_ORGANIZATION_MANAGEMENT_ACCESS` permission check
- [x] Server actions enforce via `entitlements.requireModuleAccess` (plan) + `MODULE_ORGANIZATION_MANAGEMENT_ACCESS` (user)
- [x] Sidebar item hidden when module not entitled or user lacks `MODULE_ORGANIZATION_MANAGEMENT_ACCESS`

---

## Permissions (Permission Service V2)

### Permission constants used

> No raw strings. Must match DB slugs exactly.

|          Action | Permission constant                     | DB slug                                 |
| --------------: | --------------------------------------- | --------------------------------------- |
|   Module access | `MODULE_ORGANIZATION_MANAGEMENT_ACCESS` | `module.organization-management.access` |
|        Org read | `ORG_READ`                              | `org.read`                              |
|      Org update | `ORG_UPDATE`                            | `org.update`                            |
|    Members read | `MEMBERS_READ`                          | `members.read`                          |
|  Members manage | `MEMBERS_MANAGE`                        | `members.manage`                        |
|    Invites read | `INVITES_READ`                          | `invites.read`                          |
|  Invites create | `INVITES_CREATE`                        | `invites.create`                        |
|  Invites cancel | `INVITES_CANCEL`                        | `invites.cancel`                        |
|   Branches read | `BRANCHES_READ`                         | `branches.read`                         |
| Branches create | `BRANCHES_CREATE`                       | `branches.create`                       |
| Branches update | `BRANCHES_UPDATE`                       | `branches.update`                       |
| Branches delete | `BRANCHES_DELETE`                       | `branches.delete`                       |

All constants defined in `src/lib/constants/permissions.ts`.

Role assignments (DB):

- `org_owner` → `module.*` (wildcard covers all module access), `org.*`, `members.*`, `invites.*`, `branches.*`
- `org_member` → `org.read`, `members.read` (no module access by default — must be granted via custom role)
- Custom roles → can include `module.organization-management.access` (org-scope only, not branch-scope)

### Guard pattern used (V2)

```typescript
// ✅ Correct V2 pattern — synchronous, snapshot-based
const canRead = checkPermission(context.user.permissionSnapshot, ORG_READ);
if (!canRead) return { success: false, error: "Unauthorized" };

// ❌ Old pattern — NEVER use in this codebase
const canRead = await PermissionServiceV2.currentUserHasPermission(
  supabase,
  userId,
  orgId,
  ORG_READ
);
```

Context loaded via `loadDashboardContextV2()` which returns `context.user.permissionSnapshot` — already compiled, `React.cache()`-wrapped, no extra DB hit.

### Where enforced

- **Server Components (pages):**
  - `organization/layout.tsx` → `entitlements.requireModuleOrRedirect` (module gate)
  - `organization/users/layout.tsx` → `MEMBERS_READ` (section gate, redirect to `/dashboard/start`)
  - `organization/profile/page.tsx` → `ORG_READ`
  - `organization/users/invitations/page.tsx` → `INVITES_READ`
  - `organization/users/branches/page.tsx` → redirect to `/organization/branches`
  - `organization/branches/page.tsx` → `BRANCHES_READ`
  - `organization/billing/page.tsx` → `ORG_UPDATE`
  - `organization/users/members/page.tsx` → own `MEMBERS_READ` guard (double-protected: users layout + page)
  - `organization/users/roles/page.tsx` → own `MEMBERS_READ` guard (double-protected: users layout + page)
  - `organization/users/positions/page.tsx` → own `MEMBERS_READ` guard (double-protected: users layout + page)
- **Server Actions:** ✅ All 7 action files (`profile.ts`, `members.ts`, `invitations.ts`, `roles.ts`, `positions.ts`, `branches.ts`, `billing.ts`) enforce permission via `checkPermission(context.user.permissionSnapshot, PERM)`.
- **RLS:** ✅ Database-enforced via `is_org_member(org_id)` function and custom policies on all affected tables.

### Verification checklist

- [x] Permission constants exist in `src/lib/constants/permissions.ts`
- [x] V2 guard pattern used (no `PermissionServiceV2.currentUserHasPermission` calls)
- [x] RLS enforced on `organization_profiles`, `organization_members`, `invitations`, `roles`, `org_positions`, `org_position_assignments`, `branches` (pre-existing table used for branch management)
- [x] RLS enforced on `user_role_assignments` — V2 policies (phase 3): INSERT/DELETE/UPDATE/SELECT all support both `scope='org'` and `scope='branch'` via `has_permission(org_id, 'members.manage')`
- [x] Server actions return `{ success: false, error: "Unauthorized" }` on permission denial (T2 tests cover this)
- [x] `is_org_member` excludes `status != 'active'` and `deleted_at IS NOT NULL` (verified 2026-02-26)
- [x] `has_any_org_role` (used in legacy SELECT on `organization_members`) checks only `user_role_assignments` — does NOT gate on member status or deleted_at (verified 2026-02-27 via MCP)
- [x] No raw permission strings in TypeScript — all slugs imported from `@/lib/constants/permissions` (architecture pass 2026-02-26; fixed in phase 3: `member-detail-client.tsx` PERM*OPTIONS used wrong `invitations.*`slugs, now replaced with grouped`CUSTOM_ACCESS_PERM_GROUPS`using correct`INVITES\*\*` constants)

---

## Sidebar V2 Registry

### Navigation entries

| Location | Item id                 | Title            | Href                                         | requiresModules                    | requiresPermissions |
| -------- | ----------------------- | ---------------- | -------------------------------------------- | ---------------------------------- | ------------------- |
| MAIN     | `organization`          | `"Organization"` | (group parent, no href)                      | `[MODULE_ORGANIZATION_MANAGEMENT]` | none                |
| MAIN (↳) | `organization.profile`  | `"Profile"`      | `/dashboard/organization/profile`            | inherited                          | `[ORG_READ]`        |
| MAIN (↳) | `organization.users`    | users.title key  | `/dashboard/organization/users` (startsWith) | inherited                          | `[MEMBERS_READ]`    |
| MAIN (↳) | `organization.branches` | `"Branches"`     | `/dashboard/organization/branches`           | inherited                          | `[BRANCHES_READ]`   |
| MAIN (↳) | `organization.billing`  | `"Billing"`      | `/dashboard/organization/billing`            | inherited                          | `[ORG_UPDATE]`      |

Registry file: `src/lib/sidebar/v2/registry.ts` (lines ~66–121).

### Verification checklist

- [x] Sidebar item hidden when module not entitled (SSR test org-1, verified 2026-02-26)
- [x] Profile item hidden when `ORG_READ` missing (SSR test org-2, verified 2026-02-26)
- [x] Users item hidden when `MEMBERS_READ` missing (implied by general permission tests)
- [x] Branches item hidden when `BRANCHES_READ` missing (SSR test org-4, verified 2026-02-26)
- [x] Billing item hidden when `ORG_UPDATE` missing (SSR test 7.2, verified 2026-02-26)

---

## Data Model

### Tables

- `public.organization_profiles` — org identity (name, name_2, slug, bio, website, logo_url, theme_color, font_color)
- `public.organization_members` — org membership (user_id, organization_id, status, joined_at, deleted_at)
- `public.invitations` — invite workflow (email, token, status, expires_at, accepted_at, role_id, branch_id)
- `public.roles` — custom + system roles (name, description, is_basic, scope_type, organization_id)
- `public.role_permissions` — many-to-many: roles ↔ permissions
- `public.org_positions` — job positions (name, description, org_id)
- `public.org_position_assignments` — user ↔ position ↔ branch assignments
- `public.branches` — branches (name, slug, organization_id) — pre-existing shared table, not created by this module
- `public.organization_entitlements` — subscription plan (plan_name, enabled_modules, limits, features)

### Key constraints

- `organization_members.status` CHECK: `ARRAY['active', 'inactive', 'pending']` — **`'suspended'` and `'removed'` are INVALID**
- `is_org_member(org_id)` function: checks `status = 'active' AND deleted_at IS NULL` — `inactive` is a full RLS block, not UI-only
- Member removal: sets `deleted_at` only, does NOT set a status value
- `is_basic = true` roles: system roles (cannot be edited or deleted by org admins)

### Storage

- `org-logos` bucket — public read, 5 MB limit, image types only (`image/jpeg`, `image/png`, `image/webp`, `image/gif`)
- Path pattern: `{org_id}/logo.{ext}`
- RLS: public read; INSERT/UPDATE/DELETE requires `is_org_member(org_id) AND has_permission(org_id, 'org.update')`

---

## RLS Policies

### Summary

| Table                         | Access control                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        |
| ----------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `organization_profiles`       | `is_org_member(organization_id)` for SELECT; `has_permission(organization_id, 'org.update')` for INSERT/UPDATE                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        |
| `organization_members`        | **SELECT**: legacy policy `"Users can view organization members"` — `(user_id = auth.uid()) OR is_org_creator(org_id) OR has_any_org_role(org_id)`. `has_any_org_role` queries `user_role_assignments` (scope='org', deleted_at IS NULL) — does **not** check `organization_members.status` or `deleted_at`. Pre-V2 policy; not replaced (additive-only migration rule). **P1-B mitigation (2026-02-27)**: `removeMember()` now soft-deletes all org-scoped and branch-scoped `user_role_assignments` when it sets `organization_members.deleted_at` — so ex-members no longer satisfy `has_any_org_role` after removal. **INSERT**: legacy-only — `"Org creators and owners can add members"` (WITH CHECK: `is_org_creator(org_id) OR has_org_role(org_id, 'org_owner')`). No V2 INSERT policy exists; INSERT path is restricted to org owners/creators only. **UPDATE (V2 additive)**: `"members_manage_permission_can_update"` — `is_org_member(organization_id) AND has_permission('members.manage')`.                                                                                                                                                                                                                                                                                            |
| `invitations`                 | **SELECT**: `(is_org_member(organization_id) AND has_permission(organization_id, 'invites.read')) OR (lower(email) = lower(auth.jwt()->>'email'))` AND `deleted_at IS NULL`. Invited users can read their own invite row regardless of membership. **INSERT**: `is_org_member(organization_id) AND has_permission(organization_id, 'invites.create') AND deleted_at IS NULL`. **UPDATE** (three policies): (1) `invitations_update_org_cancel` — USING/WITH CHECK: `is_org_member(organization_id) AND has_permission(organization_id, 'invites.cancel') AND deleted_at IS NULL` (full UPDATE for authorized org members). (2) `invitations_update_self_cancel` — USING: `lower(email) = lower(auth.jwt()->>'email') AND deleted_at IS NULL`; WITH CHECK: same AND `status = 'cancelled'` (invitee self-cancel only). (3) `invitations_update_self_accept` — USING: `lower(email) = lower(auth.jwt()->>'email') AND deleted_at IS NULL`; WITH CHECK: same AND `status = 'accepted' AND accepted_at IS NOT NULL` (invitee acceptance only; requires accepted_at timestamp). Policies (2) and (3) together mean: invitees may only write terminal states (`cancelled` or `accepted`) — no policy permits `status='pending'` new-row writes, preserving the Gap #6 security property. FORCE RLS enabled. |
| `roles`                       | `is_org_member` or global (is_basic) for SELECT; `has_permission(organization_id, 'members.manage')` for mutations                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                    |
| `org_positions`               | `is_org_member(org_id)` for SELECT; `has_permission(org_id, 'members.manage')` for mutations                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          |
| `branches`                    | `is_org_member(organization_id) AND deleted_at IS NULL` for SELECT; `has_permission('branches.create/update/delete')` for mutations. Soft-delete via UPDATE (sets `deleted_at`). FORCE RLS enabled.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                   |
| `organization_entitlements`   | `is_org_member(organization_id)` for SELECT; service-role only for mutations                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          |
| `storage.objects (org-logos)` | Public SELECT; `is_org_member + org.update` for INSERT/UPDATE/DELETE                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                  |

Migrations applied (12 total):

- `20260226100000_enable_rls_organization_profiles.sql`
- `20260226100001_org_members_v2_permission_policy.sql`
- `20260226100002_org_positions_tables.sql`
- `20260226200000_fix_invitations_rls_auth_users.sql` — fixes invitations RLS to use `auth.jwt() ->> 'email'` instead of `auth.users`
- `20260226200001_create_org_logos_storage_bucket.sql` — creates `org-logos` storage bucket with RLS
- `20260227100000_force_rls_org_tables.sql` — FORCE ROW LEVEL SECURITY on organization_profiles, invitations, org_positions, org_position_assignments, branches (the remaining 5; all org-management-related tables (see policy table) now have force_rls=true)
- `20260227200000_fix_invitations_update_self_cancel.sql` — Drops `invitations_update_permission`; creates `invitations_update_org_cancel` (full UPDATE for org members with invites.cancel) and `invitations_update_self_cancel` (email-match with WITH CHECK `status = 'cancelled'`). Closes Gap #6.
- `20260227200001_fix_invitations_self_accept_regression.sql` — Adds `invitations_update_self_accept` (email-match, WITH CHECK `status = 'accepted' AND accepted_at IS NOT NULL`). Restores invite acceptance flow broken by `20260227200000`; Gap #6 security property preserved (no policy permits `status='pending'` for invitees).
- `20260227300000_fix_user_role_assignments_rls_v2.sql` — Phase 3 P0: drops buggy INSERT/DELETE policies on `user_role_assignments` (INSERT used `has_org_role(branch_id, 'branch_manager')` → always false; DELETE had `scope='org'` filter blocking branch rows). Replaces with V2 INSERT/DELETE using `has_permission(org_id, 'members.manage')` + `is_org_member()`. Adds new SELECT policy for admins to read branch-scoped assignments.
- `20260227310000_fix_user_role_assignments_update_policy.sql` — Phase 3 P0b: drops `"Org owners and creators can update role assignments"` UPDATE policy (scope='org' only, blocked: upsert retry for branch rows, `removeRoleFromUser` soft-delete for branch rows). Replaces with `"V2 update role assignments"` supporting both scopes via `has_permission(org_id, 'members.manage')`.
- `20260227320000_add_ura_org_scope_select_v2.sql` — P1-A: adds `"V2 view org role assignments"` PERMISSIVE SELECT policy on `user_role_assignments` (scope='org', `is_org_member` + `has_permission(members.read)`, TO authenticated). Closes Gap #7 SELECT gap.
- `20260227330000_fix_policy_roles_to_authenticated.sql` — P2-C: converts 13 `{public}` policies across `invitations`, `org_positions`, `org_position_assignments`, `organization_members`, `organization_profiles`, and `user_effective_permissions` to `{authenticated}`. Ensures anon callers are rejected before predicate evaluation. **Cross-cutting note**: `user_effective_permissions` is shared infrastructure; the specific policy altered (`"Users can view own effective permissions"`, `user_id = auth.uid()`) was `{public}` — any anon caller could query their own non-existent permissions. Changing to `{authenticated}` is safe (unauthenticated callers have no `auth.uid()`) and reduces attack surface.

---

## API Surface

### Server actions

| Action                           | File             | Input schema                                                              | Permission enforced  | Entitlement enforced |
| -------------------------------- | ---------------- | ------------------------------------------------------------------------- | -------------------- | -------------------- |
| `getOrgProfileAction`            | `profile.ts`     | none                                                                      | ✅ `ORG_READ`        | ✅                   |
| `updateOrgProfileAction`         | `profile.ts`     | `updateProfileSchema` (Zod)                                               | ✅ `ORG_UPDATE`      | ✅                   |
| `uploadOrgLogoAction`            | `profile.ts`     | `FormData` (file: image, ≤5 MB)                                           | ✅ `ORG_UPDATE`      | ✅                   |
| `listMembersAction`              | `members.ts`     | none                                                                      | ✅ `MEMBERS_READ`    | ✅                   |
| `updateMemberStatusAction`       | `members.ts`     | `{ userId, status: "active"\|"inactive" }`                                | ✅ `MEMBERS_MANAGE`  | ✅                   |
| `removeMemberAction`             | `members.ts`     | `{ userId }`                                                              | ✅ `MEMBERS_MANAGE`  | ✅                   |
| `listInvitationsAction`          | `invitations.ts` | none                                                                      | ✅ `INVITES_READ`    | ✅                   |
| `createInvitationAction`         | `invitations.ts` | `{ email, role_id?, branch_id? }`                                         | ✅ `INVITES_CREATE`  | ✅                   |
| `cancelInvitationAction`         | `invitations.ts` | `{ invitationId }`                                                        | ✅ `INVITES_CANCEL`  | ✅                   |
| `resendInvitationAction`         | `invitations.ts` | `{ invitationId }`                                                        | ✅ `INVITES_CREATE`  | ✅                   |
| `listRolesAction`                | `roles.ts`       | none                                                                      | ✅ `MEMBERS_READ`    | ✅                   |
| `createRoleAction`               | `roles.ts`       | `{ name, description?, permission_slugs?, scope_type?: "org"\|"branch" }` | ✅ `MEMBERS_MANAGE`  | ✅                   |
| `updateRoleAction`               | `roles.ts`       | `{ roleId, name?, description?, permission_slugs? }`                      | ✅ `MEMBERS_MANAGE`  | ✅                   |
| `deleteRoleAction`               | `roles.ts`       | `{ roleId }`                                                              | ✅ `MEMBERS_MANAGE`  | ✅                   |
| `assignRoleToUserAction`         | `roles.ts`       | `{ userId, roleId, scope?: "org"\|"branch", scopeId?: uuid }`             | ✅ `MEMBERS_MANAGE`  | ✅                   |
| `removeRoleFromUserAction`       | `roles.ts`       | `{ userId, roleId, scope?: "org"\|"branch", scopeId?: uuid }`             | ✅ `MEMBERS_MANAGE`  | ✅                   |
| `getUserRoleAssignmentsAction`   | `roles.ts`       | `{ userId }`                                                              | ✅ `MEMBERS_READ`    | ✅                   |
| `getMemberAccessAction`          | `roles.ts`       | `{ userId: uuid }`                                                        | ✅ `MEMBERS_READ`    | ✅                   |
| `listPositionsAction`            | `positions.ts`   | none                                                                      | ✅ `MEMBERS_READ`    | ✅                   |
| `listPositionAssignmentsAction`  | `positions.ts`   | none                                                                      | ✅ `MEMBERS_READ`    | ✅                   |
| `createPositionAction`           | `positions.ts`   | `{ name, description? }`                                                  | ✅ `MEMBERS_MANAGE`  | ✅                   |
| `updatePositionAction`           | `positions.ts`   | `{ positionId, name?, description? }`                                     | ✅ `MEMBERS_MANAGE`  | ✅                   |
| `deletePositionAction`           | `positions.ts`   | `{ positionId }`                                                          | ✅ `MEMBERS_MANAGE`  | ✅                   |
| `assignPositionAction`           | `positions.ts`   | `{ userId, positionId, branch_id? }`                                      | ✅ `MEMBERS_MANAGE`  | ✅                   |
| `removePositionAssignmentAction` | `positions.ts`   | `{ assignmentId }`                                                        | ✅ `MEMBERS_MANAGE`  | ✅                   |
| `listBranchesAction`             | `branches.ts`    | none                                                                      | ✅ `BRANCHES_READ`   | ✅                   |
| `createBranchAction`             | `branches.ts`    | `{ name, slug? }`                                                         | ✅ `BRANCHES_CREATE` | ✅                   |
| `updateBranchAction`             | `branches.ts`    | `{ branchId, name?, slug? }`                                              | ✅ `BRANCHES_UPDATE` | ✅                   |
| `deleteBranchAction`             | `branches.ts`    | `{ branchId }`                                                            | ✅ `BRANCHES_DELETE` | ✅                   |
| `getBillingOverviewAction`       | `billing.ts`     | none                                                                      | ✅ `ORG_UPDATE`      | ✅                   |

### Services

- `src/server/services/organization.service.ts` — all service classes:
  - `OrgProfileService` — `getProfile`, `updateProfile`, `uploadLogo`
  - `OrgMembersService` — `listMembers`, `updateMemberStatus`, `removeMember`, `getMember`
  - `OrgInvitationsService` — `listInvitations`, `createInvitation`, `cancelInvitation`, `resendInvitation`
  - `OrgRolesService` — `listRoles`, `createRole`, `updateRole`, `deleteRole`, `assignRoleToUser`, `removeRoleFromUser`, `getUserRoleAssignments`, `getMemberAccess`
  - `OrgPositionsService` — `listPositions`, `listAssignmentsForOrg`, `createPosition`, `updatePosition`, `deletePosition`, `assignPosition`, `removePositionAssignment`
  - `OrgBranchesService` — `listBranches`, `createBranch`, `updateBranch`, `deleteBranch`
  - `OrgBillingService` — `getBillingOverview`

---

## UI

### Routes

| Route                                              | Page guard                                 | Layout guard   |
| -------------------------------------------------- | ------------------------------------------ | -------------- |
| `/dashboard/organization/profile`                  | `ORG_READ`                                 | module gate    |
| `/dashboard/organization/users`                    | redirect → `/users/members`                | module gate    |
| `/dashboard/organization/users/members`            | own `MEMBERS_READ` (redundant with layout) | `MEMBERS_READ` |
| `/dashboard/organization/users/members/[memberId]` | `MEMBERS_READ`                             | `MEMBERS_READ` |
| `/dashboard/organization/users/invitations`        | `INVITES_READ`                             | `MEMBERS_READ` |
| `/dashboard/organization/users/roles`              | own `MEMBERS_READ` (redundant with layout) | `MEMBERS_READ` |
| `/dashboard/organization/users/positions`          | own `MEMBERS_READ` (redundant with layout) | `MEMBERS_READ` |
| `/dashboard/organization/users/branches`           | redirect → `/organization/branches`        | `MEMBERS_READ` |
| `/dashboard/organization/branches`                 | `BRANCHES_READ`                            | module gate    |
| `/dashboard/organization/billing`                  | `ORG_UPDATE`                               | module gate    |

### Components

- Loading boundaries:
  - `src/app/[locale]/dashboard/organization/loading.tsx` — spinner for all org sub-routes
  - `src/app/[locale]/dashboard/organization/users/loading.tsx` — spinner for users tab sub-routes
- Server layouts:
  - `src/app/[locale]/dashboard/organization/layout.tsx` — module entitlement gate
  - `src/app/[locale]/dashboard/organization/users/layout.tsx` — `MEMBERS_READ` gate + tab nav header
- Server pages: profile, users (redirect), members, invitations, roles, positions, branches (top-level + users/branches redirect), billing
- Client components:
  - `organization/profile/_components/org-profile-client.tsx` — profile form + logo upload
  - `organization/billing/_components/billing-client.tsx` — billing overview display
  - `organization/users/_components/users-layout-client.tsx` — tab navigation (Members/Invitations/Roles/Positions)
  - `organization/users/members/_components/members-client.tsx` — member list + activate/deactivate/remove, scope-aware role management dialog (branch multiselect for branch/both roles), position assignment dialog, view detail link
  - `organization/users/members/[memberId]/_components/member-detail-client.tsx` — member detail (Info + Access tabs): displays all role assignments with scope badges; add role dialog with scope selection; remove assignment
  - `organization/users/invitations/_components/invitations-client.tsx` — invitation list + create/resend/cancel dialog
  - `organization/users/roles/_components/roles-client.tsx` — role list + create/edit/delete dialog; create includes scope selector (`org`|`branch`); scope badge on rows; scope read-only in edit dialog
  - `organization/users/positions/_components/positions-client.tsx` — position list + create/edit/delete dialog
  - `organization/branches/_components/branches-client.tsx` — branch list + create/edit/delete dialog

### Routing

All routes registered in `src/i18n/routing.ts` with Polish locale paths:

- `/dashboard/organization/profile` → `pl: /dashboard/organizacja/profil`
- `/dashboard/organization/users` → `pl: /dashboard/organizacja/uzytkownicy`
- `/dashboard/organization/users/members` → `pl: /dashboard/organizacja/uzytkownicy/czlonkowie`
- `/dashboard/organization/users/members/[memberId]` → `pl: /dashboard/organizacja/uzytkownicy/czlonkowie/[memberId]`
- `/dashboard/organization/users/invitations` → `pl: /dashboard/organizacja/uzytkownicy/zaproszenia`
- `/dashboard/organization/users/roles` → `pl: /dashboard/organizacja/uzytkownicy/role`
- `/dashboard/organization/users/positions` → `pl: /dashboard/organizacja/uzytkownicy/stanowiska`
- `/dashboard/organization/users/branches` → redirect to `/dashboard/organization/branches`
- `/dashboard/organization/branches` → `pl: /dashboard/organizacja/oddzialy`
- `/dashboard/organization/billing` → `pl: /dashboard/organizacja/rozliczenia`

### i18n translation keys added

- `messages/en.json` + `messages/pl.json`:
  - `modules.organizationManagement.titleSidebar` ("Organization" / "Organizacja")
  - `modules.organizationManagement.items.profile` ("Profile" / "Profil")
  - `modules.organizationManagement.items.branches` ("Branches" / "Oddziały")
  - `modules.organizationManagement.items.billing` ("Billing" / "Rozliczenia")
  - `modules.organizationManagement.items.users.positions` ("Positions" / "Stanowiska")
- `messages/en/organization/general.json` + `messages/pl/organization/general.json`:
  - `billing` object (full billing page translations — added to fix namespace override in i18n loader)

---

## Tests

### Coverage map

- **T2 — Action deny-path tests:**
  - `src/app/actions/organization/__tests__/actions.test.ts` — 26 tests
  - Covers: all 7 action domains, entitlement gate, permission denial, `status='suspended'` rejected by Zod, `branches.read` does not imply `branches.create`

- **T1 — RLS behavior tests:**
  - `src/server/services/__tests__/organization-rls.test.ts` — 23 tests (mock-based; verifies service error propagation and DB constraint compliance)
  - Covers: RLS blocks unauthorized clients, `is_org_member` semantics, `inactive` is a full RLS block, soft-delete behavior, DB constraint values (`active/inactive/pending` only), member removal does not write status, `cancelInvitation` writes only `status='cancelled'`, `invitations_update_self_cancel` and `invitations_update_self_accept` WITH CHECK semantics documented (exploit path blocked, acceptance path restored)

- **T-RLS — Real DB RLS integration tests:**
  - `src/server/services/__tests__/organization-rls-integration.test.ts` — 4 tests (skipped when env vars absent; connects to real Supabase project)
  - **Client discipline**: T-RLS-1/2/3 use `RlsClient` (anon key + JWT sign-in) via `rlsQuery()` — service role is never used for ALLOW/DENY assertions. T-RLS-4 uses service role (`SetupClient`) for DB-state verification only (reads soft-deleted rows that RLS would hide). `assertIsRlsClient()` runtime guard enforces this boundary.
  - **Service role is used only for setup/cleanup; policy assertions are performed using RLS-enforced JWT clients.**
  - T-RLS-1: non-member gets 0 rows from `user_role_assignments` (org-scope) — PERMISSIVE policy OR-chain filtered
  - T-RLS-2: active member WITH `members.read` CAN read `user_role_assignments` — P1-A `"V2 view org role assignments"` policy
  - T-RLS-3: active member WITHOUT `members.read` gets 0 rows — confirms permission gate
  - T-RLS-4: `removeMember()` soft-deletes `user_role_assignments` — P1-B stale-role fix; verified via service-role DB-state read (not an RLS assertion)

- **Sidebar SSR integration tests:**
  - `src/app/[locale]/dashboard/__tests__/sidebar-ssr.test.tsx` — 5 org-specific tests (org-1 through org-5), verified 2026-02-26
  - org-1: org group absent when `organization-management` NOT in `enabled_modules`
  - org-2: `organization.profile` absent when user lacks `org.read`
  - org-3: `organization.profile` present when user has `org.read`
  - org-4: `organization.branches` absent when user lacks `branches.read`
  - org-5: `organization.branches` present when user has `branches.read`
  - Plus test 7.2: billing visible to owner (ORG_UPDATE), not to member

- **Frontend component tests (RTL + Vitest):**
  - `src/app/[locale]/dashboard/organization/users/roles/__tests__/roles-client.test.tsx` — 10 tests
  - roles-1: Create Role button visible when user has `MEMBERS_MANAGE`
  - roles-2: Create Role button absent when user lacks `MEMBERS_MANAGE`
  - roles-3: All 4 permission group labels (Organization/Members/Invitations/Branches) render in create dialog
  - roles-4: `createRoleAction` called with correct `permission_slugs` on submit
  - roles-5: `listRolesAction` NOT called on mount (SSR-first regression)
  - roles-6: Create dialog shows scope selector defaulting to `org`
  - roles-7: `createRoleAction` receives `scope_type: "branch"` when branch scope selected
  - roles-8: Branch-scoped role renders `branch` badge in list
  - roles-9: `both`-scoped role renders `both` badge in list
  - roles-10: Edit dialog shows scope as read-only text (no combobox)
  - `src/app/[locale]/dashboard/organization/branches/__tests__/branches-client.test.tsx` — 4 tests
  - branches-1: Create Branch button visible when user has `BRANCHES_CREATE`
  - branches-2: `createBranchAction` called with branch name on submit
  - branches-3: `listBranchesAction` NOT called on mount (SSR-first regression)
  - branches-4: Branch name renders immediately from `initialBranches` (no fetch)
  - `src/app/[locale]/dashboard/organization/users/invitations/__tests__/invitations-client.test.tsx` — 4 tests
  - invitations-1: Invite button visible when user has `INVITES_CREATE`
  - invitations-2: Invite button absent when user lacks `INVITES_CREATE`
  - invitations-3: `listInvitationsAction` NOT called on mount (SSR-first regression)
  - invitations-4: `createInvitationAction` called with email on submit
  - `src/app/[locale]/dashboard/organization/users/members/__tests__/members-client.test.tsx` — 7 tests
  - members-1: List actions NOT called on mount (SSR-first regression)
  - members-2: Empty state message renders when member list is empty
  - members-3: Member name renders immediately from `initialMembers` (no fetch)
  - members-4: View link per row links to member detail page (href contains userId)
  - members-5: Branch-scoped role shows `branch` badge in Manage Roles dialog
  - members-6: `both`-scoped role shows org/branch toggle when checked in dialog
  - members-7: Branch multiselect appears when branch scope selected for `both` role
  - `src/app/[locale]/dashboard/organization/users/members/[memberId]/__tests__/member-detail-client.test.tsx` — 10 tests
  - detail-1: Member name renders from prop (no fetch)
  - detail-2: Info tab renders email
  - detail-3: Access tab renders role assignment from `initialAccess`
  - detail-4: Org scope assignment renders `org` badge
  - detail-5: Branch scope assignment renders branch name
  - detail-6: Add Role button visible when user has `MEMBERS_MANAGE`
  - detail-7: Add Role button absent when user lacks `MEMBERS_MANAGE`
  - detail-8: `assignRoleToUserAction` called with `scope_type` param on submit
  - detail-9: Remove assignment calls `removeRoleFromUserAction`
  - detail-10: `getMemberAccessAction` NOT called on mount (SSR-first regression)
  - `src/app/[locale]/dashboard/organization/users/positions/__tests__/positions-client.test.tsx` — 6 tests (NEW)
  - positions-1: Create Position button visible when user has `MEMBERS_MANAGE`
  - positions-2: Create Position button absent when user lacks permission
  - positions-3: `listPositionsAction` NOT called on mount (SSR-first regression)
  - positions-4: Position name renders immediately from `initialPositions` (no fetch)
  - positions-5: `createPositionAction` called with name on submit
  - positions-6: Error toast shown when `createPositionAction` fails

### Manual test checklist

- [ ] Org profile update (name, slug, bio, website)
- [ ] Logo upload and removal
- [ ] Member activate/deactivate flow
- [ ] Member removal (soft delete — verify no status change in DB)
- [ ] Member role assignment (Manage Roles dialog — org-scoped role)
- [ ] Member role assignment — branch-scoped role (branch selector shown)
- [ ] Member role assignment — `both`-scoped role (org/branch toggle shown)
- [ ] Member detail page (Eye icon → `/members/[memberId]`) — Info + Access tabs
- [ ] Member position assignment (Assign Position dialog)
- [ ] Invitation create → accept → invitation status becomes `accepted` in DB _(current legacy flow)_
- [ ] ⚠️ **EXPECTED TO FAIL (Gap #8)**: Invitation accept → new member appears in org member list. The current `acceptInvitation` flow updates `invitations.status` only — it does NOT insert into `organization_members`. This test will pass only after Gap #8 (V2 server-action acceptance flow with `organization_members` INSERT) is implemented.
- [ ] Invitation cancel flow
- [ ] Role create with `org` scope → scope badge absent in list
- [ ] Role create with `branch` scope → `branch` badge shown in list
- [ ] Role edit — scope shown as read-only text (no dropdown)
- [ ] Role create with permissions → verify permission slugs stored
- [ ] Role edit — permissions pre-populated from existing role
- [ ] Role delete (system roles cannot be deleted)
- [ ] Position create/edit/delete
- [ ] Branch create/edit/delete (top-level `/organization/branches`)
- [ ] Billing page visible only to org owner (ORG_UPDATE required)
- [ ] Module gate: create test org without `organization-management` entitlement — verify redirect to `/upgrade`
- [ ] Permission denial: verify all tabs redirect correctly for users with limited permissions

---

## Client Ownership Model

All `createClient()` calls are server-side only. Pattern per action:

- Action: 1x `createClient()` (for service calls)
- `entitlements.requireModuleAccess()` → `getOrgContext()` (React.cache-wrapped) → 1x `createClient()` — deduped
- `loadDashboardContextV2()` (React.cache-wrapped) → `loadAppContextV2()` + `loadUserContextV2()` each call `createClient()` — deduped per request

Total: up to 4 `createClient()` calls in the call tree, but `React.cache()` deduplicates the loader and guard calls within the same request. The guide prohibits `createClient()` in **Client Components only** — all calls here are server-side. **DECISION: no fix.**

Verified 2026-02-26:

- `src/server/services/organization.service.ts`: 0 `createClient()` calls (clients injected as parameters ✅)
- `src/server/loaders/v2/load-dashboard-context.v2.ts`: 0 `createClient()` calls (delegates to sub-loaders)
- All action files: 1 `createClient()` per action function ✅

---

## SSR Strategy (✅ Compliant — Remediated 2026-02-26)

All 7 org pages now use **SSR-first** pattern. Initial data is server-rendered and passed via `initialData` props.

| Page                                | SSR data passed                                                                               | Client fetches on mount |
| ----------------------------------- | --------------------------------------------------------------------------------------------- | ----------------------- |
| `profile/page.tsx`                  | `canEdit`, `initialProfile`                                                                   | ❌ none                 |
| `billing/page.tsx`                  | `initialBilling`                                                                              | ❌ none                 |
| `users/members/page.tsx`            | `initialMembers`, `initialPositions`, `initialAssignments`, `initialRoles`, `initialBranches` | ❌ none                 |
| `users/members/[memberId]/page.tsx` | `member`, `initialAccess`, `initialRoles`, `initialBranches`                                  | ❌ none                 |
| `users/invitations/page.tsx`        | `initialInvitations`                                                                          | ❌ none                 |
| `users/roles/page.tsx`              | `initialRoles`                                                                                | ❌ none                 |
| `users/positions/page.tsx`          | `initialPositions`                                                                            | ❌ none                 |
| `branches/page.tsx`                 | `initialBranches`                                                                             | ❌ none                 |

**Pattern**: Each Server Page calls `createClient()` + the relevant service method(s), passes results as `initialXxx` props to the Client Component. Client Components initialize `useState` from these props. After mutations, they call `load()` for optimistic local re-sync + `router.refresh()` for SSR re-render.

---

## Known Compliance Gaps

| #   | Severity | Gap                                                                                                                                                                                                                                                            | Status                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                     |
| --- | -------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | INFO     | Client components use `'data' in result` pattern (not `result.success`) due to TS inference widening action return types — functional but not ideal                                                                                                            | ✅ Closed 2026-02-26 — all result checks standardized to `result.success` / `result.error`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                 |
| 2   | INFO     | Tab nav uses `pathname.includes()` for active detection — could produce false positives if route names overlap                                                                                                                                                 | ✅ Closed 2026-02-26 — changed to `pathname.endsWith()` in `users-layout-client.tsx`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                       |
| 3   | INFO     | No `loading.tsx` or `error.tsx` boundary files in the organization route tree                                                                                                                                                                                  | ✅ Closed 2026-02-26 — `loading.tsx` and `error.tsx` added at `organization/` and `organization/users/`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                    |
| 4   | INFO     | Module config (`src/modules/organization-managment/config.ts`) still points to legacy `/dashboard-old/` routes                                                                                                                                                 | ✅ Closed 2026-02-26 — `items` replaced with `[]`, navigation driven by sidebar V2 registry                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                |
| 5   | MEDIUM   | All 7 org pages violate guide §2731 "Mandatory SSR-first" — client-fetch-on-mount for initial data                                                                                                                                                             | ✅ Closed 2026-02-26 — all 7 pages SSR-first; `initialXxx` props passed from Server Components                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                             |
| 6   | MEDIUM   | `invitations` UPDATE RLS had no column restriction on the email-match (self-cancel) branch — invitee could UPDATE any column (role_id, branch_id, expires_at, etc.) via direct Supabase REST API, enabling privilege self-escalation before acceptance         | ✅ Closed 2026-02-27 — `20260227200000` splits into two policies (org-cancel + self-cancel); `20260227200001` adds self-accept policy. Three policies together: invitees may only write `status='cancelled'` or `status='accepted'`; no policy permits `status='pending'` new-row writes. +8 T1 tests total.                                                                                                                                                                                                                                                                                                                                                                                                               |
| 7   | INFO     | `organization_members` SELECT: `has_any_org_role` does not check member status or deleted_at — inactive/removed members with live role assignments can read the member list. Consistency gap: `removeMember()` did not clean up `user_role_assignments`.       | ✅ Closed 2026-02-27 — (a) `removeMember()` now soft-deletes all org-scoped and branch-scoped `user_role_assignments` for the removed user (P1-B, `organization.service.ts`). (b) `"V2 view org role assignments"` PERMISSIVE SELECT policy added on `user_role_assignments` requiring `members.read` + `is_org_member` (P1-A, migration `20260227320000`). Legacy `has_any_org_role` policy remains; V2 path provides permission-gated visibility for non-owner admins. Verified by T-RLS-2, T-RLS-4 integration tests.                                                                                                                                                                                                   |
| 8   | INFO     | Invitation acceptance (`src/lib/api/invitations.ts:acceptInvitation`) is a legacy client-side flow that only updates `invitations.status = 'accepted'` — it does NOT insert into `organization_members`. No DB trigger on `invitations` table bridges the gap. | ⏳ Open (P1-C, documented-only) — no INSERT RLS policy change needed since the legacy flow never attempts an `organization_members` INSERT. When a V2 server-action invite acceptance flow is implemented, it must use a trusted server flow (service role or elevated context) to INSERT into `organization_members`, because the current INSERT policy is legacy-only (`"Org creators and owners can add members"` — WITH CHECK: `is_org_creator(org_id) OR has_org_role(org_id, 'org_owner')`). **No V2 INSERT policy exists on `organization_members`.** A new additive INSERT policy (e.g. `has_permission(org_id, 'members.manage')`) must be created before an RLS-respecting server action can accept invitations. |

---

## Files Changed (This Session)

### Service layer

- `src/server/services/organization.service.ts` _(P1-B: removeMember now soft-deletes user_role_assignments)_

### Server actions

- `src/app/actions/organization/profile.ts`
- `src/app/actions/organization/members.ts`
- `src/app/actions/organization/invitations.ts`
- `src/app/actions/organization/roles.ts`
- `src/app/actions/organization/positions.ts`
- `src/app/actions/organization/branches.ts`
- `src/app/actions/organization/billing.ts`

### Tests

- `src/app/actions/organization/__tests__/actions.test.ts`
- `src/server/services/__tests__/organization-rls.test.ts`
- `src/server/services/__tests__/organization-rls-integration.test.ts` _(T-RLS: 4 real DB RLS tests — NEW)_
- `src/app/[locale]/dashboard/__tests__/sidebar-ssr.test.tsx` (added org-1 through org-5)
- `src/app/[locale]/dashboard/organization/users/roles/__tests__/roles-client.test.tsx` (5 RTL tests)
- `src/app/[locale]/dashboard/organization/branches/__tests__/branches-client.test.tsx` (4 RTL tests)
- `src/app/[locale]/dashboard/organization/users/invitations/__tests__/invitations-client.test.tsx` (4 RTL tests)
- `src/app/[locale]/dashboard/organization/users/members/__tests__/members-client.test.tsx` (3 RTL tests)
- `src/app/[locale]/dashboard/organization/users/positions/__tests__/positions-client.test.tsx` (6 RTL tests)

### Layouts and pages

- `src/app/[locale]/dashboard/organization/layout.tsx`
- `src/app/[locale]/dashboard/organization/loading.tsx`
- `src/app/[locale]/dashboard/organization/error.tsx`
- `src/app/[locale]/dashboard/organization/users/layout.tsx`
- `src/app/[locale]/dashboard/organization/users/loading.tsx`
- `src/app/[locale]/dashboard/organization/users/error.tsx`
- `src/app/[locale]/dashboard/organization/users/_components/users-layout-client.tsx`
- `src/app/[locale]/dashboard/organization/profile/page.tsx`
- `src/app/[locale]/dashboard/organization/users/page.tsx`
- `src/app/[locale]/dashboard/organization/users/members/page.tsx`
- `src/app/[locale]/dashboard/organization/users/invitations/page.tsx`
- `src/app/[locale]/dashboard/organization/users/roles/page.tsx`
- `src/app/[locale]/dashboard/organization/users/positions/page.tsx`
- `src/app/[locale]/dashboard/organization/users/branches/page.tsx`
- `src/app/[locale]/dashboard/organization/branches/page.tsx`
- `src/app/[locale]/dashboard/organization/billing/page.tsx`

### Client components

- `src/app/[locale]/dashboard/organization/profile/_components/org-profile-client.tsx`
- `src/app/[locale]/dashboard/organization/billing/_components/billing-client.tsx`
- `src/app/[locale]/dashboard/organization/users/members/_components/members-client.tsx`
- `src/app/[locale]/dashboard/organization/users/members/[memberId]/page.tsx`
- `src/app/[locale]/dashboard/organization/users/members/[memberId]/_components/member-detail-client.tsx`
- `src/app/[locale]/dashboard/organization/users/invitations/_components/invitations-client.tsx`
- `src/app/[locale]/dashboard/organization/users/roles/_components/roles-client.tsx`
- `src/app/[locale]/dashboard/organization/users/positions/_components/positions-client.tsx`
- `src/app/[locale]/dashboard/organization/branches/_components/branches-client.tsx`

### Configuration

- `src/i18n/routing.ts`
- `src/lib/sidebar/v2/registry.ts`
- `messages/en.json`
- `messages/pl.json`
- `messages/en/organization/general.json`
- `messages/pl/organization/general.json`

---

## Changelog

- 2026-02-26 — Module V2 implementation: migrations, service layer, 7 action files, T1+T2 tests, layouts, pages, all client components, routing, translation keys.
- 2026-02-26 (post-audit) — Compliance fixes: raw strings in `roles-client.tsx` replaced with imported constants; 5 org-specific sidebar SSR tests added; invitations RLS fixed (`auth.users` → JWT); `org-logos` storage bucket created; `/organization/branches` top-level route and sidebar entry added; `OrgMember` type extended with roles.
- 2026-02-26 (pre-commit hardening) — Security: billing page guard corrected `ORG_READ` → `ORG_UPDATE` to match sidebar + action. SSR: `loading.tsx` added at `organization/` and `organization/users/`. Config: legacy `items` array with `/dashboard-old/` paths removed (now `items: []`). Tests: 4 RTL tests for `RolesClient` added (permission visibility, group labels, action payload).
- 2026-02-26 (architecture verification pass) — Client ownership verified (services accept injected clients, no createClient in Client Components). Raw strings: 5 more client components fixed (`branches-client.tsx` ×2, `positions-client.tsx`, `members-client.tsx`, `invitations-client.tsx`) — grep evidence shows 0 remaining. SSR-first violation confirmed (guide §2731 Mandatory); remediation proposal documented, implementation deferred. Tests: +6 RTL tests for branches, invitations, members components. Docs: client ownership model and SSR strategy sections added.
- 2026-02-26 (SSR-first remediation) — Closed all 5 Known Compliance Gaps. Phase 1: all 7 pages converted to async Server Components that call service layer directly and pass `initialXxx` props. Phase 2A: all action result checks standardized to `result.success` / `result.error` across all 8 client components. Phase 2B: tab active detection changed to `pathname.endsWith()`. Phase 3: +10 RTL tests (regression guards for no-mount-fetch, new positions test file). Phase 4: MODULE.md + MODULE_CHECKLIST.md updated.
- 2026-02-27 (security fix — Gap #6) — Closed invitations UPDATE privilege escalation. Applied `20260227200000_fix_invitations_update_self_cancel.sql`: dropped combined UPDATE policy, created `invitations_update_org_cancel` (full UPDATE for org members) and `invitations_update_self_cancel` (email-match restricted to `status='cancelled'` via WITH CHECK). Added 3 T1 RLS tests. MODULE.md + MODULE_CHECKLIST.md updated. Verified via MCP post-apply.
- 2026-02-27 (regression fix) — Restored invite acceptance path broken by Gap #6 fix. Applied `20260227200001_fix_invitations_self_accept_regression.sql`: adds `invitations_update_self_accept` (email-match, WITH CHECK `status='accepted' AND accepted_at IS NOT NULL`). Gap #6 security property confirmed intact (no policy permits `status='pending'` for invitees). +5 T1 tests (23 total). Verified via MCP post-apply.
- 2026-02-27 (Phase 2 — Scoped RBAC UX + Member Detail) — Service layer: `OrgRolesService` generalized with `scope_type` on create, `scope`/`scopeId` on assign/remove, new `getMemberAccess` and `getMember`. Actions: `createRoleAction` accepts `scope_type`, assign/remove accept `scope`+`scopeId`, new `getMemberAccessAction`. Hooks: mutations updated, `useMemberAccessQuery` added. UI: `roles-client.tsx` — scope selector in create dialog, scope badge on rows, read-only scope in edit. `members-client.tsx` — View link (Eye icon) per row, scope-aware Manage Roles dialog (branch multiselect, both-toggle). New `members/[memberId]/page.tsx` + `member-detail-client.tsx` (Info + Access tabs). Routing: `/dashboard/organization/users/members/[memberId]` registered. RTL tests: roles 5→10, members 3→7, +10 member-detail. All 976 tests pass.
