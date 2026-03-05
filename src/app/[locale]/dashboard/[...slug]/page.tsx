import { redirect } from "@/i18n/navigation";
import { getLocale } from "next-intl/server";

/**
 * Dashboard catch-all route — hard lock
 *
 * Any /dashboard/* path that does not have a physical page file is caught here.
 * Instead of returning a 404 we redirect to the default V2 landing page so
 * users are never left on a dead URL when old bookmarks or links are followed.
 *
 * Allowed routes (physical pages, not caught here):
 *   /dashboard/start          — welcome landing
 *   /dashboard/diagnostics    — diagnostics panel (admin link)
 *   /dashboard/tools/**       — Tools V2 module
 *   /dashboard/account/**     — User Account V2 module
 *   /dashboard/organization/** — Org Management V2 module
 *   /dashboard/access-denied  — permission gate redirect target
 */
export default async function DashboardCatchAll() {
  const locale = await getLocale();
  return redirect({ href: "/dashboard/tools", locale });
}
