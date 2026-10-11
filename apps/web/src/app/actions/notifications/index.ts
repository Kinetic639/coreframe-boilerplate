"use server";

import { z } from "zod";
import { createClient } from "@/utils/supabase/server";
import { loadDashboardContextV2 } from "@/server/loaders/v2/load-dashboard-context.v2";
import { NotificationsService } from "@/server/services/notifications.service";
import type { NotificationCursor, NotificationsPage } from "@/lib/notifications/types";

type ActionResult<T> = { success: true; data: T } | { success: false; error: string };

const uuid = z.string().uuid();
const listSchema = z.object({
  filter: z.enum(["all", "unread", "assigned"]).optional(),
  before: z.object({ createdAt: z.string().datetime({ offset: true }), id: uuid }).nullish(),
});
const setReadSchema = z.object({ ids: z.array(uuid).min(1).max(100), read: z.boolean() });

/** Any signed-in member of the active organization; the database returns only their rows */
async function getContext() {
  const supabase = await createClient();
  const context = await loadDashboardContextV2();
  const orgId = context?.app.activeOrgId;
  if (!context?.user.user?.id || !orgId) return null;
  return { supabase, orgId };
}

async function run<T>(
  scope: string,
  fn: (
    ctx: NonNullable<Awaited<ReturnType<typeof getContext>>>
  ) => Promise<{ success: true; data: T } | { success: false; error: string }>
): Promise<ActionResult<T>> {
  try {
    const ctx = await getContext();
    if (!ctx) return { success: false, error: "Unauthorized" };
    const result = await fn(ctx);
    if (result.success) return result;
    console.error(`[notifications.${scope}]`, (result as { error: string }).error);
    return { success: false, error: "Failed" };
  } catch (error) {
    console.error(`[notifications.${scope}]`, error);
    return { success: false, error: "Failed" };
  }
}

export async function listNotificationsAction(
  rawInput: unknown = {}
): Promise<ActionResult<NotificationsPage>> {
  const parsed = listSchema.safeParse(rawInput);
  if (!parsed.success) return { success: false, error: "Invalid input" };
  return run("list", (ctx) =>
    NotificationsService.list(ctx.supabase, ctx.orgId, {
      filter: parsed.data.filter,
      // apps/web runs without strictNullChecks: zod's inferred fields are all optional
      before: (parsed.data.before ?? null) as NotificationCursor | null,
    })
  );
}

export async function getUnreadNotificationsCountAction(): Promise<ActionResult<number>> {
  return run("unreadCount", (ctx) => NotificationsService.unreadCount(ctx.supabase, ctx.orgId));
}

/** Marks notifications read or unread (the envelope button) */
export async function setNotificationsReadAction(rawInput: unknown): Promise<ActionResult<number>> {
  const parsed = setReadSchema.safeParse(rawInput);
  if (!parsed.success) return { success: false, error: "Invalid input" };
  return run("setRead", (ctx) =>
    NotificationsService.setRead(
      ctx.supabase,
      parsed.data.ids as string[],
      parsed.data.read as boolean
    )
  );
}

export async function markAllNotificationsReadAction(): Promise<ActionResult<number>> {
  return run("markAllRead", (ctx) => NotificationsService.markAllRead(ctx.supabase, ctx.orgId));
}
