import { create } from "zustand";
import { devtools } from "zustand/middleware";
import type {
  ProductWithDetails,
  ProductSearchFilters,
  CreateProductData,
  UpdateProductData,
  CreateVariantData,
  CreateMovementData,
  CreateReservationData,
  StockMovementFilters,
  StockSnapshot,
} from "@/modules/warehouse/types/flexible-products";
import { flexibleProductService } from "@/modules/warehouse/api/flexible-products";

// Types for the store
interface ProductState {
  // Data state
  products: ProductWithDetails[];
  currentProduct: ProductWithDetails | null;
  searchResults: {
    products: ProductWithDetails[];
    total: number;
    filters: ProductSearchFilters | null;
  };

  // Stock data
  stockMovements: any[];
  stockSummary: Record<string, StockSnapshot>;

  // Loading states
  isLoadingProducts: boolean;
  isLoadingCurrent: boolean;
  isSearching: boolean;
  isCreatingProduct: boolean;
  isUpdatingProduct: boolean;
  isDeletingProduct: boolean;
  isLoadingStock: boolean;
  isCreatingMovement: boolean;

  // Error states
  productsError: string | null;
  currentError: string | null;
  searchError: string | null;
  actionError: string | null;
  stockError: string | null;

  // Meta state
  lastFetch: Date | null;
  pagination: {
    page: number;
    limit: number;
    total: number;
  };
}

interface ProductActions {
  // Product loading
  loadProducts: (filters?: ProductSearchFilters) => Promise<void>;
  loadProduct: (productId: string) => Promise<void>;
  clearCurrentProduct: () => void;

  // Search operations
  searchProducts: (filters: ProductSearchFilters) => Promise<void>;
  clearSearch: () => void;

  // CRUD operations
  createProduct: (productData: CreateProductData) => Promise<ProductWithDetails>;
  updateProduct: (productId: string, productData: UpdateProductData) => Promise<ProductWithDetails>;
  deleteProduct: (productId: string) => Promise<void>;

  // Variant operations
  createVariant: (variantData: CreateVariantData) => Promise<void>;
  updateVariant: (variantId: string, variantData: Partial<CreateVariantData>) => Promise<void>;
  deleteVariant: (variantId: string) => Promise<void>;

  // Stock operations
  loadStockMovements: (filters: StockMovementFilters) => Promise<void>;
  createStockMovement: (movementData: CreateMovementData) => Promise<void>;
  createReservation: (reservationData: CreateReservationData) => Promise<void>;
  updateStockSummary: (
    productId: string,
    variantId: string,
    organizationId: string,
    branchId: string,
    locationId: string
  ) => Promise<void>;

  // Pagination
  setPage: (page: number) => void;
  setLimit: (limit: number) => void;

  // Utility actions
  clearErrors: () => void;
  reset: () => void;
}

export type ProductStore = ProductState & ProductActions;

const initialState: ProductState = {
  products: [],
  currentProduct: null,
  searchResults: {
    products: [],
    total: 0,
    filters: null,
  },

  stockMovements: [],
  stockSummary: {},

  isLoadingProducts: false,
  isLoadingCurrent: false,
  isSearching: false,
  isCreatingProduct: false,
  isUpdatingProduct: false,
  isDeletingProduct: false,
  isLoadingStock: false,
  isCreatingMovement: false,

  productsError: null,
  currentError: null,
  searchError: null,
  actionError: null,
  stockError: null,

  lastFetch: null,
  pagination: {
    page: 1,
    limit: 20,
    total: 0,
  },
};

export const useProductStore = create<ProductStore>()(
  devtools(
    (set, get) => ({
      ...initialState,

      // Product loading
      loadProducts: async (filters?: ProductSearchFilters) => {
        set({ isLoadingProducts: true, productsError: null });

        try {
          const searchFilters = {
            ...filters,
            limit: get().pagination.limit,
            offset: (get().pagination.page - 1) * get().pagination.limit,
          };

          const result = await flexibleProductService.searchProducts(searchFilters);

          set({
            products: result.products,
            isLoadingProducts: false,
            lastFetch: new Date(),
            pagination: {
              ...get().pagination,
              total: result.total,
            },
          });
        } catch (error) {
          console.error("Error loading products:", error);
          set({
            productsError: error instanceof Error ? error.message : "Failed to load products",
            isLoadingProducts: false,
          });
        }
      },

      loadProduct: async (productId: string) => {
        set({ isLoadingCurrent: true, currentError: null });

        try {
          const product = await flexibleProductService.getProductById(productId);

          set({
            currentProduct: product,
            isLoadingCurrent: false,
          });
        } catch (error) {
          console.error("Error loading product:", error);
          set({
            currentError: error instanceof Error ? error.message : "Failed to load product",
            isLoadingCurrent: false,
            currentProduct: null,
          });
        }
      },

      clearCurrentProduct: () => {
        set({ currentProduct: null, currentError: null });
      },

      // Search operations
      searchProducts: async (filters: ProductSearchFilters) => {
        set({ isSearching: true, searchError: null });

        try {
          const searchFilters = {
            ...filters,
            limit: filters.limit || get().pagination.limit,
            offset: filters.offset || (get().pagination.page - 1) * get().pagination.limit,
          };

          const result = await flexibleProductService.searchProducts(searchFilters);

          set({
            searchResults: {
              products: result.products,
              total: result.total,
              filters: searchFilters,
            },
            isSearching: false,
          });
        } catch (error) {
          console.error("Error searching products:", error);
          set({
            searchError: error instanceof Error ? error.message : "Failed to search products",
            isSearching: false,
          });
        }
      },

      clearSearch: () => {
        set({
          searchResults: {
            products: [],
            total: 0,
            filters: null,
          },
          searchError: null,
        });
      },

      // CRUD operations
      createProduct: async (productData: CreateProductData) => {
        set({ isCreatingProduct: true, actionError: null });

        try {
          const product = await flexibleProductService.createProduct(productData);

          // Add to local products list if it matches current filters
          set((state) => ({
            products: [product, ...state.products],
            isCreatingProduct: false,
          }));

          return product;
        } catch (error) {
          console.error("Error creating product:", error);
          set({
            actionError: error instanceof Error ? error.message : "Failed to create product",
            isCreatingProduct: false,
          });
          throw error;
        }
      },

      updateProduct: async (productId: string, _productData: UpdateProductData) => {
        set({ isUpdatingProduct: true, actionError: null });

        try {
          // For now, we'll reload the product since we don't have the update method implemented
          // TODO: Implement updateProduct in the service
          await get().loadProduct(productId);

          const updatedProduct = get().currentProduct;
          if (!updatedProduct) throw new Error("Product not found after update");

          // Update in local products list
          set((state) => ({
            products: state.products.map((p) => (p.id === productId ? updatedProduct : p)),
            isUpdatingProduct: false,
          }));

          return updatedProduct;
        } catch (error) {
          console.error("Error updating product:", error);
          set({
            actionError: error instanceof Error ? error.message : "Failed to update product",
            isUpdatingProduct: false,
          });
          throw error;
        }
      },

      deleteProduct: async (productId: string) => {
        set({ isDeletingProduct: true, actionError: null });

        try {
          // TODO: Implement deleteProduct in the service
          // For now, we'll just remove from local state
          set((state) => ({
            products: state.products.filter((p) => p.id !== productId),
            currentProduct: state.currentProduct?.id === productId ? null : state.currentProduct,
            isDeletingProduct: false,
          }));
        } catch (error) {
          console.error("Error deleting product:", error);
          set({
            actionError: error instanceof Error ? error.message : "Failed to delete product",
            isDeletingProduct: false,
          });
          throw error;
        }
      },

      // Variant operations
      createVariant: async (variantData: CreateVariantData) => {
        set({ actionError: null });

        try {
          // TODO: Implement createVariant in the service
          // For now, reload the current product to get updated variants
          if (get().currentProduct?.id === variantData.product_id) {
            await get().loadProduct(variantData.product_id);
          }
        } catch (error) {
          console.error("Error creating variant:", error);
          set({
            actionError: error instanceof Error ? error.message : "Failed to create variant",
          });
          throw error;
        }
      },

      updateVariant: async (_variantId: string, _variantData: Partial<CreateVariantData>) => {
        set({ actionError: null });

        try {
          // TODO: Implement updateVariant in the service
          // For now, if we have a current product, reload it
          if (get().currentProduct) {
            await get().loadProduct(get().currentProduct!.id);
          }
        } catch (error) {
          console.error("Error updating variant:", error);
          set({
            actionError: error instanceof Error ? error.message : "Failed to update variant",
          });
          throw error;
        }
      },

      deleteVariant: async (_variantId: string) => {
        set({ actionError: null });

        try {
          // TODO: Implement deleteVariant in the service
          // For now, if we have a current product, reload it
          if (get().currentProduct) {
            await get().loadProduct(get().currentProduct!.id);
          }
        } catch (error) {
          console.error("Error deleting variant:", error);
          set({
            actionError: error instanceof Error ? error.message : "Failed to delete variant",
          });
          throw error;
        }
      },

      // Stock operations
      loadStockMovements: async (filters: StockMovementFilters) => {
        set({ isLoadingStock: true, stockError: null });

        try {
          const result = await flexibleProductService.getStockMovements(filters);

          set({
            stockMovements: result.movements,
            isLoadingStock: false,
          });
        } catch (error) {
          console.error("Error loading stock movements:", error);
          set({
            stockError: error instanceof Error ? error.message : "Failed to load stock movements",
            isLoadingStock: false,
          });
        }
      },

      createStockMovement: async (movementData: CreateMovementData) => {
        set({ isCreatingMovement: true, stockError: null });

        try {
          await flexibleProductService.createStockMovement(movementData);

          // Reload stock movements for this product/variant
          await get().loadStockMovements({
            product_id: movementData.product_id,
            variant_id: movementData.variant_id,
            limit: 50,
          });

          // Update stock summary
          await get().updateStockSummary(
            movementData.product_id,
            movementData.variant_id,
            movementData.organization_id,
            movementData.branch_id,
            movementData.location_id
          );

          set({ isCreatingMovement: false });
        } catch (error) {
          console.error("Error creating stock movement:", error);
          set({
            stockError: error instanceof Error ? error.message : "Failed to create stock movement",
            isCreatingMovement: false,
          });
          throw error;
        }
      },

      createReservation: async (reservationData: CreateReservationData) => {
        set({ stockError: null });

        try {
          await flexibleProductService.createReservation(reservationData);

          // Update stock summary after reservation
          await get().updateStockSummary(
            reservationData.product_id,
            reservationData.variant_id,
            reservationData.organization_id,
            reservationData.branch_id,
            reservationData.location_id
          );
        } catch (error) {
          console.error("Error creating reservation:", error);
          set({
            stockError: error instanceof Error ? error.message : "Failed to create reservation",
          });
          throw error;
        }
      },

      updateStockSummary: async (
        productId: string,
        variantId: string,
        organizationId: string,
        branchId: string,
        locationId: string
      ) => {
        try {
          const stockData = await flexibleProductService.calculateCurrentStock(
            organizationId,
            branchId,
            locationId,
            productId,
            variantId
          );

          const key = `${productId}-${variantId}-${locationId}`;

          set((state) => ({
            stockSummary: {
              ...state.stockSummary,
              [key]: {
                id: key,
                organization_id: organizationId,
                branch_id: branchId,
                location_id: locationId,
                product_id: productId,
                variant_id: variantId,
                quantity_on_hand: stockData.onHand,
                quantity_reserved: stockData.reserved,
                quantity_available: stockData.available,
                average_cost: null,
                total_value: null,
                last_movement_id: null,
                last_movement_at: null,
                updated_at: new Date().toISOString(),
              },
            },
          }));
        } catch (error) {
          console.error("Error updating stock summary:", error);
        }
      },

      // Pagination
      setPage: (page: number) => {
        set((state) => ({
          pagination: {
            ...state.pagination,
            page,
          },
        }));
      },

      setLimit: (limit: number) => {
        set((state) => ({
          pagination: {
            ...state.pagination,
            limit,
            page: 1, // Reset to first page when changing limit
          },
        }));
      },

      // Utility actions
      clearErrors: () => {
        set({
          productsError: null,
          currentError: null,
          searchError: null,
          actionError: null,
          stockError: null,
        });
      },

      reset: () => {
        set(initialState);
      },
    }),
    {
      name: "product-store",
    }
  )
);
