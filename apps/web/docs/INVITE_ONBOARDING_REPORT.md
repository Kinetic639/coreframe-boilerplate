# Invite-Aware Onboarding + Public Invitation Preview — Implementation Report

**Branch**: `invitation-system`
**Date**: 2026-03-06
**Status**: Complete — all tests passing (1125/1125)

---

## Summary

Implemented a secure, server-first invitation flow that allows anonymous users to preview invitation details before signing up, and ensures authenticated users with pending invites are routed to a resolution screen rather than silently dropped into their dashboard.

The system is built around two SECURITY DEFINER PostgreSQL functions and a set of reason codes (`InviteReasonCode`) that drive the entire UX from a single enum.

---

## Architecture Overview

```
Invitation email link
  └── /invite/[token] (SSR page)
        ├── Loads preview via get_invitation_preview_by_token (anon-safe)
        ├── Checks auth state server-side
        └── Renders InvitePageClient (reason-code-driven UX)
              ├── INVITE_NOT_FOUND     → not found card
              ├── INVITE_EXPIRED       → expired card
              ├── INVITE_CANCELLED     → cancelled card
              ├── INVITE_ACCEPTED      → already accepted card
              └── INVITE_PENDING
                    ├── Not authed     → preview + sign-in / sign-up CTAs
                    ├── Email mismatch → warning card
                    └── Email match    → Accept button → acceptInvitationAction()

Sign-in flow
  └── signInAction()
        └── If no returnUrl: check get_my_pending_invitations
              └── Pending found → /invite/resolve
                    └── InviteResolveClient: join (→ /invite/[token]) or skip (→ /dashboard/start)

Email confirmation flow (auth/callback)
  └── No invitation_token in URL: check get_my_pending_invitations
        └── Pending found → /invite/resolve
```

---

## Phases Implemented

### Phase 1: Database Functions

**Migration**: `supabase/migrations/20260306140000_invite_preview_and_pending_functions.sql`

#### `get_invitation_preview_by_token(p_token TEXT) → JSONB`

- `SECURITY DEFINER SET search_path TO ''`
- GRANT EXECUTE to **anon** and **authenticated**
- Returns: `reason_code`, `status`, `expires_at`, `invited_email`, `org_name`, `role_name`, `branch_name`
- Never returns `id` or `token` — safe for public exposure
- Reason codes: `INVITE_PENDING`, `INVITE_NOT_FOUND`, `INVITE_EXPIRED`, `INVITE_CANCELLED`, `INVITE_ACCEPTED`

#### `get_my_pending_invitations() → JSONB`

- `SECURITY DEFINER SET search_path TO ''`
- GRANT EXECUTE to **authenticated** only; REVOKE from **anon**
- Looks up caller email via `auth.uid()` → `auth.users`
- Joins `invitations`, `organization_profiles`, `roles`, `branches`
- Returns: `{ success, invitations: [{ id, token, expires_at, org_name, role_name, branch_name }] }`

Both functions applied to the remote Supabase project (`zlcnlalwfmmtusigeuyk`) via MCP.

---

### Phase 2: Server Actions

**File**: `src/app/actions/organization/invite-preview.ts`

```typescript
export type InviteReasonCode =
  | "INVITE_PENDING"
  | "INVITE_NOT_FOUND"
  | "INVITE_EXPIRED"
  | "INVITE_CANCELLED"
  | "INVITE_ACCEPTED"
  | "INVITE_INVALID";
```

**`getPublicInvitationPreviewAction(token: string)`**

- Guards: empty token or `< 8 chars` → `INVITE_INVALID` (no DB call)
- RPC error → `INVITE_INVALID`
- Maps RPC result to typed `InvitePreview` response

**`getMyPendingInvitationsAction()`**

- Guards: unauthenticated → `{ success: false, invitations: [] }`
- Returns `{ success, invitations: PendingInviteItem[], error? }`

---

### Phase 3: Server-First Invite Page

**Files**:

- `src/app/[locale]/invite/[token]/page.tsx` — server component (SSR)
- `src/app/[locale]/invite/[token]/_components/invite-page-client.tsx` — client island

The page was rewritten from a client-side monolith (which relied on RLS-exposed invitation data) to a server component that:

1. Loads the preview via SECURITY DEFINER RPC (no auth required)
2. Checks auth state SSR
3. Passes `{ token, preview, userEmail, locale }` to the client island

The client island renders all UX branches without any further data fetching.

**Reason-code UX matrix**:

| Reason Code        | Auth State             | Rendered UI                           |
| ------------------ | ---------------------- | ------------------------------------- |
| `INVITE_NOT_FOUND` | any                    | Not found card                        |
| `INVITE_EXPIRED`   | any                    | Expired card                          |
| `INVITE_CANCELLED` | any                    | Cancelled card                        |
| `INVITE_ACCEPTED`  | any                    | Already accepted card                 |
| `INVITE_PENDING`   | unauthenticated        | Preview card + Sign In / Sign Up CTAs |
| `INVITE_PENDING`   | authed, email mismatch | Mismatch warning card                 |
| `INVITE_PENDING`   | authed, email match    | Accept button                         |

Sign-up CTA includes `?invitation=<token>` query param so the sign-up page can pre-fill and pass the token through `signUpAction`.

Sign-in CTA includes `?returnUrl=/invite/<token>` so the user lands back on the invite page after login.

---

### Phase 4: Invite Resolution Page

**Files**:

- `src/app/[locale]/invite/resolve/page.tsx` — server component
- `src/app/[locale]/invite/resolve/_components/invite-resolve-client.tsx` — client component

**Route registered** in `src/i18n/routing.ts`:

```typescript
"/invite/resolve": {
  en: "/invite/resolve",
  pl: "/zaproszenie/resolve",
},
```

**Server component** guards:

1. Unauthenticated → redirect to `/sign-in`
2. No pending invites → redirect to `/dashboard/start`
3. 1+ pending invites → render `InviteResolveClient`

**Client component** renders one card per pending invitation with:

- **Join** → navigates to `/invite/[token]` for that invitation
- **Skip** → navigates to `skipHref` (leaves invitations pending, does NOT cancel)

---

### Phase 5: Pending Invite Detection on Auth Events

**`signInAction`** (`src/app/[locale]/actions.ts`):

After successful sign-in with no `returnUrl`, checks pending invites before redirecting:

```typescript
const { data: pendingData } = await supabase.rpc("get_my_pending_invitations");
const pendingResult = pendingData as { success: boolean; invitations?: unknown[] } | null;
if (pendingResult?.success && (pendingResult.invitations?.length ?? 0) > 0) {
  return redirect({ href: "/invite/resolve", locale });
}
return redirect({ href: "/dashboard/start", locale });
```

**`auth/callback`** (`src/app/auth/callback/route.ts`):

After code exchange, if no `invitation_token` in the URL (i.e. user confirmed email from sign-up but wasn't completing an invitation flow):

```typescript
if (!invitationToken && code) {
  const { data: pendingData } = await supabase.rpc("get_my_pending_invitations");
  const pendingResult = pendingData as { success: boolean; invitations?: unknown[] } | null;
  if (pendingResult?.success && (pendingResult.invitations?.length ?? 0) > 0) {
    return NextResponse.redirect(`${origin}/invite/resolve`);
  }
}
```

Direct `supabase.rpc()` calls are used (not the server action) to avoid `createClient()` duplication issues.

---

### Phase 6: InvitationFormDialog — Optional Role

**File**: `src/modules/organization-managment/components/invitations/InvitationFormDialog.tsx`

Changes:

- Import changed from `@/app/actions/invitations` → `@/app/actions/organization/invitations` (V2 action)
- `role_id` schema changed: `z.string().uuid()` → `z.string().uuid().optional().or(z.literal(""))`
- Explicit `__none__` option added to role selector with "No extra role" label
- Role selection is optional — `null` sent when blank; `org_member` base role assigned automatically on acceptance
- All UI strings moved to `useTranslations("invitationFormDialog")`
- `branch_id` always sent as `null` (branch-scoped invite deferred to future phase)

---

### Phase 7: Internationalization

**Files**: `messages/en.json`, `messages/pl.json`

New/extended namespaces:

| Namespace              | Keys Added                                                                                                              |
| ---------------------- | ----------------------------------------------------------------------------------------------------------------------- |
| `invitationPage`       | `expiredTitle`, `cancelledTitle`, `cancelledDescription`, `acceptedTitle`, `acceptedDescription`                        |
| `inviteResolvePage`    | `title`, `singleInviteDescription`, `multipleInviteDescription`, `joinButton`, `skipButton`, `skipHint`, `expiresLabel` |
| `invitationFormDialog` | Full set: title, description, email/role/expiry fields, buttons, hints, toasts                                          |

---

### Phase 8: Tests

#### `src/app/actions/organization/__tests__/invite-preview.test.ts` (NEW — 14 tests)

**`getPublicInvitationPreviewAction`** (8 tests):

- Returns `INVITE_INVALID` for empty token (no DB call)
- Returns `INVITE_INVALID` for short token < 8 chars (no DB call)
- Calls `get_invitation_preview_by_token` RPC with correct token
- Maps `INVITE_PENDING` response correctly (org_name, invited_email, role_name, branch_name)
- Maps `INVITE_NOT_FOUND` correctly
- Maps `INVITE_EXPIRED` correctly
- Maps `INVITE_CANCELLED` correctly
- Maps `INVITE_ACCEPTED` correctly
- Returns `INVITE_INVALID` when RPC itself errors
- Does NOT expose `token` or `id` in preview response

**`getMyPendingInvitationsAction`** (5 tests):

- Returns error when unauthenticated (no RPC call)
- Calls `get_my_pending_invitations` RPC when authenticated
- Returns empty list when no pending invites
- Returns error when RPC fails (with error message)
- Returns multiple invites when multiple orgs have pending invites

#### Test Fix: `src/server/sidebar/__tests__/build-sidebar-model.test.ts`

The "Parent Pruning" test expected an `account` item in `model.footer`, but the registry comment explicitly states account is in the NavUser dropdown (not a sidebar section) and `FOOTER_NAV_ITEMS` is empty. Updated the assertion to `expect(model.footer).toHaveLength(0)`.

---

## Files Changed

| File                                                                                 | Status    | Description                                           |
| ------------------------------------------------------------------------------------ | --------- | ----------------------------------------------------- |
| `supabase/migrations/20260306140000_invite_preview_and_pending_functions.sql`        | NEW       | DB functions for invite preview and pending detection |
| `src/app/actions/organization/invite-preview.ts`                                     | NEW       | Server actions wrapping the two DB functions          |
| `src/app/[locale]/invite/[token]/page.tsx`                                           | REWRITTEN | Server component — SSR preview load                   |
| `src/app/[locale]/invite/[token]/_components/invite-page-client.tsx`                 | NEW       | Client island — reason-code-driven UX                 |
| `src/app/[locale]/invite/resolve/page.tsx`                                           | NEW       | Invite resolution server page                         |
| `src/app/[locale]/invite/resolve/_components/invite-resolve-client.tsx`              | NEW       | Invite resolution client component                    |
| `src/app/[locale]/actions.ts`                                                        | MODIFIED  | signInAction: pending invite detection                |
| `src/app/auth/callback/route.ts`                                                     | MODIFIED  | auth/callback: pending invite detection               |
| `src/modules/organization-managment/components/invitations/InvitationFormDialog.tsx` | REWRITTEN | Optional role, V2 action, full i18n                   |
| `src/i18n/routing.ts`                                                                | MODIFIED  | Added `/invite/resolve` route                         |
| `messages/en.json`                                                                   | MODIFIED  | New/extended namespaces                               |
| `messages/pl.json`                                                                   | MODIFIED  | New/extended namespaces                               |
| `src/app/actions/organization/__tests__/invite-preview.test.ts`                      | NEW       | 14 tests for invite-preview actions                   |
| `src/server/sidebar/__tests__/build-sidebar-model.test.ts`                           | MODIFIED  | Fixed stale footer account assertion                  |

---

## Security Properties

- **No raw invitation data exposed to anon**: `get_invitation_preview_by_token` never returns `id`, `token`, or internal fields
- **Email match enforced client-side and server-side**: accept button only shown when `preview.invited_email === userEmail`; `acceptInvitationAction` enforces the same server-side via RLS
- **`get_my_pending_invitations` restricted to authenticated**: REVOKE from anon; `auth.uid()` used to identify the caller — no user-supplied email
- **SECURITY DEFINER + empty search_path**: both functions are hardened against search_path injection
- **Skip does not cancel**: skipping the resolve page leaves invitations pending; they are shown again on next sign-in

---

## Out of Scope (Deferred)

- Branch-scoped invitations (InvitationFormDialog always sends `branch_id: null`)
- Multi-role invites
- Billing/plans integration
- Per-invitation cancellation from the resolve page
- Sandbox/demo org creation flow

---

## Verification Commands

```bash
pnpm type-check   # 0 errors
pnpm test:run     # 1125 passed, 8 skipped (DB integration), 9 todo
```
