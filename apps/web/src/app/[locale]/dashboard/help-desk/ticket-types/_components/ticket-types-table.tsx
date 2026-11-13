import {
  ArrowDown,
  ArrowUp,
  Building2,
  ChevronsUpDown,
  ExternalLink,
  Eye,
  GitBranch,
  Pencil,
  ShieldCheck,
  Trash2,
  Users,
} from "lucide-react";
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
import { RowActions, RowActionButton, RowActionLink } from "@/components/kolor-sensu/row-actions";
import type { HelpdeskTicketTypeWithDetails } from "@/server/services/helpdesk-ticket-types.service";
import type { PaginatedResult } from "@/lib/data-view/types";
import { cn } from "@/lib/utils";
import {
  ticketTypeHref,
  TYPE_PAGE_SIZES,
  type TicketTypeState,
  type TypeSort,
} from "./ticket-types-state";

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
  const shown = layout.filter((c) => c.shown).map((c) => c.id);
  const { page, pages, range } = pageState(
    { page: data.page, size: state.wierszy },
    data.totalCount,
    data.rows.length
  );
  const href = (patch: Partial<TicketTypeState>) => ticketTypeHref(path, state, patch);
  const rowHref = (row: TicketType) =>
    href({ selected: state.selected === row.id ? null : row.id });
  const openPreview = (event: MouseEvent, row: TicketType) => {
    if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey)
      return;
    event.preventDefault();
    onPreview(state.selected === row.id ? null : row.id);
  };
  const sortOf = (field: TypeSort) => ({
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
            {new Date(row.updated_at).toLocaleString(labels.locale, {
              dateStyle: "short",
              timeStyle: "short",
            })}
          </span>
        );
      default:
        return "—";
    }
  };
  const pagination = (
    <TablePagination
      sizes={TYPE_PAGE_SIZES.map((size) => ({
        size,
        current: state.wierszy === size,
        href: href({ wierszy: size, strona: 1, selected: null }),
      }))}
      range={range}
      previousHref={page > 1 ? href({ strona: page - 1, selected: null }) : null}
      nextHref={page < pages ? href({ strona: page + 1, selected: null }) : null}
    />
  );
  const nameSort = sortOf("name");
  const NameSortIcon =
    nameSort.direction === "asc"
      ? ArrowUp
      : nameSort.direction === "desc"
        ? ArrowDown
        : ChevronsUpDown;
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
  const linkProps = (row: TicketType) => ({
    href: rowHref(row),
    scroll: false,
    onClick: (event: MouseEvent) => openPreview(event, row),
  });
  return (
    <div
      className={cn(
        "ks-list-pane relative flex min-h-0 min-w-0 flex-1 flex-col",
        state.selected && "ks-list-pane--preview"
      )}
    >
      {state.selected ? (
        <aside
          className="ks-list-mini-list min-h-0 flex-1 overflow-y-auto border-r bg-background"
          aria-label={labels.title}
        >
          <header className="sticky top-0 z-10 flex h-[34px] items-center border-b bg-muted/70 px-3 text-[10px] font-medium text-muted-foreground backdrop-blur-sm">
            <PageLink
              href={nameSort.href}
              scroll={false}
              className={cn(
                "inline-flex items-center gap-1 rounded hover:text-foreground",
                nameSort.direction && "text-foreground"
              )}
            >
              {set.pinned.label}
              <NameSortIcon
                className={cn("size-3", !nameSort.direction && "opacity-40")}
                aria-hidden="true"
              />
            </PageLink>
          </header>
          <ul>
            {data.rows.map((row) => {
              const selected = row.id === state.selected;
              return (
                <li key={row.id} data-row-id={row.id}>
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
            rowKey={(row) => row.id}
            rowHref={rowHref}
            selected={(row) => row.id === state.selected}
            pinnedSort={nameSort}
            pinned={(row) => (
              <PageLink {...linkProps(row)} className="flex min-w-0 items-center py-1">
                {identity(row)}
              </PageLink>
            )}
            cell={(row, id) => (
              <td
                key={id}
                className={cn(
                  TD,
                  id === "sort_order"
                    ? "text-right"
                    : id === "status"
                      ? ""
                      : "text-muted-foreground"
                )}
              >
                {value(row, id)}
              </td>
            )}
            actions={actions}
            menu={menu}
            widths={widths}
            widthsCookie={`${cookie}_widths`}
            empty={labels.empty}
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
            <PageLink href={nameSort.href}>
              {labels.name}{" "}
              {nameSort.direction === "asc" ? "↑" : nameSort.direction === "desc" ? "↓" : "↕"}
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
                    {identity(row)}
                    {value(row, "status")}
                  </span>
                  <span className="mt-1.5 grid grid-cols-2 gap-x-2 gap-y-1">
                    {shown
                      .filter((id) => id !== "status")
                      .map((id) => (
                        <span key={id} className="min-w-0 text-xs">
                          <span className="block text-[10px] text-muted-foreground">
                            {set.labels[id]}
                          </span>
                          <span className="block truncate">{value(row, id)}</span>
                        </span>
                      ))}
                  </span>
                </span>
              </PageLink>
              <div className="ml-1 shrink-0">{actions(row)}</div>
            </li>
          ))}
          {!data.rows.length ? (
            <li className="px-4 py-12 text-center text-sm text-muted-foreground">{labels.empty}</li>
          ) : null}
        </ul>
        {pagination}
      </div>
    </div>
  );
}
