/**
 * Stock Alerts & Notifications Service
 * Phase 3 of Inventory Replenishment System
 *
 * This service manages the two-tier alert system:
 * - Tier 1: UI monitoring for ALL products below reorder point
 * - Tier 2: Active notifications for selected products
 */

import { createClient } from "@/utils/supabase/client";
import type {
  StockAlertWithProduct,
  StockAlertWithRelations,
  AlertSummary,
  AlertsBySupplier,
  AlertDetectionResult,
  AlertFilters,
  AlertSeverity,
} from "../types/stock-alerts";
import { determineAlertType, determineSeverity } from "../types/stock-alerts";

// =====================================================
// Database Function Calls
// =====================================================

/**
 * Runs the stock level check and creates alerts
 * Calls the check_stock_levels_and_alert database function
 */
export async function checkStockLevelsAndAlert(
  organizationId?: string
): Promise<AlertDetectionResult> {
  const supabase = createClient();

  const { data, error } = await supabase.rpc("check_stock_levels_and_alert", {
    p_organization_id: organizationId ?? null,
  });

  if (error) {
    console.error("Error checking stock levels:", error);
    throw new Error(`Failed to check stock levels: ${error.message}`);
  }

  if (!data || data.length === 0) {
    return {
      alerts_created: 0,
      alerts_resolved: 0,
      notifications_pending: 0,
    };
  }

  return {
    alerts_created: data[0].alerts_created,
    alerts_resolved: data[0].alerts_resolved,
    notifications_pending: data[0].notifications_pending,
  };
}

/**
 * Gets alert summary for dashboard
 */
export async function getAlertSummary(organizationId: string): Promise<AlertSummary> {
  const supabase = createClient();

  const { data, error } = await supabase.rpc("get_alert_summary", {
    p_organization_id: organizationId,
  });

  if (error) {
    console.error("Error fetching alert summary:", error);
    throw new Error(`Failed to fetch alert summary: ${error.message}`);
  }

  if (!data || data.length === 0) {
    return {
      total_active: 0,
      critical_count: 0,
      warning_count: 0,
      info_count: 0,
      out_of_stock_count: 0,
      notification_enabled_count: 0,
      pending_notifications: 0,
    };
  }

  return data[0] as AlertSummary;
}

/**
 * Gets low stock alerts grouped by supplier for batch PO creation
 */
export async function getLowStockBySupplier(organizationId: string): Promise<AlertsBySupplier[]> {
  const supabase = createClient();

  const { data, error } = await supabase.rpc("get_low_stock_by_supplier", {
    p_organization_id: organizationId,
  });

  if (error) {
    console.error("Error fetching low stock by supplier:", error);
    throw new Error(`Failed to fetch low stock by supplier: ${error.message}`);
  }

  return (data || []) as AlertsBySupplier[];
}

// =====================================================
// Alert Retrieval
// =====================================================

/**
 * Gets alerts with optional filters
 */
export async function getAlerts(
  organizationId: string,
  filters?: AlertFilters
): Promise<StockAlertWithProduct[]> {
  const supabase = createClient();

  let query = supabase
    .from("stock_alerts")
    .select(
      `
      *,
      product:products!inner (
        id,
        name,
        sku,
        base_unit,
        description,
        send_low_stock_alerts
      ),
      product_variant:product_variants (
        id,
        variant_name,
        sku
      )
    `
    )
    .eq("organization_id", organizationId)
    .order("created_at", { ascending: false });

  // Apply filters
  if (filters?.status && filters.status.length > 0) {
    query = query.in("status", filters.status);
  }

  if (filters?.severity && filters.severity.length > 0) {
    query = query.in("severity", filters.severity);
  }

  if (filters?.alert_type && filters.alert_type.length > 0) {
    query = query.in("alert_type", filters.alert_type);
  }

  if (filters?.supplier_id) {
    query = query.eq("suggested_supplier_id", filters.supplier_id);
  }

  if (filters?.location_id) {
    query = query.eq("location_id", filters.location_id);
  }

  if (filters?.branch_id) {
    query = query.eq("branch_id", filters.branch_id);
  }

  if (filters?.date_from) {
    query = query.gte("created_at", filters.date_from);
  }

  if (filters?.date_to) {
    query = query.lte("created_at", filters.date_to);
  }

  if (filters?.notification_enabled_only) {
    query = query.eq("notification_sent", false);
  }

  if (filters?.search) {
    // Search by product name or SKU
    // Note: This requires a text search or multiple queries
    // For now, we'll filter client-side after fetch
  }

  const { data, error } = await query;

  if (error) {
    console.error("Error fetching alerts:", error);
    throw new Error(`Failed to fetch alerts: ${error.message}`);
  }

  let alerts = (data || []) as StockAlertWithProduct[];

  // Client-side search filter
  if (filters?.search) {
    const searchLower = filters.search.toLowerCase();
    alerts = alerts.filter(
      (alert) =>
        alert.product.name.toLowerCase().includes(searchLower) ||
        alert.product.sku.toLowerCase().includes(searchLower)
    );
  }

  return alerts;
}

/**
 * Gets a single alert with all relations
 */
export async function getAlertById(alertId: string): Promise<StockAlertWithRelations | null> {
  const supabase = createClient();

  const { data, error } = await supabase
    .from("stock_alerts")
    .select(
      `
      *,
      product:products!inner (
        id,
        name,
        sku,
        base_unit,
        description,
        send_low_stock_alerts
      ),
      product_variant:product_variants (
        id,
        variant_name,
        sku
      ),
      supplier:business_accounts!stock_alerts_suggested_supplier_id_fkey (
        id,
        name,
        email,
        phone
      ),
      location:locations (
        id,
        name,
        location_type
      ),
      acknowledged_by_user:users!stock_alerts_acknowledged_by_fkey (
        id,
        email,
        full_name
      ),
      resolved_by_user:users!stock_alerts_resolved_by_fkey (
        id,
        email,
        full_name
      )
    `
    )
    .eq("id", alertId)
    .single();

  if (error) {
    console.error("Error fetching alert:", error);
    return null;
  }

  return data as StockAlertWithRelations;
}

/**
 * Gets active alerts for a specific product
 */
export async function getActiveAlertsForProduct(
  productId: string
): Promise<StockAlertWithProduct[]> {
  const supabase = createClient();

  const { data, error } = await supabase
    .from("stock_alerts")
    .select(
      `
      *,
      product:products!inner (
        id,
        name,
        sku,
        base_unit,
        description,
        send_low_stock_alerts
      ),
      product_variant:product_variants (
        id,
        variant_name,
        sku
      )
    `
    )
    .eq("product_id", productId)
    .eq("status", "active")
    .order("created_at", { ascending: false });

  if (error) {
    console.error("Error fetching product alerts:", error);
    return [];
  }

  return (data || []) as StockAlertWithProduct[];
}

// =====================================================
// Alert Actions
// =====================================================

/**
 * Acknowledges an alert
 */
export async function acknowledgeAlert(
  alertId: string,
  userId: string
): Promise<{ success: boolean; error?: string }> {
  const supabase = createClient();

  const { error } = await supabase
    .from("stock_alerts")
    .update({
      status: "acknowledged",
      acknowledged_at: new Date().toISOString(),
      acknowledged_by: userId,
    })
    .eq("id", alertId)
    .in("status", ["active"]); // Only acknowledge active alerts

  if (error) {
    console.error("Error acknowledging alert:", error);
    return {
      success: false,
      error: error.message,
    };
  }

  return { success: true };
}

/**
 * Resolves an alert
 */
export async function resolveAlert(
  alertId: string,
  userId: string,
  resolutionNotes?: string
): Promise<{ success: boolean; error?: string }> {
  const supabase = createClient();

  const { error } = await supabase
    .from("stock_alerts")
    .update({
      status: "resolved",
      resolved_at: new Date().toISOString(),
      resolved_by: userId,
      resolution_notes: resolutionNotes || null,
    })
    .eq("id", alertId)
    .in("status", ["active", "acknowledged"]); // Can resolve active or acknowledged

  if (error) {
    console.error("Error resolving alert:", error);
    return {
      success: false,
      error: error.message,
    };
  }

  return { success: true };
}

/**
 * Ignores an alert
 */
export async function ignoreAlert(alertId: string): Promise<{ success: boolean; error?: string }> {
  const supabase = createClient();

  const { error } = await supabase
    .from("stock_alerts")
    .update({
      status: "ignored",
    })
    .eq("id", alertId)
    .in("status", ["active", "acknowledged"]);

  if (error) {
    console.error("Error ignoring alert:", error);
    return {
      success: false,
      error: error.message,
    };
  }

  return { success: true };
}

/**
 * Bulk acknowledge alerts
 */
export async function bulkAcknowledgeAlerts(
  alertIds: string[],
  userId: string
): Promise<{ success: boolean; updated: number; error?: string }> {
  const supabase = createClient();

  const { error, count } = await supabase
    .from("stock_alerts")
    .update({
      status: "acknowledged",
      acknowledged_at: new Date().toISOString(),
      acknowledged_by: userId,
    })
    .in("id", alertIds)
    .eq("status", "active");

  if (error) {
    console.error("Error bulk acknowledging alerts:", error);
    return {
      success: false,
      updated: 0,
      error: error.message,
    };
  }

  return {
    success: true,
    updated: count || 0,
  };
}

/**
 * Bulk resolve alerts
 */
export async function bulkResolveAlerts(
  alertIds: string[],
  userId: string,
  resolutionNotes?: string
): Promise<{ success: boolean; updated: number; error?: string }> {
  const supabase = createClient();

  const { error, count } = await supabase
    .from("stock_alerts")
    .update({
      status: "resolved",
      resolved_at: new Date().toISOString(),
      resolved_by: userId,
      resolution_notes: resolutionNotes || null,
    })
    .in("id", alertIds)
    .in("status", ["active", "acknowledged"]);

  if (error) {
    console.error("Error bulk resolving alerts:", error);
    return {
      success: false,
      updated: 0,
      error: error.message,
    };
  }

  return {
    success: true,
    updated: count || 0,
  };
}

// =====================================================
// Manual Alert Creation
// =====================================================

/**
 * Manually creates an alert for a product
 * (In case automated detection is disabled or for manual override)
 */
export async function createManualAlert(
  organizationId: string,
  branchId: string | null,
  productId: string,
  availableStock: number,
  reorderPoint: number,
  locationId?: string
): Promise<{ success: boolean; alertId?: string; error?: string }> {
  const supabase = createClient();

  // Determine alert type and severity
  const alertType = determineAlertType(availableStock, reorderPoint);
  const severity = determineSeverity(availableStock, reorderPoint);

  // Get product to check if notifications enabled
  const { data: product } = await supabase
    .from("products")
    .select("send_low_stock_alerts")
    .eq("id", productId)
    .single();

  const sendNotifications = product?.send_low_stock_alerts || false;

  const { data, error } = await supabase
    .from("stock_alerts")
    .insert({
      organization_id: organizationId,
      branch_id: branchId,
      product_id: productId,
      location_id: locationId || null,
      current_stock: availableStock,
      reorder_point: reorderPoint,
      available_stock: availableStock,
      alert_type: alertType,
      severity: severity,
      status: "active",
      notification_sent: !sendNotifications, // Mark as sent if notifications disabled
      notification_sent_at: sendNotifications ? null : new Date().toISOString(),
    })
    .select("id")
    .single();

  if (error) {
    console.error("Error creating manual alert:", error);
    return {
      success: false,
      error: error.message,
    };
  }

  return {
    success: true,
    alertId: data.id,
  };
}

// =====================================================
// Notification Management (Tier 2)
// =====================================================

/**
 * Gets alerts that need notifications sent
 */
export async function getAlertsNeedingNotification(
  organizationId: string
): Promise<StockAlertWithProduct[]> {
  const supabase = createClient();

  const { data, error } = await supabase
    .from("stock_alerts")
    .select(
      `
      *,
      product:products!inner (
        id,
        name,
        sku,
        base_unit,
        description,
        send_low_stock_alerts
      ),
      product_variant:product_variants (
        id,
        variant_name,
        sku
      )
    `
    )
    .eq("organization_id", organizationId)
    .eq("status", "active")
    .eq("notification_sent", false)
    .order("severity", { ascending: false })
    .order("created_at", { ascending: true });

  if (error) {
    console.error("Error fetching alerts needing notification:", error);
    return [];
  }

  return (data || []) as StockAlertWithProduct[];
}

/**
 * Marks notification as sent for an alert
 */
export async function markNotificationSent(
  alertId: string,
  notificationType: "email" | "push" | "both"
): Promise<{ success: boolean; error?: string }> {
  const supabase = createClient();

  const { error } = await supabase
    .from("stock_alerts")
    .update({
      notification_sent: true,
      notification_sent_at: new Date().toISOString(),
      notification_type: notificationType,
    })
    .eq("id", alertId);

  if (error) {
    console.error("Error marking notification as sent:", error);
    return {
      success: false,
      error: error.message,
    };
  }

  return { success: true };
}

// =====================================================
// Helper Functions
// =====================================================

/**
 * Checks if a product has active alerts
 */
export async function hasActiveAlerts(productId: string): Promise<boolean> {
  const supabase = createClient();

  const { count, error } = await supabase
    .from("stock_alerts")
    .select("id", { count: "exact", head: true })
    .eq("product_id", productId)
    .eq("status", "active");

  if (error) {
    console.error("Error checking active alerts:", error);
    return false;
  }

  return (count || 0) > 0;
}

/**
 * Gets count of active alerts by severity
 */
export async function getAlertCountsBySeverity(
  organizationId: string
): Promise<Record<AlertSeverity, number>> {
  const supabase = createClient();

  const { data, error } = await supabase
    .from("stock_alerts")
    .select("severity")
    .eq("organization_id", organizationId)
    .eq("status", "active");

  if (error) {
    console.error("Error fetching alert counts:", error);
    return { info: 0, warning: 0, critical: 0 };
  }

  const counts = { info: 0, warning: 0, critical: 0 };

  data?.forEach((alert: any) => {
    if (alert.severity in counts) {
      counts[alert.severity as AlertSeverity]++;
    }
  });

  return counts;
}
