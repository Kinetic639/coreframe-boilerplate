import { getMyPendingInvitationsAction } from "@/app/actions/organization/invite-preview";
import { createClient } from "@/utils/supabase/server";
import { redirect } from "@/i18n/navigation";
import { getLocale } from "next-intl/server";
import { InviteResolveClient } from "./_components/invite-resolve-client";

/**
 * Invite resolution page — shown when the system detects pending invites
 * for the authenticated user's email.
 *
 * This page:
 * - Requires authentication (redirects to sign-in otherwise)
 * - Loads pending invites via SECURITY DEFINER function (no RLS bypass needed client-side)
 * - If no pending invites → redirects to /dashboard/start
 * - If 1+ pending invites → shows resolution UI
 *
 * Choosing "skip" leaves invites pending (does not cancel them).
 * Choosing "join" navigates to /invite/[token] where actual acceptance happens.
 */
export default async function InviteResolvePage() {
  const locale = await getLocale();

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return redirect({ href: "/sign-in", locale });
  }

  const result = await getMyPendingInvitationsAction();

  // No pending invites → go to dashboard
  if (!result.success || result.invitations.length === 0) {
    return redirect({ href: "/dashboard/start", locale });
  }

  return (
    <InviteResolveClient
      invitations={result.invitations}
      userEmail={user.email ?? ""}
      skipHref="/onboarding"
    />
  );
}
