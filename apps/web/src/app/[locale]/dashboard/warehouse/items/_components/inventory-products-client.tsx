"use client";

import { useCallback, useMemo, useState } from "react";
import Image from "next/image";
import { ChevronDown, ChevronRight, Download, PackagePlus, Upload } from "lucide-react";
import { Link } from "@/i18n/navigation";
import { DataView } from "@/components/data-view/data-view";
import type {
  DataViewColumnDef,
  DataViewFilterDef,
  DataViewListParams,
  PaginatedResult,
} from "@/lib/data-view/types";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import type {
  InventoryCustomFieldDefinition,
  InventoryProductDetail,
  InventoryProductListRow,
} from "@/lib/warehouse/inventory-types";
import {
  exportInventoryProductsCsvAction,
  getInventoryProductAction,
  listInventoryProductsAction,
} from "@/app/actions/warehouse/inventory";
import {
  ExpandedVariantRows,
  ProductDetailPanel,
  ProductSidebarItem,
  VariantGroupingControl,
  statusVariant,
} from "./inventory-product-display";

type InventoryProductsClientProps = {
  initialData: PaginatedResult<InventoryProductListRow>;
  customFields: InventoryCustomFieldDefinition[];
  canManageProducts: boolean;
  canImportProducts: boolean;
};

const INVENTORY_PRODUCTS_QUERY_KEY = ["inventory-products"];

async function listFetcher(params: DataViewListParams) {
  const result = await listInventoryProductsAction(params);
  if (!result.success || !("data" in result))
    throw new Error("error" in result ? result.error : "Unauthorized");
  return result.data;
}

async function detailFetcher(id: string) {
  const result = await getInventoryProductAction({
    id: id.includes("::") ? id.split("::")[0] : id,
  });
  if (!result.success || !("data" in result))
    throw new Error("error" in result ? result.error : "Unauthorized");
  return result.data;
}

export function InventoryProductsClient({
  initialData,
  customFields,
  canManageProducts,
  canImportProducts,
}: InventoryProductsClientProps) {
  const [expandedProductIds, setExpandedProductIds] = useState<Record<string, true>>({});
  const [listMessage, setListMessage] = useState<string | null>(null);

  const toggleExpanded = useCallback((id: string) => {
    setExpandedProductIds((current) => {
      const next = { ...current };
      if (next[id]) delete next[id];
      else next[id] = true;
      return next;
    });
  }, []);

  const exportProducts = useCallback(async () => {
    const result = await exportInventoryProductsCsvAction();
    if (!result.success || !("data" in result)) {
      setListMessage("error" in result ? result.error : "Export failed");
      return;
    }
    const blob = new Blob([result.data.csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = result.data.file_name;
    anchor.click();
    URL.revokeObjectURL(url);
  }, []);

  const columns = useMemo<DataViewColumnDef<InventoryProductListRow>[]>(
    () => [
      {
        key: "name",
        header: "Product",
        accessor: (row) => (
          <div className="min-w-0 py-2">
            <div className="flex min-w-0 items-center gap-3">
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded border bg-muted">
                {row.thumbnail_url ? (
                  <Image
                    src={row.thumbnail_url}
                    alt=""
                    width={36}
                    height={36}
                    unoptimized
                    className="h-full w-full rounded object-cover"
                  />
                ) : (
                  <PackagePlus className="h-4 w-4 text-muted-foreground" />
                )}
              </div>
              <div className="min-w-0">
                <div className="truncate font-medium">{row.name}</div>
                <div className="truncate text-xs text-muted-foreground">
                  {row.is_variant_row && row.parent_product_name
                    ? `${row.parent_product_name} · ${row.sku}`
                    : row.variant_count > 1
                      ? `${row.variant_count} variants`
                      : row.sku}
                </div>
              </div>
            </div>
          </div>
        ),
        sortable: true,
        defaultVisible: true,
      },
      {
        key: "product_type",
        header: "Type",
        accessor: (row) => <span className="capitalize">{row.product_type.replace("_", " ")}</span>,
        sortable: true,
        defaultVisible: true,
      },
      {
        key: "status",
        header: "Status",
        accessor: (row) => (
          <Badge variant={statusVariant[row.status] ?? "outline"}>{row.status}</Badge>
        ),
        sortable: true,
        defaultVisible: true,
      },
      {
        key: "on_hand_quantity",
        header: "On hand",
        accessor: (row) => (
          <span className="tabular-nums">
            {row.on_hand_quantity} {row.unit_code}
          </span>
        ),
        sortable: true,
        defaultVisible: true,
      },
      {
        key: "available_quantity",
        header: "Available",
        accessor: (row) => (
          <span className="tabular-nums">
            {row.available_quantity} {row.unit_code}
          </span>
        ),
        sortable: true,
        defaultVisible: true,
      },
      {
        key: "updated_at",
        header: "Updated",
        accessor: (row) => (
          <span className="text-xs text-muted-foreground">
            {new Date(row.updated_at).toLocaleString()}
          </span>
        ),
        sortable: true,
        defaultVisible: true,
      },
      ...customFields.map<DataViewColumnDef<InventoryProductListRow>>((field) => ({
        key: `custom_field:${field.id}`,
        header: field.name,
        accessor: (row) => (
          <span className="text-sm text-muted-foreground">
            {row.custom_field_values[field.id] || "-"}
          </span>
        ),
        defaultVisible: false,
      })),
    ],
    [customFields]
  );

  const filters = useMemo<DataViewFilterDef[]>(
    () => [
      {
        type: "select",
        key: "product_type",
        label: "Type",
        options: ["stocked", "consumable", "service", "serialized", "lot_tracked", "bundle"].map(
          (value) => ({ label: value.replace("_", " "), value })
        ),
      },
      {
        type: "select",
        key: "status",
        label: "Status",
        options: ["active", "archived", "discontinued"].map((value) => ({ label: value, value })),
      },
      {
        type: "boolean",
        key: "is_variant",
        label: "Is variant",
        isVisible: (filters) => filters.__group_variants === false,
      },
      ...customFields.map<DataViewFilterDef>((field) => ({
        type: "text",
        key: `custom_field:${field.id}`,
        label: field.name,
      })),
    ],
    [customFields]
  );

  const renderCompactItem = useCallback(
    (row: InventoryProductListRow) => <ProductSidebarItem product={row} />,
    []
  );

  const renderExpandedRow = useCallback(
    (row: InventoryProductListRow) =>
      !row.is_variant_row && row.variant_count > 1 && expandedProductIds[row.id] ? (
        <ExpandedVariantRows product={row} />
      ) : null,
    [expandedProductIds]
  );

  const renderRowControl = useCallback(
    (row: InventoryProductListRow) => {
      if (row.is_variant_row || row.variant_count <= 1) return null;
      const isExpanded = !!expandedProductIds[row.id];
      return (
        <button
          type="button"
          className="grid h-8 w-8 place-items-center rounded hover:bg-muted"
          aria-label={isExpanded ? "Hide variants" : "Show variants"}
          aria-expanded={isExpanded}
          onClick={() => toggleExpanded(row.id)}
        >
          {isExpanded ? (
            <ChevronDown className="h-4 w-4 text-muted-foreground" />
          ) : (
            <ChevronRight className="h-4 w-4 text-muted-foreground" />
          )}
        </button>
      );
    },
    [expandedProductIds, toggleExpanded]
  );

  const renderToolbarControls = useCallback(() => <VariantGroupingControl />, []);

  const renderDetail = useCallback(
    (detail: InventoryProductDetail) => (
      <ProductDetailPanel
        detail={detail}
        customFields={customFields}
        canManageProducts={canManageProducts}
      />
    ),
    [canManageProducts, customFields]
  );

  const getRowId = useCallback((row: InventoryProductListRow) => row.row_id, []);

  return (
    <div className="flex h-full min-h-0 flex-col gap-4">
      <div className="flex items-center justify-between gap-3 border-b pb-4">
        <div />
        <div className="flex flex-wrap items-center gap-2">
          <Button type="button" variant="outline" onClick={exportProducts}>
            <Download className="mr-2 h-4 w-4" />
            Export CSV
          </Button>
          {canImportProducts ? (
            <Button asChild variant="outline">
              <Link href="/dashboard/warehouse/items/import">
                <Upload className="mr-2 h-4 w-4" />
                Import file
              </Link>
            </Button>
          ) : null}
          {canManageProducts ? (
            <>
              <Button asChild variant="outline">
                <Link href={"/dashboard/warehouse/items/custom-fields" as any}>Custom fields</Link>
              </Button>
              <Button asChild>
                <Link href="/dashboard/warehouse/items/new">
                  <PackagePlus className="mr-2 h-4 w-4" />
                  Create
                </Link>
              </Button>
            </>
          ) : null}
        </div>
      </div>

      {listMessage ? (
        <div className="shrink-0 rounded-md border bg-muted/30 px-3 py-2 text-sm text-muted-foreground">
          {listMessage}
        </div>
      ) : null}

      <DataView<InventoryProductListRow, InventoryProductDetail>
        entity="inventory-products"
        columns={columns}
        filters={filters}
        initialData={initialData}
        queryKey={INVENTORY_PRODUCTS_QUERY_KEY}
        listFetcher={listFetcher}
        detailFetcher={detailFetcher}
        getRowId={getRowId}
        renderCompactItem={renderCompactItem}
        renderExpandedRow={renderExpandedRow}
        renderRowControl={renderRowControl}
        renderToolbarControls={renderToolbarControls}
        renderDetail={renderDetail}
        className="min-h-0 flex-1"
      />
    </div>
  );
}
