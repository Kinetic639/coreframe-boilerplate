import { createClient } from "@/utils/supabase/server";
import { redirect } from "@/i18n/navigation";
import { getLocale } from "next-intl/server";
import { OnboardingEntryClient } from "./_components/onboarding-entry-client";

/**
 * Onboarding entry page — the handoff point after signup or invite decline/skip.
 *
 * Routes here:
 * - auth/callback after email confirmation (no invite)
 * - signInAction when user has no active org membership
 * - InvitePageClient after declining an invite (no more pending invites)
 * - InviteResolveClient "continue without accepting" skip button
 *
 * This page does NOT implement a full onboarding wizard.
 * It is a clean entry point for future org creation or browsing.
 */
export default async function OnboardingPage() {
  const locale = await getLocale();
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return redirect({ href: "/sign-in", locale });
  }

  return <OnboardingEntryClient userEmail={user.email ?? ""} />;
}
