import { ActivityLogger } from "@/utils/activity-logger";
import type { ActivityContext } from "@/types/activities";
import { ACTION_SLUGS, ENTITY_TYPE_SLUGS } from "@/types/activities";

/**
 * Warehouse-specific activity logging utilities
 */
export class WarehouseActivityLogger {
  /**
   * Log product-related activities
   */
  static async logProductActivity(
    context: ActivityContext,
    action: string,
    productId: string,
    productName: string,
    metadata?: Record<string, unknown>
  ) {
    return ActivityLogger.logWarehouseActivity(
      context,
      ENTITY_TYPE_SLUGS.PRODUCT,
      action,
      productId,
      `Product "${productName}" was ${action}`,
      metadata
    );
  }

  static async logProductCreated(
    context: ActivityContext,
    productId: string,
    productName: string,
    metadata?: Record<string, unknown>
  ) {
    return this.logProductActivity(context, ACTION_SLUGS.CREATED, productId, productName, metadata);
  }

  static async logProductUpdated(
    context: ActivityContext,
    productId: string,
    productName: string,
    changes: Record<string, { old: unknown; new: unknown }>,
    metadata?: Record<string, unknown>
  ) {
    return ActivityLogger.logEntityUpdated(
      context,
      "warehouse",
      ENTITY_TYPE_SLUGS.PRODUCT,
      productId,
      productName,
      changes,
      metadata
    );
  }

  static async logProductDeleted(
    context: ActivityContext,
    productId: string,
    productName: string,
    metadata?: Record<string, unknown>
  ) {
    return this.logProductActivity(context, ACTION_SLUGS.DELETED, productId, productName, metadata);
  }

  /**
   * Log location-related activities
   */
  static async logLocationActivity(
    context: ActivityContext,
    action: string,
    locationId: string,
    locationName: string,
    metadata?: Record<string, unknown>
  ) {
    return ActivityLogger.logWarehouseActivity(
      context,
      ENTITY_TYPE_SLUGS.LOCATION,
      action,
      locationId,
      `Location "${locationName}" was ${action}`,
      metadata
    );
  }

  static async logLocationCreated(
    context: ActivityContext,
    locationId: string,
    locationName: string,
    parentLocationId?: string,
    metadata?: Record<string, unknown>
  ) {
    return this.logLocationActivity(context, ACTION_SLUGS.CREATED, locationId, locationName, {
      ...metadata,
      parentLocationId,
    });
  }

  static async logLocationMoved(
    context: ActivityContext,
    locationId: string,
    locationName: string,
    fromParentId: string,
    toParentId: string,
    metadata?: Record<string, unknown>
  ) {
    return this.logLocationActivity(context, ACTION_SLUGS.MOVED, locationId, locationName, {
      ...metadata,
      fromParentId,
      toParentId,
    });
  }

  static async logLocationQRGenerated(
    context: ActivityContext,
    locationId: string,
    locationName: string,
    metadata?: Record<string, unknown>
  ) {
    return ActivityLogger.logWarehouseActivity(
      context,
      ENTITY_TYPE_SLUGS.LOCATION,
      "qr_generated",
      locationId,
      `QR code generated for location "${locationName}"`,
      metadata
    );
  }

  /**
   * Log stock movement activities
   */
  static async logStockMovement(
    context: ActivityContext,
    movementId: string,
    movementType: string,
    productVariantId: string,
    quantity: number,
    fromLocationId?: string,
    toLocationId?: string,
    metadata?: Record<string, unknown>
  ) {
    return ActivityLogger.logWarehouseActivity(
      context,
      ENTITY_TYPE_SLUGS.STOCK_MOVEMENT,
      ACTION_SLUGS.CREATED,
      movementId,
      `Stock movement: ${quantity} units ${movementType}`,
      {
        ...metadata,
        movementType,
        productVariantId,
        quantity,
        fromLocationId,
        toLocationId,
      }
    );
  }

  static async logStockAdjustment(
    context: ActivityContext,
    adjustmentId: string,
    productVariantId: string,
    locationId: string,
    oldQuantity: number,
    newQuantity: number,
    reason: string,
    metadata?: Record<string, unknown>
  ) {
    const difference = newQuantity - oldQuantity;
    const action = difference > 0 ? "increase" : "decrease";

    return ActivityLogger.logWarehouseActivity(
      context,
      ENTITY_TYPE_SLUGS.STOCK_MOVEMENT,
      "adjustment",
      adjustmentId,
      `Stock ${action}: ${Math.abs(difference)} units (${oldQuantity} → ${newQuantity})`,
      {
        ...metadata,
        productVariantId,
        locationId,
        oldQuantity,
        newQuantity,
        difference,
        reason,
      }
    );
  }

  /**
   * Log supplier-related activities
   */
  static async logSupplierActivity(
    context: ActivityContext,
    action: string,
    supplierId: string,
    supplierName: string,
    metadata?: Record<string, unknown>
  ) {
    return ActivityLogger.logWarehouseActivity(
      context,
      ENTITY_TYPE_SLUGS.SUPPLIER,
      action,
      supplierId,
      `Supplier "${supplierName}" was ${action}`,
      metadata
    );
  }

  static async logSupplierCreated(
    context: ActivityContext,
    supplierId: string,
    supplierName: string,
    metadata?: Record<string, unknown>
  ) {
    return this.logSupplierActivity(
      context,
      ACTION_SLUGS.CREATED,
      supplierId,
      supplierName,
      metadata
    );
  }

  /**
   * Log audit-related activities
   */
  static async logAuditStarted(
    context: ActivityContext,
    auditId: string,
    locationId: string,
    locationName: string,
    metadata?: Record<string, unknown>
  ) {
    return ActivityLogger.logWarehouseActivity(
      context,
      ENTITY_TYPE_SLUGS.AUDIT,
      ACTION_SLUGS.STARTED,
      auditId,
      `Audit started for location "${locationName}"`,
      {
        ...metadata,
        locationId,
      }
    );
  }

  static async logAuditCompleted(
    context: ActivityContext,
    auditId: string,
    locationId: string,
    locationName: string,
    discrepancyCount: number,
    metadata?: Record<string, unknown>
  ) {
    return ActivityLogger.logWarehouseActivity(
      context,
      ENTITY_TYPE_SLUGS.AUDIT,
      ACTION_SLUGS.COMPLETED,
      auditId,
      `Audit completed for location "${locationName}" with ${discrepancyCount} discrepancies`,
      {
        ...metadata,
        locationId,
        discrepancyCount,
      }
    );
  }

  /**
   * Log delivery-related activities
   */
  static async logDeliveryReceived(
    context: ActivityContext,
    deliveryId: string,
    supplierId: string,
    supplierName: string,
    itemCount: number,
    metadata?: Record<string, unknown>
  ) {
    return ActivityLogger.logWarehouseActivity(
      context,
      ENTITY_TYPE_SLUGS.DELIVERY,
      "received",
      deliveryId,
      `Delivery received from "${supplierName}" with ${itemCount} items`,
      {
        ...metadata,
        supplierId,
        itemCount,
      }
    );
  }

  /**
   * Utility method to create activity context from request
   */
  static createContextFromRequest(
    organizationId: string,
    branchId: string | undefined,
    userId: string | undefined,
    req?: {
      url?: string;
      headers?: {
        "user-agent"?: string;
        "x-forwarded-for"?: string;
      };
    }
  ): ActivityContext {
    return {
      organizationId,
      branchId,
      userId,
      url: req?.url,
      userAgent: req?.headers?.["user-agent"],
      ipAddress: req?.headers?.["x-forwarded-for"]?.split(",")[0]?.trim(),
    };
  }
}
