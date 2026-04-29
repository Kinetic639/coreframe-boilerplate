"use client";

import React from "react";
import { DataView } from "@/components/data-view/data-view";
import { Badge } from "@/components/ui/badge";
import type {
  DataViewColumnDef,
  DataViewFilterDef,
  DataViewListParams,
  PaginatedResult,
} from "@/components/data-view/data-view.types";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type Product = {
  id: string;
  name: string;
  category: string;
  status: "active" | "draft" | "discontinued";
  price: number;
  updatedAt: string;
};

export type ProductDetail = Product & {
  description: string;
  stock: number;
  sku: string;
  supplier: string;
};

// ---------------------------------------------------------------------------
// Mock data (client-side — demo only)
// ---------------------------------------------------------------------------

const ALL_PRODUCTS: ProductDetail[] = [
  {
    id: "prod-001",
    name: "Professional Drill Set",
    category: "Power Tools",
    status: "active",
    price: 299.99,
    updatedAt: "2026-04-15",
    description: "Complete 20V drill set with 2 batteries and charger.",
    stock: 45,
    sku: "DRL-PRO-001",
    supplier: "DeWalt",
  },
  {
    id: "prod-002",
    name: "Safety Helmet",
    category: "Safety Equipment",
    status: "active",
    price: 34.99,
    updatedAt: "2026-04-10",
    description: "ANSI Z89.1 compliant hard hat with ratchet suspension.",
    stock: 200,
    sku: "SAF-HLM-002",
    supplier: "MSA Safety",
  },
  {
    id: "prod-003",
    name: "Industrial Workbench",
    category: "Furniture",
    status: "active",
    price: 549.0,
    updatedAt: "2026-03-28",
    description: 'Heavy-duty steel workbench, 72" x 30", 3000 lb capacity.',
    stock: 12,
    sku: "FRN-WRK-003",
    supplier: "Edsal",
  },
  {
    id: "prod-004",
    name: 'Angle Grinder 4.5"',
    category: "Power Tools",
    status: "active",
    price: 89.99,
    updatedAt: "2026-04-02",
    description: "7.5A angle grinder with side handle and guard.",
    stock: 78,
    sku: "GRD-ANG-004",
    supplier: "Makita",
  },
  {
    id: "prod-005",
    name: "Hi-Vis Safety Vest",
    category: "Safety Equipment",
    status: "active",
    price: 12.99,
    updatedAt: "2026-04-20",
    description: "Class 2 high visibility safety vest, ANSI/ISEA 107.",
    stock: 500,
    sku: "SAF-VST-005",
    supplier: "PIP",
  },
  {
    id: "prod-006",
    name: 'Torque Wrench 1/2"',
    category: "Hand Tools",
    status: "active",
    price: 59.99,
    updatedAt: "2026-03-15",
    description: "Click-type torque wrench, 10–150 ft-lbs.",
    stock: 33,
    sku: "TRQ-WRN-006",
    supplier: "CDI Torque",
  },
  {
    id: "prod-007",
    name: "Storage Cabinet",
    category: "Furniture",
    status: "draft",
    price: 199.0,
    updatedAt: "2026-04-18",
    description: 'Lockable steel storage cabinet, 72" tall.',
    stock: 0,
    sku: "FRN-CAB-007",
    supplier: "Edsal",
  },
  {
    id: "prod-008",
    name: "Laser Level Kit",
    category: "Measurement",
    status: "active",
    price: 149.99,
    updatedAt: "2026-04-05",
    description: "Self-leveling laser with tripod, 50ft range.",
    stock: 22,
    sku: "MSR-LZR-008",
    supplier: "Bosch",
  },
  {
    id: "prod-009",
    name: "Work Gloves (12-pack)",
    category: "Safety Equipment",
    status: "active",
    price: 28.99,
    updatedAt: "2026-04-22",
    description: "Cut-resistant work gloves, size L.",
    stock: 150,
    sku: "SAF-GLV-009",
    supplier: "PIP",
  },
  {
    id: "prod-010",
    name: "Cordless Circular Saw",
    category: "Power Tools",
    status: "discontinued",
    price: 179.99,
    updatedAt: "2026-01-10",
    description: '20V cordless circular saw, 6-1/2" blade. Discontinued.',
    stock: 3,
    sku: "SAW-CRC-010",
    supplier: "DeWalt",
  },
  {
    id: "prod-011",
    name: "Digital Caliper",
    category: "Measurement",
    status: "active",
    price: 24.99,
    updatedAt: "2026-04-14",
    description: '6" digital caliper, 0.0005" resolution.',
    stock: 67,
    sku: "MSR-CAL-011",
    supplier: "Mitutoyo",
  },
  {
    id: "prod-012",
    name: "First Aid Kit",
    category: "Safety Equipment",
    status: "active",
    price: 44.99,
    updatedAt: "2026-04-19",
    description: "200-piece first aid kit, OSHA compliant.",
    stock: 85,
    sku: "SAF-FAK-012",
    supplier: "Honeywell",
  },
];

// ---------------------------------------------------------------------------
// Fetchers (client-side mock — real impl would call Supabase)
// ---------------------------------------------------------------------------

async function mockListFetcher(params: DataViewListParams): Promise<PaginatedResult<Product>> {
  let rows: ProductDetail[] = [...ALL_PRODUCTS];

  if (params.search) {
    const q = params.search.toLowerCase();
    rows = rows.filter(
      (r) => r.name.toLowerCase().includes(q) || r.category.toLowerCase().includes(q)
    );
  }

  if (params.filters.category) {
    rows = rows.filter((r) => r.category === params.filters.category);
  }
  if (params.filters.status) {
    const statuses = Array.isArray(params.filters.status)
      ? params.filters.status
      : [params.filters.status as string];
    rows = rows.filter((r) => statuses.includes(r.status));
  }

  if (params.sort) {
    const { field, direction } = params.sort;
    rows = [...rows].sort((a, b) => {
      const av = String((a as Record<string, unknown>)[field] ?? "");
      const bv = String((b as Record<string, unknown>)[field] ?? "");
      const cmp = av.localeCompare(bv, undefined, { numeric: true });
      return direction === "asc" ? cmp : -cmp;
    });
  }

  const totalCount = rows.length;
  const start = (params.page - 1) * params.pageSize;
  const sliced: Product[] = rows
    .slice(start, start + params.pageSize)
    .map(({ description: _d, stock: _s, sku: _sk, supplier: _sp, ...rest }) => rest);

  await new Promise((r) => setTimeout(r, 80));
  return { rows: sliced, totalCount, page: params.page, pageSize: params.pageSize };
}

async function mockDetailFetcher(id: string): Promise<ProductDetail | null> {
  await new Promise((r) => setTimeout(r, 120));
  return ALL_PRODUCTS.find((p) => p.id === id) ?? null;
}

// ---------------------------------------------------------------------------
// Columns
// ---------------------------------------------------------------------------

const STATUS_COLORS: Record<
  Product["status"],
  "default" | "secondary" | "destructive" | "outline"
> = { active: "default", draft: "secondary", discontinued: "destructive" };

const columns: DataViewColumnDef<Product>[] = [
  {
    key: "name",
    header: "Name",
    accessor: (r) => <span className="font-medium">{r.name}</span>,
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

// ---------------------------------------------------------------------------
// Filters
// ---------------------------------------------------------------------------

const filters: DataViewFilterDef[] = [
  {
    type: "select",
    key: "category",
    label: "Category",
    options: [
      { label: "Power Tools", value: "Power Tools" },
      { label: "Safety Equipment", value: "Safety Equipment" },
      { label: "Furniture", value: "Furniture" },
      { label: "Hand Tools", value: "Hand Tools" },
      { label: "Measurement", value: "Measurement" },
    ],
  },
  {
    type: "multi-select",
    key: "status",
    label: "Status",
    options: [
      { label: "Active", value: "active" },
      { label: "Draft", value: "draft" },
      { label: "Discontinued", value: "discontinued" },
    ],
  },
];

// ---------------------------------------------------------------------------
// Render helpers
// ---------------------------------------------------------------------------

function renderDetail(product: ProductDetail) {
  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-lg font-semibold">{product.name}</h2>
        <p className="text-sm text-muted-foreground">{product.sku}</p>
      </div>
      <Badge variant={STATUS_COLORS[product.status]} className="capitalize">
        {product.status}
      </Badge>
      <p className="text-sm text-foreground">{product.description}</p>
      <div className="grid grid-cols-2 gap-3 text-sm">
        {[
          ["Category", product.category],
          [
            "Price",
            new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(
              product.price
            ),
          ],
          ["Stock", `${product.stock} units`],
          ["Supplier", product.supplier],
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

// ---------------------------------------------------------------------------
// Client component
// ---------------------------------------------------------------------------

interface DataViewDemoClientProps {
  initialData: PaginatedResult<Product>;
}

export function DataViewDemoClient({ initialData }: DataViewDemoClientProps) {
  return (
    <DataView<Product, ProductDetail>
      entity="demo-products"
      columns={columns}
      filters={filters}
      initialData={initialData}
      queryKey={["demo-products"]}
      listFetcher={mockListFetcher}
      detailFetcher={mockDetailFetcher}
      getRowId={(r) => r.id}
      renderDetail={renderDetail}
      className="h-full"
    />
  );
}
