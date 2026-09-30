"use server";

import { z } from "zod";
import { createClient } from "@/utils/supabase/server";
import { loadDashboardContextV2 } from "@/server/loaders/v2/load-dashboard-context.v2";
import { checkPermission } from "@/lib/utils/permissions";
import { QR_ASSIGN, WAREHOUSE_INVENTORY_OPERATE } from "@/lib/constants/permissions";
import { QrAssignmentsService } from "@/server/services/qr.service";

const CONTAINER_TARGET_TYPE = "inventory.container";

const createAndAssignSchema = z.object({
  containerId: z.string().uuid(),
  label: z.string().max(200).nullable().optional(),
});

export type ContainerQrAssignment = {
  assignmentId: string;
  qrCodeId: string;
  token: string;
  label: string | null;
  status: string;
};

/**
 * Phase 10D -- generate a new QR code and assign it to a container in one
 * step. Same compound gate as the location equivalent: `qr.assign` plus the
 * target's own assign permission (`warehouse.inventory.operate`, from the
 * `inventory.container` registry entry). Org and branch are derived
 * server-side by `QrAssignmentsService.assignToTarget` via the registry's
 * `validate()` -- never taken from the caller.
 */
export async function createAndAssignQrToContainerAction(rawInput: unknown) {
  try {
    const context = await loadDashboardContextV2();
    if (!context?.app.activeOrgId)
      return { success: false as const, error: "No active organization" };

    if (
      !checkPermission(context.user.permissionSnapshot, QR_ASSIGN) ||
      !checkPermission(context.user.permissionSnapshot, WAREHOUSE_INVENTORY_OPERATE)
    ) {
      return { success: false as const, error: "Unauthorized" };
    }

    const parsed = createAndAssignSchema.safeParse(rawInput);
    if (!parsed.success) return { success: false as const, error: "Invalid input" };

    const supabase = await createClient();
    const result = await QrAssignmentsService.createAndAssign(supabase, context.app.activeOrgId, {
      targetType: CONTAINER_TARGET_TYPE,
      targetId: parsed.data.containerId,
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
      } satisfies ContainerQrAssignment,
    };
  } catch {
    return { success: false as const, error: "Unexpected error" };
  }
}

/**
 * Phase 10D -- the container's active QR assignment, or null. Visibility is
 * enforced by `qr_assignments`/`qr_codes` RLS (`qr.read`) underneath.
 */
export async function getQrAssignmentForContainerAction(containerId: string) {
  try {
    if (!z.string().uuid().safeParse(containerId).success) {
      return { success: false as const, error: "Invalid container id" };
    }

    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return { success: false as const, error: "Unauthorized" };

    const { data, error } = await supabase
      .from("qr_assignments")
      .select("id, qr_code_id, qr_codes!qr_assignments_qr_code_id_fkey(token, label, status)")
      .eq("target_type", CONTAINER_TARGET_TYPE)
      .eq("target_id", containerId)
      .is("revoked_at", null)
      .maybeSingle();

    if (error) return { success: false as const, error: "Failed to load QR assignment" };
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
      } satisfies ContainerQrAssignment,
    };
  } catch {
    return { success: false as const, error: "Unexpected error" };
  }
}
