# Organization Management Module — Legacy Extraction & V2 Blueprint

> **Status**: Blueprint (READ-ONLY analysis — no code changed)
> **Date**: 2026-02-25
> **Branch**: `admin-dashboard`
> **Module slug**: `organization-management`

---

## 1. Executive Summary

The Organization Management module exists today as a mix of legacy code scattered across two
mismatched directories and 13 pages under the defunct `dashboard-old` route. The V2 sidebar
registry already has three items registered (`organization.profile`, `organization.users`,
`organization.billing`) pointing to routes that **do not yet have page implementations**.

The database layer is largely complete and mostly sound, with one **critical security gap**:
`organization_profiles` has **Row Level Security disabled**. All other core tables (`organizations`,
`organization_members`, `branches`, `invitations`, `roles`, `role_permissions`,
`user_role_assignments`, `user_effective_permissions`, `user_permission_overrides`) have RLS
enabled. A compiled-permissions trigger system automatically recomputes `user_effective_permissions`
on any role/override change.

The legacy permission system uses raw strings that don't match the V2 permission constants.
A full mapping exists (see §4). The V2 permission constants are already defined and complete for
this module's needs.

**Immediate priorities before implementation begins:**

1. Enable RLS on `organization_profiles` (critical security fix)
2. Delete dead `src/modules/organization-management/` directory (typo-free, unused)
3. Rename `src/modules/organization-managment/` → `src/modules/organization-management/` or keep as-is and update references

---

## 2. Legacy Code Inventory

### 2.1 Directory Structure

| Path                                                                       | Status              | Notes                                                                 |
| -------------------------------------------------------------------------- | ------------------- | --------------------------------------------------------------------- |
| [src/modules/organization-managment/](src/modules/organization-managment/) | **Active (legacy)** | Typo in name (missing 'e'). Contains config, components, API helpers. |
| `src/modules/organization-management/`                                     | Dead                | Correct spelling. Mostly empty or stub files.                         |
| `src/app/[locale]/dashboard-old/organization/`                             | Dead                | 13 legacy pages — routes not active in V2 shell.                      |

### 2.2 Active Legacy Files (organization-managment — typo dir)

| File                                                                                                                                                                             | Purpose                                                                                                             |
| -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------- |
| [src/modules/organization-managment/config.ts](src/modules/organization-managment/config.ts)                                                                                     | Module config: routes all point to `/dashboard-old/*`, uses raw permission strings                                  |
| [src/modules/organization-managment/schema.ts](src/modules/organization-managment/schema.ts)                                                                                     | Zod schema for `organization_profiles` update (name, slug, name_2, bio, website, logo_url, theme_color, font_color) |
| [src/modules/organization-managment/api/updateProfile.ts](src/modules/organization-managment/api/updateProfile.ts)                                                               | Server action — updates `organization_profiles`; uses deprecated `public.authorize()` RPC                           |
| [src/modules/organization-managment/api/uploadLogo.ts](src/modules/organization-managment/api/uploadLogo.ts)                                                                     | Logo upload helper (server-side)                                                                                    |
| [src/modules/organization-managment/api/getBranchesWithStatsFromDb.ts](src/modules/organization-managment/api/getBranchesWithStatsFromDb.ts)                                     | Fetches branches list with member/active counts                                                                     |
| [src/modules/organization-managment/LogoUploader.tsx](src/modules/organization-managment/LogoUploader.tsx)                                                                       | Logo upload component — server action based, **ACTIVE**                                                             |
| [src/modules/organization-managment/OrganizationLogoUploader.tsx](src/modules/organization-managment/OrganizationLogoUploader.tsx)                                               | Logo upload component — direct client-side Supabase, **INSECURE / DEAD**                                            |
| [src/modules/organization-managment/OrganizationProfileForm.tsx](src/modules/organization-managment/OrganizationProfileForm.tsx)                                                 | Profile edit form (React Hook Form + shadcn/ui)                                                                     |
| [src/modules/organization-managment/OrganizationPreview.tsx](src/modules/organization-managment/OrganizationPreview.tsx)                                                         | Preview card for org profile                                                                                        |
| [src/modules/organization-managment/components/branches/](src/modules/organization-managment/components/branches/)                                                               | BranchTable, BranchFormDialog, BranchDeleteDialog, BranchActions, BranchSearch, BranchHeader, BranchStats           |
| [src/modules/organization-managment/components/invitations/InvitationManagementView.tsx](src/modules/organization-managment/components/invitations/InvitationManagementView.tsx) | Full invitation management table with filter/search/cancel/resend                                                   |
| [src/modules/organization-managment/components/invitations/InvitationFormDialog.tsx](src/modules/organization-managment/components/invitations/InvitationFormDialog.tsx)         | Invite new user dialog                                                                                              |

### 2.3 Server Actions (legacy, active)

| File                                                             | Actions                                                                               |
| ---------------------------------------------------------------- | ------------------------------------------------------------------------------------- |
| [src/app/actions/branches.ts](src/app/actions/branches.ts)       | `createBranch`, `updateBranch`, `deleteBranch`, `getBranches`                         |
| [src/app/actions/invitations.ts](src/app/actions/invitations.ts) | `cancelInvitationAction`, `resendInvitationAction`, `cleanupExpiredInvitationsAction` |
| `src/app/actions/invitations-server.ts`                          | `InvitationWithDetails` type + server fetch helpers                                   |
| `src/app/actions/roles/index.ts`                                 | Role assignment actions                                                               |

### 2.4 Legacy Hooks

| Hook                         | Source                                                                                                 |
| ---------------------------- | ------------------------------------------------------------------------------------------------------ |
| `useOrganizationInvitations` | `src/hooks/useOrganizationInvitations.ts` — client hook, fetches invitations; TanStack Query or custom |

---

## 3. Database Layer (Supabase MCP — verified 2026-02-25)

### 3.1 Tables & Columns

#### `organizations`

| Column      | Type        | Notes             |
| ----------- | ----------- | ----------------- |
| id          | uuid PK     |                   |
| name        | text        |                   |
| slug        | text        | Unique identifier |
| description | text        | nullable          |
| is_active   | boolean     |                   |
| created_at  | timestamptz |                   |
| updated_at  | timestamptz |                   |

#### `organization_profiles`

| Column          | Type         | Notes                        |
| --------------- | ------------ | ---------------------------- |
| organization_id | uuid FK (PK) | References organizations.id  |
| name            | text         | Display name                 |
| name_2          | text         | nullable, secondary name     |
| bio             | text         | nullable, max 500 chars      |
| logo_url        | text         | nullable, public URL         |
| website         | text         | nullable                     |
| theme_color     | text         | nullable, hex e.g. `#6366f1` |
| font_color      | text         | nullable, hex                |
| created_at      | timestamptz  |                              |
| updated_at      | timestamptz  |                              |

> **CRITICAL**: RLS is **DISABLED** on this table — see §3.3.

#### `organization_members`

| Column          | Type        | Notes    |
| --------------- | ----------- | -------- |
| id              | uuid PK     |          |
| organization_id | uuid FK     |          |
| user_id         | uuid FK     |          |
| joined_at       | timestamptz |          |
| is_active       | boolean     |          |
| invited_by      | uuid        | nullable |
| created_at      | timestamptz |          |
| updated_at      | timestamptz |          |

#### `branches`

| Column          | Type        | Notes       |
| --------------- | ----------- | ----------- |
| id              | uuid PK     |             |
| organization_id | uuid FK     |             |
| name            | text        |             |
| description     | text        | nullable    |
| is_active       | boolean     |             |
| created_at      | timestamptz |             |
| updated_at      | timestamptz |             |
| deleted_at      | timestamptz | Soft delete |

#### `invitations`

| Column          | Type        | Notes                                                             |
| --------------- | ----------- | ----------------------------------------------------------------- |
| id              | uuid PK     |                                                                   |
| organization_id | uuid FK     |                                                                   |
| email           | text        | Invitee email                                                     |
| role_id         | uuid FK     | nullable, references roles.id                                     |
| branch_id       | uuid FK     | nullable, references branches.id                                  |
| token           | text        | Unique invite token                                               |
| status          | text        | `pending` \| `accepted` \| `rejected` \| `expired` \| `cancelled` |
| expires_at      | timestamptz | nullable                                                          |
| created_by      | uuid FK     |                                                                   |
| created_at      | timestamptz |                                                                   |
| updated_at      | timestamptz |                                                                   |

#### Compiled Permission Tables

| Table                        | Purpose                                                     |
| ---------------------------- | ----------------------------------------------------------- |
| `roles`                      | Named roles scoped to org (e.g., `org_owner`, `org_member`) |
| `role_permissions`           | Maps role → permission slug                                 |
| `permissions`                | Canonical permission registry (24 slugs)                    |
| `user_role_assignments`      | User → role within an org                                   |
| `user_effective_permissions` | **Compiled snapshot** — auto-updated by triggers            |
| `user_permission_overrides`  | Explicit allow/deny overrides per user+org                  |

### 3.2 RLS Status

| Table                        | RLS Enabled | FORCE RLS | Notes                             |
| ---------------------------- | ----------- | --------- | --------------------------------- |
| `organizations`              | ✅          | No        | Standard RLS                      |
| `organization_profiles`      | ❌          | No        | **CRITICAL GAP — no policies**    |
| `organization_members`       | ✅          | No        | Policies use `is_org_member()`    |
| `branches`                   | ✅          | No        | Policies use `has_permission()`   |
| `invitations`                | ✅          | No        | 3 policies (insert/select/update) |
| `roles`                      | ✅          | No        |                                   |
| `role_permissions`           | ✅          | No        |                                   |
| `user_role_assignments`      | ✅          | No        |                                   |
| `user_effective_permissions` | ✅          | No        |                                   |
| `user_permission_overrides`  | ✅          | No        |                                   |

### 3.3 Critical Security Gap: `organization_profiles` Has No RLS

```sql
-- Current state (DANGEROUS):
-- ALTER TABLE organization_profiles ENABLE ROW LEVEL SECURITY;  -- NOT run

-- Any authenticated user can SELECT/UPDATE any org's profile row
-- The legacy updateProfile.ts works around this with application-level authorize() call
-- but there is no DB-level protection
```

**Required fix** (migration): Enable RLS + add select/update policies.

### 3.4 Invitations RLS Policies (V2-compatible)

```sql
-- INSERT: requires invites.create permission in the org
-- Policy: has_permission(organization_id, 'invites.create')

-- SELECT: org members can see their org's invitations
-- Policy: is_org_member(organization_id)

-- UPDATE (cancel/accept): requires invites.cancel or is the invitee
-- Policy: has_permission(organization_id, 'invites.cancel') OR email = auth.email()
```

These policies already use `has_permission()` which is the V2 RLS function. ✅

### 3.5 Triggers (Compiled Permissions Auto-Recompile)

| Trigger                              | Table                               | Event                | Fires                                               |
| ------------------------------------ | ----------------------------------- | -------------------- | --------------------------------------------------- |
| `trigger_compile_on_membership`      | `organization_members`              | INSERT/UPDATE/DELETE | Recompiles permissions for affected user            |
| `trigger_compile_on_role_assignment` | `user_role_assignments`             | INSERT/UPDATE/DELETE | Recompiles permissions for affected user            |
| `trigger_compile_on_role_permission` | `role_permissions`                  | INSERT/UPDATE/DELETE | Recompiles permissions for all users with that role |
| `trigger_compile_on_override`        | `user_permission_overrides`         | INSERT/UPDATE/DELETE | Recompiles permissions for affected user            |
| `trigger_recompute_entitlements`     | `subscription_addons` / `overrides` | INSERT/UPDATE        | Recomputes org entitlements                         |

---

## 4. Permission Migration Map (Legacy → V2)

### 4.1 Raw Legacy Strings → V2 Constants

| Legacy Raw String               | V2 Constant                                               | DB Slug          | Notes                                                          |
| ------------------------------- | --------------------------------------------------------- | ---------------- | -------------------------------------------------------------- |
| `"organization.profile.update"` | `ORG_UPDATE`                                              | `org.update`     | **Mismatch** — legacy used longer string, V2 uses `org.update` |
| `"organization.profile.read"`   | `ORG_READ`                                                | `org.read`       | Same mismatch pattern                                          |
| `"branch.manage"`               | `BRANCHES_CREATE` + `BRANCHES_UPDATE` + `BRANCHES_DELETE` | `branches.*`     | Split into granular                                            |
| `"user.manage"`                 | `MEMBERS_MANAGE`                                          | `members.manage` | Renamed                                                        |
| `"invitation.read"`             | `INVITES_READ`                                            | `invites.read`   | Renamed                                                        |
| `"invitation.create"`           | `INVITES_CREATE`                                          | `invites.create` | Renamed                                                        |
| `"invitation.cancel"`           | `INVITES_CANCEL`                                          | `invites.cancel` | Renamed                                                        |
| `"invitation.manage"`           | `INVITES_CREATE` + `INVITES_CANCEL` + `INVITES_READ`      | —                | No direct V2 equivalent; use granular                          |
| `"user.role.read"`              | `MEMBERS_READ`                                            | `members.read`   | Renamed                                                        |

### 4.2 V2 Permission Constants Available (from `src/lib/constants/permissions.ts`)

```typescript
// Fully available for Organization Management V2:
ORG_READ = "org.read";
ORG_UPDATE = "org.update";
MEMBERS_READ = "members.read";
MEMBERS_MANAGE = "members.manage";
BRANCHES_CREATE = "branches.create";
BRANCHES_READ = "branches.read";
BRANCHES_UPDATE = "branches.update";
BRANCHES_DELETE = "branches.delete";
INVITES_CREATE = "invites.create";
INVITES_READ = "invites.read";
INVITES_CANCEL = "invites.cancel";
```

All 11 permission slugs are confirmed in the `permissions` table in the database.

### 4.3 `public.authorize()` vs `PermissionServiceV2`

The legacy `updateProfile.ts` uses the old `public.authorize()` RPC pattern:

```typescript
// LEGACY (do not use in V2):
const { data: authResult } = await supabase.rpc("authorize", {
  user_id: userId,
  required_permissions: ["organization.profile.update"], // wrong slug!
  organization_id: preferences.organization_id,
});
```

V2 pattern (correct approach):

```typescript
// V2 (server action):
import { PermissionServiceV2 } from "@/server/services/permission.service";
const allowed = await PermissionServiceV2.hasPermission(supabase, userId, orgId, ORG_UPDATE);
```

---

## 5. Sidebar V2 Registry (Already Registered)

From [src/lib/sidebar/v2/registry.ts](src/lib/sidebar/v2/registry.ts):

```typescript
// Organization parent (module-gated: MODULE_ORGANIZATION_MANAGEMENT)
{
  id: "organization",
  children: [
    {
      id: "organization.profile",
      href: "/dashboard/organization/profile",
      visibility: { requiresPermissions: [ORG_READ] },
    },
    {
      id: "organization.users",
      href: "/dashboard/organization/users",
      visibility: { requiresPermissions: [MEMBERS_READ] },
    },
    {
      id: "organization.billing",
      href: "/dashboard/organization/billing",
      visibility: { requiresPermissions: [ORG_UPDATE] }, // owners only
    },
  ],
}
```

**None of these routes have page implementations yet.** The sidebar items will render correctly
once pages are created at these paths.

**Missing sidebar items** (exist in legacy config, not in V2 registry):

- `organization.branches` — branches management sub-page
- `organization.invitations` — invitation management (currently a sub-tab of users)
- `organization.roles` — role management

The V2 registry consolidates branches + invitations + roles under `organization.users`.
This is a design decision that should be confirmed before implementation.

---

## 6. V2 Module Blueprint

### 6.1 Module Identity

```typescript
// src/lib/constants/modules.ts (already registered)
export const MODULE_ORGANIZATION_MANAGEMENT = "organization-management" as const;

// Theme color
export const ORG_MODULE_THEME_COLOR = "#6366f1"; // Indigo
```

### 6.2 Proposed Page Structure

```
src/app/[locale]/dashboard/organization/
├── layout.tsx                      # Module layout with org context guard
├── profile/
│   └── page.tsx                    # Organization profile (name, logo, bio, website, colors)
├── users/
│   ├── page.tsx                    # Members list + tabs: Members | Invitations | Roles
│   └── [memberId]/
│       └── page.tsx                # Member detail / role assignment (optional)
└── billing/
    └── page.tsx                    # Billing & subscriptions (owner-only)
```

### 6.3 Server Actions (V2 Pattern)

New server actions should be created at `src/app/actions/organization/`:

```
src/app/actions/organization/
├── profile.ts       # updateOrgProfile, getOrgProfile
├── members.ts       # getMembers, removeMember, updateMemberRole
├── branches.ts      # migrate/refactor from src/app/actions/branches.ts
└── invitations.ts   # migrate/refactor from src/app/actions/invitations.ts
```

Each action must:

1. Get user session via `createClient()`
2. Load org context from `appContext` (not `user_preferences`)
3. Check permissions via `PermissionServiceV2.hasPermission()`
4. Use V2 permission constants (not raw strings)

### 6.4 Service Layer

```
src/server/services/
└── organization.service.ts    # OrgProfileService, MembersService, InvitationsService
```

Following the flat service pattern (no subdirectories).

### 6.5 SSR Architecture (V2 Pattern)

```typescript
// src/app/[locale]/dashboard/organization/profile/page.tsx
export default async function OrgProfilePage({ params }: { params: { locale: string } }) {
  // 1. Load context server-side (already done by dashboard layout)
  const context = await loadDashboardContextV2();

  // 2. Fetch org profile server-side
  const profile = await OrgProfileService.getProfile(
    context.appContext.activeOrgId,
    context.userContext
  );

  // 3. Render with pre-fetched data — no client useEffect
  return <OrgProfileForm initialData={profile} orgId={context.appContext.activeOrgId} />;
}
```

### 6.6 Required Migration

> Enable RLS on `organization_profiles` before ANY other implementation.

```sql
-- Migration: enable_rls_organization_profiles
ALTER TABLE organization_profiles ENABLE ROW LEVEL SECURITY;

-- Policy: members can read their org's profile
CREATE POLICY "org_members_can_read_profile"
ON organization_profiles FOR SELECT
USING (is_org_member(organization_id));

-- Policy: users with org.update can update the profile
CREATE POLICY "org_admins_can_update_profile"
ON organization_profiles FOR UPDATE
USING (has_permission(organization_id, 'org.update'))
WITH CHECK (has_permission(organization_id, 'org.update'));
```

### 6.7 Logo Storage Strategy

Logo storage should follow the same pattern as user avatars:

```
Storage bucket: org-logos (private or public — TBD)
Path structure: {orgId}/logo.{ext}
```

Options:

- **Public bucket** (simpler): Store `logo_url` as public URL directly in `organization_profiles.logo_url`.
  No signed URL needed. Suitable if logos are not sensitive.
- **Private bucket** (more secure): Use signed URLs generated in the server loader.
  Store path in a new `logo_path` column; generate signed URL in `loadDashboardContextV2`.

The legacy `LogoUploader.tsx` uses a server action which is the correct approach regardless.
`OrganizationLogoUploader.tsx` (direct client Supabase) must be deleted.

**Recommendation**: Use public bucket for org logos (not sensitive, must be displayable externally).

### 6.8 Internationalization

All i18n keys already exist in `messages/en.json` and `messages/pl.json` under:

```
modules.organizationManagement.title
modules.organizationManagement.description
modules.organizationManagement.items.profile
modules.organizationManagement.items.branches
modules.organizationManagement.items.users.title
modules.organizationManagement.items.users.list
modules.organizationManagement.items.users.invitations
modules.organizationManagement.items.users.roles
modules.organizationManagement.items.billing
```

New keys may be needed for V2-specific UI strings.

---

## 7. Next Implementation Steps Checklist

### Security (Must Do First)

- [ ] **[CRITICAL]** Apply migration: `enable_rls_organization_profiles` — enable RLS + add select/update policies
- [ ] Delete `src/modules/organization-managment/OrganizationLogoUploader.tsx` (insecure direct client upload)
- [ ] Create local migration file for every Supabase MCP migration applied

### Cleanup

- [ ] Delete dead `src/modules/organization-management/` directory (correct spelling, unused stubs)
- [ ] Confirm disposition of `src/modules/organization-managment/` (keep with typo or rename)
- [ ] Remove `dashboard-old/organization/` routes from Next.js route config once V2 pages exist

### Data Layer (Server Actions + Services)

- [ ] Create `src/server/services/organization.service.ts` (profile CRUD)
- [ ] Create `src/app/actions/organization/profile.ts` — uses `PermissionServiceV2`, `ORG_UPDATE` constant
- [ ] Refactor `src/app/actions/branches.ts` → `src/app/actions/organization/branches.ts` with V2 patterns
- [ ] Refactor `src/app/actions/invitations.ts` → `src/app/actions/organization/invitations.ts`
- [ ] Replace all raw permission strings (e.g., `"organization.profile.update"`) with V2 constants
- [ ] Replace `public.authorize()` RPC calls with `PermissionServiceV2.hasPermission()`

### Pages

- [ ] `src/app/[locale]/dashboard/organization/layout.tsx` — module guard (requires `MODULE_ORGANIZATION_MANAGEMENT`)
- [ ] `src/app/[locale]/dashboard/organization/profile/page.tsx` — SSR, requires `ORG_READ`
- [ ] `src/app/[locale]/dashboard/organization/users/page.tsx` — SSR, requires `MEMBERS_READ`; tabs for Members / Invitations / Roles
- [ ] `src/app/[locale]/dashboard/organization/billing/page.tsx` — SSR, requires `ORG_UPDATE`

### Components (Migrate from Legacy)

- [ ] Migrate `OrganizationProfileForm.tsx` → V2 (update imports, use V2 action)
- [ ] Migrate `LogoUploader.tsx` → V2 (keep server-action pattern, update paths)
- [ ] Migrate `BranchTable`, `BranchFormDialog`, `BranchDeleteDialog` → V2 components
- [ ] Migrate `InvitationManagementView.tsx` → V2 (update hook to V2 query pattern)
- [ ] Migrate `InvitationFormDialog.tsx` → V2

### Sidebar Registry

- [ ] Confirm `organization.branches` — add as child of `organization.users` or separate item?
- [ ] Add `organization.branches` to `src/lib/sidebar/v2/registry.ts` if separate page desired
- [ ] Verify i18n titleKey for `organization.profile` and `organization.billing` (TODO comments in registry)

### Testing

- [ ] Unit tests for `organization.service.ts`
- [ ] Unit tests for server actions (mock `PermissionServiceV2`)
- [ ] Update `sidebar-ssr.test.tsx` if new sidebar items added
- [ ] Integration test: org member cannot update profile (RLS policy test)
- [ ] Integration test: org owner can update profile
- [ ] Integration test: member cannot see billing page

### Documentation

- [ ] Create `src/app/[locale]/dashboard/organization/MODULE.md`
- [ ] Create `src/app/[locale]/dashboard/organization/MODULE_CHECKLIST.md`

---

## 8. Anti-Footgun Notes

| #   | Issue                                                         | Correct Approach                                                                               |
| --- | ------------------------------------------------------------- | ---------------------------------------------------------------------------------------------- |
| 1   | `organization_profiles` has no RLS                            | Enable RLS via migration BEFORE writing any server actions                                     |
| 2   | Legacy uses `"organization.profile.update"` permission string | V2 slug is `"org.update"` (constant: `ORG_UPDATE`)                                             |
| 3   | Legacy uses `public.authorize()` RPC                          | V2 uses `PermissionServiceV2.hasPermission()`                                                  |
| 4   | Two logo upload components exist                              | Only `LogoUploader.tsx` (server action) is correct; delete `OrganizationLogoUploader.tsx`      |
| 5   | `organization-managment` dir has typo                         | Do not create new files in this dir; target final dir is `organization-management`             |
| 6   | Sidebar items point to `/dashboard/organization/*`            | Routes don't exist yet — implement pages before testing sidebar navigation                     |
| 7   | Triggers auto-recompile `user_effective_permissions`          | Permission changes are not instant in tests; allow for trigger propagation                     |
| 8   | `invitations` uses `has_permission()` (V2 RLS)                | New server actions must match this; do not use legacy `authorize()` for invitation ops         |
| 9   | `organization.billing` requires `ORG_UPDATE` permission       | This means only `org_owner` roles with `org.update` see billing — intentional                  |
| 10  | `organization-management` vs `organization-managment`         | Module slug constant is `"organization-management"` (correct) — the directory typo is separate |

---

_Generated by Claude Code — 2026-02-25 — READ-ONLY analysis, no code modified._
