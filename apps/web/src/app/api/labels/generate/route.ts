import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";
import { generateQRToken, generateQRCodeURL } from "@/lib/utils/qr-generator";

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
      templateId,
      labelType,
      quantity = 1,
      batchName,
      batchDescription,
      entityIds = [],
    } = body;

    // Validate input
    if (!templateId || !labelType) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }

    // Get user's organization and branch context from user_preferences
    const { data: preferences } = await supabase
      .from("user_preferences")
      .select("organization_id, default_branch_id")
      .eq("user_id", user.id)
      .single();

    let organizationId = preferences?.organization_id;
    const activeBranchId = preferences?.default_branch_id;

    // Fallback: If no preferences, try to find user's owned organization
    if (!organizationId) {
      const { data: ownedOrg } = await supabase
        .from("organizations")
        .select("id")
        .eq("created_by", user.id)
        .limit(1)
        .single();

      if (ownedOrg) {
        organizationId = ownedOrg.id;
      }
    }

    if (!organizationId) {
      return NextResponse.json({ error: "User context not found" }, { status: 403 });
    }

    // Get user's active branch or first available branch
    const { data: branches } = await supabase
      .from("branches")
      .select("id")
      .eq("organization_id", organizationId)
      .is("deleted_at", null);

    if (!branches || branches.length === 0) {
      return NextResponse.json({ error: "No branches found for organization" }, { status: 403 });
    }

    // Use preferred branch or first available
    const branchId =
      activeBranchId && branches.find((b) => b.id === activeBranchId)
        ? activeBranchId
        : branches[0].id;

    // Verify template exists and user has access
    const { data: template, error: templateError } = await supabase
      .from("label_templates")
      .select("*")
      .eq("id", templateId)
      .or(`is_system.eq.true,organization_id.eq.${organizationId}`)
      .single();

    if (templateError || !template) {
      return NextResponse.json({ error: "Template not found or access denied" }, { status: 404 });
    }

    // Create batch record if generating multiple labels
    let batchId = null;
    if (quantity > 1) {
      const { data: batch, error: batchError } = await supabase
        .from("label_batches")
        .insert({
          batch_name: batchName || `Batch_${Date.now()}`,
          batch_description: batchDescription,
          label_template_id: templateId,
          quantity,
          label_type: labelType,
          batch_status: "pending",
          labels_per_sheet: 1, // Default, would be calculated based on layout
          sheet_layout: "single", // Default
          created_by: user.id,
          organization_id: organizationId,
          branch_id: branchId,
        })
        .select("id")
        .single();

      if (batchError) {
        console.error("Batch creation error:", batchError);
        return NextResponse.json({ error: "Failed to create batch" }, { status: 500 });
      }

      batchId = batch.id;
    }

    // Generate QR labels
    const labelsToInsert = [];
    for (let i = 0; i < quantity; i++) {
      const qrToken = generateQRToken();

      // If entity IDs are provided, assign them cyclically
      const entityId = entityIds.length > 0 ? entityIds[i % entityIds.length] : null;

      labelsToInsert.push({
        qr_token: qrToken,
        label_type: labelType,
        label_template_id: templateId,
        entity_type: entityId ? labelType : null,
        entity_id: entityId,
        assigned_at: entityId ? new Date().toISOString() : null,
        assigned_by: entityId ? user.id : null,
        created_by: user.id,
        organization_id: organizationId,
        branch_id: branchId,
        is_active: true,
        metadata: {
          batch_id: batchId,
          generation_timestamp: new Date().toISOString(),
          template_snapshot: {
            name: template.name,
            dimensions: `${template.width_mm}x${template.height_mm}mm`,
            qr_position: template.qr_position,
          },
        },
      });
    }

    // Insert all labels
    const { data: createdLabels, error: labelsError } = await supabase
      .from("qr_labels")
      .insert(labelsToInsert)
      .select("id, qr_token, entity_type, entity_id");

    if (labelsError) {
      console.error("Labels creation error:", labelsError);
      return NextResponse.json({ error: "Failed to create labels" }, { status: 500 });
    }

    // Update batch status if applicable
    if (batchId) {
      await supabase
        .from("label_batches")
        .update({
          batch_status: "generated",
          generated_at: new Date().toISOString(),
        })
        .eq("id", batchId);
    }

    // Generate QR URLs for the created labels
    const labelsWithUrls = createdLabels.map((label) => ({
      ...label,
      qr_url: generateQRCodeURL(label.qr_token),
    }));

    return NextResponse.json({
      success: true,
      labels: labelsWithUrls,
      batchId,
      message: `Successfully generated ${createdLabels.length} QR label${createdLabels.length > 1 ? "s" : ""}`,
    });
  } catch (error) {
    console.error("API Error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
