# Role & Permission System Analysis & Implementation Plan

## Executive Summary

This document provides a comprehensive analysis of the current authentication, roles, and permission setup in the coreframe-boilerplate project based on **live Supabase database inspection**. The system foundation is much more complete than initially assessed, with working JWT authentication and active role assignments.

## ✅ ACTUAL Current State Analysis (Live Database Verified)

### 1. Database Schema Overview - **CONFIRMED WORKING**

#### Core Authentication Tables

- **`users`** - Application users linked to Supabase auth.users ✅
- **`organizations`** - Multi-tenant organization structure (1 active org) ✅
- **`branches`** - Sub-organizational units (3 active branches) ✅
- **`teams`** - Team structure within branches ✅

#### Role-Based Access Control (RBAC) Tables - **ALL PRESENT & ACTIVE**

- **`roles`** - Role definitions with organization scoping ✅
  - 4 active roles: `org_owner`, `org_admin`, `branch_manager`, `branch_employee`
  - `organization_id` properly set for organization-specific roles
  - `is_basic` flag distinguishes system vs custom roles
- **`permissions`** - System-wide permission definitions ✅
  - 10 active permissions: audit.view, branch.manage, org.edit, user.manage, etc.
- **`role_permissions`** - Many-to-many role-permission mappings ✅
  - `org_owner` role has all 10 permissions assigned
- **`user_role_assignments`** - User role assignments with scope ✅
  - 3 users with `org_owner` role at organization scope
  - Properly structured with scope ('org'/'branch') and scope_id
- **`user_permission_overrides`** - Per-user permission exceptions ✅
  - Table exists but no active overrides (0 records)

### 2. What's Already Working - **MAJOR DISCOVERY**

#### ✅ JWT Authentication System

- **`custom_access_token_hook`** is **WORKING CORRECTLY**
- Uses proper `user_role_assignments` table (not legacy `user_roles`)
- Generates proper JWT claims with role, role_id, org_id, branch_id
- Role extraction and validation is functional

#### ✅ Active Role System

- **Real users with roles**: 3 users have `org_owner` role assigned
- **Complete permission mappings**: `org_owner` has all system permissions
- **Multi-tenant structure**: Roles scoped to specific organization
- **Database integrity**: All foreign keys and constraints working

#### ✅ Partial Security Implementation

- **RLS Enabled**: `permissions` and `role_permissions` tables have RLS policies
- **Basic authentication**: "Allow SELECT for logged-in users" policies active

### 3. What Still Needs Implementation

#### Missing Security Policies

1. **`roles` table**: No RLS policies (rowsecurity: false)
2. **`user_role_assignments`**: No RLS policies (rowsecurity: false)
3. **`user_permission_overrides`**: No RLS policies (rowsecurity: false)

#### Frontend-Backend Disconnect

1. **UI uses mock data**: Role management interface exists but not connected to database
2. **No API layer**: Server actions for role management not implemented
3. **Permission validation**: Frontend role checking works, backend validation missing

## Corrected Implementation Plan (Based on Live Database Analysis)

### Phase 1: Complete Security Implementation (HIGH PRIORITY)

#### 1.1 Row Level Security Policies - **CRITICAL MISSING PIECE**

**Immediate Tasks:**

- [ ] Enable RLS and add policies for `roles` table
- [ ] Enable RLS and add policies for `user_role_assignments` table
- [ ] Enable RLS and add policies for `user_permission_overrides` table
- [ ] Test organization-scoped data isolation

**Required RLS Policies:**

```sql
-- Enable RLS on missing tables
ALTER TABLE roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_role_assignments ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_permission_overrides ENABLE ROW LEVEL SECURITY;

-- Organization-scoped role visibility
CREATE POLICY "Users can view roles in their organization" ON roles
FOR SELECT USING (
  organization_id IN (
    SELECT scope_id FROM user_role_assignments
    WHERE user_id = auth.uid() AND scope = 'org'
  )
);

-- Role assignment management by org owners
CREATE POLICY "Org owners can manage role assignments" ON user_role_assignments
FOR ALL USING (
  EXISTS (
    SELECT 1 FROM user_role_assignments ura
    JOIN roles r ON ura.role_id = r.id
    WHERE ura.user_id = auth.uid()
    AND r.name = 'org_owner'
    AND ura.scope = 'org'
    AND ura.scope_id = user_role_assignments.scope_id
  )
);
```

#### 1.2 TypeScript Type Corrections - **MINOR FIXES NEEDED**

**Tasks:**

- [ ] Update mock data in `src/lib/mock/organization.ts` to use real database structure
- [ ] Fix type references in role management components
- [ ] Ensure consistent naming across codebase

### Phase 2: Backend API Implementation (MEDIUM PRIORITY)

#### 2.1 Server Actions for Role Management

**Create API Layer:**

```typescript
// src/app/actions/roles/
-getRolesForOrganization(organizationId) - // ✅ Data exists, need API
  assignUserRole(userId, roleId, scope, scopeId) - // ✅ Structure ready
  revokeUserRole(assignmentId) - // ✅ Can implement immediately
  createCustomRole(organizationId, roleData) - // ✅ Database supports
  updateRolePermissions(roleId, permissions); // ✅ role_permissions ready
```

#### 2.2 Permission Validation Services

**Backend Permission Checking:**

```typescript
// src/lib/auth/permissions.ts
-hasPermission(userId, permissionSlug, scope, scopeId) -
  getUserEffectivePermissions(userId, organizationId) -
  validateRoleAssignment(assignerUserId, targetUserId, roleId);
```

### Phase 3: Frontend Integration (MEDIUM PRIORITY)

#### 3.1 Connect Existing UI to Database

**Current Status:**

- ✅ Role management UI exists at `/dashboard/organization/users/roles`
- ✅ UI components are well-designed and functional
- ❌ Uses mock data instead of real database queries

**Integration Tasks:**

```typescript
// Replace mock data usage in:
- src/app/[locale]/dashboard/organization/users/roles/page.tsx
- src/lib/mock/organization.ts (update to use real queries)

// Create data fetching utilities:
- src/lib/api/roles.ts (fetch roles, permissions, assignments)
- src/hooks/useRoles.ts (React hooks for role data)
- src/hooks/usePermissions.ts (React hooks for permission data)
```

#### 3.2 Enhanced Role Assignment Interface

**Upgrade Existing Components:**

- Connect role table to real `user_role_assignments` data
- Add role assignment/revocation functionality
- Implement permission override management
- Add real-time role validation

**New Components Needed:**

```
src/modules/organization-management/components/roles/
├── RoleAssignmentDialog.tsx        # Assign roles to users
├── PermissionOverrideDialog.tsx    # Manage permission exceptions
├── BulkRoleActions.tsx             # Bulk role operations
└── RoleAuditLog.tsx                # Track role changes
```

### Phase 4: Advanced Features (LOW PRIORITY)

#### 4.1 Custom Role Creation

- **Database Ready**: `roles` table supports custom org roles
- **UI Enhancement**: Add custom role creation interface
- **Validation Logic**: Ensure role name uniqueness per organization

#### 4.2 Permission Override System

- **Database Ready**: `user_permission_overrides` table exists
- **UI Components**: Build permission override management interface
- **Backend Logic**: Implement permission resolution with overrides

## Implementation Priority & Timeline

### **IMMEDIATE (This Week)**

1. **Add Missing RLS Policies** - Critical security gap
2. **Fix Type Inconsistencies** - Update mock data references
3. **Test Current JWT System** - Verify role extraction works

### **SHORT TERM (Next 2 Weeks)**

1. **Create Server Actions** - Role assignment APIs
2. **Connect Frontend to Database** - Replace mock data
3. **Add Permission Validation** - Backend permission checking

### **MEDIUM TERM (Next Month)**

1. **Enhanced Role Management UI** - Full CRUD operations
2. **Permission Override System** - Granular permission control
3. **Custom Role Creation** - Organization-specific roles

### **LONG TERM (Future)**

1. **Advanced Workflow Integration** - Module-level permission control
2. **Audit & Compliance Features** - Complete activity tracking
3. **Role Templates & Inheritance** - Advanced role hierarchy

## Key Discoveries & Corrections

### ✅ **What's Actually Working (Contrary to Initial Assessment)**

1. **JWT Hook**: Properly using `user_role_assignments`, generating correct claims
2. **Database Schema**: All RBAC tables exist and are properly structured
3. **Active Role Data**: Real users with roles, complete permission mappings
4. **Frontend Components**: Well-designed role management UI already exists

### ❌ **What Actually Needs Work (Much Less Than Expected)**

1. **Security Policies**: 3 tables missing RLS policies (critical but quick fix)
2. **API Integration**: Frontend needs to connect to database (straightforward)
3. **Backend Validation**: Permission checking on server side (standard implementation)

### 📝 **Updated Assessment**

- **Original Estimate**: 8-12 weeks for full implementation
- **Revised Estimate**: 3-4 weeks for core functionality
- **Risk Level**: Low (foundation is solid, mostly connecting existing pieces)
- **Priority**: High value, low effort implementation

## Technical Specifications

### Database Schema Migrations

#### System Roles and Permissions

```sql
-- Standard system roles
INSERT INTO roles (name, is_basic, organization_id) VALUES
('org_owner', true, NULL),
('org_admin', true, NULL),
('branch_admin', true, NULL),
('branch_manager', true, NULL),
('team_leader', true, NULL),
('employee', true, NULL);

-- Core permissions
INSERT INTO permissions (slug, label) VALUES
('users.view', 'View Users'),
('users.create', 'Create Users'),
('users.edit', 'Edit Users'),
('users.delete', 'Delete Users'),
('roles.view', 'View Roles'),
('roles.create', 'Create Custom Roles'),
('roles.edit', 'Edit Roles'),
('roles.delete', 'Delete Roles'),
('permissions.assign', 'Assign Permissions'),
('org.settings', 'Organization Settings'),
('branch.settings', 'Branch Settings');
```

### API Endpoints Design

#### Role Management Endpoints

```typescript
// Role CRUD
POST   /api/organizations/[id]/roles          # Create custom role
GET    /api/organizations/[id]/roles          # List organization roles
PATCH  /api/roles/[id]                        # Update role
DELETE /api/roles/[id]                        # Delete role

// Role Assignments
POST   /api/users/[id]/roles                  # Assign role to user
DELETE /api/users/[id]/roles/[roleId]         # Revoke role from user
GET    /api/users/[id]/roles                  # Get user's roles

// Permission Overrides
POST   /api/users/[id]/permissions            # Add permission override
DELETE /api/users/[id]/permissions/[permId]   # Remove permission override
```

### Performance Considerations

#### Database Optimization

- Composite indexes on `user_role_assignments` for common queries
- Materialized views for complex permission calculations
- Caching strategy for role hierarchy lookups
- Query optimization for organization-scoped operations

#### Frontend Performance

- Role data caching and invalidation strategy
- Lazy loading for large role lists
- Optimistic updates for role assignments
- Debounced search and filtering

## Testing Strategy

### Unit Tests

- Role assignment/revocation logic
- Permission calculation algorithms
- JWT claim generation and parsing
- RLS policy effectiveness

### Integration Tests

- End-to-end role management workflows
- Cross-module permission checks
- Multi-tenant data isolation

### Security Tests

- Permission escalation attempts
- Cross-organization data access
- JWT manipulation resistance
- RLS policy bypass attempts

## Migration & Deployment Strategy

### Database Migration Path

1. **Phase 1**: Fix broken references and add RLS policies
2. **Phase 2**: Add new columns and tables for advanced features
3. **Phase 3**: Migrate existing data, add constraints
4. **Phase 4**: Performance optimizations and cleanup

### Feature Rollout Plan

1. **Beta Phase**: Deploy to development environment
2. **Limited Release**: Single organization testing
3. **Gradual Rollout**: Progressive feature enablement
4. **Full Release**: All organizations with monitoring

### Rollback Strategy

- Database migration rollback scripts
- Feature flag-based rollback capability
- Data backup and restoration procedures
- Monitoring and alerting for issues

## Success Metrics

### Functional Metrics

- Role assignment completion rate
- Permission override usage
- Custom role adoption
- User management efficiency improvements

### Performance Metrics

- Role checking query performance
- UI responsiveness for role operations
- JWT token generation speed
- Database query optimization effectiveness

### Security Metrics

- Failed authorization attempts
- Permission escalation detection
- Audit compliance scores
- Security vulnerability assessments

## Conclusion

This implementation plan provides a comprehensive roadmap for transforming the current basic role system into a sophisticated, organization-managed RBAC solution. The phased approach ensures system stability while delivering incremental value to users.

The enhanced system will support:

- ✅ Organization owner-managed custom roles
- ✅ Granular per-user permission overrides
- ✅ Scalable multi-tenant architecture
- ✅ Comprehensive audit and compliance features
- ✅ Modern, intuitive admin interfaces

**Estimated Timeline**: 8-12 weeks for full implementation
**Priority**: Critical for enterprise customer requirements
**Risk Level**: Medium (well-planned migration strategy)
