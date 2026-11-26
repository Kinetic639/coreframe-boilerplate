import { NextResponse } from "next/server";
import { guard } from "@/server/requests/api-guard";
import { closeOwnRequest } from "@/server/requests/requests.service";
import { createClient } from "@/utils/supabase/server";

/**
 * The requester closes ("Sprawa załatwiona") or withdraws their request ({ outcome }).
 * A plain POST, not a Server Action, so the save never re-renders the route. Returns the
 * saved list row for the cache.
 */
export async function POST(req: Request, { params }: { params: Promise<{ ticketId: string }> }) {
  const { ticketId } = await params;
  const g = await guard(ticketId);
  if ("response" in g) return g.response;
  const body = (await req.json().catch(() => null)) as { outcome?: string } | null;
  const outcome = body?.outcome;
  if (outcome !== "closed" && outcome !== "cancelled") {
    return NextResponse.json({ error: "invalid" }, { status: 400 });
  }
  const res = await closeOwnRequest(await createClient(), g.ctx, ticketId, outcome);
  return res.ok
    ? NextResponse.json(res.data)
    : NextResponse.json({ error: res.error }, { status: 422 });
}
