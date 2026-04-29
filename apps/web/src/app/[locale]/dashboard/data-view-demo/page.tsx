/**
 * /dashboard/data-view-demo — DataView System Demo Page
 *
 * Server component: reads searchParams, generates SSR initial data,
 * then hands off to the client DataViewDemoClient.
 */

import React from "react";
import { parseDataViewSearchParams } from "@/components/data-view/data-view-search-params";
import type { PaginatedResult } from "@/components/data-view/data-view.types";
import { DataViewDemoClient, type Product, type ProductDetail } from "./data-view-demo-client";

// ---------------------------------------------------------------------------
// Mock data duplicated server-side for SSR initial fetch
// ---------------------------------------------------------------------------

const ALL_PRODUCTS_SSR: ProductDetail[] = [
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

function toListRow({
  description: _d,
  stock: _s,
  sku: _sk,
  supplier: _sp,
  ...rest
}: ProductDetail): Product {
  return rest;
}

function serverMockFetch(
  search: string,
  filters: Record<string, string | string[] | boolean | null>,
  sort: { field: string; direction: "asc" | "desc" } | null,
  page: number,
  pageSize: number
): PaginatedResult<Product> {
  let rows = [...ALL_PRODUCTS_SSR];

  if (search) {
    const q = search.toLowerCase();
    rows = rows.filter(
      (r) => r.name.toLowerCase().includes(q) || r.category.toLowerCase().includes(q)
    );
  }
  if (filters.category) {
    rows = rows.filter((r) => r.category === filters.category);
  }
  if (filters.status) {
    const statuses = Array.isArray(filters.status) ? filters.status : [filters.status as string];
    rows = rows.filter((r) => statuses.includes(r.status));
  }
  if (sort) {
    rows = [...rows].sort((a, b) => {
      const av = String((a as Record<string, unknown>)[sort.field] ?? "");
      const bv = String((b as Record<string, unknown>)[sort.field] ?? "");
      const cmp = av.localeCompare(bv, undefined, { numeric: true });
      return sort.direction === "asc" ? cmp : -cmp;
    });
  }

  const totalCount = rows.length;
  const start = (page - 1) * pageSize;
  return {
    rows: rows.slice(start, start + pageSize).map(toListRow),
    totalCount,
    page,
    pageSize,
  };
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

type PageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export default async function DataViewDemoPage({ searchParams }: PageProps) {
  const params = await searchParams;
  const urlState = parseDataViewSearchParams(params);

  const initialData = serverMockFetch(
    urlState.search,
    urlState.filters,
    urlState.sort,
    urlState.page,
    urlState.pageSize
  );

  return (
    <div className="flex flex-col gap-4 p-4 md:p-6 h-[calc(100vh-4rem)]">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">DataView Demo</h1>
        <p className="text-sm text-muted-foreground">
          Generic Master–Detail workspace. URL-driven state via nuqs, TanStack Query for caching,
          Framer Motion for the detail panel animation. Click any row to open details.
        </p>
      </div>

      <div className="flex-1 overflow-hidden">
        <DataViewDemoClient initialData={initialData} />
      </div>
    </div>
  );
}
