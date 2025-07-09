// src/lib/mock/products-extended.ts
import { Tables } from "../../../supabase/types/types";
import { v4 as uuidv4 } from "uuid";

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
  id: uuidv4(),
  name: `Product ${Math.floor(Math.random() * 1000)}`,
  sku: `SKU-${Math.floor(Math.random() * 10000)}`,
  barcode: `BAR-${Math.floor(Math.random() * 1000000)}`,
  description: `Description for Product ${Math.floor(Math.random() * 1000)}.`,
  created_at: new Date().toISOString(),
  updated_at: new Date().toISOString(),
  deleted_at: null,
  default_unit: "pcs",
  main_image_id: null,
  ...overrides,
});

const createMockVariant = (
  productId: string,
  overrides?: Partial<Tables<"product_variants">>
): Tables<"product_variants"> => ({
  id: uuidv4(),
  product_id: productId,
  name: `Variant ${Math.floor(Math.random() * 100)}`,
  sku: `VAR-SKU-${Math.floor(Math.random() * 10000)}`,
  attributes: {
    size: ["S", "M", "L", "XL"][Math.floor(Math.random() * 4)],
    color: ["Red", "Blue", "Green"][Math.floor(Math.random() * 3)],
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
  id: uuidv4(),
  product_id: null, // This should ideally link to product_variants.id, but schema links to products.id
  purchase_price: parseFloat((Math.random() * 100 + 10).toFixed(2)),
  vat_rate: 23,
  weight: parseFloat((Math.random() * 5).toFixed(2)),
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
  id: uuidv4(),
  product_id: productId,
  location_id: locationId,
  quantity: Math.floor(Math.random() * 200),
  created_at: new Date().toISOString(),
  updated_at: new Date().toISOString(),
  deleted_at: null,
  ...overrides,
});

const createMockSupplier = (overrides?: Partial<Tables<"suppliers">>): Tables<"suppliers"> => ({
  id: uuidv4(),
  name: `Supplier ${Math.floor(Math.random() * 50)}`,
  contact_info: { email: "supplier@example.com" },
  created_at: new Date().toISOString(),
  updated_at: new Date().toISOString(),
  deleted_at: null,
  ...overrides,
});

// Generate some mock locations for stock data
const mockLocations: Tables<"locations">[] = [
  {
    id: uuidv4(),
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
    id: uuidv4(),
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
    id: uuidv4(),
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
    const numVariants = Math.floor(Math.random() * 3) + 1;
    for (let j = 0; j < numVariants; j++) {
      const variant = createMockVariant(product.id, {
        name: `${product.name} - ${j === 0 ? "Standard" : `Option ${j}`}`,
        attributes: {
          size: ["S", "M", "L", "XL"][Math.floor(Math.random() * 4)],
          color: ["Red", "Blue", "Green"][Math.floor(Math.random() * 3)],
        },
      });
      const inventoryData = createMockInventoryData(variant.id, { product_id: product.id }); // Link inventory to product_id as per schema

      const stockLocations: (Tables<"product_stock_locations"> & {
        location: Tables<"locations"> | null;
      })[] = [];
      // Each variant has stock in 1 to 2 random locations
      const numStockLocations = Math.floor(Math.random() * 2) + 1;
      for (let k = 0; k < numStockLocations; k++) {
        const randomLocation = mockLocations[Math.floor(Math.random() * mockLocations.length)];
        stockLocations.push({
          ...createMockStockLocation(product.id, randomLocation.id),
          location: randomLocation,
        });
      }

      variants.push({ ...variant, inventory_data: inventoryData, stock_locations: stockLocations });
    }

    // Assign 1 to 2 random suppliers to each product
    const productSuppliers = Array.from({ length: Math.floor(Math.random() * 2) + 1 })
      .map(() => allSuppliers[Math.floor(Math.random() * allSuppliers.length)])
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
