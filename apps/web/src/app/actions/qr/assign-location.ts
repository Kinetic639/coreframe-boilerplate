"use server";

import { z } from "zod";
import { createClient } from "@/utils/supabase/server";
import { loadDashboardContextV2 } from "@/server/loaders/v2/load-dashboard-context.v2";
import { checkPermission } from "@/lib/utils/permissions";
import { QR_ASSIGN, WAREHOUSE_LOCATIONS_MANAGE } from "@/lib/constants/permissions";
import { QrAssignmentsService, QrCodesService } from "@/server/services/qr.service";

const assignSchema = z.object({
  qrCodeId: z.string().uuid(),
  locationId: z.string().uuid(),
});

const createAndAssignSchema = z.object({
  locationId: z.string().uuid(),
  label: z.string().max(200).nullable().optional(),
});

export async function assignQrToLocationAction(rawInput: unknown) {
  try {
    const context = await loadDashboardContextV2();
    if (!context?.app.activeOrgId)
      return { success: false as const, error: "No active organization" };

    if (
      !checkPermission(context.user.permissionSnapshot, QR_ASSIGN) ||
      !checkPermission(context.user.permissionSnapshot, WAREHOUSE_LOCATIONS_MANAGE)
    ) {
      return { success: false as const, error: "Unauthorized" };
    }

    const parsed = assignSchema.safeParse(rawInput);
    if (!parsed.success) return { success: false as const, error: "Invalid input" };

    const supabase = await createClient();
    return QrAssignmentsService.assignToTarget(supabase, {
      qrCodeId: parsed.data.qrCodeId,
      targetType: "warehouse.location",
      targetId: parsed.data.locationId,
      assignedBy: context.user.user?.id ?? "",
      permissionSnapshot: context.user.permissionSnapshot,
    });
  } catch {
    return { success: false as const, error: "Unexpected error" };
  }
}

export async function createAndAssignQrToLocationAction(rawInput: unknown) {
  try {
    const context = await loadDashboardContextV2();
    if (!context?.app.activeOrgId)
      return { success: false as const, error: "No active organization" };

    if (
      !checkPermission(context.user.permissionSnapshot, QR_ASSIGN) ||
      !checkPermission(context.user.permissionSnapshot, WAREHOUSE_LOCATIONS_MANAGE)
    ) {
      return { success: false as const, error: "Unauthorized" };
    }

    const parsed = createAndAssignSchema.safeParse(rawInput);
    if (!parsed.success) return { success: false as const, error: "Invalid input" };

    const supabase = await createClient();
    const result = await QrAssignmentsService.createAndAssign(supabase, context.app.activeOrgId, {
      targetType: "warehouse.location",
      targetId: parsed.data.locationId,
      assignedBy: context.user.user?.id ?? "",
      permissionSnapshot: context.user.permissionSnapshot,
      label: parsed.data.label ?? null,
    });
    if (!result.success) return result;

    return {
      success: true as const,
      data: {
        assignmentId: result.data.assignment.id,
        qrCodeId: result.data.qr.id,
        token: result.data.qr.token,
        label: result.data.qr.label,
        status: result.data.qr.status,
      },
    };
  } catch {
    return { success: false as const, error: "Unexpected error" };
  }
}

export async function getQrAssignmentForLocationAction(locationId: string) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return { success: false as const, error: "Unauthorized" };

    const { data, error } = await supabase
      .from("qr_assignments")
      .select("id, qr_code_id, qr_codes!qr_assignments_qr_code_id_fkey(token, label, status)")
      .eq("target_type", "warehouse.location")
      .eq("target_id", locationId)
      .is("revoked_at", null)
      .maybeSingle();

    if (error) return { success: false as const, error: error.message };
    if (!data) return { success: true as const, data: null };

    const qrCode = (Array.isArray(data.qr_codes) ? data.qr_codes[0] : data.qr_codes) as {
      token: string;
      label: string | null;
      status: string;
    } | null;
    return {
      success: true as const,
      data: {
        assignmentId: data.id as string,
        qrCodeId: data.qr_code_id as string,
        token: qrCode?.token ?? "",
        label: qrCode?.label ?? null,
        status: qrCode?.status ?? "active",
      },
    };
  } catch {
    return { success: false as const, error: "Unexpected error" };
  }
}

export async function unassignQrFromLocationAction(assignmentId: string) {
  try {
    const context = await loadDashboardContextV2();
    if (!context?.app.activeOrgId)
      return { success: false as const, error: "No active organization" };

    if (
      !checkPermission(context.user.permissionSnapshot, QR_ASSIGN) ||
      !checkPermission(context.user.permissionSnapshot, WAREHOUSE_LOCATIONS_MANAGE)
    ) {
      return { success: false as const, error: "Unauthorized" };
    }

    const supabase = await createClient();
    return QrAssignmentsService.revokeAssignment(supabase, context.app.activeOrgId, assignmentId, {
      revokedBy: context.user.user?.id ?? "",
    });
  } catch {
    return { success: false as const, error: "Unexpected error" };
  }
}
