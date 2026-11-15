import { getLocale } from "next-intl/server";
import { HydrationBoundary } from "@tanstack/react-query";
import { getPathname } from "@/i18n/navigation";
import { loadDashboardContextV2 } from "@/server/loaders/v2/load-dashboard-context.v2";
import { FeedbackListView } from "@/components/platform-feedback/feedback-list-view";
import { loadFeedbackPage } from "@/components/platform-feedback/feedback-page-data";
import "@/components/data-table/ambra-list.css";

type PageProps = {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

/** The user's own reports to the Ambra team, with the answers. */
export default async function AccountFeedbackPage({ searchParams }: PageProps = {}) {
  const [locale, context] = await Promise.all([getLocale(), loadDashboardContextV2()]);
  const path = getPathname({ locale, href: "/dashboard/account/feedback" });
  const page = await loadFeedbackPage(
    "mine",
    path,
    searchParams ? await searchParams : {},
    context?.user.user.id ?? ""
  );

  return (
    <HydrationBoundary state={page.dehydrated}>
      <FeedbackListView
        scope="mine"
        path={path}
        set={page.set}
        layout={page.layout}
        widths={page.widths}
        cookie={page.cookie}
        labels={page.labels}
      />
    </HydrationBoundary>
  );
}
