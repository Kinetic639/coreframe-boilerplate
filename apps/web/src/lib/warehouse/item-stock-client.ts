import type { InventoryBalanceListRow } from "@/lib/warehouse/inventory-types";
import type { ReservationLineView } from "@/server/services/inventory-reservations.service";
import type { BlockLineView } from "@/server/services/inventory-blocks.service";

export type ItemStockBreakdown = {
  branchId: string;
  canOperate: boolean;
  rows: InventoryBalanceListRow[];
  reservations: ReservationLineView[];
  blocks: BlockLineView[];
};

export type ItemStockResult =
  | { success: true; data: ItemStockBreakdown }
  | { success: false; error: string };

/**
 * One item's stock breakdown, from GET /api/warehouse/products/:id/stock
 * (no server action: it does not wait behind other actions, and it is
 * cancelled when the panel goes away).
 */
export async function fetchItemStockBreakdown(
  input: { productId: string; organizationId: string | null; branchId: string | null },
  signal?: AbortSignal
): Promise<ItemStockResult> {
  if (!input.organizationId) return { success: false, error: "unauthorized" };
  if (!input.branchId) return { success: false, error: "no_branch" };
  const query = new URLSearchParams({
    organizationId: input.organizationId,
    branchId: input.branchId,
  });
  const response = await fetch(
    `/api/warehouse/products/${encodeURIComponent(input.productId)}/stock?${query}`,
    { signal, credentials: "same-origin" }
  );
  const body = (await response.json().catch(() => null)) as ItemStockResult | null;
  if (!body) return { success: false, error: `HTTP ${response.status}` };
  return body;
}
