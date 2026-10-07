import { MousePointerClick } from "lucide-react";
import { getTranslations, setRequestLocale } from "next-intl/server";

/** Desktop placeholder next to the list; on phones the list itself is the page. */
export default async function RequestsPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("requests");
  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-2 text-stone-500">
      <MousePointerClick className="h-7 w-7 text-stone-400" />
      <p className="text-sm">{t("pickOne")}</p>
    </div>
  );
}
