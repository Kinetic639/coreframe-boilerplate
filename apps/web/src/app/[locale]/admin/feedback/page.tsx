import { parseDataViewSearchParams } from "@/components/data-view/data-view-search-params";
import { createClient } from "@/utils/supabase/server";
import { PlatformFeedbackService } from "@/server/services/platform-feedback.service";
import { AdminFeedbackClient } from "./_components/admin-feedback-client";

type PageProps = {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

/**
 * Reports from every organization. The admin layout already admits only the
 * platform admin; the database checks it again for every read and write.
 */
export default async function AdminFeedbackPage({ searchParams }: PageProps = {}) {
  const params = parseDataViewSearchParams(searchParams ? await searchParams : {});
  const supabase = await createClient();
  const result = await PlatformFeedbackService.list(supabase, {
    scope: "all",
    search: params.search || undefined,
    page: params.page,
    pageSize: params.pageSize,
  });
  const initialData = result.success
    ? result.data
    : { rows: [], totalCount: 0, page: params.page, pageSize: params.pageSize };

  return (
    <div className="h-[calc(100vh-8rem)] min-h-[520px]">
      <AdminFeedbackClient initialData={initialData} />
    </div>
  );
}
