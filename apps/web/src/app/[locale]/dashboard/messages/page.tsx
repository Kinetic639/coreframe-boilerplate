import { redirect } from "@/i18n/navigation";
import { getLocale } from "next-intl/server";
import { loadDashboardContextV2 } from "@/server/loaders/v2/load-dashboard-context.v2";
import { checkPermission } from "@/lib/utils/permissions";
import { MESSAGES_USE } from "@/lib/constants/permissions";
import { MessagesPageClient } from "./_components/messages-page-client";

/**
 * /dashboard/wiadomosci — full view of the conversations (list, thread,
 * details). Data comes from the messages provider in the dashboard layout.
 */
export default async function MessagesPage({
  searchParams,
}: {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  const locale = await getLocale();
  const context = await loadDashboardContextV2();
  if (!context?.app.activeOrgId) return redirect({ href: "/sign-in", locale });

  if (!checkPermission(context.user.permissionSnapshot, MESSAGES_USE)) {
    return redirect({
      href: { pathname: "/dashboard/access-denied", query: { reason: "messages_use_required" } },
      locale,
    });
  }

  const params = searchParams ? await searchParams : {};
  const initialConversationId = typeof params.c === "string" ? params.c : null;

  return <MessagesPageClient initialConversationId={initialConversationId} />;
}
