import { loadAppContextServer } from "@/lib/api/load-app-context-server";
import { loadLocationsServer } from "@/modules/warehouse/api/locations";
import { LocationManager } from "@/modules/warehouse/locations/LocationManager";

export default async function LocationsPage() {
  const context = await loadAppContextServer();

  const orgId = context?.active_org_id;
  const branchId = context?.active_branch_id;

  if (!orgId || !branchId) {
    return <div className="p-4 text-red-600">Brak aktywnej organizacji lub oddziału.</div>;
  }

  const locations = await loadLocationsServer(orgId, branchId);

  return (
    <div className="mx-auto max-w-7xl px-4">
      <LocationManager locations={locations} activeOrgId={orgId} activeBranchId={branchId} />
    </div>
  );
}
