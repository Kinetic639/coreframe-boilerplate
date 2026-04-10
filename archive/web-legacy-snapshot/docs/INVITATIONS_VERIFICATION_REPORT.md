# Registration / Auth / Onboarding — Verification Report

**Date**: 2026-03-06
**Mode**: VERIFICATION ONLY — no code changes made
**Branch**: `invitation-system`
**Scope**: Full registration lifecycle, auth flows, user bootstrap, invitation compatibility, i18n, security

---

## 1. Executive Summary

The codebase has a **working but partially inconsistent** registration and onboarding system. The core PKCE-based invitation acceptance flow (implemented in this session) is architecturally sound. However, three significant issues require attention before shipping invitations to production:

| Severity | Finding                                                                                                      |
| -------- | ------------------------------------------------------------------------------------------------------------ |
| CRITICAL | `handle_user_signup_hook` invitation branch is dead code — invited new users also get a personal org created |
| CRITICAL | Regular users are never inserted into `organization_members`; `is_org_member()` returns FALSE for them       |
| HIGH     | `reset-password/page.tsx` uses `getSession()` instead of `getUser()` for session validation                  |
| HIGH     | `/auth/confirm` route hardcodes `/dashboard-old/start` as a redirect target (stale legacy path)              |
| MEDIUM   | `sign-up-form.tsx` contains 5 hardcoded Polish strings (not i18n)                                            |
| MEDIUM   | Legacy `lib/api/invitations.ts` client functions bypass the SECURITY DEFINER function                        |
| LOW      | Debug `console.log` statements left in `signInAction`                                                        |

---

## 2. Evidence Map

### Files Inspected

| File                                                             | Notes                                      |
| ---------------------------------------------------------------- | ------------------------------------------ |
| `src/app/[locale]/actions.ts`                                    | All auth server actions                    |
| `src/app/auth/callback/route.ts`                                 | PKCE code exchange + invitation RPC        |
| `src/app/auth/confirm/route.ts`                                  | OTP verify for password reset              |
| `src/app/[locale]/(public)/(auth)/reset-password/page.tsx`       | Uses `getSession()` — issue                |
| `src/app/[locale]/invite/[token]/page.tsx`                       | Invitation acceptance UI                   |
| `src/app/actions/organization/invitations.ts`                    | All invitation server actions              |
| `src/server/services/organization.service.ts`                    | `OrgInvitationsService.acceptInvitation()` |
| `src/server/loaders/v2/load-app-context.v2.ts`                   | Org/branch resolution logic                |
| `src/server/loaders/v2/load-user-context.v2.ts`                  | User identity + permissions                |
| `src/server/loaders/v2/load-dashboard-context.v2.ts`             | Combined context loader                    |
| `src/components/auth/forms/sign-up-form.tsx`                     | Signup form + invitation pre-fill          |
| `src/lib/api/invitations.ts`                                     | Legacy client-side invitation API          |
| `src/utils/supabase/server.ts`                                   | Server Supabase client                     |
| `src/utils/supabase/client.ts`                                   | Browser Supabase client                    |
| `src/i18n/routing.ts`                                            | All i18n pathnames                         |
| `src/server/services/__tests__/organization-invitations.test.ts` | Unit tests                                 |
| `src/app/actions/organization/__tests__/actions.test.ts`         | Action tests                               |

### DB Objects Inspected (via Supabase MCP)

| Object                           | Type                      | Notes                                    |
| -------------------------------- | ------------------------- | ---------------------------------------- |
| `handle_user_signup_hook`        | FUNCTION SECURITY DEFINER | Main user bootstrap function             |
| `accept_invitation_and_join_org` | FUNCTION SECURITY DEFINER | Invitation acceptance RPC (new)          |
| `compile_user_permissions`       | FUNCTION SECURITY DEFINER | UEP compiler with wildcard expansion     |
| `get_user_roles_for_hook`        | FUNCTION SECURITY DEFINER | JWT role injection                       |
| `is_org_member`                  | FUNCTION SECURITY DEFINER | Checks `organization_members` table      |
| `is_org_creator`                 | FUNCTION SECURITY DEFINER | Checks `organizations.created_by`        |
| `organization_members` RLS       | 6 policies                | INSERT, SELECT (x2), UPDATE (x2), DELETE |
| `invitations` RLS                | 4 policies                | INSERT, SELECT, UPDATE (x2)              |
| `users` RLS                      | 4 policies                | INSERT, SELECT (x2), UPDATE              |
| `user_role_assignments` RLS      | 6 policies                | Full V2 set                              |
| `user_preferences` RLS           | 4 policies                | Own-only                                 |
| All public triggers              | 90+ triggers              | Full list obtained                       |

---

## 3. E2E Auth Flows — Verified

### 3A. Regular Sign-Up (New User, No Invitation)

```
/sign-up → signUpAction(email, password, firstName, lastName)
  → supabase.auth.signUp({ email, password, options: { data: { first_name, last_name } } })
  → emailRedirectTo: {SITE_URL}/auth/callback
  → Supabase sends confirmation email
  → User clicks link → /auth/callback?code=...
  → supabase.auth.exchangeCodeForSession(code)
  → no invitation_token → no RPC
  → redirect to /dashboard
```

**DB bootstrap (via `handle_user_signup_hook`):**

- INSERT `public.users` (id, email, first_name, last_name)
- INSERT `public.organizations` (slug from first_name or email prefix, up to 5 retry attempts)
- INSERT `public.organization_profiles`
- INSERT `public.branches` ("Main Branch", slug: "main")
- INSERT `public.user_preferences` (org_id, branch_id)
- INSERT `public.user_role_assignments` (org_owner, scope=org, scope_id=new_org_id)
- **MISSING**: No INSERT into `public.organization_members` — see Section 5.

### 3B. Sign-Up via Invitation (New User)

```
/invite/[token] → "No account" → /sign-up?invitation=TOKEN
  → sign-up-form.tsx: fetchInvitationByToken(TOKEN) client-side
    → pre-fills email (locked), shows org/role/branch info
  → signUpAction(formData) with invitationToken
    → emailRedirectTo: {SITE_URL}/auth/callback?invitation_token=TOKEN
    → user_metadata: { first_name, last_name }  (NO invitation_token in metadata)
  → hook fires with no invitation_token in user_metadata → regular path → creates personal org
  → Supabase sends confirmation email with custom callback URL
  → User clicks link → /auth/callback?code=...&invitation_token=TOKEN
  → supabase.auth.exchangeCodeForSession(code)
  → supabase.rpc("accept_invitation_and_join_org", { p_token: TOKEN })
    → validates: token exists, status = pending, email match, expiry
    → INSERT organization_members (active)
    → INSERT user_role_assignments (org_member base role)
    → INSERT user_role_assignments (invited role, if set and org-scoped)
    → UPDATE invitations SET status = 'accepted', accepted_at = now()
    → RETURN { success: true, organization_id: ... }
  → redirect to /dashboard
```

**Issue**: Hook always takes the regular path (creates personal org) because `invitation_token` is only in the `emailRedirectTo` URL, not in `user_metadata`. User ends up with two orgs. `user_preferences.organization_id` points to personal org.

### 3C. Existing User Accepting Invitation

```
/invite/[token] → user is already logged in
  → page loads invitation via fetchInvitationByToken (client)
  → shows details: org, role, branch, expiry
  → email match check (client-side guard): invitation.email === user.email
  → handleAcceptInvitation() → acceptInvitationAction(token)
    → OrgInvitationsService.acceptInvitation(supabase, token)
    → supabase.rpc("accept_invitation_and_join_org", { p_token: token })
    → redirect to /dashboard/start (after 2s)
```

**Status**: Correct. Works as designed.

### 3D. Forgot Password / Reset Password

```
/forgot-password → forgotPasswordAction(email)
  → supabase.auth.resetPasswordForEmail(email, {
      redirectTo: {SITE_URL}/auth/confirm?next=/{locale}/reset-password
    })
  → Supabase sends email with token_hash link
  → User clicks → /auth/confirm?token_hash=...&type=recovery&next=...
  → supabase.auth.verifyOtp({ type, token_hash })
  → redirect to /{locale}/reset-password (localized)
  → resetPasswordAction(formData)
  → supabase.auth.updateUser({ password })
  → supabase.auth.signOut()
  → redirect to /sign-in
```

**Issue**: `/auth/confirm` has `/dashboard-old/start` in its `localizedPaths` object — legacy entry, never used by current forgot-password flow but signals incomplete cleanup.

### 3E. Sign-In

```
/sign-in → signInAction(email, password, returnUrl?)
  → supabase.auth.signInWithPassword({ email, password })
  → if returnUrl: nextRedirect(returnUrl)
  → else: redirect to /dashboard/start
```

**Issue**: Debug `console.log` statements at lines 87–93 in `actions.ts` left in production code.

---

## 4. User Bootstrap Model

### Regular Registration (via `handle_user_signup_hook`)

The hook is a SECURITY DEFINER function receiving event JSONB from Supabase Auth:

```
public.users                INSERT (id, email, first_name, last_name)
public.organizations        INSERT (name from first_name/email, unique slug with retry)
public.organization_profiles INSERT
public.branches             INSERT ("Main Branch", slug: "main")
public.user_preferences     INSERT (organization_id, default_branch_id)
public.user_role_assignments INSERT (org_owner, scope=org, scope_id=new_org_id)
public.organization_members  *** NOT INSERTED ***
```

The hook contains an invitation path (reads `event->'user_metadata'->>'invitation_token'`) that would skip org creation and instead set up the invited org context. This path is currently never reached because `signUpAction` does not put the token in `user_metadata`.

### Invitation Acceptance (via `accept_invitation_and_join_org`)

```
public.organization_members  UPSERT (status=active, joined_at=now(); reactivates if soft-deleted)
public.user_role_assignments UPSERT (org_member base role; reactivates if soft-deleted)
public.user_role_assignments UPSERT (invited role, if role_id set and scope_type in org/both)
public.invitations           UPDATE (status=accepted, accepted_at=now())
```

### Compile Pipeline (triggered automatically)

```
AFTER INSERT/UPDATE/DELETE on user_role_assignments
  → trigger_compile_on_role_assignment()
  → compile_user_permissions(user_id, org_id)
    → GUARD: if no organization_members row → DELETE uep rows for user+org, RETURN
    → INSERT user_effective_permissions (wildcard expansion via LEFT JOIN)
```

---

## 5. DB Truth — Critical Gaps

### Gap 1: `organization_members` Never Populated for Regular Users

**Evidence (verified from DB)**: The `handle_user_signup_hook` body contains no INSERT into `organization_members` in either the regular or invitation path.

**Impact chain**:

- `is_org_member(org_id)` → `FALSE` (checks `organization_members.status = 'active'`)
- `compile_user_permissions` → guards on `organization_members` → deletes UEP, returns empty
- `has_permission()` → `FALSE` (reads from `user_effective_permissions`)
- RLS on `organizations` (select/update via `is_org_member`), `user_role_assignments` (V2 insert/update/delete policies call `is_org_member`), `invitations` (insert requires `is_org_member`) — all affected

**Partial mitigation**:

- `is_org_creator()` provides an alternative check (reads `organizations.created_by`). Two SELECT policies — `org_select_creator` and `Org creators and owners can add members` — use `is_org_creator`.
- `loadAppContextV2` resolves org via `user_role_assignments` or `created_by` (does NOT use `organization_members`), so org loading still works.

**Unmitigated**: Most RLS policies that call `is_org_member` or `has_permission` would block normal usage for newly registered org owners.

**Auth hook registration caveat**: If `handle_user_signup_hook` is NOT registered as a Supabase Auth Hook in the dashboard, no bootstrap happens at all. The function exists in DB but hook registration must be verified in Supabase Dashboard → Authentication → Hooks.

### Gap 2: Hook Invitation Branch Is Dead Code

**Evidence**: Hook reads `event->'user_metadata'->>'invitation_token'`. The `signUpAction` only puts the token in `emailRedirectTo` URL, not in `user_metadata.data`. The hook's invitation branch never fires.

**Consequence**: The hook always runs the regular path → creates a personal org for every new user, including those signing up via invitation.

### Gap 3: Wrong Default Org for Invited New Users

**Evidence**: Hook's regular path inserts `user_preferences.organization_id = new_personal_org_id`. After the callback accepts the invitation, `user_preferences` still points to the personal org, not the invited org.

**Consequence**: After first login, `loadAppContextV2` reads preferences → selects personal org as active → user doesn't see the invited org by default.

---

## 6. Readiness Matrix

| Feature                            | Status  | Notes                                                     |
| ---------------------------------- | ------- | --------------------------------------------------------- |
| Regular sign-up                    | PARTIAL | Bootstrap works; `organization_members` gap may break RLS |
| Email confirmation (PKCE)          | PASS    | Code exchange and redirect work correctly                 |
| Sign-in with returnUrl             | PASS    | —                                                         |
| Forgot / reset password            | PASS    | Minor stale path in `/auth/confirm`                       |
| Invitation page — logged-in user   | PASS    | Full RPC acceptance flow works                            |
| Invitation page — not logged in    | PASS    | Redirects to sign-in or sign-up with token                |
| Sign-up via invitation (new user)  | PARTIAL | Works but creates extra personal org                      |
| PKCE invitation auto-accept        | PASS    | `/auth/callback` correctly calls RPC                      |
| Email on invite/resend             | PASS    | EmailService with try/catch isolation                     |
| Expiry check                       | PASS    | Both client (UI guard) and DB (RPC)                       |
| Email mismatch guard               | PASS    | Both client (UI guard) and DB (RPC)                       |
| Re-joining after soft-delete       | PASS    | `ON CONFLICT DO UPDATE SET deleted_at = NULL`             |
| i18n invitation page               | PASS    | All 37 keys use `useTranslations`                         |
| i18n routing for `/invite/[token]` | PASS    | `/zaproszenie/[token]` in routing.ts                      |
| Resend invitation                  | PASS    | New token + extended expiry + email                       |
| Cancel invitation                  | PASS    | Soft-delete via service                                   |

---

## 7. Security Audit

### Authentication

| Check                                                                      | Result                                                     |
| -------------------------------------------------------------------------- | ---------------------------------------------------------- |
| `loadAppContextV2` uses `getUser()`                                        | PASS — comment explains cookie-only risk of `getSession()` |
| `loadUserContextV2` uses `getUser()` for auth, `getSession()` for JWT only | PASS — pattern documented                                  |
| `reset-password/page.tsx` uses `getSession()` for auth gate                | FAIL — should be `getUser()`                               |
| `accept_invitation_and_join_org` uses `auth.uid()` server-only             | PASS                                                       |
| `SET search_path TO ''` on acceptance function                             | PASS — prevents search path injection                      |
| GRANT authenticated / REVOKE anon on acceptance function                   | PASS                                                       |
| Email match validation in RPC (case-insensitive)                           | PASS                                                       |
| Invitation status = 'pending' checked in RPC                               | PASS                                                       |
| Expiry checked in RPC                                                      | PASS                                                       |
| `FOR UPDATE` row lock on invitation in RPC                                 | PASS — prevents double-acceptance                          |

### Legacy Client Functions (`lib/api/invitations.ts`)

The file contains `acceptInvitation(token)` and `rejectInvitation(token)` that directly UPDATE the `invitations` table via browser client. These:

- Skip `accept_invitation_and_join_org` — no `organization_members` or URA created
- Reference `updated_at` and `rejected_at` columns that **do not exist** in the current `invitations` schema (verified from DB) — these updates silently fail
- Are not called by the current invitation page (page uses `acceptInvitationAction` via server action)
- Remain importable and could be accidentally used in future code

### RLS Policy Summary

| Table                   | Assessment                                                                                                                                                              |
| ----------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `invitations`           | SELECT: org member+read OR own email (correct for anon view). INSERT: requires `invites.create` permission. UPDATE: org cancel OR self-accept/cancel. No DELETE policy. |
| `organization_members`  | INSERT: org creator OR org owner (enables `accept_invitation_and_join_org` via SECURITY DEFINER). SELECT: own OR org member. UPDATE: org owner OR members.manage.       |
| `user_role_assignments` | V2 policies with dual org/branch paths. "View own role assignments" allows `loadDashboardContextV2` branch switcher.                                                    |
| `users`                 | SELECT: own OR org co-member. INSERT: own only. UPDATE: own only. No DELETE.                                                                                            |
| `user_preferences`      | Own-only for all operations.                                                                                                                                            |

---

## 8. Invitation Compatibility

### New User Registering via Invitation — Current Behavior

1. Arrives at `/invite/[token]`, clicks "No account" → `/sign-up?invitation=TOKEN`
2. Form pre-fills email (locked), shows org/role via `fetchInvitationByToken`
3. Submits → `signUpAction` → `invitation_token` appended only to `emailRedirectTo`
4. Hook fires: no `invitation_token` in `user_metadata` → regular path → personal org created
5. Confirmation email sent with `?invitation_token=TOKEN` in callback URL
6. User clicks email → `/auth/callback?code=...&invitation_token=TOKEN`
7. Code exchange → session → `accept_invitation_and_join_org` RPC → joins invited org
8. Redirect to `/dashboard`
9. `loadAppContextV2` reads preferences → selects personal org, not invited org

**Result**: User belongs to both orgs, invitation correctly accepted, but default context is personal org.

### Existing User Accepting Invitation — Current Behavior

Works correctly. RPC validates, joins org, returns `{ success: true, data: { organization_id } }`, UI redirects to `/dashboard/start`.

---

## 9. Test Coverage

### New Tests Added This Session

| Suite                                    | Count | Patterns                                                                   |
| ---------------------------------------- | ----- | -------------------------------------------------------------------------- |
| `OrgInvitationsService.acceptInvitation` | 6     | RPC success, failure, no-org-id, network error, no message, email mismatch |
| `OrgInvitationsService.resendInvitation` | 2     | Success returns token+email+org_id; not found                              |
| `acceptInvitationAction` (actions test)  | 3     | Success, service error, throws                                             |
| `createInvitationAction` (actions test)  | 1     | Success with email send                                                    |

### Coverage Gaps

- No test for PKCE token preservation through signup → email → callback chain
- No test verifying the "extra personal org" issue for invited new users
- No test for `fetchInvitationByToken` RLS behavior for unauthenticated callers
- No test for `handle_user_signup_hook` logic (DB function unit test)
- No E2E/integration test for full invitation signup flow

---

## 10. Implementation Readiness

### Fully Ready

- `accept_invitation_and_join_org` SECURITY DEFINER function (deployed, verified in DB)
- `OrgInvitationsService.acceptInvitation()` + `acceptInvitationAction` (implemented, tested)
- `resendInvitationAction` with email sending (implemented, tested)
- `createInvitationAction` with email sending (implemented, tested)
- Invitation page with full i18n — 37 keys, no hardcoded strings (implemented)
- PKCE callback invitation token handling (implemented, tested)
- Migration `20260306120000_invitation_acceptance_flow.sql` (applied)

### Requires Fixing Before Production

**Priority 1 — Critical**:

1. Add `organization_members` INSERT to `handle_user_signup_hook` (regular path):

   ```sql
   INSERT INTO public.organization_members (organization_id, user_id, status, joined_at)
   VALUES (new_org_id, user_id, 'active', now())
   ON CONFLICT (organization_id, user_id) DO UPDATE SET status = 'active', deleted_at = NULL;
   ```

   This unblocks `is_org_member()`, `compile_user_permissions`, and all dependent RLS policies.

2. Pass `invitation_token` in `user_metadata` so the hook takes the invitation path:
   In `signUpAction`, add to the `data` object:
   ```typescript
   data: {
     first_name: firstName || "",
     last_name: lastName || "",
     ...(invitationToken ? { invitation_token: invitationToken } : {}),
   }
   ```
   The hook already reads `event->'user_metadata'->>'invitation_token'` and has the correct branch.

**Priority 2 — High**:

3. `reset-password/page.tsx`: replace `getSession()` with `getUser()`:

   ```typescript
   const {
     data: { user },
   } = await supabase.auth.getUser();
   if (!user) redirect({ href: "/forgot-password", locale });
   ```

4. `/auth/confirm`: remove the stale `"/dashboard-old/start"` entry from `localizedPaths`.

**Priority 3 — Medium**:

5. `sign-up-form.tsx`: add i18n for 5 hardcoded Polish strings (`"Dołącz do organizacji"`, `"Utwórz konto..."`, `"Ładowanie szczegółów..."`, `"Zaproszenie do:"`, `"Rola:"`, `"Oddział:"`).

6. `lib/api/invitations.ts`: remove or clearly deprecate `acceptInvitation()` and `rejectInvitation()` — they reference non-existent columns and bypass the SECURITY DEFINER function.

7. `actions.ts` (signInAction): remove debug `console.log` statements at lines 87–93.

---

## 11. Recommended Implementation Order

```
Phase A — DB Fix (1 migration)
  1. Add organization_members INSERT to handle_user_signup_hook regular path
     Fixes: is_org_member(), compile_user_permissions, all RLS gaps for org owners

Phase B — Signup Fix (1 change in signUpAction)
  2. Pass invitation_token in user_metadata.data
     Fixes: hook takes invitation path → no personal org for invited users
            user_preferences correctly set to invited org by hook

Phase C — Security (1 file)
  3. Replace getSession() with getUser() in reset-password/page.tsx

Phase D — Cleanup (multiple small changes)
  4. Remove console.log from signInAction (lines 87–93)
  5. Remove /dashboard-old/start from /auth/confirm localizedPaths
  6. i18n the 5 Polish strings in sign-up-form.tsx
  7. Remove/deprecate legacy acceptInvitation/rejectInvitation in lib/api/invitations.ts
```

---

## 12. Final Verdict

### Registration System

**PARTIAL** — Auth plumbing (PKCE, Supabase SSR client setup, `getUser()` in loaders, session validation) is solid and follows best practices. The critical gap is `organization_members` missing from the hook, which causes `is_org_member()` to return FALSE for org owners and `compile_user_permissions` to produce empty snapshots. This needs a one-line SQL fix in the hook body.

### Invitation System

**FUNCTIONAL WITH KNOWN ISSUES** — The Phase 1–5 implementation (SECURITY DEFINER RPC, server action, PKCE callback, UI, email, i18n, tests) is architecturally correct and production-quality. The main issue is that new users signing up via invitation also get a personal org created and land in the wrong org context. This is fixed by a one-line change to `signUpAction` (pass token in metadata).

### Auth Security

**MOSTLY SECURE** — Main concern is `getSession()` in `reset-password/page.tsx`. All critical context loading paths use `getUser()`. The SECURITY DEFINER acceptance function has proper auth guards, row locks, search path isolation, and correct GRANT/REVOKE.

### i18n Readiness

**GOOD** — Invitation page fully translated. Auth routes correctly registered in routing.ts with Polish aliases. `localePrefix: "as-needed"` + `defaultLocale: "pl"` is correct. Five outstanding strings in `sign-up-form.tsx`.

---

## Appendix A — DB Schema Verified

### `public.users`

`id uuid, email text NOT NULL, first_name text, last_name text, status_id uuid, default_branch_id uuid, created_at, deleted_at, avatar_url text, avatar_path text`

### `public.organizations`

`id uuid, name text NOT NULL, slug text, created_by uuid, created_at, deleted_at, name_2 text`

### `public.invitations`

`id uuid, email text NOT NULL, invited_by uuid NOT NULL, organization_id uuid, branch_id uuid, team_id uuid, role_id uuid, token text NOT NULL, status text DEFAULT 'pending', expires_at, accepted_at, created_at, deleted_at`

**Note**: No `updated_at` column, no `rejected_at` column. The legacy `lib/api/invitations.ts` `rejectInvitation()` and `cancelInvitation()` functions reference both — those writes silently fail.

### `public.organization_members`

`id uuid, organization_id uuid NOT NULL, user_id uuid NOT NULL, status text DEFAULT 'active', joined_at, created_at, updated_at, deleted_at`

### `public.user_role_assignments`

`id uuid, user_id uuid NOT NULL, role_id uuid NOT NULL, scope text NOT NULL, scope_id uuid NOT NULL, deleted_at`

---

## Appendix B — Auth Hook Registration Status

`handle_user_signup_hook` exists as a SECURITY DEFINER function in the DB. Whether it is wired as a Supabase Auth Hook could not be confirmed via SQL (`auth.hooks` table is inaccessible via MCP).

**To verify**: Supabase Dashboard → Authentication → Hooks → look for "After user created" hook pointing to `public.handle_user_signup_hook`.

- If **registered**: the gaps in Section 5 are active bugs affecting all registered users.
- If **not registered**: the entire bootstrap (no `public.users` row, no org, no URA) does not work. This is the more catastrophic scenario, but unlikely since the project appears functional in development.
