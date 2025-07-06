import { loadAppContextServer } from "@/lib/api/load-app-context-server";
import LocationManager from "./location-manager";

export default async function LocationsPage() {
  const context = await loadAppContextServer();
  const activeBranchId = context?.activeBranch?.branch_id || null;
  const activeBranchName = context?.activeBranch?.name || "";

  return <LocationManager activeBranchId={activeBranchId} activeBranchName={activeBranchName} />;
}
