import { NextResponse } from "next/server";
import { guard } from "@/server/requests/api-guard";
import { loadNewRequestOptions } from "@/server/requests/new-request-options";
import { createClient } from "@/utils/supabase/server";

/** Branches, types and warehouses for the new-request dialog. */
export async function GET() {
  const g = await guard();
  if ("response" in g) return g.response;
  return NextResponse.json(await loadNewRequestOptions(await createClient(), g.ctx));
}
