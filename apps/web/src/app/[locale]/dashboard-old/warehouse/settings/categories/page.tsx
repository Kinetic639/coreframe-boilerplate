import { getTranslations } from "next-intl/server";
import type { Metadata } from "next";
import { CategoriesPage } from "@/modules/warehouse/settings/components/categories-page";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("modules.warehouse.items.settings.categories");
  return {
    title: t("title"),
  };
}

export default function Page() {
  return <CategoriesPage />;
}
