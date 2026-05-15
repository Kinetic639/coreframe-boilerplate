"use client";

import { useMemo, useRef, useState, useTransition } from "react";
import type React from "react";
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
import { Switch } from "@/components/ui/switch";
import { cn } from "@/lib/utils";
import { useDataViewUrl } from "@/components/data-view/use-data-view";
import type {
  InventoryCustomFieldDefinition,
  InventoryProductImageRow,
  InventoryProductDetail,
  InventoryProductListRow,
  InventoryProductVariantListRow,
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

type ProductImportPreview = {
  rows: Array<{
    row_number: number;
    product_name: string;
    product_sku: string | null;
    variant_name: string;
    variant_sku: string;
    unit_code: string;
    errors: string[];
  }>;
  total_rows: number;
  valid_rows: number;
  invalid_rows: number;
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
  const [importMessage, setImportMessage] = useState<string | null>(null);
  const [importPreview, setImportPreview] = useState<ProductImportPreview | null>(null);
  const [importCsv, setImportCsv] = useState<string | null>(null);
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
          return (
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
    [customFields]
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
  ];

  return (
    <div className="flex h-full flex-col gap-4">
      <div className="flex items-center justify-between gap-3 border-b pb-4">
        <div />
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
                    setImportMessage(null);
                    setImportPreview(null);
                    setImportCsv(null);
                    const csv = await file.text();
                    const preview = await previewInventoryProductsCsvImportAction({ csv });
                    if (!preview.success || !("data" in preview)) {
                      setImportMessage(
                        "error" in preview ? preview.error : "Import preview failed"
                      );
                      return;
                    }
                    setImportPreview(preview.data);
                    setImportCsv(csv);
                    setImportMessage(
                      preview.data.invalid_rows > 0
                        ? `Review ${preview.data.invalid_rows} invalid rows before importing.`
                        : `Preview ready: ${preview.data.valid_rows} rows can be imported.`
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
      {importPreview ? (
        <div className="rounded-md border bg-background">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b px-3 py-2">
            <div>
              <p className="text-sm font-medium">Import preview</p>
              <p className="text-xs text-muted-foreground">
                {importPreview.valid_rows} valid, {importPreview.invalid_rows} invalid,{" "}
                {importPreview.total_rows} total rows
              </p>
            </div>
            <div className="flex gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => {
                  setImportPreview(null);
                  setImportCsv(null);
                  setImportMessage(null);
                }}
              >
                Clear
              </Button>
              <Button
                type="button"
                size="sm"
                disabled={isImportPending || importPreview.invalid_rows > 0 || !importCsv}
                onClick={() => {
                  if (!importCsv) return;
                  startImportTransition(async () => {
                    const imported = await importInventoryProductsCsvAction({ csv: importCsv });
                    setImportMessage(
                      imported.success && "data" in imported
                        ? `Imported ${imported.data.imported_products} products and ${imported.data.imported_variants} variants.`
                        : "error" in imported
                          ? imported.error
                          : "Import failed"
                    );
                    if (imported.success) {
                      setImportPreview(null);
                      setImportCsv(null);
                    }
                  });
                }}
              >
                Confirm import
              </Button>
            </div>
          </div>
          <div className="max-h-72 overflow-auto">
            <table className="min-w-full text-sm">
              <thead className="sticky top-0 bg-muted text-xs uppercase text-muted-foreground">
                <tr>
                  <th className="px-3 py-2 text-left">Row</th>
                  <th className="px-3 py-2 text-left">Product</th>
                  <th className="px-3 py-2 text-left">Variant</th>
                  <th className="px-3 py-2 text-left">SKU</th>
                  <th className="px-3 py-2 text-left">Unit</th>
                  <th className="px-3 py-2 text-left">Status</th>
                </tr>
              </thead>
              <tbody>
                {importPreview.rows.slice(0, 200).map((row) => (
                  <tr key={row.row_number} className="border-t">
                    <td className="px-3 py-2 text-muted-foreground">{row.row_number}</td>
                    <td className="px-3 py-2">{row.product_name || "-"}</td>
                    <td className="px-3 py-2">{row.variant_name || "-"}</td>
                    <td className="px-3 py-2">{row.variant_sku || "-"}</td>
                    <td className="px-3 py-2">{row.unit_code || "-"}</td>
                    <td className="px-3 py-2">
                      {row.errors.length > 0 ? (
                        <span className="text-destructive">{row.errors.join(", ")}</span>
                      ) : (
                        <span className="text-emerald-600">Ready</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {importPreview.rows.length > 200 ? (
              <p className="border-t px-3 py-2 text-xs text-muted-foreground">
                Showing first 200 rows. The full file will be imported after confirmation.
              </p>
            ) : null}
          </div>
        </div>
      ) : null}

      <DataView<InventoryProductListRow, InventoryProductDetail>
        entity="inventory-products"
        columns={columns}
        filters={filters}
        initialData={initialData}
        queryKey={["inventory-products"]}
        listFetcher={listFetcher}
        detailFetcher={detailFetcher}
        getRowId={(row) => row.row_id}
        renderCompactItem={(row) => <ProductSidebarItem product={row} />}
        renderExpandedRow={(row) =>
          !row.is_variant_row && row.variant_count > 1 && expandedProductIds[row.id] ? (
            <ExpandedVariantRows product={row} />
          ) : null
        }
        renderRowControl={(row) => {
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
        }}
        renderToolbarControls={() => <VariantGroupingControl />}
        renderDetail={(detail) => (
          <ProductDetailPanel
            detail={detail}
            customFields={customFields}
            canManageProducts={canManageProducts}
          />
        )}
        className="min-h-0 flex-1"
      />
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
          {product.is_variant_row && product.parent_product_name
            ? `${product.parent_product_name} · ${product.sku}`
            : product.variant_count > 1
              ? `${product.variant_count} variants`
              : product.sku}
        </span>
      </span>
    </span>
  );
}

function VariantGroupingControl() {
  const { urlState } = useDataViewUrl();
  const grouped = urlState.filters.__group_variants !== false;

  return (
    <label className="flex h-8 shrink-0 items-center gap-2 rounded-md border px-2 text-xs">
      <Switch
        checked={grouped}
        onCheckedChange={(checked) => {
          const next = { ...urlState.filters };
          if (checked) {
            delete next.__group_variants;
            delete next.is_variant;
          } else {
            next.__group_variants = false;
          }
          urlState.setFilters(next);
        }}
        className="h-4 w-7 [&>span]:h-3 [&>span]:w-3 [&>span]:data-[state=checked]:translate-x-3"
        aria-label="Group variants"
      />
      <span>Group variants</span>
    </label>
  );
}

function ExpandedVariantRows({ product }: { product: InventoryProductListRow }) {
  return (
    <div className="border-t bg-muted/20 px-14 py-3">
      <div className="overflow-hidden rounded-md border bg-background">
        <div className="grid grid-cols-[48px_minmax(220px,1fr)_160px_180px_120px_120px_120px] gap-3 border-b bg-muted/40 px-3 py-2 text-xs font-semibold uppercase text-muted-foreground">
          <span>Image</span>
          <span>Variant</span>
          <span>SKU</span>
          <span>Attributes</span>
          <span className="text-right">On hand</span>
          <span className="text-right">Available</span>
          <span>Status</span>
        </div>
        {product.variants.map((variant) => (
          <div
            key={variant.id}
            className="grid grid-cols-[48px_minmax(220px,1fr)_160px_180px_120px_120px_120px] items-center gap-3 border-b px-3 py-2 text-sm last:border-b-0"
          >
            <ProductImageThumb src={variant.thumbnail_url} className="h-9 w-9" />
            <span className="truncate font-medium">{variant.name}</span>
            <span className="truncate text-muted-foreground">{variant.sku}</span>
            <VariantOptionSummary variant={variant} />
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

function ProductDetailPanel({
  detail,
  customFields,
  canManageProducts,
}: {
  detail: InventoryProductDetail;
  customFields: InventoryCustomFieldDefinition[];
  canManageProducts: boolean;
}) {
  const [selectedImageId, setSelectedImageId] = useState<string | null>(null);
  const [expandedVariantIds, setExpandedVariantIds] = useState<Record<string, true>>({});
  const hasVisibleVariants = detail.variant_count > 1;
  const simpleVariant = hasVisibleVariants ? null : detail.variants[0];
  const productImages = detail.images
    .filter((image) => !image.variant_id)
    .sort((a, b) => Number(b.is_primary) - Number(a.is_primary) || a.sort_order - b.sort_order);
  const selectedImage =
    productImages.find((image) => image.id === selectedImageId) ??
    productImages.find((image) => image.is_primary) ??
    productImages[0];
  const selectedImageUrl = imageUrl(selectedImage) ?? detail.thumbnail_url;
  const customFieldRows = customFields
    .map((field) => ({ field, value: detail.custom_field_values[field.id] }))
    .filter((row) => row.value);

  return (
    <div className="space-y-5">
      <section className="grid gap-5 xl:grid-cols-[minmax(220px,300px)_1fr]">
        <div className="space-y-3">
          <div className="grid aspect-square max-h-[300px] place-items-center overflow-hidden rounded-md border bg-muted/30">
            {selectedImageUrl ? (
              <Image
                src={selectedImageUrl}
                alt=""
                width={300}
                height={300}
                unoptimized
                className="h-full w-full object-cover"
              />
            ) : (
              <PackagePlus className="h-10 w-10 text-muted-foreground" />
            )}
          </div>
          {productImages.length > 0 ? (
            <div className="flex flex-wrap gap-2">
              {productImages.map((image) => {
                const url = imageUrl(image);
                if (!url) return null;
                const active = (selectedImage?.id ?? null) === image.id;
                return (
                  <button
                    key={image.id}
                    type="button"
                    className={cn(
                      "h-12 w-12 overflow-hidden rounded border bg-muted",
                      active && "border-primary ring-1 ring-primary"
                    )}
                    onClick={() => setSelectedImageId(image.id)}
                    aria-label="Preview product image"
                  >
                    <Image
                      src={url}
                      alt=""
                      width={48}
                      height={48}
                      unoptimized
                      className="h-full w-full object-cover"
                    />
                  </button>
                );
              })}
            </div>
          ) : null}
        </div>

        <div className="min-w-0 space-y-4">
          <div>
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="min-w-0">
                <h2 className="truncate text-xl font-semibold">{detail.name}</h2>
                <p className="text-sm text-muted-foreground">
                  {hasVisibleVariants ? `${detail.variant_count} variants` : detail.sku || "No SKU"}
                </p>
              </div>
              <Badge variant={statusVariant[detail.status] ?? "outline"}>{detail.status}</Badge>
            </div>
            <p className="mt-3 text-sm text-muted-foreground">
              {detail.description ?? "No description"}
            </p>
            <TagChips tags={detail.tags} className="mt-3" />
          </div>

          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            <DetailFact label="Type" value={detail.product_type.replace("_", " ")} />
            <DetailFact label="Unit" value={detail.unit_code || "-"} />
            <DetailFact label="On hand" value={`${detail.on_hand_quantity} ${detail.unit_code}`} />
            <DetailFact
              label="Available"
              value={`${detail.available_quantity} ${detail.unit_code}`}
            />
            <DetailFact label="Brand" value={detail.brand_name ?? "Not set"} />
            <DetailFact label="Manufacturer" value={detail.manufacturer_name ?? "Not set"} />
            <DetailFact label="Dimensions" value={formatDimensions(detail)} />
            <DetailFact label="Weight" value={formatWeight(detail)} />
            <DetailFact label="Returnable" value={detail.returnable ? "Yes" : "No"} />
          </div>

          {simpleVariant ? (
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
              <DetailFact label="Barcode" value={simpleVariant.barcode ?? "Not set"} />
              <DetailFact label="Purchase" value={formatPrice(simpleVariant, "purchase_price")} />
              <DetailFact label="Sales" value={formatPrice(simpleVariant, "sales_price")} />
              <DetailFact
                label="Reorder point"
                value={
                  simpleVariant.reorder_point == null ? "Not set" : simpleVariant.reorder_point
                }
              />
            </div>
          ) : null}
        </div>
      </section>

      {customFieldRows.length > 0 ? (
        <section className="rounded-md border p-3">
          <p className="mb-3 text-xs font-semibold uppercase text-muted-foreground">
            Custom fields
          </p>
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {customFieldRows.map(({ field, value }) => (
              <DetailFact key={field.id} label={field.name} value={value} />
            ))}
          </div>
        </section>
      ) : null}

      {detail.sales_description || detail.purchase_description ? (
        <section className="grid gap-3 md:grid-cols-2">
          <DescriptionBlock title="Sales description" value={detail.sales_description} />
          <DescriptionBlock title="Purchase description" value={detail.purchase_description} />
        </section>
      ) : null}

      {hasVisibleVariants ? (
        <section>
          <p className="mb-2 text-xs font-semibold uppercase text-muted-foreground">Variants</p>
          <div className="overflow-hidden rounded-md border">
            {detail.variants.map((variant) => {
              const variantImages = detail.images.filter(
                (image) => image.variant_id === variant.id
              );
              const variantCustomFieldRows = customFields
                .filter((field) => field.entity_type === "variant")
                .map((field) => ({ field, value: variant.custom_field_values[field.id] }))
                .filter((row) => row.value);
              const expanded = !!expandedVariantIds[variant.id];
              return (
                <div key={variant.id} className="border-b last:border-b-0">
                  <button
                    type="button"
                    className="grid w-full grid-cols-[44px_1fr_auto] items-center gap-3 px-3 py-2 text-left text-sm hover:bg-muted/50"
                    onClick={() =>
                      setExpandedVariantIds((current) => {
                        const next = { ...current };
                        if (next[variant.id]) delete next[variant.id];
                        else next[variant.id] = true;
                        return next;
                      })
                    }
                    aria-expanded={expanded}
                  >
                    <ProductImageThumb src={variant.thumbnail_url} className="h-9 w-9" />
                    <span className="min-w-0">
                      <span className="block truncate font-medium">{variant.name}</span>
                      <span className="block truncate text-xs text-muted-foreground">
                        {variant.sku}
                      </span>
                      <VariantOptionSummary variant={variant} className="mt-1" />
                    </span>
                    <span className="flex items-center gap-3">
                      <span className="hidden text-right text-xs text-muted-foreground sm:block">
                        {variant.available_quantity} {detail.unit_code} available
                      </span>
                      {expanded ? (
                        <ChevronDown className="h-4 w-4 text-muted-foreground" />
                      ) : (
                        <ChevronRight className="h-4 w-4 text-muted-foreground" />
                      )}
                    </span>
                  </button>
                  {expanded ? (
                    <div className="grid gap-3 border-t bg-muted/20 p-3 md:grid-cols-[minmax(160px,220px)_1fr]">
                      <VariantImageGallery
                        images={variantImages}
                        fallback={variant.thumbnail_url}
                      />
                      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                        <DetailFact
                          label="On hand"
                          value={`${variant.on_hand_quantity} ${detail.unit_code}`}
                        />
                        <DetailFact
                          label="Available"
                          value={`${variant.available_quantity} ${detail.unit_code}`}
                        />
                        <DetailFact
                          label="Reorder point"
                          value={variant.reorder_point == null ? "Not set" : variant.reorder_point}
                        />
                        <DetailFact label="Status" value={variant.status} />
                        <DetailFact label="Barcode" value={variant.barcode ?? "Not set"} />
                        <DetailFact
                          label="Purchase"
                          value={formatPrice(variant, "purchase_price")}
                        />
                        <DetailFact label="Sales" value={formatPrice(variant, "sales_price")} />
                        <DetailFact
                          label="Attributes"
                          value={
                            variant.option_values.length > 0
                              ? variant.option_values
                                  .map((option) => `${option.option_group_name}: ${option.value}`)
                                  .join(", ")
                              : "Not set"
                          }
                        />
                        {variantCustomFieldRows.map(({ field, value }) => (
                          <DetailFact key={field.id} label={field.name} value={value} />
                        ))}
                      </div>
                    </div>
                  ) : null}
                </div>
              );
            })}
          </div>
        </section>
      ) : null}

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
  );
}

function ProductImageThumb({ src, className }: { src: string | null; className?: string }) {
  return (
    <span
      className={cn(
        "grid shrink-0 place-items-center overflow-hidden rounded border bg-muted",
        className
      )}
    >
      {src ? (
        <Image
          src={src}
          alt=""
          width={48}
          height={48}
          unoptimized
          className="h-full w-full object-cover"
        />
      ) : (
        <PackagePlus className="h-4 w-4 text-muted-foreground" />
      )}
    </span>
  );
}

function VariantImageGallery({
  images,
  fallback,
}: {
  images: InventoryProductImageRow[];
  fallback: string | null;
}) {
  const urls = images.map(imageUrl).filter((url): url is string => Boolean(url));
  const primary = urls[0] ?? fallback;

  return (
    <div className="space-y-2">
      <div className="grid aspect-square max-h-52 place-items-center overflow-hidden rounded-md border bg-background">
        {primary ? (
          <Image
            src={primary}
            alt=""
            width={220}
            height={220}
            unoptimized
            className="h-full w-full object-cover"
          />
        ) : (
          <PackagePlus className="h-8 w-8 text-muted-foreground" />
        )}
      </div>
      {urls.length > 1 ? (
        <div className="flex flex-wrap gap-1.5">
          {urls.slice(0, 8).map((url) => (
            <Image
              key={url}
              src={url}
              alt=""
              width={36}
              height={36}
              unoptimized
              className="h-9 w-9 rounded border object-cover"
            />
          ))}
        </div>
      ) : null}
    </div>
  );
}

function VariantOptionSummary({
  variant,
  className,
}: {
  variant: InventoryProductVariantListRow;
  className?: string;
}) {
  if (variant.option_values.length === 0) {
    return <span className={cn("text-xs text-muted-foreground", className)}>No attributes</span>;
  }

  return (
    <span className={cn("flex flex-wrap gap-1", className)}>
      {variant.option_values.map((option) => (
        <span
          key={`${variant.id}-${option.option_group_id}`}
          className="rounded border bg-background px-1.5 py-0.5 text-[11px] text-muted-foreground"
        >
          {option.option_group_name}: <span className="text-foreground">{option.value}</span>
        </span>
      ))}
    </span>
  );
}

function DetailFact({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="min-w-0 rounded-md border bg-muted/20 px-3 py-2">
      <p className="text-[11px] font-semibold uppercase text-muted-foreground">{label}</p>
      <div className="mt-1 truncate text-sm">{value}</div>
    </div>
  );
}

function TagChips({ tags, className }: { tags: string[]; className?: string }) {
  if (tags.length === 0) return null;

  return (
    <div className={cn("flex flex-wrap gap-1.5", className)}>
      {tags.map((tag) => (
        <Badge key={tag} variant="secondary" className="rounded-md text-xs">
          {tag}
        </Badge>
      ))}
    </div>
  );
}

function DescriptionBlock({ title, value }: { title: string; value: string | null }) {
  return (
    <div className="rounded-md border p-3">
      <p className="mb-2 text-xs font-semibold uppercase text-muted-foreground">{title}</p>
      <p className="text-sm text-muted-foreground">{value ?? "Not set"}</p>
    </div>
  );
}

function imageUrl(image: InventoryProductImageRow | undefined) {
  return image?.public_url ?? image?.storage_path ?? null;
}

function formatDimensions(detail: InventoryProductDetail) {
  if (!detail.length_value && !detail.width_value && !detail.height_value) return "Not set";
  return `${detail.length_value ?? "-"} x ${detail.width_value ?? "-"} x ${detail.height_value ?? "-"} ${detail.dimension_unit ?? ""}`.trim();
}

function formatWeight(detail: InventoryProductDetail) {
  if (!detail.weight_value) return "Not set";
  return `${detail.weight_value} ${detail.weight_unit ?? ""}`.trim();
}

function formatPrice(
  variant: InventoryProductVariantListRow,
  key: "purchase_price" | "sales_price"
) {
  const value = variant[key];
  if (value == null) return "Not set";
  return `${value} ${variant.price_currency ?? ""}`.trim();
}
