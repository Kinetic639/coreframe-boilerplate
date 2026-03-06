import { getPublicInvitationPreviewAction } from "@/app/actions/organization/invite-preview";
import { createClient } from "@/utils/supabase/server";
import { getLocale } from "next-intl/server";
import { InvitePageClient } from "./_components/invite-page-client";

interface Props {
  params: Promise<{ locale: string; token: string }>;
}

/**
 * Server-rendered invitation page.
 *
 * Preview data is loaded SSR via the SECURITY DEFINER
 * get_invitation_preview_by_token function — no client-side auth
 * required to see invite details. The accept action is delegated to
 * the client island (InvitePageClient) which calls acceptInvitationAction.
 */
export default async function InvitationPage({ params }: Props) {
  const { token } = await params;
  const locale = await getLocale();

  // Load preview SSR — works for unauthenticated visitors too
  const preview = await getPublicInvitationPreviewAction(token);

  // Load current user (server-side, validated against Supabase Auth)
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  return (
    <InvitePageClient
      token={token}
      preview={preview}
      userEmail={user?.email ?? null}
      locale={locale}
    />
  );
}
