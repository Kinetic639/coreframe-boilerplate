/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from "react";
import { v4 as uuidv4 } from "uuid";
import { Header, ViewMode } from "./components/Header";
import { TreeSidebar } from "./components/TreeSidebar";
import { WarehouseCanvas } from "./components/WarehouseCanvas";
import { WarehouseViewer } from "./components/WarehouseViewer";
import { Inspector } from "./components/Inspector";
import { Toolbox } from "./components/Toolbox";
import { Modal } from "./components/Modal";
import { LocationNode, LocationType, Geometry } from "./types";
import { calculateFullPath, generateSlug } from "./lib/utils";

export default function App() {
  const [locations, setLocations] = React.useState<LocationNode[]>([]);
  const [selectedId, setSelectedId] = React.useState<string | null>(null);
  const [zoom, setZoom] = React.useState(1);
  const [pan, setPan] = React.useState({ x: 0, y: 0 });
  const [isAddModalOpen, setIsAddModalOpen] = React.useState(false);
  const [newWarehouseName, setNewWarehouseName] = React.useState("");
  const [newWarehouseWidth, setNewWarehouseWidth] = React.useState(50);
  const [newWarehouseHeight, setNewWarehouseHeight] = React.useState(30);
  const [showGrid, setShowGrid] = React.useState(true);
  const [snapToGrid, setSnapToGrid] = React.useState(true);
  const [showInspector, setShowInspector] = React.useState(true);
  const [gridInterval, setGridInterval] = React.useState(1); // 1 meter
  const [viewMode, setViewMode] = React.useState<ViewMode>("editor");

  const selectedLocation = React.useMemo(
    () => locations.find((l) => l.id === selectedId) || null,
    [locations, selectedId]
  );

  // Persistence
  React.useEffect(() => {
    const saved = localStorage.getItem("warehouse_locations");
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) {
          setLocations(parsed);
          // Select the first root or first item
          setSelectedId(parsed[0].id);
          return;
        }
      } catch (e) {
        console.error("Failed to load saved locations", e);
      }
    }

    // Initial mock data if nothing saved
    const rootId = uuidv4();
    const shelfId = uuidv4();

    const root: LocationNode = {
      id: rootId,
      parentId: null,
      rootLocationId: rootId,
      name: "Main Warehouse",
      slug: "MW",
      fullPath: "MW",
      type: "warehouse",
      level: 0,
      sortOrder: 0,
      geometry: { x: 0, y: 0, width: 50, height: 30, rotation: 0 },
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };

    const shelf: LocationNode = {
      id: shelfId,
      parentId: rootId,
      rootLocationId: rootId,
      name: "Storage S1",
      slug: "S1",
      fullPath: "MW/S1",
      type: "storage",
      level: 1,
      sortOrder: 0,
      geometry: { x: 5, y: 5, width: 2, height: 10, rotation: 0 },
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };

    setLocations([root, shelf]);
    setSelectedId(shelfId);
  }, []);

  React.useEffect(() => {
    if (locations.length > 0) {
      localStorage.setItem("warehouse_locations", JSON.stringify(locations));
    }
  }, [locations]);

  const handleSave = () => {
    localStorage.setItem("warehouse_locations", JSON.stringify(locations));
  };

  const handleAddRoot = () => {
    if (!newWarehouseName.trim()) return;

    const id = uuidv4();
    const slug = generateSlug(newWarehouseName).toUpperCase();
    const newRoot: LocationNode = {
      id,
      parentId: null,
      rootLocationId: id,
      name: newWarehouseName,
      slug,
      fullPath: slug,
      type: "warehouse",
      level: 0,
      sortOrder: locations.length,
      geometry: { x: 0, y: 0, width: newWarehouseWidth, height: newWarehouseHeight, rotation: 0 },
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };
    setLocations([...locations, newRoot]);
    setSelectedId(id);
    setIsAddModalOpen(false);
    setNewWarehouseName("");
    setNewWarehouseWidth(50);
    setNewWarehouseHeight(30);
  };

  const handleAddChild = (parentId: string) => {
    const parent = locations.find((l) => l.id === parentId);
    if (!parent) return;

    const id = uuidv4();
    const isParentRoot = !parent.parentId;
    const type: LocationType = "storage";
    const name = `New Storage`;
    const slug = `S${locations.filter((l) => l.parentId === parentId && l.type === type).length + 1}`;

    const newChild: LocationNode = {
      id,
      parentId,
      rootLocationId: parent.rootLocationId,
      name,
      slug,
      fullPath: calculateFullPath(parent.fullPath, slug),
      type,
      level: parent.level + 1,
      sortOrder: locations.filter((l) => l.parentId === parentId).length,
      geometry: parent.geometry
        ? {
            x: parent.geometry.x + 1,
            y: parent.geometry.y + 1,
            width: 1,
            height: 2,
            rotation: 0,
          }
        : { x: 1, y: 1, width: 1, height: 2, rotation: 0 },
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };

    setLocations([...locations, newChild]);
    setSelectedId(id);
  };

  const handleUpdate = (id: string, updates: Partial<LocationNode>) => {
    setLocations((prev) => {
      const updatedLocations = [...prev];
      const index = updatedLocations.findIndex((l) => l.id === id);
      if (index === -1) return prev;

      const oldLocation = updatedLocations[index];
      const updatedLocation = { ...oldLocation, ...updates, updatedAt: Date.now() };

      // If slug changed, we need to update fullPath and all descendants' fullPaths
      if (updates.slug && updates.slug !== oldLocation.slug) {
        const parent = updatedLocations.find((p) => p.id === updatedLocation.parentId);
        updatedLocation.fullPath = calculateFullPath(parent?.fullPath || null, updates.slug);

        // Recursive update for all descendants
        const updateDescendants = (parentId: string, parentPath: string) => {
          updatedLocations.forEach((loc, i) => {
            if (loc.parentId === parentId) {
              const newPath = calculateFullPath(parentPath, loc.slug);
              updatedLocations[i] = { ...loc, fullPath: newPath, updatedAt: Date.now() };
              updateDescendants(loc.id, newPath);
            }
          });
        };

        updatedLocations[index] = updatedLocation;
        updateDescendants(id, updatedLocation.fullPath);
      } else {
        updatedLocations[index] = updatedLocation;
      }

      return updatedLocations;
    });
  };

  const handleDelete = (id: string) => {
    setLocations((prev) =>
      prev.map((l) => {
        if (l.id === id || l.parentId === id) {
          return { ...l, deletedAt: Date.now(), updatedAt: Date.now() } as any;
        }
        return l;
      })
    );
    if (selectedId === id) setSelectedId(null);
  };

  const activeLocations = React.useMemo(() => locations.filter((l) => !l.deletedAt), [locations]);

  const snap = (val: number) => (snapToGrid ? Math.round(val / gridInterval) * gridInterval : val);

  const getAbsolutePosition = (id: string | null): { x: number; y: number } => {
    if (!id) return { x: 0, y: 0 };
    const location = locations.find((l) => l.id === id);
    if (!location || !location.geometry) return { x: 0, y: 0 };

    const parentPos = getAbsolutePosition(location.parentId);
    return {
      x: parentPos.x + location.geometry.x,
      y: parentPos.y + location.geometry.y,
    };
  };

  const handleDivide = (id: string, mode: "horizontal" | "vertical", count: number) => {
    const target = locations.find((l) => l.id === id);
    if (!target || !target.geometry) return;

    const newChildren: LocationNode[] = [];
    const { width, height } = target.geometry;

    for (let i = 0; i < count; i++) {
      const childId = uuidv4();
      const slug = `${i + 1}`;

      const childGeo: Geometry =
        mode === "horizontal"
          ? {
              x: (width / count) * i,
              y: 0,
              width: width / count,
              height: height,
              rotation: 0,
            }
          : {
              x: 0,
              y: (height / count) * i,
              width: width,
              height: height / count,
              rotation: 0,
            };

      newChildren.push({
        id: childId,
        parentId: id,
        rootLocationId: target.rootLocationId,
        name: `${target.name} ${mode === "horizontal" ? "Col" : "Row"} ${i + 1}`,
        slug,
        fullPath: calculateFullPath(target.fullPath, slug),
        type: "storage",
        level: target.level + 1,
        sortOrder: i,
        geometry: childGeo,
        createdAt: Date.now(),
        updatedAt: Date.now(),
      });
    }

    setLocations((prev) => [...prev, ...newChildren]);
  };

  const handleDropNewLocation = (type: LocationType, x: number, y: number) => {
    // Determine parent: if a location is selected, use it.
    // Otherwise use the first root warehouse.
    let parentId = selectedId;
    if (!parentId) {
      const root = locations.find((l) => !l.parentId && !l.deletedAt);
      if (root) parentId = root.id;
    }

    if (!parentId) return;

    const parent = locations.find((l) => l.id === parentId);
    if (!parent || !parent.geometry) return;

    // Convert global drop coordinates to relative coordinates
    const parentAbsPos = getAbsolutePosition(parentId);
    const relativeX = snap(x - parentAbsPos.x);
    const relativeY = snap(y - parentAbsPos.y);
    const width = 1;
    const height = 2;

    // Check for collisions before adding
    const hasCollision = locations.some((l) => {
      if (l.parentId !== parentId || !l.geometry || l.deletedAt) return false;
      const s = l.geometry;
      return (
        relativeX < s.x + s.width - 0.001 &&
        relativeX + width > s.x + 0.001 &&
        relativeY < s.y + s.height - 0.001 &&
        relativeY + height > s.y + 0.001
      );
    });

    if (hasCollision) {
      console.warn("Cannot drop here: space occupied");
      return;
    }

    const id = uuidv4();
    const name = `New ${type.charAt(0).toUpperCase() + type.slice(1)}`;
    const slug = `${type.charAt(0).toUpperCase()}${locations.filter((l) => l.parentId === parentId && l.type === type).length + 1}`;

    const newChild: LocationNode = {
      id,
      parentId,
      rootLocationId: parent.rootLocationId,
      name,
      slug,
      fullPath: calculateFullPath(parent.fullPath, slug),
      type,
      level: parent.level + 1,
      sortOrder: locations.filter((l) => l.parentId === parentId).length,
      geometry: {
        x: relativeX,
        y: relativeY,
        width: 1,
        height: 2,
        rotation: 0,
      },
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };

    setLocations([...locations, newChild]);
    setSelectedId(id);
  };

  const handleReset = () => {
    localStorage.removeItem("warehouse_locations");
    window.location.reload();
  };

  return (
    <div className="flex flex-col h-screen w-screen bg-slate-50 overflow-hidden text-slate-900 font-sans">
      <Header
        selectedLocation={selectedLocation}
        onSave={handleSave}
        onReset={handleReset}
        showInspector={showInspector}
        onToggleInspector={() => setShowInspector(!showInspector)}
        viewMode={viewMode}
        onViewModeChange={setViewMode}
      />

      <main className="flex flex-1 overflow-hidden">
        {viewMode === "editor" ? (
          <>
            <div className="flex flex-col h-full shrink-0">
              <TreeSidebar
                locations={activeLocations}
                selectedId={selectedId}
                onSelect={setSelectedId}
                onAddRoot={() => setIsAddModalOpen(true)}
              />
              <Toolbox />
            </div>

            <WarehouseCanvas
              locations={activeLocations}
              selectedId={selectedId}
              onSelect={setSelectedId}
              onUpdate={handleUpdate}
              onDropNewLocation={handleDropNewLocation}
              zoom={zoom}
              setZoom={setZoom}
              pan={pan}
              setPan={setPan}
              showGrid={showGrid}
              snapToGrid={snapToGrid}
              gridInterval={gridInterval}
            />

            {showInspector && (
              <Inspector
                selectedLocation={selectedLocation}
                onUpdate={handleUpdate}
                onDelete={handleDelete}
                onDivide={handleDivide}
                onAddChild={handleAddChild}
                showGrid={showGrid}
                onToggleGrid={() => setShowGrid(!showGrid)}
                snapToGrid={snapToGrid}
                onToggleSnap={() => setSnapToGrid(!snapToGrid)}
                gridInterval={gridInterval}
                onGridIntervalChange={setGridInterval}
              />
            )}
          </>
        ) : (
          <>
            <div className="flex flex-col h-full shrink-0">
              <TreeSidebar
                locations={activeLocations}
                selectedId={selectedId}
                onSelect={setSelectedId}
                onAddRoot={() => setIsAddModalOpen(true)}
              />
            </div>
            <div className="flex-1 bg-slate-50 p-8 overflow-auto">
              <div className="max-w-6xl mx-auto h-full flex flex-col gap-6">
                <div className="flex items-center justify-between">
                  <div>
                    <h2 className="text-2xl font-bold text-slate-800">Warehouse Preview</h2>
                    <p className="text-slate-500 text-sm">
                      Interactive map viewer for your warehouse layout.
                    </p>
                  </div>
                  {selectedLocation && (
                    <div className="bg-blue-50 text-blue-700 px-4 py-2 rounded-lg border border-blue-100 flex items-center gap-2 shadow-sm">
                      <span className="text-[10px] font-black uppercase tracking-widest opacity-50">
                        Selected:
                      </span>
                      <span className="font-bold text-sm tracking-tight">
                        {selectedLocation.name}
                      </span>
                    </div>
                  )}
                </div>

                <div className="flex-1 bg-white rounded-2xl border shadow-2xl overflow-hidden min-h-[600px]">
                  <WarehouseViewer locations={activeLocations} highlightId={selectedId} />
                </div>
              </div>
            </div>
          </>
        )}
      </main>

      <Modal
        isOpen={isAddModalOpen}
        onClose={() => setIsAddModalOpen(false)}
        title="Add New Warehouse"
      >
        <div className="space-y-4">
          <div>
            <label className="block text-xs font-bold text-slate-400 uppercase mb-1">
              Warehouse Name
            </label>
            <input
              type="text"
              placeholder="e.g. Main Distribution Center"
              value={newWarehouseName}
              onChange={(e) => setNewWarehouseName(e.target.value)}
              className="w-full px-3 py-2 border rounded-md text-sm focus:ring-2 focus:ring-blue-500 outline-none"
              autoFocus
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold text-slate-400 uppercase mb-1">
                Width (m)
              </label>
              <input
                type="number"
                value={newWarehouseWidth}
                onChange={(e) => setNewWarehouseWidth(parseInt(e.target.value) || 0)}
                className="w-full px-3 py-2 border rounded-md text-sm focus:ring-2 focus:ring-blue-500 outline-none"
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-400 uppercase mb-1">
                Length (m)
              </label>
              <input
                type="number"
                value={newWarehouseHeight}
                onChange={(e) => setNewWarehouseHeight(parseInt(e.target.value) || 0)}
                className="w-full px-3 py-2 border rounded-md text-sm focus:ring-2 focus:ring-blue-500 outline-none"
              />
            </div>
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <button
              onClick={() => setIsAddModalOpen(false)}
              className="px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50 rounded-md transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handleAddRoot}
              className="px-4 py-2 text-sm font-medium bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors"
            >
              Create Warehouse
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
