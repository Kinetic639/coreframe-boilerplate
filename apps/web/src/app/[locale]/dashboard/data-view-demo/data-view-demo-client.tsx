"use client";

import React from "react";
import { useLocale, useTranslations } from "next-intl";
import { DataView } from "@/components/data-view/data-view";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/utils";
import type {
  DataViewColumnDef,
  DataViewFilterDef,
  DataViewListParams,
  PaginatedResult,
} from "@/components/data-view/data-view.types";
import {
  ALL_PRODUCTS,
  PRODUCT_CATEGORIES,
  PRODUCT_STATUS_OPTIONS,
  PRODUCT_SUPPLIERS,
  filterAndSortProducts,
  paginateProducts,
  type Product,
  type ProductDetail,
} from "./mock-data";

const CATEGORY_TRANSLATION_KEYS: Record<string, string> = {
  "Power Tools": "powerTools",
  Storage: "storage",
  Furniture: "furniture",
  Measurement: "measurement",
  "Hand Tools": "handTools",
  "Safety Equipment": "safetyEquipment",
  Electrical: "electrical",
  Fasteners: "fasteners",
  Warehouse: "warehouse",
  Lighting: "lighting",
};

const STATUS_COLORS: Record<
  Product["status"],
  "default" | "secondary" | "destructive" | "outline"
> = { active: "default", draft: "secondary", discontinued: "destructive" };

async function mockListFetcher(params: DataViewListParams): Promise<PaginatedResult<Product>> {
  const filteredRows = filterAndSortProducts(ALL_PRODUCTS, params);

  await new Promise((r) => setTimeout(r, 80));
  return paginateProducts(filteredRows, params.page, params.pageSize);
}

async function mockDetailFetcher(id: string): Promise<ProductDetail | null> {
  await new Promise((r) => setTimeout(r, 120));
  return ALL_PRODUCTS.find((product) => product.id === id) ?? null;
}

function ProductMiniature({ product }: { product: Product }) {
  return (
    <div
      className={cn(
        "flex h-10 w-10 shrink-0 items-center justify-center rounded-md border text-[11px] font-semibold tracking-wide",
        product.thumbnailTone
      )}
      aria-hidden="true"
    >
      {product.thumbnailLabel}
    </div>
  );
}

interface DataViewDemoClientProps {
  initialData: PaginatedResult<Product>;
  resolveSelectedPage?: (args: {
    selectedId: string;
    listParams: DataViewListParams;
  }) => Promise<number | null>;
}

export function DataViewDemoClient({ initialData, resolveSelectedPage }: DataViewDemoClientProps) {
  const t = useTranslations("dataViewDemo");
  const locale = useLocale();
  const currencyFormatter = new Intl.NumberFormat(locale, {
    style: "currency",
    currency: "USD",
  });
  const columns: DataViewColumnDef<Product>[] = [
    {
      key: "name",
      header: t("columns.product"),
      accessor: (r) => (
        <div className="flex min-w-0 items-center gap-3 py-2">
          <ProductMiniature product={r} />
          <div className="min-w-0">
            <div className="truncate font-medium text-foreground">{r.name}</div>
            <div className="truncate text-xs text-muted-foreground">{r.catalogCode}</div>
          </div>
        </div>
      ),
      sortable: true,
      defaultVisible: true,
    },
    {
      key: "category",
      header: t("columns.category"),
      accessor: (r) => t(`categories.${CATEGORY_TRANSLATION_KEYS[r.category]}`),
      sortable: true,
      defaultVisible: true,
      compactLabel: true,
    },
    {
      key: "supplier",
      header: t("columns.supplier"),
      accessor: (r) => <span className="text-sm text-foreground">{r.supplier}</span>,
      sortable: true,
      defaultVisible: true,
    },
    {
      key: "status",
      header: t("columns.status"),
      accessor: (r) => (
        <Badge variant={STATUS_COLORS[r.status]} className="capitalize text-xs">
          {t(`status.${r.status}`)}
        </Badge>
      ),
      defaultVisible: true,
    },
    {
      key: "stock",
      header: t("columns.stock"),
      accessor: (r) => <span className="tabular-nums text-sm text-foreground">{r.stock}</span>,
      sortable: true,
      defaultVisible: true,
    },
    {
      key: "location",
      header: t("columns.location"),
      accessor: (r) => <span className="text-sm text-muted-foreground">{r.location}</span>,
      sortable: true,
      defaultVisible: true,
    },
    {
      key: "price",
      header: t("columns.price"),
      accessor: (r) => <span className="tabular-nums">{currencyFormatter.format(r.price)}</span>,
      sortable: true,
      defaultVisible: true,
    },
    {
      key: "updatedAt",
      header: t("columns.updatedAt"),
      accessor: (r) => <span className="text-muted-foreground text-xs">{r.updatedAt}</span>,
      sortable: true,
      defaultVisible: true,
    },
  ];

  const filters: DataViewFilterDef[] = [
    {
      type: "text",
      key: "catalogCode",
      label: t("filters.catalog"),
    },
    {
      type: "select",
      key: "category",
      label: t("filters.category"),
      options: PRODUCT_CATEGORIES.map((category) => ({
        label: t(`categories.${CATEGORY_TRANSLATION_KEYS[category]}`),
        value: category,
      })),
    },
    {
      type: "select",
      key: "supplier",
      label: t("filters.supplier"),
      options: PRODUCT_SUPPLIERS.map((supplier) => ({ label: supplier, value: supplier })),
    },
    {
      type: "multi-select",
      key: "status",
      label: t("filters.status"),
      options: PRODUCT_STATUS_OPTIONS.map((option) => ({
        label: t(`status.${option.value}`),
        value: option.value,
      })),
    },
    {
      type: "range",
      key: "priceRange",
      label: t("filters.price"),
      minKey: "minPrice",
      maxKey: "maxPrice",
    },
    {
      type: "date-range",
      key: "updatedRange",
      label: t("filters.updatedAt"),
      fromKey: "updatedFrom",
      toKey: "updatedTo",
    },
    {
      type: "boolean",
      key: "inStock",
      label: t("filters.inStock"),
    },
  ];

  const renderDetail = (product: ProductDetail) => (
    <div className="space-y-5">
      <div className="flex items-start gap-4">
        <ProductMiniature product={product} />
        <div className="min-w-0">
          <h2 className="text-lg font-semibold">{product.name}</h2>
          <p className="text-sm text-muted-foreground">
            {product.catalogCode} • {product.sku}
          </p>
        </div>
      </div>
      <Badge variant={STATUS_COLORS[product.status]} className="capitalize">
        {t(`status.${product.status}`)}
      </Badge>
      <p className="text-sm text-foreground">{product.description}</p>
      <div className="grid grid-cols-2 gap-3 text-sm">
        {[
          [t("detail.category"), t(`categories.${CATEGORY_TRANSLATION_KEYS[product.category]}`)],
          [t("detail.supplier"), product.supplier],
          [t("detail.location"), product.location],
          [t("detail.price"), currencyFormatter.format(product.price)],
          [t("detail.stock"), t("detail.stockUnits", { count: product.stock })],
          [t("detail.barcode"), product.barcode],
          [t("detail.receivedAt"), product.receivedAt],
          [t("detail.updatedAt"), product.updatedAt],
        ].map(([label, value]) => (
          <div key={label}>
            <p className="text-muted-foreground text-xs font-medium uppercase tracking-wide">
              {label}
            </p>
            <p>{value}</p>
          </div>
        ))}
      </div>
    </div>
  );

  return (
    <DataView<Product, ProductDetail>
      entity="demo-products"
      columns={columns}
      filters={filters}
      initialData={initialData}
      queryKey={["demo-products"]}
      listFetcher={mockListFetcher}
      detailFetcher={mockDetailFetcher}
      resolveSelectedPage={resolveSelectedPage}
      getRowId={(row) => row.id}
      renderDetail={renderDetail}
      className="h-full"
    />
  );
}

export type { Product, ProductDetail };
