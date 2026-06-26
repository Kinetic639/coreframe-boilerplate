"use client";

import React, { useCallback, useMemo, useState } from "react";
import { useTranslations } from "next-intl";
import { AnimatePresence, motion } from "motion/react";
import {
  Archive,
  Box,
  Check,
  ChevronDown,
  ChevronRight,
  Clock,
  Construction,
  Copy,
  Database,
  Fingerprint,
  Inbox,
  Info,
  Layers,
  LayoutList,
  Maximize2,
  Package,
  RotateCcw,
  ShieldCheck,
  Tag,
  Zap,
} from "lucide-react";
import type {
  AmbraLocationInventorySnapshot,
  ContainerLine,
  LocationContainer,
  LocationInventoryLine,
  LocationMovementLine,
  LocationPutawayRule,
  LocationRole,
  LogicalLocation,
} from "../_ambra/types";
import type { InventoryVariantOption } from "@/lib/warehouse/inventory-types";
import { LOCATION_CATEGORIES } from "../_ambra/constants/locationCategories";
import { IconRenderer } from "../_ambra/components/locations/location-icons";
import { BehaviorIndicator, DetailItem } from "../_ambra/components/locations/location-page-atoms";

// ---------------------------------------------------------------------------
// Sub-components (private to this file, copied from LocationsPage)
// ---------------------------------------------------------------------------

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
  t: ReturnType<typeof useTranslations>;
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
  t: ReturnType<typeof useTranslations>;
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
                <div className="mt-3 space-y-1 pl-5">
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
  t: ReturnType<typeof useTranslations>;
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

function MovementHistoryList({
  movements,
  t,
}: {
  movements: LocationMovementLine[];
  t: ReturnType<typeof useTranslations>;
}) {
  if (movements.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center p-12 text-center">
        <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-muted opacity-60">
          <Layers className="h-5 w-5 text-muted-foreground" />
        </div>
        <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
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

// ---------------------------------------------------------------------------
// Main Component
// ---------------------------------------------------------------------------

type Props = {
  location: LogicalLocation;
  allLocations: LogicalLocation[];
  inventorySnapshot: AmbraLocationInventorySnapshot;
  variantOptions: InventoryVariantOption[];
  pathCode: string;
  compact?: boolean;
  onSelectLocation?: (id: string) => void;
  headerActions?: React.ReactNode;
};

export function LocationDetailPanel({
  location,
  allLocations,
  inventorySnapshot,
  variantOptions,
  pathCode,
  compact,
  onSelectLocation,
  headerActions,
}: Props) {
  const t = useTranslations("ambraLocations");
  const [activeTab, setActiveTab] = useState<"info" | "inventory" | "history">("info");
  const [copiedPath, setCopiedPath] = useState(false);

  // --- helpers ---

  const getPhysicalKindLabel = (kind: string | undefined) =>
    t(`physicalKinds.${kind ?? "bin"}`, { fallback: kind ?? "bin" } as any);
  const getStockPolicyLabel = (policy: string | undefined) =>
    t(`stockPolicies.${policy ?? "none"}`, { fallback: policy ?? "none" } as any);
  const getOperationProfileLabel = (profile: string | undefined) =>
    t(`operationProfiles.${profile ?? "standard"}`, { fallback: profile ?? "standard" } as any);
  const getCategoryLabel = (role: LocationRole) =>
    t(`categories.${role}.label`, {
      fallback: LOCATION_CATEGORIES[role]?.label || (role as string),
    } as any);

  // --- computed values ---

  const childrenByParent = useMemo(() => {
    const map = new Map<string, LogicalLocation[]>();
    for (const loc of allLocations) {
      if (!loc.parentId) continue;
      const children = map.get(loc.parentId) ?? [];
      children.push(loc);
      map.set(loc.parentId, children);
    }
    return map;
  }, [allLocations]);

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
    for (const loc of allLocations) {
      const scopeIds = [loc.id, ...getDescendantIds(loc.id)];
      const skuIds = new Set<string>();
      let aggregateQuantity = 0;
      for (const id of scopeIds) {
        const item = direct.get(id);
        if (!item) continue;
        aggregateQuantity += item.quantity;
        item.skuIds.forEach((skuId) => skuIds.add(skuId));
      }
      const directItem = direct.get(loc.id);
      summary.set(loc.id, {
        directQuantity: directItem?.quantity ?? 0,
        directSkus: directItem?.skuIds.size ?? 0,
        aggregateQuantity,
        aggregateSkus: skuIds.size,
      });
    }
    return summary;
  }, [getDescendantIds, inventorySnapshot.balances, allLocations]);

  const selectedInventoryScopeIds = useMemo(() => {
    const includeChildren =
      location.stockPolicy !== "stockable" && !location.capabilities?.canStoreInventory;
    return new Set([location.id, ...(includeChildren ? getDescendantIds(location.id) : [])]);
  }, [getDescendantIds, location]);

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

  const selectedSummary = locationStockSummaryById.get(location.id) ?? null;

  const selectedCanHoldStock =
    location.stockPolicy === "stockable" || location.capabilities?.canStoreInventory;

  const locationNameById = useMemo(
    () => new Map(allLocations.map((loc) => [loc.id, loc.name])),
    [allLocations]
  );

  // --- path breadcrumb ---

  const pathSegments = useMemo(() => {
    const segments: LogicalLocation[] = [];
    const byId = new Map(allLocations.map((l) => [l.id, l]));
    let cur: LogicalLocation | undefined = location;
    while (cur) {
      segments.unshift(cur);
      cur = cur.parentId ? byId.get(cur.parentId) : undefined;
    }
    return segments;
  }, [allLocations, location]);

  const handleCopyPath = () => {
    const pathString = pathSegments.map((l) => l.code).join("/");
    navigator.clipboard.writeText(pathString);
    setCopiedPath(true);
    setTimeout(() => setCopiedPath(false), 2000);
  };

  // --- child locations ---

  const childLocations = useMemo(
    () => allLocations.filter((l) => l.parentId === location.id),
    [allLocations, location.id]
  );

  return (
    <div className="flex flex-col">
      {/* HEADER */}
      <div className="shrink-0 border-b border-border bg-card px-5 py-4">
        <div className="flex items-start justify-between gap-3">
          <div>
            <div className="flex items-center gap-3">
              <h1 className="flex items-center gap-3 text-2xl font-semibold tracking-normal text-foreground">
                <IconRenderer
                  name={location.icon || LOCATION_CATEGORIES[location.role]?.iconName || "Database"}
                  className={`h-6 w-6 ${location.color || "text-primary"}`}
                />
                {location.name}
              </h1>
              <div className="mt-1 flex items-center justify-center gap-1.5 rounded border border-border bg-muted px-2 py-0.5 text-[9px] font-semibold uppercase tracking-wide text-muted-foreground">
                <IconRenderer
                  name={LOCATION_CATEGORIES[location.role]?.iconName || "Box"}
                  className={`h-3 w-3 ${location.color || "text-muted-foreground"}`}
                />
                {getCategoryLabel(location.role)}
              </div>
            </div>
            <div className="mt-2 inline-flex items-center">
              {pathSegments.map((pathLoc, i, arr) => (
                <React.Fragment key={pathLoc.id}>
                  <span
                    onClick={() => onSelectLocation?.(pathLoc.id)}
                    className={`text-[10px] font-semibold uppercase tracking-wide transition-colors ${
                      onSelectLocation ? "cursor-pointer" : ""
                    } ${
                      i === arr.length - 1
                        ? "text-primary"
                        : "text-muted-foreground hover:text-foreground/80"
                    }`}
                  >
                    {pathLoc.code}
                  </span>
                  {i < arr.length - 1 && (
                    <span className="text-[10px] font-bold text-muted-foreground">/</span>
                  )}
                </React.Fragment>
              ))}
              <button
                onClick={handleCopyPath}
                className="ml-2 rounded-md p-1 text-muted-foreground transition-colors hover:bg-muted hover:text-primary"
                title={t("actions.copyPath")}
              >
                {copiedPath ? (
                  <Check className="h-3.5 w-3.5 text-emerald-700 dark:text-emerald-300" />
                ) : (
                  <Copy className="h-3.5 w-3.5" />
                )}
              </button>
            </div>
          </div>
          {headerActions && <div className="flex items-center gap-2 shrink-0">{headerActions}</div>}
        </div>
      </div>

      {/* TABS */}
      <div className="flex shrink-0 items-center border-b border-border bg-background px-5 py-2.5">
        <div className="flex shrink-0 rounded-xl border border-border/50 bg-background/80 p-1 backdrop-blur">
          <button
            onClick={() => setActiveTab("info")}
            className={`flex items-center gap-2 rounded-lg px-5 py-2 text-[10px] font-semibold uppercase tracking-wide transition-all ${activeTab === "info" ? "bg-muted text-primary shadow-sm" : "text-muted-foreground hover:text-foreground/80"}`}
          >
            <Info className="h-3.5 w-3.5" />
            {t("tabs.information")}
          </button>
          <button
            onClick={() => setActiveTab("inventory")}
            className={`flex items-center gap-2 rounded-lg px-5 py-2 text-[10px] font-semibold uppercase tracking-wide transition-all ${activeTab === "inventory" ? "bg-muted text-emerald-400 shadow-sm" : "text-muted-foreground hover:text-foreground/80"}`}
          >
            <Package className="h-3.5 w-3.5" />
            {t("tabs.inventory")}
          </button>
          <button
            onClick={() => setActiveTab("history")}
            className={`flex items-center gap-2 rounded-lg px-5 py-2 text-[10px] font-semibold uppercase tracking-wide transition-all ${activeTab === "history" ? "bg-muted text-primary shadow-sm" : "text-muted-foreground hover:text-foreground/80"}`}
          >
            <Clock className="h-3.5 w-3.5" />
            {t("tabs.history")}
          </button>
        </div>
      </div>

      {/* TAB CONTENT */}
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
              {/* 4-section grid */}
              <div
                className={`grid gap-6 ${compact ? "grid-cols-1" : "grid-cols-1 lg:grid-cols-2"}`}
              >
                {/* Section 1: Structure & Stock Policy */}
                <section className="overflow-hidden rounded-lg border border-border bg-card/70 shadow-sm">
                  <div className="flex items-center justify-between border-b border-border bg-muted/40 px-5 py-4">
                    <span className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                      {t("detail.structureStockPolicy")}
                    </span>
                    <Fingerprint className="h-4 w-4 text-muted-foreground" />
                  </div>
                  <div className="p-6">
                    <div className="mb-5 flex items-start gap-4">
                      <div
                        className={`rounded-lg border border-border bg-muted p-4 ${LOCATION_CATEGORIES[location.role]?.color || "text-primary"}`}
                      >
                        <IconRenderer
                          name={LOCATION_CATEGORIES[location.role]?.iconName || "Database"}
                          className="h-6 w-6"
                        />
                      </div>
                      <div>
                        <h3 className="text-lg font-semibold tracking-normal text-foreground">
                          {getPhysicalKindLabel(location.physicalKind)}
                        </h3>
                        <p className="mt-1 text-xs font-medium leading-relaxed text-muted-foreground">
                          {selectedCanHoldStock
                            ? t("detail.binCanHoldStock")
                            : t("detail.aggregatesChildStock")}
                        </p>
                      </div>
                    </div>
                    <div className="mb-5 grid grid-cols-1 gap-4 sm:grid-cols-3">
                      <DetailItem
                        label={t("detail.physicalKind")}
                        value={getPhysicalKindLabel(location.physicalKind)}
                      />
                      <DetailItem
                        label={t("detail.stockPolicy")}
                        value={getStockPolicyLabel(location.stockPolicy)}
                      />
                      <DetailItem
                        label={t("detail.operationProfile")}
                        value={getOperationProfileLabel(location.operationProfile)}
                      />
                    </div>
                    <DetailItem label={t("detail.fullPathCode")} value={pathCode} isMono />
                  </div>
                </section>

                {/* Section 2: Description */}
                <section className="overflow-hidden rounded-lg border border-border bg-card/70 shadow-sm">
                  <div className="flex items-center justify-between border-b border-border bg-muted/40 px-5 py-4">
                    <span className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                      {t("detail.description")}
                    </span>
                    <Info className="h-4 w-4 text-muted-foreground" />
                  </div>
                  <div className="p-6">
                    <p className="min-h-20 text-sm leading-6 text-foreground">
                      {location.description?.trim() || t("detail.noDescription")}
                    </p>
                  </div>
                </section>

                {/* Section 3: Operational Behavior */}
                <section className="overflow-hidden rounded-lg border border-border bg-card/70 shadow-sm">
                  <div className="flex items-center justify-between border-b border-border bg-muted/40 px-5 py-4">
                    <span className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                      {t("detail.operationalBehavior")}
                    </span>
                    <Construction className="h-4 w-4 text-muted-foreground" />
                  </div>
                  <div className="p-6">
                    <p className="mb-4 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                      {t("detail.functionalCapabilities")}
                    </p>
                    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                      <BehaviorIndicator
                        label={t("capabilities.storesInventory")}
                        active={location.capabilities.canStoreInventory}
                        icon={<Database className="h-3.5 w-3.5" />}
                      />
                      <BehaviorIndicator
                        label={t("capabilities.pickable")}
                        active={location.capabilities.canPick}
                        icon={<RotateCcw className="h-3.5 w-3.5" />}
                      />
                      <BehaviorIndicator
                        label={t("capabilities.receivable")}
                        active={location.capabilities.canReceive}
                        icon={<Inbox className="h-3.5 w-3.5" />}
                      />
                      <BehaviorIndicator
                        label={t("capabilities.virtual")}
                        active={location.capabilities.isVirtual}
                        icon={<Zap className="h-3.5 w-3.5" />}
                      />
                    </div>
                  </div>
                </section>

                {/* Section 4: Physical Metadata */}
                <section className="overflow-hidden rounded-lg border border-border bg-card/70 shadow-sm">
                  <div className="flex items-center justify-between border-b border-border bg-muted/40 px-5 py-4">
                    <span className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                      {t("detail.physicalMetadata")}
                    </span>
                    <Maximize2 className="h-4 w-4 text-muted-foreground" />
                  </div>
                  <div className="p-6">
                    {location.physicalMetadata ? (
                      <div className="grid grid-cols-2 gap-x-4 gap-y-6">
                        <DetailItem
                          label={t("detail.width")}
                          value={`${location.physicalMetadata.width} mm`}
                          isMono
                        />
                        <DetailItem
                          label={t("detail.height")}
                          value={`${location.physicalMetadata.height} mm`}
                          isMono
                        />
                        <DetailItem
                          label={t("detail.depth")}
                          value={`${location.physicalMetadata.depth} mm`}
                          isMono
                        />
                        <DetailItem
                          label={t("detail.weightCapacity")}
                          value={`${location.physicalMetadata.weightCapacity} kg`}
                          isMono
                        />
                      </div>
                    ) : (
                      <div className="py-4 text-center">
                        <p className="text-[11px] font-medium italic text-muted-foreground">
                          {t("detail.noPhysicalMetadata")}
                        </p>
                      </div>
                    )}
                  </div>
                </section>
              </div>

              {/* Child Locations (read-only) */}
              <div className="relative mt-5 block w-full overflow-hidden rounded-lg border border-border bg-card">
                <div className="flex items-center justify-between border-b border-border bg-muted/40 px-8 py-5">
                  <div className="flex items-center gap-4">
                    <h3 className="flex items-center gap-3 text-sm font-semibold uppercase tracking-wide text-foreground">
                      <LayoutList className="h-4 w-4 text-primary" />
                      {t("detail.childInventoryStructure")}
                    </h3>
                    <span className="rounded-full border border-border bg-background px-3 py-1 font-mono text-[10px] font-bold text-muted-foreground">
                      {childLocations.length} {t("detail.entities")}
                    </span>
                  </div>
                </div>

                <div className="bg-card/70 p-4">
                  {childLocations.length > 0 ? (
                    <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
                      {childLocations.map((child) => (
                        <div
                          key={child.id}
                          onClick={() => onSelectLocation?.(child.id)}
                          className={`group flex items-center justify-between rounded-lg border border-border bg-muted/20 p-4 shadow-sm transition-all hover:border-primary/50 hover:bg-muted/40 ${onSelectLocation ? "cursor-pointer" : ""}`}
                        >
                          <div className="flex items-center gap-4">
                            <div
                              className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-xl border border-border bg-card ${LOCATION_CATEGORIES[child.role]?.color || "text-muted-foreground"}`}
                            >
                              <IconRenderer
                                name={
                                  child.icon || LOCATION_CATEGORIES[child.role]?.iconName || "Box"
                                }
                                className="h-6 w-6"
                              />
                            </div>
                            <div className="overflow-hidden">
                              <p className="truncate text-xs font-semibold text-foreground">
                                {child.name}
                              </p>
                              <div className="mt-0.5 flex items-center gap-2">
                                <p className="truncate text-[10px] font-mono font-bold uppercase text-primary/80">
                                  {child.code}
                                </p>
                              </div>
                              <div className="mt-1.5 flex items-center gap-3">
                                <span className="rounded border border-emerald-500/10 bg-emerald-500/5 px-1.5 py-0.5 font-mono text-[9px] text-emerald-700 dark:text-emerald-300">
                                  {t("detail.stockCount", {
                                    count:
                                      locationStockSummaryById.get(child.id)?.aggregateQuantity ??
                                      0,
                                  })}
                                </span>
                                <span className="text-[9px] font-bold uppercase tracking-wide text-muted-foreground">
                                  {getCategoryLabel(child.role)}
                                </span>
                              </div>
                            </div>
                          </div>
                          {onSelectLocation && (
                            <ChevronRight className="h-5 w-5 shrink-0 text-muted-foreground transition-colors group-hover:text-primary" />
                          )}
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="flex flex-col items-center justify-center py-20 text-center">
                      <Box className="mb-4 h-12 w-12 text-muted-foreground" />
                      <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                        {t("detail.structureEmpty")}
                      </p>
                      <p className="mt-2 text-[10px] font-medium text-muted-foreground">
                        {t("detail.noChildLocations")}
                      </p>
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
              <div className="overflow-hidden rounded-lg border border-border bg-card/70 shadow-sm">
                <div className="flex items-center justify-between border-b border-border bg-muted/40 px-5 py-4">
                  <span className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                    {t("history.recentMovements")}
                  </span>
                  <Clock className="h-4 w-4 text-muted-foreground" />
                </div>
                <MovementHistoryList movements={selectedMovementLines} t={t} />
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
