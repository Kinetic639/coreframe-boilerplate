import { NextRequest } from "next/server";
import { z } from "zod";
import { createClient } from "@/utils/supabase/server";
import { InventoryProductsService } from "@/server/services/inventory-products.service";
import {
  loadProductState,
  productListParams,
} from "@/app/[locale]/dashboard/warehouse/items/_components/inventory-products-state";

export const dynamic = "force-dynamic";

/**
 * One page of the products list, for the list's own client cache.
 *
 * GET ?organizationId&branchId&<the page's own query: q, strona, wierszy,
 * sort, direction, status, product_type, grouped, is_variant, filters>
 *
 * A GET, not a server action: actions run one after another per tab, so a
 * page change would wait behind every hover-prefetch, and an action cannot
 * be cancelled. Lives under /api, so the middleware's session refresh does
 * not run; the session is checked from the JWT (getClaims). Every read goes
 * through RLS (inventory_products: has_permission(org, products.read);
 * balances: has_branch_permission(.., inventory.read)), and the permission
 * checked alongside, so a refusal is a 403, not an empty list.
 */
const scope = z.object({
  organizationId: z.string().uuid(),
  branchId: z.string().uuid().optional(),
});

function json(body: unknown, status = 200) {
  return Response.json(body, { status, headers: { "Cache-Control": "private, no-store" } });
}

export async function GET(request: NextRequest) {
  const params = request.nextUrl.searchParams;
  const parsed = scope.safeParse({
    organizationId: params.get("organizationId"),
    branchId: params.get("branchId") || undefined,
  });
  if (!parsed.success) return json({ success: false, error: "invalid_input" }, 400);
  const { organizationId, branchId } = parsed.data;

  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getClaims();
  if (!auth?.claims?.sub) return json({ success: false, error: "unauthorized" }, 401);

  const [allowed, result] = await Promise.all([
    supabase.rpc("has_permission", {
      org_id: organizationId,
      permission: "warehouse.products.read",
    }),
    InventoryProductsService.listProducts(
      supabase,
      organizationId,
      productListParams(loadProductState(params)),
      branchId ?? null
    ),
  ]);
  if (allowed.data !== true) return json({ success: false, error: "forbidden" }, 403);
  if (!result.success) {
    return json({ success: false, error: (result as { error: string }).error }, 500);
  }
  return json({ success: true, data: result.data });
}
