import { createClient } from "@/utils/supabase/server";
import { redirect } from "@/i18n/navigation";
import { getLocale } from "next-intl/server";
import { OnboardingEntryClient } from "./_components/onboarding-entry-client";

/**
 * Onboarding entry page — protection screen for authenticated users with no active org.
 *
 * Routes here:
 * - auth/callback after email confirmation (no invite)
 * - signInAction when user has no active org membership
 * - Dashboard layout when activeOrgId is null
 * - InvitePageClient after declining an invite (no more pending invites)
 *
 * Checks for pending invitations so the UI can guide the user appropriately.
 * Does NOT implement a full onboarding wizard.
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

  // Check if the user has any pending invitations by email
  const { data: pendingInvites } = await supabase
    .from("invitations")
    .select("id, token, organization_id")
    .eq("status", "pending")
    .is("deleted_at", null)
    .ilike("email", user.email ?? "")
    .limit(1);

  const pendingInviteToken = pendingInvites?.[0]?.token ?? null;

  const firstName = (user.user_metadata?.first_name as string | undefined) ?? "";

  return (
    <OnboardingEntryClient
      userEmail={user.email ?? ""}
      firstName={firstName}
      pendingInviteToken={pendingInviteToken}
    />
  );
}
