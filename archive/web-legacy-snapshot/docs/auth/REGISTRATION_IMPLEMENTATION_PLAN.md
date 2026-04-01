# Registration & Invitations – Implementation Plan (No Database Triggers)

## Executive Summary

Based on analysis of the current Next.js 15 + Supabase codebase and the fact that existing database triggers are broken and non-functional, this document outlines a comprehensive implementation plan for a robust registration system that supports both regular sign-up and invitation-based registration flows using **pure Server Actions approach**.

## Current State Analysis

### Existing Implementation Strengths

- ✅ Database schema supports invitations with proper relationships
- ✅ RLS policies exist for security
- ✅ Permission-based authorization system is in place
- ✅ Email validation and invitation preview functionality
- ✅ Comprehensive user roles and permissions system
- ✅ Multi-tenant architecture with organizations and branches
- ✅ Supabase Auth handles email confirmation natively

### Critical Issues Identified

- ❌ **Database triggers are broken and not working**
- ❌ **No automatic user creation after email confirmation**
- ❌ **Manual database operations required for user setup**
- ❌ **Race conditions possible without proper coordination**
- ❌ **No atomic user creation and organization assignment**
- ❌ **Missing coordination between Supabase Auth and application data**

### Key Problems to Solve

1. **Email confirmation must gate all data creation** (atomic behavior)
2. **Single-organization rule** for invitation path must be enforced
3. **System needs to be idempotent** and handle retries safely
4. **RLS-friendly implementation** with minimal client-side database access
5. **Enterprise-grade security** with comprehensive audit trails

## Implementation Approaches Analysis

### Option 1: Pure Client-Side Implementation

**Description**: Handle all registration logic in React components and client-side JavaScript.

**Pros:**

- Simple to implement
- Follows current patterns
- Easy to debug and modify

**Cons:**

- Security concerns with client-side validation
- Potential race conditions
- Complex error handling
- Difficult to ensure atomicity
- Not suitable for enterprise use

**Verdict**: ❌ **Not recommended** for enterprise use

---

### Option 2: Database Trigger Implementation

**Description**: Handle all registration logic entirely within PostgreSQL triggers and functions.

**Pros:**

- Atomic operations guaranteed
- Secure (server-side only)
- Centralized business logic
- Excellent performance

**Cons:**

- ❌ **CURRENT TRIGGERS ARE BROKEN AND NOT WORKING**
- Limited error handling capabilities
- Debugging difficulties
- Inflexible for complex business rules
- Hard to maintain and extend

**Verdict**: ❌ **Not viable** (current implementation is broken)

---

### Option 3: Pure Server Action Implementation (RECOMMENDED)

**Description**: Handle all registration logic in Next.js Server Actions with manual database operations and coordination with Supabase Auth.

**Pros:**

- ✅ **Full control over business logic**
- ✅ **Excellent error handling and debugging**
- ✅ **Easy to test and maintain**
- ✅ **Flexible for complex requirements**
- ✅ **No dependency on broken triggers**
- ✅ **Enterprise-grade transaction control**
- ✅ **Perfect for current codebase state**

**Cons:**

- Requires careful transaction management
- Need to handle race conditions manually
- More complex coordination with Supabase Auth
- Need to implement cleanup mechanisms

**Verdict**: ✅ **RECOMMENDED APPROACH** (given broken triggers)

---

### Option 4: Webhook-Based Implementation

**Description**: Use Supabase Auth webhooks to trigger user creation after email confirmation.

**Pros:**

- Event-driven architecture
- Automatic triggers on auth events
- Good separation of concerns

**Cons:**

- Additional infrastructure complexity
- Webhook reliability concerns
- Harder to debug and test
- Network dependency

**Verdict**: ⚠️ **Possible alternative** but more complex

## Recommended Solution: Pure Server Action Implementation

### Architecture Decision Rationale

Given that database triggers are broken and non-functional, the Pure Server Action approach is the most practical and enterprise-ready solution:

1. **Server Actions** handle ALL registration logic (validation, user creation, org assignment)
2. **Email confirmation callback** coordinates with Server Actions for post-confirmation setup
3. **Database transactions** ensure atomicity without relying on triggers
4. **RLS policies** provide defense-in-depth security
5. **Comprehensive error handling** with proper logging and recovery
6. **Testable and maintainable** without database-side complexity

### Enterprise Authentication Patterns Implemented

Based on research of Auth0, Okta, and WorkOS implementations:

- **Email Invitation Flows**: Administrator invites users via email with secure tokens
- **Just-in-Time Provisioning**: User accounts created on first access
- **Domain-Based Auto-Join**: Optional feature for viral growth
- **Self-Service Onboarding**: Users can manage their own invitations
- **RBAC Integration**: Role assignments through invitation system
- **Audit Trail**: Complete logging of all authentication events

## Core Implementation Flows (No Database Triggers)

### 1. Regular Registration Flow

```
1. User submits registration form
2. Client-side validation (email format, password strength)
3. Server action validates data and checks for existing users
4. Supabase Auth signUp called with user metadata (including pending_setup flag)
5. Confirmation email sent to user
6. User clicks confirmation link
7. Email confirmation callback triggered
8. Server Action detects new confirmed user and executes atomically:
   ├── Creates public.users entry
   ├── Creates personal organization
   ├── Creates organization_profiles entry
   ├── Creates default branch
   ├── Creates user_preferences pointing to personal org
   ├── Assigns org_owner role
   └── Marks user setup as complete
9. User redirected to dashboard
```

### 2. Invitation-Based Registration Flow

```
1. Admin creates invitation for email address
2. Invitation token generated and stored
3. Invitation email sent with secure link
4. Invitee clicks link and sees invitation preview
5. Invitee submits registration form (email pre-filled and locked)
6. Server validates invitation token and email match
7. Supabase Auth signUp called with invitation metadata (including invitation_id)
8. Confirmation email sent to user
9. User clicks confirmation link
10. Email confirmation callback triggered
11. Server Action detects invitation-based user and executes atomically:
    ├── Creates public.users entry
    ├── Creates user_preferences pointing to invited org/branch
    ├── Assigns role from invitation
    ├── Marks invitation as accepted
    ├── Records acceptance timestamp
    └── Marks user setup as complete
12. User redirected to organization dashboard
```

## Detailed Implementation Plan

### Phase 1: Remove Broken Triggers & Database Foundation (Priority: High)

#### 1.1 Remove Broken Database Triggers

**File**: New migration `remove_broken_auth_triggers.sql`

**Changes Needed**:

```sql
-- Drop existing broken trigger: on_auth_user_created
-- Drop existing broken function: handle_new_auth_user()
-- Clean up any orphaned trigger artifacts
-- Ensure clean state for Server Action implementation
```

**Rationale**:

- Current triggers are broken and not working
- Server Actions will handle all user creation logic
- Clean slate approach for better maintainability

#### 1.2 Add Database Constraints and Indexes

**File**: New migration `add_invitation_constraints.sql`

**Changes Needed**:

```sql
-- Add unique constraint on invitation tokens
-- Add indexes for invitation queries (email, token, status)
-- Add proper foreign key constraints
-- Add check constraints for invitation expiry
-- Add user setup tracking fields to auth.users metadata
```

#### 1.3 Enhance RLS Policies

**File**: New migration `enhance_invitation_rls_policies.sql`

**Security Improvements**:

- Add invitation-specific RLS policies
- Ensure users can only see their own invitations
- Prevent unauthorized invitation creation
- Add policies for user setup process

### Phase 2: Server-Side Logic Enhancement (Priority: High)

#### 2.1 NEW: Post-Confirmation User Setup Handler

**File**: `src/app/auth/callback/route.ts` (major rewrite)

**Core Functionality**:

```typescript
// NEW: Detect if user needs setup after email confirmation
// NEW: Handle regular registration user setup atomically
// NEW: Handle invitation-based registration user setup
// NEW: Coordinate between Supabase Auth and application database
// NEW: Comprehensive error handling and recovery
// NEW: Audit logging of all setup events
// NEW: Idempotent operations for safe retries
```

**This is a completely new implementation** since no triggers exist

#### 2.2 Enhanced Sign-Up Action

**File**: `src/app/actions/auth/sign-up.ts`

**Enhancements**:

```typescript
// MODIFIED: Only handles Supabase Auth signUp (no database creation)
// NEW: Stores setup metadata in auth.users.raw_user_meta_data
// NEW: Better invitation validation
// NEW: Comprehensive error handling
// NEW: Audit logging
// NEW: Rate limiting
// NEW: Setup coordination flags
```

#### 2.3 NEW: User Setup Server Action

**File**: `src/app/actions/auth/setup-user.ts` (completely new)

**Core Functionality**:

```typescript
// NEW: Complete user setup after email confirmation
// NEW: Handle regular vs invitation-based flows
// NEW: Atomic database operations with transactions
// NEW: Organization and user_preferences creation
// NEW: Role assignments and permissions
// NEW: Idempotent operations
// NEW: Comprehensive error handling and rollback
```

#### 2.4 Enhanced Invitation Management

**File**: `src/app/actions/invitations.ts`

**Improvements**:

```typescript
// Better permission validation
// Comprehensive audit logging
// Invitation preview with organization details
// Bulk invitation support
// Invitation template customization
```

### Phase 3: User Experience Improvements (Priority: Medium)

#### 3.1 Enhanced Sign-Up Form

**File**: `src/components/auth/forms/sign-up-form.tsx`

**UX Enhancements**:

```typescript
// Better invitation preview display
// Real-time email validation
// Clear error messaging
// Loading states and feedback
// Accessibility improvements
```

#### 3.2 Invitation Preview Page

**File**: `src/app/[locale]/invite/[token]/page.tsx`

**Improvements**:

```typescript
// Better error handling for invalid/expired invitations
// Clearer organization information display
// Better mobile responsiveness
// Social proof elements (org member count, etc.)
```

#### 3.3 Email Validation API

**File**: `src/app/actions/email-validation.ts` and `src/lib/api/email-validation.ts`

**Enhancements**:

```typescript
// Domain-based validation rules
// Integration with invitation system
// Better error handling
// Caching for performance
```

### Phase 4: Audit Logging & Monitoring (Priority: Medium)

#### 4.1 Comprehensive Audit System

**Files**:

- `src/lib/audit/invitation-logger.ts`
- `src/lib/audit/user-setup-logger.ts` (NEW)
- New migration for audit tables

**Features**:

```sql
-- User setup events (NEW - critical for no-trigger approach)
-- Registration completion tracking (NEW)
-- Invitation creation events
-- Invitation acceptance/rejection events
-- Failed registration attempts
-- Security events (token validation failures)
-- Performance metrics
-- Setup failure and retry events (NEW)
```

#### 4.2 Admin Dashboard Enhancements

**File**: `src/app/[locale]/dashboard/organization/users/invitations/page.tsx`

**Admin Features**:

```typescript
// User setup status monitoring (NEW - critical for debugging)
// Registration completion rates (NEW)
// Failed setup recovery tools (NEW)
// Invitation analytics dashboard
// Bulk invitation management
// Invitation template editor
// User onboarding metrics
// Security event monitoring
```

### Phase 5: Performance & Scalability (Priority: Low)

#### 5.1 Database Optimizations

- Add database indexes for common queries
- Implement invitation cleanup job
- Add connection pooling optimizations
- Query performance monitoring

#### 5.2 Caching Strategy

- Implement Redis caching for invitation validation
- Cache organization details for invitation preview
- Cache user permissions for faster authorization

#### 5.3 Rate Limiting

- Implement rate limiting for invitation creation
- Add rate limiting for registration attempts
- DDoS protection for public endpoints

## Security Implementation Details

### Token Security

- **Generation**: Cryptographically secure random tokens (256-bit)
- **Storage**: Hashed tokens in database with salt
- **Expiration**: 7-day default, configurable per organization
- **Validation**: Constant-time comparison to prevent timing attacks

### Email Security

- **Validation**: RFC 5322 compliant email validation
- **Domain Filtering**: Optional domain allowlist/blocklist
- **Rate Limiting**: Prevent email spam and abuse
- **Confirmation Required**: No data creation without email confirmation

### Access Control

- **RLS Policies**: Database-level security for all tables
- **Permission Validation**: Server-side permission checks
- **Session Management**: Secure JWT tokens with rotation
- **Audit Logging**: Complete trail of all security events

### Enterprise Compliance

- **GDPR Compliance**: User data export and deletion
- **SOC 2 Ready**: Comprehensive audit logging
- **RBAC Support**: Full role-based access control
- **Data Isolation**: Multi-tenant data separation

## Data Model Enhancements (No Database Triggers)

### Remove Broken Triggers First

```sql
-- CRITICAL: Remove all broken triggers and functions
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
DROP FUNCTION IF EXISTS public.handle_new_auth_user();
DROP FUNCTION IF EXISTS expire_old_invitations();
DROP FUNCTION IF EXISTS cleanup_old_invitation_events();
```

### Invitation Table Improvements

```sql
-- Add constraints for better data integrity
ALTER TABLE invitations
ADD CONSTRAINT unique_pending_invitation
UNIQUE (email, organization_id, status)
WHERE status = 'pending';

-- Add index for performance
CREATE INDEX idx_invitations_token_hash ON invitations USING hash(token);
CREATE INDEX idx_invitations_email_status ON invitations(email, status);
CREATE INDEX idx_invitations_expires_at ON invitations(expires_at) WHERE status = 'pending';
```

### User Setup Tracking (NEW - Critical for No-Trigger Approach)

```sql
-- Track user setup status since no triggers handle this automatically
CREATE TABLE user_setup_status (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  setup_completed BOOLEAN DEFAULT FALSE,
  setup_type TEXT CHECK (setup_type IN ('regular', 'invitation')),
  invitation_id UUID REFERENCES invitations(id),
  setup_started_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  setup_completed_at TIMESTAMP WITH TIME ZONE,
  setup_errors JSONB,
  retry_count INTEGER DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Performance indexes
CREATE INDEX idx_user_setup_status_user_id ON user_setup_status(user_id);
CREATE INDEX idx_user_setup_status_completed ON user_setup_status(setup_completed);
CREATE INDEX idx_user_setup_incomplete ON user_setup_status(setup_completed, setup_started_at)
WHERE setup_completed = FALSE;
```

### User Preferences Table Enhancements

```sql
-- Ensure proper foreign key relationships
ALTER TABLE user_preferences
ADD CONSTRAINT fk_user_preferences_organization
FOREIGN KEY (default_organization_id) REFERENCES organizations(id) ON DELETE CASCADE;

ALTER TABLE user_preferences
ADD CONSTRAINT fk_user_preferences_branch
FOREIGN KEY (default_branch_id) REFERENCES branches(id) ON DELETE SET NULL;
```

### Audit Tables (Enhanced for No-Trigger Approach)

```sql
-- Create comprehensive audit logging
CREATE TABLE user_setup_audit_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id),
  setup_step TEXT NOT NULL,
  event_type TEXT NOT NULL,
  event_data JSONB,
  success BOOLEAN,
  error_message TEXT,
  ip_address INET,
  user_agent TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE invitation_audit_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  invitation_id UUID REFERENCES invitations(id),
  event_type TEXT NOT NULL,
  event_data JSONB,
  user_id UUID REFERENCES users(id),
  ip_address INET,
  user_agent TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indexes for audit queries
CREATE INDEX idx_user_setup_audit_user_id ON user_setup_audit_log(user_id);
CREATE INDEX idx_user_setup_audit_created_at ON user_setup_audit_log(created_at);
CREATE INDEX idx_invitation_audit_invitation_id ON invitation_audit_log(invitation_id);
```

## Testing Strategy

### Unit Tests (Updated for No-Trigger Approach)

- Server action user setup logic (NEW - critical)
- Server action validation logic
- Email validation utilities
- Permission checking functions
- User setup atomic operations (NEW)
- Setup failure recovery mechanisms (NEW)

### Integration Tests (Updated for No-Trigger Approach)

- Complete registration flows (regular + invitation)
- Email confirmation process
- **Server Action user setup execution** (replaces trigger tests)
- **Setup coordination between auth and app database** (NEW)
- RLS policy enforcement
- **Setup retry and idempotency** (NEW)

### End-to-End Tests

- Full user journey from invitation to login
- Admin invitation management workflow
- **User setup completion monitoring** (NEW)
- Error handling scenarios
- **Setup failure and recovery scenarios** (NEW)
- Performance under load

### Security Tests

- SQL injection prevention
- XSS protection
- CSRF token validation
- Rate limiting effectiveness
- **Setup process race condition protection** (NEW)

## Error Handling Strategy

### User-Facing Errors

```typescript
// Clear, actionable error messages
const ERROR_MESSAGES = {
  INVITATION_EXPIRED:
    "This invitation has expired. Please contact your administrator for a new invitation.",
  INVITATION_USED: "This invitation has already been accepted.",
  EMAIL_MISMATCH: "This invitation was sent to a different email address.",
  INVALID_TOKEN: "This invitation link is invalid or has been tampered with.",
  EMAIL_ALREADY_REGISTERED: "An account with this email already exists. Try signing in instead.",
};
```

### Developer/Admin Errors

```typescript
// Detailed error information for debugging
interface DetailedError {
  code: string;
  message: string;
  details: {
    timestamp: string;
    userId?: string;
    invitationId?: string;
    stackTrace?: string;
    metadata: Record<string, any>;
  };
}
```

### Error Recovery

- Automatic retry mechanisms for transient failures
- Graceful degradation for non-critical features
- Clear escalation paths for manual intervention
- Comprehensive logging for post-mortem analysis

## Performance Considerations

### Database Performance

- Optimized indexes for common query patterns
- Connection pooling for high concurrency
- Query optimization for invitation lookups
- Cleanup jobs for expired data

### Frontend Performance

- Lazy loading of invitation details
- Optimistic UI updates where appropriate
- Caching of organization metadata
- Progressive enhancement for accessibility

### Email Performance

- Asynchronous email sending
- Email template caching
- Delivery status tracking
- Fallback delivery mechanisms

## Deployment Strategy

### Database Migrations

1. Create new migration files in order
2. Test migrations on staging environment
3. Backup production before deployment
4. Apply migrations during maintenance window
5. Verify data integrity post-migration

### Code Deployment

1. Deploy server actions first
2. Update database triggers
3. Deploy frontend changes
4. Enable new features via feature flags
5. Monitor for errors and performance issues

### Rollback Plan

- Database migration rollback scripts
- Feature flag toggles for quick disabling
- Monitoring alerts for failure detection
- Documented recovery procedures

## Monitoring & Alerting

### Key Metrics

- Registration success/failure rates
- Invitation acceptance rates
- Email delivery rates
- Database query performance
- Authentication error rates

### Alerts

- High registration failure rate
- Database trigger failures
- Email delivery failures
- Security events (invalid tokens, brute force)
- Performance degradation

### Dashboards

- Real-time registration metrics
- Invitation funnel analysis
- User onboarding progress
- Security event monitoring
- System health overview

## Enterprise Features Roadmap

### Phase 1 (Immediate)

- ✅ Basic invitation flow
- ✅ Email confirmation
- ✅ Organization assignment
- ✅ Role-based access

### Phase 2 (Short-term)

- 🔄 Domain-based auto-join
- 🔄 Bulk invitation management
- 🔄 Invitation templates
- 🔄 Advanced audit logging

### Phase 3 (Medium-term)

- 📋 SCIM provisioning integration
- 📋 SSO integration for invitations
- 📋 Advanced user lifecycle management
- 📋 Compliance reporting

### Phase 4 (Long-term)

- 📋 AI-powered user insights
- 📋 Advanced security analytics
- 📋 Custom workflow automation
- 📋 Enterprise integration APIs

## Risk Assessment & Mitigation

### Technical Risks

| Risk                            | Impact | Probability | Mitigation                                          |
| ------------------------------- | ------ | ----------- | --------------------------------------------------- |
| Database trigger failures       | High   | Low         | Comprehensive testing, fallback mechanisms          |
| Race conditions in registration | Medium | Medium      | Database constraints, idempotent operations         |
| Email delivery failures         | Medium | Medium      | Retry mechanisms, monitoring, alternative providers |
| Performance degradation         | Medium | Low         | Load testing, monitoring, optimization              |

### Security Risks

| Risk                         | Impact | Probability | Mitigation                                     |
| ---------------------------- | ------ | ----------- | ---------------------------------------------- |
| Token prediction/brute force | High   | Low         | Cryptographically secure tokens, rate limiting |
| Email spoofing               | Medium | Medium      | SPF/DKIM validation, sender verification       |
| Data exposure via RLS bypass | High   | Low         | Comprehensive testing, code review             |
| Session hijacking            | High   | Low         | Secure cookie settings, JWT rotation           |

### Operational Risks

| Risk                        | Impact | Probability | Mitigation                                 |
| --------------------------- | ------ | ----------- | ------------------------------------------ |
| Invitation spam             | Medium | Medium      | Rate limiting, admin controls              |
| Support ticket volume       | Low    | High        | Clear error messages, self-service options |
| Database migration issues   | High   | Low         | Staging testing, rollback procedures       |
| Third-party service outages | Medium | Medium      | Fallback providers, graceful degradation   |

## Success Criteria

### Functional Requirements

- [x] Regular sign-up creates personal organization
- [x] Invitation sign-up joins invited organization (no personal org)
- [x] Email confirmation gates all data creation
- [x] System is atomic and idempotent
- [x] RLS-friendly with minimal client database access
- [x] Comprehensive error handling
- [x] Audit logging for compliance

### Performance Requirements

- Registration completion time < 2 seconds
- Email delivery time < 30 seconds
- Database query response time < 100ms
- Support for 1000+ concurrent registrations
- 99.9% uptime for registration system

### Security Requirements

- Zero successful bypass of email confirmation
- Zero successful privilege escalation
- Complete audit trail for all operations
- Compliance with enterprise security standards
- Regular security assessment passing

### User Experience Requirements

- Clear invitation preview before registration
- Intuitive error messages and recovery
- Mobile-responsive design
- Accessibility compliance (WCAG 2.1 AA)
- Multi-language support

## Conclusion

This implementation plan provides a comprehensive roadmap for building an enterprise-grade registration and invitation system. The Hybrid Database + Auth Trigger approach leverages the strengths of Supabase while implementing industry best practices from leading authentication providers.

The phased approach ensures that critical functionality is delivered first, with enhancements and optimizations following in subsequent phases. The detailed risk assessment and mitigation strategies provide confidence in the system's reliability and security.

By following this plan, the registration system will support both current needs and future enterprise requirements while maintaining the high standards of security, performance, and user experience expected in a production SaaS application.

---

**Document Version**: 1.0  
**Last Updated**: 2025-01-20  
**Author**: Claude Code  
**Review Status**: Ready for Technical Review
