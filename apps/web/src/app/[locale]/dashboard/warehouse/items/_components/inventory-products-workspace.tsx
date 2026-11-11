"use client";

import { useCallback, useEffect, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { getInventoryProductAction } from "@/app/actions/warehouse/inventory";
import type {
  ColumnLayout,
  ColumnSet,
  ColumnWidths,
} from "@/components/kolor-sensu/data-table/columns";
import type { PaginatedResult } from "@/lib/data-view/types";
import type {
  InventoryCustomFieldDefinition,
  InventoryProductListRow,
} from "@/lib/warehouse/inventory-types";
import { InventoryProductsTable } from "./inventory-products-table";
import { ProductRecordPanel } from "./inventory-product-record-panel";
import { inventoryProductKeys } from "./inventory-product-query";
import { productHref, type ProductState } from "./inventory-products-state";

function stateFromLocation(): Pick<ProductState, "selected" | "tab"> {
  const params = new URLSearchParams(window.location.search);
  const selected = params.get("selected");
  const tab = params.get("tab");
  return {
    selected: selected && /^[\da-f-]{36}(::[\da-f-]{36})?$/i.test(selected) ? selected : null,
    tab: tab === "variants" || tab === "stock" ? tab : "info",
  };
}

export function InventoryProductsWorkspace({
  data,
  state: initialState,
  path,
  set,
  layout,
  widths,
  cookie,
  customFields,
  labels,
  canManageProducts,
  canReadStock,
  productPathTemplate,
  productEditPathTemplate,
  error,
  scope,
}: {
  data: PaginatedResult<InventoryProductListRow>;
  state: ProductState;
  path: string;
  set: ColumnSet<string>;
  layout: ColumnLayout;
  widths: ColumnWidths;
  cookie: string;
  customFields: InventoryCustomFieldDefinition[];
  labels: Record<string, string>;
  canManageProducts: boolean;
  canReadStock: boolean;
  productPathTemplate: string;
  productEditPathTemplate: string;
  error: string | null;
  scope: string;
}) {
  const queryClient = useQueryClient();
  const [preview, setPreview] = useState(() => ({
    selected: initialState.selected,
    tab: initialState.tab,
  }));
  const state = { ...initialState, ...preview };
  const productPath = useCallback(
    (id: string, edit = false) =>
      (edit ? productEditPathTemplate : productPathTemplate).replace("__PRODUCT_ID__", id),
    [productEditPathTemplate, productPathTemplate]
  );

  useEffect(() => {
    const onPopState = () => setPreview(stateFromLocation());
    window.addEventListener("popstate", onPopState);
    return () => window.removeEventListener("popstate", onPopState);
  }, []);

  const navigatePreview = useCallback(
    (patch: Partial<Pick<ProductState, "selected" | "tab">>) => {
      setPreview((current) => {
        const next = { ...current, ...patch };
        window.history.pushState(null, "", productHref(path, initialState, next));
        return next;
      });
    },
    [initialState, path]
  );

  const prefetchPreview = useCallback(
    (selectionId: string) => {
      const productId = selectionId.split("::")[0];
      void queryClient.prefetchQuery({
        queryKey: inventoryProductKeys.detail(scope, productId),
        queryFn: async () => {
          const result = await getInventoryProductAction({ id: productId });
          if (!result.success || !("data" in result)) {
            throw new Error("error" in result ? result.error : labels.loadError);
          }
          return result.data;
        },
        staleTime: 5 * 60 * 1000,
      });
    },
    [labels.loadError, queryClient, scope]
  );

  return (
    <div className="flex min-h-0 min-w-0 flex-1">
      <InventoryProductsTable
        data={data}
        state={state}
        path={path}
        set={set}
        layout={layout}
        widths={widths}
        cookie={cookie}
        labels={labels}
        canManageProducts={canManageProducts}
        productPath={productPath}
        error={error}
        onPreview={(selected) => navigatePreview({ selected, tab: "info" })}
        onPrefetch={prefetchPreview}
      />
      {state.selected ? (
        <ProductRecordPanel
          selectionId={state.selected}
          scope={scope}
          state={state}
          path={path}
          labels={labels}
          customFields={customFields}
          canManageProducts={canManageProducts}
          canReadStock={canReadStock}
          fullPath={productPath(state.selected.split("::")[0])}
          editPath={productPath(state.selected.split("::")[0], true)}
          onClose={() => navigatePreview({ selected: null, tab: "info" })}
          onTabChange={(tab) => navigatePreview({ tab })}
        />
      ) : null}
    </div>
  );
}
