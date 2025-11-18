/**
 * Stock Alerts & Notifications Types
 * Phase 3 of Inventory Replenishment System
 *
 * These types define the two-tier alert system:
 * - Tier 1: ALL products below reorder_point (UI monitoring)
 * - Tier 2: Only selected products send notifications
 */

// =====================================================
// Core Alert Types
// =====================================================

/**
 * Alert type classification
 */
export type AlertType = "low_stock" | "out_of_stock" | "below_minimum";

/**
 * Alert severity levels
 */
export type AlertSeverity = "info" | "warning" | "critical";

/**
 * Alert status workflow
 */
export type AlertStatus = "active" | "acknowledged" | "resolved" | "ignored";

/**
 * Notification types for Tier 2 alerts
 */
export type NotificationType = "email" | "push" | "both";

/**
 * Stock alert record from database
 */
export interface StockAlert {
  id: string;
  organization_id: string;
  branch_id: string | null;
  product_id: string;
  product_variant_id: string | null;
  location_id: string | null;

  // Stock levels (snapshot at alert creation)
  current_stock: number; // Available stock (quantity_on_hand - reserved_quantity)
  reorder_point: number;
  available_stock: number; // Same as current_stock (for compatibility)
  quantity_on_hand: number | null; // Physical stock in warehouse
  reserved_quantity: number | null; // Stock reserved for orders

  // Suggested replenishment (from Phase 2 calculation)
  suggested_order_quantity: number | null;
  suggested_packages: number | null;
  suggested_supplier_id: string | null;
  calculation_method: "fixed" | "min_max" | "auto" | null;
  calculation_notes: string | null;

  // Alert classification
  alert_type: AlertType;
  severity: AlertSeverity;

  // Two-tier notification system
  notification_sent: boolean;
  notification_sent_at: string | null;
  notification_type: NotificationType | null;

  // Status tracking
  status: AlertStatus;
  acknowledged_at: string | null;
  acknowledged_by: string | null;
  resolved_at: string | null;
  resolved_by: string | null;
  resolution_notes: string | null;

  // Timestamps
  created_at: string;
  updated_at: string;
}

// =====================================================
// Extended Alert Types with Relations
// =====================================================

/**
 * Stock alert with product details
 */
export interface StockAlertWithProduct extends StockAlert {
  product: {
    id: string;
    name: string;
    sku: string;
    unit: string;
    description: string | null;
    send_low_stock_alerts: boolean;
  };
  product_variant?: {
    id: string;
    name: string;
    sku: string;
  } | null;
}

/**
 * Stock alert with all relations for detail view
 */
export interface StockAlertWithRelations extends StockAlertWithProduct {
  supplier?: {
    id: string;
    name: string;
    email: string | null;
    phone: string | null;
  } | null;
  location?: {
    id: string;
    name: string;
    location_type: string;
  } | null;
  acknowledged_by_user?: {
    id: string;
    email: string;
    full_name: string | null;
  } | null;
  resolved_by_user?: {
    id: string;
    email: string;
    full_name: string | null;
  } | null;
}

// =====================================================
// Alert Summary & Dashboard Types
// =====================================================

/**
 * Alert summary for dashboard widget
 */
export interface AlertSummary {
  total_active: number;
  critical_count: number;
  warning_count: number;
  info_count: number;
  out_of_stock_count: number;
  notification_enabled_count: number; // Tier 2
  pending_notifications: number; // Tier 2
}

/**
 * Alert summary by supplier for batch PO creation
 */
export interface AlertsBySupplier {
  supplier_id: string;
  supplier_name: string;
  product_count: number;
  total_suggested_quantity: number;
  total_packages: number;
  products: AlertProductInfo[];
}

/**
 * Product info within supplier-grouped alerts
 */
export interface AlertProductInfo {
  alert_id: string;
  product_id: string;
  product_name: string;
  sku: string;
  unit: string;
  available_stock: number;
  reorder_point: number;
  suggested_quantity: number | null;
  suggested_packages: number | null;
  severity: AlertSeverity;
  alert_type: AlertType;
  created_at: string;
}

// =====================================================
// Alert Action Types
// =====================================================

/**
 * Data for acknowledging an alert
 */
export interface AcknowledgeAlertData {
  alert_id: string;
  acknowledged_by: string;
}

/**
 * Data for resolving an alert
 */
export interface ResolveAlertData {
  alert_id: string;
  resolved_by: string;
  resolution_notes?: string;
}

/**
 * Result of alert detection function
 */
export interface AlertDetectionResult {
  alerts_created: number;
  alerts_resolved: number;
  notifications_pending: number;
}

/**
 * Filter options for alerts list
 */
export interface AlertFilters {
  status?: AlertStatus[];
  severity?: AlertSeverity[];
  alert_type?: AlertType[];
  supplier_id?: string;
  location_id?: string;
  branch_id?: string;
  date_from?: string;
  date_to?: string;
  search?: string; // Search by product name/SKU
  notification_enabled_only?: boolean; // Tier 2 filter
}

// =====================================================
// Constants & Labels
// =====================================================

/**
 * Alert type labels
 */
export const ALERT_TYPE_LABELS: Record<AlertType, string> = {
  low_stock: "Low Stock",
  out_of_stock: "Out of Stock",
  below_minimum: "Below Minimum",
};

/**
 * Alert type descriptions
 */
export const ALERT_TYPE_DESCRIPTIONS: Record<AlertType, string> = {
  low_stock: "Stock level is below reorder point",
  out_of_stock: "Product is completely out of stock",
  below_minimum: "Stock is critically low (below 50% of reorder point)",
};

/**
 * Severity labels
 */
export const SEVERITY_LABELS: Record<AlertSeverity, string> = {
  info: "Info",
  warning: "Warning",
  critical: "Critical",
};

/**
 * Severity colors (Tailwind classes)
 */
export const SEVERITY_COLORS: Record<AlertSeverity, string> = {
  info: "text-blue-600 bg-blue-50 border-blue-200",
  warning: "text-yellow-600 bg-yellow-50 border-yellow-200",
  critical: "text-red-600 bg-red-50 border-red-200",
};

/**
 * Status labels
 */
export const STATUS_LABELS: Record<AlertStatus, string> = {
  active: "Active",
  acknowledged: "Acknowledged",
  resolved: "Resolved",
  ignored: "Ignored",
};

/**
 * Status colors (Tailwind classes)
 */
export const STATUS_COLORS: Record<AlertStatus, string> = {
  active: "text-red-600 bg-red-50 border-red-200",
  acknowledged: "text-yellow-600 bg-yellow-50 border-yellow-200",
  resolved: "text-green-600 bg-green-50 border-green-200",
  ignored: "text-gray-600 bg-gray-50 border-gray-200",
};

// =====================================================
// Helper Functions
// =====================================================

/**
 * Determines alert type based on stock levels
 */
export function determineAlertType(availableStock: number, reorderPoint: number): AlertType {
  if (availableStock === 0) {
    return "out_of_stock";
  }
  if (availableStock < reorderPoint * 0.5) {
    return "below_minimum";
  }
  return "low_stock";
}

/**
 * Determines severity based on stock levels
 */
export function determineSeverity(availableStock: number, reorderPoint: number): AlertSeverity {
  if (availableStock === 0) {
    return "critical";
  }
  if (availableStock < reorderPoint * 0.5) {
    return "critical";
  }
  return "warning";
}

/**
 * Checks if alert needs notification (Tier 2)
 */
export function needsNotification(alert: StockAlert): boolean {
  return !alert.notification_sent && alert.status === "active";
}

/**
 * Gets severity icon name
 */
export function getSeverityIcon(severity: AlertSeverity): string {
  switch (severity) {
    case "critical":
      return "alert-triangle";
    case "warning":
      return "alert-circle";
    case "info":
      return "info";
    default:
      return "bell";
  }
}

/**
 * Formats alert summary for display
 */
export function formatAlertSummary(summary: AlertSummary): string {
  const parts: string[] = [];

  if (summary.critical_count > 0) {
    parts.push(`${summary.critical_count} critical`);
  }
  if (summary.warning_count > 0) {
    parts.push(`${summary.warning_count} warnings`);
  }
  if (summary.info_count > 0) {
    parts.push(`${summary.info_count} info`);
  }

  return parts.length > 0 ? parts.join(", ") : "No active alerts";
}

/**
 * Groups alerts by supplier for batch PO creation
 */
export function groupAlertsBySupplier(alerts: StockAlertWithRelations[]): AlertsBySupplier[] {
  const supplierMap = new Map<string, AlertsBySupplier>();

  alerts.forEach((alert) => {
    if (!alert.supplier) return;

    const supplierId = alert.supplier.id;
    const existing = supplierMap.get(supplierId);

    const productInfo: AlertProductInfo = {
      alert_id: alert.id,
      product_id: alert.product_id,
      product_name: alert.product.name,
      sku: alert.product.sku,
      unit: alert.product.unit,
      available_stock: alert.available_stock,
      reorder_point: alert.reorder_point,
      suggested_quantity: alert.suggested_order_quantity,
      suggested_packages: alert.suggested_packages,
      severity: alert.severity,
      alert_type: alert.alert_type,
      created_at: alert.created_at,
    };

    if (existing) {
      existing.product_count++;
      existing.total_suggested_quantity += alert.suggested_order_quantity || 0;
      existing.total_packages += alert.suggested_packages || 0;
      existing.products.push(productInfo);
    } else {
      supplierMap.set(supplierId, {
        supplier_id: supplierId,
        supplier_name: alert.supplier.name,
        product_count: 1,
        total_suggested_quantity: alert.suggested_order_quantity || 0,
        total_packages: alert.suggested_packages || 0,
        products: [productInfo],
      });
    }
  });

  // Sort by total suggested quantity descending
  return Array.from(supplierMap.values()).sort(
    (a, b) => b.total_suggested_quantity - a.total_suggested_quantity
  );
}

/**
 * Validates if alert can be resolved
 */
export function canResolveAlert(alert: StockAlert): {
  canResolve: boolean;
  reason?: string;
} {
  if (alert.status !== "active" && alert.status !== "acknowledged") {
    return {
      canResolve: false,
      reason: `Alert is already ${alert.status}`,
    };
  }

  return { canResolve: true };
}

/**
 * Calculates alert age in hours
 */
export function getAlertAge(alert: StockAlert): number {
  const created = new Date(alert.created_at);
  const now = new Date();
  return Math.floor((now.getTime() - created.getTime()) / (1000 * 60 * 60));
}

/**
 * Formats alert age for display
 */
export function formatAlertAge(alert: StockAlert): string {
  const hours = getAlertAge(alert);

  if (hours < 1) {
    return "Just now";
  }
  if (hours === 1) {
    return "1 hour ago";
  }
  if (hours < 24) {
    return `${hours} hours ago`;
  }

  const days = Math.floor(hours / 24);
  if (days === 1) {
    return "1 day ago";
  }
  return `${days} days ago`;
}
