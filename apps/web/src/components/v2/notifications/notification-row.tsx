"use client";

import { useLocale, useTranslations } from "next-intl";
import { Mail, MailOpen } from "lucide-react";
import { Link } from "@/i18n/navigation";
import { toUnsafeI18nHref } from "@/lib/i18n/unsafe-href";
import { cn } from "@/lib/utils";
import { formatNotificationTime } from "@/lib/notifications/cache";
import { notificationRoute, type AppNotification } from "@/lib/notifications/types";
import { describeNotification } from "./notification-text";

/**
 * One notification: what happened, the object (number + title), an excerpt for
 * comments, module and time. Clicking opens the object and marks it read. The
 * envelope on the right toggles read (open) / unread (closed) without opening.
 */
export function NotificationRow({
  notification,
  onOpen,
  onToggleRead,
}: {
  notification: AppNotification;
  onOpen: (notification: AppNotification) => void;
  onToggleRead: (notification: AppNotification, read: boolean) => void;
}) {
  const t = useTranslations("notificationCenter");
  const locale = useLocale();
  const { actor, text, module, icon: Icon } = describeNotification(notification, t);
  const unread = notification.read_at === null;
  const route = notificationRoute(notification);
  // A 1:1 conversation has no name of its own
  const title =
    notification.title ||
    (notification.target_type === "chat.conversation" ? t("directConversation") : "");
  const toggleLabel = unread ? t("markRead") : t("markUnread");

  const body = (
    <>
      <span
        className={cn(
          "mt-0.5 flex size-[26px] shrink-0 items-center justify-center rounded",
          unread ? "bg-primary/15 text-primary" : "bg-muted text-muted-foreground"
        )}
      >
        <Icon className="size-3.5" />
      </span>
      <span className="flex min-w-0 flex-1 flex-col gap-0.5">
        <span className="text-xs leading-[17px]">
          <span className="font-semibold">{actor}</span> {text}
        </span>
        <span className="flex min-w-0 items-center gap-1.5">
          {notification.target_code ? (
            <span className="shrink-0 rounded bg-muted px-1 font-mono text-[10px] leading-4 text-foreground/80">
              {notification.target_code}
            </span>
          ) : null}
          <span className="truncate text-[11px] text-foreground/80">{title}</span>
        </span>
        {notification.snippet ? (
          <span className="mt-0.5 line-clamp-2 rounded-md border bg-muted/40 px-2 py-1 text-[11px] leading-4 text-muted-foreground">
            {notification.snippet}
          </span>
        ) : null}
        <span className="text-[10px] text-muted-foreground">
          {module} · {formatNotificationTime(notification.created_at, locale)}
        </span>
      </span>
    </>
  );

  const bodyClass = "flex min-w-0 flex-1 gap-2.5 py-2 pl-3 pr-1 text-left";

  return (
    <li
      className={cn(
        "flex items-start border-b last:border-b-0",
        unread && "bg-amber-50/60 dark:bg-amber-950/20"
      )}
      data-testid="notification-row"
      data-unread={unread ? "true" : "false"}
    >
      {route ? (
        <Link
          href={
            route.query
              ? { pathname: toUnsafeI18nHref(route.pathname), query: route.query }
              : toUnsafeI18nHref(route.pathname)
          }
          onClick={() => onOpen(notification)}
          className={cn(
            bodyClass,
            "hover:bg-muted/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring"
          )}
        >
          {body}
        </Link>
      ) : (
        <div className={bodyClass}>{body}</div>
      )}
      <button
        type="button"
        onClick={() => onToggleRead(notification, unread)}
        aria-label={toggleLabel}
        aria-pressed={!unread}
        title={toggleLabel}
        className={cn(
          "m-1.5 flex size-7 shrink-0 items-center justify-center rounded-md hover:bg-muted",
          unread ? "text-primary" : "text-muted-foreground"
        )}
      >
        {unread ? <Mail className="size-4" /> : <MailOpen className="size-4" />}
      </button>
    </li>
  );
}
