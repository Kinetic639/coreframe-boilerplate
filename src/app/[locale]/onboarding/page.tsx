import { createClient } from "@/utils/supabase/server";
import { redirect } from "@/i18n/navigation";
import { getLocale } from "next-intl/server";
import { loadAppContextV2 } from "@/server/loaders/v2/load-app-context.v2";
import { getAvailablePlansAction } from "@/app/actions/onboarding";
import { OnboardingWizardClient } from "./_components/onboarding-wizard-client";
import { OnboardingInvitePendingClient } from "./_components/onboarding-invite-pending-client";

/**
 * Onboarding page — post-signup state machine.
 *
 * State routing:
 *   1. Not authenticated          → /sign-in
 *   2. Already has an org         → /dashboard/start (handles returning users)
 *   3. Has pending invitations    → OnboardingInvitePendingClient
 *   4. No org, no invitations     → OnboardingWizardClient (self-starter flow)
 *
 * This page intentionally does NOT use loadDashboardContextV2 to avoid
 * the redirect loop: dashboard layout redirects here when activeOrgId is
 * null, so we must not use the same loader that triggers that redirect.
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

  // State 2: user already has an org — skip onboarding entirely
  const appContext = await loadAppContextV2();
  if (appContext?.activeOrgId) {
    return redirect({ href: "/dashboard/start", locale });
  }

  const firstName = (user.user_metadata?.first_name as string | undefined) ?? "";

  // Check for pending invitations (non-expired)
  const now = new Date().toISOString();
  const { data: pendingInvites } = await supabase
    .from("invitations")
    .select("id, token, organization_id, organizations(name)")
    .eq("status", "pending")
    .is("deleted_at", null)
    .ilike("email", user.email ?? "")
    .or(`expires_at.is.null,expires_at.gt.${now}`)
    .order("created_at", { ascending: false })
    .limit(5);

  // State 3: has pending invites — show invitation-first screen
  if (pendingInvites && pendingInvites.length > 0) {
    const invites = pendingInvites.map((inv) => {
      const org = inv.organizations as { name: string } | { name: string }[] | null;
      const orgName = Array.isArray(org) ? (org[0]?.name ?? null) : (org?.name ?? null);
      return {
        id: inv.id as string,
        token: inv.token as string,
        orgName,
      };
    });

    return (
      <OnboardingInvitePendingClient
        userEmail={user.email ?? ""}
        firstName={firstName}
        invites={invites}
      />
    );
  }

  // State 4: no org, no invites — show onboarding wizard
  const plans = await getAvailablePlansAction();

  return (
    <OnboardingWizardClient userEmail={user.email ?? ""} firstName={firstName} plans={plans} />
  );
}
