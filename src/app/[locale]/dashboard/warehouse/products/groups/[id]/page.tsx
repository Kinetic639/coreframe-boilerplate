import { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { ProductGroupDetailClient } from "./product-group-detail-client";

interface ProductGroupDetailPageProps {
  params: {
    locale: string;
    id: string;
  };
}

export async function generateMetadata({ params }: ProductGroupDetailPageProps): Promise<Metadata> {
  const t = await getTranslations({
    locale: params.locale,
    namespace: "productGroups.detail",
  });

  return {
    title: t("title"),
    description: t("overview"),
  };
}

export default async function ProductGroupDetailPage({ params }: ProductGroupDetailPageProps) {
  return <ProductGroupDetailClient productGroupId={params.id} />;
}
