import { NextRequest } from "next/server";
import { z } from "zod";
import { createClient } from "@/utils/supabase/server";

export const dynamic = "force-dynamic";

/**
 * The organization's assigned QR codes and where each points (type, target,
 * branch) -- for the global scanner, so a scanned label of a location or a
 * container opens its page at once instead of going through /qr first.
 * Session from the JWT (getClaims), RLS read only. A code this does not
 * know, or one of another branch, still goes through /qr, which validates
 * it and handles the branch switch.
 */
const query = z.object({ organizationId: z.string().uuid() });

export async function GET(request: NextRequest) {
  const parsed = query.safeParse(Object.fromEntries(request.nextUrl.searchParams));
  if (!parsed.success) {
    return Response.json({ success: false, error: "invalid_input" }, { status: 400 });
  }
  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getClaims();
  if (!auth?.claims?.sub) {
    return Response.json({ success: false, error: "unauthorized" }, { status: 401 });
  }

  const { data, error } = await supabase
    .from("qr_codes")
    .select(
      "token, qr_assignments!qr_assignments_qr_code_id_fkey(target_type, target_id, branch_id, revoked_at)"
    )
    .eq("organization_id", (parsed.data as { organizationId: string }).organizationId)
    .eq("status", "active")
    .is("deleted_at", null)
    .limit(20000);
  if (error) return Response.json({ success: false, error: "unexpected" }, { status: 500 });

  const codes = (
    (data ?? []) as Array<{
      token: string;
      qr_assignments: Array<{
        target_type: string;
        target_id: string;
        branch_id: string | null;
        revoked_at: string | null;
      }> | null;
    }>
  ).flatMap((row) => {
    const active = (row.qr_assignments ?? []).find((a) => a.revoked_at === null);
    return active
      ? [
          {
            token: row.token,
            targetType: active.target_type,
            targetId: active.target_id,
            branchId: active.branch_id,
          },
        ]
      : [];
  });

  return Response.json(
    { success: true, data: codes },
    { headers: { "Cache-Control": "private, no-store" } }
  );
}
