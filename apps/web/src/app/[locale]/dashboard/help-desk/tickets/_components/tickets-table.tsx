import { ExternalLink, Eye, MessageSquare, Paperclip } from "lucide-react";
import type { ReactNode } from "react";
import { ListPane } from "@/components/data-table/list-pane";
import {
  type ColumnLayout,
  type ColumnSet,
  type ColumnWidths,
} from "@/components/data-table/columns";
import { RowActions, RowActionLink } from "@/components/data-table/row-actions";
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
import { formatDateTime } from "@/lib/date-time/format";

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
  const href = (patch: Partial<TicketState>) => ticketHref(path, state, patch);
  const rowHref = (row: HelpdeskTicketListRow) =>
    href({ selected: state.selected === row.ticket_number ? null : row.ticket_number });
  const sortOf = (field: TicketSort) => ({
    href: href({
      sort: field,
      direction: state.sort === field && state.direction === "asc" ? "desc" : "asc",
      strona: 1,
      selected: null,
    }),
    direction: state.sort === field ? state.direction : null,
  });
  const date = (value: string | null) =>
    value ? (
      <span className="text-xs text-muted-foreground">
        {formatDateTime(value, labels.locale, {
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
  const numberSort = sortOf("ticket_number");
  const identity = (row: HelpdeskTicketListRow) => (
    <span className="min-w-0">
      <span className="block truncate text-[13px] font-medium" title={row.title}>
        {row.title}
      </span>
      <span className="flex items-center gap-2 text-[11px] leading-4 font-normal text-muted-foreground">
        <span className="truncate font-mono">{row.ticket_number}</span>
        {row.comment_count ? (
          <span
            className="inline-flex shrink-0 items-center gap-0.5 tabular-nums"
            title={labels.comments}
          >
            <MessageSquare className="size-3" aria-hidden />
            <span className="sr-only">{labels.comments}:</span>
            {row.comment_count}
          </span>
        ) : null}
        {row.attachment_count ? (
          <span
            className="inline-flex shrink-0 items-center gap-0.5 tabular-nums"
            title={labels.attachments}
          >
            <Paperclip className="size-3" aria-hidden />
            <span className="sr-only">{labels.attachments}:</span>
            {row.attachment_count}
          </span>
        ) : null}
      </span>
    </span>
  );
  const empty = loading ? labels.loading : error ? labels.loadError : labels.empty;
  return (
    <ListPane
      rows={data.rows}
      totalCount={data.totalCount}
      page={state.strona}
      size={state.wierszy}
      sizes={TICKET_PAGE_SIZES}
      selected={state.selected}
      rowKey={(row) => row.ticket_number}
      rowHref={rowHref}
      pageHref={(page) => href({ strona: page, selected: null })}
      sizeHref={(size) =>
        href({ wierszy: size as TicketState["wierszy"], strona: 1, selected: null })
      }
      set={set}
      layout={layout}
      widths={widths}
      cookie={cookie}
      onLayoutChange={onLayoutChange}
      sortOf={(id) => (SORT_FIELD[id] ? sortOf(SORT_FIELD[id]) : undefined)}
      pinnedSort={numberSort}
      identity={identity}
      value={value}
      plainValue={plainValue}
      badge={(row) => (
        <TicketStatus row={row} configs={configs} label={labels[`status_${row.status}`]} />
      )}
      cardHidden={["status"]}
      actions={actions}
      cellClassName={(id) =>
        id === "branch" || id === "ticket_type" ? "text-muted-foreground" : undefined
      }
      labels={labels}
      empty={empty}
      loading={loading}
      refreshing={refreshing}
      error={error}
      onRetry={onRetry}
      onPreview={onPreview}
      onPrefetch={onPrefetch}
    />
  );
}
