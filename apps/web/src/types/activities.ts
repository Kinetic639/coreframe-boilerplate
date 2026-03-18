// Core activity types and interfaces
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
  metadata: Record<string, unknown>;
  status: ActivityStatus;
  url?: string;
  ipAddress?: string;
  userAgent?: string;
  sessionId?: string;
  createdAt: Date;
  updatedAt: Date;
  deletedAt?: Date;
}

// Activity with joined relations
export interface ActivityWithRelations extends Activity {
  module?: ActivityModule;
  entityType?: ActivityEntityType;
  action?: ActivityAction;
  user?: {
    id: string;
    email?: string;
    name?: string;
  };
  branch?: {
    id: string;
    name: string;
  };
}

// Input interface for creating activities
export interface ActivityInput {
  organizationId: string;
  branchId?: string;
  userId?: string;
  moduleSlug: string;
  entityTypeSlug?: string;
  actionSlug: string;
  entityId?: string;
  description: string;
  metadata?: Record<string, unknown>;
  status?: ActivityStatus;
  url?: string;
  ipAddress?: string;
  userAgent?: string;
  sessionId?: string;
}

// Filter interface for querying activities
export interface ActivityFilters {
  organizationId: string;
  branchId?: string;
  userId?: string;
  moduleIds?: string[];
  entityTypeIds?: string[];
  actionIds?: string[];
  status?: ActivityStatus[];
  dateFrom?: Date;
  dateTo?: Date;
  includeDeleted?: boolean;
  limit?: number;
  offset?: number;
  searchTerm?: string;
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
  ANALYTICS: "analytics",
} as const;

// Commonly used entity type slugs
export const ENTITY_TYPE_SLUGS = {
  PRODUCT: "product",
  PRODUCT_VARIANT: "product_variant",
  LOCATION: "location",
  SUPPLIER: "supplier",
  DELIVERY: "delivery",
  STOCK_MOVEMENT: "stock_movement",
  AUDIT: "audit",
  USER: "user",
  BRANCH: "branch",
  ORGANIZATION: "organization",
  ROLE: "role",
  PERMISSION: "permission",
  TEAM: "team",
  PROJECT: "project",
  TASK: "task",
  TICKET: "ticket",
  SESSION: "session",
  REPORT: "report",
  DASHBOARD: "dashboard",
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
  STARTED: "started",
  PAUSED: "paused",
  RESUMED: "resumed",
  APPROVED: "approved",
  REJECTED: "rejected",
  REVIEWED: "reviewed",
  PUBLISHED: "published",
  ARCHIVED: "archived",
  EXPORTED: "exported",
  IMPORTED: "imported",
  ACCESSED: "accessed",
  VIEWED: "viewed",
  DOWNLOADED: "downloaded",
  UPLOADED: "uploaded",
  SYNCHRONIZED: "synchronized",
  LOGGED_IN: "logged_in",
  LOGGED_OUT: "logged_out",
  INVITED: "invited",
  JOINED: "joined",
  LEFT: "left",
  PROMOTED: "promoted",
  DEMOTED: "demoted",
  SUSPENDED: "suspended",
  UNSUSPENDED: "unsuspended",
  VERIFIED: "verified",
  UNVERIFIED: "unverified",
} as const;

// Helper types
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

// Paginated response type
export interface PaginatedActivities {
  activities: ActivityWithRelations[];
  total: number;
  hasMore: boolean;
  page: number;
  limit: number;
}

// Activity context helpers
export interface ActivityContext {
  organizationId: string;
  branchId?: string;
  userId?: string;
  sessionId?: string;
  ipAddress?: string;
  userAgent?: string;
  url?: string;
}

// Status badge variants for UI
export const ACTIVITY_STATUS_VARIANTS = {
  recorded: "default",
  processed: "secondary",
  archived: "outline",
  error: "destructive",
} as const;

// Module color mapping for UI
export const MODULE_COLORS = {
  warehouse: "#10b981",
  catalog: "#3b82f6",
  organization: "#6366f1",
  teams: "#8b5cf6",
  support: "#f59e0b",
  system: "#6b7280",
  security: "#ef4444",
  analytics: "#06b6d4",
} as const;
