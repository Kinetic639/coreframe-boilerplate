"use server";

import { createClient } from "@/utils/supabase/server";
import { loadDashboardContextV2 } from "@/server/loaders/v2/load-dashboard-context.v2";
import { checkPermission } from "@/lib/utils/permissions";
import { WAREHOUSE_LOCATIONS_MANAGE } from "@/lib/constants/permissions";
import { WarehouseLocationLabelSettingsService } from "@/server/services/warehouse-location-label-settings.service";
import { labelConfigSchema } from "@/lib/qr/label-config-schema";
import type { LabelConfig } from "@/lib/qr/label-config";

export async function getLocationLabelSettingsAction() {
  try {
    const context = await loadDashboardContextV2();
    if (!context?.app.activeOrgId)
      return { success: false as const, error: "No active organization" };

    const supabase = await createClient();
    const result = await WarehouseLocationLabelSettingsService.get(
      supabase,
      context.app.activeOrgId
    );
    if (!result.success) return result;

    return { success: true as const, data: result.data?.label_config ?? null };
  } catch {
    return { success: false as const, error: "Unexpected error" };
  }
}

export async function saveLocationLabelSettingsAction(rawInput: unknown) {
  try {
    const context = await loadDashboardContextV2();
    if (!context?.app.activeOrgId)
      return { success: false as const, error: "No active organization" };

    if (!checkPermission(context.user.permissionSnapshot, WAREHOUSE_LOCATIONS_MANAGE)) {
      return { success: false as const, error: "Unauthorized" };
    }

    const parsed = labelConfigSchema.safeParse(rawInput);
    if (!parsed.success) return { success: false as const, error: "Invalid label configuration" };

    const supabase = await createClient();
    const result = await WarehouseLocationLabelSettingsService.upsert(
      supabase,
      context.app.activeOrgId,
      parsed.data as LabelConfig
    );
    if (!result.success) return result;

    return { success: true as const, data: result.data.label_config };
  } catch {
    return { success: false as const, error: "Unexpected error" };
  }
}
