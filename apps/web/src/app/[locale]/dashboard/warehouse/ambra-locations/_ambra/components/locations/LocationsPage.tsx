"use client";

import React, { useCallback, useMemo, useState } from "react";
import dynamic from "next/dynamic";
import { useTranslations } from "next-intl";
import {
  LogicalLocation,
  LocationRole,
  LocationCapabilities,
  VisualNode,
  MappingStatus,
  Layout,
  type AmbraLocationInventorySnapshot,
  type ContainerLine,
  type LocationContainer,
  type LocationInventoryLine,
  type LocationMovementLine,
  type LocationPutawayRule,
} from "../../types";
import type { InventoryVariantOption } from "@/lib/warehouse/inventory-types";
import {
  Search,
  Plus,
  X,
  Filter,
  MoreVertical,
  MapPin,
  Archive,
  ChevronRight,
  ChevronDown,
  Box,
  Info,
  LayoutGrid,
  Database,
  Pencil,
  MoveUpRight,
  CornerDownRight,
  FileText,
  FileJson,
  Move,
  LayoutList,
  Columns,
  GripVertical,
  Check,
  Shield,
  Tag,
  Flag,
  Zap,
  Star,
  Heart,
  Coffee,
  Briefcase,
  Key,
  Hammer,
  Scale,
  Maximize2,
  AlertCircle,
  Clock,
  ExternalLink,
  Copy,
  Trash2,
  Search as SearchIcon,
  Fingerprint,
  Layers,
  Server,
  Layout as LayoutIcon,
  Inbox,
  Truck,
  RotateCcw,
  CheckSquare,
  ShieldAlert,
  Construction,
  Car,
  ShieldCheck,
  Triangle,
  Package,
  Circle,
  Activity,
} from "lucide-react";

import {
  LOCATION_CATEGORIES,
  LocationCategoryDefinition,
} from "../../constants/locationCategories";
import { motion, AnimatePresence } from "motion/react";
import type { InteractiveLocationMapPreviewProps } from "./InteractiveLocationMapPreview";
import { IconRenderer } from "./location-icons";
import {
  BehaviorIndicator,
  CompactIndicator,
  DetailItem,
  MappingBadge,
  RibbonAction,
} from "./location-page-atoms";

const LocationModal = dynamic(() => import("./LocationModal"), { ssr: false });
const InteractiveLocationMapPreview = dynamic<InteractiveLocationMapPreviewProps>(
  () =>
    import("./InteractiveLocationMapPreview").then(
      (module) => module.InteractiveLocationMapPreview
    ),
  { ssr: false }
);
const LocationExportDialog = dynamic(() => import("./LocationExportDialog"), { ssr: false });
const WorkspaceHealthReportDialog = dynamic(
  () => import("../workspaces/WorkspaceHealthReportDialog"),
  { ssr: false }
);

interface LocationsPageProps {
  locations: LogicalLocation[];
  visuals: VisualNode[];
  layouts: Layout[];
  inventorySnapshot: AmbraLocationInventorySnapshot;
  variantOptions: InventoryVariantOption[];
  onCreateLocation: (loc: LogicalLocation) => void | Promise<void>;
  onUpdateLocation?: (loc: Partial<LogicalLocation> & { id: string }) => void | Promise<void>;
  onDeleteLocation?: (locationId: string) => void | Promise<void>;
  onNavigateToWorkspace: (layoutId: string) => void;
}

function InventoryMetric({
  label,
  value,
  icon,
}: {
  label: string;
  value: number;
  icon: React.ReactNode;
}) {
  return (
    <div className="rounded-lg border border-border bg-card p-4">
      <div className="flex items-center justify-between gap-3">
        <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
          {label}
        </p>
        <div className="rounded-md border border-border bg-muted p-2 text-muted-foreground">
          {icon}
        </div>
      </div>
      <p className="mt-3 text-2xl font-semibold tabular-nums text-foreground">{value}</p>
    </div>
  );
}

function InventoryLinesTable({
  lines,
  locationNameById,
  showLocation,
  emptyLabel,
  t,
}: {
  lines: LocationInventoryLine[];
  locationNameById: Map<string, string>;
  showLocation: boolean;
  emptyLabel: string;
  t: any;
}) {
  return (
    <div className="overflow-hidden rounded-lg border border-border bg-card">
      <div className="flex items-center justify-between border-b border-border bg-muted/40 px-5 py-4">
        <span className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
          {t("inventory.stockLines")}
        </span>
        <Package className="h-4 w-4 text-muted-foreground" />
      </div>
      {lines.length === 0 ? (
        <div className="p-10 text-center text-xs font-medium text-muted-foreground">
          {emptyLabel}
        </div>
      ) : (
        <div className="divide-y divide-border">
          {lines.map((line) => (
            <div
              key={line.id}
              className="grid gap-3 px-5 py-3 text-xs md:grid-cols-[1.4fr_1fr_0.8fr_0.8fr]"
            >
              <div>
                <p className="font-semibold text-foreground">{line.productName || line.sku}</p>
                <p className="mt-0.5 font-mono text-[10px] text-muted-foreground">{line.sku}</p>
              </div>
              <div className={showLocation ? "" : "hidden md:block"}>
                {showLocation ? (
                  <>
                    <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                      {t("inventory.location")}
                    </p>
                    <p className="mt-0.5 text-foreground">
                      {locationNameById.get(line.locationId) ?? line.locationId}
                    </p>
                  </>
                ) : null}
              </div>
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                  {t("inventory.onHand")}
                </p>
                <p className="mt-0.5 font-mono text-foreground">
                  {line.onHandQuantity} {line.unitCode}
                </p>
              </div>
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                  {t("inventory.available")}
                </p>
                <p className="mt-0.5 font-mono text-foreground">
                  {line.availableQuantity} {line.unitCode}
                </p>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function ContainerList({
  containers,
  locationNameById,
  emptyLabel,
  t,
}: {
  containers: LocationContainer[];
  locationNameById: Map<string, string>;
  emptyLabel: string;
  t: any;
}) {
  const [expandedId, setExpandedId] = React.useState<string | null>(null);

  return (
    <div className="overflow-hidden rounded-lg border border-border bg-card">
      <div className="flex items-center justify-between border-b border-border bg-muted/40 px-5 py-4">
        <span className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
          {t("inventory.containerizedStock")}
        </span>
        <Archive className="h-4 w-4 text-muted-foreground" />
      </div>
      {containers.length === 0 ? (
        <div className="p-8 text-center text-xs font-medium text-muted-foreground">
          {emptyLabel}
        </div>
      ) : (
        <div className="divide-y divide-border">
          {containers.map((container) => (
            <div key={container.id} className="px-5 py-3 text-xs">
              <div className="flex items-center justify-between gap-3">
                <button
                  type="button"
                  onClick={() => setExpandedId(expandedId === container.id ? null : container.id)}
                  className="flex items-center gap-2 font-mono font-semibold text-foreground hover:text-primary"
                >
                  {expandedId === container.id ? (
                    <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />
                  ) : (
                    <ChevronRight className="h-3.5 w-3.5 text-muted-foreground" />
                  )}
                  {container.code}
                  {container.referenceId && (
                    <span className="ml-1 rounded bg-primary/10 px-1.5 py-0.5 text-[10px] font-normal text-primary">
                      {container.referenceId}
                    </span>
                  )}
                </button>
                <div className="flex items-center gap-2">
                  <span className="rounded-md border border-border bg-muted px-2 py-0.5 text-[10px] uppercase text-muted-foreground">
                    {container.status}
                  </span>
                  <span className="text-[10px] text-muted-foreground">
                    {container.lines.length} {t("inventory.items")}
                  </span>
                </div>
              </div>
              <p className="mt-1 pl-5 text-muted-foreground">
                {locationNameById.get(container.currentLocationId) ?? container.currentLocationId}
              </p>

              {expandedId === container.id && (
                <div className="mt-3 pl-5 space-y-1">
                  {container.lines.length > 0 ? (
                    container.lines.map((line: ContainerLine) => (
                      <div
                        key={line.id}
                        className="flex items-center justify-between gap-2 rounded bg-muted/40 px-2 py-1.5"
                      >
                        <div>
                          <span className="font-medium text-foreground">
                            {line.productName || line.sku}
                          </span>
                          <span className="ml-2 font-mono text-muted-foreground">
                            {line.quantity} {line.unitCode}
                          </span>
                        </div>
                      </div>
                    ))
                  ) : (
                    <p className="text-[10px] text-muted-foreground">{t("inventory.noItems")}</p>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function PutawayRuleList({
  rules,
  variants,
  emptyLabel,
  t,
}: {
  rules: LocationPutawayRule[];
  variants: InventoryVariantOption[];
  emptyLabel: string;
  t: any;
}) {
  const variantById = new Map(variants.map((variant) => [variant.id, variant]));

  return (
    <div className="overflow-hidden rounded-lg border border-border bg-card">
      <div className="flex items-center justify-between border-b border-border bg-muted/40 px-5 py-4">
        <span className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
          {t("inventory.preferredStorage")}
        </span>
        <Tag className="h-4 w-4 text-muted-foreground" />
      </div>
      {rules.length === 0 ? (
        <div className="p-8 text-center text-xs font-medium text-muted-foreground">
          {emptyLabel}
        </div>
      ) : (
        <div className="divide-y divide-border">
          {rules.map((rule) => (
            <div key={rule.id} className="px-5 py-3 text-xs">
              <p className="font-semibold text-foreground">
                {rule.variantId
                  ? (variantById.get(rule.variantId)?.label ?? rule.variantId)
                  : rule.productCategory || rule.productId || t("inventory.defaultRule")}
              </p>
              <p className="mt-1 text-muted-foreground">
                {t("inventory.priority")}: {rule.priority}
              </p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function MovementHistoryList({ movements, t }: { movements: LocationMovementLine[]; t: any }) {
  if (movements.length === 0) {
    return (
      <div className="p-12 text-center flex flex-col items-center justify-center">
        <div className="w-12 h-12 rounded-full bg-muted flex items-center justify-center mb-4 opacity-60">
          <Layers className="w-5 h-5 text-muted-foreground" />
        </div>
        <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide">
          {t("history.noActivity")}
        </p>
      </div>
    );
  }

  return (
    <div className="divide-y divide-border">
      {movements.map((movement) => {
        const isRelocation =
          movement.movementKind === "transfer" &&
          movement.sourceLocationId &&
          movement.destinationLocationId;
        return (
          <div
            key={movement.id}
            className="grid gap-3 px-5 py-4 text-xs md:grid-cols-[1fr_1fr_1fr_0.7fr]"
          >
            <div>
              <p className="font-semibold text-foreground">
                {isRelocation ? t("history.internalRelocation") : movement.movementKind}
              </p>
              <p className="mt-0.5 font-mono text-[10px] text-muted-foreground">
                {movement.movementNumber}
              </p>
            </div>
            <div>
              <p className="font-semibold text-foreground">
                {movement.productName || movement.sku}
              </p>
              <p className="mt-0.5 font-mono text-[10px] text-muted-foreground">{movement.sku}</p>
            </div>
            <div>
              <p className="text-muted-foreground">
                {movement.sourceLocationName ?? t("history.external")}
                {" -> "}
                {movement.destinationLocationName ?? t("history.external")}
              </p>
              <p className="mt-0.5 text-muted-foreground">
                {new Date(movement.postedAt ?? movement.createdAt).toLocaleString()}
              </p>
            </div>
            <p className="font-mono text-foreground">
              {movement.quantity} {movement.unitCode}
            </p>
          </div>
        );
      })}
    </div>
  );
}

export default function LocationsPage({
  locations,
  visuals,
  layouts,
  inventorySnapshot,
  variantOptions,
  onCreateLocation,
  onUpdateLocation,
  onDeleteLocation,
  onNavigateToWorkspace,
}: LocationsPageProps) {
  const t = useTranslations("ambraLocations");
  const [selectedLocationId, setSelectedLocationId] = useState<string | null>(
    locations[0]?.id || null
  );
  const [expandedIds, setExpandedIds] = useState<string[]>(["l1", "l2"]);
  const [searchQuery, setSearchQuery] = useState("");
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [draggedId, setDraggedId] = useState<string | null>(null);
  const [dragOverId, setDragOverId] = useState<string | null>(null);
  const [copiedPath, setCopiedPath] = useState(false);
  const [isTreeLocked, setIsTreeLocked] = useState(true);
  const [isTreeActionsOpen, setIsTreeActionsOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<"info" | "inventory" | "history">("info");

  // Reset selected location when the locations list changes (e.g. branch switch)
  React.useEffect(() => {
    if (selectedLocationId && !locations.some((l) => l.id === selectedLocationId)) {
      setSelectedLocationId(locations[0]?.id || null);
    }
  }, [locations, selectedLocationId]);

  // New States
  const [isCompactMode, setIsCompactMode] = useState(false);
  const [isMoveModalOpen, setIsMoveModalOpen] = useState(false);
  const [locationToMove, setLocationToMove] = useState<string | null>(null);
  const [moveTargetId, setMoveTargetId] = useState<string | "ROOT">("ROOT");
  const [childListDensity, setChildListDensity] = useState<"COMFORTABLE" | "COMPACT">(
    "COMFORTABLE"
  );

  const [previewLayoutId, setPreviewLayoutId] = useState<string | null>(null);
  const [isExportDialogOpen, setIsExportDialogOpen] = useState(false);
  const [healthReportLayoutId, setHealthReportLayoutId] = useState<string | null>(null);

  const selectedLocation = locations.find((l) => l.id === selectedLocationId) || null;

  const childrenByParent = useMemo(() => {
    const byParent = new Map<string | null, LogicalLocation[]>();
    for (const location of locations) {
      const bucket = byParent.get(location.parentId) ?? [];
      bucket.push(location);
      byParent.set(location.parentId, bucket);
    }
    return byParent;
  }, [locations]);

  const stockableLocations = useMemo(
    () =>
      locations.filter(
        (location) =>
          location.stockPolicy === "stockable" || location.capabilities?.canStoreInventory
      ),
    [locations]
  );

  const getDescendantIds = useCallback(
    (locationId: string): string[] => {
      const children = childrenByParent.get(locationId) ?? [];
      return children.flatMap((child) => [child.id, ...getDescendantIds(child.id)]);
    },
    [childrenByParent]
  );

  const locationStockSummaryById = useMemo(() => {
    const direct = new Map<string, { quantity: number; skuIds: Set<string> }>();
    for (const line of inventorySnapshot.balances) {
      const summary = direct.get(line.locationId) ?? { quantity: 0, skuIds: new Set<string>() };
      summary.quantity += line.onHandQuantity;
      summary.skuIds.add(line.variantId);
      direct.set(line.locationId, summary);
    }

    const summary = new Map<
      string,
      {
        directQuantity: number;
        directSkus: number;
        aggregateQuantity: number;
        aggregateSkus: number;
      }
    >();
    for (const location of locations) {
      const scopeIds = [location.id, ...getDescendantIds(location.id)];
      const skuIds = new Set<string>();
      let aggregateQuantity = 0;
      for (const id of scopeIds) {
        const item = direct.get(id);
        if (!item) continue;
        aggregateQuantity += item.quantity;
        item.skuIds.forEach((skuId) => skuIds.add(skuId));
      }
      const directItem = direct.get(location.id);
      summary.set(location.id, {
        directQuantity: directItem?.quantity ?? 0,
        directSkus: directItem?.skuIds.size ?? 0,
        aggregateQuantity,
        aggregateSkus: skuIds.size,
      });
    }
    return summary;
  }, [getDescendantIds, inventorySnapshot.balances, locations]);

  const selectedInventoryScopeIds = useMemo(() => {
    if (!selectedLocation) return new Set<string>();
    const includeChildren =
      selectedLocation.stockPolicy !== "stockable" &&
      !selectedLocation.capabilities?.canStoreInventory;
    return new Set([
      selectedLocation.id,
      ...(includeChildren ? getDescendantIds(selectedLocation.id) : []),
    ]);
  }, [getDescendantIds, selectedLocation]);

  const selectedInventoryLines = useMemo(
    () =>
      inventorySnapshot.balances.filter((line) => selectedInventoryScopeIds.has(line.locationId)),
    [inventorySnapshot.balances, selectedInventoryScopeIds]
  );

  const selectedMovementLines = useMemo(
    () =>
      inventorySnapshot.movements.filter(
        (line) =>
          (line.sourceLocationId && selectedInventoryScopeIds.has(line.sourceLocationId)) ||
          (line.destinationLocationId && selectedInventoryScopeIds.has(line.destinationLocationId))
      ),
    [inventorySnapshot.movements, selectedInventoryScopeIds]
  );

  const selectedContainers = useMemo(
    () =>
      inventorySnapshot.containers.filter((container) =>
        selectedInventoryScopeIds.has(container.currentLocationId)
      ),
    [inventorySnapshot.containers, selectedInventoryScopeIds]
  );

  const selectedPutawayRules = useMemo(
    () =>
      inventorySnapshot.putawayRules.filter((rule) =>
        selectedInventoryScopeIds.has(rule.destinationLocationId)
      ),
    [inventorySnapshot.putawayRules, selectedInventoryScopeIds]
  );

  const selectedSummary = selectedLocation
    ? locationStockSummaryById.get(selectedLocation.id)
    : null;

  const selectedCanHoldStock =
    selectedLocation?.stockPolicy === "stockable" ||
    selectedLocation?.capabilities?.canStoreInventory;

  const locationNameById = useMemo(
    () => new Map(locations.map((location) => [location.id, location.name])),
    [locations]
  );

  const getCategoryLabel = (role: LocationRole) =>
    t(`categories.${role}.label`, { fallback: LOCATION_CATEGORIES[role]?.label || role });

  const getCategoryDescription = (role: LocationRole) =>
    t(`categories.${role}.description`, {
      fallback: LOCATION_CATEGORIES[role]?.description || "",
    });

  const getPhysicalKindLabel = (kind: string | undefined) =>
    t(`physicalKinds.${kind ?? "bin"}`, { fallback: kind ?? "bin" });

  const getStockPolicyLabel = (policy: string | undefined) =>
    t(`stockPolicies.${policy ?? "none"}`, { fallback: policy ?? "none" });

  const getOperationProfileLabel = (profile: string | undefined) =>
    t(`operationProfiles.${profile ?? "standard"}`, { fallback: profile ?? "standard" });

  const handleCopyPath = () => {
    if (!selectedLocation) return;
    const pathNames = getLocationPath(selectedLocation.id).map((l) => l.code);
    const pathString = pathNames.join("/");
    navigator.clipboard.writeText(pathString);
    setCopiedPath(true);
    setTimeout(() => setCopiedPath(false), 2000);
  };

  const getLocationPath = (locId: string): LogicalLocation[] => {
    const path: LogicalLocation[] = [];
    let current = locations.find((l) => l.id === locId);
    while (current) {
      path.unshift(current);
      current = locations.find((l) => l.id === current?.parentId);
    }
    return path;
  };

  const getMappingStatus = (locId: string): MappingStatus => {
    const isMapped = visuals.some((v) => v.locationId === locId);
    return isMapped ? MappingStatus.MAPPED : MappingStatus.UNMAPPED;
  };

  const handleEditLocation = async (data: Partial<LogicalLocation>) => {
    if (onUpdateLocation && selectedLocation) {
      await onUpdateLocation({ ...data, id: selectedLocation.id });
    } else {
      console.log("Update location (no-op prototype):", data);
    }
    setIsEditModalOpen(false);
  };

  const handleAddLocation = async (data: Partial<LogicalLocation>) => {
    const newId = `l-${Date.now()}`;
    const newLoc: LogicalLocation = {
      id: newId,
      branchId: locations[0]?.branchId || "main-branch",
      code: data.code || `NEW-${newId.slice(-4)}`,
      name: data.name || t("defaults.newLocation"),
      description: data.description || "",
      parentId: data.parentId === "ROOT-SYS" || data.parentId === "" ? null : data.parentId || null,
      role: data.role || LocationRole.BIN,
      capabilities: data.capabilities || {
        canStoreInventory: true,
        canPick: true,
        canReceive: true,
        canShip: false,
        canReserve: true,
        isVirtual: false,
        isTemporary: false,
      },
      status: data.status || "active",
      icon: data.icon,
      color: data.color,
      pathCode: "", // Calculated via server/backend or util
      pathName: "",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    await onCreateLocation(newLoc);
    setIsAddModalOpen(false);

    // Auto-expand parent
    if (newLoc.parentId && !expandedIds?.includes(newLoc.parentId)) {
      setExpandedIds((prev) => [...prev, newLoc.parentId!]);
    }
  };

  const toggleExpand = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setExpandedIds((prev) =>
      prev?.includes(id) ? prev.filter((i) => i !== id) : [...(prev || []), id]
    );
  };

  const handleDragStart = (e: React.DragEvent, id: string) => {
    if (isTreeLocked) return;
    e.stopPropagation();
    setDraggedId(id);
    e.dataTransfer.effectAllowed = "move";

    const row = (e.currentTarget as HTMLElement).closest(".tree-row-wrapper");
    if (row) {
      e.dataTransfer.setDragImage(row, 20, 15);
      setTimeout(() => row.classList.add("opacity-50"), 0);
    } else {
      setTimeout(() => e.target && (e.target as HTMLElement).classList.add("opacity-50"), 0);
    }
  };

  const handleDragEnd = (e: React.DragEvent) => {
    e.stopPropagation();
    setDraggedId(null);
    setDragOverId(null);

    const row = (e.currentTarget as HTMLElement).closest(".tree-row-wrapper");
    if (row) {
      row.classList.remove("opacity-50");
    } else {
      e.target && (e.target as HTMLElement).classList.remove("opacity-50");
    }
  };

  const handleDragOver = (e: React.DragEvent, id: string) => {
    e.preventDefault();
    e.stopPropagation();
    if (draggedId && draggedId !== id && !getLocationPath(id).some((l) => l.id === draggedId)) {
      e.dataTransfer.dropEffect = "move";
      if (dragOverId !== id) setDragOverId(id);
    } else {
      e.dataTransfer.dropEffect = "none";
    }
  };

  const handleDragLeave = (e: React.DragEvent, id: string) => {
    e.preventDefault();
    e.stopPropagation();
    if (dragOverId === id) setDragOverId(null);
  };

  const handleDrop = (e: React.DragEvent, targetId: string) => {
    e.preventDefault();
    e.stopPropagation();
    setDragOverId(null);
    if (
      draggedId &&
      draggedId !== targetId &&
      !getLocationPath(targetId).some((l) => l.id === draggedId)
    ) {
      // Open confirmation modal instead of applying directly
      setLocationToMove(draggedId);
      setMoveTargetId(targetId);
      setIsMoveModalOpen(true);
    }
  };

  const executeMove = async () => {
    if (locationToMove && onUpdateLocation) {
      await onUpdateLocation({
        id: locationToMove,
        parentId: moveTargetId === "ROOT" ? null : moveTargetId,
      });
    }
    setIsMoveModalOpen(false);
    setLocationToMove(null);
  };

  const handleExpandAll = () => {
    const allIds = locations.map((l) => l.id);
    setExpandedIds(allIds);
    setIsTreeActionsOpen(false);
  };

  const handleCollapseAll = () => {
    setExpandedIds([]);
    setIsTreeActionsOpen(false);
  };

  const filteredLocations = locations.filter(
    (l) =>
      searchQuery === "" ||
      l.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      l.code.toLowerCase().includes(searchQuery.toLowerCase())
  );

  // Auto-expand parents when searching
  React.useEffect(() => {
    if (searchQuery.trim() !== "") {
      const parentsToExpand = new Set<string>();
      filteredLocations.forEach((loc) => {
        const path = getLocationPath(loc.id);
        path.forEach((p) => {
          if (p.id !== loc.id) parentsToExpand.add(p.id);
        });
      });
      setExpandedIds(Array.from(parentsToExpand));
    }
  }, [searchQuery]);

  const renderTreeItem = (location: LogicalLocation, depth: number = 0) => {
    // If searching, we only render items that match or are parents of matches
    if (searchQuery !== "") {
      const pathIds = getLocationPath(location.id).map((l) => l.id);
      const hasMatchingChild = filteredLocations.some((fl) =>
        getLocationPath(fl.id)
          .map((l) => l.id)
          ?.includes(location.id)
      );
      const isMatch = filteredLocations.some((fl) => fl.id === location.id);
      if (!isMatch && !hasMatchingChild) return null;
    }

    const children = locations
      .filter((l) => l.parentId === location.id)
      .sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0));
    const hasChildren = children.length > 0;
    const isExpanded = expandedIds?.includes(location.id) || searchQuery !== "";
    const isSelected = selectedLocationId === location.id;

    const category = LOCATION_CATEGORIES[location.role];
    const iconName = location.icon || category?.iconName || "Box";
    const iconColorClass =
      location.color ||
      (isSelected ? "text-primary" : "text-muted-foreground group-hover:text-muted-foreground");

    // Operational signals for tree
    const mappedCount = visuals.filter((v) => v.locationId === location.id).length;
    const stockSummary = locationStockSummaryById.get(location.id);
    const treeStockCount = stockSummary?.aggregateQuantity ?? 0;
    const hasStock = treeStockCount > 0;
    const warningCount = (location.warnings || []).filter(
      (w) => w.severity === "warning" || w.severity === "critical"
    ).length;

    return (
      <div key={location.id} className="relative">
        <div
          onClick={() => setSelectedLocationId(location.id)}
          onDragOver={(e) => handleDragOver(e, location.id)}
          onDragLeave={(e) => handleDragLeave(e, location.id)}
          onDrop={(e) => handleDrop(e, location.id)}
          className={`group tree-row-wrapper flex items-center justify-between py-1 px-2 rounded-lg cursor-pointer transition-colors border border-transparent ${
            dragOverId === location.id
              ? "bg-primary/20 border-primary/60 ring-2 ring-primary/30"
              : isSelected
                ? "border-primary/30"
                : "hover:bg-muted/50 hover:border-border/50"
          } relative`}
          style={{ paddingLeft: `${depth * 16 + 8}px` }}
        >
          {isSelected && (
            <motion.div
              layoutId="activeLocation"
              className="absolute inset-0 bg-primary/10 rounded-lg pointer-events-none"
              transition={{ type: "spring", bounce: 0.25, duration: 0.4 }}
            />
          )}
          <div className="flex items-center gap-2 overflow-hidden relative z-10 flex-1">
            <div
              className={`w-4 h-4 shrink-0 flex items-center justify-center rounded cursor-pointer transition-colors ${hasChildren ? "hover:bg-muted" : "opacity-0"}`}
              onClick={(e) => hasChildren && toggleExpand(location.id, e)}
            >
              {isExpanded ? (
                <ChevronDown className="w-3 h-3 text-muted-foreground" />
              ) : (
                <ChevronRight className="w-3 h-3 text-muted-foreground" />
              )}
            </div>

            <div className="flex items-center gap-2 overflow-hidden flex-1">
              <IconRenderer name={iconName} className={`w-3 h-3 shrink-0 ${iconColorClass}`} />
              <span
                className={`text-[11px] font-bold truncate ${isSelected ? "text-primary" : "text-foreground"}`}
              >
                {location.name}
              </span>
              <span className="text-[10px] text-muted-foreground uppercase tracking-tight truncate group-hover:text-muted-foreground transition-colors hidden sm:block">
                {location.code}
              </span>
            </div>
          </div>

          <div className="flex items-center gap-2 relative z-10">
            {/* Visual Signals */}
            <div className="flex items-center gap-1.5 opacity-60 group-hover:opacity-100 transition-opacity">
              {mappedCount > 0 && (
                <span title={t("tree.mappedTitle", { count: mappedCount })}>
                  <LayoutGrid className="w-2.5 h-2.5 text-primary" />
                </span>
              )}
              {hasStock && (
                <div
                  className="flex items-center gap-0.5"
                  title={t("tree.stockTitle", { count: treeStockCount })}
                >
                  <Package className="w-2.5 h-2.5 text-emerald-400" />
                  <span className="text-[8px] font-mono font-bold text-emerald-700 dark:text-emerald-300/80">
                    {treeStockCount}
                  </span>
                </div>
              )}
              {warningCount > 0 && (
                <span title={t("tree.warningTitle", { count: warningCount })}>
                  <AlertCircle className="w-2.5 h-2.5 text-amber-500" />
                </span>
              )}
            </div>

            <div className="flex items-center opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0">
              {!isTreeLocked && (
                <div
                  className="p-1 text-muted-foreground hover:text-foreground hover:bg-muted rounded cursor-grab active:cursor-grabbing transition-colors"
                  draggable={true}
                  onDragStart={(e) => handleDragStart(e, location.id)}
                  onDragEnd={handleDragEnd}
                  title={t("actions.dragToMove")}
                >
                  <GripVertical className="w-3.5 h-3.5" />
                </div>
              )}
            </div>
          </div>
        </div>

        {isExpanded && hasChildren && (
          <div className="mt-0.5 relative">
            {/* Tree branch line */}
            <div
              className="absolute left-[16px] top-0 bottom-3 w-px bg-muted"
              style={{ marginLeft: `${depth * 16}px` }}
            ></div>
            {children.map((child) => renderTreeItem(child, depth + 1))}
          </div>
        )}
      </div>
    );
  };

  const rootLocations = locations
    .filter((l) => !l.parentId)
    .sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0));

  const handleLocateOnMap = () => {
    if (!selectedLocation) return;
    // Find layout where this location is mapped
    const targetLayoutId = findRelevantLayoutId(selectedLocation.id);
    setPreviewLayoutId(targetLayoutId);
  };

  const handleAnalyzeMapping = () => {
    if (!selectedLocation) return;
    const targetLayoutId = findRelevantLayoutId(selectedLocation.id);
    setHealthReportLayoutId(targetLayoutId);
  };

  const findRelevantLayoutId = (locId: string): string | null => {
    const path = getLocationPath(locId);
    const pathIds = new Set(path.map((l) => l.id));

    // 1. Check if any layout is explicitly scoped to this location or any of its ancestors
    const scopedLayout = layouts.find((l) => l.rootLocationId && pathIds.has(l.rootLocationId));
    if (scopedLayout) return scopedLayout.id;

    // 2. Find layout where this location is actually mapped
    const layoutWithMapping = layouts.find((layout) =>
      visuals.some(
        (v) =>
          v.layoutId === layout.id &&
          (v.locationId === locId || (v.structure && hasLocationIdInStructure(v.structure, locId)))
      )
    );

    if (layoutWithMapping) return layoutWithMapping.id;

    // 3. Try to find mapping for any ancestor
    for (let i = path.length - 2; i >= 0; i--) {
      const ancestor = path[i];
      const ancestorLayout = layouts.find((layout) =>
        visuals.some(
          (v) =>
            v.layoutId === layout.id &&
            (v.locationId === ancestor.id ||
              (v.structure && hasLocationIdInStructure(v.structure, ancestor.id)))
        )
      );
      if (ancestorLayout) {
        return ancestorLayout.id;
      }
    }

    return layouts[0]?.id || null;
  };

  function hasLocationIdInStructure(root: any, locId: string): boolean {
    if (root.locationId === locId) return true;
    if (root.children) {
      return root.children.some((c: any) => hasLocationIdInStructure(c, locId));
    }
    return false;
  }

  return (
    <div className="flex h-full gap-0 bg-background font-sans">
      <AnimatePresence>
        {previewLayoutId && (
          <InteractiveLocationMapPreview
            layout={layouts.find((l) => l.id === previewLayoutId)!}
            visualNodes={visuals.filter((v) => v.layoutId === previewLayoutId)}
            locations={locations}
            initialLocationId={selectedLocationId || undefined}
            onClose={() => setPreviewLayoutId(null)}
            canEdit={true}
            onOpenEditor={() => {
              onNavigateToWorkspace(previewLayoutId);
              setPreviewLayoutId(null);
            }}
          />
        )}
      </AnimatePresence>

      {/* Sidebar: Location Tree */}
      <div className="relative z-10 flex w-[360px] shrink-0 flex-col overflow-hidden border-r border-border bg-card">
        <div className="border-b border-border bg-card px-3 py-3">
          <div className="flex items-center gap-2">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
              <input
                type="text"
                placeholder={t("tree.searchPlaceholder")}
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full bg-background border border-border/80 rounded-xl py-2 pl-8 pr-4 text-[11px] text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-primary/50 focus:ring-1 focus:ring-ring/20 transition-all font-bold tracking-tight"
              />
            </div>
            <button
              onClick={() => {
                setSelectedLocationId(null);
                setIsAddModalOpen(true);
              }}
              className="w-8 h-8 rounded-xl bg-primary/10 text-primary hover:bg-primary hover:text-primary-foreground flex items-center justify-center transition-all cursor-pointer border border-primary/20 shadow-sm shadow-primary/10 shrink-0"
              title={t("actions.addEntity")}
            >
              <Plus className="w-4 h-4" />
            </button>
          </div>
        </div>
        <div
          className={`relative flex-1 space-y-0.5 overflow-y-auto p-3 scrollbar-thin scrollbar-thumb-muted transition-colors ${dragOverId === "ROOT" ? "bg-primary/5 ring-2 ring-inset ring-primary/30" : ""}`}
          onDragOver={(e) => handleDragOver(e, "ROOT")}
          onDragLeave={(e) => handleDragLeave(e, "ROOT")}
          onDrop={(e) => handleDrop(e, "ROOT")}
        >
          {rootLocations.map((loc) => renderTreeItem(loc))}
          {rootLocations.length === 0 && (
            <div className="text-center p-8">
              <Database className="w-8 h-8 text-muted-foreground mx-auto mb-3" />
              <p className="text-xs text-muted-foreground uppercase tracking-wide font-semibold">
                {t("tree.noLocations")}
              </p>
            </div>
          )}
        </div>

        <div className="p-2 border-t border-border bg-background/40">
          <div className="flex items-center justify-between bg-background/80 rounded-xl p-1 border border-border/50">
            <div className="flex items-center gap-1">
              <button
                onClick={handleExpandAll}
                className="p-1.5 rounded-lg text-muted-foreground hover:text-primary hover:bg-muted transition-all"
                title={t("actions.expandAll")}
              >
                <Maximize2 className="w-3.5 h-3.5" />
              </button>
              <button
                onClick={handleCollapseAll}
                className="p-1.5 rounded-lg text-muted-foreground hover:text-primary hover:bg-muted transition-all"
                title={t("actions.collapseAll")}
              >
                <Triangle className="w-3.5 h-3.5 rotate-180" />
              </button>
              <div className="w-px h-4 bg-muted mx-1" />
              <button
                onClick={() => setIsTreeLocked(!isTreeLocked)}
                className={`p-1.5 rounded-lg transition-all flex items-center gap-2 ${!isTreeLocked ? "bg-amber-500/10 text-amber-500" : "text-muted-foreground hover:text-foreground/80 hover:bg-muted"}`}
                title={isTreeLocked ? t("actions.enableReordering") : t("actions.lockReordering")}
              >
                {isTreeLocked ? <Key className="w-3.5 h-3.5" /> : <Move className="w-3.5 h-3.5" />}
                <span className="text-[9px] font-semibold uppercase tracking-wide">
                  {isTreeLocked ? t("tree.locked") : t("tree.editMode")}
                </span>
              </button>
            </div>

            <div className="relative">
              <button
                onClick={() => setIsTreeActionsOpen(!isTreeActionsOpen)}
                className={`p-1.5 rounded-lg transition-all ${isTreeActionsOpen ? "bg-muted text-foreground" : "text-muted-foreground hover:text-foreground/80 hover:bg-muted"}`}
              >
                <MoreVertical className="w-3.5 h-3.5" />
              </button>

              <AnimatePresence>
                {isTreeActionsOpen && (
                  <>
                    <div
                      className="fixed inset-0 z-40"
                      onClick={() => setIsTreeActionsOpen(false)}
                    />
                    <motion.div
                      initial={{ opacity: 0, y: 10, scale: 0.95 }}
                      animate={{ opacity: 1, y: 0, scale: 1 }}
                      exit={{ opacity: 0, y: 10, scale: 0.95 }}
                      className="absolute right-0 bottom-full mb-2 w-48 bg-card border border-border rounded-xl shadow-sm z-50 overflow-hidden py-1"
                    >
                      <button className="w-full px-4 py-2 text-left text-[10px] font-bold text-muted-foreground hover:text-foreground hover:bg-muted flex items-center gap-2">
                        <Filter className="w-3.5 h-3.5" /> {t("actions.filterByType")}
                      </button>
                      <button className="w-full px-4 py-2 text-left text-[10px] font-bold text-muted-foreground hover:text-foreground hover:bg-muted flex items-center gap-2">
                        <LayoutGrid className="w-3.5 h-3.5" /> {t("actions.smartLayout")}
                      </button>
                      <div className="border-t border-border my-1" />
                      <button
                        onClick={() => {
                          setIsCompactMode((v) => !v);
                          setIsTreeActionsOpen(false);
                        }}
                        className="w-full px-4 py-2 text-left text-[10px] font-bold text-muted-foreground hover:text-foreground hover:bg-muted flex items-center gap-2"
                      >
                        {isCompactMode ? (
                          <LayoutList className="w-3.5 h-3.5" />
                        ) : (
                          <Columns className="w-3.5 h-3.5" />
                        )}
                        {isCompactMode ? t("actions.standardView") : t("actions.compactView")}
                      </button>
                      <div className="border-t border-border my-1" />
                      <button
                        onClick={() => {
                          if (selectedLocation) {
                            handleAnalyzeMapping();
                          } else if (layouts.length > 0) {
                            setHealthReportLayoutId(layouts[0].id);
                          }
                          setIsTreeActionsOpen(false);
                        }}
                        className="w-full px-4 py-2 text-left text-[10px] font-bold text-emerald-400 hover:text-foreground hover:bg-emerald-500/10 flex items-center gap-2"
                      >
                        <Activity className="w-3.5 h-3.5" /> {t("actions.analyzeMapping")}
                      </button>
                      <div className="border-t border-border my-1" />
                      <button
                        onClick={() => {
                          setIsExportDialogOpen(true);
                          setIsTreeActionsOpen(false);
                        }}
                        className="w-full px-4 py-2 text-left text-[10px] font-bold text-primary hover:text-foreground hover:bg-primary/10 flex items-center gap-2"
                      >
                        <FileJson className="w-3.5 h-3.5" /> {t("actions.exportData")}
                      </button>
                    </motion.div>
                  </>
                )}
              </AnimatePresence>
            </div>
          </div>
        </div>
      </div>

      {/* Main Content Area: Location Detail */}
      <div className="relative flex min-w-0 flex-1 flex-col overflow-hidden bg-background">
        <AnimatePresence mode="wait">
          {selectedLocation ? (
            <motion.div
              key={selectedLocation.id}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.2 }}
              className="flex-1 flex flex-col h-full relative z-10"
            >
              {/* Detail Header */}
              <div className="relative z-10 shrink-0 border-b border-border bg-card px-5 py-4">
                <div className="flex items-start justify-between">
                  <div>
                    <div className="flex items-center gap-3">
                      <h1 className="text-2xl font-semibold text-foreground tracking-normal flex items-center gap-3">
                        <IconRenderer
                          name={
                            selectedLocation.icon ||
                            LOCATION_CATEGORIES[selectedLocation.role]?.iconName ||
                            "Database"
                          }
                          className={`w-6 h-6 ${selectedLocation.color || "text-primary"}`}
                        />
                        {selectedLocation.name}
                      </h1>
                      <div className="px-2 py-0.5 rounded items-center justify-center bg-muted border border-border text-[9px] font-semibold text-muted-foreground uppercase tracking-wide flex gap-1.5 mt-1">
                        <IconRenderer
                          name={LOCATION_CATEGORIES[selectedLocation.role]?.iconName || "Box"}
                          className={`w-3 h-3 ${selectedLocation.color || "text-muted-foreground"}`}
                        />
                        {getCategoryLabel(selectedLocation.role)}
                      </div>
                    </div>
                    <div className="flex items-center mt-2 inline-flex">
                      {getLocationPath(selectedLocation.id).map((pathLoc, i, arr) => (
                        <React.Fragment key={pathLoc.id}>
                          <span
                            onClick={() => setSelectedLocationId(pathLoc.id)}
                            className={`text-[10px] font-semibold uppercase tracking-wide cursor-pointer transition-colors ${
                              i === arr.length - 1
                                ? "text-primary"
                                : "text-muted-foreground hover:text-foreground/80"
                            }`}
                          >
                            {pathLoc.code}
                          </span>
                          {i < arr.length - 1 && (
                            <span className="text-muted-foreground text-[10px] font-bold">/</span>
                          )}
                        </React.Fragment>
                      ))}
                      <button
                        onClick={handleCopyPath}
                        className="ml-2 p-1 rounded-md hover:bg-muted text-muted-foreground hover:text-primary transition-colors"
                        title={t("actions.copyPath")}
                      >
                        {copiedPath ? (
                          <Check className="w-3.5 h-3.5 text-emerald-700 dark:text-emerald-300" />
                        ) : (
                          <Copy className="w-3.5 h-3.5" />
                        )}
                      </button>
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <div className="flex items-center gap-1 bg-background/80 rounded-xl p-1 border border-border mr-2">
                      <button
                        onClick={() => setIsCompactMode(false)}
                        className={`p-2 rounded-lg transition-all ${!isCompactMode ? "bg-primary/10 text-primary shadow-[inset_0_1px_0_0_rgba(255,255,255,0.1)] border border-primary/20" : "text-muted-foreground hover:text-foreground/80 border border-transparent"}`}
                        title={t("actions.bentoView")}
                      >
                        <LayoutGrid className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => setIsCompactMode(true)}
                        className={`p-2 rounded-lg transition-all ${isCompactMode ? "bg-primary/10 text-primary shadow-[inset_0_1px_0_0_rgba(255,255,255,0.1)] border border-primary/20" : "text-muted-foreground hover:text-foreground/80 border border-transparent"}`}
                        title={t("actions.streamlinedView")}
                      >
                        <LayoutList className="w-4 h-4" />
                      </button>
                    </div>
                    <button
                      onClick={() => setIsEditModalOpen(true)}
                      className="flex items-center gap-2 px-4 py-2 rounded-xl border border-border bg-muted hover:bg-muted font-bold text-xs text-foreground/80 transition-all shadow-sm"
                    >
                      <Pencil className="w-4 h-4" />
                      {t("actions.edit")}
                    </button>
                  </div>
                </div>
              </div>

              {/* SUB-HEADER: TABS & QUICK ACTIONS RIBBON (Moved outside) */}
              <div className="relative z-20 flex shrink-0 flex-col items-center justify-between gap-3 border-b border-border bg-background px-5 py-2.5 sm:flex-row">
                {/* Tabs */}
                <div className="flex bg-background/80 p-1 rounded-xl border border-border/50 backdrop-blur shrink-0">
                  <button
                    onClick={() => setActiveTab("info")}
                    className={`px-5 py-2 rounded-lg text-[10px] font-semibold uppercase tracking-wide transition-all gap-2 flex items-center ${activeTab === "info" ? "bg-muted text-primary shadow-sm" : "text-muted-foreground hover:text-foreground/80"}`}
                  >
                    <Info className="w-3.5 h-3.5" />
                    {t("tabs.information")}
                  </button>
                  <button
                    onClick={() => setActiveTab("inventory")}
                    className={`px-5 py-2 rounded-lg text-[10px] font-semibold uppercase tracking-wide transition-all gap-2 flex items-center ${activeTab === "inventory" ? "bg-muted text-emerald-400 shadow-sm" : "text-muted-foreground hover:text-foreground/80"}`}
                  >
                    <Package className="w-3.5 h-3.5" />
                    {t("tabs.inventory")}
                  </button>
                  <button
                    onClick={() => setActiveTab("history")}
                    className={`px-5 py-2 rounded-lg text-[10px] font-semibold uppercase tracking-wide transition-all gap-2 flex items-center ${activeTab === "history" ? "bg-muted text-primary shadow-sm" : "text-muted-foreground hover:text-foreground/80"}`}
                  >
                    <Clock className="w-3.5 h-3.5" />
                    {t("tabs.history")}
                  </button>
                </div>

                {/* Ribbon Actions */}
                <div className="flex items-center gap-1.5 bg-background/50 p-1 rounded-xl border border-border/40">
                  <RibbonAction
                    icon={<Plus className="w-3 h-3" />}
                    onClick={() => setIsAddModalOpen(true)}
                    title={t("actions.quickAddChild")}
                  />
                  <RibbonAction
                    icon={<Copy className="w-3 h-3" />}
                    onClick={() => console.log("Duplicate")}
                    title={t("actions.duplicate")}
                  />
                  <RibbonAction
                    icon={<SearchIcon className="w-3 h-3" />}
                    onClick={handleLocateOnMap}
                    title={t("actions.locateOnMap")}
                  />
                  <RibbonAction
                    icon={<Activity className="w-3 h-3" />}
                    onClick={handleAnalyzeMapping}
                    title={t("actions.analyzeMappingHealth")}
                  />
                  <RibbonAction
                    icon={<MoveUpRight className="w-3 h-3" />}
                    onClick={() => {
                      setLocationToMove(selectedLocation.id);
                      setIsMoveModalOpen(true);
                    }}
                    title={t("actions.moveLocation")}
                  />
                  <div className="w-px h-4 bg-muted mx-1" />
                  <RibbonAction
                    icon={<Trash2 className="w-3 h-3" />}
                    onClick={() => {
                      if (!onDeleteLocation || !selectedLocation) return;
                      void onDeleteLocation(selectedLocation.id);
                    }}
                    title={t("actions.archive")}
                    variant="danger"
                  />
                </div>
              </div>

              {/* Detail Content */}
              <div className="flex-1 overflow-y-auto p-4 pb-10 scrollbar-thin scrollbar-thumb-muted md:p-5">
                <AnimatePresence mode="wait">
                  {activeTab === "info" ? (
                    <motion.div
                      key="info-tab"
                      initial={{ opacity: 0, x: -10 }}
                      animate={{ opacity: 1, x: 0 }}
                      exit={{ opacity: 0, x: 10 }}
                      transition={{ duration: 0.2 }}
                      className="space-y-8"
                    >
                      <div
                        className={`grid gap-6 ${isCompactMode ? "grid-cols-1" : "grid-cols-1 lg:grid-cols-2"}`}
                      >
                        <section className="bg-card/70 rounded-lg border border-border shadow-sm overflow-hidden">
                          <div className="px-5 py-4 border-b border-border bg-muted/40 flex items-center justify-between">
                            <span className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                              {t("detail.structureStockPolicy")}
                            </span>
                            <Fingerprint className="w-4 h-4 text-muted-foreground" />
                          </div>
                          <div className="p-6">
                            <div className="flex items-start gap-4 mb-5">
                              <div
                                className={`p-4 rounded-lg bg-muted border border-border ${LOCATION_CATEGORIES[selectedLocation.role]?.color || "text-primary"}`}
                              >
                                <IconRenderer
                                  name={
                                    LOCATION_CATEGORIES[selectedLocation.role]?.iconName ||
                                    "Database"
                                  }
                                  className="w-6 h-6"
                                />
                              </div>
                              <div>
                                <h3 className="text-lg font-semibold text-foreground tracking-normal">
                                  {getPhysicalKindLabel(selectedLocation.physicalKind)}
                                </h3>
                                <p className="text-xs text-muted-foreground font-medium leading-relaxed mt-1">
                                  {selectedCanHoldStock
                                    ? t("detail.binCanHoldStock")
                                    : t("detail.aggregatesChildStock")}
                                </p>
                              </div>
                            </div>
                            <div className="mb-5 grid grid-cols-1 gap-4 sm:grid-cols-3">
                              <DetailItem
                                label={t("detail.physicalKind")}
                                value={getPhysicalKindLabel(selectedLocation.physicalKind)}
                              />
                              <DetailItem
                                label={t("detail.stockPolicy")}
                                value={getStockPolicyLabel(selectedLocation.stockPolicy)}
                              />
                              <DetailItem
                                label={t("detail.operationProfile")}
                                value={getOperationProfileLabel(selectedLocation.operationProfile)}
                              />
                            </div>
                            <DetailItem
                              label={t("detail.fullPathCode")}
                              value={getLocationPath(selectedLocation.id)
                                .map((p) => p.code)
                                .join(" / ")}
                              isMono
                            />
                          </div>
                        </section>

                        <section className="bg-card/70 rounded-lg border border-border shadow-sm overflow-hidden">
                          <div className="px-5 py-4 border-b border-border bg-muted/40 flex items-center justify-between">
                            <span className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                              {t("detail.description")}
                            </span>
                            <Info className="w-4 h-4 text-muted-foreground" />
                          </div>
                          <div className="p-6">
                            <p className="min-h-20 text-sm leading-6 text-foreground">
                              {selectedLocation.description?.trim() || t("detail.noDescription")}
                            </p>
                          </div>
                        </section>

                        <section className="bg-card/70 rounded-lg border border-border shadow-sm overflow-hidden">
                          <div className="px-5 py-4 border-b border-border bg-muted/40 flex items-center justify-between">
                            <span className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                              {t("detail.operationalBehavior")}
                            </span>
                            <Construction className="w-4 h-4 text-muted-foreground" />
                          </div>
                          <div className="p-6">
                            <p className="text-[10px] text-muted-foreground font-semibold uppercase tracking-wide mb-4">
                              {t("detail.functionalCapabilities")}
                            </p>
                            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                              <BehaviorIndicator
                                label={t("capabilities.storesInventory")}
                                active={selectedLocation.capabilities.canStoreInventory}
                                icon={<Database className="w-3.5 h-3.5" />}
                              />
                              <BehaviorIndicator
                                label={t("capabilities.pickable")}
                                active={selectedLocation.capabilities.canPick}
                                icon={<RotateCcw className="w-3.5 h-3.5" />}
                              />
                              <BehaviorIndicator
                                label={t("capabilities.receivable")}
                                active={selectedLocation.capabilities.canReceive}
                                icon={<Inbox className="w-3.5 h-3.5" />}
                              />
                              <BehaviorIndicator
                                label={t("capabilities.virtual")}
                                active={selectedLocation.capabilities.isVirtual}
                                icon={<Zap className="w-3.5 h-3.5" />}
                              />
                            </div>
                          </div>
                        </section>

                        <section className="bg-card/70 rounded-lg border border-border shadow-sm overflow-hidden">
                          <div className="px-5 py-4 border-b border-border bg-muted/40 flex items-center justify-between">
                            <span className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                              {t("detail.physicalMetadata")}
                            </span>
                            <Maximize2 className="w-4 h-4 text-muted-foreground" />
                          </div>
                          <div className="p-6">
                            {selectedLocation.physicalMetadata ? (
                              <div className="grid grid-cols-2 gap-y-6 gap-x-4">
                                <DetailItem
                                  label={t("detail.width")}
                                  value={`${selectedLocation.physicalMetadata.width} mm`}
                                  isMono
                                />
                                <DetailItem
                                  label={t("detail.height")}
                                  value={`${selectedLocation.physicalMetadata.height} mm`}
                                  isMono
                                />
                                <DetailItem
                                  label={t("detail.depth")}
                                  value={`${selectedLocation.physicalMetadata.depth} mm`}
                                  isMono
                                />
                                <DetailItem
                                  label={t("detail.weightCapacity")}
                                  value={`${selectedLocation.physicalMetadata.weightCapacity} kg`}
                                  isMono
                                />
                              </div>
                            ) : (
                              <div className="py-4 text-center">
                                <p className="text-[11px] text-muted-foreground font-medium italic">
                                  {t("detail.noPhysicalMetadata")}
                                </p>
                              </div>
                            )}
                          </div>
                        </section>
                      </div>

                      {/* FULL WIDTH COLUMN: CHILD LOCATIONS */}
                      <div className="relative mt-5 block w-full overflow-hidden rounded-lg border border-border bg-card">
                        <div className="px-8 py-5 border-b border-border bg-muted/40 flex items-center justify-between">
                          <div className="flex items-center gap-4">
                            <h3 className="text-sm font-semibold text-foreground uppercase tracking-wide flex items-center gap-3">
                              <LayoutList className="w-4 h-4 text-primary" />
                              {t("detail.childInventoryStructure")}
                            </h3>
                            <span className="text-[10px] bg-background text-muted-foreground px-3 py-1 rounded-full border border-border font-mono font-bold">
                              {locations.filter((l) => l.parentId === selectedLocation.id).length}{" "}
                              {t("detail.entities")}
                            </span>
                          </div>

                          <div className="flex items-center gap-4">
                            <div className="flex bg-background p-1 rounded-xl border border-border">
                              <button
                                onClick={() => setChildListDensity("COMFORTABLE")}
                                className={`px-3 py-1.5 rounded-lg text-[9px] font-semibold uppercase tracking-wide transition-all ${childListDensity === "COMFORTABLE" ? "bg-muted text-primary" : "text-muted-foreground hover:text-muted-foreground"}`}
                              >
                                {t("actions.comfortable")}
                              </button>
                              <button
                                onClick={() => setChildListDensity("COMPACT")}
                                className={`px-3 py-1.5 rounded-lg text-[9px] font-semibold uppercase tracking-wide transition-all ${childListDensity === "COMPACT" ? "bg-muted text-primary" : "text-muted-foreground hover:text-muted-foreground"}`}
                              >
                                {t("actions.compact")}
                              </button>
                            </div>
                            <div className="w-px h-6 bg-muted" />
                            <button
                              onClick={() => setIsAddModalOpen(true)}
                              className="w-8 h-8 rounded-lg bg-primary/10 text-primary hover:bg-primary hover:text-primary-foreground flex items-center justify-center transition-all cursor-pointer border border-primary/20"
                              title={t("actions.addChildLocation")}
                            >
                              <Plus className="w-4 h-4" />
                            </button>
                          </div>
                        </div>

                        <div className="p-4 bg-card/70">
                          {locations.filter((l) => l.parentId === selectedLocation.id).length >
                          0 ? (
                            <div
                              className={
                                childListDensity === "COMFORTABLE"
                                  ? "grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4"
                                  : "space-y-1"
                              }
                            >
                              {locations
                                .filter((l) => l.parentId === selectedLocation.id)
                                .map((child) =>
                                  childListDensity === "COMFORTABLE" ? (
                                    <div
                                      key={child.id}
                                      onClick={() => setSelectedLocationId(child.id)}
                                      className="flex items-center justify-between p-4 rounded-lg bg-muted/20 border border-border hover:border-primary/50 hover:bg-muted/40 transition-all cursor-pointer group shadow-sm"
                                    >
                                      <div className="flex items-center gap-4">
                                        <div
                                          className={`w-12 h-12 rounded-xl bg-card border border-border flex items-center justify-center shrink-0 ${LOCATION_CATEGORIES[child.role]?.color || "text-muted-foreground"}`}
                                        >
                                          <IconRenderer
                                            name={
                                              child.icon ||
                                              LOCATION_CATEGORIES[child.role]?.iconName ||
                                              "Box"
                                            }
                                            className="w-6 h-6"
                                          />
                                        </div>
                                        <div className="overflow-hidden">
                                          <p className="text-xs font-semibold text-foreground truncate">
                                            {child.name}
                                          </p>
                                          <div className="flex items-center gap-2 mt-0.5">
                                            <p className="text-[10px] font-mono font-bold text-primary/80 uppercase truncate">
                                              {child.code}
                                            </p>
                                            {getMappingStatus(child.id) ===
                                              MappingStatus.MAPPED && (
                                              <LayoutGrid className="w-2.5 h-2.5 text-primary/40" />
                                            )}
                                          </div>
                                          <div className="flex items-center gap-3 mt-1.5">
                                            <span className="text-[9px] font-mono text-emerald-700 dark:text-emerald-300 bg-emerald-500/5 px-1.5 py-0.5 rounded border border-emerald-500/10">
                                              {t("detail.stockCount", {
                                                count:
                                                  locationStockSummaryById.get(child.id)
                                                    ?.aggregateQuantity ?? 0,
                                              })}
                                            </span>
                                            <span className="text-[9px] font-bold text-muted-foreground uppercase tracking-wide">
                                              {getCategoryLabel(child.role)}
                                            </span>
                                          </div>
                                        </div>
                                      </div>
                                      <ChevronRight className="w-5 h-5 text-muted-foreground group-hover:text-primary transition-colors shrink-0" />
                                    </div>
                                  ) : (
                                    <div
                                      key={child.id}
                                      onClick={() => setSelectedLocationId(child.id)}
                                      className="flex items-center justify-between py-1.5 px-4 rounded-lg bg-background/50 border border-transparent hover:border-border hover:bg-muted/40 transition-all cursor-pointer group"
                                    >
                                      <div className="flex items-center gap-4 flex-1">
                                        <div className="flex items-center gap-2 w-48 shrink-0">
                                          <IconRenderer
                                            name={
                                              child.icon ||
                                              LOCATION_CATEGORIES[child.role]?.iconName ||
                                              "Box"
                                            }
                                            className={`w-3.5 h-3.5 ${LOCATION_CATEGORIES[child.role]?.color || "text-muted-foreground"}`}
                                          />
                                          <span className="text-[11px] font-bold text-foreground truncate group-hover:text-foreground transition-colors">
                                            {child.name}
                                          </span>
                                        </div>
                                        <span className="w-24 text-[10px] font-mono font-bold text-primary/70 group-hover:text-primary transition-colors uppercase truncate">
                                          {child.code}
                                        </span>
                                        <span className="text-[9px] font-semibold uppercase tracking-wide text-muted-foreground w-32">
                                          {getCategoryLabel(child.role)}
                                        </span>
                                        <div className="flex items-center gap-1.5 w-24">
                                          <Package className="w-3 h-3 text-muted-foreground" />
                                          <span className="text-[10px] font-mono text-muted-foreground">
                                            {locationStockSummaryById.get(child.id)
                                              ?.aggregateQuantity ?? 0}
                                          </span>
                                        </div>
                                        <div className="flex items-center gap-2 flex-1 justify-end opacity-40 group-hover:opacity-100 transition-opacity">
                                          {getMappingStatus(child.id) === MappingStatus.MAPPED ? (
                                            <LayoutGrid className="w-3.5 h-3.5 text-primary" />
                                          ) : (
                                            <Triangle className="w-3.5 h-3.5 text-muted-foreground" />
                                          )}
                                          {(child.warnings?.length || 0) > 0 && (
                                            <AlertCircle className="w-3.5 h-3.5 text-amber-500" />
                                          )}
                                        </div>
                                      </div>
                                      <div className="ml-4 opacity-0 group-hover:opacity-100 transition-opacity flex items-center gap-1">
                                        <button className="p-1.5 rounded hover:bg-muted text-muted-foreground hover:text-foreground">
                                          <Pencil className="w-3 h-3" />
                                        </button>
                                        <button className="p-1.5 rounded hover:bg-muted text-muted-foreground hover:text-foreground">
                                          <Copy className="w-3 h-3" />
                                        </button>
                                      </div>
                                    </div>
                                  )
                                )}
                            </div>
                          ) : (
                            <div className="py-20 flex flex-col items-center justify-center text-center">
                              <Box className="w-12 h-12 text-muted-foreground mb-4" />
                              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                                {t("detail.structureEmpty")}
                              </p>
                              <p className="text-[10px] text-muted-foreground font-medium mt-2">
                                {t("detail.noChildLocations")}
                              </p>
                              <button
                                onClick={() => setIsAddModalOpen(true)}
                                className="mt-6 px-6 py-2 rounded-xl border border-border text-[10px] font-semibold uppercase tracking-wide text-muted-foreground hover:border-primary/50 hover:text-primary transition-all"
                              >
                                {t("actions.initialSeed")}
                              </button>
                            </div>
                          )}
                        </div>
                      </div>
                    </motion.div>
                  ) : activeTab === "inventory" ? (
                    <motion.div
                      key="inventory-tab"
                      initial={{ opacity: 0, x: 10 }}
                      animate={{ opacity: 1, x: 0 }}
                      exit={{ opacity: 0, x: -10 }}
                      transition={{ duration: 0.2 }}
                      className="space-y-6"
                    >
                      <div className="grid gap-4 lg:grid-cols-4">
                        <InventoryMetric
                          label={t("inventory.activeStock")}
                          value={
                            selectedCanHoldStock
                              ? (selectedSummary?.directQuantity ?? 0)
                              : (selectedSummary?.aggregateQuantity ?? 0)
                          }
                          icon={<Package className="h-4 w-4" />}
                        />
                        <InventoryMetric
                          label={t("inventory.activeSkus")}
                          value={
                            selectedCanHoldStock
                              ? (selectedSummary?.directSkus ?? 0)
                              : (selectedSummary?.aggregateSkus ?? 0)
                          }
                          icon={<Layers className="h-4 w-4" />}
                        />
                        <InventoryMetric
                          label={t("inventory.containers")}
                          value={selectedContainers.length}
                          icon={<Archive className="h-4 w-4" />}
                        />
                        <InventoryMetric
                          label={t("inventory.putawayRules")}
                          value={selectedPutawayRules.length}
                          icon={<Tag className="h-4 w-4" />}
                        />
                      </div>

                      <div className="rounded-lg border border-border bg-card p-4">
                        <div className="flex items-start gap-3">
                          <div className="mt-0.5 rounded-md border border-primary/20 bg-primary/10 p-2 text-primary">
                            <ShieldCheck className="h-4 w-4" />
                          </div>
                          <div>
                            <p className="text-sm font-semibold text-foreground">
                              {selectedCanHoldStock
                                ? t("inventory.directBinStock")
                                : t("inventory.aggregatedChildStock")}
                            </p>
                            <p className="mt-1 text-xs leading-5 text-muted-foreground">
                              {t("inventory.branchStockBoundary")}
                            </p>
                          </div>
                        </div>
                      </div>

                      <InventoryLinesTable
                        lines={selectedInventoryLines}
                        locationNameById={locationNameById}
                        showLocation={!selectedCanHoldStock}
                        emptyLabel={t("inventory.noStockLines")}
                        t={t}
                      />

                      <div className="grid gap-4 lg:grid-cols-2">
                        <ContainerList
                          containers={selectedContainers}
                          locationNameById={locationNameById}
                          emptyLabel={t("inventory.noContainers")}
                          t={t}
                        />
                        <PutawayRuleList
                          rules={selectedPutawayRules}
                          variants={variantOptions}
                          emptyLabel={t("inventory.noPutawayRules")}
                          t={t}
                        />
                      </div>
                    </motion.div>
                  ) : (
                    <motion.div
                      key="history-tab"
                      initial={{ opacity: 0, x: 10 }}
                      animate={{ opacity: 1, x: 0 }}
                      exit={{ opacity: 0, x: -10 }}
                      transition={{ duration: 0.2 }}
                      className="space-y-6"
                    >
                      <div className="bg-card/70 rounded-lg border border-border shadow-sm overflow-hidden">
                        <div className="px-5 py-4 border-b border-border bg-muted/40 flex items-center justify-between">
                          <span className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                            {t("history.recentMovements")}
                          </span>
                          <Clock className="w-4 h-4 text-muted-foreground" />
                        </div>
                        <MovementHistoryList movements={selectedMovementLines} t={t} />
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            </motion.div>
          ) : (
            <motion.div
              key="empty"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="flex-1 flex flex-col items-center justify-center relative z-10 opacity-50"
            >
              <Database className="w-16 h-16 text-muted-foreground mb-6" />
              <p className="text-sm font-bold text-foreground/80">{t("empty.selectLocation")}</p>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      <AnimatePresence>
        {isAddModalOpen && (
          <LocationModal
            onClose={() => setIsAddModalOpen(false)}
            onSubmit={handleAddLocation}
            locations={locations}
            initialData={selectedLocation ? { parentId: selectedLocation.id } : undefined}
          />
        )}
        {isEditModalOpen && selectedLocation && (
          <LocationModal
            onClose={() => setIsEditModalOpen(false)}
            onSubmit={handleEditLocation}
            locations={locations}
            initialData={selectedLocation}
          />
        )}

        {/* Move Location Confirmation Modal */}
        {isMoveModalOpen && locationToMove && (
          <div className="fixed inset-0 z-[110] flex items-center justify-center p-6 bg-background/80 backdrop-blur-md">
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="w-full max-w-lg bg-card border border-border rounded-lg shadow-sm overflow-hidden flex flex-col"
            >
              <div className="p-6 border-b border-border bg-background/80">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-500">
                    <Move className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="text-sm font-semibold text-foreground uppercase tracking-wide">
                      {t("move.title")}
                    </h3>
                    <p className="text-xs text-muted-foreground mt-1">{t("move.subtitle")}</p>
                  </div>
                </div>
              </div>

              <div className="p-6 space-y-6">
                <div className="space-y-4">
                  <p className="text-xs text-foreground/80 font-medium">{t("move.description")}</p>

                  <div className="bg-background rounded-xl border border-border p-4 space-y-4">
                    <div>
                      <p className="text-[9px] font-semibold uppercase tracking-wide text-muted-foreground mb-1.5">
                        {t("move.oldPath")}
                      </p>
                      <div className="flex items-center gap-1.5 flex-wrap px-2 py-1.5 rounded-lg bg-card border border-border">
                        {getLocationPath(locationToMove).map((l, i, arr) => (
                          <React.Fragment key={l.id}>
                            <span
                              className={`text-[10px] font-mono ${i === arr.length - 1 ? "text-amber-400 font-bold" : "text-muted-foreground"}`}
                            >
                              {l.code}
                            </span>
                            {i < arr.length - 1 && (
                              <span className="text-muted-foreground font-bold text-[10px]">/</span>
                            )}
                          </React.Fragment>
                        ))}
                      </div>
                    </div>
                    <div>
                      <p className="text-[9px] font-semibold uppercase tracking-wide text-emerald-700 dark:text-emerald-300 mb-1.5">
                        {t("move.newPath")}
                      </p>
                      <div className="flex items-center gap-1.5 flex-wrap px-2 py-1.5 rounded-lg bg-card border border-emerald-500/20">
                        {moveTargetId !== "ROOT" &&
                          getLocationPath(moveTargetId).map((l) => (
                            <React.Fragment key={l.id}>
                              <span className="text-[10px] font-mono text-emerald-400/70">
                                {l.code}
                              </span>
                              <span className="text-muted-foreground font-bold text-[10px]">/</span>
                            </React.Fragment>
                          ))}
                        {moveTargetId === "ROOT" && (
                          <span className="text-[10px] font-mono text-emerald-400/70">
                            {t("modal.root")} /{" "}
                          </span>
                        )}
                        <span className="text-[10px] font-mono font-bold text-emerald-400">
                          {locations.find((l) => l.id === locationToMove)?.code ||
                            t("move.unknown")}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              <div className="p-6 border-t border-border bg-background/80 flex justify-end gap-3">
                <button
                  onClick={() => {
                    setIsMoveModalOpen(false);
                    setLocationToMove(null);
                  }}
                  className="px-5 py-2.5 rounded-xl font-bold text-xs text-muted-foreground hover:text-foreground transition-colors"
                >
                  {t("actions.cancel")}
                </button>
                <button
                  onClick={executeMove}
                  className="px-5 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-white font-semibold text-xs uppercase tracking-wide transition-colors flex items-center justify-center gap-2 shadow-sm"
                >
                  {t("move.confirm")}
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {isExportDialogOpen && (
          <LocationExportDialog
            locations={locations}
            layouts={layouts}
            onClose={() => setIsExportDialogOpen(false)}
          />
        )}
      </AnimatePresence>

      <AnimatePresence>
        {healthReportLayoutId && layouts.find((l) => l.id === healthReportLayoutId) && (
          <WorkspaceHealthReportDialog
            layout={layouts.find((l) => l.id === healthReportLayoutId)!}
            visuals={visuals.filter((v) => v.layoutId === healthReportLayoutId)}
            locations={locations}
            scopeLocationId={selectedLocationId || undefined}
            onClose={() => setHealthReportLayoutId(null)}
          />
        )}
      </AnimatePresence>
    </div>
  );
}
