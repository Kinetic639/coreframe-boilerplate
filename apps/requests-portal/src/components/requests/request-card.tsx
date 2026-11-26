import { MessageSquare } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import { formatWhen } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { RequestListItem } from "@/server/requests/types";
import { AttentionDot, StatusBadge } from "./status";
import { TypeLabel } from "./type-label";

/** Phone list card: status and time, title, number · type and comments, repair order. */
export function RequestCard({
  item,
  query,
  onPrefetch,
}: {
  item: RequestListItem;
  query?: Record<string, string>;
  onPrefetch?: (id: string) => void;
}) {
  const t = useTranslations("requests");
  const locale = useLocale();
  const yourTurn = item.state === "yourTurn";
  return (
    <Link
      href={{ pathname: "/[ticketId]", params: { ticketId: item.id }, query }}
      onPointerDown={() => onPrefetch?.(item.id)}
      onFocus={() => onPrefetch?.(item.id)}
      className={cn(
        "flex flex-col gap-2 rounded-lg border bg-card p-4 text-card-foreground shadow-sm transition-colors active:bg-muted/60",
        yourTurn && "border-orange-300 dark:border-orange-500/50"
      )}
    >
      <div className="flex items-center gap-2">
        <StatusBadge state={item.state} />
        <span className="flex-1" />
        {yourTurn && <AttentionDot />}
        <span className="shrink-0 text-[13px] text-muted-foreground">
          {formatWhen(item.updatedAt, locale, { today: t("today"), yesterday: t("yesterday") })}
        </span>
      </div>
      <p className="line-clamp-2 text-base font-semibold leading-snug">{item.title}</p>
      <div className="flex items-center gap-3 text-[13px] text-muted-foreground">
        <span className="font-mono">{item.number}</span>
        <TypeLabel type={item.type} className="text-[13px] text-muted-foreground" />
        <span className="flex-1" />
        <span
          className="inline-flex items-center gap-1.5"
          aria-label={t("comments", { count: item.commentCount })}
        >
          <MessageSquare className="h-3.5 w-3.5" />
          {item.commentCount}
        </span>
      </div>
      {item.order && (
        <p className="font-mono text-[13px] text-muted-foreground">
          {item.order.zlNumber ?? `${item.order.orderNumber}/${item.order.warehouse}`}
        </p>
      )}
    </Link>
  );
}
