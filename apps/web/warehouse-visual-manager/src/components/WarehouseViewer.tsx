import React, { useEffect, useRef, useState } from "react";
import { Stage, Layer, Rect, Group, Text, Line } from "react-konva";
import { LocationNode, METER_TO_PIXEL } from "../types";

interface WarehouseViewerProps {
  locations: LocationNode[];
  highlightId: string | null;
  className?: string;
}

export const WarehouseViewer: React.FC<WarehouseViewerProps> = ({
  locations,
  highlightId,
  className = "",
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const stageRef = useRef<any>(null);
  const [dimensions, setDimensions] = useState({ width: 0, height: 0 });
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });

  // Handle resizing
  useEffect(() => {
    const updateDimensions = () => {
      if (containerRef.current) {
        setDimensions({
          width: containerRef.current.offsetWidth,
          height: containerRef.current.offsetHeight,
        });
      }
    };

    updateDimensions();
    window.addEventListener("resize", updateDimensions);
    return () => window.removeEventListener("resize", updateDimensions);
  }, []);

  // Auto-zoom to fit all root warehouses
  useEffect(() => {
    if (dimensions.width === 0 || locations.length === 0) return;

    const activeLocations = locations.filter((l) => !l.deletedAt && l.geometry);
    if (activeLocations.length === 0) return;

    const targetBounds = { minX: Infinity, minY: Infinity, maxX: -Infinity, maxY: -Infinity };

    // Always fit all root warehouses to keep the view stable
    const roots = activeLocations.filter((l) => !l.parentId);
    roots.forEach((r) => {
      const g = r.geometry!;
      targetBounds.minX = Math.min(targetBounds.minX, g.x);
      targetBounds.minY = Math.min(targetBounds.minY, g.y);
      targetBounds.maxX = Math.max(targetBounds.maxX, g.x + g.width);
      targetBounds.maxY = Math.max(targetBounds.maxY, g.y + g.height);
    });

    if (targetBounds.minX === Infinity) return;

    const padding = 2; // meters
    const w = targetBounds.maxX - targetBounds.minX + padding * 2;
    const h = targetBounds.maxY - targetBounds.minY + padding * 2;

    const zoomX = dimensions.width / (w * METER_TO_PIXEL);
    const zoomY = dimensions.height / (h * METER_TO_PIXEL);
    const newZoom = Math.min(zoomX, zoomY, 2); // Cap zoom at 2x

    const centerX = (targetBounds.minX + targetBounds.maxX) / 2;
    const centerY = (targetBounds.minY + targetBounds.maxY) / 2;

    setZoom(newZoom);
    setPan({
      x: dimensions.width / 2 - centerX * METER_TO_PIXEL * newZoom,
      y: dimensions.height / 2 - centerY * METER_TO_PIXEL * newZoom,
    });
  }, [dimensions, locations]); // Removed highlightId from dependencies for stable view

  const renderLocations = (parentId: string | null) => {
    return locations
      .filter((l) => !l.deletedAt && l.geometry && l.parentId === parentId)
      .map((location) => {
        const geo = location.geometry!;
        const isHighlighted = highlightId === location.id;
        const isWarehouse = location.type === "warehouse";

        return (
          <Group key={location.id} x={geo.x} y={geo.y}>
            <Rect
              width={geo.width}
              height={geo.height}
              fill={
                isWarehouse
                  ? "white"
                  : location.type === "obstacle"
                    ? isHighlighted
                      ? "rgba(239, 68, 68, 0.4)"
                      : "rgba(239, 68, 68, 0.1)"
                    : isHighlighted
                      ? "rgba(59, 130, 246, 0.3)"
                      : "white"
              }
              stroke={
                isWarehouse
                  ? "#1e293b"
                  : location.type === "obstacle"
                    ? isHighlighted
                      ? "#dc2626"
                      : "#f87171"
                    : isHighlighted
                      ? "#2563eb"
                      : "#64748b"
              }
              strokeWidth={(isHighlighted ? 3 : 1) / (zoom * METER_TO_PIXEL)}
              cornerRadius={isWarehouse ? 0 : 0.05}
            />

            {isWarehouse && (
              <Text
                x={0.2}
                y={-0.8}
                text={location.name}
                fontSize={0.6}
                fontFamily="sans-serif"
                fontStyle="bold"
                fill="#1e293b"
              />
            )}

            <Text
              x={0.1}
              y={0.1}
              text={location.slug}
              fontSize={0.4}
              fontFamily="monospace"
              fill={isHighlighted ? "#2563eb" : "#64748b"}
            />

            {renderLocations(location.id)}
          </Group>
        );
      });
  };

  return (
    <div ref={containerRef} className={`w-full h-full bg-slate-100 ${className}`}>
      <Stage
        width={dimensions.width}
        height={dimensions.height}
        scaleX={zoom * METER_TO_PIXEL}
        scaleY={zoom * METER_TO_PIXEL}
        x={pan.x}
        y={pan.y}
      >
        <Layer>{renderLocations(null)}</Layer>
      </Stage>
    </div>
  );
};
