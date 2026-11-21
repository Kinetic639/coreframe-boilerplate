"use server";

import { z } from "zod";
import { createClient } from "@/utils/supabase/server";
import { loadDashboardContextV2 } from "@/server/loaders/v2/load-dashboard-context.v2";
import { checkPermission } from "@/lib/utils/permissions";
import { QR_READ, QR_REVOKE } from "@/lib/constants/permissions";
import { QrCodesService, type QrSettings } from "@/server/services/qr.service";

// Bulk actions and settings of the QR codes registry (Organization → QR codes).

type Result<T> = { success: true; data: T } | { success: false; error: string };

const idsSchema = z.object({ ids: z.array(z.string().uuid()).min(1).max(500) });
const settingsSchema = z.object({
  unused_expiry_days: z.number().int().min(0).max(3650),
});

async function managerContext(): Promise<
  { orgId: string; userId: string | null } | { error: string }
> {
  const context = await loadDashboardContextV2();
  if (!context?.app.activeOrgId) return { error: "No active organization" };
  if (!checkPermission(context.user.permissionSnapshot, QR_REVOKE))
    return { error: "Unauthorized" };
  return { orgId: context.app.activeOrgId, userId: context.user.user?.id ?? null };
}

/** Revoke many codes (their assignments too). Returns how many were revoked. */
export async function revokeQrCodesAction(rawInput: unknown): Promise<Result<number>> {
  try {
    const ctx = await managerContext();
    if ("error" in ctx) return { success: false, error: ctx.error };
    const parsed = idsSchema.safeParse(rawInput);
    if (!parsed.success) return { success: false, error: "Invalid input" };

    const supabase = await createClient();
    let revoked = 0;
    for (const id of parsed.data.ids) {
      const result = await QrCodesService.revoke(supabase, ctx.orgId, id, {
        revokedBy: ctx.userId ?? "",
      });
      if (result.success) revoked += 1;
    }
    return { success: true, data: revoked };
  } catch {
    return { success: false, error: "Unexpected error" };
  }
}

/** Soft-delete codes with no active assignment. Returns how many were deleted. */
export async function deleteQrCodesAction(rawInput: unknown): Promise<Result<number>> {
  try {
    const ctx = await managerContext();
    if ("error" in ctx) return { success: false, error: ctx.error };
    const parsed = idsSchema.safeParse(rawInput);
    if (!parsed.success) return { success: false, error: "Invalid input" };

    const supabase = await createClient();
    return QrCodesService.softDeleteMany(supabase, ctx.orgId, parsed.data.ids);
  } catch {
    return { success: false, error: "Unexpected error" };
  }
}

/** Bring expired codes back. Returns how many were restored. */
export async function restoreQrCodesAction(rawInput: unknown): Promise<Result<number>> {
  try {
    const ctx = await managerContext();
    if ("error" in ctx) return { success: false, error: ctx.error };
    const parsed = idsSchema.safeParse(rawInput);
    if (!parsed.success) return { success: false, error: "Invalid input" };

    const supabase = await createClient();
    return QrCodesService.restoreMany(supabase, ctx.orgId, parsed.data.ids);
  } catch {
    return { success: false, error: "Unexpected error" };
  }
}

export async function getQrSettingsAction(): Promise<Result<QrSettings>> {
  try {
    const context = await loadDashboardContextV2();
    if (!context?.app.activeOrgId) return { success: false, error: "No active organization" };
    if (!checkPermission(context.user.permissionSnapshot, QR_READ)) {
      return { success: false, error: "Unauthorized" };
    }
    const supabase = await createClient();
    return QrCodesService.getSettings(supabase, context.app.activeOrgId);
  } catch {
    return { success: false, error: "Unexpected error" };
  }
}

export async function saveQrSettingsAction(rawInput: unknown): Promise<Result<QrSettings>> {
  try {
    const ctx = await managerContext();
    if ("error" in ctx) return { success: false, error: ctx.error };
    const parsed = settingsSchema.safeParse(rawInput);
    if (!parsed.success) return { success: false, error: "Invalid input" };

    const supabase = await createClient();
    return QrCodesService.saveSettings(
      supabase,
      ctx.orgId,
      { unused_expiry_days: parsed.data.unused_expiry_days as number },
      ctx.userId
    );
  } catch {
    return { success: false, error: "Unexpected error" };
  }
}
