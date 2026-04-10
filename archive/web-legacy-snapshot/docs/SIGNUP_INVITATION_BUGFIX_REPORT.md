# Signup + Invitation Bug Fix Report

**Branch:** invitation-system
**Date:** 2026-03-09
**Migration:** `20260309100000_fix_signup_hook_scope_check.sql`

---

## Phase 1 — Signup Confirmation Email UX

### Problem

`signUpAction` returned the same `signUpSuccess` message regardless of context:

> "Thanks for signing up! Please check your email for a verification link. **Your organization has been created automatically.**"

Two issues:

1. **False claim** — for invited users, no new organization is created. For regular users, org creation happens in the auth hook which can fail silently. The message was never accurate.
2. **Already-registered emails** — Supabase returns `{ data: { user: { identities: [] } }, error: null }` for existing emails (enumeration protection). The app showed the same success message, giving no actionable feedback.

### Fix

**`src/app/[locale]/actions.ts`**

- Added `identities.length === 0` check after `signUp()`. Returns `errors.emailAlreadyRegistered` error.
- Split success into two distinct messages: `success.signUpSuccess` (regular) and `success.signUpSuccessInvited` (with invitation token).

**`messages/en.json` + `messages/pl.json`**

- `signUpSuccess`: Removed false org-creation claim. Now: "Thanks for signing up! Please check your email for a verification link."
- Added `signUpSuccessInvited`: "Account created! Please confirm your email, then return to your invitation link to complete joining."
- Added `errors.emailAlreadyRegistered`: "An account with this email already exists. Please sign in."

---

## Phase 2 — Accept Invite INTERNAL_ERROR Root Cause

### Investigation

Queried the live DB to verify:

| Question                                   | Finding                                                                                                   |
| ------------------------------------------ | --------------------------------------------------------------------------------------------------------- |
| Hardcoded `v_org_member_role_id` exists?   | ✓ `fc5d6871...` = `org_member` (scope_type='org')                                                         |
| `roles.scope_type` allowed values?         | `'org'`, `'branch'` (no 'both' in use)                                                                    |
| Triggers that can throw during acceptance? | `check_role_assignment_scope` (BEFORE INSERT OR UPDATE) — raises exception if scope mismatches scope_type |
| INTERNAL_ERROR root cause?                 | See below                                                                                                 |

### Root Cause: `handle_user_signup_hook` — Silent Transaction Rollback

The auth hook (`handle_user_signup_hook`) had a bug in its invitation path:

```sql
-- BUGGY (before fix):
INSERT INTO public.user_role_assignments (user_id, role_id, scope, scope_id)
VALUES (user_id, invitation_record.role_id, 'org', invitation_record.organization_id)
ON CONFLICT ... DO UPDATE SET deleted_at = NULL;
-- ^ No scope_type check! If role is scope_type='branch', the validate_role_assignment_scope
--   trigger raises: RAISE EXCEPTION 'Role % can only be assigned at branch scope'
```

**Consequence:** The `EXCEPTION WHEN others` handler at the function level caught this exception and returned `event` (success), but PL/pgSQL's implicit savepoint mechanism rolled back **all** DB changes made since the exception block began, including:

- `public.users` INSERT
- `user_preferences` INSERT
- `organization_members` INSERT
- `org_member` role assignment INSERT

The invitation remained `pending` (the `UPDATE` to `accepted` was also rolled back). The user existed in `auth.users` but had no `public.users` row, no org membership, and no role assignments.

**Effect on subsequent manual acceptance:** `accept_invitation_and_join_org` itself was already fixed (migration `20260308100000`) to check `scope_type IN ('org', 'both')` before inserting the invited role. So manual acceptance via the invite page would succeed. But users who signed up via invite link and had a branch-scoped role were left in a broken state requiring a re-accept.

**Why INTERNAL_ERROR appeared historically:** The original `accept_invitation_and_join_org` (before hardening, `20260306120000`) did NOT check `scope_type`, so it also attempted `scope='org'` for branch roles, triggering the same validator → exception caught → `SQLERRM` returned as `INTERNAL_ERROR`. The hardening migration fixed this in the accept RPC; this migration fixes the root source (the hook).

### Fix

**`supabase/migrations/20260309100000_fix_signup_hook_scope_check.sql`**

Replaced the two separate role-assignment blocks with a single scope-aware block:

```sql
IF invitation_record.role_id IS NOT NULL
   AND invitation_record.role_id != org_member_role_id
THEN
  -- Org-scope only if role allows it
  IF EXISTS (SELECT 1 FROM public.roles
             WHERE id = invitation_record.role_id
               AND scope_type IN ('org', 'both') AND deleted_at IS NULL) THEN
    INSERT INTO public.user_role_assignments ... VALUES (..., 'org', org_id)
    ON CONFLICT ... DO UPDATE SET deleted_at = NULL;
  END IF;

  -- Branch-scope only if role allows it and branch was specified
  IF invitation_record.branch_id IS NOT NULL AND EXISTS (
    SELECT 1 FROM public.roles
    WHERE id = invitation_record.role_id
      AND scope_type IN ('branch', 'both') AND deleted_at IS NULL
  ) THEN
    INSERT INTO public.user_role_assignments ... VALUES (..., 'branch', branch_id)
    ON CONFLICT ... DO UPDATE SET deleted_at = NULL;
  END IF;
END IF;
```

---

## Phase 3 — Decline Flow State Persistence

### Status: Already Correct

After migration `20260308100000_harden_invitation_rpcs.sql`:

- `declined_at TIMESTAMPTZ` column added to `invitations` ✓
- `decline_invitation` RPC sets `declined_at = now()` and `status = 'declined'` ✓
- `get_invitation_preview_by_token` returns `INVITE_NOT_PENDING` for declined invites ✓
- `invite-page-client.tsx` routes to `/onboarding` only on `result.success === true` ✓
- `OrgInvitation` interface includes `declined_at: string | null` ✓

No additional changes needed.

---

## Phase 4 — Admin Invite UI Reality

### Audit Finding

The admin invite UI (`InvitationsClient`) only exposes an email input. The `createInvitationAction` backend accepts `role_id` and `branch_id` fields (validated via `createInviteSchema`), but the UI does not pass them.

**This is intentional for the current scope.** Invitations without a specific role will use the default `org_member` role when accepted via `accept_invitation_and_join_org`.

**There is no role selector in the admin invite form.** The schema supports it, but the UI feature has not been built. When/if a role selector is added, the form just needs to include `role_id` in the `createInvitationAction` call.

---

## Phase 5 — Tests Added

**`src/app/[locale]/__tests__/signup-bootstrap.test.ts`** — 4 new tests in `"signUpAction — UX message differentiation"` describe:

| Test                                  | Asserts                                                       |
| ------------------------------------- | ------------------------------------------------------------- |
| Regular signup success                | Redirect contains `success=`, does NOT mention "organization" |
| Invited signup success                | Redirect contains `success=signUpSuccessInvited`              |
| Already-registered (empty identities) | Redirect contains `error=emailAlreadyRegistered`              |
| Already-registered (null identities)  | Redirect contains `error=`                                    |

---

## Summary of Changes

| File                                                                 | Change                                                                         |
| -------------------------------------------------------------------- | ------------------------------------------------------------------------------ |
| `supabase/migrations/20260309100000_fix_signup_hook_scope_check.sql` | NEW — fixes hook scope bug                                                     |
| `src/app/[locale]/actions.ts`                                        | Already-registered detection + split success messages                          |
| `messages/en.json`                                                   | Fixed `signUpSuccess`, added `signUpSuccessInvited` + `emailAlreadyRegistered` |
| `messages/pl.json`                                                   | Same as en.json in Polish                                                      |
| `src/app/[locale]/__tests__/signup-bootstrap.test.ts`                | 4 new UX message tests                                                         |
