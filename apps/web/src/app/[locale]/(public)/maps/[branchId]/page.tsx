import { notFound } from "next/navigation";
import { getPublicWarehouseBranchBundleAction } from "@/app/actions/warehouse/public-maps";
import { PublicWarehouseMapsPageClient } from "./_components/public-warehouse-maps-page-client";

interface Props {
  params: Promise<{ locale: string; branchId: string }>;
}

export default async function PublicWarehouseMapsPage({ params }: Props) {
  const { branchId } = await params;
  const result = await getPublicWarehouseBranchBundleAction(branchId);

  if (!result.success || !result.data) {
    notFound();
  }

  return (
    <PublicWarehouseMapsPageClient
      branch={result.data.branch}
      layouts={result.data.layouts}
      locations={result.data.locations}
      locationGroups={result.data.locationGroups}
    />
  );
}
