"use server";

import { z } from "zod";
import { createClient } from "@/utils/supabase/server";
import { loadDashboardContextV2 } from "@/server/loaders/v2/load-dashboard-context.v2";
import { checkPermission } from "@/lib/utils/permissions";
import { entitlements, mapEntitlementError } from "@/server/guards/entitlements-guards";
import {
  OrgPositionsService,
  type CreatePositionInput,
} from "@/server/services/organization.service";
import { MODULE_ORGANIZATION_MANAGEMENT } from "@/lib/constants/modules";
import {
  MODULE_ORGANIZATION_MANAGEMENT_ACCESS,
  MEMBERS_READ,
  MEMBERS_MANAGE,
} from "@/lib/constants/permissions";

const createPositionSchema = z.object({
  name: z.string().min(1).max(100),
  description: z.string().max(300).nullable().optional(),
});

const updatePositionSchema = z.object({
  positionId: z.string().uuid(),
  name: z.string().min(1).max(100).optional(),
  description: z.string().max(300).nullable().optional(),
});

const positionIdSchema = z.object({ positionId: z.string().uuid() });

const assignPositionSchema = z.object({
  userId: z.string().uuid(),
  positionId: z.string().uuid(),
  branchId: z.string().uuid().nullable().optional(),
});

const removeAssignmentSchema = z.object({ assignmentId: z.string().uuid() });

export async function listPositionsAction() {
  try {
    const supabase = await createClient();
    await entitlements.requireModuleAccess(MODULE_ORGANIZATION_MANAGEMENT);
    const context = await loadDashboardContextV2();
    if (!context?.app.activeOrgId) return { success: false, error: "No active organization" };
    if (!checkPermission(context.user.permissionSnapshot, MODULE_ORGANIZATION_MANAGEMENT_ACCESS))
      return { success: false, error: "Unauthorized" };

    const canRead = checkPermission(context.user.permissionSnapshot, MEMBERS_READ);
    if (!canRead) return { success: false, error: "Unauthorized" };

    return await OrgPositionsService.listPositions(supabase, context.app.activeOrgId);
  } catch (error) {
    const mapped = mapEntitlementError(error);
    if (mapped) return { success: false, error: mapped.message };
    return { success: false, error: "Unexpected error" };
  }
}

export async function listPositionAssignmentsAction() {
  try {
    const supabase = await createClient();
    await entitlements.requireModuleAccess(MODULE_ORGANIZATION_MANAGEMENT);
    const context = await loadDashboardContextV2();
    if (!context?.app.activeOrgId) return { success: false, error: "No active organization" };
    if (!checkPermission(context.user.permissionSnapshot, MODULE_ORGANIZATION_MANAGEMENT_ACCESS))
      return { success: false, error: "Unauthorized" };

    const canRead = checkPermission(context.user.permissionSnapshot, MEMBERS_READ);
    if (!canRead) return { success: false, error: "Unauthorized" };

    return await OrgPositionsService.listAssignmentsForOrg(supabase, context.app.activeOrgId);
  } catch (error) {
    const mapped = mapEntitlementError(error);
    if (mapped) return { success: false, error: mapped.message };
    return { success: false, error: "Unexpected error" };
  }
}

export async function createPositionAction(rawInput: unknown) {
  try {
    const supabase = await createClient();
    await entitlements.requireModuleAccess(MODULE_ORGANIZATION_MANAGEMENT);
    const context = await loadDashboardContextV2();
    if (!context?.app.activeOrgId || !context.user.user.id) {
      return { success: false, error: "No active organization" };
    }
    if (!checkPermission(context.user.permissionSnapshot, MODULE_ORGANIZATION_MANAGEMENT_ACCESS))
      return { success: false, error: "Unauthorized" };

    const canManage = checkPermission(context.user.permissionSnapshot, MEMBERS_MANAGE);
    if (!canManage) return { success: false, error: "Unauthorized" };

    const parsed = createPositionSchema.safeParse(rawInput);
    if (!parsed.success) return { success: false, error: parsed.error.errors[0].message };

    return await OrgPositionsService.createPosition(
      supabase,
      context.app.activeOrgId,
      context.user.user.id,
      parsed.data as CreatePositionInput
    );
  } catch (error) {
    const mapped = mapEntitlementError(error);
    if (mapped) return { success: false, error: mapped.message };
    return { success: false, error: "Unexpected error" };
  }
}

export async function updatePositionAction(rawInput: unknown) {
  try {
    const supabase = await createClient();
    await entitlements.requireModuleAccess(MODULE_ORGANIZATION_MANAGEMENT);
    const context = await loadDashboardContextV2();
    if (!context?.app.activeOrgId) return { success: false, error: "No active organization" };
    if (!checkPermission(context.user.permissionSnapshot, MODULE_ORGANIZATION_MANAGEMENT_ACCESS))
      return { success: false, error: "Unauthorized" };

    const canManage = checkPermission(context.user.permissionSnapshot, MEMBERS_MANAGE);
    if (!canManage) return { success: false, error: "Unauthorized" };

    const parsed = updatePositionSchema.safeParse(rawInput);
    if (!parsed.success) return { success: false, error: parsed.error.errors[0].message };

    const { positionId, ...updateInput } = parsed.data;
    return await OrgPositionsService.updatePosition(
      supabase,
      positionId,
      context.app.activeOrgId,
      updateInput
    );
  } catch (error) {
    const mapped = mapEntitlementError(error);
    if (mapped) return { success: false, error: mapped.message };
    return { success: false, error: "Unexpected error" };
  }
}

export async function deletePositionAction(rawInput: unknown) {
  try {
    const supabase = await createClient();
    await entitlements.requireModuleAccess(MODULE_ORGANIZATION_MANAGEMENT);
    const context = await loadDashboardContextV2();
    if (!context?.app.activeOrgId) return { success: false, error: "No active organization" };
    if (!checkPermission(context.user.permissionSnapshot, MODULE_ORGANIZATION_MANAGEMENT_ACCESS))
      return { success: false, error: "Unauthorized" };

    const canManage = checkPermission(context.user.permissionSnapshot, MEMBERS_MANAGE);
    if (!canManage) return { success: false, error: "Unauthorized" };

    const parsed = positionIdSchema.safeParse(rawInput);
    if (!parsed.success) return { success: false, error: parsed.error.errors[0].message };

    return await OrgPositionsService.deletePosition(
      supabase,
      parsed.data.positionId,
      context.app.activeOrgId
    );
  } catch (error) {
    const mapped = mapEntitlementError(error);
    if (mapped) return { success: false, error: mapped.message };
    return { success: false, error: "Unexpected error" };
  }
}

export async function assignPositionAction(rawInput: unknown) {
  try {
    const supabase = await createClient();
    await entitlements.requireModuleAccess(MODULE_ORGANIZATION_MANAGEMENT);
    const context = await loadDashboardContextV2();
    if (!context?.app.activeOrgId || !context.user.user.id) {
      return { success: false, error: "No active organization" };
    }
    if (!checkPermission(context.user.permissionSnapshot, MODULE_ORGANIZATION_MANAGEMENT_ACCESS))
      return { success: false, error: "Unauthorized" };

    const canManage = checkPermission(context.user.permissionSnapshot, MEMBERS_MANAGE);
    if (!canManage) return { success: false, error: "Unauthorized" };

    const parsed = assignPositionSchema.safeParse(rawInput);
    if (!parsed.success) return { success: false, error: parsed.error.errors[0].message };

    return await OrgPositionsService.assignPosition(
      supabase,
      context.app.activeOrgId,
      parsed.data.userId,
      parsed.data.positionId,
      context.user.user.id,
      parsed.data.branchId
    );
  } catch (error) {
    const mapped = mapEntitlementError(error);
    if (mapped) return { success: false, error: mapped.message };
    return { success: false, error: "Unexpected error" };
  }
}

export async function removePositionAssignmentAction(rawInput: unknown) {
  try {
    const supabase = await createClient();
    await entitlements.requireModuleAccess(MODULE_ORGANIZATION_MANAGEMENT);
    const context = await loadDashboardContextV2();
    if (!context?.app.activeOrgId) return { success: false, error: "No active organization" };
    if (!checkPermission(context.user.permissionSnapshot, MODULE_ORGANIZATION_MANAGEMENT_ACCESS))
      return { success: false, error: "Unauthorized" };

    const canManage = checkPermission(context.user.permissionSnapshot, MEMBERS_MANAGE);
    if (!canManage) return { success: false, error: "Unauthorized" };

    const parsed = removeAssignmentSchema.safeParse(rawInput);
    if (!parsed.success) return { success: false, error: parsed.error.errors[0].message };

    return await OrgPositionsService.removeAssignment(
      supabase,
      parsed.data.assignmentId,
      context.app.activeOrgId
    );
  } catch (error) {
    const mapped = mapEntitlementError(error);
    if (mapped) return { success: false, error: mapped.message };
    return { success: false, error: "Unexpected error" };
  }
}
