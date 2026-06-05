"use client";

import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { LocationFormV2, type LocationFormV2Values } from "./location-form-v2";
import { useUpsertVisualNodeMutation } from "@/hooks/queries/warehouse/location-visual-nodes";
import type {
  LocationV2,
  LocationCategory,
  VisualizationType,
} from "@/lib/types/warehouse/locations-v2";

// Map location_category to a default visualization_type
const CATEGORY_VIZ: Partial<Record<LocationCategory, VisualizationType>> = {
  cabinet: "cabinet",
  rack: "rack",
  shelf_unit: "rack",
  workbench: "rectangle",
  zone: "zone",
  area: "zone",
  receiving: "zone",
  dispatch: "zone",
  bin: "bin",
  drawer: "drawer",
};

// Default initial mm position for newly placed objects
const DEFAULT_PLACE_X = 1000;
const DEFAULT_PLACE_Y = 1000;
const DEFAULT_WIDTH = 1200;
const DEFAULT_DEPTH = 600;

interface AddObjectDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  layoutId: string;
  branchId: string;
  onCreateLocation: (values: LocationFormV2Values) => Promise<LocationV2 | null>;
  /** Called after location + visual node are created */
  onCreated?: (location: LocationV2) => void;
}

export function AddObjectDialog({
  open,
  onOpenChange,
  layoutId,
  branchId,
  onCreateLocation,
  onCreated,
}: AddObjectDialogProps) {
  const [isCreating, setIsCreating] = useState(false);
  const upsertNode = useUpsertVisualNodeMutation(layoutId, branchId);

  async function handleSubmit(values: LocationFormV2Values) {
    setIsCreating(true);
    try {
      // 1. Create the inventory location
      const location = await onCreateLocation(values);
      if (!location) return;

      // 2. Create top-down visual node
      const category = values.location_category as LocationCategory;
      const vizType: VisualizationType = CATEGORY_VIZ[category] ?? "rectangle";

      await upsertNode.mutateAsync({
        layout_id: layoutId,
        location_id: location.id,
        view_type: "top_down",
        visualization_type: vizType,
        x_mm: DEFAULT_PLACE_X,
        y_mm: DEFAULT_PLACE_Y,
        width_mm: values.width_mm ?? DEFAULT_WIDTH,
        height_mm: values.depth_mm ?? DEFAULT_DEPTH, // top-down: height = depth
      });

      onCreated?.(location);
      onOpenChange(false);
    } finally {
      setIsCreating(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Add object to plan</DialogTitle>
          <DialogDescription>
            Create a new storage object and place it on the top-down plan.
          </DialogDescription>
        </DialogHeader>
        <LocationFormV2
          onSubmit={handleSubmit}
          isPending={isCreating || upsertNode.isPending}
          submitLabel="Add to plan"
        />
      </DialogContent>
    </Dialog>
  );
}
