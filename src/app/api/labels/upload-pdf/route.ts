import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

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

    // Get form data
    const formData = await request.formData();
    const file = formData.get("file") as File;
    const batchId = formData.get("batchId") as string;
    const labelType = formData.get("labelType") as string;

    if (!file) {
      return NextResponse.json({ success: false, error: "No file provided" }, { status: 400 });
    }

    if (file.type !== "application/pdf") {
      return NextResponse.json(
        { success: false, error: "Only PDF files are allowed" },
        { status: 400 }
      );
    }

    // Create filename with organization and timestamp
    const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
    const filename = `${organizationId}/${labelType}/${batchId || `single-${timestamp}`}.pdf`;

    // Convert file to buffer
    const arrayBuffer = await file.arrayBuffer();
    const buffer = new Uint8Array(arrayBuffer);

    // Upload to Supabase storage
    const { data, error: uploadError } = await supabase.storage
      .from("label-pdfs")
      .upload(filename, buffer, {
        contentType: "application/pdf",
        upsert: true,
      });

    if (uploadError) {
      console.error("Error uploading PDF:", uploadError);
      return NextResponse.json({ success: false, error: "Failed to upload PDF" }, { status: 500 });
    }

    // Update batch record with PDF path if batchId is provided
    if (batchId) {
      const { error: updateError } = await supabase
        .from("label_batches")
        .update({
          pdf_generated: true,
          pdf_path: data.path,
        })
        .eq("id", batchId);

      if (updateError) {
        console.error("Error updating batch:", updateError);
        // Don't fail the request if batch update fails
      }
    }

    // Get public URL for the uploaded file
    const { data: publicUrl } = supabase.storage.from("label-pdfs").getPublicUrl(data.path);

    return NextResponse.json({
      success: true,
      path: data.path,
      publicUrl: publicUrl.publicUrl,
      message: "PDF uploaded successfully",
    });
  } catch (error) {
    console.error("Error in PDF upload API:", error);
    return NextResponse.json({ success: false, error: "Internal server error" }, { status: 500 });
  }
}
