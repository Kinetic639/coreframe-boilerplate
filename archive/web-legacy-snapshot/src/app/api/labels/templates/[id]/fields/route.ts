import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";

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
    const { fields } = body;

    if (!fields || !Array.isArray(fields)) {
      return NextResponse.json(
        { success: false, error: "Fields array is required" },
        { status: 400 }
      );
    }

    // Validate template access
    const { data: template, error: templateError } = await supabase
      .from("label_templates")
      .select("id, organization_id, created_by, is_system")
      .eq("id", templateId)
      .is("deleted_at", null)
      .single();

    if (templateError || !template) {
      return NextResponse.json({ success: false, error: "Template not found" }, { status: 404 });
    }

    if (template.is_system) {
      return NextResponse.json(
        { success: false, error: "Cannot edit system template fields" },
        { status: 403 }
      );
    }

    // Get user's organization context
    const { data: preferences } = await supabase
      .from("user_preferences")
      .select("organization_id")
      .eq("user_id", user.id)
      .single();

    const userOrgId = preferences?.organization_id;
    if (template.organization_id !== userOrgId && template.created_by !== user.id) {
      return NextResponse.json({ success: false, error: "Permission denied" }, { status: 403 });
    }

    // Update each field in the fields array
    const updates: Promise<any>[] = [];

    for (const field of fields) {
      if (!field.id) continue;

      const updateData: any = {
        field_name: field.field_name,
        field_value: field.field_value,
        position_x: field.position_x || 0,
        position_y: field.position_y || 0,
        width_mm: field.width_mm || 20,
        height_mm: field.height_mm || 10,
        font_size: field.font_size || 12,
        font_weight: field.font_weight || "normal",
        text_align: field.text_align || "left",
        vertical_align: field.vertical_align || "top",
        show_label: field.show_label || false,
        label_text: field.label_text,
        label_position: field.label_position || "inside-top-left",
        label_color: field.label_color || "#666666",
        label_font_size: field.label_font_size || 10,
        is_required: field.is_required || false,
        sort_order: field.sort_order || 0,
        text_color: field.text_color || "#000000",
        background_color: field.background_color || "transparent",
        border_enabled: field.border_enabled || false,
        border_width: field.border_width || 0.5,
        border_color: field.border_color || "#000000",
        padding_top: field.padding_top || 2,
        padding_right: field.padding_right || 2,
        padding_bottom: field.padding_bottom || 2,
        padding_left: field.padding_left || 2,
        updated_at: new Date().toISOString(),
      };

      // Only set non-null values
      Object.keys(updateData).forEach((key) => {
        if (updateData[key] === undefined) {
          delete updateData[key];
        }
      });

      const updatePromise = supabase
        .from("label_template_fields")
        .update(updateData)
        .eq("id", field.id)
        .eq("label_template_id", templateId)
        .select();

      updates.push(updatePromise as any);
    }

    const results = await Promise.all(updates);

    // Check for errors
    const errors = results.filter((result) => result.error);
    if (errors.length > 0) {
      console.error("Errors updating fields:", errors);
      return NextResponse.json(
        { success: false, error: "Failed to update some fields" },
        { status: 500 }
      );
    }

    // Also update the template's updated_at timestamp
    await supabase
      .from("label_templates")
      .update({ updated_at: new Date().toISOString() })
      .eq("id", templateId);

    return NextResponse.json({
      success: true,
      message: "Template fields updated successfully",
    });
  } catch (error) {
    console.error("Error in update template fields API:", error);
    return NextResponse.json({ success: false, error: "Internal server error" }, { status: 500 });
  }
}
