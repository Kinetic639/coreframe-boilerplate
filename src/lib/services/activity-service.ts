import { createClient } from "@/lib/supabase/client";
import type {
  ActivityInput,
  ActivityFilters,
  ActivityWithRelations,
  PaginatedActivities,
  ActivityStatus,
} from "@/types/activities";

export class ActivityService {
  private static supabase = createClient();

  /**
   * Log a single activity
   */
  static async log(input: ActivityInput): Promise<string> {
    const supabase = this.supabase;

    // Get reference IDs for normalized data
    const { data: module } = await supabase
      .from("activity_modules")
      .select("id")
      .eq("slug", input.moduleSlug)
      .single();

    const { data: entityType } = input.entityTypeSlug
      ? await supabase
          .from("activity_entity_types")
          .select("id")
          .eq("slug", input.entityTypeSlug)
          .single()
      : { data: null };

    const { data: action } = await supabase
      .from("activity_actions")
      .select("id")
      .eq("slug", input.actionSlug)
      .single();

    if (!module || !action) {
      throw new Error(`Invalid module (${input.moduleSlug}) or action (${input.actionSlug})`);
    }

    const activity = {
      organization_id: input.organizationId,
      branch_id: input.branchId || null,
      user_id: input.userId || null,
      module_id: module.id,
      entity_type_id: entityType?.id || null,
      action_id: action.id,
      entity_id: input.entityId || null,
      description: input.description,
      metadata: input.metadata || {},
      status: input.status || "recorded",
      url: input.url || null,
      ip_address: input.ipAddress || null,
      user_agent: input.userAgent || null,
      session_id: input.sessionId || null,
    };

    const { data, error } = await supabase
      .from("activities")
      .insert(activity)
      .select("id")
      .single();

    if (error) {
      throw new Error(`Failed to log activity: ${error.message}`);
    }

    return data.id;
  }

  /**
   * Log multiple activities in a batch
   */
  static async logBatch(inputs: ActivityInput[]): Promise<string[]> {
    const supabase = this.supabase;

    // Get all unique module, entity type, and action slugs
    const moduleSlugs = [...new Set(inputs.map((i) => i.moduleSlug))];
    const entityTypeSlugs = [...new Set(inputs.map((i) => i.entityTypeSlug).filter(Boolean))];
    const actionSlugs = [...new Set(inputs.map((i) => i.actionSlug))];

    // Fetch reference data in parallel
    const [modulesData, entityTypesData, actionsData] = await Promise.all([
      supabase.from("activity_modules").select("id, slug").in("slug", moduleSlugs),
      entityTypeSlugs.length > 0
        ? supabase.from("activity_entity_types").select("id, slug").in("slug", entityTypeSlugs)
        : { data: [], error: null },
      supabase.from("activity_actions").select("id, slug").in("slug", actionSlugs),
    ]);

    if (modulesData.error || entityTypesData.error || actionsData.error) {
      throw new Error("Failed to fetch reference data for batch insert");
    }

    // Create lookup maps
    const moduleMap = new Map(modulesData.data.map((m) => [m.slug, m.id]));
    const entityTypeMap = new Map(
      entityTypesData.data.map((et) => [et.slug, et.id] as [string, any])
    );
    const actionMap = new Map(actionsData.data.map((a) => [a.slug, a.id]));

    // Transform inputs to database format
    const activities = inputs.map((input) => ({
      organization_id: input.organizationId,
      branch_id: input.branchId || null,
      user_id: input.userId || null,
      module_id: moduleMap.get(input.moduleSlug)!,
      entity_type_id: input.entityTypeSlug ? entityTypeMap.get(input.entityTypeSlug) || null : null,
      action_id: actionMap.get(input.actionSlug)!,
      entity_id: input.entityId || null,
      description: input.description,
      metadata: input.metadata || {},
      status: input.status || "recorded",
      url: input.url || null,
      ip_address: input.ipAddress || null,
      user_agent: input.userAgent || null,
      session_id: input.sessionId || null,
    }));

    const { data, error } = await supabase.from("activities").insert(activities).select("id");

    if (error) {
      throw new Error(`Failed to log activities batch: ${error.message}`);
    }

    return data.map((d) => d.id);
  }

  /**
   * Get activities with filtering and pagination
   */
  static async getActivities(filters: ActivityFilters): Promise<PaginatedActivities> {
    const supabase = this.supabase;
    const limit = filters.limit || 20;
    const offset = filters.offset || 0;

    let query = supabase
      .from("activities")
      .select(
        `
        *,
        module:activity_modules(id, slug, name),
        entity_type:activity_entity_types(id, slug, description),
        action:activity_actions(id, slug, description),
        user:users(id, email),
        branch:branches(id, name)
      `
      )
      .eq("organization_id", filters.organizationId)
      .order("created_at", { ascending: false });

    // Apply filters
    if (filters.branchId) {
      query = query.eq("branch_id", filters.branchId);
    }

    if (filters.userId) {
      query = query.eq("user_id", filters.userId);
    }

    if (filters.moduleIds && filters.moduleIds.length > 0) {
      query = query.in("module_id", filters.moduleIds);
    }

    if (filters.entityTypeIds && filters.entityTypeIds.length > 0) {
      query = query.in("entity_type_id", filters.entityTypeIds);
    }

    if (filters.actionIds && filters.actionIds.length > 0) {
      query = query.in("action_id", filters.actionIds);
    }

    if (filters.status && filters.status.length > 0) {
      query = query.in("status", filters.status);
    }

    if (filters.dateFrom) {
      query = query.gte("created_at", filters.dateFrom.toISOString());
    }

    if (filters.dateTo) {
      query = query.lte("created_at", filters.dateTo.toISOString());
    }

    if (!filters.includeDeleted) {
      query = query.is("deleted_at", null);
    }

    if (filters.searchTerm) {
      query = query.ilike("description", `%${filters.searchTerm}%`);
    }

    // Get total count
    const countQuery = supabase
      .from("activities")
      .select("*", { count: "exact", head: true })
      .eq("organization_id", filters.organizationId);

    // Apply same filters to count query
    if (filters.branchId) countQuery.eq("branch_id", filters.branchId);
    if (filters.userId) countQuery.eq("user_id", filters.userId);
    if (filters.moduleIds?.length) countQuery.in("module_id", filters.moduleIds);
    if (filters.entityTypeIds?.length) countQuery.in("entity_type_id", filters.entityTypeIds);
    if (filters.actionIds?.length) countQuery.in("action_id", filters.actionIds);
    if (filters.status?.length) countQuery.in("status", filters.status);
    if (filters.dateFrom) countQuery.gte("created_at", filters.dateFrom.toISOString());
    if (filters.dateTo) countQuery.lte("created_at", filters.dateTo.toISOString());
    if (!filters.includeDeleted) countQuery.is("deleted_at", null);
    if (filters.searchTerm) countQuery.ilike("description", `%${filters.searchTerm}%`);

    const [{ data: activities, error }, { count, error: countError }] = await Promise.all([
      query.range(offset, offset + limit - 1),
      countQuery,
    ]);

    if (error || countError) {
      throw new Error(`Failed to fetch activities: ${error?.message || countError?.message}`);
    }

    const transformedActivities: ActivityWithRelations[] = activities.map((activity) => ({
      id: activity.id,
      organizationId: activity.organization_id,
      branchId: activity.branch_id,
      userId: activity.user_id,
      moduleId: activity.module_id,
      entityTypeId: activity.entity_type_id,
      actionId: activity.action_id,
      entityId: activity.entity_id,
      description: activity.description,
      metadata: activity.metadata,
      status: activity.status,
      url: activity.url,
      ipAddress: activity.ip_address,
      userAgent: activity.user_agent,
      sessionId: activity.session_id,
      createdAt: new Date(activity.created_at),
      updatedAt: new Date(activity.updated_at),
      deletedAt: activity.deleted_at ? new Date(activity.deleted_at) : undefined,
      module: activity.module,
      entityType: activity.entity_type,
      action: activity.action,
      user: activity.user,
      branch: activity.branch,
    }));

    return {
      activities: transformedActivities,
      total: count || 0,
      hasMore: offset + limit < (count || 0),
      page: Math.floor(offset / limit) + 1,
      limit,
    };
  }

  /**
   * Get a single activity by ID
   */
  static async getActivityById(id: string): Promise<ActivityWithRelations | null> {
    const supabase = this.supabase;

    const { data, error } = await supabase
      .from("activities")
      .select(
        `
        *,
        module:activity_modules(id, slug, name),
        entity_type:activity_entity_types(id, slug, description),
        action:activity_actions(id, slug, description),
        user:users(id, email),
        branch:branches(id, name)
      `
      )
      .eq("id", id)
      .single();

    if (error) {
      if (error.code === "PGRST116") return null; // Not found
      throw new Error(`Failed to fetch activity: ${error.message}`);
    }

    return {
      id: data.id,
      organizationId: data.organization_id,
      branchId: data.branch_id,
      userId: data.user_id,
      moduleId: data.module_id,
      entityTypeId: data.entity_type_id,
      actionId: data.action_id,
      entityId: data.entity_id,
      description: data.description,
      metadata: data.metadata,
      status: data.status,
      url: data.url,
      ipAddress: data.ip_address,
      userAgent: data.user_agent,
      sessionId: data.session_id,
      createdAt: new Date(data.created_at),
      updatedAt: new Date(data.updated_at),
      deletedAt: data.deleted_at ? new Date(data.deleted_at) : undefined,
      module: data.module,
      entityType: data.entity_type,
      action: data.action,
      user: data.user,
      branch: data.branch,
    };
  }

  /**
   * Get activities for a specific entity
   */
  static async getActivitiesByEntity(
    entityTypeSlug: string,
    entityId: string,
    organizationId: string
  ): Promise<ActivityWithRelations[]> {
    const supabase = this.supabase;

    // Get entity type ID
    const { data: entityType } = await supabase
      .from("activity_entity_types")
      .select("id")
      .eq("slug", entityTypeSlug)
      .single();

    if (!entityType) {
      throw new Error(`Invalid entity type: ${entityTypeSlug}`);
    }

    const { data, error } = await supabase
      .from("activities")
      .select(
        `
        *,
        module:activity_modules(id, slug, name),
        entity_type:activity_entity_types(id, slug, description),
        action:activity_actions(id, slug, description),
        user:users(id, email),
        branch:branches(id, name)
      `
      )
      .eq("organization_id", organizationId)
      .eq("entity_type_id", entityType.id)
      .eq("entity_id", entityId)
      .is("deleted_at", null)
      .order("created_at", { ascending: false });

    if (error) {
      throw new Error(`Failed to fetch entity activities: ${error.message}`);
    }

    return data.map((activity) => ({
      id: activity.id,
      organizationId: activity.organization_id,
      branchId: activity.branch_id,
      userId: activity.user_id,
      moduleId: activity.module_id,
      entityTypeId: activity.entity_type_id,
      actionId: activity.action_id,
      entityId: activity.entity_id,
      description: activity.description,
      metadata: activity.metadata,
      status: activity.status,
      url: activity.url,
      ipAddress: activity.ip_address,
      userAgent: activity.user_agent,
      sessionId: activity.session_id,
      createdAt: new Date(activity.created_at),
      updatedAt: new Date(activity.updated_at),
      deletedAt: activity.deleted_at ? new Date(activity.deleted_at) : undefined,
      module: activity.module,
      entityType: activity.entity_type,
      action: activity.action,
      user: activity.user,
      branch: activity.branch,
    }));
  }

  /**
   * Get reference data
   */
  static async getModules(): Promise<any[]> {
    const { data, error } = await this.supabase.from("activity_modules").select("*").order("name");

    if (error) {
      throw new Error(`Failed to fetch modules: ${error.message}`);
    }

    return data.map((module) => ({
      id: module.id,
      slug: module.slug,
      name: module.name,
      createdAt: new Date(module.created_at),
    }));
  }

  static async getEntityTypes(moduleSlug?: string): Promise<any[]> {
    let query = this.supabase
      .from("activity_entity_types")
      .select(
        `
        *,
        module:activity_modules(id, slug, name)
      `
      )
      .order("slug");

    if (moduleSlug) {
      const { data: module } = await this.supabase
        .from("activity_modules")
        .select("id")
        .eq("slug", moduleSlug)
        .single();

      if (module) {
        query = query.eq("module_id", module.id);
      }
    }

    const { data, error } = await query;

    if (error) {
      throw new Error(`Failed to fetch entity types: ${error.message}`);
    }

    return data.map((entityType) => ({
      id: entityType.id,
      slug: entityType.slug,
      moduleId: entityType.module_id,
      tableName: entityType.table_name,
      description: entityType.description,
      createdAt: new Date(entityType.created_at),
      module: entityType.module,
    }));
  }

  static async getActions(): Promise<any[]> {
    const { data, error } = await this.supabase.from("activity_actions").select("*").order("slug");

    if (error) {
      throw new Error(`Failed to fetch actions: ${error.message}`);
    }

    return data.map((action) => ({
      id: action.id,
      slug: action.slug,
      description: action.description,
      createdAt: new Date(action.created_at),
    }));
  }

  /**
   * Soft delete an activity
   */
  static async softDeleteActivity(id: string): Promise<void> {
    const { error } = await this.supabase
      .from("activities")
      .update({ deleted_at: new Date().toISOString() })
      .eq("id", id);

    if (error) {
      throw new Error(`Failed to delete activity: ${error.message}`);
    }
  }

  /**
   * Update activity status
   */
  static async updateActivityStatus(id: string, status: ActivityStatus): Promise<void> {
    const { error } = await this.supabase.from("activities").update({ status }).eq("id", id);

    if (error) {
      throw new Error(`Failed to update activity status: ${error.message}`);
    }
  }

  /**
   * Bulk update activity status
   */
  static async bulkUpdateStatus(ids: string[], status: ActivityStatus): Promise<void> {
    const { error } = await this.supabase.from("activities").update({ status }).in("id", ids);

    if (error) {
      throw new Error(`Failed to bulk update activity status: ${error.message}`);
    }
  }

  /**
   * Get activity summary for analytics
   */
  static async getany(filters: ActivityFilters): Promise<any> {
    // This would need more complex aggregation queries
    // For now, return basic summary from the activities we can fetch
    const { activities, total } = await this.getActivities({
      ...filters,
      limit: 1000, // Get more data for analysis
    });

    const activitiesByModule: Record<string, number> = {};
    const activitiesByAction: Record<string, number> = {};
    const activitiesByStatus: Record<ActivityStatus, number> = {
      recorded: 0,
      processed: 0,
      archived: 0,
      error: 0,
    };
    const userCounts: Record<string, number> = {};

    activities.forEach((activity) => {
      // Count by module
      const moduleSlug = activity.module?.slug || "unknown";
      activitiesByModule[moduleSlug] = (activitiesByModule[moduleSlug] || 0) + 1;

      // Count by action
      const actionSlug = activity.action?.slug || "unknown";
      activitiesByAction[actionSlug] = (activitiesByAction[actionSlug] || 0) + 1;

      // Count by status
      activitiesByStatus[activity.status]++;

      // Count by user
      if (activity.userId) {
        userCounts[activity.userId] = (userCounts[activity.userId] || 0) + 1;
      }
    });

    const topUsers = Object.entries(userCounts)
      .map(([userId, count]) => {
        const user = activities.find((a) => a.userId === userId)?.user;
        return {
          userId,
          count,
          userName: user?.email || "Unknown User",
        };
      })
      .sort((a, b) => b.count - a.count)
      .slice(0, 10);

    return {
      totalActivities: total,
      activitiesByModule,
      activitiesByAction,
      activitiesByStatus,
      topUsers,
      timeRange: {
        from: filters.dateFrom || new Date(Date.now() - 30 * 24 * 60 * 60 * 1000),
        to: filters.dateTo || new Date(),
      },
    };
  }
}
