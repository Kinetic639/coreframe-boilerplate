import type { PortalBranch, PortalContext } from "@/server/portal-context";
import type { PortalSupabase } from "@/utils/supabase/server";
import {
  listBranchWarehouses,
  listTicketTypesByBranch,
  type PortalTicketType,
  type PortalWarehouse,
} from "./requests.service";

/** What the new-request form offers: branches the user may file in, their types and warehouses. */
export type NewRequestOptions = {
  branches: PortalBranch[];
  typesByBranch: Record<string, PortalTicketType[]>;
  warehousesByBranch: Record<string, PortalWarehouse[]>;
  /** The header's branch when the user may file there, else the first one; null = none. */
  defaultBranchId: string | null;
};

export async function loadNewRequestOptions(
  supabase: PortalSupabase,
  ctx: PortalContext
): Promise<NewRequestOptions> {
  const branches = ctx.branches.filter((b) => ctx.can.create(b.id));
  const branchIds = branches.map((b) => b.id);
  const [types, warehousesByBranch] = await Promise.all([
    listTicketTypesByBranch(supabase, ctx, branchIds),
    listBranchWarehouses(supabase, ctx, branchIds),
  ]);
  const defaultBranchId =
    (ctx.activeBranchId && branchIds.includes(ctx.activeBranchId) && ctx.activeBranchId) ||
    branchIds[0] ||
    null;
  return {
    branches,
    typesByBranch: types.ok ? types.data : {},
    warehousesByBranch,
    defaultBranchId,
  };
}
