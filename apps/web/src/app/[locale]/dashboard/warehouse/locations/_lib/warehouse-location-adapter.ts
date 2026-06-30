import type { WarehouseLocation } from "@/lib/warehouse/location-tree";
import type { CreateLocationInput, UpdateLocationInput } from "@/app/actions/warehouse/schemas";

import {
  OPERATION_PROFILES,
  PHYSICAL_LOCATION_KINDS,
} from "../_ambra/constants/locationCategories";
import {
  LocationRole,
  type Branch,
  type LocationOperationProfile,
  type LocationStockPolicy,
  type LogicalLocation,
  type PhysicalLocationKind,
} from "../_ambra/types";

const STORAGE_MODE_PHYSICAL_KIND: Record<string, PhysicalLocationKind> = {
  standard: "bin",
  storage: "bin",
  warehouse: "warehouse",
  zone: "zone",
  aisle: "aisle",
  rack: "rack",
  shelf: "shelf",
  bin: "bin",
  receiving: "bin",
  shipping: "bin",
  staging: "bin",
  returns: "bin",
  quarantine: "bin",
  transit: "bin",
  adjustment: "bin",
  virtual: "zone",
};

const STORAGE_MODE_OPERATION_PROFILE: Record<string, LocationOperationProfile> = {
  receiving: "receiving",
  shipping: "shipping",
  staging: "staging",
  returns: "returns",
  quarantine: "quarantine",
  transit: "transit",
};

const PHYSICAL_KIND_ROLE: Record<PhysicalLocationKind, LocationRole> = {
  warehouse: LocationRole.WAREHOUSE,
  zone: LocationRole.ZONE,
  aisle: LocationRole.AISLE,
  rack: LocationRole.RACK,
  shelf: LocationRole.SHELF,
  bin: LocationRole.BIN,
};

const TAILWIND_COLOR_TO_HEX: Record<string, string> = {
  "text-primary": "#38BDF8",
  "text-emerald-400": "#34D399",
  "text-emerald-500": "#10B981",
  "text-emerald-700 dark:text-emerald-300": "#10B981",
  "text-blue-400": "#60A5FA",
  "text-blue-500": "#3B82F6",
  "text-indigo-400": "#818CF8",
  "text-purple-400": "#C084FC",
  "text-red-500": "#EF4444",
  "text-amber-400": "#FBBF24",
  "text-amber-500": "#F59E0B",
  "text-lime-400": "#A3E635",
  "text-cyan-400": "#22D3EE",
  "text-fuchsia-400": "#E879F9",
  "text-muted-foreground": "#94A3B8",
};

function resolvePhysicalKind(location: WarehouseLocation): PhysicalLocationKind {
  const storageMode = location.storage_mode?.toLowerCase();
  if (storageMode && STORAGE_MODE_PHYSICAL_KIND[storageMode]) {
    return STORAGE_MODE_PHYSICAL_KIND[storageMode];
  }
  if (location.map_role === "layout_root") return "warehouse";
  if (location.parent_id === null) return "warehouse";
  return location.can_store_inventory ? "bin" : "zone";
}

function resolveOperationProfile(location: WarehouseLocation): LocationOperationProfile {
  const storageMode = location.storage_mode?.toLowerCase();
  if (storageMode && STORAGE_MODE_OPERATION_PROFILE[storageMode]) {
    return STORAGE_MODE_OPERATION_PROFILE[storageMode];
  }
  return "standard";
}

function resolveStockPolicy(location: WarehouseLocation): LocationStockPolicy {
  return location.can_store_inventory ? "stockable" : "none";
}

function metersToCentimeters(value: number | null | undefined) {
  return value ? Math.round(value * 100) : 0;
}

function centimetersToMeters(value: number | null | undefined) {
  return value && value > 0 ? value / 100 : null;
}

function normalizeLocationCode(value: string | null | undefined) {
  const cleaned = value
    ?.trim()
    .replace(/[^A-Za-z0-9_/-]/g, "-")
    .slice(0, 20);
  return cleaned || null;
}

function normalizeParentId(value: string | null | undefined) {
  if (!value || value === "ROOT" || value === "ROOT-SYS") return null;
  return value;
}

function normalizeColor(value: string | null | undefined) {
  if (!value) return null;
  if (/^#[0-9A-Fa-f]{6}$/.test(value)) return value;
  return TAILWIND_COLOR_TO_HEX[value] ?? null;
}

function buildPath(location: WarehouseLocation, byId: Map<string, WarehouseLocation>) {
  const path: WarehouseLocation[] = [];
  const visited = new Set<string>();
  let current: WarehouseLocation | undefined = location;

  while (current && !visited.has(current.id)) {
    visited.add(current.id);
    path.unshift(current);
    current = current.parent_id ? byId.get(current.parent_id) : undefined;
  }

  return path;
}

export function createAmbraBranch(
  id: string | null | undefined,
  name: string | null | undefined
): Branch {
  return {
    id: id ?? "ambra-demo-branch",
    name: name ?? "Main Logistics Center",
  };
}

export function warehouseLocationsToAmbra(locations: WarehouseLocation[]): LogicalLocation[] {
  const byId = new Map(locations.map((location) => [location.id, location]));

  return locations.map((location) => {
    const physicalKind = resolvePhysicalKind(location);
    const operationProfile = resolveOperationProfile(location);
    const stockPolicy = resolveStockPolicy(location);
    const role = PHYSICAL_KIND_ROLE[physicalKind];
    const physicalDefinition = PHYSICAL_LOCATION_KINDS[physicalKind];
    const operationDefinition = OPERATION_PROFILES[operationProfile];
    const path = buildPath(location, byId);
    const canStoreInventory = stockPolicy === "stockable";

    return {
      id: location.id,
      branchId: location.branch_id,
      parentId: location.parent_id,
      code: location.code || location.name || location.id.slice(0, 8),
      name: location.name,
      description: location.description ?? "",
      pathCode: path.map((item) => item.code || item.name).join("/"),
      pathName: path.map((item) => item.name).join(" / "),
      status: "active",
      role,
      physicalKind,
      stockPolicy,
      operationProfile,
      capabilities: {
        canStoreInventory,
        canReceive: canStoreInventory,
        canPick: canStoreInventory,
        canShip: operationProfile === "shipping",
        canReserve: canStoreInventory,
        isVirtual: false,
        isTemporary: false,
      },
      icon: location.icon_name ?? physicalDefinition.iconName,
      color: operationProfile === "standard" ? physicalDefinition.color : operationDefinition.color,
      sortOrder: location.sort_order,
      physical: {
        qrCode: location.qr_code,
      },
      physicalMetadata: {
        width: metersToCentimeters(location.physical_width_m),
        height: metersToCentimeters(location.physical_height_m),
        depth: metersToCentimeters(location.physical_depth_m),
        weightCapacity: 0,
      },
      assignment: {
        allowedCategories: [],
      },
      stockCount: 0,
      skuCount: 0,
      warnings: [],
      createdAt: location.created_at,
      updatedAt: location.updated_at,
      deletedAt: location.deleted_at ?? undefined,
    };
  });
}

export function ambraLocationToCreateInput(location: LogicalLocation): CreateLocationInput {
  const physicalKind = location.physicalKind ?? "bin";
  const stockPolicy =
    location.stockPolicy ?? PHYSICAL_LOCATION_KINDS[physicalKind]?.defaultStockPolicy ?? "none";
  const physicalDefinition = PHYSICAL_LOCATION_KINDS[physicalKind] ?? PHYSICAL_LOCATION_KINDS.bin;
  const operationProfile = location.operationProfile ?? "standard";

  return {
    name: location.name.trim(),
    code: normalizeLocationCode(location.code),
    description: location.description?.trim() || null,
    parent_id: normalizeParentId(location.parentId),
    icon_name: location.icon || physicalDefinition.iconName,
    color: normalizeColor(location.color ?? physicalDefinition.color),
    storage_mode: physicalKind,
    allow_top_storage: stockPolicy === "stockable",
    can_store_inventory: stockPolicy === "stockable",
    map_role: physicalKind === "warehouse" ? "layout_root" : "logical",
    physical_width_m: centimetersToMeters(location.physicalMetadata?.width),
    physical_height_m: centimetersToMeters(location.physicalMetadata?.height),
    physical_depth_m: centimetersToMeters(location.physicalMetadata?.depth),
    sort_order: location.sortOrder,
  };
}

export function ambraLocationToUpdateInput(
  location: Partial<LogicalLocation> & { id: string }
): UpdateLocationInput & { id: string } {
  const physicalKind = location.physicalKind;
  const physicalDefinition = physicalKind ? PHYSICAL_LOCATION_KINDS[physicalKind] : null;

  return {
    id: location.id,
    ...(location.name !== undefined ? { name: location.name.trim() } : {}),
    ...(location.code !== undefined ? { code: normalizeLocationCode(location.code) } : {}),
    ...(location.description !== undefined
      ? { description: location.description?.trim() || null }
      : {}),
    ...(location.parentId !== undefined ? { parent_id: normalizeParentId(location.parentId) } : {}),
    ...(location.icon !== undefined
      ? { icon_name: location.icon || physicalDefinition?.iconName || null }
      : {}),
    ...(location.color !== undefined ? { color: normalizeColor(location.color) } : {}),
    ...(physicalKind ? { storage_mode: physicalKind } : {}),
    ...(location.stockPolicy !== undefined
      ? { allow_top_storage: location.stockPolicy === "stockable" }
      : {}),
    ...(location.stockPolicy !== undefined
      ? { can_store_inventory: location.stockPolicy === "stockable" }
      : {}),
    ...(physicalKind ? { map_role: physicalKind === "warehouse" ? "layout_root" : "logical" } : {}),
    ...(location.physicalMetadata?.width !== undefined
      ? { physical_width_m: centimetersToMeters(location.physicalMetadata.width) }
      : {}),
    ...(location.physicalMetadata?.height !== undefined
      ? { physical_height_m: centimetersToMeters(location.physicalMetadata.height) }
      : {}),
    ...(location.physicalMetadata?.depth !== undefined
      ? { physical_depth_m: centimetersToMeters(location.physicalMetadata.depth) }
      : {}),
    ...(location.sortOrder !== undefined ? { sort_order: location.sortOrder } : {}),
  };
}
