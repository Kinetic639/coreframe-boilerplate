import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import type { LabelConfig } from "@/lib/qr/label-config";
import { QrLabelTemplatesService } from "@/server/services/qr-labels.service";

export type ServiceResult<T> = { success: true; data: T } | { success: false; error: string };

export interface WarehouseLocationLabelSettings {
  template_id: string;
  organization_id: string;
  label_config: LabelConfig;
}

const LOCATION = "warehouse.location" as const;
const DEFAULT_LOCATION_TEMPLATE_NAME = "Lokalizacje";

/**
 * The organization's default location label. Since the label templates
 * (docs/QR_LABELS_PLAN.md, Q3) it is simply the default QR label template
 * for warehouse.location; the old warehouse_location_label_settings table
 * was copied into it by migration 20261122090000.
 */
export class WarehouseLocationLabelSettingsService {
  /** The default location template's layout, or null (callers use DEFAULT_LABEL_CONFIG). */
  static async get(
    supabase: SupabaseClient,
    orgId: string
  ): Promise<ServiceResult<WarehouseLocationLabelSettings | null>> {
    const templates = await QrLabelTemplatesService.list(supabase, orgId);
    if (!templates.success)
      return { success: false, error: (templates as { error: string }).error };
    const template = templates.data.find((t) => t.is_default && t.target_type === LOCATION);
    if (!template?.layout || template.layout.format !== "pdf") return { success: true, data: null };
    return {
      success: true,
      data: {
        template_id: template.id,
        organization_id: orgId,
        label_config: template.layout.config,
      },
    };
  }

  static async upsert(
    supabase: SupabaseClient,
    orgId: string,
    labelConfig: LabelConfig,
    userId: string | null = null
  ): Promise<ServiceResult<WarehouseLocationLabelSettings>> {
    const templates = await QrLabelTemplatesService.list(supabase, orgId);
    if (!templates.success)
      return { success: false, error: (templates as { error: string }).error };
    const current = templates.data.find((t) => t.is_default && t.target_type === LOCATION);

    const saved = current
      ? await QrLabelTemplatesService.update(supabase, orgId, current.id, {
          format: "pdf",
          config: labelConfig,
          userId,
        })
      : await QrLabelTemplatesService.create(supabase, orgId, {
          name: DEFAULT_LOCATION_TEMPLATE_NAME,
          targetType: LOCATION,
          format: "pdf",
          config: labelConfig,
          isDefault: true,
          userId,
        });
    if (!saved.success) return { success: false, error: (saved as { error: string }).error };

    return {
      success: true,
      data: { template_id: saved.data.id, organization_id: orgId, label_config: labelConfig },
    };
  }
}
