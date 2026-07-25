import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";

export interface PlanningBadgeConfig {
  label: string;
  color: string;
}

export interface PlanningSettingsRow {
  id: string;
  organization_id: string;
  status_configs: Record<string, PlanningBadgeConfig>;
  priority_configs: Record<string, PlanningBadgeConfig>;
  created_at: string;
  updated_at: string;
}

export interface SavePlanningSettingsInput {
  status_configs?: Record<string, PlanningBadgeConfig>;
  priority_configs?: Record<string, PlanningBadgeConfig>;
}

type ServiceResult<T> = { success: true; data: T } | { success: false; error: string };

export const PlanningSettingsService = {
  async getSettings(
    supabase: SupabaseClient,
    orgId: string
  ): Promise<ServiceResult<PlanningSettingsRow | null>> {
    try {
      const { data, error } = await supabase
        .from("planning_settings")
        .select("id, organization_id, status_configs, priority_configs, created_at, updated_at")
        .eq("organization_id", orgId)
        .maybeSingle();

      if (error) return { success: false, error: error.message };
      if (!data) return { success: true, data: null };

      return {
        success: true,
        data: {
          id: (data as any).id,
          organization_id: (data as any).organization_id,
          status_configs: ((data as any).status_configs ?? {}) as Record<
            string,
            PlanningBadgeConfig
          >,
          priority_configs: ((data as any).priority_configs ?? {}) as Record<
            string,
            PlanningBadgeConfig
          >,
          created_at: (data as any).created_at,
          updated_at: (data as any).updated_at,
        },
      };
    } catch (e) {
      return { success: false, error: e instanceof Error ? e.message : "Unexpected error" };
    }
  },

  async saveSettings(
    supabase: SupabaseClient,
    orgId: string,
    input: SavePlanningSettingsInput
  ): Promise<ServiceResult<PlanningSettingsRow>> {
    try {
      const { data, error } = await supabase
        .from("planning_settings")
        .upsert(
          {
            organization_id: orgId,
            status_configs: input.status_configs ?? {},
            priority_configs: input.priority_configs ?? {},
          },
          { onConflict: "organization_id" }
        )
        .select("id, organization_id, status_configs, priority_configs, created_at, updated_at")
        .single();

      if (error) return { success: false, error: error.message };

      return {
        success: true,
        data: {
          id: (data as any).id,
          organization_id: (data as any).organization_id,
          status_configs: ((data as any).status_configs ?? {}) as Record<
            string,
            PlanningBadgeConfig
          >,
          priority_configs: ((data as any).priority_configs ?? {}) as Record<
            string,
            PlanningBadgeConfig
          >,
          created_at: (data as any).created_at,
          updated_at: (data as any).updated_at,
        },
      };
    } catch (e) {
      return { success: false, error: e instanceof Error ? e.message : "Unexpected error" };
    }
  },
};
