"use client";

import * as React from "react";
import { AdvancedDataTable, ColumnConfig } from "@/components/ui/advanced-data-table";
import type { ProductWithDetails } from "@/modules/warehouse/types/products";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import {
  Package,
  Barcode as BarcodeIcon,
  DollarSign,
  Edit,
  Trash2,
  Copy,
  Box,
  Ruler,
} from "lucide-react";
import { useTranslations } from "next-intl";

interface ProductsAdvancedTableProps {
  products: ProductWithDetails[];
  loading?: boolean;
  error?: string | null;
  onEdit?: (product: ProductWithDetails) => void;
  onDelete?: (product: ProductWithDetails) => void;
  onDuplicate?: (product: ProductWithDetails) => void;
  onAdd?: () => void;
}

export function ProductsAdvancedTable({
  products,
  loading = false,
  error = null,
  onEdit,
  onDelete,
  onDuplicate,
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
        <div className="space-y-1">
          <div className="font-medium">{value}</div>
          <div className="flex items-center gap-2">
            <Badge variant="outline" className="text-xs">
              {row.product_type === "goods" ? t("productType.goods") : t("productType.service")}
            </Badge>
            {row.sku && <span className="text-xs text-muted-foreground">SKU: {row.sku}</span>}
          </div>
        </div>
      ),
      renderSidebar: (value, row) => (
        <div>
          <div className="mb-2 text-lg font-semibold">{value}</div>
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <Badge variant="outline">
                {row.product_type === "goods" ? t("productType.goods") : t("productType.service")}
              </Badge>
              <Badge variant={row.status === "active" ? "default" : "secondary"}>
                {t(`status.${row.status}`)}
              </Badge>
            </div>
            {row.description && (
              <p className="line-clamp-3 text-sm text-muted-foreground">{row.description}</p>
            )}
          </div>
        </div>
      ),
      renderDetails: (value, row) => (
        <div className="space-y-6">
          {/* Basic Information */}
          <div>
            <h4 className="mb-3 flex items-center gap-2 font-semibold">
              <Package className="h-4 w-4" />
              {t("basicInfo.title")}
            </h4>
            <div className="grid grid-cols-2 gap-4 text-sm">
              {row.sku && (
                <div>
                  <span className="text-muted-foreground">SKU:</span>
                  <span className="ml-2 font-medium">{row.sku}</span>
                </div>
              )}
              {row.brand && (
                <div>
                  <span className="text-muted-foreground">{t("basicInfo.brand")}:</span>
                  <span className="ml-2 font-medium">{row.brand}</span>
                </div>
              )}
              {row.manufacturer && (
                <div>
                  <span className="text-muted-foreground">{t("basicInfo.manufacturer")}:</span>
                  <span className="ml-2 font-medium">{row.manufacturer}</span>
                </div>
              )}
              <div>
                <span className="text-muted-foreground">{t("basicInfo.unit")}:</span>
                <span className="ml-2 font-medium">{row.unit}</span>
              </div>
            </div>
          </div>

          {/* Barcodes */}
          {row.barcodes && row.barcodes.length > 0 && (
            <div>
              <h4 className="mb-3 flex items-center gap-2 font-semibold">
                <BarcodeIcon className="h-4 w-4" />
                {t("barcodes.title")}
              </h4>
              <div className="space-y-2">
                {row.barcodes.map((barcode, idx) => (
                  <div key={idx} className="flex items-center gap-2 text-sm">
                    <code className="rounded bg-muted px-2 py-1">{barcode.barcode}</code>
                    {barcode.is_primary && (
                      <Badge variant="secondary" className="text-xs">
                        {t("barcodes.isPrimary")}
                      </Badge>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Identifiers */}
          {(row.upc || row.ean || row.isbn || row.mpn) && (
            <div>
              <h4 className="mb-3 font-semibold">{t("identifiers.title")}</h4>
              <div className="grid grid-cols-2 gap-4 text-sm">
                {row.upc && (
                  <div>
                    <span className="text-muted-foreground">UPC:</span>
                    <span className="ml-2 font-medium">{row.upc}</span>
                  </div>
                )}
                {row.ean && (
                  <div>
                    <span className="text-muted-foreground">EAN:</span>
                    <span className="ml-2 font-medium">{row.ean}</span>
                  </div>
                )}
                {row.isbn && (
                  <div>
                    <span className="text-muted-foreground">ISBN:</span>
                    <span className="ml-2 font-medium">{row.isbn}</span>
                  </div>
                )}
                {row.mpn && (
                  <div>
                    <span className="text-muted-foreground">MPN:</span>
                    <span className="ml-2 font-medium">{row.mpn}</span>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Measurements */}
          {(row.dimensions_length ||
            row.dimensions_width ||
            row.dimensions_height ||
            row.weight) && (
            <div>
              <h4 className="mb-3 flex items-center gap-2 font-semibold">
                <Ruler className="h-4 w-4" />
                {t("measurements.title")}
              </h4>
              <div className="grid grid-cols-2 gap-4 text-sm">
                {(row.dimensions_length || row.dimensions_width || row.dimensions_height) && (
                  <div>
                    <span className="text-muted-foreground">{t("measurements.dimensions")}:</span>
                    <span className="ml-2 font-medium">
                      {row.dimensions_length || "—"} × {row.dimensions_width || "—"} ×{" "}
                      {row.dimensions_height || "—"} {row.dimensions_unit || "cm"}
                    </span>
                  </div>
                )}
                {row.weight && (
                  <div>
                    <span className="text-muted-foreground">{t("measurements.weight")}:</span>
                    <span className="ml-2 font-medium">
                      {row.weight} {row.weight_unit || "kg"}
                    </span>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Pricing */}
          <div>
            <h4 className="mb-3 flex items-center gap-2 font-semibold">
              <DollarSign className="h-4 w-4" />
              Pricing
            </h4>
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <span className="text-muted-foreground">{t("salesInfo.sellingPrice")}:</span>
                <span className="ml-2 font-medium">
                  {row.selling_price?.toFixed(2) || "0.00"} PLN
                </span>
              </div>
              <div>
                <span className="text-muted-foreground">{t("purchaseInfo.costPrice")}:</span>
                <span className="ml-2 font-medium">{row.cost_price?.toFixed(2) || "0.00"} PLN</span>
              </div>
            </div>
          </div>

          {/* Inventory */}
          {row.product_type === "goods" && row.track_inventory && (
            <div>
              <h4 className="mb-3 flex items-center gap-2 font-semibold">
                <Box className="h-4 w-4" />
                {t("inventorySettings.title")}
              </h4>
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <span className="text-muted-foreground">
                    {t("inventorySettings.openingStock")}:
                  </span>
                  <span className="ml-2 font-medium">
                    {row.opening_stock || 0} {row.unit}
                  </span>
                </div>
                <div>
                  <span className="text-muted-foreground">
                    {t("inventorySettings.reorderPoint")}:
                  </span>
                  <span className="ml-2 font-medium">
                    {row.reorder_point || 0} {row.unit}
                  </span>
                </div>
              </div>
            </div>
          )}

          {/* Actions */}
          <Separator />
          <div className="flex gap-2">
            {onEdit && (
              <Button variant="default" size="sm" onClick={() => onEdit(row)}>
                <Edit className="mr-2 h-4 w-4" />
                {t("actions.edit")}
              </Button>
            )}
            {onDuplicate && (
              <Button variant="outline" size="sm" onClick={() => onDuplicate(row)}>
                <Copy className="mr-2 h-4 w-4" />
                {t("actions.duplicate")}
              </Button>
            )}
            {onDelete && (
              <Button variant="destructive" size="sm" onClick={() => onDelete(row)}>
                <Trash2 className="mr-2 h-4 w-4" />
                {t("actions.delete")}
              </Button>
            )}
          </div>
        </div>
      ),
    },
    {
      key: "selling_price",
      header: t("salesInfo.sellingPrice"),
      sortable: true,
      filterType: "number",
      showInMobile: true,
      render: (value) => (
        <div className="flex items-center gap-1 text-sm font-medium">
          <DollarSign className="h-3 w-3 text-muted-foreground" />
          {value?.toFixed(2) || "0.00"} PLN
        </div>
      ),
    },
    {
      key: "cost_price",
      header: t("purchaseInfo.costPrice"),
      sortable: true,
      filterType: "number",
      render: (value) => (
        <div className="flex items-center gap-1 text-sm">
          <DollarSign className="h-3 w-3 text-muted-foreground" />
          {value?.toFixed(2) || "0.00"} PLN
        </div>
      ),
    },
    {
      key: "opening_stock",
      header: t("inventorySettings.openingStock"),
      sortable: true,
      filterType: "number",
      render: (value, row) =>
        row.product_type === "goods" && row.track_inventory ? (
          <div className="flex items-center gap-1 text-sm">
            <Box className="h-3 w-3 text-muted-foreground" />
            {value || 0} {row.unit}
          </div>
        ) : (
          <span className="text-sm text-muted-foreground">—</span>
        ),
    },
    {
      key: "status",
      header: t("status.active"),
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

  return (
    <AdvancedDataTable
      data={products}
      columns={columns}
      loading={loading}
      error={error}
      emptyMessage={t("filters.all")}
      searchPlaceholder={t("filters.search")}
      onAdd={onAdd}
      addButtonLabel={t("createProduct")}
      itemName="product"
      itemNamePlural="products"
    />
  );
}
