import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import type { ServiceResult } from "./organization.service";
import {
  NOTIFICATIONS_PAGE_SIZE,
  type AppNotification,
  type NotificationCursor,
  type NotificationFilter,
  type NotificationsPage,
} from "@/lib/notifications/types";

/**
 * Notifications of the signed-in user. Every call goes through an RPC that
 * filters by `auth.uid()`; rows are created only by database triggers.
 */
export class NotificationsService {
  static async list(
    supabase: SupabaseClient,
    orgId: string,
    options: {
      filter?: NotificationFilter;
      before?: NotificationCursor | null;
      limit?: number;
    } = {}
  ): Promise<ServiceResult<NotificationsPage>> {
    const limit = Math.min(Math.max(options.limit ?? NOTIFICATIONS_PAGE_SIZE, 1), 100);
    const { data, error } = await supabase.rpc("notifications_list", {
      p_org: orgId,
      p_filter: options.filter ?? "all",
      p_limit: limit + 1,
      p_before: options.before?.createdAt ?? null,
      p_before_id: options.before?.id ?? null,
    });
    if (error) return { success: false, error: error.message };

    const rows = (data ?? []) as AppNotification[];
    const page = rows.slice(0, limit);
    const last = page[page.length - 1];
    return {
      success: true,
      data: {
        notifications: page,
        nextCursor:
          rows.length > limit && last ? { createdAt: last.created_at, id: last.id } : null,
      },
    };
  }

  static async unreadCount(
    supabase: SupabaseClient,
    orgId: string
  ): Promise<ServiceResult<number>> {
    const { data, error } = await supabase.rpc("notifications_unread_count", { p_org: orgId });
    if (error) return { success: false, error: error.message };
    return { success: true, data: (data as number) ?? 0 };
  }

  static async setRead(
    supabase: SupabaseClient,
    ids: string[],
    read: boolean
  ): Promise<ServiceResult<number>> {
    const { data, error } = await supabase.rpc("notifications_set_read", {
      p_ids: ids,
      p_read: read,
    });
    if (error) return { success: false, error: error.message };
    return { success: true, data: (data as number) ?? 0 };
  }

  static async markAllRead(
    supabase: SupabaseClient,
    orgId: string
  ): Promise<ServiceResult<number>> {
    const { data, error } = await supabase.rpc("notifications_mark_all_read", { p_org: orgId });
    if (error) return { success: false, error: error.message };
    return { success: true, data: (data as number) ?? 0 };
  }
}
