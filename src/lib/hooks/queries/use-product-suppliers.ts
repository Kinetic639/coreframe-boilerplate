import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "react-toastify";
import {
  getProductSuppliers,
  getPreferredSupplier,
  getBestPriceSupplier,
  getSupplierProducts,
  addSupplier,
  updateSupplier,
  removeSupplier,
  setPreferredSupplier,
  updatePrice,
  getPriceHistory,
  hasSuppliers,
  getSupplierCount,
} from "@/app/[locale]/dashboard/warehouse/products/suppliers/_actions";
import type {
  AddSupplierInput,
  UpdateSupplierInput,
  UpdatePriceInput,
  SetPreferredSupplierInput,
  GetBestPriceSupplierInput,
} from "@/server/schemas/product-suppliers.schema";

/**
 * Hook to fetch all suppliers for a product
 */
export function useProductSuppliers(productId: string | null, activeOnly: boolean = true) {
  return useQuery({
    queryKey: ["product-suppliers", productId, activeOnly],
    queryFn: async () => {
      if (!productId) return null;
      return await getProductSuppliers(productId, activeOnly);
    },
    enabled: !!productId,
    staleTime: 5 * 60 * 1000, // 5 minutes
  });
}

/**
 * Hook to fetch preferred supplier for a product
 */
export function usePreferredSupplier(productId: string | null) {
  return useQuery({
    queryKey: ["preferred-supplier", productId],
    queryFn: async () => {
      if (!productId) return null;
      return await getPreferredSupplier(productId);
    },
    enabled: !!productId,
    staleTime: 5 * 60 * 1000,
  });
}

/**
 * Hook to get best price supplier (mutation because it requires calculation)
 */
export function useGetBestPriceSupplier() {
  return useMutation({
    mutationFn: async (input: GetBestPriceSupplierInput) => {
      return await getBestPriceSupplier(input);
    },
  });
}

/**
 * Hook to fetch all products for a supplier
 */
export function useSupplierProducts(supplierId: string | null, activeOnly: boolean = true) {
  return useQuery({
    queryKey: ["supplier-products", supplierId, activeOnly],
    queryFn: async () => {
      if (!supplierId) return null;
      return await getSupplierProducts(supplierId, activeOnly);
    },
    enabled: !!supplierId,
    staleTime: 5 * 60 * 1000,
  });
}

/**
 * Hook to add a supplier to a product
 */
export function useAddSupplier() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: AddSupplierInput) => {
      return await addSupplier(input);
    },
    onSuccess: (data, variables) => {
      queryClient.invalidateQueries({ queryKey: ["product-suppliers", variables.product_id] });
      queryClient.invalidateQueries({ queryKey: ["preferred-supplier", variables.product_id] });
      queryClient.invalidateQueries({
        queryKey: ["supplier-products", variables.data.supplier_id],
      });
      toast.success("Supplier added successfully");
    },
    onError: (error: Error) => {
      toast.error(error.message || "Failed to add supplier");
    },
  });
}

/**
 * Hook to update product-supplier relationship
 */
export function useUpdateSupplier() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: UpdateSupplierInput) => {
      return await updateSupplier(input);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["product-suppliers"] });
      queryClient.invalidateQueries({ queryKey: ["preferred-supplier"] });
      queryClient.invalidateQueries({ queryKey: ["supplier-products"] });
      toast.success("Supplier updated successfully");
    },
    onError: (error: Error) => {
      toast.error(error.message || "Failed to update supplier");
    },
  });
}

/**
 * Hook to remove supplier from product
 */
export function useRemoveSupplier() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      return await removeSupplier(id);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["product-suppliers"] });
      queryClient.invalidateQueries({ queryKey: ["preferred-supplier"] });
      queryClient.invalidateQueries({ queryKey: ["supplier-products"] });
      toast.success("Supplier removed successfully");
    },
    onError: (error: Error) => {
      toast.error(error.message || "Failed to remove supplier");
    },
  });
}

/**
 * Hook to set preferred supplier
 */
export function useSetPreferredSupplier() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: SetPreferredSupplierInput) => {
      return await setPreferredSupplier(input);
    },
    onSuccess: (data, variables) => {
      queryClient.invalidateQueries({ queryKey: ["product-suppliers", variables.product_id] });
      queryClient.invalidateQueries({ queryKey: ["preferred-supplier", variables.product_id] });
      toast.success("Preferred supplier set successfully");
    },
    onError: (error: Error) => {
      toast.error(error.message || "Failed to set preferred supplier");
    },
  });
}

/**
 * Hook to update supplier price
 */
export function useUpdatePrice() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: UpdatePriceInput) => {
      return await updatePrice(input);
    },
    onSuccess: (data, variables) => {
      queryClient.invalidateQueries({ queryKey: ["product-suppliers"] });
      queryClient.invalidateQueries({ queryKey: ["price-history", variables.id] });
      toast.success("Price updated successfully");
    },
    onError: (error: Error) => {
      toast.error(error.message || "Failed to update price");
    },
  });
}

/**
 * Hook to fetch price history
 */
export function usePriceHistory(productSupplierId: string | null) {
  return useQuery({
    queryKey: ["price-history", productSupplierId],
    queryFn: async () => {
      if (!productSupplierId) return null;
      return await getPriceHistory(productSupplierId);
    },
    enabled: !!productSupplierId,
    staleTime: 10 * 60 * 1000, // 10 minutes (historical data changes infrequently)
  });
}

/**
 * Hook to check if product has suppliers
 */
export function useHasSuppliers(productId: string | null) {
  return useQuery({
    queryKey: ["has-suppliers", productId],
    queryFn: async () => {
      if (!productId) return false;
      return await hasSuppliers(productId);
    },
    enabled: !!productId,
    staleTime: 5 * 60 * 1000,
  });
}

/**
 * Hook to get supplier count for a product
 */
export function useSupplierCount(productId: string | null) {
  return useQuery({
    queryKey: ["supplier-count", productId],
    queryFn: async () => {
      if (!productId) return 0;
      return await getSupplierCount(productId);
    },
    enabled: !!productId,
    staleTime: 5 * 60 * 1000,
  });
}
