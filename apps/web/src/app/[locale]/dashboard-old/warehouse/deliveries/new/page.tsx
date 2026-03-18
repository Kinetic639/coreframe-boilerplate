import { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { loadAppContextServer } from "@/lib/api/load-app-context-server";
import { redirect } from "next/navigation";
import { NewDeliveryForm } from "@/modules/warehouse/components/new-delivery-form";

export async function generateMetadata({
  params: { locale },
}: {
  params: { locale: string };
}): Promise<Metadata> {
  const t = await getTranslations({ locale, namespace: "modules.warehouse.items.deliveries" });

  return {
    title: t("new"),
    description: t("new"),
  };
}

export default async function NewDeliveryPage() {
  const { activeOrg, activeBranch } = await loadAppContextServer();

  if (!activeOrg || !activeBranch) {
    redirect("/dashboard-old/start");
  }

  return (
    <div className="container mx-auto py-6">
      <NewDeliveryForm organizationId={activeOrg.organization_id} branchId={activeBranch.id} />
    </div>
  );
}
