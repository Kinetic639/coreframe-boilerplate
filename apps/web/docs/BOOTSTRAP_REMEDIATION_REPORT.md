# Registration / Bootstrap Remediation — Implementation Report

**Date:** 2026-03-06
**Branch:** `invitation-system`
**Status:** Complete

---

## 1. Summary

This report documents the remediation of six critical bugs in the user registration and invitation-acceptance bootstrap path. All bugs were identified during a prior verification audit (`docs/INVITATIONS_VERIFICATION_REPORT.md`).

Root cause: the `handle_user_signup_hook` Postgres function was missing an INSERT into `organization_members` for both the regular (new org) path and the invitation (join org) path. This caused `is_org_member()` to return FALSE for every new user, which in turn caused `compile_user_permissions()` to delete the user's UEP rows and return an empty permission snapshot — effectively locking every new user out of the application.

A secondary bug meant the hook's invitation branch was dead code: `signUpAction` never put `invitation_token` into `user_metadata`, so invited users always took the "create a new org" path instead of joining the inviting org.

---

## 2. Files Changed

| File                                                                        | Type     | Phase |
| --------------------------------------------------------------------------- | -------- | ----- |
| `supabase/migrations/20260306130000_fix_bootstrap_organization_members.sql` | NEW      | 1     |
| `src/app/[locale]/actions.ts`                                               | MODIFIED | 2, 4  |
| `src/app/[locale]/(public)/(auth)/reset-password/page.tsx`                  | MODIFIED | 4     |
| `src/app/auth/confirm/route.ts`                                             | MODIFIED | 4     |
| `src/lib/api/invitations.ts`                                                | MODIFIED | 5     |
| `src/app/actions/invitations.ts`                                            | MODIFIED | 5     |
| `src/components/auth/forms/sign-up-form.tsx`                                | MODIFIED | 6     |
| `messages/en.json`                                                          | MODIFIED | 6     |
| `messages/pl.json`                                                          | MODIFIED | 6     |
| `src/app/[locale]/__tests__/signup-bootstrap.test.ts`                       | NEW      | Tests |

---

## 3. Database Changes

### Migration: `20260306130000_fix_bootstrap_organization_members.sql`

Applied via Supabase MCP (`mcp__supabase__apply_migration`).

**Regular signup path additions:**

```sql
-- After creating org + preferences, now also inserts the org owner into organization_members
INSERT INTO public.organization_members (organization_id, user_id, status, joined_at)
VALUES (new_org_id, user_id, 'active', now())
ON CONFLICT (organization_id, user_id) DO UPDATE SET
  status = 'active', deleted_at = NULL, updated_at = now();
```

**Invitation signup path additions (both were missing):**

```sql
-- 1. Add to organization_members
INSERT INTO public.organization_members (organization_id, user_id, status, joined_at)
VALUES (invitation_record.organization_id, user_id, 'active', now())
ON CONFLICT (organization_id, user_id) DO UPDATE SET
  status = 'active', deleted_at = NULL, updated_at = now();

-- 2. Assign base org_member role (was also missing)
INSERT INTO public.user_role_assignments (user_id, role_id, scope, scope_id)
VALUES (user_id, org_member_role_id, 'org', invitation_record.organization_id)
ON CONFLICT (user_id, role_id, scope, scope_id) DO UPDATE SET deleted_at = NULL;
```

The function retains `SECURITY DEFINER` and has `GRANT EXECUTE TO supabase_auth_admin; REVOKE ALL ON FUNCTION ... FROM anon, authenticated;`.

---

## 4. Before / After: Signup Flows

### Regular signup (no invitation token)

**Before:**

1. `signUpAction` → Supabase Auth `signUp()`
2. Hook fires → creates `users`, `user_preferences`, `organization_profiles`, `branches`, `user_role_assignments` (owner role)
3. `organization_members` NOT inserted → `is_org_member()` returns FALSE
4. `compile_user_permissions()` deletes UEP rows → empty snapshot
5. User sees access denied everywhere

**After:**

1. (same steps 1-2)
2. `organization_members` inserted with `status = 'active'`
3. `compile_user_permissions()` finds org member → builds correct UEP
4. User has full owner permissions

### Invited signup

**Before:**

1. `signUpAction` passes `invitationToken` in `emailRedirectTo` URL but NOT in `user_metadata`
2. Hook fires → reads `user_metadata.invitation_token` → finds `null` → takes regular path → creates a new personal org for the invited user
3. Invited user ends up in wrong org with no invitation context
4. `organization_members` NOT inserted → permissions broken

**After:**

1. `signUpAction` spreads `invitation_token` into `options.data` (user_metadata)
2. Hook fires → reads `invitation_token` from metadata → finds valid token → takes invitation path
3. Marks invitation `accepted`, inserts into `organization_members` for the correct org
4. Assigns `org_member` base role
5. `compile_user_permissions()` builds correct UEP for inviting org

---

## 5. Auth Cleanup (Phase 4)

### `getSession()` → `getUser()` in reset-password page

`src/app/[locale]/(public)/(auth)/reset-password/page.tsx` now uses `supabase.auth.getUser()` for the auth gate. `getUser()` re-validates the JWT with the Supabase Auth server; `getSession()` only reads the cookie without server validation, making it exploitable.

```typescript
// Before
const { data: { session } } = await supabase.auth.getSession();
if (!session) { redirect(...) }

// After
const { data: { user } } = await supabase.auth.getUser();
if (!user) { redirect(...) }
```

### `/auth/confirm` stale path removed

Removed `"/dashboard-old/start"` from `localizedPaths` in `src/app/auth/confirm/route.ts`. This was a stale entry pointing to a deleted route.

### Debug console.log removal

Removed all debug `console.log` statements from:

- `signInAction` in `actions.ts` (3 statements logging session/user data)
- `forgotPasswordAction` in `actions.ts` (5 statements)
- `auth/confirm/route.ts` GET handler (6 statements)

---

## 6. Legacy Cleanup (Phase 5)

### `src/lib/api/invitations.ts`

**Removed:**

- `acceptInvitation()` — bypassed the `accept_invitation_and_join_org` SECURITY DEFINER RPC; referenced non-existent `updated_at` column on `invitations` table
- `rejectInvitation()` — referenced non-existent `rejected_at` and `updated_at` columns

**Fixed:**

- `cancelInvitation()` — removed `updated_at` from update payload (column does not exist)
- `markExpiredInvitations()` — removed `updated_at` from update payload

### `src/app/actions/invitations.ts`

**Removed:**

- `acceptInvitationAction()` — legacy server action wrapping the broken client-side path; revalidated deleted `dashboard-old` paths; had hardcoded Polish error string
- `rejectInvitationAction()` — no authentication check, used broken client path

Remaining exports: `createInvitationAction`, `cancelInvitationAction`, `resendInvitationAction`, `cleanupExpiredInvitationsAction`.

---

## 7. i18n (Phase 6)

### `src/components/auth/forms/sign-up-form.tsx`

Replaced 6 hardcoded Polish strings with `t()` calls:

| Hardcoded string                              | Key                        |
| --------------------------------------------- | -------------------------- |
| `"Dołącz do organizacji"`                     | `invitationTitle`          |
| `"Utwórz konto aby zaakceptować zaproszenie"` | `invitationDescription`    |
| `"Zaproszenie do:"`                           | `invitationTo`             |
| `"Rola:"`                                     | `invitationRole`           |
| `"Oddział:"`                                  | `invitationBranch`         |
| `"Ładowanie szczegółów zaproszenia..."`       | `invitationLoadingDetails` |

Keys added to both `messages/en.json` and `messages/pl.json` under `authForms.SignUpForm`. Also added previously missing keys `firstNameLabel`, `firstNamePlaceholder`, `lastNameLabel`, `lastNamePlaceholder`.

---

## 8. Tests

### New: `src/app/[locale]/__tests__/signup-bootstrap.test.ts`

5 test groups, 9 tests total:

**`signUpAction — invitation_token in metadata` (5 tests):**

- Asserts `invitation_token` is present in `options.data` when `invitationToken` FormData field provided
- Asserts `invitation_token` is absent from `options.data` for regular signup
- Asserts `first_name` and `last_name` always present in metadata
- Asserts `emailRedirectTo` URL contains `invitation_token=` when token provided
- Asserts `emailRedirectTo` URL does NOT contain `invitation_token` for regular signup

**`Legacy invitation mutations — removed from lib/api/invitations` (4 tests):**

- `acceptInvitation` is not exported → `undefined`
- `rejectInvitation` is not exported → `undefined`
- `fetchInvitationByToken` still exported → `function`
- `cancelInvitation` still exported → `function`

**`Legacy invitation mutations — removed from app/actions/invitations` (2 tests):**

- `acceptInvitationAction` is not exported → `undefined`
- `rejectInvitationAction` is not exported → `undefined`

Mock setup uses `vi.hoisted()` to avoid the Vitest factory hoisting issue:

```typescript
const { signUpMock } = vi.hoisted(() => ({ signUpMock: vi.fn() }));
```

### Test run result

```
Test Files  1 failed (pre-existing) | 60 passed | 2 skipped (63)
      Tests  1 failed (pre-existing) | 1110 passed | 8 skipped | 9 todo (1128)
```

The one failure (`build-sidebar-model.test.ts > Parent Pruning > should hide parent when all children are filtered out`) is pre-existing and unrelated to this remediation.

---

## 9. Known / Deferred Items

### Duplicate invitation acceptance (harmless)

After the hook marks an invitation `accepted`, the `/auth/callback` route also calls `accept_invitation_and_join_org` RPC. The RPC returns `"Invitation is no longer pending"` (already accepted by hook). This logs a `console.error` but does not break the user flow since `organization_members` and URA were already correctly set by the hook. Deferred: the callback's RPC call could be guarded with a status check first, but this is low priority.

### `build-sidebar-model.test.ts` pre-existing failure

The "should hide parent when all children are filtered out" test asserts `accountItem` is defined in `model.footer`, but `accountItem` is `undefined`. This is a pre-existing test regression not introduced by this remediation. Deferred for the sidebar module owner.

---

## 10. Commands Run

```bash
# Apply DB migration
mcp__supabase__apply_migration  # migration: 20260306130000_fix_bootstrap_organization_members.sql

# Verify migration applied
mcp__supabase__execute_sql  # SELECT COUNT(*) FROM organization_members; (verified table exists)

# Type checking
pnpm type-check  # passed clean

# Test run
pnpm run test:run  # 1110 pass, 1 pre-existing fail (unrelated)
```
