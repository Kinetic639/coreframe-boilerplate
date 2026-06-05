"use client";

import {
  useRef,
  useState,
  useCallback,
  useEffect,
  type PointerEvent as ReactPointerEvent,
} from "react";
import { ZoomIn, ZoomOut, Maximize2, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { useUpsertVisualNodeMutation } from "@/hooks/queries/warehouse/location-visual-nodes";
import type { LocationVisualNode, VisualizationType } from "@/lib/types/warehouse/locations-v2";

// ─── Colour palette by visualization type ────────────────────────────────────

const VIZ_FILL: Record<VisualizationType | "default", string> = {
  rectangle: "#e2e8f0",
  cabinet: "#dbeafe",
  rack: "#dcfce7",
  grid: "#fef9c3",
  drawer: "#fce7f3",
  bin: "#ede9fe",
  zone: "#fee2e2",
  custom: "#f1f5f9",
  default: "#e2e8f0",
};

const VIZ_STROKE: Record<VisualizationType | "default", string> = {
  rectangle: "#94a3b8",
  cabinet: "#93c5fd",
  rack: "#86efac",
  grid: "#fde047",
  drawer: "#f9a8d4",
  bin: "#c4b5fd",
  zone: "#fca5a5",
  custom: "#cbd5e1",
  default: "#94a3b8",
};

// ─── Types ────────────────────────────────────────────────────────────────────

interface Viewport {
  /** pixels per mm */
  scale: number;
  /** canvas origin offset in SVG pixels */
  x: number;
  y: number;
}

interface DragState {
  nodeId: string;
  startPointerX: number;
  startPointerY: number;
  startNodeX: number;
  startNodeY: number;
}

interface ResizeState {
  nodeId: string;
  handle: "se" | "sw" | "ne" | "nw";
  startPointerX: number;
  startPointerY: number;
  startNodeX: number;
  startNodeY: number;
  startNodeW: number;
  startNodeH: number;
}

interface TopDownPlanCanvasProps {
  layoutId: string;
  branchId: string;
  visualNodes: LocationVisualNode[];
  /** locationId → display label (code + name) */
  locationLabels?: Record<string, string>;
  canvasWidthMm: number;
  canvasHeightMm: number;
  selectedNodeId?: string | null;
  onSelectNode: (nodeId: string | null) => void;
  onAddObject?: () => void;
}

// ─── Canvas helpers ───────────────────────────────────────────────────────────

const MIN_SCALE = 0.005;
const MAX_SCALE = 0.5;
const RESIZE_HANDLE_SIZE = 8; // pixels

export function TopDownPlanCanvas({
  layoutId,
  branchId,
  visualNodes,
  locationLabels = {},
  canvasWidthMm,
  canvasHeightMm,
  selectedNodeId,
  onSelectNode,
  onAddObject,
}: TopDownPlanCanvasProps) {
  const svgRef = useRef<SVGSVGElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const [viewport, setViewport] = useState<Viewport>(() => ({
    scale: 0.02,
    x: 20,
    y: 20,
  }));

  const [localPositions, setLocalPositions] = useState<
    Record<string, { x: number; y: number; w: number; h: number }>
  >({});

  const dragRef = useRef<DragState | null>(null);
  const resizeRef = useRef<ResizeState | null>(null);
  const panRef = useRef<{
    startX: number;
    startY: number;
    startVx: number;
    startVy: number;
  } | null>(null);

  const upsertNode = useUpsertVisualNodeMutation(layoutId, branchId);

  // ── Fit canvas to container on mount ──────────────────────────────────────
  useEffect(() => {
    if (!containerRef.current) return;
    const { width, height } = containerRef.current.getBoundingClientRect();
    const scaleX = (width - 40) / canvasWidthMm;
    const scaleY = (height - 40) / canvasHeightMm;
    const scale = Math.min(scaleX, scaleY, MAX_SCALE);
    setViewport({ scale, x: 20, y: 20 });
  }, [canvasWidthMm, canvasHeightMm]);

  function clientToSvg(clientX: number, clientY: number) {
    const svg = svgRef.current;
    if (!svg) return { x: 0, y: 0 };
    const rect = svg.getBoundingClientRect();
    return { x: clientX - rect.left, y: clientY - rect.top };
  }

  // ── Get current visual position (local drag override or server data) ───────
  function getNodeRect(node: LocationVisualNode) {
    const local = localPositions[node.id];
    return {
      x: local?.x ?? node.x_mm,
      y: local?.y ?? node.y_mm,
      w: local?.w ?? node.width_mm,
      h: local?.h ?? node.height_mm,
    };
  }

  // ── Object drag ──────────────────────────────────────────────────────────
  function handleObjectPointerDown(e: ReactPointerEvent<SVGElement>, node: LocationVisualNode) {
    e.stopPropagation();
    onSelectNode(node.id);
    if (e.button !== 0) return;
    (e.target as SVGElement).setPointerCapture(e.pointerId);
    const { x: svgX, y: svgY } = clientToSvg(e.clientX, e.clientY);
    const rect = getNodeRect(node);
    dragRef.current = {
      nodeId: node.id,
      startPointerX: svgX,
      startPointerY: svgY,
      startNodeX: rect.x,
      startNodeY: rect.y,
    };
  }

  // ── Resize handle drag ────────────────────────────────────────────────────
  function handleResizePointerDown(
    e: ReactPointerEvent<SVGCircleElement>,
    node: LocationVisualNode,
    handle: ResizeState["handle"]
  ) {
    e.stopPropagation();
    (e.target as SVGElement).setPointerCapture(e.pointerId);
    const { x: svgX, y: svgY } = clientToSvg(e.clientX, e.clientY);
    const rect = getNodeRect(node);
    resizeRef.current = {
      nodeId: node.id,
      handle,
      startPointerX: svgX,
      startPointerY: svgY,
      startNodeX: rect.x,
      startNodeY: rect.y,
      startNodeW: rect.w,
      startNodeH: rect.h,
    };
  }

  // ── Pan background ────────────────────────────────────────────────────────
  function handleSvgPointerDown(e: ReactPointerEvent<SVGSVGElement>) {
    if (e.button !== 0) return;
    onSelectNode(null);
    (e.target as SVGSVGElement).setPointerCapture(e.pointerId);
    const { x, y } = clientToSvg(e.clientX, e.clientY);
    panRef.current = {
      startX: x,
      startY: y,
      startVx: viewport.x,
      startVy: viewport.y,
    };
  }

  const handlePointerMove = useCallback(
    (e: ReactPointerEvent<SVGSVGElement>) => {
      const { x: svgX, y: svgY } = clientToSvg(e.clientX, e.clientY);

      // Object drag
      if (dragRef.current) {
        const { nodeId, startPointerX, startPointerY, startNodeX, startNodeY } = dragRef.current;
        const dxMm = (svgX - startPointerX) / viewport.scale;
        const dyMm = (svgY - startPointerY) / viewport.scale;
        setLocalPositions((prev) => ({
          ...prev,
          [nodeId]: {
            x: Math.max(0, startNodeX + dxMm),
            y: Math.max(0, startNodeY + dyMm),
            w: prev[nodeId]?.w ?? visualNodes.find((n) => n.id === nodeId)?.width_mm ?? 1000,
            h: prev[nodeId]?.h ?? visualNodes.find((n) => n.id === nodeId)?.height_mm ?? 600,
          },
        }));
        return;
      }

      // Resize
      if (resizeRef.current) {
        const {
          nodeId,
          handle,
          startPointerX,
          startPointerY,
          startNodeX,
          startNodeY,
          startNodeW,
          startNodeH,
        } = resizeRef.current;
        const dxMm = (svgX - startPointerX) / viewport.scale;
        const dyMm = (svgY - startPointerY) / viewport.scale;
        let x = startNodeX;
        let y = startNodeY;
        let w = startNodeW;
        let h = startNodeH;
        const MIN_SIZE = 100;
        if (handle === "se") {
          w = Math.max(MIN_SIZE, startNodeW + dxMm);
          h = Math.max(MIN_SIZE, startNodeH + dyMm);
        }
        if (handle === "sw") {
          x = startNodeX + dxMm;
          w = Math.max(MIN_SIZE, startNodeW - dxMm);
          h = Math.max(MIN_SIZE, startNodeH + dyMm);
        }
        if (handle === "ne") {
          y = startNodeY + dyMm;
          w = Math.max(MIN_SIZE, startNodeW + dxMm);
          h = Math.max(MIN_SIZE, startNodeH - dyMm);
        }
        if (handle === "nw") {
          x = startNodeX + dxMm;
          y = startNodeY + dyMm;
          w = Math.max(MIN_SIZE, startNodeW - dxMm);
          h = Math.max(MIN_SIZE, startNodeH - dyMm);
        }
        setLocalPositions((prev) => ({
          ...prev,
          [nodeId]: { x: Math.max(0, x), y: Math.max(0, y), w, h },
        }));
        return;
      }

      // Pan
      if (panRef.current) {
        const { startX, startY, startVx, startVy } = panRef.current;
        setViewport((v) => ({
          ...v,
          x: startVx + (svgX - startX),
          y: startVy + (svgY - startY),
        }));
      }
    },
    [viewport.scale, visualNodes]
  );

  function handlePointerUp(_e: ReactPointerEvent<SVGSVGElement>) {
    // Commit drag
    if (dragRef.current) {
      const { nodeId } = dragRef.current;
      const local = localPositions[nodeId];
      const node = visualNodes.find((n) => n.id === nodeId);
      if (node && local) {
        upsertNode.mutate({
          id: nodeId,
          layout_id: layoutId,
          location_id: node.location_id,
          view_type: "top_down",
          x_mm: Math.round(local.x),
          y_mm: Math.round(local.y),
          width_mm: Math.round(local.w),
          height_mm: Math.round(local.h),
          visualization_type: node.visualization_type,
          visual_role: node.visual_role,
        });
      }
      dragRef.current = null;
    }

    // Commit resize
    if (resizeRef.current) {
      const { nodeId } = resizeRef.current;
      const local = localPositions[nodeId];
      const node = visualNodes.find((n) => n.id === nodeId);
      if (node && local) {
        upsertNode.mutate({
          id: nodeId,
          layout_id: layoutId,
          location_id: node.location_id,
          view_type: "top_down",
          x_mm: Math.round(local.x),
          y_mm: Math.round(local.y),
          width_mm: Math.round(local.w),
          height_mm: Math.round(local.h),
          visualization_type: node.visualization_type,
          visual_role: node.visual_role,
        });
      }
      resizeRef.current = null;
    }

    panRef.current = null;
  }

  // ── Zoom ──────────────────────────────────────────────────────────────────
  function handleWheel(e: React.WheelEvent<SVGSVGElement>) {
    e.preventDefault();
    const { x: svgX, y: svgY } = clientToSvg(e.clientX, e.clientY);
    const factor = e.deltaY < 0 ? 1.1 : 0.9;
    setViewport((v) => {
      const newScale = Math.max(MIN_SCALE, Math.min(MAX_SCALE, v.scale * factor));
      const ratio = newScale / v.scale;
      return {
        scale: newScale,
        x: svgX - ratio * (svgX - v.x),
        y: svgY - ratio * (svgY - v.y),
      };
    });
  }

  function zoom(factor: number) {
    const svg = svgRef.current;
    if (!svg) return;
    const rect = svg.getBoundingClientRect();
    const cx = rect.width / 2;
    const cy = rect.height / 2;
    setViewport((v) => {
      const newScale = Math.max(MIN_SCALE, Math.min(MAX_SCALE, v.scale * factor));
      const ratio = newScale / v.scale;
      return { scale: newScale, x: cx - ratio * (cx - v.x), y: cy - ratio * (cy - v.y) };
    });
  }

  function fitView() {
    if (!containerRef.current) return;
    const { width, height } = containerRef.current.getBoundingClientRect();
    const s = Math.min((width - 40) / canvasWidthMm, (height - 40) / canvasHeightMm, MAX_SCALE);
    setViewport({ scale: s, x: 20, y: 20 });
  }

  // ── Canvas background grid spacing (in mm) ────────────────────────────────
  const gridMm = viewport.scale > 0.03 ? 500 : viewport.scale > 0.01 ? 1000 : 5000;

  return (
    <div ref={containerRef} className="relative w-full h-full bg-slate-50 overflow-hidden">
      {/* Toolbar */}
      <div className="absolute top-3 left-3 z-10 flex flex-col gap-1">
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="outline"
              size="icon"
              className="h-8 w-8 bg-white shadow-sm"
              onClick={() => zoom(1.2)}
            >
              <ZoomIn className="h-4 w-4" />
            </Button>
          </TooltipTrigger>
          <TooltipContent side="right">Zoom in</TooltipContent>
        </Tooltip>
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="outline"
              size="icon"
              className="h-8 w-8 bg-white shadow-sm"
              onClick={() => zoom(0.8)}
            >
              <ZoomOut className="h-4 w-4" />
            </Button>
          </TooltipTrigger>
          <TooltipContent side="right">Zoom out</TooltipContent>
        </Tooltip>
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="outline"
              size="icon"
              className="h-8 w-8 bg-white shadow-sm"
              onClick={fitView}
            >
              <Maximize2 className="h-4 w-4" />
            </Button>
          </TooltipTrigger>
          <TooltipContent side="right">Fit view</TooltipContent>
        </Tooltip>
      </div>

      {/* Add object button */}
      {onAddObject && (
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="default"
              size="sm"
              className="absolute top-3 right-3 z-10 shadow-sm gap-1"
              onClick={onAddObject}
            >
              <Plus className="h-4 w-4" />
              Add object
            </Button>
          </TooltipTrigger>
          <TooltipContent>Add a new object to the plan</TooltipContent>
        </Tooltip>
      )}

      {/* Scale indicator */}
      <div className="absolute bottom-3 left-3 z-10 text-[10px] text-muted-foreground bg-white/80 px-2 py-0.5 rounded border">
        {Math.round(viewport.scale * 1000) / 10} px/100mm
      </div>

      <svg
        ref={svgRef}
        className="w-full h-full cursor-grab active:cursor-grabbing"
        onPointerDown={handleSvgPointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onWheel={handleWheel}
        style={{ touchAction: "none" }}
      >
        <defs>
          <pattern
            id="grid"
            width={gridMm * viewport.scale}
            height={gridMm * viewport.scale}
            patternUnits="userSpaceOnUse"
            x={viewport.x % (gridMm * viewport.scale)}
            y={viewport.y % (gridMm * viewport.scale)}
          >
            <path
              d={`M ${gridMm * viewport.scale} 0 L 0 0 0 ${gridMm * viewport.scale}`}
              fill="none"
              stroke="#e2e8f0"
              strokeWidth="0.5"
            />
          </pattern>
        </defs>

        {/* Background */}
        <rect width="100%" height="100%" fill="url(#grid)" />

        {/* Canvas boundary */}
        <rect
          x={viewport.x}
          y={viewport.y}
          width={canvasWidthMm * viewport.scale}
          height={canvasHeightMm * viewport.scale}
          fill="white"
          stroke="#cbd5e1"
          strokeWidth="1"
        />

        {/* Visual nodes */}
        <g>
          {visualNodes.map((node) => {
            const rect = getNodeRect(node);
            const px = viewport.x + rect.x * viewport.scale;
            const py = viewport.y + rect.y * viewport.scale;
            const pw = rect.w * viewport.scale;
            const ph = rect.h * viewport.scale;
            const isSelected = selectedNodeId === node.id;
            const vizType = node.visualization_type ?? "rectangle";
            const fill = VIZ_FILL[vizType] ?? VIZ_FILL.default;
            const stroke = VIZ_STROKE[vizType] ?? VIZ_STROKE.default;

            return (
              <g
                key={node.id}
                onPointerDown={(e) => handleObjectPointerDown(e, node)}
                style={{ cursor: "move" }}
              >
                {/* Main rectangle */}
                <rect
                  x={px}
                  y={py}
                  width={pw}
                  height={ph}
                  fill={fill}
                  stroke={isSelected ? "#3b82f6" : stroke}
                  strokeWidth={isSelected ? 2 : 1}
                  rx={2}
                />

                {/* Label */}
                {pw > 30 && ph > 16 && (
                  <text
                    x={px + pw / 2}
                    y={py + ph / 2}
                    textAnchor="middle"
                    dominantBaseline="middle"
                    fontSize={Math.max(8, Math.min(14, pw / 8))}
                    fill="#334155"
                    style={{ userSelect: "none", pointerEvents: "none" }}
                  >
                    {truncateLabel(
                      locationLabels[node.location_id] ?? node.location_id.slice(0, 8),
                      20
                    )}
                  </text>
                )}

                {/* Resize handles (only when selected) */}
                {isSelected && (
                  <>
                    {(
                      [
                        ["nw", px, py],
                        ["ne", px + pw, py],
                        ["se", px + pw, py + ph],
                        ["sw", px, py + ph],
                      ] as const
                    ).map(([handle, hx, hy]) => (
                      <circle
                        key={handle}
                        cx={hx}
                        cy={hy}
                        r={RESIZE_HANDLE_SIZE / 2}
                        fill="white"
                        stroke="#3b82f6"
                        strokeWidth={1.5}
                        style={{ cursor: `${handle}-resize` }}
                        onPointerDown={(e) => handleResizePointerDown(e, node, handle)}
                      />
                    ))}
                  </>
                )}
              </g>
            );
          })}
        </g>

        {/* Empty state */}
        {visualNodes.length === 0 && (
          <text
            x="50%"
            y="50%"
            textAnchor="middle"
            dominantBaseline="middle"
            fontSize={14}
            fill="#94a3b8"
            style={{ userSelect: "none" }}
          >
            No objects on this plan yet — click &quot;Add object&quot; to start.
          </text>
        )}
      </svg>
    </div>
  );
}

// Use location code/name from the node id as a fallback label.
// The canvas receives visual nodes without location name; name comes from
// the locations list passed by the parent shell.
function truncateLabel(str: string, max: number) {
  if (str.length <= max) return str;
  return str.slice(0, max - 1) + "…";
}
