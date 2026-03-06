import { createClient } from "@/utils/supabase/server";
import { NextResponse } from "next/server";

export async function GET(request: Request) {
  // The `/auth/callback` route is required for the server-side auth flow implemented
  // by the SSR package. It exchanges an auth code for the user's session.
  // https://supabase.com/docs/guides/auth/server-side/nextjs
  const requestUrl = new URL(request.url);
  const code = requestUrl.searchParams.get("code");
  const origin = requestUrl.origin;
  const redirectTo = requestUrl.searchParams.get("redirect_to")?.toString();
  const invitationToken = requestUrl.searchParams.get("invitation_token")?.toString();

  if (code) {
    const supabase = await createClient();
    await supabase.auth.exchangeCodeForSession(code);

    // If an invitation token is present, auto-accept it now that the user has a session
    if (invitationToken) {
      const { data, error } = await supabase.rpc("accept_invitation_and_join_org", {
        p_token: invitationToken,
      });
      if (error) {
        console.error("[auth/callback] Invitation acceptance RPC error:", error.message);
      } else {
        const result = data as { success: boolean; error?: string; organization_id?: string };
        if (!result.success) {
          console.error("[auth/callback] Invitation acceptance failed:", result.error);
        }
      }
    }
  }

  if (redirectTo) {
    return NextResponse.redirect(`${origin}${redirectTo}`);
  }

  // If no invitation token was present (non-invite signup path), check
  // whether the newly authenticated user has any pending invites by email.
  // Redirect to the resolve page so they can join without having used the link.
  if (!invitationToken && code) {
    const supabase = await createClient();
    const { data: pendingData } = await supabase.rpc("get_my_pending_invitations");
    const pendingResult = pendingData as {
      success: boolean;
      invitations?: unknown[];
    } | null;
    if (pendingResult?.success && (pendingResult.invitations?.length ?? 0) > 0) {
      return NextResponse.redirect(`${origin}/invite/resolve`);
    }
  }

  // auth/callback is the email-confirmation route for new signups.
  // At this point the user has no org yet — route to onboarding entry.
  if (invitationToken) {
    // Invite signup: accepted above → go to dashboard
    return NextResponse.redirect(`${origin}/dashboard/start`);
  }
  return NextResponse.redirect(`${origin}/onboarding`);
}
