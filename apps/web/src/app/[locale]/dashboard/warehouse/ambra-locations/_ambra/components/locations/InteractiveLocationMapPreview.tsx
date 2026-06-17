"use client";

/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useMemo, useEffect, useRef, useCallback } from "react";
import { useTranslations } from "next-intl";
import {
  Search,
  SearchX,
  X,
  ArrowLeft,
  ChevronRight,
  Info,
  Maximize2,
  Edit2,
  Box,
  Layers,
  MapPin,
  AlertTriangle,
  ZoomIn,
  ZoomOut,
  Maximize,
  ChevronDown,
  ExternalLink,
  Plus,
  Package,
  AlertCircle,
  LayoutGrid,
  Database,
  Truck,
  RotateCcw,
  ShieldAlert,
  CheckSquare,
  Server,
  Construction,
  Briefcase,
  Inbox,
  Layout as LayoutIcon,
  Car,
  Flag,
  ArrowRightLeft as MoveDesign,
  Rows,
  Move,
  Archive,
  Shield,
  Tag,
  Zap,
  Star,
  Heart,
  Coffee,
  Key,
  Hammer,
  Scale,
  Clock,
  Copy,
  Trash2,
  Search as SearchIcon,
  Fingerprint,
  ShieldCheck,
  Triangle,
  Circle,
  LayoutList,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import {
  VisualNode,
  StructureNode,
  LogicalLocation,
  Layout,
  ViewMode,
  VisualNodeRole,
  LocationRole,
} from "../../types";
import {
  buildLocationMappingIndex,
  resolveLocationVisual,
  searchLocationsAndVisuals,
  LocationVisualResolution,
  MappingIndex,
} from "../../lib/locationMappingResolver";
import { cn } from "../../lib/utils";
import { SECTION_SKINS } from "../../constants/skins";

const ALL_ICONS: Record<string, any> = {
  Database,
  Layers,
  MapPin,
  Box,
  Inbox,
  Truck,
  RotateCcw,
  ShieldAlert,
  CheckSquare,
  Server,
  Construction,
  Briefcase,
  Layout: LayoutIcon,
  Car,
  Flag,
  ArrowRightLeft: MoveDesign,
  Move,
  Rows,
  Archive,
  Shield,
  Tag,
  Zap,
  Star,
  Heart,
  Coffee,
  Key,
  Hammer,
  Scale,
  Maximize2,
  AlertCircle,
  Clock,
  ExternalLink,
  Copy,
  Trash2,
  Search: SearchIcon,
  Fingerprint,
  ShieldCheck,
  Triangle,
  Package,
  Circle,
  LayoutGrid,
};

const IconRenderer = ({
  name,
  className,
  color,
}: {
  name: string;
  className?: string;
  color?: string;
}) => {
  const IconComponent = ALL_ICONS[name] || Box;
  return <IconComponent className={className} color={color} />;
};

const LOCATION_CATEGORIES: Record<string, any> = {
  [LocationRole.WAREHOUSE]: { label: "Warehouse", iconName: "Database", color: "text-primary" },
  [LocationRole.ZONE]: { label: "Zone", iconName: "Layers", color: "text-indigo-400" },
  [LocationRole.AISLE]: { label: "Aisle", iconName: "Move", color: "text-amber-400" },
  [LocationRole.RACK]: { label: "Rack", iconName: "LayoutGrid", color: "text-emerald-400" },
  [LocationRole.SHELF]: { label: "Shelf", iconName: "Rows", color: "text-blue-400" },
  [LocationRole.BIN]: { label: "Bin", iconName: "Box", color: "text-orange-400" },
  [LocationRole.STAGING]: { label: "Staging", iconName: "Layers", color: "text-purple-400" },
};

export interface InteractiveLocationMapPreviewProps {
  layout: Layout;
  visualNodes: VisualNode[];
  locations: LogicalLocation[];
  initialLocationId?: string;
  compact?: boolean;
  embedded?: boolean;
  onClose?: () => void;
  onOpenEditor?: () => void;
  canEdit?: boolean;
}

interface ViewTransform {
  x: number;
  y: number;
  scale: number;
}

export function InteractiveLocationMapPreview({
  layout,
  visualNodes,
  locations,
  initialLocationId,
  compact = false,
  embedded = false,
  onClose,
  onOpenEditor,
  canEdit = false,
}: InteractiveLocationMapPreviewProps) {
  const t = useTranslations("ambraLocations.preview");
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedLocationId, setSelectedLocationId] = useState<string | null>(
    initialLocationId || null
  );
  const [selectedVisualNodeId, setSelectedVisualNodeId] = useState<string | null>(null);
  const [hoveredNodeId, setHoveredNodeId] = useState<string | null>(null);
  const [expandedLocationIds, setExpandedLocationIds] = useState<Set<string>>(new Set());
  const [mainViewMode, setMainViewMode] = useState<"top" | "front">("top");
  const [showMinimap, setShowMinimap] = useState(true);

  // Transforms
  const [topDownTransform, setTopDownTransform] = useState<ViewTransform>({ x: 0, y: 0, scale: 1 });
  const [frontTransform, setFrontTransform] = useState<ViewTransform>({ x: 0, y: 0, scale: 1 });

  const topDownContainerRef = useRef<HTMLDivElement>(null);
  const frontContainerRef = useRef<HTMLDivElement>(null);

  // When location changes, clear direct visual selection
  useEffect(() => {
    if (selectedLocationId) setSelectedVisualNodeId(null);
  }, [selectedLocationId]);

  // Build mapping index
  const index = useMemo(
    () => buildLocationMappingIndex(visualNodes, locations),
    [visualNodes, locations]
  );

  // Resolve selected location
  const resolution = useMemo(() => {
    if (!selectedLocationId) return null;
    return resolveLocationVisual(selectedLocationId, visualNodes, index);
  }, [selectedLocationId, visualNodes, index]);

  // Auto-switch view mode on selection
  useEffect(() => {
    if (resolution?.status === "front_cell") {
      setMainViewMode("front");
    } else if (resolution?.status === "top_down") {
      setMainViewMode("top");
    }
  }, [resolution]);

  // Handle derived selections from resolution
  const activeVisualNodeId = useMemo(() => {
    if (!resolution) return null;
    if (resolution.status === "top_down") return resolution.visualNodeId;
    if (resolution.status === "front_cell") return resolution.parentVisualNodeId;
    return null;
  }, [resolution]);

  const activeStructureNodeId = useMemo(() => {
    if (resolution?.status === "front_cell") return resolution.structureNodeId;
    return null;
  }, [resolution]);

  // Hierarchical Location Tree Data
  const locationTree = useMemo(() => {
    const map = new Map<string | null, LogicalLocation[]>();
    locations.forEach((loc) => {
      const parentId = loc.parentId;
      if (!map.has(parentId)) map.set(parentId, []);
      map.get(parentId)!.push(loc);
    });
    return map;
  }, [locations]);

  // Filtered nodes that should be visible (due to search)
  const visibleLocationIds = useMemo(() => {
    if (!searchQuery) return null;
    const ids = new Set<string>();
    const query = searchQuery.toLowerCase();

    locations.forEach((loc) => {
      const matches =
        loc.code.toLowerCase().includes(query) ||
        loc.name.toLowerCase().includes(query) ||
        loc.pathCode.toLowerCase().includes(query);

      if (matches) {
        ids.add(loc.id);
        // Expand ancestors
        let parentId = loc.parentId;
        while (parentId) {
          ids.add(parentId);
          const parent = locations.find((l) => l.id === parentId);
          parentId = parent?.parentId || null;
        }
      }
    });
    return ids;
  }, [searchQuery, locations]);

  // Apply search expansion
  useEffect(() => {
    if (visibleLocationIds) {
      setExpandedLocationIds((prev) => {
        const next = new Set(prev);
        visibleLocationIds.forEach((id) => next.add(id));
        return next;
      });
    }
  }, [visibleLocationIds]);

  // Initial fit to view
  const fitTopDown = useCallback(() => {
    if (!topDownContainerRef.current || visualNodes.length === 0) return;
    const container = topDownContainerRef.current;
    const { width, height } = container.getBoundingClientRect();

    let minX = Infinity,
      minY = Infinity,
      maxX = -Infinity,
      maxY = -Infinity;
    visualNodes.forEach((v) => {
      minX = Math.min(minX, v.x);
      minY = Math.min(minY, v.y);
      maxX = Math.max(maxX, v.x + v.width);
      maxY = Math.max(maxY, v.y + v.depth);
    });

    const contentWidth = maxX - minX;
    const contentHeight = maxY - minY;
    const padding = 100;

    const scale =
      Math.min((width - padding) / contentWidth, (height - padding) / contentHeight) || 1;

    setTopDownTransform({
      x: (width - contentWidth * scale) / 2 - minX * scale,
      y: (height - contentHeight * scale) / 2 - minY * scale,
      scale,
    });
  }, [visualNodes]);

  const fitFront = useCallback(() => {
    if (!frontContainerRef.current || !activeVisualNodeId) return;
    const node = visualNodes.find((n) => n.id === activeVisualNodeId);
    if (!node) return;

    const container = frontContainerRef.current;
    const { width, height } = container.getBoundingClientRect();

    const contentWidth = node.width;
    const contentHeight = node.height;
    const padding = 60;

    const scale =
      Math.min((width - padding) / contentWidth, (height - padding) / contentHeight) || 1;

    setFrontTransform({
      x: (width - contentWidth * scale) / 2,
      y: (height - contentHeight * scale) / 2,
      scale,
    });
  }, [activeVisualNodeId, visualNodes]);

  useEffect(() => {
    if (mainViewMode === "top") fitTopDown();
  }, [fitTopDown, mainViewMode]);

  useEffect(() => {
    if (mainViewMode === "front" && activeVisualNodeId) fitFront();
  }, [activeVisualNodeId, fitFront, mainViewMode]);

  // Pan to selected node
  useEffect(() => {
    if (activeVisualNodeId && topDownContainerRef.current) {
      const node = visualNodes.find((v) => v.id === activeVisualNodeId);
      if (node) {
        const { width, height } = topDownContainerRef.current.getBoundingClientRect();
        setTopDownTransform((prev) => ({
          ...prev,
          x: width / 2 - (node.x + node.width / 2) * prev.scale,
          y: height / 2 - (node.y + node.depth / 2) * prev.scale,
        }));
      }
    }
  }, [activeVisualNodeId, visualNodes]);

  useEffect(() => {
    if (selectedLocationId) {
      const ancestors = [];
      let currentId = selectedLocationId;
      while (currentId) {
        const loc = locations.find((l) => l.id === currentId);
        if (loc?.parentId) {
          ancestors.push(loc.parentId);
          currentId = loc.parentId;
        } else {
          currentId = null;
        }
      }
      if (ancestors.length > 0) {
        setExpandedLocationIds((prev) => {
          const next = new Set(prev);
          ancestors.forEach((id) => next.add(id));
          return next;
        });
      }

      // Scroll into view
      setTimeout(() => {
        const element = document.getElementById(`tree-item-${selectedLocationId}`);
        if (element) {
          element.scrollIntoView({ behavior: "smooth", block: "nearest" });
        }
      }, 100);
    }
  }, [selectedLocationId, locations]);

  const toggleExpand = (id: string) => {
    setExpandedLocationIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const selectedLoc = locations.find((l) => l.id === selectedLocationId);

  // Filtered visuals for map
  const mapVisuals = useMemo(
    () => visualNodes.filter((v) => v.preview?.visibleInPreview !== false),
    [visualNodes]
  );

  return (
    <div
      className={cn(
        "flex flex-col h-full bg-background text-foreground overflow-hidden font-sans",
        !embedded && "fixed inset-0 z-50",
        embedded && "relative rounded-xl border border-border"
      )}
    >
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-border bg-card/70 backdrop-blur-sm z-30">
        <div className="flex items-center gap-3">
          {!embedded && onClose && (
            <button onClick={onClose} className="p-2 hover:bg-muted rounded-lg transition-colors">
              <ArrowLeft className="w-5 h-5" />
            </button>
          )}
          <div>
            <h1 className="text-lg font-semibold tracking-tight leading-none text-foreground">
              {layout.name}
            </h1>
            <span className="text-[10px] text-muted-foreground font-semibold uppercase tracking-wide mt-1 block">
              {t("title")}
            </span>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {canEdit && onOpenEditor && (
            <button
              onClick={onOpenEditor}
              className="flex items-center gap-2 px-3 py-1.5 bg-primary hover:bg-primary/90 text-foreground rounded-lg text-sm font-medium transition-all shadow-sm shadow-primary/20"
            >
              <Edit2 className="w-4 h-4" />
              <span className="hidden sm:inline">{t("openEditor")}</span>
            </button>
          )}
          {!embedded && onClose && (
            <button
              onClick={onClose}
              className="p-2 hover:bg-muted rounded-lg transition-colors text-muted-foreground hover:text-foreground"
            >
              <X className="w-5 h-5" />
            </button>
          )}
        </div>
      </div>

      <div className="flex flex-1 overflow-hidden">
        {/* Left Panel: Location Tree */}
        <div
          className={cn(
            "w-80 border-r border-border flex flex-col bg-card/50 overflow-hidden",
            compact && "w-64"
          )}
        >
          <div className="p-4 border-b border-border bg-card/70">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <input
                type="text"
                placeholder={t("searchPlaceholder")}
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full bg-background border border-border rounded-lg py-2 pl-10 pr-4 text-sm focus:outline-none focus:ring-2 focus:ring-ring/50 transition-all placeholder:text-muted-foreground"
              />
            </div>
          </div>

          <div className="flex-1 overflow-y-auto custom-scrollbar p-2 flex flex-col gap-6">
            <div className="space-y-1">
              <div className="px-2 pb-2 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                {t("locationTree")}
              </div>
              <LocationTree
                locations={(locationTree.get(layout.rootLocationId || null) || []).filter((l) => {
                  const resolution = resolveLocationVisual(l.id, visualNodes, index);
                  const visualNode =
                    resolution.status === "top_down"
                      ? resolution.visualNode
                      : resolution.status === "front_cell"
                        ? resolution.parentVisualNode
                        : null;
                  if (visualNode?.preview?.visibleInPreviewTree === false) return false;
                  return true;
                })}
                treeMap={locationTree}
                selectedId={selectedLocationId}
                onSelect={setSelectedLocationId}
                expandedIds={expandedLocationIds}
                onToggleExpand={toggleExpand}
                visibleIds={visibleLocationIds}
                index={index}
                visualNodes={visualNodes}
              />
            </div>

            {/* Context Objects Section */}
            {visualNodes.some((v) => v.preview?.visibleInPreviewTree && !v.locationId) && (
              <div className="space-y-1 pt-4 border-t border-border">
                <div className="px-2 pb-2 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                  {t("contextObjects")}
                </div>
                <div className="space-y-0.5">
                  {visualNodes
                    .filter((v) => v.preview?.visibleInPreviewTree && !v.locationId)
                    .map((node) => (
                      <button
                        key={node.id}
                        onClick={() => {
                          setSelectedLocationId(null);
                          setSelectedVisualNodeId(node.id);
                        }}
                        className={cn(
                          "w-full text-left p-2 rounded-lg flex items-center gap-3 transition-colors border border-transparent",
                          selectedVisualNodeId === node.id && !selectedLocationId
                            ? "bg-primary/10 border-primary/30 text-foreground"
                            : "hover:bg-muted/50 text-muted-foreground"
                        )}
                      >
                        <div className="p-1 rounded bg-muted border border-border">
                          <Layers className="w-3 h-3 text-muted-foreground" />
                        </div>
                        <span className="text-[11px] font-bold truncate">{node.label}</span>
                      </button>
                    ))}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Main Preview Area */}
        <div className="flex-1 flex flex-col relative bg-background overflow-hidden">
          {mainViewMode === "top" ? (
            <div className="flex-1 relative overflow-hidden" ref={topDownContainerRef}>
              <PanZoomContainer
                transform={topDownTransform}
                onTransformChange={setTopDownTransform}
                className="w-full h-full"
              >
                <PreviewTopDownMap
                  visuals={mapVisuals}
                  selectedNodeId={activeVisualNodeId || selectedVisualNodeId}
                  onSelectNode={(node) => {
                    if (node.preview?.selectableInPreview === false) return;
                    if (node.locationId) setSelectedLocationId(node.locationId);
                    else {
                      setSelectedLocationId(null);
                      setSelectedVisualNodeId(node.id);
                    }
                  }}
                  hoveredNodeId={hoveredNodeId}
                  onHoverNode={setHoveredNodeId}
                  transform={topDownTransform}
                />
              </PanZoomContainer>

              {/* Float Controls Top-Down */}
              <div className="absolute top-4 right-4 flex flex-col gap-2 z-30">
                <div className="bg-card/80 backdrop-blur border border-border rounded-xl p-1 shadow-sm flex flex-col gap-1">
                  <button
                    onClick={() => setTopDownTransform((t) => ({ ...t, scale: t.scale * 1.2 }))}
                    className="p-2 hover:bg-muted rounded-lg transition-colors text-muted-foreground hover:text-foreground"
                    title={t("zoomIn")}
                  >
                    <ZoomIn className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => setTopDownTransform((t) => ({ ...t, scale: t.scale / 1.2 }))}
                    className="p-2 hover:bg-muted rounded-lg transition-colors text-muted-foreground hover:text-foreground"
                    title={t("zoomOut")}
                  >
                    <ZoomOut className="w-4 h-4" />
                  </button>
                  <div className="h-px bg-muted mx-1" />
                  <button
                    onClick={fitTopDown}
                    className="p-2 hover:bg-muted rounded-lg transition-colors text-muted-foreground hover:text-foreground"
                    title={t("fitToView")}
                  >
                    <Maximize className="w-4 h-4" />
                  </button>
                </div>

                {activeVisualNodeId &&
                  visualNodes.find((n) => n.id === activeVisualNodeId)?.structure && (
                    <button
                      onClick={() => setMainViewMode("front")}
                      className="flex items-center gap-2 px-3 py-2 bg-card/80 backdrop-blur border border-border rounded-xl text-xs font-bold text-primary hover:text-foreground transition-all shadow-sm hover:bg-muted"
                    >
                      <LayoutIcon className="w-4 h-4" />
                      <span>{t("enterFrontView")}</span>
                    </button>
                  )}
              </div>
            </div>
          ) : (
            <div className="flex-1 flex flex-col relative bg-background" ref={frontContainerRef}>
              <div className="flex items-center justify-between px-6 py-4 bg-card/70 border-b border-border backdrop-blur-md z-30">
                <div className="flex items-center gap-4">
                  <button
                    onClick={() => setMainViewMode("top")}
                    className="p-2 hover:bg-muted rounded-lg transition-colors text-muted-foreground hover:text-foreground"
                  >
                    <ArrowLeft className="w-5 h-5" />
                  </button>
                  <div>
                    <span className="text-sm font-bold tracking-tight text-foreground block">
                      {visualNodes.find((n) => n.id === activeVisualNodeId)?.label}
                    </span>
                    <span className="text-[10px] text-muted-foreground font-mono uppercase tracking-wide">
                      {t("mainFrontView")}
                    </span>
                  </div>
                </div>

                <div className="flex items-center gap-3">
                  <div className="flex items-center gap-1 bg-background/80 p-1.5 rounded-xl border border-border">
                    <button
                      onClick={() => setFrontTransform((t) => ({ ...t, scale: t.scale * 1.2 }))}
                      className="p-2 hover:bg-muted rounded-lg text-muted-foreground transition-colors"
                    >
                      <ZoomIn className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => setFrontTransform((t) => ({ ...t, scale: t.scale / 1.2 }))}
                      className="p-2 hover:bg-muted rounded-lg text-muted-foreground transition-colors"
                    >
                      <ZoomOut className="w-4 h-4" />
                    </button>
                    <button
                      onClick={fitFront}
                      className="p-2 hover:bg-muted rounded-lg text-muted-foreground transition-colors"
                    >
                      <Maximize className="w-4 h-4" />
                    </button>
                  </div>
                  <button
                    onClick={() => setMainViewMode("top")}
                    className="flex items-center gap-2 px-4 py-2 bg-muted hover:bg-muted rounded-xl text-xs font-bold text-foreground transition-all"
                  >
                    <MoveDesign className="w-4 h-4" />
                    <span>{t("backToMap")}</span>
                  </button>
                </div>
              </div>

              <div className="flex-1 relative overflow-hidden bg-background/80">
                <PanZoomContainer
                  transform={frontTransform}
                  onTransformChange={setFrontTransform}
                  className="w-full h-full"
                >
                  <PreviewFrontView
                    node={
                      visualNodes.find(
                        (n) => n.id === activeVisualNodeId || n.id === selectedVisualNodeId
                      )!
                    }
                    selectedStructureNodeId={activeStructureNodeId}
                    onSelectCell={(cell) => {
                      if (cell.locationId) setSelectedLocationId(cell.locationId);
                      else {
                        setSelectedLocationId(null);
                        setSelectedVisualNodeId(activeVisualNodeId);
                      }
                    }}
                  />
                </PanZoomContainer>
              </div>
            </div>
          )}

          {/* Minimap Overlay */}
          {showMinimap && (
            <AnimatePresence>
              {((mainViewMode === "top" &&
                activeVisualNodeId &&
                visualNodes.find((n) => n.id === activeVisualNodeId)?.structure) ||
                mainViewMode === "front") && (
                <motion.div
                  initial={{ opacity: 0, scale: 0.9, y: 20 }}
                  animate={{ opacity: 1, scale: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.9, y: 20 }}
                  className="absolute bottom-6 right-6 w-72 aspect-video bg-card/90 backdrop-blur-xl border border-border rounded-lg shadow-[0_20px_50px_rgba(0,0,0,0.5)] overflow-hidden z-40 flex flex-col group"
                >
                  <div className="flex items-center justify-between px-3 py-1.5 bg-muted/50 border-b border-border">
                    <span className="text-[9px] font-semibold uppercase tracking-wide text-muted-foreground">
                      {mainViewMode === "top" ? t("frontViewMinimap") : t("topMapMinimap")}
                    </span>
                    <div className="flex items-center gap-1">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          const resetEvent = new CustomEvent("reset-minimap");
                          window.dispatchEvent(resetEvent);
                        }}
                        className="p-1 hover:bg-muted rounded text-muted-foreground hover:text-foreground transition-colors"
                        title={t("resetView")}
                      >
                        <RotateCcw className="w-3 h-3" />
                      </button>
                      <button
                        onClick={() => setShowMinimap(false)}
                        className="p-1 hover:bg-muted rounded text-muted-foreground hover:text-foreground transition-colors"
                      >
                        <X className="w-3 h-3" />
                      </button>
                    </div>
                  </div>

                  <div className="flex-1 relative overflow-hidden bg-background">
                    {mainViewMode === "top" ? (
                      <MinimapWrapper onSwap={() => setMainViewMode("front")}>
                        <PreviewFrontView
                          node={visualNodes.find((n) => n.id === activeVisualNodeId)!}
                          selectedStructureNodeId={activeStructureNodeId}
                          onSelectCell={() => {}} // Read-only in minimap
                        />
                      </MinimapWrapper>
                    ) : (
                      <MinimapWrapper onSwap={() => setMainViewMode("top")} visuals={mapVisuals}>
                        <PreviewTopDownMap
                          visuals={mapVisuals}
                          selectedNodeId={activeVisualNodeId}
                          onSelectNode={() => {}} // Read-only in minimap
                          hoveredNodeId={null}
                          onHoverNode={() => {}}
                          transform={{ x: 0, y: 0, scale: 1 }} // Transform handled by MinimapWrapper's PanZoomContainer
                        />
                      </MinimapWrapper>
                    )}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          )}

          {/* Minimap Restore Button */}
          {!showMinimap && (
            <button
              onClick={() => setShowMinimap(true)}
              className="absolute bottom-6 right-6 p-3 bg-card/80 backdrop-blur border border-border rounded-full text-muted-foreground hover:text-foreground shadow-sm z-40 transition-all hover:scale-110"
            >
              <Maximize2 className="w-5 h-5" />
            </button>
          )}
        </div>

        {/* Details Panel */}
        <div className="w-80 border-l border-border bg-card/50 flex flex-col z-30">
          <div className="p-5 border-b border-border bg-card/70">
            <h2 className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground mb-6 flex items-center gap-2">
              <Info className="w-3.5 h-3.5" />
              {t("locationDetails")}
            </h2>

            {resolution && selectedLoc ? (
              <div className="space-y-6">
                <div>
                  <div className="inline-flex items-center px-2 py-0.5 rounded bg-primary/10 border border-primary/20 text-[10px] font-semibold text-primary mb-2 uppercase tracking-wide">
                    {selectedLoc.role}
                  </div>
                  <div className="text-3xl font-bold tracking-tight text-foreground mb-1">
                    {selectedLoc.code}
                  </div>
                  <div className="text-sm font-medium text-muted-foreground">
                    {selectedLoc.name}
                  </div>
                </div>

                <div className="space-y-3">
                  <div className="space-y-1.5">
                    <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                      {t("physicalPath")}
                    </p>
                    <div className="text-xs font-mono text-foreground/80 break-all bg-background/80 p-2 rounded-lg border border-border">
                      {selectedLoc.pathCode}
                    </div>
                  </div>

                  <div className="space-y-1.5">
                    <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                      {t("currentView")}
                    </p>
                    <div className="text-xs font-medium text-primary flex items-center gap-2 bg-primary/5 p-2 rounded-lg border border-primary/10">
                      {mainViewMode === "top" ? (
                        <Maximize className="w-3.5 h-3.5" />
                      ) : (
                        <Layers className="w-3.5 h-3.5" />
                      )}
                      {mainViewMode === "top" ? t("viewingTopMap") : t("viewingFrontView")}
                    </div>
                  </div>

                  <div className="space-y-1.5">
                    <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                      {t("workspace")}
                    </p>
                    <div className="text-xs font-medium text-muted-foreground flex items-center gap-2">
                      <span className="w-1.5 h-1.5 rounded-full bg-muted-foreground" />
                      {layout.name}
                    </div>
                  </div>
                </div>

                <div
                  className={cn(
                    "p-4 rounded-xl border bg-background/80 relative overflow-hidden",
                    resolution.status === "top_down" &&
                      "border-emerald-500/30 shadow-[0_0_20px_-10px_rgba(16,185,129,0.3)]",
                    resolution.status === "front_cell" && "border-primary/30 shadow-sm",
                    resolution.status === "unmapped" && "border-border",
                    resolution.status === "duplicate" && "border-amber-500/30"
                  )}
                >
                  <div className="flex items-center gap-2 mb-3 relative z-10">
                    <MapPin
                      className={cn(
                        "w-4 h-4",
                        resolution.status === "top_down" && "text-emerald-400",
                        resolution.status === "front_cell" && "text-primary",
                        resolution.status === "unmapped" && "text-muted-foreground",
                        resolution.status === "duplicate" && "text-amber-400"
                      )}
                    />
                    <span
                      className={cn(
                        "text-xs font-semibold uppercase tracking-wide",
                        resolution.status === "top_down" && "text-emerald-400",
                        resolution.status === "front_cell" && "text-primary",
                        resolution.status === "unmapped" && "text-muted-foreground",
                        resolution.status === "duplicate" && "text-amber-400"
                      )}
                    >
                      {resolution.status.replace("_", " ")}
                    </span>
                  </div>

                  <div className="text-[11px] text-muted-foreground leading-relaxed relative z-10">
                    {resolution.status === "top_down" && (
                      <p>
                        {t("mappedToPhysicalObject")}{" "}
                        <span className="text-foreground">"{resolution.visualNode.label}"</span> on
                        {t("onTopDownView")}
                      </p>
                    )}
                    {resolution.status === "front_cell" && (
                      <p>
                        {t("mappedTo")}{" "}
                        <span className="text-foreground font-bold">
                          {resolution.structureNode.displayLabel || resolution.structureNode.label}
                        </span>{" "}
                        {t("inside")}{" "}
                        <span className="text-foreground">
                          "{resolution.parentVisualNode.label}"
                        </span>
                        .
                      </p>
                    )}
                    {resolution.status === "unmapped" && <p>{t("unmappedDescription")}</p>}
                    {resolution.status === "duplicate" && <p>{t("duplicateDescription")}</p>}
                  </div>
                </div>

                <div className="pt-4 border-t border-border space-y-4">
                  <div>
                    <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground mb-2">
                      {t("capabilities")}
                    </p>
                    <div className="flex flex-wrap gap-1.5">
                      {Object.entries(selectedLoc.capabilities).map(
                        ([key, val]) =>
                          val && (
                            <div
                              key={key}
                              className="px-2 py-0.5 rounded bg-muted border border-border text-[9px] font-bold text-foreground/80 uppercase tracking-tight"
                            >
                              {key.replace(/([A-Z])/g, " $1").trim()}
                            </div>
                          )
                      )}
                    </div>
                  </div>

                  <div className="flex flex-col gap-2">
                    <button className="flex items-center justify-between px-3 py-2 bg-muted hover:bg-muted rounded-lg text-xs font-semibold text-foreground/80 transition-colors w-full group">
                      <span className="flex items-center gap-2 group-hover:text-foreground">
                        <Box className="w-3.5 h-3.5" />
                        {t("viewInventory")}
                      </span>
                      <ExternalLink className="w-3 h-3 opacity-0 group-hover:opacity-100 transition-opacity" />
                    </button>
                  </div>
                </div>
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center py-24 text-center px-8">
                <div className="w-16 h-16 bg-card border border-border rounded-lg flex items-center justify-center mb-6 shadow-sm">
                  <MapPin className="w-8 h-8 text-muted-foreground" />
                </div>
                <p className="text-sm text-muted-foreground italic leading-relaxed">
                  {t("selectLocation")}
                </p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

// --- Internal Helper Components ---

function MinimapWrapper({
  children,
  onSwap,
  visuals,
}: {
  children: React.ReactElement;
  onSwap: () => void;
  visuals?: VisualNode[];
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [transform, setTransform] = useState({ x: 0, y: 0, scale: 0.1 });
  const [isReady, setIsReady] = useState(false);
  const dragStartPos = useRef<{ x: number; y: number } | null>(null);

  const fitMinimap = useCallback(() => {
    if (!containerRef.current) return;
    const { width: cw, height: ch } = containerRef.current.getBoundingClientRect();
    if (cw === 0 || ch === 0) return;

    const childProps = children.props as any;
    let contentWidth = 10000;
    let contentHeight = 10000;
    let minX = 0;
    let minY = 0;

    if (childProps.node) {
      // Front View
      contentWidth = childProps.node.width;
      contentHeight = childProps.node.height;
    } else if (visuals && visuals.length > 0) {
      // Top Down Map - Calculate real bounds
      minX = Math.min(...visuals.map((v) => v.x));
      minY = Math.min(...visuals.map((v) => v.y));
      const maxX = Math.max(...visuals.map((v) => v.x + v.width));
      const maxY = Math.max(...visuals.map((v) => v.y + v.depth));
      contentWidth = maxX - minX;
      contentHeight = maxY - minY;
    }

    const padding = 10;
    const s = Math.min((cw - padding * 2) / contentWidth, (ch - padding * 2) / contentHeight);

    setTransform({
      x: (cw - contentWidth * s) / 2 - minX * s,
      y: (ch - contentHeight * s) / 2 - minY * s,
      scale: s,
    });
    setIsReady(true);
  }, [children.props, visuals]);

  useEffect(() => {
    // Small delay to ensure container size is stabilized
    const timer = setTimeout(fitMinimap, 50);

    const handleReset = () => fitMinimap();
    window.addEventListener("reset-minimap", handleReset);

    return () => {
      clearTimeout(timer);
      window.removeEventListener("reset-minimap", handleReset);
    };
  }, [fitMinimap]);

  return (
    <div
      ref={containerRef}
      className="w-full h-full relative group cursor-pointer"
      onMouseDown={(e) => {
        if (e.button === 0) {
          dragStartPos.current = { x: e.clientX, y: e.clientY };
        }
      }}
      onMouseUp={(e) => {
        if (e.button === 0 && dragStartPos.current) {
          const dist = Math.sqrt(
            Math.pow(e.clientX - dragStartPos.current.x, 2) +
              Math.pow(e.clientY - dragStartPos.current.y, 2)
          );
          if (dist < 5) onSwap(); // Quick click swaps
          dragStartPos.current = null;
        }
      }}
    >
      <div
        className={cn(
          "w-full h-full transition-opacity duration-500",
          isReady ? "opacity-100" : "opacity-0"
        )}
      >
        <PanZoomContainer
          transform={transform}
          onTransformChange={setTransform}
          className="w-full h-full"
          maxScale={5}
          minScale={0.0001}
          panningButton={1} // MMB for pan
        >
          {React.cloneElement(children, { transform } as any)}
        </PanZoomContainer>
      </div>
    </div>
  );
}

function PanZoomContainer({
  children,
  transform,
  onTransformChange,
  className,
  maxScale = 10,
  minScale = 0.1,
  panningButton = 0,
}: {
  children: React.ReactNode;
  transform: ViewTransform;
  onTransformChange: (t: ViewTransform) => void;
  className?: string;
  maxScale?: number;
  minScale?: number;
  panningButton?: number;
}) {
  const isDragging = useRef(false);
  const lastPos = useRef({ x: 0, y: 0 });

  const handleMouseDown = useCallback(
    (e: React.MouseEvent) => {
      if (e.button !== panningButton) return;
      isDragging.current = true;
      lastPos.current = { x: e.clientX, y: e.clientY };
    },
    [panningButton]
  );

  const handleMouseMove = useCallback(
    (e: React.MouseEvent) => {
      if (!isDragging.current) return;
      const dx = e.clientX - lastPos.current.x;
      const dy = e.clientY - lastPos.current.y;
      onTransformChange({
        ...transform,
        x: transform.x + dx,
        y: transform.y + dy,
      });
      lastPos.current = { x: e.clientX, y: e.clientY };
    },
    [transform, onTransformChange]
  );

  const handleMouseUp = useCallback(() => {
    isDragging.current = false;
  }, []);

  const handleWheel = useCallback(
    (e: React.WheelEvent) => {
      e.preventDefault();
      const zoomSpeed = 0.0015;
      const zoomFactor = Math.pow(1.1, -e.deltaY / 100);
      const newScale = Math.min(Math.max(transform.scale * zoomFactor, minScale), maxScale);

      // Zoom toward mouse position
      const rect = e.currentTarget.getBoundingClientRect();
      const mouseX = e.clientX - rect.left;
      const mouseY = e.clientY - rect.top;

      const scaleRatio = newScale / transform.scale;
      const dx = (mouseX - transform.x) * (1 - scaleRatio);
      const dy = (mouseY - transform.y) * (1 - scaleRatio);

      onTransformChange({
        x: transform.x + dx,
        y: transform.y + dy,
        scale: newScale,
      });
    },
    [transform, onTransformChange, maxScale, minScale]
  );

  return (
    <div
      className={cn(
        "select-none overflow-hidden",
        panningButton === 0 ? "cursor-grab active:cursor-grabbing" : "",
        className
      )}
      onMouseDown={handleMouseDown}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
      onMouseLeave={handleMouseUp}
      onWheel={handleWheel}
    >
      <div
        style={{
          transform: `translate(${transform.x}px, ${transform.y}px) scale(${transform.scale})`,
          transformOrigin: "0 0",
        }}
        className="w-full h-full transform-gpu"
      >
        {children}
      </div>
    </div>
  );
}

function LocationTree({
  locations,
  treeMap,
  selectedId,
  onSelect,
  expandedIds,
  onToggleExpand,
  visibleIds,
  index,
  visualNodes,
  depth = 0,
}: {
  locations: LogicalLocation[];
  treeMap: Map<string | null, LogicalLocation[]>;
  selectedId: string | null;
  onSelect: (id: string) => void;
  expandedIds: Set<string>;
  onToggleExpand: (id: string) => void;
  visibleIds: Set<string> | null;
  index: MappingIndex;
  visualNodes: VisualNode[];
  depth?: number;
}) {
  return (
    <div className="space-y-0.5 relative">
      {locations
        .filter((loc) => !visibleIds || visibleIds.has(loc.id))
        .sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0) || a.code.localeCompare(b.code))
        .map((loc) => {
          const children = treeMap.get(loc.id) || [];
          const isExpanded = expandedIds.has(loc.id) || (visibleIds && visibleIds.has(loc.id));
          const isSelected = selectedId === loc.id;
          const resolution = resolveLocationVisual(loc.id, visualNodes, index);

          const category = LOCATION_CATEGORIES[loc.role];
          const iconName = loc.icon || category?.iconName || "Box";
          const iconColorClass =
            loc.color ||
            (isSelected
              ? "text-primary"
              : "text-muted-foreground group-hover:text-muted-foreground");

          return (
            <div key={loc.id} id={`tree-item-${loc.id}`} className="relative">
              <button
                onClick={() => onSelect(loc.id)}
                className={cn(
                  "w-full text-left py-1.5 px-2 rounded-lg flex items-center justify-between group relative transition-all border border-transparent",
                  isSelected
                    ? "bg-primary/10 border-primary/30 text-foreground"
                    : "hover:bg-muted/50 text-muted-foreground"
                )}
                style={{ paddingLeft: `${depth * 16 + 8}px` }}
              >
                {isSelected && (
                  <motion.div
                    layoutId="activeLocationPreview"
                    className="absolute inset-0 bg-primary/5 rounded-lg pointer-events-none"
                    transition={{ type: "spring", bounce: 0.25, duration: 0.4 }}
                  />
                )}

                <div className="flex items-center gap-2 overflow-hidden flex-1 relative z-10">
                  <div
                    className={cn(
                      "w-4 h-4 shrink-0 flex items-center justify-center rounded cursor-pointer hover:bg-muted transition-colors",
                      children.length === 0 && "opacity-0 pointer-events-none"
                    )}
                    onClick={(e) => {
                      e.stopPropagation();
                      onToggleExpand(loc.id);
                    }}
                  >
                    {isExpanded ? (
                      <ChevronDown className="w-3 h-3" />
                    ) : (
                      <ChevronRight className="w-3 h-3" />
                    )}
                  </div>

                  <div className="flex items-center gap-2 overflow-hidden flex-1">
                    <IconRenderer
                      name={iconName}
                      className={cn("w-3 h-3 shrink-0", iconColorClass)}
                    />
                    <span
                      className={cn(
                        "text-[11px] font-bold truncate",
                        isSelected ? "text-primary" : "text-foreground"
                      )}
                    >
                      {loc.name}
                    </span>
                    <span className="text-[9px] text-muted-foreground uppercase tracking-tight truncate group-hover:text-muted-foreground transition-colors hidden sm:block font-mono">
                      {loc.code}
                    </span>
                  </div>
                </div>

                <div className="flex items-center gap-1.5 shrink-0 relative z-10">
                  <span
                    className={cn(
                      "text-[8px] font-black uppercase px-1 py-0.5 rounded-sm tracking-widest",
                      resolution.status === "top_down" &&
                        "bg-emerald-500/20 text-emerald-400 border border-emerald-500/10",
                      resolution.status === "front_cell" &&
                        "bg-primary/20 text-primary border border-primary/10",
                      resolution.status === "unmapped" &&
                        "bg-muted/50 text-muted-foreground border border-border/30",
                      resolution.status === "duplicate" &&
                        "bg-amber-500/20 text-amber-400 border border-amber-500/10"
                    )}
                  >
                    {resolution.status === "top_down" && "TOP"}
                    {resolution.status === "front_cell" && "FRNT"}
                    {resolution.status === "unmapped" && "NO"}
                    {resolution.status === "duplicate" && "DUP"}
                  </span>
                </div>
              </button>

              {isExpanded && children.length > 0 && (
                <div className="relative">
                  {/* Tree guide line */}
                  <div
                    className="absolute left-[16px] top-0 bottom-4 w-px bg-muted"
                    style={{ marginLeft: `${depth * 16}px` }}
                  />
                  <LocationTree
                    locations={children.filter((l) => {
                      const res = resolveLocationVisual(l.id, visualNodes, index);
                      const visualNode =
                        res.status === "top_down"
                          ? res.visualNode
                          : res.status === "front_cell"
                            ? res.parentVisualNode
                            : null;
                      if (visualNode?.preview?.visibleInPreviewTree === false) return false;
                      return true;
                    })}
                    treeMap={treeMap}
                    selectedId={selectedId}
                    onSelect={onSelect}
                    expandedIds={expandedIds}
                    onToggleExpand={onToggleExpand}
                    visibleIds={visibleIds}
                    index={index}
                    visualNodes={visualNodes}
                    depth={depth + 1}
                  />
                </div>
              )}
            </div>
          );
        })}
    </div>
  );
}

function PreviewTopDownMap({
  visuals,
  selectedNodeId,
  onSelectNode,
  hoveredNodeId,
  onHoverNode,
  transform,
}: {
  visuals: VisualNode[];
  selectedNodeId: string | null;
  onSelectNode: (node: VisualNode) => void;
  hoveredNodeId: string | null;
  onHoverNode: (id: string | null) => void;
  transform: ViewTransform;
}) {
  // Use a fixed virtual coordinate space
  const viewSize = 10000;

  const getZonePattern = (node: VisualNode) => {
    if (!node.zonePattern || node.zonePattern === "solid") return null;
    return `url(#pattern-${node.id})`;
  };

  return (
    <div className="w-full h-full relative">
      <svg
        width={viewSize}
        height={viewSize}
        viewBox={`0 0 ${viewSize} ${viewSize}`}
        className="overflow-visible"
      >
        <defs>
          <pattern id="previewGrid" width="200" height="200" patternUnits="userSpaceOnUse">
            <path
              d="M 200 0 L 0 0 0 200"
              fill="none"
              stroke="currentColor"
              strokeWidth="0.5"
              className="text-muted-foreground/30"
            />
          </pattern>
          {visuals.map(
            (node) =>
              node.zonePattern &&
              node.zonePattern !== "solid" && (
                <pattern
                  key={`pattern-def-${node.id}`}
                  id={`pattern-${node.id}`}
                  width="12"
                  height="12"
                  patternUnits="userSpaceOnUse"
                  patternTransform="rotate(45)"
                >
                  {node.zonePattern.includes("stripes") && (
                    <rect
                      width={node.zonePattern === "stripes-wide" ? 6 : 3}
                      height="12"
                      fill={node.secondaryColor || "rgba(255,255,255,0.1)"}
                      fillOpacity={node.secondaryOpacity ?? 0.5}
                    />
                  )}
                  {node.zonePattern === "dots" && (
                    <circle
                      cx="6"
                      cy="6"
                      r="2"
                      fill={node.secondaryColor || "rgba(255,255,255,0.1)"}
                      fillOpacity={node.secondaryOpacity ?? 0.5}
                    />
                  )}
                  {node.zonePattern === "grid" && (
                    <path
                      d="M 12 0 L 0 0 0 12"
                      fill="none"
                      stroke={node.secondaryColor || "rgba(255,255,255,0.1)"}
                      strokeWidth="1"
                      strokeOpacity={node.secondaryOpacity ?? 0.5}
                    />
                  )}
                </pattern>
              )
          )}
        </defs>
        <rect x="0" y="0" width={viewSize} height={viewSize} fill="url(#previewGrid)" />

        {visuals.map((node) => {
          const isSelected = selectedNodeId === node.id;
          const isHovered = hoveredNodeId === node.id;
          const isVisualOnly = !node.locationId;

          // Default behavior based on roles if not explicitly set
          const isSelectable =
            node.preview?.selectableInPreview ??
            (node.nodeRole !== VisualNodeRole.INFRASTRUCTURE &&
              node.nodeRole !== VisualNodeRole.OBSTACLE &&
              node.nodeRole !== VisualNodeRole.ANNOTATION);

          const style = node.style || {};

          return (
            <g
              key={node.id}
              className={cn(
                "group transition-opacity duration-300",
                isSelectable ? "pointer-events-auto cursor-pointer" : "pointer-events-none"
              )}
              onClick={(e) => {
                e.stopPropagation();
                if (isSelectable) onSelectNode(node);
              }}
              onMouseEnter={() => isSelectable && onHoverNode(node.id)}
              onMouseLeave={() => isSelectable && onHoverNode(null)}
              transform={`rotate(${node.rotation || 0}, ${node.x + node.width / 2}, ${node.y + node.depth / 2})`}
            >
              {/* Modern Minimal Selection Outline */}
              {isSelected && (
                <rect
                  x={node.x - 2 / transform.scale}
                  y={node.y - 2 / transform.scale}
                  width={node.width + 4 / transform.scale}
                  height={node.depth + 4 / transform.scale}
                  fill="none"
                  stroke="#0ea5e9"
                  strokeWidth={1.5 / transform.scale}
                  rx={(style.cornerRadiusTopLeft || 0) / transform.scale + 2 / transform.scale}
                  className="opacity-40"
                />
              )}

              <rect
                x={node.x}
                y={node.y}
                width={node.width}
                height={node.depth}
                fill={node.color || (isVisualOnly ? "#334155" : "#475569")}
                fillOpacity={
                  isSelected ? 0.9 : isHovered ? 0.8 : (node.opacity ?? (isVisualOnly ? 0.15 : 0.7))
                }
                stroke={
                  isSelected
                    ? "#0ea5e9"
                    : isHovered
                      ? "rgba(255,255,255,0.3)"
                      : node.opacity && node.opacity < 1
                        ? "transparent"
                        : "rgba(255,255,255,0.08)"
                }
                strokeWidth={isSelected ? 1 / transform.scale : 0.5 / transform.scale}
                rx={(style.cornerRadiusTopLeft || 0) / transform.scale}
                ry={(style.cornerRadiusTopLeft || 0) / transform.scale}
                className="transition-all duration-200"
              />

              {/* Zone Pattern Overlay */}
              {node.zonePattern && node.zonePattern !== "solid" && (
                <rect
                  x={node.x}
                  y={node.y}
                  width={node.width}
                  height={node.depth}
                  fill={getZonePattern(node)!}
                  rx={(style.cornerRadiusTopLeft || 0) / transform.scale}
                  ry={(style.cornerRadiusTopLeft || 0) / transform.scale}
                  className="pointer-events-none"
                />
              )}

              {/* Selection Transparent Overlay */}
              {isSelected && (
                <rect
                  x={node.x}
                  y={node.y}
                  width={node.width}
                  height={node.depth}
                  fill="#0ea5e9"
                  fillOpacity={0.08}
                  rx={(style.cornerRadiusTopLeft || 0) / transform.scale}
                  ry={(style.cornerRadiusTopLeft || 0) / transform.scale}
                  className="pointer-events-none"
                />
              )}

              {/* Label handling with overflow prevention */}
              {node.width * transform.scale > 40 && node.depth * transform.scale > 20 && (
                <foreignObject
                  x={node.x}
                  y={node.y}
                  width={node.width}
                  height={node.depth}
                  className="pointer-events-none"
                >
                  <div className="w-full h-full flex items-center justify-center p-1">
                    <span
                      className="font-black select-none uppercase tracking-tighter text-center leading-none truncate block w-full whitespace-nowrap overflow-hidden text-ellipsis"
                      style={{
                        fontSize: `${Math.max(8, Math.min(14, (node.width / node.label.length) * 1.2, node.depth * 0.4))}px`,
                        color: isVisualOnly ? "rgba(255,255,255,0.4)" : "#fff",
                        textShadow: "0 1px 4px rgba(0,0,0,0.8)",
                      }}
                    >
                      {node.label}
                    </span>
                  </div>
                </foreignObject>
              )}
            </g>
          );
        })}
      </svg>
    </div>
  );
}

function PreviewFrontView({
  node,
  selectedStructureNodeId,
  onSelectCell,
  transform = { x: 0, y: 0, scale: 1 },
}: {
  node: VisualNode;
  selectedStructureNodeId: string | null;
  onSelectCell: (node: StructureNode) => void;
  transform?: ViewTransform;
}) {
  if (!node.structure) return null;

  return (
    <div
      className="bg-card border-4 border-border shadow-[0_30px_60px_-12px_rgba(0,0,0,0.5)] overflow-hidden"
      style={{
        width: `${node.width}px`,
        height: `${node.height}px`,
        borderTopLeftRadius: `${node.style?.cornerRadiusTopLeft || 0}px`,
        borderTopRightRadius: `${node.style?.cornerRadiusTopRight || 0}px`,
        borderBottomLeftRadius: `${node.style?.cornerRadiusBottomLeft || 0}px`,
        borderBottomRightRadius: `${node.style?.cornerRadiusBottomRight || 0}px`,
      }}
    >
      <StructureRenderer
        node={node.structure}
        selectedId={selectedStructureNodeId}
        onSelect={onSelectCell}
      />
    </div>
  );
}

function StructureRenderer({
  node,
  selectedId,
  onSelect,
}: {
  node: StructureNode;
  selectedId: string | null;
  onSelect: (node: StructureNode) => void;
}) {
  const isSelected = selectedId === node.id;
  const skin = node.skin ? SECTION_SKINS.find((s) => s.id === node.skin) : null;

  if (node.type === "container" && node.children) {
    const isHorizontal = node.split === "horizontal";
    const frame = node.frame;

    return (
      <div
        className={cn("w-full h-full flex overflow-hidden", isHorizontal ? "flex-col" : "flex-row")}
        style={{
          padding: frame
            ? `${frame.top?.thickness || 0}px ${frame.right?.thickness || 0}px ${frame.bottom?.thickness || 0}px ${frame.left?.thickness || 0}px`
            : 0,
          backgroundColor: node.color || undefined,
          borderTop: frame?.top
            ? `${frame.top.thickness}px ${frame.top.type === "gap" ? "dashed" : "solid"} ${frame.top.color || "rgba(255,255,255,0.15)"}`
            : undefined,
          borderBottom: frame?.bottom
            ? `${frame.bottom.thickness}px ${frame.bottom.type === "gap" ? "dashed" : "solid"} ${frame.bottom.color || "rgba(255,255,255,0.15)"}`
            : undefined,
          borderLeft: frame?.left
            ? `${frame.left.thickness}px ${frame.left.type === "gap" ? "dashed" : "solid"} ${frame.left.color || "rgba(255,255,255,0.15)"}`
            : undefined,
          borderRight: frame?.right
            ? `${frame.right.thickness}px ${frame.right.type === "gap" ? "dashed" : "solid"} ${frame.right.color || "rgba(255,255,255,0.15)"}`
            : undefined,
          borderTopLeftRadius: `${node.style?.cornerRadiusTopLeft || 0}px`,
          borderTopRightRadius: `${node.style?.cornerRadiusTopRight || 0}px`,
          borderBottomLeftRadius: `${node.style?.cornerRadiusBottomLeft || 0}px`,
          borderBottomRightRadius: `${node.style?.cornerRadiusBottomRight || 0}px`,
        }}
      >
        {node.children.map((child, idx) => {
          const divider = node.dividers?.[idx];
          return (
            <div key={child.id} style={{ flex: child.size }} className="relative w-full h-full">
              <StructureRenderer node={child} selectedId={selectedId} onSelect={onSelect} />
              {idx < node.children!.length - 1 && (
                <div
                  className="absolute z-10 pointer-events-none"
                  style={{
                    backgroundColor: divider?.color || "rgba(255,255,255,0.1)",
                    opacity: divider?.opacity ?? 1,
                    borderStyle: divider?.type === "gap" ? "dashed" : "solid",
                    ...(isHorizontal
                      ? {
                          bottom: 0,
                          left: 0,
                          right: 0,
                          height: `${divider?.thickness || 1}px`,
                          borderBottom:
                            divider?.type === "gap"
                              ? `${divider.thickness}px dashed ${divider.color || "rgba(255,255,255,0.1)"}`
                              : "none",
                          backgroundColor:
                            divider?.type === "gap"
                              ? "transparent"
                              : divider?.color || "rgba(255,255,255,0.1)",
                        }
                      : {
                          right: 0,
                          top: 0,
                          bottom: 0,
                          width: `${divider?.thickness || 1}px`,
                          borderRight:
                            divider?.type === "gap"
                              ? `${divider.thickness}px dashed ${divider.color || "rgba(255,255,255,0.1)"}`
                              : "none",
                          backgroundColor:
                            divider?.type === "gap"
                              ? "transparent"
                              : divider?.color || "rgba(255,255,255,0.1)",
                        }),
                  }}
                />
              )}
            </div>
          );
        })}
      </div>
    );
  }

  return (
    <button
      onClick={() => onSelect(node)}
      className={cn(
        "w-full h-full flex items-center justify-center transition-all group overflow-hidden relative",
        isSelected ? "z-10" : "hover:bg-muted/50",
        !node.locationId && "opacity-60"
      )}
      style={{
        backgroundColor: node.color || "transparent",
        borderTopLeftRadius: `${node.style?.cornerRadiusTopLeft || 0}px`,
        borderTopRightRadius: `${node.style?.cornerRadiusTopRight || 0}px`,
        borderBottomLeftRadius: `${node.style?.cornerRadiusBottomLeft || 0}px`,
        borderBottomRightRadius: `${node.style?.cornerRadiusBottomRight || 0}px`,
      }}
    >
      <div className="absolute inset-0 pointer-events-none">
        {skin?.render(node.color || "#475569", 0.5)}
      </div>

      {isSelected && (
        <div className="absolute inset-0 border-[1px] border-primary/50 z-20 pointer-events-none" />
      )}
      {isSelected && <div className="absolute inset-0 bg-primary/5 z-10 pointer-events-none" />}

      <div className="flex flex-col items-center gap-0.5 p-1 relative z-30 w-full overflow-hidden">
        <span
          className={cn(
            "text-[9px] font-black leading-tight uppercase tracking-tight text-center truncate w-full px-1",
            isSelected
              ? "text-foreground"
              : node.locationId
                ? "text-foreground/80 group-hover:text-foreground"
                : "text-muted-foreground"
          )}
        >
          {node.displayLabel || node.label}
        </span>
      </div>
    </button>
  );
}
