import { NextResponse } from "next/server";
import { guard } from "@/server/requests/api-guard";
import { getRequestView } from "@/server/requests/view.service";
import { createClient } from "@/utils/supabase/server";

export const dynamic = "force-dynamic";

/** One request card: the request, its activity, comments and files. */
export async function GET(_req: Request, { params }: { params: Promise<{ ticketId: string }> }) {
  const { ticketId } = await params;
  const g = await guard(ticketId);
  if ("response" in g) return g.response;
  const res = await getRequestView(await createClient(), g.ctx, ticketId);
  if (!res.ok) return NextResponse.json({ error: res.error }, { status: 422 });
  if (!res.data) return NextResponse.json({ error: "not_found" }, { status: 404 });
  return NextResponse.json(res.data, { headers: { "Cache-Control": "private, no-store" } });
}
