import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import type { LabelConfig } from "@/lib/qr/label-config";
import {
  QrLabelLayoutsService,
  QrLabelTemplatesService,
  QrPrintBatchesService,
} from "@/server/services/qr-labels.service";

/**
 * A template id from the request, kept only if the organization has it
 * (read under the caller's RLS). Anything else becomes null.
 */
export async function verifiedTemplateId(
  supabase: SupabaseClient,
  orgId: string,
  templateId: string | null | undefined
): Promise<string | null> {
  if (!templateId) return null;
  const result = await QrLabelTemplatesService.get(supabase, orgId, templateId);
  return result.success && result.data ? result.data.id : null;
}

/**
 * Remember that these existing codes were printed with this layout, so the
 * next "print label" can look the same. Best effort: the labels are already
 * generated, so a failure is logged, never returned to the user.
 */
export async function recordReprint(input: {
  orgId: string;
  userId: string | null;
  qrCodeIds: string[];
  format: "pdf" | "zpl";
  labelConfig: LabelConfig;
  templateId: string | null;
}): Promise<void> {
  try {
    if (input.qrCodeIds.length === 0) return;
    const layout = await QrLabelLayoutsService.ensure(
      input.orgId,
      input.format,
      input.labelConfig,
      input.userId
    );
    if (!layout.success) {
      console.error("[recordReprint] layout:", (layout as { error: string }).error);
      return;
    }
    const batch = await QrPrintBatchesService.recordReprint(input.orgId, {
      qrCodeIds: input.qrCodeIds,
      layoutId: layout.data,
      templateId: input.templateId,
      userId: input.userId,
    });
    if (!batch.success) console.error("[recordReprint] batch:", (batch as { error: string }).error);
  } catch (err) {
    console.error("[recordReprint] failed:", err);
  }
}
