"use server";

import { encodedRedirect } from "@/utils/utils";
import { createClient } from "@/utils/supabase/server";
import { redirect } from "@/i18n/navigation";
import { getLocale, getTranslations } from "next-intl/server";

export const signUpAction = async (formData: FormData) => {
  const email = formData.get("email")?.toString();
  const password = formData.get("password")?.toString();
  const firstName = formData.get("firstName")?.toString();
  const lastName = formData.get("lastName")?.toString();
  const invitationToken = formData.get("invitationToken")?.toString();
  const supabase = await createClient();
  const locale = await getLocale();
  const t = await getTranslations({ locale, namespace: "auth" });

  // Use environment variable for site URL - more reliable than origin header
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000";

  if (!email || !password) {
    return encodedRedirect("error", "/sign-up", t("errors.emailPasswordRequired"));
  }

  // Build callback URL — include invitation token so callback can auto-accept
  const callbackUrl = invitationToken
    ? `${siteUrl}/auth/callback?invitation_token=${encodeURIComponent(invitationToken)}`
    : `${siteUrl}/auth/callback`;

  // Register user with metadata for names and optional invitation token.
  // invitation_token in data triggers the hook's invitation-aware branch,
  // which skips personal-org creation and joins the invited org instead.
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      emailRedirectTo: callbackUrl,
      data: {
        first_name: firstName || "",
        last_name: lastName || "",
        ...(invitationToken ? { invitation_token: invitationToken } : {}),
      },
    },
  });

  if (error || !data.user) {
    console.error(error?.code + " " + error?.message);
    return encodedRedirect("error", "/sign-up", error?.message || t("errors.registrationFailed"));
  }

  // The database trigger will automatically:
  // 1. Insert the user into public.users table
  // 2. Create a new organization based on email domain
  // 3. Create organization profile
  // 4. Assign org_owner role to the user

  return encodedRedirect("success", "/sign-up", t("success.signUpSuccess"));
};

export const signInAction = async (formData: FormData) => {
  const email = formData.get("email") as string;
  const password = formData.get("password") as string;
  const returnUrl = formData.get("returnUrl") as string;

  const supabase = await createClient();
  const locale = await getLocale();
  const t = await getTranslations({ locale, namespace: "auth" });

  const { error } = await supabase.auth.signInWithPassword({
    email,
    password,
  });

  if (error) {
    const errorMessage = error.message.includes("Invalid login credentials")
      ? t("errors.invalidCredentials")
      : error.message;

    // If there's a returnUrl, include it in the redirect back to sign-in with the error
    if (returnUrl) {
      const { redirect: nextRedirect } = await import("next/navigation");
      const signInUrl = `/${locale}/sign-in?returnUrl=${encodeURIComponent(returnUrl)}&error=${encodeURIComponent(errorMessage)}`;
      return nextRedirect(signInUrl);
    }
    return encodedRedirect("error", "/sign-in", errorMessage);
  }

  // If there's a returnUrl (e.g. /invite/[token]), honor it directly
  if (returnUrl && returnUrl.trim() !== "") {
    const { redirect: nextRedirect } = await import("next/navigation");
    return nextRedirect(returnUrl);
  }

  // Check for pending invites — route to resolution if found
  const { data: pendingData } = await supabase.rpc("get_my_pending_invitations");
  const pendingResult = pendingData as { success: boolean; invitations?: unknown[] } | null;
  if (pendingResult?.success && (pendingResult.invitations?.length ?? 0) > 0) {
    return redirect({ href: "/invite/resolve", locale });
  }

  // Check if user has any active org membership — if not, route to onboarding
  const { data: membership } = await supabase
    .from("organization_members")
    .select("organization_id")
    .eq("status", "active")
    .is("deleted_at", null)
    .limit(1)
    .maybeSingle();

  if (!membership) {
    return redirect({ href: "/onboarding", locale });
  }

  return redirect({ href: "/dashboard/start", locale });
};

export const forgotPasswordAction = async (formData: FormData) => {
  const email = formData.get("email")?.toString();
  const supabase = await createClient();
  const locale = await getLocale();
  const t = await getTranslations({ locale, namespace: "auth" });

  // Use environment variable for site URL - more reliable than origin header
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000";

  if (!email) {
    return encodedRedirect("error", "/forgot-password", t("errors.emailRequired"));
  }

  // Validate email format
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(email)) {
    return encodedRedirect("error", "/forgot-password", t("errors.invalidEmailFormat"));
  }

  const nextPath = `/${locale}/reset-password`;
  const redirectUrl = `${siteUrl}/auth/confirm?next=${encodeURIComponent(nextPath)}`;

  await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: redirectUrl,
  });

  // Always show success message for security (don't reveal if email exists)
  return encodedRedirect("success", "/forgot-password", t("success.passwordResetSent"));
};

export const resetPasswordAction = async (formData: FormData) => {
  const supabase = await createClient();
  const locale = await getLocale();

  const password = formData.get("password") as string;
  const confirmPassword = formData.get("confirmPassword") as string;

  // Comprehensive server-side validation
  if (!password || !confirmPassword) {
    redirect({
      href: {
        pathname: "/reset-password",
        query: { toast: "password-error" },
      },
      locale,
    });
  }

  if (password !== confirmPassword) {
    redirect({
      href: {
        pathname: "/reset-password",
        query: { toast: "password-error" },
      },
      locale,
    });
  }

  if (password.length < 8) {
    redirect({
      href: {
        pathname: "/reset-password",
        query: { toast: "password-error" },
      },
      locale,
    });
  }

  if (!/[A-Z]/.test(password)) {
    redirect({
      href: {
        pathname: "/reset-password",
        query: { toast: "password-error" },
      },
      locale,
    });
  }

  if (!/[a-z]/.test(password)) {
    redirect({
      href: {
        pathname: "/reset-password",
        query: { toast: "password-error" },
      },
      locale,
    });
  }

  if (!/\d/.test(password)) {
    redirect({
      href: {
        pathname: "/reset-password",
        query: { toast: "password-error" },
      },
      locale,
    });
  }

  const { error } = await supabase.auth.updateUser({ password });

  if (error) {
    console.error("Password update error:", {
      message: error.message,
      status: error.status,
      code: error.code,
      name: error.name,
      fullError: error,
    });

    // Map specific Supabase errors to user-friendly toast keys
    let toastKey = "password-error";
    const errorMsg = error.message?.toLowerCase() || "";

    // Check for specific error messages from Supabase
    // More flexible matching to catch variations
    if (errorMsg.includes("same") && (errorMsg.includes("old") || errorMsg.includes("previous"))) {
      toastKey = "password-same-as-old";
    } else if (errorMsg.includes("weak") || errorMsg.includes("strength")) {
      toastKey = "password-too-weak";
    } else if (
      errorMsg.includes("session") ||
      errorMsg.includes("expired") ||
      errorMsg.includes("token")
    ) {
      toastKey = "password-session-expired";
    }

    redirect({
      href: {
        pathname: "/reset-password",
        query: { toast: toastKey },
      },
      locale,
    });
  }

  // Sign out after password reset for security
  await supabase.auth.signOut();

  redirect({
    href: {
      pathname: "/sign-in",
      query: { toast: "password-updated" },
    },
    locale,
  });
};

export const signOutAction = async () => {
  const supabase = await createClient();
  await supabase.auth.signOut();

  const locale = await getLocale();
  return redirect({ href: "/sign-in", locale });
};
