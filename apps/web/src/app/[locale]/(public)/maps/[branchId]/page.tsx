import { notFound } from "next/navigation";
import { NextIntlClientProvider } from "next-intl";
import { getMessages } from "next-intl/server";
import { getPublicWarehouseBranchBundleAction } from "@/app/actions/warehouse/public-maps";
import { PublicWarehouseMapsPageShell } from "./_components/public-warehouse-maps-page-shell";

interface Props {
  params: Promise<{ locale: string; branchId: string }>;
}

export default async function PublicWarehouseMapsPage({ params }: Props) {
  const { branchId } = await params;
  const messages = await getMessages();
  const result = await getPublicWarehouseBranchBundleAction(branchId);

  if (!result.success || !result.data) {
    notFound();
  }

  return (
    <NextIntlClientProvider messages={messages}>
      <PublicWarehouseMapsPageShell
        branch={result.data.branch}
        layouts={result.data.layouts}
        locations={result.data.locations}
        locationGroups={result.data.locationGroups}
      />
    </NextIntlClientProvider>
  );
}
