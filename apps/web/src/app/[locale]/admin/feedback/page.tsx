import { getLocale } from "next-intl/server";
import { getPathname } from "@/i18n/navigation";
import { loadAdminContextV2 } from "@/server/loaders/v2/load-admin-context.v2";
import { loadFeedbackPage } from "@/components/platform-feedback/feedback-page-data";
import { AdminFeedbackClient } from "./_components/admin-feedback-client";
import "@/components/data-table/ambra-list.css";

type PageProps = {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

/**
 * Reports from every organization. The admin layout already admits only the
 * platform admin; the database checks it again for every read and write.
 */
export default async function AdminFeedbackPage({ searchParams }: PageProps = {}) {
  const [locale, context] = await Promise.all([getLocale(), loadAdminContextV2()]);
  const path = getPathname({ locale, href: "/admin/feedback" });
  const page = await loadFeedbackPage(
    "all",
    path,
    searchParams ? await searchParams : {},
    context?.user.id ?? ""
  );

  return <AdminFeedbackClient path={path} {...page} />;
}
