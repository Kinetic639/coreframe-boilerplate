import React from "react";
import {
  Info,
  Split,
  Trash2,
  Edit3,
  Plus,
  ChevronRight,
  Layout,
  Grid3X3,
  Magnet,
} from "lucide-react";
import { LocationNode, LocationType } from "../types";
import { cn } from "../lib/utils";

interface InspectorProps {
  selectedLocation: LocationNode | null;
  onUpdate: (id: string, updates: Partial<LocationNode>) => void;
  onDelete: (id: string) => void;
  onDivide: (id: string, mode: "horizontal" | "vertical", count: number) => void;
  onAddChild: (parentId: string) => void;
  showGrid: boolean;
  onToggleGrid: () => void;
  snapToGrid: boolean;
  onToggleSnap: () => void;
  gridInterval: number;
  onGridIntervalChange: (interval: number) => void;
}

export const Inspector: React.FC<InspectorProps> = ({
  selectedLocation,
  onUpdate,
  onDelete,
  onDivide,
  onAddChild,
  showGrid,
  onToggleGrid,
  snapToGrid,
  onToggleSnap,
  gridInterval,
  onGridIntervalChange,
}) => {
  const [divideCount, setDivideCount] = React.useState(2);

  if (!selectedLocation) {
    return (
      <div className="w-80 h-full border-l bg-white p-8 flex flex-col items-center justify-center text-center text-slate-400">
        <Info className="w-12 h-12 mb-4 opacity-20" />
        <p className="text-sm">Select a location to view details and manage its layout.</p>
      </div>
    );
  }

  const locationTypes: LocationType[] = ["warehouse", "storage", "obstacle"];

  return (
    <div className="w-80 h-full border-l bg-white flex flex-col">
      <div className="p-4 border-b bg-slate-50 flex items-center justify-between">
        <h2 className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Inspector</h2>
        <button
          onClick={() => onDelete(selectedLocation.id)}
          className="p-1.5 text-slate-400 hover:text-red-500 hover:bg-red-50 transition-colors rounded"
          title="Delete Location"
        >
          <Trash2 className="w-4 h-4" />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-6">
        {/* Basic Info */}
        <div className="space-y-4">
          <div>
            <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">
              Name
            </label>
            <input
              type="text"
              value={selectedLocation.name}
              onChange={(e) => onUpdate(selectedLocation.id, { name: e.target.value })}
              className="w-full px-3 py-2 border rounded-md text-sm focus:ring-2 focus:ring-blue-500 outline-none"
            />
          </div>
          <div>
            <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">
              Slug / Code
            </label>
            <input
              type="text"
              value={selectedLocation.slug}
              onChange={(e) =>
                onUpdate(selectedLocation.id, { slug: e.target.value.toUpperCase() })
              }
              className="w-full px-3 py-2 border rounded-md text-sm font-mono focus:ring-2 focus:ring-blue-500 outline-none"
            />
          </div>
          <div>
            <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">
              Type
            </label>
            <select
              value={selectedLocation.type}
              onChange={(e) =>
                onUpdate(selectedLocation.id, { type: e.target.value as LocationType })
              }
              className="w-full px-3 py-2 border rounded-md text-sm focus:ring-2 focus:ring-blue-500 outline-none bg-white"
            >
              {locationTypes.map((t) => (
                <option key={t} value={t}>
                  {t.charAt(0).toUpperCase() + t.slice(1).replace("_", " ")}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Path Info */}
        <div className="p-3 bg-slate-50 rounded-lg border border-slate-100">
          <label className="block text-[10px] font-bold text-slate-400 uppercase mb-2">
            Full Path
          </label>
          <div className="flex flex-wrap gap-1 items-center text-[11px] font-mono text-slate-600">
            {selectedLocation.fullPath.split("/").map((part, i, arr) => (
              <React.Fragment key={i}>
                <span className="bg-white px-1.5 py-0.5 rounded border border-slate-200">
                  {part}
                </span>
                {i < arr.length - 1 && <ChevronRight className="w-3 h-3 text-slate-300" />}
              </React.Fragment>
            ))}
          </div>
        </div>

        {/* Geometry Info */}
        {selectedLocation.geometry && (
          <div className="pt-6 border-t space-y-4">
            <h3 className="text-xs font-bold text-slate-700 uppercase flex items-center gap-2">
              <Layout className="w-3.5 h-3.5" /> Geometry
            </h3>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">
                  X Position (m)
                </label>
                <input
                  type="number"
                  step="0.1"
                  value={selectedLocation.geometry.x}
                  onChange={(e) =>
                    onUpdate(selectedLocation.id, {
                      geometry: {
                        ...selectedLocation.geometry!,
                        x: parseFloat(e.target.value) || 0,
                      },
                    })
                  }
                  className="w-full px-2 py-1.5 border rounded text-xs font-mono"
                />
              </div>
              <div>
                <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">
                  Y Position (m)
                </label>
                <input
                  type="number"
                  step="0.1"
                  value={selectedLocation.geometry.y}
                  onChange={(e) =>
                    onUpdate(selectedLocation.id, {
                      geometry: {
                        ...selectedLocation.geometry!,
                        y: parseFloat(e.target.value) || 0,
                      },
                    })
                  }
                  className="w-full px-2 py-1.5 border rounded text-xs font-mono"
                />
              </div>
              <div>
                <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">
                  Width (m)
                </label>
                <input
                  type="number"
                  step="0.1"
                  min="0.1"
                  value={selectedLocation.geometry.width}
                  onChange={(e) =>
                    onUpdate(selectedLocation.id, {
                      geometry: {
                        ...selectedLocation.geometry!,
                        width: Math.max(0.1, parseFloat(e.target.value) || 0.1),
                      },
                    })
                  }
                  className="w-full px-2 py-1.5 border rounded text-xs font-mono"
                />
              </div>
              <div>
                <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">
                  Height (m)
                </label>
                <input
                  type="number"
                  step="0.1"
                  min="0.1"
                  value={selectedLocation.geometry.height}
                  onChange={(e) =>
                    onUpdate(selectedLocation.id, {
                      geometry: {
                        ...selectedLocation.geometry!,
                        height: Math.max(0.1, parseFloat(e.target.value) || 0.1),
                      },
                    })
                  }
                  className="w-full px-2 py-1.5 border rounded text-xs font-mono"
                />
              </div>
            </div>
          </div>
        )}

        {/* Grid Options (Warehouse Only) */}
        {selectedLocation.type === "warehouse" && (
          <div className="pt-6 border-t space-y-4">
            <h3 className="text-xs font-bold text-slate-700 uppercase flex items-center gap-2">
              <Grid3X3 className="w-3.5 h-3.5" /> Grid Settings
            </h3>
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <label className="text-xs text-slate-600 font-medium">Show Grid</label>
                <button
                  onClick={onToggleGrid}
                  className={cn(
                    "w-10 h-5 rounded-full transition-colors relative",
                    showGrid ? "bg-blue-600" : "bg-slate-200"
                  )}
                >
                  <div
                    className={cn(
                      "w-4 h-4 bg-white rounded-full absolute top-0.5 transition-transform",
                      showGrid ? "translate-x-5" : "translate-x-0.5"
                    )}
                  />
                </button>
              </div>

              <div className="flex items-center justify-between">
                <label className="text-xs text-slate-600 font-medium flex items-center gap-1.5">
                  <Magnet className="w-3.5 h-3.5" /> Snap to Grid
                </label>
                <button
                  onClick={onToggleSnap}
                  className={cn(
                    "w-10 h-5 rounded-full transition-colors relative",
                    snapToGrid ? "bg-blue-600" : "bg-slate-200"
                  )}
                >
                  <div
                    className={cn(
                      "w-4 h-4 bg-white rounded-full absolute top-0.5 transition-transform",
                      snapToGrid ? "translate-x-5" : "translate-x-0.5"
                    )}
                  />
                </button>
              </div>

              {showGrid && (
                <div className="flex items-center justify-between pt-2">
                  <label className="text-xs text-slate-600 font-medium">Grid Size</label>
                  <select
                    value={gridInterval}
                    onChange={(e) => onGridIntervalChange(parseFloat(e.target.value))}
                    className="bg-slate-50 border border-slate-200 rounded px-2 py-1 text-xs font-medium text-slate-700 outline-none focus:border-blue-500"
                  >
                    <option value={0.1}>0.1m</option>
                    <option value={0.5}>0.5m</option>
                    <option value={1}>1.0m</option>
                    <option value={2}>2.0m</option>
                    <option value={5}>5.0m</option>
                    <option value={10}>10.0m</option>
                  </select>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Subdivision Controls */}
        <div className="pt-6 border-t space-y-4">
          <h3 className="text-xs font-bold text-slate-700 uppercase flex items-center gap-2">
            <Split className="w-3.5 h-3.5" /> Subdivision
          </h3>
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <label className="text-xs text-slate-500">Count:</label>
              <input
                type="number"
                min="2"
                max="20"
                value={divideCount}
                onChange={(e) => setDivideCount(parseInt(e.target.value) || 2)}
                className="w-16 px-2 py-1 border rounded text-xs"
              />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <button
                onClick={() => onDivide(selectedLocation.id, "horizontal", divideCount)}
                className="flex flex-col items-center justify-center p-3 border rounded-lg hover:bg-blue-50 hover:border-blue-200 transition-all group"
              >
                <div className="flex gap-0.5 mb-2">
                  <div className="w-2 h-4 bg-slate-200 group-hover:bg-blue-300 rounded-sm" />
                  <div className="w-2 h-4 bg-slate-200 group-hover:bg-blue-300 rounded-sm" />
                  <div className="w-2 h-4 bg-slate-200 group-hover:bg-blue-300 rounded-sm" />
                </div>
                <span className="text-[10px] font-medium text-slate-600 group-hover:text-blue-700">
                  Horizontal
                </span>
              </button>
              <button
                onClick={() => onDivide(selectedLocation.id, "vertical", divideCount)}
                className="flex flex-col items-center justify-center p-3 border rounded-lg hover:bg-blue-50 hover:border-blue-200 transition-all group"
              >
                <div className="flex flex-col gap-0.5 mb-2">
                  <div className="w-4 h-2 bg-slate-200 group-hover:bg-blue-300 rounded-sm" />
                  <div className="w-4 h-2 bg-slate-200 group-hover:bg-blue-300 rounded-sm" />
                  <div className="w-4 h-2 bg-slate-200 group-hover:bg-blue-300 rounded-sm" />
                </div>
                <span className="text-[10px] font-medium text-slate-600 group-hover:text-blue-700">
                  Vertical
                </span>
              </button>
            </div>
          </div>
        </div>

        {/* Actions */}
        <div className="pt-6 border-t space-y-2">
          <button
            onClick={() => onAddChild(selectedLocation.id)}
            className="w-full flex items-center justify-center gap-2 py-2 px-4 bg-slate-900 text-white rounded-md text-sm hover:bg-slate-800 transition-colors"
          >
            <Plus className="w-4 h-4" />
            {selectedLocation.type === "warehouse" ? "Add Storage" : "Add Sub-location"}
          </button>
        </div>
      </div>
    </div>
  );
};
