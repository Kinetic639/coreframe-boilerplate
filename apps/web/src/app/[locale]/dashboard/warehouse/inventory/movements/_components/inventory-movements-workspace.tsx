"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { keepPreviousData, useQuery, useQueryClient } from "@tanstack/react-query";
import { useQueryStates } from "nuqs";
import { ExternalLink, X } from "lucide-react";
import type {
  ColumnLayout,
  ColumnSet,
  ColumnWidths,
} from "@/components/kolor-sensu/data-table/columns";
import { TableNavigationProvider } from "@/components/kolor-sensu/data-table/table-navigation";
import type { InventoryMovementListRow } from "@/lib/warehouse/inventory-types";
import { InventoryMovementDetailPanel } from "./inventory-movement-detail-panel";
import {
  InventoryMovementsTable,
  MovementStatus,
  movementNumber,
} from "./inventory-movements-table";
import {
  invalidateInventoryMovements,
  movementDetailQuery,
  movementListQuery,
  MOVEMENTS_CHANGED_EVENT,
  type MovementList,
  type MovementsScope,
} from "./inventory-movements-query";
import { movementHref, movementParsers } from "./inventory-movements-state";

/** How long the pointer rests on a row before its card is fetched. */
const HOVER_INTENT_MS = 150;

const EMPTY_LIST: MovementList = { rows: [], totalCount: 0, page: 1, pageSize: 50 };

type LocationOption = { id: string; name: string; code: string | null };

/**
 * The movements list and its side panel, as the products list: the address
 * is the one state, every change only pushes a new address, and the list
 * answers from its cache (the server put the first page there) or fetches
 * just its rows.
 */
export function InventoryMovementsWorkspace({
  scope,
  path,
  set,
  layout: savedLayout,
  widths,
  cookie,
  labels,
  canOperate,
  locations,
  movementPathTemplate,
  movementEditPathTemplate,
}: {
  scope: MovementsScope;
  path: string;
  set: ColumnSet<string>;
  layout: ColumnLayout;
  widths: ColumnWidths;
  cookie: string;
  labels: Record<string, string>;
  canOperate: boolean;
  locations: LocationOption[];
  movementPathTemplate: string;
  movementEditPathTemplate: string;
}) {
  const queryClient = useQueryClient();
  const [state] = useQueryStates(movementParsers);
  const list = useQuery({
    ...movementListQuery(scope, state),
    placeholderData: keepPreviousData,
  });
  const data = list.data ?? EMPTY_LIST;

  // The columns follow the menu at once; the cookie keeps them for the server.
  const [layout, setLayout] = useState(savedLayout);

  /** Same page, new address: Next keeps useSearchParams in step with it. */
  const navigate = useCallback((href: string) => {
    window.history.pushState(null, "", href);
  }, []);

  const movementPath = useCallback(
    (routeKey: string, edit = false) =>
      (edit ? movementEditPathTemplate : movementPathTemplate).replace(
        "__MOVEMENT__",
        encodeURIComponent(routeKey)
      ),
    [movementEditPathTemplate, movementPathTemplate]
  );

  const preview = useCallback(
    (selected: string | null) => navigate(movementHref(path, state, { selected })),
    [navigate, path, state]
  );

  // A page past the end (a filter narrowed): go to the last one.
  useEffect(() => {
    if (list.isPlaceholderData || !list.data) return;
    const last = Math.max(1, Math.ceil(list.data.totalCount / state.wierszy));
    if (state.strona > last) {
      window.history.replaceState(null, "", movementHref(path, state, { strona: last }));
    }
  }, [list.data, list.isPlaceholderData, path, state]);

  // The next page is a click away: fetch it once this one is shown.
  useEffect(() => {
    if (list.isPlaceholderData || !list.data) return;
    if (state.strona * state.wierszy >= list.data.totalCount) return;
    void queryClient.prefetchQuery(
      movementListQuery(scope, { ...state, strona: state.strona + 1 })
    );
  }, [list.data, list.isPlaceholderData, queryClient, scope, state]);

  // A movement's card, fetched when the pointer rests on its row.
  const hover = useRef<ReturnType<typeof setTimeout> | null>(null);
  const prefetchPreview = useCallback(
    (routeKey: string | null) => {
      if (hover.current) clearTimeout(hover.current);
      hover.current = null;
      if (!routeKey) return;
      hover.current = setTimeout(() => {
        void queryClient.prefetchQuery(movementDetailQuery(scope, routeKey));
      }, HOVER_INTENT_MS);
    },
    [queryClient, scope]
  );
  useEffect(() => () => void (hover.current && clearTimeout(hover.current)), []);

  // Posted, cancelled, reversed or accepted in the panel: lists and cards refetch.
  useEffect(() => {
    const changed = () => void invalidateInventoryMovements(queryClient);
    window.addEventListener(MOVEMENTS_CHANGED_EVENT, changed);
    return () => window.removeEventListener(MOVEMENTS_CHANGED_EVENT, changed);
  }, [queryClient]);

  const selectedRow = useMemo<InventoryMovementListRow | null>(
    () => data.rows.find((row) => row.route_key === state.selected) ?? null,
    [data.rows, state.selected]
  );

  // ↓ / ↑ open the next / previous movement, Esc closes the panel. Keys typed
  // into a field, or with a modifier, stay the field's.
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.defaultPrevented || event.altKey || event.ctrlKey || event.metaKey) return;
      const target = event.target as HTMLElement | null;
      if (
        target?.closest(
          "input, textarea, select, [contenteditable='true'], [role='menu'], [role='dialog'], [role='listbox']"
        )
      ) {
        return;
      }
      if (event.key === "Escape" && state.selected) {
        event.preventDefault();
        preview(null);
        return;
      }
      if (event.key !== "ArrowDown" && event.key !== "ArrowUp") return;
      if (!data.rows.length) return;
      const at = data.rows.findIndex((row) => row.route_key === state.selected);
      if (at < 0 && event.key === "ArrowUp") return;
      const next =
        at < 0
          ? 0
          : Math.min(data.rows.length - 1, Math.max(0, at + (event.key === "ArrowDown" ? 1 : -1)));
      if (next === at) return;
      event.preventDefault();
      preview(data.rows[next].route_key);
      requestAnimationFrame(() =>
        document
          .querySelector(`[data-row-id="${CSS.escape(data.rows[next].route_key)}"]`)
          ?.scrollIntoView({ block: "nearest" })
      );
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [data.rows, preview, state.selected]);

  return (
    <TableNavigationProvider navigate={navigate}>
      <div className="flex min-h-0 min-w-0 flex-1">
        <InventoryMovementsTable
          data={data}
          state={state}
          path={path}
          set={set}
          layout={layout}
          onLayoutChange={setLayout}
          widths={widths}
          cookie={cookie}
          labels={labels}
          canOperate={canOperate}
          movementPath={movementPath}
          loading={list.isPending}
          refreshing={list.isFetching && !list.isPending}
          error={list.isError ? list.error.message : null}
          onRetry={() => void list.refetch()}
          onPreview={preview}
          onPrefetch={prefetchPreview}
        />
        {state.selected ? (
          <MovementRecordPanel
            key={state.selected}
            routeKey={state.selected}
            row={selectedRow}
            scope={scope}
            labels={labels}
            locations={locations}
            canOperate={canOperate}
            fullPath={movementPath(state.selected)}
            onClose={() => preview(null)}
          />
        ) : null}
      </div>
    </TableNavigationProvider>
  );
}

function MovementRecordPanel({
  routeKey,
  row,
  scope,
  labels,
  locations,
  canOperate,
  fullPath,
  onClose,
}: {
  routeKey: string;
  /** The list's row of this movement, shown while its card comes. */
  row: InventoryMovementListRow | null;
  scope: MovementsScope;
  labels: Record<string, string>;
  locations: LocationOption[];
  canOperate: boolean;
  fullPath: string;
  onClose: () => void;
}) {
  const query = useQuery(movementDetailQuery(scope, routeKey));
  return (
    <aside
      aria-labelledby="inventory-movement-panel-title"
      className="ks-list-panel fixed inset-y-0 right-0 z-[var(--z-modal)] flex w-full max-w-2xl flex-col overflow-hidden border-l bg-background shadow-2xl xl:static xl:z-auto xl:min-w-0 xl:flex-1 xl:max-w-none xl:shadow-none"
    >
      <header className="flex h-12 shrink-0 items-center gap-2 border-b px-4">
        <button
          type="button"
          onClick={onClose}
          className="inline-flex items-center gap-2 rounded-md px-2 py-1.5 text-sm text-muted-foreground hover:bg-muted hover:text-foreground"
          aria-label={labels.close}
        >
          <X className="size-4" />
          <span>{labels.title}</span>
        </button>
        <span className="text-muted-foreground/50">/</span>
        <span id="inventory-movement-panel-title" className="truncate font-mono text-sm">
          {row ? movementNumber(row) : routeKey}
        </span>
        <Link
          href={fullPath}
          className="ml-auto inline-flex h-8 items-center gap-1.5 rounded-md border px-3 text-xs font-medium hover:bg-muted"
        >
          <ExternalLink className="size-3.5" />
          {labels.openMovement}
        </Link>
      </header>
      {query.isPending ? (
        <div className="space-y-4 p-5" aria-busy="true" aria-label={labels.loading}>
          {row ? (
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="font-mono text-lg font-semibold">{movementNumber(row)}</h2>
              <MovementStatus
                value={row.status}
                label={labels[`status_${row.status}`] ?? row.status}
              />
              <p className="w-full text-sm text-muted-foreground">{row.movement_type_name}</p>
            </div>
          ) : (
            <div className="h-6 w-1/2 animate-pulse rounded bg-muted" />
          )}
          {[0, 1, 2, 3, 4].map((key) => (
            <div key={key} className="h-4 animate-pulse rounded bg-muted" />
          ))}
        </div>
      ) : null}
      {query.isError ? (
        <div className="grid flex-1 place-items-center p-8 text-center text-sm">
          <div>
            <p className="text-destructive">
              {query.error.message === "Movement not found" ? labels.notFound : query.error.message}
            </p>
            <button className="mt-3 underline" type="button" onClick={() => query.refetch()}>
              {labels.retry}
            </button>
          </div>
        </div>
      ) : null}
      {query.data ? (
        <div className="min-h-0 flex-1 overflow-y-auto p-5">
          <InventoryMovementDetailPanel
            detail={query.data}
            activeBranchId={scope.branchId}
            locations={locations}
            canOperate={canOperate}
            showOpenPageAction={false}
          />
        </div>
      ) : null}
    </aside>
  );
}
