import { NextRequest, NextResponse } from "next/server";
import { planningReads, type PlanningReadName } from "@/server/planning/read-registry";

// Planning reads over GET: see read-registry.ts. The arguments come as a JSON
// array in ?args=, the same values the client would pass to the action.

export const dynamic = "force-dynamic";

const NO_STORE = { "Cache-Control": "private, no-store" };

export async function GET(request: NextRequest, { params }: { params: Promise<{ name: string }> }) {
  const { name } = await params;
  if (!Object.prototype.hasOwnProperty.call(planningReads, name)) {
    return NextResponse.json(
      { success: false, error: "Not found" },
      { status: 404, headers: NO_STORE }
    );
  }

  let args: unknown;
  try {
    args = JSON.parse(request.nextUrl.searchParams.get("args") ?? "[]");
  } catch {
    args = null;
  }
  if (!Array.isArray(args)) {
    return NextResponse.json(
      { success: false, error: "Invalid input" },
      { status: 400, headers: NO_STORE }
    );
  }

  const read = planningReads[name as PlanningReadName] as (...input: unknown[]) => Promise<{
    success: boolean;
  }>;
  const result = await read(...args);
  return NextResponse.json(result, { headers: NO_STORE });
}
