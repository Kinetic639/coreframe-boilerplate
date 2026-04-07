import React from "react";
import { Stage, Layer, Rect, Text, Group, Transformer, Line } from "react-konva";
import { ZoomIn, ZoomOut, Maximize, Hand } from "lucide-react";
import { LocationNode, LocationType, METER_TO_PIXEL } from "../types";

interface WarehouseCanvasProps {
  locations: LocationNode[];
  selectedId: string | null;
  onSelect: (id: string | null) => void;
  onUpdate: (id: string, updates: Partial<LocationNode>) => void;
  onDropNewLocation: (type: LocationType, x: number, y: number) => void;
  zoom: number;
  setZoom: (zoom: number) => void;
  pan: { x: number; y: number };
  setPan: (pan: { x: number; y: number }) => void;
  showGrid: boolean;
  snapToGrid: boolean;
  gridInterval: number;
}

export const WarehouseCanvas: React.FC<WarehouseCanvasProps> = ({
  locations,
  selectedId,
  onSelect,
  onUpdate,
  onDropNewLocation,
  zoom,
  setZoom,
  pan,
  setPan,
  showGrid,
  snapToGrid,
  gridInterval,
}) => {
  const containerRef = React.useRef<HTMLDivElement>(null);
  const stageRef = React.useRef<any>(null);
  const transformerRef = React.useRef<any>(null);
  const [dimensions, setDimensions] = React.useState({ width: 0, height: 0 });

  React.useEffect(() => {
    const updateSize = () => {
      if (containerRef.current) {
        setDimensions({
          width: containerRef.current.offsetWidth,
          height: containerRef.current.offsetHeight,
        });
      }
    };
    window.addEventListener("resize", updateSize);
    updateSize();
    return () => window.removeEventListener("resize", updateSize);
  }, []);

  const handleWheel = (e: any) => {
    e.evt.preventDefault();
    const scaleBy = 1.1;
    const stage = e.target.getStage();

    // Use the logical zoom state as the base, not the stage's absolute scale
    const oldZoom = zoom;
    const pointer = stage.getPointerPosition();

    // Calculate mouse position in "meters" relative to the stage origin
    const mousePointTo = {
      x: (pointer.x - pan.x) / (oldZoom * METER_TO_PIXEL),
      y: (pointer.y - pan.y) / (oldZoom * METER_TO_PIXEL),
    };

    const newZoom = e.evt.deltaY < 0 ? oldZoom * scaleBy : oldZoom / scaleBy;

    // Limit zoom range to prevent extreme values (1% to 5000%)
    const limitedZoom = Math.max(0.01, Math.min(newZoom, 50));

    setZoom(limitedZoom);
    setPan({
      x: pointer.x - mousePointTo.x * limitedZoom * METER_TO_PIXEL,
      y: pointer.y - mousePointTo.y * limitedZoom * METER_TO_PIXEL,
    });
  };

  const getAbsoluteGeometry = (id: string) => {
    const current = locations.find((l) => l.id === id);
    if (!current || !current.geometry) return null;

    let absX = current.geometry.x;
    let absY = current.geometry.y;
    let parentId = current.parentId;

    while (parentId) {
      const parent = locations.find((l) => l.id === parentId);
      if (parent && parent.geometry) {
        absX += parent.geometry.x;
        absY += parent.geometry.y;
        parentId = parent.parentId;
      } else {
        break;
      }
    }

    return {
      x: absX,
      y: absY,
      width: current.geometry.width,
      height: current.geometry.height,
    };
  };

  const resetView = () => {
    if (dimensions.width === 0) return;

    let targetGeo = null;

    if (selectedId) {
      targetGeo = getAbsoluteGeometry(selectedId);
    }

    if (!targetGeo) {
      const roots = locations.filter((l) => !l.parentId && l.geometry && !l.deletedAt);
      if (roots.length > 0) {
        let minX = Infinity,
          minY = Infinity,
          maxX = -Infinity,
          maxY = -Infinity;
        roots.forEach((r) => {
          const g = r.geometry!;
          minX = Math.min(minX, g.x);
          minY = Math.min(minY, g.y);
          maxX = Math.max(maxX, g.x + g.width);
          maxY = Math.max(maxY, g.y + g.height);
        });
        targetGeo = {
          x: minX,
          y: minY,
          width: maxX - minX,
          height: maxY - minY,
        };
      }
    }

    if (targetGeo) {
      const padding = 2; // meters
      const w = targetGeo.width + padding * 2;
      const h = targetGeo.height + padding * 2;

      const zoomX = dimensions.width / (w * METER_TO_PIXEL);
      const zoomY = dimensions.height / (h * METER_TO_PIXEL);
      const newZoom = Math.max(0.01, Math.min(zoomX, zoomY, 5)); // Cap zoom at 5x

      const centerX = targetGeo.x + targetGeo.width / 2;
      const centerY = targetGeo.y + targetGeo.height / 2;

      setZoom(newZoom);
      setPan({
        x: dimensions.width / 2 - centerX * METER_TO_PIXEL * newZoom,
        y: dimensions.height / 2 - centerY * METER_TO_PIXEL * newZoom,
      });
    } else {
      setZoom(1);
      setPan({ x: 50, y: 50 });
    }
  };

  const zoomAtCenter = (factor: number) => {
    const oldZoom = zoom;
    const newZoom = Math.max(0.01, Math.min(oldZoom * factor, 50));

    const centerX = dimensions.width / 2;
    const centerY = dimensions.height / 2;

    const mousePointTo = {
      x: (centerX - pan.x) / (oldZoom * METER_TO_PIXEL),
      y: (centerY - pan.y) / (oldZoom * METER_TO_PIXEL),
    };

    setZoom(newZoom);
    setPan({
      x: centerX - mousePointTo.x * newZoom * METER_TO_PIXEL,
      y: centerY - mousePointTo.y * newZoom * METER_TO_PIXEL,
    });
  };

  const snap = (val: number) => (snapToGrid ? Math.round(val / gridInterval) * gridInterval : val);

  const checkCollision = (
    id: string,
    x: number,
    y: number,
    width: number,
    height: number,
    parentId: string | null
  ) => {
    const siblings = locations.filter((l) => l.parentId === parentId && l.id !== id && l.geometry);
    for (const sib of siblings) {
      const s = sib.geometry!;
      // Use a small epsilon to allow items to touch perfectly
      const overlapX = x < s.x + s.width - 0.001 && x + width > s.x + 0.001;
      const overlapY = y < s.y + s.height - 0.001 && y + height > s.y + 0.001;
      if (overlapX && overlapY) return true;
    }
    return false;
  };

  const prevSelectedId = React.useRef<string | null>(null);

  React.useEffect(() => {
    if (selectedId && transformerRef.current) {
      const stage = transformerRef.current.getStage();
      const selectedNode = stage.findOne("#" + selectedId);
      if (selectedNode) {
        const shape = selectedNode.findOne(".shape");
        if (shape) {
          console.log("Attaching transformer to:", selectedId);
          transformerRef.current.nodes([shape]);
          transformerRef.current.getLayer().batchDraw();
        } else {
          console.warn("Shape not found for:", selectedId);
        }
      } else {
        console.warn("Node not found for:", selectedId);
      }
    } else if (transformerRef.current) {
      transformerRef.current.nodes([]);
    }
  }, [selectedId, locations, zoom]);

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    const type = e.dataTransfer.getData("locationType") as LocationType;
    if (!type || !stageRef.current) return;

    stageRef.current.setPointersPositions(e);
    const pointerPosition = stageRef.current.getPointerPosition();

    // Convert screen coordinates to stage coordinates (meters)
    const x = snap((pointerPosition.x - pan.x) / (zoom * METER_TO_PIXEL));
    const y = snap((pointerPosition.y - pan.y) / (zoom * METER_TO_PIXEL));

    onDropNewLocation(type, x, y);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
  };

  // Only render locations that have geometry
  const visualLocations = locations.filter((l) => l.geometry);

  // Sharp grid rendering using Line components, scoped to warehouse
  const renderGrid = (warehouse: LocationNode) => {
    if (!showGrid || !warehouse.geometry) return null;

    const geo = warehouse.geometry;
    const lines = [];

    // Calculate stroke width to be exactly 1 pixel on screen
    const baseStrokeWidth = 1 / (zoom * METER_TO_PIXEL);

    // Vertical lines
    for (let x = 0; x <= geo.width + 0.001; x += gridInterval) {
      const isMajor = Math.abs(x % 1) < 0.001 || Math.abs((x % 1) - 1) < 0.001;
      lines.push(
        <Line
          key={`v-${x}`}
          points={[x, 0, x, geo.height]}
          stroke={isMajor ? "#94a3b8" : "#e2e8f0"}
          strokeWidth={baseStrokeWidth}
          listening={false}
        />
      );
    }
    // Horizontal lines
    for (let y = 0; y <= geo.height + 0.001; y += gridInterval) {
      const isMajor = Math.abs(y % 1) < 0.001 || Math.abs((y % 1) - 1) < 0.001;
      lines.push(
        <Line
          key={`h-${y}`}
          points={[0, y, geo.width, y]}
          stroke={isMajor ? "#94a3b8" : "#e2e8f0"}
          strokeWidth={baseStrokeWidth}
          listening={false}
        />
      );
    }

    return <Group>{lines}</Group>;
  };

  // Recursive rendering of locations
  const renderLocations = (parentId: string | null) => {
    return visualLocations
      .filter((l) => l.parentId === parentId)
      .map((location) => {
        const geo = location.geometry!;
        const isSelected = selectedId === location.id;
        const isWarehouse = location.type === "warehouse";
        const parent = locations.find((p) => p.id === location.parentId);

        return (
          <Group
            key={location.id}
            id={location.id}
            x={geo.x}
            y={geo.y}
            onClick={(e) => {
              e.cancelBubble = true;
              onSelect(location.id);
            }}
            onTap={(e) => {
              e.cancelBubble = true;
              onSelect(location.id);
            }}
            draggable={isSelected}
            dragBoundFunc={(pos) => {
              if (!parent || !parent.geometry || !stageRef.current) return pos;

              const stage = stageRef.current;
              const scale = METER_TO_PIXEL * zoom;

              const parentNode = stage.findOne("#" + parent.id);
              if (!parentNode) return pos;

              const parentAbsPos = parentNode.getAbsolutePosition();
              const currentNode = stage.findOne("#" + location.id);
              if (!currentNode) return pos;

              const currentAbsPos = currentNode.getAbsolutePosition();

              // 1. Calculate proposed relative position
              let targetRelX = (pos.x - parentAbsPos.x) / scale;
              let targetRelY = (pos.y - parentAbsPos.y) / scale;

              // 2. Apply snapping if enabled
              if (snapToGrid) {
                targetRelX = Math.round(targetRelX / gridInterval) * gridInterval;
                targetRelY = Math.round(targetRelY / gridInterval) * gridInterval;
              }

              // 3. Parent boundary check
              targetRelX = Math.max(0, Math.min(targetRelX, parent.geometry.width - geo.width));
              targetRelY = Math.max(0, Math.min(targetRelY, parent.geometry.height - geo.height));

              // 4. Stepped collision check to prevent tunneling
              // We move from current geo.x/y to targetRelX/Y in small steps
              const dist = Math.sqrt(
                Math.pow(targetRelX - geo.x, 2) + Math.pow(targetRelY - geo.y, 2)
              );
              const stepSize = Math.min(0.1, gridInterval); // Small steps for precision
              const steps = Math.ceil(dist / stepSize);

              let finalRelX = geo.x;
              let finalRelY = geo.y;

              // Pre-filter siblings for performance
              const siblings = locations.filter(
                (l) => l.parentId === location.parentId && l.id !== location.id && l.geometry
              );

              for (let i = 1; i <= steps; i++) {
                const nextX = geo.x + (targetRelX - geo.x) * (i / steps);
                const nextY = geo.y + (targetRelY - geo.y) * (i / steps);

                const collisionBoth = checkCollision(
                  location.id,
                  nextX,
                  nextY,
                  geo.width,
                  geo.height,
                  location.parentId
                );

                if (collisionBoth) {
                  // Try sliding: can we move just X?
                  const collisionX = checkCollision(
                    location.id,
                    nextX,
                    finalRelY,
                    geo.width,
                    geo.height,
                    location.parentId
                  );
                  // Try sliding: can we move just Y?
                  const collisionY = checkCollision(
                    location.id,
                    finalRelX,
                    nextY,
                    geo.width,
                    geo.height,
                    location.parentId
                  );

                  if (!collisionX) {
                    finalRelX = nextX;
                    // finalRelY stays same
                  } else if (!collisionY) {
                    finalRelY = nextY;
                    // finalRelX stays same
                  } else {
                    // Blocked in both directions
                    break;
                  }
                } else {
                  finalRelX = nextX;
                  finalRelY = nextY;
                }
              }

              // If we didn't move at all, return current absolute position
              if (finalRelX === geo.x && finalRelY === geo.y && dist > 0.001) {
                return currentAbsPos;
              }

              return {
                x: parentAbsPos.x + finalRelX * scale,
                y: parentAbsPos.y + finalRelY * scale,
              };
            }}
            onDragEnd={(e) => {
              onUpdate(location.id, {
                geometry: {
                  ...geo,
                  x: snap(e.target.x()),
                  y: snap(e.target.y()),
                },
              });
            }}
          >
            <Rect
              name="shape"
              x={0}
              y={0}
              width={geo.width}
              height={geo.height}
              rotation={geo.rotation}
              fill={
                isWarehouse
                  ? "white"
                  : location.type === "obstacle"
                    ? isSelected
                      ? "rgba(239, 68, 68, 0.2)"
                      : "rgba(239, 68, 68, 0.1)"
                    : isSelected
                      ? "rgba(59, 130, 246, 0.1)"
                      : "white"
              }
              stroke={
                isWarehouse
                  ? "#1e293b"
                  : location.type === "obstacle"
                    ? isSelected
                      ? "#ef4444"
                      : "#f87171"
                    : isSelected
                      ? "#2563eb"
                      : "#64748b"
              }
              strokeWidth={
                isWarehouse
                  ? 2 / (zoom * METER_TO_PIXEL)
                  : isSelected
                    ? 2 / (zoom * METER_TO_PIXEL)
                    : 1 / (zoom * METER_TO_PIXEL)
              }
              cornerRadius={isWarehouse ? 0 : 0.05}
              shadowBlur={isSelected ? 0.1 : isWarehouse ? 0.5 : 0}
              shadowColor="rgba(0,0,0,0.4)"
              onTransformEnd={(e) => {
                const node = e.target;
                const scaleX = node.scaleX();
                const scaleY = node.scaleY();

                // reset scale
                node.scaleX(1);
                node.scaleY(1);

                // For nested components, x and y are already relative to parent group
                const newWidth = snap(Math.max(0.1, node.width() * scaleX));
                const newHeight = snap(Math.max(0.1, node.height() * scaleY));

                // The new relative position is the group's current x plus the rect's offset
                let newX = snap(geo.x + node.x());
                let newY = snap(geo.y + node.y());

                if (parent && parent.geometry) {
                  newX = Math.max(0, Math.min(newX, parent.geometry.width - newWidth));
                  newY = Math.max(0, Math.min(newY, parent.geometry.height - newHeight));
                }

                onUpdate(location.id, {
                  geometry: {
                    ...geo,
                    x: newX,
                    y: newY,
                    width: newWidth,
                    height: newHeight,
                    rotation: node.rotation(),
                  },
                });
                // Reset rect offset to 0 as the group will move to the newX/newY
                node.x(0);
                node.y(0);
              }}
            />

            {/* Render grid inside warehouse */}
            {isWarehouse && renderGrid(location)}

            <Text
              x={0.1}
              y={0.1}
              text={location.slug}
              fontSize={0.4}
              fontFamily="monospace"
              fill={isSelected ? "#2563eb" : "#64748b"}
            />

            {/* Recursively render children */}
            {renderLocations(location.id)}
          </Group>
        );
      });
  };

  return (
    <div
      ref={containerRef}
      className="flex-1 h-full bg-slate-900 overflow-hidden relative cursor-crosshair"
      onDrop={handleDrop}
      onDragOver={handleDragOver}
    >
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
          if (e.target === e.target.getStage()) {
            onSelect(null);
          }
        }}
        onTap={(e) => {
          if (e.target === e.target.getStage()) {
            onSelect(null);
          }
        }}
      >
        <Layer>
          {/* Background - Dark "empty" space */}
          <Rect
            x={-10000}
            y={-10000}
            width={20000}
            height={20000}
            fill="#1e293b"
            onClick={() => onSelect(null)}
            onTap={() => onSelect(null)}
          />

          {renderLocations(null)}

          <Transformer
            ref={transformerRef}
            boundBoxFunc={(oldBox, newBox) => {
              // Minimum size check
              if (newBox.width < 0.1 || newBox.height < 0.1) {
                return oldBox;
              }

              if (!selectedId) return newBox;

              const location = locations.find((l) => l.id === selectedId);
              if (!location || !location.parentId) return newBox;

              const parent = locations.find((p) => p.id === location.parentId);
              if (!parent || !parent.geometry || !stageRef.current) return newBox;

              const stage = stageRef.current;
              const scale = METER_TO_PIXEL * zoom;

              const parentNode = stage.findOne("#" + parent.id);
              if (!parentNode) return newBox;

              const parentAbsPos = parentNode.getAbsolutePosition();

              // Convert newBox (absolute) to relative meters
              const relX = (newBox.x - parentAbsPos.x) / scale;
              const relY = (newBox.y - parentAbsPos.y) / scale;
              const relW = newBox.width / scale;
              const relH = newBox.height / scale;

              // 1. Parent boundary check
              if (
                relX < -0.001 ||
                relY < -0.001 ||
                relX + relW > parent.geometry.width + 0.001 ||
                relY + relH > parent.geometry.height + 0.001
              ) {
                return oldBox;
              }

              // 2. Sibling collision check
              if (checkCollision(location.id, relX, relY, relW, relH, location.parentId)) {
                return oldBox;
              }

              return newBox;
            }}
            anchorSize={6}
            anchorCornerRadius={1}
            anchorStroke="#3b82f6"
            anchorFill="white"
            borderStroke="#3b82f6"
            borderStrokeWidth={2}
            enabledAnchors={[
              "top-left",
              "top-center",
              "top-right",
              "middle-right",
              "bottom-right",
              "bottom-center",
              "bottom-left",
              "middle-left",
            ]}
            keepRatio={false}
            rotateEnabled={false}
          />
        </Layer>
      </Stage>

      {/* Canvas Toolbar */}
      <div className="absolute top-4 left-4 flex flex-col gap-2">
        <div className="bg-white rounded-lg border shadow-sm flex flex-col overflow-hidden">
          <button
            onClick={() => zoomAtCenter(1.2)}
            className="p-2 hover:bg-slate-50 text-slate-600 border-b transition-colors"
            title="Zoom In"
          >
            <ZoomIn className="w-4 h-4" />
          </button>
          <button
            onClick={() => zoomAtCenter(1 / 1.2)}
            className="p-2 hover:bg-slate-50 text-slate-600 border-b transition-colors"
            title="Zoom Out"
          >
            <ZoomOut className="w-4 h-4" />
          </button>
          <button
            onClick={resetView}
            className="p-2 hover:bg-slate-50 text-slate-600 transition-colors"
            title="Reset View"
          >
            <Maximize className="w-4 h-4" />
          </button>
        </div>

        <div className="bg-white rounded-lg border shadow-sm p-2 text-slate-400">
          <Hand className="w-4 h-4" />
        </div>
      </div>

      <div className="absolute bottom-4 right-4 bg-white/80 backdrop-blur px-3 py-1.5 rounded-full border shadow-sm flex gap-3 text-[10px] font-mono text-slate-500 items-center">
        <div className="flex items-center gap-1">
          <span className="opacity-50">ZOOM</span>
          <span className="font-bold text-slate-700">{(zoom * 100).toFixed(0)}%</span>
        </div>
        <div className="w-px h-3 bg-slate-200" />
        <div className="flex items-center gap-1">
          <span className="opacity-50">UNIT</span>
          <span className="font-bold text-slate-700">METERS (m)</span>
        </div>
        <div className="w-px h-3 bg-slate-200" />
        <div className="flex items-center gap-1">
          <span className="opacity-50">GRID</span>
          <span className="font-bold text-slate-700">{gridInterval}m</span>
        </div>
      </div>
    </div>
  );
};
