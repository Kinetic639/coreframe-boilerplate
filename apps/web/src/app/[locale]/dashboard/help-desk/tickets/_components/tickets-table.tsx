import { ArrowDown, ArrowUp, ChevronsUpDown, ExternalLink, Eye } from "lucide-react";
import type { MouseEvent, ReactNode } from "react";
import { TableLink as PageLink } from "@/components/kolor-sensu/data-table/table-navigation";
import {
  DataTable,
  TablePagination,
  pageState,
  TD,
} from "@/components/kolor-sensu/data-table/data-table";
import { ColumnsMenu } from "@/components/kolor-sensu/data-table/columns-menu";
import {
  defaultLayout,
  type ColumnLayout,
  type ColumnSet,
  type ColumnWidths,
} from "@/components/kolor-sensu/data-table/columns";
import { RowActions, RowActionLink } from "@/components/kolor-sensu/row-actions";
import {
  TicketStatusBadge,
  type StatusBadgeConfig,
} from "@/components/help-desk/ticket-status-badge";
import {
  TicketPriorityBadge,
  type PriorityBadgeConfig,
} from "@/components/help-desk/ticket-priority-badge";
import { UserAvatar } from "@/components/primitives/avatar/user-avatar";
import {
  UserAvatarGroup,
  type UserAvatarGroupItem,
} from "@/components/primitives/avatar/user-avatar-group";
import type { HelpdeskTicketListRow } from "@/server/services/helpdesk-tickets.service";
import { cn } from "@/lib/utils";
import type { TicketList } from "./tickets-query";
import { ticketHref, TICKET_PAGE_SIZES, type TicketSort, type TicketState } from "./tickets-state";

/** Columns the list sorts by (each the ticket's own field). */
const SORT_FIELD: Record<string, TicketSort> = {
  status: "status",
  priority: "priority",
  created_at: "created_at",
  updated_at: "updated_at",
};

export function ticketColumnSet(labels: Record<string, string>): ColumnSet<string> {
  const ids = [
    "ticket_type",
    "status",
    "priority",
    "branch",
    "acceptance",
    "creator",
    "assignees",
    "created_at",
    "updated_at",
  ];
  return {
    ids,
    labels: {
      ticket_type: labels.type,
      status: labels.status,
      priority: labels.priority,
      branch: labels.branch,
      acceptance: labels.acceptance,
      creator: labels.createdBy,
      assignees: labels.responders,
      created_at: labels.createdAt,
      updated_at: labels.updatedAt,
    },
    widths: {
      ticket_type: 180,
      status: 180,
      priority: 120,
      branch: 160,
      acceptance: 170,
      creator: 90,
      assignees: 120,
      created_at: 140,
      updated_at: 140,
    },
    shownByDefault: [
      "ticket_type",
      "status",
      "priority",
      "branch",
      "acceptance",
      "creator",
      "assignees",
      "created_at",
    ],
    pinned: { id: "ticket", label: labels.ticket, width: 300 },
  };
}

export interface TicketBadgeConfigs {
  status: Record<string, StatusBadgeConfig> | null;
  priority: Record<string, PriorityBadgeConfig> | null;
}

export function TicketStatus({
  row,
  configs,
  label,
}: {
  row: Pick<HelpdeskTicketListRow, "status">;
  configs: TicketBadgeConfigs;
  label?: string;
}) {
  return (
    <TicketStatusBadge status={row.status} config={configs.status?.[row.status]} label={label} />
  );
}

function AssigneeAvatars({ assignees }: { assignees: HelpdeskTicketListRow["assignees"] }) {
  if (assignees.length === 0) return <span className="text-xs text-muted-foreground">—</span>;
  const users: UserAvatarGroupItem[] = assignees.map((a) => ({
    id: a.user_id,
    fullName: a.name ?? undefined,
    email: a.email ?? undefined,
    src: a.avatar_url ?? undefined,
    profileHref: a.profile_href ?? undefined,
  }));
  return <UserAvatarGroup users={users} max={3} size="sm" popoverSide="top" />;
}

export function HelpDeskTicketsTable({
  data,
  state,
  path,
  set,
  layout,
  widths,
  cookie,
  labels,
  configs,
  branchNames,
  ticketPath,
  error,
  loading,
  refreshing,
  onRetry,
  onLayoutChange,
  onPreview,
  onPrefetch,
}: {
  data: TicketList;
  state: TicketState;
  path: string;
  set: ColumnSet<string>;
  layout: ColumnLayout;
  widths: ColumnWidths;
  cookie: string;
  labels: Record<string, string>;
  configs: TicketBadgeConfigs;
  branchNames: Record<string, string>;
  ticketPath: (ticketNumber: string) => string;
  error: string | null;
  /** No rows yet (nothing cached for this address). */
  loading: boolean;
  /** Rows shown are the previous ones (or stale) while new ones come. */
  refreshing: boolean;
  onRetry: () => void;
  onLayoutChange: (layout: ColumnLayout) => void;
  onPreview: (ticketNumber: string | null) => void;
  /** A row the pointer rests on (null: it left), for its card's prefetch. */
  onPrefetch: (ticketNumber: string | null) => void;
}) {
  const shown = layout.filter((c) => c.shown).map((c) => c.id);
  const { page, pages, range } = pageState(
    { page: state.strona, size: state.wierszy },
    data.totalCount,
    data.rows.length
  );
  const href = (patch: Partial<TicketState>) => ticketHref(path, state, patch);
  const rowHref = (row: HelpdeskTicketListRow) =>
    href({ selected: state.selected === row.ticket_number ? null : row.ticket_number });
  const openPreview = (event: MouseEvent, row: HelpdeskTicketListRow) => {
    if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey)
      return;
    event.preventDefault();
    onPreview(state.selected === row.ticket_number ? null : row.ticket_number);
  };
  const sortOf = (field: TicketSort) => ({
    href: href({
      sort: field,
      direction: state.sort === field && state.direction === "asc" ? "desc" : "asc",
      strona: 1,
      selected: null,
    }),
    direction: state.sort === field ? state.direction : null,
  });
  const menu = (
    <ColumnsMenu
      cookie={cookie}
      defaults={defaultLayout(set)}
      labels={set.labels}
      layout={layout}
      onChange={onLayoutChange}
      pinnedLabel={set.pinned.label}
    />
  );
  const date = (value: string | null) =>
    value ? (
      <span className="text-xs text-muted-foreground">
        {new Date(value).toLocaleString(labels.locale, {
          dateStyle: "short",
          timeStyle: "short",
        })}
      </span>
    ) : (
      "—"
    );
  const actions = (row: HelpdeskTicketListRow) => (
    <RowActions label={row.ticket_number}>
      <RowActionLink href={rowHref(row)} icon={<Eye className="size-4" />}>
        {labels.preview}
      </RowActionLink>
      <RowActionLink
        href={ticketPath(row.ticket_number)}
        icon={<ExternalLink className="size-4" />}
      >
        {labels.viewFull}
      </RowActionLink>
    </RowActions>
  );
  const value = (row: HelpdeskTicketListRow, id: string): ReactNode => {
    switch (id) {
      case "ticket_type":
        return row.ticket_type_name ? (
          <span className="inline-flex min-w-0 items-center gap-1.5">
            <span
              className="size-2 shrink-0 rounded-full"
              style={{ backgroundColor: row.ticket_type_color ?? "#6366f1" }}
            />
            <span className="truncate">{row.ticket_type_name}</span>
          </span>
        ) : (
          "—"
        );
      case "status":
        return <TicketStatus row={row} configs={configs} label={labels[`status_${row.status}`]} />;
      case "priority":
        return (
          <TicketPriorityBadge
            priority={row.priority}
            config={configs.priority?.[row.priority]}
            label={labels[`priority_${row.priority}`]}
          />
        );
      case "branch":
        return row.branch_id ? (branchNames[row.branch_id] ?? "—") : "—";
      case "acceptance":
        return row.requires_acceptance ? (
          <span
            className={cn(
              "inline-flex rounded px-1.5 py-0.5 text-[11px]",
              row.accepted_at
                ? "bg-green-500/10 text-green-700 dark:text-green-400"
                : "bg-amber-500/10 text-amber-700 dark:text-amber-400"
            )}
          >
            {row.accepted_at ? labels.accepted : labels.acceptancePending}
          </span>
        ) : (
          "—"
        );
      case "creator":
        return row.creator_name || row.creator_email ? (
          <UserAvatar
            className="size-6"
            fullName={row.creator_name}
            email={row.creator_email}
            src={row.creator_avatar_url}
            profileHref={row.creator_profile_href ?? undefined}
          />
        ) : (
          "—"
        );
      case "assignees":
        return <AssigneeAvatars assignees={row.assignees} />;
      case "created_at":
        return date(row.created_at);
      case "updated_at":
        return date(row.updated_at);
      default:
        return "—";
    }
  };
  // The phone card is one link: people show as names there, not avatar links.
  const plainValue = (row: HelpdeskTicketListRow, id: string): ReactNode => {
    if (id === "creator") return row.creator_name ?? row.creator_email ?? "—";
    if (id === "assignees") {
      return row.assignees.length
        ? row.assignees.map((a) => a.name ?? a.email ?? "—").join(", ")
        : "—";
    }
    return value(row, id);
  };
  const pagination = (
    <TablePagination
      sizes={TICKET_PAGE_SIZES.map((size) => ({
        size,
        current: state.wierszy === size,
        href: href({ wierszy: size, strona: 1, selected: null }),
      }))}
      range={range}
      previousHref={page > 1 ? href({ strona: page - 1, selected: null }) : null}
      nextHref={page < pages ? href({ strona: page + 1, selected: null }) : null}
    />
  );
  const numberSort = sortOf("ticket_number");
  const NumberSortIcon =
    numberSort.direction === "asc"
      ? ArrowUp
      : numberSort.direction === "desc"
        ? ArrowDown
        : ChevronsUpDown;
  const identity = (row: HelpdeskTicketListRow) => (
    <span className="min-w-0">
      <span className="block truncate text-[13px] font-medium" title={row.title}>
        {row.title}
      </span>
      <span className="block truncate font-mono text-[11px] leading-4 font-normal text-muted-foreground">
        {row.ticket_number}
      </span>
    </span>
  );
  const linkProps = (row: HelpdeskTicketListRow) => ({
    href: rowHref(row),
    scroll: false,
    onClick: (event: MouseEvent) => openPreview(event, row),
    onMouseEnter: () => onPrefetch(row.ticket_number),
    onMouseLeave: () => onPrefetch(null),
    onFocus: () => onPrefetch(row.ticket_number),
  });
  const empty = loading ? labels.loading : error ? labels.loadError : labels.empty;
  return (
    <div
      className={cn(
        "ks-list-pane relative flex min-h-0 min-w-0 flex-1 flex-col",
        state.selected && "ks-list-pane--preview"
      )}
      aria-busy={loading || refreshing}
      data-refreshing={refreshing ? "" : undefined}
    >
      {/* The rows stay while new ones come: a thin bar says so, not a skeleton. */}
      {loading || refreshing ? (
        <div className="ks-list-progress" role="progressbar" aria-label={labels.loading} />
      ) : null}
      {error ? (
        <div role="alert" className="border-b bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {labels.loadError} <span className="block text-xs">{error}</span>
          <button type="button" onClick={onRetry} className="underline">
            {labels.retry}
          </button>
        </div>
      ) : null}
      {state.selected ? (
        <aside
          className="ks-list-mini-list min-h-0 flex-1 overflow-y-auto border-r bg-background"
          aria-label={labels.title}
        >
          <header className="sticky top-0 z-10 flex h-[34px] items-center border-b bg-muted/70 px-3 text-[10px] font-medium text-muted-foreground backdrop-blur-sm">
            <PageLink
              href={numberSort.href}
              scroll={false}
              className={cn(
                "inline-flex items-center gap-1 rounded hover:text-foreground",
                numberSort.direction && "text-foreground"
              )}
            >
              {set.pinned.label}
              <NumberSortIcon
                className={cn("size-3", !numberSort.direction && "opacity-40")}
                aria-hidden="true"
              />
            </PageLink>
          </header>
          <ul>
            {data.rows.map((row) => {
              const selected = row.ticket_number === state.selected;
              return (
                <li key={row.id} data-row-id={row.ticket_number}>
                  <PageLink
                    {...linkProps(row)}
                    className={cn(
                      "group flex h-[49px] items-center gap-2.5 border-b px-3 py-1 hover:bg-muted/50",
                      selected &&
                        "border-l-[3px] border-l-primary bg-primary/10 pl-[9px] hover:bg-primary/10"
                    )}
                    aria-current={selected ? "true" : undefined}
                  >
                    {identity(row)}
                  </PageLink>
                </li>
              );
            })}
          </ul>
        </aside>
      ) : (
        <div className="ks-list-desktop-table min-h-0 flex-1 flex-col">
          <DataTable
            caption={labels.title}
            set={set}
            columns={shown.map((id) => ({
              id,
              label: set.labels[id],
              sort: SORT_FIELD[id] ? sortOf(SORT_FIELD[id]) : undefined,
            }))}
            rows={data.rows}
            rowKey={(row) => row.ticket_number}
            rowHref={rowHref}
            selected={(row) => row.ticket_number === state.selected}
            pinnedSort={numberSort}
            onRowIntent={(row) => onPrefetch(row ? row.ticket_number : null)}
            pinned={(row) => (
              <PageLink {...linkProps(row)} className="flex min-w-0 items-center gap-2.5 py-1">
                {identity(row)}
              </PageLink>
            )}
            cell={(row, id) => (
              <td
                key={id}
                className={cn(
                  TD,
                  id === "branch" || id === "ticket_type" ? "text-muted-foreground" : ""
                )}
              >
                {value(row, id)}
              </td>
            )}
            actions={actions}
            menu={menu}
            widths={widths}
            widthsCookie={`${cookie}_widths`}
            empty={empty}
            pagination={pagination}
          />
        </div>
      )}
      <div className="ks-list-mobile min-h-0 flex-1 flex-col">
        <header className="flex h-10 shrink-0 items-center justify-between border-b px-3 text-xs text-muted-foreground">
          <span>
            {data.totalCount} {labels.countSuffix}
          </span>
          <div className="flex items-center gap-2">
            <PageLink href={numberSort.href}>
              {labels.number}{" "}
              {numberSort.direction === "asc" ? "↑" : numberSort.direction === "desc" ? "↓" : "↕"}
            </PageLink>
            {menu}
          </div>
        </header>
        <ul className="min-h-0 flex-1 overflow-auto overscroll-contain">
          {data.rows.map((row) => (
            <li key={row.id} className="flex items-start border-b px-3 py-2.5 hover:bg-muted/30">
              <PageLink {...linkProps(row)} className="flex min-w-0 flex-1 items-start gap-2.5">
                <span className="min-w-0 flex-1">
                  <span className="flex items-center justify-between gap-2">
                    <strong className="truncate text-[13px] font-medium leading-5">
                      {row.title}
                    </strong>
                    <TicketStatus
                      row={row}
                      configs={configs}
                      label={labels[`status_${row.status}`]}
                    />
                  </span>
                  <span className="block truncate font-mono text-[11px] text-muted-foreground">
                    {row.ticket_number}
                  </span>
                  <span className="mt-1.5 grid grid-cols-2 gap-x-2 gap-y-1">
                    {shown
                      .filter((id) => id !== "status")
                      .map((id) => (
                        <span key={id} className="min-w-0 text-xs">
                          <span className="block text-[10px] text-muted-foreground">
                            {set.labels[id]}
                          </span>
                          <span className="block truncate">{plainValue(row, id)}</span>
                        </span>
                      ))}
                  </span>
                </span>
              </PageLink>
              <div className="ml-1 shrink-0">{actions(row)}</div>
            </li>
          ))}
          {!data.rows.length ? (
            <li className="px-4 py-12 text-center text-sm text-muted-foreground">{empty}</li>
          ) : null}
        </ul>
        {pagination}
      </div>
    </div>
  );
}
