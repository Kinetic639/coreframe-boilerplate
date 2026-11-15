"use client";

import { Check, ClipboardCheck, Eye, Printer, TreePine } from "lucide-react";
import type { ReactNode } from "react";
import { type TableSelection } from "@/components/data-table/data-table";
import { ListPane } from "@/components/data-table/list-pane";
import {
  type ColumnLayout,
  type ColumnSet,
  type ColumnWidths,
} from "@/components/data-table/columns";
import { RowActionButton, RowActionLink, RowActions } from "@/components/data-table/row-actions";
import {
  LOCATION_PAGE_SIZES,
  locationHref,
  type LocationListRow,
  type LocationSort,
  type LocationState,
} from "./locations-list-state";

/** Columns the list sorts by (each the location's own field). */
const SORT_FIELD: Record<string, LocationSort> = {
  path: "struktura",
  level: "level",
  created_at: "created_at",
};

export interface LocationRowCommands {
  /** The tree view, with this location open. */
  showInTree: (id: string) => void;
  print: (ids: string[]) => void;
  audit: (ids: string[]) => void;
}

export function LocationsListTable({
  rows,
  totalCount,
  state,
  path,
  set,
  layout,
  widths,
  cookie,
  labels,
  ticked,
  onTickedChange,
  commands,
  onLayoutChange,
  onPreview,
}: {
  rows: LocationListRow[];
  totalCount: number;
  state: LocationState;
  path: string;
  set: ColumnSet<string>;
  layout: ColumnLayout;
  widths: ColumnWidths;
  cookie: string;
  labels: Record<string, string>;
  /** The rows ticked (ids), for actions on several at once. */
  ticked: string[];
  onTickedChange: (ids: string[]) => void;
  commands: LocationRowCommands;
  onLayoutChange: (layout: ColumnLayout) => void;
  onPreview: (id: string | null) => void;
}) {
  const href = (patch: Partial<LocationState>) => locationHref(path, state, patch);
  const rowHref = (row: LocationListRow) =>
    href({ selected: state.selected === row.id ? null : row.id });
  const sortOf = (field: LocationSort) => ({
    href: href({
      sort: field,
      direction: state.sort === field && state.direction === "asc" ? "desc" : "asc",
      strona: 1,
      selected: null,
    }),
    direction: state.sort === field ? state.direction : null,
  });
  const actions = (row: LocationListRow) => (
    <RowActions label={row.code ?? row.name}>
      <RowActionLink href={rowHref(row)} icon={<Eye className="size-4" />}>
        {labels.preview}
      </RowActionLink>
      <RowActionButton
        onSelect={() => commands.showInTree(row.id)}
        icon={<TreePine className="size-4" />}
      >
        {labels.showInTree}
      </RowActionButton>
      <RowActionButton
        onSelect={() => commands.print([row.id])}
        icon={<Printer className="size-4" />}
      >
        {labels.printLabel}
      </RowActionButton>
      <RowActionButton
        onSelect={() => commands.audit([row.id])}
        icon={<ClipboardCheck className="size-4" />}
      >
        {labels.auditLocation}
      </RowActionButton>
    </RowActions>
  );
  const value = (row: LocationListRow, id: string): ReactNode => {
    switch (id) {
      case "name":
        return (
          <span className="flex min-w-0 items-center gap-2 text-foreground">
            {row.color ? (
              <span
                aria-hidden="true"
                className="size-2.5 shrink-0 rounded-full border"
                style={{ backgroundColor: row.color }}
              />
            ) : null}
            <span className="truncate">{row.name}</span>
          </span>
        );
      case "path":
        return (
          <span className="block truncate font-mono text-xs" title={row.path}>
            {row.path}
          </span>
        );
      case "level":
        return <span className="tabular-nums">{row.level}</span>;
      case "storage_mode":
        return row.storage_mode ? (labels[`mode_${row.storage_mode}`] ?? row.storage_mode) : "—";
      case "can_store_inventory":
        return row.can_store_inventory ? (
          <span className="inline-flex items-center gap-1 text-primary">
            <Check className="size-3.5" aria-hidden="true" />
            {labels.yes}
          </span>
        ) : (
          <span className="text-muted-foreground">{labels.no}</span>
        );
      case "created_at":
        return row.created_at ? (
          <span className="text-xs">
            {new Date(row.created_at).toLocaleString(labels.locale, {
              dateStyle: "short",
              timeStyle: "short",
            })}
          </span>
        ) : (
          "—"
        );
      default:
        return "—";
    }
  };
  const tickedSet = new Set(ticked);
  const tickedOnPage = rows.filter((row) => tickedSet.has(row.id));
  const selection: TableSelection<LocationListRow> = {
    isSelected: (row) => tickedSet.has(row.id),
    toggle: (row) =>
      onTickedChange(
        tickedSet.has(row.id) ? ticked.filter((id) => id !== row.id) : [...ticked, row.id]
      ),
    all: rows.length > 0 && tickedOnPage.length === rows.length,
    some: tickedOnPage.length > 0,
    toggleAll: () => {
      const pageIds = new Set(rows.map((row) => row.id));
      onTickedChange(
        tickedOnPage.length === rows.length
          ? ticked.filter((id) => !pageIds.has(id))
          : [...new Set([...ticked, ...pageIds])]
      );
    },
    allLabel: labels.selectAll,
    rowLabel: (row) => `${labels.selectRow}: ${row.code ?? row.name}`,
  };
  const codeSort = sortOf("code");
  const identity = (row: LocationListRow) => (
    <span className="min-w-0">
      <span className="block truncate font-mono text-[12.5px] font-medium">{row.code ?? "—"}</span>
      <span className="block truncate text-[11px] leading-4 font-normal text-muted-foreground">
        {row.name}
      </span>
    </span>
  );
  return (
    <ListPane
      rows={rows}
      totalCount={totalCount}
      page={state.strona}
      size={state.wierszy}
      sizes={LOCATION_PAGE_SIZES}
      selected={state.selected}
      rowKey={(row) => row.id}
      rowHref={rowHref}
      pageHref={(page) => href({ strona: page, selected: null })}
      sizeHref={(size) =>
        href({ wierszy: size as LocationState["wierszy"], strona: 1, selected: null })
      }
      set={set}
      layout={layout}
      widths={widths}
      cookie={cookie}
      onLayoutChange={onLayoutChange}
      sortOf={(id) =>
        SORT_FIELD[id] ? sortOf(SORT_FIELD[id]) : id === "name" ? sortOf("name") : undefined
      }
      pinnedSort={codeSort}
      identity={identity}
      value={value}
      cardHidden={["name"]}
      actions={actions}
      cellClassName={(id) =>
        id === "level" ? "text-right" : id === "name" ? undefined : "text-muted-foreground"
      }
      labels={labels}
      empty={labels.empty}
      onPreview={onPreview}
      selection={selection}
    />
  );
}
