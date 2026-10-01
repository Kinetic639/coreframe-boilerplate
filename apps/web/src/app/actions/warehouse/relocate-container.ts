"use server";

import { z } from "zod";
import { createClient } from "@/utils/supabase/server";
import { loadDashboardContextV2 } from "@/server/loaders/v2/load-dashboard-context.v2";
import { checkPermission } from "@/lib/utils/permissions";
import { WAREHOUSE_INVENTORY_OPERATE } from "@/lib/constants/permissions";
import {
  InventoryContainersService,
  type ContainerRelocationError,
  type ContainerRelocationResult,
} from "@/server/services/inventory-containers.service";

const relocateSchema = z.object({
  containerId: z.string().uuid(),
  destinationLocationId: z.string().uuid(),
});

type RelocateContainerResult =
  | { success: true; data: ContainerRelocationResult }
  | { success: false; error: ContainerRelocationError | "invalid_input" };

/**
 * Phase 10E -- move a whole container to another location of the active
 * branch. Gated on `warehouse.inventory.operate`; org and branch come from
 * server context and the container's own (RLS-visible) row, never from the
 * caller. A container outside the active branch is treated as not found --
 * the container screen switches branch before offering the move.
 */
export async function relocateContainerAction(rawInput: unknown): Promise<RelocateContainerResult> {
  try {
    const context = await loadDashboardContextV2();
    const orgId = context?.app.activeOrgId;
    const userId = context?.user.user?.id;
    if (!context || !orgId || !userId) return { success: false, error: "unauthorized" };

    if (!checkPermission(context.user.permissionSnapshot, WAREHOUSE_INVENTORY_OPERATE)) {
      return { success: false, error: "unauthorized" };
    }

    const parsed = relocateSchema.safeParse(rawInput);
    if (!parsed.success) return { success: false, error: "invalid_input" };

    const supabase = await createClient();
    const detail = await InventoryContainersService.getDetail(
      supabase,
      orgId,
      parsed.data.containerId
    );
    if (!detail.success || !detail.data) return { success: false, error: "not_found" };
    if (context.app.activeBranchId && detail.data.branchId !== context.app.activeBranchId) {
      return { success: false, error: "not_found" };
    }

    const result = await InventoryContainersService.relocate(supabase, {
      actorUserId: userId,
      organizationId: orgId,
      branchId: detail.data.branchId,
      containerId: parsed.data.containerId,
      destinationLocationId: parsed.data.destinationLocationId,
    });
    if (!result.success) {
      return {
        success: false,
        error: (result as { success: false; error: string }).error as ContainerRelocationError,
      };
    }
    return result;
  } catch {
    return { success: false, error: "unexpected" };
  }
}
