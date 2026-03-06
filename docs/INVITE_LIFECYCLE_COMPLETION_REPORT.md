# Complete Invitation Flow + Onboarding Handoff — Implementation Report

**Branch**: `invitation-system`
**Date**: 2026-03-07
**Status**: Complete — 1140 tests passing, 0 type errors, 0 lint errors

---

## 1. Summary of Changes

This phase completed the full invitation lifecycle from creation to member decision/acceptance, and established a deterministic post-auth routing model that routes users with no organization to a dedicated onboarding entry point.

Key additions:

- `decline_invitation` SECURITY DEFINER DB function — users can explicitly decline invitations
- `INVITE_DECLINED` reason code — full set of terminal invite states now modeled
- `declineInvitationAction` server action with correct routing (more invites → resolve, none → onboarding)
- `/onboarding` entry route — clean handoff point for users with no org
- Routing fixes: `auth/callback`, `signInAction`, skip button all route to `/onboarding`
- 15 new tests covering decline paths and routing decision logic

---

## 2. Files Changed

| File                                                                           | Status   | Description                                                                                                                          |
| ------------------------------------------------------------------------------ | -------- | ------------------------------------------------------------------------------------------------------------------------------------ |
| `supabase/migrations/20260307100000_invite_decline_and_onboarding_routing.sql` | NEW      | `decline_invitation` function + updated `get_invitation_preview_by_token` for declined status                                        |
| `src/app/actions/organization/invitations.ts`                                  | MODIFIED | Added `declineInvitationAction`                                                                                                      |
| `src/app/actions/organization/invite-preview.ts`                               | MODIFIED | Added `INVITE_DECLINED` to `InviteReasonCode` union                                                                                  |
| `src/app/[locale]/onboarding/page.tsx`                                         | NEW      | Onboarding entry server page                                                                                                         |
| `src/app/[locale]/onboarding/_components/onboarding-entry-client.tsx`          | NEW      | Onboarding entry client component                                                                                                    |
| `src/i18n/routing.ts`                                                          | MODIFIED | Added `/onboarding` route (en + pl)                                                                                                  |
| `messages/en.json`                                                             | MODIFIED | Added `declinedTitle`, `declinedDescription`, `declineButton`, `declineError` to `invitationPage`; added `onboardingEntry` namespace |
| `messages/pl.json`                                                             | MODIFIED | Same keys in Polish                                                                                                                  |
| `src/app/[locale]/invite/[token]/_components/invite-page-client.tsx`           | MODIFIED | Added decline button, `handleDecline`, `INVITE_DECLINED` terminal card                                                               |
| `src/app/[locale]/invite/resolve/page.tsx`                                     | MODIFIED | `skipHref` changed from `/dashboard/start` to `/onboarding`                                                                          |
| `src/app/auth/callback/route.ts`                                               | MODIFIED | Redirects to `/onboarding`; `/dashboard/start` only when `invitation_token` was used                                                 |
| `src/app/[locale]/actions.ts`                                                  | MODIFIED | `signInAction`: checks org membership; routes to `/onboarding` if no active membership                                               |
| `src/app/actions/organization/__tests__/invite-lifecycle.test.ts`              | NEW      | 15 tests for decline action + routing decisions                                                                                      |
| `src/modules/organization-managment/MODULE_CHECKLIST.md`                       | MODIFIED | Invitation lifecycle completion section added                                                                                        |

---

## 3. DB Changes

### New function: `public.decline_invitation(p_token TEXT) → JSONB`

- `SECURITY DEFINER SET search_path TO ''`
- GRANT EXECUTE to **authenticated** only; REVOKE from **anon**
- Validates: caller is authenticated, email matches invitation, status is `pending`
- On success: sets `status = 'declined'`
- Returns: `{ success, organization_id }` or `{ success: false, error }`
- Atomic via `FOR UPDATE` row lock

### Updated function: `public.get_invitation_preview_by_token(p_token TEXT) → JSONB`

- Added `declined` → `INVITE_DECLINED` mapping
- All other reason codes unchanged

**Migration**: `supabase/migrations/20260307100000_invite_decline_and_onboarding_routing.sql`
**Applied to**: `zlcnlalwfmmtusigeuyk` via Supabase MCP

---

## 4. Admin Invite Flow Status

All admin-side operations verified complete:

| Action                            | Guard            | Status                               |
| --------------------------------- | ---------------- | ------------------------------------ |
| `createInvitationAction`          | `INVITES_CREATE` | ✅ Optional role, email delivery     |
| `cancelInvitationAction`          | `INVITES_CANCEL` | ✅ Sets `cancelled`                  |
| `resendInvitationAction`          | `INVITES_CREATE` | ✅ Regenerates token + resends email |
| `listInvitationsAction`           | `INVITES_READ`   | ✅ All org invitations               |
| `cleanupExpiredInvitationsAction` | `INVITES_CANCEL` | ✅ Bulk cleanup                      |

Role selection: optional (`null` → `org_member` only on acceptance). Branch-scoped roles: **deferred**.

---

## 5. Public Invite Review Flow

**Route**: `/invite/[token]` — SSR server component + client island.

Full reason-code UX matrix:

| Reason Code        | Auth State             | UI                               |
| ------------------ | ---------------------- | -------------------------------- |
| `INVITE_NOT_FOUND` | any                    | Not found card                   |
| `INVITE_EXPIRED`   | any                    | Expired card                     |
| `INVITE_CANCELLED` | any                    | Cancelled by org card            |
| `INVITE_DECLINED`  | any                    | Already declined card (new)      |
| `INVITE_ACCEPTED`  | any                    | Already accepted card            |
| `INVITE_INVALID`   | any                    | Not found card                   |
| `INVITE_PENDING`   | unauthenticated        | Preview + Sign In / Sign Up CTAs |
| `INVITE_PENDING`   | authed, email mismatch | Mismatch warning                 |
| `INVITE_PENDING`   | authed, email match    | Accept + Decline buttons (new)   |

---

## 6. Post-Auth Invite Resolution Flow

**Case A — One pending invite**: routed to `/invite/resolve` → single card → "View & Accept" → `/invite/[token]` → Accept or Decline.

**Case B — Multiple pending invites**: same route → multiple cards → user selects which to act on → "Continue without accepting" → `/onboarding`.

**Case C — No pending invite**:

- `signInAction` with org → `/dashboard/start`
- `signInAction` without org → `/onboarding`
- `auth/callback` without invite → `/onboarding`

---

## 7. Continue / Decline Behavior

### Skip

- "Continue without accepting" on `/invite/resolve`
- Navigates to `/onboarding`, leaves invites pending (no DB mutation)

### Decline

- "Decline invitation" on `/invite/[token]` (email-match only)
- Calls `decline_invitation` RPC → sets `status = 'declined'`
- After decline: more invites → `/invite/resolve`, none → `/onboarding`
- Declined token shows `INVITE_DECLINED` terminal card if revisited

### Accept

- "Accept Invitation" on `/invite/[token]` (email-match only)
- Calls `accept_invitation_and_join_org` RPC → creates membership + role assignments
- After accept: `/dashboard/start`

---

## 8. Onboarding Entry Handoff

**Route**: `/onboarding`

- Server component: checks auth → redirects to `/sign-in` if not authed
- Client component: shows user email, "Go to Dashboard" link, org creation hint
- **Placeholder only — no org creation wizard**

Routes to `/onboarding`:

1. `auth/callback` — new signup, no invite, no pending invites
2. `signInAction` — user has no active `organization_members` row
3. `InvitePageClient` — after decline, no more pending invites
4. `InviteResolveClient` — skip button

---

## 9. Routing Consistency Changes

| Entry point                                 | Before                     | After                              |
| ------------------------------------------- | -------------------------- | ---------------------------------- |
| `auth/callback` — no invite, no pending     | `/dashboard` (wrong)       | `/onboarding`                      |
| `auth/callback` — invitation_token accepted | `/dashboard` (wrong)       | `/dashboard/start`                 |
| `signInAction` — no pending, no org         | `/dashboard/start` (wrong) | `/onboarding`                      |
| `signInAction` — no pending, has org        | `/dashboard/start`         | `/dashboard/start` (unchanged)     |
| `InviteResolveClient` skip                  | `/dashboard/start`         | `/onboarding`                      |
| `InvitePageClient` after decline            | N/A (new)                  | `/invite/resolve` or `/onboarding` |

Routing decision logic centralized in 3 files:

1. `src/app/[locale]/actions.ts` (`signInAction`)
2. `src/app/auth/callback/route.ts`
3. `src/app/[locale]/invite/[token]/_components/invite-page-client.tsx`

---

## 10. Tests Added / Updated

### `src/app/actions/organization/__tests__/invite-lifecycle.test.ts` (15 new tests)

**`declineInvitationAction`** (7):

- RPC success → `{ success: true }`
- RPC returns `success: false` with error message
- RPC itself errors
- RPC returns null data
- Not authenticated response
- Email mismatch response
- Unexpected exception

**`INVITE_DECLINED` preview** (2):

- Maps `declined` status → `INVITE_DECLINED`
- Distinct from `INVITE_CANCELLED`

**Routing decisions** (6):

- No org → `/onboarding`
- Has org → `/dashboard/start`
- Pending invites take priority over org check
- `auth/callback`: no invite, no pending → `/onboarding`
- `auth/callback`: pending found → `/invite/resolve`
- `auth/callback`: `invitation_token` present → `/dashboard/start`

**Full suite**: 1140 passed, 8 skipped, 9 todo

---

## 11. Deferred Items

| Item                                      | Reason                                                 |
| ----------------------------------------- | ------------------------------------------------------ |
| Full own-org onboarding wizard            | Out of scope per spec                                  |
| Org creation flow                         | Out of scope per spec                                  |
| Branch-scoped invite role assignment      | Additional service + UI work; `branch_id: null` always |
| Multi-role invitations                    | Out of scope per spec                                  |
| Billing/plan recommendation on onboarding | Out of scope per spec                                  |
| Email notification to inviter on decline  | Minor enhancement                                      |
| Admin resend to declined user             | Works: resend resets token + status to pending         |

---

## 12. Commands Run

```bash
# DB applied via Supabase MCP
mcp__supabase__apply_migration name=invite_decline_and_onboarding_routing

# Verification
pnpm type-check    # 0 errors
pnpm lint          # 0 errors (131 pre-existing warnings)
pnpm test:run      # 1140 passed, 8 skipped, 9 todo
```
