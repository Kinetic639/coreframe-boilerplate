"use client";

import { format } from "date-fns";
import { Badge } from "@/components/ui/badge";
import { PreviewableTable } from "@/components/ui/previewable-table";
import type { ColumnConfig } from "@/components/ui/advanced-data-table";
import { cn } from "@/lib/utils";

import { ProductPreviewCard } from "@/modules/development/components/previewable-table/product-preview-card";
import {
  type PreviewProduct,
  previewProducts,
} from "@/modules/development/samples/previewable-table-data";

const productColumns: ColumnConfig<PreviewProduct>[] = [
  {
    key: "name",
    header: "Product",
    sortable: true,
    filterType: "text",
    isPrimary: true,
    render: (value, row) => (
      <div className="flex flex-col">
        <span className="font-medium">{value}</span>
        <span className="text-xs text-muted-foreground">SKU {row.sku}</span>
      </div>
    ),
  },
  {
    key: "category",
    header: "Category",
    filterType: "select",
    filterOptions: Array.from(new Set(previewProducts.map((product) => product.category))).map(
      (category) => ({
        value: category,
        label: category,
      })
    ),
    render: (value) => <span className="text-sm">{value}</span>,
  },
  {
    key: "price",
    header: "Price",
    align: "right",
    sortable: true,
    render: (value: number) => <span className="font-medium">${value.toFixed(2)}</span>,
  },
  {
    key: "stock",
    header: "Stock",
    align: "center",
    sortable: true,
    filterType: "number-range",
    render: (value: number) => (
      <span className={cn("text-sm font-medium", value === 0 ? "text-destructive" : "")}>
        {value}
      </span>
    ),
  },
  {
    key: "status",
    header: "Status",
    filterType: "select",
    filterOptions: [
      { value: "active", label: "Active" },
      { value: "draft", label: "Draft" },
      { value: "archived", label: "Archived" },
    ],
    render: (value: PreviewProduct["status"]) => (
      <Badge
        variant="outline"
        className={cn(
          "rounded-full px-2.5 py-1 text-xs",
          value === "active" && "border-emerald-500/40 text-emerald-600 dark:text-emerald-300",
          value === "draft" && "border-amber-500/40 text-amber-600 dark:text-amber-300",
          value === "archived" && "border-slate-500/40 text-slate-600 dark:text-slate-300"
        )}
      >
        {value.toUpperCase()}
      </Badge>
    ),
  },
  {
    key: "updatedAt",
    header: "Updated",
    sortable: true,
    render: (value: string) => (
      <span className="text-sm text-muted-foreground">{format(new Date(value), "PPP p")}</span>
    ),
  },
];

interface PageProps {
  params: {
    locale: string;
    entityId?: string[];
  };
}

export default function ProductTablePreviewPage({ params }: PageProps) {
  const selectedId = params.entityId?.[0] ?? null;

  return (
    <PreviewableTable<PreviewProduct>
      basePath="/dashboard/development/table-preview/products"
      selectedId={selectedId}
      data={previewProducts}
      columns={productColumns}
      searchPlaceholder="Search products, SKU or categories"
      header={{
        title: "Product preview layout",
        description:
          "Demo of the reusable master-detail table layout that embeds the product page preview inline.",
      }}
      renderDetail={(row, onClose) => <ProductPreviewCard product={row} onClose={onClose} />}
      emptyMessage="No products found"
      responsive
      persistFiltersInUrl
      defaultSort={{ key: "updatedAt", direction: "desc" }}
    />
  );
}
