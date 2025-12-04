import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "../../../supabase/types/types";
import type {
  CreateCustomContextInput,
  UpdateContextConfigurationInput,
  SetFieldVisibilityInput,
  CloneSystemContextInput,
  ContextFilters,
} from "@/server/schemas/context.schema";

// ==========================================
// TYPE DEFINITIONS
// ==========================================

type Context = Database["public"]["Tables"]["contexts"]["Row"];

export interface ContextWithAccess extends Context {
  has_access: boolean;
  is_locked: boolean;
  lock_reason?: string;
}

export interface ContextFieldVisibility {
  context_id: string;
  field_name: string;
  visibility_level: "always" | "on_request" | "never";
  access_level?: "public" | "token_required" | "private";
  requires_permission?: string;
  custom_rules?: Record<string, any>;
}

// ==========================================
// CONTEXT SERVICE
// ==========================================

export class ContextService {
  /**
   * Get all available contexts for an organization with subscription access control
   */
  static async getAvailableContexts(
    supabase: SupabaseClient<Database>,
    organizationId: string,
    includeSystemContexts = true
  ): Promise<Context[]> {
    let query = supabase.from("contexts").select("*").eq("is_active", true).is("deleted_at", null);

    if (includeSystemContexts) {
      query = query.or(`organization_id.is.null,organization_id.eq.${organizationId}`);
    } else {
      query = query.eq("organization_id", organizationId);
    }

    const { data, error } = await query.order("display_name");

    if (error) {
      throw new Error(`Failed to fetch available contexts: ${error.message}`);
    }

    return data || [];
  }

  /**
   * Get contexts with access information (locked/unlocked based on subscription)
   */
  static async getContextsWithAccess(
    supabase: SupabaseClient<Database>,
    organizationId: string,
    userSubscriptionTier?: string
  ): Promise<ContextWithAccess[]> {
    const contexts = await this.getAvailableContexts(supabase, organizationId, true);

    return contexts.map((context) => {
      let has_access = true;
      let is_locked = false;
      let lock_reason: string | undefined;

      // Check if context requires subscription
      if (context.requires_subscription) {
        if (!userSubscriptionTier) {
          has_access = false;
          is_locked = true;
          lock_reason = "Requires subscription";
        } else if (
          context.subscription_tier &&
          context.subscription_tier !== userSubscriptionTier
        ) {
          // Simple tier check - in production you'd have more sophisticated tier comparison
          has_access = false;
          is_locked = true;
          lock_reason = `Requires ${context.subscription_tier} subscription`;
        }
      }

      return {
        ...context,
        has_access,
        is_locked,
        lock_reason,
      };
    });
  }

  /**
   * Get all system contexts
   */
  static async getSystemContexts(supabase: SupabaseClient<Database>): Promise<Context[]> {
    const { data, error } = await supabase
      .from("contexts")
      .select("*")
      .eq("type", "system")
      .is("organization_id", null)
      .is("deleted_at", null)
      .order("display_name");

    if (error) {
      throw new Error(`Failed to fetch system contexts: ${error.message}`);
    }

    return data || [];
  }

  /**
   * Get organization-specific contexts
   */
  static async getOrganizationContexts(
    supabase: SupabaseClient<Database>,
    organizationId: string,
    filters?: ContextFilters
  ): Promise<Context[]> {
    let query = supabase
      .from("contexts")
      .select("*")
      .eq("organization_id", organizationId)
      .eq("type", "custom")
      .is("deleted_at", null);

    // Apply filters
    if (filters?.is_active !== undefined) {
      query = query.eq("is_active", filters.is_active);
    }

    if (filters?.api_enabled !== undefined) {
      query = query.eq("api_enabled", filters.api_enabled);
    }

    if (filters?.requires_subscription !== undefined) {
      query = query.eq("requires_subscription", filters.requires_subscription);
    }

    if (filters?.search) {
      query = query.or(
        `name.ilike.%${filters.search}%,display_name.ilike.%${filters.search}%,description.ilike.%${filters.search}%`
      );
    }

    const { data, error } = await query.order("display_name");

    if (error) {
      throw new Error(`Failed to fetch organization contexts: ${error.message}`);
    }

    return data || [];
  }

  /**
   * Create a custom context for an organization
   */
  static async createCustomContext(
    supabase: SupabaseClient<Database>,
    input: CreateCustomContextInput
  ): Promise<Context> {
    // Check if context name already exists for this organization
    const { data: existing } = await supabase
      .from("contexts")
      .select("id")
      .eq("organization_id", input.organization_id)
      .eq("name", input.name)
      .is("deleted_at", null)
      .single();

    if (existing) {
      throw new Error(`Context with name "${input.name}" already exists`);
    }

    const { data, error } = await supabase
      .from("contexts")
      .insert({
        type: "custom",
        organization_id: input.organization_id,
        name: input.name,
        display_name: input.display_name,
        description: input.description || null,
        icon: input.icon || null,
        color: input.color || "#10b981",
        is_active: input.is_active ?? true,
        requires_subscription: input.requires_subscription ?? false,
        subscription_tier: input.subscription_tier || null,
        api_enabled: input.api_enabled ?? false,
        api_rate_limit: input.api_rate_limit || null,
        metadata: input.metadata || null,
      } as any)
      .select()
      .single();

    if (error) {
      throw new Error(`Failed to create custom context: ${error.message}`);
    }

    return data;
  }

  /**
   * Update a context configuration
   */
  static async updateContextConfiguration(
    supabase: SupabaseClient<Database>,
    contextId: string,
    input: UpdateContextConfigurationInput
  ): Promise<Context> {
    const updateData: any = {
      ...input,
      updated_at: new Date().toISOString(),
    };

    const { data, error } = await supabase
      .from("contexts")
      .update(updateData)
      .eq("id", contextId)
      .select()
      .single();

    if (error) {
      throw new Error(`Failed to update context configuration: ${error.message}`);
    }

    return data;
  }

  /**
   * Delete a context (soft delete)
   */
  static async deleteContext(supabase: SupabaseClient<Database>, contextId: string): Promise<void> {
    // Prevent deletion of system contexts
    const { data: context } = await supabase
      .from("contexts")
      .select("type")
      .eq("id", contextId)
      .single();

    if (context?.type === "system") {
      throw new Error("Cannot delete system contexts");
    }

    const { error } = await supabase
      .from("contexts")
      .update({ deleted_at: new Date().toISOString() } as any)
      .eq("id", contextId);

    if (error) {
      throw new Error(`Failed to delete context: ${error.message}`);
    }
  }

  /**
   * Get field visibility rules for a context
   */
  static async getContextFieldVisibility(
    supabase: SupabaseClient<Database>,
    contextId: string
  ): Promise<ContextFieldVisibility[]> {
    const { data, error } = await supabase
      .from("context_field_visibility")
      .select("*")
      .eq("context_id", contextId)
      .order("field_name");

    if (error) {
      throw new Error(`Failed to fetch field visibility rules: ${error.message}`);
    }

    return (data || []).map((rule) => ({
      context_id: rule.context_id,
      field_name: rule.field_name,
      visibility_level: rule.visibility_level as "always" | "on_request" | "never",
      access_level: rule.access_level as "public" | "token_required" | "private" | undefined,
      requires_permission: rule.requires_permission || undefined,
      custom_rules: rule.custom_rules || undefined,
    }));
  }

  /**
   * Set field visibility rule (upsert)
   */
  static async setFieldVisibility(
    supabase: SupabaseClient<Database>,
    input: SetFieldVisibilityInput
  ): Promise<ContextFieldVisibility> {
    const { data, error } = await supabase
      .from("context_field_visibility")
      .upsert(
        {
          context_id: input.context_id,
          field_name: input.field_name,
          visibility_level: input.visibility_level,
          access_level: input.access_level || null,
          requires_permission: input.requires_permission || null,
          custom_rules: input.custom_rules || null,
        } as any,
        {
          onConflict: "context_id,field_name",
        }
      )
      .select()
      .single();

    if (error) {
      throw new Error(`Failed to set field visibility: ${error.message}`);
    }

    return {
      context_id: data.context_id,
      field_name: data.field_name,
      visibility_level: data.visibility_level as "always" | "on_request" | "never",
      access_level: data.access_level as "public" | "token_required" | "private" | undefined,
      requires_permission: data.requires_permission || undefined,
      custom_rules: data.custom_rules || undefined,
    };
  }

  /**
   * Get context by name
   */
  static async getContextByName(
    supabase: SupabaseClient<Database>,
    name: string,
    organizationId?: string
  ): Promise<Context | null> {
    let query = supabase.from("contexts").select("*").eq("name", name).is("deleted_at", null);

    if (organizationId) {
      query = query.or(`organization_id.is.null,organization_id.eq.${organizationId}`);
    } else {
      query = query.is("organization_id", null);
    }

    const { data, error } = await query.single();

    if (error) {
      if (error.code === "PGRST116") return null;
      throw new Error(`Failed to fetch context by name: ${error.message}`);
    }

    return data;
  }

  /**
   * Check if a context has API enabled
   */
  static async isContextApiEnabled(
    supabase: SupabaseClient<Database>,
    contextId: string
  ): Promise<boolean> {
    const { data, error } = await supabase
      .from("contexts")
      .select("api_enabled")
      .eq("id", contextId)
      .is("deleted_at", null)
      .single();

    if (error) {
      if (error.code === "PGRST116") return false;
      throw new Error(`Failed to check API status: ${error.message}`);
    }

    return data?.api_enabled ?? false;
  }

  /**
   * Get all API-enabled contexts
   */
  static async getApiEnabledContexts(
    supabase: SupabaseClient<Database>,
    organizationId: string
  ): Promise<Context[]> {
    const { data, error } = await supabase
      .from("contexts")
      .select("*")
      .eq("api_enabled", true)
      .eq("is_active", true)
      .is("deleted_at", null)
      .or(`organization_id.is.null,organization_id.eq.${organizationId}`)
      .order("display_name");

    if (error) {
      throw new Error(`Failed to fetch API-enabled contexts: ${error.message}`);
    }

    return data || [];
  }

  /**
   * Clone a system context for an organization
   */
  static async cloneSystemContext(
    supabase: SupabaseClient<Database>,
    input: CloneSystemContextInput
  ): Promise<Context> {
    // Get source context
    const { data: sourceContext, error: sourceError } = await supabase
      .from("contexts")
      .select("*")
      .eq("id", input.source_context_id)
      .eq("type", "system")
      .is("organization_id", null)
      .single();

    if (sourceError || !sourceContext) {
      throw new Error("Source system context not found");
    }

    // Check if name already exists
    const { data: existing } = await supabase
      .from("contexts")
      .select("id")
      .eq("organization_id", input.organization_id)
      .eq("name", input.new_name)
      .is("deleted_at", null)
      .single();

    if (existing) {
      throw new Error(`Context with name "${input.new_name}" already exists`);
    }

    // Create new context
    const newContextData: any = {
      type: "custom",
      organization_id: input.organization_id,
      name: input.new_name,
      display_name: input.new_display_name,
      description: input.customizations?.description || sourceContext.description,
      icon: input.customizations?.icon || sourceContext.icon,
      color: input.customizations?.color || sourceContext.color,
      is_active: input.customizations?.is_active ?? sourceContext.is_active,
      requires_subscription: sourceContext.requires_subscription,
      subscription_tier: sourceContext.subscription_tier,
      api_enabled: input.customizations?.api_enabled ?? sourceContext.api_enabled,
      api_rate_limit: sourceContext.api_rate_limit,
      metadata: input.customizations?.metadata || sourceContext.metadata,
      parent_context_id: input.source_context_id,
    };

    const { data: newContext, error: createError } = await supabase
      .from("contexts")
      .insert(newContextData)
      .select()
      .single();

    if (createError) {
      throw new Error(`Failed to clone context: ${createError.message}`);
    }

    // Clone field visibility rules if requested
    if (input.clone_field_visibility) {
      const visibilityRules = await this.getContextFieldVisibility(
        supabase,
        input.source_context_id
      );

      if (visibilityRules.length > 0) {
        const newRules = visibilityRules.map((rule) => ({
          context_id: newContext.id,
          field_name: rule.field_name,
          visibility_level: rule.visibility_level,
          access_level: rule.access_level || null,
          requires_permission: rule.requires_permission || null,
          custom_rules: rule.custom_rules || null,
        }));

        await supabase.from("context_field_visibility").insert(newRules as any);
      }
    }

    return newContext;
  }
}
