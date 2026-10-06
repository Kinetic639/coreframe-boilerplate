import { Plus } from "lucide-react";
import { getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";

/** Mobile floating "Nowe zapytanie" button (desktop has it in the header). */
export async function NewRequestFab() {
  const t = await getTranslations("requests");
  return (
    <Link
      href="/new"
      className="fixed bottom-6 right-4 z-30 flex h-[52px] items-center gap-2 rounded-2xl bg-primary pl-4 pr-5 text-[15px] font-semibold text-stone-900 shadow-[0_8px_24px_-6px_rgba(161,92,7,.45),0_2px_6px_rgba(28,25,23,.12)] lg:hidden"
    >
      <Plus className="h-[18px] w-[18px]" strokeWidth={2.4} />
      {t("newLabel")}
    </Link>
  );
}
