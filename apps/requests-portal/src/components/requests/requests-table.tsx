"use client";

import { MessageSquare } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import { formatWhen } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { RequestListItem } from "@/server/requests/types";
import { AvatarStack } from "./avatar";
import { AttentionDot, StatusBadge } from "./status";
import { TypeLabel } from "./type-label";

/**
 * Desktop list. With the request panel open it keeps the essentials only (number and
 * title, status, comments, last change). The whole row opens the request.
 */
export function RequestsTable({
  items,
  selectedId,
  compact,
  query,
  onPrefetch,
}: {
  items: RequestListItem[];
  selectedId: string | undefined;
  compact: boolean;
  query: Record<string, string>;
  onPrefetch: (id: string) => void;
}) {
  const t = useTranslations("requests");
  const locale = useLocale();
  const when = (iso: string) =>
    formatWhen(iso, locale, { today: t("today"), yesterday: t("yesterday") });
  const th = "h-10 px-4 text-left align-middle text-xs font-medium text-muted-foreground";

  return (
    <table className="w-full table-fixed border-collapse text-sm">
      <thead className="sticky top-0 z-[1] bg-card">
        <tr className="border-b">
          <th className={cn(th, "pl-6")}>{t("table.request")}</th>
          <th className={cn(th, "w-[170px]")}>{t("table.status")}</th>
          {!compact && <th className={cn(th, "w-[190px]")}>{t("table.type")}</th>}
          {!compact && <th className={cn(th, "w-[160px]")}>{t("table.order")}</th>}
          {!compact && <th className={cn(th, "w-[130px]")}>{t("table.responders")}</th>}
          <th className={cn(th, "w-[64px]")}>
            <span className="sr-only">{t("table.comments")}</span>
          </th>
          <th className={cn(th, "w-[140px] pr-6")}>{t("table.updated")}</th>
        </tr>
      </thead>
      <tbody>
        {items.map((item) => {
          const selected = item.id === selectedId;
          return (
            <tr
              key={item.id}
              onPointerEnter={() => onPrefetch(item.id)}
              className={cn(
                "relative border-b transition-colors hover:bg-muted/60",
                selected &&
                  "bg-primary/10 shadow-[inset_3px_0_0_var(--primary)] hover:bg-primary/10"
              )}
            >
              <td className="py-3 pl-6 pr-4">
                <Link
                  href={{ pathname: "/[ticketId]", params: { ticketId: item.id }, query }}
                  aria-current={selected ? "page" : undefined}
                  onFocus={() => onPrefetch(item.id)}
                  className="flex min-w-0 flex-col gap-0.5 outline-none after:absolute after:inset-0 focus-visible:after:ring-2 focus-visible:after:ring-inset focus-visible:after:ring-ring"
                >
                  <span className="flex items-center gap-2 font-mono text-xs text-muted-foreground">
                    {item.number}
                    {item.state === "yourTurn" && <AttentionDot />}
                  </span>
                  <span className="truncate font-medium" title={item.title}>
                    {item.title}
                  </span>
                </Link>
              </td>
              <td className="px-4 py-3">
                <StatusBadge state={item.state} />
              </td>
              {!compact && (
                <td className="px-4 py-3">
                  <TypeLabel type={item.type} />
                </td>
              )}
              {!compact && (
                <td className="truncate px-4 py-3 font-mono text-[13px]">
                  {item.order ? (
                    (item.order.zlNumber ?? `${item.order.orderNumber}/${item.order.warehouse}`)
                  ) : (
                    <span className="text-muted-foreground">—</span>
                  )}
                </td>
              )}
              {!compact && (
                <td className="px-4 py-3">
                  {item.responders.length ? (
                    <AvatarStack people={item.responders} size={26} />
                  ) : (
                    <span className="text-[13px] text-muted-foreground">{t("queueShort")}</span>
                  )}
                </td>
              )}
              <td className="px-4 py-3">
                <span
                  className={cn(
                    "inline-flex items-center gap-1.5 text-[13px] text-muted-foreground",
                    item.commentCount === 0 && "opacity-60"
                  )}
                  aria-label={t("comments", { count: item.commentCount })}
                >
                  <MessageSquare className="h-3.5 w-3.5" />
                  {item.commentCount}
                </span>
              </td>
              <td className="whitespace-nowrap py-3 pl-4 pr-6 text-[13px] text-muted-foreground">
                {when(item.updatedAt)}
              </td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}
