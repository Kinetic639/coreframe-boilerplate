import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { createClient } from "@/utils/supabase/server";
import { loadDashboardContextV2 } from "@/server/loaders/v2/load-dashboard-context.v2";
import { ToolsCatalogService, UserToolsService } from "@/server/services/tools.service";
import { ToolDetailClient } from "../_components/tool-detail-client";

interface ToolDetailPageProps {
  params: Promise<{ slug: string }>;
}

/**
 * /dashboard/tools/[slug] — Tool detail page.
 *
 * SSR: loads tool catalog item + user's record for this tool.
 * Returns 404 if slug not found or tool is inactive.
 */
export default async function ToolDetailPage({ params }: ToolDetailPageProps) {
  const { slug } = await params;
  await getTranslations("modules.tools"); // warm i18n namespace

  const supabase = await createClient();
  const context = await loadDashboardContextV2();
  const userId = context?.user?.user?.id ?? "";

  const [toolResult, recordResult] = await Promise.all([
    ToolsCatalogService.getToolBySlug(supabase, slug),
    userId
      ? UserToolsService.getUserToolRecord(supabase, userId, slug)
      : Promise.resolve({ success: true as const, data: null }),
  ]);

  // 404 for missing or inactive tools
  if (!toolResult.success || !toolResult.data) {
    notFound();
  }

  const tool = toolResult.data;
  const record = recordResult.success ? recordResult.data : null;

  return (
    <div className="p-4 md:p-6">
      <ToolDetailClient tool={tool} initialRecord={record} />
    </div>
  );
}

export async function generateMetadata({ params }: ToolDetailPageProps) {
  const { slug } = await params;
  const t = await getTranslations("modules.tools");
  const supabase = await createClient();
  const result = await ToolsCatalogService.getToolBySlug(supabase, slug);
  const name = result.success && result.data ? result.data.name : t("title");
  return { title: name };
}
