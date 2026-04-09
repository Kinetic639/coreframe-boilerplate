"use client";

import React from "react";
import {
  Trash2,
  Copy,
  Info,
  Grid3x3,
  Magnet,
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
import type { WarehouseLocation } from "@/lib/warehouse/location-tree";

// ─── Alignment type ───────────────────────────────────────────────────────────

export type AlignType =
  | "left"
  | "right"
  | "top"
  | "bottom"
  | "center-h"
  | "center-v"
  | "distribute-h"
  | "distribute-v";

// ─── Props ────────────────────────────────────────────────────────────────────

interface ShapeInspectorProps {
  selectedShapes: WarehouseLayoutShape[];
  layout: WarehouseLayout;
  locations: WarehouseLocation[];
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
    patch: { name?: string; code?: string | null; color?: string | null }
  ) => void;
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
}: {
  style: ShapeStyle | null;
  onStyleChange: (patch: Partial<ShapeStyle>) => void;
}) {
  const labelColor = style?.labelColor ?? "#475569";
  const labelSize = style?.labelSize ?? 0.35;
  const activeH = style?.labelAlignH ?? "left";
  const activeV = style?.labelAlignV ?? "top";

  return (
    <div className="space-y-3 pt-3 border-t">
      <Label className="text-[10px] uppercase text-muted-foreground font-semibold">
        Code Label
      </Label>

      {/* Color + Size row */}
      <div className="flex items-center gap-3">
        <div className="flex items-center gap-1.5 flex-1">
          <Label className="text-[10px] text-muted-foreground shrink-0">Color</Label>
          <input
            type="color"
            value={labelColor}
            onChange={(e) => onStyleChange({ labelColor: e.target.value })}
            className="w-7 h-7 rounded border cursor-pointer p-0.5"
          />
        </div>
        <div className="flex items-center gap-1.5 flex-1">
          <Label htmlFor="label-size" className="text-[10px] text-muted-foreground shrink-0">
            Size
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
        <Label className="text-[10px] text-muted-foreground">Position</Label>
        <div className="grid grid-cols-3 gap-1 w-full">
          {ALIGN_GRID.map(({ h, v }) => {
            const isActive = h === activeH && v === activeV;
            return (
              <button
                key={`${h}-${v}`}
                type="button"
                title={`${v} ${h}`}
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

// ─── Component ────────────────────────────────────────────────────────────────

export function ShapeInspector({
  selectedShapes,
  layout,
  locations,
  showGrid,
  snapToGrid,
  gridIntervalM,
  onToggleGrid,
  onToggleSnap,
  onGridIntervalChange,
  onShapeGeometryChange,
  onUpdateLocation,
  onDeleteShape,
  onDeleteShapes,
  onCloneShape,
  onAlignShapes,
  onLayoutMetaChange,
}: ShapeInspectorProps) {
  // Convenience for single-selection paths
  const selectedShape = selectedShapes.length === 1 ? selectedShapes[0] : null;
  const isMulti = selectedShapes.length > 1;
  const style = selectedShape?.style as ShapeStyle | null;

  // The linked warehouse_location for the selected shape (location shapes only)
  const linkedLocation =
    selectedShape?.shape_type === "location" && selectedShape.location_id
      ? (locations.find((l) => l.id === selectedShape.location_id) ?? null)
      : null;

  // Local edit state for name/code/color — synced from linkedLocation when selection changes
  const [locName, setLocName] = React.useState(linkedLocation?.name ?? "");
  const [locCode, setLocCode] = React.useState(linkedLocation?.code ?? "");
  const [locColor, setLocColor] = React.useState(linkedLocation?.color ?? "#10b981");

  React.useEffect(() => {
    setLocName(linkedLocation?.name ?? "");
    setLocCode(linkedLocation?.code ?? "");
    setLocColor(linkedLocation?.color ?? "#10b981");
  }, [linkedLocation?.id]); // reset only when a different location is selected

  return (
    <div className="w-72 h-full border-l bg-background flex flex-col shrink-0 overflow-hidden">
      {/* Header */}
      <div className="px-4 py-3 border-b bg-muted/50 flex items-center justify-between shrink-0">
        <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">
          Inspector
        </span>
        {isMulti && (
          <div className="flex items-center gap-1">
            <span className="text-[10px] text-muted-foreground">
              {selectedShapes.length} selected
            </span>
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7 text-muted-foreground hover:text-destructive hover:bg-destructive/10"
              onClick={() => onDeleteShapes(selectedShapes.map((s) => s.id))}
              title="Delete selected shapes"
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
                title="Clone location"
              >
                <Copy className="w-3.5 h-3.5" />
              </Button>
            )}
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7 text-muted-foreground hover:text-destructive hover:bg-destructive/10"
              onClick={() => onDeleteShape(selectedShape.id)}
              title="Delete shape"
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
                Align
              </Label>
              <div className="space-y-1">
                <p className="text-[10px] text-muted-foreground">Horizontal</p>
                <div className="flex items-center gap-0.5">
                  <AlignBtn
                    icon={AlignStartVertical}
                    title="Align left edges"
                    onClick={() => onAlignShapes("left")}
                  />
                  <AlignBtn
                    icon={AlignCenterVertical}
                    title="Center horizontally"
                    onClick={() => onAlignShapes("center-h")}
                  />
                  <AlignBtn
                    icon={AlignEndVertical}
                    title="Align right edges"
                    onClick={() => onAlignShapes("right")}
                  />
                  {selectedShapes.length >= 3 && (
                    <AlignBtn
                      icon={AlignHorizontalSpaceAround}
                      title="Distribute horizontally"
                      onClick={() => onAlignShapes("distribute-h")}
                    />
                  )}
                </div>
              </div>
              <div className="space-y-1">
                <p className="text-[10px] text-muted-foreground">Vertical</p>
                <div className="flex items-center gap-0.5">
                  <AlignBtn
                    icon={AlignStartHorizontal}
                    title="Align top edges"
                    onClick={() => onAlignShapes("top")}
                  />
                  <AlignBtn
                    icon={AlignCenterHorizontal}
                    title="Center vertically"
                    onClick={() => onAlignShapes("center-v")}
                  />
                  <AlignBtn
                    icon={AlignEndHorizontal}
                    title="Align bottom edges"
                    onClick={() => onAlignShapes("bottom")}
                  />
                  {selectedShapes.length >= 3 && (
                    <AlignBtn
                      icon={AlignVerticalSpaceAround}
                      title="Distribute vertically"
                      onClick={() => onAlignShapes("distribute-v")}
                    />
                  )}
                </div>
              </div>
            </div>

            {/* Label style — shown when all selected shapes are location shapes */}
            {selectedShapes.every((s) => s.shape_type === "location") && (
              <LabelStyleSection
                style={selectedShapes[0].style as ShapeStyle | null}
                onStyleChange={(patch) => {
                  selectedShapes.forEach((s) => {
                    const shapeStyle = s.style as ShapeStyle | null;
                    onShapeGeometryChange(s.id, { style: { ...(shapeStyle ?? {}), ...patch } });
                  });
                }}
              />
            )}

            <p className="text-[10px] text-muted-foreground pt-1 border-t">
              Shift+click shapes to add or remove from selection.
            </p>
          </div>
        ) : !selectedShape ? (
          <div className="flex flex-col items-center justify-center py-8 text-center text-muted-foreground">
            <Info className="w-10 h-10 mb-3 opacity-20" />
            <p className="text-xs">Select a shape to inspect its properties.</p>
            <p className="text-[10px] mt-1 opacity-60">Shift+click to select multiple.</p>
          </div>
        ) : (
          <>
            {/* Type badge */}
            <div>
              <Label className="text-[10px] uppercase text-muted-foreground font-semibold">
                Type
              </Label>
              <p className="mt-1 text-sm font-medium capitalize">{selectedShape.shape_type}</p>
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
                      Name
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
                      placeholder="Location name"
                      className="h-8 text-sm"
                    />
                  </div>
                  <div className="space-y-1">
                    <Label
                      htmlFor="loc-code"
                      className="text-[10px] uppercase text-muted-foreground font-semibold"
                    >
                      Code
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
                      placeholder="e.g. A-01"
                      className="h-8 text-xs font-mono"
                    />
                    <p className="text-[10px] text-muted-foreground">
                      Letters, numbers, hyphens, underscores
                    </p>
                  </div>
                  <div className="space-y-1">
                    <Label
                      htmlFor="loc-color"
                      className="text-[10px] uppercase text-muted-foreground font-semibold"
                    >
                      Color
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
                        className="w-8 h-8 rounded border cursor-pointer p-0.5"
                      />
                      <span className="text-xs font-mono text-muted-foreground">{locColor}</span>
                    </div>
                  </div>
                </div>
                <LabelStyleSection
                  style={style}
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
                    Label
                  </Label>
                  <Input
                    id="shape-label"
                    value={selectedShape.label ?? ""}
                    onChange={(e) =>
                      onShapeGeometryChange(selectedShape.id, { label: e.target.value || null })
                    }
                    placeholder="No label"
                    className="h-8 text-sm"
                  />
                </div>
                {selectedShape.shape_type === "label" && (
                  <div className="space-y-1">
                    <Label
                      htmlFor="shape-fontsize"
                      className="text-[10px] uppercase text-muted-foreground font-semibold"
                    >
                      Font size (m)
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
                Geometry (meters)
              </Label>
              <div className="grid grid-cols-2 gap-2">
                {(["x", "y", "width", "height"] as const).map((field) => (
                  <div key={field} className="space-y-1">
                    <Label
                      htmlFor={`shape-${field}`}
                      className="text-[10px] text-muted-foreground uppercase"
                    >
                      {field}
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
                  Rotation (°)
                </Label>
                <Input
                  id="shape-rotation"
                  type="number"
                  step="1"
                  value={selectedShape.rotation.toFixed(0)}
                  onChange={(e) => {
                    const v = parseFloat(e.target.value);
                    if (!isNaN(v)) onShapeGeometryChange(selectedShape.id, { rotation: v });
                  }}
                  className="h-8 text-xs font-mono"
                />
              </div>
            </div>

            {/* Style — not shown for location shapes (color is controlled above) */}
            {selectedShape.shape_type !== "label" && selectedShape.shape_type !== "location" && (
              <div className="space-y-2 pt-3 border-t">
                <Label className="text-[10px] uppercase text-muted-foreground font-semibold">
                  Style
                </Label>
                <div className="flex items-center gap-3">
                  <Label
                    htmlFor="shape-fill"
                    className="text-xs text-muted-foreground w-10 shrink-0"
                  >
                    Fill
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
                    Stroke
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
            <Grid3x3 className="w-3 h-3" /> Grid
          </Label>
          <div className="flex items-center justify-between">
            <Label className="text-xs text-muted-foreground">Show grid</Label>
            <Switch checked={showGrid} onCheckedChange={onToggleGrid} />
          </div>
          <div className="flex items-center justify-between">
            <Label className="text-xs text-muted-foreground flex items-center gap-1">
              <Magnet className="w-3 h-3" /> Snap to grid
            </Label>
            <Switch checked={snapToGrid} onCheckedChange={onToggleSnap} />
          </div>
          {showGrid && (
            <div className="flex items-center justify-between">
              <Label className="text-xs text-muted-foreground">Grid size</Label>
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
            Canvas Size (m)
          </Label>
          <div className="grid grid-cols-2 gap-2">
            <div className="space-y-1">
              <Label className="text-[10px] text-muted-foreground uppercase">Width</Label>
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
              <Label className="text-[10px] text-muted-foreground uppercase">Height</Label>
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
