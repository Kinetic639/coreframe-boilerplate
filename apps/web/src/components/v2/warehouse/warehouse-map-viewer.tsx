"use client";

import React from "react";
import { Stage, Layer, Rect, Group, Text } from "react-konva";
import type {
  WarehouseLayoutWithShapes,
  WarehouseLayoutShape,
  ShapeStyle,
  ShapeType,
} from "@/lib/warehouse/layouts";
import type { WarehouseLocation } from "@/lib/warehouse/location-tree";
import {
  METER_TO_PIXEL,
  locationColorToFill,
} from "@/app/[locale]/dashboard/warehouse/map/[layoutId]/_components/map-canvas";
import { useIsDark } from "@/hooks/use-css-var";

// ─── Shape type colors (read-only, same palette as editor) ───────────────────

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

export interface WarehouseMapViewerProps {
  layout: WarehouseLayoutWithShapes;
  /** Optional locations list — used to derive fill/stroke from location.color live. */
  locations?: WarehouseLocation[];
  /** The location_id to highlight (pulses with a blue border). */
  highlightLocationId?: string | null;
  /**
   * When true (default) the viewer auto-pans to the highlighted shape each
   * time highlightLocationId changes — useful for the dialog "where is this?"
   * use-case. Set to false when the viewer should stay fitted to the whole
   * canvas and only highlight visually without jumping (preview panel).
   */
  autoPanToHighlight?: boolean;
  /**
   * When true, all shapes except the highlighted one are rendered in grayscale.
   * The highlighted shape is shown in its full color. Requires highlightLocationId.
   */
  monochromaticHighlight?: boolean;
  className?: string;
  /** Called when the user clicks a shape */
  onShapeClick?: (shape: WarehouseLayoutShape) => void;
}

// ─── Component ────────────────────────────────────────────────────────────────

export function WarehouseMapViewer({
  layout,
  locations,
  highlightLocationId,
  autoPanToHighlight = true,
  monochromaticHighlight = false,
  className = "",
  onShapeClick,
}: WarehouseMapViewerProps) {
  const containerRef = React.useRef<HTMLDivElement>(null);
  const [dimensions, setDimensions] = React.useState({ width: 600, height: 400 });
  const [zoom, setZoom] = React.useState(1);
  const [pan, setPan] = React.useState({ x: 40, y: 40 });
  const [tick, setTick] = React.useState(0); // drives highlight pulse animation

  const isDark = useIsDark();
  const canvasBg = isDark ? "#18181b" : "#ffffff";
  const canvasBorder = isDark ? "#3f3f46" : "#94a3b8";
  const hasMeasuredViewport = dimensions.width > 0 && dimensions.height > 0;

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

  // ── Pulse animation for highlighted shape ─────────────────────────────────
  React.useEffect(() => {
    if (!highlightLocationId) return;
    const id = setInterval(() => setTick((t) => t + 1), 600);
    return () => clearInterval(id);
  }, [highlightLocationId]);

  // ── Fit whole canvas to viewport (runs on mount + resize) ─────────────────
  const fitCanvas = React.useCallback(
    (w: number, h: number) => {
      if (w === 0 || h === 0) return;
      const padding = 3;
      const tw = layout.canvas_width_m + padding * 2;
      const th = layout.canvas_height_m + padding * 2;
      const newZoom = Math.min(w / (tw * METER_TO_PIXEL), h / (th * METER_TO_PIXEL), 3);
      setZoom(newZoom);
      setPan({
        x: w / 2 - (layout.canvas_width_m / 2) * newZoom * METER_TO_PIXEL,
        y: h / 2 - (layout.canvas_height_m / 2) * newZoom * METER_TO_PIXEL,
      });
    },
    [layout.canvas_width_m, layout.canvas_height_m]
  );

  // Refit when dimensions or layout size changes
  React.useEffect(() => {
    fitCanvas(dimensions.width, dimensions.height);
  }, [dimensions, fitCanvas]);

  // ── Auto-pan to highlighted shape (only when autoPanToHighlight=true) ──────
  React.useEffect(() => {
    if (!autoPanToHighlight || !highlightLocationId || dimensions.width === 0) return;
    const highlighted = layout.shapes.find((s) => s.location_id === highlightLocationId);
    if (!highlighted) return;
    const margin = 8;
    const targetX = Math.max(0, highlighted.x - margin);
    const targetY = Math.max(0, highlighted.y - margin);
    const targetW = highlighted.width + margin * 2;
    const targetH = highlighted.height + margin * 2;
    const padding = 3;
    const w = targetW + padding * 2;
    const h = targetH + padding * 2;
    const newZoom = Math.min(
      dimensions.width / (w * METER_TO_PIXEL),
      dimensions.height / (h * METER_TO_PIXEL),
      3
    );
    setZoom(newZoom);
    setPan({
      x: dimensions.width / 2 - (targetX + targetW / 2) * newZoom * METER_TO_PIXEL,
      y: dimensions.height / 2 - (targetY + targetH / 2) * newZoom * METER_TO_PIXEL,
    });
  }, [autoPanToHighlight, highlightLocationId, dimensions, layout.shapes]);

  // ── Zoom on wheel (viewer is interactive) ─────────────────────────────────
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

  // ── Shape rendering ───────────────────────────────────────────────────────
  const monoFill = isDark ? "#27272a" : "#e5e7eb";
  const monoStroke = isDark ? "#3f3f46" : "#9ca3af";
  const isMonoActive = monochromaticHighlight && !!highlightLocationId;
  const sortedShapes = React.useMemo(() => {
    const base = [...layout.shapes].sort(
      (a, b) => a.z_index - b.z_index || a.sort_order - b.sort_order
    );
    if (!highlightLocationId) return base;

    const highlighted: WarehouseLayoutShape[] = [];
    const normal: WarehouseLayoutShape[] = [];

    for (const shape of base) {
      if (shape.location_id === highlightLocationId) {
        highlighted.push(shape);
      } else {
        normal.push(shape);
      }
    }

    return [...normal, ...highlighted];
  }, [layout.shapes, highlightLocationId]);

  const renderShape = (shape: WarehouseLayoutShape) => {
    const defaults = SHAPE_DEFAULTS[shape.shape_type];
    const style = shape.style as ShapeStyle | null;
    // Prefer live location color, then persisted shape.style, then default
    const locColor =
      shape.shape_type === "location" && shape.location_id
        ? (locations?.find((l) => l.id === shape.location_id)?.color ?? null)
        : null;
    const fill = locColor ? locationColorToFill(locColor) : (style?.fill ?? defaults.fill);
    const stroke = locColor ?? style?.stroke ?? defaults.stroke;
    const sw = (style?.strokeWidth ?? 1) / (zoom * METER_TO_PIXEL);

    const isHighlighted = shape.location_id === highlightLocationId && !!highlightLocationId;
    // In monochromatic mode: non-highlighted shapes go gray; highlighted shape gets its full color.
    // In normal mode: highlighted shape pulses with a blue border.
    const effectiveFill = isMonoActive && !isHighlighted ? monoFill : fill;
    const effectiveStroke = isMonoActive
      ? isHighlighted
        ? stroke
        : monoStroke
      : isHighlighted
        ? "#2563eb"
        : stroke;
    // Pulse only in normal (non-mono) mode
    const pulseStrokeWidth =
      !isMonoActive && isHighlighted ? (tick % 2 === 0 ? sw * 4 : sw * 2) : sw;

    if (shape.shape_type === "label") {
      const labelColor =
        isMonoActive && !isHighlighted
          ? isDark
            ? "#52525b"
            : "#9ca3af"
          : (style?.textColor ?? "#1e293b");
      return (
        <Group
          key={shape.id}
          x={shape.x}
          y={shape.y}
          onClick={onShapeClick ? () => onShapeClick(shape) : undefined}
        >
          <Text
            text={shape.label ?? ""}
            fontSize={style?.fontSize ?? 0.8}
            fontFamily="sans-serif"
            fill={labelColor}
          />
        </Group>
      );
    }

    return (
      <Group
        key={shape.id}
        x={shape.x}
        y={shape.y}
        onClick={
          onShapeClick
            ? (e) => {
                e.cancelBubble = true;
                onShapeClick(shape);
              }
            : undefined
        }
      >
        <Rect
          width={shape.width}
          height={shape.height}
          rotation={shape.rotation}
          fill={effectiveFill}
          stroke={effectiveStroke}
          strokeWidth={pulseStrokeWidth}
          cornerRadius={(style?.cornerRadius ?? 0) / (zoom * METER_TO_PIXEL)}
          shadowBlur={isHighlighted && !isMonoActive ? 0.3 : 0}
          shadowColor="rgba(37,99,235,0.5)"
        />
        {shape.label && shape.shape_type !== "wall" && (
          <Text
            x={0.05}
            y={0.05}
            text={shape.label}
            fontSize={0.35}
            fontFamily={shape.shape_type === "location" ? "monospace" : "sans-serif"}
            fill={
              isMonoActive && !isHighlighted
                ? isDark
                  ? "#52525b"
                  : "#9ca3af"
                : isHighlighted
                  ? "#1d4ed8"
                  : "#475569"
            }
            listening={false}
          />
        )}
      </Group>
    );
  };

  return (
    <div ref={containerRef} className={`w-full h-full ${className}`}>
      {!hasMeasuredViewport ? null : (
        <Stage
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
        >
          <Layer>
            {/* Canvas background */}
            <Rect
              x={0}
              y={0}
              width={layout.canvas_width_m}
              height={layout.canvas_height_m}
              fill={canvasBg}
              stroke={canvasBorder}
              strokeWidth={1.5 / (zoom * METER_TO_PIXEL)}
            />

            {sortedShapes.map(renderShape)}
          </Layer>
        </Stage>
      )}
    </div>
  );
}
