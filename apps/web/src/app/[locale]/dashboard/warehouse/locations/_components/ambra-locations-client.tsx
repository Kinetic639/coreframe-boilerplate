"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useTranslations } from "next-intl";
import { useQueryState, parseAsString } from "nuqs";
import { getQrAssignmentForLocationAction } from "@/app/actions/qr/assign-location";
import { AnimatePresence, motion } from "motion/react";
import { List, TreePine } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

import {
  useCreateLocationMutation,
  useDeleteLocationMutation,
  useUpdateLocationMutation,
} from "@/hooks/queries/warehouse";
import LocationsPage from "../_ambra/components/locations/LocationsPage";
import type {
  AmbraLocationInventorySnapshot,
  Branch,
  Layout,
  LogicalLocation,
  VisualNode,
} from "../_ambra/types";
import type { InventoryVariantOption } from "@/lib/warehouse/inventory-types";
import type { PaginatedResult } from "@/lib/data-view/types";
import type { LocationListRow } from "@/server/services/warehouse-locations.service";
import type { WarehouseLocation } from "@/lib/warehouse/location-tree";
import {
  ambraLocationToCreateInput,
  ambraLocationToUpdateInput,
  warehouseLocationsToAmbra,
} from "../_lib/warehouse-location-adapter";
import { LocationsDataView } from "./locations-data-view";

type AmbraLocationsClientProps = {
  organizationId: string;
  activeBranch: Branch;
  initialLocations: LogicalLocation[];
  rawLocations: WarehouseLocation[];
  initialInventorySnapshot: AmbraLocationInventorySnapshot;
  variantOptions: InventoryVariantOption[];
  initialListData: PaginatedResult<LocationListRow>;
  /** Whether the current user is allowed to create locations (gates the empty-state CTA). */
  canCreateLocation: boolean;
};

export function AmbraLocationsClient({
  organizationId,
  activeBranch,
  initialLocations,
  rawLocations,
  initialInventorySnapshot,
  variantOptions,
  initialListData,
  canCreateLocation,
}: AmbraLocationsClientProps) {
  const t = useTranslations("warehouseLocations.listView");
  const [viewParam, setViewParam] = useQueryState("view", parseAsString.withDefault("tree"));
  const viewMode = (viewParam === "list" ? "list" : "tree") as "tree" | "list";

  const [treeSelectedId, setTreeSelectedId] = useState<string | null>(() => {
    if (typeof window === "undefined") return null;
    return new URL(window.location.href).searchParams.get("selected") || null;
  });

  const selectedLocationId = viewMode === "tree" ? treeSelectedId : null;

  const setSelectedLocationId = useCallback((id: string | null) => setTreeSelectedId(id), []);

  const setViewMode = useCallback(
    (mode: "tree" | "list") => {
      if (mode === "list" && treeSelectedId) {
        const url = new URL(window.location.href);
        url.searchParams.set("selected", treeSelectedId);
        url.searchParams.set("view", "list");
        window.history.replaceState(null, "", url.toString());
      } else if (mode === "tree") {
        const url = new URL(window.location.href);
        const sel = url.searchParams.get("selected");
        if (sel) setTreeSelectedId(sel);
        url.searchParams.delete("selected");
        url.searchParams.set("view", "tree");
        window.history.replaceState(null, "", url.toString());
      }
      void setViewParam(mode, { history: "replace" });
    },
    [setViewParam, treeSelectedId]
  );
  type QrAssignmentInfo = {
    assignmentId: string;
    qrCodeId: string;
    token: string;
    label: string | null;
    status: string;
  };
  const [qrCache, setQrCache] = useState<Map<string, QrAssignmentInfo | null>>(new Map());
  const [qrAssignment, setQrAssignment] = useState<QrAssignmentInfo | null>(null);

  useEffect(() => {
    if (!selectedLocationId) {
      setQrAssignment(null);
      return;
    }
    if (qrCache.has(selectedLocationId)) {
      setQrAssignment(qrCache.get(selectedLocationId) ?? null);
      return;
    }
    getQrAssignmentForLocationAction(selectedLocationId)
      .then((r) => {
        const val = r.success && r.data ? (r.data as QrAssignmentInfo) : null;
        setQrAssignment(val);
        setQrCache((prev) => new Map(prev).set(selectedLocationId, val));
      })
      .catch(() => {
        setQrAssignment(null);
        setQrCache((prev) => new Map(prev).set(selectedLocationId, null));
      });
  }, [selectedLocationId, qrCache]);

  const [locations, setLocations] = useState<LogicalLocation[]>(initialLocations);
  const [layouts] = useState<Layout[]>([]);
  const [visuals] = useState<VisualNode[]>([]);
  const effectiveBranch = activeBranch;
  const createLocation = useCreateLocationMutation(activeBranch.id);
  const updateLocation = useUpdateLocationMutation(activeBranch.id);
  const deleteLocation = useDeleteLocationMutation(activeBranch.id);

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
    const created = await createLocation.mutateAsync(ambraLocationToCreateInput(location));
    const [createdAmbraLocation] = warehouseLocationsToAmbra([created]);
    if (!createdAmbraLocation) return;

    setLocations((current) => [...current, createdAmbraLocation]);
  };

  const handleUpdateLocation = async (location: Partial<LogicalLocation> & { id: string }) => {
    const updated = await updateLocation.mutateAsync(ambraLocationToUpdateInput(location));
    const [updatedAmbraLocation] = warehouseLocationsToAmbra([updated]);
    if (!updatedAmbraLocation) return;

    setLocations((current) =>
      current.map((item) => (item.id === location.id ? updatedAmbraLocation : item))
    );
  };

  const handleDeleteLocation = async (locationId: string) => {
    await deleteLocation.mutateAsync(locationId);
    setLocations((current) => current.filter((item) => item.id !== locationId));
  };

  return (
    <div className="h-[calc(100vh-4rem)] overflow-hidden bg-background text-foreground selection:bg-primary/30 flex flex-col">
      <div className="flex items-center gap-1 px-4 pt-2 pb-1">
        <Button
          variant="ghost"
          size="sm"
          className={cn("gap-1.5", viewMode === "tree" && "bg-muted")}
          onClick={() => setViewMode("tree")}
        >
          <TreePine className="h-4 w-4" />
          {t("treeView")}
        </Button>
        <Button
          variant="ghost"
          size="sm"
          className={cn("gap-1.5", viewMode === "list" && "bg-muted")}
          onClick={() => setViewMode("list")}
        >
          <List className="h-4 w-4" />
          {t("listView")}
        </Button>
      </div>
      <div className="flex-1 min-h-0">
        {viewMode === "list" ? (
          <LocationsDataView
            organizationId={organizationId}
            branchId={activeBranch.id}
            initialData={initialListData}
            allLocations={rawLocations}
            ambraLocations={branchLocations}
            inventorySnapshot={initialInventorySnapshot}
            variantOptions={variantOptions}
            qrCache={qrCache}
          />
        ) : (
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
                selectedLocationId={selectedLocationId}
                onSelectLocation={setSelectedLocationId}
                onCreateLocation={handleCreateLocation}
                onUpdateLocation={handleUpdateLocation}
                onDeleteLocation={handleDeleteLocation}
                onNavigateToWorkspace={() => undefined}
                canCreateLocation={canCreateLocation}
                qrAssignment={qrAssignment}
                onQrAssigned={(a) => {
                  setQrAssignment(a);
                  if (selectedLocationId)
                    setQrCache((prev) => new Map(prev).set(selectedLocationId, a));
                }}
                onQrUnassigned={() => {
                  setQrAssignment(null);
                  if (selectedLocationId)
                    setQrCache((prev) => new Map(prev).set(selectedLocationId, null));
                }}
              />
            </motion.div>
          </AnimatePresence>
        )}
      </div>
    </div>
  );
}
