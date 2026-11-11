"use server";

import { z } from "zod";
import { createClient } from "@/utils/supabase/server";
import { loadDashboardContextV2 } from "@/server/loaders/v2/load-dashboard-context.v2";
import { checkPermission } from "@/lib/utils/permissions";
import { WAREHOUSE_INVENTORY_OPERATE, WAREHOUSE_INVENTORY_READ } from "@/lib/constants/permissions";
import { InventoryBalancesService } from "@/server/services/inventory-balances.service";
import {
  InventoryReservationsService,
  type ReservationLineView,
} from "@/server/services/inventory-reservations.service";
import {
  InventoryBlocksService,
  type BlockLineView,
} from "@/server/services/inventory-blocks.service";
import type { InventoryBalanceListRow } from "@/lib/warehouse/inventory-types";

export type ItemStockBreakdown = {
  branchId: string;
  canOperate: boolean;
  rows: InventoryBalanceListRow[];
  reservations: ReservationLineView[];
  blocks: BlockLineView[];
};

/**
 * One item's stock in the active branch, per location, with every
 * reservation and block behind its R and B -- for the item panel of the
 * products list (the item page loads the same on the server).
 */
export async function getItemStockBreakdownAction(
  rawInput: unknown
): Promise<{ success: true; data: ItemStockBreakdown } | { success: false; error: string }> {
  try {
    const context = await loadDashboardContextV2();
    const orgId = context?.app.activeOrgId ?? null;
    const branchId = context?.app.activeBranchId ?? null;
    if (!context || !orgId) return { success: false, error: "unauthorized" };
    if (!branchId) return { success: false, error: "no_branch" };
    const snapshot = context.user.permissionSnapshot;
    if (!checkPermission(snapshot, WAREHOUSE_INVENTORY_READ)) {
      return { success: false, error: "unauthorized" };
    }
    const parsed = z.object({ productId: z.string().uuid() }).safeParse(rawInput);
    if (!parsed.success) return { success: false, error: "invalid_input" };

    const supabase = await createClient();
    const stock = await InventoryBalancesService.listForProduct(
      supabase,
      orgId,
      branchId,
      parsed.data.productId
    );
    if (!stock.success) return { success: false, error: "failed" };
    const variantIds = [...new Set(stock.data.map((row) => row.variant_id))];
    const [reservations, blocks] = variantIds.length
      ? await Promise.all([
          InventoryReservationsService.listActiveDetailed(supabase, orgId, branchId, {
            variantIds,
          }),
          InventoryBlocksService.listActiveDetailed(supabase, orgId, branchId, { variantIds }),
        ])
      : [
          { success: true as const, data: [] as ReservationLineView[] },
          { success: true as const, data: [] as BlockLineView[] },
        ];
    if (!reservations.success || !blocks.success) return { success: false, error: "failed" };

    return {
      success: true,
      data: {
        branchId,
        canOperate: checkPermission(snapshot, WAREHOUSE_INVENTORY_OPERATE),
        rows: stock.data,
        reservations: reservations.data,
        blocks: blocks.data,
      },
    };
  } catch {
    return { success: false, error: "failed" };
  }
}
