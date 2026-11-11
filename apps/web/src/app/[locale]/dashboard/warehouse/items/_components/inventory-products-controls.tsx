"use client";

import { useState } from "react";
import { useQueryStates } from "nuqs";
import { Download, SlidersHorizontal } from "lucide-react";
import { FilterBar, type FilterField } from "@/components/kolor-sensu/data-table/filter-bar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/kolor-sensu/popover";
import { Button } from "@/components/ui/button";
import { exportInventoryProductsCsvAction } from "@/app/actions/warehouse/inventory";
import type { InventoryCustomFieldDefinition } from "@/lib/warehouse/inventory-types";
import { productParsers, PRODUCT_TYPES, PRODUCT_STATUSES } from "./inventory-products-state";

export function ProductFilters({
  order,
  customFields,
  labels,
}: {
  order: string[];
  customFields: InventoryCustomFieldDefinition[];
  labels: Record<string, string>;
}) {
  const [state, setState] = useQueryStates(productParsers, { shallow: false });
  const fields: FilterField[] = [
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
        order={order}
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
                strona: 1,
                selected: null,
                tab: null,
              })
            }
            className="accent-primary"
          />
          {labels.groupVariants}
        </label>
        {customFields.length > 0 ? (
          <Popover>
            <PopoverTrigger
              aria-label={labels.customFields}
              className="inline-flex h-7 items-center gap-1 rounded px-1.5 text-xs hover:bg-muted"
            >
              <SlidersHorizontal className="size-3.5" />
              {labels.customFields}
              {Object.values(state.filters).filter(Boolean).length
                ? ` · ${Object.values(state.filters).filter(Boolean).length}`
                : ""}
            </PopoverTrigger>
            <PopoverContent align="end" className="grid max-h-96 gap-3 overflow-auto p-3">
              {customFields.map((field) => (
                <form
                  key={field.id}
                  onSubmit={(e) => {
                    e.preventDefault();
                    const value = String(new FormData(e.currentTarget).get("value") ?? "");
                    void setState({
                      filters: { ...state.filters, [`custom_field:${field.id}`]: value || null },
                      strona: 1,
                      selected: null,
                    });
                  }}
                >
                  <label className="grid gap-1 text-xs">
                    {field.name}
                    <input
                      name="value"
                      key={String(state.filters[`custom_field:${field.id}`] ?? "")}
                      defaultValue={String(state.filters[`custom_field:${field.id}`] ?? "")}
                      className="h-8 rounded border bg-background px-2 text-foreground"
                    />
                  </label>
                  <button type="submit" className="mt-1 text-xs text-primary">
                    {labels.apply}
                  </button>
                </form>
              ))}
              <button
                className="text-left text-xs text-primary"
                onClick={() => void setState({ filters: {}, strona: 1, selected: null })}
              >
                {labels.clear}
              </button>
            </PopoverContent>
          </Popover>
        ) : null}
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
