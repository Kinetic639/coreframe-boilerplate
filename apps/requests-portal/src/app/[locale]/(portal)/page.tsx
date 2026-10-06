import { MousePointerClick } from "lucide-react";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { AutoRefresh } from "@/components/requests/auto-refresh";
import { ListPane } from "@/components/requests/list-pane";
import { NewRequestFab } from "@/components/requests/new-request-fab";
import { requirePortalContext } from "@/server/portal-context";
import type { ListSearchParams } from "@/server/requests/list-params";

export default async function RequestsPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<ListSearchParams>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const [ctx, sp, t] = await Promise.all([
    requirePortalContext(),
    searchParams,
    getTranslations("requests"),
  ]);

  return (
    <div className="flex flex-1 lg:grid lg:grid-cols-[minmax(380px,480px)_1fr]">
      <div className="min-w-0 flex-1 lg:border-r lg:border-stone-200">
        <ListPane ctx={ctx} searchParams={sp} />
      </div>
      <div className="hidden flex-col items-center justify-center gap-2 text-stone-500 lg:flex">
        <MousePointerClick className="h-7 w-7 text-stone-400" />
        <p className="text-sm">{t("pickOne")}</p>
      </div>
      <NewRequestFab />
      <AutoRefresh />
    </div>
  );
}
