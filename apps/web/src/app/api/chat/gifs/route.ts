import { NextRequest } from "next/server";
import { createClient } from "@/utils/supabase/server";
import { parseGifResponse } from "@/lib/messages/gif";

export const dynamic = "force-dynamic";

/**
 * GIF search for the chat picker: GET ?q=<text>&pos=<next page>&locale=pl|en.
 * Without q it returns the trending GIFs.
 *
 * Proxies KLIPY's Tenor-compatible v2 API so the key (KLIPY_API_KEY, server
 * only) never reaches the browser. The session token is verified locally
 * (getClaims, no request to Supabase), and provider answers are kept in the
 * data cache for an hour, so repeated searches do not spend the key's quota.
 * 503 "not_configured" while no key is set: the picker says so.
 */
const KLIPY_BASE = "https://api.klipy.com/v2";
const PAGE_SIZE = 24;
const CACHE_SECONDS = 60 * 60;

function json(body: unknown, status = 200, cache = "private, no-store") {
  return Response.json(body, { status, headers: { "Cache-Control": cache } });
}

export async function GET(request: NextRequest) {
  const key = process.env.KLIPY_API_KEY?.trim();
  if (!key) return json({ error: "not_configured" }, 503);

  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getClaims();
  if (!auth?.claims?.sub) return json({ error: "unauthorized" }, 401);

  const params = request.nextUrl.searchParams;
  const q = (params.get("q") ?? "").trim().slice(0, 100);
  const pos = (params.get("pos") ?? "").slice(0, 100);
  const english = params.get("locale") === "en";

  const url = new URL(`${KLIPY_BASE}/${q ? "search" : "featured"}`);
  if (q) url.searchParams.set("q", q);
  url.searchParams.set("key", key);
  url.searchParams.set("client_key", "ambra-chat");
  url.searchParams.set("limit", String(PAGE_SIZE));
  url.searchParams.set("contentfilter", "medium");
  url.searchParams.set("media_filter", "tinygif,nanogif,mediumgif,gif,tinymp4,mp4,nanomp4");
  url.searchParams.set("locale", english ? "en_US" : "pl_PL");
  url.searchParams.set("country", english ? "US" : "PL");
  if (pos) url.searchParams.set("pos", pos);

  try {
    const response = await fetch(url, { next: { revalidate: CACHE_SECONDS } });
    if (!response.ok) {
      console.error("[api/chat/gifs] provider answered", response.status);
      return json({ error: response.status === 429 ? "rate_limited" : "failed" }, 502);
    }
    return json(parseGifResponse(await response.json()), 200, "private, max-age=300");
  } catch (error) {
    console.error("[api/chat/gifs] provider request failed", error);
    return json({ error: "failed" }, 502);
  }
}
