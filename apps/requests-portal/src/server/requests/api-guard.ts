import { NextResponse } from "next/server";
import { loadPortalContext, type PortalContext } from "@/server/portal-context";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Signed-in portal user + valid ids, or the error response to return. */
export async function guard(
  ...ids: string[]
): Promise<{ ctx: PortalContext } | { response: NextResponse }> {
  if (!ids.every((id) => UUID.test(id))) {
    return { response: NextResponse.json({ error: "invalid" }, { status: 400 }) };
  }
  const res = await loadPortalContext();
  if (res.status !== "ok") {
    return { response: NextResponse.json({ error: "unauthorized" }, { status: 401 }) };
  }
  return { ctx: res.context };
}
