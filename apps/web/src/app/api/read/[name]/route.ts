import { NextRequest } from "next/server";
import { appReads } from "@/server/reads/registry";
import { serveRead } from "@/server/reads/serve-read";

// Shared reads over GET (POST when the arguments are long): see
// src/server/reads/registry.ts.

export const dynamic = "force-dynamic";

type Context = { params: Promise<{ name: string }> };

export async function GET(request: NextRequest, { params }: Context) {
  return serveRead(appReads, (await params).name, request);
}

export async function POST(request: NextRequest, { params }: Context) {
  return serveRead(appReads, (await params).name, request);
}
