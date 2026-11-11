import { NextResponse } from "next/server";
import { guard } from "@/server/requests/api-guard";
import { editComment } from "@/server/requests/thread-ops";

/** Edit of one's own reply (multipart: bodyRich, removeIds JSON, files[]). */
export async function POST(
  req: Request,
  { params }: { params: Promise<{ ticketId: string; commentId: string }> }
) {
  const { ticketId, commentId } = await params;
  const g = await guard(ticketId, commentId);
  if ("response" in g) return g.response;
  const res = await editComment(g.ctx, ticketId, commentId, await req.formData());
  return res.ok
    ? NextResponse.json({ ok: true })
    : NextResponse.json({ error: res.error }, { status: 422 });
}
