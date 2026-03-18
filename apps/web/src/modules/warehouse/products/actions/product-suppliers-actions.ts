/**
 * Product-Supplier Server Actions
 * Phase 0: Purchase Orders Implementation
 */

"use server";

import { createClient } from "@supabase/server";
import { ProductSuppliersService } from "../../api/product-suppliers-service";
import type {
  ProductSupplierFormData,
  ProductSupplierWithRelations,
  BestPriceResult,
  PriceHistoryResponse,
} from "../../types/product-suppliers";

// =====================================================
// Get Product Suppliers
// =====================================================

export async function getProductSuppliersAction(
  productId: string,
  activeOnly: boolean = true
): Promise<{
  success: boolean;
  data?: ProductSupplierWithRelations[];
  error?: string;
}> {
  try {
    const supabase = await createClient();
    const service = new ProductSuppliersService(supabase);

    const suppliers = await service.getProductSuppliers(productId, activeOnly);

    return {
      success: true,
      data: suppliers,
    };
  } catch (error) {
    console.error("Error fetching product suppliers:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Failed to fetch suppliers",
    };
  }
}

export async function getPreferredSupplierAction(productId: string): Promise<{
  success: boolean;
  data?: ProductSupplierWithRelations | null;
  error?: string;
}> {
  try {
    const supabase = await createClient();
    const service = new ProductSuppliersService(supabase);

    const supplier = await service.getPreferredSupplier(productId);

    return {
      success: true,
      data: supplier,
    };
  } catch (error) {
    console.error("Error fetching preferred supplier:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Failed to fetch preferred supplier",
    };
  }
}

export async function getBestPriceSupplierAction(
  productId: string,
  quantity: number
): Promise<{
  success: boolean;
  data?: BestPriceResult | null;
  error?: string;
}> {
  try {
    const supabase = await createClient();
    const service = new ProductSuppliersService(supabase);

    const result = await service.getBestPriceSupplier(productId, quantity);

    return {
      success: true,
      data: result,
    };
  } catch (error) {
    console.error("Error finding best price supplier:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Failed to find best price supplier",
    };
  }
}

// =====================================================
// Get Supplier Products
// =====================================================

export async function getSupplierProductsAction(
  supplierId: string,
  activeOnly: boolean = true
): Promise<{
  success: boolean;
  data?: ProductSupplierWithRelations[];
  error?: string;
}> {
  try {
    const supabase = await createClient();
    const service = new ProductSuppliersService(supabase);

    const products = await service.getSupplierProducts(supplierId, activeOnly);

    return {
      success: true,
      data: products,
    };
  } catch (error) {
    console.error("Error fetching supplier products:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Failed to fetch products",
    };
  }
}

// =====================================================
// Create and Update
// =====================================================

export async function addSupplierToProductAction(
  productId: string,
  data: ProductSupplierFormData
): Promise<{
  success: boolean;
  data?: any;
  error?: string;
}> {
  try {
    const supabase = await createClient();

    // Get current user
    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();

    if (userError || !user) {
      return {
        success: false,
        error: "Unauthorized: User not authenticated",
      };
    }

    const service = new ProductSuppliersService(supabase);
    const supplier = await service.addSupplier(productId, data, user.id);

    return {
      success: true,
      data: supplier,
    };
  } catch (error) {
    console.error("Error adding supplier:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Failed to add supplier",
    };
  }
}

export async function updateSupplierAction(
  id: string,
  data: Partial<ProductSupplierFormData>
): Promise<{
  success: boolean;
  data?: any;
  error?: string;
}> {
  try {
    const supabase = await createClient();

    // Get current user
    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();

    if (userError || !user) {
      return {
        success: false,
        error: "Unauthorized: User not authenticated",
      };
    }

    const service = new ProductSuppliersService(supabase);
    const supplier = await service.updateSupplier(id, data, user.id);

    return {
      success: true,
      data: supplier,
    };
  } catch (error) {
    console.error("Error updating supplier:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Failed to update supplier",
    };
  }
}

export async function removeSupplierAction(id: string): Promise<{
  success: boolean;
  error?: string;
}> {
  try {
    const supabase = await createClient();

    // Get current user (for authorization)
    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();

    if (userError || !user) {
      return {
        success: false,
        error: "Unauthorized: User not authenticated",
      };
    }

    const service = new ProductSuppliersService(supabase);
    await service.removeSupplier(id);

    return {
      success: true,
    };
  } catch (error) {
    console.error("Error removing supplier:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Failed to remove supplier",
    };
  }
}

export async function setPreferredSupplierAction(
  productId: string,
  supplierId: string
): Promise<{
  success: boolean;
  error?: string;
}> {
  try {
    const supabase = await createClient();

    // Get current user (for authorization)
    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();

    if (userError || !user) {
      return {
        success: false,
        error: "Unauthorized: User not authenticated",
      };
    }

    const service = new ProductSuppliersService(supabase);
    await service.setPreferredSupplier(productId, supplierId);

    return {
      success: true,
    };
  } catch (error) {
    console.error("Error setting preferred supplier:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Failed to set preferred supplier",
    };
  }
}

// =====================================================
// Price History
// =====================================================

export async function updateSupplierPriceAction(
  id: string,
  newPrice: number,
  reason: string
): Promise<{
  success: boolean;
  data?: any;
  error?: string;
}> {
  try {
    const supabase = await createClient();

    // Get current user
    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();

    if (userError || !user) {
      return {
        success: false,
        error: "Unauthorized: User not authenticated",
      };
    }

    const service = new ProductSuppliersService(supabase);
    const supplier = await service.updatePrice(id, newPrice, reason, user.id);

    return {
      success: true,
      data: supplier,
    };
  } catch (error) {
    console.error("Error updating price:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Failed to update price",
    };
  }
}

export async function getPriceHistoryAction(productSupplierId: string): Promise<{
  success: boolean;
  data?: PriceHistoryResponse;
  error?: string;
}> {
  try {
    const supabase = await createClient();
    const service = new ProductSuppliersService(supabase);

    const history = await service.getPriceHistory(productSupplierId);

    return {
      success: true,
      data: history,
    };
  } catch (error) {
    console.error("Error fetching price history:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Failed to fetch price history",
    };
  }
}

// =====================================================
// Utility Actions
// =====================================================

export async function getSupplierCountAction(productId: string): Promise<{
  success: boolean;
  data?: number;
  error?: string;
}> {
  try {
    const supabase = await createClient();
    const service = new ProductSuppliersService(supabase);

    const count = await service.getSupplierCount(productId);

    return {
      success: true,
      data: count,
    };
  } catch (error) {
    console.error("Error counting suppliers:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Failed to count suppliers",
    };
  }
}
