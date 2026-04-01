"use server";

import { createClient } from "@/utils/supabase/server";

export async function testLogoAccess(organizationId: string) {
  try {
    const supabase = await createClient();

    // Test if we can access the storage bucket
    const { data: files, error: listError } = await supabase.storage
      .from("organization-logos")
      .list("");

    // console.log("🔍 Storage list result:", { files, listError });

    // Test generating a public URL for the organization
    const filePath = `${organizationId}.png`; // Assuming PNG format
    const {
      data: { publicUrl },
    } = supabase.storage.from("organization-logos").getPublicUrl(filePath);

    // Try to fetch the URL to see if it exists
    try {
      const response = await fetch(publicUrl);
      const exists = response.ok;

      return {
        organizationId,
        filePath,
        publicUrl,
        exists,
        statusCode: response.status,
        files: files?.map((f) => f.name) || [],
        listError: listError?.message || null,
      };
    } catch (fetchError) {
      return {
        organizationId,
        filePath,
        publicUrl,
        exists: false,
        error: "Failed to fetch URL",
        fetchError: fetchError instanceof Error ? fetchError.message : "Unknown fetch error",
        files: files?.map((f) => f.name) || [],
        listError: listError?.message || null,
      };
    }
  } catch (error) {
    return {
      error: error instanceof Error ? error.message : "Unknown error",
      organizationId,
    };
  }
}
