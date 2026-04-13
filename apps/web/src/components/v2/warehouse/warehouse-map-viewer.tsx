"use client";

import React from "react";
import { Stage, Layer, Rect, Group, Text } from "react-konva";
import type {
  WarehouseLayoutWithShapes,
  WarehouseLayoutShape,
  ShapeStyle,
  ShapeType,
  WarehouseLayoutProjection,
} from "@/lib/warehouse/layouts";
import {
  getEffectiveLocationColor,
  type WarehouseLocation,
  type WarehouseLocationGroup,
} from "@/lib/warehouse/location-tree";
import {
  METER_TO_PIXEL,
  locationColorToFill,
} from "@/app/[locale]/dashboard/warehouse/map/[layoutId]/_components/map-canvas";
import { useIsDark } from "@/hooks/use-css-var";

function withAlpha(color: string, alphaHex: string) {
  if (!color.startsWith("#")) return color;
  const normalized =
    color.length === 4
      ? `#${color[1]}${color[1]}${color[2]}${color[2]}${color[3]}${color[3]}`
      : color;
  return normalized.length === 7 ? `${normalized}${alphaHex}` : normalized;
}

function getRotationOffsets(
  width: number,
  height: number,
  rotation: number
): { minX: number; maxX: number; minY: number; maxY: number } {
  const angle = (rotation * Math.PI) / 180;
  const cos = Math.cos(angle);
  const sin = Math.sin(angle);
  const corners = [
    { x: 0, y: 0 },
    { x: width, y: 0 },
    { x: 0, y: height },
    { x: width, y: height },
  ].map((corner) => ({
    x: corner.x * cos - corner.y * sin,
    y: corner.x * sin + corner.y * cos,
  }));

  return {
    minX: Math.min(...corners.map((corner) => corner.x)),
    maxX: Math.max(...corners.map((corner) => corner.x)),
    minY: Math.min(...corners.map((corner) => corner.y)),
    maxY: Math.max(...corners.map((corner) => corner.y)),
  };
}

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
  projection?: WarehouseLayoutProjection;
  /** Optional locations list — used to derive fill/stroke from location.color live. */
  locations?: WarehouseLocation[];
  locationGroups?: WarehouseLocationGroup[];
  /** The location_id to highlight (pulses with a blue border). */
  highlightLocationId?: string | null;
  /** Optional multi-highlight mode, used for grouped previews. */
  highlightLocationIds?: string[] | null;
  /** Optional explicit active ids for stitched front headers. */
  headerActiveLocationIds?: string[] | null;
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
  projection = "top_down",
  locations,
  locationGroups,
  highlightLocationId,
  highlightLocationIds,
  headerActiveLocationIds,
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
  const [hoveredLocationId, setHoveredLocationId] = React.useState<string | null>(null);
  const hasUserAdjustedCameraRef = React.useRef(false);
  const lastAutoFitKeyRef = React.useRef<string | null>(null);
  const effectiveHighlightIds = React.useMemo(() => {
    if (highlightLocationIds && highlightLocationIds.length > 0) {
      return [...new Set(highlightLocationIds)];
    }
    return highlightLocationId ? [highlightLocationId] : [];
  }, [highlightLocationId, highlightLocationIds]);
  const highlightIdSet = React.useMemo(
    () => new Set(effectiveHighlightIds),
    [effectiveHighlightIds]
  );
  const headerActiveIdSet = React.useMemo(
    () => new Set((headerActiveLocationIds ?? []).filter(Boolean)),
    [headerActiveLocationIds]
  );
  const hasHeaderActiveIds = headerActiveIdSet.size > 0;
  const hasHighlights = effectiveHighlightIds.length > 0;

  const isDark = useIsDark();
  const canvasBg = isDark ? "#18181b" : "#ffffff";
  const canvasBorder = isDark ? "#3f3f46" : "#94a3b8";
  const hasMeasuredViewport = dimensions.width > 0 && dimensions.height > 0;
  const projectionShapes = React.useMemo(
    () =>
      layout.shapes.filter(
        (shape) => (shape.projection ?? "top_down") === projection && !shape.deleted_at
      ),
    [layout.shapes, projection]
  );
  const contentBounds = React.useMemo(() => {
    if (projectionShapes.length === 0) {
      return {
        minX: 0,
        minY: 0,
        maxX: layout.canvas_width_m,
        maxY: layout.canvas_height_m,
      };
    }

    const minX = Math.min(
      ...projectionShapes.map(
        (shape) => shape.x + getRotationOffsets(shape.width, shape.height, shape.rotation).minX
      )
    );
    const minY = Math.min(
      ...projectionShapes.map(
        (shape) => shape.y + getRotationOffsets(shape.width, shape.height, shape.rotation).minY
      )
    );
    const maxX = Math.max(
      ...projectionShapes.map(
        (shape) => shape.x + getRotationOffsets(shape.width, shape.height, shape.rotation).maxX
      )
    );
    const maxY = Math.max(
      ...projectionShapes.map(
        (shape) => shape.y + getRotationOffsets(shape.width, shape.height, shape.rotation).maxY
      )
    );

    return {
      minX: Math.min(0, minX),
      minY: Math.min(0, minY),
      maxX: Math.max(layout.canvas_width_m, maxX),
      maxY: Math.max(layout.canvas_height_m, maxY),
    };
  }, [layout.canvas_height_m, layout.canvas_width_m, projectionShapes]);

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
    if (!hasHighlights) return;
    const id = setInterval(() => setTick((t) => t + 1), 600);
    return () => clearInterval(id);
  }, [hasHighlights]);

  // ── Fit whole canvas to viewport (runs on mount + resize) ─────────────────
  const fitCanvas = React.useCallback(
    (w: number, h: number) => {
      if (w === 0 || h === 0) return;
      const contentWidth = Math.max(0.5, contentBounds.maxX - contentBounds.minX);
      const contentHeight = Math.max(0.5, contentBounds.maxY - contentBounds.minY);
      const padding = Math.max(0.35, Math.min(contentWidth, contentHeight) * 0.06);
      const tw = contentWidth + padding * 2;
      const th = contentHeight + padding * 2;
      const newZoom = Math.min(w / (tw * METER_TO_PIXEL), h / (th * METER_TO_PIXEL), 3);
      setZoom(newZoom);
      setPan({
        x: w / 2 - (contentBounds.minX + contentWidth / 2) * newZoom * METER_TO_PIXEL,
        y: h / 2 - (contentBounds.minY + contentHeight / 2) * newZoom * METER_TO_PIXEL,
      });
    },
    [contentBounds]
  );

  const autoFitKey = React.useMemo(
    () =>
      JSON.stringify({
        layoutId: layout.id,
        projection,
        width: dimensions.width,
        height: dimensions.height,
        canvasWidth: layout.canvas_width_m,
        canvasHeight: layout.canvas_height_m,
        bounds: contentBounds,
      }),
    [
      contentBounds,
      dimensions.height,
      dimensions.width,
      layout.canvas_height_m,
      layout.canvas_width_m,
      layout.id,
      projection,
    ]
  );

  // Refit when the actual viewed layout changes or the viewport is first measured.
  React.useEffect(() => {
    if (dimensions.width === 0 || dimensions.height === 0) return;
    if (lastAutoFitKeyRef.current === autoFitKey) return;

    const layoutChanged =
      lastAutoFitKeyRef.current === null ||
      !lastAutoFitKeyRef.current.includes(`"layoutId":"${layout.id}"`);
    if (layoutChanged) {
      hasUserAdjustedCameraRef.current = false;
    }

    if (!hasUserAdjustedCameraRef.current) {
      fitCanvas(dimensions.width, dimensions.height);
    }

    lastAutoFitKeyRef.current = autoFitKey;
  }, [autoFitKey, dimensions.height, dimensions.width, fitCanvas, layout.id]);

  // ── Auto-pan to highlighted shape (only when autoPanToHighlight=true) ──────
  React.useEffect(() => {
    if (!autoPanToHighlight || effectiveHighlightIds.length === 0 || dimensions.width === 0) return;
    const highlighted = projectionShapes.filter(
      (shape) => shape.location_id && highlightIdSet.has(shape.location_id)
    );
    if (highlighted.length === 0) return;
    const margin = 8;
    const minX = Math.min(
      ...highlighted.map(
        (shape) => shape.x + getRotationOffsets(shape.width, shape.height, shape.rotation).minX
      )
    );
    const minY = Math.min(
      ...highlighted.map(
        (shape) => shape.y + getRotationOffsets(shape.width, shape.height, shape.rotation).minY
      )
    );
    const maxX = Math.max(
      ...highlighted.map(
        (shape) => shape.x + getRotationOffsets(shape.width, shape.height, shape.rotation).maxX
      )
    );
    const maxY = Math.max(
      ...highlighted.map(
        (shape) => shape.y + getRotationOffsets(shape.width, shape.height, shape.rotation).maxY
      )
    );
    const targetX = Math.max(0, minX - margin);
    const targetY = Math.max(0, minY - margin);
    const targetW = maxX - minX + margin * 2;
    const targetH = maxY - minY + margin * 2;
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
  }, [autoPanToHighlight, effectiveHighlightIds, highlightIdSet, dimensions, projectionShapes]);

  // ── Zoom on wheel (viewer is interactive) ─────────────────────────────────
  const handleWheel = (e: any) => {
    e.evt.preventDefault();
    hasUserAdjustedCameraRef.current = true;
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
  const isMonoActive = monochromaticHighlight && hasHighlights;
  const sortedShapes = React.useMemo(() => {
    const base = [...layout.shapes]
      .sort((a, b) => a.z_index - b.z_index || a.sort_order - b.sort_order)
      .filter((shape) => (shape.projection ?? "top_down") === projection);
    if (!hasHighlights) return base;

    const highlighted: WarehouseLayoutShape[] = [];
    const normal: WarehouseLayoutShape[] = [];

    for (const shape of base) {
      if (shape.location_id && highlightIdSet.has(shape.location_id)) {
        highlighted.push(shape);
      } else {
        normal.push(shape);
      }
    }

    return [...normal, ...highlighted];
  }, [layout.shapes, hasHighlights, highlightIdSet, projection]);

  const renderShape = (shape: WarehouseLayoutShape) => {
    const defaults = SHAPE_DEFAULTS[shape.shape_type];
    const style = shape.style as ShapeStyle | null;
    const isCombinedHeaderBackground = shape.id.startsWith("combined:header-bg:");
    const isCombinedHeaderLabel = shape.id.startsWith("combined:header:");
    const isCombinedHeaderShape = isCombinedHeaderBackground || isCombinedHeaderLabel;
    // Prefer live location color, then persisted shape.style, then default
    const locColor =
      shape.shape_type === "location" && shape.location_id
        ? (() => {
            const location = locations?.find((l) => l.id === shape.location_id);
            return location ? getEffectiveLocationColor(location, locationGroups, locations) : null;
          })()
        : null;
    const fill = locColor ? locationColorToFill(locColor) : (style?.fill ?? defaults.fill);
    const stroke = locColor ?? style?.stroke ?? defaults.stroke;
    const sw = (style?.strokeWidth ?? 1) / (zoom * METER_TO_PIXEL);

    const isHighlighted =
      !!shape.location_id &&
      (isCombinedHeaderShape
        ? headerActiveIdSet.has(shape.location_id)
        : highlightIdSet.has(shape.location_id));
    const isHeaderHovered =
      isCombinedHeaderShape && !!shape.location_id && hoveredLocationId === shape.location_id;
    const isHeaderDimmed =
      isCombinedHeaderShape &&
      hasHeaderActiveIds &&
      !!shape.location_id &&
      !headerActiveIdSet.has(shape.location_id);
    // In monochromatic mode: non-highlighted shapes go gray; highlighted shape gets its full color.
    // In normal mode: highlighted shape pulses with a blue border.
    const effectiveFill =
      isMonoActive && !isHighlighted
        ? monoFill
        : isHeaderDimmed
          ? isDark
            ? "#27272a"
            : "#e5e7eb"
          : isCombinedHeaderBackground && isHighlighted
            ? withAlpha(stroke, "55")
            : isCombinedHeaderBackground && isHeaderHovered
              ? withAlpha(stroke, "40")
              : fill;
    const effectiveStroke = isMonoActive
      ? isHighlighted
        ? stroke
        : monoStroke
      : isHeaderDimmed
        ? isDark
          ? "#3f3f46"
          : "#9ca3af"
        : isCombinedHeaderBackground && isHighlighted
          ? "#2563eb"
          : isHighlighted
            ? "#2563eb"
            : stroke;
    // Pulse only in normal (non-mono) mode
    const pulseStrokeWidth = isCombinedHeaderBackground
      ? isHighlighted
        ? sw * 2.25
        : isHeaderHovered
          ? sw * 1.5
          : sw
      : !isMonoActive && isHighlighted
        ? tick % 2 === 0
          ? sw * 4
          : sw * 2
        : sw;

    if (shape.shape_type === "label") {
      const combinedHeaderLabelColor = isHeaderDimmed
        ? isDark
          ? "#71717a"
          : "#9ca3af"
        : (style?.textColor ?? "#1e293b");
      const labelColor =
        isMonoActive && !isHighlighted
          ? isDark
            ? "#52525b"
            : "#9ca3af"
          : isHeaderDimmed
            ? isDark
              ? "#71717a"
              : "#9ca3af"
            : isCombinedHeaderLabel
              ? combinedHeaderLabelColor
              : (style?.textColor ?? "#1e293b");
      return (
        <Group
          key={shape.id}
          x={shape.x}
          y={shape.y}
          onClick={onShapeClick ? () => onShapeClick(shape) : undefined}
          onMouseEnter={() => {
            if (isCombinedHeaderShape && shape.location_id) {
              setHoveredLocationId(shape.location_id);
            }
          }}
          onMouseLeave={() => {
            if (isCombinedHeaderShape) {
              setHoveredLocationId((current) => (current === shape.location_id ? null : current));
            }
          }}
        >
          {shape.width > 0 && shape.height > 0 ? (
            <Rect
              width={shape.width}
              height={shape.height}
              fill={isCombinedHeaderLabel ? "rgba(15,23,42,0.001)" : "transparent"}
              strokeEnabled={false}
            />
          ) : null}
          <Text
            text={shape.label ?? ""}
            fontSize={style?.fontSize ?? 0.8}
            fontFamily="sans-serif"
            fill={labelColor}
            width={shape.width > 0 ? shape.width : undefined}
            height={shape.height > 0 ? shape.height : undefined}
            align={shape.width > 0 ? "center" : "left"}
            verticalAlign={shape.height > 0 ? "middle" : "top"}
          />
        </Group>
      );
    }

    return (
      <Group
        key={shape.id}
        x={shape.x}
        y={shape.y}
        rotation={shape.rotation}
        onClick={
          onShapeClick
            ? (e) => {
                e.cancelBubble = true;
                onShapeClick(shape);
              }
            : undefined
        }
        onMouseEnter={() => {
          if (isCombinedHeaderShape && shape.location_id) {
            setHoveredLocationId(shape.location_id);
          }
        }}
        onMouseLeave={() => {
          if (isCombinedHeaderShape) {
            setHoveredLocationId((current) => (current === shape.location_id ? null : current));
          }
        }}
      >
        <Rect
          width={shape.width}
          height={shape.height}
          fill={effectiveFill}
          stroke={effectiveStroke}
          strokeWidth={pulseStrokeWidth}
          cornerRadius={(style?.cornerRadius ?? 0) / (zoom * METER_TO_PIXEL)}
          shadowBlur={
            isCombinedHeaderBackground
              ? isHighlighted
                ? 0.36
                : isHeaderHovered
                  ? 0.24
                  : 0
              : isHighlighted && !isMonoActive
                ? 0.3
                : 0
          }
          shadowColor={
            isCombinedHeaderBackground
              ? isHighlighted
                ? "rgba(37,99,235,0.45)"
                : "rgba(15,23,42,0.24)"
              : "rgba(37,99,235,0.5)"
          }
        />
        {shape.label &&
          shape.shape_type !== "wall" &&
          (shape.shape_type === "location" ? (
            <Group
              x={shape.width / 2}
              y={shape.height / 2}
              rotation={-shape.rotation}
              listening={false}
            >
              <Text
                x={-shape.width / 2}
                y={-shape.height / 2}
                width={shape.width}
                height={shape.height}
                padding={0.05}
                text={shape.label}
                fontSize={(style as any)?.labelSize ?? 0.35}
                fontFamily="monospace"
                fill={
                  isMonoActive && !isHighlighted
                    ? isDark
                      ? "#52525b"
                      : "#9ca3af"
                    : ((style as any)?.labelColor ?? effectiveStroke)
                }
                align={(style as any)?.labelAlignH ?? "left"}
                verticalAlign={
                  ((style as any)?.labelAlignV ?? "top") === "center"
                    ? "middle"
                    : ((style as any)?.labelAlignV ?? "top")
                }
                wrap="none"
                ellipsis={false}
                listening={false}
              />
            </Group>
          ) : (
            <Text
              x={0.05}
              y={0.05}
              text={shape.label}
              fontSize={0.35}
              fontFamily="sans-serif"
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
          ))}
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
              hasUserAdjustedCameraRef.current = true;
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
