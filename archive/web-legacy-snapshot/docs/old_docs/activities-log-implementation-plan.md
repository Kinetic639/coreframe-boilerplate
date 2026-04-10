# Activities Log System - Detailed Implementation Plan (Updated)

## Overview

The Activities Log system provides comprehensive tracking of all user actions and system events across the entire application with scope-based visibility and module subscription awareness. This system serves as both an audit trail for compliance and a foundation for analytics, notifications, and user behavior insights.

## Architecture Strategy

### Hybrid Module Approach

1. **Home Module Widget**: Recent activities with basic filtering - available to all users
2. **Analytics Module**: Complete activity history, advanced analytics, and reporting - premium feature
3. **Scope-Based Visibility**: Activities visible only to relevant users/branches based on permissions
4. **Data Preservation**: Never delete activities, only hide them when subscriptions end
5. **Iterative Implementation**: Start with one activity type (`product.created`), expand gradually

## Core Architecture

### Database Schema - Normalized Design

The new schema uses **normalized references** for better data integrity, scalability, and query performance:

#### Supporting Tables (Reference Data)

```sql
-- activity_modules: normalized module references
CREATE TABLE activity_modules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slug TEXT UNIQUE NOT NULL, -- e.g., 'warehouse', 'catalog', 'organization'
  name TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- activity_entity_types: normalized entity type references
CREATE TABLE activity_entity_types (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slug TEXT UNIQUE NOT NULL, -- e.g., 'product', 'location', 'user'
  module_id UUID REFERENCES activity_modules(id) ON DELETE SET NULL,
  table_name TEXT, -- actual database table name
  description TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- activity_actions: normalized action references
CREATE TABLE activity_actions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slug TEXT UNIQUE NOT NULL, -- e.g., 'created', 'updated', 'deleted'
  description TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
```

#### Primary Table: `activities`

```sql
CREATE TABLE activities (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Organization/Branch context
  organization_id UUID NOT NULL REFERENCES organizations(id),
  branch_id UUID REFERENCES branches(id), -- nullable for org-level activities
  user_id UUID REFERENCES users(id), -- nullable for system activities

  -- Normalized references
  module_id UUID REFERENCES activity_modules(id),
  entity_type_id UUID REFERENCES activity_entity_types(id),
  action_id UUID REFERENCES activity_actions(id),

  -- Entity and description
  entity_id UUID, -- ID of the affected entity
  description TEXT NOT NULL,
  metadata JSONB DEFAULT '{}',

  -- Status tracking
  status TEXT DEFAULT 'recorded' CHECK (
    status IN ('recorded', 'processed', 'archived', 'error')
  ),

  -- Request context
  url TEXT,
  ip_address INET,
  user_agent TEXT,
  session_id UUID,

  -- Comprehensive timestamp tracking
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  deleted_at TIMESTAMP WITH TIME ZONE -- Soft delete support
);

-- Performance indexes
CREATE INDEX idx_activities_org_branch ON activities(organization_id, branch_id);
CREATE INDEX idx_activities_user ON activities(user_id);
CREATE INDEX idx_activities_entity ON activities(entity_type_id, entity_id);
CREATE INDEX idx_activities_created_at ON activities(created_at);
CREATE INDEX idx_activities_deleted_at ON activities(deleted_at);
CREATE INDEX idx_activities_status ON activities(status);
CREATE INDEX idx_activities_module ON activities(module_id);

-- Composite indexes for common queries
CREATE INDEX idx_activities_org_module_created ON activities(organization_id, module_id, created_at DESC);
CREATE INDEX idx_activities_user_created ON activities(user_id, created_at DESC) WHERE deleted_at IS NULL;

-- Updated trigger for automatic timestamp updates
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_activities_updated_at
  BEFORE UPDATE ON activities
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
```

#### Seed Data for Reference Tables

```sql
-- Insert activity modules
INSERT INTO activity_modules (slug, name) VALUES
  ('warehouse', 'Warehouse Management'),
  ('catalog', 'Product Catalog'),
  ('organization', 'Organization Management'),
  ('teams', 'Team Collaboration'),
  ('support', 'Support & Help'),
  ('system', 'System Operations'),
  ('security', 'Security & Authentication');

-- Insert common entity types
INSERT INTO activity_entity_types (slug, module_id, table_name, description) VALUES
  ('product', (SELECT id FROM activity_modules WHERE slug = 'warehouse'), 'products', 'Product entities'),
  ('product_variant', (SELECT id FROM activity_modules WHERE slug = 'warehouse'), 'product_variants', 'Product variant entities'),
  ('location', (SELECT id FROM activity_modules WHERE slug = 'warehouse'), 'locations', 'Storage location entities'),
  ('supplier', (SELECT id FROM activity_modules WHERE slug = 'warehouse'), 'suppliers', 'Supplier entities'),
  ('delivery', (SELECT id FROM activity_modules WHERE slug = 'warehouse'), 'deliveries', 'Delivery entities'),
  ('user', (SELECT id FROM activity_modules WHERE slug = 'organization'), 'users', 'User entities'),
  ('branch', (SELECT id FROM activity_modules WHERE slug = 'organization'), 'branches', 'Branch entities'),
  ('organization', (SELECT id FROM activity_modules WHERE slug = 'organization'), 'organizations', 'Organization entities');

-- Insert common actions
INSERT INTO activity_actions (slug, description) VALUES
  ('created', 'Entity was created'),
  ('updated', 'Entity was updated'),
  ('deleted', 'Entity was deleted'),
  ('restored', 'Entity was restored from deletion'),
  ('activated', 'Entity was activated'),
  ('deactivated', 'Entity was deactivated'),
  ('moved', 'Entity was moved or transferred'),
  ('assigned', 'Entity was assigned'),
  ('unassigned', 'Entity was unassigned'),
  ('processed', 'Entity was processed'),
  ('completed', 'Process was completed'),
  ('failed', 'Process failed'),
  ('cancelled', 'Process was cancelled');
```

## Activity Categories & Types

### 1. Warehouse Activities

**Category**: `warehouse`
**Retention**: 2 years (for audit compliance)

#### Product Management

- `product.created` - New product added
- `product.updated` - Product details modified
- `product.deleted` - Product soft deleted
- `product.restored` - Product restored from deletion
- `product_variant.created` - New variant added
- `product_variant.updated` - Variant modified
- `product_variant.deleted` - Variant removed

**Metadata Structure**:

```json
{
  "product_id": "uuid",
  "product_name": "string",
  "changes": {
    "field_name": {
      "old_value": "any",
      "new_value": "any"
    }
  },
  "variant_details": {
    "variant_id": "uuid",
    "sku": "string"
  }
}
```

#### Stock Movements

- `stock.movement_created` - New stock movement recorded
- `stock.adjustment` - Manual stock adjustment
- `stock.transfer` - Internal location transfer
- `stock.correction` - Correction after audit
- `stock.reservation` - Stock reserved
- `stock.release` - Stock released from reservation

**Metadata Structure**:

```json
{
  "movement_id": "uuid",
  "movement_type": "string",
  "product_variant_id": "uuid",
  "from_location_id": "uuid",
  "to_location_id": "uuid",
  "quantity": "number",
  "reason": "string",
  "reference_id": "uuid"
}
```

#### Location Management

- `location.created` - New location added
- `location.updated` - Location details changed
- `location.moved` - Location hierarchy changed
- `location.deleted` - Location soft deleted
- `location.qr_generated` - QR code generated for location

#### Supplier & Delivery Management

- `supplier.created` - New supplier added
- `supplier.updated` - Supplier details modified
- `delivery.created` - New delivery scheduled
- `delivery.status_changed` - Delivery status updated
- `delivery.received` - Delivery marked as received
- `delivery.processed` - Delivery processing completed

### 2. Organization Activities

**Category**: `organization`
**Retention**: 7 years (for legal compliance)

#### User Management

- `user.invited` - User invited to organization
- `user.joined` - User accepted invitation
- `user.role_assigned` - Role assigned to user
- `user.role_removed` - Role removed from user
- `user.deactivated` - User account deactivated
- `user.reactivated` - User account reactivated

#### Branch Management

- `branch.created` - New branch added
- `branch.updated` - Branch details modified
- `branch.user_assigned` - User assigned to branch
- `branch.user_removed` - User removed from branch

#### Organization Settings

- `organization.updated` - Organization details changed
- `organization.settings_changed` - Settings modified
- `organization.logo_updated` - Logo changed

### 3. User Activities

**Category**: `user`
**Retention**: 1 year

#### Authentication & Session

- `user.login` - User logged in
- `user.logout` - User logged out
- `user.password_changed` - Password updated
- `user.profile_updated` - Profile information changed
- `user.preferences_updated` - User preferences changed

#### Navigation & Interaction

- `user.page_visited` - Page/module accessed
- `user.search_performed` - Search query executed
- `user.export_generated` - Data export created
- `user.import_performed` - Data import executed

### 4. System Activities

**Category**: `system`
**Retention**: 30 days

#### Automated Processes

- `system.backup_created` - Automated backup completed
- `system.cleanup_performed` - Automated cleanup executed
- `system.notification_sent` - System notification dispatched
- `system.integration_sync` - External system sync
- `system.maintenance_started` - Maintenance mode enabled
- `system.maintenance_ended` - Maintenance mode disabled

#### Data Processing

- `system.report_generated` - Automated report created
- `system.analytics_processed` - Analytics data processed
- `system.trigger_executed` - Database trigger fired

### 5. Security Activities

**Category**: `security`
**Retention**: 5 years (for security compliance)

#### Security Events

- `security.failed_login` - Failed login attempt
- `security.account_locked` - Account locked due to failed attempts
- `security.suspicious_activity` - Suspicious behavior detected
- `security.permission_denied` - Access denied to resource
- `security.api_rate_limit` - API rate limit exceeded

#### Data Access

- `security.sensitive_data_accessed` - Sensitive information viewed
- `security.data_exported` - Data export with sensitive information
- `security.admin_action` - Administrative action performed

## Implementation Structure

### 1. Core Service Layer

```typescript
// src/lib/services/activity-service.ts
export interface ActivityInput {
  organizationId: string;
  branchId?: string;
  userId?: string;
  moduleSlug: string; // e.g., 'warehouse', 'organization'
  entityTypeSlug?: string; // e.g., 'product', 'location', 'user'
  actionSlug: string; // e.g., 'created', 'updated', 'deleted'
  entityId?: string;
  description: string;
  metadata?: Record<string, any>;
  status?: "recorded" | "processed" | "archived" | "error";
  url?: string;
  ipAddress?: string;
  userAgent?: string;
  sessionId?: string;
}

export interface ActivityFilters {
  organizationId: string;
  branchId?: string;
  userId?: string;
  moduleIds?: string[];
  entityTypeIds?: string[];
  actionIds?: string[];
  status?: string[];
  dateFrom?: Date;
  dateTo?: Date;
  includeDeleted?: boolean;
  limit?: number;
  offset?: number;
}

export interface ActivityWithRelations extends Activity {
  module?: ActivityModule;
  entityType?: ActivityEntityType;
  action?: ActivityAction;
  user?: User;
  branch?: Branch;
}

export class ActivityService {
  // Core logging methods
  async log(activity: ActivityInput): Promise<string>; // Returns activity ID
  async logBatch(activities: ActivityInput[]): Promise<string[]>; // Returns activity IDs

  // Query methods with normalized joins
  async getActivities(filters: ActivityFilters): Promise<{
    activities: ActivityWithRelations[];
    total: number;
    hasMore: boolean;
  }>;
  async getActivityById(id: string): Promise<ActivityWithRelations | null>;
  async getActivitiesByEntity(
    entityTypeSlug: string,
    entityId: string
  ): Promise<ActivityWithRelations[]>;

  // Reference data methods
  async getModules(): Promise<ActivityModule[]>;
  async getEntityTypes(moduleSlug?: string): Promise<ActivityEntityType[]>;
  async getActions(): Promise<ActivityAction[]>;

  // Analytics methods
  async getActivitySummary(filters: ActivityFilters): Promise<ActivitySummary>;
  async getUserActivityReport(userId: string, timeRange: TimeRange): Promise<UserActivityReport>;
  async getModuleActivityStats(
    organizationId: string,
    timeRange: TimeRange
  ): Promise<ModuleActivityStats[]>;

  // Utility methods
  async softDeleteActivity(id: string): Promise<void>;
  async updateActivityStatus(id: string, status: ActivityStatus): Promise<void>;
  async bulkUpdateStatus(ids: string[], status: ActivityStatus): Promise<void>;
}
```

### 2. Logging Hooks & Utilities

```typescript
// src/hooks/useActivityLogger.ts
export function useActivityLogger() {
  const { activeOrgId, activeBranchId } = useAppStore();
  const { user } = useUser();

  const logActivity = useCallback(
    async (activity: Omit<ActivityInput, "organizationId" | "userId" | "branchId">) => {
      return await ActivityService.log({
        ...activity,
        organizationId: activeOrgId,
        branchId: activeBranchId,
        userId: user?.id,
      });
    },
    [activeOrgId, activeBranchId, user?.id]
  );

  // Helper methods for common module activities
  const logWarehouseActivity = useCallback(
    async (
      entityTypeSlug: string,
      actionSlug: string,
      entityId: string,
      description: string,
      metadata?: Record<string, any>
    ) => {
      return logActivity({
        moduleSlug: "warehouse",
        entityTypeSlug,
        actionSlug,
        entityId,
        description,
        metadata,
      });
    },
    [logActivity]
  );

  const logOrganizationActivity = useCallback(
    async (
      entityTypeSlug: string,
      actionSlug: string,
      entityId: string,
      description: string,
      metadata?: Record<string, any>
    ) => {
      return logActivity({
        moduleSlug: "organization",
        entityTypeSlug,
        actionSlug,
        entityId,
        description,
        metadata,
      });
    },
    [logActivity]
  );

  return {
    logActivity,
    logWarehouseActivity,
    logOrganizationActivity,
  };
}

// src/utils/activity-logger.ts - Static utility methods
export class ActivityLogger {
  // Context-aware logging with automatic context injection
  static async logWithContext(
    activity: Omit<ActivityInput, "organizationId" | "userId" | "branchId">,
    context: { organizationId: string; branchId?: string; userId?: string }
  ): Promise<string> {
    return ActivityService.log({
      ...activity,
      ...context,
    });
  }

  // Module-specific logging methods
  static async logWarehouseActivity(
    context: { organizationId: string; branchId?: string; userId?: string },
    entityTypeSlug: string,
    actionSlug: string,
    entityId: string,
    description: string,
    metadata?: Record<string, any>
  ): Promise<string> {
    return this.logWithContext(
      {
        moduleSlug: "warehouse",
        entityTypeSlug,
        actionSlug,
        entityId,
        description,
        metadata,
      },
      context
    );
  }

  static async logSystemActivity(
    organizationId: string,
    actionSlug: string,
    description: string,
    metadata?: Record<string, any>
  ): Promise<string> {
    return this.logWithContext(
      {
        moduleSlug: "system",
        actionSlug,
        description,
        metadata,
      },
      { organizationId }
    );
  }

  static async logSecurityActivity(
    context: { organizationId: string; userId?: string },
    actionSlug: string,
    description: string,
    metadata?: Record<string, any>
  ): Promise<string> {
    return this.logWithContext(
      {
        moduleSlug: "security",
        actionSlug,
        description,
        metadata,
        status: "recorded", // Security events are immediately recorded
      },
      context
    );
  }
}
```

### 3. TypeScript Types

```typescript
// src/types/activities.ts
export type ActivityStatus = "recorded" | "processed" | "archived" | "error";

// Reference data types
export interface ActivityModule {
  id: string;
  slug: string;
  name: string;
  createdAt: Date;
}

export interface ActivityEntityType {
  id: string;
  slug: string;
  moduleId?: string;
  tableName?: string;
  description?: string;
  createdAt: Date;
  module?: ActivityModule;
}

export interface ActivityAction {
  id: string;
  slug: string;
  description?: string;
  createdAt: Date;
}

// Main activity interface
export interface Activity {
  id: string;
  organizationId: string;
  branchId?: string;
  userId?: string;
  moduleId?: string;
  entityTypeId?: string;
  actionId?: string;
  entityId?: string;
  description: string;
  metadata: Record<string, any>;
  status: ActivityStatus;
  url?: string;
  ipAddress?: string;
  userAgent?: string;
  sessionId?: string;
  createdAt: Date;
  updatedAt: Date;
  deletedAt?: Date;
}

// Commonly used module slugs
export const MODULE_SLUGS = {
  WAREHOUSE: "warehouse",
  CATALOG: "catalog",
  ORGANIZATION: "organization",
  TEAMS: "teams",
  SUPPORT: "support",
  SYSTEM: "system",
  SECURITY: "security",
} as const;

// Commonly used entity type slugs
export const ENTITY_TYPE_SLUGS = {
  PRODUCT: "product",
  PRODUCT_VARIANT: "product_variant",
  LOCATION: "location",
  SUPPLIER: "supplier",
  DELIVERY: "delivery",
  USER: "user",
  BRANCH: "branch",
  ORGANIZATION: "organization",
} as const;

// Commonly used action slugs
export const ACTION_SLUGS = {
  CREATED: "created",
  UPDATED: "updated",
  DELETED: "deleted",
  RESTORED: "restored",
  ACTIVATED: "activated",
  DEACTIVATED: "deactivated",
  MOVED: "moved",
  ASSIGNED: "assigned",
  UNASSIGNED: "unassigned",
  PROCESSED: "processed",
  COMPLETED: "completed",
  FAILED: "failed",
  CANCELLED: "cancelled",
} as const;

// Helper types for specific modules
export type ModuleSlug = (typeof MODULE_SLUGS)[keyof typeof MODULE_SLUGS];
export type EntityTypeSlug = (typeof ENTITY_TYPE_SLUGS)[keyof typeof ENTITY_TYPE_SLUGS];
export type ActionSlug = (typeof ACTION_SLUGS)[keyof typeof ACTION_SLUGS];

// Analytics and reporting types
export interface ActivitySummary {
  totalActivities: number;
  activitiesByModule: Record<string, number>;
  activitiesByAction: Record<string, number>;
  activitiesByStatus: Record<ActivityStatus, number>;
  topUsers: Array<{ userId: string; count: number; userName?: string }>;
  timeRange: { from: Date; to: Date };
}

export interface UserActivityReport {
  userId: string;
  userName?: string;
  totalActivities: number;
  activitiesByModule: Record<string, number>;
  lastActivity?: Date;
  mostCommonActions: Array<{ action: string; count: number }>;
}

export interface ModuleActivityStats {
  moduleSlug: string;
  moduleName: string;
  totalActivities: number;
  activitiesByAction: Record<string, number>;
  activitiesByEntityType: Record<string, number>;
  trendData: Array<{ date: Date; count: number }>;
}

// Time range utilities
export interface TimeRange {
  from: Date;
  to: Date;
}

export const TIME_RANGES = {
  LAST_24_HOURS: { hours: 24 },
  LAST_7_DAYS: { days: 7 },
  LAST_30_DAYS: { days: 30 },
  LAST_90_DAYS: { days: 90 },
  LAST_YEAR: { days: 365 },
} as const;
```

### 4. UI Components

```typescript
// src/components/activities/ActivityFeed.tsx
export function ActivityFeed({ filters }: { filters?: ActivityFilters }) {
  // Real-time activity feed
}

// src/components/activities/ActivityItem.tsx
export function ActivityItem({ activity }: { activity: Activity }) {
  // Individual activity display
}

// src/components/activities/ActivityFilters.tsx
export function ActivityFilters({
  onFiltersChange,
}: {
  onFiltersChange: (filters: ActivityFilters) => void;
}) {
  // Filter interface
}

// src/components/activities/ActivityTimeline.tsx
export function ActivityTimeline({ activities }: { activities: Activity[] }) {
  // Timeline visualization
}
```

### 5. Integration Points

#### Automatic Logging Middleware

```typescript
// src/middleware/activity-middleware.ts
export function activityMiddleware(req: Request, res: Response, next: NextFunction) {
  // Automatically log API calls, database changes, etc.
}
```

#### Database Triggers

```sql
-- Automatic logging for critical table changes
CREATE OR REPLACE FUNCTION log_activity_trigger()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO activities (
    organization_id,
    activity_type,
    entity_type,
    entity_id,
    action,
    description,
    metadata
  ) VALUES (
    COALESCE(NEW.organization_id, OLD.organization_id),
    TG_TABLE_NAME || '.' || TG_OP,
    TG_TABLE_NAME,
    COALESCE(NEW.id, OLD.id),
    TG_OP,
    'Automatic ' || TG_OP || ' on ' || TG_TABLE_NAME,
    jsonb_build_object('old', to_jsonb(OLD), 'new', to_jsonb(NEW))
  );

  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER log_product_changes
  AFTER INSERT OR UPDATE OR DELETE ON products
  FOR EACH ROW EXECUTE FUNCTION log_activity_trigger();
```

## Data Retention & Privacy

### Retention Policies

- **Warehouse Activities**: 2 years (compliance requirement)
- **Organization Activities**: 7 years (legal requirement)
- **User Activities**: 1 year (analytics needs)
- **System Activities**: 30 days (operational needs)
- **Security Activities**: 5 years (security compliance)

### Cleanup & Archival

```sql
-- Automated cleanup procedure
CREATE OR REPLACE FUNCTION cleanup_expired_activities()
RETURNS void AS $$
BEGIN
  -- Archive activities before deletion
  INSERT INTO activities_archive
  SELECT * FROM activities
  WHERE expires_at < NOW();

  -- Delete expired activities
  DELETE FROM activities
  WHERE expires_at < NOW();
END;
$$ LANGUAGE plpgsql;

-- Schedule cleanup to run daily
SELECT cron.schedule('cleanup-activities', '0 2 * * *', 'SELECT cleanup_expired_activities();');
```

## Analytics & Reporting

### Built-in Reports

1. **User Activity Summary** - Daily/weekly/monthly user engagement
2. **Warehouse Operations Report** - Stock movements, deliveries, audits
3. **Security Audit Report** - Failed logins, permission denials, suspicious activity
4. **System Performance Report** - System activities, errors, maintenance

### Real-time Features

- Activity feed for recent actions
- Live notifications for critical activities
- Real-time dashboards with activity metrics

## Implementation Phases

### Phase 1: Core Infrastructure & Database (Week 1)

**Priority**: Critical foundation

**Database Files**:

- `supabase/migrations/[timestamp]_create_activity_modules.sql`
- `supabase/migrations/[timestamp]_create_activity_entity_types.sql`
- `supabase/migrations/[timestamp]_create_activity_actions.sql`
- `supabase/migrations/[timestamp]_create_activities_table.sql`
- `supabase/migrations/[timestamp]_insert_activity_reference_data.sql`

**Service Layer Files**:

- `src/types/activities.ts` - Complete TypeScript definitions
- `src/lib/services/activity-service.ts` - Core service implementation
- `src/utils/activity-logger.ts` - Static utility methods
- `src/hooks/useActivityLogger.ts` - React hook for activity logging

**Database Tasks**:

- Create normalized schema with reference tables
- Add comprehensive indexes for performance
- Insert seed data for modules, entity types, and actions
- Set up triggers for timestamp management
- Implement soft delete functionality

**Service Tasks**:

- ActivityService class with CRUD operations
- Normalized reference data handling
- Batch logging capabilities
- Status management (recorded/processed/archived/error)
- Filtering and pagination

### Phase 2: Warehouse Module Integration (Week 2)

**Priority**: High - Core business functionality

**Files to create**:

- `src/modules/warehouse/utils/activity-integration.ts`
- `src/modules/warehouse/hooks/useWarehouseActivityLogger.ts`

**Integration Points**:

- Product CRUD operations
- Stock movement tracking
- Location management activities
- Supplier and delivery tracking
- Automatic logging in existing warehouse actions

**Tasks**:

- Integrate activity logging into product management
- Add stock movement activity tracking
- Implement location activity logging
- Add supplier/delivery activity integration
- Update warehouse forms to include activity logging

### Phase 3: Organization & User Activities (Week 3)

**Priority**: High - Security and compliance

**Files to create**:

- `src/modules/organization-management/utils/activity-integration.ts`
- `src/utils/auth/activity-middleware.ts`
- `src/lib/middleware/activity-tracking.ts`

**Integration Points**:

- User management (invite, role changes, deactivation)
- Branch management activities
- Organization settings changes
- Authentication events
- Permission changes

**Tasks**:

- User lifecycle activity tracking
- Branch management activity logging
- Organization settings activity tracking
- Authentication middleware for login/logout tracking
- Role-based activity filtering implementation

### Phase 4: UI Components & Basic Analytics (Week 4)

**Priority**: Medium - User visibility

**Component Files**:

- `src/components/activities/ActivityFeed.tsx`
- `src/components/activities/ActivityItem.tsx`
- `src/components/activities/ActivityFilters.tsx`
- `src/components/activities/ActivityStatusBadge.tsx`
- `src/components/activities/ActivityTimeline.tsx`

**Page Files**:

- `src/app/[locale]/dashboard/activities/page.tsx` - Main activities page
- `src/app/[locale]/dashboard/activities/loading.tsx`
- `src/components/dashboard/widgets/RecentActivitiesWidget.tsx`

**Query Hook Files**:

- `src/hooks/queries/useActivities.ts`
- `src/hooks/queries/useActivitySummary.ts`
- `src/hooks/queries/useActivityModules.ts`

**Tasks**:

- Real-time activity feed with infinite scroll
- Advanced filtering by module, entity type, action, status
- Activity timeline visualization
- Recent activities widget for dashboard
- Basic analytics and summary views
- Mobile-responsive activity components

### Phase 5: Advanced Features & Analytics (Week 5)

**Priority**: Low - Enhanced functionality

**Analytics Files**:

- `src/components/activities/ActivityAnalytics.tsx`
- `src/components/activities/UserActivityReport.tsx`
- `src/components/activities/ModuleActivityStats.tsx`
- `src/lib/analytics/activity-analytics.ts`

**Advanced Features**:

- `src/components/activities/ActivityExport.tsx`
- `src/components/activities/ActivitySearch.tsx`
- `src/lib/services/activity-export-service.ts`
- `src/lib/services/activity-cleanup-service.ts`

**Tasks**:

- Comprehensive analytics dashboard
- User activity reports and insights
- Module-specific activity statistics
- Export functionality (CSV, JSON)
- Advanced search and full-text search
- Activity retention and cleanup automation
- Performance monitoring and optimization

### Phase 6: Security & Compliance Features (Week 6)

**Priority**: Medium - Security requirements

**Security Files**:

- `src/lib/security/activity-audit.ts`
- `src/components/activities/SecurityActivityMonitor.tsx`
- `src/lib/compliance/activity-retention.ts`

**Tasks**:

- Security event monitoring
- Compliance reporting features
- Activity audit trail protection
- Automated retention policy enforcement
- Sensitive data activity tracking
- Security alert system integration

## Security & Performance

### Security Measures

- Activity data encryption for sensitive information
- Access control based on user roles
- Audit trail for activity log access
- Rate limiting for activity logging

### Performance Optimization

- Partitioned tables by date for large datasets
- Indexes on commonly queried fields
- Batch logging for high-volume activities
- Async processing for non-critical activities
- Caching for frequently accessed activity summaries

## Testing Strategy

### Unit Tests

- Activity service CRUD operations
- Activity logger utilities
- Data validation and sanitization
- Permission checks

### Integration Tests

- Database trigger functionality
- API endpoint testing
- Real-time activity streaming
- Cleanup and archival processes

### Performance Tests

- High-volume activity logging
- Query performance with large datasets
- Real-time feed responsiveness
- Database partition efficiency

This comprehensive activity logging system will provide the foundation for audit compliance, user analytics, security monitoring, and operational insights across the entire application.
