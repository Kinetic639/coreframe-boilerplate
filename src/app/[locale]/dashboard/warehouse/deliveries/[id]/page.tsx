import { redirect } from "next/navigation";
import { loadAppContextServer } from "@/lib/api/load-app-context-server";
import { getDelivery } from "@/app/actions/warehouse/get-delivery";
import { DeliveryDetailsForm } from "@/modules/warehouse/components/delivery-details-form";

interface DeliveryDetailsPageProps {
  params: Promise<{
    locale: string;
    id: string;
  }>;
}

export default async function DeliveryDetailsPage({ params }: DeliveryDetailsPageProps) {
  const { activeOrg, activeBranch } = await loadAppContextServer();
  const { id } = await params;

  if (!activeOrg || !activeBranch) {
    redirect("/");
  }

  const delivery = await getDelivery(id);

  if (!delivery) {
    redirect("/dashboard/warehouse/deliveries");
  }

  return (
    <DeliveryDetailsForm
      delivery={delivery}
      organizationId={activeOrg.organization_id}
      branchId={activeBranch.id}
    />
  );
}
