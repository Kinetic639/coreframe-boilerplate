import { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { ProductGroupDetailClient } from "./product-group-detail-client";

interface ProductGroupDetailPageProps {
  params: Promise<{
    locale: string;
    id: string;
  }>;
}

export async function generateMetadata({ params }: ProductGroupDetailPageProps): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({
    locale,
    namespace: "productGroups.detail",
  });

  return {
    title: t("title"),
    description: t("overview"),
  };
}

export default async function ProductGroupDetailPage({ params }: ProductGroupDetailPageProps) {
  const { id } = await params;
  return <ProductGroupDetailClient productGroupId={id} />;
}
