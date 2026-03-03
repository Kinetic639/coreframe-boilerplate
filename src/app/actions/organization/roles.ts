"use server";

import { z } from "zod";
import { createClient } from "@/utils/supabase/server";
import { loadDashboardContextV2 } from "@/server/loaders/v2/load-dashboard-context.v2";
import { checkPermission } from "@/lib/utils/permissions";
import { entitlements, mapEntitlementError } from "@/server/guards/entitlements-guards";
import { OrgRolesService, type CreateRoleInput } from "@/server/services/organization.service";
import { MODULE_ORGANIZATION_MANAGEMENT } from "@/lib/constants/modules";
import {
  MODULE_ORGANIZATION_MANAGEMENT_ACCESS,
  MEMBERS_READ,
  MEMBERS_MANAGE,
  ORG_READ,
  ORG_UPDATE,
  BRANCHES_CREATE,
  BRANCHES_UPDATE,
  BRANCHES_DELETE,
  BRANCH_ROLES_MANAGE,
  INVITES_READ,
  INVITES_CREATE,
  INVITES_CANCEL,
} from "@/lib/constants/permissions";

// Permissions that are meaningful only at org scope — not valid for branch-scoped roles.
// members.* and invites.* are org-level concepts (member list, invitations, activation).
// branch.roles.manage is the branch-scoped alternative for role assignment delegation.
const ORG_ONLY_SLUGS = new Set<string>([
  ORG_READ,
  ORG_UPDATE,
  BRANCHES_CREATE,
  BRANCHES_UPDATE,
  BRANCHES_DELETE,
  MODULE_ORGANIZATION_MANAGEMENT_ACCESS,
  MEMBERS_READ,
  MEMBERS_MANAGE,
  INVITES_READ,
  INVITES_CREATE,
  INVITES_CANCEL,
]);

const createRoleSchema = z.object({
  name: z.string().min(1).max(100),
  description: z.string().max(500).nullable().optional(),
  permission_slugs: z.array(z.string()).optional(),
  scope_type: z.enum(["org", "branch"]).optional(),
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
  scope: z.enum(["org", "branch"]).default("org"),
  scopeId: z.string().uuid().optional(),
});

export async function listRolesAction() {
  try {
    const supabase = await createClient();
    await entitlements.requireModuleAccess(MODULE_ORGANIZATION_MANAGEMENT);
    const context = await loadDashboardContextV2();
    if (!context?.app.activeOrgId) return { success: false, error: "No active organization" };
    if (!checkPermission(context.user.permissionSnapshot, MODULE_ORGANIZATION_MANAGEMENT_ACCESS))
      return { success: false, error: "Unauthorized" };

    const canRead = checkPermission(context.user.permissionSnapshot, MEMBERS_READ);
    const canBranchManage = checkPermission(context.user.permissionSnapshot, BRANCH_ROLES_MANAGE);
    if (!canRead && !canBranchManage) return { success: false, error: "Unauthorized" };

    const rolesResult = await OrgRolesService.listRoles(supabase, context.app.activeOrgId);
    if (!rolesResult.success) return rolesResult;

    // Branch managers (no MEMBERS_READ) see only branch-scoped roles.
    // This limits the role picker in branch-access UI to appropriate roles only.
    if (!canRead && canBranchManage) {
      return { success: true, data: rolesResult.data.filter((r) => r.scope_type === "branch") };
    }

    return rolesResult;
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
    if (!checkPermission(context.user.permissionSnapshot, MODULE_ORGANIZATION_MANAGEMENT_ACCESS))
      return { success: false, error: "Unauthorized" };

    const canManage = checkPermission(context.user.permissionSnapshot, MEMBERS_MANAGE);
    if (!canManage) return { success: false, error: "Unauthorized" };

    const parsed = createRoleSchema.safeParse(rawInput);
    if (!parsed.success) return { success: false, error: parsed.error.errors[0].message };

    // P2: branch-scoped roles may not contain org-only permissions
    if (parsed.data.scope_type === "branch" && parsed.data.permission_slugs?.length) {
      const invalid = parsed.data.permission_slugs.filter((s) => ORG_ONLY_SLUGS.has(s));
      if (invalid.length > 0) {
        return {
          success: false,
          error: `Permissions not allowed for branch-scoped roles: ${invalid.join(", ")}`,
        };
      }
    }

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
    if (!checkPermission(context.user.permissionSnapshot, MODULE_ORGANIZATION_MANAGEMENT_ACCESS))
      return { success: false, error: "Unauthorized" };

    const canManage = checkPermission(context.user.permissionSnapshot, MEMBERS_MANAGE);
    if (!canManage) return { success: false, error: "Unauthorized" };

    const parsed = updateRoleSchema.safeParse(rawInput);
    if (!parsed.success) return { success: false, error: parsed.error.errors[0].message };

    const { roleId, ...updateInput } = parsed.data;

    // G2: branch-scoped roles may not contain org-only permissions (mirrors createRoleAction guard)
    if (updateInput.permission_slugs?.length) {
      const { data: role, error: roleErr } = await supabase
        .from("roles")
        .select("scope_type")
        .eq("id", roleId)
        .maybeSingle();
      if (roleErr) return { success: false, error: roleErr.message };
      if (role?.scope_type === "branch") {
        const invalid = updateInput.permission_slugs.filter((s) => ORG_ONLY_SLUGS.has(s));
        if (invalid.length > 0) {
          return {
            success: false,
            error: `Permissions not allowed for branch-scoped roles: ${invalid.join(", ")}`,
          };
        }
      }
    }

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
    if (!checkPermission(context.user.permissionSnapshot, MODULE_ORGANIZATION_MANAGEMENT_ACCESS))
      return { success: false, error: "Unauthorized" };

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
    if (!checkPermission(context.user.permissionSnapshot, MODULE_ORGANIZATION_MANAGEMENT_ACCESS))
      return { success: false, error: "Unauthorized" };

    const parsed = assignRoleSchema.safeParse(rawInput);
    if (!parsed.success) return { success: false, error: parsed.error.errors[0].message };

    const { userId, roleId, scope, scopeId } = parsed.data;

    // Org admins (members.manage) may assign to any scope.
    // Branch managers (branch.roles.manage) may only assign branch-scoped roles;
    // RLS enforces the per-branch restriction — the action gate is a coarse allow.
    const canManage = checkPermission(context.user.permissionSnapshot, MEMBERS_MANAGE);
    const canManageBranch =
      scope === "branch" && checkPermission(context.user.permissionSnapshot, BRANCH_ROLES_MANAGE);
    if (!canManage && !canManageBranch) return { success: false, error: "Unauthorized" };

    if (scope === "branch" && !scopeId) {
      return { success: false, error: "scopeId required for branch assignments" };
    }

    return await OrgRolesService.assignRoleToUser(
      supabase,
      userId,
      roleId,
      context.app.activeOrgId,
      scope,
      scopeId
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
    if (!checkPermission(context.user.permissionSnapshot, MODULE_ORGANIZATION_MANAGEMENT_ACCESS))
      return { success: false, error: "Unauthorized" };

    const parsed = assignRoleSchema.safeParse(rawInput);
    if (!parsed.success) return { success: false, error: parsed.error.errors[0].message };

    const { userId, roleId, scope, scopeId } = parsed.data;

    // Same dual-gate as assignRoleToUserAction. RLS enforces the per-branch restriction.
    const canManage = checkPermission(context.user.permissionSnapshot, MEMBERS_MANAGE);
    const canManageBranch =
      scope === "branch" && checkPermission(context.user.permissionSnapshot, BRANCH_ROLES_MANAGE);
    if (!canManage && !canManageBranch) return { success: false, error: "Unauthorized" };

    if (scope === "branch" && !scopeId) {
      return { success: false, error: "scopeId required for branch removals" };
    }

    return await OrgRolesService.removeRoleFromUser(
      supabase,
      userId,
      roleId,
      context.app.activeOrgId,
      scope,
      scopeId
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
    if (!checkPermission(context.user.permissionSnapshot, MODULE_ORGANIZATION_MANAGEMENT_ACCESS))
      return { success: false, error: "Unauthorized" };

    const canRead = checkPermission(context.user.permissionSnapshot, MEMBERS_READ);
    const canBranchManage = checkPermission(context.user.permissionSnapshot, BRANCH_ROLES_MANAGE);
    if (!canRead && !canBranchManage) return { success: false, error: "Unauthorized" };

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

export async function getMemberAccessAction(userId: string) {
  try {
    const supabase = await createClient();
    await entitlements.requireModuleAccess(MODULE_ORGANIZATION_MANAGEMENT);
    const context = await loadDashboardContextV2();
    if (!context?.app.activeOrgId) return { success: false, error: "No active organization" };
    if (!checkPermission(context.user.permissionSnapshot, MODULE_ORGANIZATION_MANAGEMENT_ACCESS))
      return { success: false, error: "Unauthorized" };

    const canRead = checkPermission(context.user.permissionSnapshot, MEMBERS_READ);
    const canBranchManage = checkPermission(context.user.permissionSnapshot, BRANCH_ROLES_MANAGE);
    if (!canRead && !canBranchManage) return { success: false, error: "Unauthorized" };

    if (!z.string().uuid().safeParse(userId).success) {
      return { success: false, error: "Invalid user ID" };
    }

    const accessResult = await OrgRolesService.getMemberAccess(
      supabase,
      context.app.activeOrgId,
      userId
    );
    if (!accessResult.success) return accessResult;

    // Branch managers (no MEMBERS_READ) see only branch-scoped assignments.
    // This prevents leaking org-scoped role data to users without members.read.
    if (!canRead && canBranchManage) {
      return {
        success: true,
        data: {
          ...accessResult.data,
          assignments: accessResult.data.assignments.filter((a) => a.scope === "branch"),
        },
      };
    }

    return accessResult;
  } catch (error) {
    const mapped = mapEntitlementError(error);
    if (mapped) return { success: false, error: mapped.message };
    return { success: false, error: "Unexpected error" };
  }
}
