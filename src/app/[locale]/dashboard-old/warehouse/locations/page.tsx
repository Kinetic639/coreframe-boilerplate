"use client";
import { useAppStore } from "@/lib/stores/app-store";
import LocationManager from "./location-manager";

export default function LocationsPage() {
  const { activeBranch, isLoaded } = useAppStore();
  const activeBranchId = activeBranch?.branch_id || null;
  const activeBranchName = activeBranch?.name || "";

  if (!isLoaded) {
    return <div>Loading...</div>; // Or a proper skeleton loader
  }

  return <LocationManager activeBranchId={activeBranchId} activeBranchName={activeBranchName} />;
}
