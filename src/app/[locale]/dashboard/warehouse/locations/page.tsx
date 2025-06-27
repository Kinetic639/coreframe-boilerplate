import { LocationManager } from "@/modules/warehouse/locations/LocationManager";
import { loadLocations } from "@/modules/warehouse/api/locations";
import { loadAppContextServer } from "@/lib/api/load-app-context-server";

export default async function Locations() {
  const context = await loadAppContextServer();
  const orgId = context?.active_org_id;
  const locations = orgId ? await loadLocations(orgId) : [];

  return (
    <div className="mx-auto max-w-7xl">
      <LocationManager initialLocations={locations} />
    </div>
  );
}
