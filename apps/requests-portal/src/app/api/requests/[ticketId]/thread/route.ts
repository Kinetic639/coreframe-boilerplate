import { NextResponse } from "next/server";
import { guard } from "@/server/requests/api-guard";
import { loadThread } from "@/server/requests/thread-ops";

export const dynamic = "force-dynamic";

/** Fresh thread (comments + attachments) of one request. */
export async function GET(_req: Request, { params }: { params: Promise<{ ticketId: string }> }) {
  const { ticketId } = await params;
  const g = await guard(ticketId);
  if ("response" in g) return g.response;
  const data = await loadThread(g.ctx, ticketId);
  return data
    ? NextResponse.json(data)
    : NextResponse.json({ error: "not_found" }, { status: 404 });
}
