"use server";

import { z } from "zod";
import { createClient } from "@/utils/supabase/server";
import { loadDashboardContextV2 } from "@/server/loaders/v2/load-dashboard-context.v2";
import { checkPermission } from "@/lib/utils/permissions";
import { entitlements, mapEntitlementError } from "@/server/guards/entitlements-guards";
import { OrgBranchesService, type CreateBranchInput } from "@/server/services/organization.service";
import { eventService } from "@/server/services/event.service";
import { MODULE_ORGANIZATION_MANAGEMENT } from "@/lib/constants/modules";
import {
  MODULE_ORGANIZATION_MANAGEMENT_ACCESS,
  BRANCHES_READ,
  BRANCHES_CREATE,
  BRANCHES_UPDATE,
  BRANCHES_DELETE,
} from "@/lib/constants/permissions";

const createBranchSchema = z.object({
  name: z.string().min(1).max(200),
  slug: z
    .string()
    .regex(/^[a-z0-9-]+$/, "Slug must be lowercase letters, numbers, hyphens only")
    .max(100)
    .nullable()
    .optional(),
});

const updateBranchSchema = z.object({
  branchId: z.string().uuid(),
  name: z.string().min(1).max(200).optional(),
  slug: z
    .string()
    .regex(/^[a-z0-9-]+$/, "Slug must be lowercase letters, numbers, hyphens only")
    .max(100)
    .nullable()
    .optional(),
});

const branchIdSchema = z.object({ branchId: z.string().uuid() });

export async function listBranchesAction() {
  try {
    const supabase = await createClient();
    await entitlements.requireModuleAccess(MODULE_ORGANIZATION_MANAGEMENT);
    const context = await loadDashboardContextV2();
    if (!context?.app.activeOrgId) return { success: false, error: "No active organization" };
    if (!checkPermission(context.user.permissionSnapshot, MODULE_ORGANIZATION_MANAGEMENT_ACCESS))
      return { success: false, error: "Unauthorized" };

    const canRead = checkPermission(context.user.permissionSnapshot, BRANCHES_READ);
    if (!canRead) return { success: false, error: "Unauthorized" };

    return await OrgBranchesService.listBranches(supabase, context.app.activeOrgId);
  } catch (error) {
    const mapped = mapEntitlementError(error);
    if (mapped) return { success: false, error: mapped.message };
    return { success: false, error: "Unexpected error" };
  }
}

export async function createBranchAction(rawInput: unknown) {
  try {
    const supabase = await createClient();
    await entitlements.requireModuleAccess(MODULE_ORGANIZATION_MANAGEMENT);
    const context = await loadDashboardContextV2();
    if (!context?.app.activeOrgId) return { success: false, error: "No active organization" };
    if (!checkPermission(context.user.permissionSnapshot, MODULE_ORGANIZATION_MANAGEMENT_ACCESS))
      return { success: false, error: "Unauthorized" };

    const canCreate = checkPermission(context.user.permissionSnapshot, BRANCHES_CREATE);
    if (!canCreate) return { success: false, error: "Unauthorized" };

    const parsed = createBranchSchema.safeParse(rawInput);
    if (!parsed.success) return { success: false, error: parsed.error.errors[0].message };

    const result = await OrgBranchesService.createBranch(
      supabase,
      context.app.activeOrgId,
      parsed.data as CreateBranchInput
    );

    if (result.success) {
      try {
        await eventService.emit({
          actionKey: "org.branch.created",
          actorType: "user",
          actorUserId: context.user.user?.id ?? null,
          organizationId: context.app.activeOrgId,
          entityType: "branch",
          entityId: result.data.id,
          metadata: { branch_id: result.data.id, branch_name: result.data.name },
          eventTier: "baseline",
        });
      } catch (emitError) {
        console.error("[createBranchAction] Failed to emit org.branch.created:", {
          actionKey: "org.branch.created",
          organizationId: context.app.activeOrgId,
          actorUserId: context.user.user?.id ?? null,
          entityType: "branch",
          entityId: result.data.id,
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

export async function updateBranchAction(rawInput: unknown) {
  try {
    const supabase = await createClient();
    await entitlements.requireModuleAccess(MODULE_ORGANIZATION_MANAGEMENT);
    const context = await loadDashboardContextV2();
    if (!context?.app.activeOrgId) return { success: false, error: "No active organization" };
    if (!checkPermission(context.user.permissionSnapshot, MODULE_ORGANIZATION_MANAGEMENT_ACCESS))
      return { success: false, error: "Unauthorized" };

    const canUpdate = checkPermission(context.user.permissionSnapshot, BRANCHES_UPDATE);
    if (!canUpdate) return { success: false, error: "Unauthorized" };

    const parsed = updateBranchSchema.safeParse(rawInput);
    if (!parsed.success) return { success: false, error: parsed.error.errors[0].message };

    const { branchId, ...updateInput } = parsed.data;

    const result = await OrgBranchesService.updateBranch(
      supabase,
      branchId,
      context.app.activeOrgId,
      updateInput
    );

    if (result.success) {
      const updatedFields = Object.keys(updateInput).filter(
        (k) => (updateInput as Record<string, unknown>)[k] !== undefined
      );
      try {
        await eventService.emit({
          actionKey: "org.branch.updated",
          actorType: "user",
          actorUserId: context.user.user?.id ?? null,
          organizationId: context.app.activeOrgId,
          entityType: "branch",
          entityId: branchId,
          metadata: {
            branch_id: branchId,
            branch_name: updateInput.name,
            updated_fields: updatedFields,
          },
          eventTier: "baseline",
        });
      } catch (emitError) {
        console.error("[updateBranchAction] Failed to emit org.branch.updated:", {
          actionKey: "org.branch.updated",
          organizationId: context.app.activeOrgId,
          actorUserId: context.user.user?.id ?? null,
          entityType: "branch",
          entityId: branchId,
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

export async function deleteBranchAction(rawInput: unknown) {
  try {
    const supabase = await createClient();
    await entitlements.requireModuleAccess(MODULE_ORGANIZATION_MANAGEMENT);
    const context = await loadDashboardContextV2();
    if (!context?.app.activeOrgId) return { success: false, error: "No active organization" };
    if (!checkPermission(context.user.permissionSnapshot, MODULE_ORGANIZATION_MANAGEMENT_ACCESS))
      return { success: false, error: "Unauthorized" };

    const canDelete = checkPermission(context.user.permissionSnapshot, BRANCHES_DELETE);
    if (!canDelete) return { success: false, error: "Unauthorized" };

    const parsed = branchIdSchema.safeParse(rawInput);
    if (!parsed.success) return { success: false, error: parsed.error.errors[0].message };

    const result = await OrgBranchesService.deleteBranch(
      supabase,
      parsed.data.branchId,
      context.app.activeOrgId
    );

    if (result.success) {
      try {
        await eventService.emit({
          actionKey: "org.branch.deleted",
          actorType: "user",
          actorUserId: context.user.user?.id ?? null,
          organizationId: context.app.activeOrgId,
          entityType: "branch",
          entityId: parsed.data.branchId,
          metadata: { branch_id: parsed.data.branchId },
          eventTier: "enhanced",
        });
      } catch (emitError) {
        console.error("[deleteBranchAction] Failed to emit org.branch.deleted:", {
          actionKey: "org.branch.deleted",
          organizationId: context.app.activeOrgId,
          actorUserId: context.user.user?.id ?? null,
          entityType: "branch",
          entityId: parsed.data.branchId,
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
