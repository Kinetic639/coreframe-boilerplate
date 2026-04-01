import { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { loadAppContextServer } from "@/lib/api/load-app-context-server";
import { redirect } from "next/navigation";
import { DeliveriesListView } from "@/modules/warehouse/components/deliveries-list-view";

export async function generateMetadata({
  params: { locale },
}: {
  params: { locale: string };
}): Promise<Metadata> {
  const t = await getTranslations({ locale, namespace: "modules.warehouse.items.deliveries" });

  return {
    title: t("title"),
    description: t("list"),
  };
}

export default async function DeliveriesPage() {
  const { activeOrg, activeBranch } = await loadAppContextServer();

  if (!activeOrg || !activeBranch) {
    redirect("/dashboard-old/start");
  }

  return (
    <div className="container mx-auto py-6 space-y-6">
      <DeliveriesListView organizationId={activeOrg.organization_id} branchId={activeBranch.id} />
    </div>
  );
}
