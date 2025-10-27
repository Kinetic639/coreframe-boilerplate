import { Metadata } from "next";
import { loadAppContextServer } from "@/lib/api/load-app-context-server";
import { redirect } from "next/navigation";
import { DeliveryDebugger } from "@/modules/warehouse/components/delivery-debugger";

export const metadata: Metadata = {
  title: "Delivery Debugger - Development Tool",
  description: "Debug and inspect delivery data",
};

export default async function DeliveryDebugPage() {
  const { activeOrg, activeBranch } = await loadAppContextServer();

  if (!activeOrg || !activeBranch) {
    redirect("/dashboard/start");
  }

  return (
    <div className="container mx-auto py-6 space-y-6">
      <div className="bg-yellow-100 border-l-4 border-yellow-500 p-4 mb-6">
        <div className="flex">
          <div className="flex-shrink-0">
            <svg
              className="h-5 w-5 text-yellow-500"
              xmlns="http://www.w3.org/2000/svg"
              viewBox="0 0 20 20"
              fill="currentColor"
            >
              <path
                fillRule="evenodd"
                d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z"
                clipRule="evenodd"
              />
            </svg>
          </div>
          <div className="ml-3">
            <p className="text-sm text-yellow-700">
              <strong>Development Tool:</strong> This page is for debugging deliveries in
              development. Remove before production.
            </p>
          </div>
        </div>
      </div>

      <DeliveryDebugger organizationId={activeOrg.organization_id} branchId={activeBranch.id} />
    </div>
  );
}
