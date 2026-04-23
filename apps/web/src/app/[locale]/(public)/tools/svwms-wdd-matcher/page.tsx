import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { PublicWddMatcher } from "@/components/tools/svwms-wdd-matcher/public-wdd-matcher";

type Props = {
  params: Promise<{ locale: string }>;
};

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "modules.tools.wddMatcher" });

  return {
    title: `${t("title")} | Ambra System`,
    description: t("public.subtitle"),
  };
}

export default function PublicWddMatcherPage() {
  return <PublicWddMatcher />;
}
