"use server";

import { z } from "zod";
import { createClient } from "@/utils/supabase/server";
import { loadDashboardContextV2 } from "@/server/loaders/v2/load-dashboard-context.v2";
import { checkPermission } from "@/lib/utils/permissions";
import { entitlements, mapEntitlementError } from "@/server/guards/entitlements-guards";
import { OrgRolesService, type CreateRoleInput } from "@/server/services/organization.service";
import { eventService } from "@/server/services/event.service";
import { MODULE_ORGANIZATION_MANAGEMENT } from "@/lib/constants/modules";
import {
  MODULE_ORGANIZATION_MANAGEMENT_ACCESS,
  MEMBERS_READ,
  MEMBERS_MANAGE,
  BRANCH_ROLES_MANAGE,
} from "@/lib/constants/permissions";
import { validateBranchRolePermissions } from "@repo/domain/organization";

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
      const validation = validateBranchRolePermissions("branch", parsed.data.permission_slugs);
      if ("invalidSlugs" in validation) {
        return {
          success: false,
          error: `Permissions not allowed for branch-scoped roles: ${validation.invalidSlugs.join(", ")}`,
        };
      }
    }

    const result = await OrgRolesService.createRole(
      supabase,
      context.app.activeOrgId,
      parsed.data as CreateRoleInput
    );

    if (result.success) {
      const createRoleEmitResult = await eventService.emit({
        actionKey: "org.role.created",
        actorType: "user",
        actorUserId: context.user.user?.id ?? null,
        organizationId: context.app.activeOrgId,
        entityType: "role",
        entityId: result.data.id,
        metadata: { role_id: result.data.id, role_name: result.data.name },
        eventTier: "enhanced",
      });
      if (!createRoleEmitResult.success) {
        console.error("[createRoleAction] Failed to emit org.role.created:", {
          actionKey: "org.role.created",
          organizationId: context.app.activeOrgId,
          actorUserId: context.user.user?.id ?? null,
          entityType: "role",
          entityId: result.data.id,
          error: (createRoleEmitResult as { success: false; error: string }).error,
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
        const validation = validateBranchRolePermissions("branch", updateInput.permission_slugs);
        if ("invalidSlugs" in validation) {
          return {
            success: false,
            error: `Permissions not allowed for branch-scoped roles: ${validation.invalidSlugs.join(", ")}`,
          };
        }
      }
    }

    // Fetch role name for event metadata — use new name if provided, else fetch current
    const roleName =
      updateInput.name ??
      (await (async () => {
        const { data } = await supabase.from("roles").select("name").eq("id", roleId).maybeSingle();
        return data?.name ?? roleId;
      })());

    const result = await OrgRolesService.updateRole(supabase, roleId, updateInput);

    if (result.success) {
      const updatedFields = Object.keys(updateInput).filter(
        (k) => (updateInput as Record<string, unknown>)[k] !== undefined
      );
      const updateRoleEmitResult = await eventService.emit({
        actionKey: "org.role.updated",
        actorType: "user",
        actorUserId: context.user.user?.id ?? null,
        organizationId: context.app.activeOrgId,
        entityType: "role",
        entityId: roleId,
        metadata: { role_id: roleId, role_name: roleName, updated_fields: updatedFields },
        eventTier: "enhanced",
      });
      if (!updateRoleEmitResult.success) {
        console.error("[updateRoleAction] Failed to emit org.role.updated:", {
          actionKey: "org.role.updated",
          organizationId: context.app.activeOrgId,
          actorUserId: context.user.user?.id ?? null,
          entityType: "role",
          entityId: roleId,
          error: (updateRoleEmitResult as { success: false; error: string }).error,
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

    // Fetch role name before deleting (service returns void, name unavailable after)
    const { data: roleToDelete } = await supabase
      .from("roles")
      .select("name")
      .eq("id", parsed.data.roleId)
      .maybeSingle();
    const deletedRoleName = roleToDelete?.name ?? parsed.data.roleId;

    const result = await OrgRolesService.deleteRole(supabase, parsed.data.roleId);

    if (result.success) {
      const deleteRoleEmitResult = await eventService.emit({
        actionKey: "org.role.deleted",
        actorType: "user",
        actorUserId: context.user.user?.id ?? null,
        organizationId: context.app.activeOrgId,
        entityType: "role",
        entityId: parsed.data.roleId,
        metadata: { role_id: parsed.data.roleId, role_name: deletedRoleName },
        eventTier: "enhanced",
      });
      if (!deleteRoleEmitResult.success) {
        console.error("[deleteRoleAction] Failed to emit org.role.deleted:", {
          actionKey: "org.role.deleted",
          organizationId: context.app.activeOrgId,
          actorUserId: context.user.user?.id ?? null,
          entityType: "role",
          entityId: parsed.data.roleId,
          error: (deleteRoleEmitResult as { success: false; error: string }).error,
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

    // Fetch role name for event metadata
    const { data: assignRoleData } = await supabase
      .from("roles")
      .select("name")
      .eq("id", roleId)
      .maybeSingle();
    const assignRoleName = assignRoleData?.name ?? roleId;

    const result = await OrgRolesService.assignRoleToUser(
      supabase,
      userId,
      roleId,
      context.app.activeOrgId,
      scope,
      scopeId
    );

    if (result.success) {
      const assignEmitResult = await eventService.emit({
        actionKey: "org.member.role_assigned",
        actorType: "user",
        actorUserId: context.user.user?.id ?? null,
        organizationId: context.app.activeOrgId,
        branchId: scope === "branch" ? scopeId : undefined,
        entityType: "role",
        entityId: roleId,
        targetType: "user",
        targetId: userId,
        metadata: {
          target_user_id: userId,
          role_name: assignRoleName,
          scope,
          branch_id: scope === "branch" ? scopeId : undefined,
        },
        eventTier: "enhanced",
      });
      if (!assignEmitResult.success) {
        console.error("[assignRoleToUserAction] Failed to emit org.member.role_assigned:", {
          actionKey: "org.member.role_assigned",
          organizationId: context.app.activeOrgId,
          actorUserId: context.user.user?.id ?? null,
          entityType: "role",
          entityId: roleId,
          error: (assignEmitResult as { success: false; error: string }).error,
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

    // Fetch role name for event metadata
    const { data: removeRoleData } = await supabase
      .from("roles")
      .select("name")
      .eq("id", roleId)
      .maybeSingle();
    const removeRoleName = removeRoleData?.name ?? roleId;

    const result = await OrgRolesService.removeRoleFromUser(
      supabase,
      userId,
      roleId,
      context.app.activeOrgId,
      scope,
      scopeId
    );

    if (result.success) {
      const removeRoleEmitResult = await eventService.emit({
        actionKey: "org.member.role_removed",
        actorType: "user",
        actorUserId: context.user.user?.id ?? null,
        organizationId: context.app.activeOrgId,
        branchId: scope === "branch" ? scopeId : undefined,
        entityType: "role",
        entityId: roleId,
        targetType: "user",
        targetId: userId,
        metadata: {
          target_user_id: userId,
          role_name: removeRoleName,
          scope,
          branch_id: scope === "branch" ? scopeId : undefined,
        },
        eventTier: "enhanced",
      });
      if (!removeRoleEmitResult.success) {
        console.error("[removeRoleFromUserAction] Failed to emit org.member.role_removed:", {
          actionKey: "org.member.role_removed",
          organizationId: context.app.activeOrgId,
          actorUserId: context.user.user?.id ?? null,
          entityType: "role",
          entityId: roleId,
          error: (removeRoleEmitResult as { success: false; error: string }).error,
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
