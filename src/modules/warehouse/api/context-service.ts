import { createClient } from "@/lib/supabase/client";
import type { Tables, TablesInsert, TablesUpdate } from "@/types/supabase";
import { subscriptionService } from "@/lib/services/subscription-service";

// Context management types
export type Context = Tables<"context_configurations">;
export type FieldVisibilityRule = Tables<"field_visibility_rules">;

export type CreateContextRequest = TablesInsert<"context_configurations">;
export type UpdateContextRequest = TablesUpdate<"context_configurations">;

export interface ContextWithAccess extends Context {
  hasAccess: boolean;
  isPremium: boolean;
}

export type ContextConfig = {
  api_enabled: boolean;
  access_level: "public" | "token_required" | "private";
  rate_limits?: {
    requests_per_minute: number;
    requests_per_hour: number;
  };
  cors_origins?: string[];
  metadata?: any;
};

export type CreateFieldVisibilityRequest = TablesInsert<"field_visibility_rules">;

export class ContextService {
  private supabase = createClient();

  /**
   * Get all available contexts for an organization with subscription access control
   */
  async getAvailableContexts(organizationId?: string): Promise<Context[]> {
    try {
      let query = this.supabase
        .from("context_configurations")
        .select("*")
        .eq("is_active", true)
        .order("context_name");

      // Include system contexts and organization-specific contexts
      if (organizationId) {
        query = query.or(`context_type.eq.system,organization_id.eq.${organizationId}`);
      } else {
        query = query.eq("context_type", "system");
      }

      const { data, error } = await query;
      if (error) throw error;

      // Filter contexts based on subscription access
      if (organizationId && data) {
        const accessibleContexts = [];
        for (const context of data) {
          const hasAccess = await subscriptionService.hasContextAccess(
            organizationId,
            context.context_name
          );
          if (hasAccess) {
            accessibleContexts.push(context);
          }
        }
        return accessibleContexts;
      }

      return data || [];
    } catch (error) {
      console.error("Error getting available contexts:", error);
      throw error;
    }
  }

  /**
   * Get all contexts with access information (for UI that shows locked contexts)
   */
  async getContextsWithAccess(organizationId?: string): Promise<ContextWithAccess[]> {
    try {
      let query = this.supabase
        .from("context_configurations")
        .select("*")
        .eq("is_active", true)
        .order("context_name");

      // Include system contexts and organization-specific contexts
      if (organizationId) {
        query = query.or(`context_type.eq.system,organization_id.eq.${organizationId}`);
      } else {
        query = query.eq("context_type", "system");
      }

      const { data, error } = await query;
      if (error) throw error;

      // Add access information to each context
      const contextsWithAccess: ContextWithAccess[] = [];

      if (data) {
        for (const context of data) {
          let hasAccess = true;
          const isPremium = context.context_name !== "warehouse"; // Warehouse is always free

          if (organizationId && isPremium) {
            hasAccess = await subscriptionService.hasContextAccess(
              organizationId,
              context.context_name
            );
          }

          contextsWithAccess.push({
            ...context,
            hasAccess,
            isPremium,
          });
        }
      }

      return contextsWithAccess;
    } catch (error) {
      console.error("Error getting contexts with access:", error);
      throw error;
    }
  }

  /**
   * Get system contexts (available to all organizations)
   */
  async getSystemContexts(): Promise<Context[]> {
    try {
      const { data, error } = await this.supabase
        .from("context_configurations")
        .select("*")
        .eq("context_type", "system")
        .eq("is_active", true)
        .order("context_name");

      if (error) throw error;
      return data || [];
    } catch (error) {
      console.error("Error getting system contexts:", error);
      throw error;
    }
  }

  /**
   * Get custom contexts for an organization
   */
  async getOrganizationContexts(organizationId: string): Promise<Context[]> {
    try {
      const { data, error } = await this.supabase
        .from("context_configurations")
        .select("*")
        .eq("context_type", "custom")
        .eq("organization_id", organizationId)
        .eq("is_active", true)
        .order("context_name");

      if (error) throw error;
      return data || [];
    } catch (error) {
      console.error("Error getting organization contexts:", error);
      throw error;
    }
  }

  /**
   * Create a custom context for an organization
   */
  async createCustomContext(data: CreateContextRequest): Promise<Context> {
    try {
      // Ensure it's marked as custom and has proper defaults
      const contextData: CreateContextRequest = {
        ...data,
        context_type: "custom",
        is_active: true,
        api_enabled: data.api_enabled ?? false,
        access_level: data.access_level ?? "private",
        rate_limits: data.rate_limits ?? { requests_per_minute: 60, requests_per_hour: 1000 },
        cors_origins: data.cors_origins ?? [],
        metadata: data.metadata ?? {},
      };

      const { data: context, error } = await this.supabase
        .from("context_configurations")
        .insert(contextData)
        .select()
        .single();

      if (error) throw error;
      return context;
    } catch (error) {
      console.error("Error creating custom context:", error);
      throw error;
    }
  }

  /**
   * Update context configuration
   */
  async updateContextConfiguration(
    contextId: string,
    config: Partial<ContextConfig>
  ): Promise<Context> {
    try {
      const { data: context, error } = await this.supabase
        .from("context_configurations")
        .update(config)
        .eq("id", contextId)
        .select()
        .single();

      if (error) throw error;
      return context;
    } catch (error) {
      console.error("Error updating context configuration:", error);
      throw error;
    }
  }

  /**
   * Delete (deactivate) a custom context
   */
  async deleteContext(contextId: string): Promise<void> {
    try {
      const { error } = await this.supabase
        .from("context_configurations")
        .update({ is_active: false })
        .eq("id", contextId)
        .eq("context_type", "custom"); // Only allow deleting custom contexts

      if (error) throw error;
    } catch (error) {
      console.error("Error deleting context:", error);
      throw error;
    }
  }

  /**
   * Get field visibility rules for a context
   */
  async getContextFieldVisibility(contextId: string): Promise<FieldVisibilityRule[]> {
    try {
      const { data, error } = await this.supabase
        .from("field_visibility_rules")
        .select("*")
        .eq("context_config_id", contextId)
        .order("field_name");

      if (error) throw error;
      return data || [];
    } catch (error) {
      console.error("Error getting context field visibility:", error);
      throw error;
    }
  }

  /**
   * Set field visibility rule for a context
   */
  async setFieldVisibility(
    contextId: string,
    fieldName: string,
    visibilityLevel: "public" | "token_required" | "private",
    transformations?: any
  ): Promise<FieldVisibilityRule> {
    try {
      const visibilityData: CreateFieldVisibilityRequest = {
        context_config_id: contextId,
        field_name: fieldName,
        visibility_level: visibilityLevel,
        field_transformations: transformations || {},
      };

      const { data: rule, error } = await this.supabase
        .from("field_visibility_rules")
        .upsert(visibilityData, {
          onConflict: "context_config_id,field_name",
        })
        .select()
        .single();

      if (error) throw error;
      return rule;
    } catch (error) {
      console.error("Error setting field visibility:", error);
      throw error;
    }
  }

  /**
   * Get context by name and organization
   */
  async getContextByName(contextName: string, organizationId?: string): Promise<Context | null> {
    try {
      let query = this.supabase
        .from("context_configurations")
        .select("*")
        .eq("context_name", contextName)
        .eq("is_active", true);

      // Check system contexts first, then organization contexts
      if (organizationId) {
        query = query.or(`context_type.eq.system,organization_id.eq.${organizationId}`);
      } else {
        query = query.eq("context_type", "system");
      }

      const { data, error } = await query.single();

      if (error) {
        if (error.code === "PGRST116") return null; // Not found
        throw error;
      }

      return data;
    } catch (error) {
      console.error("Error getting context by name:", error);
      throw error;
    }
  }

  /**
   * Check if a context supports API access
   */
  async isContextApiEnabled(contextId: string): Promise<boolean> {
    try {
      const { data, error } = await this.supabase
        .from("context_configurations")
        .select("api_enabled")
        .eq("id", contextId)
        .eq("is_active", true)
        .single();

      if (error) throw error;
      return data?.api_enabled || false;
    } catch (error) {
      console.error("Error checking context API status:", error);
      return false;
    }
  }

  /**
   * Get contexts that have API enabled (for API endpoint generation)
   */
  async getApiEnabledContexts(organizationId?: string): Promise<Context[]> {
    try {
      let query = this.supabase
        .from("context_configurations")
        .select("*")
        .eq("api_enabled", true)
        .eq("is_active", true)
        .order("context_name");

      if (organizationId) {
        query = query.or(`context_type.eq.system,organization_id.eq.${organizationId}`);
      } else {
        query = query.eq("context_type", "system");
      }

      const { data, error } = await query;
      if (error) throw error;

      return data || [];
    } catch (error) {
      console.error("Error getting API-enabled contexts:", error);
      throw error;
    }
  }

  /**
   * Clone a system context to create a custom variant
   */
  async cloneSystemContext(
    systemContextName: string,
    organizationId: string,
    customizations: {
      context_name: string;
      display_label: any;
      icon?: string;
      color?: string;
      api_enabled?: boolean;
      access_level?: "public" | "token_required" | "private";
    }
  ): Promise<Context> {
    try {
      // Get the system context
      const systemContext = await this.getContextByName(systemContextName);
      if (!systemContext) {
        throw new Error(`System context '${systemContextName}' not found`);
      }

      // Create custom context based on system context
      const customContextData: CreateContextRequest = {
        context_name: customizations.context_name,
        context_type: "custom",
        display_label: customizations.display_label,
        icon: customizations.icon || systemContext.icon,
        color: customizations.color || systemContext.color,
        organization_id: organizationId,
        is_active: true,
        api_enabled: customizations.api_enabled ?? systemContext.api_enabled,
        access_level: customizations.access_level ?? systemContext.access_level,
        rate_limits: systemContext.rate_limits,
        cors_origins: systemContext.cors_origins,
        metadata: {
          ...(typeof systemContext.metadata === "object" && systemContext.metadata !== null
            ? systemContext.metadata
            : {}),
          cloned_from: systemContext.id,
          cloned_at: new Date().toISOString(),
        },
      };

      const customContext = await this.createCustomContext(customContextData);

      // Copy field visibility rules if they exist
      const systemFieldRules = await this.getContextFieldVisibility(systemContext.id);
      if (systemFieldRules.length > 0) {
        for (const rule of systemFieldRules) {
          await this.setFieldVisibility(
            customContext.id,
            rule.field_name,
            rule.visibility_level as "public" | "token_required" | "private",
            rule.field_transformations
          );
        }
      }

      return customContext;
    } catch (error) {
      console.error("Error cloning system context:", error);
      throw error;
    }
  }
}

export const contextService = new ContextService();
