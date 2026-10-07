import { Hash, MessageSquare, Warehouse, Wrench } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import { formatWhen, inkFor } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { RequestListItem } from "@/server/requests/types";
import { Avatar } from "./avatar";
import { STATE_STYLE, StateDot } from "./status";

const ICON = "h-[13px] w-[13px] shrink-0 text-stone-500";

/** Approved list card (design variant I, light): type · date / title / order meta · comments / avatar, tags · status. */
export function RequestCard({
  item,
  selected = false,
  query,
}: {
  item: RequestListItem;
  selected?: boolean;
  /** List query to keep when opening the request (desktop split view). */
  query?: Record<string, string>;
}) {
  const t = useTranslations("requests");
  const locale = useLocale();
  const state = STATE_STYLE[item.state];
  const label = (text: string) => (
    <span className="hidden text-stone-500 group-hover:inline">{text}</span>
  );

  return (
    <Link
      href={{ pathname: "/[ticketId]", params: { ticketId: item.id }, query }}
      aria-current={selected ? "page" : undefined}
      className={cn(
        "group flex flex-col gap-2.5 rounded-xl bg-white px-3.5 py-3 text-stone-900 ring-1 transition-shadow",
        selected
          ? "ring-[1.5px] ring-primary shadow-[0_6px_16px_-10px_rgba(161,92,7,.45)]"
          : "ring-stone-200 hover:shadow-[0_8px_20px_-12px_rgba(28,25,23,.28)] hover:ring-stone-300"
      )}
    >
      <div className="flex items-center gap-2 text-[10.5px]">
        <span
          className="min-w-0 truncate font-bold uppercase tracking-[.06em]"
          style={{ color: item.type ? inkFor(item.type.color) : "#57534E" }}
        >
          {item.type?.name ?? t("noType")}
        </span>
        <span className="flex-1" />
        <span className="shrink-0 whitespace-nowrap text-[11.5px] text-stone-500">
          {formatWhen(item.updatedAt, locale, { today: t("today"), yesterday: t("yesterday") })}
        </span>
      </div>

      <div
        title={item.title}
        className="truncate text-[15px] font-semibold leading-snug tracking-[-0.01em]"
      >
        {item.title}
      </div>

      <div className="flex flex-wrap items-center gap-x-3.5 gap-y-1.5 text-xs text-stone-700">
        {item.order ? (
          <>
            <span className="inline-flex items-center gap-1.5">
              <Wrench className={ICON} />
              {label(t("order"))}
              <span className="font-mono text-[11.5px] text-stone-900">
                {item.order.orderNumber}
              </span>
            </span>
            <span className="inline-flex items-center gap-1.5">
              <Warehouse className={ICON} />
              {label(t("warehouse"))}
              <span className="font-mono text-[11.5px] text-stone-900">{item.order.warehouse}</span>
            </span>
          </>
        ) : (
          <span className="inline-flex items-center gap-1.5 text-stone-500">
            <Wrench className={ICON} />
            {t("noOrder")}
          </span>
        )}
        <span className="inline-flex items-center gap-1.5">
          <Hash className={ICON} />
          {label(t("number"))}
          <span className="font-mono text-[11px] text-stone-900">{item.number}</span>
        </span>
        <span className="flex-1" />
        {item.commentCount > 0 && (
          <span
            className="inline-flex items-center gap-1.5 text-stone-600"
            aria-label={t("comments", { count: item.commentCount })}
          >
            <MessageSquare className={ICON} />
            {item.commentCount}
          </span>
        )}
      </div>

      <div className="flex min-h-[22px] items-center gap-1.5 text-xs">
        <Avatar person={item.requester} size={22} className="mr-1" />
        <span className="flex-1" />
        <span className="inline-flex shrink-0 items-center gap-[7px] text-[11.5px]">
          <StateDot state={item.state} />
          <span className="font-semibold" style={{ color: state.text }}>
            {t(`state.${item.state}`)}
          </span>
        </span>
      </div>
    </Link>
  );
}
