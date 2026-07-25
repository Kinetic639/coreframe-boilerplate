import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import type { LabelConfig } from "@/lib/qr/label-config";

export type ServiceResult<T> = { success: true; data: T } | { success: false; error: string };

export interface WarehouseLocationLabelSettings {
  id: string;
  organization_id: string;
  label_config: LabelConfig;
  created_at: string;
  updated_at: string;
}

export class WarehouseLocationLabelSettingsService {
  /**
   * Returns the org's saved default label template, or null if none has been
   * saved yet (callers fall back to DEFAULT_LABEL_CONFIG).
   */
  static async get(
    supabase: SupabaseClient,
    orgId: string
  ): Promise<ServiceResult<WarehouseLocationLabelSettings | null>> {
    const { data, error } = await supabase
      .from("warehouse_location_label_settings")
      .select("*")
      .eq("organization_id", orgId)
      .maybeSingle();

    if (error) return { success: false, error: error.message };
    return { success: true, data: data as WarehouseLocationLabelSettings | null };
  }

  static async upsert(
    supabase: SupabaseClient,
    orgId: string,
    labelConfig: LabelConfig
  ): Promise<ServiceResult<WarehouseLocationLabelSettings>> {
    const { data, error } = await supabase
      .from("warehouse_location_label_settings")
      .upsert(
        { organization_id: orgId, label_config: labelConfig },
        { onConflict: "organization_id" }
      )
      .select("*")
      .single();

    if (error) return { success: false, error: error.message };
    return { success: true, data: data as WarehouseLocationLabelSettings };
  }
}
