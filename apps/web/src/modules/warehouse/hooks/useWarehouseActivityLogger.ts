"use client";

import { useCallback } from "react";
import { useAppStore } from "@/lib/stores/app-store";
import { WarehouseActivityLogger } from "../utils/activity-integration";
import type { ActivityContext } from "@/types/activities";

/**
 * Hook for warehouse-specific activity logging
 * Provides convenience methods for common warehouse operations
 */
export function useWarehouseActivityLogger() {
  const { activeOrgId, activeBranchId } = useAppStore();

  const createContext = useCallback((): ActivityContext | null => {
    if (!activeOrgId) {
      console.warn("No active organization");
      return null;
    }

    return {
      organizationId: activeOrgId,
      branchId: activeBranchId || undefined,
      userId: undefined, // This would come from auth context
      url: typeof window !== "undefined" ? window.location.href : undefined,
      userAgent: typeof navigator !== "undefined" ? navigator.userAgent : undefined,
    };
  }, [activeOrgId, activeBranchId]);

  // Helper to safely execute activity logging
  const safeLog = useCallback(
    async <T extends unknown[]>(
      logFunction: (context: ActivityContext, ...args: T) => Promise<string>,
      ...args: T
    ): Promise<string | null> => {
      const context = createContext();
      if (!context) return null;
      try {
        return await logFunction(context, ...args);
      } catch (error) {
        console.error("Failed to log warehouse activity:", error);
        return null;
      }
    },
    [createContext]
  );

  // Product activities
  const logProductCreated = useCallback(
    async (productId: string, productName: string, metadata?: Record<string, unknown>) => {
      return safeLog(WarehouseActivityLogger.logProductCreated, productId, productName, metadata);
    },
    [safeLog]
  );

  // Simplified wrapper methods using safeLog
  const logProductUpdated = useCallback(
    (
      productId: string,
      productName: string,
      changes: Record<string, { old: unknown; new: unknown }>,
      metadata?: Record<string, unknown>
    ) =>
      safeLog(WarehouseActivityLogger.logProductUpdated, productId, productName, changes, metadata),
    [safeLog]
  );

  const logProductDeleted = useCallback(
    (productId: string, productName: string, metadata?: Record<string, unknown>) =>
      safeLog(WarehouseActivityLogger.logProductDeleted, productId, productName, metadata),
    [safeLog]
  );

  const logLocationCreated = useCallback(
    (
      locationId: string,
      locationName: string,
      parentLocationId?: string,
      metadata?: Record<string, unknown>
    ) =>
      safeLog(
        WarehouseActivityLogger.logLocationCreated,
        locationId,
        locationName,
        parentLocationId,
        metadata
      ),
    [safeLog]
  );

  const logLocationMoved = useCallback(
    (
      locationId: string,
      locationName: string,
      fromParentId: string,
      toParentId: string,
      metadata?: Record<string, unknown>
    ) =>
      safeLog(
        WarehouseActivityLogger.logLocationMoved,
        locationId,
        locationName,
        fromParentId,
        toParentId,
        metadata
      ),
    [safeLog]
  );

  const logLocationQRGenerated = useCallback(
    (locationId: string, locationName: string, metadata?: Record<string, unknown>) =>
      safeLog(WarehouseActivityLogger.logLocationQRGenerated, locationId, locationName, metadata),
    [safeLog]
  );

  const logStockMovement = useCallback(
    (
      movementId: string,
      movementType: string,
      productVariantId: string,
      quantity: number,
      fromLocationId?: string,
      toLocationId?: string,
      metadata?: Record<string, unknown>
    ) =>
      safeLog(
        WarehouseActivityLogger.logStockMovement,
        movementId,
        movementType,
        productVariantId,
        quantity,
        fromLocationId,
        toLocationId,
        metadata
      ),
    [safeLog]
  );

  const logStockAdjustment = useCallback(
    (
      adjustmentId: string,
      productVariantId: string,
      locationId: string,
      oldQuantity: number,
      newQuantity: number,
      reason: string,
      metadata?: Record<string, unknown>
    ) =>
      safeLog(
        WarehouseActivityLogger.logStockAdjustment,
        adjustmentId,
        productVariantId,
        locationId,
        oldQuantity,
        newQuantity,
        reason,
        metadata
      ),
    [safeLog]
  );

  const logSupplierCreated = useCallback(
    (supplierId: string, supplierName: string, metadata?: Record<string, unknown>) =>
      safeLog(WarehouseActivityLogger.logSupplierCreated, supplierId, supplierName, metadata),
    [safeLog]
  );

  const logAuditStarted = useCallback(
    (
      auditId: string,
      locationId: string,
      locationName: string,
      metadata?: Record<string, unknown>
    ) =>
      safeLog(WarehouseActivityLogger.logAuditStarted, auditId, locationId, locationName, metadata),
    [safeLog]
  );

  const logAuditCompleted = useCallback(
    (
      auditId: string,
      locationId: string,
      locationName: string,
      discrepancyCount: number,
      metadata?: Record<string, unknown>
    ) =>
      safeLog(
        WarehouseActivityLogger.logAuditCompleted,
        auditId,
        locationId,
        locationName,
        discrepancyCount,
        metadata
      ),
    [safeLog]
  );

  const logDeliveryReceived = useCallback(
    (
      deliveryId: string,
      supplierId: string,
      supplierName: string,
      itemCount: number,
      metadata?: Record<string, unknown>
    ) =>
      safeLog(
        WarehouseActivityLogger.logDeliveryReceived,
        deliveryId,
        supplierId,
        supplierName,
        itemCount,
        metadata
      ),
    [safeLog]
  );

  return {
    // Product methods
    logProductCreated,
    logProductUpdated,
    logProductDeleted,

    // Location methods
    logLocationCreated,
    logLocationMoved,
    logLocationQRGenerated,

    // Stock methods
    logStockMovement,
    logStockAdjustment,

    // Supplier methods
    logSupplierCreated,

    // Audit methods
    logAuditStarted,
    logAuditCompleted,

    // Delivery methods
    logDeliveryReceived,
  };
}
