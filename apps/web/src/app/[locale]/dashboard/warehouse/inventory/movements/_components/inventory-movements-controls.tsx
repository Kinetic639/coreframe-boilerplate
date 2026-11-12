"use client";

import { useQueryStates } from "nuqs";
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { FilterBar, type FilterField } from "@/components/kolor-sensu/data-table/filter-bar";
import type { DocumentUnit } from "@/server/services/warehouse-stock.service";
import { MOVEMENT_STATUSES, movementParsers, POSTED_WITHIN } from "./inventory-movements-state";
import { movementListQuery, type MovementsScope } from "./inventory-movements-query";

/** How many movements the address finds (from the list's cache, no request of its own). */
export function MovementsTotal({ scope, initial }: { scope: MovementsScope; initial: number }) {
  const [state] = useQueryStates(movementParsers);
  const { data } = useQuery({
    ...movementListQuery(scope, state),
    placeholderData: keepPreviousData,
  });
  return (
    <span className="text-xs tabular-nums text-muted-foreground">
      {data?.totalCount ?? initial}
    </span>
  );
}

export function MovementFilters({
  scope,
  order,
  units,
  types,
  labels,
}: {
  scope: MovementsScope;
  /** The columns' order: the filters follow it. */
  order: string[];
  units: DocumentUnit[];
  /** The organization's movement types (code and name). */
  types: { code: string; name: string }[];
  labels: Record<string, string>;
}) {
  const [state] = useQueryStates(movementParsers);
  // The search box spins while this address's rows come (not for prefetches).
  const fetching = useQuery({
    ...movementListQuery(scope, state),
    placeholderData: keepPreviousData,
  }).isFetching;
  const fields: FilterField[] = [
    {
      kind: "list",
      id: "rodzaj",
      label: labels.kind,
      options: types.map((type) => ({ value: type.code, label: `${type.code} ${type.name}` })),
    },
    {
      kind: "list",
      id: "status",
      label: labels.status,
      options: MOVEMENT_STATUSES.map((value) => ({
        value,
        label: labels[`status_${value}`] ?? value,
      })),
    },
    ...(units.length
      ? ([
          {
            kind: "list",
            id: "jednostka",
            label: labels.unit,
            options: units.map((u) => ({
              value: u.id,
              label: `${u.code}${u.name ? ` ${u.name}` : ""}`,
            })),
          },
          {
            kind: "list",
            id: "magazyn",
            label: labels.warehouse,
            options: units.flatMap((u) =>
              u.warehouses.map((w) => ({
                value: w.id,
                label: `${w.code}${w.name ? ` ${w.name}` : ""} (${u.code})`,
              }))
            ),
          },
        ] satisfies FilterField[])
      : []),
    {
      kind: "dates",
      id: "posted_at",
      label: labels.posted,
      options: POSTED_WITHIN.map((value) => ({ value, label: labels[`within_${value}`] })),
      keys: { scope: "ksiegowanie", from: "ksiegowanie_od", to: "ksiegowanie_do" },
    },
  ];
  // The filter ids that are not columns sit after the column they belong to.
  const columnOrder = order.flatMap((id) =>
    id === "movement_type" ? ["rodzaj"] : id === "warehouse" ? ["jednostka", "magazyn"] : [id]
  );
  return (
    <div className="ks-list-filter-row">
      <FilterBar
        parsers={movementParsers}
        fields={fields}
        resetOnChange={["strona", "selected"]}
        shallow
        pending={fetching}
        order={columnOrder}
        search={{ label: labels.search, placeholder: labels.search }}
      />
    </div>
  );
}
