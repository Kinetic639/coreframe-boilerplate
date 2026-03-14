"use server";

import { encodedRedirect } from "@/utils/utils";
import { createClient } from "@/utils/supabase/server";
import { createServiceClient } from "@/utils/supabase/service";
import { redirect } from "@/i18n/navigation";
import { getLocale, getTranslations } from "next-intl/server";
import { eventService } from "@/server/services/event.service";

export const signUpAction = async (formData: FormData) => {
  const email = formData.get("email")?.toString();
  const firstName = formData.get("firstName")?.toString();
  const lastName = formData.get("lastName")?.toString();
  const invitationToken = formData.get("invitationToken")?.toString();
  const supabase = await createClient();
  const locale = await getLocale();
  const t = await getTranslations({ locale, namespace: "auth" });

  // Use environment variable for site URL - more reliable than origin header
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000";

  if (!email) {
    return encodedRedirect("error", "/sign-up", t("errors.emailPasswordRequired"));
  }

  // Generate a random temporary password — user will set their real password after email confirmation
  const tempPassword = crypto.randomUUID() + crypto.randomUUID();

  // Build callback URL — include invitation token so the auth/confirm handler can forward it
  const callbackUrl = invitationToken
    ? `${siteUrl}/auth/callback?invitation_token=${encodeURIComponent(invitationToken)}`
    : `${siteUrl}/auth/callback`;

  // Register user with metadata for names and optional invitation token.
  // invitation_token in data triggers the hook's invitation-aware branch,
  // which skips personal-org creation and joins the invited org instead.
  const { data, error } = await supabase.auth.signUp({
    email,
    password: tempPassword,
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

  // Supabase silently returns success for already-registered emails to prevent enumeration.
  // Detect this case via empty identities array and show an actionable error.
  if (!data.user.identities || data.user.identities.length === 0) {
    return encodedRedirect("error", "/sign-up", t("errors.emailAlreadyRegistered"));
  }

  // Save first_name/last_name directly to public.users using service role.
  // The auth hook runs in a separate transaction and cannot reliably read auth.users
  // at hook time — so we write names here where we have the data in-hand.
  if (firstName || lastName) {
    const serviceClient = createServiceClient();
    await serviceClient.from("users").upsert(
      {
        id: data.user.id,
        email,
        first_name: firstName || null,
        last_name: lastName || null,
      },
      { onConflict: "id" }
    );
  }

  const successMessage = invitationToken
    ? t("success.signUpSuccessInvited")
    : t("success.signUpSuccess");

  return encodedRedirect("success", "/sign-up", successMessage);
};

export const signInAction = async (formData: FormData) => {
  const email = formData.get("email") as string;
  const password = formData.get("password") as string;
  const returnUrl = formData.get("returnUrl") as string;

  const supabase = await createClient();
  const locale = await getLocale();
  const t = await getTranslations({ locale, namespace: "auth" });

  const { data: signInData, error } = await supabase.auth.signInWithPassword({
    email,
    password,
  });

  if (error) {
    const errorMessage = error.message.includes("Invalid login credentials")
      ? t("errors.invalidCredentials")
      : error.message;

    // Emit failed login — best effort, must not block the redirect
    try {
      await eventService.emit({
        actionKey: "auth.login.failed",
        actorType: "user",
        actorUserId: null,
        organizationId: null,
        entityType: "auth",
        entityId: email,
        metadata: { email, reason: "invalid_credentials" },
        eventTier: "baseline",
      });
    } catch (emitError) {
      console.error("[signInAction] Failed to emit auth.login.failed:", {
        actionKey: "auth.login.failed",
        entityId: email,
        error: emitError,
      });
    }

    // If there's a returnUrl, include it in the redirect back to sign-in with the error
    if (returnUrl) {
      const { redirect: nextRedirect } = await import("next/navigation");
      const signInUrl = `/${locale}/sign-in?returnUrl=${encodeURIComponent(returnUrl)}&error=${encodeURIComponent(errorMessage)}`;
      return nextRedirect(signInUrl);
    }
    return encodedRedirect("error", "/sign-in", errorMessage);
  }

  // Emit successful login — best effort, before redirect logic
  try {
    await eventService.emit({
      actionKey: "auth.login",
      actorType: "user",
      actorUserId: signInData.user?.id ?? null,
      organizationId: null,
      entityType: "user",
      entityId: signInData.user?.id ?? email,
      metadata: { email: signInData.user?.email },
      eventTier: "baseline",
    });
  } catch (emitError) {
    console.error("[signInAction] Failed to emit auth.login:", {
      actionKey: "auth.login",
      actorUserId: signInData.user?.id ?? null,
      entityId: signInData.user?.id ?? email,
      error: emitError,
    });
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

  // Emit password reset requested — always, regardless of whether email exists
  // (we never reveal if an account exists — Supabase handles that too)
  try {
    await eventService.emit({
      actionKey: "auth.password.reset_requested",
      actorType: "user",
      actorUserId: null,
      organizationId: null,
      entityType: "auth",
      entityId: email,
      metadata: { email },
      eventTier: "baseline",
    });
  } catch (emitError) {
    console.error("[forgotPasswordAction] Failed to emit auth.password.reset_requested:", {
      actionKey: "auth.password.reset_requested",
      entityId: email,
      error: emitError,
    });
  }

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

  // Get current user for event metadata (still authenticated at this point)
  const {
    data: { user: resetUser },
  } = await supabase.auth.getUser();

  // Emit password reset completed — best effort, must not block signOut + redirect
  try {
    await eventService.emit({
      actionKey: "auth.password.reset_completed",
      actorType: "user",
      actorUserId: resetUser?.id ?? null,
      organizationId: null,
      entityType: "user",
      entityId: resetUser?.id ?? "unknown",
      metadata: {},
      eventTier: "baseline",
    });
  } catch (emitError) {
    console.error("[resetPasswordAction] Failed to emit auth.password.reset_completed:", {
      actionKey: "auth.password.reset_completed",
      actorUserId: resetUser?.id ?? null,
      entityId: resetUser?.id ?? "unknown",
      error: emitError,
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

  // Get user before signOut — event service uses service-role client so it works post-signOut,
  // but we need the user ID now while the session is still valid.
  //
  // IMPORTANT: getUser() must be called before signOut(). If the access token is already
  // expired (and the middleware refresh did not run), getUser() returns null. In that case
  // we skip emission entirely — a null-actor event is stored with actor_user_id = null and
  // can never be retrieved by the personal feed query (which filters actor_user_id = userId).
  // Skipping prevents permanently invisible noise rows in platform_events.
  const {
    data: { user: signingOutUser },
  } = await supabase.auth.getUser();

  await supabase.auth.signOut();

  // Only emit if we have a valid user ID — null actorUserId produces unfindable events
  if (signingOutUser?.id) {
    // Emit session revoked (voluntary sign-out) — best effort, must not block redirect
    try {
      await eventService.emit({
        actionKey: "auth.session.revoked",
        actorType: "user",
        actorUserId: signingOutUser.id,
        organizationId: null,
        entityType: "user",
        entityId: signingOutUser.id,
        metadata: { reason: "voluntary_signout" },
        eventTier: "enhanced",
      });
    } catch (emitError) {
      console.error("[signOutAction] Failed to emit auth.session.revoked:", {
        actionKey: "auth.session.revoked",
        actorUserId: signingOutUser.id,
        entityId: signingOutUser.id,
        error: emitError,
      });
    }
  }

  const locale = await getLocale();
  return redirect({ href: "/sign-in", locale });
};
