import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "react-toastify";
import {
  getProducts,
  getProductById,
  createProduct,
  updateProduct,
  deleteProduct,
  permanentlyDeleteProduct,
  addBarcode,
  removeBarcode,
  setPrimaryBarcode,
  getProductBarcodes,
} from "@/app/[locale]/dashboard/warehouse/products/_actions";
import type {
  ProductFilters,
  CreateProductInput,
  UpdateProductInput,
  CreateBarcodeInput,
} from "@/server/schemas/products.schema";

/**
 * Hook to fetch products with optional filters
 */
export function useProducts(filters?: ProductFilters) {
  return useQuery({
    queryKey: ["products", filters],
    queryFn: async () => {
      return await getProducts(filters || { page: 1, pageSize: 20 });
    },
    staleTime: 5 * 60 * 1000, // 5 minutes
  });
}

/**
 * Hook to fetch a single product by ID
 */
export function useProduct(productId: string | null) {
  return useQuery({
    queryKey: ["products", productId],
    queryFn: async () => {
      if (!productId) return null;
      return await getProductById(productId);
    },
    enabled: !!productId,
    staleTime: 5 * 60 * 1000,
  });
}

/**
 * Hook to create a new product
 */
export function useCreateProduct() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: CreateProductInput) => {
      return await createProduct(input);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["products"] });
      toast.success("Product created successfully");
    },
    onError: (error: Error) => {
      toast.error(error.message || "Failed to create product");
    },
  });
}

/**
 * Hook to update an existing product
 */
export function useUpdateProduct() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ productId, input }: { productId: string; input: UpdateProductInput }) => {
      return await updateProduct(productId, input);
    },
    onSuccess: (data, variables) => {
      queryClient.invalidateQueries({ queryKey: ["products"] });
      queryClient.invalidateQueries({ queryKey: ["products", variables.productId] });
      toast.success("Product updated successfully");
    },
    onError: (error: Error) => {
      toast.error(error.message || "Failed to update product");
    },
  });
}

/**
 * Hook to delete a product (soft delete)
 */
export function useDeleteProduct() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (productId: string) => {
      return await deleteProduct(productId);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["products"] });
      toast.success("Product deleted successfully");
    },
    onError: (error: Error) => {
      toast.error(error.message || "Failed to delete product");
    },
  });
}

/**
 * Hook to permanently delete a product
 */
export function usePermanentlyDeleteProduct() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (productId: string) => {
      return await permanentlyDeleteProduct(productId);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["products"] });
      toast.success("Product permanently deleted");
    },
    onError: (error: Error) => {
      toast.error(error.message || "Failed to permanently delete product");
    },
  });
}

/**
 * Hook to fetch product barcodes
 */
export function useProductBarcodes(productId: string | null) {
  return useQuery({
    queryKey: ["product-barcodes", productId],
    queryFn: async () => {
      if (!productId) return [];
      return await getProductBarcodes(productId);
    },
    enabled: !!productId,
    staleTime: 5 * 60 * 1000,
  });
}

/**
 * Hook to add a barcode to a product
 */
export function useAddBarcode() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: CreateBarcodeInput) => {
      return await addBarcode(input);
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["product-barcodes", data.product_id] });
      queryClient.invalidateQueries({ queryKey: ["products", data.product_id] });
      toast.success("Barcode added successfully");
    },
    onError: (error: Error) => {
      toast.error(error.message || "Failed to add barcode");
    },
  });
}

/**
 * Hook to remove a barcode
 */
export function useRemoveBarcode() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (barcodeId: string) => {
      return await removeBarcode(barcodeId);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["product-barcodes"] });
      queryClient.invalidateQueries({ queryKey: ["products"] });
      toast.success("Barcode removed successfully");
    },
    onError: (error: Error) => {
      toast.error(error.message || "Failed to remove barcode");
    },
  });
}

/**
 * Hook to set a barcode as primary
 */
export function useSetPrimaryBarcode() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ barcodeId, productId }: { barcodeId: string; productId: string }) => {
      return await setPrimaryBarcode(barcodeId, productId);
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ["product-barcodes", variables.productId] });
      queryClient.invalidateQueries({ queryKey: ["products", variables.productId] });
      toast.success("Primary barcode updated");
    },
    onError: (error: Error) => {
      toast.error(error.message || "Failed to set primary barcode");
    },
  });
}
