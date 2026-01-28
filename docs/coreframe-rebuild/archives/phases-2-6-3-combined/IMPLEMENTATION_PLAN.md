# Combined Phases Implementation Plan

# Auth System, RLS Foundation & Organization Management

**Version:** 3.0 (Realistic Timeline)
**Created:** 2026-01-14
**Estimated Duration:** 2-3 days
**Target:** End of this week

---

## Implementation Order

**Day 1: Auth System** - Email + login + verification (6-8 hours)
**Day 2: RLS + Organization Backend** - Database security + services (6-8 hours)
**Day 3: Organization UI + Admin Tools** - Complete feature + monitoring (6-8 hours)

---

## Day 1: Complete Auth System

**Goal:** Production-ready authentication with email delivery
**Duration:** 6-8 hours

### Morning (3-4 hours): Email Service

**Setup Resend + React Email**

- Install packages: `npm install resend react-email @react-email/components`
- Configure API key in `.env`
- Create EmailService abstraction with 4 templates:
  - Invitation email
  - Welcome email
  - Password reset email
  - Email verification

**Files to Create:**

- `src/lib/services/email.service.ts`
- `src/lib/templates/emails/*.tsx` (4 templates)
- Basic tests for email service

### Afternoon (3-4 hours): Auth Flow

**Email Verification**

- Verification page (`/verify-email`) with success/expired/invalid states
- Resend verification action with rate limiting
- Integration with signup flow

**Auth Pages Polish**

- Sign-in: Remember me, show password, loading states
- Sign-up: Password strength, real-time validation, terms
- Password reset: Forgot + reset pages with token validation

**Optional:** OAuth setup (Google)

**Files to Create/Modify:**

- `src/app/[locale]/(public)/(auth)/verify-email/page.tsx`
- `src/app/actions/auth/resend-verification.ts`
- `src/components/auth/forms/sign-in-form.tsx`
- `src/components/auth/forms/sign-up-form.tsx`
- `src/app/[locale]/(public)/(auth)/forgot-password/page.tsx`
- `src/app/[locale]/(public)/(auth)/reset-password/page.tsx`

**Tests:** Write focused tests as you build (30-40 tests)

---

## Day 2: RLS + Organization Backend

**Goal:** Secure database + complete organization service layer
**Duration:** 6-8 hours

### Morning (3-4 hours): RLS Foundation

**RLS Policies for All Core Tables**

- Organizations (SELECT, INSERT, UPDATE, DELETE)
- Organization_users (membership)
- Branches (org-scoped)
- Users, user_preferences, user_permission_overrides
- Roles, permissions, role_permissions, user_role_assignments
- Invitations (invited user + admins)
- Activity_logs (immutable audit trail)

**Files to Create:**

- `supabase/migrations/20260114_complete_rls.sql` (single migration with all policies)
- `src/test/rls-simulation.ts` (testing utilities)
- `docs/coreframe-rebuild/RLS_PATTERNS.md` (documentation)

**Tests:** RLS validation tests (50+ scenarios)

### Afternoon (3-4 hours): Organization Service Layer

**Services (with full CRUD + tests)**

- OrganizationService (14 methods: CRUD, members, logo, stats)
- RoleService (9 methods: CRUD, permissions)
- MemberService (8 methods: CRUD, invitations, roles)

**Server Actions**

- Organization actions (6 actions)
- Role actions (5 actions)
- Member actions (6 actions)

**Files to Create:**

- `src/server/services/organization.service.ts`
- `src/server/services/role.service.ts`
- `src/server/services/member.service.ts`
- `src/app/actions/organizations/*.ts`
- `src/app/actions/roles/*.ts`
- `src/app/actions/members/*.ts`
- All test files

**Tests:** Service + action tests (80-100 tests)

---

## Day 3: Organization UI + Admin Tools

**Goal:** Complete organization management + admin dashboard
**Duration:** 6-8 hours

### Morning (3-4 hours): Organization Management UI

**React Query Hooks**

- Organization hooks (8 hooks: queries + mutations)
- Role hooks (6 hooks)
- Member hooks (6 hooks)

**Organization Pages**

- List page with create dialog (`/organizations`)
- Detail + settings page (`/organizations/[orgId]`)
- Role management page (`/organizations/[orgId]/roles`)
- Member management page (`/organizations/[orgId]/members`)

**Account Settings**

- Profile page (`/account/profile`)
- Preferences page (`/account/preferences`)
- Security page (`/account/security`)

**Files to Create:**

- `src/lib/hooks/v2/use-organizations.ts`
- `src/lib/hooks/v2/use-roles.ts`
- `src/lib/hooks/v2/use-members.ts`
- `src/app/[locale]/(dashboard-v2)/organizations/**/*.tsx`
- `src/app/[locale]/(dashboard-v2)/account/**/*.tsx`
- `src/components/organizations/*.tsx`

**Tests:** UI component tests (40-50 tests)

### Afternoon (3-4 hours): Admin Tools

**Admin Dashboard**

- Admin layout + navigation
- Dashboard home with stats
- User management (table, search, suspend, password reset)
- Organization monitoring (table, stats, audit logs, suspend)
- Permission validator (test permissions, view derivation)
- Activity log viewer (filters, search)
- System health monitor

**Files to Create:**

- `src/app/[locale]/(dashboard-v2)/admin/**/*.tsx`
- Admin service files
- Admin components

**Tests:** Admin tests (30-40 tests)

---

## Testing Strategy

**Total Tests:** 200-250 (focused, not excessive)

- Day 1 Auth: 30-40 tests
- Day 2 RLS + Services: 130-150 tests
- Day 3 UI + Admin: 70-90 tests

**Approach:**

- Write tests alongside features (TDD)
- Focus on critical paths, not 100% coverage
- Integration tests > unit tests for speed
- Use RLS simulation utilities for database tests

**Coverage Targets:**

- Services: 80%+
- Actions: 70%+
- Critical flows: 90%+

---

## Mobile-First API Design

All APIs designed for future React Native app:

- Paginated responses (limit + offset)
- Minimal data transfer (field selection)
- Idempotent actions (offline sync)
- Batch operations support
- Incremental sync (lastSyncAt)
- Optimized image sizes
- Conservative cache strategy

---

## Definition of Done

**Day 1 Complete:**

- [ ] Users can register and receive emails
- [ ] Sign-in, password reset, email verification working
- [ ] 30-40 auth tests passing

**Day 2 Complete:**

- [ ] RLS on all 12+ core tables
- [ ] Organization/Role/Member services complete
- [ ] All server actions working
- [ ] 130-150 tests passing

**Day 3 Complete:**

- [ ] Organization management UI complete
- [ ] Role + member management working
- [ ] Account settings complete
- [ ] Admin dashboard operational
- [ ] 70-90 UI/admin tests passing

**Final Gates:**

- [ ] All 200-250 tests passing
- [ ] No TypeScript errors
- [ ] No linting errors
- [ ] All pages SSR correctly
- [ ] Ready for production

---

**Version:** 3.0
**Last Updated:** 2026-01-14
**Timeline:** 2-3 days
**Status:** Ready for Implementation
