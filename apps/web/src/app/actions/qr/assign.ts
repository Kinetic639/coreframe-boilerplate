"use server";

import { z } from "zod";
import { createClient } from "@/utils/supabase/server";
import { loadDashboardContextV2 } from "@/server/loaders/v2/load-dashboard-context.v2";
import { checkPermission } from "@/lib/utils/permissions";
import { QR_ASSIGN, HELPDESK_TICKETS_MANAGE } from "@/lib/constants/permissions";
import { QrAssignmentsService } from "@/server/services/qr.service";

const assignSchema = z.object({
  qrCodeId: z.string().uuid(),
  ticketId: z.string().uuid(),
});

export async function assignQrToTicketAction(rawInput: unknown) {
  try {
    const context = await loadDashboardContextV2();
    if (!context?.app.activeOrgId)
      return { success: false as const, error: "No active organization" };

    if (
      !checkPermission(context.user.permissionSnapshot, QR_ASSIGN) ||
      !checkPermission(context.user.permissionSnapshot, HELPDESK_TICKETS_MANAGE)
    ) {
      return { success: false as const, error: "Unauthorized" };
    }

    const parsed = assignSchema.safeParse(rawInput);
    if (!parsed.success) return { success: false as const, error: "Invalid input" };

    const supabase = await createClient();
    return QrAssignmentsService.assignToTarget(supabase, {
      qrCodeId: parsed.data.qrCodeId,
      targetType: "helpdesk.ticket",
      targetId: parsed.data.ticketId,
      assignedBy: context.user.user?.id ?? "",
      permissionSnapshot: context.user.permissionSnapshot,
    });
  } catch {
    return { success: false as const, error: "Unexpected error" };
  }
}

export async function getQrCodeByTokenAction(token: string) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return { success: false as const, error: "Unauthorized" };

    const { data, error } = await supabase
      .from("qr_codes")
      .select(
        "id, token, label, status, qr_assignments!qr_assignments_qr_code_id_fkey(target_type, target_id, revoked_at)"
      )
      .eq("token", token)
      .is("deleted_at", null)
      .maybeSingle();

    if (error) return { success: false as const, error: error.message };
    if (!data) return { success: true as const, data: null };

    const assignments =
      (data.qr_assignments as
        | { target_type: string; target_id: string; revoked_at: string | null }[]
        | null) ?? [];
    const activeAssignment = assignments.find((a) => a.revoked_at === null) ?? null;

    return {
      success: true as const,
      data: {
        id: data.id as string,
        token: data.token as string,
        label: (data.label as string | null) ?? null,
        status: data.status as string,
        assignment: activeAssignment
          ? { target_type: activeAssignment.target_type, target_id: activeAssignment.target_id }
          : null,
      },
    };
  } catch {
    return { success: false as const, error: "Unexpected error" };
  }
}

export async function getQrAssignmentForTicketAction(ticketId: string) {
  try {
    // Lightweight auth — RLS enforces org scope
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return { success: false as const, error: "Unauthorized" };

    const { data, error } = await supabase
      .from("qr_assignments")
      .select("id, qr_code_id, qr_codes!qr_assignments_qr_code_id_fkey(token, label, status)")
      .eq("target_type", "helpdesk.ticket")
      .eq("target_id", ticketId)
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
