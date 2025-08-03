import { createClient } from "@/utils/supabase/client";
import type { Tables, TablesInsert, TablesUpdate } from "../../../../supabase/types/types";

export type ProductWithVariants = Tables<"products"> & {
  variants: (Tables<"product_variants"> & {
    stock_locations: Tables<"product_stock_locations">[];
  })[];
  stock_locations?: Tables<"product_stock_locations">[];
  inventory_data: Tables<"product_inventory_data"> | null;
  ecommerce_data: Tables<"product_ecommerce_data"> | null;
  suppliers: Tables<"suppliers">[];
};

export type CreateProductData = {
  // Basic product data
  name: string;
  description?: string;
  sku?: string;
  barcode?: string;
  code?: string;
  default_unit?: string;
  main_image_id?: string;

  // Inventory data
  purchase_price?: number;
  vat_rate?: number;
  weight?: number;
  dimensions?: Record<string, unknown>;
  packaging_type?: string;

  // Initial stock location (branch context)
  initial_quantity?: number;
  location_id?: string;

  // Variant data (default variant will be created)
  variant_name?: string;
  variant_sku?: string;
  variant_attributes?: Record<string, unknown>;
};

export type UpdateProductData = Partial<CreateProductData> & {
  id: string;
};

export class ProductService {
  private supabase: ReturnType<typeof createClient>;

  constructor() {
    this.supabase = createClient();
  }

  async createProduct(productData: CreateProductData): Promise<ProductWithVariants> {
    const {
      name,
      description,
      sku,
      barcode,
      code,
      default_unit,
      main_image_id,
      purchase_price,
      vat_rate,
      weight,
      dimensions,
      packaging_type,
      initial_quantity = 0,
      location_id,
      variant_name,
      variant_sku,
      variant_attributes,
    } = productData;

    try {
      // 1. Create the main product
      const productInsert: TablesInsert<"products"> = {
        name,
        description,
        sku,
        barcode,
        code,
        default_unit,
        main_image_id,
      };

      const { data: product, error: productError } = await this.supabase
        .from("products")
        .insert(productInsert)
        .select()
        .single();

      if (productError) throw productError;

      // 2. Create inventory data if provided
      let inventoryData = null;
      if (
        purchase_price !== undefined ||
        vat_rate !== undefined ||
        weight !== undefined ||
        dimensions ||
        packaging_type
      ) {
        const inventoryInsert: TablesInsert<"product_inventory_data"> = {
          product_id: product.id,
          purchase_price,
          vat_rate,
          weight,
          dimensions,
          packaging_type,
        };

        const { data: inventory, error: inventoryError } = await this.supabase
          .from("product_inventory_data")
          .insert(inventoryInsert)
          .select()
          .single();

        if (inventoryError) throw inventoryError;
        inventoryData = inventory;
      }

      // 3. Create default variant
      const variantInsert: TablesInsert<"product_variants"> = {
        product_id: product.id,
        name: variant_name || name,
        sku: variant_sku || sku,
        attributes: variant_attributes,
      };

      const { data: variant, error: variantError } = await this.supabase
        .from("product_variants")
        .insert(variantInsert)
        .select()
        .single();

      if (variantError) throw variantError;

      // 4. Create initial stock location if provided
      let stockLocations: Tables<"product_stock_locations">[] = [];
      if (location_id && initial_quantity > 0) {
        const stockInsert: TablesInsert<"product_stock_locations"> = {
          product_id: product.id,
          location_id,
          quantity: initial_quantity,
        };

        const { data: stock, error: stockError } = await this.supabase
          .from("product_stock_locations")
          .insert(stockInsert)
          .select()
          .single();

        if (stockError) throw stockError;
        stockLocations = [stock];
      }

      // 5. Return the complete product with relations
      return {
        ...product,
        variants: [
          {
            ...variant,
            stock_locations: stockLocations,
          },
        ],
        inventory_data: inventoryData,
        ecommerce_data: null,
        suppliers: [],
      };
    } catch (error) {
      console.error("Error creating product:", error);
      throw error;
    }
  }

  async updateProduct(productData: UpdateProductData): Promise<ProductWithVariants> {
    const {
      id,
      name,
      description,
      sku,
      barcode,
      code,
      default_unit,
      main_image_id,
      purchase_price,
      vat_rate,
      weight,
      dimensions,
      packaging_type,
    } = productData;

    try {
      // 1. Update the main product
      const productUpdate: TablesUpdate<"products"> = {
        name,
        description,
        sku,
        barcode,
        code,
        default_unit,
        main_image_id,
      };

      const { error: productError } = await this.supabase
        .from("products")
        .update(productUpdate)
        .eq("id", id)
        .select()
        .single();

      if (productError) throw productError;

      // 2. Update inventory data if provided
      if (
        purchase_price !== undefined ||
        vat_rate !== undefined ||
        weight !== undefined ||
        dimensions ||
        packaging_type
      ) {
        const inventoryUpdate: TablesUpdate<"product_inventory_data"> = {
          purchase_price,
          vat_rate,
          weight,
          dimensions,
          packaging_type,
        };

        const { error: inventoryError } = await this.supabase
          .from("product_inventory_data")
          .upsert({ product_id: id, ...inventoryUpdate })
          .eq("product_id", id);

        if (inventoryError) throw inventoryError;
      }

      // 3. Fetch and return the updated product with relations
      return await this.getProductById(id);
    } catch (error) {
      console.error("Error updating product:", error);
      throw error;
    }
  }

  async deleteProduct(productId: string): Promise<void> {
    try {
      // Soft delete by setting deleted_at timestamp
      const { error } = await this.supabase
        .from("products")
        .update({ deleted_at: new Date().toISOString() })
        .eq("id", productId);

      if (error) throw error;
    } catch (error) {
      console.error("Error deleting product:", error);
      throw error;
    }
  }

  async getProductById(productId: string): Promise<ProductWithVariants> {
    try {
      const { data: product, error: productError } = await this.supabase
        .from("products")
        .select(
          `
  *,
  variants:product_variants(
    *,
    stock_locations:product_stock_locations(
      *,
      location:locations!inner(branch_id)
    )
  ),
  inventory_data:product_inventory_data(*),
  ecommerce_data:product_ecommerce_data(*),
  suppliers:product_suppliers(
    supplier:suppliers(*)
  )
`,
          { count: "exact" }
        )

        .eq("id", productId)
        .is("deleted_at", null)
        .single();

      if (productError) throw productError;

      // Transform the suppliers data structure
      const suppliers = product.suppliers?.map((ps: any) => ps.supplier) || [];

      return {
        ...product,
        suppliers,
      } as ProductWithVariants;
    } catch (error) {
      console.error("Error getting product by ID:", error);
      throw error;
    }
  }

  async getProductsByBranch(
    branchId: string,
    filters?: {
      search?: string;
      minPrice?: number;
      maxPrice?: number;
      supplierId?: string;
      locationId?: string;
      showLowStock?: boolean;
      limit?: number;
      offset?: number;
    }
  ): Promise<{ products: ProductWithVariants[]; total: number }> {
    try {
      // Build the base query with proper supplier filtering
      let selectQuery = `
        *,
        variants:product_variants(*),
        stock_locations:product_stock_locations(
          *,
          location:locations!inner(branch_id)
        ),
        inventory_data:product_inventory_data(*),
        ecommerce_data:product_ecommerce_data(*)`;

      // If filtering by supplier, only include products that have that supplier relationship
      if (filters?.supplierId) {
        selectQuery += `,
        suppliers:product_suppliers!inner(
          supplier:suppliers!inner(*)
        )`;
      } else {
        selectQuery += `,
        suppliers:product_suppliers(
          supplier:suppliers(*)
        )`;
      }

      let query = this.supabase
        .from("products")
        .select(selectQuery, { count: "exact" })
        .eq("stock_locations.location.branch_id", branchId)
        .is("deleted_at", null);

      // Apply supplier filter with inner join
      if (filters?.supplierId) {
        query = query.eq("suppliers.supplier_id", filters.supplierId);
      }

      if (filters?.search) {
        query = query.or(
          `name.ilike.%${filters.search}%,description.ilike.%${filters.search}%,sku.ilike.%${filters.search}%`
        );
      }

      if (filters?.locationId) {
        query = query.eq("stock_locations.location_id", filters.locationId);
      }

      if (filters?.limit) {
        query = query.range(filters.offset || 0, (filters.offset || 0) + filters.limit - 1);
      }

      const { data: products, error, count } = await query;
      if (error) throw error;

      const transformedProducts = (products || []).map((product: any) => ({
        ...product,
        suppliers: product.suppliers?.map((ps: any) => ps.supplier) || [],
      })) as ProductWithVariants[];

      let filteredProducts = transformedProducts;

      if (filters?.minPrice !== undefined || filters?.maxPrice !== undefined) {
        filteredProducts = filteredProducts.filter((product) => {
          const price = product.inventory_data?.purchase_price || 0;
          if (filters.minPrice !== undefined && price < filters.minPrice) return false;
          if (filters.maxPrice !== undefined && price > filters.maxPrice) return false;
          return true;
        });
      }

      if (filters?.showLowStock) {
        filteredProducts = filteredProducts.filter((product) => {
          const totalStock =
            product.stock_locations?.reduce((sum, sl) => sum + (sl.quantity || 0), 0) || 0;
          return totalStock < 10;
        });
      }

      return {
        products: filteredProducts,
        total: count || filteredProducts.length,
      };
    } catch (error) {
      console.error("Error getting products by branch:", error);
      throw error;
    }
  }

  async updateProductStock(productId: string, locationId: string, quantity: number): Promise<void> {
    try {
      const { error } = await this.supabase.from("product_stock_locations").upsert({
        product_id: productId,
        location_id: locationId,
        quantity,
      });

      if (error) throw error;
    } catch (error) {
      console.error("Error updating product stock:", error);
      throw error;
    }
  }

  async getProductTypes(organizationId: string): Promise<Tables<"product_types">[]> {
    try {
      const { data, error } = await this.supabase
        .from("product_types")
        .select("*")
        .eq("organization_id", organizationId)
        .order("name");

      if (error) throw error;
      return data || [];
    } catch (error) {
      console.error("Error getting product types:", error);
      throw error;
    }
  }

  async getLocationsByBranch(branchId: string): Promise<Tables<"locations">[]> {
    try {
      const { data, error } = await this.supabase
        .from("locations")
        .select("*")
        .eq("branch_id", branchId)
        .is("deleted_at", null)
        .order("name");

      if (error) throw error;
      return data || [];
    } catch (error) {
      console.error("Error getting locations by branch:", error);
      throw error;
    }
  }
}

// Export a singleton instance
export const productService = new ProductService();
