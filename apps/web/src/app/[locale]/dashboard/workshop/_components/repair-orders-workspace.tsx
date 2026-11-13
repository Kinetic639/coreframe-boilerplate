"use client";

import { useCallback, useEffect, useState } from "react";
import { keepPreviousData, useQuery, useQueryClient } from "@tanstack/react-query";
import { useQueryStates } from "nuqs";
import { FilterBar, type FilterField } from "@/components/kolor-sensu/data-table/filter-bar";
import type {
  ColumnLayout,
  ColumnSet,
  ColumnWidths,
} from "@/components/kolor-sensu/data-table/columns";
import { TableNavigationProvider } from "@/components/kolor-sensu/data-table/table-navigation";
import { RepairOrdersTable } from "./repair-orders-table";
import {
  repairOrderListQuery,
  type RepairOrderList,
  type RepairOrdersScope,
} from "./repair-orders-query";
import {
  CREATED_WITHIN,
  NO_ADVISOR,
  REPAIR_ORDER_STATUSES,
  repairOrderHref,
  repairOrderParsers,
} from "./repair-orders-state";

type Option = { value: string; label: string };

const EMPTY_LIST: RepairOrderList = { rows: [], totalCount: 0, page: 1, pageSize: 50 };

/** How many orders the address finds (from the list's cache, no request of its own). */
export function RepairOrdersTotal({
  scope,
  initial,
}: {
  scope: RepairOrdersScope;
  initial: number;
}) {
  const [state] = useQueryStates(repairOrderParsers);
  const { data } = useQuery({
    ...repairOrderListQuery(scope, state),
    placeholderData: keepPreviousData,
  });
  return (
    <span className="text-xs tabular-nums text-muted-foreground">
      {data?.totalCount ?? initial}
    </span>
  );
}

/**
 * The repair order list, as the movements list: the address is the one
 * state, a filter, sort or page only pushes a new address, and the list
 * answers from its cache (the server put the first page there) or fetches
 * just its rows. A row opens the order's own page.
 */
export function RepairOrdersWorkspace({
  scope,
  path,
  set,
  layout: savedLayout,
  widths,
  cookie,
  labels,
  warehouses,
  advisors,
  orderPathTemplate,
}: {
  scope: RepairOrdersScope;
  path: string;
  set: ColumnSet<string>;
  layout: ColumnLayout;
  widths: ColumnWidths;
  cookie: string;
  labels: Record<string, string>;
  warehouses: Option[];
  advisors: Option[];
  orderPathTemplate: string;
}) {
  const queryClient = useQueryClient();
  const [state] = useQueryStates(repairOrderParsers);
  const list = useQuery({
    ...repairOrderListQuery(scope, state),
    placeholderData: keepPreviousData,
  });
  const data = list.data ?? EMPTY_LIST;

  // The columns follow the menu at once; the cookie keeps them for the server.
  const [layout, setLayout] = useState(savedLayout);

  /** Same page, new address: Next keeps useSearchParams in step with it. */
  const navigate = useCallback((href: string) => {
    window.history.pushState(null, "", href);
  }, []);
  const orderPath = useCallback(
    (id: string) => orderPathTemplate.replace("__ORDER__", encodeURIComponent(id)),
    [orderPathTemplate]
  );

  // A page past the end (a filter narrowed): go to the last one.
  useEffect(() => {
    if (list.isPlaceholderData || !list.data) return;
    const last = Math.max(1, Math.ceil(list.data.totalCount / state.wierszy));
    if (state.strona > last) {
      window.history.replaceState(null, "", repairOrderHref(path, state, { strona: last }));
    }
  }, [list.data, list.isPlaceholderData, path, state]);

  // The next page is a click away: fetch it once this one is shown.
  useEffect(() => {
    if (list.isPlaceholderData || !list.data) return;
    if (state.strona * state.wierszy >= list.data.totalCount) return;
    void queryClient.prefetchQuery(
      repairOrderListQuery(scope, { ...state, strona: state.strona + 1 })
    );
  }, [list.data, list.isPlaceholderData, queryClient, scope, state]);

  const warehouseNames = Object.fromEntries(
    warehouses.map((warehouse) => [warehouse.value, warehouse.label])
  );
  const fields: FilterField[] = [
    ...(warehouses.length
      ? [
          {
            kind: "list" as const,
            id: "magazyn",
            label: labels.column_warehouse,
            options: warehouses.map((warehouse) => ({
              value: warehouse.value,
              label: `${warehouse.value} · ${warehouse.label}`,
            })),
          },
        ]
      : []),
    {
      kind: "list",
      id: "status",
      label: labels.column_status,
      options: REPAIR_ORDER_STATUSES.map((value) => ({
        value,
        label: labels[`status_${value}`] ?? value,
      })),
    },
    {
      kind: "list",
      id: "doradca",
      label: labels.column_advisor,
      options: [{ value: NO_ADVISOR, label: labels.noAdvisor }, ...advisors],
    },
    {
      kind: "dates",
      id: "created_at",
      label: labels.column_created_at,
      options: CREATED_WITHIN.map((value) => ({ value, label: labels[`within_${value}`] })),
      keys: { scope: "utworzono", from: "utworzono_od", to: "utworzono_do" },
    },
  ];
  // The filter ids that are not columns sit where their column is.
  const order = ["order", ...layout.map((column) => column.id)].map((id) =>
    id === "warehouse" ? "magazyn" : id === "advisor" ? "doradca" : id
  );

  return (
    <TableNavigationProvider navigate={navigate}>
      <div className="ks-list-filter-row">
        <FilterBar
          parsers={repairOrderParsers}
          fields={fields}
          resetOnChange={["strona"]}
          shallow
          pending={list.isFetching}
          order={order}
          search={{ label: labels.search, placeholder: labels.search }}
        />
      </div>
      <div className="flex min-h-0 min-w-0 flex-1">
        <RepairOrdersTable
          data={data}
          state={state}
          path={path}
          set={set}
          layout={layout}
          onLayoutChange={setLayout}
          widths={widths}
          cookie={cookie}
          labels={labels}
          warehouseNames={warehouseNames}
          orderPath={orderPath}
          loading={list.isPending}
          refreshing={list.isFetching && !list.isPending}
          error={list.isError ? list.error.message : null}
          onRetry={() => void list.refetch()}
        />
      </div>
    </TableNavigationProvider>
  );
}
