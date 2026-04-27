"use server";

import { z } from "zod";
import { createClient } from "@/utils/supabase/server";
import { loadDashboardContextV2 } from "@/server/loaders/v2/load-dashboard-context.v2";
import { checkPermission } from "@/lib/utils/permissions";
import { QR_REVOKE } from "@/lib/constants/permissions";
import { QrCodesService } from "@/server/services/qr.service";

const schema = z.object({ qrCodeId: z.string().uuid() });

export async function revokeQrAction(rawInput: unknown) {
  try {
    const context = await loadDashboardContextV2();
    if (!context?.app.activeOrgId)
      return { success: false as const, error: "No active organization" };

    if (!checkPermission(context.user.permissionSnapshot, QR_REVOKE)) {
      return { success: false as const, error: "Unauthorized" };
    }

    const parsed = schema.safeParse(rawInput);
    if (!parsed.success) return { success: false as const, error: "Invalid QR code ID" };

    const userId = context.user.user?.id ?? null;
    const supabase = await createClient();
    return QrCodesService.revoke(supabase, context.app.activeOrgId, parsed.data.qrCodeId, {
      revokedBy: userId ?? "",
    });
  } catch {
    return { success: false as const, error: "Unexpected error" };
  }
}
