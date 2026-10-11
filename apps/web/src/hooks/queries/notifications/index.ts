"use client";

import { useCallback, useEffect, useRef } from "react";
import {
  useInfiniteQuery,
  useQuery,
  useQueryClient,
  type QueryClient,
} from "@tanstack/react-query";
import {
  getUnreadNotificationsCountAction,
  listNotificationsAction,
  markAllNotificationsReadAction,
  setNotificationsReadAction,
} from "@/app/actions/notifications";
import {
  flattenNotifications,
  prependNotification,
  setReadInList,
  type NotificationsInfiniteData,
} from "@/lib/notifications/cache";
import {
  NOTIFICATIONS_UNREAD_CAP,
  type AppNotification,
  type NotificationCursor,
  type NotificationFilter,
  type NotificationsPage,
} from "@/lib/notifications/types";
import { createClient } from "@/utils/supabase/client";

const FILTERS: NotificationFilter[] = ["all", "unread", "assigned"];

export const notificationsKeys = {
  all: ["notifications"] as const,
  list: (orgId: string, filter: NotificationFilter) =>
    ["notifications", "list", orgId, filter] as const,
  unread: (orgId: string) => ["notifications", "unread", orgId] as const,
};

export function useNotifications(
  orgId: string | null | undefined,
  filter: NotificationFilter,
  enabled = true
) {
  const query = useInfiniteQuery({
    queryKey: notificationsKeys.list(orgId ?? "", filter),
    queryFn: async ({ pageParam }): Promise<NotificationsPage> => {
      const result = await listNotificationsAction({
        filter,
        before: (pageParam as NotificationCursor | null) ?? null,
      });
      if (!result.success) throw new Error((result as { error: string }).error);
      return result.data;
    },
    initialPageParam: null as NotificationCursor | null,
    getNextPageParam: (lastPage) => lastPage.nextCursor,
    enabled: !!orgId && enabled,
    staleTime: 30_000,
  });
  return {
    ...query,
    notifications: flattenNotifications(query.data as NotificationsInfiniteData | undefined),
  };
}

export function useUnreadNotificationsCount(orgId: string | null | undefined) {
  return useQuery({
    queryKey: notificationsKeys.unread(orgId ?? ""),
    queryFn: async (): Promise<number> => {
      const result = await getUnreadNotificationsCountAction();
      if (!result.success) throw new Error((result as { error: string }).error);
      return result.data;
    },
    enabled: !!orgId,
    staleTime: 60_000,
  });
}

function patchLists(
  queryClient: QueryClient,
  orgId: string,
  patch: (
    data: NotificationsInfiniteData | undefined,
    filter: NotificationFilter
  ) => NotificationsInfiniteData | undefined
) {
  for (const filter of FILTERS) {
    queryClient.setQueryData<NotificationsInfiniteData>(
      notificationsKeys.list(orgId, filter),
      (data) => patch(data, filter)
    );
  }
}

/** Read / unread toggle and "mark all", applied to the cache first */
export function useNotificationReadActions(orgId: string | null | undefined) {
  const queryClient = useQueryClient();

  const setRead = useCallback(
    async (notification: AppNotification, read: boolean) => {
      if (!orgId || (notification.read_at !== null) === read) return;
      const now = new Date().toISOString();
      patchLists(queryClient, orgId, (data, filter) =>
        setReadInList(data, [notification.id], read, now, filter === "unread")
      );
      queryClient.setQueryData<number>(notificationsKeys.unread(orgId), (count) =>
        Math.max((count ?? 0) + (read ? -1 : 1), 0)
      );
      const result = await setNotificationsReadAction({ ids: [notification.id], read });
      // A row marked unread belongs in the "unread" list again; on failure reload all
      if (!result.success || !read) {
        void queryClient.invalidateQueries({ queryKey: notificationsKeys.all });
      }
    },
    [orgId, queryClient]
  );

  const markAllRead = useCallback(async () => {
    if (!orgId) return;
    const now = new Date().toISOString();
    patchLists(queryClient, orgId, (data, filter) =>
      setReadInList(data, null, true, now, filter === "unread")
    );
    queryClient.setQueryData<number>(notificationsKeys.unread(orgId), 0);
    const result = await markAllNotificationsReadAction();
    if (!result.success) void queryClient.invalidateQueries({ queryKey: notificationsKeys.all });
  }, [orgId, queryClient]);

  return { setRead, markAllRead };
}

/**
 * Live notifications: private broadcast "user:<uid>:notifications" sent by a
 * database trigger. New rows go into the cached lists and the unread count;
 * a re-join after a dropped connection reloads (events sent meanwhile are lost).
 */
export function useNotificationsRealtime(
  orgId: string | null | undefined,
  userId: string | null | undefined,
  onNew: (notification: AppNotification) => void
) {
  const queryClient = useQueryClient();
  const onNewRef = useRef(onNew);
  useEffect(() => {
    onNewRef.current = onNew;
  }, [onNew]);

  useEffect(() => {
    if (!orgId || !userId) return;
    const supabase = createClient();
    const topic = `user:${userId}:notifications`;
    let active = true;
    let joined = false;
    let channel: ReturnType<typeof supabase.channel> | null = null;

    void (async () => {
      // Session to Realtime first, or the private join is rejected
      await supabase.realtime.setAuth().catch(() => undefined);
      // supabase-js hands back an existing channel with the same topic
      const stale = supabase.getChannels().find((item) => item.topic === `realtime:${topic}`);
      if (stale) await supabase.removeChannel(stale);
      if (!active) return;

      channel = supabase
        .channel(topic, { config: { private: true } })
        .on("broadcast", { event: "notification" }, ({ payload }) => {
          const notification = payload as AppNotification;
          if (!notification?.id || notification.organization_id !== orgId) return;
          patchLists(queryClient, orgId, (data, filter) =>
            filter === "assigned" ? data : prependNotification(data, notification)
          );
          void queryClient.invalidateQueries({
            queryKey: notificationsKeys.list(orgId, "assigned"),
          });
          queryClient.setQueryData<number>(notificationsKeys.unread(orgId), (count) =>
            Math.min((count ?? 0) + 1, NOTIFICATIONS_UNREAD_CAP)
          );
          onNewRef.current(notification);
        })
        .subscribe((status) => {
          if (status !== "SUBSCRIBED") return;
          if (joined) void queryClient.invalidateQueries({ queryKey: notificationsKeys.all });
          joined = true;
        });
    })();

    return () => {
      active = false;
      if (channel) void supabase.removeChannel(channel);
    };
  }, [orgId, queryClient, userId]);
}
