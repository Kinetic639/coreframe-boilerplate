import { NextRequest } from "next/server";
import { z } from "zod";
import { createClient } from "@/utils/supabase/server";
import { InventoryProductsService } from "@/server/services/inventory-products.service";

export const dynamic = "force-dynamic";

/**
 * One product's card (the list's side panel). A GET for the same reasons
 * as the list (../route.ts): parallel, cancellable, no action queue.
 *
 * GET /api/warehouse/products/:id?organizationId&branchId
 */
const input = z.object({
  id: z.string().uuid(),
  organizationId: z.string().uuid(),
  branchId: z.string().uuid().optional(),
});

function json(body: unknown, status = 200) {
  return Response.json(body, { status, headers: { "Cache-Control": "private, no-store" } });
}

export async function GET(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  const parsed = input.safeParse({
    id,
    organizationId: request.nextUrl.searchParams.get("organizationId"),
    branchId: request.nextUrl.searchParams.get("branchId") || undefined,
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
    InventoryProductsService.getProductDetail(
      supabase,
      organizationId,
      parsed.data.id,
      branchId ?? null
    ),
  ]);
  if (allowed.data !== true) return json({ success: false, error: "forbidden" }, 403);
  if (!result.success) {
    return json({ success: false, error: (result as { error: string }).error }, 500);
  }
  if (!result.data) return json({ success: false, error: "not_found" }, 404);
  return json({ success: true, data: result.data });
}
