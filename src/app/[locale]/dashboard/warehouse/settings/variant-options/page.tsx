import { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { VariantOptionsPage } from "@/modules/warehouse/settings/components/variant-options-page";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("modules.warehouse.items.settings.variantOptions");
  return {
    title: t("title"),
  };
}

export default async function VariantOptionsRoute() {
  return <VariantOptionsPage />;
}
