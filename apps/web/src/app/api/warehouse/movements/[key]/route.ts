import { NextRequest } from "next/server";
import { z } from "zod";
import { createClient } from "@/utils/supabase/server";
import { InventoryMovementsService } from "@/server/services/inventory-movements.service";

export const dynamic = "force-dynamic";

/**
 * One movement's card (the list's side panel), by its route key
 * (`PZ(115)-1-26-3112`) or id.
 *
 * GET /api/warehouse/movements/:key?organizationId&branchId
 */
const input = z.object({
  key: z.string().min(1).max(120),
  organizationId: z.string().uuid(),
  branchId: z.string().uuid(),
});

function json(body: unknown, status = 200) {
  return Response.json(body, { status, headers: { "Cache-Control": "private, no-store" } });
}

function safeDecode(value: string) {
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
}

export async function GET(request: NextRequest, context: { params: Promise<{ key: string }> }) {
  const { key } = await context.params;
  const parsed = input.safeParse({
    key: safeDecode(key),
    organizationId: request.nextUrl.searchParams.get("organizationId"),
    branchId: request.nextUrl.searchParams.get("branchId"),
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
    InventoryMovementsService.getMovementDetail(
      supabase,
      organizationId,
      branchId,
      parsed.data.key
    ),
  ]);
  if (allowed.data !== true) return json({ success: false, error: "forbidden" }, 403);
  if (!result.success) {
    const error = (result as { error: string }).error;
    return json({ success: false, error }, error === "Movement not found" ? 404 : 500);
  }
  return json({ success: true, data: result.data });
}
