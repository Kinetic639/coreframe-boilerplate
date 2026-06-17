import type { WarehouseLocation } from "@/lib/warehouse/location-tree";
import type { CreateLocationInput, UpdateLocationInput } from "@/app/actions/warehouse/schemas";

import { LOCATION_CATEGORIES } from "../_ambra/constants/locationCategories";
import { LocationRole, type Branch, type LogicalLocation } from "../_ambra/types";

const STORAGE_MODE_ROLE: Record<string, LocationRole> = {
  warehouse: LocationRole.WAREHOUSE,
  zone: LocationRole.ZONE,
  aisle: LocationRole.AISLE,
  rack: LocationRole.RACK,
  shelf: LocationRole.SHELF,
  bin: LocationRole.BIN,
  receiving: LocationRole.RECEIVING,
  shipping: LocationRole.SHIPPING,
  staging: LocationRole.STAGING,
  returns: LocationRole.RETURNS,
  quarantine: LocationRole.QUARANTINE,
  transit: LocationRole.TRANSIT,
  adjustment: LocationRole.ADJUSTMENT,
  virtual: LocationRole.VIRTUAL,
  storage: LocationRole.STORAGE,
  standard: LocationRole.STORAGE,
};

const ROLE_STORAGE_MODE: Record<LocationRole, string> = {
  [LocationRole.WAREHOUSE]: "warehouse",
  [LocationRole.ZONE]: "zone",
  [LocationRole.AISLE]: "aisle",
  [LocationRole.RACK]: "rack",
  [LocationRole.SHELF]: "shelf",
  [LocationRole.BIN]: "bin",
  [LocationRole.STAGING]: "staging",
  [LocationRole.RECEIVING]: "receiving",
  [LocationRole.SHIPPING]: "shipping",
  [LocationRole.RETURNS]: "returns",
  [LocationRole.QUARANTINE]: "quarantine",
  [LocationRole.TRANSIT]: "transit",
  [LocationRole.ADJUSTMENT]: "adjustment",
  [LocationRole.VIRTUAL]: "virtual",
  [LocationRole.STORAGE]: "storage",
  [LocationRole.OTHER]: "storage",
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

function resolveRole(location: WarehouseLocation) {
  const storageMode = location.storage_mode?.toLowerCase();
  if (storageMode && STORAGE_MODE_ROLE[storageMode]) return STORAGE_MODE_ROLE[storageMode];
  if (location.map_role === "layout_root") return LocationRole.WAREHOUSE;
  if (location.parent_id === null) return LocationRole.WAREHOUSE;
  return LocationRole.STORAGE;
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
    const role = resolveRole(location);
    const category = LOCATION_CATEGORIES[role] ?? LOCATION_CATEGORIES[LocationRole.STORAGE];
    const path = buildPath(location, byId);

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
      capabilities: {
        canStoreInventory: category.defaults.canStoreInventory ?? true,
        canReceive: category.defaults.canReceive ?? true,
        canPick: category.defaults.canPick ?? true,
        canShip: category.defaults.canShip ?? false,
        canReserve: category.defaults.canReserve ?? true,
        isVirtual: category.defaults.isVirtual ?? false,
        isTemporary: false,
      },
      icon: location.icon_name ?? category.iconName,
      color: category.color,
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
  const role = location.role ?? LocationRole.STORAGE;
  const category = LOCATION_CATEGORIES[role] ?? LOCATION_CATEGORIES[LocationRole.STORAGE];

  return {
    name: location.name.trim(),
    code: normalizeLocationCode(location.code),
    description: location.description?.trim() || null,
    parent_id: normalizeParentId(location.parentId),
    icon_name: location.icon || category.iconName,
    color: normalizeColor(location.color ?? category.color),
    storage_mode: ROLE_STORAGE_MODE[role],
    map_role: role === LocationRole.WAREHOUSE ? "layout_root" : "logical",
    physical_width_m: centimetersToMeters(location.physicalMetadata?.width),
    physical_height_m: centimetersToMeters(location.physicalMetadata?.height),
    physical_depth_m: centimetersToMeters(location.physicalMetadata?.depth),
    sort_order: location.sortOrder,
  };
}

export function ambraLocationToUpdateInput(
  location: Partial<LogicalLocation> & { id: string }
): UpdateLocationInput & { id: string } {
  const role = location.role;
  const category = role ? LOCATION_CATEGORIES[role] : null;

  return {
    id: location.id,
    ...(location.name !== undefined ? { name: location.name.trim() } : {}),
    ...(location.code !== undefined ? { code: normalizeLocationCode(location.code) } : {}),
    ...(location.description !== undefined
      ? { description: location.description?.trim() || null }
      : {}),
    ...(location.parentId !== undefined ? { parent_id: normalizeParentId(location.parentId) } : {}),
    ...(location.icon !== undefined
      ? { icon_name: location.icon || category?.iconName || null }
      : {}),
    ...(location.color !== undefined ? { color: normalizeColor(location.color) } : {}),
    ...(role ? { storage_mode: ROLE_STORAGE_MODE[role] } : {}),
    ...(role ? { map_role: role === LocationRole.WAREHOUSE ? "layout_root" : "logical" } : {}),
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
