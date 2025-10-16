"use client";

import * as React from "react";
import { AdvancedDataTable, ColumnConfig } from "@/components/ui/advanced-data-table";
import type { ProductWithDetails } from "@/modules/warehouse/types/products";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Edit, Trash2 } from "lucide-react";
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
        <div className="space-y-4">
          <div>
            <div className="mb-2 text-lg font-semibold">{value}</div>
            <div className="mb-2 flex items-center gap-2">
              <Badge variant="outline">
                {row.product_type === "goods" ? t("productType.goods") : t("productType.service")}
              </Badge>
              <Badge variant={row.status === "active" ? "default" : "secondary"}>
                {t(`status.${row.status}`)}
              </Badge>
            </div>
            {row.description && <p className="text-sm text-muted-foreground">{row.description}</p>}
          </div>

          <Separator />

          {/* Basic Info */}
          <div>
            <h4 className="mb-2 text-sm font-semibold">{t("basicInfo.title")}</h4>
            <div className="space-y-1 text-xs">
              {row.sku && (
                <div>
                  <span className="text-muted-foreground">SKU:</span> {row.sku}
                </div>
              )}
              {row.brand && (
                <div>
                  <span className="text-muted-foreground">Brand:</span> {row.brand}
                </div>
              )}
              {row.manufacturer && (
                <div>
                  <span className="text-muted-foreground">Manufacturer:</span> {row.manufacturer}
                </div>
              )}
              <div>
                <span className="text-muted-foreground">Unit:</span> {row.unit}
              </div>
            </div>
          </div>

          {/* Barcodes */}
          {row.barcodes && row.barcodes.length > 0 && (
            <div>
              <h4 className="mb-2 text-sm font-semibold">{t("barcodes.title")}</h4>
              <div className="space-y-1">
                {row.barcodes.map((barcode, idx) => (
                  <div key={idx} className="flex items-center gap-2 text-xs">
                    <code className="rounded bg-muted px-2 py-0.5">{barcode.barcode}</code>
                    {barcode.is_primary && (
                      <Badge variant="secondary" className="text-xs">
                        Primary
                      </Badge>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Pricing */}
          <div>
            <h4 className="mb-2 text-sm font-semibold">Pricing</h4>
            <div className="grid grid-cols-2 gap-2 text-xs">
              <div>
                <span className="text-muted-foreground">Selling:</span>
                <div className="font-medium">{row.selling_price?.toFixed(2) || "0.00"} PLN</div>
              </div>
              <div>
                <span className="text-muted-foreground">Cost:</span>
                <div className="font-medium">{row.cost_price?.toFixed(2) || "0.00"} PLN</div>
              </div>
            </div>
          </div>

          {/* Inventory */}
          {row.product_type === "goods" && row.track_inventory && (
            <div>
              <h4 className="mb-2 text-sm font-semibold">Inventory</h4>
              <div className="text-xs">
                <span className="text-muted-foreground">Stock:</span> {row.opening_stock || 0}{" "}
                {row.unit}
              </div>
            </div>
          )}

          {/* Actions */}
          <div className="flex gap-2 pt-2">
            {onEdit && (
              <Button variant="default" size="sm" onClick={() => onEdit(row)}>
                <Edit className="mr-1 h-4 w-4" />
                Edit
              </Button>
            )}
            {onDelete && (
              <Button variant="destructive" size="sm" onClick={() => onDelete(row)}>
                <Trash2 className="mr-1 h-4 w-4" />
                Delete
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

  return (
    <AdvancedDataTable
      data={products}
      columns={columns}
      loading={loading}
      error={error}
      emptyMessage="No products found"
      searchPlaceholder={t("filters.search")}
      onAdd={onAdd}
    />
  );
}
