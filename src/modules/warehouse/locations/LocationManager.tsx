import { Tables } from "../../../../supabase/types/types";

export function LocationManager({
  initialLocations = [],
}: {
  initialLocations?: Tables<"locations">[];
}) {
  console.log(initialLocations || "gay");

  return <div>location manager</div>;
}
