"use server";

import { createClient } from "@/utils/supabase/server";
import { getAuthUser } from "@/server/auth/get-auth-user";

export type HasNewActivityResult =
  | { success: true; data: { hasNew: boolean; checkedAt: string } }
  | { success: false; error: string };

/**
 * Cheap check for the status bar poll: is there a platform event about the
 * current user newer than `since`?
 *
 * One query, without the dashboard context. The full refresh
 * (getLatestActivityAction) loads the context, the user's org events, their
 * auth events with the service client and the names in the events: about four
 * requests. The status bar polls every two minutes and on every window focus,
 * and almost every tick finds nothing new, so it asks this first and runs the
 * full refresh only when the answer is yes.
 *
 * The user comes from the verified token. RLS on platform_events limits rows to
 * organizations the user belongs to; the filter matches what the personal feed
 * reads (actor, or the event's entity or target is the user). Events in another
 * organization, or ones the feed then hides, only cause an extra full refresh.
 * Auth events without an organization (sign-in) are not seen here; the full
 * refresh on the next change or page load picks them up.
 *
 * `checkedAt` is the server time of this check; the client sends it back as
 * the next `since` after a full refresh, so its own clock does not matter.
 */
export async function hasNewActivityAction(since: string): Promise<HasNewActivityResult> {
  const checkedAt = new Date().toISOString();

  const sinceDate = new Date(since);
  if (typeof since !== "string" || Number.isNaN(sinceDate.getTime())) {
    return { success: false, error: "Invalid date" };
  }

  const {
    data: { user },
  } = await getAuthUser();
  if (!user) return { success: false, error: "Unauthorized" };

  const supabase = await createClient();
  const orFilter = [
    `actor_user_id.eq.${user.id}`,
    `and(entity_type.eq.user,entity_id.eq.${user.id})`,
    `and(target_type.eq.user,target_id.eq.${user.id})`,
  ].join(",");

  // platform_events is not in the generated DB types (see _query.ts)
  const { data, error } = await (supabase as any)
    .from("platform_events")
    .select("id")
    .gt("created_at", sinceDate.toISOString())
    .or(orFilter)
    .limit(1);

  if (error) {
    console.error("[hasNewActivityAction] Query failed", { error });
    return { success: false, error: "Failed to check activity" };
  }

  return { success: true, data: { hasNew: (data ?? []).length > 0, checkedAt } };
}
