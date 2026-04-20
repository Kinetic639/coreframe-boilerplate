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
import { useCssVars, useIsDark } from "@/hooks/use-css-var";
import { cn } from "@/lib/utils";

function withAlpha(color: string, alphaHex: string) {
  if (!color.startsWith("#")) return color;
  const normalized =
    color.length === 4
      ? `#${color[1]}${color[1]}${color[2]}${color[2]}${color[3]}${color[3]}`
      : color;
  return normalized.length === 7 ? `${normalized}${alphaHex}` : normalized;
}

function blendHex(colorA: string, colorB: string, weight = 0.5) {
  if (!colorA.startsWith("#") || !colorB.startsWith("#")) return colorA;

  const normalize = (value: string) =>
    value.length === 4
      ? `#${value[1]}${value[1]}${value[2]}${value[2]}${value[3]}${value[3]}`
      : value;

  const a = normalize(colorA);
  const b = normalize(colorB);
  if (a.length !== 7 || b.length !== 7) return colorA;

  const mix = (start: number, end: number) =>
    Math.round(start + (end - start) * weight)
      .toString(16)
      .padStart(2, "0");

  const ar = parseInt(a.slice(1, 3), 16);
  const ag = parseInt(a.slice(3, 5), 16);
  const ab = parseInt(a.slice(5, 7), 16);
  const br = parseInt(b.slice(1, 3), 16);
  const bg = parseInt(b.slice(3, 5), 16);
  const bb = parseInt(b.slice(5, 7), 16);

  return `#${mix(ar, br)}${mix(ag, bg)}${mix(ab, bb)}`;
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

function getShapeElevationLevel(
  shape: WarehouseLayoutShape,
  locationById: Map<string, WarehouseLocation>
) {
  if ((shape.projection ?? "top_down") !== "top_down") return 1;
  if (shape.shape_type !== "location" || !shape.location_id) return 1;

  return Math.max(1, locationById.get(shape.location_id)?.elevation_level ?? 1);
}

type ProjectionShapeRecord = {
  shape: WarehouseLayoutShape;
  elevationLevel: number;
  bounds: { minX: number; maxX: number; minY: number; maxY: number };
};

// ─── Props ────────────────────────────────────────────────────────────────────

export interface WarehouseMapViewerProps {
  layout: WarehouseLayoutWithShapes;
  projection?: WarehouseLayoutProjection;
  viewBackgroundLabel?: string | null;
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
  viewportResetKey?: string | number;
  className?: string;
  /** Called when the user clicks a shape */
  onShapeClick?: (shape: WarehouseLayoutShape) => void;
}

// ─── Component ────────────────────────────────────────────────────────────────

export function WarehouseMapViewer({
  layout,
  projection = "top_down",
  viewBackgroundLabel,
  locations,
  locationGroups,
  highlightLocationId,
  highlightLocationIds,
  headerActiveLocationIds,
  autoPanToHighlight = true,
  monochromaticHighlight = false,
  viewportResetKey,
  className = "",
  onShapeClick,
}: WarehouseMapViewerProps) {
  const containerRef = React.useRef<HTMLDivElement>(null);
  const [dimensions, setDimensions] = React.useState({ width: 600, height: 400 });
  const [zoom, setZoom] = React.useState(1);
  const [pan, setPan] = React.useState({ x: 40, y: 40 });
  const [hoveredLocationId, setHoveredLocationId] = React.useState<string | null>(null);
  const [tooltipPos, setTooltipPos] = React.useState<{ x: number; y: number } | null>(null);
  const hasUserAdjustedCameraRef = React.useRef(false);
  const lastAutoFitKeyRef = React.useRef<string | null>(null);
  const resizeFrameRef = React.useRef<number | null>(null);
  const tooltipFrameRef = React.useRef<number | null>(null);
  const lastTooltipPosRef = React.useRef<{ x: number; y: number } | null>(null);
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
  const {
    "--background": themeBackground,
    "--card": themeCard,
    "--border": themeBorder,
    "--muted-foreground": themeMutedForeground,
    "--muted": themeMuted,
    "--accent": themeAccent,
    "--foreground": themeForeground,
    "--primary": themePrimary,
    "--primary-foreground": themePrimaryForeground,
    "--secondary": themeSecondary,
    "--secondary-foreground": themeSecondaryForeground,
    "--card-foreground": themeCardForeground,
  } = useCssVars([
    "--background",
    "--card",
    "--border",
    "--muted-foreground",
    "--muted",
    "--accent",
    "--foreground",
    "--primary",
    "--primary-foreground",
    "--secondary",
    "--secondary-foreground",
    "--card-foreground",
  ]);
  const canvasBg = themeCard || themeBackground || (isDark ? "#18181b" : "#ffffff");
  const canvasBorder = themeBorder || (isDark ? "#3f3f46" : "#94a3b8");
  const shapeDefaults = React.useMemo<Record<ShapeType, { fill: string; stroke: string }>>(
    () => ({
      location: {
        fill: themeAccent || themeMuted || canvasBg,
        stroke: themePrimary || themeForeground || canvasBorder,
      },
      wall: {
        fill: themeMuted || canvasBg,
        stroke: themeBorder || canvasBorder,
      },
      door: {
        fill: themeSecondary || themeAccent || canvasBg,
        stroke: themePrimary || themeForeground || canvasBorder,
      },
      aisle: {
        fill: themeBackground || canvasBg,
        stroke: themeBorder || canvasBorder,
      },
      zone: {
        fill: themeAccent || themeMuted || canvasBg,
        stroke: themePrimary || themeForeground || canvasBorder,
      },
      obstacle: {
        fill: themeMuted || themeSecondary || canvasBg,
        stroke: themeMutedForeground || themeBorder || canvasBorder,
      },
      label: { fill: "transparent", stroke: "transparent" },
    }),
    [
      canvasBg,
      canvasBorder,
      themeAccent,
      themeBackground,
      themeBorder,
      themeForeground,
      themeMuted,
      themeMutedForeground,
      themePrimary,
      themeSecondary,
    ]
  );
  const locationById = React.useMemo(
    () => new Map((locations ?? []).map((location) => [location.id, location])),
    [locations]
  );
  const groupById = React.useMemo(
    () => new Map((locationGroups ?? []).map((group) => [group.id, group])),
    [locationGroups]
  );
  const effectiveLocationColorById = React.useMemo(() => {
    const map = new Map<string, string | null>();

    for (const location of locations ?? []) {
      map.set(location.id, getEffectiveLocationColor(location, groupById, locationById));
    }

    return map;
  }, [groupById, locationById, locations]);
  const hasMeasuredViewport = dimensions.width > 0 && dimensions.height > 0;
  const projectionShapeRecords = React.useMemo<ProjectionShapeRecord[]>(
    () =>
      layout.shapes
        .filter((shape) => (shape.projection ?? "top_down") === projection && !shape.deleted_at)
        .map((shape) => {
          const offsets = getRotationOffsets(shape.width, shape.height, shape.rotation);
          return {
            shape,
            elevationLevel: getShapeElevationLevel(shape, locationById),
            bounds: {
              minX: shape.x + offsets.minX,
              maxX: shape.x + offsets.maxX,
              minY: shape.y + offsets.minY,
              maxY: shape.y + offsets.maxY,
            },
          };
        }),
    [layout.shapes, locationById, projection]
  );
  const combinedHeaderTooltipByLocationId = React.useMemo(() => {
    const map = new Map<string, string>();
    for (const record of projectionShapeRecords) {
      const { shape } = record;
      if (shape.id.startsWith("combined:header-bg:") && shape.location_id && shape.label) {
        map.set(shape.location_id, shape.label);
      }
    }
    return map;
  }, [projectionShapeRecords]);
  const narrowHeaderTooltip = React.useMemo(() => {
    if (!hoveredLocationId) return null;
    return combinedHeaderTooltipByLocationId.get(hoveredLocationId) ?? null;
  }, [combinedHeaderTooltipByLocationId, hoveredLocationId]);
  const contentBounds = React.useMemo(() => {
    if (projectionShapeRecords.length === 0) {
      return {
        minX: 0,
        minY: 0,
        maxX: layout.canvas_width_m,
        maxY: layout.canvas_height_m,
      };
    }

    const minX = Math.min(...projectionShapeRecords.map((record) => record.bounds.minX));
    const minY = Math.min(...projectionShapeRecords.map((record) => record.bounds.minY));
    const maxX = Math.max(...projectionShapeRecords.map((record) => record.bounds.maxX));
    const maxY = Math.max(...projectionShapeRecords.map((record) => record.bounds.maxY));

    return {
      minX: Math.min(0, minX),
      minY: Math.min(0, minY),
      maxX: Math.max(layout.canvas_width_m, maxX),
      maxY: Math.max(layout.canvas_height_m, maxY),
    };
  }, [layout.canvas_height_m, layout.canvas_width_m, projectionShapeRecords]);

  // ── Resize observer ────────────────────────────────────────────────────────
  React.useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const syncDimensions = () => {
      const next = { width: el.offsetWidth, height: el.offsetHeight };
      setDimensions((current) =>
        current.width === next.width && current.height === next.height ? current : next
      );
    };
    const obs = new ResizeObserver(() => {
      if (resizeFrameRef.current !== null) {
        cancelAnimationFrame(resizeFrameRef.current);
      }
      resizeFrameRef.current = requestAnimationFrame(() => {
        resizeFrameRef.current = null;
        syncDimensions();
      });
    });
    obs.observe(el);
    syncDimensions();
    return () => {
      obs.disconnect();
      if (resizeFrameRef.current !== null) {
        cancelAnimationFrame(resizeFrameRef.current);
      }
      if (tooltipFrameRef.current !== null) {
        cancelAnimationFrame(tooltipFrameRef.current);
      }
    };
  }, []);

  React.useEffect(() => {
    if (viewportResetKey === undefined) return;
    hasUserAdjustedCameraRef.current = false;
    lastAutoFitKeyRef.current = null;
  }, [viewportResetKey]);

  // ── Fit whole canvas to viewport (runs on mount + resize) ─────────────────
  const fitCanvas = React.useCallback(
    (w: number, h: number) => {
      if (w === 0 || h === 0) return;
      const contentWidth = Math.max(0.5, contentBounds.maxX - contentBounds.minX);
      const contentHeight = Math.max(0.5, contentBounds.maxY - contentBounds.minY);
      const padding = Math.max(0.35, Math.min(contentWidth, contentHeight) * 0.06);
      const tw = contentWidth + padding * 2;
      const th = contentHeight + padding * 2;
      const newZoom = Math.min(w / (tw * METER_TO_PIXEL), h / (th * METER_TO_PIXEL), 10);
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
      [
        layout.id,
        projection,
        dimensions.width,
        dimensions.height,
        layout.canvas_width_m,
        layout.canvas_height_m,
        contentBounds.minX,
        contentBounds.minY,
        contentBounds.maxX,
        contentBounds.maxY,
      ].join(":"),
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
      lastAutoFitKeyRef.current === null || !lastAutoFitKeyRef.current.startsWith(`${layout.id}:`);
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
    const highlighted = projectionShapeRecords.filter(
      (record) => record.shape.location_id && highlightIdSet.has(record.shape.location_id)
    );
    if (highlighted.length === 0) return;
    const margin = 8;
    const minX = Math.min(...highlighted.map((record) => record.bounds.minX));
    const minY = Math.min(...highlighted.map((record) => record.bounds.minY));
    const maxX = Math.max(...highlighted.map((record) => record.bounds.maxX));
    const maxY = Math.max(...highlighted.map((record) => record.bounds.maxY));
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
      10
    );
    setZoom(newZoom);
    setPan({
      x: dimensions.width / 2 - (targetX + targetW / 2) * newZoom * METER_TO_PIXEL,
      y: dimensions.height / 2 - (targetY + targetH / 2) * newZoom * METER_TO_PIXEL,
    });
  }, [
    autoPanToHighlight,
    effectiveHighlightIds,
    highlightIdSet,
    dimensions,
    projectionShapeRecords,
  ]);

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
  const monoFill = React.useMemo(
    () =>
      isDark
        ? blendHex(themeMutedForeground || themeBorder || "#94a3b8", canvasBg, 0.72)
        : blendHex(themeBorder || themeMuted || "#cbd5e1", canvasBg, 0.28),
    [canvasBg, isDark, themeBorder, themeMuted, themeMutedForeground]
  );
  const monoStroke = themeMutedForeground || themeBorder || canvasBorder;
  const isMonoActive = monochromaticHighlight;
  const sortedShapeRecords = React.useMemo(() => {
    const base = [...projectionShapeRecords].sort(
      (a, b) =>
        a.shape.z_index - b.shape.z_index ||
        a.elevationLevel - b.elevationLevel ||
        a.shape.sort_order - b.shape.sort_order
    );
    if (!hasHighlights) return base;

    const highlighted: ProjectionShapeRecord[] = [];
    const normal: ProjectionShapeRecord[] = [];

    for (const record of base) {
      if (record.shape.location_id && highlightIdSet.has(record.shape.location_id)) {
        highlighted.push(record);
      } else {
        normal.push(record);
      }
    }

    return [...normal, ...highlighted];
  }, [projectionShapeRecords, hasHighlights, highlightIdSet]);

  const renderShape = (record: ProjectionShapeRecord) => {
    const { shape } = record;
    const defaults = shapeDefaults[shape.shape_type];
    const style = shape.style as ShapeStyle | null;
    const isCombinedHeaderBackground = shape.id.startsWith("combined:header-bg:");
    const isCombinedHeaderLabel = shape.id.startsWith("combined:header:");
    const isCombinedHeaderShape = isCombinedHeaderBackground || isCombinedHeaderLabel;
    // Prefer live location color, then persisted shape.style, then default
    const locColor =
      shape.shape_type === "location" && shape.location_id
        ? (effectiveLocationColorById.get(shape.location_id) ?? null)
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
    const isColorModeDimmed =
      !isMonoActive && hasHighlights && !isHighlighted && !isCombinedHeaderShape;
    const contentOpacity = isMonoActive
      ? !isHighlighted
        ? 0.58
        : 1
      : isHeaderDimmed
        ? 0.55
        : isColorModeDimmed
          ? 0.62
          : 1;
    // In monochromatic mode: non-highlighted shapes go gray; highlighted shape keeps its full color.
    // In color mode: highlighted shape gets a smooth, color-matched emphasis instead of a flashing border.
    const effectiveFill =
      isMonoActive && !isHighlighted
        ? monoFill
        : isHeaderDimmed
          ? monoFill
          : isCombinedHeaderBackground && isHighlighted
            ? themeAccent || themeSecondary || fill
            : isCombinedHeaderBackground && isHeaderHovered
              ? themeAccent || themeMuted || fill
              : fill;
    const effectiveStroke = isMonoActive
      ? isHighlighted
        ? stroke
        : withAlpha(monoStroke, "99")
      : isHeaderDimmed
        ? monoStroke
        : isCombinedHeaderBackground && isHighlighted
          ? themePrimary || stroke
          : isHighlighted
            ? themePrimary || stroke
            : isColorModeDimmed
              ? withAlpha(stroke, "AA")
              : stroke;
    // Smooth pulse only in normal (non-mono) mode
    const primaryStrokeWidth = isCombinedHeaderBackground
      ? isHighlighted
        ? sw * 2.25
        : isHeaderHovered
          ? sw * 1.5
          : sw
      : !isMonoActive && isHighlighted
        ? sw * 2.75
        : sw;
    const highlightHaloStrokeWidth =
      !isMonoActive && isHighlighted && !isCombinedHeaderBackground ? sw * 4.5 : 0;
    const highlightHaloColor =
      !isMonoActive && isHighlighted && !isCombinedHeaderBackground
        ? withAlpha(themePrimary || stroke, "44")
        : "transparent";

    if (shape.shape_type === "label") {
      const combinedHeaderLabelColor = isHeaderDimmed
        ? themeMutedForeground || monoStroke
        : (style?.textColor ?? themeCardForeground ?? themeForeground ?? "#1e293b");
      const labelColor =
        isMonoActive && !isHighlighted
          ? themeMutedForeground || monoStroke
          : isHeaderDimmed
            ? themeMutedForeground || monoStroke
            : isCombinedHeaderLabel
              ? combinedHeaderLabelColor
              : (style?.textColor ?? themeCardForeground ?? themeForeground ?? "#1e293b");
      return (
        <Group
          key={shape.id}
          x={shape.x}
          y={shape.y}
          opacity={contentOpacity}
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
        opacity={contentOpacity}
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
        {highlightHaloStrokeWidth > 0 ? (
          <Rect
            width={shape.width}
            height={shape.height}
            fillEnabled={false}
            stroke={highlightHaloColor}
            strokeWidth={highlightHaloStrokeWidth}
            cornerRadius={(style?.cornerRadius ?? 0) / (zoom * METER_TO_PIXEL)}
            listening={false}
            perfectDrawEnabled={false}
          />
        ) : null}
        <Rect
          width={shape.width}
          height={shape.height}
          fill={effectiveFill}
          stroke={effectiveStroke}
          strokeWidth={primaryStrokeWidth}
          cornerRadius={(style?.cornerRadius ?? 0) / (zoom * METER_TO_PIXEL)}
          shadowBlur={
            isCombinedHeaderBackground
              ? isHighlighted
                ? 0.28
                : isHeaderHovered
                  ? 0.18
                  : 0
              : isHighlighted && !isMonoActive
                ? 0.44
                : 0
          }
          shadowColor={
            isCombinedHeaderBackground
              ? isHighlighted
                ? withAlpha(stroke, "55")
                : "rgba(15,23,42,0.16)"
              : withAlpha(themePrimary || stroke, isHighlighted ? "66" : "00")
          }
          perfectDrawEnabled={false}
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
                    ? themeMutedForeground || monoStroke
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
                perfectDrawEnabled={false}
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
                  ? themeMutedForeground || monoStroke
                  : isHighlighted
                    ? themePrimary || themePrimaryForeground || effectiveStroke
                    : themeMutedForeground || themeForeground || "#475569"
              }
              listening={false}
              perfectDrawEnabled={false}
            />
          ))}
      </Group>
    );
  };

  return (
    <div
      ref={containerRef}
      className={`relative w-full h-full ${className}`}
      onMouseMove={(e) => {
        if (!hoveredLocationId) return;
        const rect = containerRef.current?.getBoundingClientRect();
        if (!rect) return;
        const next = { x: e.clientX - rect.left, y: e.clientY - rect.top };
        const previous = lastTooltipPosRef.current;
        if (previous && previous.x === next.x && previous.y === next.y) return;
        lastTooltipPosRef.current = next;
        if (tooltipFrameRef.current !== null) return;
        tooltipFrameRef.current = requestAnimationFrame(() => {
          tooltipFrameRef.current = null;
          setTooltipPos(lastTooltipPosRef.current);
        });
      }}
      onMouseLeave={() => {
        lastTooltipPosRef.current = null;
        if (tooltipFrameRef.current !== null) {
          cancelAnimationFrame(tooltipFrameRef.current);
          tooltipFrameRef.current = null;
        }
        setTooltipPos(null);
      }}
    >
      {viewBackgroundLabel?.trim() ? (
        <div className="pointer-events-none absolute inset-0 z-0 flex items-end justify-end overflow-hidden p-3">
          <span
            className={cn(
              "select-none text-right text-[11px] font-semibold uppercase tracking-[0.18em]"
            )}
            style={{
              color: themeMutedForeground || canvasBorder,
              opacity: 0.72,
            }}
          >
            {viewBackgroundLabel}
          </span>
        </div>
      ) : null}

      {!hasMeasuredViewport ? null : (
        <div className="relative z-10 h-full w-full">
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
            <Layer listening={false}>
              {/* Canvas background */}
              <Rect
                x={0}
                y={0}
                width={layout.canvas_width_m}
                height={layout.canvas_height_m}
                fill={canvasBg}
                stroke={canvasBorder}
                strokeWidth={1.5 / (zoom * METER_TO_PIXEL)}
                perfectDrawEnabled={false}
              />
            </Layer>

            <Layer>{sortedShapeRecords.map(renderShape)}</Layer>
          </Stage>
        </div>
      )}
      {narrowHeaderTooltip && tooltipPos && (
        <div
          className="pointer-events-none absolute z-50 rounded border bg-popover px-2 py-1 text-xs text-popover-foreground shadow-md"
          style={{ left: tooltipPos.x + 12, top: tooltipPos.y - 28 }}
        >
          {narrowHeaderTooltip}
        </div>
      )}
    </div>
  );
}
