"use client";

import { useCallback, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { Bell, CheckCheck, ExternalLink, SlidersHorizontal } from "lucide-react";
import { toast } from "react-toastify";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { Link, useRouter } from "@/i18n/navigation";
import { toUnsafeI18nHref } from "@/lib/i18n/unsafe-href";
import { cn } from "@/lib/utils";
import {
  useNotificationReadActions,
  useNotificationsRealtime,
  useUnreadNotificationsCount,
} from "@/hooks/queries/notifications";
import {
  NOTIFICATION_FILTERS,
  notificationRoute,
  type AppNotification,
  type NotificationFilter,
} from "@/lib/notifications/types";
import { useAppStoreV2 } from "@/lib/stores/v2/app-store";
import { useUserStoreV2 } from "@/lib/stores/v2/user-store";
import { NotificationList } from "@/components/v2/notifications/notification-list";
import { describeNotification } from "@/components/v2/notifications/notification-text";

const FILTERS = NOTIFICATION_FILTERS;

/**
 * Bell in the header with the notifications drawer.
 *
 * The count and the list are live (private Realtime channel fed by database
 * triggers). A new notification shows a toast unless the drawer is open.
 * Chat messages are a separate module and never appear here.
 */
export function HeaderNotifications() {
  const t = useTranslations("notificationCenter");
  const router = useRouter();
  const orgId = useAppStoreV2((s) => s.activeOrgId);
  const userId = useUserStoreV2((s) => s.user?.id ?? null);
  const [open, setOpen] = useState(false);
  const [filter, setFilter] = useState<NotificationFilter>("all");
  const openRef = useRef(open);
  openRef.current = open;
  const unread = useUnreadNotificationsCount(orgId).data ?? 0;
  const { setRead, markAllRead } = useNotificationReadActions(orgId);

  const onNew = useCallback(
    (notification: AppNotification) => {
      if (openRef.current) return;
      const { actor, text, icon: Icon } = describeNotification(notification, t);
      const route = notificationRoute(notification);
      const title =
        notification.title ||
        (notification.target_type === "chat.conversation" ? t("directConversation") : "");
      toast(
        ({ closeToast }) => (
          <div className="flex gap-2.5" data-testid="notification-toast">
            <span className="mt-0.5 flex size-7 shrink-0 items-center justify-center rounded bg-primary/15 text-primary">
              <Icon className="size-4" />
            </span>
            <div className="min-w-0 flex-1">
              <p className="text-xs leading-[17px] text-foreground">
                <span className="font-semibold">{actor}</span> {text}
              </p>
              <p className="truncate text-[11px] text-muted-foreground">
                {notification.target_code ? (
                  <span className="font-mono">{notification.target_code} · </span>
                ) : null}
                {title}
              </p>
              <div className="mt-1.5 flex gap-1.5">
                {route ? (
                  <button
                    type="button"
                    onClick={() => {
                      void setRead(notification, true);
                      router.push(
                        route.query
                          ? { pathname: toUnsafeI18nHref(route.pathname), query: route.query }
                          : toUnsafeI18nHref(route.pathname)
                      );
                      closeToast();
                    }}
                    className="h-6 rounded bg-foreground px-2 text-[11px] font-medium text-background"
                  >
                    {t("toast.open")}
                  </button>
                ) : null}
                <button
                  type="button"
                  onClick={() => {
                    void setRead(notification, true);
                    closeToast();
                  }}
                  className="h-6 rounded border px-2 text-[11px] text-foreground/80"
                >
                  {t("toast.markRead")}
                </button>
              </div>
            </div>
          </div>
        ),
        { icon: false, autoClose: 8000, closeOnClick: false }
      );
    },
    [router, setRead, t]
  );

  useNotificationsRealtime(orgId, userId, onNew);

  if (!orgId) return null;

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <Button variant="ghost" size="icon" className="relative h-9 w-9" aria-label={t("open")}>
          <Bell className="h-5 w-5" />
          {unread > 0 ? (
            <span
              className="absolute right-0.5 top-0.5 flex h-4 min-w-4 items-center justify-center rounded bg-amber-700 px-1 text-[10px] font-bold leading-none text-white"
              data-testid="notifications-count"
            >
              {unread > 9 ? "9+" : unread}
            </span>
          ) : null}
        </Button>
      </SheetTrigger>
      <SheetContent side="right" className="flex w-full flex-col gap-0 p-0 sm:max-w-sm">
        <SheetHeader className="space-y-0.5 border-b px-3 py-3 text-left">
          <div className="flex items-center gap-2 pr-8">
            <SheetTitle className="text-sm font-semibold">{t("title")}</SheetTitle>
            {unread > 0 ? (
              <span className="rounded bg-primary/15 px-1.5 py-px text-[11px] font-semibold text-primary">
                {t("newCount", { count: unread > 99 ? "99+" : unread })}
              </span>
            ) : null}
            <span className="flex-1" />
            <button
              type="button"
              onClick={() => void markAllRead()}
              disabled={unread === 0}
              className="flex h-7 items-center gap-1 rounded-md px-1.5 text-[11px] text-foreground/80 hover:bg-muted disabled:opacity-40"
            >
              <CheckCheck className="size-3.5" />
              {t("markAll")}
            </button>
          </div>
          <SheetDescription className="text-xs">{t("description")}</SheetDescription>
        </SheetHeader>

        <div role="tablist" aria-label={t("tabsLabel")} className="flex border-b px-1.5">
          {FILTERS.map((item) => (
            <button
              key={item}
              type="button"
              role="tab"
              aria-selected={filter === item}
              onClick={() => setFilter(item)}
              className={cn(
                "relative flex h-8 items-center gap-1 px-2 text-xs",
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

        <div className="min-h-0 flex-1 overflow-y-auto" data-testid="notifications-drawer-list">
          <NotificationList
            orgId={orgId}
            filter={filter}
            enabled={open}
            onNavigate={() => setOpen(false)}
          />
        </div>

        <div className="flex items-center justify-between gap-2 border-t px-3 py-2 text-xs">
          <Link
            href="/dashboard/account/notifications"
            onClick={() => setOpen(false)}
            className="flex items-center gap-1.5 text-foreground/80 hover:underline"
          >
            <SlidersHorizontal className="size-3.5" />
            {t("settings")}
          </Link>
          <Link
            href="/dashboard/notifications"
            onClick={() => setOpen(false)}
            className="flex items-center gap-1 font-medium text-primary hover:underline"
          >
            {t("allNotifications")}
            <ExternalLink className="size-3" />
          </Link>
        </div>
      </SheetContent>
    </Sheet>
  );
}
