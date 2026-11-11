import { NextResponse } from "next/server";
import { guard } from "@/server/requests/api-guard";
import { postComment } from "@/server/requests/thread-ops";

/** New reply (multipart: body, bodyRich, files[]). */
export async function POST(req: Request, { params }: { params: Promise<{ ticketId: string }> }) {
  const { ticketId } = await params;
  const g = await guard(ticketId);
  if ("response" in g) return g.response;
  const res = await postComment(g.ctx, ticketId, await req.formData());
  return res.ok
    ? NextResponse.json({ ok: true })
    : NextResponse.json({ error: res.error }, { status: 422 });
}
