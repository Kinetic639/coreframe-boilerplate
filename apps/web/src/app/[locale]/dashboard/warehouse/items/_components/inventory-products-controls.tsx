"use client";

import { useState } from "react";
import { useQueryStates } from "nuqs";
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { Download } from "lucide-react";
import { FilterBar, type FilterField } from "@/components/kolor-sensu/data-table/filter-bar";
import { Button } from "@/components/ui/button";
import { exportInventoryProductsCsvAction } from "@/app/actions/warehouse/inventory";
import type { InventoryCustomFieldDefinition } from "@/lib/warehouse/inventory-types";
import {
  CHANGED_WITHIN,
  productParsers,
  PRODUCT_TYPES,
  PRODUCT_STATUSES,
  QUANTITY_RANGES,
} from "./inventory-products-state";
import { productListQuery, type ProductsScope } from "./inventory-product-query";
import { ProductViews } from "./inventory-products-views";

/** How many products the address finds (from the list's cache, no request of its own). */
export function ProductsTotal({ scope, initial }: { scope: ProductsScope; initial: number }) {
  const [state] = useQueryStates(productParsers);
  const { data } = useQuery({
    ...productListQuery(scope, state),
    placeholderData: keepPreviousData,
  });
  return (
    <span className="text-xs tabular-nums text-muted-foreground">
      {data?.totalCount ?? initial}
    </span>
  );
}

export function ProductFilters({
  scope,
  path,
  userId,
  canShareViews,
  order,
  customFields,
  labels,
}: {
  scope: ProductsScope;
  path: string;
  userId: string;
  canShareViews: boolean;
  order: string[];
  customFields: InventoryCustomFieldDefinition[];
  labels: Record<string, string>;
}) {
  // The list fetches its own rows: the address changes without a server render.
  const [state, setState] = useQueryStates(productParsers, { shallow: true, history: "push" });
  // The search box spins while this address's rows come (not for prefetches).
  const fetching = useQuery({
    ...productListQuery(scope, state),
    placeholderData: keepPreviousData,
  }).isFetching;
  const quantityLabels: Record<string, string> = {
    on_hand_quantity: labels.onHand,
    available_quantity: labels.available,
    reserved_total_quantity: labels.reserved,
    blocked_quantity: labels.blocked,
  };
  // A filter for every column of the list (in the columns' order), each of
  // its kind: text contains, values to tick, a range of numbers or of days.
  const fields: FilterField[] = [
    { kind: "text", id: "nazwa", label: labels.productColumn },
    { kind: "text", id: "sku", label: labels.sku },
    {
      kind: "list",
      id: "product_type",
      label: labels.type,
      options: PRODUCT_TYPES.map((value) => ({ value, label: labels[value] ?? value })),
    },
    {
      kind: "list",
      id: "status",
      label: labels.status,
      options: PRODUCT_STATUSES.map((value) => ({ value, label: labels[value] ?? value })),
    },
    // Quantities are sums per product: they filter the grouped list.
    ...(state.grouped
      ? QUANTITY_RANGES.map((range) => ({
          kind: "range" as const,
          id: range.column,
          label: quantityLabels[range.column],
          keys: { min: range.min, max: range.max },
        }))
      : []),
    {
      kind: "dates",
      id: "updated_at",
      label: labels.updated,
      options: CHANGED_WITHIN.map((value) => ({ value, label: labels[`changed_${value}`] })),
      keys: { scope: "zmiana", from: "zmiana_od", to: "zmiana_do" },
    },
    ...customFields.map((field) => ({
      kind: "text" as const,
      id: `custom_field:${field.id}`,
      label: field.name,
      within: "filters",
    })),
    ...(!state.grouped
      ? [
          {
            kind: "list" as const,
            id: "is_variant",
            label: labels.isVariant,
            options: [
              { value: "true", label: labels.yes },
              { value: "false", label: labels.no },
            ],
          },
        ]
      : []),
  ];
  return (
    <div className="products-filter-row">
      <FilterBar
        parsers={productParsers}
        fields={fields}
        resetOnChange={["strona", "selected", "tab"]}
        shallow
        pending={fetching}
        order={["nazwa", ...order]}
        search={{ label: labels.search, placeholder: labels.search }}
      />
      <div className="products-filter-extras">
        <label className="inline-flex cursor-pointer items-center gap-1.5 whitespace-nowrap text-xs text-muted-foreground">
          <input
            type="checkbox"
            checked={state.grouped}
            onChange={(e) =>
              void setState({
                grouped: e.target.checked,
                is_variant: [],
                stan: [],
                ...Object.fromEntries(
                  QUANTITY_RANGES.flatMap((range) => [
                    [range.min, null],
                    [range.max, null],
                  ])
                ),
                strona: 1,
                selected: null,
                tab: null,
              })
            }
            className="accent-primary"
          />
          {labels.groupVariants}
        </label>
        {/* Saved views only: the filters themselves are all in the bar. */}
        <ProductViews
          scope={scope}
          path={path}
          userId={userId}
          canShare={canShareViews}
          labels={labels}
        />
      </div>
    </div>
  );
}

export function ProductExport({ label }: { label: string }) {
  const [pending, setPending] = useState(false),
    [error, setError] = useState<string | null>(null);
  async function exportCsv() {
    setPending(true);
    setError(null);
    try {
      const result = await exportInventoryProductsCsvAction();
      if (!result.success || !("data" in result)) {
        setError("error" in result ? result.error : "Export failed");
        return;
      }
      const url = URL.createObjectURL(
        new Blob([result.data.csv], { type: "text/csv;charset=utf-8" })
      );
      const a = document.createElement("a");
      a.href = url;
      a.download = result.data.file_name;
      a.click();
      URL.revokeObjectURL(url);
    } catch (error) {
      setError(error instanceof Error ? error.message : String(error));
    } finally {
      setPending(false);
    }
  }
  return (
    <div>
      <Button
        size="sm"
        variant="outline"
        disabled={pending}
        onClick={exportCsv}
        aria-label={label}
        title={label}
      >
        <Download className="size-3.5 sm:mr-1.5" />
        <span className="hidden sm:inline">{label}</span>
      </Button>
      {error ? (
        <p role="alert" className="max-w-xs text-xs text-destructive">
          {error}
        </p>
      ) : null}
    </div>
  );
}
