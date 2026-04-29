"use client";

import React from "react";
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

const columns: DataViewColumnDef<Product>[] = [
  {
    key: "name",
    header: "Product",
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
    header: "Category",
    accessor: (r) => r.category,
    sortable: true,
    defaultVisible: true,
    compactLabel: true,
  },
  {
    key: "supplier",
    header: "Supplier",
    accessor: (r) => <span className="text-sm text-foreground">{r.supplier}</span>,
    sortable: true,
    defaultVisible: true,
  },
  {
    key: "status",
    header: "Status",
    accessor: (r) => (
      <Badge variant={STATUS_COLORS[r.status]} className="capitalize text-xs">
        {r.status}
      </Badge>
    ),
    defaultVisible: true,
  },
  {
    key: "stock",
    header: "Stock",
    accessor: (r) => <span className="tabular-nums text-sm text-foreground">{r.stock}</span>,
    sortable: true,
    defaultVisible: true,
  },
  {
    key: "location",
    header: "Location",
    accessor: (r) => <span className="text-sm text-muted-foreground">{r.location}</span>,
    sortable: true,
    defaultVisible: true,
  },
  {
    key: "price",
    header: "Price",
    accessor: (r) => (
      <span className="tabular-nums">
        {new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(r.price)}
      </span>
    ),
    sortable: true,
    defaultVisible: true,
  },
  {
    key: "updatedAt",
    header: "Updated",
    accessor: (r) => <span className="text-muted-foreground text-xs">{r.updatedAt}</span>,
    sortable: true,
    defaultVisible: true,
  },
];

const filters: DataViewFilterDef[] = [
  {
    type: "text",
    key: "catalogCode",
    label: "Catalog",
  },
  {
    type: "select",
    key: "category",
    label: "Category",
    options: PRODUCT_CATEGORIES.map((category) => ({ label: category, value: category })),
  },
  {
    type: "select",
    key: "supplier",
    label: "Supplier",
    options: PRODUCT_SUPPLIERS.map((supplier) => ({ label: supplier, value: supplier })),
  },
  {
    type: "multi-select",
    key: "status",
    label: "Status",
    options: PRODUCT_STATUS_OPTIONS,
  },
  {
    type: "range",
    key: "priceRange",
    label: "Price",
    minKey: "minPrice",
    maxKey: "maxPrice",
  },
  {
    type: "date-range",
    key: "updatedRange",
    label: "Updated",
    fromKey: "updatedFrom",
    toKey: "updatedTo",
  },
  {
    type: "boolean",
    key: "inStock",
    label: "In stock",
  },
];

function renderDetail(product: ProductDetail) {
  return (
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
        {product.status}
      </Badge>
      <p className="text-sm text-foreground">{product.description}</p>
      <div className="grid grid-cols-2 gap-3 text-sm">
        {[
          ["Category", product.category],
          ["Supplier", product.supplier],
          ["Location", product.location],
          [
            "Price",
            new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(
              product.price
            ),
          ],
          ["Stock", `${product.stock} units`],
          ["Barcode", product.barcode],
          ["Received", product.receivedAt],
          ["Updated", product.updatedAt],
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
}

interface DataViewDemoClientProps {
  initialData: PaginatedResult<Product>;
  resolveSelectedPage?: (args: {
    selectedId: string;
    listParams: DataViewListParams;
  }) => Promise<number | null>;
}

export function DataViewDemoClient({ initialData, resolveSelectedPage }: DataViewDemoClientProps) {
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
