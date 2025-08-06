import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    const body = await request.json();

    // Get current user
    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();
    if (userError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const {
      qrToken,
      entityType, // 'location' or 'product'
      entityId,
      generateNew = false, // If true, generate new QR instead of using existing token
    } = body;

    // Validate input
    if (!entityType || !entityId) {
      return NextResponse.json({ error: "Missing entity type or ID" }, { status: 400 });
    }

    if (!generateNew && !qrToken) {
      return NextResponse.json(
        { error: "QR token required when not generating new" },
        { status: 400 }
      );
    }

    // Get user's organization and branch context
    const { data: userRoles } = await supabase
      .from("user_roles")
      .select("organization_id, branch_id")
      .eq("user_id", user.id)
      .limit(1)
      .single();

    if (!userRoles) {
      return NextResponse.json({ error: "User context not found" }, { status: 400 });
    }

    let qrLabel = null;

    if (generateNew) {
      // Generate new QR label for this entity
      const { generateQRToken } = await import("@/lib/utils/qr-generator");
      const newQrToken = generateQRToken();

      const { data: createdLabel, error: createError } = await supabase
        .from("qr_labels")
        .insert({
          qr_token: newQrToken,
          label_type: entityType,
          entity_type: entityType,
          entity_id: entityId,
          assigned_at: new Date().toISOString(),
          assigned_by: user.id,
          created_by: user.id,
          organization_id: userRoles.organization_id,
          branch_id: userRoles.branch_id,
          is_active: true,
          metadata: {
            assignment_method: "generated_and_assigned",
            assigned_timestamp: new Date().toISOString(),
          },
        })
        .select()
        .single();

      if (createError) {
        console.error("QR label creation error:", createError);
        return NextResponse.json({ error: "Failed to create QR label" }, { status: 500 });
      }

      qrLabel = createdLabel;
    } else {
      // Use existing QR token
      // First verify the QR exists and is available
      const { data: existingLabel, error: labelError } = await supabase
        .from("qr_labels")
        .select("*")
        .eq("qr_token", qrToken)
        .eq("is_active", true)
        .single();

      if (labelError || !existingLabel) {
        return NextResponse.json({ error: "QR token not found or inactive" }, { status: 404 });
      }

      // Check if already assigned
      if (existingLabel.entity_id) {
        return NextResponse.json(
          {
            error: "QR code is already assigned to another entity",
            assignedTo: {
              type: existingLabel.entity_type,
              id: existingLabel.entity_id,
            },
          },
          { status: 409 }
        );
      }

      // Verify user has access to this QR
      if (existingLabel.organization_id !== userRoles.organization_id) {
        return NextResponse.json({ error: "Access denied" }, { status: 403 });
      }

      // Assign the QR to the entity
      const { data: updatedLabel, error: updateError } = await supabase
        .from("qr_labels")
        .update({
          entity_type: entityType,
          entity_id: entityId,
          assigned_at: new Date().toISOString(),
          assigned_by: user.id,
          metadata: {
            ...existingLabel.metadata,
            assignment_method: "manual_assignment",
            assigned_timestamp: new Date().toISOString(),
            previous_assignments: existingLabel.metadata?.previous_assignments || [],
          },
        })
        .eq("id", existingLabel.id)
        .select()
        .single();

      if (updateError) {
        console.error("QR label update error:", updateError);
        return NextResponse.json({ error: "Failed to assign QR label" }, { status: 500 });
      }

      qrLabel = updatedLabel;
    }

    // Update the target entity with QR assignment
    if (entityType === "location") {
      const { error: locationUpdateError } = await supabase
        .from("locations")
        .update({
          qr_label_id: qrLabel.id,
          has_qr_assigned: true,
          qr_assigned_at: new Date().toISOString(),
          qr_assigned_by: user.id,
        })
        .eq("id", entityId)
        .eq("organization_id", userRoles.organization_id); // Ensure user has access

      if (locationUpdateError) {
        console.error("Location update error:", locationUpdateError);
        // Don't fail the request, but log the error
      }
    } else if (entityType === "product") {
      const { error: productUpdateError } = await supabase
        .from("products")
        .update({
          qr_label_id: qrLabel.id,
          has_qr_assigned: true,
          qr_assigned_at: new Date().toISOString(),
          qr_assigned_by: user.id,
        })
        .eq("id", entityId)
        .eq("organization_id", userRoles.organization_id); // Ensure user has access

      if (productUpdateError) {
        console.error("Product update error:", productUpdateError);
        // Don't fail the request, but log the error
      }
    }

    // Log the assignment
    try {
      await supabase.from("qr_scan_logs").insert({
        qr_token: qrLabel.qr_token,
        scan_type: "assignment",
        scanner_type: "manual",
        user_id: user.id,
        scan_result: "success",
        scan_context: {
          entity_type: entityType,
          entity_id: entityId,
          assignment_method: generateNew ? "generated_and_assigned" : "manual_assignment",
          timestamp: new Date().toISOString(),
        },
        organization_id: userRoles.organization_id,
        branch_id: userRoles.branch_id,
      });
    } catch (logError) {
      console.error("Failed to log assignment:", logError);
    }

    // Generate QR URL
    const { generateQRCodeURL } = await import("@/lib/utils/qr-generator");

    return NextResponse.json({
      success: true,
      qrLabel: {
        id: qrLabel.id,
        qr_token: qrLabel.qr_token,
        qr_url: generateQRCodeURL(qrLabel.qr_token),
        label_type: qrLabel.label_type,
        entity_type: qrLabel.entity_type,
        entity_id: qrLabel.entity_id,
        assigned_at: qrLabel.assigned_at,
        assigned_by: qrLabel.assigned_by,
      },
      message: generateNew
        ? `New QR code generated and assigned to ${entityType}`
        : `QR code assigned to ${entityType}`,
    });
  } catch (error) {
    console.error("Assignment API error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

// GET endpoint to check current assignment status
export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();

    // Get current user
    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();
    if (userError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const entityType = searchParams.get("entityType");
    const entityId = searchParams.get("entityId");

    if (!entityType || !entityId) {
      return NextResponse.json({ error: "Missing entity type or ID" }, { status: 400 });
    }

    // Get user's organization context
    const { data: userRoles } = await supabase
      .from("user_roles")
      .select("organization_id, branch_id")
      .eq("user_id", user.id)
      .limit(1)
      .single();

    if (!userRoles) {
      return NextResponse.json({ error: "User context not found" }, { status: 400 });
    }

    // Check current QR assignment
    const { data: qrLabel } = await supabase
      .from("qr_labels")
      .select("id, qr_token, assigned_at, assigned_by, users!assigned_by(first_name, last_name)")
      .eq("entity_type", entityType)
      .eq("entity_id", entityId)
      .eq("organization_id", userRoles.organization_id)
      .eq("is_active", true)
      .single();

    if (qrLabel) {
      const { generateQRCodeURL } = await import("@/lib/utils/qr-generator");

      return NextResponse.json({
        hasAssignment: true,
        qrLabel: {
          id: qrLabel.id,
          qr_token: qrLabel.qr_token,
          qr_url: generateQRCodeURL(qrLabel.qr_token),
          assigned_at: qrLabel.assigned_at,
          assigned_by: qrLabel.assigned_by,
          assigned_by_name: qrLabel.users
            ? `${qrLabel.users.first_name || ""} ${qrLabel.users.last_name || ""}`.trim()
            : "Unknown",
        },
      });
    } else {
      return NextResponse.json({
        hasAssignment: false,
        qrLabel: null,
      });
    }
  } catch (error) {
    console.error("Assignment check API error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
