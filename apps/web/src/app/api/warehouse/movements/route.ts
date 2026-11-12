import { NextRequest } from "next/server";
import { z } from "zod";
import { createClient } from "@/utils/supabase/server";
import { InventoryMovementsService } from "@/server/services/inventory-movements.service";
import {
  loadMovementState,
  movementListParams,
} from "@/app/[locale]/dashboard/warehouse/inventory/movements/_components/inventory-movements-state";

export const dynamic = "force-dynamic";

/**
 * One page of the movements list, for the list's own client cache (as
 * /api/warehouse/products).
 *
 * GET ?organizationId&branchId&<the page's own query: q, strona, wierszy,
 * sort, direction, rodzaj, status, jednostka, magazyn, ksiegowanie*>
 *
 * Reads go through RLS; warehouse.inventory.read for the branch is checked
 * alongside, so a refusal is a 403, not an empty list.
 */
const scope = z.object({
  organizationId: z.string().uuid(),
  branchId: z.string().uuid(),
});

function json(body: unknown, status = 200) {
  return Response.json(body, { status, headers: { "Cache-Control": "private, no-store" } });
}

export async function GET(request: NextRequest) {
  const params = request.nextUrl.searchParams;
  const parsed = scope.safeParse({
    organizationId: params.get("organizationId"),
    branchId: params.get("branchId"),
  });
  if (!parsed.success) return json({ success: false, error: "invalid_input" }, 400);
  const { organizationId, branchId } = parsed.data;

  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getClaims();
  if (!auth?.claims?.sub) return json({ success: false, error: "unauthorized" }, 401);

  const [allowed, result] = await Promise.all([
    supabase.rpc("has_branch_permission", {
      p_org_id: organizationId,
      p_branch_id: branchId,
      p_permission_slug: "warehouse.inventory.read",
    }),
    InventoryMovementsService.listMovements(
      supabase,
      organizationId,
      branchId,
      movementListParams(loadMovementState(params))
    ),
  ]);
  if (allowed.data !== true) return json({ success: false, error: "forbidden" }, 403);
  if (!result.success) {
    return json({ success: false, error: (result as { error: string }).error }, 500);
  }
  return json({ success: true, data: result.data });
}
