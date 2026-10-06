"use server";

import { getLocale, getTranslations } from "next-intl/server";
import { z } from "zod";
import { redirect } from "@/i18n/navigation";
import { createClient } from "@/utils/supabase/server";

const emailSchema = z.string().trim().email();

/** Same-origin relative path only -- blocks open redirects such as "//evil.com". */
function safeReturnUrl(value: FormDataEntryValue | null): string | null {
  const url = value?.toString().trim() ?? "";
  return url.startsWith("/") && !url.startsWith("//") ? url : null;
}

export async function signInAction(formData: FormData) {
  const locale = await getLocale();
  const t = await getTranslations({ locale, namespace: "auth.errors" });
  const returnUrl = safeReturnUrl(formData.get("returnUrl"));
  const email = emailSchema.safeParse(formData.get("email"));
  const password = formData.get("password")?.toString() ?? "";

  const back = (error: string): never =>
    redirect({
      href: { pathname: "/sign-in", query: { error, ...(returnUrl ? { returnUrl } : {}) } },
      locale,
    });

  if (!email.success || !password) back(t("invalidCredentials"));

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword({
    email: email.data!,
    password,
  });
  if (error) {
    back(
      error.message.includes("Invalid login credentials") ? t("invalidCredentials") : error.message
    );
  }

  if (returnUrl) {
    const { redirect: nextRedirect } = await import("next/navigation");
    nextRedirect(returnUrl);
  }
  redirect({ href: "/", locale });
}

export async function forgotPasswordAction(formData: FormData) {
  const locale = await getLocale();
  const t = await getTranslations({ locale, namespace: "auth" });
  const email = emailSchema.safeParse(formData.get("email"));

  if (!email.success) {
    redirect({
      href: { pathname: "/forgot-password", query: { error: t("errors.invalidEmail") } },
      locale,
    });
  }

  // The recovery e-mail is built by the shared send-auth-email hook, which links to
  // Ambra's own /auth/confirm (see docs/REQUESTS_PORTAL_PLAN.md, D5).
  const supabase = await createClient();
  await supabase.auth.resetPasswordForEmail(email.data!);

  // Same message whether or not the account exists.
  redirect({
    href: { pathname: "/forgot-password", query: { success: t("success.resetSent") } },
    locale,
  });
}

export async function signOutAction() {
  const locale = await getLocale();
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect({ href: "/sign-in", locale });
}
