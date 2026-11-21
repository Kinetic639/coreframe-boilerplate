import { NextRequest } from "next/server";
import { planningReads } from "@/server/planning/read-registry";
import { serveRead } from "@/server/reads/serve-read";

// Planning reads over GET: see read-registry.ts. The arguments come as a JSON
// array in ?args=, the same values the client would pass to the action.

export const dynamic = "force-dynamic";

type Context = { params: Promise<{ name: string }> };

export async function GET(request: NextRequest, { params }: Context) {
  return serveRead(planningReads, (await params).name, request);
}

export async function POST(request: NextRequest, { params }: Context) {
  return serveRead(planningReads, (await params).name, request);
}
