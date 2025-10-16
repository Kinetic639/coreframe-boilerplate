"use client";

import * as React from "react";
import { AdvancedDataTable, ColumnConfig } from "@/components/ui/advanced-data-table";
import type { ProductWithDetails } from "@/modules/warehouse/types/products";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Edit, Trash2, Package, Barcode, DollarSign, Clock, ArrowRightLeft } from "lucide-react";
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

  // Custom detail panel renderer for the right sidebar - InFlow style with tabs
  const renderDetail = (product: ProductWithDetails) => (
    <div className="flex h-full flex-col">
      {/* Compact Header with Actions */}
      <div className="border-b bg-background p-4">
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-[#10b981]/10">
              <Package className="h-6 w-6 text-[#10b981]" />
            </div>
            <div>
              <h3 className="text-lg font-semibold">{product.name}</h3>
              <div className="flex items-center gap-1.5">
                <Badge variant="outline" className="text-xs">
                  {product.product_type === "goods"
                    ? t("productType.goods")
                    : t("productType.service")}
                </Badge>
                <Badge
                  variant={product.status === "active" ? "default" : "secondary"}
                  className="text-xs"
                >
                  {t(`status.${product.status}`)}
                </Badge>
              </div>
            </div>
          </div>
          <div className="flex gap-1">
            {onEdit && (
              <Button variant="outline" size="sm" className="h-8" onClick={() => onEdit(product)}>
                <Edit className="mr-1.5 h-3.5 w-3.5" />
                {t("actions.edit")}
              </Button>
            )}
            {onDelete && (
              <Button
                variant="outline"
                size="sm"
                className="h-8 text-red-600 hover:text-red-700"
                onClick={() => onDelete(product)}
              >
                <Trash2 className="mr-1.5 h-3.5 w-3.5" />
                {t("actions.delete")}
              </Button>
            )}
          </div>
        </div>
      </div>

      {/* Tabs Navigation */}
      <Tabs defaultValue="overview" className="flex flex-1 flex-col overflow-hidden">
        <TabsList className="w-full justify-start rounded-none border-b bg-background px-4">
          <TabsTrigger value="overview" className="gap-1.5">
            <Package className="h-3.5 w-3.5" />
            Overview
          </TabsTrigger>
          <TabsTrigger value="transactions" className="gap-1.5">
            <ArrowRightLeft className="h-3.5 w-3.5" />
            Transactions
          </TabsTrigger>
          <TabsTrigger value="history" className="gap-1.5">
            <Clock className="h-3.5 w-3.5" />
            History
          </TabsTrigger>
        </TabsList>

        {/* Overview Tab */}
        <TabsContent value="overview" className="flex-1 overflow-auto p-4">
          <div className="space-y-4">
            {/* Description */}
            {product.description && (
              <div>
                <p className="text-sm text-muted-foreground">{product.description}</p>
              </div>
            )}

            {/* Basic Information */}
            <div>
              <h4 className="mb-2 flex items-center gap-1.5 text-sm font-semibold">
                <Package className="h-3.5 w-3.5" />
                {t("basicInfo.title")}
              </h4>
              <div className="grid gap-2 text-sm">
                {product.sku && (
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">SKU:</span>
                    <span className="font-medium">{product.sku}</span>
                  </div>
                )}
                <div className="flex justify-between">
                  <span className="text-muted-foreground">{t("basicInfo.unit")}:</span>
                  <span className="font-medium">{product.unit}</span>
                </div>
                {product.brand && (
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">{t("basicInfo.brand")}:</span>
                    <span className="font-medium">{product.brand}</span>
                  </div>
                )}
                {product.manufacturer && (
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">{t("basicInfo.manufacturer")}:</span>
                    <span className="font-medium">{product.manufacturer}</span>
                  </div>
                )}
                <div className="flex justify-between">
                  <span className="text-muted-foreground">{t("basicInfo.returnableItem")}:</span>
                  <span className="font-medium">
                    {product.returnable_item ? t("yes") : t("no")}
                  </span>
                </div>
              </div>
            </div>

            {/* Barcodes */}
            {product.barcodes && product.barcodes.length > 0 && (
              <>
                <Separator />
                <div>
                  <h4 className="mb-2 flex items-center gap-1.5 text-sm font-semibold">
                    <Barcode className="h-3.5 w-3.5" />
                    {t("barcodes.title")}
                  </h4>
                  <div className="space-y-2">
                    {product.barcodes.map((barcode, idx) => (
                      <div
                        key={idx}
                        className="flex items-center justify-between rounded-lg bg-muted/50 p-2"
                      >
                        <code className="font-mono text-sm">{barcode.barcode}</code>
                        {barcode.is_primary && (
                          <Badge variant="secondary" className="text-xs">
                            {t("barcodes.primary")}
                          </Badge>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              </>
            )}

            {/* Identifiers */}
            {(product.upc || product.ean || product.isbn || product.mpn) && (
              <>
                <Separator />
                <div>
                  <h4 className="mb-2 text-sm font-semibold">{t("identifiers.title")}</h4>
                  <div className="grid gap-2 text-sm">
                    {product.upc && (
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">UPC:</span>
                        <span className="font-medium">{product.upc}</span>
                      </div>
                    )}
                    {product.ean && (
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">EAN:</span>
                        <span className="font-medium">{product.ean}</span>
                      </div>
                    )}
                    {product.isbn && (
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">ISBN:</span>
                        <span className="font-medium">{product.isbn}</span>
                      </div>
                    )}
                    {product.mpn && (
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">MPN:</span>
                        <span className="font-medium">{product.mpn}</span>
                      </div>
                    )}
                  </div>
                </div>
              </>
            )}

            {/* Measurements */}
            {(product.dimensions_length || product.weight) && (
              <>
                <Separator />
                <div>
                  <h4 className="mb-2 text-sm font-semibold">{t("measurements.title")}</h4>
                  <div className="grid gap-2 text-sm">
                    {product.dimensions_length && (
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">
                          {t("measurements.dimensions")}:
                        </span>
                        <span className="font-medium">
                          {product.dimensions_length} × {product.dimensions_width} ×{" "}
                          {product.dimensions_height} {product.dimensions_unit}
                        </span>
                      </div>
                    )}
                    {product.weight && (
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">{t("measurements.weight")}:</span>
                        <span className="font-medium">
                          {product.weight} {product.weight_unit}
                        </span>
                      </div>
                    )}
                  </div>
                </div>
              </>
            )}

            {/* Pricing */}
            <Separator />
            <div>
              <h4 className="mb-2 flex items-center gap-1.5 text-sm font-semibold">
                <DollarSign className="h-3.5 w-3.5" />
                {t("pricing.title")}
              </h4>
              <div className="grid grid-cols-2 gap-3">
                <div className="rounded-lg bg-muted/50 p-2.5">
                  <div className="text-xs text-muted-foreground">{t("salesInfo.sellingPrice")}</div>
                  <div className="mt-1 text-lg font-bold text-green-600">
                    {product.selling_price?.toFixed(2) || "0.00"} PLN
                  </div>
                </div>
                <div className="rounded-lg bg-muted/50 p-2.5">
                  <div className="text-xs text-muted-foreground">{t("purchaseInfo.costPrice")}</div>
                  <div className="mt-1 text-lg font-bold">
                    {product.cost_price?.toFixed(2) || "0.00"} PLN
                  </div>
                </div>
              </div>
            </div>

            {/* Inventory */}
            {product.product_type === "goods" && product.track_inventory && (
              <>
                <Separator />
                <div>
                  <h4 className="mb-2 text-sm font-semibold">{t("inventorySettings.title")}</h4>
                  <div className="grid gap-2 text-sm">
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">
                        {t("inventorySettings.trackInventory")}:
                      </span>
                      <span className="font-medium">{t("yes")}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">
                        {t("inventorySettings.openingStock")}:
                      </span>
                      <span className="font-medium">
                        {product.opening_stock || 0} {product.unit}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">
                        {t("inventorySettings.reorderPoint")}:
                      </span>
                      <span className="font-medium">
                        {product.reorder_point || 0} {product.unit}
                      </span>
                    </div>
                    {product.opening_stock_rate && (
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">
                          {t("inventorySettings.openingStockRate")}:
                        </span>
                        <span className="font-medium">
                          {product.opening_stock_rate.toFixed(2)} PLN
                        </span>
                      </div>
                    )}
                  </div>
                </div>
              </>
            )}
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
