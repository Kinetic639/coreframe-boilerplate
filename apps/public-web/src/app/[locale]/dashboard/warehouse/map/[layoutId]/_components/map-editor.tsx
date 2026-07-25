"use client";

import React from "react";
import { useTranslations } from "next-intl";
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
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { useRouter } from "@/i18n/navigation";
import { cn } from "@/lib/utils";

import type {
  WarehouseLayoutWithShapes,
  WarehouseLayoutShape,
  ShapeUpsertInput,
  ShapeStyle,
  ShapeType,
} from "@/lib/warehouse/layouts";
import {
  getEffectiveLocationColor,
  type WarehouseLocation,
  type WarehouseLocationGroup,
} from "@/lib/warehouse/location-tree";

import { MapCanvas, locationColorToFill } from "./map-canvas";
import { LocationToolbox } from "./location-toolbox";
import { ShapeInspector, type AlignType } from "./shape-inspector";
import { MapPreview } from "./map-preview";
import { WarehouseFrontElevationPanel } from "@/components/v2/warehouse/warehouse-front-elevation-panel";
import { isEligibleTopDownUnit } from "@/lib/warehouse/map-context";

import {
  useBatchSaveShapesMutation,
  useCreateLocationMutation,
  useDeleteLocationMutation,
  useDeleteLocationGroupMutation,
  usePublishLayoutMutation,
  useUnpublishLayoutMutation,
  useUpdateLayoutMutation,
  useUpdateLocationGroupMutation,
  useUpdateLocationMutation,
  useWarehouseLocationGroupsQuery,
  useWarehouseLocationsQuery,
  warehouseKeys,
} from "@/hooks/queries/warehouse";
import { useQueryClient } from "@tanstack/react-query";

// ─── Props ────────────────────────────────────────────────────────────────────

interface MapEditorProps {
  initialLayout: WarehouseLayoutWithShapes;
  locations: WarehouseLocation[];
  locationGroups: WarehouseLocationGroup[];
  branchId: string;
  canManage: boolean;
  canPublish: boolean;
}

// ─── Editor ───────────────────────────────────────────────────────────────────

export function MapEditor({
  initialLayout,
  locations,
  locationGroups: initialLocationGroups,
  branchId,
  canManage,
  canPublish,
}: MapEditorProps) {
  const t = useTranslations("warehouseMapEditor");
  const toolboxT = useTranslations("warehouseMapToolbox");
  const router = useRouter();

  // ── Local canvas state ────────────────────────────────────────────────────
  const [layout, setLayout] = React.useState(initialLayout);
  const [shapes, setShapes] = React.useState<WarehouseLayoutShape[]>(initialLayout.shapes);
  const [selectedIds, setSelectedIds] = React.useState<string[]>([]);
  const [selectedGroupId, setSelectedGroupId] = React.useState<string | null>(null);
  const [selectedContainerLocationId, setSelectedContainerLocationId] = React.useState<
    string | null
  >(null);
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
  const [pendingDeleteGroupId, setPendingDeleteGroupId] = React.useState<string | null>(null);

  // ── Live locations (reactive — updates when cache is invalidated) ─────────
  const { data: liveLocations = locations } = useWarehouseLocationsQuery(branchId, locations);
  const { data: locationGroups = initialLocationGroups } = useWarehouseLocationGroupsQuery(
    branchId,
    initialLocationGroups
  );

  // ── Mutations & cache ─────────────────────────────────────────────────────
  const queryClient = useQueryClient();
  const batchSave = useBatchSaveShapesMutation(layout.id);
  const createLocMut = useCreateLocationMutation(branchId);
  const deleteLocMut = useDeleteLocationMutation(branchId);
  const publishMut = usePublishLayoutMutation(branchId);
  const unpublishMut = useUnpublishLayoutMutation(branchId);
  const updateLayoutMut = useUpdateLayoutMutation(branchId);
  const updateLocMut = useUpdateLocationMutation(branchId);
  const updateGroupMut = useUpdateLocationGroupMutation(branchId);
  const deleteGroupMut = useDeleteLocationGroupMutation(branchId);

  // ── Auto-remove shapes for deleted locations ──────────────────────────────
  // When a location is soft-deleted (from the locations page or the toolbox),
  // liveLocations updates and drops that location. Any canvas shape that still
  // references it would block future saves (DB rejects deleted location_ids).
  // Remove those shapes immediately so the canvas stays in sync.
  React.useEffect(() => {
    const validIds = new Set(liveLocations.map((l) => l.id));
    setShapes((prev) => {
      const toRemove = new Set(
        prev.filter((s) => s.location_id && !validIds.has(s.location_id)).map((s) => s.id)
      );
      if (toRemove.size === 0) return prev;
      setSelectedIds((sel) => sel.filter((id) => !toRemove.has(id)));
      setIsDirty(true);
      return prev.filter((s) => !toRemove.has(s.id));
    });
  }, [liveLocations]);

  React.useEffect(() => {
    if (selectedGroupId && !locationGroups.some((group) => group.id === selectedGroupId)) {
      setSelectedGroupId(null);
    }
  }, [locationGroups, selectedGroupId]);

  React.useEffect(() => {
    if (
      selectedContainerLocationId &&
      !liveLocations.some((location) => location.id === selectedContainerLocationId)
    ) {
      setSelectedContainerLocationId(null);
    }
  }, [liveLocations, selectedContainerLocationId]);

  React.useEffect(() => {
    const liveLocationMap = new Map(liveLocations.map((location) => [location.id, location]));

    setShapes((prev) => {
      let changed = false;

      const next = prev.map((shape) => {
        if (
          shape.shape_type !== "location" ||
          !shape.location_id ||
          (shape.projection ?? "top_down") !== "top_down"
        ) {
          return shape;
        }

        const location = liveLocationMap.get(shape.location_id);
        if (!location) return shape;

        const nextWidth = location.physical_width_m ?? shape.width;
        const nextHeight = location.physical_depth_m ?? shape.height;
        const nextLabel = location.code ?? shape.label ?? null;

        if (nextWidth === shape.width && nextHeight === shape.height && nextLabel === shape.label) {
          return shape;
        }

        changed = true;
        return {
          ...shape,
          width: nextWidth,
          height: nextHeight,
          label: nextLabel,
        };
      });

      return changed ? next : prev;
    });
  }, [liveLocations]);

  // ── Derived ───────────────────────────────────────────────────────────────
  const selectedShapes = React.useMemo(
    () => shapes.filter((s) => selectedIds.includes(s.id)),
    [shapes, selectedIds]
  );
  const topDownShapes = React.useMemo(
    () => shapes.filter((shape) => (shape.projection ?? "top_down") !== "front_elevation"),
    [shapes]
  );
  const selectedShape = selectedShapes.length === 1 ? selectedShapes[0] : null;
  const selectedGroup = React.useMemo(
    () => locationGroups.find((group) => group.id === selectedGroupId) ?? null,
    [locationGroups, selectedGroupId]
  );
  const selectedContainerLocation = React.useMemo(
    () =>
      liveLocations.find(
        (location) =>
          location.id === selectedContainerLocationId &&
          (location.map_role ?? "logical") === "logical"
      ) ?? null,
    [liveLocations, selectedContainerLocationId]
  );
  const placedLocationIds = React.useMemo(
    () =>
      new Set(
        topDownShapes.filter((shape) => shape.location_id).map((shape) => shape.location_id!)
      ),
    [topDownShapes]
  );
  const selectedFrontAnchorLocationId = React.useMemo(() => {
    if (!selectedShape?.location_id) return null;
    return isEligibleTopDownUnit(selectedShape.location_id, liveLocations, layout.root_location_id)
      ? selectedShape.location_id
      : null;
  }, [layout.root_location_id, liveLocations, selectedShape?.location_id]);

  // ── Group highlight: shapes in the same group as the selected shape ────────
  const groupHighlightShapeIds = React.useMemo<Set<string>>(() => {
    if (!selectedShape?.location_id) return new Set();
    const selectedLoc = liveLocations.find((l) => l.id === selectedShape.location_id);
    if (!selectedLoc?.group_id) return new Set();
    const groupId = selectedLoc.group_id;
    const groupLocIds = new Set(
      liveLocations
        .filter((l) => l.group_id === groupId && l.id !== selectedLoc.id)
        .map((l) => l.id)
    );
    return new Set(
      topDownShapes
        .filter((s) => s.location_id && groupLocIds.has(s.location_id) && s.id !== selectedShape.id)
        .map((s) => s.id)
    );
  }, [selectedShape, liveLocations, topDownShapes]);

  // ── Save ──────────────────────────────────────────────────────────────────
  const handleSave = async (shapesToSave: WarehouseLayoutShape[] = shapes) => {
    // Defensive: strip location_id from shapes referencing soft-deleted locations.
    // A location can be deleted (via the locations page or toolbox) after shapes
    // were placed. The batch-save DB function rejects any location_id whose row
    // has deleted_at IS NOT NULL, so we null it out here before sending.
    const validLocationIds = new Set(liveLocations.map((l) => l.id));

    const input: ShapeUpsertInput[] = shapesToSave.map((s) => ({
      id: s.id,
      shape_type: s.shape_type,
      // Coerce empty string → null defensively (drag-and-drop edge case).
      // Also null out references to locations that have since been deleted.
      location_id: s.location_id && validLocationIds.has(s.location_id) ? s.location_id : null,
      projection: s.projection ?? "top_down",
      anchor_location_id: s.anchor_location_id ?? null,
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
    toast.success(t("feedback.layoutSaved"));
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

  const handleShapesDragEnd = (positions: { id: string; x: number; y: number }[]) => {
    const positionMap = new Map(positions.map((position) => [position.id, position]));
    setShapes((prev) =>
      prev.map((shape) => {
        const next = positionMap.get(shape.id);
        return next ? { ...shape, x: next.x, y: next.y } : shape;
      })
    );
    setIsDirty(true);
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

    const transformedShape = shapes.find((shape) => shape.id === id);
    if (
      transformedShape?.shape_type === "location" &&
      transformedShape.location_id &&
      (transformedShape.projection ?? "top_down") === "top_down"
    ) {
      updateLocMut.mutate({
        id: transformedShape.location_id,
        physical_width_m: width,
        physical_depth_m: height,
      });
    }
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

  const getRotatedBounds = (
    shape: Pick<WarehouseLayoutShape, "x" | "y" | "width" | "height" | "rotation">
  ) => {
    const angle = ((shape.rotation ?? 0) * Math.PI) / 180;
    const cos = Math.cos(angle);
    const sin = Math.sin(angle);
    const corners = [
      { x: 0, y: 0 },
      { x: shape.width, y: 0 },
      { x: 0, y: shape.height },
      { x: shape.width, y: shape.height },
    ].map((corner) => ({
      x: shape.x + corner.x * cos - corner.y * sin,
      y: shape.y + corner.x * sin + corner.y * cos,
    }));

    const minX = Math.min(...corners.map((corner) => corner.x));
    const maxX = Math.max(...corners.map((corner) => corner.x));
    const minY = Math.min(...corners.map((corner) => corner.y));
    const maxY = Math.max(...corners.map((corner) => corner.y));

    return {
      minX,
      maxX,
      minY,
      maxY,
      offsetMinX: minX - shape.x,
      offsetMaxX: maxX - shape.x,
      offsetMinY: minY - shape.y,
      offsetMaxY: maxY - shape.y,
    };
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
      case "stitch-h": {
        const sorted = [...targets]
          .map((shape) => ({ shape, bounds: getRotatedBounds(shape) }))
          .sort((a, b) => a.bounds.minX - b.bounds.minX || a.shape.sort_order - b.shape.sort_order);
        let curRight = sorted[0].bounds.maxX;
        patches = sorted.map((s, index) => {
          if (index === 0) {
            return { id: s.shape.id, x: s.shape.x };
          }
          const x = curRight - s.bounds.offsetMinX;
          curRight = x + s.bounds.offsetMaxX;
          return { id: s.shape.id, x };
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
      case "stitch-v": {
        const sorted = [...targets]
          .map((shape) => ({ shape, bounds: getRotatedBounds(shape) }))
          .sort((a, b) => a.bounds.minY - b.bounds.minY || a.shape.sort_order - b.shape.sort_order);
        let curBottom = sorted[0].bounds.maxY;
        patches = sorted.map((s, index) => {
          if (index === 0) {
            return { id: s.shape.id, y: s.shape.y };
          }
          const y = curBottom - s.bounds.offsetMinY;
          curBottom = y + s.bounds.offsetMaxY;
          return { id: s.shape.id, y };
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
    const locColor = loc ? getEffectiveLocationColor(loc, locationGroups) : null;
    const width =
      type === "location"
        ? Math.max(0.1, loc?.physical_width_m ?? 2)
        : type === "wall"
          ? 5
          : type === "label"
            ? 3
            : 2;
    const height =
      type === "location"
        ? Math.max(0.1, loc?.physical_depth_m ?? 2)
        : type === "wall"
          ? 0.3
          : type === "label"
            ? 0.8
            : 2;
    const newShape: WarehouseLayoutShape = {
      id: crypto.randomUUID(),
      layout_id: layout.id,
      organization_id: layout.organization_id,
      branch_id: layout.branch_id,
      shape_type: type,
      projection: "top_down",
      anchor_location_id: layout.root_location_id ?? null,
      location_id: locationId,
      label,
      x: Math.max(0, xM),
      y: Math.max(0, yM),
      width,
      height,
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
      setNewLocError(t("dialogs.location.validation.nameRequired"));
      return;
    }
    if (!code) {
      setNewLocError(t("dialogs.location.validation.codeRequired"));
      return;
    }
    if (!/^[A-Za-z0-9_/-]+$/.test(code)) {
      setNewLocError(t("dialogs.location.validation.codeInvalid"));
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
        physical_width_m: pendingClone?.shape.width ?? undefined,
        physical_depth_m: pendingClone?.shape.height ?? undefined,
      });
      const newLocationId = createdLocation.id;

      // Determine position + dimensions:
      // - Clone: same size as source, placed immediately to its right with a small gap
      // - Drop: default 2×2 at the drop point
      let xM: number, yM: number, width: number, height: number, rotation: number;
      const clonedLabelStyle: ShapeStyle = {};
      if (pendingClone) {
        const src = pendingClone.shape;
        const srcStyle = src.style;
        width = src.width;
        height = src.height;
        rotation = src.rotation;
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
        width = Math.max(0.1, createdLocation.physical_width_m ?? 2);
        height = Math.max(0.1, createdLocation.physical_depth_m ?? 2);
        rotation = 0;
        setPendingDrop(null);
      }

      const newShape: WarehouseLayoutShape = {
        id: crypto.randomUUID(),
        layout_id: layout.id,
        organization_id: layout.organization_id,
        branch_id: layout.branch_id,
        shape_type: "location",
        projection: "top_down",
        anchor_location_id: layout.root_location_id ?? null,
        location_id: newLocationId,
        label: code,
        x: Math.max(0, xM),
        y: Math.max(0, yM),
        width,
        height,
        rotation,
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
      const message =
        error instanceof Error ? error.message : t("dialogs.location.validation.createFailed");
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
    const color = getEffectiveLocationColor(loc, locationGroups) ?? "#10b981";
    setPendingClone({ shape, color });
    setNewLocName(loc.name);
    setNewLocCode(loc.code ?? "");
    setNewLocColor(color);
    setNewLocError("");
  };

  // ── Update warehouse_location name / code / color from inspector ─────────
  const handleUpdateLocation = (
    locationId: string,
    patch: {
      name?: string;
      code?: string | null;
      color?: string | null;
      group_id?: string | null;
      inherit_group_color?: boolean;
      elevation_level?: number;
    }
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
          if (
            patch.color !== undefined ||
            patch.group_id !== undefined ||
            patch.inherit_group_color !== undefined
          ) {
            const latestLocations =
              queryClient.getQueryData<WarehouseLocation[]>(
                warehouseKeys.locationsByBranch(branchId)
              ) ?? liveLocations;
            const updatedLocation = latestLocations.find((location) => location.id === locationId);
            const nextLocation = {
              ...updatedLocation,
              ...patch,
            } as WarehouseLocation | undefined;
            const c = nextLocation
              ? (getEffectiveLocationColor(nextLocation, locationGroups) ?? "#10b981")
              : (patch.color ?? "#10b981");
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

  const handleUpdateLocationGroup = (locationId: string, groupId: string | null) => {
    updateLocMut.mutate({ id: locationId, group_id: groupId });
  };

  const handleUpdateLocationDimensions = (
    locationId: string,
    patch: { physical_width_m?: number; physical_depth_m?: number }
  ) => {
    updateLocMut.mutate({ id: locationId, ...patch });

    const targetShape = shapes.find(
      (shape) =>
        shape.shape_type === "location" &&
        shape.location_id === locationId &&
        (shape.projection ?? "top_down") === "top_down"
    );

    if (!targetShape) return;

    patchShape(targetShape.id, {
      ...(patch.physical_width_m !== undefined ? { width: patch.physical_width_m } : {}),
      ...(patch.physical_depth_m !== undefined ? { height: patch.physical_depth_m } : {}),
    });
  };

  const handleUpdateGroup = (
    groupId: string,
    patch: { name?: string; color?: string | null; description?: string | null }
  ) => {
    updateGroupMut.mutate({ id: groupId, ...patch });
  };

  const handleSelectGroup = (groupId: string) => {
    setSelectedIds([]);
    setSelectedGroupId(groupId);
    setSelectedContainerLocationId(null);
  };

  const handleSelectContainerLocation = (locationId: string) => {
    setSelectedIds([]);
    setSelectedGroupId(null);
    setSelectedContainerLocationId(locationId);
  };

  const handleSelectGroupMembers = (groupId: string) => {
    const memberLocationIds = new Set(
      liveLocations
        .filter((location) => location.group_id === groupId)
        .map((location) => location.id)
    );
    const memberShapeIds = shapes
      .filter((shape) => shape.location_id && memberLocationIds.has(shape.location_id))
      .map((shape) => shape.id);
    setSelectedGroupId(null);
    setSelectedContainerLocationId(null);
    setSelectedIds(memberShapeIds);
  };

  const handleSelectContainerMembers = (locationId: string) => {
    const descendantIds = new Set<string>();
    const stack = liveLocations.filter((location) => location.parent_id === locationId);

    while (stack.length > 0) {
      const current = stack.pop()!;
      descendantIds.add(current.id);
      liveLocations
        .filter((location) => location.parent_id === current.id)
        .forEach((child) => stack.push(child));
    }

    const descendantShapeIds = shapes
      .filter((shape) => shape.location_id && descendantIds.has(shape.location_id))
      .map((shape) => shape.id);

    setSelectedContainerLocationId(null);
    setSelectedGroupId(null);
    setSelectedIds(descendantShapeIds);
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
      toast.info(t("feedback.savingBeforePublishing"));
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
          <span className="text-xs">{t("actions.backToLocations")}</span>
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
          {layout.status === "published" ? t("status.published") : t("status.draft")}
        </Badge>

        {isDirty && (
          <span className="text-[10px] text-amber-600 font-medium">
            {t("status.unsavedChanges")}
          </span>
        )}

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
              {t("actions.edit")}
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
              {t("actions.preview")}
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
              {isSaving ? t("actions.saving") : t("actions.save")}
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
              {t("actions.publish")}
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
              {t("actions.unpublish")}
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
            locationGroups={locationGroups}
            rootLocationId={layout.root_location_id ?? null}
          />
        ) : (
          <>
            {canManage && (
              <LocationToolbox
                locations={liveLocations}
                locationGroups={locationGroups}
                rootLocationId={layout.root_location_id ?? null}
                branchId={branchId}
                placedLocationIds={placedLocationIds}
                selectedId={selectedIds[0] ?? null}
                selectedGroupId={selectedGroupId}
                selectedContainerLocationId={selectedContainerLocationId}
                onSelectLocation={(locId) => {
                  const existing = shapes.find((s) => s.location_id === locId);
                  if (existing) {
                    setSelectedGroupId(null);
                    setSelectedContainerLocationId(null);
                    setSelectedIds([existing.id]);
                  }
                }}
                onSelectGroup={handleSelectGroup}
                onSelectContainerLocation={handleSelectContainerLocation}
              />
            )}

            <div className="flex min-w-0 flex-1 flex-col overflow-hidden">
              <MapCanvas
                shapes={topDownShapes}
                locations={liveLocations}
                locationGroups={locationGroups}
                canvasWidthM={layout.canvas_width_m}
                canvasHeightM={layout.canvas_height_m}
                selectedIds={selectedIds}
                onSelectionChange={(ids) => {
                  setSelectedGroupId(null);
                  setSelectedContainerLocationId(null);
                  setSelectedIds(ids);
                }}
                onShapeDragEnd={handleShapeDragEnd}
                onShapesDragEnd={handleShapesDragEnd}
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
                groupHighlightShapeIds={groupHighlightShapeIds}
              />

              <WarehouseFrontElevationPanel
                layout={{ ...layout, shapes }}
                locations={liveLocations}
                locationGroups={locationGroups}
                anchorLocationId={selectedFrontAnchorLocationId}
                className="h-64 shrink-0"
              />
            </div>

            <ShapeInspector
              selectedShapes={selectedShapes}
              selectedGroup={selectedGroup}
              selectedContainerLocation={selectedContainerLocation}
              layout={layout}
              locations={liveLocations}
              locationGroups={locationGroups}
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
              onUpdateLocationDimensions={handleUpdateLocationDimensions}
              onUpdateGroup={handleUpdateGroup}
              onDeleteGroup={() => setPendingDeleteGroupId(selectedGroup?.id ?? null)}
              onSelectGroupMembers={() =>
                selectedGroup ? handleSelectGroupMembers(selectedGroup.id) : undefined
              }
              onDeleteContainerLocation={() => {
                if (selectedContainerLocation) {
                  deleteLocMut.mutate(selectedContainerLocation.id, {
                    onSuccess: () => setSelectedContainerLocationId(null),
                  });
                }
              }}
              onSelectContainerMembers={() =>
                selectedContainerLocation
                  ? handleSelectContainerMembers(selectedContainerLocation.id)
                  : undefined
              }
              onDeleteShape={handleDeleteShape}
              onDeleteShapes={handleDeleteShapes}
              onCloneShape={handleCloneShape}
              onAlignShapes={handleAlignShapes}
              onLayoutMetaChange={handleLayoutMetaChange}
            />
          </>
        )}
      </div>

      <AlertDialog
        open={!!pendingDeleteGroupId}
        onOpenChange={(open) => !open && setPendingDeleteGroupId(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{toolboxT("deleteGroupDialog.title")}</AlertDialogTitle>
            <AlertDialogDescription>
              {toolboxT("deleteGroupDialog.description", { name: selectedGroup?.name ?? "" })}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleteGroupMut.isPending}>
              {toolboxT("actions.cancel")}
            </AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              disabled={deleteGroupMut.isPending}
              onClick={() => {
                if (!pendingDeleteGroupId) return;
                deleteGroupMut.mutate(pendingDeleteGroupId, {
                  onSuccess: () => {
                    setPendingDeleteGroupId(null);
                    setSelectedGroupId(null);
                  },
                });
              }}
            >
              {deleteGroupMut.isPending ? toolboxT("actions.deleting") : toolboxT("actions.delete")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

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
            <DialogTitle>
              {pendingClone ? t("dialogs.location.cloneTitle") : t("dialogs.location.createTitle")}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label htmlFor="nloc-name">
                {t("dialogs.location.fields.name")} <span className="text-destructive">*</span>
              </Label>
              <Input
                id="nloc-name"
                value={newLocName}
                onChange={(e) => setNewLocName(e.target.value)}
                placeholder={t("dialogs.location.placeholders.name")}
                autoFocus
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="nloc-code">
                {t("dialogs.location.fields.code")} <span className="text-destructive">*</span>
              </Label>
              <Input
                id="nloc-code"
                value={newLocCode}
                onChange={(e) => setNewLocCode(e.target.value.toUpperCase())}
                placeholder={t("dialogs.location.placeholders.code")}
                className="font-mono"
              />
              <p className="text-[11px] text-muted-foreground">{t("dialogs.location.help.code")}</p>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="nloc-color">{t("dialogs.location.fields.color")}</Label>
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
              {t("actions.cancel")}
            </Button>
            <Button onClick={handleCreateNewLocation} disabled={newLocCreating}>
              {newLocCreating ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" /> {t("actions.creating")}
                </>
              ) : pendingClone ? (
                t("actions.clone")
              ) : (
                t("actions.create")
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
