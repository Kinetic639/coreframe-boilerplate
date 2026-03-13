"use server";

import { z } from "zod";
import { createClient } from "@/utils/supabase/server";
import { loadDashboardContextV2 } from "@/server/loaders/v2/load-dashboard-context.v2";
import { checkPermission } from "@/lib/utils/permissions";
import { entitlements, mapEntitlementError } from "@/server/guards/entitlements-guards";
import { OrgMembersService } from "@/server/services/organization.service";
import { eventService } from "@/server/services/event.service";
import { MODULE_ORGANIZATION_MANAGEMENT } from "@/lib/constants/modules";
import {
  MODULE_ORGANIZATION_MANAGEMENT_ACCESS,
  MEMBERS_READ,
  MEMBERS_MANAGE,
} from "@/lib/constants/permissions";

const updateStatusSchema = z.object({
  userId: z.string().uuid(),
  status: z.enum(["active", "inactive"]),
});

const removeSchema = z.object({
  userId: z.string().uuid(),
});

export async function listMembersAction() {
  try {
    const supabase = await createClient();
    await entitlements.requireModuleAccess(MODULE_ORGANIZATION_MANAGEMENT);
    const context = await loadDashboardContextV2();
    if (!context?.app.activeOrgId) return { success: false, error: "No active organization" };
    if (!checkPermission(context.user.permissionSnapshot, MODULE_ORGANIZATION_MANAGEMENT_ACCESS))
      return { success: false, error: "Unauthorized" };

    const canRead = checkPermission(context.user.permissionSnapshot, MEMBERS_READ);
    if (!canRead) return { success: false, error: "Unauthorized" };

    return await OrgMembersService.listMembers(supabase, context.app.activeOrgId);
  } catch (error) {
    const mapped = mapEntitlementError(error);
    if (mapped) return { success: false, error: mapped.message };
    return { success: false, error: "Unexpected error" };
  }
}

export async function updateMemberStatusAction(rawInput: unknown) {
  try {
    const supabase = await createClient();
    await entitlements.requireModuleAccess(MODULE_ORGANIZATION_MANAGEMENT);
    const context = await loadDashboardContextV2();
    if (!context?.app.activeOrgId) return { success: false, error: "No active organization" };
    if (!checkPermission(context.user.permissionSnapshot, MODULE_ORGANIZATION_MANAGEMENT_ACCESS))
      return { success: false, error: "Unauthorized" };

    const canManage = checkPermission(context.user.permissionSnapshot, MEMBERS_MANAGE);
    if (!canManage) return { success: false, error: "Unauthorized" };

    const parsed = updateStatusSchema.safeParse(rawInput);
    if (!parsed.success) return { success: false, error: parsed.error.errors[0].message };

    return await OrgMembersService.updateMemberStatus(
      supabase,
      context.app.activeOrgId,
      parsed.data.userId,
      parsed.data.status
    );
  } catch (error) {
    const mapped = mapEntitlementError(error);
    if (mapped) return { success: false, error: mapped.message };
    return { success: false, error: "Unexpected error" };
  }
}

export async function removeMemberAction(rawInput: unknown) {
  try {
    const supabase = await createClient();
    await entitlements.requireModuleAccess(MODULE_ORGANIZATION_MANAGEMENT);
    const context = await loadDashboardContextV2();
    if (!context?.app.activeOrgId) return { success: false, error: "No active organization" };
    if (!checkPermission(context.user.permissionSnapshot, MODULE_ORGANIZATION_MANAGEMENT_ACCESS))
      return { success: false, error: "Unauthorized" };

    const canManage = checkPermission(context.user.permissionSnapshot, MEMBERS_MANAGE);
    if (!canManage) return { success: false, error: "Unauthorized" };

    const parsed = removeSchema.safeParse(rawInput);
    if (!parsed.success) return { success: false, error: parsed.error.errors[0].message };

    const result = await OrgMembersService.removeMember(
      supabase,
      context.app.activeOrgId,
      parsed.data.userId
    );

    if (result.success) {
      try {
        await eventService.emit({
          actionKey: "org.member.removed",
          actorType: "user",
          actorUserId: context.user.user?.id ?? null,
          organizationId: context.app.activeOrgId,
          entityType: "user",
          entityId: parsed.data.userId,
          targetType: "user",
          targetId: parsed.data.userId,
          metadata: { removed_user_id: parsed.data.userId },
          eventTier: "enhanced",
        });
      } catch (emitError) {
        console.error("[removeMemberAction] Failed to emit org.member.removed:", {
          actionKey: "org.member.removed",
          organizationId: context.app.activeOrgId,
          actorUserId: context.user.user?.id ?? null,
          entityType: "user",
          entityId: parsed.data.userId,
          error: emitError,
        });
      }
    }

    return result;
  } catch (error) {
    const mapped = mapEntitlementError(error);
    if (mapped) return { success: false, error: mapped.message };
    return { success: false, error: "Unexpected error" };
  }
}
