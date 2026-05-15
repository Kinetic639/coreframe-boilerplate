"use client";

import { useMemo, useRef, useState, useTransition } from "react";
import Image from "next/image";
import { ChevronDown, ChevronRight, Download, Edit, PackagePlus, Upload } from "lucide-react";
import { Link } from "@/i18n/navigation";
import { DataView } from "@/components/data-view/data-view";
import type {
  DataViewColumnDef,
  DataViewFilterDef,
  DataViewListParams,
  PaginatedResult,
} from "@/components/data-view/data-view.types";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import type {
  InventoryCustomFieldDefinition,
  InventoryProductDetail,
  InventoryProductListRow,
} from "@/server/services/inventory-products.service";
import {
  exportInventoryProductsCsvAction,
  getInventoryProductAction,
  importInventoryProductsCsvAction,
  listInventoryProductsAction,
  previewInventoryProductsCsvImportAction,
} from "@/app/actions/warehouse/inventory";

type InventoryProductsClientProps = {
  initialData: PaginatedResult<InventoryProductListRow>;
  customFields: InventoryCustomFieldDefinition[];
  canManageProducts: boolean;
  canImportProducts: boolean;
};

const statusVariant: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
  active: "default",
  archived: "secondary",
  discontinued: "destructive",
};

async function listFetcher(params: DataViewListParams) {
  const result = await listInventoryProductsAction(params);
  if (!result.success || !("data" in result))
    throw new Error("error" in result ? result.error : "Unauthorized");
  return result.data;
}

async function detailFetcher(id: string) {
  const result = await getInventoryProductAction({ id });
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
  const [viewMode, setViewMode] = useState<"grouped" | "variants">("grouped");
  const [importMessage, setImportMessage] = useState<string | null>(null);
  const [isImportPending, startImportTransition] = useTransition();
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const toggleExpanded = (id: string) => {
    setExpandedProductIds((current) => {
      const next = { ...current };
      if (next[id]) delete next[id];
      else next[id] = true;
      return next;
    });
  };

  const columns = useMemo<DataViewColumnDef<InventoryProductListRow>[]>(
    () => [
      {
        key: "name",
        header: "Product",
        accessor: (row) => {
          const isExpanded = !!expandedProductIds[row.id];
          const hasVisibleVariants = row.variant_count > 1;
          return (
            <div className="min-w-0 py-2">
              <div className="flex min-w-0 items-center gap-3">
                {hasVisibleVariants ? (
                  <button
                    type="button"
                    className="grid h-7 w-7 shrink-0 place-items-center rounded hover:bg-muted"
                    aria-label={isExpanded ? "Hide variants" : "Show variants"}
                    aria-expanded={isExpanded}
                    onClick={(event) => {
                      event.stopPropagation();
                      toggleExpanded(row.id);
                    }}
                  >
                    {isExpanded ? (
                      <ChevronDown className="h-4 w-4 text-muted-foreground" />
                    ) : (
                      <ChevronRight className="h-4 w-4 text-muted-foreground" />
                    )}
                  </button>
                ) : (
                  <span className="h-7 w-7 shrink-0" />
                )}
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
                    {row.variant_count > 1 ? `${row.variant_count} variants` : row.sku}
                  </div>
                </div>
              </div>
            </div>
          );
        },
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
    [customFields, expandedProductIds]
  );

  const filters: DataViewFilterDef[] = [
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
    ...customFields.map<DataViewFilterDef>((field) => ({
      type: "text",
      key: `custom_field:${field.id}`,
      label: field.name,
    })),
  ];

  return (
    <div className="flex h-full flex-col gap-4">
      <div className="flex items-center justify-between gap-3 border-b pb-4">
        <div className="inline-flex overflow-hidden rounded-md border">
          <button
            type="button"
            className={`px-3 py-2 text-sm ${viewMode === "grouped" ? "bg-muted font-medium" : ""}`}
            onClick={() => setViewMode("grouped")}
          >
            Products
          </button>
          <button
            type="button"
            className={`border-l px-3 py-2 text-sm ${viewMode === "variants" ? "bg-muted font-medium" : ""}`}
            onClick={() => setViewMode("variants")}
          >
            Variants
          </button>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button
            type="button"
            variant="outline"
            onClick={async () => {
              const result = await exportInventoryProductsCsvAction();
              if (!result.success || !("data" in result)) {
                setImportMessage("error" in result ? result.error : "Export failed");
                return;
              }
              const blob = new Blob([result.data.csv], { type: "text/csv;charset=utf-8" });
              const url = URL.createObjectURL(blob);
              const anchor = document.createElement("a");
              anchor.href = url;
              anchor.download = result.data.file_name;
              anchor.click();
              URL.revokeObjectURL(url);
            }}
          >
            <Download className="mr-2 h-4 w-4" />
            Export CSV
          </Button>
          {canImportProducts ? (
            <>
              <input
                ref={fileInputRef}
                type="file"
                accept=".csv,text/csv"
                className="hidden"
                onChange={(event) => {
                  const file = event.target.files?.[0];
                  event.currentTarget.value = "";
                  if (!file) return;
                  startImportTransition(async () => {
                    const csv = await file.text();
                    const preview = await previewInventoryProductsCsvImportAction({ csv });
                    if (!preview.success || !("data" in preview)) {
                      setImportMessage(
                        "error" in preview ? preview.error : "Import preview failed"
                      );
                      return;
                    }
                    if (preview.data.invalid_rows > 0) {
                      const firstInvalid = preview.data.rows.find((row) => row.errors.length > 0);
                      setImportMessage(
                        `Import blocked: ${preview.data.invalid_rows} invalid rows. Row ${firstInvalid?.row_number}: ${firstInvalid?.errors.join(", ")}`
                      );
                      return;
                    }
                    const imported = await importInventoryProductsCsvAction({ csv });
                    setImportMessage(
                      imported.success && "data" in imported
                        ? `Imported ${imported.data.imported_products} products and ${imported.data.imported_variants} variants.`
                        : "error" in imported
                          ? imported.error
                          : "Import failed"
                    );
                  });
                }}
              />
              <Button
                type="button"
                variant="outline"
                disabled={isImportPending}
                onClick={() => fileInputRef.current?.click()}
              >
                <Upload className="mr-2 h-4 w-4" />
                Import CSV
              </Button>
            </>
          ) : null}
          {canManageProducts ? (
            <Button asChild>
              <Link href="/dashboard/warehouse/items/new">
                <PackagePlus className="mr-2 h-4 w-4" />
                Create
              </Link>
            </Button>
          ) : null}
        </div>
      </div>
      {importMessage ? (
        <div className="rounded-md border bg-muted/30 px-3 py-2 text-sm text-muted-foreground">
          {importMessage}
        </div>
      ) : null}

      {viewMode === "variants" ? (
        <FlatVariantTable products={initialData.rows} />
      ) : (
        <DataView<InventoryProductListRow, InventoryProductDetail>
          entity="inventory-products"
          columns={columns}
          filters={filters}
          initialData={initialData}
          queryKey={["inventory-products"]}
          listFetcher={listFetcher}
          detailFetcher={detailFetcher}
          getRowId={(row) => row.id}
          renderCompactItem={(row) => <ProductSidebarItem product={row} />}
          renderExpandedRow={(row) =>
            row.variant_count > 1 && expandedProductIds[row.id] ? (
              <ExpandedVariantRows product={row} />
            ) : null
          }
          renderDetail={(detail) => (
            <div className="space-y-4">
              <div>
                <h2 className="text-lg font-semibold">{detail.name}</h2>
                <p className="text-sm text-muted-foreground">
                  {detail.variant_count > 1 ? `${detail.variant_count} variants` : detail.sku}
                </p>
              </div>
              <p className="text-sm">{detail.description ?? "No description"}</p>
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div>
                  <p className="text-xs uppercase text-muted-foreground">Type</p>
                  <p>{detail.product_type}</p>
                </div>
                <div>
                  <p className="text-xs uppercase text-muted-foreground">Status</p>
                  <p>{detail.status}</p>
                </div>
                <div>
                  <p className="text-xs uppercase text-muted-foreground">On hand</p>
                  <p>
                    {detail.on_hand_quantity} {detail.unit_code}
                  </p>
                </div>
                <div>
                  <p className="text-xs uppercase text-muted-foreground">Available</p>
                  <p>
                    {detail.available_quantity} {detail.unit_code}
                  </p>
                </div>
              </div>
              <div>
                <p className="mb-2 text-xs uppercase text-muted-foreground">Variants</p>
                {detail.variant_count > 1 ? (
                  <div className="overflow-hidden rounded-md border">
                    {detail.variants.map((variant) => (
                      <div
                        key={variant.id}
                        className="grid grid-cols-[1fr_auto_auto] gap-3 border-b p-2 text-sm last:border-b-0"
                      >
                        <div className="min-w-0">
                          <span className="font-medium">{variant.name}</span>
                          <span className="ml-2 text-muted-foreground">{variant.sku}</span>
                        </div>
                        <span className="tabular-nums">
                          {variant.on_hand_quantity} {detail.unit_code}
                        </span>
                        <span className="text-muted-foreground">{variant.status}</span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground">This is a simple item.</p>
                )}
              </div>
              <div className="flex gap-2">
                <Button asChild size="sm">
                  <Link
                    href={{
                      pathname: "/dashboard/warehouse/items/[productId]",
                      params: { productId: detail.id },
                    }}
                  >
                    Open profile
                  </Link>
                </Button>
                {canManageProducts ? (
                  <Button asChild size="sm" variant="outline">
                    <Link
                      href={{
                        pathname: "/dashboard/warehouse/items/[productId]/edit",
                        params: { productId: detail.id },
                      }}
                    >
                      <Edit className="mr-2 h-4 w-4" />
                      Edit
                    </Link>
                  </Button>
                ) : null}
              </div>
            </div>
          )}
          className="min-h-0 flex-1"
        />
      )}
    </div>
  );
}

function ProductSidebarItem({ product }: { product: InventoryProductListRow }) {
  return (
    <span className="flex min-w-0 items-center gap-3">
      <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded border bg-muted">
        {product.thumbnail_url ? (
          <Image
            src={product.thumbnail_url}
            alt=""
            width={32}
            height={32}
            unoptimized
            className="h-full w-full rounded object-cover"
          />
        ) : (
          <PackagePlus className="h-4 w-4 text-muted-foreground" />
        )}
      </span>
      <span className="min-w-0">
        <span className="block truncate font-medium">{product.name}</span>
        <span className="block truncate text-xs text-muted-foreground">
          {product.variant_count > 1 ? `${product.variant_count} variants` : product.sku}
        </span>
      </span>
    </span>
  );
}

function ExpandedVariantRows({ product }: { product: InventoryProductListRow }) {
  return (
    <div className="border-t bg-muted/20 px-14 py-3">
      <div className="overflow-hidden rounded-md border bg-background">
        <div className="grid grid-cols-[minmax(220px,1fr)_160px_120px_120px_120px] gap-3 border-b bg-muted/40 px-3 py-2 text-xs font-semibold uppercase text-muted-foreground">
          <span>Variant</span>
          <span>SKU</span>
          <span className="text-right">On hand</span>
          <span className="text-right">Available</span>
          <span>Status</span>
        </div>
        {product.variants.map((variant) => (
          <div
            key={variant.id}
            className="grid grid-cols-[minmax(220px,1fr)_160px_120px_120px_120px] gap-3 border-b px-3 py-2 text-sm last:border-b-0"
          >
            <span className="truncate font-medium">{variant.name}</span>
            <span className="truncate text-muted-foreground">{variant.sku}</span>
            <span className="text-right tabular-nums">
              {variant.on_hand_quantity} {product.unit_code}
            </span>
            <span className="text-right tabular-nums">
              {variant.available_quantity} {product.unit_code}
            </span>
            <span>{variant.status}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function FlatVariantTable({ products }: { products: InventoryProductListRow[] }) {
  const rows = products.flatMap((product) =>
    product.variant_count > 1 ? product.variants.map((variant) => ({ product, variant })) : []
  );

  return (
    <div className="min-h-0 flex-1 overflow-auto rounded-lg border bg-background">
      <table className="w-full min-w-[900px] text-sm">
        <thead className="sticky top-0 bg-background text-xs uppercase text-muted-foreground">
          <tr className="border-b">
            <th className="px-3 py-2 text-left">Variant</th>
            <th className="px-3 py-2 text-left">Product</th>
            <th className="px-3 py-2 text-left">SKU</th>
            <th className="px-3 py-2 text-right">On hand</th>
            <th className="px-3 py-2 text-right">Available</th>
            <th className="px-3 py-2 text-left">Status</th>
          </tr>
        </thead>
        <tbody>
          {rows.map(({ product, variant }) => (
            <tr key={variant.id} className="border-b last:border-b-0">
              <td className="px-3 py-2 font-medium">{variant.name}</td>
              <td className="px-3 py-2">
                <Link
                  href={{
                    pathname: "/dashboard/warehouse/items/[productId]",
                    params: { productId: product.id },
                  }}
                  className="text-primary hover:underline"
                >
                  {product.name}
                </Link>
              </td>
              <td className="px-3 py-2 text-muted-foreground">{variant.sku}</td>
              <td className="px-3 py-2 text-right tabular-nums">
                {variant.on_hand_quantity} {product.unit_code}
              </td>
              <td className="px-3 py-2 text-right tabular-nums">
                {variant.available_quantity} {product.unit_code}
              </td>
              <td className="px-3 py-2">{variant.status}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
