import { Eye } from "lucide-react";
import type { ReactNode } from "react";
import { ListPane } from "@/components/data-table/list-pane";
import {
  type ColumnLayout,
  type ColumnSet,
  type ColumnWidths,
} from "@/components/data-table/columns";
import { RowActions, RowActionLink } from "@/components/data-table/row-actions";
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
  const href = (patch: Partial<PartyState>) => partyHref(path, state, patch);
  const rowHref = (row: Row) => href({ selected: state.selected === row.id ? null : row.id });
  const sortOf = (field: PartySort) => ({
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
  const empty = loading
    ? labels.loading
    : error
      ? labels.loadError
      : state.q || state.rola.length || state.status.length
        ? labels.empty
        : labels.emptyAll;
  return (
    <ListPane
      rows={data.rows}
      totalCount={data.totalCount}
      page={state.strona}
      size={state.wierszy}
      sizes={PARTY_PAGE_SIZES}
      selected={state.selected}
      rowKey={(row) => row.id}
      rowHref={rowHref}
      pageHref={(page) => href({ strona: page, selected: null })}
      sizeHref={(size) =>
        href({ wierszy: size as PartyState["wierszy"], strona: 1, selected: null })
      }
      set={set}
      layout={layout}
      widths={widths}
      cookie={cookie}
      onLayoutChange={onLayoutChange}
      sortOf={(id) => (SORT_FIELD[id] ? sortOf(SORT_FIELD[id]) : undefined)}
      pinnedSort={sortOf("display_name")}
      identity={identity}
      value={value}
      badge={(row) => <PartyStatus status={row.status} labels={labels} />}
      cardHidden={["status", "number"]}
      actions={actions}
      cellClassName={(id) =>
        id === "email" || id === "phone" ? "text-muted-foreground" : undefined
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
