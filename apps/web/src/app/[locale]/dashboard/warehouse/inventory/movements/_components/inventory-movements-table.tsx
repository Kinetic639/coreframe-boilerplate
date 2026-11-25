import { ExternalLink, Eye, Pencil } from "lucide-react";
import type { ReactNode } from "react";
import { ListPane } from "@/components/data-table/list-pane";
import {
  type ColumnLayout,
  type ColumnSet,
  type ColumnWidths,
} from "@/components/data-table/columns";
import { RowActions, RowActionLink } from "@/components/data-table/row-actions";
import type { InventoryMovementListRow } from "@/lib/warehouse/inventory-types";
import { cn } from "@/lib/utils";
import type { MovementList } from "./inventory-movements-query";
import {
  movementHref,
  MOVEMENT_PAGE_SIZES,
  type MovementSort,
  type MovementState,
} from "./inventory-movements-state";
import { formatDateTime } from "@/lib/date-time/format";

/** Columns the list sorts by (each the movement's own field). */
const SORT_FIELD: Record<string, MovementSort> = {
  movement_type: "movement_type_code",
  status: "status",
  posted_at: "posted_at",
  created_at: "created_at",
};

export function movementColumnSet(labels: Record<string, string>): ColumnSet<string> {
  const ids = [
    "movement_type",
    "status",
    "warehouse",
    "external_reference",
    "counterparty",
    "line_count",
    "posted_at",
    "created_at",
  ];
  return {
    ids,
    labels: {
      movement_type: labels.kind,
      status: labels.status,
      warehouse: labels.warehouse,
      external_reference: labels.reference,
      counterparty: labels.counterparty,
      line_count: labels.lines,
      posted_at: labels.posted,
      created_at: labels.created,
    },
    widths: {
      movement_type: 200,
      status: 130,
      warehouse: 130,
      external_reference: 220,
      counterparty: 200,
      line_count: 80,
      posted_at: 160,
      created_at: 160,
    },
    shownByDefault: [
      "movement_type",
      "status",
      "warehouse",
      "external_reference",
      "line_count",
      "posted_at",
    ],
    pinned: { id: "document_number", label: labels.movement, width: 230 },
  };
}

const STATUS_TONE: Record<string, string> = {
  draft: "bg-muted text-muted-foreground",
  posted: "bg-primary/10 text-primary",
  accepted: "bg-primary/10 text-primary",
  in_transit: "bg-amber-500/10 text-amber-700 dark:text-amber-400",
  reversed: "bg-muted text-muted-foreground line-through decoration-1",
  cancelled: "bg-destructive/10 text-destructive",
  declined: "bg-destructive/10 text-destructive",
};

export function MovementStatus({ value, label }: { value: string; label: string }) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded px-1.5 py-0.5 text-[11px]",
        STATUS_TONE[value] ?? "bg-muted text-muted-foreground"
      )}
    >
      <span className="size-1.5 rounded-full bg-current" />
      {label}
    </span>
  );
}

export const movementNumber = (row: {
  document_number: string | null;
  draft_number: string | null;
}) => row.document_number ?? row.draft_number ?? "—";

export function InventoryMovementsTable({
  data,
  state,
  path,
  set,
  layout,
  widths,
  cookie,
  labels,
  canOperate,
  movementPath,
  error,
  loading,
  refreshing,
  onRetry,
  onLayoutChange,
  onPreview,
  onPrefetch,
}: {
  data: MovementList;
  state: MovementState;
  path: string;
  set: ColumnSet<string>;
  layout: ColumnLayout;
  widths: ColumnWidths;
  cookie: string;
  labels: Record<string, string>;
  canOperate: boolean;
  movementPath: (routeKey: string, edit?: boolean) => string;
  error: string | null;
  /** No rows yet (nothing cached for this address). */
  loading: boolean;
  /** Rows shown are the previous ones (or stale) while new ones come. */
  refreshing: boolean;
  onRetry: () => void;
  onLayoutChange: (layout: ColumnLayout) => void;
  onPreview: (routeKey: string | null) => void;
  /** A row the pointer rests on (null: it left), for its card's prefetch. */
  onPrefetch: (routeKey: string | null) => void;
}) {
  const href = (patch: Partial<MovementState>) => movementHref(path, state, patch);
  const rowHref = (row: InventoryMovementListRow) =>
    href({ selected: state.selected === row.route_key ? null : row.route_key });
  const sortOf = (field: MovementSort) => ({
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
  const actions = (row: InventoryMovementListRow) => (
    <RowActions label={movementNumber(row)}>
      <RowActionLink href={rowHref(row)} icon={<Eye className="size-4" />}>
        {labels.preview}
      </RowActionLink>
      <RowActionLink href={movementPath(row.route_key)} icon={<ExternalLink className="size-4" />}>
        {labels.openMovement}
      </RowActionLink>
      {canOperate && row.status === "draft" ? (
        <RowActionLink
          href={movementPath(row.route_key, true)}
          icon={<Pencil className="size-4" />}
        >
          {labels.editDraft}
        </RowActionLink>
      ) : null}
    </RowActions>
  );
  const value = (row: InventoryMovementListRow, id: string): ReactNode => {
    switch (id) {
      case "movement_type":
        return (
          <span className="truncate">
            <span className="mr-1.5 font-mono text-[11px] text-muted-foreground">
              {row.movement_type_code}
            </span>
            {row.movement_type_name}
          </span>
        );
      case "status":
        return (
          <MovementStatus value={row.status} label={labels[`status_${row.status}`] ?? row.status} />
        );
      case "warehouse":
        return row.warehouse_code ? (
          <span className="font-mono text-xs" title={row.warehouse_name ?? undefined}>
            {row.warehouse_code}
            {row.unit_code ? (
              <span className="text-muted-foreground"> · {row.unit_code}</span>
            ) : null}
          </span>
        ) : (
          "—"
        );
      case "external_reference":
        return row.external_reference ? (
          <span className="font-mono text-xs" title={row.external_reference}>
            {row.external_reference}
          </span>
        ) : (
          "—"
        );
      case "counterparty":
        return row.sender_name ?? row.recipient_name ?? "—";
      case "line_count":
        return <span className="tabular-nums">{row.line_count}</span>;
      case "posted_at":
        return date(row.posted_at);
      case "created_at":
        return date(row.created_at);
      default:
        return "—";
    }
  };
  const numberSort = sortOf("document_number");
  const identity = (row: InventoryMovementListRow) => (
    <span className="min-w-0">
      <span className="block truncate font-mono text-[12.5px] font-medium">
        {movementNumber(row)}
      </span>
      <span className="block truncate text-[11px] leading-4 font-normal text-muted-foreground">
        {row.movement_type_name}
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
      sizes={MOVEMENT_PAGE_SIZES}
      selected={state.selected}
      rowKey={(row) => row.route_key}
      rowHref={rowHref}
      pageHref={(page) => href({ strona: page, selected: null })}
      sizeHref={(size) =>
        href({ wierszy: size as MovementState["wierszy"], strona: 1, selected: null })
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
      badge={(row) => (
        <MovementStatus value={row.status} label={labels[`status_${row.status}`] ?? row.status} />
      )}
      cardHidden={["status", "movement_type"]}
      actions={actions}
      cellClassName={(id) =>
        id === "line_count" ? "text-right" : id === "status" ? undefined : "text-muted-foreground"
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
