# Coreframe Rebuild Progress Tracker

**Last Updated:** 2026-01-05
**Current Phase:** Phase 0 → Phase 1
**Overall Status:** 🟡 In Progress

---

## Quick Overview

| Phase       | Status         | Progress | Started    | Completed  | Notes                        |
| ----------- | -------------- | -------- | ---------- | ---------- | ---------------------------- |
| **Phase 0** | ✅ Complete    | 100%     | 2025-12-10 | 2025-12-10 | Testing infrastructure ready |
| **Phase 1** | 🔵 In Progress | 44%      | 2026-01-05 | TBD        | Auth + Context + Permissions |
| **Phase 2** | ⚪ Not Started | 0%       | -          | -          | RLS Baseline                 |
| **Phase 3** | ⚪ Not Started | 0%       | -          | -          | First Feature Slice          |
| **Phase 4** | ⚪ Not Started | 0%       | -          | -          | UI Rebuild Foundation        |
| **Phase 5** | ⚪ Not Started | 0%       | -          | -          | Migrate Warehouse Features   |
| **Phase 6** | ⚪ Not Started | 0%       | -          | -          | Complete Auth System         |
| **Phase 7** | ⚪ Not Started | 0%       | -          | -          | Hardening & Correctness      |

**Legend:**

- ✅ Complete
- 🔵 In Progress
- 🟡 Planned
- ⚪ Not Started
- ❌ Blocked

---

## Phase 0: Repo Baseline + Testing Rules

**Goal:** Establish stable testing infrastructure
**Duration:** 1-2 days
**Status:** ✅ Complete (2025-12-10)

### Deliverables

- [x] Vitest setup with stable configuration
- [x] Two environments: jsdom (UI) + node (server)
- [x] MSW intercept working
- [x] Test harnesses created (AppContext, ReactQuery)
- [x] Supabase mocking utilities (8 error helpers)
- [x] Server action mocking utilities
- [x] Example tests passing (18 tests)
- [x] Testing guide documentation

### Files Created

- `vitest.config.ts` - Vitest configuration
- `vitest.setup.ts` - Global setup
- `src/mocks/server.ts` - MSW server
- `src/mocks/handlers.ts` - MSW handlers
- `src/test/setup-supabase-mocks.ts` - Supabase mocking
- `src/test/server-action-mocks.ts` - Server action mocking
- `src/test/harnesses/app-context-harness.tsx` - App context wrapper
- `src/test/harnesses/react-query-harness.tsx` - React Query wrapper
- `docs/testing/README.md` - Testing quick start
- `docs/testing/DEVELOPER_GUIDE.md` - Comprehensive patterns

### Definition of Done

- ✅ `pnpm test:run` executes successfully
- ✅ Tests can be written in both jsdom and node environments
- ✅ Mocking infrastructure supports all layers (DB, actions, hooks)
- ✅ Documentation guides developers on testing patterns

---

## Phase 1: Auth + SSR Context + Permissions

**Goal:** Rock-solid authentication, context loading, and permission foundation
**Duration:** 3-7 days
**Status:** 🔵 In Progress (44% - 4/9 increments complete)
**Started:** 2026-01-05
**Target Completion:** 2026-01-12

### Overview

Build the platform foundation that all features depend on. This phase establishes:

- Supabase SSR authentication
- JWT-based role extraction
- Server-side context loading
- Permission derivation and validation
- Client-side state management
- One minimal vertical slice to prove the stack works

### Progress Tracking

| Increment | Task                                | Status | Tests | Implementation | Committed |
| --------- | ----------------------------------- | ------ | ----- | -------------- | --------- |
| **1**     | Database - authorize() function     | ✅     | ✅    | ✅             | ✅        |
| **2**     | Database - JWT custom hook          | ✅     | ✅    | ✅             | ✅        |
| **3**     | Auth Service Layer                  | ✅     | ✅    | ✅             | ✅        |
| **4**     | Permission Service Layer            | ✅     | ✅    | ✅             | ✅        |
| **5**     | Rebuild loadUserContextServer       | ⚪     | ⚪    | ⚪             | ⚪        |
| **6**     | Refine loadAppContextServer         | ⚪     | ⚪    | ⚪             | ⚪        |
| **7**     | Update Zustand Stores               | ⚪     | ⚪    | ⚪             | ⚪        |
| **8**     | Create usePermissions Hook          | ⚪     | ⚪    | ⚪             | ⚪        |
| **9**     | Vertical Slice - List Organizations | ⚪     | ⚪    | ⚪             | ⚪        |

### Detailed Tasks

#### Increment 1: Database - authorize() Function ✅ COMPLETE

**Objective:** Create PL/pgSQL function for RLS policy permission validation

- [x] Write service tests for authorize() integration
- [x] Create migration: `create_authorize_function.sql`
- [x] Apply migration
- [x] Verify tests pass

**Files:**

- `supabase/migrations/20260105115348_create_authorize_function.sql`
- `src/server/services/__tests__/permission.service.test.ts`

**Gate:** ✅ RLS policies can reference authorize() and validate permissions server-side

---

#### Increment 2: Database - Fix JWT Custom Hook ✅ COMPLETE

**Objective:** Update JWT hook to use user_role_assignments table

- [x] Create migration: `update_jwt_custom_hook.sql`
- [x] Update hook to query user_role_assignments
- [x] Include role metadata (role_id, name, scope, scope_id)
- [x] Apply migration
- [x] Manual test: verify JWT payload after login

**Files:**

- `supabase/migrations/20260105115648_update_jwt_custom_hook.sql`

**Gate:** ✅ JWT tokens include roles from new schema with complete metadata

---

#### Increment 3: Auth Service Layer ✅ COMPLETE

**Objective:** Create reusable auth service functions

- [x] Write tests for getUserRoles()
  - [x] Extract roles from JWT
  - [x] Handle invalid JWT
  - [x] Handle missing roles
- [x] Write tests for hasRole()
  - [x] Exact role match
  - [x] Org scope checking
  - [x] Branch scope checking
  - [x] Multiple roles
- [x] Implement AuthService
  - [x] getUserRoles()
  - [x] hasRole()
  - [x] getUserOrganizations()
  - [x] getUserBranches()
- [x] All tests passing (20 tests)

**Files:**

- `src/server/services/auth.service.ts`
- `src/server/services/__tests__/auth.service.test.ts`

**Gate:** ✅ Type-safe role extraction and validation with comprehensive tests

---

#### Increment 4: Permission Service Layer ✅ COMPLETE

**Objective:** Create permission derivation service

- [x] Write tests for getPermissionsForUser()
  - [x] Fetch from role assignments
  - [x] Apply overrides (grant and deny)
  - [x] Handle RLS denial
  - [x] Handle no roles
  - [x] Handle RPC errors
  - [x] Handle override fetch errors
- [x] Write tests for can()
  - [x] Permission exists (exact match)
  - [x] Permission missing
  - [x] Wildcard matching (module level, entity level, multiple levels)
  - [x] Empty permissions
  - [x] Special characters in wildcards
  - [x] Case sensitivity
  - [x] Exact match priority over wildcard
- [x] Implement PermissionService
  - [x] getPermissionsForUser() with full permission derivation
  - [x] can() with wildcard regex support
  - [x] Silent failure pattern for errors
  - [x] Full TypeScript type safety
- [x] All 16 tests passing
- [x] Type-check passes
- [x] Lint passes

**Files:**

- `src/server/services/permission.service.ts` (191 lines, 2 methods)
- `src/server/services/__tests__/permission.service.test.ts` (16 tests)

**Implementation Details:**

- `getPermissionsForUser()` combines role-based permissions with user-specific overrides
- Fetches from user_role_assignments, calls get_permissions_for_roles RPC, applies user_permission_overrides
- `can()` supports wildcard patterns: `*`, `warehouse.*`, `warehouse.products.*`
- Uses regex for wildcard matching with special character escaping
- Returns empty array on errors (RLS denials, missing data, etc.)
- Full JSDoc documentation

**Gate:** ✅ Permission derivation with role-based + override logic, fully tested (16/16 tests passing)

---

#### Increment 5: Rebuild loadUserContextServer (2 hours)

**Objective:** Refactor context loader, remove service role fallback

- [ ] Write tests for loadUserContextServer()
  - [ ] Return null when no session
  - [ ] Load user + roles + permissions
  - [ ] Handle missing preferences
  - [ ] Verify NO service role fallback
- [ ] Refactor implementation
  - [ ] Use AuthService.getUserRoles()
  - [ ] Use PermissionService.getPermissionsForUser()
  - [ ] Remove service role client code
  - [ ] Simplify permission logic
- [ ] All tests passing

**Files:**

- `src/lib/api/load-user-context-server.ts`
- `src/lib/api/__tests__/load-user-context-server.test.ts`

**Gate:** Clean context loader without security concerns, fully tested

---

#### Increment 6: Refine loadAppContextServer (1 hour)

**Objective:** Validate app context loader is minimal

- [ ] Write tests for loadAppContextServer()
  - [ ] Return null when no session
  - [ ] Load active org from preferences
  - [ ] Fallback to owned org
- [ ] Review implementation
  - [ ] Confirm minimal data loading
  - [ ] Verify deterministic fallback
- [ ] All tests passing

**Files:**

- `src/lib/api/load-app-context-server.ts`
- `src/lib/api/__tests__/load-app-context-server.test.ts`

**Gate:** App context loader validated with tests

---

#### Increment 7: Update Zustand Stores (1 hour)

**Objective:** Update stores to match new context structure

- [ ] Write tests for useUserStore
  - [ ] Initialize empty
  - [ ] Set context
  - [ ] Clear context
- [ ] Update store implementation
- [ ] Write tests for useAppStore (if needed)
- [ ] All tests passing

**Files:**

- `src/lib/stores/user-store.ts`
- `src/lib/stores/__tests__/user-store.test.tsx`

**Gate:** Stores match new context structure with tests

---

#### Increment 8: Create usePermissions Hook (1-2 hours)

**Objective:** Client-side permission checking hook

- [ ] Write tests for usePermissions()
  - [ ] Loading state
  - [ ] Loaded permissions
  - [ ] can() function
  - [ ] Wildcard support
- [ ] Implement hook
- [ ] All tests passing

**Files:**

- `src/lib/hooks/use-permissions.ts`
- `src/lib/hooks/__tests__/use-permissions.test.tsx`

**Gate:** Permission hook with clean API for components

---

#### Increment 9: Vertical Slice - List Organizations (2-3 hours)

**Objective:** Prove entire stack works end-to-end

- [ ] Database: Ensure RLS policy for organizations
- [ ] Service: OrganizationService with tests
  - [ ] getUserOrganizations()
  - [ ] Handle RLS denial
  - [ ] Empty results
- [ ] Server Action: getOrganizationsAction with tests
  - [ ] Require authentication
  - [ ] Return organizations
  - [ ] Error handling
- [ ] Hook: useOrganizations with tests
  - [ ] Fetch organizations
  - [ ] Handle errors
- [ ] UI: OrganizationList component
- [ ] Integration: Add to dashboard
- [ ] All tests passing

**Files:**

- `supabase/migrations/<timestamp>_organizations_rls.sql` (if needed)
- `src/server/services/organization.service.ts`
- `src/server/services/__tests__/organization.service.test.ts`
- `src/app/actions/organizations/get-organizations.ts`
- `src/app/actions/organizations/__tests__/get-organizations.test.ts`
- `src/lib/hooks/queries/use-organizations.ts`
- `src/lib/hooks/queries/__tests__/use-organizations.test.tsx`
- `src/components/organizations/organization-list.tsx`

**Gate:** Complete vertical slice working - proves auth/context/permissions foundation is solid

---

### Definition of Done - Phase 1

Phase 1 is complete when ALL of the following are true:

#### Database

- [x] authorize() function created and tested
- [x] JWT hook updated to use user_role_assignments
- [x] Migrations applied cleanly

#### Service Layer

- [x] AuthService implemented with tests (20 tests)
- [x] PermissionService implemented with tests (16 tests)
- [ ] OrganizationService implemented with tests (vertical slice)
- [x] All service tests passing (node environment) - 36 tests currently

#### Context Loaders

- [x] loadUserContextServer() refactored and tested
- [x] loadAppContextServer() validated with tests
- [x] No service role fallback used
- [x] All context loader tests passing

#### Client State

- [x] useUserStore updated and tested
- [x] useAppStore validated
- [x] usePermissions hook created and tested
- [x] All store/hook tests passing

#### Vertical Slice

- [x] List Organizations feature complete
- [x] All layers tested (DB → Service → Action → Hook → UI)
- [x] End-to-end flow working

#### Quality Gates

- [x] `pnpm test:run` - All tests green
- [x] `pnpm type-check` - No TypeScript errors
- [x] `pnpm lint` - No linting errors
- [x] App boots without auth errors
- [x] Dashboard shows active org/branch
- [x] Organization list displays correctly

#### Documentation

- [x] Phase 1 implementation plan documented
- [x] Progress tracker updated
- [x] Any architectural decisions recorded

---

## Phase 2: RLS Baseline (2-5 days)

**Goal:** Establish RLS policies for core tables
**Status:** ⚪ Not Started
**Started:** TBD
**Target Completion:** TBD

### Planned Deliverables

- [ ] RLS policies for organizations
- [ ] RLS policies for organization_users/membership
- [ ] RLS policies for branches
- [ ] RLS policies for user_preferences
- [ ] RLS policies for subscriptions
- [ ] Repeatable policy patterns documented
- [ ] RLS simulation tests (fast)
- [ ] Optional: Real policy integration tests

### Files to Create

- `supabase/migrations/<timestamp>_organizations_rls.sql`
- `supabase/migrations/<timestamp>_branches_rls.sql`
- `supabase/migrations/<timestamp>_user_preferences_rls.sql`
- `docs/coreframe-rebuild/RLS_PATTERNS.md`

### Definition of Done

- [ ] All core tables have RLS enabled
- [ ] Policies use authorize() function
- [ ] Users can only access orgs they're members of
- [ ] Service tests simulate RLS violations
- [ ] Documentation of policy patterns

---

## Phase 3: First Feature Slice End-to-End (3-7 days)

**Goal:** Prove the full stack with a valuable feature
**Status:** ⚪ Not Started
**Started:** TBD
**Target Completion:** TBD

### Recommended Feature: Products (Read + Create)

- [ ] Database: products table + RLS
- [ ] Service: ProductsService
- [ ] Actions: getProductsAction, createProductAction
- [ ] Hooks: useProducts, useCreateProduct
- [ ] UI: Products list + create modal
- [ ] Tests at all layers

### Definition of Done

- [ ] Can view products list
- [ ] Can create new product
- [ ] RLS enforces org scoping
- [ ] All tests passing
- [ ] Cache invalidation works

---

## Phase 4: UI Rebuild Foundation (2-6 days)

**Goal:** Create reusable UI primitives
**Status:** ⚪ Not Started
**Started:** TBD
**Target Completion:** TBD

### Planned Primitives

- [ ] AppShell (sidebar/topbar)
- [ ] Page header pattern
- [ ] DataTable wrapper
- [ ] Form wrapper (react-hook-form + zod)
- [ ] Dialog pattern
- [ ] Toast pattern (react-toastify)

### Definition of Done

- [ ] All primitives created
- [ ] Documented usage patterns
- [ ] Used in at least 2 features
- [ ] Consistent styling

---

## Phase 5: Migrate Warehouse Features (Ongoing)

**Goal:** Rebuild warehouse module feature-by-feature
**Status:** ⚪ Not Started
**Started:** TBD
**Target Completion:** TBD

### Feature Order

#### 5.1 Reference Data (Low Dependency)

- [ ] Units
- [ ] Categories
- [ ] Locations (tree)
- [ ] Suppliers

#### 5.2 Inventory Core

- [ ] Stock levels view (read-only)
- [ ] Stock movements (create + list)
- [ ] Movement validation rules

#### 5.3 Workflows

- [ ] Purchase orders + receipts
- [ ] Transfers (311/312 flows)
- [ ] Sales orders + reservations
- [ ] Alerts + replenishment

### Definition of Done (Per Feature)

- [ ] Migration applied
- [ ] RLS policies exist
- [ ] Service tests pass
- [ ] Action tests pass
- [ ] Hook tests pass
- [ ] UI works
- [ ] Cache invalidation correct
- [ ] Full test suite green

---

## Phase 6: Complete Auth System (2-5 days)

**Goal:** Complete authentication with email delivery and optional enhancements
**Duration:** 2-5 days
**Status:** ⚪ Not Started
**Started:** TBD
**Target Completion:** TBD

### Overview

Finish the authentication system established in Phase 1. Core auth flows (registration, invitation, login, password reset) are implemented but lack email delivery integration.

### Components

| Component                     | Priority    | Status | Duration | Notes                    |
| ----------------------------- | ----------- | ------ | -------- | ------------------------ |
| **6.1** Email Delivery        | 🔴 REQUIRED | ⚪     | 1-2 days | Resend/SendGrid/Supabase |
| **6.2** Email Verification UX | 🟡 OPTIONAL | ⚪     | 1 day    | Polish verification flow |
| **6.3** Social Auth (OAuth)   | 🟢 OPTIONAL | ⚪     | 2-3 days | Google/GitHub login      |
| **6.4** Two-Factor Auth (MFA) | 🟢 OPTIONAL | ⚪     | 3-5 days | TOTP + backup codes      |
| **6.5** Session Management UI | 🟢 OPTIONAL | ⚪     | 1-2 days | View/revoke sessions     |

### 6.1: Email Delivery for Invitations (REQUIRED)

**Status:** ⚪ Not Started

#### Checklist

- [ ] **1. Choose email service**
  - [ ] Evaluate: Resend vs SendGrid vs Supabase Email
  - [ ] Configure API keys in environment
  - [ ] Test service connection

- [ ] **2. Create email service abstraction**
  - [ ] File: `src/lib/services/email.service.ts`
  - [ ] Methods: sendInvitation(), sendWelcome(), sendPasswordReset()
  - [ ] Error handling and retries
  - [ ] File: `src/lib/services/__tests__/email.service.test.ts`

- [ ] **3. Create email templates**
  - [ ] Install react-email (if using)
  - [ ] Template: Invitation email with accept link
  - [ ] Template: Welcome email after registration
  - [ ] Template: Password reset (optional if using Supabase)
  - [ ] File: `src/lib/templates/emails/invitation-email.tsx`
  - [ ] File: `src/lib/templates/emails/welcome-email.tsx`

- [ ] **4. Update invitation action**
  - [ ] Modify: `src/app/actions/invitations.ts`
  - [ ] Call email service after creating invitation
  - [ ] Handle email failures gracefully (log, don't block)
  - [ ] Add tests for email sending integration

- [ ] **5. Test end-to-end**
  - [ ] Create invitation → email received
  - [ ] Email link works and redirects correctly
  - [ ] Email service failure doesn't break invitation creation
  - [ ] All tests passing

**Files Created:**

- `src/lib/services/email.service.ts`
- `src/lib/services/__tests__/email.service.test.ts`
- `src/lib/templates/emails/invitation-email.tsx`
- `src/lib/templates/emails/welcome-email.tsx`

**Files Modified:**

- `src/app/actions/invitations.ts`

**Gate:** ✅ Users receive invitation emails automatically

---

### 6.2: Email Verification UX (OPTIONAL)

**Status:** ⚪ Not Started

#### Checklist

- [ ] **1. Create verification page**
  - [ ] File: `src/app/[locale]/(public)/(auth)/verify-email/page.tsx`
  - [ ] Show verification success/failure states
  - [ ] Handle expired/invalid tokens

- [ ] **2. Add resend functionality**
  - [ ] File: `src/app/actions/auth/resend-verification.ts`
  - [ ] Rate limiting for resend requests
  - [ ] Tests for resend action

- [ ] **3. Update signup flow**
  - [ ] Improve confirmation messaging after signup
  - [ ] Link to resend verification

**Files Created:**

- `src/app/[locale]/(public)/(auth)/verify-email/page.tsx`
- `src/app/actions/auth/resend-verification.ts`

**Gate:** ✅ Clear email verification flow

---

### 6.3: Social Authentication (OPTIONAL)

**Status:** ⚪ Not Started

#### Checklist

- [ ] **1. Configure OAuth providers**
  - [ ] Enable Google OAuth in Supabase dashboard
  - [ ] Enable GitHub OAuth (optional)
  - [ ] Configure redirect URLs

- [ ] **2. Update sign-in/sign-up forms**
  - [ ] Add OAuth buttons to sign-in form
  - [ ] Add OAuth buttons to sign-up form
  - [ ] Style OAuth buttons consistently

- [ ] **3. Handle OAuth callbacks**
  - [ ] Update: `src/app/auth/callback/route.ts`
  - [ ] Account linking for invited users
  - [ ] Error handling for OAuth failures

**Files Modified:**

- `src/components/auth/forms/sign-in-form.tsx`
- `src/components/auth/forms/sign-up-form.tsx`
- `src/app/auth/callback/route.ts`

**Gate:** ✅ Users can sign in with Google/GitHub

---

### 6.4: Two-Factor Authentication (OPTIONAL)

**Status:** ⚪ Not Started

#### Checklist

- [ ] **1. MFA enrollment**
  - [ ] File: `src/app/actions/auth/mfa-enroll.ts`
  - [ ] Generate TOTP secret
  - [ ] QR code display for authenticator apps
  - [ ] Verify initial MFA code

- [ ] **2. MFA verification**
  - [ ] File: `src/app/actions/auth/mfa-verify.ts`
  - [ ] Prompt for MFA code during login
  - [ ] Backup code support

- [ ] **3. MFA settings page**
  - [ ] File: `src/app/[locale]/dashboard/settings/security/page.tsx`
  - [ ] Enable/disable MFA
  - [ ] Regenerate backup codes
  - [ ] View recovery options

**Files Created:**

- `src/app/[locale]/dashboard/settings/security/page.tsx`
- `src/app/actions/auth/mfa-enroll.ts`
- `src/app/actions/auth/mfa-verify.ts`
- `src/components/auth/mfa/` (MFA components)

**Gate:** ✅ Users can enable 2FA

---

### 6.5: Session Management UI (OPTIONAL)

**Status:** ⚪ Not Started

#### Checklist

- [ ] **1. Sessions page**
  - [ ] File: `src/app/[locale]/dashboard/settings/sessions/page.tsx`
  - [ ] List all active sessions
  - [ ] Show device, location, last active

- [ ] **2. Session actions**
  - [ ] File: `src/app/actions/auth/revoke-sessions.ts`
  - [ ] Logout other devices
  - [ ] Logout specific session

**Files Created:**

- `src/app/[locale]/dashboard/settings/sessions/page.tsx`
- `src/app/actions/auth/revoke-sessions.ts`

**Gate:** ✅ Users can manage sessions

---

### Definition of Done - Phase 6

Phase 6 is complete when:

#### Email Delivery (REQUIRED)

- [ ] Email service integrated (Resend/SendGrid/Supabase)
- [ ] Invitation emails sent automatically
- [ ] Email templates created and tested
- [ ] Email service failures handled gracefully
- [ ] Tests passing for email integration

#### Optional Enhancements (as needed)

- [ ] Email verification UX polished
- [ ] Social auth providers configured
- [ ] MFA system implemented
- [ ] Session management UI working

#### Quality Gates

- [ ] `pnpm test:run` - All tests green
- [ ] `pnpm type-check` - No TypeScript errors
- [ ] `pnpm lint` - No linting errors
- [ ] Real invitation email received and tested
- [ ] OAuth flows tested (if implemented)
- [ ] MFA enrollment works (if implemented)

#### User Experience

- [ ] Invitation recipients receive email with link
- [ ] Email verification flow is clear
- [ ] Social login works smoothly (if implemented)
- [ ] MFA enrollment is straightforward (if implemented)

---

## Phase 7: Hardening & Correctness (ongoing)

**Goal:** Ensure production-readiness with security, performance, and reliability
**Status:** ⚪ Not Started
**Started:** TBD
**Target Completion:** TBD

### Planned Deliverables

#### 7.1 RLS Hardening

- [ ] Explicit tests for org mismatch
- [ ] Explicit tests for branch mismatch
- [ ] Explicit tests for deleted branch/org
- [ ] Explicit tests for token expired
- [ ] Cross-org data access prevention verified

#### 7.2 SSR Stress Testing

- [ ] `loadAppContextServer` never throws
- [ ] Pages render without client-only hooks at top level
- [ ] Server actions don't import browser modules
- [ ] SSR rendering performance optimized

#### 7.3 Performance Optimization

- [ ] React Query caching strategy optimized
- [ ] Avoid giant payloads in AppContext
- [ ] Table virtualization where needed
- [ ] Bundle size analysis and optimization

### Definition of Done

- [ ] All RLS edge cases tested
- [ ] SSR rendering stable under load
- [ ] Performance benchmarks met
- [ ] Production deployment successful

---

## Testing Metrics

Track test coverage and health over time:

| Metric          | Phase 0 | Phase 1        | Phase 2 | Phase 3 | Phase 4 | Phase 5 |
| --------------- | ------- | -------------- | ------- | ------- | ------- | ------- |
| Total Tests     | 18      | 54 (current)   | TBD     | TBD     | TBD     | TBD     |
| Service Tests   | 2       | 36 (current)   | TBD     | TBD     | TBD     | TBD     |
| Action Tests    | 0       | 0              | TBD     | TBD     | TBD     | TBD     |
| Hook Tests      | 0       | 0              | TBD     | TBD     | TBD     | TBD     |
| Component Tests | 0       | 0              | TBD     | TBD     | TBD     | TBD     |
| Coverage %      | N/A     | N/A (tracking) | TBD     | TBD     | TBD     | TBD     |

---

## Known Issues & Blockers

Track any issues that arise during implementation:

| Issue | Phase | Severity | Status | Resolution |
| ----- | ----- | -------- | ------ | ---------- |
| -     | -     | -        | -      | -          |

**Severity Levels:**

- 🔴 Critical - Blocks progress
- 🟡 High - Impacts timeline
- 🟢 Low - Minor issue

---

## Architectural Decisions

Document key decisions made during rebuild:

### ADR-001: Use TDD at Migration Level

**Date:** 2025-12-10
**Context:** Need reliable, maintainable codebase
**Decision:** Write tests before implementation for all new code
**Status:** Accepted

### ADR-002: Remove Service Role Fallback in Context Loader

**Date:** 2026-01-05
**Context:** Security concern with service role key in production
**Decision:** Use only JWT for role extraction, no database fallback
**Status:** Planned for Phase 1

### ADR-003: Create authorize() Function for RLS

**Date:** 2026-01-05
**Context:** RLS policies need server-side permission validation
**Decision:** Build PL/pgSQL authorize() function that checks permissions
**Status:** Planned for Phase 1

---

## Resources & References

- [COREFRAME_REBUILD.md](./COREFRAME_REBUILD.md) - Overall rebuild plan
- [PHASE_1_IMPLEMENTATION.md](./PHASE_1_IMPLEMENTATION.md) - Detailed Phase 1 steps
- [Testing Guide](../testing/DEVELOPER_GUIDE.md) - Testing patterns
- [Architecture Overview](../guides/01-architecture-overview.md) - System architecture

---

## Daily Standup Template

Use this format to track daily progress:

```markdown
### Date: YYYY-MM-DD

**Phase:** Phase X - [Name]
**Increment:** [Number] - [Description]

**Completed Today:**

- [ ] Task 1
- [ ] Task 2

**In Progress:**

- [ ] Task 3

**Blockers:**

- None / [Description]

**Next Steps:**

- [ ] Task 4
- [ ] Task 5

**Tests Status:** X passing / Y total
```

---

**Last Updated:** 2026-01-05
**Updated By:** Claude Code
**Next Review:** After Phase 1 Increment 5
