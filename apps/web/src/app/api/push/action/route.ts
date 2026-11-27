import { NextResponse } from "next/server";
import { z } from "zod";
import { ChatService } from "@/server/services/chat.service";
import { NotificationsService } from "@/server/services/notifications.service";
import { createClient } from "@/utils/supabase/server";

export const dynamic = "force-dynamic";

const schema = z.union([
  z.object({ notificationId: z.string().uuid() }),
  z.object({ conversationId: z.string().uuid(), until: z.string().datetime({ offset: true }) }),
]);

/**
 * "Mark as read" pressed on a system notification. Called by the service
 * worker with the user's session cookie; the RPCs act only for that user.
 */
export async function POST(request: Request) {
  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Invalid" }, { status: 400 });

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const input = parsed.data as { notificationId?: string; conversationId?: string; until?: string };
  const result = input.notificationId
    ? await NotificationsService.setRead(supabase, [input.notificationId], true)
    : await ChatService.markRead(supabase, input.conversationId ?? "", input.until ?? null);
  if (!result.success) return NextResponse.json({ error: "Failed" }, { status: 500 });
  return NextResponse.json({ ok: true });
}
