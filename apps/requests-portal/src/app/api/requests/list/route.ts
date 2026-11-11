import { NextResponse } from "next/server";
import { guard } from "@/server/requests/api-guard";
import { parseListParams } from "@/server/requests/list-params";
import { listRequests } from "@/server/requests/requests.service";
import { createClient } from "@/utils/supabase/server";

/** Request list for the given list query (?scope=&f=&type=&q=&sort=&p=). */
export async function GET(req: Request) {
  const g = await guard();
  if ("response" in g) return g.response;
  const query = Object.fromEntries(new URL(req.url).searchParams);
  const res = await listRequests(await createClient(), g.ctx, parseListParams(query));
  return res.ok
    ? NextResponse.json(res.data)
    : NextResponse.json({ error: res.error }, { status: 422 });
}
