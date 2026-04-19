"use client";

import React from "react";
import { useTranslations } from "next-intl";
import {
  Trash2,
  Copy,
  Info,
  Grid3x3,
  Magnet,
  RotateCcw,
  RotateCw,
  Rows3,
  Columns3,
  AlignStartVertical,
  AlignCenterVertical,
  AlignEndVertical,
  AlignStartHorizontal,
  AlignCenterHorizontal,
  AlignEndHorizontal,
  AlignHorizontalSpaceAround,
  AlignVerticalSpaceAround,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";
import type { WarehouseLayoutShape, ShapeStyle } from "@/lib/warehouse/layouts";
import type { WarehouseLayout } from "@/lib/warehouse/layouts";
import {
  getEffectiveLocationColor,
  type WarehouseLocation,
  type WarehouseLocationGroup,
} from "@/lib/warehouse/location-tree";

// ─── Alignment type ───────────────────────────────────────────────────────────

export type AlignType =
  | "left"
  | "right"
  | "top"
  | "bottom"
  | "center-h"
  | "center-v"
  | "stitch-h"
  | "stitch-v"
  | "distribute-h"
  | "distribute-v";

// ─── Props ────────────────────────────────────────────────────────────────────

interface ShapeInspectorProps {
  selectedShapes: WarehouseLayoutShape[];
  selectedGroup: WarehouseLocationGroup | null;
  selectedContainerLocation: WarehouseLocation | null;
  layout: WarehouseLayout;
  locations: WarehouseLocation[];
  locationGroups: WarehouseLocationGroup[];
  showGrid: boolean;
  snapToGrid: boolean;
  gridIntervalM: number;
  onToggleGrid: () => void;
  onToggleSnap: () => void;
  onGridIntervalChange: (v: number) => void;
  onShapeGeometryChange: (
    id: string,
    patch: Partial<
      Pick<WarehouseLayoutShape, "x" | "y" | "width" | "height" | "rotation" | "label" | "style">
    >
  ) => void;
  onUpdateLocation: (
    locationId: string,
    patch: {
      name?: string;
      code?: string | null;
      color?: string | null;
      group_id?: string | null;
      inherit_group_color?: boolean;
      elevation_level?: number;
    }
  ) => void;
  onUpdateLocationDimensions: (
    locationId: string,
    patch: {
      physical_width_m?: number;
      physical_depth_m?: number;
    }
  ) => void;
  onUpdateGroup: (
    groupId: string,
    patch: { name?: string; color?: string | null; description?: string | null }
  ) => void;
  onDeleteGroup: () => void;
  onSelectGroupMembers: () => void;
  onDeleteContainerLocation: () => void;
  onSelectContainerMembers: () => void;
  onDeleteShape: (id: string) => void;
  onDeleteShapes: (ids: string[]) => void;
  onCloneShape: (shapeId: string) => void;
  onAlignShapes: (type: AlignType) => void;
  onLayoutMetaChange: (
    patch: Partial<Pick<WarehouseLayout, "canvas_width_m" | "canvas_height_m">>
  ) => void;
}

// ─── Label style section (location shapes only) ───────────────────────────────

type LabelAlignH = "left" | "center" | "right";
type LabelAlignV = "top" | "center" | "bottom";

const ALIGN_GRID: { h: LabelAlignH; v: LabelAlignV }[] = [
  { h: "left", v: "top" },
  { h: "center", v: "top" },
  { h: "right", v: "top" },
  { h: "left", v: "center" },
  { h: "center", v: "center" },
  { h: "right", v: "center" },
  { h: "left", v: "bottom" },
  { h: "center", v: "bottom" },
  { h: "right", v: "bottom" },
];

// Dot position inside the 3×3 cell that visually represents the alignment
const DOT_OFFSET: Record<LabelAlignH | LabelAlignV, string> = {
  left: "justify-start",
  center: "justify-center",
  right: "justify-end",
  top: "items-start",
  bottom: "items-end",
};

function LabelStyleSection({
  style,
  onStyleChange,
  t,
}: {
  style: ShapeStyle | null;
  onStyleChange: (patch: Partial<ShapeStyle>) => void;
  t: ReturnType<typeof useTranslations>;
}) {
  const labelColor = style?.labelColor ?? "#475569";
  const labelSize = style?.labelSize ?? 0.35;
  const activeH = style?.labelAlignH ?? "left";
  const activeV = style?.labelAlignV ?? "top";

  return (
    <div className="space-y-3 pt-3 border-t">
      <Label className="text-[10px] uppercase text-muted-foreground font-semibold">
        {t("sections.codeLabel")}
      </Label>

      {/* Color + Size row */}
      <div className="flex items-center gap-3">
        <div className="flex items-center gap-1.5 flex-1">
          <Label className="text-[10px] text-muted-foreground shrink-0">{t("fields.color")}</Label>
          <input
            type="color"
            value={labelColor}
            onChange={(e) => onStyleChange({ labelColor: e.target.value })}
            className="w-7 h-7 rounded border cursor-pointer p-0.5"
          />
        </div>
        <div className="flex items-center gap-1.5 flex-1">
          <Label htmlFor="label-size" className="text-[10px] text-muted-foreground shrink-0">
            {t("fields.size")}
          </Label>
          <Input
            id="label-size"
            type="number"
            step="0.05"
            min={0.05}
            max={5}
            value={labelSize.toFixed(2)}
            onChange={(e) => {
              const v = parseFloat(e.target.value);
              if (!isNaN(v) && v > 0) onStyleChange({ labelSize: v });
            }}
            className="h-7 text-xs font-mono"
          />
        </div>
      </div>

      {/* Alignment grid — 3×3 */}
      <div className="space-y-1.5">
        <Label className="text-[10px] text-muted-foreground">{t("fields.position")}</Label>
        <div className="grid grid-cols-3 gap-1 w-full">
          {ALIGN_GRID.map(({ h, v }) => {
            const isActive = h === activeH && v === activeV;
            return (
              <button
                key={`${h}-${v}`}
                type="button"
                title={t("alignment.position", { vertical: v, horizontal: h })}
                onClick={() => onStyleChange({ labelAlignH: h, labelAlignV: v })}
                className={cn(
                  "h-8 rounded border flex items-center transition-colors",
                  DOT_OFFSET[h],
                  isActive
                    ? "border-primary bg-primary/10"
                    : "border-border hover:border-muted-foreground/50 hover:bg-muted"
                )}
              >
                <div
                  className={cn(
                    "w-1.5 h-1.5 rounded-full mx-1.5",
                    isActive ? "bg-primary" : "bg-muted-foreground/40"
                  )}
                />
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}

// ─── Align button ─────────────────────────────────────────────────────────────

function AlignBtn({
  icon: Icon,
  title,
  onClick,
}: {
  icon: React.ElementType;
  title: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      title={title}
      onClick={onClick}
      className="flex items-center justify-center w-8 h-8 rounded hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
    >
      <Icon className="w-4 h-4" />
    </button>
  );
}

const GEOMETRY_FIELD_KEYS = {
  x: "fields.x",
  y: "fields.y",
  width: "fields.width",
  height: "fields.height",
} as const;

function normalizeRotation(value: number) {
  const normalized = value % 360;
  return normalized < 0 ? normalized + 360 : normalized;
}

// ─── Component ────────────────────────────────────────────────────────────────

export function ShapeInspector({
  selectedShapes,
  selectedGroup,
  selectedContainerLocation,
  layout,
  locations,
  locationGroups,
  showGrid,
  snapToGrid,
  gridIntervalM,
  onToggleGrid,
  onToggleSnap,
  onGridIntervalChange,
  onShapeGeometryChange,
  onUpdateLocation,
  onUpdateLocationDimensions,
  onUpdateGroup,
  onDeleteGroup,
  onSelectGroupMembers,
  onDeleteContainerLocation,
  onSelectContainerMembers,
  onDeleteShape,
  onDeleteShapes,
  onCloneShape,
  onAlignShapes,
  onLayoutMetaChange,
}: ShapeInspectorProps) {
  const t = useTranslations("warehouseShapeInspector");
  // Convenience for single-selection paths
  const selectedShape = selectedShapes.length === 1 ? selectedShapes[0] : null;
  const isMulti = selectedShapes.length > 1;
  const style = selectedShape?.style as ShapeStyle | null;
  const isTopDownLocationShape =
    selectedShape?.shape_type === "location" &&
    (selectedShape.projection ?? "top_down") === "top_down";
  const isBulkTopDownLocationSelection =
    isMulti &&
    selectedShapes.every(
      (shape) => shape.shape_type === "location" && (shape.projection ?? "top_down") === "top_down"
    );
  const isBulkRotatableSelection =
    isMulti && selectedShapes.every((shape) => shape.shape_type !== "label");

  // The linked warehouse_location for the selected shape (location shapes only)
  const linkedLocation =
    selectedShape?.shape_type === "location" && selectedShape.location_id
      ? (locations.find((l) => l.id === selectedShape.location_id) ?? null)
      : null;
  const availableGroups = React.useMemo(() => {
    if (!linkedLocation) return [];
    return locationGroups
      .filter((group) => group.parent_location_id === linkedLocation.parent_id)
      .sort((a, b) => a.sort_order - b.sort_order || a.name.localeCompare(b.name));
  }, [linkedLocation, locationGroups]);

  // Local edit state for name/code/color — synced from linkedLocation when selection changes
  const [locName, setLocName] = React.useState(linkedLocation?.name ?? "");
  const [locCode, setLocCode] = React.useState(linkedLocation?.code ?? "");
  const [locColor, setLocColor] = React.useState(linkedLocation?.color ?? "#10b981");
  const [inheritGroupColor, setInheritGroupColor] = React.useState(
    linkedLocation?.inherit_group_color ?? false
  );
  const [locElevationLevel, setLocElevationLevel] = React.useState(
    String((linkedLocation ?? selectedContainerLocation)?.elevation_level ?? 1)
  );
  const [groupName, setGroupName] = React.useState(selectedGroup?.name ?? "");
  const [groupColor, setGroupColor] = React.useState(selectedGroup?.color ?? "#64748b");

  React.useEffect(() => {
    setLocName(linkedLocation?.name ?? "");
    setLocCode(linkedLocation?.code ?? "");
    setLocColor(linkedLocation?.color ?? "#10b981");
    setInheritGroupColor(linkedLocation?.inherit_group_color ?? false);
    setLocElevationLevel(String(linkedLocation?.elevation_level ?? 1));
  }, [linkedLocation?.id]); // reset only when a different location is selected

  React.useEffect(() => {
    if (!selectedContainerLocation) return;
    setLocName(selectedContainerLocation.name ?? "");
    setLocCode(selectedContainerLocation.code ?? "");
    setLocColor(selectedContainerLocation.color ?? "#10b981");
    setLocElevationLevel(String(selectedContainerLocation.elevation_level ?? 1));
  }, [selectedContainerLocation?.id]);

  const effectivePreviewColor = linkedLocation
    ? (getEffectiveLocationColor(
        { ...linkedLocation, color: locColor, inherit_group_color: inheritGroupColor },
        locationGroups
      ) ?? "#10b981")
    : "#10b981";

  React.useEffect(() => {
    setGroupName(selectedGroup?.name ?? "");
    setGroupColor(selectedGroup?.color ?? "#64748b");
  }, [selectedGroup?.id]);

  const commonMultiWidth = React.useMemo(() => {
    if (!isBulkTopDownLocationSelection || selectedShapes.length === 0) return "";
    const [first, ...rest] = selectedShapes;
    return rest.every((shape) => Math.abs(shape.width - first.width) < 0.001)
      ? first.width.toFixed(2)
      : "";
  }, [isBulkTopDownLocationSelection, selectedShapes]);

  const commonMultiDepth = React.useMemo(() => {
    if (!isBulkTopDownLocationSelection || selectedShapes.length === 0) return "";
    const [first, ...rest] = selectedShapes;
    return rest.every((shape) => Math.abs(shape.height - first.height) < 0.001)
      ? first.height.toFixed(2)
      : "";
  }, [isBulkTopDownLocationSelection, selectedShapes]);

  const commonMultiElevationLevel = React.useMemo(() => {
    if (!isBulkTopDownLocationSelection || selectedShapes.length === 0) return "";

    const locationIds = selectedShapes
      .map((shape) => shape.location_id)
      .filter((locationId): locationId is string => !!locationId);
    if (locationIds.length !== selectedShapes.length) return "";

    const selectedLocations = locationIds
      .map((locationId) => locations.find((location) => location.id === locationId) ?? null)
      .filter((location): location is WarehouseLocation => !!location);
    if (selectedLocations.length !== selectedShapes.length) return "";

    const [first, ...rest] = selectedLocations;
    return rest.every(
      (location) => (location.elevation_level ?? 1) === (first.elevation_level ?? 1)
    )
      ? String(first.elevation_level ?? 1)
      : "";
  }, [isBulkTopDownLocationSelection, locations, selectedShapes]);

  const [bulkWidth, setBulkWidth] = React.useState(commonMultiWidth);
  const [bulkDepth, setBulkDepth] = React.useState(commonMultiDepth);
  const [bulkElevationLevel, setBulkElevationLevel] = React.useState(commonMultiElevationLevel);

  React.useEffect(() => {
    setBulkWidth(commonMultiWidth);
    setBulkDepth(commonMultiDepth);
    setBulkElevationLevel(commonMultiElevationLevel);
  }, [commonMultiDepth, commonMultiElevationLevel, commonMultiWidth]);

  const applyBulkTopDownDimension = React.useCallback(
    (field: "width" | "height", rawValue: string) => {
      const value = parseFloat(rawValue);
      if (Number.isNaN(value) || value <= 0 || !isBulkTopDownLocationSelection) return;

      selectedShapes.forEach((shape) => {
        onShapeGeometryChange(shape.id, { [field]: value });
        if (shape.location_id) {
          onUpdateLocationDimensions(shape.location_id, {
            ...(field === "width" ? { physical_width_m: value } : {}),
            ...(field === "height" ? { physical_depth_m: value } : {}),
          });
        }
      });
    },
    [
      isBulkTopDownLocationSelection,
      onShapeGeometryChange,
      onUpdateLocationDimensions,
      selectedShapes,
    ]
  );

  const applyBulkRotation = React.useCallback(
    (delta: number) => {
      if (!isBulkRotatableSelection) return;

      selectedShapes.forEach((shape) => {
        onShapeGeometryChange(shape.id, {
          rotation: normalizeRotation(shape.rotation + delta),
        });
      });
    },
    [isBulkRotatableSelection, onShapeGeometryChange, selectedShapes]
  );

  const applyBulkElevationLevel = React.useCallback(
    (rawValue: string) => {
      const value = Math.max(1, Number.parseInt(rawValue, 10) || 1);
      if (!isBulkTopDownLocationSelection) return;

      selectedShapes.forEach((shape) => {
        if (!shape.location_id) return;
        onUpdateLocation(shape.location_id, { elevation_level: value });
      });
    },
    [isBulkTopDownLocationSelection, onUpdateLocation, selectedShapes]
  );

  return (
    <div className="w-72 h-full border-l bg-background flex flex-col shrink-0 overflow-hidden">
      {/* Header */}
      <div className="px-4 py-3 border-b bg-muted/50 flex items-center justify-between shrink-0">
        <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">
          {t("header.title")}
        </span>
        {isMulti && (
          <div className="flex items-center gap-1">
            <span className="text-[10px] text-muted-foreground">
              {t("header.selectedCount", { count: String(selectedShapes.length) })}
            </span>
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7 text-muted-foreground hover:text-destructive hover:bg-destructive/10"
              onClick={() => onDeleteShapes(selectedShapes.map((s) => s.id))}
              title={t("actions.deleteSelectedShapes")}
            >
              <Trash2 className="w-3.5 h-3.5" />
            </Button>
          </div>
        )}
        {selectedShape && !isMulti && (
          <div className="flex items-center gap-1">
            {selectedShape.shape_type === "location" && (
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7 text-muted-foreground hover:text-primary hover:bg-primary/10"
                onClick={() => onCloneShape(selectedShape.id)}
                title={t("actions.cloneLocation")}
              >
                <Copy className="w-3.5 h-3.5" />
              </Button>
            )}
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7 text-muted-foreground hover:text-destructive hover:bg-destructive/10"
              onClick={() => onDeleteShape(selectedShape.id)}
              title={t("actions.deleteShape")}
            >
              <Trash2 className="w-3.5 h-3.5" />
            </Button>
          </div>
        )}
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-5">
        {/* ── Multi-select alignment panel ────────────────────────────────── */}
        {isMulti ? (
          <div className="space-y-4">
            <div className="space-y-2">
              <Label className="text-[10px] uppercase text-muted-foreground font-semibold">
                {t("sections.align")}
              </Label>
              <div className="space-y-1">
                <p className="text-[10px] text-muted-foreground">{t("alignment.horizontal")}</p>
                <div className="flex items-center gap-0.5">
                  <AlignBtn
                    icon={AlignStartVertical}
                    title={t("alignment.left")}
                    onClick={() => onAlignShapes("left")}
                  />
                  <AlignBtn
                    icon={AlignCenterVertical}
                    title={t("alignment.centerH")}
                    onClick={() => onAlignShapes("center-h")}
                  />
                  <AlignBtn
                    icon={AlignEndVertical}
                    title={t("alignment.right")}
                    onClick={() => onAlignShapes("right")}
                  />
                  {selectedShapes.length >= 3 && (
                    <AlignBtn
                      icon={AlignHorizontalSpaceAround}
                      title={t("alignment.distributeH")}
                      onClick={() => onAlignShapes("distribute-h")}
                    />
                  )}
                  <AlignBtn
                    icon={Columns3}
                    title={t("alignment.stitchH")}
                    onClick={() => onAlignShapes("stitch-h")}
                  />
                </div>
              </div>
              <div className="space-y-1">
                <p className="text-[10px] text-muted-foreground">{t("alignment.vertical")}</p>
                <div className="flex items-center gap-0.5">
                  <AlignBtn
                    icon={AlignStartHorizontal}
                    title={t("alignment.top")}
                    onClick={() => onAlignShapes("top")}
                  />
                  <AlignBtn
                    icon={AlignCenterHorizontal}
                    title={t("alignment.centerV")}
                    onClick={() => onAlignShapes("center-v")}
                  />
                  <AlignBtn
                    icon={AlignEndHorizontal}
                    title={t("alignment.bottom")}
                    onClick={() => onAlignShapes("bottom")}
                  />
                  {selectedShapes.length >= 3 && (
                    <AlignBtn
                      icon={AlignVerticalSpaceAround}
                      title={t("alignment.distributeV")}
                      onClick={() => onAlignShapes("distribute-v")}
                    />
                  )}
                  <AlignBtn
                    icon={Rows3}
                    title={t("alignment.stitchV")}
                    onClick={() => onAlignShapes("stitch-v")}
                  />
                </div>
              </div>
            </div>

            {isBulkTopDownLocationSelection && (
              <div className="space-y-2 pt-3 border-t">
                <Label className="text-[10px] uppercase text-muted-foreground font-semibold">
                  {t("sections.geometry")}
                </Label>
                <div className="grid grid-cols-2 gap-2">
                  <div className="space-y-1">
                    <Label className="text-[10px] text-muted-foreground uppercase">
                      {t("fields.width")}
                    </Label>
                    <Input
                      type="number"
                      step="0.1"
                      min={0.1}
                      value={bulkWidth}
                      placeholder="—"
                      onChange={(e) => setBulkWidth(e.target.value)}
                      onBlur={(e) => applyBulkTopDownDimension("width", e.target.value)}
                      className="h-8 text-xs font-mono"
                    />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-[10px] text-muted-foreground uppercase">
                      {t("fields.depth")}
                    </Label>
                    <Input
                      type="number"
                      step="0.1"
                      min={0.1}
                      value={bulkDepth}
                      placeholder="—"
                      onChange={(e) => setBulkDepth(e.target.value)}
                      onBlur={(e) => applyBulkTopDownDimension("height", e.target.value)}
                      className="h-8 text-xs font-mono"
                    />
                  </div>
                </div>
                <div className="space-y-1">
                  <Label className="text-[10px] text-muted-foreground uppercase">
                    {t("fields.elevationLevel")}
                  </Label>
                  <Input
                    type="number"
                    min={1}
                    step={1}
                    value={bulkElevationLevel}
                    placeholder="—"
                    onChange={(e) => setBulkElevationLevel(e.target.value)}
                    onBlur={(e) => {
                      const nextValue = String(
                        Math.max(1, Number.parseInt(e.target.value, 10) || 1)
                      );
                      setBulkElevationLevel(nextValue);
                      applyBulkElevationLevel(nextValue);
                    }}
                    className="h-8 text-xs font-mono"
                  />
                  <p className="text-[10px] text-muted-foreground">{t("help.elevationLevel")}</p>
                </div>
              </div>
            )}

            {isBulkRotatableSelection && (
              <div className="space-y-2 pt-3 border-t">
                <Label className="text-[10px] uppercase text-muted-foreground font-semibold">
                  {t("fields.rotation")}
                </Label>
                <div className="flex items-center gap-2">
                  <TooltipProvider delayDuration={100}>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button
                          type="button"
                          variant="outline"
                          size="icon"
                          className="h-8 w-8 shrink-0"
                          onClick={() => applyBulkRotation(-90)}
                        >
                          <RotateCcw className="h-3.5 w-3.5" />
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent>{t("actions.rotateLeft")}</TooltipContent>
                    </Tooltip>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button
                          type="button"
                          variant="outline"
                          size="icon"
                          className="h-8 w-8 shrink-0"
                          onClick={() => applyBulkRotation(90)}
                        >
                          <RotateCw className="h-3.5 w-3.5" />
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent>{t("actions.rotateRight")}</TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                </div>
              </div>
            )}

            {/* Label style — shown when all selected shapes are location shapes */}
            {selectedShapes.every((s) => s.shape_type === "location") && (
              <LabelStyleSection
                style={selectedShapes[0].style as ShapeStyle | null}
                t={t}
                onStyleChange={(patch) => {
                  selectedShapes.forEach((s) => {
                    const shapeStyle = s.style as ShapeStyle | null;
                    onShapeGeometryChange(s.id, { style: { ...(shapeStyle ?? {}), ...patch } });
                  });
                }}
              />
            )}

            <p className="text-[10px] text-muted-foreground pt-1 border-t">
              {t("multiSelect.help")}
            </p>
          </div>
        ) : selectedGroup ? (
          <div className="space-y-4">
            <div>
              <Label className="text-[10px] uppercase text-muted-foreground font-semibold">
                {t("sections.group")}
              </Label>
              <p className="mt-1 text-sm font-medium">{selectedGroup.name}</p>
            </div>

            <div className="space-y-3">
              <div className="space-y-1">
                <Label
                  htmlFor="group-name"
                  className="text-[10px] uppercase text-muted-foreground font-semibold"
                >
                  {t("fields.groupName")}
                </Label>
                <Input
                  id="group-name"
                  value={groupName}
                  onChange={(e) => setGroupName(e.target.value)}
                  onBlur={() => {
                    const trimmed = groupName.trim();
                    if (trimmed && trimmed !== selectedGroup.name) {
                      onUpdateGroup(selectedGroup.id, { name: trimmed });
                    }
                  }}
                  placeholder={t("placeholders.groupName")}
                  className="h-8 text-sm"
                />
              </div>

              <div className="space-y-1">
                <Label
                  htmlFor="group-color"
                  className="text-[10px] uppercase text-muted-foreground font-semibold"
                >
                  {t("fields.groupColor")}
                </Label>
                <div className="flex items-center gap-2">
                  <input
                    id="group-color"
                    type="color"
                    value={groupColor}
                    onChange={(e) => setGroupColor(e.target.value)}
                    onBlur={() => {
                      if (groupColor !== (selectedGroup.color ?? "#64748b")) {
                        onUpdateGroup(selectedGroup.id, { color: groupColor });
                      }
                    }}
                    className="w-8 h-8 rounded border cursor-pointer p-0.5"
                  />
                  <span className="text-xs font-mono text-muted-foreground">{groupColor}</span>
                </div>
              </div>

              <div className="rounded-md border bg-muted/30 px-3 py-2">
                <p className="text-[10px] uppercase text-muted-foreground font-semibold">
                  {t("fields.groupMembers")}
                </p>
                <p className="mt-1 text-sm font-medium">
                  {locations.filter((location) => location.group_id === selectedGroup.id).length}
                </p>
              </div>
            </div>

            <div className="space-y-2 pt-3 border-t">
              <Button
                type="button"
                variant="outline"
                className="w-full"
                onClick={onSelectGroupMembers}
              >
                {t("actions.selectGroupMembers")}
              </Button>
              <Button
                type="button"
                variant="destructive"
                className="w-full"
                onClick={onDeleteGroup}
              >
                {t("actions.deleteGroup")}
              </Button>
            </div>
          </div>
        ) : selectedContainerLocation ? (
          <div className="space-y-4">
            <div>
              <Label className="text-[10px] uppercase text-muted-foreground font-semibold">
                {t("sections.group")}
              </Label>
              <p className="mt-1 text-sm font-medium">{selectedContainerLocation.name}</p>
              {selectedContainerLocation.code ? (
                <p className="mt-1 text-xs font-mono text-muted-foreground">
                  {selectedContainerLocation.code}
                </p>
              ) : null}
            </div>

            <div className="space-y-3">
              <div className="space-y-1">
                <Label
                  htmlFor="container-name"
                  className="text-[10px] uppercase text-muted-foreground font-semibold"
                >
                  {t("fields.name")}
                </Label>
                <Input
                  id="container-name"
                  value={locName}
                  onChange={(e) => setLocName(e.target.value)}
                  onBlur={() => {
                    const trimmed = locName.trim();
                    if (trimmed && trimmed !== selectedContainerLocation.name) {
                      onUpdateLocation(selectedContainerLocation.id, { name: trimmed });
                    }
                  }}
                  placeholder={t("placeholders.locationName")}
                  className="h-8 text-sm"
                />
              </div>

              <div className="space-y-1">
                <Label
                  htmlFor="container-code"
                  className="text-[10px] uppercase text-muted-foreground font-semibold"
                >
                  {t("fields.code")}
                </Label>
                <Input
                  id="container-code"
                  value={locCode}
                  onChange={(e) => setLocCode(e.target.value.toUpperCase())}
                  onBlur={() => {
                    const trimmed = locCode.trim() || null;
                    if (trimmed !== (selectedContainerLocation.code ?? null)) {
                      onUpdateLocation(selectedContainerLocation.id, { code: trimmed });
                    }
                  }}
                  placeholder={t("placeholders.locationCode")}
                  className="h-8 text-xs font-mono"
                />
              </div>

              <div className="space-y-1">
                <Label
                  htmlFor="container-color"
                  className="text-[10px] uppercase text-muted-foreground font-semibold"
                >
                  {t("fields.color")}
                </Label>
                <div className="flex items-center gap-2">
                  <input
                    id="container-color"
                    type="color"
                    value={locColor}
                    onChange={(e) => setLocColor(e.target.value)}
                    onBlur={() => {
                      if (locColor !== (selectedContainerLocation.color ?? "#10b981")) {
                        onUpdateLocation(selectedContainerLocation.id, { color: locColor });
                      }
                    }}
                    className="w-8 h-8 rounded border cursor-pointer p-0.5"
                  />
                  <span className="text-xs font-mono text-muted-foreground">{locColor}</span>
                </div>
              </div>

              <div className="space-y-1">
                <Label
                  htmlFor="container-elevation-level"
                  className="text-[10px] uppercase text-muted-foreground font-semibold"
                >
                  {t("fields.elevationLevel")}
                </Label>
                <Input
                  id="container-elevation-level"
                  type="number"
                  min={1}
                  step={1}
                  value={locElevationLevel}
                  onChange={(e) => setLocElevationLevel(e.target.value)}
                  onBlur={() => {
                    const nextValue = Math.max(
                      1,
                      Number.parseInt(locElevationLevel || "1", 10) || 1
                    );
                    setLocElevationLevel(String(nextValue));
                    if (nextValue !== (selectedContainerLocation.elevation_level ?? 1)) {
                      onUpdateLocation(selectedContainerLocation.id, {
                        elevation_level: nextValue,
                      });
                    }
                  }}
                  className="h-8 text-xs font-mono"
                />
              </div>

              <div className="rounded-md border bg-muted/30 px-3 py-2">
                <p className="text-[10px] uppercase text-muted-foreground font-semibold">
                  {t("fields.groupMembers")}
                </p>
                <p className="mt-1 text-sm font-medium">
                  {
                    locations.filter(
                      (location) => location.parent_id === selectedContainerLocation.id
                    ).length
                  }
                </p>
              </div>
            </div>

            <div className="space-y-2 pt-3 border-t">
              <Button
                type="button"
                variant="outline"
                className="w-full"
                onClick={onSelectContainerMembers}
              >
                {t("actions.selectGroupMembers")}
              </Button>
              <Button
                type="button"
                variant="destructive"
                className="w-full"
                onClick={onDeleteContainerLocation}
              >
                {t("actions.deleteShape")}
              </Button>
            </div>
          </div>
        ) : !selectedShape ? (
          <div className="flex flex-col items-center justify-center py-8 text-center text-muted-foreground">
            <Info className="w-10 h-10 mb-3 opacity-20" />
            <p className="text-xs">{t("empty.title")}</p>
            <p className="text-[10px] mt-1 opacity-60">{t("empty.description")}</p>
          </div>
        ) : (
          <>
            {/* Type badge */}
            <div>
              <Label className="text-[10px] uppercase text-muted-foreground font-semibold">
                {t("sections.type")}
              </Label>
              <p className="mt-1 text-sm font-medium capitalize">
                {t(`shapeTypes.${selectedShape.shape_type}`)}
              </p>
            </div>

            {/* Location shapes: Name + Code editing the real warehouse_location record */}
            {selectedShape.shape_type === "location" && linkedLocation ? (
              <React.Fragment>
                <div className="space-y-3">
                  <div className="space-y-1">
                    <Label
                      htmlFor="loc-name"
                      className="text-[10px] uppercase text-muted-foreground font-semibold"
                    >
                      {t("fields.name")}
                    </Label>
                    <Input
                      id="loc-name"
                      value={locName}
                      onChange={(e) => setLocName(e.target.value)}
                      onBlur={() => {
                        const trimmed = locName.trim();
                        if (trimmed && trimmed !== linkedLocation.name) {
                          onUpdateLocation(linkedLocation.id, { name: trimmed });
                        }
                      }}
                      placeholder={t("placeholders.locationName")}
                      className="h-8 text-sm"
                    />
                  </div>
                  <div className="space-y-1">
                    <Label
                      htmlFor="loc-code"
                      className="text-[10px] uppercase text-muted-foreground font-semibold"
                    >
                      {t("fields.code")}
                    </Label>
                    <Input
                      id="loc-code"
                      value={locCode}
                      onChange={(e) => setLocCode(e.target.value.toUpperCase())}
                      onBlur={() => {
                        const trimmed = locCode.trim() || null;
                        if (trimmed !== (linkedLocation.code ?? null)) {
                          onUpdateLocation(linkedLocation.id, { code: trimmed });
                        }
                      }}
                      placeholder={t("placeholders.locationCode")}
                      className="h-8 text-xs font-mono"
                    />
                    <p className="text-[10px] text-muted-foreground">{t("help.locationCode")}</p>
                  </div>
                  <div className="space-y-1">
                    <Label
                      htmlFor="loc-color"
                      className="text-[10px] uppercase text-muted-foreground font-semibold"
                    >
                      {t("fields.color")}
                    </Label>
                    <div className="flex items-center gap-2">
                      <input
                        id="loc-color"
                        type="color"
                        value={locColor}
                        onChange={(e) => setLocColor(e.target.value)}
                        onBlur={() => {
                          if (locColor !== (linkedLocation.color ?? "#10b981")) {
                            onUpdateLocation(linkedLocation.id, { color: locColor });
                          }
                        }}
                        disabled={inheritGroupColor && !!linkedLocation.group_id}
                        className="w-8 h-8 rounded border cursor-pointer p-0.5 disabled:cursor-not-allowed disabled:opacity-50"
                      />
                      <span className="text-xs font-mono text-muted-foreground">
                        {inheritGroupColor && linkedLocation.group_id
                          ? effectivePreviewColor
                          : locColor}
                      </span>
                    </div>
                  </div>
                  <div className="space-y-1">
                    <Label
                      htmlFor="loc-elevation-level"
                      className="text-[10px] uppercase text-muted-foreground font-semibold"
                    >
                      {t("fields.elevationLevel")}
                    </Label>
                    <Input
                      id="loc-elevation-level"
                      type="number"
                      min={1}
                      step={1}
                      value={locElevationLevel}
                      onChange={(e) => setLocElevationLevel(e.target.value)}
                      onBlur={() => {
                        const nextValue = Math.max(
                          1,
                          Number.parseInt(locElevationLevel || "1", 10) || 1
                        );
                        setLocElevationLevel(String(nextValue));
                        if (nextValue !== (linkedLocation.elevation_level ?? 1)) {
                          onUpdateLocation(linkedLocation.id, {
                            elevation_level: nextValue,
                          });
                        }
                      }}
                      className="h-8 text-xs font-mono"
                    />
                    <p className="text-[10px] text-muted-foreground">{t("help.elevationLevel")}</p>
                  </div>
                  <div className="space-y-1">
                    <Label className="text-[10px] uppercase text-muted-foreground font-semibold">
                      {t("fields.group")}
                    </Label>
                    <Select
                      value={linkedLocation.group_id ?? "__none__"}
                      onValueChange={(value) => {
                        const nextGroupId = value === "__none__" ? null : value;
                        if (!nextGroupId) {
                          setInheritGroupColor(false);
                          onUpdateLocation(linkedLocation.id, {
                            group_id: null,
                            inherit_group_color: false,
                          });
                          return;
                        }

                        onUpdateLocation(linkedLocation.id, { group_id: nextGroupId });
                      }}
                    >
                      <SelectTrigger className="h-8 text-xs">
                        <SelectValue placeholder={t("placeholders.noGroup")} />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="__none__">{t("fields.groupNone")}</SelectItem>
                        {availableGroups.map((group) => (
                          <SelectItem key={group.id} value={group.id}>
                            {group.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  {linkedLocation.group_id && (
                    <div className="space-y-1">
                      <div className="flex items-center justify-between rounded-md border px-3 py-2">
                        <div className="space-y-0.5">
                          <Label className="text-[10px] uppercase text-muted-foreground font-semibold">
                            {t("fields.inheritGroupColor")}
                          </Label>
                          <p className="text-[10px] text-muted-foreground">
                            {t("help.inheritGroupColor")}
                          </p>
                        </div>
                        <Switch
                          checked={inheritGroupColor}
                          onCheckedChange={(checked) => {
                            setInheritGroupColor(checked);
                            onUpdateLocation(linkedLocation.id, {
                              inherit_group_color: checked,
                            });
                          }}
                        />
                      </div>
                    </div>
                  )}
                </div>
                <LabelStyleSection
                  style={style}
                  t={t}
                  onStyleChange={(patch) =>
                    onShapeGeometryChange(selectedShape.id, {
                      style: { ...(style ?? {}), ...patch },
                    })
                  }
                />
              </React.Fragment>
            ) : (
              /* Non-location shapes: free-text label + font size for label shapes */
              <div className="space-y-3">
                <div className="space-y-1">
                  <Label
                    htmlFor="shape-label"
                    className="text-[10px] uppercase text-muted-foreground font-semibold"
                  >
                    {t("fields.label")}
                  </Label>
                  <Input
                    id="shape-label"
                    value={selectedShape.label ?? ""}
                    onChange={(e) =>
                      onShapeGeometryChange(selectedShape.id, { label: e.target.value || null })
                    }
                    placeholder={t("placeholders.noLabel")}
                    className="h-8 text-sm"
                  />
                </div>
                {selectedShape.shape_type === "label" && (
                  <div className="space-y-1">
                    <Label
                      htmlFor="shape-fontsize"
                      className="text-[10px] uppercase text-muted-foreground font-semibold"
                    >
                      {t("fields.fontSize")}
                    </Label>
                    <Input
                      id="shape-fontsize"
                      type="number"
                      step="0.1"
                      min={0.1}
                      max={10}
                      value={(style?.fontSize ?? 0.8).toFixed(1)}
                      onChange={(e) => {
                        const v = parseFloat(e.target.value);
                        if (!isNaN(v) && v > 0) {
                          onShapeGeometryChange(selectedShape.id, {
                            style: { ...style, fontSize: v },
                          });
                        }
                      }}
                      className="h-8 text-xs font-mono"
                    />
                  </div>
                )}
              </div>
            )}

            {/* Geometry */}
            <div className="space-y-2 pt-3 border-t">
              <Label className="text-[10px] uppercase text-muted-foreground font-semibold">
                {t("sections.geometry")}
              </Label>
              <div className="grid grid-cols-2 gap-2">
                {(["x", "y", "width", "height"] as const).map((field) => (
                  <div key={field} className="space-y-1">
                    <Label
                      htmlFor={`shape-${field}`}
                      className="text-[10px] text-muted-foreground uppercase"
                    >
                      {field === "height" && isTopDownLocationShape
                        ? t("fields.depth")
                        : t(GEOMETRY_FIELD_KEYS[field])}
                    </Label>
                    <Input
                      id={`shape-${field}`}
                      type="number"
                      step="0.1"
                      min={field === "width" || field === "height" ? 0.1 : undefined}
                      value={selectedShape[field].toFixed(2)}
                      onChange={(e) => {
                        const v = parseFloat(e.target.value);
                        if (!isNaN(v)) onShapeGeometryChange(selectedShape.id, { [field]: v });
                      }}
                      className="h-8 text-xs font-mono"
                    />
                  </div>
                ))}
              </div>
              <div className="space-y-1">
                <Label
                  htmlFor="shape-rotation"
                  className="text-[10px] text-muted-foreground uppercase"
                >
                  {t("fields.rotation")}
                </Label>
                <div className="flex items-center gap-2">
                  <Input
                    id="shape-rotation"
                    type="number"
                    step="1"
                    value={selectedShape.rotation.toFixed(0)}
                    onChange={(e) => {
                      const v = parseFloat(e.target.value);
                      if (!isNaN(v)) {
                        onShapeGeometryChange(selectedShape.id, {
                          rotation: normalizeRotation(v),
                        });
                      }
                    }}
                    className="h-8 w-20 text-xs font-mono"
                  />
                  {selectedShape.shape_type !== "label" && (
                    <TooltipProvider delayDuration={100}>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Button
                            type="button"
                            variant="outline"
                            size="icon"
                            className="h-8 w-8 shrink-0"
                            onClick={() =>
                              onShapeGeometryChange(selectedShape.id, {
                                rotation: normalizeRotation(selectedShape.rotation - 90),
                              })
                            }
                          >
                            <RotateCcw className="h-3.5 w-3.5" />
                          </Button>
                        </TooltipTrigger>
                        <TooltipContent>{t("actions.rotateLeft")}</TooltipContent>
                      </Tooltip>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Button
                            type="button"
                            variant="outline"
                            size="icon"
                            className="h-8 w-8 shrink-0"
                            onClick={() =>
                              onShapeGeometryChange(selectedShape.id, {
                                rotation: normalizeRotation(selectedShape.rotation + 90),
                              })
                            }
                          >
                            <RotateCw className="h-3.5 w-3.5" />
                          </Button>
                        </TooltipTrigger>
                        <TooltipContent>{t("actions.rotateRight")}</TooltipContent>
                      </Tooltip>
                    </TooltipProvider>
                  )}
                </div>
              </div>
            </div>

            {/* Style — not shown for location shapes (color is controlled above) */}
            {selectedShape.shape_type !== "label" && selectedShape.shape_type !== "location" && (
              <div className="space-y-2 pt-3 border-t">
                <Label className="text-[10px] uppercase text-muted-foreground font-semibold">
                  {t("sections.style")}
                </Label>
                <div className="flex items-center gap-3">
                  <Label
                    htmlFor="shape-fill"
                    className="text-xs text-muted-foreground w-10 shrink-0"
                  >
                    {t("fields.fill")}
                  </Label>
                  <input
                    id="shape-fill"
                    type="color"
                    value={style?.fill ?? "#d1fae5"}
                    onChange={(e) =>
                      onShapeGeometryChange(selectedShape.id, {
                        style: { ...style, fill: e.target.value },
                      })
                    }
                    className="w-8 h-8 rounded border cursor-pointer p-0.5"
                  />
                  <Label
                    htmlFor="shape-stroke"
                    className="text-xs text-muted-foreground w-12 shrink-0"
                  >
                    {t("fields.stroke")}
                  </Label>
                  <input
                    id="shape-stroke"
                    type="color"
                    value={style?.stroke ?? "#10b981"}
                    onChange={(e) =>
                      onShapeGeometryChange(selectedShape.id, {
                        style: { ...style, stroke: e.target.value },
                      })
                    }
                    className="w-8 h-8 rounded border cursor-pointer p-0.5"
                  />
                </div>
              </div>
            )}
          </>
        )}

        {/* ── Grid settings (always visible) ───────────────────────────────── */}
        <div className="space-y-3 pt-3 border-t">
          <Label className="text-[10px] uppercase text-muted-foreground font-semibold flex items-center gap-1.5">
            <Grid3x3 className="w-3 h-3" /> {t("sections.grid")}
          </Label>
          <div className="flex items-center justify-between">
            <Label className="text-xs text-muted-foreground">{t("fields.showGrid")}</Label>
            <Switch checked={showGrid} onCheckedChange={onToggleGrid} />
          </div>
          <div className="flex items-center justify-between">
            <Label className="text-xs text-muted-foreground flex items-center gap-1">
              <Magnet className="w-3 h-3" /> {t("fields.snapToGrid")}
            </Label>
            <Switch checked={snapToGrid} onCheckedChange={onToggleSnap} />
          </div>
          {showGrid && (
            <div className="flex items-center justify-between">
              <Label className="text-xs text-muted-foreground">{t("fields.gridSize")}</Label>
              <Select
                value={String(gridIntervalM)}
                onValueChange={(v) => onGridIntervalChange(parseFloat(v))}
              >
                <SelectTrigger className="w-20 h-7 text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {[0.1, 0.5, 1, 2, 5, 10].map((v) => (
                    <SelectItem key={v} value={String(v)} className="text-xs">
                      {v}m
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}
        </div>

        {/* ── Canvas dimensions ─────────────────────────────────────────────── */}
        <div className="space-y-2 pt-3 border-t">
          <Label className="text-[10px] uppercase text-muted-foreground font-semibold">
            {t("sections.canvasSize")}
          </Label>
          <div className="grid grid-cols-2 gap-2">
            <div className="space-y-1">
              <Label className="text-[10px] text-muted-foreground uppercase">
                {t("fields.width")}
              </Label>
              <Input
                type="number"
                step="1"
                min={1}
                value={layout.canvas_width_m}
                onChange={(e) => {
                  const v = parseFloat(e.target.value);
                  if (v > 0) onLayoutMetaChange({ canvas_width_m: v });
                }}
                className="h-8 text-xs font-mono"
              />
            </div>
            <div className="space-y-1">
              <Label className="text-[10px] text-muted-foreground uppercase">
                {t("fields.height")}
              </Label>
              <Input
                type="number"
                step="1"
                min={1}
                value={layout.canvas_height_m}
                onChange={(e) => {
                  const v = parseFloat(e.target.value);
                  if (v > 0) onLayoutMetaChange({ canvas_height_m: v });
                }}
                className="h-8 text-xs font-mono"
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
