import type { DataViewListParams, PaginatedResult } from "@/components/data-view/data-view.types";

export type ProductStatus = "active" | "draft" | "discontinued";

export type Product = {
  id: string;
  name: string;
  catalogCode: string;
  category: string;
  supplier: string;
  location: string;
  status: ProductStatus;
  price: number;
  stock: number;
  updatedAt: string;
  thumbnailLabel: string;
  thumbnailTone: string;
};

export type ProductDetail = Product & {
  description: string;
  sku: string;
  barcode: string;
  receivedAt: string;
  unit: string;
};

type ProductSeed = {
  name: string;
  category: string;
  supplier: string;
  location: string;
  unit: string;
  tone: string;
  priceBase: number;
  stockBase: number;
};

const PRODUCT_SEEDS: ProductSeed[] = [
  {
    name: "Impact Driver Kit",
    category: "Power Tools",
    supplier: "DeWalt",
    location: "Aisle A3",
    unit: "kit",
    tone: "bg-amber-100 text-amber-700",
    priceBase: 189,
    stockBase: 14,
  },
  {
    name: "Storage Cabinet",
    category: "Storage",
    supplier: "Gladiator",
    location: "Aisle C1",
    unit: "cabinet",
    tone: "bg-slate-100 text-slate-700",
    priceBase: 279,
    stockBase: 6,
  },
  {
    name: "Mobile Workbench",
    category: "Furniture",
    supplier: "Edsal",
    location: "Floor F2",
    unit: "bench",
    tone: "bg-orange-100 text-orange-700",
    priceBase: 459,
    stockBase: 4,
  },
  {
    name: "Digital Caliper",
    category: "Measurement",
    supplier: "Mitutoyo",
    location: "Aisle B4",
    unit: "tool",
    tone: "bg-sky-100 text-sky-700",
    priceBase: 46,
    stockBase: 28,
  },
  {
    name: "Torque Wrench",
    category: "Hand Tools",
    supplier: "CDI Torque",
    location: "Aisle A6",
    unit: "tool",
    tone: "bg-rose-100 text-rose-700",
    priceBase: 88,
    stockBase: 18,
  },
  {
    name: "Safety Vest",
    category: "Safety Equipment",
    supplier: "PIP",
    location: "Aisle D2",
    unit: "vest",
    tone: "bg-lime-100 text-lime-700",
    priceBase: 16,
    stockBase: 120,
  },
  {
    name: "Wire Stripper",
    category: "Electrical",
    supplier: "Klein Tools",
    location: "Aisle B1",
    unit: "tool",
    tone: "bg-violet-100 text-violet-700",
    priceBase: 24,
    stockBase: 34,
  },
  {
    name: "Fastener Pack",
    category: "Fasteners",
    supplier: "Simpson Strong-Tie",
    location: "Aisle E5",
    unit: "pack",
    tone: "bg-stone-100 text-stone-700",
    priceBase: 12,
    stockBase: 260,
  },
  {
    name: "Laser Level",
    category: "Measurement",
    supplier: "Bosch",
    location: "Aisle B6",
    unit: "kit",
    tone: "bg-emerald-100 text-emerald-700",
    priceBase: 129,
    stockBase: 11,
  },
  {
    name: "First Aid Kit",
    category: "Safety Equipment",
    supplier: "Honeywell",
    location: "Aisle D1",
    unit: "kit",
    tone: "bg-red-100 text-red-700",
    priceBase: 39,
    stockBase: 42,
  },
  {
    name: "Pallet Jack",
    category: "Warehouse",
    supplier: "Vestil",
    location: "Floor G1",
    unit: "jack",
    tone: "bg-cyan-100 text-cyan-700",
    priceBase: 599,
    stockBase: 3,
  },
  {
    name: "LED Work Light",
    category: "Lighting",
    supplier: "Milwaukee",
    location: "Aisle C4",
    unit: "light",
    tone: "bg-yellow-100 text-yellow-700",
    priceBase: 72,
    stockBase: 24,
  },
];

const VARIANT_LABELS = ["Core", "Plus", "Max", "Site", "Pro"];

export const PRODUCT_CATEGORIES = Array.from(
  new Set(PRODUCT_SEEDS.map((seed) => seed.category))
).sort();

export const PRODUCT_SUPPLIERS = Array.from(
  new Set(PRODUCT_SEEDS.map((seed) => seed.supplier))
).sort();

export const PRODUCT_STATUS_OPTIONS: { label: string; value: ProductStatus }[] = [
  { label: "Active", value: "active" },
  { label: "Draft", value: "draft" },
  { label: "Discontinued", value: "discontinued" },
];

function buildStatus(index: number): ProductStatus {
  if (index % 9 === 0) return "discontinued";
  if (index % 4 === 0) return "draft";
  return "active";
}

function buildDate(year: number, month: number, day: number) {
  return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

function buildUpdatedAt(index: number) {
  return buildDate(2026, ((index * 2) % 6) + 1, ((index * 5) % 27) + 1);
}

function buildReceivedAt(index: number) {
  return buildDate(2025, ((index * 3) % 12) + 1, ((index * 7) % 27) + 1);
}

function buildPrice(index: number, seed: ProductSeed) {
  const cycle = Math.floor(index / PRODUCT_SEEDS.length);
  const cents = [0.99, 0.49, 0.0, 0.95][index % 4];
  return Number((seed.priceBase + cycle * 11 + (index % 5) * 3 + cents).toFixed(2));
}

function buildStock(index: number, seed: ProductSeed, status: ProductStatus) {
  if (status === "draft") return 0;
  if (status === "discontinued") return Math.max(1, (index % 6) + 1);
  return seed.stockBase + (index % 8) * 2;
}

function buildCatalogCode(seed: ProductSeed, variant: string, sequence: number) {
  const base = seed.name
    .split(" ")
    .map((part) => part[0])
    .join("")
    .slice(0, 3)
    .toUpperCase();
  return `${base}-${variant.slice(0, 2).toUpperCase()}-${String(sequence).padStart(4, "0")}`;
}

function buildThumbnailLabel(seed: ProductSeed) {
  return seed.name
    .split(" ")
    .slice(0, 2)
    .map((part) => part[0])
    .join("")
    .toUpperCase();
}

function buildDescription(seed: ProductSeed, variant: string, status: ProductStatus) {
  const lifecycle =
    status === "active"
      ? "Ready for immediate deployment across active sites."
      : status === "draft"
        ? "Still under review before catalog-wide release."
        : "Being phased out while the remaining stock is cleared.";

  return `${seed.name} ${variant} configured for ${seed.category.toLowerCase()} workflows. ${lifecycle}`;
}

export function buildMockProducts(count = 25): ProductDetail[] {
  return Array.from({ length: count }, (_, index) => {
    const seed = PRODUCT_SEEDS[index % PRODUCT_SEEDS.length];
    const variant =
      VARIANT_LABELS[Math.floor(index / PRODUCT_SEEDS.length) % VARIANT_LABELS.length];
    const sequence = index + 1;
    const status = buildStatus(sequence);
    const catalogCode = buildCatalogCode(seed, variant, sequence);

    return {
      id: `prod-${String(sequence).padStart(3, "0")}`,
      name: `${seed.name} ${variant}`,
      catalogCode,
      category: seed.category,
      supplier: seed.supplier,
      location: seed.location,
      status,
      price: buildPrice(sequence, seed),
      stock: buildStock(sequence, seed, status),
      updatedAt: buildUpdatedAt(sequence),
      thumbnailLabel: buildThumbnailLabel(seed),
      thumbnailTone: seed.tone,
      description: buildDescription(seed, variant, status),
      sku: `${catalogCode}-${seed.unit.toUpperCase()}`,
      barcode: `00${String(734500000000 + sequence * 71)}`,
      receivedAt: buildReceivedAt(sequence),
      unit: seed.unit,
    };
  });
}

export const ALL_PRODUCTS = buildMockProducts();

function normalizeString(value: unknown) {
  return String(value ?? "").toLowerCase();
}

function toNumberFilterValue(value: string | string[] | boolean | null | undefined) {
  if (typeof value !== "string" || value.trim() === "") return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function matchesDateRange(date: string, from?: string | null, to?: string | null) {
  if (from && date < from) return false;
  if (to && date > to) return false;
  return true;
}

export function filterAndSortProducts(
  rows: ProductDetail[],
  params: Pick<DataViewListParams, "search" | "filters" | "sort">
) {
  let nextRows = [...rows];

  if (params.search) {
    const query = params.search.toLowerCase();
    nextRows = nextRows.filter((row) =>
      [
        row.name,
        row.catalogCode,
        row.category,
        row.supplier,
        row.location,
        row.sku,
        row.barcode,
      ].some((value) => value.toLowerCase().includes(query))
    );
  }

  if (typeof params.filters.catalogCode === "string" && params.filters.catalogCode.trim()) {
    const catalogQuery = params.filters.catalogCode.toLowerCase();
    nextRows = nextRows.filter((row) => row.catalogCode.toLowerCase().includes(catalogQuery));
  }

  if (params.filters.category) {
    nextRows = nextRows.filter((row) => row.category === params.filters.category);
  }

  if (params.filters.supplier) {
    nextRows = nextRows.filter((row) => row.supplier === params.filters.supplier);
  }

  if (params.filters.status) {
    const statuses = Array.isArray(params.filters.status)
      ? params.filters.status
      : [params.filters.status as string];
    nextRows = nextRows.filter((row) => statuses.includes(row.status));
  }

  if (typeof params.filters.inStock === "boolean") {
    nextRows = nextRows.filter((row) => (params.filters.inStock ? row.stock > 0 : row.stock === 0));
  }

  const minPrice = toNumberFilterValue(params.filters.minPrice);
  const maxPrice = toNumberFilterValue(params.filters.maxPrice);
  if (minPrice !== null) {
    nextRows = nextRows.filter((row) => row.price >= minPrice);
  }
  if (maxPrice !== null) {
    nextRows = nextRows.filter((row) => row.price <= maxPrice);
  }

  const updatedFrom =
    typeof params.filters.updatedFrom === "string" ? params.filters.updatedFrom : null;
  const updatedTo = typeof params.filters.updatedTo === "string" ? params.filters.updatedTo : null;
  if (updatedFrom || updatedTo) {
    nextRows = nextRows.filter((row) => matchesDateRange(row.updatedAt, updatedFrom, updatedTo));
  }

  if (params.sort) {
    const { field, direction } = params.sort;
    nextRows = [...nextRows].sort((a, b) => {
      const compareDirection = direction === "asc" ? 1 : -1;
      let comparison = 0;

      if (field === "price" || field === "stock") {
        comparison = (a[field] - b[field]) * compareDirection;
      } else {
        comparison =
          normalizeString(a[field as keyof ProductDetail]).localeCompare(
            normalizeString(b[field as keyof ProductDetail]),
            undefined,
            { numeric: true }
          ) * compareDirection;
      }

      if (comparison !== 0) {
        return comparison;
      }

      return a.id.localeCompare(b.id, undefined, { numeric: true });
    });
  }

  return nextRows;
}

export function paginateProducts(
  rows: ProductDetail[],
  page: number,
  pageSize: number
): PaginatedResult<Product> {
  const totalCount = rows.length;
  const start = (page - 1) * pageSize;

  return {
    rows: rows.slice(start, start + pageSize),
    totalCount,
    page,
    pageSize,
  };
}

export function resolveProductPage(
  rows: ProductDetail[],
  params: DataViewListParams,
  selectedId: string
) {
  const sortedRows = filterAndSortProducts(rows, params);
  const selectedIndex = sortedRows.findIndex((row) => row.id === selectedId);

  if (selectedIndex === -1) return null;

  return Math.floor(selectedIndex / params.pageSize) + 1;
}
