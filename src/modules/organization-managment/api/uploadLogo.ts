"use server";

import { createClient } from "@/lib/supabase/server";

export async function uploadOrganizationLogo(formData: FormData) {
  const supabase = await createClient();

  // Get current session
  const {
    data: { session },
  } = await supabase.auth.getSession();

  if (!session) {
    return { error: new Error("Brak aktywnej sesji użytkownika") };
  }

  const userId = session.user.id;
  const file = formData.get("file") as File;
  const organizationId = formData.get("organizationId") as string;

  if (!file || !organizationId) {
    return { error: new Error("File and organization ID are required") };
  }

  // Get user's organization from preferences and verify access
  const { data: preferences } = await supabase
    .from("user_preferences")
    .select("organization_id")
    .eq("user_id", userId)
    .single();

  if (!preferences?.organization_id || preferences.organization_id !== organizationId) {
    return { error: new Error("Brak dostępu do tej organizacji") };
  }

  // Use Supabase authorize function to check permissions
  const { data: authResult } = await supabase.rpc("authorize", {
    user_id: userId,
    required_permissions: ["organization.profile.update"],
    organization_id: organizationId,
  });

  if (!authResult || !authResult.authorized) {
    return {
      error: new Error("Brak uprawnień do zarządzania logo organizacji"),
    };
  }

  // Validate file
  if (!file.type.startsWith("image/")) {
    return { error: new Error("File must be an image") };
  }

  if (file.size > 5 * 1024 * 1024) {
    return { error: new Error("File size must be less than 5MB") };
  }

  try {
    // Create file path
    const ext = file.name.split(".").pop();
    const timestamp = Date.now();
    const filePath = `${organizationId}/logo_${timestamp}.${ext}`;

    // Upload file to storage
    const { error: uploadError } = await supabase.storage
      .from("organization-logos")
      .upload(filePath, file, { upsert: true });

    if (uploadError) {
      return { error: new Error(`Upload failed: ${uploadError.message}`) };
    }

    // Get public URL
    const {
      data: { publicUrl },
    } = supabase.storage.from("organization-logos").getPublicUrl(filePath);

    return {
      success: true,
      url: publicUrl,
      message: "Logo uploaded successfully",
    };
  } catch (error) {
    return {
      error: new Error(
        `Unexpected error: ${error instanceof Error ? error.message : "Unknown error"}`
      ),
    };
  }
}
