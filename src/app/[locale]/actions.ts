"use server";

import { encodedRedirect } from "@/utils/utils";
import { createClient } from "@/utils/supabase/server";
import { headers } from "next/headers";
import { redirect } from "@/i18n/navigation";
import { getLocale } from "next-intl/server";

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

export const signInAction = async (formData: FormData) => {
  const email = formData.get("email") as string;
  const password = formData.get("password") as string;
  const returnUrl = formData.get("returnUrl") as string;

  const supabase = await createClient();

  const { error } = await supabase.auth.signInWithPassword({
    email,
    password,
  });

  if (error) {
    // If there's a returnUrl, include it in the redirect back to sign-in with the error
    if (returnUrl) {
      const { redirect: nextRedirect } = await import("next/navigation");
      const locale = await getLocale();
      const signInUrl = `/${locale}/sign-in?returnUrl=${encodeURIComponent(returnUrl)}&error=${encodeURIComponent(error.message)}`;
      return nextRedirect(signInUrl);
    }
    return encodedRedirect("error", "/sign-in", error.message);
  }

  const locale = await getLocale();

  // If there's a returnUrl, redirect there, otherwise go to dashboard
  if (returnUrl && returnUrl.trim() !== "") {
    console.log("[DEBUG] Processing returnUrl:", returnUrl);
    console.log("[DEBUG] Locale:", locale);

    // Use direct Next.js redirect to the exact returnUrl
    const { redirect: nextRedirect } = await import("next/navigation");
    console.log("[DEBUG] Using Next.js redirect to:", returnUrl);
    return nextRedirect(returnUrl);
  }

  return redirect({ href: "/dashboard-old/start", locale });
};

export const forgotPasswordAction = async (formData: FormData) => {
  const email = formData.get("email")?.toString();
  const supabase = await createClient();
  const origin = (await headers()).get("origin");
  const locale = await getLocale();

  if (!email) {
    return encodedRedirect("error", "/forgot-password", "Email is required");
  }

  // Validate email format
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(email)) {
    return encodedRedirect("error", "/forgot-password", "Invalid email format");
  }

  const redirectUrl = `${origin}/auth/confirm?next=/${locale}/reset-password`;

  console.log("[Password Reset] Email:", email);
  console.log("[Password Reset] Redirect URL:", redirectUrl);
  console.log("[Password Reset] Origin:", origin);
  console.log("[Password Reset] Locale:", locale);

  const { error } = await supabase.auth.resetPasswordForEmail(email, {
    // PKCE flow with token_hash verification
    redirectTo: redirectUrl,
  });

  if (error) {
    console.error("[Password Reset] Supabase error:", {
      message: error.message,
      status: error.status,
      name: error.name,
    });
  } else {
    console.log("[Password Reset] Request successful - email should be sent by Supabase SMTP");
  }

  // Always show success message for security (don't reveal if email exists)
  return encodedRedirect(
    "success",
    "/forgot-password",
    "If an account exists with this email, you will receive a password reset link."
  );
};

export const resetPasswordAction = async (formData: FormData) => {
  const supabase = await createClient();
  const locale = await getLocale();

  const password = formData.get("password") as string;
  const confirmPassword = formData.get("confirmPassword") as string;

  // Comprehensive server-side validation
  if (!password || !confirmPassword) {
    return encodedRedirect("error", "/reset-password", "Password and confirmation are required");
  }

  if (password !== confirmPassword) {
    return encodedRedirect("error", "/reset-password", "Passwords do not match");
  }

  if (password.length < 8) {
    return encodedRedirect("error", "/reset-password", "Password must be at least 8 characters");
  }

  if (!/[A-Z]/.test(password)) {
    return encodedRedirect("error", "/reset-password", "Password must contain an uppercase letter");
  }

  if (!/[a-z]/.test(password)) {
    return encodedRedirect("error", "/reset-password", "Password must contain a lowercase letter");
  }

  if (!/\d/.test(password)) {
    return encodedRedirect("error", "/reset-password", "Password must contain a number");
  }

  const { error } = await supabase.auth.updateUser({ password });

  if (error) {
    console.error("Password update error:", error.message);
    return encodedRedirect(
      "error",
      "/reset-password",
      "Failed to update password. Please try again."
    );
  }

  // Sign out after password reset for security
  await supabase.auth.signOut();

  return redirect({ href: "/sign-in", locale });
};

export const signOutAction = async () => {
  const supabase = await createClient();
  await supabase.auth.signOut();

  const locale = await getLocale();
  return redirect({ href: "/sign-in", locale });
};
