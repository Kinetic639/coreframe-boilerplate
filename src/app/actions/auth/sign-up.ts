"use server";

import { encodedRedirect } from "@/utils/utils";
import { createClient } from "@/utils/supabase/server";
import { headers } from "next/headers";

export const signUpAction = async (formData: FormData) => {
  const email = formData.get("email")?.toString();
  const password = formData.get("password")?.toString();
  const firstName = formData.get("firstName")?.toString();
  const lastName = formData.get("lastName")?.toString();
  const supabase = await createClient();
  const origin = (await headers()).get("origin");

  if (!email || !password) {
    return encodedRedirect("error", "/sign-up", "Email and password are required");
  }

  // Register user with metadata for names
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      emailRedirectTo: `${origin}/auth/callback`,
      data: {
        first_name: firstName || "",
        last_name: lastName || "",
      },
    },
  });

  if (error || !data.user) {
    console.error(error?.code + " " + error?.message);
    return encodedRedirect("error", "/sign-up", error?.message || "Registration failed");
  }

  // The database trigger will automatically:
  // 1. Insert the user into public.users table
  // 2. Create a new organization based on email domain
  // 3. Create organization profile
  // 4. Assign org_owner role to the user

  return encodedRedirect(
    "success",
    "/sign-up",
    "Thanks for signing up! Please check your email for a verification link. Your organization has been created automatically."
  );
};
