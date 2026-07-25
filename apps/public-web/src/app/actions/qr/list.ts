"use server";

import { createClient } from "@/utils/supabase/server";
import { loadDashboardContextV2 } from "@/server/loaders/v2/load-dashboard-context.v2";
import { checkPermission } from "@/lib/utils/permissions";
import { QR_READ } from "@/lib/constants/permissions";
import { QrCodesService } from "@/server/services/qr.service";

export async function listQrCodesAction() {
  try {
    const context = await loadDashboardContextV2();
    if (!context?.app.activeOrgId)
      return { success: false as const, error: "No active organization" };

    if (!checkPermission(context.user.permissionSnapshot, QR_READ)) {
      return { success: false as const, error: "Unauthorized" };
    }

    const supabase = await createClient();
    return QrCodesService.listWithStatus(supabase, context.app.activeOrgId);
  } catch {
    return { success: false as const, error: "Unexpected error" };
  }
}
