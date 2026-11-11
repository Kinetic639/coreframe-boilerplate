import { parseDataViewSearchParams } from "@/components/data-view/data-view-search-params";
import { createClient } from "@/utils/supabase/server";
import { PlatformFeedbackService } from "@/server/services/platform-feedback.service";
import { FeedbackListView } from "@/components/platform-feedback/feedback-list-view";

type PageProps = {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

/** The user's own reports to the Ambra team, with the answers. */
export default async function AccountFeedbackPage({ searchParams }: PageProps = {}) {
  const params = parseDataViewSearchParams(searchParams ? await searchParams : {});
  const supabase = await createClient();
  const result = await PlatformFeedbackService.list(supabase, {
    scope: "mine",
    search: params.search || undefined,
    page: params.page,
    pageSize: params.pageSize,
  });
  const initialData = result.success
    ? result.data
    : { rows: [], totalCount: 0, page: params.page, pageSize: params.pageSize };

  return (
    <div className="h-[calc(100vh-14rem)] min-h-[480px]">
      <FeedbackListView scope="mine" initialData={initialData} />
    </div>
  );
}
