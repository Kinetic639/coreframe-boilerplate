"use client";

import { useState, useMemo } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "react-toastify";
import { ResizableHandle, ResizablePanel, ResizablePanelGroup } from "@/components/ui/resizable";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Plus, MapPin, ChevronDown, Loader2 } from "lucide-react";

import { LocationTreePanel } from "./location-tree-panel";
import { TopDownPlanCanvas } from "./top-down-plan-canvas";
import { LocationObjectPanel } from "./location-object-panel";
import { AddObjectDialog } from "./add-object-dialog";
import { UnmappedLocationsPanel, buildPlacementNode } from "./unmapped-locations-panel";

import { useWarehouseLocationsQuery } from "@/hooks/queries/warehouse";
import {
  useLocationVisualNodesQuery,
  useUnmappedLocationsQuery,
  useUpsertVisualNodeMutation,
} from "@/hooks/queries/warehouse/location-visual-nodes";
import { createLocationV2Action } from "@/app/actions/warehouse/locations";
import { createLayoutAction } from "@/app/actions/warehouse/layouts";
import { warehouseKeys } from "@/hooks/queries/warehouse";

import type { LocationV2, LocationVisualNode } from "@/lib/types/warehouse/locations-v2";
import type { WarehouseLayout } from "@/lib/warehouse/layouts";
import type { LocationFormV2Values } from "./location-form-v2";

// Default canvas dimensions (50m × 30m)
const DEFAULT_CANVAS_W = 50000;
const DEFAULT_CANVAS_H = 30000;

interface LocationsPageShellProps {
  initialLocations: LocationV2[];
  initialLayouts: WarehouseLayout[];
  initialVisualNodes: LocationVisualNode[];
  branchId: string;
  orgId: string;
}

export function LocationsPageShell({
  initialLocations,
  initialLayouts,
  initialVisualNodes,
  branchId,
}: LocationsPageShellProps) {
  const queryClient = useQueryClient();

  const [selectedLayoutId, setSelectedLayoutId] = useState<string | null>(
    initialLayouts[0]?.id ?? null
  );
  const [selectedLocationId, setSelectedLocationId] = useState<string | null>(null);
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const [addDialogOpen, setAddDialogOpen] = useState(false);
  const [unmappedOpen, setUnmappedOpen] = useState(true);
  const [isCreatingLayout, setIsCreatingLayout] = useState(false);
  const [placingId, setPlacingId] = useState<string | null>(null);

  // ── Queries ────────────────────────────────────────────────────────────────
  const { data: locations = initialLocations } = useWarehouseLocationsQuery(
    branchId,
    initialLocations as never
  );

  const { data: visualNodes = initialVisualNodes } = useLocationVisualNodesQuery(
    selectedLayoutId,
    "top_down"
  );

  const { data: unmappedLocations = [], isLoading: isLoadingUnmapped } = useUnmappedLocationsQuery(
    branchId,
    selectedLayoutId ?? undefined
  );

  const upsertNode = useUpsertVisualNodeMutation(selectedLayoutId ?? "", branchId);

  // ── Derived data ───────────────────────────────────────────────────────────
  const currentLayout = initialLayouts.find((l) => l.id === selectedLayoutId);
  const canvasW = (currentLayout as { canvas_width_m?: number })?.canvas_width_m
    ? (currentLayout as { canvas_width_m?: number }).canvas_width_m! * 1000
    : DEFAULT_CANVAS_W;
  const canvasH = (currentLayout as { canvas_height_m?: number })?.canvas_height_m
    ? (currentLayout as { canvas_height_m?: number }).canvas_height_m! * 1000
    : DEFAULT_CANVAS_H;

  // Map locationId → visual node for fast lookup
  const nodeByLocationId = useMemo(
    () => new Map((visualNodes as LocationVisualNode[]).map((n) => [n.location_id, n])),
    [visualNodes]
  );

  // Map nodeId → locationId for selection sync
  const nodeToLocation = useMemo(
    () => new Map((visualNodes as LocationVisualNode[]).map((n) => [n.id, n.location_id])),
    [visualNodes]
  );

  // Location map for labels
  const locationMap = useMemo(
    () => new Map((locations as LocationV2[]).map((l) => [l.id, l])),
    [locations]
  );

  const locationLabels = useMemo(() => {
    const labels: Record<string, string> = {};
    for (const loc of locations as LocationV2[]) {
      labels[loc.id] = loc.code ? `${loc.code} ${loc.name}` : loc.name;
    }
    return labels;
  }, [locations]);

  const selectedLocation = selectedLocationId
    ? (locationMap.get(selectedLocationId) ?? null)
    : null;
  const selectedVisualNode = selectedLocation
    ? (nodeByLocationId.get(selectedLocation.id) ?? null)
    : null;

  // ── Handlers ───────────────────────────────────────────────────────────────
  function handleSelectNode(nodeId: string | null) {
    setSelectedNodeId(nodeId);
    if (nodeId) {
      const locId = nodeToLocation.get(nodeId);
      setSelectedLocationId(locId ?? null);
    } else {
      setSelectedLocationId(null);
    }
  }

  function handleSelectLocation(location: LocationV2) {
    setSelectedLocationId(location.id);
    const node = nodeByLocationId.get(location.id);
    setSelectedNodeId(node?.id ?? null);
  }

  async function handleCreateLocation(values: LocationFormV2Values): Promise<LocationV2 | null> {
    const result = await createLocationV2Action({
      name: values.name,
      code: values.code || undefined,
      can_store_inventory: values.can_store_inventory,
      location_category: values.location_category,
      width_mm: values.width_mm ?? undefined,
      height_mm: values.height_mm ?? undefined,
      depth_mm: values.depth_mm ?? undefined,
    });
    if (!result.success) {
      toast.error((result as { success: false; error: string }).error);
      return null;
    }
    // Invalidate locations cache
    queryClient.invalidateQueries({
      queryKey: warehouseKeys.locationsByBranch(branchId),
    });
    return (result as { success: true; data: unknown }).data as unknown as LocationV2;
  }

  async function handlePlaceUnmapped(location: LocationV2) {
    if (!selectedLayoutId) return;
    setPlacingId(location.id);
    try {
      const input = buildPlacementNode(location, selectedLayoutId, 1000, 1000);
      await upsertNode.mutateAsync(input);
      toast.success(`${location.name} placed on map`);
    } catch {
      toast.error("Failed to place location");
    } finally {
      setPlacingId(null);
    }
  }

  async function handleCreatePlan() {
    setIsCreatingLayout(true);
    try {
      const result = await createLayoutAction({
        name: "Plan",
        canvas_width_m: 50,
        canvas_height_m: 30,
      });
      if (!result.success) {
        toast.error((result as { success: false; error: string }).error);
        return;
      }
      const layout = (result as { success: true; data: unknown }).data as WarehouseLayout;
      queryClient.invalidateQueries({
        queryKey: warehouseKeys.layoutsByBranch(branchId),
      });
      setSelectedLayoutId(layout.id);
      initialLayouts.push(layout);
    } finally {
      setIsCreatingLayout(false);
    }
  }

  // ── No branch ──────────────────────────────────────────────────────────────
  if (!branchId) {
    return (
      <div className="flex h-full items-center justify-center text-muted-foreground">
        <p className="text-sm">Select a branch to view the warehouse plan.</p>
      </div>
    );
  }

  // ── No layout ──────────────────────────────────────────────────────────────
  if (initialLayouts.length === 0) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-4 text-center">
        <MapPin className="h-10 w-10 text-muted-foreground/40" />
        <div>
          <p className="font-medium">No warehouse plan yet</p>
          <p className="text-sm text-muted-foreground mt-1">
            Create a plan to start placing objects.
          </p>
        </div>
        <Button onClick={handleCreatePlan} disabled={isCreatingLayout}>
          {isCreatingLayout ? (
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          ) : (
            <Plus className="mr-2 h-4 w-4" />
          )}
          Create plan
        </Button>
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col overflow-hidden">
      {/* Top bar */}
      <div className="flex items-center gap-3 border-b px-4 py-2 shrink-0">
        <h1 className="text-sm font-semibold">Warehouse Plan</h1>
        {initialLayouts.length > 1 && (
          <Select value={selectedLayoutId ?? ""} onValueChange={setSelectedLayoutId}>
            <SelectTrigger className="h-7 w-44 text-xs">
              <SelectValue placeholder="Select plan" />
            </SelectTrigger>
            <SelectContent>
              {initialLayouts.map((l) => (
                <SelectItem key={l.id} value={l.id}>
                  {l.name}
                  {l.status === "published" && (
                    <Badge variant="secondary" className="ml-2 text-[10px]">
                      published
                    </Badge>
                  )}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
        <div className="flex-1" />
        <span className="text-xs text-muted-foreground">
          {(visualNodes as LocationVisualNode[]).length} objects ·{" "}
          {(unmappedLocations as LocationV2[]).length} unmapped
        </span>
      </div>

      {/* Main 3-panel layout */}
      <ResizablePanelGroup orientation="horizontal" className="flex-1 overflow-hidden">
        {/* Left: location tree */}
        <ResizablePanel defaultSize={20} minSize={15} maxSize={30}>
          <div className="flex h-full flex-col border-r">
            <div className="px-3 py-2 text-xs font-semibold text-muted-foreground uppercase tracking-wide shrink-0">
              Locations
            </div>
            <LocationTreePanel
              locations={locations as LocationV2[]}
              selectedId={selectedLocationId}
              onSelect={handleSelectLocation}
            />

            {/* Unmapped panel */}
            <Collapsible
              open={unmappedOpen}
              onOpenChange={setUnmappedOpen}
              className="border-t shrink-0"
            >
              <CollapsibleTrigger className="flex w-full items-center justify-between px-3 py-2 text-xs font-semibold text-muted-foreground uppercase tracking-wide hover:bg-muted/40">
                Unmapped
                <div className="flex items-center gap-1">
                  {(unmappedLocations as LocationV2[]).length > 0 && (
                    <Badge variant="secondary" className="text-[10px]">
                      {(unmappedLocations as LocationV2[]).length}
                    </Badge>
                  )}
                  <ChevronDown
                    className={`h-3 w-3 transition-transform ${unmappedOpen ? "rotate-180" : ""}`}
                  />
                </div>
              </CollapsibleTrigger>
              <CollapsibleContent>
                <div className="max-h-48">
                  <UnmappedLocationsPanel
                    locations={unmappedLocations as LocationV2[]}
                    isLoading={isLoadingUnmapped}
                    onPlace={handlePlaceUnmapped}
                    placingId={placingId}
                  />
                </div>
              </CollapsibleContent>
            </Collapsible>
          </div>
        </ResizablePanel>

        <ResizableHandle withHandle />

        {/* Center: canvas */}
        <ResizablePanel defaultSize={selectedLocationId ? 55 : 80} minSize={40}>
          <div className="h-full">
            <TopDownPlanCanvas
              layoutId={selectedLayoutId ?? ""}
              branchId={branchId}
              visualNodes={visualNodes as LocationVisualNode[]}
              locationLabels={locationLabels}
              canvasWidthMm={canvasW}
              canvasHeightMm={canvasH}
              selectedNodeId={selectedNodeId}
              onSelectNode={handleSelectNode}
              onAddObject={() => setAddDialogOpen(true)}
            />
          </div>
        </ResizablePanel>

        {/* Right: inspector (only when selection) */}
        {selectedLocation && (
          <>
            <ResizableHandle withHandle />
            <ResizablePanel defaultSize={25} minSize={20} maxSize={35}>
              <div className="flex h-full flex-col border-l">
                <div className="px-3 py-2 text-xs font-semibold text-muted-foreground uppercase tracking-wide border-b shrink-0 flex items-center justify-between">
                  <span>Inspector</span>
                  <button
                    className="text-muted-foreground hover:text-foreground"
                    onClick={() => {
                      setSelectedLocationId(null);
                      setSelectedNodeId(null);
                    }}
                  >
                    ×
                  </button>
                </div>
                <LocationObjectPanel
                  location={selectedLocation}
                  visualNode={selectedVisualNode}
                  layoutId={selectedLayoutId ?? ""}
                  branchId={branchId}
                  onDeselect={() => {
                    setSelectedLocationId(null);
                    setSelectedNodeId(null);
                  }}
                />
              </div>
            </ResizablePanel>
          </>
        )}
      </ResizablePanelGroup>

      {/* Add object dialog */}
      {selectedLayoutId && (
        <AddObjectDialog
          open={addDialogOpen}
          onOpenChange={setAddDialogOpen}
          layoutId={selectedLayoutId}
          branchId={branchId}
          onCreateLocation={handleCreateLocation}
          onCreated={(loc) => {
            setSelectedLocationId(loc.id);
          }}
        />
      )}
    </div>
  );
}
