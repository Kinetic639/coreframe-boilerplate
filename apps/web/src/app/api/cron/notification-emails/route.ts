import { timingSafeEqual } from "node:crypto";
import { NextResponse } from "next/server";
import { runChatEmails, runNotificationEmails } from "@/server/notifications/email-digest";
import { EmailService } from "@/server/services/email.service";
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
 * Sends e-mail for notifications still unread after ten minutes and for chat
 * messages still unread after fifteen. Called every
 * few minutes by the database scheduler (pg_cron + pg_net, see
 * docs/NOTIFICATIONS_CRON_SETUP.md) with `Authorization: Bearer $CRON_SECRET`.
 */
export async function POST(request: Request) {
  if (!authorized(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  try {
    const email = new EmailService();
    const supabase = createServiceClient();
    const send = (options: Parameters<EmailService["sendEmail"]>[0]) => email.sendEmail(options);
    const notifications = await runNotificationEmails(supabase, send);
    // Unread chat messages: a separate queue, the same schedule
    const chat = await runChatEmails(supabase, send);
    return NextResponse.json({ notifications, chat });
  } catch (error) {
    console.error("[cron/notification-emails]", error);
    return NextResponse.json({ error: "Failed" }, { status: 500 });
  }
}
