"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { CheckCheck, SlidersHorizontal } from "lucide-react";
import { Link } from "@/i18n/navigation";
import { cn } from "@/lib/utils";
import {
  useNotificationReadActions,
  useUnreadNotificationsCount,
} from "@/hooks/queries/notifications";
import { NOTIFICATION_FILTERS, type NotificationFilter } from "@/lib/notifications/types";
import { NotificationList } from "@/components/v2/notifications/notification-list";

const FILTERS = NOTIFICATION_FILTERS;

/** Full list of notifications: the same rows as the drawer, with more room */
export function NotificationsPageClient({ orgId }: { orgId: string }) {
  const t = useTranslations("notificationCenter");
  const [filter, setFilter] = useState<NotificationFilter>("all");
  const unread = useUnreadNotificationsCount(orgId).data ?? 0;
  const { markAllRead } = useNotificationReadActions(orgId);

  return (
    <div className="mx-auto w-full max-w-3xl" data-testid="notifications-page">
      <div className="flex flex-wrap items-center gap-2">
        <div className="min-w-0 flex-1">
          <h1 className="text-base font-semibold">{t("page.title")}</h1>
          <p className="text-xs text-muted-foreground">{t("page.subtitle")}</p>
        </div>
        <Link
          href="/dashboard/account/notifications"
          className="flex h-8 items-center gap-1.5 rounded-md border px-2 text-xs hover:bg-muted"
        >
          <SlidersHorizontal className="size-3.5" />
          {t("settings")}
        </Link>
        <button
          type="button"
          onClick={() => void markAllRead()}
          disabled={unread === 0}
          className="flex h-8 items-center gap-1.5 rounded-md border px-2 text-xs hover:bg-muted disabled:opacity-40"
        >
          <CheckCheck className="size-3.5" />
          {t("markAll")}
        </button>
      </div>

      <div className="mt-3 overflow-hidden rounded-md border bg-card">
        <div role="tablist" aria-label={t("tabsLabel")} className="flex border-b px-1.5">
          {FILTERS.map((item) => (
            <button
              key={item}
              type="button"
              role="tab"
              aria-selected={filter === item}
              onClick={() => setFilter(item)}
              className={cn(
                "relative flex h-9 items-center gap-1 px-2.5 text-xs",
                "after:absolute after:inset-x-1.5 after:-bottom-px after:h-0.5 after:rounded-full",
                filter === item
                  ? "font-semibold text-foreground after:bg-primary"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              {t(`tabs.${item}`)}
              {item === "unread" && unread > 0 ? (
                <span className="text-[10px] font-normal text-muted-foreground">
                  {unread > 99 ? "99+" : unread}
                </span>
              ) : null}
            </button>
          ))}
        </div>
        <NotificationList orgId={orgId} filter={filter} />
      </div>
    </div>
  );
}
