# Coreframe Rebuild Plan (Step-by-step, works end-to-end from day 1)

> Goal: rebuild **correctly** (SSR-ready, RLS-secure, fast UI), introducing **migrations one-by-one using TDD**, while keeping the app **working at every step**.

This plan assumes:

- Next.js 15 (App Router), React 19
- Supabase (Postgres + RLS)
- Zustand for AppContext/store
- React Query for client data fetching
- Vitest + Testing Library + MSW
- `jsdom` for UI tests, `node` for server tests

---

## Principles (non-negotiable)

### 1) “Working app always”

Every step must end with:

- ✅ `pnpm test:run` green
- ✅ app boots (SSR pages render without auth errors)
- ✅ at least one “happy path” UI route works

### 2) TDD at migration level

For each migration:

1. Write tests (RED)
2. Implement migration (GREEN)
3. Switch usage behind a flag (optional) or direct swap
4. Run full suite + minimal smoke route
5. Commit

### 3) Separate “Domain” from “UI”

- **Domain** (services + policies + validation) must be testable in Node.
- **UI** only consumes hooks/actions, never embeds business logic.

### 4) RLS-first security

- Policies are designed **before** building features.
- Every feature has: **table → RLS → service → action → hook → UI**.

---

## Target architecture (you implement towards this)

### Layers

1. **DB + RLS** (Supabase)
2. **Server services** (pure functions: validate + query)
3. **Server actions** (auth + permissions + call service)
4. **Client hooks** (React Query, caching)
5. **UI** (forms, tables, dialogs)

### Context model (AppContext)

AppContext should provide _only_ global “scope & identity” + a few global lookups:

- `session/user` (id, email, roles)
- `activeOrgId`
- `activeBranchId`
- `availableOrgs` / `availableBranches` (lightweight)
- `subscription/tier` (feature gates)
- `permissions` (optional: cached)
- `locale` / `timezone` (optional)
  Avoid putting large domain datasets (products, movements) into AppContext.

---

## Workstreams (run sequentially in this order)

1. **Security & foundations** (auth, app context, permissions, RLS scaffolding)
2. **Core domain (warehouse minimal slice)** end-to-end
3. **UI rebuild** using the new API layer only
4. **Expand domain** feature-by-feature with migrations + TDD
5. **Hardening** (RLS edge cases, SSR stress, perf)

---

# Phase 0 — Repo baseline + testing rules (1–2 days)

## Deliverables

- ✅ Stable `vitest` setup
- ✅ Two environments:
  - UI tests: `jsdom`
  - Server tests: `@vitest-environment node`
- ✅ MSW intercept works
- ✅ No tests depend on previous “broken UI”

## Add these conventions

- Test file pattern:
  - `*.test.ts` / `*.test.tsx`
- Folder layout:
  - `src/test/harnesses/*`
  - `src/test/factories/*`
  - `src/test/fixtures/*`

## Hard rule

- No tests for “old UI”. You are rebuilding UI—don’t lock in bad patterns.

---

# Phase 1 — Auth + SSR context + permissions (foundation) (3–7 days)

This phase is the “platform”. Don’t build features without it.

## 1.1 Auth model (Supabase SSR)

### Implement

- `createClient()` for:
  - server (SSR)
  - client
  - middleware (optional)
- Decide “source of truth” for session:
  - cookies → server client → user/roles

### Tests (node)

- server client reads cookies and returns session/user
- unauthenticated: returns null user, never throws
- refresh logic (if you have it) doesn’t infinite loop

**Gate**

- A server action can reliably get `user.id` or return `{ success:false, code:'AUTH' }`.

---

## 1.2 Role model (JWT roles / org scopes)

### Implement

- One function that normalizes roles:
  - `getUserRoles(user/session)` → `[{ role, orgId? }]`
- One function that checks:
  - `hasRole(roles, requiredRole, orgId?)`

### Tests (node)

- parses valid claims
- invalid token → empty roles
- org-scoped matching works

**Gate**

- You can enforce org access without any UI.

---

## 1.3 AppContext (SSR loader + client store)

### Implement

- `loadAppContextServer()` returns:
  - user
  - available orgs
  - active org + branch (resolved deterministically)
  - subscription tier
  - minimal module list / feature gates
- `useAppStore` (Zustand) holds:
  - `setContext()`, `clear()`, `setActiveOrg()`, `setActiveBranch()`

### Tests

- `node`: `loadAppContextServer` resolves org/branch fallback chain
- `jsdom`: app-store mutation tests (set/clear/switch)

**Gate**

- You can SSR-render a “Dashboard shell” showing active org/branch.

---

## 1.4 Permission model (RBAC / capabilities)

Decide one approach and stick to it:

### Recommended

- Server: derive permissions based on roles + subscription + modules
- Client: consume a `permissions[]` list and helper `can('warehouse.products.create')`

### Implement

- `getPermissionsForUser({ userId, orgId })` server-side
- `can(permissions, key)` helper

### Tests

- `node`: permission derivation matrix
- `jsdom`: permission hook renders loading → loaded → denies UI

**Gate**

- Every action checks `AUTH` + `PERMISSION` consistently.

---

# Phase 2 — RLS baseline (tables + policies) (2–5 days)

Do this before building data-heavy features.

## 2.1 RLS rules (global pattern)

Create a repeatable policy pattern:

- `organizations`: membership based
- `branches`: belongs to org
- Domain tables: scoped by `organization_id` (+ optional `branch_id`)
- Use a consistent membership table:
  - e.g. `organization_users` (user_id, organization_id, role)

## 2.2 Minimum tables to unlock the app

Start with:

- organizations
- organization_users
- branches
- user_preferences (active org/branch)
- subscriptions (if used)

## 2.3 Tests (simulation first, real later)

### Simulation (fast)

- service tests use mocked Supabase returning `PGRST301` to ensure graceful errors

### Real (later)

- optional: run “policy integration checks” in a dedicated environment

**Gate**

- A user can only read org/branch they belong to (in principle + tested in code).

---

# Phase 3 — First feature slice end-to-end (the “vertical slice”) (3–7 days)

Pick ONE thin, valuable feature to prove the stack:

### Recommended vertical slice

**Warehouse → Products (read list + create)**
Because it exercises:

- RLS scope
- server service
- server action
- react-query
- new UI patterns

## 3.1 DB (migration #1)

- `products` table with `organization_id`
- RLS: members can select/insert/update/delete in their org

## 3.2 Service (migration #1)

- `ProductsService.list(orgId, filters)`
- `ProductsService.create(orgId, input)` with zod validation

### Tests (node)

- list returns data
- create validates
- handles `23505` uniqueness
- handles `PGRST301` RLS denial

## 3.3 Server actions (migration #1)

- `getProductsAction({ orgId, ... })`
- `createProductAction({ orgId, ... })`
  Actions must enforce:

1. auth
2. permission
3. org scope
4. call service
5. return typed `{success,data}`

### Tests (node)

- unauthenticated fails
- permission denied fails
- calls service with correct orgId

## 3.4 Hooks

- `useProductsQuery(orgId)`
- `useCreateProductMutation()` invalidates `['products', orgId]`

### Tests (jsdom)

- query renders loading → list
- mutation invalidates cache

## 3.5 UI (new)

Build only:

- Products list page (fast table)
- Create product modal

### Component tests (jsdom)

- create flow happy path
- validation errors show
- permission-gated button hidden/disabled

**Gate**

- You can log in → choose org → see products → add product → see update.

This proves the whole system works “from start”.

---

# Phase 4 — UI rebuild foundation (2–6 days, can overlap after Phase 3)

You’re rebuilding UI from scratch, so create a **UI kit + layout** first.

## 4.1 New UI constraints

- No heavy state in components
- Tables must be virtualized if large
- React Query handles data; Zustand handles only scope

## 4.2 Build these primitives (once)

- AppShell (sidebar/topbar)
- Page header pattern
- DataTable wrapper
- Form wrapper (react-hook-form + zod)
- Dialog pattern
- Toast pattern

### Tests

- a couple smoke tests only (UI primitives are stable, don’t overtest)

**Gate**

- Any new feature UI uses the same primitives and stays performant.

---

# Phase 5 — Migrate remaining Warehouse features (feature-by-feature) (ongoing)

Each feature repeats the same pipeline:
**DB → RLS → Service → Action → Hook → UI → Tests**

## Recommended order (reduces dependency pain)

### 5.1 Reference data first (low dependency)

1. Units
2. Categories
3. Locations (tree)
4. Suppliers

### 5.2 Inventory core next

5. Stock levels view (read-only)
6. Stock movements (create + list)
7. Movement validation rules

### 5.3 Workflows last

8. Purchase orders + receipts
9. Transfers (311/312 style flows)
10. Sales orders + reservations
11. Alerts + replenishment

For each, define:

- Minimal “v1” scope (must work)
- “v2” improvements later

---

# Phase 6 — Complete Auth System (email delivery + enhancements) (2–5 days)

**Goal:** Complete authentication with email delivery, verification UX, and optional security enhancements

**Status:** Not Started

This phase finishes the authentication system that was established in Phase 1. While core auth flows (registration, invitation, login, password reset) are fully implemented, they lack email delivery integration.

## 6.1 Email Delivery for Invitations (REQUIRED - 1-2 days)

### Implement

- Integrate email service (Resend, SendGrid, or Supabase Email)
- Create email templates:
  - Invitation email with accept link
  - Welcome email after successful registration
  - Optional: Password reset email (if not using Supabase native)
- Update `createInvitationAction()` to send email after creating invitation record
- Add email configuration to environment variables

### Tests (node)

- Email service integration tests (mock service)
- Invitation creation triggers email send
- Email contains correct invitation link and token
- Email service failures handled gracefully (invitation still created)

### Files to Create/Modify

- `src/lib/services/email.service.ts` - Email service abstraction
- `src/lib/services/__tests__/email.service.test.ts` - Email tests
- `src/lib/templates/emails/invitation-email.tsx` - Email template (React Email)
- Update: `src/app/actions/invitations.ts` - Add email sending

**Gate:** Users receive invitation emails automatically when invited to organizations

---

## 6.2 Email Verification UX (OPTIONAL - 1 day)

### Implement

- Create explicit "Email Verification" page
- Add "Resend Verification Email" functionality
- Update signup confirmation messaging
- Handle verification callback states (success, expired, invalid)

### Tests (jsdom)

- Verification success page renders
- Resend verification button works
- Error states display correctly

### Files to Create

- `src/app/[locale]/(public)/(auth)/verify-email/page.tsx` - Verification page
- `src/app/actions/auth/resend-verification.ts` - Resend action

**Gate:** Clear email verification flow for new users

---

## 6.3 Social Authentication (OPTIONAL - 2-3 days)

### Implement

- Configure Google OAuth provider in Supabase
- Configure GitHub OAuth provider (optional)
- Update sign-in/sign-up pages with OAuth buttons
- Handle OAuth callback and account linking
- Merge invited users with OAuth accounts

### Tests (node + jsdom)

- OAuth sign-in flow
- Account linking when email matches invitation
- Error handling for OAuth failures

### Files to Create/Modify

- Update: `src/components/auth/forms/sign-in-form.tsx` - Add OAuth buttons
- Update: `src/components/auth/forms/sign-up-form.tsx` - Add OAuth buttons
- Update: `src/app/auth/callback/route.ts` - Handle OAuth providers

**Gate:** Users can sign in with Google/GitHub

---

## 6.4 Two-Factor Authentication (OPTIONAL - 3-5 days)

### Implement

- TOTP-based MFA using Supabase MFA
- Backup codes generation and storage
- MFA settings page (enable/disable, regenerate backup codes)
- Enforce MFA for specific roles (e.g., org_owner)

### Tests (node + jsdom)

- MFA enrollment flow
- MFA verification during login
- Backup code recovery
- MFA enforcement by role

### Files to Create

- `src/app/[locale]/dashboard/settings/security/page.tsx` - Security settings
- `src/app/actions/auth/mfa-enroll.ts` - MFA enrollment
- `src/app/actions/auth/mfa-verify.ts` - MFA verification
- `src/components/auth/mfa/` - MFA components

**Gate:** Users can enable 2FA and use backup codes

---

## 6.5 Session Management UI (OPTIONAL - 1-2 days)

### Implement

- "Active Sessions" page showing all user sessions
- "Logout Other Devices" functionality
- Session details (device, location, last active)

### Tests (jsdom)

- Session list renders
- Logout other devices works
- Current session marked clearly

### Files to Create

- `src/app/[locale]/dashboard/settings/sessions/page.tsx` - Sessions page
- `src/app/actions/auth/revoke-sessions.ts` - Revoke action

**Gate:** Users can view and manage their sessions

---

## Definition of Done - Phase 6

Phase 6 is complete when:

### Email Delivery (REQUIRED)

- [x] Email service integrated (Resend/SendGrid/Supabase)
- [x] Invitation emails sent automatically
- [x] Email templates created and tested
- [x] Email service failures handled gracefully
- [x] Tests passing for email integration

### Optional Enhancements (as needed)

- [ ] Email verification UX polished
- [ ] Social auth providers configured
- [ ] MFA system implemented
- [ ] Session management UI working

### Quality Gates

- [x] `pnpm test:run` - All tests green
- [x] `pnpm type-check` - No TypeScript errors
- [x] `pnpm lint` - No linting errors
- [x] Real invitation email received and tested
- [x] OAuth flows tested (if implemented)
- [x] MFA enrollment works (if implemented)

### User Experience

- [x] Invitation recipients receive email with link
- [x] Email verification flow is clear
- [x] Social login works smoothly (if implemented)
- [x] MFA enrollment is straightforward (if implemented)

---

# Phase 7 — Hardening & Correctness (after Phase 6)

## 7.1 RLS Hardening

- explicit tests for:
  - org mismatch
  - branch mismatch
  - deleted branch/org
  - token expired

## 7.2 SSR Stress

- ensure:
  - `loadAppContextServer` never throws
  - pages render without client-only hooks at top level
  - server actions don't import browser modules

## 7.3 Performance

- React Query caching strategy
- avoid giant payloads in AppContext
- table virtualization where needed

---

# Cross-cutting test strategy (fast + scalable)

## Test pyramid

1. **Node service tests** (most)
2. **Node server action tests**
3. **jsdom hook tests**
4. **jsdom UI component tests**
5. **Very few integration tests** (critical flows only)

## What NOT to do

- Don’t write dozens of fragile “integration UI tests” early.
- Don’t couple tests to CSS/dom structure; test behavior.

---

# Definition of Done for each migration

A migration is “done” only if:

- ✅ DB migration applied cleanly
- ✅ RLS policies exist (or explicitly deferred with reason)
- ✅ Service tests cover success + error + RLS denial
- ✅ Action tests cover auth + permission + service call
- ✅ UI works with new primitives
- ✅ Cache invalidation correct
- ✅ `pnpm test:run` green

---

# Suggested “Day 1” execution (start here)

1. Lock Phase 1 outputs:
   - stable AppContext SSR loader
   - stable permission checks
   - consistent server action response type
2. Choose the vertical slice:
   - Products list + create
3. Do one migration end-to-end using TDD
4. Only then start migrating other features

---

# Checklist of files you will end up with (per feature)

- `supabase/migrations/<timestamp>_<feature>.sql`
- `src/server/services/<feature>.service.ts`
- `src/server/services/__tests__/<feature>.service.test.ts` (**node**)
- `src/app/actions/<feature>/<action>.ts`
- `src/app/actions/<feature>/__tests__/<action>.test.ts` (**node**)
- `src/lib/hooks/queries/use-<feature>.ts`
- `src/lib/hooks/queries/__tests__/use-<feature>.test.tsx` (**jsdom**)
- `src/modules/<feature>/components/...`
- `src/modules/<feature>/components/__tests__/...test.tsx` (**jsdom**)

---

## If you want: I can turn this into a “Migration Tracker”

A markdown table you can keep in the repo (feature → db → rls → service → action → hook → ui → done),
so you always know what’s implemented and what’s pending.
