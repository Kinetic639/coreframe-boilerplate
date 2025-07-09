// src/lib/mock/products-extended.ts
import { Tables } from "../../../supabase/types/types";
// import { v4 as uuidv4 } from "uuid"; // Replaced with deterministic UUID generation

// Seeded random number generator
let seed = 1;
function random() {
  const x = Math.sin(seed++) * 10000;
  return x - Math.floor(x);
}

// Deterministic UUID generation based on the seeded random number generator
function generateDeterministicUuid(): string {
  const chars = "0123456789abcdef";
  let uuid = "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx";
  uuid = uuid.replace(/[xy]/g, function (c) {
    const r = Math.floor(random() * 16);
    const v = c === "x" ? r : (r & 0x3) | 0x8;
    return chars[v];
  });
  return uuid;
}

// Define combined product type for UI
export type ProductWithDetails = Tables<"products"> & {
  variants: (Tables<"product_variants"> & {
    inventory_data: Tables<"product_inventory_data"> | null;
    stock_locations: (Tables<"product_stock_locations"> & {
      location: Tables<"locations"> | null; // Assuming locations table exists and is relevant
    })[];
  })[];
  suppliers: Tables<"suppliers">[];
};

// Mock data generation functions
const createMockProduct = (overrides?: Partial<Tables<"products">>): Tables<"products"> => ({
  id: generateDeterministicUuid(),
  name: [
    "Lakier bazowy",
    "Szpachlówka uniwersalna",
    "Podkład akrylowy",
    "Papier ścierny P800",
    "Taśma maskująca",
    "Utwardzacz do lakieru",
    "Rozcieńczalnik",
    "Odtłuszczacz",
    "Pasta polerska",
    "Zmywacz silikonowy",
  ][Math.floor(random() * 10)],
  sku: `SKU-${Math.floor(random() * 10000)}`,
  barcode: `BAR-${Math.floor(random() * 1000000)}`,
  description: [
    "Wysokiej jakości lakier bazowy do zaprawek.",
    "Szybkoschnąca szpachlówka do wypełniania ubytków.",
    "Podkład zwiększający przyczepność lakieru.",
    "Papier ścierny do szlifowania na mokro.",
    "Taśma odporna na wysokie temperatury.",
    "Utwardzacz zapewniający trwałość powłoki.",
    "Rozcieńczalnik do lakierów akrylowych.",
    "Skuteczny odtłuszczacz do powierzchni.",
    "Pasta do usuwania zarysowań.",
    "Zmywacz do usuwania silikonu przed lakierowaniem.",
  ][Math.floor(random() * 10)],
  created_at: new Date().toISOString(),
  updated_at: new Date().toISOString(),
  deleted_at: null,
  default_unit: ["szt.", "kg", "litr", "m", "opak."][Math.floor(random() * 5)],
  main_image_id: mockImageUrls[Math.floor(random() * mockImageUrls.length)],
  ...overrides,
});

const mockImageUrls = [
  "https://picsum.photos/seed/paint1/400/300",
  "https://picsum.photos/seed/filler1/400/300",
  "https://picsum.photos/seed/sanding1/400/300",
  "https://picsum.photos/seed/masking1/400/300",
  "https://picsum.photos/seed/clearcoat1/400/300",
  "https://picsum.photos/seed/primer1/400/300",
  "https://picsum.photos/seed/degreaser1/400/300",
  "https://picsum.photos/seed/polishing1/400/300",
];

const createMockVariant = (
  productId: string,
  overrides?: Partial<Tables<"product_variants">>
): Tables<"product_variants"> => ({
  id: generateDeterministicUuid(),
  product_id: productId,
  name: `Wariant ${Math.floor(random() * 100)}`,
  sku: `VAR-SKU-${Math.floor(random() * 10000)}`,
  attributes: {
    pojemnosc: ["0.5L", "1L", "5L"][Math.floor(random() * 3)],
    kolor: ["Czerwony", "Czarny", "Biały", "Srebrny"][Math.floor(random() * 4)],
    granulacja: ["P800", "P1200", "P2000"][Math.floor(random() * 3)],
  },
  created_at: new Date().toISOString(),
  updated_at: new Date().toISOString(),
  deleted_at: null,
  ...overrides,
});

const createMockInventoryData = (
  variantId: string,
  overrides?: Partial<Tables<"product_inventory_data">>
): Tables<"product_inventory_data"> => ({
  id: generateDeterministicUuid(),
  product_id: null, // This should ideally link to product_variants.id, but schema links to products.id
  purchase_price: parseFloat((random() * 100 + 10).toFixed(2)),
  vat_rate: 23,
  weight: parseFloat((random() * 5).toFixed(2)),
  dimensions: { length: 10, width: 10, height: 10 },
  packaging_type: "box",
  inventory_image_ids: [],
  created_at: new Date().toISOString(),
  updated_at: new Date().toISOString(),
  deleted_at: null,
  ...overrides,
});

const createMockStockLocation = (
  productId: string,
  locationId: string,
  overrides?: Partial<Tables<"product_stock_locations">>
): Tables<"product_stock_locations"> => ({
  id: generateDeterministicUuid(),
  product_id: productId,
  location_id: locationId,
  quantity: Math.floor(random() * 200),
  created_at: new Date().toISOString(),
  updated_at: new Date().toISOString(),
  deleted_at: null,
  ...overrides,
});

const createMockSupplier = (overrides?: Partial<Tables<"suppliers">>): Tables<"suppliers"> => ({
  id: generateDeterministicUuid(),
  name: `Supplier ${Math.floor(random() * 50)}`,
  contact_info: { email: "supplier@example.com" },
  created_at: new Date().toISOString(),
  updated_at: new Date().toISOString(),
  deleted_at: null,
  ...overrides,
});

// Generate some mock locations for stock data
const mockLocations: Tables<"locations">[] = [
  {
    id: generateDeterministicUuid(),
    name: "Warehouse A - Shelf 1",
    code: "WA-S1",
    description: null,
    color: "#FF0000",
    icon_name: "Warehouse",
    branch_id: "branch1",
    created_at: new Date().toISOString(),
    deleted_at: null,
    image_url: null,
    level: 1,
    organization_id: "org1",
    parent_id: null,
    sort_order: 1,
    updated_at: new Date().toISOString(),
  },
  {
    id: generateDeterministicUuid(),
    name: "Warehouse A - Shelf 2",
    code: "WA-S2",
    description: null,
    color: "#00FF00",
    icon_name: "Warehouse",
    branch_id: "branch1",
    created_at: new Date().toISOString(),
    deleted_at: null,
    image_url: null,
    level: 1,
    organization_id: "org1",
    parent_id: null,
    sort_order: 2,
    updated_at: new Date().toISOString(),
  },
  {
    id: generateDeterministicUuid(),
    name: "Warehouse B - Aisle 1",
    code: "WB-A1",
    description: null,
    color: "#0000FF",
    icon_name: "Warehouse",
    branch_id: "branch2",
    created_at: new Date().toISOString(),
    deleted_at: null,
    image_url: null,
    level: 1,
    organization_id: "org1",
    parent_id: null,
    sort_order: 1,
    updated_at: new Date().toISOString(),
  },
];

const generateMockProducts = (count: number): ProductWithDetails[] => {
  const products: ProductWithDetails[] = [];
  const allSuppliers: Tables<"suppliers">[] = Array.from({ length: 5 }).map(() =>
    createMockSupplier()
  );

  for (let i = 0; i < count; i++) {
    const product = createMockProduct();
    const variants: (Tables<"product_variants"> & {
      inventory_data: Tables<"product_inventory_data"> | null;
      stock_locations: (Tables<"product_stock_locations"> & {
        location: Tables<"locations"> | null;
      })[];
    })[] = [];

    // Each product has 1 to 3 variants
    const numVariants = Math.floor(random() * 3) + 1;
    for (let j = 0; j < numVariants; j++) {
      const variant = createMockVariant(product.id, {
        name: `${product.name} - ${j === 0 ? "Standard" : `Option ${j}`}`,
        attributes: {
          size: ["S", "M", "L", "XL"][Math.floor(random() * 4)],
          color: ["Red", "Blue", "Green"][Math.floor(random() * 3)],
        },
      });
      const inventoryData = createMockInventoryData(variant.id, { product_id: product.id }); // Link inventory to product_id as per schema

      const stockLocations: (Tables<"product_stock_locations"> & {
        location: Tables<"locations"> | null;
      })[] = [];
      // Each variant has stock in 1 to 2 random locations
      const numStockLocations = Math.floor(random() * 2) + 1;
      for (let k = 0; k < numStockLocations; k++) {
        const randomLocation = mockLocations[Math.floor(random() * mockLocations.length)];
        const quantity = i % 5 === 0 ? 1 : Math.floor(random() * 200) + 10; // Set to 1 for low stock, otherwise higher
        stockLocations.push({
          ...createMockStockLocation(product.id, randomLocation.id, { quantity }),
          location: randomLocation,
        });
      }

      variants.push({ ...variant, inventory_data: inventoryData, stock_locations: stockLocations });
    }

    // Assign 1 to 2 random suppliers to each product
    const productSuppliers = Array.from({ length: Math.floor(random() * 2) + 1 })
      .map(() => allSuppliers[Math.floor(random() * allSuppliers.length)])
      .filter((value, index, self) => self.indexOf(value) === index); // Ensure unique suppliers

    products.push({
      ...product,
      variants: variants,
      suppliers: productSuppliers,
    });
  }
  return products;
};

export const mockProductsData: ProductWithDetails[] = generateMockProducts(50); // Generate 50 mock products

export const getMockProducts = (): ProductWithDetails[] => {
  return mockProductsData;
};

export const getMockSuppliers = (): Tables<"suppliers">[] => {
  const allSuppliers: Tables<"suppliers">[] = [];
  mockProductsData.forEach((product) => {
    product.suppliers.forEach((supplier) => {
      if (!allSuppliers.some((s) => s.id === supplier.id)) {
        allSuppliers.push(supplier);
      }
    });
  });
  return allSuppliers;
};

export const getMockLocations = (): Tables<"locations">[] => {
  return mockLocations;
};

export const getMockProductById = (id: string): ProductWithDetails | undefined => {
  return mockProductsData.find((p) => p.id === id);
};
