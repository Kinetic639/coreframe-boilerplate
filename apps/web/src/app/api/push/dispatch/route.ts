import { timingSafeEqual } from "node:crypto";
import { NextResponse } from "next/server";
import { runPushDispatch, vapidConfig } from "@/server/notifications/push";
import { webPushSender } from "@/server/notifications/web-push-sender";
import { createServiceClient } from "@/utils/supabase/service";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

function authorized(request: Request): boolean {
  const secret = process.env.CRON_SECRET;
  // Without a configured secret the endpoint stays closed
  if (!secret || secret.length < 16) return false;
  const given = Buffer.from(request.headers.get("authorization") ?? "");
  const expected = Buffer.from(`Bearer ${secret}`);
  return given.length === expected.length && timingSafeEqual(given, expected);
}

/**
 * Sends what waits in the push queue. Called by the database right after a
 * notification or chat message is queued (pg_net, trigger `push_queue_kick`)
 * with `Authorization: Bearer $CRON_SECRET`, and by the e-mail cron as a
 * fallback.
 */
export async function POST(request: Request) {
  if (!authorized(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const vapid = vapidConfig();
  if (!vapid) {
    return NextResponse.json({ error: "Push is not configured" }, { status: 503 });
  }
  try {
    const result = await runPushDispatch(createServiceClient(), webPushSender(vapid));
    return NextResponse.json(result);
  } catch (error) {
    console.error("[push/dispatch]", error);
    return NextResponse.json({ error: "Failed" }, { status: 500 });
  }
}
