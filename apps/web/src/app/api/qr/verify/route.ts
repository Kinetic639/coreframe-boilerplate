import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { qrToken, scanType = "verification" } = await request.json();

    if (!qrToken) {
      return NextResponse.json({ error: "QR token is required" }, { status: 400 });
    }

    // Get current user (optional for some scan types)
    const {
      data: { user },
    } = await supabase.auth.getUser();

    // Look up the QR label
    const { data: qrLabel, error: labelError } = await supabase
      .from("qr_labels")
      .select(
        `
        *,
        label_templates (
          name,
          label_type,
          width_mm,
          height_mm
        )
      `
      )
      .eq("qr_token", qrToken)
      .eq("is_active", true)
      .single();

    let scanResult = "success";
    let errorMessage = null;
    let entity = null;

    if (labelError || !qrLabel) {
      scanResult = "not_found";
      errorMessage = "QR code not found or inactive";
    } else {
      // If QR is assigned to an entity, fetch entity details
      if (qrLabel.entity_type && qrLabel.entity_id) {
        if (qrLabel.entity_type === "location") {
          const { data: location } = await supabase
            .from("locations")
            .select("id, name, code, level")
            .eq("id", qrLabel.entity_id)
            .single();

          if (location) {
            entity = {
              type: "location",
              id: location.id,
              name: location.name,
              code: location.code,
              level: location.level,
            };
          }
        } else if (qrLabel.entity_type === "product") {
          const { data: product } = await supabase
            .from("products")
            .select("id, name, sku, code")
            .eq("id", qrLabel.entity_id)
            .single();

          if (product) {
            entity = {
              type: "product",
              id: product.id,
              name: product.name,
              code: product.sku || product.code,
            };
          }
        }
      }

      // Check user permissions if user is logged in
      if (user && qrLabel.organization_id) {
        // First check user preferences
        const { data: preferences } = await supabase
          .from("user_preferences")
          .select("organization_id")
          .eq("user_id", user.id)
          .single();

        let hasAccess = preferences?.organization_id === qrLabel.organization_id;

        // If no access through preferences, check role assignments
        if (!hasAccess) {
          const { data: roleAssignment } = await supabase
            .from("user_role_assignments")
            .select("scope, scope_id")
            .eq("user_id", user.id)
            .eq("scope", "org")
            .eq("scope_id", qrLabel.organization_id)
            .single();

          hasAccess = !!roleAssignment;
        }

        if (!hasAccess) {
          scanResult = "unauthorized";
          errorMessage = "Access denied to this organization";
          entity = null; // Don't reveal entity details if unauthorized
        }
      }
    }

    // Log the scan attempt
    const scanLogData = {
      qr_token: qrToken,
      scan_type: scanType,
      scanner_type: "manual", // Could be detected from user agent
      user_id: user?.id || null,
      scan_result: scanResult,
      error_message: errorMessage,
      scan_context: {
        entity_type: qrLabel?.entity_type || null,
        entity_id: qrLabel?.entity_id || null,
        user_agent: request.headers.get("user-agent"),
        timestamp: new Date().toISOString(),
      },
      organization_id: qrLabel?.organization_id || null,
      branch_id: qrLabel?.branch_id || null,
    };

    // Insert scan log (don't fail the request if this fails)
    try {
      await supabase.from("qr_scan_logs").insert(scanLogData);
    } catch (logError) {
      console.error("Failed to log scan:", logError);
    }

    // Return verification result
    const response = {
      success: scanResult === "success",
      qrLabel:
        scanResult === "success"
          ? {
              id: qrLabel?.id,
              qr_token: qrLabel?.qr_token,
              label_type: qrLabel?.label_type,
              entity_type: qrLabel?.entity_type,
              entity_id: qrLabel?.entity_id,
              assigned_at: qrLabel?.assigned_at,
              template: qrLabel?.label_templates,
            }
          : null,
      entity,
      error: errorMessage,
      scanResult,
    };

    const statusCode = scanResult === "success" ? 200 : scanResult === "unauthorized" ? 403 : 404;

    return NextResponse.json(response, { status: statusCode });
  } catch (error) {
    console.error("QR verify error:", error);

    // Log the error attempt
    try {
      const supabase = await createClient();
      await supabase.from("qr_scan_logs").insert({
        qr_token: (await request.json()).qrToken || "unknown",
        scan_type: "verification",
        scanner_type: "manual",
        scan_result: "error",
        error_message: error instanceof Error ? error.message : "Unknown error",
      });
    } catch (logError) {
      console.error("Failed to log error scan:", logError);
    }

    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
