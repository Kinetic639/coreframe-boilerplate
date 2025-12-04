/**
 * Sales Orders React Query Hooks
 * Client-side hooks for sales order operations
 */

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "react-toastify";
import {
  getSalesOrdersAction,
  getSalesOrderByIdAction,
  getSalesOrderByNumberAction,
  getOrdersByCustomerAction,
  getOrdersByStatusAction,
  createSalesOrderAction,
  updateSalesOrderAction,
  deleteSalesOrderAction,
  updateOrderStatusAction,
  releaseReservationForItemAction,
} from "@/app/[locale]/dashboard/warehouse/sales-orders/_actions";
import type {
  CreateSalesOrderInput,
  UpdateSalesOrderInput,
  SalesOrderFiltersInput,
  UpdateOrderStatusInput,
  SalesOrderStatus,
  ReleaseReservationForItemInput,
} from "@/server/schemas/sales-orders.schema";

// =====================================================
// QUERY KEYS
// =====================================================

export const salesOrderKeys = {
  all: ["sales-orders"] as const,
  lists: () => [...salesOrderKeys.all, "list"] as const,
  list: (filters: SalesOrderFiltersInput) => [...salesOrderKeys.lists(), filters] as const,
  details: () => [...salesOrderKeys.all, "detail"] as const,
  detail: (id: string) => [...salesOrderKeys.details(), id] as const,
  byNumber: (orderNumber: string) => [...salesOrderKeys.all, "by-number", orderNumber] as const,
  byCustomer: (customerId: string) => [...salesOrderKeys.all, "by-customer", customerId] as const,
  byStatus: (status: SalesOrderStatus) => [...salesOrderKeys.all, "by-status", status] as const,
};

// =====================================================
// QUERY HOOKS
// =====================================================

/**
 * Get all sales orders with filters
 */
export function useSalesOrders(filters: SalesOrderFiltersInput = {}) {
  return useQuery({
    queryKey: salesOrderKeys.list(filters),
    queryFn: async () => {
      const result = await getSalesOrdersAction(filters);
      if (!result.success) {
        throw new Error(result.error);
      }
      return result.data;
    },
    staleTime: 2 * 60 * 1000, // 2 minutes
  });
}

/**
 * Get a single sales order by ID
 */
export function useSalesOrder(id: string | null) {
  return useQuery({
    queryKey: salesOrderKeys.detail(id || ""),
    queryFn: async () => {
      if (!id) throw new Error("Sales order ID is required");
      const result = await getSalesOrderByIdAction(id);
      if (!result.success) {
        throw new Error(result.error);
      }
      return result.data;
    },
    enabled: !!id,
    staleTime: 2 * 60 * 1000, // 2 minutes
  });
}

/**
 * Get a sales order by order number
 */
export function useSalesOrderByNumber(orderNumber: string | null) {
  return useQuery({
    queryKey: salesOrderKeys.byNumber(orderNumber || ""),
    queryFn: async () => {
      if (!orderNumber) throw new Error("Order number is required");
      const result = await getSalesOrderByNumberAction(orderNumber);
      if (!result.success) {
        throw new Error(result.error);
      }
      return result.data;
    },
    enabled: !!orderNumber,
    staleTime: 2 * 60 * 1000, // 2 minutes
  });
}

/**
 * Get orders by customer
 */
export function useOrdersByCustomer(customerId: string | null) {
  return useQuery({
    queryKey: salesOrderKeys.byCustomer(customerId || ""),
    queryFn: async () => {
      if (!customerId) throw new Error("Customer ID is required");
      const result = await getOrdersByCustomerAction(customerId);
      if (!result.success) {
        throw new Error(result.error);
      }
      return result.data;
    },
    enabled: !!customerId,
    staleTime: 2 * 60 * 1000, // 2 minutes
  });
}

/**
 * Get orders by status
 */
export function useOrdersByStatus(status: SalesOrderStatus | null) {
  return useQuery({
    queryKey: salesOrderKeys.byStatus(status || "draft"),
    queryFn: async () => {
      if (!status) throw new Error("Status is required");
      const result = await getOrdersByStatusAction(status);
      if (!result.success) {
        throw new Error(result.error);
      }
      return result.data;
    },
    enabled: !!status,
    staleTime: 2 * 60 * 1000, // 2 minutes
  });
}

// =====================================================
// MUTATION HOOKS - CRUD
// =====================================================

/**
 * Create a new sales order
 */
export function useCreateSalesOrder() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: CreateSalesOrderInput) => {
      const result = await createSalesOrderAction(input);
      if (!result.success) {
        throw new Error(result.error);
      }
      return result.data;
    },
    onSuccess: () => {
      toast.success("Sales order created successfully");
      queryClient.invalidateQueries({ queryKey: salesOrderKeys.lists() });
    },
    onError: (error: Error) => {
      toast.error(`Failed to create sales order: ${error.message}`);
    },
  });
}

/**
 * Update a sales order
 */
export function useUpdateSalesOrder() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, data }: { id: string; data: UpdateSalesOrderInput }) => {
      const result = await updateSalesOrderAction(id, data);
      if (!result.success) {
        throw new Error(result.error);
      }
      return result.data;
    },
    onSuccess: (_, variables) => {
      toast.success("Sales order updated successfully");
      queryClient.invalidateQueries({ queryKey: salesOrderKeys.detail(variables.id) });
      queryClient.invalidateQueries({ queryKey: salesOrderKeys.lists() });
    },
    onError: (error: Error) => {
      toast.error(`Failed to update sales order: ${error.message}`);
    },
  });
}

/**
 * Delete a sales order
 */
export function useDeleteSalesOrder() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      const result = await deleteSalesOrderAction(id);
      if (!result.success) {
        throw new Error(result.error);
      }
      return result.data;
    },
    onSuccess: () => {
      toast.success("Sales order deleted successfully");
      queryClient.invalidateQueries({ queryKey: salesOrderKeys.lists() });
    },
    onError: (error: Error) => {
      toast.error(`Failed to delete sales order: ${error.message}`);
    },
  });
}

// =====================================================
// MUTATION HOOKS - STATUS
// =====================================================

/**
 * Update sales order status
 */
export function useUpdateOrderStatus() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, input }: { id: string; input: UpdateOrderStatusInput }) => {
      const result = await updateOrderStatusAction(id, input);
      if (!result.success) {
        throw new Error(result.error);
      }
      return result.data;
    },
    onSuccess: (_, variables) => {
      toast.success("Order status updated successfully");
      queryClient.invalidateQueries({ queryKey: salesOrderKeys.detail(variables.id) });
      queryClient.invalidateQueries({ queryKey: salesOrderKeys.lists() });
      // Also invalidate reservations if status changed to confirmed or cancelled
      if (variables.input.status === "confirmed" || variables.input.status === "cancelled") {
        queryClient.invalidateQueries({ queryKey: ["reservations"] });
      }
    },
    onError: (error: Error) => {
      toast.error(`Failed to update order status: ${error.message}`);
    },
  });
}

// =====================================================
// MUTATION HOOKS - RESERVATIONS
// =====================================================

/**
 * Release reservation for an order item when fulfilled
 */
export function useReleaseReservationForItem() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: ReleaseReservationForItemInput) => {
      const result = await releaseReservationForItemAction(input);
      if (!result.success) {
        throw new Error(result.error);
      }
      return result.data;
    },
    onSuccess: () => {
      toast.success("Reservation released successfully");
      // Invalidate relevant queries
      queryClient.invalidateQueries({ queryKey: salesOrderKeys.all });
      queryClient.invalidateQueries({ queryKey: ["reservations"] });
      queryClient.invalidateQueries({ queryKey: ["stock-inventory"] });
    },
    onError: (error: Error) => {
      toast.error(`Failed to release reservation: ${error.message}`);
    },
  });
}
