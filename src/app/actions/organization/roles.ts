"use server";

import { z } from "zod";
import { createClient } from "@/utils/supabase/server";
import { loadDashboardContextV2 } from "@/server/loaders/v2/load-dashboard-context.v2";
import { checkPermission } from "@/lib/utils/permissions";
import { entitlements, mapEntitlementError } from "@/server/guards/entitlements-guards";
import { OrgRolesService, type CreateRoleInput } from "@/server/services/organization.service";
import { MODULE_ORGANIZATION_MANAGEMENT } from "@/lib/constants/modules";
import { MEMBERS_READ, MEMBERS_MANAGE } from "@/lib/constants/permissions";

const createRoleSchema = z.object({
  name: z.string().min(1).max(100),
  description: z.string().max(500).nullable().optional(),
  permission_slugs: z.array(z.string()).optional(),
});

const updateRoleSchema = z.object({
  roleId: z.string().uuid(),
  name: z.string().min(1).max(100).optional(),
  description: z.string().max(500).nullable().optional(),
  permission_slugs: z.array(z.string()).optional(),
});

const deleteRoleSchema = z.object({ roleId: z.string().uuid() });

const assignRoleSchema = z.object({
  userId: z.string().uuid(),
  roleId: z.string().uuid(),
});

export async function listRolesAction() {
  try {
    const supabase = await createClient();
    await entitlements.requireModuleAccess(MODULE_ORGANIZATION_MANAGEMENT);
    const context = await loadDashboardContextV2();
    if (!context?.app.activeOrgId) return { success: false, error: "No active organization" };

    const canRead = checkPermission(context.user.permissionSnapshot, MEMBERS_READ);
    if (!canRead) return { success: false, error: "Unauthorized" };

    return await OrgRolesService.listRoles(supabase, context.app.activeOrgId);
  } catch (error) {
    const mapped = mapEntitlementError(error);
    if (mapped) return { success: false, error: mapped.message };
    return { success: false, error: "Unexpected error" };
  }
}

export async function createRoleAction(rawInput: unknown) {
  try {
    const supabase = await createClient();
    await entitlements.requireModuleAccess(MODULE_ORGANIZATION_MANAGEMENT);
    const context = await loadDashboardContextV2();
    if (!context?.app.activeOrgId) return { success: false, error: "No active organization" };

    const canManage = checkPermission(context.user.permissionSnapshot, MEMBERS_MANAGE);
    if (!canManage) return { success: false, error: "Unauthorized" };

    const parsed = createRoleSchema.safeParse(rawInput);
    if (!parsed.success) return { success: false, error: parsed.error.errors[0].message };

    return await OrgRolesService.createRole(
      supabase,
      context.app.activeOrgId,
      parsed.data as CreateRoleInput
    );
  } catch (error) {
    const mapped = mapEntitlementError(error);
    if (mapped) return { success: false, error: mapped.message };
    return { success: false, error: "Unexpected error" };
  }
}

export async function updateRoleAction(rawInput: unknown) {
  try {
    const supabase = await createClient();
    await entitlements.requireModuleAccess(MODULE_ORGANIZATION_MANAGEMENT);
    const context = await loadDashboardContextV2();
    if (!context?.app.activeOrgId) return { success: false, error: "No active organization" };

    const canManage = checkPermission(context.user.permissionSnapshot, MEMBERS_MANAGE);
    if (!canManage) return { success: false, error: "Unauthorized" };

    const parsed = updateRoleSchema.safeParse(rawInput);
    if (!parsed.success) return { success: false, error: parsed.error.errors[0].message };

    const { roleId, ...updateInput } = parsed.data;
    return await OrgRolesService.updateRole(supabase, roleId, updateInput);
  } catch (error) {
    const mapped = mapEntitlementError(error);
    if (mapped) return { success: false, error: mapped.message };
    return { success: false, error: "Unexpected error" };
  }
}

export async function deleteRoleAction(rawInput: unknown) {
  try {
    const supabase = await createClient();
    await entitlements.requireModuleAccess(MODULE_ORGANIZATION_MANAGEMENT);
    const context = await loadDashboardContextV2();
    if (!context?.app.activeOrgId) return { success: false, error: "No active organization" };

    const canManage = checkPermission(context.user.permissionSnapshot, MEMBERS_MANAGE);
    if (!canManage) return { success: false, error: "Unauthorized" };

    const parsed = deleteRoleSchema.safeParse(rawInput);
    if (!parsed.success) return { success: false, error: parsed.error.errors[0].message };

    return await OrgRolesService.deleteRole(supabase, parsed.data.roleId);
  } catch (error) {
    const mapped = mapEntitlementError(error);
    if (mapped) return { success: false, error: mapped.message };
    return { success: false, error: "Unexpected error" };
  }
}

export async function assignRoleToUserAction(rawInput: unknown) {
  try {
    const supabase = await createClient();
    await entitlements.requireModuleAccess(MODULE_ORGANIZATION_MANAGEMENT);
    const context = await loadDashboardContextV2();
    if (!context?.app.activeOrgId) return { success: false, error: "No active organization" };

    const canManage = checkPermission(context.user.permissionSnapshot, MEMBERS_MANAGE);
    if (!canManage) return { success: false, error: "Unauthorized" };

    const parsed = assignRoleSchema.safeParse(rawInput);
    if (!parsed.success) return { success: false, error: parsed.error.errors[0].message };

    return await OrgRolesService.assignRoleToUser(
      supabase,
      parsed.data.userId,
      parsed.data.roleId,
      context.app.activeOrgId
    );
  } catch (error) {
    const mapped = mapEntitlementError(error);
    if (mapped) return { success: false, error: mapped.message };
    return { success: false, error: "Unexpected error" };
  }
}

export async function removeRoleFromUserAction(rawInput: unknown) {
  try {
    const supabase = await createClient();
    await entitlements.requireModuleAccess(MODULE_ORGANIZATION_MANAGEMENT);
    const context = await loadDashboardContextV2();
    if (!context?.app.activeOrgId) return { success: false, error: "No active organization" };

    const canManage = checkPermission(context.user.permissionSnapshot, MEMBERS_MANAGE);
    if (!canManage) return { success: false, error: "Unauthorized" };

    const parsed = assignRoleSchema.safeParse(rawInput);
    if (!parsed.success) return { success: false, error: parsed.error.errors[0].message };

    return await OrgRolesService.removeRoleFromUser(
      supabase,
      parsed.data.userId,
      parsed.data.roleId,
      context.app.activeOrgId
    );
  } catch (error) {
    const mapped = mapEntitlementError(error);
    if (mapped) return { success: false, error: mapped.message };
    return { success: false, error: "Unexpected error" };
  }
}

export async function getUserRoleAssignmentsAction(userId: string) {
  try {
    const supabase = await createClient();
    await entitlements.requireModuleAccess(MODULE_ORGANIZATION_MANAGEMENT);
    const context = await loadDashboardContextV2();
    if (!context?.app.activeOrgId) return { success: false, error: "No active organization" };

    const canRead = checkPermission(context.user.permissionSnapshot, MEMBERS_READ);
    if (!canRead) return { success: false, error: "Unauthorized" };

    if (!z.string().uuid().safeParse(userId).success) {
      return { success: false, error: "Invalid user ID" };
    }

    return await OrgRolesService.getUserRoleAssignments(supabase, context.app.activeOrgId, userId);
  } catch (error) {
    const mapped = mapEntitlementError(error);
    if (mapped) return { success: false, error: mapped.message };
    return { success: false, error: "Unexpected error" };
  }
}
