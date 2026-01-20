# Permission System V2 - Architecture Design

## The Core Idea (One Sentence)

> A user can do something only if there is an explicit row in the database that says they can.

No magic. No guessing. No wildcards at runtime. Everything else exists only to produce those rows.

---

## Table Responsibilities

### 1. `auth.users` (Supabase Auth)

**Question it answers:** Who is this person?

This is just authentication - email, password, user id. It does NOT decide permissions. It only proves identity.

### 2. `organizations`

**Question it answers:** What company/workspace exists?

An organization is a company, a workspace, a tenant. Nothing more.

### 3. `organization_members` (Tenant Boundary)

**Question it answers:** Is this user part of this organization at all?

Think of this as: "Are you inside the building?"

| Column          | Purpose                    |
| --------------- | -------------------------- |
| user_id         | Who                        |
| organization_id | Which org                  |
| status          | active, invited, suspended |

**Why this exists:** Because belonging is different from permission. If you are not a member, you should see nothing - permissions don't even matter. This table is the tenant security wall.

### 4. `permissions` (Dictionary)

**Question it answers:** What actions are even possible in the system?

This is just a dictionary of allowed verbs:

- `org.read`
- `org.update`
- `branches.read`
- `members.manage`
- etc.

This table does nothing by itself. It's just a list.

### 5. `roles` (Labels)

**Question it answers:** What bundle of permissions do we want to name?

Examples: `org_owner`, `org_member`

A role is just a label. It has no power until permissions are attached.

### 6. `role_permissions` (Role Definitions)

**Question it answers:** Which permissions belong to this role?

| Role       | Permission     |
| ---------- | -------------- |
| org_owner  | org.read       |
| org_owner  | org.update     |
| org_owner  | members.manage |
| org_member | org.read       |
| org_member | members.read   |
| org_member | self.update    |

This is where roles get meaning.

### 7. `user_role_assignments`

**Question it answers:** Which role does this user have in this organization?

| User  | Role       | Scope | Scope ID |
| ----- | ---------- | ----- | -------- |
| Alice | org_owner  | org   | org-123  |
| Bob   | org_member | org   | org-123  |

At this point, we can describe permissions... but we still haven't created anything the database can enforce safely.

### 8. `user_effective_permissions` (THE KEY TABLE)

**Question it answers:** What is this user actually allowed to do, right now, in this org?

| user_id | organization_id | permission_slug |
| ------- | --------------- | --------------- |
| Alice   | org-123         | org.read        |
| Alice   | org-123         | org.update      |
| Alice   | org-123         | members.manage  |
| Bob     | org-123         | org.read        |
| Bob     | org-123         | members.read    |
| Bob     | org-123         | self.update     |

**IMPORTANT RULE:** This table contains only explicit facts.

No:

- wildcards
- roles
- overrides
- logic

Just: "User X is allowed to do Y in org Z"

### 9. `user_permission_overrides` (Optional - Admin UX)

**Question it answers:** Does this specific user have a one-off grant or revoke?

| user_id | organization_id | permission_slug | effect |
| ------- | --------------- | --------------- | ------ |
| Bob     | org-123         | members.manage  | grant  |
| Charlie | org-123         | branches.delete | revoke |

**CRITICAL:** This table is an INPUT to compilation, not something evaluated at runtime.

---

## The Compiler (How Permissions Are Created)

This happens on the backend, not in the database.

### When Does It Run?

- User creates an organization
- User accepts an invite
- Role assignment changes
- Role permissions change
- Override is added/removed

### Compiler Process (Plain English)

Let's say: User Bob joins Org X as `org_member`

**Step by step:**

1. Backend looks up: roles assigned to User Bob in Org X
2. For each role: find its permissions
3. Apply overrides:
   - For each `grant` override: add to set
   - For each `revoke` override: remove from set
4. Delete old rows for (Bob, Org X) from `user_effective_permissions`
5. Insert new rows into `user_effective_permissions`

That's it.

**No decisions at request time. Everything is decided once, stored, and reused.**

---

## Frontend Flow

### Step 1 - User logs in

Supabase gives you: `auth.uid() = user_id`

### Step 2 - User selects/has an active organization

Frontend knows: `activeOrgId`

### Step 3 - Frontend fetches effective permissions

```typescript
const permissions = await fetchEffectivePermissions(userId, orgId);
// Returns: Set<string> { "org.read", "members.read", "self.update" }
```

### Frontend Permission Checks (Simple)

```typescript
if (permissions.has("members.manage")) {
  showInviteButton();
}
```

That's it. No wildcards. No precedence. No ambiguity.

---

## Backend Enforcement (RLS)

When frontend requests: "Give me the list of members"

### Layer 1: Membership Check (Tenant Boundary)

Database checks: "Is this user an active member of this org?"
If no → request fails immediately.

### Layer 2: Permission Check (Action)

For reads: membership might be enough
For writes: database checks `user_effective_permissions`

Example RLS logic:

```sql
-- Can user read members?
EXISTS (
  SELECT 1 FROM organization_members
  WHERE user_id = auth.uid()
  AND organization_id = target_org_id
  AND status = 'active'
)

-- Can user manage members?
EXISTS (
  SELECT 1 FROM user_effective_permissions
  WHERE user_id = auth.uid()
  AND organization_id = target_org_id
  AND permission_slug = 'members.manage'
)
```

**This happens inside the database, not in JS.**

---

## Why This Is Safe

### Bad (what we had before)

"If wildcard matches unless denied unless overridden unless scope..."

- Logic split across frontend, backend, database
- Hard to debug
- Hard to trust

### Good (this model)

"Does a row exist?"

- Same check everywhere
- Easy to inspect
- Easy to explain
- Easy to extend

---

## Debugging Access (The Real Test)

"Why can't user X do Y in org Z?"

```sql
SELECT * FROM user_effective_permissions
WHERE user_id = 'user-X'
AND organization_id = 'org-Z';
```

You immediately see if the permission exists. That's it.

---

## V1 Permissions (Start Small)

We start with only these categories:

### Organization

- `org.read` - View organization info
- `org.update` - Update organization settings

### Branches

- `branches.read` - View branches
- `branches.create` - Create new branches
- `branches.update` - Update branch info
- `branches.delete` - Delete branches

### Members

- `members.read` - View member list
- `members.manage` - Invite, remove, change roles

### Self

- `self.read` - View own profile
- `self.update` - Update own profile

### Invites

- `invites.create` - Send invitations
- `invites.read` - View pending invites
- `invites.cancel` - Cancel pending invites

---

## V1 Roles

### `org_owner`

Has ALL permissions:

- org.read, org.update
- branches.read, branches.create, branches.update, branches.delete
- members.read, members.manage
- self.read, self.update
- invites.create, invites.read, invites.cancel

### `org_member`

Limited permissions:

- org.read
- branches.read
- members.read
- self.read, self.update

---

## Wildcards (Authoring Convenience Only)

Wildcards are allowed in:

1. **Role authoring / admin UX** - org owner assigns `warehouse.*` rather than 50 individual permissions
2. **Compiler inputs** - compiler expands `warehouse.*` into explicit grants

**After compilation, enforcement is exact and explicit.**

The compiler expands:

- `warehouse.*` → `warehouse.products.read`, `warehouse.products.create`, etc.

RLS never sees wildcards.

---

## Override Examples

### Grant Override

"Bob is org_member, but can also manage members"

| user_id | organization_id | permission_slug | effect |
| ------- | --------------- | --------------- | ------ |
| Bob     | org-123         | members.manage  | grant  |

Compiler result: Bob gets `members.manage` in addition to his role permissions.

### Revoke Override

"Charlie is org_owner, but cannot delete branches"

| user_id | organization_id | permission_slug | effect |
| ------- | --------------- | --------------- | ------ |
| Charlie | org-123         | branches.delete | revoke |

Compiler result: Charlie gets all org_owner permissions EXCEPT `branches.delete`.

---

## Summary

| Layer                        | Responsibility                         |
| ---------------------------- | -------------------------------------- |
| `auth.users`                 | Identity (who are you?)                |
| `organization_members`       | Membership (are you in this org?)      |
| `roles` + `role_permissions` | Intent (what should roles allow?)      |
| `user_role_assignments`      | Assignment (what role does user have?) |
| `user_permission_overrides`  | Exceptions (one-off changes)           |
| **Compiler**                 | Turns intent into facts                |
| `user_effective_permissions` | Facts (what can user actually do?)     |
| **RLS**                      | Enforcement (check facts)              |
| **Frontend**                 | UI gating (show/hide based on facts)   |

**The golden rule:**

> Roles + overrides describe intent.
> The compiler turns intent into facts.
> Facts are enforced everywhere.
