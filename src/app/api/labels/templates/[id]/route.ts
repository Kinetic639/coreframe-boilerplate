import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";

export async function DELETE(request: NextRequest, { params }: { params: { id: string } }) {
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

    const templateId = params.id;

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
