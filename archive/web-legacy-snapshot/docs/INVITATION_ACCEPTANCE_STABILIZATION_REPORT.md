# Invitation Acceptance Stabilization Report

**Branch:** invitation-system
**Date:** 2026-03-09
**Migration:** `20260309110000_stabilize_invitation_acceptance.sql`

---

## 1. Summary of Bug Fixed

Valid invite acceptance was failing with `INTERNAL_ERROR` in `accept_invitation_and_join_org`. After acceptance, even when it worked, users landed in the wrong org context. This migration makes baseline acceptance — joining an org as `org_member` — reliable for all user states.

---

## 2. Exact Root Cause of INTERNAL_ERROR

**Primary root cause: Foreign key violation on `organization_members.user_id → public.users(id)`**

The acceptance function inserted directly into `organization_members`. That table's FK references `public.users(id)`, **not** `auth.users(id)`.

Users whose signup hook failed silently (due to the branch-role scope bug fixed in `20260309100000`) have a valid `auth.users` row but **no `public.users` row**. When acceptance attempted `INSERT INTO organization_members`, PostgreSQL raised:

```
ERROR: insert or update on table "organization_members" violates foreign key constraint
"organization_members_user_id_fkey"
DETAIL: Key (user_id)=(xxx) is not present in table "users".
```

This was caught by `EXCEPTION WHEN OTHERS` and returned as `INTERNAL_ERROR`.

**Secondary root cause: `user_preferences` not updated after acceptance**

The function never updated `user_preferences.organization_id`, so users landed in their pre-accept org context instead of the invited org.

**Tertiary issue: Hardcoded `org_member` UUID**

The UUID `fc5d6871-e442-4e49-94bd-4668b3dde4f7` was hardcoded. If the role is ever re-seeded or migrated, the function would silently fail.

### Trigger chain verified — not the cause

All trigger functions (`trigger_compile_on_membership`, `trigger_compile_on_role_assignment`) are `SECURITY DEFINER` owned by `postgres`. All are `SET search_path TO ''` with fully-qualified references. The `compile_user_permissions` function is similarly hardened. No trigger path caused the INTERNAL_ERROR.

### RLS verified — not the cause

All tables used in the accept path (`organization_members`, `user_role_assignments`, `invitations`, `user_preferences`) have RLS enabled. The function runs as `postgres` (superuser, `BYPASSRLS`), so RLS is bypassed throughout.

### FK chain in full

```
auth.users
  └── public.users (id FK → auth.users.id)
        ├── organization_members (user_id FK → public.users.id)  ← violation point
        └── user_preferences     (user_id FK → public.users.id)  ← would also fail
```

---

## 3. Files Changed

| File                                                                     | Change                                |
| ------------------------------------------------------------------------ | ------------------------------------- |
| `supabase/migrations/20260309110000_stabilize_invitation_acceptance.sql` | NEW — replaces accept RPC             |
| `src/app/actions/organization/__tests__/invite-lifecycle.test.ts`        | 10 new `acceptInvitationAction` tests |
| `src/server/services/__tests__/organization-invitations.test.ts`         | 3 new stabilized-path service tests   |

---

## 4. DB Changes

**Function replaced:** `public.accept_invitation_and_join_org(p_token text)`

No schema changes (no new tables, columns, or constraints).

---

## 5. Before vs After Acceptance Flow

### Before (broken)

```
auth.uid() → OK
auth.users email lookup → OK
invitations lookup → OK
validate pending/expiry/email → OK
INSERT organization_members → FK VIOLATION (no public.users row)
                           → EXCEPTION WHEN OTHERS → INTERNAL_ERROR
```

### After (stabilized)

```
auth.uid() → OK
auth.users email lookup → OK
SELECT org_member role by name → dynamic, no UUID hardcoding
invitations lookup + FOR UPDATE → OK
validate pending/expiry/email → OK
UPSERT public.users (id, email) ON CONFLICT DO NOTHING → ensures row exists
INSERT organization_members ON CONFLICT DO UPDATE → OK
INSERT user_role_assignments (org_member, scope=org) → OK
UPSERT user_preferences (organization_id = invited org) → sets active org context
UPDATE invitations SET status=accepted → OK
RETURN { success: true, organization_id }
```

---

## 6. org_member Assignment Behavior

| Aspect            | Behavior                                                                      |
| ----------------- | ----------------------------------------------------------------------------- |
| Role resolved     | By name: `WHERE name='org_member' AND is_basic=true AND deleted_at IS NULL`   |
| Scope assigned    | `'org'` with `scope_id = invitation.organization_id`                          |
| Conflict handling | `ON CONFLICT DO UPDATE SET deleted_at = NULL` (reactivates soft-deleted rows) |
| Invited role_id   | **Not assigned** (intentionally deferred — see Section 9)                     |
| Branch roles      | **Not assigned** (intentionally deferred)                                     |

---

## 7. Post-Accept Routing / Context Behavior

The function now UPSERTs `user_preferences`:

```sql
INSERT INTO public.user_preferences (user_id, organization_id, created_at)
  VALUES (v_current_user_id, v_invitation.organization_id, now())
  ON CONFLICT (user_id) DO UPDATE
    SET organization_id   = v_invitation.organization_id,
        default_branch_id = NULL,
        last_branch_id    = NULL,
        updated_at        = now();
```

- **New users** (no preferences row): preferences created with invited org as active org.
- **Existing users** (switching orgs): `organization_id` updated to invited org; branch IDs nulled so `loadDashboardContextV2` picks the first available branch in the new org.
- **Client routing**: `acceptInvitationAction` returns `organization_id`. Client routes to `/dashboard/start`, which SSR-loads context from updated `user_preferences`. User lands in invited org. No extra client-side context switching needed.

---

## 8. Tests Added / Updated

### `src/app/actions/organization/__tests__/invite-lifecycle.test.ts`

New describe: `"acceptInvitationAction"` — 10 tests:

| Test                                      | Covers                                 |
| ----------------------------------------- | -------------------------------------- |
| Returns success with organization_id      | Happy path                             |
| Surfaces INTERNAL_ERROR                   | Broken-hook users, FK violations       |
| Surfaces NOT_AUTHENTICATED                | Unauthenticated callers                |
| Surfaces INVITE_NOT_PENDING               | Already accepted/declined/cancelled    |
| Surfaces INVITE_EXPIRED                   | Past-expiry invites                    |
| Surfaces EMAIL_MISMATCH                   | Wrong signed-in email                  |
| Surfaces INVITE_NOT_FOUND                 | Invalid token                          |
| Handles network errors                    | RPC throws exception                   |
| Returns error when organization_id absent | Defensive guard                        |
| organization_id returned for routing      | Documents post-accept routing contract |

### `src/server/services/__tests__/organization-invitations.test.ts`

New describe: `"OrgInvitationsService.acceptInvitation — stabilized org_member-only path"` — 3 tests:

| Test                                        | Covers                                         |
| ------------------------------------------- | ---------------------------------------------- |
| RPC called with only p_token                | Stabilization: no role_id, no branch_id passed |
| organization_id returned for client routing | Post-accept routing                            |
| INTERNAL_ERROR surfaced from RPC            | Documents the pre-fix failure mode             |

**Test totals:** 1144 → 1157 passing (+13).

---

## 9. Deferred Items

| Item                          | Reason                                                                                                    |
| ----------------------------- | --------------------------------------------------------------------------------------------------------- |
| Invited `role_id` assignment  | Deferred until baseline stable. The `invite.role_id` block was removed from the accept RPC in this phase. |
| Branch-scoped role assignment | Deferred. Requires branch context and scope validation.                                                   |
| Admin invite UI role selector | Out of scope for this phase. UI only has email input.                                                     |
| Multi-role invites            | Future feature.                                                                                           |

When role assignment is re-added, it should follow the same scope-type guard pattern used in `handle_user_signup_hook` (migration `20260309100000`):

- Org roles: `INSERT WHERE scope_type IN ('org', 'both')`
- Branch roles: `INSERT WHERE scope_type IN ('branch', 'both') AND branch_id IS NOT NULL`

---

## 10. Commands Run

```sql
-- Root cause verification
SELECT pg_get_functiondef(oid) FROM pg_proc WHERE proname = 'accept_invitation_and_join_org';
SELECT conname, pg_get_constraintdef(oid) FROM pg_constraint WHERE conrelid = 'public.organization_members'::regclass;
SELECT conname, pg_get_constraintdef(oid) FROM pg_constraint WHERE conrelid = 'public.user_preferences'::regclass;
SELECT conname, pg_get_constraintdef(oid) FROM pg_constraint WHERE conrelid = 'public.users'::regclass;
SELECT column_name, is_nullable FROM information_schema.columns WHERE table_name = 'users';
SELECT proname, prosecdef, proowner::regrole FROM pg_proc WHERE proname IN (...);
SELECT policyname, cmd, with_check FROM pg_policies WHERE tablename = 'invitations' AND cmd = 'UPDATE';
-- Trigger inspection
SELECT proconfig, pg_get_functiondef FROM pg_proc WHERE proname IN ('trigger_compile_on_membership', 'trigger_compile_on_role_assignment');
```

```bash
pnpm run test:run   # 1157 passed
```
