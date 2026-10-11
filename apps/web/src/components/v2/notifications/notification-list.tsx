"use client";

import { useTranslations } from "next-intl";
import { CircleCheck, Loader2 } from "lucide-react";
import { useNotificationReadActions, useNotifications } from "@/hooks/queries/notifications";
import { notificationDayGroup } from "@/lib/notifications/cache";
import type { AppNotification, NotificationFilter } from "@/lib/notifications/types";
import { NotificationRow } from "./notification-row";

const GROUPS = ["today", "yesterday", "earlier"] as const;

/**
 * Notifications of one filter, grouped by day, with "earlier" paging and the
 * empty / error states. Shared by the header drawer and the full page.
 */
export function NotificationList({
  orgId,
  filter,
  enabled = true,
  onNavigate,
}: {
  orgId: string;
  filter: NotificationFilter;
  enabled?: boolean;
  /** Called when a notification is opened (the drawer closes itself) */
  onNavigate?: () => void;
}) {
  const t = useTranslations("notificationCenter");
  const list = useNotifications(orgId, filter, enabled);
  const { setRead } = useNotificationReadActions(orgId);

  const open = (notification: AppNotification) => {
    void setRead(notification, true);
    onNavigate?.();
  };

  if (list.isLoading) {
    return (
      <div className="flex justify-center py-10 text-muted-foreground">
        <Loader2 className="size-4 animate-spin" />
      </div>
    );
  }
  if (list.isError) {
    return (
      <div className="px-4 py-10 text-center text-xs text-muted-foreground">
        <p>{t("loadFailed")}</p>
        <button
          type="button"
          onClick={() => void list.refetch()}
          className="mt-1 text-primary underline"
        >
          {t("retry")}
        </button>
      </div>
    );
  }
  if (list.notifications.length === 0) {
    const empty = filter === "unread" ? "emptyUnread" : "empty";
    return (
      <div
        className="m-3 flex flex-col gap-1.5 border-y bg-muted/20 p-4"
        data-testid="notifications-empty"
      >
        <span className="mb-0.5 flex size-7 items-center justify-center rounded bg-primary/10 text-primary">
          <CircleCheck className="size-4" />
        </span>
        <p className="text-sm font-medium">{t(`${empty}.title`)}</p>
        <p className="text-xs leading-5 text-muted-foreground">{t(`${empty}.description`)}</p>
      </div>
    );
  }

  return (
    <div>
      {GROUPS.map((group) => {
        const items = list.notifications.filter(
          (notification) => notificationDayGroup(notification.created_at) === group
        );
        if (items.length === 0) return null;
        return (
          <section key={group}>
            <h3 className="px-3 pb-1 pt-3 text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
              {t(`groups.${group}`)}
            </h3>
            <ul className="border-t">
              {items.map((notification) => (
                <NotificationRow
                  key={notification.id}
                  notification={notification}
                  onOpen={open}
                  onToggleRead={(item, read) => void setRead(item, read)}
                />
              ))}
            </ul>
          </section>
        );
      })}
      {list.hasNextPage ? (
        <div className="flex justify-center py-3">
          <button
            type="button"
            onClick={() => void list.fetchNextPage()}
            disabled={list.isFetchingNextPage}
            className="flex items-center gap-1.5 text-[11px] text-muted-foreground hover:text-foreground"
          >
            {list.isFetchingNextPage ? <Loader2 className="size-3 animate-spin" /> : null}
            {t("loadMore")}
          </button>
        </div>
      ) : null}
    </div>
  );
}
