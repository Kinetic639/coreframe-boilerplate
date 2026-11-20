import "server-only";
import { NextRequest, NextResponse } from "next/server";

const NO_STORE = { "Cache-Control": "private, no-store" };

type Read = (...input: unknown[]) => Promise<unknown>;

/**
 * Runs one registered read for a route handler. The arguments come as a JSON
 * array: in ?args= for GET, or as the body for POST (used when they would make
 * the address too long). Only names in the registry run; anything else is 404.
 */
export async function serveRead(
  registry: Record<string, unknown>,
  name: string,
  request: NextRequest
): Promise<NextResponse> {
  if (!Object.prototype.hasOwnProperty.call(registry, name)) {
    return NextResponse.json(
      { success: false, error: "Not found" },
      { status: 404, headers: NO_STORE }
    );
  }

  let args: unknown;
  try {
    args =
      request.method === "POST"
        ? await request.json()
        : JSON.parse(request.nextUrl.searchParams.get("args") ?? "[]");
  } catch {
    args = null;
  }
  if (!Array.isArray(args)) {
    return NextResponse.json(
      { success: false, error: "Invalid input" },
      { status: 400, headers: NO_STORE }
    );
  }

  const result = await (registry[name] as Read)(...args);
  return NextResponse.json(result, { headers: NO_STORE });
}
