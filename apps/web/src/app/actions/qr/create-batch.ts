"use server";

import { z } from "zod";
import { createClient } from "@/utils/supabase/server";
import { loadDashboardContextV2 } from "@/server/loaders/v2/load-dashboard-context.v2";
import { checkPermission } from "@/lib/utils/permissions";
import { QR_CREATE } from "@/lib/constants/permissions";
import { QrCodesService } from "@/server/services/qr.service";
import type { QrCode } from "@/server/services/qr.service";

const schema = z.object({
  count: z.number().int().min(1).max(50),
  labelPrefix: z.string().max(80).optional(),
});

export async function createQrBatchAction(
  rawInput: unknown
): Promise<{ success: true; data: QrCode[] } | { success: false; error: string }> {
  try {
    const context = await loadDashboardContextV2();
    if (!context?.app.activeOrgId) return { success: false, error: "No active organization" };

    if (!checkPermission(context.user.permissionSnapshot, QR_CREATE)) {
      return { success: false, error: "Unauthorized" };
    }

    const parsed = schema.safeParse(rawInput);
    if (!parsed.success)
      return { success: false, error: parsed.error.issues[0]?.message ?? "Invalid input" };

    const { count, labelPrefix } = parsed.data;
    const orgId = context.app.activeOrgId;
    const userId = context.user.user?.id ?? null;
    const supabase = await createClient();

    const results = await Promise.all(
      Array.from({ length: count }, (_, i) =>
        QrCodesService.create(supabase, orgId, {
          label: labelPrefix ? `${labelPrefix} ${i + 1}` : null,
          createdBy: userId,
        })
      )
    );

    const failures = results.filter((r) => !r.success);
    if (failures.length > 0) {
      return { success: false, error: `${failures.length} of ${count} QR codes failed to create.` };
    }

    return { success: true, data: results.map((r) => (r as { success: true; data: QrCode }).data) };
  } catch {
    return { success: false, error: "Unexpected error" };
  }
}
