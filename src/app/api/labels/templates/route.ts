import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";

export async function GET(request: NextRequest) {
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

    // Get user's organization context from user_preferences
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

    if (!organizationId) {
      return NextResponse.json(
        { success: false, error: "User context not found" },
        { status: 403 }
      );
    }

    // Get query parameters
    const { searchParams } = new URL(request.url);
    const labelType = searchParams.get("labelType");

    // Build query
    let query = supabase
      .from("label_templates")
      .select("*")
      .or(`is_system.eq.true,organization_id.eq.${organizationId}`)
      .is("deleted_at", null)
      .order("is_system", { ascending: false }) // System templates first
      .order("is_default", { ascending: false }) // Default templates first
      .order("name");

    // Filter by label type if specified
    if (labelType && labelType !== "all") {
      query = query.eq("label_type", labelType);
    }

    const { data: templates, error: templatesError } = await query;

    if (templatesError) {
      console.error("Error fetching templates:", templatesError);
      return NextResponse.json(
        { success: false, error: "Failed to fetch templates" },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      templates,
      count: templates.length,
    });
  } catch (error) {
    console.error("Error in templates API:", error);
    return NextResponse.json({ success: false, error: "Internal server error" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
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

    // Get user's organization context from user_preferences
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

    if (!organizationId) {
      return NextResponse.json(
        { success: false, error: "User context not found" },
        { status: 403 }
      );
    }

    // Parse request body
    const body = await request.json();
    const {
      name,
      description,
      label_type,
      category = "custom",
      width_mm,
      height_mm,
      dpi = 300,
      template_config = {},
      qr_position = "center",
      qr_size_mm = 15,
      show_label_text = true,
      label_text_position = "bottom",
      label_text_size = 12,
      show_code = false,
      layout_direction = "column",
      section_balance = "equal",
      background_color = "#FFFFFF",
      text_color = "#000000",
      border_enabled = true,
      border_width = 0.5,
      border_color = "#000000",
      is_default = false,
    } = body;

    // Validate required fields
    if (!name || !label_type || !width_mm || !height_mm) {
      return NextResponse.json(
        { success: false, error: "Missing required fields: name, label_type, width_mm, height_mm" },
        { status: 400 }
      );
    }

    // Additional validation
    if (width_mm < 10 || width_mm > 200 || height_mm < 10 || height_mm > 200) {
      return NextResponse.json(
        { success: false, error: "Label dimensions must be between 10mm and 200mm" },
        { status: 400 }
      );
    }

    if (qr_size_mm < 5 || qr_size_mm > Math.min(width_mm, height_mm)) {
      return NextResponse.json(
        { success: false, error: "QR size must be between 5mm and the smaller label dimension" },
        { status: 400 }
      );
    }

    if (!["location", "product", "generic"].includes(label_type)) {
      return NextResponse.json(
        {
          success: false,
          error: "Invalid label_type. Must be 'location', 'product', or 'generic'",
        },
        { status: 400 }
      );
    }

    // Create custom template
    const { data: template, error: templateError } = await supabase
      .from("label_templates")
      .insert({
        name,
        description,
        label_type,
        category,
        width_mm,
        height_mm,
        dpi,
        template_config,
        qr_position,
        qr_size_mm,
        show_label_text,
        label_text_position,
        label_text_size,
        show_code,
        layout_direction,
        section_balance,
        background_color,
        text_color,
        border_enabled,
        border_width,
        border_color,
        is_default,
        is_system: false,
        organization_id: organizationId,
        created_by: user.id,
      })
      .select()
      .single();

    if (templateError) {
      console.error("Error creating template:", templateError);
      return NextResponse.json(
        { success: false, error: "Failed to create template" },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      template,
      message: "Template created successfully",
    });
  } catch (error) {
    console.error("Error in create template API:", error);
    return NextResponse.json({ success: false, error: "Internal server error" }, { status: 500 });
  }
}
