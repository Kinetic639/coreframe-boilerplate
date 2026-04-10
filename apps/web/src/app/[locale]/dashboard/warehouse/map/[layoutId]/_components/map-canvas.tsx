"use client";

import React from "react";
import { useTranslations } from "next-intl";
import { Stage, Layer, Rect, Group, Text, Line, Transformer } from "react-konva";
import { ZoomIn, ZoomOut, Maximize2 } from "lucide-react";
import type { WarehouseLayoutShape, ShapeType, ShapeStyle } from "@/lib/warehouse/layouts";
import type { WarehouseLocation } from "@/lib/warehouse/location-tree";
import { useIsDark } from "@/hooks/use-css-var";

/**
 * Derive a translucent fill from a location's hex color.
 * Exported so callers (map-editor, viewer) can reuse the same formula.
 */
export function locationColorToFill(hex: string): string {
  if (!hex || !hex.startsWith("#") || hex.length < 7) return "#d1fae5";
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `rgba(${r},${g},${b},0.2)`;
}

// ─── Constants ────────────────────────────────────────────────────────────────

/** Base scale: 1 meter = 20 pixels at zoom 1.0 */
export const METER_TO_PIXEL = 20;

/** Default fill color per shape type */
const SHAPE_DEFAULTS: Record<ShapeType, { fill: string; stroke: string }> = {
  location: { fill: "#d1fae5", stroke: "#10b981" },
  wall: { fill: "#94a3b8", stroke: "#475569" },
  door: { fill: "#bfdbfe", stroke: "#3b82f6" },
  aisle: { fill: "#fef9c3", stroke: "#eab308" },
  zone: { fill: "#ede9fe", stroke: "#8b5cf6" },
  obstacle: { fill: "#fee2e2", stroke: "#ef4444" },
  label: { fill: "transparent", stroke: "transparent" },
};

// ─── Props ────────────────────────────────────────────────────────────────────

export interface MapCanvasProps {
  shapes: WarehouseLayoutShape[];
  locations?: WarehouseLocation[];
  canvasWidthM: number;
  canvasHeightM: number;
  selectedIds: string[];
  onSelectionChange: (ids: string[]) => void;
  onShapeDragEnd: (id: string, x: number, y: number) => void;
  onShapeTransformEnd: (
    id: string,
    x: number,
    y: number,
    width: number,
    height: number,
    rotation: number
  ) => void;
  onDropNewShape: (type: ShapeType, xM: number, yM: number, locationId: string | null) => void;
  showGrid: boolean;
  snapToGrid: boolean;
  gridIntervalM: number;
  canManage: boolean;
  /** Restore zoom/pan from before a preview-mode roundtrip */
  initialZoom?: number;
  initialPan?: { x: number; y: number };
  /** Called whenever zoom or pan changes so the parent can persist the viewport */
  onViewportChange?: (zoom: number, pan: { x: number; y: number }) => void;
  /** Shape IDs in the same group as the selected shape — rendered with a soft highlight ring */
  groupHighlightShapeIds?: Set<string>;
}

// ─── Component ────────────────────────────────────────────────────────────────

export function MapCanvas({
  shapes,
  locations,
  canvasWidthM,
  canvasHeightM,
  selectedIds,
  onSelectionChange,
  onShapeDragEnd,
  onShapeTransformEnd,
  onDropNewShape,
  showGrid,
  snapToGrid,
  gridIntervalM,
  canManage,
  initialZoom,
  initialPan,
  onViewportChange,
  groupHighlightShapeIds,
}: MapCanvasProps) {
  const t = useTranslations("warehouseMapCanvas");
  const containerRef = React.useRef<HTMLDivElement>(null);
  const stageRef = React.useRef<any>(null);
  const transformerRef = React.useRef<any>(null);
  const [dimensions, setDimensions] = React.useState({ width: 0, height: 0 });
  const [zoom, setZoom] = React.useState(initialZoom ?? 1);
  const [pan, setPan] = React.useState(initialPan ?? { x: 40, y: 40 });

  // Auto-fit once after the container is first measured (only when no saved viewport)
  const didAutoFit = React.useRef(false);
  React.useEffect(() => {
    if (didAutoFit.current) return;
    if (dimensions.width === 0 || dimensions.height === 0) return;
    didAutoFit.current = true;
    if (initialZoom !== undefined) return; // restore saved viewport as-is
    const padding = 3;
    const cw = canvasWidthM + padding * 2;
    const ch = canvasHeightM + padding * 2;
    const newZoom = Math.min(
      dimensions.width / (cw * METER_TO_PIXEL),
      dimensions.height / (ch * METER_TO_PIXEL),
      4
    );
    setZoom(newZoom);
    setPan({
      x: dimensions.width / 2 - (canvasWidthM / 2) * newZoom * METER_TO_PIXEL,
      y: dimensions.height / 2 - (canvasHeightM / 2) * newZoom * METER_TO_PIXEL,
    });
  }, [dimensions.width, dimensions.height, canvasWidthM, canvasHeightM, initialZoom]);

  // Keep parent informed of viewport changes (stored in a ref to avoid stale closures)
  const onViewportChangeRef = React.useRef(onViewportChange);
  onViewportChangeRef.current = onViewportChange;
  React.useEffect(() => {
    onViewportChangeRef.current?.(zoom, pan);
  }, [zoom, pan]);

  const isDark = useIsDark();
  const hasMeasuredViewport = dimensions.width > 0 && dimensions.height > 0;
  // Canvas is a physical floor plan — always needs clear contrast against its surround.
  // Light: white canvas on zinc-200 surround. Dark: near-black canvas on zinc-900 surround.
  const canvasBg = isDark ? "#18181b" : "#ffffff"; // zinc-950 / white
  const canvasBorder = isDark ? "#3f3f46" : "#94a3b8"; // zinc-700 / slate-400
  const gridMajor = isDark ? "#52525b" : "#94a3b8"; // zinc-600 / slate-400  — clearly visible
  const gridMinor = isDark ? "#2d2d33" : "#e2e8f0"; // zinc-850ish / slate-200 — subtle but present

  // ── Resize observer ────────────────────────────────────────────────────────
  React.useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const obs = new ResizeObserver(() => {
      setDimensions({ width: el.offsetWidth, height: el.offsetHeight });
    });
    obs.observe(el);
    setDimensions({ width: el.offsetWidth, height: el.offsetHeight });
    return () => obs.disconnect();
  }, []);

  // ── Attach Transformer to selected shape (single only — multi shows highlight only) ──
  React.useEffect(() => {
    if (!transformerRef.current) return;
    if (selectedIds.length !== 1 || !canManage) {
      transformerRef.current.nodes([]);
      return;
    }
    const stage = transformerRef.current.getStage();
    const node = stage?.findOne(`#shape-${selectedIds[0]}`);
    if (node) {
      transformerRef.current.nodes([node]);
      transformerRef.current.getLayer()?.batchDraw();
    } else {
      transformerRef.current.nodes([]);
    }
  }, [selectedIds, shapes, zoom, canManage]);

  // ── Zoom helpers ──────────────────────────────────────────────────────────
  const snap = (v: number) => (snapToGrid ? Math.round(v / gridIntervalM) * gridIntervalM : v);

  const handleWheel = (e: any) => {
    e.evt.preventDefault();
    const scaleBy = 1.12;
    const stage = e.target.getStage();
    const pointer = stage.getPointerPosition();
    const oldZoom = zoom;
    const newZoom = Math.max(
      0.05,
      Math.min(e.evt.deltaY < 0 ? oldZoom * scaleBy : oldZoom / scaleBy, 20)
    );
    const mousePointTo = {
      x: (pointer.x - pan.x) / (oldZoom * METER_TO_PIXEL),
      y: (pointer.y - pan.y) / (oldZoom * METER_TO_PIXEL),
    };
    setZoom(newZoom);
    setPan({
      x: pointer.x - mousePointTo.x * newZoom * METER_TO_PIXEL,
      y: pointer.y - mousePointTo.y * newZoom * METER_TO_PIXEL,
    });
  };

  const zoomAtCenter = (factor: number) => {
    const oldZoom = zoom;
    const newZoom = Math.max(0.05, Math.min(oldZoom * factor, 20));
    const cx = dimensions.width / 2;
    const cy = dimensions.height / 2;
    const mousePointTo = {
      x: (cx - pan.x) / (oldZoom * METER_TO_PIXEL),
      y: (cy - pan.y) / (oldZoom * METER_TO_PIXEL),
    };
    setZoom(newZoom);
    setPan({
      x: cx - mousePointTo.x * newZoom * METER_TO_PIXEL,
      y: cy - mousePointTo.y * newZoom * METER_TO_PIXEL,
    });
  };

  const fitToCanvas = () => {
    const padding = 3; // meters
    const w = canvasWidthM + padding * 2;
    const h = canvasHeightM + padding * 2;
    const newZoom = Math.min(
      dimensions.width / (w * METER_TO_PIXEL),
      dimensions.height / (h * METER_TO_PIXEL),
      4
    );
    setZoom(newZoom);
    setPan({
      x: dimensions.width / 2 - (canvasWidthM / 2) * newZoom * METER_TO_PIXEL,
      y: dimensions.height / 2 - (canvasHeightM / 2) * newZoom * METER_TO_PIXEL,
    });
  };

  // ── Drop from toolbox ────────────────────────────────────────────────────
  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    const type = e.dataTransfer.getData("shapeType") as ShapeType;
    if (!type || !stageRef.current) return;
    // locationId is only set when dragging a location chip from the toolbox.
    // getData() is safe to call here (drop handler) — returns "" when absent.
    const rawLocationId = e.dataTransfer.getData("locationId");
    const locationId = rawLocationId || null;
    stageRef.current.setPointersPositions(e);
    const pos = stageRef.current.getPointerPosition();
    if (!pos) return;
    const xM = snap((pos.x - pan.x) / (zoom * METER_TO_PIXEL));
    const yM = snap((pos.y - pan.y) / (zoom * METER_TO_PIXEL));
    onDropNewShape(type, xM, yM, locationId);
  };

  // ── Grid rendering ────────────────────────────────────────────────────────
  const renderGrid = () => {
    if (!showGrid) return null;
    const lines: React.ReactNode[] = [];
    const sw = 1 / (zoom * METER_TO_PIXEL); // 1px on screen
    for (let x = 0; x <= canvasWidthM + 0.001; x += gridIntervalM) {
      lines.push(
        <Line
          key={`gv-${x}`}
          points={[x, 0, x, canvasHeightM]}
          stroke={Math.abs(x % 5) < 0.001 ? gridMajor : gridMinor}
          strokeWidth={sw}
          listening={false}
        />
      );
    }
    for (let y = 0; y <= canvasHeightM + 0.001; y += gridIntervalM) {
      lines.push(
        <Line
          key={`gh-${y}`}
          points={[0, y, canvasWidthM, y]}
          stroke={Math.abs(y % 5) < 0.001 ? gridMajor : gridMinor}
          strokeWidth={sw}
          listening={false}
        />
      );
    }
    return <>{lines}</>;
  };

  // ── Shape rendering ───────────────────────────────────────────────────────
  const renderShape = (shape: WarehouseLayoutShape) => {
    const defaults = SHAPE_DEFAULTS[shape.shape_type];
    const style = shape.style as ShapeStyle | null;
    // For location shapes: derive fill/stroke from the linked location's color
    // so the canvas always reflects the current location color.
    const locColor =
      shape.shape_type === "location" && shape.location_id
        ? (locations?.find((l) => l.id === shape.location_id)?.color ?? null)
        : null;
    const fill = locColor ? locationColorToFill(locColor) : (style?.fill ?? defaults.fill);
    const stroke = locColor ?? style?.stroke ?? defaults.stroke;
    const strokeWidth = (style?.strokeWidth ?? 1) / (zoom * METER_TO_PIXEL);
    const isSelected = selectedIds.includes(shape.id);
    const isGroupHighlighted = !isSelected && (groupHighlightShapeIds?.has(shape.id) ?? false);
    const isDraggable = canManage && isSelected && selectedIds.length === 1;

    // ── Shared transform handler ─────────────────────────────────────────────
    // The Transformer is attached to the Group (id="shape-{id}"). Konva fires
    // transformend on the Group, not on children, so this handler MUST be on
    // the Group. Key rules:
    //   1. Read x/y BEFORE resetting anything — node.x(0) would clear them.
    //   2. Compute width/height from shape state × scale, NOT node.width() —
    //      Group.width() returns 0 when not explicitly set.
    //   3. Reset scaleX/scaleY to 1 so transforms don't accumulate.
    //   4. Clamp final geometry to canvas boundaries.
    const handleTransformEnd = (e: any) => {
      const node = e.target; // = the Group
      const scaleX = node.scaleX();
      const scaleY = node.scaleY();
      const newWidth = snap(Math.max(0.1, shape.width * scaleX));
      const newHeight = snap(Math.max(0.1, shape.height * scaleY));
      // Clamp position so the shape stays inside the canvas after resize
      const newX = snap(Math.max(0, Math.min(canvasWidthM - newWidth, node.x())));
      const newY = snap(Math.max(0, Math.min(canvasHeightM - newHeight, node.y())));
      const newRot = node.rotation();
      node.scaleX(1);
      node.scaleY(1);
      onShapeTransformEnd(shape.id, newX, newY, newWidth, newHeight, newRot);
    };

    // Clamp a dragged position to keep the shape fully within the canvas.
    // dragBoundFunc receives/returns ABSOLUTE screen-pixel positions.
    const dragBoundFunc = (pos: { x: number; y: number }) => {
      const scale = zoom * METER_TO_PIXEL;
      return {
        x: Math.min(Math.max(pos.x, pan.x), pan.x + (canvasWidthM - shape.width) * scale),
        y: Math.min(Math.max(pos.y, pan.y), pan.y + (canvasHeightM - shape.height) * scale),
      };
    };

    const handleShapeClick = (e: any) => {
      e.cancelBubble = true;
      if (e.evt?.shiftKey) {
        // Shift+click: toggle in multi-selection
        onSelectionChange(
          selectedIds.includes(shape.id)
            ? selectedIds.filter((id) => id !== shape.id)
            : [...selectedIds, shape.id]
        );
      } else {
        onSelectionChange([shape.id]);
      }
    };

    if (shape.shape_type === "label") {
      return (
        <Group
          key={shape.id}
          id={`shape-${shape.id}`}
          x={shape.x}
          y={shape.y}
          rotation={shape.rotation}
          draggable={isDraggable}
          dragBoundFunc={isDraggable ? dragBoundFunc : undefined}
          onClick={handleShapeClick}
          onTap={handleShapeClick}
          onDragEnd={(e) => {
            const x = snap(Math.max(0, Math.min(canvasWidthM - shape.width, e.target.x())));
            const y = snap(Math.max(0, Math.min(canvasHeightM - shape.height, e.target.y())));
            onShapeDragEnd(shape.id, x, y);
          }}
          onTransformEnd={handleTransformEnd}
        >
          <Text
            text={shape.label ?? t("defaultLabel")}
            fontSize={style?.fontSize ?? 0.8}
            fontFamily="sans-serif"
            fontStyle={style?.fontWeight ?? "normal"}
            fill={style?.textColor ?? "#1e293b"}
            listening={true}
          />
        </Group>
      );
    }

    return (
      <Group
        key={shape.id}
        id={`shape-${shape.id}`}
        x={shape.x}
        y={shape.y}
        rotation={shape.rotation}
        draggable={isDraggable}
        dragBoundFunc={isDraggable ? dragBoundFunc : undefined}
        onClick={handleShapeClick}
        onTap={handleShapeClick}
        onDragEnd={(e) => {
          const x = snap(Math.max(0, Math.min(canvasWidthM - shape.width, e.target.x())));
          const y = snap(Math.max(0, Math.min(canvasHeightM - shape.height, e.target.y())));
          onShapeDragEnd(shape.id, x, y);
        }}
        onTransformEnd={handleTransformEnd}
      >
        <Rect
          x={0}
          y={0}
          width={shape.width}
          height={shape.height}
          fill={fill}
          stroke={isSelected ? "#2563eb" : stroke}
          strokeWidth={isSelected ? strokeWidth * 2 : strokeWidth}
          cornerRadius={(style?.cornerRadius ?? 0) / (zoom * METER_TO_PIXEL)}
          shadowBlur={isSelected ? 0.15 : 0}
          shadowColor="rgba(37,99,235,0.4)"
        />
        {isGroupHighlighted && (
          <Rect
            x={-strokeWidth * 2}
            y={-strokeWidth * 2}
            width={shape.width + strokeWidth * 4}
            height={shape.height + strokeWidth * 4}
            fill="transparent"
            stroke={stroke}
            strokeWidth={strokeWidth * 1.5}
            opacity={0.4}
            dash={[strokeWidth * 4, strokeWidth * 3]}
            cornerRadius={(style?.cornerRadius ?? 0) / (zoom * METER_TO_PIXEL)}
            listening={false}
          />
        )}
        {shape.shape_type === "location" && (
          <Text
            x={0}
            y={0}
            width={shape.width}
            height={shape.height}
            padding={0.05}
            text={shape.label ?? ""}
            fontSize={style?.labelSize ?? 0.35}
            fontFamily="monospace"
            fill={style?.labelColor ?? (isSelected ? "#1d4ed8" : "#475569")}
            align={style?.labelAlignH ?? "left"}
            verticalAlign={
              (style?.labelAlignV ?? "top") === "center" ? "middle" : (style?.labelAlignV ?? "top")
            }
            wrap="none"
            ellipsis={false}
            listening={false}
          />
        )}
        {shape.shape_type === "zone" && shape.label && (
          <Text
            x={0.1}
            y={0.1}
            text={shape.label}
            fontSize={0.4}
            fontFamily="sans-serif"
            fill={isSelected ? "#5b21b6" : "#6d28d9"}
            listening={false}
          />
        )}
      </Group>
    );
  };

  return (
    <div
      ref={containerRef}
      className="min-w-0 flex-1 h-full bg-zinc-200 dark:bg-zinc-900 overflow-hidden relative"
      onDrop={canManage ? handleDrop : undefined}
      onDragOver={
        canManage
          ? (e) => {
              e.preventDefault();
              e.dataTransfer.dropEffect = "copy";
            }
          : undefined
      }
    >
      {hasMeasuredViewport ? (
        <Stage
          ref={stageRef}
          width={dimensions.width}
          height={dimensions.height}
          scaleX={zoom * METER_TO_PIXEL}
          scaleY={zoom * METER_TO_PIXEL}
          x={pan.x}
          y={pan.y}
          draggable
          onWheel={handleWheel}
          onDragEnd={(e) => {
            if (e.target === e.target.getStage()) {
              setPan({ x: e.target.x(), y: e.target.y() });
            }
          }}
          onClick={(e) => {
            if (e.target === e.target.getStage()) onSelectionChange([]);
          }}
          onTap={(e) => {
            if (e.target === e.target.getStage()) onSelectionChange([]);
          }}
        >
          <Layer>
            {/* Canvas background */}
            <Rect
              x={0}
              y={0}
              width={canvasWidthM}
              height={canvasHeightM}
              fill={canvasBg}
              stroke={canvasBorder}
              strokeWidth={2 / (zoom * METER_TO_PIXEL)}
              shadowBlur={0.5}
              shadowColor="rgba(0,0,0,0.2)"
              onClick={() => onSelectionChange([])}
            />

            {renderGrid()}

            {/* Shapes sorted by z_index */}
            {[...shapes]
              .sort((a, b) => a.z_index - b.z_index || a.sort_order - b.sort_order)
              .map(renderShape)}

            <Transformer
              ref={transformerRef}
              boundBoxFunc={(oldBox, newBox) => {
                const scale = zoom * METER_TO_PIXEL;
                const minSize = 0.1 * scale;
                // Reject below-minimum size
                if (newBox.width < minSize || newBox.height < minSize) return oldBox;
                // Reject if any edge crosses the canvas boundary (screen pixels)
                const canvasRight = pan.x + canvasWidthM * scale;
                const canvasBottom = pan.y + canvasHeightM * scale;
                if (newBox.x < pan.x || newBox.y < pan.y) return oldBox;
                if (
                  newBox.x + newBox.width > canvasRight ||
                  newBox.y + newBox.height > canvasBottom
                )
                  return oldBox;
                return newBox;
              }}
              anchorSize={7}
              anchorCornerRadius={2}
              anchorStroke="#2563eb"
              anchorFill="white"
              borderStroke="#2563eb"
              borderStrokeWidth={1.5}
              keepRatio={false}
              rotateEnabled={true}
            />
          </Layer>
        </Stage>
      ) : null}

      {/* Zoom controls */}
      <div className="absolute top-3 left-3 flex flex-col gap-1">
        <div className="bg-background rounded-lg border shadow-sm flex flex-col overflow-hidden">
          <button
            onClick={() => zoomAtCenter(1.25)}
            className="p-2 hover:bg-muted text-muted-foreground border-b transition-colors"
            title={t("actions.zoomIn")}
          >
            <ZoomIn className="w-4 h-4" />
          </button>
          <button
            onClick={() => zoomAtCenter(0.8)}
            className="p-2 hover:bg-muted text-muted-foreground border-b transition-colors"
            title={t("actions.zoomOut")}
          >
            <ZoomOut className="w-4 h-4" />
          </button>
          <button
            onClick={fitToCanvas}
            className="p-2 hover:bg-muted text-muted-foreground transition-colors"
            title={t("actions.fitToCanvas")}
          >
            <Maximize2 className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Status bar */}
      <div className="absolute bottom-3 right-3 bg-background/90 backdrop-blur-sm px-3 py-1.5 rounded-full border shadow-sm flex gap-3 text-[10px] font-mono text-muted-foreground items-center">
        <span>
          <span className="opacity-50">{t("status.zoom")} </span>
          <span className="font-bold text-foreground">{(zoom * 100).toFixed(0)}%</span>
        </span>
        <div className="w-px h-3 bg-border" />
        <span>
          <span className="opacity-50">{t("status.grid")} </span>
          <span className="font-bold text-foreground">{gridIntervalM}m</span>
        </span>
        <div className="w-px h-3 bg-border" />
        <span>
          <span className="opacity-50">{t("status.canvas")} </span>
          <span className="font-bold text-foreground">
            {canvasWidthM}×{canvasHeightM}m
          </span>
        </span>
      </div>
    </div>
  );
}
