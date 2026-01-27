# Phase 3: User Management

**Status:** ⚪ NOT STARTED
**Duration:** ~10 hours estimated
**Priority:** 🟡 HIGH
**Overall Progress:** 0%

---

## 📊 Progress Tracker

| Task                        | Status         | Duration | Pages | Actions | Tests | Completion |
| --------------------------- | -------------- | -------- | ----- | ------- | ----- | ---------- |
| 3.1 User Profile Management | ⚪ Not Started | 4h       | 3     | 5       | 0/20  | 0%         |
| 3.2 User Invitations        | ⚪ Not Started | 3h       | 2     | 5       | 0/25  | 0%         |
| 3.3 User List & Management  | ⚪ Not Started | 3h       | 1     | 4       | 0/35  | 0%         |

**Total:** 0/6 pages | 0/14 actions | 0/80 tests | 0/10 hours | 0% complete

---

## 🎯 Phase Goal

Build complete user management system including profile, settings, invitations, and user administration.

**Prerequisites:**

- ✅ Auth system (password reset) - Complete
- ✅ User context loading - Complete
- ⚪ RLS policies (Phase 1) - Required
- ⚪ UI primitives (Phase 2) - Required

---

## Task 3.1: User Profile Management (4 hours) ⚪

### 3.1.1 Profile Page (2 hours)

**File:** `src/app/[locale]/dashboard/account/profile/page.tsx`

**Features:**

- [ ] Display user info (name, email, avatar)
- [ ] Edit profile form
- [ ] Avatar upload with storage RLS
- [ ] Form validation
- [ ] Success/error feedback

**Server Action:** `src/app/[locale]/dashboard/account/_actions.ts`

```typescript
export async function updateUserProfile(input: UpdateProfileInput): Promise<ActionResponse> {
  // 1. Load context
  // 2. Validate input with Zod
  // 3. Call UserService.updateProfile()
  // 4. Return success/error
}
```

**Service:** `src/server/services/user.service.ts`

```typescript
class UserService {
  static async updateProfile(userId: string, data: UpdateProfileData): Promise<User> {
    // 1. Validate business rules
    // 2. Update users table
    // 3. Return updated user
  }
}
```

**RLS Policy:**

```sql
-- Already covered in Phase 1.1
-- users_update_own policy allows users to update own profile
```

**Tests:**

- [ ] Service tests (5 tests)
- [ ] Action tests (5 tests)
- [ ] Component tests (3 tests)

**Checklist:**

- [ ] Page created
- [ ] Form functional
- [ ] Avatar upload works
- [ ] Server action created
- [ ] Service method created
- [ ] 13 tests passing
- [ ] Mobile responsive

### 3.1.2 Profile Settings (1 hour)

**File:** `src/app/[locale]/dashboard/account/preferences/page.tsx`

**Features:**

- [ ] Notification preferences
- [ ] Language/locale selection
- [ ] Timezone selection
- [ ] Theme selection (light/dark)

**Server Action:**

```typescript
export async function updateUserPreferences(
  input: UpdatePreferencesInput
): Promise<ActionResponse> {
  // Update user_preferences table
}
```

**Tests:**

- [ ] Action tests (3 tests)
- [ ] Component tests (2 tests)

**Checklist:**

- [ ] Page created
- [ ] All settings work
- [ ] Preferences persist
- [ ] 5 tests passing

### 3.1.3 Account Security (1 hour)

**File:** `src/app/[locale]/dashboard/account/security/page.tsx`

**Features:**

- [ ] Change password form
- [ ] Email change (with verification)
- [ ] Login history display
- [ ] Active sessions list

**Server Actions:**

```typescript
export async function changePassword(input: ChangePasswordInput): Promise<ActionResponse>;
export async function changeEmail(input: ChangeEmailInput): Promise<ActionResponse>;
export async function getSessions(): Promise<ActionResponse<Session[]>>;
```

**Tests:**

- [ ] Action tests (2 tests)

**Checklist:**

- [ ] Page created
- [ ] Password change works
- [ ] Email change flow works
- [ ] Sessions display
- [ ] 2 tests passing

### Definition of Done ✅

- [ ] 3 profile pages complete
- [ ] 5 server actions working
- [ ] UserService methods created
- [ ] RLS policies enforced
- [ ] 20 tests passing
- [ ] Mobile responsive

---

## Task 3.2: User Invitations (3 hours) ⚪

### 3.2.1 Invitation Flow (2 hours)

**Files:**

- `src/components/v2/users/invite-user-dialog.tsx`
- `src/app/[locale]/dashboard/organization/_actions.ts`

**Features:**

- [ ] Invite user dialog
- [ ] Email invitation with accept link
- [ ] Invitation status tracking (pending/accepted/expired)
- [ ] Resend invitation
- [ ] Cancel invitation
- [ ] Role selection on invite

**Server Actions:**

```typescript
export async function inviteUser(input: InviteUserInput): Promise<ActionResponse>;
export async function resendInvitation(invitationId: string): Promise<ActionResponse>;
export async function cancelInvitation(invitationId: string): Promise<ActionResponse>;
```

**Service:** `src/server/services/invitation.service.ts`

```typescript
class InvitationService {
  static async create(
    email: string,
    orgId: string,
    roleId: string,
    invitedBy: string
  ): Promise<Invitation>;
  static async resend(invitationId: string): Promise<void>;
  static async cancel(invitationId: string): Promise<void>;
  static async accept(token: string, userId: string): Promise<void>;
}
```

**Email Template:**

```typescript
// Use existing EmailService from Phase 0
EmailService.sendInvitationEmail({
  to: email,
  inviterName: user.name,
  organizationName: org.name,
  acceptUrl: `${siteUrl}/accept-invitation?token=${token}`,
});
```

**Tests:**

- [ ] Service tests (10 tests)
- [ ] Action tests (8 tests)
- [ ] Component tests (2 tests)

**Checklist:**

- [ ] Dialog component created
- [ ] Server actions created
- [ ] InvitationService created
- [ ] Email sending works
- [ ] 20 tests passing

### 3.2.2 Accept Invitation (1 hour)

**File:** `src/app/[locale]/(public)/accept-invitation/page.tsx`

**Features:**

- [ ] Accept invitation page
- [ ] Set password on accept
- [ ] Auto-assign to organization
- [ ] Auto-assign role
- [ ] Redirect to dashboard

**Server Action:**

```typescript
export async function acceptInvitation(token: string, password: string): Promise<ActionResponse>;
```

**Tests:**

- [ ] Action tests (5 tests)

**Checklist:**

- [ ] Page created
- [ ] Token validation works
- [ ] User setup completes
- [ ] Role assignment works
- [ ] 5 tests passing

### Definition of Done ✅

- [ ] Invitation system complete
- [ ] 5 server actions working
- [ ] InvitationService created
- [ ] Email templates working
- [ ] 25 tests passing

---

## Task 3.3: User List & Management (3 hours) ⚪

### 3.3.1 Organization Users List (2 hours)

**File:** `src/app/[locale]/dashboard/organization/users/page.tsx`

**Features:**

- [ ] DataTable with users
- [ ] Display: name, email, roles, status
- [ ] Filter by role
- [ ] Filter by status (active/invited/suspended)
- [ ] Search by name/email
- [ ] User detail dialog
- [ ] Invite user button (permission-gated)

**Server Actions:**

```typescript
export async function getOrganizationUsers(filters: UserFilters): Promise<ActionResponse<User[]>>;
export async function getUserDetails(userId: string): Promise<ActionResponse<UserDetails>>;
```

**Service:** `src/server/services/user.service.ts`

```typescript
class UserService {
  static async getOrganizationUsers(orgId: string, filters: UserFilters): Promise<User[]>;
  static async getUserDetails(userId: string, orgId: string): Promise<UserDetails>;
}
```

**Tests:**

- [ ] Service tests (10 tests)
- [ ] Action tests (8 tests)
- [ ] Component tests (5 tests)

**Checklist:**

- [ ] Page created
- [ ] DataTable working
- [ ] Filters working
- [ ] Search working
- [ ] Server actions created
- [ ] 23 tests passing

### 3.3.2 User Role Management (1 hour)

**Component:** `src/components/v2/users/manage-roles-dialog.tsx`

**Features:**

- [ ] Assign/remove roles
- [ ] Org-level roles
- [ ] Branch-level roles
- [ ] Permission overrides (view only)
- [ ] Role assignment validation

**Server Actions:**

```typescript
export async function assignRole(
  userId: string,
  roleId: string,
  scope: Scope
): Promise<ActionResponse>;
export async function removeRole(
  userId: string,
  roleId: string,
  scope: Scope
): Promise<ActionResponse>;
```

**Service:** `src/server/services/role.service.ts`

```typescript
class RoleService {
  static async assignRole(
    userId: string,
    roleId: string,
    scopeType: string,
    scopeId: string
  ): Promise<void>;
  static async removeRole(assignmentId: string): Promise<void>;
}
```

**Tests:**

- [ ] Service tests (5 tests)
- [ ] Action tests (5 tests)
- [ ] Component tests (2 tests)

**Checklist:**

- [ ] Dialog component created
- [ ] Role assignment works
- [ ] Validation prevents privilege escalation
- [ ] 12 tests passing

### Definition of Done ✅

- [ ] User list page complete
- [ ] Role management working
- [ ] 4 server actions created
- [ ] UserService + RoleService methods
- [ ] 35 tests passing
- [ ] Only admins can manage roles

---

## 📈 Success Metrics

- [ ] **User profile complete** - Edit, preferences, security
- [ ] **Invitation system working** - Send, accept, track
- [ ] **Role assignment functional** - Org and branch level
- [ ] **80+ tests passing** - Comprehensive coverage
- [ ] **Mobile responsive** - Works on all devices
- [ ] **Permission gating** - Only authorized users see admin features

---

## 🔄 Next Steps

After Phase 3 completion:

- Move to Phase 4: Organization Management
- Build on user management patterns
- Add permission overrides UI

---

**Last Updated:** 2026-01-27
**Status:** ⚪ Not Started
**Requires:** Phase 1 (RLS), Phase 2 (UI Primitives)
**Next Task:** 3.1 User Profile Management
