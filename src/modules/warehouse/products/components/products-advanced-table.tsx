"use client";

import * as React from "react";
import { AdvancedDataTable, ColumnConfig } from "@/components/ui/advanced-data-table";
import type { ProductWithDetails } from "@/modules/warehouse/types/products";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Edit, Trash2, Package, Clock, ArrowRightLeft } from "lucide-react";
import { useTranslations } from "next-intl";

interface ProductsAdvancedTableProps {
  products: ProductWithDetails[];
  loading?: boolean;
  error?: string | null;
  onEdit?: (product: ProductWithDetails) => void;
  onDelete?: (product: ProductWithDetails) => void;
  onAdd?: () => void;
}

export function ProductsAdvancedTable({
  products,
  loading = false,
  error = null,
  onEdit,
  onDelete,
  onAdd,
}: ProductsAdvancedTableProps) {
  const t = useTranslations("productsModule");

  const columns: ColumnConfig<ProductWithDetails>[] = [
    {
      key: "name",
      header: t("basicInfo.name"),
      sortable: true,
      filterType: "text",
      isPrimary: true,
      showInMobile: true,
      render: (value, row) => (
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-[#10b981]/10">
            <Package className="h-5 w-5 text-[#10b981]" />
          </div>
          <div>
            <div className="font-medium">{value}</div>
            <div className="text-sm text-muted-foreground">{row.sku && `SKU: ${row.sku}`}</div>
          </div>
        </div>
      ),
      renderSidebar: (value, row) => (
        <div>
          <div className="font-medium">{value}</div>
          {row.sku && <div className="text-xs text-muted-foreground">SKU: {row.sku}</div>}
        </div>
      ),
    },
    {
      key: "product_type",
      header: t("basicInfo.productType"),
      sortable: true,
      filterType: "select",
      filterOptions: [
        { label: t("productType.goods"), value: "goods" },
        { label: t("productType.service"), value: "service" },
      ],
      showInMobile: true,
      render: (value) => (
        <Badge variant="outline" className="text-xs">
          {value === "goods" ? t("productType.goods") : t("productType.service")}
        </Badge>
      ),
    },
    {
      key: "selling_price",
      header: t("salesInfo.sellingPrice"),
      sortable: true,
      filterType: "number-range",
      showInMobile: true,
      render: (value) => (
        <div className="text-sm font-medium">{value?.toFixed(2) || "0.00"} PLN</div>
      ),
    },
    {
      key: "cost_price",
      header: t("purchaseInfo.costPrice"),
      sortable: true,
      filterType: "number-range",
      render: (value) => <div className="text-sm">{value?.toFixed(2) || "0.00"} PLN</div>,
    },
    {
      key: "opening_stock",
      header: t("inventorySettings.openingStock"),
      sortable: true,
      filterType: "number-range",
      render: (value, row) =>
        row.product_type === "goods" && row.track_inventory ? (
          <div className="text-sm">
            {value || 0} {row.unit}
          </div>
        ) : (
          <span className="text-sm text-muted-foreground">—</span>
        ),
    },
    {
      key: "status",
      header: "Status",
      sortable: true,
      filterType: "select",
      filterOptions: [
        { label: t("status.active"), value: "active" },
        { label: t("status.inactive"), value: "inactive" },
        { label: t("status.archived"), value: "archived" },
      ],
      showInMobile: true,
      render: (value) => (
        <Badge
          variant={
            value === "active" ? "default" : value === "inactive" ? "secondary" : "destructive"
          }
          className="text-xs"
        >
          {t(`status.${value}`)}
        </Badge>
      ),
    },
  ];

  // Custom detail panel renderer - PROPER InFlow/Zoho style
  const renderDetail = (product: ProductWithDetails) => (
    <div className="flex h-full flex-col bg-white">
      {/* Header with product name and actions */}
      <div className="flex items-center justify-between border-b px-6 py-4">
        <h1 className="text-2xl font-semibold text-[#0066CC]">{product.name}</h1>
        <div className="flex gap-2">
          {onEdit && (
            <Button variant="outline" size="sm" onClick={() => onEdit(product)}>
              <Edit className="mr-2 h-4 w-4" />
              Edit
            </Button>
          )}
          {onDelete && (
            <Button
              variant="outline"
              size="sm"
              className="text-red-600 hover:text-red-700"
              onClick={() => onDelete(product)}
            >
              <Trash2 className="mr-2 h-4 w-4" />
              Delete
            </Button>
          )}
        </div>
      </div>

      {/* SKU and Returnable badge */}
      <div className="border-b px-6 py-3">
        <div className="flex items-center gap-3 text-sm text-muted-foreground">
          <span className="font-medium">SKU</span>
          <span>{product.sku || "—"}</span>
          {product.returnable_item && (
            <Badge variant="outline" className="ml-2">
              Returnable Item
            </Badge>
          )}
        </div>
      </div>

      {/* Tabs - InFlow rounded pill style */}
      <Tabs defaultValue="overview" className="flex flex-1 flex-col overflow-hidden">
        <div className="border-b px-6 pt-4">
          <TabsList className="h-auto rounded-full bg-transparent p-0">
            <TabsTrigger
              value="overview"
              className="rounded-full data-[state=active]:bg-[#0066CC] data-[state=active]:text-white"
            >
              Overview
            </TabsTrigger>
            <TabsTrigger
              value="transactions"
              className="rounded-full data-[state=active]:bg-[#0066CC] data-[state=active]:text-white"
            >
              Transactions
            </TabsTrigger>
            <TabsTrigger
              value="history"
              className="rounded-full data-[state=active]:bg-[#0066CC] data-[state=active]:text-white"
            >
              History
            </TabsTrigger>
          </TabsList>
        </div>

        {/* Overview Tab - InFlow layout with image and 2-column grid */}
        <TabsContent value="overview" className="flex-1 overflow-auto p-6">
          <div className="grid gap-6 lg:grid-cols-[300px_1fr]">
            {/* Left: Product Image */}
            <div className="flex flex-col gap-4">
              <div className="flex aspect-square items-center justify-center rounded-lg border-2 border-dashed bg-muted/30">
                <div className="text-center">
                  <Package className="mx-auto mb-2 h-12 w-12 text-muted-foreground/50" />
                  <p className="text-sm text-muted-foreground">Drag image(s) here or</p>
                  <button className="mt-1 text-sm text-[#0066CC] hover:underline">
                    Browse images
                  </button>
                  <p className="mt-2 text-xs text-muted-foreground">
                    You can add up to 15 images, each not exceeding 5 MB
                  </p>
                </div>
              </div>
            </div>

            {/* Right: Product Information in 2-column grid like InFlow */}
            <div className="space-y-8">
              {/* Description */}
              {product.description && (
                <p className="text-sm leading-relaxed text-muted-foreground">
                  {product.description}
                </p>
              )}

              {/* Product Information - 2 columns side by side like InFlow */}
              <div className="grid grid-cols-2 gap-x-12 gap-y-4">
                {/* Column 1 */}
                <div className="space-y-4">
                  <div>
                    <div className="mb-1 text-xs font-medium text-muted-foreground">SKU</div>
                    <div className="text-sm">{product.sku || "—"}</div>
                  </div>

                  {product.barcodes && product.barcodes.length > 0 && (
                    <div>
                      <div className="mb-1 text-xs font-medium text-muted-foreground">Barcode</div>
                      <div className="space-y-1">
                        {product.barcodes.map((barcode, idx) => (
                          <div key={idx} className="flex items-center gap-2 text-sm">
                            <code className="font-mono">{barcode.barcode}</code>
                            {barcode.is_primary && (
                              <Badge variant="outline" className="text-xs">
                                Primary
                              </Badge>
                            )}
                          </div>
                        ))}
                      </div>
                      <button className="mt-1 text-xs text-[#0066CC] hover:underline">
                        Manage barcodes
                      </button>
                    </div>
                  )}

                  {product.dimensions_length && (
                    <div>
                      <div className="mb-1 text-xs font-medium text-muted-foreground">
                        Dimensions
                      </div>
                      <div className="text-sm">
                        {product.dimensions_length} × {product.dimensions_width} ×{" "}
                        {product.dimensions_height} {product.dimensions_unit}
                      </div>
                      <div className="text-xs text-muted-foreground">
                        {product.weight && `${product.weight} ${product.weight_unit}`}
                      </div>
                    </div>
                  )}

                  <div>
                    <div className="mb-1 text-xs font-medium text-muted-foreground">Unit</div>
                    <div className="text-sm">{product.unit}</div>
                  </div>
                </div>

                {/* Column 2 */}
                <div className="space-y-4">
                  {product.brand && (
                    <div>
                      <div className="mb-1 text-xs font-medium text-muted-foreground">Brand</div>
                      <div className="text-sm">{product.brand}</div>
                    </div>
                  )}

                  {product.manufacturer && (
                    <div>
                      <div className="mb-1 text-xs font-medium text-muted-foreground">
                        Manufacturer
                      </div>
                      <div className="text-sm">{product.manufacturer}</div>
                    </div>
                  )}

                  {product.upc && (
                    <div>
                      <div className="mb-1 text-xs font-medium text-muted-foreground">UPC</div>
                      <div className="text-sm">{product.upc}</div>
                    </div>
                  )}

                  {product.ean && (
                    <div>
                      <div className="mb-1 text-xs font-medium text-muted-foreground">EAN</div>
                      <div className="text-sm">{product.ean}</div>
                    </div>
                  )}

                  {product.mpn && (
                    <div>
                      <div className="mb-1 text-xs font-medium text-muted-foreground">MPN</div>
                      <div className="text-sm">{product.mpn}</div>
                    </div>
                  )}
                </div>
              </div>

              {/* Quantity on hand - Big blue InFlow style */}
              {product.product_type === "goods" && product.track_inventory && (
                <div className="rounded-lg bg-[#0066CC] p-6 text-white">
                  <div className="mb-2 text-sm font-medium">Quantity on hand</div>
                  <div className="text-4xl font-bold">{product.opening_stock || 0}</div>
                  <div className="mt-1 text-sm opacity-90">{product.unit}</div>
                </div>
              )}

              {/* Pricing & Cost - Clean layout like Zoho */}
              <div>
                <h3 className="mb-4 text-base font-semibold">Pricing & Cost</h3>
                <div className="grid grid-cols-2 gap-6">
                  <div>
                    <div className="mb-1 text-xs text-muted-foreground">Selling Price</div>
                    <div className="text-2xl font-semibold text-green-600">
                      {product.selling_price?.toFixed(2) || "0.00"} PLN
                    </div>
                  </div>
                  <div>
                    <div className="mb-1 text-xs text-muted-foreground">Cost Price</div>
                    <div className="text-2xl font-semibold">
                      {product.cost_price?.toFixed(2) || "0.00"} PLN
                    </div>
                  </div>
                </div>
              </div>

              {/* Additional inventory details */}
              {product.product_type === "goods" &&
                product.track_inventory &&
                product.opening_stock_rate && (
                  <div>
                    <h3 className="mb-4 text-base font-semibold">Inventory Details</h3>
                    <div className="space-y-3">
                      <div className="flex justify-between">
                        <span className="text-sm text-muted-foreground">Opening Stock Rate</span>
                        <span className="text-sm font-medium">
                          {product.opening_stock_rate.toFixed(2)} PLN
                        </span>
                      </div>
                    </div>
                  </div>
                )}
            </div>
          </div>
        </TabsContent>

        {/* Transactions Tab */}
        <TabsContent value="transactions" className="flex-1 overflow-auto p-4">
          <div className="flex flex-col items-center justify-center py-12 text-center">
            <ArrowRightLeft className="mb-3 h-12 w-12 text-muted-foreground/50" />
            <h3 className="mb-1 text-sm font-medium">No transactions yet</h3>
            <p className="text-xs text-muted-foreground">
              Product transactions will appear here once you start managing inventory
            </p>
          </div>
        </TabsContent>

        {/* History Tab */}
        <TabsContent value="history" className="flex-1 overflow-auto p-4">
          <div className="flex flex-col items-center justify-center py-12 text-center">
            <Clock className="mb-3 h-12 w-12 text-muted-foreground/50" />
            <h3 className="mb-1 text-sm font-medium">No history available</h3>
            <p className="text-xs text-muted-foreground">
              Product history and audit logs will appear here
            </p>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );

  return (
    <AdvancedDataTable
      data={products}
      columns={columns}
      loading={loading}
      error={error}
      emptyMessage={t("noProductsFound")}
      getRowId={(row) => row.id}
      renderDetail={renderDetail}
      selectable={false}
      showSearch={true}
      searchPlaceholder={t("filters.search")}
      responsive={true}
      onAdd={onAdd}
    />
  );
}
