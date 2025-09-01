import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const supabase = await createClient();

    // Get the user
    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();

    if (userError || !user) {
      return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
    }

    const { id: templateId } = await params;

    // Get user's organization context
    const { data: preferences } = await supabase
      .from("user_preferences")
      .select("organization_id")
      .eq("user_id", user.id)
      .single();

    let organizationId = preferences?.organization_id;

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

    // Fetch template with fields and permissions check
    let query = supabase
      .from("label_templates")
      .select(
        `
        *,
        fields:label_template_fields(*)
      `
      )
      .eq("id", templateId)
      .is("deleted_at", null);

    // Include system templates and user's organization templates
    query = query.or(`is_system.eq.true,organization_id.eq.${organizationId}`);

    const { data: template, error: fetchError } = await query.single();

    if (fetchError || !template) {
      return NextResponse.json({ success: false, error: "Template not found" }, { status: 404 });
    }

    return NextResponse.json({
      success: true,
      template,
    });
  } catch (error) {
    console.error("Error in get template API:", error);
    return NextResponse.json({ success: false, error: "Internal server error" }, { status: 500 });
  }
}

export async function PUT(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const supabase = await createClient();

    // Get the user
    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();

    if (userError || !user) {
      return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
    }

    const { id: templateId } = await params;
    const body = await request.json();

    // Validate required fields
    const requiredFields = ["name", "width_mm", "height_mm", "dpi"];
    const missingFields = requiredFields.filter((field) => !body[field]);

    if (missingFields.length > 0) {
      return NextResponse.json(
        {
          success: false,
          error: `Missing required fields: ${missingFields.join(", ")}`,
        },
        { status: 400 }
      );
    }

    // Check if template exists and is not a system template
    const { data: existingTemplate, error: checkError } = await supabase
      .from("label_templates")
      .select("id, name, is_system, organization_id, created_by")
      .eq("id", templateId)
      .is("deleted_at", null)
      .single();

    if (checkError || !existingTemplate) {
      return NextResponse.json({ success: false, error: "Template not found" }, { status: 404 });
    }

    // Don't allow editing system templates
    if (existingTemplate.is_system) {
      return NextResponse.json(
        { success: false, error: "Cannot edit system templates" },
        { status: 403 }
      );
    }

    // Get user's organization context
    const { data: preferences } = await supabase
      .from("user_preferences")
      .select("organization_id")
      .eq("user_id", user.id)
      .single();

    let organizationId = preferences?.organization_id;

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

    // Check permissions: user must be in same organization or be the creator
    if (
      existingTemplate.organization_id !== organizationId &&
      existingTemplate.created_by !== user.id
    ) {
      return NextResponse.json({ success: false, error: "Permission denied" }, { status: 403 });
    }

    // Build template_config with additional properties
    const template_config = {
      ...body.template_config,
      field_vertical_gap: body.field_vertical_gap ?? 2,
      label_padding_top: body.label_padding_top ?? 2,
      label_padding_right: body.label_padding_right ?? 2,
      label_padding_bottom: body.label_padding_bottom ?? 2,
      label_padding_left: body.label_padding_left ?? 2,
      items_alignment: body.items_alignment ?? "center",
    };

    // Prepare update data
    const updateData = {
      name: body.name,
      description: body.description || null,
      label_type: body.label_type || "generic",
      category: body.category || "custom",
      width_mm: Number(body.width_mm),
      height_mm: Number(body.height_mm),
      dpi: Number(body.dpi),
      template_config,
      qr_position: body.qr_position || "center",
      qr_size_mm: Number(body.qr_size_mm) || 15,
      show_label_text: Boolean(body.show_label_text),
      label_text_position: body.label_text_position || "bottom",
      label_text_size: Number(body.label_text_size) || 12,
      show_code: Boolean(body.show_code),
      layout_direction: body.layout_direction || "row",
      section_balance: body.section_balance || "equal",
      orientation: body.orientation || "portrait",
      show_additional_info: body.show_additional_info ?? true,
      additional_info_position: body.additional_info_position || "bottom",
      background_color: body.background_color || "#FFFFFF",
      text_color: body.text_color || "#000000",
      border_enabled: Boolean(body.border_enabled),
      border_width: Number(body.border_width) || 0.5,
      border_color: body.border_color || "#000000",
      is_default: Boolean(body.is_default),
      updated_at: new Date().toISOString(),
    };

    // Update the template
    const { data: updatedTemplate, error: updateError } = await supabase
      .from("label_templates")
      .update(updateData)
      .eq("id", templateId)
      .select()
      .single();

    if (updateError) {
      console.error("Error updating template:", updateError);
      return NextResponse.json(
        { success: false, error: "Failed to update template" },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      template: updatedTemplate,
      message: "Template updated successfully",
    });
  } catch (error) {
    console.error("Error in update template API:", error);
    return NextResponse.json({ success: false, error: "Internal server error" }, { status: 500 });
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const supabase = await createClient();

    // Get the user
    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();

    if (userError || !user) {
      return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
    }

    const { id: templateId } = await params;

    // Check if template exists and is not a system template
    const { data: template, error: checkError } = await supabase
      .from("label_templates")
      .select("id, name, is_system, organization_id, created_by")
      .eq("id", templateId)
      .is("deleted_at", null)
      .single();

    if (checkError || !template) {
      return NextResponse.json({ success: false, error: "Template not found" }, { status: 404 });
    }

    // Don't allow deleting system templates
    if (template.is_system) {
      return NextResponse.json(
        { success: false, error: "Cannot delete system templates" },
        { status: 403 }
      );
    }

    // Get user's organization context
    const { data: preferences } = await supabase
      .from("user_preferences")
      .select("organization_id")
      .eq("user_id", user.id)
      .single();

    let organizationId = preferences?.organization_id;

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

    // Check permissions: user must be in same organization or be the creator
    if (template.organization_id !== organizationId && template.created_by !== user.id) {
      return NextResponse.json({ success: false, error: "Permission denied" }, { status: 403 });
    }

    // Soft delete the template
    const { error: deleteError } = await supabase
      .from("label_templates")
      .update({
        deleted_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq("id", templateId);

    if (deleteError) {
      console.error("Error deleting template:", deleteError);
      return NextResponse.json(
        { success: false, error: "Failed to delete template" },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      message: "Template deleted successfully",
    });
  } catch (error) {
    console.error("Error in delete template API:", error);
    return NextResponse.json({ success: false, error: "Internal server error" }, { status: 500 });
  }
}
