import { ArrowDown, ArrowUp, ChevronsUpDown, Eye } from "lucide-react";
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
import { Badge } from "@/components/ui/badge";
import type { CrmPartyListRow } from "@/server/services/crm-parties.service";
import { cn } from "@/lib/utils";
import type { PartyList } from "./parties-query";
import { partyHref, PARTY_PAGE_SIZES, type PartySort, type PartyState } from "./parties-state";

type Row = CrmPartyListRow;

/** Columns the list sorts by (each the counterparty's own field). */
const SORT_FIELD: Record<string, PartySort> = {
  number: "counterparty_number",
  status: "status",
  created_at: "created_at",
  updated_at: "updated_at",
};

export function partyColumnSet(labels: Record<string, string>): ColumnSet<string> {
  const ids = [
    "number",
    "roles",
    "status",
    "kind",
    "tax_id",
    "email",
    "phone",
    "created_at",
    "updated_at",
  ];
  return {
    ids,
    labels: Object.fromEntries(ids.map((id) => [id, labels[`column_${id}`]])),
    widths: {
      number: 100,
      roles: 220,
      status: 120,
      kind: 140,
      tax_id: 140,
      email: 220,
      phone: 150,
      created_at: 140,
      updated_at: 140,
    },
    shownByDefault: ["number", "roles", "status", "tax_id", "email", "phone"],
    pinned: { id: "party", label: labels.column_party, width: 300 },
  };
}

export function PartyStatus({
  status,
  labels,
}: {
  status: Row["status"];
  labels: Record<string, string>;
}) {
  return (
    <Badge
      variant="outline"
      className={cn(
        "font-normal",
        status === "active" && "border-emerald-600/30 text-emerald-700 dark:text-emerald-400",
        status === "archived" && "text-muted-foreground"
      )}
    >
      {labels[`status_${status}`]}
    </Badge>
  );
}

export function PartyRoles({
  row,
  labels,
}: {
  row: Pick<Row, "roles">;
  labels: Record<string, string>;
}) {
  return (
    <span className="flex min-w-0 flex-wrap gap-1">
      {row.roles.map((role) => (
        <Badge key={role} variant="secondary" className="font-normal">
          {labels[`role_${role}`]}
        </Badge>
      ))}
    </span>
  );
}

export function PartiesTable({
  data,
  state,
  path,
  set,
  layout,
  widths,
  cookie,
  labels,
  loading,
  refreshing,
  error,
  onRetry,
  onLayoutChange,
  onPreview,
  onPrefetch,
}: {
  data: PartyList;
  state: PartyState;
  path: string;
  set: ColumnSet<string>;
  layout: ColumnLayout;
  widths: ColumnWidths;
  cookie: string;
  labels: Record<string, string>;
  /** Nothing to show yet (no rows of this address in the cache). */
  loading: boolean;
  /** The rows shown are an older address's, new ones are coming. */
  refreshing: boolean;
  error: string | null;
  onRetry: () => void;
  onLayoutChange: (layout: ColumnLayout) => void;
  onPreview: (id: string | null) => void;
  /** The pointer rests on a row (null: it left): its card can be fetched. */
  onPrefetch: (id: string | null) => void;
}) {
  const shown = layout.filter((c) => c.shown).map((c) => c.id);
  const { page, pages, range } = pageState(
    { page: state.strona, size: state.wierszy },
    data.totalCount,
    data.rows.length
  );
  const href = (patch: Partial<PartyState>) => partyHref(path, state, patch);
  const rowHref = (row: Row) => href({ selected: state.selected === row.id ? null : row.id });
  const openPreview = (event: MouseEvent, row: Row) => {
    if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey)
      return;
    event.preventDefault();
    onPreview(state.selected === row.id ? null : row.id);
  };
  const sortOf = (field: PartySort) => ({
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
        {new Date(value).toLocaleString(labels.locale, { dateStyle: "short", timeStyle: "short" })}
      </span>
    ) : (
      "—"
    );
  const actions = (row: Row) => (
    <RowActions label={row.display_name}>
      <RowActionLink href={rowHref(row)} icon={<Eye className="size-4" />}>
        {labels.preview}
      </RowActionLink>
    </RowActions>
  );
  const value = (row: Row, id: string): ReactNode => {
    switch (id) {
      case "number":
        return <span className="font-mono text-xs">{row.counterparty_number}</span>;
      case "roles":
        return <PartyRoles row={row} labels={labels} />;
      case "status":
        return <PartyStatus status={row.status} labels={labels} />;
      case "kind":
        return labels[`kind_${row.party_kind}`];
      case "tax_id":
        return row.tax_id ? <span className="font-mono text-xs">{row.tax_id}</span> : "—";
      case "email":
        return row.email || "—";
      case "phone":
        return row.phone || "—";
      case "created_at":
        return date(row.created_at);
      case "updated_at":
        return date(row.updated_at);
      default:
        return "—";
    }
  };
  const pagination = (
    <TablePagination
      sizes={PARTY_PAGE_SIZES.map((size) => ({
        size,
        current: state.wierszy === size,
        href: href({ wierszy: size, strona: 1, selected: null }),
      }))}
      range={range}
      previousHref={page > 1 ? href({ strona: page - 1, selected: null }) : null}
      nextHref={page < pages ? href({ strona: page + 1, selected: null }) : null}
    />
  );
  const nameSort = sortOf("display_name");
  const NameSortIcon =
    nameSort.direction === "asc"
      ? ArrowUp
      : nameSort.direction === "desc"
        ? ArrowDown
        : ChevronsUpDown;
  const identity = (row: Row) => (
    <span className="min-w-0">
      <span className="block truncate text-[13px] font-medium" title={row.display_name}>
        {row.display_name}
      </span>
      <span className="block truncate text-[11px] leading-4 font-normal text-muted-foreground">
        <span className="font-mono">#{row.counterparty_number}</span>
        {row.legal_name && row.legal_name !== row.display_name ? ` · ${row.legal_name}` : ""}
      </span>
    </span>
  );
  const linkProps = (row: Row) => ({
    href: rowHref(row),
    scroll: false,
    onClick: (event: MouseEvent) => openPreview(event, row),
    onMouseEnter: () => onPrefetch(row.id),
    onMouseLeave: () => onPrefetch(null),
    onFocus: () => onPrefetch(row.id),
  });
  const empty = loading
    ? labels.loading
    : error
      ? labels.loadError
      : state.q || state.rola.length || state.status.length
        ? labels.empty
        : labels.emptyAll;
  return (
    <div
      className={cn(
        "ks-list-pane relative flex min-h-0 min-w-0 flex-1 flex-col",
        state.selected && "ks-list-pane--preview"
      )}
      aria-busy={loading || refreshing}
      data-refreshing={refreshing ? "" : undefined}
    >
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
            onRowIntent={(row) => onPrefetch(row ? row.id : null)}
            pinned={(row) => (
              <PageLink {...linkProps(row)} className="flex min-w-0 items-center gap-2.5 py-1">
                {identity(row)}
              </PageLink>
            )}
            cell={(row, id) => (
              <td
                key={id}
                className={cn(TD, id === "email" || id === "phone" ? "text-muted-foreground" : "")}
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
            <PageLink href={nameSort.href}>
              {labels.column_party}{" "}
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
                    <strong className="truncate text-[13px] font-medium leading-5">
                      {row.display_name}
                    </strong>
                    <PartyStatus status={row.status} labels={labels} />
                  </span>
                  <span className="block truncate font-mono text-[11px] text-muted-foreground">
                    #{row.counterparty_number}
                  </span>
                  <span className="mt-1.5 grid grid-cols-2 gap-x-2 gap-y-1">
                    {shown
                      .filter((id) => id !== "status" && id !== "number")
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
            <li className="px-4 py-12 text-center text-sm text-muted-foreground">{empty}</li>
          ) : null}
        </ul>
        {pagination}
      </div>
    </div>
  );
}
