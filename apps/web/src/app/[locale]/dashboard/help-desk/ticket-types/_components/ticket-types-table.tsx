import {
  Building2,
  ExternalLink,
  Eye,
  GitBranch,
  Pencil,
  ShieldCheck,
  Trash2,
  Users,
} from "lucide-react";
import type { ReactNode } from "react";
import { ListPane } from "@/components/data-table/list-pane";
import {
  type ColumnLayout,
  type ColumnSet,
  type ColumnWidths,
} from "@/components/data-table/columns";
import { RowActions, RowActionButton, RowActionLink } from "@/components/data-table/row-actions";
import type { HelpdeskTicketTypeWithDetails } from "@/server/services/helpdesk-ticket-types.service";
import type { PaginatedResult } from "@/lib/data-view/types";
import { cn } from "@/lib/utils";
import {
  ticketTypeHref,
  TYPE_PAGE_SIZES,
  type TicketTypeState,
  type TypeSort,
} from "./ticket-types-state";
import { formatDateTime } from "@/lib/date-time/format";

type TicketType = HelpdeskTicketTypeWithDetails;

/** Columns the list sorts by (each the type's own field). */
const SORT_FIELD: Record<string, TypeSort> = {
  default_priority: "default_priority",
  sort_order: "sort_order",
  updated_at: "updated_at",
};

export function ticketTypeColumnSet(labels: Record<string, string>): ColumnSet<string> {
  const ids = [
    "scope",
    "default_priority",
    "responders",
    "acceptance",
    "status",
    "sort_order",
    "updated_at",
  ];
  return {
    ids,
    labels: {
      scope: labels.scope,
      default_priority: labels.priority,
      responders: labels.responders,
      acceptance: labels.acceptance,
      status: labels.status,
      sort_order: labels.order,
      updated_at: labels.updatedAt,
    },
    widths: {
      scope: 200,
      default_priority: 120,
      responders: 160,
      acceptance: 150,
      status: 120,
      sort_order: 100,
      updated_at: 150,
    },
    shownByDefault: ["scope", "default_priority", "responders", "acceptance", "status"],
    pinned: { id: "name", label: labels.type, width: 300 },
  };
}

export function TicketTypesTable({
  data,
  state,
  path,
  set,
  layout,
  widths,
  cookie,
  labels,
  branchNames,
  typePath,
  onLayoutChange,
  onPreview,
  onEdit,
  onDelete,
}: {
  data: PaginatedResult<TicketType>;
  state: TicketTypeState;
  path: string;
  set: ColumnSet<string>;
  layout: ColumnLayout;
  widths: ColumnWidths;
  cookie: string;
  labels: Record<string, string>;
  branchNames: Record<string, string>;
  typePath: (id: string) => string;
  onLayoutChange: (layout: ColumnLayout) => void;
  onPreview: (id: string | null) => void;
  onEdit: (type: TicketType) => void;
  onDelete: (type: TicketType) => void;
}) {
  const href = (patch: Partial<TicketTypeState>) => ticketTypeHref(path, state, patch);
  const rowHref = (row: TicketType) =>
    href({ selected: state.selected === row.id ? null : row.id });
  const sortOf = (field: TypeSort) => ({
    href: href({
      sort: field,
      direction: state.sort === field && state.direction === "asc" ? "desc" : "asc",
      strona: 1,
      selected: null,
    }),
    direction: state.sort === field ? state.direction : null,
  });
  const actions = (row: TicketType) => (
    <RowActions label={row.name}>
      <RowActionLink href={rowHref(row)} icon={<Eye className="size-4" />}>
        {labels.preview}
      </RowActionLink>
      <RowActionLink href={typePath(row.id)} icon={<ExternalLink className="size-4" />}>
        {labels.viewType}
      </RowActionLink>
      <RowActionButton onSelect={() => onEdit(row)} icon={<Pencil className="size-4" />}>
        {labels.edit}
      </RowActionButton>
      {!row.is_system ? (
        <RowActionButton
          onSelect={() => onDelete(row)}
          icon={<Trash2 className="size-4" />}
          destructive
        >
          {labels.delete}
        </RowActionButton>
      ) : null}
    </RowActions>
  );
  const value = (row: TicketType, id: string): ReactNode => {
    switch (id) {
      case "scope":
        return row.scope === "branch" ? (
          <span className="inline-flex min-w-0 items-center gap-1.5">
            <GitBranch className="size-3.5 shrink-0 text-muted-foreground" />
            <span className="truncate">
              {(row.branch_id && branchNames[row.branch_id]) ?? labels.scopeBranch}
            </span>
          </span>
        ) : (
          <span className="inline-flex min-w-0 items-center gap-1.5">
            <Building2 className="size-3.5 shrink-0 text-muted-foreground" />
            <span className="truncate">{labels.scopeOrg}</span>
          </span>
        );
      case "default_priority":
        return labels[`priority_${row.default_priority}`] ?? row.default_priority;
      case "responders":
        return row.default_responders.length ? (
          <span className="inline-flex items-center gap-1.5 tabular-nums">
            <Users className="size-3.5 text-muted-foreground" />
            {row.default_responders.length}
          </span>
        ) : (
          "—"
        );
      case "acceptance":
        return row.requires_acceptance ? (
          <span className="inline-flex items-center gap-1.5 text-green-700 dark:text-green-400">
            <ShieldCheck className="size-3.5" />
            <span className="tabular-nums">{row.default_acceptors.length}</span>
          </span>
        ) : (
          "—"
        );
      case "status":
        return (
          <span
            className={cn(
              "inline-flex items-center gap-1.5 rounded px-1.5 py-0.5 text-[11px]",
              row.is_active
                ? "bg-green-500/10 text-green-700 dark:text-green-400"
                : "bg-muted text-muted-foreground"
            )}
          >
            <span className="size-1.5 rounded-full bg-current" />
            {row.is_active ? labels.active : labels.inactive}
          </span>
        );
      case "sort_order":
        return <span className="tabular-nums">{row.sort_order}</span>;
      case "updated_at":
        return (
          <span className="text-xs text-muted-foreground">
            {formatDateTime(row.updated_at, labels.locale, {
              dateStyle: "short",
              timeStyle: "short",
            })}
          </span>
        );
      default:
        return "—";
    }
  };
  const nameSort = sortOf("name");
  const identity = (row: TicketType) => (
    <span className="flex min-w-0 items-center gap-2.5">
      <span className="size-2.5 shrink-0 rounded-full" style={{ backgroundColor: row.color }} />
      <span className="min-w-0">
        <span className="block truncate text-[13px] font-medium" title={row.name}>
          {row.name}
        </span>
        <span className="block truncate text-[11px] leading-4 font-normal text-muted-foreground">
          {row.description || (row.is_system ? labels.system : " ")}
        </span>
      </span>
    </span>
  );
  return (
    <ListPane
      rows={data.rows}
      totalCount={data.totalCount}
      page={state.strona}
      size={state.wierszy}
      sizes={TYPE_PAGE_SIZES}
      selected={state.selected}
      rowKey={(row) => row.id}
      rowHref={rowHref}
      pageHref={(page) => href({ strona: page, selected: null })}
      sizeHref={(size) =>
        href({ wierszy: size as TicketTypeState["wierszy"], strona: 1, selected: null })
      }
      set={set}
      layout={layout}
      widths={widths}
      cookie={cookie}
      onLayoutChange={onLayoutChange}
      sortOf={(id) => (SORT_FIELD[id] ? sortOf(SORT_FIELD[id]) : undefined)}
      pinnedSort={nameSort}
      identity={identity}
      value={value}
      badge={(row) => value(row, "status")}
      cardHidden={["status"]}
      actions={actions}
      cellClassName={(id) =>
        id === "sort_order" ? "text-right" : id === "status" ? undefined : "text-muted-foreground"
      }
      labels={labels}
      empty={labels.empty}
      onPreview={onPreview}
    />
  );
}
