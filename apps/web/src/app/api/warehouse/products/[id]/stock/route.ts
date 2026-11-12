import { NextRequest } from "next/server";
import { z } from "zod";
import { createClient } from "@/utils/supabase/server";
import { InventoryBalancesService } from "@/server/services/inventory-balances.service";
import {
  InventoryReservationsService,
  type ReservationLineView,
} from "@/server/services/inventory-reservations.service";
import {
  InventoryBlocksService,
  type BlockLineView,
} from "@/server/services/inventory-blocks.service";
import type { ItemStockBreakdown } from "@/lib/warehouse/item-stock-client";

export const dynamic = "force-dynamic";

/**
 * One item's stock in a branch, per location, with every reservation and
 * block behind its R and B (the "Stany" tab of the products list's panel).
 * A GET, like the list (../../route.ts): it runs at once, beside anything
 * else, instead of waiting in the queue of server actions.
 *
 * GET /api/warehouse/products/:id/stock?organizationId&branchId
 */
const input = z.object({
  id: z.string().uuid(),
  organizationId: z.string().uuid(),
  branchId: z.string().uuid(),
});

function json(body: unknown, status = 200) {
  return Response.json(body, { status, headers: { "Cache-Control": "private, no-store" } });
}

export async function GET(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  const params = request.nextUrl.searchParams;
  if (!params.get("branchId")) return json({ success: false, error: "no_branch" }, 400);
  const parsed = input.safeParse({
    id,
    organizationId: params.get("organizationId"),
    branchId: params.get("branchId"),
  });
  if (!parsed.success) return json({ success: false, error: "invalid_input" }, 400);
  const { organizationId: orgId, branchId, id: productId } = parsed.data;

  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getClaims();
  if (!auth?.claims?.sub) return json({ success: false, error: "unauthorized" }, 401);

  const permission = (slug: string) =>
    supabase.rpc("has_branch_permission", {
      p_org_id: orgId,
      p_branch_id: branchId,
      p_permission_slug: slug,
    });
  const [canRead, canOperate, stock] = await Promise.all([
    permission("warehouse.inventory.read"),
    permission("warehouse.inventory.operate"),
    InventoryBalancesService.listForProduct(supabase, orgId, branchId, productId),
  ]);
  if (canRead.data !== true) return json({ success: false, error: "unauthorized" }, 403);
  if (!stock.success) return json({ success: false, error: "failed" }, 500);

  const variantIds = [...new Set(stock.data.map((row) => row.variant_id))];
  const [reservations, blocks] = variantIds.length
    ? await Promise.all([
        InventoryReservationsService.listActiveDetailed(supabase, orgId, branchId, { variantIds }),
        InventoryBlocksService.listActiveDetailed(supabase, orgId, branchId, { variantIds }),
      ])
    : [
        { success: true as const, data: [] as ReservationLineView[] },
        { success: true as const, data: [] as BlockLineView[] },
      ];
  if (!reservations.success || !blocks.success) {
    return json({ success: false, error: "failed" }, 500);
  }

  const data: ItemStockBreakdown = {
    branchId,
    canOperate: canOperate.data === true,
    rows: stock.data,
    reservations: reservations.data,
    blocks: blocks.data,
  };
  return json({ success: true, data });
}
