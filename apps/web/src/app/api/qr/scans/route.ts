import { NextRequest } from "next/server";
import { z } from "zod";
import { createClient } from "@/utils/supabase/server";
import { recordQrScan } from "@/server/qr/scan-recorder";

export const dynamic = "force-dynamic";

const body = z.object({ token: z.string().min(1).max(200) });

/**
 * POST /api/qr/scans -- counts a scan the app resolved on its own (the global
 * scanner opening a label's page directly, the putaway scan strip), which
 * never reaches /qr/[token]. Sent with navigator.sendBeacon, so it always
 * answers 204 and never blocks the scan.
 *
 * The code is looked up with the caller's session (RLS: qr.read in the
 * code's organization), so a user can only count scans of codes they can see.
 */
export async function POST(request: NextRequest) {
  const parsed = body.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return new Response(null, { status: 204 });

  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getClaims();
  if (!auth?.claims?.sub) return new Response(null, { status: 204 });

  const { data } = await supabase
    .from("qr_codes")
    .select("id")
    .eq("token", parsed.data.token)
    .is("deleted_at", null)
    .maybeSingle();
  if (data?.id) await recordQrScan(data.id as string);

  return new Response(null, { status: 204 });
}
