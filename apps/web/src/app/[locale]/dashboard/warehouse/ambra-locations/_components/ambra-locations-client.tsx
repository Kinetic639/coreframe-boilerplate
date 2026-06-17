"use client";

import { useMemo, useState } from "react";
import { AnimatePresence, motion } from "motion/react";

import {
  useCreateLocationMutation,
  useDeleteLocationMutation,
  useUpdateLocationMutation,
} from "@/hooks/queries/warehouse";
import { MOCK_BRANCHES, MOCK_LAYOUTS, MOCK_LOCATIONS, MOCK_VISUALS } from "../_ambra/constants";
import LocationsPage from "../_ambra/components/locations/LocationsPage";
import type {
  AmbraLocationInventorySnapshot,
  Branch,
  Layout,
  LogicalLocation,
  VisualNode,
} from "../_ambra/types";
import type { InventoryVariantOption } from "@/lib/warehouse/inventory-types";
import {
  ambraLocationToCreateInput,
  ambraLocationToUpdateInput,
  warehouseLocationsToAmbra,
} from "../_lib/warehouse-location-adapter";

type AmbraLocationsClientProps = {
  activeBranch: Branch;
  initialLocations: LogicalLocation[];
  initialInventorySnapshot: AmbraLocationInventorySnapshot;
  variantOptions: InventoryVariantOption[];
};

export function AmbraLocationsClient({
  activeBranch,
  initialLocations,
  initialInventorySnapshot,
  variantOptions,
}: AmbraLocationsClientProps) {
  const useDemoData = initialLocations.length === 0;
  const [locations, setLocations] = useState<LogicalLocation[]>(
    useDemoData ? MOCK_LOCATIONS : initialLocations
  );
  const [layouts] = useState<Layout[]>(useDemoData ? MOCK_LAYOUTS : []);
  const [visuals] = useState<VisualNode[]>(useDemoData ? MOCK_VISUALS : []);
  const effectiveBranch = useDemoData ? MOCK_BRANCHES[0] : activeBranch;
  const createLocation = useCreateLocationMutation(useDemoData ? null : activeBranch.id);
  const updateLocation = useUpdateLocationMutation(useDemoData ? null : activeBranch.id);
  const deleteLocation = useDeleteLocationMutation(useDemoData ? null : activeBranch.id);

  const branchLocations = useMemo(
    () => locations.filter((location) => location.branchId === effectiveBranch.id),
    [effectiveBranch.id, locations]
  );

  const branchLayouts = useMemo(
    () => layouts.filter((layout) => layout.branchId === effectiveBranch.id),
    [effectiveBranch.id, layouts]
  );

  const branchVisuals = useMemo(
    () =>
      visuals.filter((visual) => {
        const layout = layouts.find((item) => item.id === visual.layoutId);
        return layout?.branchId === effectiveBranch.id;
      }),
    [effectiveBranch.id, layouts, visuals]
  );

  const handleCreateLocation = async (location: LogicalLocation) => {
    if (useDemoData) {
      setLocations((current) => [...current, { ...location, branchId: effectiveBranch.id }]);
      return;
    }

    const created = await createLocation.mutateAsync(ambraLocationToCreateInput(location));
    const [createdAmbraLocation] = warehouseLocationsToAmbra([created]);
    if (!createdAmbraLocation) return;

    setLocations((current) => [...current, createdAmbraLocation]);
  };

  const handleUpdateLocation = async (location: Partial<LogicalLocation> & { id: string }) => {
    if (useDemoData) {
      setLocations((current) =>
        current.map((item) => (item.id === location.id ? { ...item, ...location } : item))
      );
      return;
    }

    const updated = await updateLocation.mutateAsync(ambraLocationToUpdateInput(location));
    const [updatedAmbraLocation] = warehouseLocationsToAmbra([updated]);
    if (!updatedAmbraLocation) return;

    setLocations((current) =>
      current.map((item) => (item.id === location.id ? updatedAmbraLocation : item))
    );
  };

  const handleDeleteLocation = async (locationId: string) => {
    if (useDemoData) {
      setLocations((current) => current.filter((item) => item.id !== locationId));
      return;
    }

    await deleteLocation.mutateAsync(locationId);
    setLocations((current) => current.filter((item) => item.id !== locationId));
  };

  return (
    <div className="h-[calc(100vh-4rem)] overflow-hidden bg-background text-foreground selection:bg-primary/30">
      <AnimatePresence mode="wait">
        <motion.div
          key="locations"
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -10 }}
          transition={{ duration: 0.2 }}
          className="h-full"
        >
          <LocationsPage
            locations={branchLocations}
            visuals={branchVisuals}
            layouts={branchLayouts}
            inventorySnapshot={initialInventorySnapshot}
            variantOptions={variantOptions}
            onCreateLocation={handleCreateLocation}
            onUpdateLocation={handleUpdateLocation}
            onDeleteLocation={handleDeleteLocation}
            onNavigateToWorkspace={() => undefined}
          />
        </motion.div>
      </AnimatePresence>
    </div>
  );
}
