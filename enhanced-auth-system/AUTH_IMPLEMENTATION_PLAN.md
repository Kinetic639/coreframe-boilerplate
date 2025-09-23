# Enhanced Multi-Tenant SaaS Auth System Implementation Plan

## Current System Analysis

### Existing Database Schema (From Current Project)

The current implementation has a solid foundation with these key components:

**Core Tables:**

- `organizations` - Basic org data with slug-based identification
- `organization_profiles` - Public profile data (name, logo, theme, bio, website)
- `branches` - Sub-organizations within orgs
- `branch_profiles` - Public branch data
- `users` - Custom user table linked to auth.users
- `user_preferences` - User settings with org/branch context
- `roles` - Role definitions (supports custom roles per org)
- `permissions` - System-wide permission definitions
- `role_permissions` - Many-to-many role-permission mapping
- `user_role_assignments` - User roles with scope (org/branch) and scope_id
- `user_permission_overrides` - Individual permission overrides with scope support
- `invitations` - Basic invitation system with tokens

**Current Features:**
✅ Multi-tenant architecture with organizations and branches  
✅ Sophisticated role system with scoped permissions (org/branch)  
✅ Permission overrides for granular control  
✅ JWT custom claims with roles embedded via `custom_access_token_hook`  
✅ Auto organization creation on direct signup  
✅ Basic invitation table structure  
✅ Comprehensive RLS policies

**Missing/Needs Enhancement:**
❌ Complete invitation flow with email integration  
❌ Role pre-assignment during invitation  
❌ Resend/React Email integration  
❌ Enhanced user onboarding  
❌ Invitation acceptance handling

---

## Implementation Plan for New Project

### Phase 1: Project Setup & Testing Infrastructure

#### 1.1 Project Initialization

- [ ] Create new Next.js 15 project with TypeScript
- [ ] Setup Supabase project (development/staging/production)
- [ ] Configure environment variables and secrets
- [ ] Setup path aliases and basic project structure

#### 1.2 Testing Infrastructure Setup

- [ ] **Unit Testing**: Install and configure Vitest
- [ ] **Integration Testing**: Setup Playwright for API and database testing
- [ ] **E2E Testing**: Configure Playwright for full user flows
- [ ] **Database Testing**: Setup test database with migrations
- [ ] **Mock Services**: Create mocks for Supabase and email services
- [ ] **CI/CD Pipeline**: Setup GitHub Actions for automated testing

#### 1.3 TDD Development Environment

- [ ] Configure test databases (unit, integration, e2e)
- [ ] Setup test data factories and seeders
- [ ] Create testing utilities for auth and multi-tenancy
- [ ] Implement test coverage reporting
- [ ] Setup pre-commit hooks with testing requirements

### Phase 2: Core Authentication Infrastructure

#### 2.1 Enhanced Database Schema

**Core Tables Enhancement:**

```sql
-- Enhanced organizations table
CREATE TABLE organizations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  slug text UNIQUE NOT NULL,
  created_by uuid REFERENCES auth.users(id),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  deleted_at timestamptz
);

-- Organization settings for advanced configuration
CREATE TABLE organization_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid REFERENCES organizations(id) UNIQUE NOT NULL,
  invitation_expiry_hours integer DEFAULT 168, -- 7 days
  auto_accept_domain text, -- Auto-accept invites from this domain
  require_email_verification boolean DEFAULT true,
  allow_branch_admins_invite boolean DEFAULT true,
  max_users integer, -- Subscription limits
  custom_branding jsonb, -- Custom colors, logos, etc.
  security_settings jsonb, -- MFA requirements, password policies
  notification_settings jsonb, -- Email notification preferences
  integration_settings jsonb, -- Third-party integrations
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Enhanced branches table
CREATE TABLE branches (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid REFERENCES organizations(id) NOT NULL,
  name text NOT NULL,
  slug text NOT NULL,
  parent_id uuid REFERENCES branches(id), -- For hierarchical branches
  level integer DEFAULT 1, -- Branch hierarchy level
  sort_order integer DEFAULT 0,
  is_active boolean DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  deleted_at timestamptz,
  UNIQUE(organization_id, slug)
);

-- Enhanced users table (extends auth.users)
CREATE TABLE users (
  id uuid PRIMARY KEY REFERENCES auth.users(id),
  email text NOT NULL,
  first_name text,
  last_name text,
  avatar_url text,
  timezone text DEFAULT 'UTC',
  language text DEFAULT 'en',
  is_active boolean DEFAULT true,
  last_seen_at timestamptz,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  deleted_at timestamptz
);

-- User preferences with enhanced functionality
CREATE TABLE user_preferences (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES users(id) UNIQUE NOT NULL,
  default_organization_id uuid REFERENCES organizations(id),
  default_branch_id uuid REFERENCES branches(id),
  theme text DEFAULT 'system', -- light, dark, system
  notifications_enabled boolean DEFAULT true,
  email_notifications jsonb DEFAULT '{}', -- Granular email preferences
  ui_preferences jsonb DEFAULT '{}', -- UI customizations
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);
```

**Enhanced Invitation System:**

```sql
-- Comprehensive invitations table
CREATE TABLE invitations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email text NOT NULL,
  token text UNIQUE NOT NULL,
  organization_id uuid REFERENCES organizations(id) NOT NULL,
  branch_id uuid REFERENCES branches(id), -- Optional: specific branch assignment
  role_id uuid REFERENCES roles(id), -- Pre-assigned role
  invited_by uuid REFERENCES users(id) NOT NULL,
  status text DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'expired', 'cancelled', 'resent')),
  invite_type text DEFAULT 'standard' CHECK (invite_type IN ('standard', 'bulk', 'auto_accept')),
  expires_at timestamptz NOT NULL DEFAULT (now() + interval '7 days'),
  accepted_at timestamptz,
  accepted_by uuid REFERENCES users(id),
  resent_count integer DEFAULT 0,
  last_resent_at timestamptz,
  custom_message text,
  metadata jsonb DEFAULT '{}', -- Additional invitation context
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  deleted_at timestamptz
);

-- Bulk invitation management
CREATE TABLE bulk_invitations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid REFERENCES organizations(id) NOT NULL,
  created_by uuid REFERENCES users(id) NOT NULL,
  name text NOT NULL, -- Descriptive name for the bulk invite
  status text DEFAULT 'processing' CHECK (status IN ('processing', 'completed', 'failed', 'cancelled')),
  total_invites integer DEFAULT 0,
  sent_invites integer DEFAULT 0,
  accepted_invites integer DEFAULT 0,
  failed_invites integer DEFAULT 0,
  invitation_data jsonb NOT NULL, -- Array of invitation objects
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- User onboarding tracking
CREATE TABLE user_onboarding (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES users(id) NOT NULL,
  organization_id uuid REFERENCES organizations(id) NOT NULL,
  onboarding_type text DEFAULT 'standard' CHECK (onboarding_type IN ('standard', 'invitation', 'import')),
  completed_steps jsonb DEFAULT '[]', -- Track completed onboarding steps
  current_step text,
  progress_percentage integer DEFAULT 0,
  started_at timestamptz DEFAULT now(),
  completed_at timestamptz,
  skipped_at timestamptz,
  metadata jsonb DEFAULT '{}',
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(user_id, organization_id)
);
```

**Advanced Permission System:**

```sql
-- Enhanced permissions with categories and dependencies
CREATE TABLE permissions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slug text UNIQUE NOT NULL,
  name text NOT NULL,
  description text,
  category text NOT NULL, -- Group permissions by feature/module
  subcategory text,
  resource_type text, -- What resource this permission applies to
  action text NOT NULL, -- create, read, update, delete, manage, etc.
  scope_types text[] DEFAULT '{"organization", "branch"}', -- Valid scopes
  dependencies uuid[], -- Other permissions this depends on
  conflicts_with uuid[], -- Permissions that conflict with this one
  is_system boolean DEFAULT false, -- System permissions can't be deleted
  is_dangerous boolean DEFAULT false, -- Requires special confirmation
  metadata jsonb DEFAULT '{}',
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  deleted_at timestamptz
);

-- Enhanced roles with templates and hierarchy
CREATE TABLE roles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  slug text NOT NULL,
  description text,
  organization_id uuid REFERENCES organizations(id), -- NULL for system roles
  parent_role_id uuid REFERENCES roles(id), -- Role inheritance
  role_type text DEFAULT 'custom' CHECK (role_type IN ('system', 'template', 'custom')),
  is_assignable boolean DEFAULT true,
  is_deletable boolean DEFAULT true,
  priority integer DEFAULT 0, -- Higher priority roles override lower ones
  max_users integer, -- Limit on number of users with this role
  auto_assign_conditions jsonb, -- Conditions for auto-assignment
  metadata jsonb DEFAULT '{}',
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  deleted_at timestamptz,
  UNIQUE(organization_id, slug)
);

-- Enhanced role permissions with conditions
CREATE TABLE role_permissions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  role_id uuid REFERENCES roles(id) NOT NULL,
  permission_id uuid REFERENCES permissions(id) NOT NULL,
  granted boolean DEFAULT true,
  scope_types text[] DEFAULT '{"organization", "branch"}', -- Which scopes this applies to
  conditions jsonb, -- Conditional permissions (time-based, resource-based, etc.)
  granted_by uuid REFERENCES users(id),
  granted_at timestamptz DEFAULT now(),
  expires_at timestamptz, -- Temporary permissions
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  deleted_at timestamptz,
  UNIQUE(role_id, permission_id)
);

-- Enhanced user role assignments with metadata
CREATE TABLE user_role_assignments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES users(id) NOT NULL,
  role_id uuid REFERENCES roles(id) NOT NULL,
  scope text NOT NULL CHECK (scope IN ('organization', 'branch')),
  scope_id uuid NOT NULL,
  assigned_by uuid REFERENCES users(id),
  assignment_type text DEFAULT 'manual' CHECK (assignment_type IN ('manual', 'auto', 'inherited', 'temporary')),
  reason text, -- Reason for assignment
  starts_at timestamptz DEFAULT now(),
  expires_at timestamptz, -- Temporary role assignments
  is_active boolean DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  deleted_at timestamptz,
  UNIQUE(user_id, role_id, scope, scope_id)
);

-- Granular permission overrides
CREATE TABLE user_permission_overrides (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES users(id) NOT NULL,
  permission_id uuid REFERENCES permissions(id) NOT NULL,
  scope text NOT NULL CHECK (scope IN ('organization', 'branch')),
  scope_id uuid NOT NULL,
  granted boolean NOT NULL,
  reason text NOT NULL, -- Required explanation for override
  override_type text DEFAULT 'manual' CHECK (override_type IN ('manual', 'emergency', 'temporary', 'exception')),
  granted_by uuid REFERENCES users(id) NOT NULL,
  reviewed_by uuid REFERENCES users(id),
  review_status text DEFAULT 'pending' CHECK (review_status IN ('pending', 'approved', 'rejected')),
  starts_at timestamptz DEFAULT now(),
  expires_at timestamptz, -- Auto-expiring overrides
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  deleted_at timestamptz,
  UNIQUE(user_id, permission_id, scope, scope_id)
);
```

#### 2.2 Advanced Permission System Features

**Permission Categories and Structure:**

```typescript
// Permission categories for better organization
interface PermissionCategory {
  // Core system permissions
  'system': {
    'users.create' | 'users.read' | 'users.update' | 'users.delete' |
    'roles.create' | 'roles.read' | 'roles.update' | 'roles.delete' |
    'permissions.manage' | 'organizations.manage'
  };

  // Organization-level permissions
  'organization': {
    'settings.read' | 'settings.update' | 'billing.manage' |
    'integrations.manage' | 'audit.read' | 'reports.generate'
  };

  // Branch-level permissions
  'branch': {
    'branch.create' | 'branch.read' | 'branch.update' | 'branch.delete' |
    'members.invite' | 'members.manage' | 'content.manage'
  };

  // Feature-specific permissions
  'features': {
    'analytics.read' | 'exports.create' | 'api.access' | 'webhooks.manage'
  };
}

// Permission validation and dependency checking
interface PermissionValidator {
  validatePermission(permission: string, user: User, context: AuthContext): boolean;
  checkDependencies(permission: string): string[];
  resolveConflicts(permissions: string[]): string[];
  calculateEffectivePermissions(user: User, context: AuthContext): EffectivePermissions;
}
```

#### 2.3 Enhanced JWT System

**Custom JWT Payload Structure:**

```typescript
interface EnhancedJwtPayload {
  // Standard JWT claims
  iss: string; // Issuer
  aud: string; // Audience
  exp: number; // Expiration
  iat: number; // Issued at
  sub: string; // Subject (user ID)

  // Supabase standard claims
  role: string; // authenticated, anon, service_role
  aal: string; // Authenticator assurance level
  session_id: string;
  email?: string;
  phone?: string;
  is_anonymous: boolean;

  // Enhanced custom claims
  organizations: Array<{
    id: string;
    slug: string;
    name: string;
    role: string;
    role_id: string;
    permissions: string[]; // Cached permissions for performance
    branches: Array<{
      id: string;
      slug: string;
      name: string;
      role?: string;
      role_id?: string;
      permissions?: string[];
    }>;
  }>;

  // User context
  user_metadata: {
    first_name?: string;
    last_name?: string;
    avatar_url?: string;
    timezone?: string;
    language?: string;
  };

  // App metadata
  app_metadata: {
    provider: string;
    providers: string[];
    default_org_id?: string;
    default_branch_id?: string;
    last_sign_in_method?: string;
    mfa_enabled?: boolean;
    feature_flags?: Record<string, boolean>;
  };

  // Permission context (cached for performance)
  effective_permissions: {
    [orgId: string]: {
      organization: string[];
      branches: {
        [branchId: string]: string[];
      };
    };
  };

  // Security context
  security: {
    last_password_change?: number;
    requires_mfa?: boolean;
    trusted_device?: boolean;
    login_method: string;
  };
}
```

**Enhanced Custom Access Token Hook:**

```sql
CREATE OR REPLACE FUNCTION public.custom_access_token_hook(event jsonb)
RETURNS jsonb
LANGUAGE plpgsql
STABLE SECURITY DEFINER
AS $$
DECLARE
  claims jsonb;
  user_orgs jsonb;
  user_perms jsonb;
  user_metadata jsonb;
BEGIN
  claims := event->'claims';

  -- Get user's organizations with roles and permissions
  SELECT
    COALESCE(
      jsonb_agg(
        jsonb_build_object(
          'id', o.id,
          'slug', o.slug,
          'name', op.name,
          'role', r.slug,
          'role_id', r.id,
          'permissions', COALESCE(org_perms.permissions, '[]'::jsonb),
          'branches', COALESCE(branch_data.branches, '[]'::jsonb)
        )
      ), '[]'::jsonb
    ) INTO user_orgs
  FROM user_role_assignments ura
  JOIN organizations o ON o.id = ura.scope_id AND ura.scope = 'organization'
  JOIN organization_profiles op ON op.organization_id = o.id
  JOIN roles r ON r.id = ura.role_id
  LEFT JOIN (
    -- Organization-level permissions
    SELECT
      ura_inner.scope_id,
      jsonb_agg(DISTINCT p.slug) as permissions
    FROM user_role_assignments ura_inner
    JOIN role_permissions rp ON rp.role_id = ura_inner.role_id
    JOIN permissions p ON p.id = rp.permission_id
    WHERE ura_inner.user_id = (event->>'user_id')::uuid
      AND ura_inner.scope = 'organization'
      AND ura_inner.deleted_at IS NULL
      AND rp.deleted_at IS NULL
      AND p.deleted_at IS NULL
    GROUP BY ura_inner.scope_id
  ) org_perms ON org_perms.scope_id = ura.scope_id
  LEFT JOIN (
    -- Branch data with permissions
    SELECT
      b.organization_id,
      jsonb_agg(
        jsonb_build_object(
          'id', b.id,
          'slug', b.slug,
          'name', bp.name,
          'role', br.slug,
          'role_id', br.id,
          'permissions', COALESCE(branch_perms.permissions, '[]'::jsonb)
        )
      ) as branches
    FROM branches b
    JOIN branch_profiles bp ON bp.branch_id = b.id
    JOIN user_role_assignments ura_branch ON ura_branch.scope_id = b.id
      AND ura_branch.scope = 'branch'
      AND ura_branch.user_id = (event->>'user_id')::uuid
    JOIN roles br ON br.id = ura_branch.role_id
    LEFT JOIN (
      -- Branch-level permissions
      SELECT
        ura_b.scope_id,
        jsonb_agg(DISTINCT p.slug) as permissions
      FROM user_role_assignments ura_b
      JOIN role_permissions rp ON rp.role_id = ura_b.role_id
      JOIN permissions p ON p.id = rp.permission_id
      WHERE ura_b.user_id = (event->>'user_id')::uuid
        AND ura_b.scope = 'branch'
        AND ura_b.deleted_at IS NULL
        AND rp.deleted_at IS NULL
        AND p.deleted_at IS NULL
      GROUP BY ura_b.scope_id
    ) branch_perms ON branch_perms.scope_id = b.id
    WHERE b.deleted_at IS NULL
    GROUP BY b.organization_id
  ) branch_data ON branch_data.organization_id = o.id
  WHERE ura.user_id = (event->>'user_id')::uuid
    AND ura.scope = 'organization'
    AND ura.deleted_at IS NULL
    AND o.deleted_at IS NULL;

  -- Get user metadata
  SELECT jsonb_build_object(
    'first_name', u.first_name,
    'last_name', u.last_name,
    'avatar_url', u.avatar_url,
    'timezone', u.timezone,
    'language', u.language
  ) INTO user_metadata
  FROM users u
  WHERE u.id = (event->>'user_id')::uuid;

  -- Set custom claims
  claims := jsonb_set(claims, '{organizations}', user_orgs);
  claims := jsonb_set(claims, '{user_metadata}', user_metadata);

  -- Update the event
  event := jsonb_set(event, '{claims}', claims);

  RETURN event;
END;
$$;

-- Grant necessary permissions
GRANT USAGE ON SCHEMA public TO supabase_auth_admin;
GRANT EXECUTE ON FUNCTION public.custom_access_token_hook TO supabase_auth_admin;
REVOKE EXECUTE ON FUNCTION public.custom_access_token_hook FROM authenticated, anon, public;

-- Grant access to tables
GRANT SELECT ON ALL TABLES IN SCHEMA public TO supabase_auth_admin;
```

### Phase 3: Email Integration & Communication

#### 3.1 Resend Integration Setup

**Installation and Configuration:**

```bash
npm install resend react-email @react-email/components
```

**Email Service Architecture:**

```typescript
// Email service with queue support
interface EmailService {
  // Core email sending
  sendEmail(config: EmailConfig): Promise<EmailResult>;

  // Template-based sending
  sendTemplateEmail(template: EmailTemplate, data: EmailData): Promise<EmailResult>;

  // Batch email sending
  sendBatchEmails(emails: EmailConfig[]): Promise<EmailResult[]>;

  // Email tracking
  trackEmail(messageId: string): Promise<EmailStatus>;

  // Queue management
  queueEmail(config: EmailConfig, priority?: number): Promise<string>;
  processQueue(): Promise<void>;
}

interface EmailConfig {
  to: string | string[];
  from: string;
  subject: string;
  html?: string;
  text?: string;
  template?: string;
  templateData?: Record<string, any>;
  replyTo?: string;
  cc?: string[];
  bcc?: string[];
  attachments?: EmailAttachment[];
  tags?: string[];
  metadata?: Record<string, any>;
}
```

#### 3.2 React Email Templates

**Invitation Email Template:**

```tsx
import {
  Body,
  Button,
  Container,
  Head,
  Heading,
  Html,
  Img,
  Link,
  Preview,
  Section,
  Text,
  Tailwind,
} from "@react-email/components";

interface InvitationEmailProps {
  inviterName: string;
  inviterEmail: string;
  organizationName: string;
  organizationLogo?: string;
  roleName: string;
  branchName?: string;
  inviteUrl: string;
  expiresAt: Date;
  customMessage?: string;
  organizationBranding?: {
    primaryColor: string;
    logoUrl: string;
  };
}

export default function InvitationEmail({
  inviterName,
  inviterEmail,
  organizationName,
  organizationLogo,
  roleName,
  branchName,
  inviteUrl,
  expiresAt,
  customMessage,
  organizationBranding,
}: InvitationEmailProps) {
  const previewText = `${inviterName} invited you to join ${organizationName}`;

  return (
    <Html>
      <Head />
      <Preview>{previewText}</Preview>
      <Tailwind>
        <Body className="bg-white my-auto mx-auto font-sans">
          <Container className="border border-solid border-[#eaeaea] rounded my-[40px] mx-auto p-[20px] w-[465px]">
            {/* Header with branding */}
            <Section className="mt-[32px]">
              {organizationLogo ? (
                <Img
                  src={organizationLogo}
                  width="40"
                  height="40"
                  alt={organizationName}
                  className="my-0 mx-auto"
                />
              ) : (
                <div className="w-10 h-10 bg-blue-500 rounded mx-auto flex items-center justify-center text-white font-bold">
                  {organizationName.charAt(0).toUpperCase()}
                </div>
              )}
            </Section>

            {/* Main heading */}
            <Heading className="text-black text-[24px] font-normal text-center p-0 my-[30px] mx-0">
              Join <strong>{organizationName}</strong>
            </Heading>

            {/* Invitation details */}
            <Text className="text-black text-[14px] leading-[24px]">Hello,</Text>

            <Text className="text-black text-[14px] leading-[24px]">
              <strong>{inviterName}</strong> ({inviterEmail}) has invited you to join{" "}
              <strong>{organizationName}</strong> as a <strong>{roleName}</strong>
              {branchName && ` in the ${branchName} branch`}.
            </Text>

            {/* Custom message if provided */}
            {customMessage && (
              <Section className="bg-gray-50 rounded p-4 my-4">
                <Text className="text-gray-700 text-[14px] leading-[24px] m-0">
                  <em>"{customMessage}"</em>
                </Text>
              </Section>
            )}

            {/* CTA Button */}
            <Section className="text-center mt-[32px] mb-[32px]">
              <Button
                className="bg-[#000000] rounded text-white text-[12px] font-semibold no-underline text-center px-5 py-3"
                href={inviteUrl}
              >
                Accept Invitation
              </Button>
            </Section>

            {/* Expiration notice */}
            <Text className="text-black text-[14px] leading-[24px]">
              This invitation will expire on <strong>{expiresAt.toLocaleDateString()}</strong> at{" "}
              <strong>{expiresAt.toLocaleTimeString()}</strong>.
            </Text>

            {/* Alternative link */}
            <Text className="text-black text-[14px] leading-[24px]">
              Or copy and paste this URL into your browser:{" "}
              <Link href={inviteUrl} className="text-blue-600 no-underline">
                {inviteUrl}
              </Link>
            </Text>

            {/* Footer */}
            <Text className="text-gray-500 text-[12px] leading-[24px] mt-[32px]">
              If you weren't expecting this invitation, you can safely ignore this email.
            </Text>
          </Container>
        </Body>
      </Tailwind>
    </Html>
  );
}
```

**Welcome Email Template:**

```tsx
interface WelcomeEmailProps {
  userName: string;
  userEmail: string;
  organizationName: string;
  organizationLogo?: string;
  dashboardUrl: string;
  onboardingUrl?: string;
  gettingStartedUrl?: string;
  supportUrl?: string;
}

export default function WelcomeEmail({
  userName,
  userEmail,
  organizationName,
  organizationLogo,
  dashboardUrl,
  onboardingUrl,
  gettingStartedUrl,
  supportUrl,
}: WelcomeEmailProps) {
  return (
    <Html>
      <Head />
      <Preview>Welcome to {organizationName}! Let's get you started.</Preview>
      <Tailwind>
        <Body className="bg-white my-auto mx-auto font-sans">
          <Container className="border border-solid border-[#eaeaea] rounded my-[40px] mx-auto p-[20px] w-[465px]">
            {/* Welcome content with onboarding steps */}
            <Heading className="text-black text-[24px] font-normal text-center p-0 my-[30px] mx-0">
              Welcome to <strong>{organizationName}</strong>!
            </Heading>

            <Text className="text-black text-[14px] leading-[24px]">Hi {userName},</Text>

            <Text className="text-black text-[14px] leading-[24px]">
              Welcome to {organizationName}! We're excited to have you on board.
            </Text>

            {/* Quick start actions */}
            <Section className="my-[32px]">
              <Heading className="text-black text-[18px] font-normal">Get Started:</Heading>

              <div className="space-y-4">
                <Button
                  className="bg-blue-600 rounded text-white text-[14px] font-semibold no-underline text-center px-6 py-3 w-full"
                  href={dashboardUrl}
                >
                  Go to Dashboard
                </Button>

                {onboardingUrl && (
                  <Button
                    className="bg-gray-100 border border-gray-300 rounded text-gray-800 text-[14px] font-semibold no-underline text-center px-6 py-3 w-full"
                    href={onboardingUrl}
                  >
                    Start Onboarding
                  </Button>
                )}
              </div>
            </Section>

            {/* Help resources */}
            <Section>
              <Text className="text-gray-600 text-[12px] leading-[24px]">
                Need help? Check out our{" "}
                {gettingStartedUrl && (
                  <>
                    <Link href={gettingStartedUrl}>getting started guide</Link>
                    {supportUrl && " or "}
                  </>
                )}
                {supportUrl && <Link href={supportUrl}>contact support</Link>}.
              </Text>
            </Section>
          </Container>
        </Body>
      </Tailwind>
    </Html>
  );
}
```

### Phase 4: Advanced Invitation System

#### 4.1 Comprehensive Invitation Management

**Invitation Service Architecture:**

```typescript
interface InvitationService {
  // Single invitation
  createInvitation(config: CreateInvitationConfig): Promise<Invitation>;

  // Bulk invitations
  createBulkInvitations(config: BulkInvitationConfig): Promise<BulkInvitation>;

  // Invitation management
  resendInvitation(invitationId: string): Promise<Invitation>;
  cancelInvitation(invitationId: string): Promise<void>;
  acceptInvitation(token: string, userData?: AcceptInvitationData): Promise<InvitationResult>;

  // Validation and verification
  validateInvitationToken(token: string): Promise<InvitationValidation>;
  checkEmailEligibility(email: string, organizationId: string): Promise<EligibilityCheck>;

  // Auto-accept functionality
  processAutoAcceptInvitation(email: string, organizationId: string): Promise<void>;

  // Analytics and reporting
  getInvitationStats(organizationId: string): Promise<InvitationStats>;
  getInvitationHistory(organizationId: string, filters?: InvitationFilters): Promise<Invitation[]>;
}

interface CreateInvitationConfig {
  email: string;
  organizationId: string;
  roleId: string;
  branchId?: string;
  customMessage?: string;
  expiryHours?: number;
  sendEmail?: boolean; // For bulk operations
  metadata?: Record<string, any>;
}

interface BulkInvitationConfig {
  organizationId: string;
  invitations: Array<{
    email: string;
    roleId: string;
    branchId?: string;
    customData?: Record<string, any>;
  }>;
  defaultMessage?: string;
  template?: string;
  batchSize?: number;
  delayBetweenBatches?: number; // Rate limiting
}

interface AcceptInvitationData {
  firstName?: string;
  lastName?: string;
  password?: string; // For new users
  timezone?: string;
  language?: string;
  agreedToTerms: boolean;
  marketingConsent?: boolean;
}

interface InvitationValidation {
  isValid: boolean;
  invitation?: Invitation;
  error?: string;
  canAccept: boolean;
  requiresPassword: boolean; // If email is not in auth.users
}
```

#### 4.2 Enhanced Invitation Flows

**Multi-Modal Invitation Creation:**

```typescript
// Standard single invitation
const standardInvitation = await invitationService.createInvitation({
  email: "user@example.com",
  organizationId: "org-123",
  roleId: "role-456",
  branchId: "branch-789",
  customMessage: "Welcome to our team!",
  expiryHours: 168, // 7 days
});

// Bulk invitation with CSV processing
const bulkInvitation = await invitationService.createBulkInvitations({
  organizationId: "org-123",
  invitations: [
    { email: "user1@example.com", roleId: "role-456", branchId: "branch-789" },
    { email: "user2@example.com", roleId: "role-456", branchId: "branch-790" },
    // ... more invitations
  ],
  defaultMessage: "Welcome to our organization!",
  batchSize: 10, // Process 10 at a time
  delayBetweenBatches: 1000, // 1 second delay for rate limiting
});

// Auto-accept domain invitation
const domainInvitation = await invitationService.processAutoAcceptInvitation(
  "user@company.com",
  "org-123"
);
```

#### 4.3 Invitation Acceptance and User Creation

**Enhanced Acceptance Flow:**

```typescript
interface InvitationAcceptanceService {
  // Validate invitation before showing acceptance form
  validateToken(token: string): Promise<InvitationValidation>;

  // Check if user already exists
  checkExistingUser(email: string): Promise<UserExistenceCheck>;

  // Accept invitation for existing user
  acceptForExistingUser(token: string, sessionData: SessionData): Promise<AcceptanceResult>;

  // Accept invitation and create new user
  acceptAndCreateUser(token: string, userData: NewUserData): Promise<AcceptanceResult>;

  // Handle post-acceptance setup
  setupUserAccess(userId: string, invitation: Invitation): Promise<void>;

  // Trigger onboarding flow
  startOnboarding(userId: string, organizationId: string): Promise<OnboardingSession>;
}

interface AcceptanceResult {
  success: boolean;
  user: User;
  session: AuthSession;
  organization: Organization;
  branch?: Branch;
  assignedRole: Role;
  onboardingRequired: boolean;
  nextSteps: OnboardingStep[];
}

// Acceptance workflow
const acceptanceFlow = async (token: string, userData?: NewUserData) => {
  // 1. Validate invitation
  const validation = await invitationService.validateToken(token);
  if (!validation.isValid) {
    throw new Error(validation.error);
  }

  // 2. Check if user exists
  const existenceCheck = await invitationService.checkExistingUser(validation.invitation.email);

  // 3. Handle based on user existence
  let result: AcceptanceResult;
  if (existenceCheck.exists) {
    // Existing user - just assign role and add to org
    result = await invitationService.acceptForExistingUser(token, {
      userId: existenceCheck.userId,
    });
  } else {
    // New user - create account and assign role
    if (!userData) {
      throw new Error("User data required for new account creation");
    }
    result = await invitationService.acceptAndCreateUser(token, userData);
  }

  // 4. Start onboarding if required
  if (result.onboardingRequired) {
    const onboardingSession = await invitationService.startOnboarding(
      result.user.id,
      result.organization.id
    );
    result.onboardingSession = onboardingSession;
  }

  return result;
};
```

### Phase 5: Enhanced User Registration & Onboarding

#### 5.1 Multi-Path Registration System

**Registration Flow Types:**

```typescript
interface RegistrationService {
  // Direct organization creation
  registerWithNewOrganization(data: DirectRegistrationData): Promise<RegistrationResult>;

  // Invitation-based registration
  registerViaInvitation(
    token: string,
    data: InvitationRegistrationData
  ): Promise<RegistrationResult>;

  // Domain-based auto-join
  registerWithDomainAutoJoin(data: DomainRegistrationData): Promise<RegistrationResult>;

  // Social login integration
  handleSocialRegistration(provider: string, userData: SocialUserData): Promise<RegistrationResult>;
}

interface DirectRegistrationData {
  user: {
    email: string;
    password: string;
    firstName: string;
    lastName: string;
    timezone?: string;
    language?: string;
  };
  organization: {
    name: string;
    slug?: string; // Auto-generated if not provided
    industry?: string;
    size?: "solo" | "small" | "medium" | "large" | "enterprise";
    country?: string;
  };
  preferences: {
    emailNotifications?: boolean;
    marketingConsent?: boolean;
  };
  source?: string; // Track registration source
}

interface RegistrationResult {
  user: User;
  session: AuthSession;
  organization?: Organization;
  assignedRoles: Array<{
    role: Role;
    scope: "organization" | "branch";
    scopeId: string;
  }>;
  onboardingRequired: boolean;
  onboardingSteps: OnboardingStep[];
  redirectTo?: string;
}
```

#### 5.2 Intelligent Onboarding System

**Onboarding Flow Management:**

```typescript
interface OnboardingService {
  // Start onboarding for user
  startOnboarding(
    userId: string,
    organizationId: string,
    type?: OnboardingType
  ): Promise<OnboardingSession>;

  // Get personalized onboarding steps
  getOnboardingSteps(userId: string, organizationId: string): Promise<OnboardingStep[]>;

  // Progress tracking
  completeStep(sessionId: string, stepId: string, data?: any): Promise<OnboardingProgress>;
  skipStep(sessionId: string, stepId: string, reason?: string): Promise<OnboardingProgress>;

  // Adaptive onboarding
  adjustOnboardingFlow(sessionId: string, userBehavior: UserBehaviorData): Promise<void>;

  // Completion handling
  completeOnboarding(sessionId: string): Promise<OnboardingCompletion>;
  resumeOnboarding(userId: string, organizationId: string): Promise<OnboardingSession>;
}

interface OnboardingStep {
  id: string;
  title: string;
  description: string;
  type: "form" | "tutorial" | "action" | "video" | "tour";
  category: "profile" | "preferences" | "features" | "integration" | "team";
  isOptional: boolean;
  estimatedMinutes: number;
  prerequisites?: string[]; // Other step IDs that must be completed first
  data?: {
    formSchema?: any; // JSON schema for form steps
    tutorialUrl?: string;
    actionConfig?: any;
    tourSteps?: TourStep[];
  };
  completionCriteria?: {
    requiresInput: boolean;
    validationRules?: ValidationRule[];
  };
}

interface OnboardingSession {
  id: string;
  userId: string;
  organizationId: string;
  type: OnboardingType;
  status: "active" | "paused" | "completed" | "skipped";
  currentStepId?: string;
  completedSteps: string[];
  skippedSteps: string[];
  progress: {
    totalSteps: number;
    completedSteps: number;
    progressPercentage: number;
  };
  estimatedTimeRemaining: number;
  startedAt: Date;
  lastActiveAt: Date;
  completedAt?: Date;
  metadata: Record<string, any>;
}

// Role-based onboarding customization
const getOnboardingSteps = (userRole: string, organizationType: string): OnboardingStep[] => {
  const baseSteps: OnboardingStep[] = [
    {
      id: "profile_setup",
      title: "Complete Your Profile",
      description: "Add your personal information and preferences",
      type: "form",
      category: "profile",
      isOptional: false,
      estimatedMinutes: 3,
      data: {
        formSchema: {
          fields: ["firstName", "lastName", "avatar", "timezone", "language"],
        },
      },
    },
    {
      id: "organization_overview",
      title: "Meet Your Organization",
      description: "Learn about your organization structure and team",
      type: "tutorial",
      category: "features",
      isOptional: false,
      estimatedMinutes: 5,
    },
  ];

  // Role-specific steps
  if (userRole === "org_owner") {
    baseSteps.push({
      id: "organization_setup",
      title: "Set Up Your Organization",
      description: "Configure organization settings and branding",
      type: "form",
      category: "preferences",
      isOptional: false,
      estimatedMinutes: 10,
      prerequisites: ["profile_setup"],
    });
  }

  if (userRole === "admin" || userRole === "org_owner") {
    baseSteps.push({
      id: "invite_team_members",
      title: "Invite Your Team",
      description: "Add team members to your organization",
      type: "action",
      category: "team",
      isOptional: true,
      estimatedMinutes: 5,
      prerequisites: ["organization_setup"],
    });
  }

  return baseSteps;
};
```

### Phase 6: Organization & Branch Management

#### 6.1 Advanced Organization Configuration

**Organization Management Service:**

```typescript
interface OrganizationService {
  // Core organization management
  createOrganization(data: CreateOrganizationData): Promise<Organization>;
  updateOrganization(id: string, data: UpdateOrganizationData): Promise<Organization>;
  deleteOrganization(id: string): Promise<void>;

  // Settings and configuration
  updateSettings(id: string, settings: OrganizationSettings): Promise<void>;
  getBranding(id: string): Promise<OrganizationBranding>;
  updateBranding(id: string, branding: OrganizationBranding): Promise<void>;

  // Branch management
  createBranch(data: CreateBranchData): Promise<Branch>;
  updateBranchHierarchy(organizationId: string, hierarchy: BranchHierarchy): Promise<void>;

  // User management
  getMembers(id: string, filters?: MemberFilters): Promise<OrganizationMember[]>;
  inviteMembers(id: string, invitations: BulkInvitationRequest): Promise<BulkInvitation>;
  updateMemberRoles(id: string, userId: string, roles: RoleAssignment[]): Promise<void>;

  // Analytics and insights
  getUsageStats(id: string): Promise<OrganizationUsageStats>;
  getSecurityInsights(id: string): Promise<SecurityInsights>;
}

interface OrganizationSettings {
  // Security settings
  security: {
    enforcePasswordPolicy: boolean;
    passwordPolicy?: PasswordPolicy;
    requireMFA: boolean;
    mfaGracePeriodDays: number;
    allowedLoginMethods: string[];
    sessionTimeoutMinutes: number;
    allowGuestAccess: boolean;
  };

  // Invitation settings
  invitations: {
    defaultExpiryHours: number;
    allowMemberInvites: boolean;
    autoAcceptDomains: string[];
    requireApprovalForInvites: boolean;
    customInvitationMessage?: string;
  };

  // Notification settings
  notifications: {
    adminNotifications: {
      newUserRegistration: boolean;
      securityAlerts: boolean;
      usageAlerts: boolean;
      billingAlerts: boolean;
    };
    userNotifications: {
      welcomeEmails: boolean;
      invitationReminders: boolean;
      activityDigests: boolean;
      maintenanceNotifications: boolean;
    };
  };

  // Integration settings
  integrations: {
    sso?: {
      enabled: boolean;
      provider: string;
      configuration: Record<string, any>;
    };
    webhooks?: {
      enabled: boolean;
      endpoints: WebhookEndpoint[];
    };
    apiAccess?: {
      enabled: boolean;
      rateLimit: number;
      allowedOrigins: string[];
    };
  };

  // Compliance and audit
  compliance: {
    dataRetentionDays: number;
    auditLogRetentionDays: number;
    enableDataExport: boolean;
    enableUserDeletion: boolean;
    privacyPolicyUrl?: string;
    termsOfServiceUrl?: string;
  };
}
```

#### 6.2 Hierarchical Branch Management

**Branch Hierarchy System:**

```typescript
interface BranchService {
  // Hierarchy management
  createBranchHierarchy(organizationId: string, structure: BranchStructure): Promise<void>;
  updateBranchParent(branchId: string, newParentId?: string): Promise<void>;
  reorderBranches(parentId: string, orderedBranchIds: string[]): Promise<void>;

  // Branch operations
  createBranch(data: CreateBranchData): Promise<Branch>;
  cloneBranch(sourceBranchId: string, name: string): Promise<Branch>;
  mergeBranches(sourceBranchId: string, targetBranchId: string): Promise<void>;
  archiveBranch(branchId: string): Promise<void>;

  // Access control
  setBranchPermissions(branchId: string, permissions: BranchPermissions): Promise<void>;
  inheritPermissions(branchId: string, fromBranchId?: string): Promise<void>;

  // Resource management
  getBranchResources(branchId: string): Promise<BranchResources>;
  allocateResources(branchId: string, allocation: ResourceAllocation): Promise<void>;
}

interface BranchHierarchy {
  organizationId: string;
  branches: Array<{
    id: string;
    name: string;
    parentId?: string;
    level: number;
    children?: BranchHierarchy["branches"];
    settings: {
      inheritPermissions: boolean;
      allowSubBranches: boolean;
      maxSubBranchLevels: number;
      resourceLimits?: ResourceLimits;
    };
  }>;
}

interface BranchPermissions {
  // User management permissions
  canInviteUsers: boolean;
  canManageRoles: boolean;
  canViewAllMembers: boolean;

  // Resource permissions
  canCreateSubBranches: boolean;
  canModifyBranchSettings: boolean;
  canAccessParentResources: boolean;
  canShareResourcesWithChildren: boolean;

  // Data permissions
  canViewOrganizationData: boolean;
  canExportData: boolean;
  canImportData: boolean;

  // Administrative permissions
  canViewAuditLogs: boolean;
  canGenerateReports: boolean;
  canManageIntegrations: boolean;
}
```

### Phase 7: Advanced Role & Permission Management

#### 7.1 Dynamic Role Creation System

**Role Management Service:**

```typescript
interface RoleService {
  // Role lifecycle
  createRole(data: CreateRoleData): Promise<Role>;
  cloneRole(sourceRoleId: string, name: string, organizationId?: string): Promise<Role>;
  updateRole(id: string, data: UpdateRoleData): Promise<Role>;
  deleteRole(id: string, reassignToRoleId?: string): Promise<void>;

  // Permission management
  assignPermissionsToRole(roleId: string, permissions: PermissionAssignment[]): Promise<void>;
  revokePermissionsFromRole(roleId: string, permissionIds: string[]): Promise<void>;
  setRolePermissions(roleId: string, permissions: PermissionAssignment[]): Promise<void>;

  // Role templates
  createRoleTemplate(data: CreateRoleTemplateData): Promise<RoleTemplate>;
  applyRoleTemplate(templateId: string, organizationId: string): Promise<Role>;
  getSystemRoleTemplates(): Promise<RoleTemplate[]>;

  // Role hierarchy and inheritance
  setRoleParent(roleId: string, parentRoleId?: string): Promise<void>;
  calculateEffectivePermissions(roleId: string): Promise<EffectivePermissions>;

  // User assignment
  assignRoleToUser(userId: string, roleId: string, scope: RoleScope): Promise<void>;
  bulkAssignRoles(assignments: BulkRoleAssignment[]): Promise<BulkAssignmentResult>;

  // Analytics
  getRoleUsageStats(organizationId: string): Promise<RoleUsageStats>;
  getPermissionUsageMatrix(organizationId: string): Promise<PermissionMatrix>;
}

interface CreateRoleData {
  name: string;
  description?: string;
  organizationId?: string; // null for system roles
  parentRoleId?: string;
  permissions: PermissionAssignment[];
  metadata?: {
    category?: string;
    tags?: string[];
    color?: string;
    icon?: string;
  };
  constraints?: {
    maxUsers?: number;
    autoAssignConditions?: AutoAssignCondition[];
    temporaryByDefault?: boolean;
    requiresApproval?: boolean;
  };
}

interface PermissionAssignment {
  permissionId: string;
  granted: boolean;
  scope?: "organization" | "branch" | "both";
  conditions?: PermissionCondition[];
  expiresAt?: Date;
}

interface PermissionCondition {
  type: "time_based" | "resource_based" | "context_based";
  configuration: {
    // Time-based conditions
    allowedHours?: string[]; // e.g., ['09:00-17:00']
    allowedDays?: string[]; // e.g., ['monday', 'tuesday']
    timezone?: string;

    // Resource-based conditions
    resourceTypes?: string[];
    resourceIds?: string[];
    maxResourceCount?: number;

    // Context-based conditions
    requiredContext?: Record<string, any>;
    locationRestrictions?: string[];
    deviceRestrictions?: string[];
  };
}
```

#### 7.2 Permission Override System

**Advanced Permission Override Management:**

```typescript
interface PermissionOverrideService {
  // Override lifecycle
  createOverride(data: CreateOverrideData): Promise<PermissionOverride>;
  updateOverride(id: string, data: UpdateOverrideData): Promise<PermissionOverride>;
  revokeOverride(id: string, reason: string): Promise<void>;

  // Bulk operations
  createBulkOverrides(overrides: CreateOverrideData[]): Promise<BulkOverrideResult>;
  reviewOverrides(reviewData: OverrideReviewData[]): Promise<void>;

  // Temporary overrides
  createTemporaryOverride(data: TemporaryOverrideData): Promise<PermissionOverride>;
  extendOverrideDuration(id: string, newExpiryDate: Date): Promise<void>;

  // Emergency overrides
  createEmergencyOverride(data: EmergencyOverrideData): Promise<PermissionOverride>;
  resolveEmergencyOverride(id: string, resolution: EmergencyResolution): Promise<void>;

  // Approval workflow
  submitOverrideForApproval(data: CreateOverrideData): Promise<OverrideApprovalRequest>;
  approveOverride(requestId: string, approverId: string, notes?: string): Promise<void>;
  rejectOverride(requestId: string, approverId: string, reason: string): Promise<void>;

  // Audit and compliance
  getOverrideAuditLog(
    organizationId: string,
    filters?: AuditFilters
  ): Promise<OverrideAuditEntry[]>;
  generateComplianceReport(organizationId: string, period: DateRange): Promise<ComplianceReport>;
}

interface CreateOverrideData {
  userId: string;
  permissionId: string;
  scope: "organization" | "branch";
  scopeId: string;
  granted: boolean;
  reason: string;
  justification?: string;
  overrideType: "manual" | "emergency" | "temporary" | "exception";
  requestedBy: string;
  expiresAt?: Date;
  requiresApproval: boolean;
  approvers?: string[]; // User IDs who can approve this override
  metadata?: Record<string, any>;
}

interface EmergencyOverrideData extends CreateOverrideData {
  emergencyType: "security_incident" | "system_outage" | "data_recovery" | "compliance_audit";
  incidentId?: string;
  contactInfo: {
    phone: string;
    alternateEmail?: string;
  };
  autoRevokeDuration: number; // Minutes after which override auto-revokes
}

interface PermissionOverride {
  id: string;
  userId: string;
  permissionId: string;
  scope: string;
  scopeId: string;
  granted: boolean;
  reason: string;
  overrideType: string;
  status: "pending" | "active" | "expired" | "revoked" | "rejected";
  requestedBy: string;
  approvedBy?: string;
  approvedAt?: Date;
  expiresAt?: Date;
  revokedAt?: Date;
  revokedBy?: string;
  revokeReason?: string;
  auditLog: OverrideAuditEntry[];
  metadata: Record<string, any>;
  createdAt: Date;
  updatedAt: Date;
}
```

### Phase 8: Security & Compliance

#### 8.1 Enhanced Security Features

**Security Service Architecture:**

```typescript
interface SecurityService {
  // Authentication security
  enforcePasswordPolicy(policy: PasswordPolicy): Promise<void>;
  detectSuspiciousLogin(userId: string, loginData: LoginAttempt): Promise<SecurityAlert>;
  manageTrustedDevices(userId: string): Promise<TrustedDevice[]>;

  // Session security
  enforceSessionLimits(userId: string, maxSessions: number): Promise<void>;
  detectConcurrentSessions(userId: string): Promise<SessionAlert[]>;
  invalidateCompromisedSessions(criteria: SessionCriteria): Promise<number>;

  // Permission security
  validatePermissionEscalation(userId: string, newPermissions: string[]): Promise<EscalationCheck>;
  auditPrivilegedActions(organizationId: string): Promise<PrivilegedActionAudit[]>;
  detectPermissionAnomalities(organizationId: string): Promise<PermissionAnomaly[]>;

  // Data security
  classifyDataSensitivity(data: any, context: SecurityContext): Promise<DataClassification>;
  enforceDataAccessPolicies(userId: string, resourceId: string): Promise<AccessDecision>;
  trackDataAccess(userId: string, resourceId: string, action: string): Promise<void>;

  // Compliance
  generateComplianceReport(
    organizationId: string,
    standard: ComplianceStandard
  ): Promise<ComplianceReport>;
  scanForVulnerabilities(organizationId: string): Promise<VulnerabilityReport>;
  enforceRetentionPolicies(organizationId: string): Promise<RetentionReport>;
}

interface PasswordPolicy {
  minLength: number;
  requireUppercase: boolean;
  requireLowercase: boolean;
  requireNumbers: boolean;
  requireSpecialChars: boolean;
  preventPasswordReuse: number; // Number of previous passwords to check
  maxAge: number; // Days before password expires
  lockoutAttempts: number;
  lockoutDuration: number; // Minutes
  allowPasskeys: boolean;
  requireMFAForPrivileged: boolean;
}

interface SecurityAlert {
  id: string;
  type: "suspicious_login" | "permission_escalation" | "data_breach" | "policy_violation";
  severity: "low" | "medium" | "high" | "critical";
  userId?: string;
  organizationId: string;
  description: string;
  detectedAt: Date;
  resolved: boolean;
  resolvedAt?: Date;
  resolvedBy?: string;
  actions: SecurityAction[];
  metadata: Record<string, any>;
}
```

#### 8.2 Comprehensive Audit System

**Audit and Logging Service:**

```typescript
interface AuditService {
  // Activity logging
  logActivity(activity: ActivityLog): Promise<void>;
  logBulkActivities(activities: ActivityLog[]): Promise<void>;

  // Query and search
  searchActivities(criteria: ActivitySearchCriteria): Promise<ActivitySearchResult>;
  getActivityTimeline(resourceId: string, resourceType: string): Promise<ActivityTimeline>;
  getUserActivityHistory(userId: string, filters?: ActivityFilters): Promise<ActivityLog[]>;

  // Security auditing
  auditPermissionChanges(
    organizationId: string,
    dateRange: DateRange
  ): Promise<PermissionChangeAudit[]>;
  auditLoginAttempts(organizationId: string, suspicious?: boolean): Promise<LoginAuditEntry[]>;
  auditDataAccess(organizationId: string, sensitiveOnly?: boolean): Promise<DataAccessAudit[]>;

  // Compliance reporting
  generateAuditReport(organizationId: string, reportType: AuditReportType): Promise<AuditReport>;
  exportAuditData(organizationId: string, filters: AuditExportFilters): Promise<string>; // CSV/JSON

  // Retention and archival
  archiveOldAuditLogs(cutoffDate: Date): Promise<ArchivalResult>;
  purgeAuditData(organizationId: string, criteria: PurgeCriteria): Promise<PurgeResult>;
}

interface ActivityLog {
  id: string;
  userId?: string;
  organizationId: string;
  branchId?: string;
  action: string; // CRUD action or custom action
  resource: {
    type: string;
    id: string;
    name?: string;
  };
  changes?: {
    before?: Record<string, any>;
    after?: Record<string, any>;
    fields?: string[];
  };
  context: {
    userAgent?: string;
    ipAddress?: string;
    method?: string;
    url?: string;
    sessionId?: string;
    requestId?: string;
  };
  outcome: "success" | "failure" | "partial";
  error?: string;
  duration?: number; // milliseconds
  metadata?: Record<string, any>;
  timestamp: Date;
}

interface PermissionChangeAudit {
  id: string;
  changeType:
    | "role_assignment"
    | "permission_override"
    | "role_creation"
    | "permission_modification";
  targetUserId?: string;
  targetRoleId?: string;
  changedBy: string;
  changes: {
    added?: string[];
    removed?: string[];
    modified?: Array<{
      permission: string;
      before: any;
      after: any;
    }>;
  };
  justification?: string;
  approvedBy?: string;
  timestamp: Date;
  reversible: boolean;
  reverted?: boolean;
  revertedAt?: Date;
  revertedBy?: string;
}
```

### Phase 9: User Experience & Interface Components

#### 9.1 Context Management System

**Enhanced App Context:**

```typescript
interface AppContextProvider {
  // Context state
  user: UserProfile | null;
  session: AuthSession | null;

  // Organization context
  currentOrganization: Organization | null;
  availableOrganizations: Organization[];
  organizationPermissions: string[];

  // Branch context
  currentBranch: Branch | null;
  availableBranches: Branch[];
  branchPermissions: string[];

  // Effective permissions (computed)
  effectivePermissions: EffectivePermissions;

  // Context switching
  switchOrganization: (organizationId: string) => Promise<void>;
  switchBranch: (branchId: string) => Promise<void>;

  // Permission checking
  hasPermission: (permission: string, scope?: "organization" | "branch") => boolean;
  hasAnyPermission: (permissions: string[], scope?: "organization" | "branch") => boolean;
  hasRole: (role: string, scope?: "organization" | "branch") => boolean;

  // Context utilities
  refreshContext: () => Promise<void>;
  clearContext: () => void;
}

interface EffectivePermissions {
  // Organization-level permissions
  organization: {
    [organizationId: string]: {
      roles: Array<{
        id: string;
        name: string;
        permissions: string[];
      }>;
      overrides: Array<{
        permission: string;
        granted: boolean;
        expiresAt?: Date;
      }>;
      effective: string[]; // Computed effective permissions
    };
  };

  // Branch-level permissions
  branches: {
    [branchId: string]: {
      organizationId: string;
      roles: Array<{
        id: string;
        name: string;
        permissions: string[];
      }>;
      overrides: Array<{
        permission: string;
        granted: boolean;
        expiresAt?: Date;
      }>;
      inherited: string[]; // Permissions inherited from organization
      effective: string[]; // Computed effective permissions
    };
  };

  // Global effective permissions (union of all)
  global: string[];

  // Permission metadata
  metadata: {
    lastUpdated: Date;
    computedAt: Date;
    cacheExpiry: Date;
  };
}
```

#### 9.2 Permission-Based UI Components

**React Components for Permission Management:**

```tsx
// Enhanced permission checking components
interface HasPermissionProps {
  permission: string | string[];
  scope?: "organization" | "branch";
  scopeId?: string;
  requireAll?: boolean; // For multiple permissions
  fallback?: React.ReactNode;
  loading?: React.ReactNode;
  children: React.ReactNode;
}

export const HasPermission: React.FC<HasPermissionProps> = ({
  permission,
  scope,
  scopeId,
  requireAll = false,
  fallback = null,
  loading,
  children,
}) => {
  const { checkPermission, isLoading } = usePermissions();

  if (isLoading) {
    return loading || null;
  }

  const permissions = Array.isArray(permission) ? permission : [permission];
  const hasAccess = requireAll
    ? permissions.every((p) => checkPermission(p, scope, scopeId))
    : permissions.some((p) => checkPermission(p, scope, scopeId));

  return hasAccess ? <>{children}</> : <>{fallback}</>;
};

// Role-based component
interface HasRoleProps {
  role: string | string[];
  scope?: "organization" | "branch";
  scopeId?: string;
  requireAll?: boolean;
  fallback?: React.ReactNode;
  children: React.ReactNode;
}

export const HasRole: React.FC<HasRoleProps> = ({
  role,
  scope,
  scopeId,
  requireAll = false,
  fallback = null,
  children,
}) => {
  const { checkRole } = usePermissions();

  const roles = Array.isArray(role) ? role : [role];
  const hasRole = requireAll
    ? roles.every((r) => checkRole(r, scope, scopeId))
    : roles.some((r) => checkRole(r, scope, scopeId));

  return hasRole ? <>{children}</> : <>{fallback}</>;
};

// Context switcher component
interface ContextSwitcherProps {
  type: "organization" | "branch";
  showPermissions?: boolean;
  onSwitch?: (id: string) => void;
}

export const ContextSwitcher: React.FC<ContextSwitcherProps> = ({
  type,
  showPermissions = false,
  onSwitch,
}) => {
  const {
    currentOrganization,
    availableOrganizations,
    currentBranch,
    availableBranches,
    switchOrganization,
    switchBranch,
    effectivePermissions,
  } = useAppContext();

  const items = type === "organization" ? availableOrganizations : availableBranches;
  const currentItem = type === "organization" ? currentOrganization : currentBranch;
  const switchFunction = type === "organization" ? switchOrganization : switchBranch;

  const handleSwitch = async (id: string) => {
    await switchFunction(id);
    onSwitch?.(id);
  };

  return (
    <Select value={currentItem?.id} onValueChange={handleSwitch}>
      <SelectTrigger className="w-[200px]">
        <SelectValue>
          <div className="flex items-center space-x-2">
            <div className="w-4 h-4 bg-blue-500 rounded-full" />
            <span>{currentItem?.name}</span>
          </div>
        </SelectValue>
      </SelectTrigger>
      <SelectContent>
        {items.map((item) => (
          <SelectItem key={item.id} value={item.id}>
            <div className="flex flex-col">
              <span>{item.name}</span>
              {showPermissions && (
                <span className="text-xs text-gray-500">
                  {type === "organization"
                    ? effectivePermissions.organization[item.id]?.effective?.length || 0
                    : effectivePermissions.branches[item.id]?.effective?.length || 0}{" "}
                  permissions
                </span>
              )}
            </div>
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
};

// Permission debug component (development only)
interface PermissionDebugProps {
  userId?: string;
  showEffective?: boolean;
  showOverrides?: boolean;
}

export const PermissionDebug: React.FC<PermissionDebugProps> = ({
  userId,
  showEffective = true,
  showOverrides = true,
}) => {
  const { effectivePermissions, user } = useAppContext();
  const targetUserId = userId || user?.id;

  if (process.env.NODE_ENV !== "development") {
    return null;
  }

  return (
    <div className="fixed bottom-4 right-4 bg-white border shadow-lg p-4 max-w-md max-h-96 overflow-auto text-xs">
      <h3 className="font-bold mb-2">Permission Debug</h3>
      <div className="space-y-2">
        <div>
          <strong>User:</strong> {user?.email}
        </div>

        {showEffective && (
          <div>
            <strong>Effective Permissions:</strong>
            <ul className="mt-1 space-y-1">
              {effectivePermissions.global.map((permission) => (
                <li key={permission} className="text-green-600">
                  ✓ {permission}
                </li>
              ))}
            </ul>
          </div>
        )}

        {showOverrides && (
          <div>
            <strong>Active Overrides:</strong>
            <div className="mt-1">{/* Render permission overrides */}</div>
          </div>
        )}
      </div>
    </div>
  );
};
```

### Phase 10: Testing Strategy

#### 10.1 Comprehensive Testing Approach

**Test Categories and Coverage:**

```typescript
// Unit tests for core authentication logic
describe("AuthenticationService", () => {
  describe("user registration", () => {
    test("should create organization for direct registration", async () => {
      const registrationData: DirectRegistrationData = {
        user: {
          email: "test@example.com",
          password: "SecurePass123!",
          firstName: "John",
          lastName: "Doe",
        },
        organization: {
          name: "Test Organization",
          industry: "technology",
        },
        preferences: {},
      };

      const result = await authService.registerWithNewOrganization(registrationData);

      expect(result.user.email).toBe("test@example.com");
      expect(result.organization).toBeDefined();
      expect(result.assignedRoles).toHaveLength(1);
      expect(result.assignedRoles[0].role.slug).toBe("org_owner");
    });

    test("should assign user to existing organization via invitation", async () => {
      const invitation = await createTestInvitation();
      const registrationData: InvitationRegistrationData = {
        invitationToken: invitation.token,
        user: {
          firstName: "Jane",
          lastName: "Smith",
          password: "SecurePass123!",
        },
        acceptTerms: true,
      };

      const result = await authService.registerViaInvitation(invitation.token, registrationData);

      expect(result.user.firstName).toBe("Jane");
      expect(result.organization?.id).toBe(invitation.organizationId);
      expect(result.assignedRoles[0].role.id).toBe(invitation.roleId);
    });
  });

  describe("permission system", () => {
    test("should calculate effective permissions correctly", async () => {
      const user = await createTestUser();
      const organization = await createTestOrganization();
      const role = await createTestRole(organization.id, ["users.read", "users.create"]);

      await assignRoleToUser(user.id, role.id, "organization", organization.id);

      const permissions = await permissionService.calculateEffectivePermissions(
        user.id,
        organization.id
      );

      expect(permissions.organization[organization.id].effective).toContain("users.read");
      expect(permissions.organization[organization.id].effective).toContain("users.create");
    });

    test("should apply permission overrides correctly", async () => {
      const user = await createTestUser();
      const organization = await createTestOrganization();
      const role = await createTestRole(organization.id, ["users.read"]);

      await assignRoleToUser(user.id, role.id, "organization", organization.id);

      // Add override to grant additional permission
      await createPermissionOverride({
        userId: user.id,
        permissionId: "users.delete",
        scope: "organization",
        scopeId: organization.id,
        granted: true,
        reason: "Test override",
      });

      const permissions = await permissionService.calculateEffectivePermissions(
        user.id,
        organization.id
      );

      expect(permissions.organization[organization.id].effective).toContain("users.read");
      expect(permissions.organization[organization.id].effective).toContain("users.delete");
    });
  });
});

// Integration tests for invitation flows
describe("Invitation Integration", () => {
  test("should handle complete invitation flow", async () => {
    // 1. Create organization and owner
    const owner = await createTestUser();
    const organization = await createTestOrganization(owner.id);

    // 2. Create invitation
    const invitation = await invitationService.createInvitation({
      email: "invitee@example.com",
      organizationId: organization.id,
      roleId: await getRoleBySlug("member"),
    });

    expect(invitation.status).toBe("pending");
    expect(invitation.token).toBeDefined();

    // 3. Accept invitation
    const acceptanceResult = await invitationService.acceptInvitation(invitation.token, {
      firstName: "New",
      lastName: "Member",
      password: "SecurePass123!",
      agreedToTerms: true,
    });

    expect(acceptanceResult.success).toBe(true);
    expect(acceptanceResult.user.email).toBe("invitee@example.com");
    expect(acceptanceResult.organization.id).toBe(organization.id);

    // 4. Verify user has correct role
    const userRoles = await getUserRoles(acceptanceResult.user.id, organization.id);
    expect(userRoles).toHaveLength(1);
    expect(userRoles[0].role.slug).toBe("member");

    // 5. Verify invitation is marked as accepted
    const updatedInvitation = await getInvitation(invitation.id);
    expect(updatedInvitation.status).toBe("accepted");
    expect(updatedInvitation.acceptedBy).toBe(acceptanceResult.user.id);
  });
});

// E2E tests for user workflows
describe("Authentication E2E", () => {
  test("should complete full registration and onboarding flow", async () => {
    await page.goto("/signup");

    // Fill registration form
    await page.fill('input[name="email"]', "test@example.com");
    await page.fill('input[name="password"]', "SecurePass123!");
    await page.fill('input[name="firstName"]', "John");
    await page.fill('input[name="lastName"]', "Doe");
    await page.fill('input[name="organizationName"]', "Test Organization");

    // Submit registration
    await page.click('button[type="submit"]');

    // Should redirect to email verification
    await expect(page.url()).toContain("/auth/verify-email");

    // Simulate email verification (in test environment)
    await simulateEmailVerification("test@example.com");

    // Should redirect to onboarding
    await expect(page.url()).toContain("/onboarding");

    // Complete onboarding steps
    await page.fill('input[name="timezone"]', "America/New_York");
    await page.click('button[data-testid="complete-profile"]');

    await page.click('button[data-testid="skip-team-setup"]');

    // Should redirect to dashboard
    await expect(page.url()).toContain("/dashboard");

    // Verify user context is loaded
    await expect(page.locator('[data-testid="user-menu"]')).toContainText("John Doe");
    await expect(page.locator('[data-testid="organization-name"]')).toContainText(
      "Test Organization"
    );
  });
});
```

#### 10.2 Security Testing

**Security-Focused Test Scenarios:**

```typescript
describe("Security Tests", () => {
  describe("permission escalation prevention", () => {
    test("should prevent users from granting themselves higher permissions", async () => {
      const user = await createTestUser();
      const organization = await createTestOrganization();
      const memberRole = await getRoleBySlug("member");

      await assignRoleToUser(user.id, memberRole.id, "organization", organization.id);

      // Attempt to grant admin role to self
      await expect(
        roleService.assignRoleToUser(
          user.id,
          await getRoleBySlug("admin"),
          { scope: "organization", scopeId: organization.id },
          user.id // Attempting as self
        )
      ).rejects.toThrow("Insufficient permissions");
    });

    test("should prevent role modification without proper permissions", async () => {
      const user = await createTestUser();
      const organization = await createTestOrganization();
      const memberRole = await getRoleBySlug("member");

      await assignRoleToUser(user.id, memberRole.id, "organization", organization.id);

      // Attempt to modify role permissions
      await expect(
        roleService.assignPermissionsToRole(
          memberRole.id,
          [{ permissionId: "admin.access", granted: true }],
          user.id // Attempting as member
        )
      ).rejects.toThrow("Insufficient permissions");
    });
  });

  describe("injection prevention", () => {
    test("should sanitize invitation data", async () => {
      const maliciousData = {
        email: "test@example.com",
        organizationId: "org-123",
        roleId: "'; DROP TABLE users; --",
        customMessage: '<script>alert("xss")</script>',
      };

      const invitation = await invitationService.createInvitation(maliciousData);

      // Verify data is sanitized
      expect(invitation.roleId).not.toContain("DROP TABLE");
      expect(invitation.customMessage).not.toContain("<script>");
    });
  });

  describe("rate limiting", () => {
    test("should enforce invitation rate limits", async () => {
      const user = await createTestUser();
      const organization = await createTestOrganization();

      // Create maximum allowed invitations
      const maxInvites = 10;
      for (let i = 0; i < maxInvites; i++) {
        await invitationService.createInvitation({
          email: `test${i}@example.com`,
          organizationId: organization.id,
          roleId: await getRoleBySlug("member"),
        });
      }

      // Next invitation should be rate limited
      await expect(
        invitationService.createInvitation({
          email: "overflow@example.com",
          organizationId: organization.id,
          roleId: await getRoleBySlug("member"),
        })
      ).rejects.toThrow("Rate limit exceeded");
    });
  });
});
```

### Phase 11: Migration & Deployment Strategy

#### 11.1 Database Migration Approach

**Migration File Structure:**

```
supabase/migrations/
├── 20240101000001_create_auth_foundations.sql
├── 20240101000002_create_permissions_system.sql
├── 20240101000003_create_roles_system.sql
├── 20240101000004_create_invitation_system.sql
├── 20240101000005_create_rls_policies.sql
├── 20240101000006_create_functions_and_triggers.sql
├── 20240101000007_seed_initial_data.sql
└── 20240101000008_create_audit_system.sql
```

**Migration Validation:**

```typescript
interface MigrationValidator {
  // Pre-migration checks
  validateDependencies(): Promise<ValidationResult>;
  checkDataIntegrity(): Promise<IntegrityCheck>;
  verifyBackupExists(): Promise<boolean>;

  // Post-migration validation
  validateMigrationSuccess(): Promise<ValidationResult>;
  verifyRLSPolicies(): Promise<RLSValidation>;
  testCriticalPaths(): Promise<PathTestResult>;

  // Rollback capabilities
  canRollback(migrationId: string): Promise<boolean>;
  createRollbackScript(migrationId: string): Promise<string>;
  executeSafeRollback(migrationId: string): Promise<RollbackResult>;
}

// Example migration validation
const validateAuthMigration = async () => {
  const validator = new MigrationValidator();

  // Pre-migration checks
  const dependencies = await validator.validateDependencies();
  if (!dependencies.valid) {
    throw new Error(`Migration dependencies not met: ${dependencies.errors.join(", ")}`);
  }

  // Execute migration
  await supabase.sql`
    -- Migration content here
  `;

  // Post-migration validation
  const validation = await validator.validateMigrationSuccess();
  if (!validation.valid) {
    // Attempt rollback
    const canRollback = await validator.canRollback("auth_migration_v1");
    if (canRollback) {
      await validator.executeSafeRollback("auth_migration_v1");
    }
    throw new Error(`Migration failed: ${validation.errors.join(", ")}`);
  }

  // Test critical authentication paths
  const pathTests = await validator.testCriticalPaths();
  if (pathTests.failures.length > 0) {
    console.warn("Some authentication paths failed after migration:", pathTests.failures);
  }
};
```

#### 11.2 Deployment Pipeline

**Multi-Environment Strategy:**

```yaml
# GitHub Actions workflow
name: Auth System Deployment

on:
  push:
    branches: [main, develop]
  pull_request:
    branches: [main]

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: "20"

      - name: Install dependencies
        run: npm ci

      - name: Run unit tests
        run: npm run test:unit

      - name: Run integration tests
        run: npm run test:integration

      - name: Run security tests
        run: npm run test:security

  deploy-staging:
    needs: test
    if: github.ref == 'refs/heads/develop'
    runs-on: ubuntu-latest
    steps:
      - name: Deploy to staging
        run: |
          # Deploy migrations to staging Supabase
          supabase db push --db-url $STAGING_DB_URL

          # Run migration validation
          npm run validate:migration:staging

          # Deploy application
          vercel deploy --token $VERCEL_TOKEN

      - name: Run E2E tests on staging
        run: npm run test:e2e:staging

  deploy-production:
    needs: test
    if: github.ref == 'refs/heads/main'
    runs-on: ubuntu-latest
    environment: production
    steps:
      - name: Create database backup
        run: |
          # Create production backup before migration
          supabase db backup --db-url $PRODUCTION_DB_URL

      - name: Deploy migrations with validation
        run: |
          # Deploy with extra validation
          npm run deploy:production:safe

      - name: Verify deployment
        run: |
          # Health checks and smoke tests
          npm run verify:production
```

**Safe Production Deployment Script:**

```typescript
// Safe deployment process
const deployToProduction = async () => {
  const deployment = new SafeDeployment({
    environment: "production",
    validationLevel: "strict",
    rollbackEnabled: true,
  });

  try {
    // 1. Pre-deployment validation
    await deployment.validateEnvironment();
    await deployment.createBackup();
    await deployment.validateBackup();

    // 2. Deploy in stages
    await deployment.deployMigrations();
    await deployment.validateMigrations();

    await deployment.deployApplication();
    await deployment.validateApplication();

    // 3. Post-deployment verification
    await deployment.runSmokeTests();
    await deployment.verifyHealthEndpoints();
    await deployment.testCriticalUserJourneys();

    // 4. Enable traffic gradually
    await deployment.enableTrafficGradually({
      stages: [0.1, 0.25, 0.5, 1.0],
      intervalMinutes: 15,
      rollbackOnError: true,
    });
  } catch (error) {
    console.error("❌ Production deployment failed:", error);

    // Automatic rollback
    await deployment.rollback();
    throw error;
  }
};
```

---

## Development Methodology

### TDD Implementation Approach

**Test-First Development Cycle:**

1. **Write Failing Tests**: Start with comprehensive test cases that define expected behavior
2. **Implement Minimal Code**: Write just enough code to make tests pass
3. **Refactor and Improve**: Enhance code quality while maintaining test coverage
4. **Integration Testing**: Test interactions between components
5. **E2E Validation**: Verify complete user workflows

**Quality Gates:**

- **Code Coverage**: Minimum 85% test coverage for core authentication logic
- **Type Safety**: Full TypeScript strict mode compliance
- **Security Testing**: Regular security audits and penetration testing
- **Performance**: Sub-100ms API response times, sub-2s page load times
- **Accessibility**: WCAG 2.1 AA compliance

### Success Metrics

**Technical Metrics:**

- **Scalability**: Support 10,000+ users per organization
- **Security**: Zero critical vulnerabilities in security audits
- **Performance**: 99.9% uptime with sub-2s average response times
- **Reliability**: Zero data loss, automated backup and recovery

**User Experience Metrics:**

- **Onboarding Completion**: >80% of invited users complete onboarding
- **User Satisfaction**: >4.5/5 user satisfaction score
- **Support Tickets**: <2% of users require auth-related support
- **Feature Adoption**: >60% utilization of advanced permission features

**Business Metrics:**

- **Time to Value**: New organizations productive within 24 hours
- **Retention**: >95% monthly active user retention
- **Scalability**: Seamless scaling from 1 to 10,000+ users per organization
- **Compliance**: Pass all required security and compliance audits

---

## Implementation Timeline

**Phase 1-2 (Weeks 1-4): Foundation**

- Project setup with comprehensive testing infrastructure
- Core database schema and authentication infrastructure
- Basic JWT and permission systems

**Phase 3-5 (Weeks 5-8): Core Features**

- Email integration with Resend and React Email
- Complete invitation system with bulk operations
- Enhanced user registration and onboarding flows

**Phase 6-8 (Weeks 9-12): Advanced Features**

- Organization and branch management systems
- Advanced role and permission management
- Security, compliance, and audit systems

**Phase 9-11 (Weeks 13-16): Polish and Deployment**

- User experience components and interfaces
- Comprehensive testing and validation
- Production deployment and monitoring setup

This comprehensive implementation plan provides a roadmap for building a sophisticated, secure, and scalable multi-tenant authentication system that will serve as the foundation for a modern SaaS application.
