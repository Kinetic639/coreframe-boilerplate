import { Metadata } from "next";
import { loadAppContextServer } from "@/lib/api/load-app-context-server";
import { redirect } from "next/navigation";
import { DeliveryDebugger } from "@/modules/warehouse/components/delivery-debugger";

export const metadata: Metadata = {
  title: "Delivery Debugger - Development Tool",
  description: "Debug and inspect delivery data",
};

export default async function DeliveryDebuggerPage() {
  const { activeOrg, activeBranch } = await loadAppContextServer();

  if (!activeOrg || !activeBranch) {
    redirect("/dashboard/start");
  }

  return (
    <div className="container mx-auto py-6 space-y-6">
      <DeliveryDebugger organizationId={activeOrg.organization_id} branchId={activeBranch.id} />
    </div>
  );
}
