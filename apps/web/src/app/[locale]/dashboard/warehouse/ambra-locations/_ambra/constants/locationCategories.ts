import { LocationRole } from "../types";

export type LocationCategoryDefinition = {
  id: LocationRole;
  label: string;
  description: string;
  iconName: string;
  color?: string;
  defaults: {
    canStoreInventory?: boolean;
    canPick?: boolean;
    canReceive?: boolean;
    isVirtual?: boolean;
    canShip?: boolean;
    canReserve?: boolean;
  };
};

export const LOCATION_CATEGORIES: Record<LocationRole, LocationCategoryDefinition> = {
  [LocationRole.STORAGE]: {
    id: LocationRole.STORAGE,
    label: "Storage",
    description: "Standard stock storage location",
    iconName: "Database",
    color: "text-primary",
    defaults: {
      canStoreInventory: true,
      canPick: true,
      canReceive: true,
      isVirtual: false,
      canReserve: true,
    },
  },
  [LocationRole.RECEIVING]: {
    id: LocationRole.RECEIVING,
    label: "Receiving",
    description: "Inbound staging area",
    iconName: "Inbox",
    color: "text-emerald-700 dark:text-emerald-300",
    defaults: {
      canStoreInventory: true,
      canPick: false,
      canReceive: true,
      isVirtual: false,
      canReserve: false,
    },
  },
  [LocationRole.SHIPPING]: {
    id: LocationRole.SHIPPING,
    label: "Shipping",
    description: "Outbound staging area",
    iconName: "Truck",
    color: "text-blue-500",
    defaults: {
      canStoreInventory: true,
      canPick: true,
      canReceive: false,
      isVirtual: false,
      canShip: true,
    },
  },
  [LocationRole.STAGING]: {
    id: LocationRole.STAGING,
    label: "Staging",
    description: "Temporary location for cross-docking or prep",
    iconName: "Flag",
    color: "text-lime-400",
    defaults: { canStoreInventory: true, canPick: true, canReceive: true, isVirtual: false },
  },
  [LocationRole.RETURNS]: {
    id: LocationRole.RETURNS,
    label: "Returns",
    description: "Area for returned goods processing",
    iconName: "RotateCcw",
    color: "text-purple-400",
    defaults: { canStoreInventory: true, canPick: false, canReceive: true, isVirtual: false },
  },
  [LocationRole.QUARANTINE]: {
    id: LocationRole.QUARANTINE,
    label: "Quarantine",
    description: "Restricted area for non-conforming goods",
    iconName: "ShieldAlert",
    color: "text-red-500",
    defaults: { canStoreInventory: true, canPick: false, canReceive: false, isVirtual: false },
  },
  [LocationRole.TRANSIT]: {
    id: LocationRole.TRANSIT,
    label: "Transit",
    description: "In-motion or transport location",
    iconName: "Car",
    color: "text-amber-500",
    defaults: { canStoreInventory: true, canPick: true, canReceive: true, isVirtual: false },
  },
  [LocationRole.ADJUSTMENT]: {
    id: LocationRole.ADJUSTMENT,
    label: "Adjustment",
    description: "Correction or inventory adjustment point",
    iconName: "CheckSquare",
    color: "text-cyan-400",
    defaults: { canStoreInventory: true, canPick: false, canReceive: false, isVirtual: true },
  },
  [LocationRole.VIRTUAL]: {
    id: LocationRole.VIRTUAL,
    label: "Virtual",
    description: "Logical organizational point",
    iconName: "Zap",
    color: "text-fuchsia-400",
    defaults: { canStoreInventory: false, canPick: false, canReceive: false, isVirtual: true },
  },
  [LocationRole.BIN]: {
    id: LocationRole.BIN,
    label: "Bin",
    description: "Specific storage container or bin",
    iconName: "Box",
    color: "text-amber-400",
    defaults: { canStoreInventory: true, canPick: true, canReceive: true, isVirtual: false },
  },
  [LocationRole.SHELF]: {
    id: LocationRole.SHELF,
    label: "Shelf",
    description: "Horizontal storage level",
    iconName: "Layout",
    color: "text-emerald-400",
    defaults: { canStoreInventory: true, canPick: true, canReceive: true, isVirtual: false },
  },
  [LocationRole.RACK]: {
    id: LocationRole.RACK,
    label: "Rack",
    description: "Vertical storage structure",
    iconName: "Server",
    color: "text-blue-400",
    defaults: { canStoreInventory: false, canPick: false, canReceive: false, isVirtual: false },
  },
  [LocationRole.AISLE]: {
    id: LocationRole.AISLE,
    label: "Aisle",
    description: "Warehouse passageway",
    iconName: "ArrowRightLeft",
    color: "text-muted-foreground",
    defaults: { canStoreInventory: false, canPick: false, canReceive: false, isVirtual: false },
  },
  [LocationRole.ZONE]: {
    id: LocationRole.ZONE,
    label: "Zone",
    description: "Storage area or zone",
    iconName: "Layers",
    color: "text-indigo-400",
    defaults: { canStoreInventory: false, canPick: false, canReceive: false, isVirtual: false },
  },
  [LocationRole.WAREHOUSE]: {
    id: LocationRole.WAREHOUSE,
    label: "Warehouse",
    description: "Primary facility root",
    iconName: "Database",
    color: "text-primary",
    defaults: { canStoreInventory: false, canPick: false, canReceive: false, isVirtual: false },
  },
  [LocationRole.OTHER]: {
    id: LocationRole.OTHER,
    label: "Other",
    description: "General purpose location",
    iconName: "Box",
    color: "text-muted-foreground",
    defaults: { canStoreInventory: true, canPick: true, canReceive: true, isVirtual: false },
  },
};
