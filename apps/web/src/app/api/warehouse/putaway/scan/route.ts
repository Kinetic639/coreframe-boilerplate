import { NextRequest } from "next/server";
import { z } from "zod";
import { createClient } from "@/utils/supabase/server";
import { PutawayScanService } from "@/server/services/putaway-scan.service";

export const dynamic = "force-dynamic";

/**
 * Putaway scan lookup, made for speed: ONE request answers "what is this
 * code" and "what is behind it" (the container and its repair order, or what
 * lies at the location). Lives under /api, so the middleware's session
 * refresh does not run for it, and the session is checked from the JWT
 * itself (getClaims) instead of a call to the auth server. Every read goes
 * through RLS, so it returns only what the caller may see; nothing is
 * written here (the putaway itself is a checked engine call).
 *
 * GET ?organizationId&branchId&token   -- a scanned code
 * GET ?organizationId&branchId&locationId -- what lies at a location
 */
const query = z
  .object({
    organizationId: z.string().uuid(),
    branchId: z.string().uuid(),
    token: z.string().trim().min(1).max(200).optional(),
    locationId: z.string().uuid().optional(),
  })
  .refine((q) => !!q.token !== !!q.locationId);

function json(body: unknown, status = 200) {
  return Response.json(body, { status, headers: { "Cache-Control": "no-store" } });
}

export async function GET(request: NextRequest) {
  const parsed = query.safeParse(Object.fromEntries(request.nextUrl.searchParams));
  if (!parsed.success) return json({ success: false, error: "invalid_input" }, 400);
  const { organizationId, branchId, token, locationId } = parsed.data as {
    organizationId: string;
    branchId: string;
    token?: string;
    locationId?: string;
  };

  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getClaims();
  if (!auth?.claims?.sub) return json({ success: false, error: "unauthorized" }, 401);

  if (locationId) {
    const location = await PutawayScanService.getLocationContents(
      supabase,
      organizationId,
      branchId,
      locationId
    );
    if (!location.success) return json({ success: false, error: "unexpected" }, 500);
    return json({ success: true, data: { location: location.data } });
  }

  const { data: qr, error } = await supabase
    .from("qr_codes")
    .select(
      "id, token, label, status, qr_assignments!qr_assignments_qr_code_id_fkey(target_type, target_id, revoked_at)"
    )
    .eq("organization_id", organizationId)
    .eq("token", token!)
    .is("deleted_at", null)
    .maybeSingle();
  if (error) return json({ success: false, error: "unexpected" }, 500);
  if (!qr) return json({ success: true, data: { lookup: null } });

  const active =
    (
      (qr.qr_assignments ?? []) as Array<{
        target_type: string;
        target_id: string;
        revoked_at: string | null;
      }>
    ).find((a) => a.revoked_at === null) ?? null;
  const lookup = {
    id: qr.id as string,
    token: qr.token as string,
    label: (qr.label as string | null) ?? null,
    status: qr.status as string,
    assignment: active ? { target_type: active.target_type, target_id: active.target_id } : null,
  };

  if (lookup.status === "active" && active?.target_type === "inventory.container") {
    const container = await PutawayScanService.getContainer(
      supabase,
      organizationId,
      branchId,
      active.target_id
    );
    if (!container.success) return json({ success: false, error: "unexpected" }, 500);
    return json({ success: true, data: { lookup, container: container.data } });
  }
  if (lookup.status === "active" && active?.target_type === "warehouse.location") {
    const location = await PutawayScanService.getLocationContents(
      supabase,
      organizationId,
      branchId,
      active.target_id
    );
    if (!location.success) return json({ success: false, error: "unexpected" }, 500);
    return json({ success: true, data: { lookup, location: location.data } });
  }
  return json({ success: true, data: { lookup } });
}
