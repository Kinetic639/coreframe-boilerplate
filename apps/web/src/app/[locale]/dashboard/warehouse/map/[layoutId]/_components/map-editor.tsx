"use client";

import React from "react";
import { toast } from "react-toastify";
import { Save, Globe, EyeOff, ArrowLeft, Loader2, Pencil, Eye } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useRouter } from "@/i18n/navigation";
import { cn } from "@/lib/utils";

import type {
  WarehouseLayoutWithShapes,
  WarehouseLayoutShape,
  ShapeUpsertInput,
  ShapeStyle,
  ShapeType,
} from "@/lib/warehouse/layouts";
import type { WarehouseLocation } from "@/lib/warehouse/location-tree";

import { MapCanvas, locationColorToFill } from "./map-canvas";
import { LocationToolbox } from "./location-toolbox";
import { ShapeInspector, type AlignType } from "./shape-inspector";
import { MapPreview } from "./map-preview";

import {
  useBatchSaveShapesMutation,
  useCreateLocationMutation,
  usePublishLayoutMutation,
  useUnpublishLayoutMutation,
  useUpdateLayoutMutation,
  useUpdateLocationMutation,
  useWarehouseLocationsQuery,
  warehouseKeys,
} from "@/hooks/queries/warehouse";
import { useQueryClient } from "@tanstack/react-query";

// ─── Props ────────────────────────────────────────────────────────────────────

interface MapEditorProps {
  initialLayout: WarehouseLayoutWithShapes;
  locations: WarehouseLocation[];
  branchId: string;
  canManage: boolean;
  canPublish: boolean;
}

// ─── Editor ───────────────────────────────────────────────────────────────────

export function MapEditor({
  initialLayout,
  locations,
  branchId,
  canManage,
  canPublish,
}: MapEditorProps) {
  const router = useRouter();

  // ── Local canvas state ────────────────────────────────────────────────────
  const [layout, setLayout] = React.useState(initialLayout);
  const [shapes, setShapes] = React.useState<WarehouseLayoutShape[]>(initialLayout.shapes);
  const [selectedIds, setSelectedIds] = React.useState<string[]>([]);
  const [showGrid, setShowGrid] = React.useState(true);
  const [snapToGrid, setSnapToGrid] = React.useState(true);
  const [gridIntervalM, setGridIntervalM] = React.useState(1);
  const [isDirty, setIsDirty] = React.useState(false);
  const [mode, setMode] = React.useState<"edit" | "preview">("edit");
  const layoutMetaRequestSeq = React.useRef(0);

  // Persist canvas zoom/pan across preview-mode roundtrips without re-rendering.
  // Starts as null so MapCanvas knows to auto-fit on first mount.
  const canvasViewportRef = React.useRef<{ zoom: number; pan: { x: number; y: number } } | null>(
    null
  );

  // ── Pending location creation (from palette drop or clone) ───────────────
  const [pendingDrop, setPendingDrop] = React.useState<{ xM: number; yM: number } | null>(null);
  const [pendingClone, setPendingClone] = React.useState<{
    shape: WarehouseLayoutShape;
    color: string;
  } | null>(null);
  const [newLocName, setNewLocName] = React.useState("");
  const [newLocCode, setNewLocCode] = React.useState("");
  const [newLocColor, setNewLocColor] = React.useState("#10b981");
  const [newLocCreating, setNewLocCreating] = React.useState(false);
  const [newLocError, setNewLocError] = React.useState("");

  // ── Live locations (reactive — updates when cache is invalidated) ─────────
  const { data: liveLocations = locations } = useWarehouseLocationsQuery(branchId, locations);

  // ── Mutations & cache ─────────────────────────────────────────────────────
  const queryClient = useQueryClient();
  const batchSave = useBatchSaveShapesMutation(layout.id);
  const createLocMut = useCreateLocationMutation(branchId);
  const publishMut = usePublishLayoutMutation(branchId);
  const unpublishMut = useUnpublishLayoutMutation(branchId);
  const updateLayoutMut = useUpdateLayoutMutation(branchId);
  const updateLocMut = useUpdateLocationMutation(branchId);

  // ── Derived ───────────────────────────────────────────────────────────────
  const selectedShapes = React.useMemo(
    () => shapes.filter((s) => selectedIds.includes(s.id)),
    [shapes, selectedIds]
  );
  const selectedShape = selectedShapes.length === 1 ? selectedShapes[0] : null;
  const placedLocationIds = React.useMemo(
    () => new Set(shapes.filter((s) => s.location_id).map((s) => s.location_id!)),
    [shapes]
  );

  // ── Save ──────────────────────────────────────────────────────────────────
  const handleSave = async (shapesToSave: WarehouseLayoutShape[] = shapes) => {
    const input: ShapeUpsertInput[] = shapesToSave.map((s) => ({
      id: s.id,
      shape_type: s.shape_type,
      // Coerce empty string → null defensively (drag-and-drop edge case)
      location_id: s.location_id || null,
      label: s.label,
      x: s.x,
      y: s.y,
      width: s.width,
      height: s.height,
      rotation: s.rotation,
      style: s.style,
      z_index: s.z_index,
      sort_order: s.sort_order,
    }));

    const saved = await batchSave.mutateAsync(input);
    setShapes(saved);
    setIsDirty(false);
    toast.success("Layout saved");
    return saved;
  };

  // ── Shape mutations ───────────────────────────────────────────────────────
  const patchShape = (id: string, patch: Partial<WarehouseLayoutShape>) => {
    setShapes((prev) => prev.map((s) => (s.id === id ? { ...s, ...patch } : s)));
    setIsDirty(true);
  };

  const handleShapeDragEnd = (id: string, x: number, y: number) => {
    patchShape(id, { x, y });
  };

  const handleShapeTransformEnd = (
    id: string,
    x: number,
    y: number,
    width: number,
    height: number,
    rotation: number
  ) => {
    patchShape(id, { x, y, width, height, rotation });
  };

  const handleDeleteShape = (id: string) => {
    setShapes((prev) => prev.filter((s) => s.id !== id));
    setSelectedIds((prev) => prev.filter((sid) => sid !== id));
    setIsDirty(true);
  };

  const handleDeleteShapes = (ids: string[]) => {
    const idSet = new Set(ids);
    setShapes((prev) => prev.filter((s) => !idSet.has(s.id)));
    setSelectedIds((prev) => prev.filter((sid) => !idSet.has(sid)));
    setIsDirty(true);
  };

  // ── Align multiple shapes ─────────────────────────────────────────────────
  const handleAlignShapes = (type: AlignType) => {
    const targets = shapes.filter((s) => selectedIds.includes(s.id));
    if (targets.length < 2) return;

    let patches: { id: string; x?: number; y?: number }[] = [];

    switch (type) {
      case "left": {
        const minX = Math.min(...targets.map((s) => s.x));
        patches = targets.map((s) => ({ id: s.id, x: minX }));
        break;
      }
      case "right": {
        const maxRight = Math.max(...targets.map((s) => s.x + s.width));
        patches = targets.map((s) => ({ id: s.id, x: maxRight - s.width }));
        break;
      }
      case "top": {
        const minY = Math.min(...targets.map((s) => s.y));
        patches = targets.map((s) => ({ id: s.id, y: minY }));
        break;
      }
      case "bottom": {
        const maxBottom = Math.max(...targets.map((s) => s.y + s.height));
        patches = targets.map((s) => ({ id: s.id, y: maxBottom - s.height }));
        break;
      }
      case "center-h": {
        const avgCenterX = targets.reduce((sum, s) => sum + s.x + s.width / 2, 0) / targets.length;
        patches = targets.map((s) => ({ id: s.id, x: avgCenterX - s.width / 2 }));
        break;
      }
      case "center-v": {
        const avgCenterY = targets.reduce((sum, s) => sum + s.y + s.height / 2, 0) / targets.length;
        patches = targets.map((s) => ({ id: s.id, y: avgCenterY - s.height / 2 }));
        break;
      }
      case "distribute-h": {
        const sorted = [...targets].sort((a, b) => a.x - b.x);
        const minX = sorted[0].x;
        const maxRight = Math.max(...sorted.map((s) => s.x + s.width));
        const totalWidth = sorted.reduce((sum, s) => sum + s.width, 0);
        const gap = (maxRight - minX - totalWidth) / (sorted.length - 1);
        let curX = minX;
        patches = sorted.map((s) => {
          const x = curX;
          curX += s.width + gap;
          return { id: s.id, x };
        });
        break;
      }
      case "distribute-v": {
        const sorted = [...targets].sort((a, b) => a.y - b.y);
        const minY = sorted[0].y;
        const maxBottom = Math.max(...sorted.map((s) => s.y + s.height));
        const totalHeight = sorted.reduce((sum, s) => sum + s.height, 0);
        const gap = (maxBottom - minY - totalHeight) / (sorted.length - 1);
        let curY = minY;
        patches = sorted.map((s) => {
          const y = curY;
          curY += s.height + gap;
          return { id: s.id, y };
        });
        break;
      }
    }

    setShapes((prev) =>
      prev.map((s) => {
        const patch = patches.find((p) => p.id === s.id);
        return patch ? { ...s, ...patch } : s;
      })
    );
    setIsDirty(true);
  };

  // ── Add a shape (with a resolved locationId) ─────────────────────────────
  const addShape = (type: ShapeType, xM: number, yM: number, locationId: string | null) => {
    const loc = locationId ? liveLocations.find((l) => l.id === locationId) : null;
    const label = loc?.code ?? null;
    // Persist location color into shape.style so the viewer always has the right color
    const locColor = loc?.color ?? null;
    const newShape: WarehouseLayoutShape = {
      id: crypto.randomUUID(),
      layout_id: layout.id,
      organization_id: layout.organization_id,
      branch_id: layout.branch_id,
      shape_type: type,
      location_id: locationId,
      label,
      x: Math.max(0, xM),
      y: Math.max(0, yM),
      width: type === "wall" ? 5 : type === "label" ? 3 : 2,
      height: type === "wall" ? 0.3 : type === "label" ? 0.8 : 2,
      rotation: 0,
      style: locColor ? { fill: locationColorToFill(locColor), stroke: locColor } : null,
      z_index: type === "zone" || type === "aisle" ? -1 : 0,
      sort_order: shapes.length,
      created_by: null,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      deleted_at: null,
    };
    setShapes((prev) => [...prev, newShape]);
    setSelectedIds([newShape.id]);
    setIsDirty(true);
  };

  // ── Drop from toolbox ─────────────────────────────────────────────────────
  const handleDropFromCanvas = (
    type: ShapeType,
    xM: number,
    yM: number,
    locationId: string | null
  ) => {
    if (type === "location" && !locationId) {
      // Open the dialog so the user can provide name + code before the
      // location is created. The drop coordinates are stored in pendingDrop.
      setPendingDrop({ xM, yM });
      setNewLocName("");
      setNewLocCode("");
      setNewLocColor("#10b981");
      setNewLocError("");
      return;
    }
    addShape(type, xM, yM, locationId);
  };

  // ── Create new location (dialog submit — handles both drop and clone) ──────
  const handleCreateNewLocation = async () => {
    const name = newLocName.trim();
    const code = newLocCode.trim();
    if (!name) {
      setNewLocError("Name is required.");
      return;
    }
    if (!code) {
      setNewLocError("Code is required.");
      return;
    }
    if (!/^[A-Za-z0-9_-]+$/.test(code)) {
      setNewLocError("Code may only contain letters, numbers, hyphens and underscores.");
      return;
    }
    setNewLocError("");
    setNewLocCreating(true);
    try {
      const createdLocation = await createLocMut.mutateAsync({
        name,
        code,
        parent_id: layout.root_location_id ?? null,
        color: newLocColor,
      });
      const newLocationId = createdLocation.id;

      // Determine position + dimensions:
      // - Clone: same size as source, placed immediately to its right with a small gap
      // - Drop: default 2×2 at the drop point
      let xM: number, yM: number, width: number, height: number;
      const clonedLabelStyle: ShapeStyle = {};
      if (pendingClone) {
        const src = pendingClone.shape;
        const srcStyle = src.style;
        width = src.width;
        height = src.height;
        xM = Math.min(src.x + src.width + 0.2, Math.max(0, layout.canvas_width_m - width));
        yM = src.y;
        // Copy label style from source shape
        if (srcStyle?.labelColor !== undefined) clonedLabelStyle.labelColor = srcStyle.labelColor;
        if (srcStyle?.labelSize !== undefined) clonedLabelStyle.labelSize = srcStyle.labelSize;
        if (srcStyle?.labelAlignH !== undefined)
          clonedLabelStyle.labelAlignH = srcStyle.labelAlignH;
        if (srcStyle?.labelAlignV !== undefined)
          clonedLabelStyle.labelAlignV = srcStyle.labelAlignV;
        setPendingClone(null);
      } else {
        xM = pendingDrop!.xM;
        yM = pendingDrop!.yM;
        width = 2;
        height = 2;
        setPendingDrop(null);
      }

      const newShape: WarehouseLayoutShape = {
        id: crypto.randomUUID(),
        layout_id: layout.id,
        organization_id: layout.organization_id,
        branch_id: layout.branch_id,
        shape_type: "location",
        location_id: newLocationId,
        label: code,
        x: Math.max(0, xM),
        y: Math.max(0, yM),
        width,
        height,
        rotation: 0,
        style: { fill: locationColorToFill(newLocColor), stroke: newLocColor, ...clonedLabelStyle },
        z_index: 0,
        sort_order: shapes.length,
        created_by: null,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        deleted_at: null,
      };
      setShapes((prev) => [...prev, newShape]);
      setSelectedIds([newShape.id]);
      setIsDirty(true);
      queryClient.invalidateQueries({ queryKey: warehouseKeys.locationsByBranch(branchId) });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to create location.";
      setNewLocError(message);
      return;
    } finally {
      setNewLocCreating(false);
    }
  };

  // ── Clone a location shape ────────────────────────────────────────────────
  const handleCloneShape = (shapeId: string) => {
    const shape = shapes.find((s) => s.id === shapeId);
    if (!shape || shape.shape_type !== "location" || !shape.location_id) return;
    const loc = liveLocations.find((l) => l.id === shape.location_id);
    if (!loc) return;
    const color = loc.color ?? "#10b981";
    setPendingClone({ shape, color });
    setNewLocName(loc.name);
    setNewLocCode(loc.code ?? "");
    setNewLocColor(color);
    setNewLocError("");
  };

  // ── Update warehouse_location name / code / color from inspector ─────────
  const handleUpdateLocation = (
    locationId: string,
    patch: { name?: string; code?: string | null; color?: string | null }
  ) => {
    updateLocMut.mutate(
      { id: locationId, ...patch },
      {
        onSuccess: () => {
          const target = shapes.find((s) => s.location_id === locationId);
          if (!target) return;
          const shapePatch: Partial<WarehouseLayoutShape> = {};
          // Sync label with new code
          if (patch.code !== undefined) shapePatch.label = patch.code || null;
          // Sync shape.style so the viewer always has the right persisted color
          if (patch.color !== undefined) {
            const c = patch.color ?? "#10b981";
            shapePatch.style = {
              ...((target.style as object | null) ?? {}),
              fill: locationColorToFill(c),
              stroke: c,
            };
          }
          if (Object.keys(shapePatch).length) patchShape(target.id, shapePatch);
        },
      }
    );
  };

  // ── Layout meta changes ───────────────────────────────────────────────────
  const handleLayoutMetaChange = (
    patch: Partial<{ canvas_width_m: number; canvas_height_m: number }>
  ) => {
    const previous = {
      canvas_width_m: layout.canvas_width_m,
      canvas_height_m: layout.canvas_height_m,
    };
    const requestId = ++layoutMetaRequestSeq.current;
    setLayout((prev) => ({ ...prev, ...patch }));
    updateLayoutMut.mutate(
      { id: layout.id, ...patch },
      {
        onError: () => {
          if (layoutMetaRequestSeq.current !== requestId) return;
          setLayout((prev) => ({ ...prev, ...previous }));
        },
      }
    );
  };

  // ── Publish / Unpublish ───────────────────────────────────────────────────
  const handlePublish = async () => {
    if (isDirty) {
      toast.info("Saving before publishing…");
      try {
        await handleSave();
      } catch {
        return;
      }
    }

    publishMut.mutate(layout.id, {
      onSuccess: (updated) => setLayout((prev) => ({ ...prev, ...updated })),
    });
  };

  const handleUnpublish = () => {
    unpublishMut.mutate(layout.id, {
      onSuccess: (updated) => setLayout((prev) => ({ ...prev, ...updated })),
    });
  };

  const isSaving = batchSave.isPending;
  const isPublishing = publishMut.isPending || unpublishMut.isPending;

  return (
    <div className="flex flex-col h-full w-full overflow-hidden bg-muted/30">
      {/* ── Top bar ──────────────────────────────────────────────────────── */}
      <header className="h-12 shrink-0 border-b bg-background flex items-center gap-3 px-4">
        <Button
          variant="ghost"
          size="sm"
          className="h-8 gap-1.5 text-muted-foreground"
          onClick={() => router.push("/dashboard/warehouse/locations" as any)}
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          <span className="text-xs">Locations</span>
        </Button>

        <div className="w-px h-5 bg-border" />

        <h1 className="text-sm font-semibold truncate max-w-xs">{layout.name}</h1>

        <Badge
          variant={layout.status === "published" ? "default" : "secondary"}
          className={
            layout.status === "published"
              ? "bg-emerald-100 text-emerald-700 border-emerald-200 text-[10px]"
              : "text-[10px]"
          }
        >
          {layout.status}
        </Badge>

        {isDirty && <span className="text-[10px] text-amber-600 font-medium">Unsaved changes</span>}

        <div className="ml-auto flex items-center gap-2">
          {/* Edit / Preview toggle */}
          <div className="flex items-center rounded-md border overflow-hidden">
            <button
              type="button"
              onClick={() => setMode("edit")}
              className={cn(
                "flex items-center gap-1.5 px-2.5 py-1 text-xs transition-colors",
                mode === "edit"
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:bg-muted"
              )}
            >
              <Pencil className="w-3 h-3" />
              Edit
            </button>
            <button
              type="button"
              onClick={() => setMode("preview")}
              className={cn(
                "flex items-center gap-1.5 px-2.5 py-1 text-xs transition-colors",
                mode === "preview"
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:bg-muted"
              )}
            >
              <Eye className="w-3 h-3" />
              Preview
            </button>
          </div>

          <div className="w-px h-5 bg-border" />
          {canManage && (
            <Button
              size="sm"
              variant="outline"
              className="h-8 gap-1.5 text-xs"
              onClick={() => {
                void handleSave();
              }}
              disabled={isSaving || !isDirty}
            >
              {isSaving ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <Save className="w-3.5 h-3.5" />
              )}
              {isSaving ? "Saving…" : "Save"}
            </Button>
          )}

          {canPublish && layout.status === "draft" && (
            <Button
              size="sm"
              className="h-8 gap-1.5 text-xs bg-emerald-600 hover:bg-emerald-700"
              onClick={() => {
                void handlePublish();
              }}
              disabled={isPublishing}
            >
              {isPublishing ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <Globe className="w-3.5 h-3.5" />
              )}
              Publish
            </Button>
          )}

          {canPublish && layout.status === "published" && (
            <Button
              size="sm"
              variant="outline"
              className="h-8 gap-1.5 text-xs"
              onClick={handleUnpublish}
              disabled={isPublishing}
            >
              <EyeOff className="w-3.5 h-3.5" />
              Unpublish
            </Button>
          )}
        </div>
        {/* end ml-auto */}
      </header>

      {/* ── Main layout ──────────────────────────────────────────────────── */}
      <div className="flex flex-1 overflow-hidden">
        {mode === "preview" ? (
          <MapPreview
            layout={{ ...layout, shapes }}
            locations={liveLocations}
            rootLocationId={layout.root_location_id ?? null}
          />
        ) : (
          <>
            {canManage && (
              <LocationToolbox
                locations={liveLocations}
                rootLocationId={layout.root_location_id ?? null}
                branchId={branchId}
                placedLocationIds={placedLocationIds}
                selectedId={selectedIds[0] ?? null}
                onSelectLocation={(locId) => {
                  const existing = shapes.find((s) => s.location_id === locId);
                  if (existing) setSelectedIds([existing.id]);
                }}
              />
            )}

            <MapCanvas
              shapes={shapes}
              locations={liveLocations}
              canvasWidthM={layout.canvas_width_m}
              canvasHeightM={layout.canvas_height_m}
              selectedIds={selectedIds}
              onSelectionChange={setSelectedIds}
              onShapeDragEnd={handleShapeDragEnd}
              onShapeTransformEnd={handleShapeTransformEnd}
              onDropNewShape={handleDropFromCanvas}
              showGrid={showGrid}
              snapToGrid={snapToGrid}
              gridIntervalM={gridIntervalM}
              canManage={canManage}
              initialZoom={canvasViewportRef.current?.zoom}
              initialPan={canvasViewportRef.current?.pan}
              onViewportChange={(zoom, pan) => {
                canvasViewportRef.current = { zoom, pan };
              }}
            />

            <ShapeInspector
              selectedShapes={selectedShapes}
              layout={layout}
              locations={liveLocations}
              showGrid={showGrid}
              snapToGrid={snapToGrid}
              gridIntervalM={gridIntervalM}
              onToggleGrid={() => setShowGrid((v) => !v)}
              onToggleSnap={() => setSnapToGrid((v) => !v)}
              onGridIntervalChange={setGridIntervalM}
              onShapeGeometryChange={(id, patch) =>
                patchShape(id, patch as Partial<WarehouseLayoutShape>)
              }
              onUpdateLocation={handleUpdateLocation}
              onDeleteShape={handleDeleteShape}
              onDeleteShapes={handleDeleteShapes}
              onCloneShape={handleCloneShape}
              onAlignShapes={handleAlignShapes}
              onLayoutMetaChange={handleLayoutMetaChange}
            />
          </>
        )}
      </div>

      {/* ── New / Clone location dialog ────────────────────────────────────── */}
      <Dialog
        open={!!pendingDrop || !!pendingClone}
        onOpenChange={(open) => {
          if (!open) {
            setPendingDrop(null);
            setPendingClone(null);
          }
        }}
      >
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>{pendingClone ? "Clone Location" : "New Storage Location"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label htmlFor="nloc-name">
                Name <span className="text-destructive">*</span>
              </Label>
              <Input
                id="nloc-name"
                value={newLocName}
                onChange={(e) => setNewLocName(e.target.value)}
                placeholder="e.g. Shelf A"
                autoFocus
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="nloc-code">
                Code <span className="text-destructive">*</span>
              </Label>
              <Input
                id="nloc-code"
                value={newLocCode}
                onChange={(e) => setNewLocCode(e.target.value.toUpperCase())}
                placeholder="e.g. A-01"
                className="font-mono"
              />
              <p className="text-[11px] text-muted-foreground">
                Letters, numbers, hyphens, underscores — max 20 chars
              </p>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="nloc-color">Color</Label>
              <div className="flex items-center gap-2">
                <input
                  id="nloc-color"
                  type="color"
                  value={newLocColor}
                  onChange={(e) => setNewLocColor(e.target.value)}
                  className="w-8 h-8 rounded border cursor-pointer p-0.5"
                />
                <span className="text-xs font-mono text-muted-foreground">{newLocColor}</span>
              </div>
            </div>
            {newLocError && <p className="text-xs text-destructive">{newLocError}</p>}
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setPendingDrop(null);
                setPendingClone(null);
              }}
              disabled={newLocCreating}
            >
              Cancel
            </Button>
            <Button onClick={handleCreateNewLocation} disabled={newLocCreating}>
              {newLocCreating ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" /> Creating…
                </>
              ) : pendingClone ? (
                "Clone"
              ) : (
                "Create"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
