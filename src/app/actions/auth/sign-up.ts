"use server";

import { encodedRedirect } from "@/utils/utils";
import { createClient } from "@/utils/supabase/server";
import { headers } from "next/headers";

function slugify(name: string) {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)+/g, "");
}

export const signUpAction = async (formData: FormData) => {
  const email = formData.get("email")?.toString();
  const password = formData.get("password")?.toString();
  const organizationName = formData.get("organizationName")?.toString();
  const supabase = await createClient();
  const origin = (await headers()).get("origin");

  if (!email || !password || !organizationName) {
    return encodedRedirect(
      "error",
      "/sign-up",
      "Email, password, and organization name are required"
    );
  }

  // 1. Register user
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      emailRedirectTo: `${origin}/auth/callback`,
    },
  });

  if (error || !data.user) {
    console.error(error?.code + " " + error?.message);
    return encodedRedirect("error", "/sign-up", error?.message || "Registration failed");
  }

  const userId = data.user.id;

  // 2. Generate slug and check uniqueness
  const baseSlug = slugify(organizationName);
  let slug = baseSlug;
  let i = 1;
  while (true) {
    const { data: existingOrg } = await supabase
      .from("organizations")
      .select("id")
      .eq("slug", slug)
      .single();
    if (!existingOrg) break;
    slug = `${baseSlug}-${i++}`;
    if (i > 10) {
      return encodedRedirect(
        "error",
        "/sign-up",
        "Could not generate unique organization slug. Try a different name."
      );
    }
  }

  // 3. Create organization
  const { error: orgError } = await supabase
    .from("organizations")
    .insert([{ name: organizationName, slug, created_by: userId }]);

  if (orgError) {
    console.error(orgError.message);
    return encodedRedirect("error", "/sign-up", "Failed to create organization");
  }

  return encodedRedirect(
    "success",
    "/sign-up",
    "Thanks for signing up! Please check your email for a verification link."
  );
};
