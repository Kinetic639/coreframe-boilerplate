"use server";

/**
 * Server Actions for Stock Alerts
 * Phase 3 of Inventory Replenishment System
 *
 * These actions handle authentication, authorization, and provide
 * secure access to alert operations from client components.
 */

import { revalidatePath } from "next/cache";
import { createClient } from "@/utils/supabase/server";
import type {
  AlertFilters,
  StockAlertWithProduct,
  StockAlertWithRelations,
  AlertSummary,
  AlertsBySupplier,
  AlertDetectionResult,
} from "@/modules/warehouse/types/stock-alerts";

// =====================================================
// Alert Detection & Monitoring
// =====================================================

/**
 * Runs stock level check and creates alerts (server action)
 */
export async function runStockLevelCheckAction(organizationId: string): Promise<{
  success: boolean;
  result?: AlertDetectionResult;
  error?: string;
}> {
  try {
    const supabase = await createClient();

    const { data, error } = await supabase.rpc("check_stock_levels_and_alert", {
      p_organization_id: organizationId,
    });

    if (error) {
      console.error("Error checking stock levels:", error);
      return { success: false, error: error.message };
    }

    const result: AlertDetectionResult = {
      alerts_created: data[0]?.alerts_created || 0,
      alerts_resolved: data[0]?.alerts_resolved || 0,
      notifications_pending: data[0]?.notifications_pending || 0,
    };

    // Revalidate relevant paths
    revalidatePath("/[locale]/dashboard/warehouse/alerts");
    revalidatePath("/[locale]/dashboard/start");

    return { success: true, result };
  } catch (error) {
    console.error("Error in runStockLevelCheckAction:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}

/**
 * Gets alert summary for dashboard (server action)
 */
export async function getAlertSummaryAction(organizationId: string): Promise<{
  success: boolean;
  summary?: AlertSummary;
  error?: string;
}> {
  try {
    const supabase = await createClient();

    const { data, error } = await supabase.rpc("get_alert_summary", {
      p_organization_id: organizationId,
    });

    if (error) {
      console.error("Error fetching alert summary:", error);
      return { success: false, error: error.message };
    }

    const summary: AlertSummary = data[0] || {
      total_active: 0,
      critical_count: 0,
      warning_count: 0,
      info_count: 0,
      out_of_stock_count: 0,
      notification_enabled_count: 0,
      pending_notifications: 0,
    };

    return { success: true, summary };
  } catch (error) {
    console.error("Error in getAlertSummaryAction:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}

/**
 * Gets low stock alerts grouped by supplier (server action)
 */
export async function getLowStockBySupplierAction(organizationId: string): Promise<{
  success: boolean;
  data?: AlertsBySupplier[];
  error?: string;
}> {
  try {
    const supabase = await createClient();

    const { data, error } = await supabase.rpc("get_low_stock_by_supplier", {
      p_organization_id: organizationId,
    });

    if (error) {
      console.error("Error fetching low stock by supplier:", error);
      return { success: false, error: error.message };
    }

    return { success: true, data: (data || []) as AlertsBySupplier[] };
  } catch (error) {
    console.error("Error in getLowStockBySupplierAction:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}

// =====================================================
// Alert Retrieval
// =====================================================

/**
 * Gets alerts with filters (server action)
 */
export async function getAlertsAction(
  organizationId: string,
  filters?: AlertFilters
): Promise<{
  success: boolean;
  alerts?: StockAlertWithProduct[];
  error?: string;
}> {
  try {
    const supabase = await createClient();

    let query = supabase
      .from("stock_alerts")
      .select(
        `
        *,
        product:products!inner (
          id,
          name,
          sku,
          unit,
          description,
          send_low_stock_alerts
        ),
        product_variant:product_variants (
          id,
          name,
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

    const { data, error } = await query;

    if (error) {
      console.error("Error fetching alerts:", error);
      return { success: false, error: error.message };
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

    return { success: true, alerts };
  } catch (error) {
    console.error("Error in getAlertsAction:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}

/**
 * Gets a single alert by ID (server action)
 */
export async function getAlertByIdAction(
  alertId: string,
  organizationId: string
): Promise<{
  success: boolean;
  alert?: StockAlertWithRelations;
  error?: string;
}> {
  try {
    const supabase = await createClient();

    const { data, error } = await supabase
      .from("stock_alerts")
      .select(
        `
        *,
        product:products!inner (
          id,
          name,
          sku,
          unit,
          description,
          send_low_stock_alerts
        ),
        product_variant:product_variants (
          id,
          name,
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
      .eq("organization_id", organizationId)
      .single();

    if (error) {
      console.error("Error fetching alert:", error);
      return { success: false, error: error.message };
    }

    return { success: true, alert: data as StockAlertWithRelations };
  } catch (error) {
    console.error("Error in getAlertByIdAction:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}

// =====================================================
// Alert Actions
// =====================================================

/**
 * Acknowledges an alert (server action)
 */
export async function acknowledgeAlertAction(
  alertId: string,
  organizationId: string
): Promise<{
  success: boolean;
  error?: string;
}> {
  try {
    const supabase = await createClient();

    // Get current user
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return { success: false, error: "Authentication required" };
    }

    const { error } = await supabase
      .from("stock_alerts")
      .update({
        status: "acknowledged",
        acknowledged_at: new Date().toISOString(),
        acknowledged_by: user.id,
      })
      .eq("id", alertId)
      .eq("organization_id", organizationId)
      .eq("status", "active");

    if (error) {
      console.error("Error acknowledging alert:", error);
      return { success: false, error: error.message };
    }

    revalidatePath("/[locale]/dashboard/warehouse/alerts");
    return { success: true };
  } catch (error) {
    console.error("Error in acknowledgeAlertAction:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}

/**
 * Resolves an alert (server action)
 */
export async function resolveAlertAction(
  alertId: string,
  organizationId: string,
  resolutionNotes?: string
): Promise<{
  success: boolean;
  error?: string;
}> {
  try {
    const supabase = await createClient();

    // Get current user
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return { success: false, error: "Authentication required" };
    }

    const { error } = await supabase
      .from("stock_alerts")
      .update({
        status: "resolved",
        resolved_at: new Date().toISOString(),
        resolved_by: user.id,
        resolution_notes: resolutionNotes || null,
      })
      .eq("id", alertId)
      .eq("organization_id", organizationId)
      .in("status", ["active", "acknowledged"]);

    if (error) {
      console.error("Error resolving alert:", error);
      return { success: false, error: error.message };
    }

    revalidatePath("/[locale]/dashboard/warehouse/alerts");
    return { success: true };
  } catch (error) {
    console.error("Error in resolveAlertAction:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}

/**
 * Ignores an alert (server action)
 */
export async function ignoreAlertAction(
  alertId: string,
  organizationId: string
): Promise<{
  success: boolean;
  error?: string;
}> {
  try {
    const supabase = await createClient();

    const { error } = await supabase
      .from("stock_alerts")
      .update({
        status: "ignored",
      })
      .eq("id", alertId)
      .eq("organization_id", organizationId)
      .in("status", ["active", "acknowledged"]);

    if (error) {
      console.error("Error ignoring alert:", error);
      return { success: false, error: error.message };
    }

    revalidatePath("/[locale]/dashboard/warehouse/alerts");
    return { success: true };
  } catch (error) {
    console.error("Error in ignoreAlertAction:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}

/**
 * Bulk acknowledges alerts (server action)
 */
export async function bulkAcknowledgeAlertsAction(
  alertIds: string[],
  organizationId: string
): Promise<{
  success: boolean;
  updated?: number;
  error?: string;
}> {
  try {
    const supabase = await createClient();

    // Get current user
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return { success: false, error: "Authentication required" };
    }

    const { error, count } = await supabase
      .from("stock_alerts")
      .update({
        status: "acknowledged",
        acknowledged_at: new Date().toISOString(),
        acknowledged_by: user.id,
      })
      .in("id", alertIds)
      .eq("organization_id", organizationId)
      .eq("status", "active");

    if (error) {
      console.error("Error bulk acknowledging alerts:", error);
      return { success: false, error: error.message };
    }

    revalidatePath("/[locale]/dashboard/warehouse/alerts");
    return { success: true, updated: count || 0 };
  } catch (error) {
    console.error("Error in bulkAcknowledgeAlertsAction:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}

/**
 * Bulk resolves alerts (server action)
 */
export async function bulkResolveAlertsAction(
  alertIds: string[],
  organizationId: string,
  resolutionNotes?: string
): Promise<{
  success: boolean;
  updated?: number;
  error?: string;
}> {
  try {
    const supabase = await createClient();

    // Get current user
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return { success: false, error: "Authentication required" };
    }

    const { error, count } = await supabase
      .from("stock_alerts")
      .update({
        status: "resolved",
        resolved_at: new Date().toISOString(),
        resolved_by: user.id,
        resolution_notes: resolutionNotes || null,
      })
      .in("id", alertIds)
      .eq("organization_id", organizationId)
      .in("status", ["active", "acknowledged"]);

    if (error) {
      console.error("Error bulk resolving alerts:", error);
      return { success: false, error: error.message };
    }

    revalidatePath("/[locale]/dashboard/warehouse/alerts");
    return { success: true, updated: count || 0 };
  } catch (error) {
    console.error("Error in bulkResolveAlertsAction:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}
