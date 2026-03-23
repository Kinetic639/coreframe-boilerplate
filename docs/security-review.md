# Security Review — Shared Backend and Auth Setup

This document records the security posture of the shared backend and auth architecture
as of 2026-03-23. It covers service-role isolation, mobile auth security, auth settings,
password policy, MFA, redirect policies, and auth edge function assumptions.

Each finding is classified as one of:

- **Confirmed safe** — audited in this pass; no action needed
- **Known gap** — documented issue; action required before production
- **Deferred** — out of scope for current phase; decision required

---

## 1. Service-Role Isolation

### Finding: Confirmed safe

Audit performed 2026-03-23.

`createServiceClient()` is defined in `apps/web/src/utils/supabase/service.ts` and is
app-local. A full grep across all `packages/*/` returns zero hits for `createServiceClient`
or `SUPABASE_SERVICE_ROLE_KEY`. The service-role client is not accessible to the mobile app
and does not appear in any shared package.

**All call sites are server-side only:**

| Location                                                     | Usage                                             |
| ------------------------------------------------------------ | ------------------------------------------------- |
| `apps/web/src/app/[locale]/actions.ts`                       | Server action (account management)                |
| `apps/web/src/app/actions/roles/index.ts`                    | Server actions (role assignment — dynamic import) |
| `apps/web/src/app/actions/users/fetch-organization-users.ts` | Server action (dynamic import)                    |
| `apps/web/src/app/actions/audit/_query.ts`                   | Audit feed server action                          |
| `apps/web/src/server/audit/reference-enrichment.ts`          | Server-side audit enrichment                      |
| `apps/web/src/server/services/event.service.ts`              | Server service                                    |
| `apps/web/src/app/actions/_debug/test-service-role.ts`       | Debug server action                               |
| `apps/web/src/app/actions/_debug/debug-jwt-token.ts`         | Debug server action (inline client)               |
| Various `__tests__/` files                                   | Test mocks only                                   |

**Note on debug actions:** `apps/web/src/app/actions/_debug/` contains two server actions
that use service-role. These are server actions (Next.js `"use server"`) and cannot be
called directly from a browser without going through Next.js route handling. They should
be reviewed for auth gating before any production exposure. Removing or gating them is a
web-app concern, not a shared-architecture concern, and is deferred.

**Note on `@supabase/service` import alias:** Some test files import via `@supabase/service`.
This is a Vitest alias defined in `apps/web/vitest.config.ts` pointing to
`src/utils/supabase/service.ts`. It is not the `@repo/supabase` shared package.

**`SupabaseServiceConfig` in `@repo/supabase`:** This is an interface only (no implementation),
explicitly documented as server-only. It defines the shape of configuration — it does not
create clients. Confirmed safe.

---

## 2. Mobile Auth Security Posture

### Session Storage: Confirmed safe

`apps/mobile` uses `expo-secure-store` for auth token storage on native platforms (iOS Keychain,
Android Keystore). These are OS-managed encrypted storage facilities. The storage adapter
(`apps/mobile/lib/supabase/storage-adapter.ts`) has a `Platform.OS === "web"` guard that
falls back to `globalThis.localStorage` for Expo web/SSR environments.

### Client Configuration: Confirmed safe

The mobile Supabase client (`apps/mobile/lib/supabase/client.ts`) is configured with:

- `detectSessionInUrl: false` — prevents URL-based session injection (mobile apps do not
  use URL-based OAuth redirects in Phase 5)
- `autoRefreshToken: true` — access tokens are automatically refreshed
- `persistSession: true` — session is persisted via SecureStore

### Environment Variables: Confirmed safe

Mobile uses `EXPO_PUBLIC_SUPABASE_URL` and `EXPO_PUBLIC_SUPABASE_ANON_KEY` — the anon key
only. The service-role key (`SUPABASE_SERVICE_ROLE_KEY`) is never present in the mobile app.

---

## 3. Auth Settings for Mobile Rollout

### Email Confirmation

**Status: Requires operational review before mobile production launch.**

The current Supabase project is configured to require email confirmation for signup.
The web app handles this via a custom `send-auth-email` edge function that sends
confirmation emails through Resend. The mobile app in Phase 5 uses only `signInWithPassword`
(no signup flow). If a mobile signup flow is added in a future phase, the email confirmation
edge function must handle mobile-originated signups correctly.

**Action required (future phase):** Before mobile signup is enabled, confirm the email
confirmation template's redirect URL works for both web and mobile entry points.

### Session Lifetime

Supabase default: access token TTL of 1 hour, refresh token TTL of 60 days (project-configurable).
Mobile uses `autoRefreshToken: true` which handles token refresh transparently.

**Status: No action needed for Phase 5 (read-only session use).**

---

## 4. Password Security

### Current State: Known gap

The current implementation has no minimum password length or complexity enforcement
visible in the codebase. The `signInWithPassword` call on the mobile sign-in screen
and the web auth forms do not validate password strength client-side.

Supabase project-level password policy (minimum length, breach detection) is an
operational setting in the Supabase dashboard and is not controlled by this repository.

**Action required (operational):**

- Set minimum password length to at least 8 characters in Supabase project settings
- Consider enabling Supabase's HaveIBeenPwned (HIBP) breach detection if available on the plan
- Add client-side minimum length validation to both web signup and any future mobile signup form

**This is a configuration and UI task — not a shared-package task.**

---

## 5. MFA Roadmap

### Status: Deferred — product and operational decision required

Supabase supports TOTP-based MFA (Time-based One-Time Passwords via authenticator apps).
Enabling it requires:

1. Enabling MFA in Supabase project auth settings (operational)
2. Building an enrollment flow in the web app (product UI)
3. Building an enrollment flow in the mobile app (product UI, Phase 6+)
4. Deciding whether MFA is enforced (required) or opt-in

**No MFA implementation exists in this codebase. This is a post-Phase 6 product decision.**

Phase 6 note: documenting the MFA roadmap is the only Phase 6 obligation. Implementation
is deferred until the product decision is made.

---

## 6. Redirect Policies

### Current State: Confirmed safe for Phase 5

The mobile app in Phase 5 uses only `signInWithPassword` (email + password). This method
does not involve redirect URLs — there is no OAuth flow, no magic link, and no
email-based confirmation initiated from mobile. The Supabase redirect URL allowlist is
therefore not relevant to Phase 5 mobile behavior.

### Known gap for future phases

If any of the following are added to the mobile app:

- OAuth providers (Google, Apple, etc.)
- Magic link sign-in
- Mobile password reset flow

Then the mobile app's deep link scheme (e.g., `myapp://`) or universal link domain must
be added to the Supabase project's redirect URL allowlist. This is an operational change
in the Supabase dashboard.

**Action required (future phase — before any redirect-based mobile auth is added):**
Register the mobile app's deep link scheme in the Supabase allowed redirect URLs list.

---

## 7. Auth Edge Function Assumptions

### Current Configuration (TARGET project)

The TARGET project (`rjeraydumwechpjjzrus`) uses a custom `send-auth-email` edge function
for email delivery (signup confirmation, password recovery). The function is configured via:

- `hook_send_email_enabled: true`
- `hook_send_email_uri: https://rjeraydumwechpjjzrus.supabase.co/functions/v1/send-auth-email`

### Email redirect URLs assume web app

Confirmation emails link to `{NEXT_PUBLIC_SITE_URL}/auth/confirm?token_hash=...&type=signup`.
Recovery emails link to `{NEXT_PUBLIC_SITE_URL}/auth/confirm?token_hash=...&type=recovery&next=/reset-password`.

`NEXT_PUBLIC_SITE_URL` is set to `https://www.ambra-system.com` — the web app URL.

**Implication:** A mobile user who triggers a password reset receives an email that links
to the web app's reset-password page, not the mobile app. This is correct behavior for
Phase 5 (mobile has no password reset flow) but must be addressed before mobile ships
password reset.

**Known gap (future phase):** When a mobile password reset flow is added, either:

- Add a separate mobile deep link handler for the recovery URL, or
- Update the edge function to detect the platform and redirect accordingly

**No action required for Phase 5.**

---

## Summary Table

| Item                                 | Status         | Action Owner                     |
| ------------------------------------ | -------------- | -------------------------------- |
| Service-role isolation               | Confirmed safe | —                                |
| Mobile session storage (SecureStore) | Confirmed safe | —                                |
| Mobile client configuration          | Confirmed safe | —                                |
| Mobile env vars (anon key only)      | Confirmed safe | —                                |
| Email confirmation for mobile signup | Known gap      | Future mobile phase              |
| Password minimum length              | Known gap      | Operational (Supabase dashboard) |
| MFA                                  | Deferred       | Product decision                 |
| Mobile deep link redirect allowlist  | Known gap      | Future mobile auth phase         |
| Recovery email → web app URL         | Known gap      | Future mobile phase              |
| Debug server action auth gating      | Deferred       | Web app concern                  |
