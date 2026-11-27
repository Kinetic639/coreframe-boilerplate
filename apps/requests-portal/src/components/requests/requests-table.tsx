"use client";

import type { ReactNode } from "react";
import { ExternalLink, Eye, MessageSquare } from "lucide-react";
import { useLocale } from "next-intl";
import type { ColumnLayout, ColumnSet, ColumnWidths } from "@/components/data-table/columns";
import { ListPane, type ListSort } from "@/components/data-table/list-pane";
import { RowActionLink, RowActions } from "@/components/data-table/row-actions";
import { cn } from "@/lib/utils";
import type { RequestListItem } from "@/server/requests/types";
import { Avatar, AvatarStack } from "./avatar";
import { StatusBadge } from "./status";

/** Page sizes in the order the pagination offers them. */
const SIZES = [20, 50, 100] as const;

const orderText = (item: RequestListItem) =>
  item.order ? (item.order.zlNumber ?? `${item.order.orderNumber}/${item.order.warehouse}`) : null;

/**
 * The requests list on the ERP data table: the same columns, look, narrow list beside an
 * open request and phone cards as the Help Desk tickets list. The shell owns the address;
 * every link here is one it builds.
 */
export function RequestsTable({
  rows,
  totalCount,
  page,
  size,
  selected,
  set,
  layout,
  widths,
  cookie,
  labels,
  branchNames,
  empty,
  loading,
  refreshing,
  error,
  onRetry,
  onLayoutChange,
  rowHref,
  fullHref,
  pageHref,
  sizeHref,
  sortOf,
  onPrefetch,
}: {
  rows: RequestListItem[];
  totalCount: number;
  page: number;
  size: number;
  selected: string | null;
  set: ColumnSet<string>;
  layout: ColumnLayout;
  widths: ColumnWidths;
  cookie: string;
  labels: Record<string, string>;
  branchNames: Record<string, string>;
  empty: string;
  loading: boolean;
  refreshing: boolean;
  error: string | null;
  onRetry: () => void;
  onLayoutChange: (layout: ColumnLayout) => void;
  rowHref: (row: RequestListItem) => string;
  fullHref: (row: RequestListItem) => string;
  pageHref: (page: number) => string;
  sizeHref: (size: number) => string;
  sortOf: (columnId: string) => ListSort | undefined;
  onPrefetch: (id: string | null) => void;
}) {
  const locale = useLocale();
  const date = (iso: string) => (
    <span className="text-xs text-muted-foreground">
      {new Intl.DateTimeFormat(locale, { dateStyle: "short", timeStyle: "short" }).format(
        new Date(iso)
      )}
    </span>
  );

  const value = (row: RequestListItem, id: string): ReactNode => {
    switch (id) {
      case "ticket_type":
        return row.type ? (
          <span className="inline-flex min-w-0 items-center gap-1.5">
            <span
              className="size-2 shrink-0 rounded-full"
              style={{ backgroundColor: row.type.color || "#6366f1" }}
            />
            <span className="truncate">{row.type.name}</span>
          </span>
        ) : (
          "—"
        );
      case "status":
        return <StatusBadge state={row.state} variant="outline" />;
      case "order":
        return orderText(row) ? <span className="font-mono">{orderText(row)}</span> : "—";
      case "branch":
        return row.branchId ? (branchNames[row.branchId] ?? "—") : "—";
      case "acceptance":
        return row.state === "approval" ? (
          <span className="inline-flex rounded bg-amber-500/10 px-1.5 py-0.5 text-[11px] text-amber-700 dark:text-amber-400">
            {labels.acceptancePending}
          </span>
        ) : (
          "—"
        );
      case "requester":
        return row.requester ? <Avatar person={row.requester} size={24} /> : "—";
      case "responders":
        return row.responders.length ? (
          <AvatarStack people={row.responders} size={24} />
        ) : (
          <span className="text-xs text-muted-foreground">{labels.queue}</span>
        );
      case "created_at":
        return date(row.createdAt);
      case "updated_at":
        return date(row.updatedAt);
      default:
        return "—";
    }
  };
  // The phone card is one link: people show as names there.
  const plainValue = (row: RequestListItem, id: string): ReactNode => {
    if (id === "requester") return row.requester?.name ?? "—";
    if (id === "responders") {
      return row.responders.length ? row.responders.map((p) => p.name).join(", ") : labels.queue;
    }
    return value(row, id);
  };

  const identity = (row: RequestListItem) => (
    <span className="min-w-0">
      <span className="block truncate text-[13px] font-medium" title={row.title}>
        {row.title}
      </span>
      <span className="flex items-center gap-2 text-[11px] leading-4 font-normal text-muted-foreground">
        <span className="truncate font-mono">{row.number}</span>
        {row.commentCount ? (
          <span
            className="inline-flex shrink-0 items-center gap-0.5 tabular-nums"
            title={labels.comments}
          >
            <MessageSquare className="size-3" aria-hidden />
            <span className="sr-only">{labels.comments}:</span>
            {row.commentCount}
          </span>
        ) : null}
      </span>
    </span>
  );

  const actions = (row: RequestListItem) => (
    <RowActions label={row.number}>
      <RowActionLink href={rowHref(row)} icon={<Eye className="size-4" />}>
        {labels.preview}
      </RowActionLink>
      <RowActionLink href={fullHref(row)} icon={<ExternalLink className="size-4" />}>
        {labels.viewFull}
      </RowActionLink>
    </RowActions>
  );

  return (
    <ListPane
      rows={rows}
      totalCount={totalCount}
      page={page}
      size={size}
      sizes={SIZES}
      selected={selected}
      rowKey={(row) => row.id}
      rowHref={rowHref}
      pageHref={pageHref}
      sizeHref={sizeHref}
      set={set}
      layout={layout}
      widths={widths}
      cookie={cookie}
      onLayoutChange={onLayoutChange}
      sortOf={sortOf}
      identity={identity}
      value={value}
      plainValue={plainValue}
      badge={(row) => <StatusBadge state={row.state} variant="outline" />}
      cardHidden={["status"]}
      actions={actions}
      cellClassName={(id) =>
        cn((id === "branch" || id === "ticket_type") && "text-muted-foreground")
      }
      labels={labels}
      empty={empty}
      loading={loading}
      refreshing={refreshing}
      error={error}
      onRetry={onRetry}
      onPrefetch={onPrefetch}
    />
  );
}
