import {
  LocationRole,
  type LocationOperationProfile,
  type LocationStockPolicy,
  type PhysicalLocationKind,
} from "../types";

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

export type PhysicalLocationDefinition = {
  id: PhysicalLocationKind;
  label: string;
  description: string;
  iconName: string;
  color?: string;
  defaultStockPolicy: LocationStockPolicy;
};

export type OperationProfileDefinition = {
  id: LocationOperationProfile;
  label: string;
  description: string;
  iconName: string;
  color?: string;
};

export const PHYSICAL_LOCATION_KINDS: Record<PhysicalLocationKind, PhysicalLocationDefinition> = {
  warehouse: {
    id: "warehouse",
    label: "Warehouse",
    description: "Branch warehouse root. Organizes stock areas but does not hold stock directly.",
    iconName: "Database",
    color: "text-primary",
    defaultStockPolicy: "none",
  },
  zone: {
    id: "zone",
    label: "Zone",
    description: "Large internal warehouse area used to group aisles, racks, or bins.",
    iconName: "Layers",
    color: "text-indigo-400",
    defaultStockPolicy: "none",
  },
  aisle: {
    id: "aisle",
    label: "Aisle",
    description: "Warehouse passageway or row used for navigation.",
    iconName: "ArrowRightLeft",
    color: "text-muted-foreground",
    defaultStockPolicy: "none",
  },
  rack: {
    id: "rack",
    label: "Rack",
    description: "Vertical storage structure containing shelves or bins.",
    iconName: "Server",
    color: "text-blue-400",
    defaultStockPolicy: "none",
  },
  shelf: {
    id: "shelf",
    label: "Shelf",
    description: "Physical shelf or level. Organizes bins and can aggregate their stock.",
    iconName: "Layout",
    color: "text-emerald-400",
    defaultStockPolicy: "none",
  },
  bin: {
    id: "bin",
    label: "Bin",
    description: "Stock-holding storage point where inventory balances are recorded.",
    iconName: "Box",
    color: "text-amber-400",
    defaultStockPolicy: "stockable",
  },
};

export const OPERATION_PROFILES: Record<LocationOperationProfile, OperationProfileDefinition> = {
  standard: {
    id: "standard",
    label: "Standard",
    description: "General-purpose internal storage behavior.",
    iconName: "Box",
    color: "text-muted-foreground",
  },
  receiving: {
    id: "receiving",
    label: "Receiving",
    description: "Inbound staging or receiving workflow hint.",
    iconName: "Inbox",
    color: "text-emerald-700 dark:text-emerald-300",
  },
  shipping: {
    id: "shipping",
    label: "Shipping",
    description: "Outbound staging or dispatch workflow hint.",
    iconName: "Truck",
    color: "text-blue-500",
  },
  returns: {
    id: "returns",
    label: "Returns",
    description: "Returned goods processing workflow hint.",
    iconName: "RotateCcw",
    color: "text-purple-400",
  },
  quarantine: {
    id: "quarantine",
    label: "Quarantine",
    description: "Restricted or non-conforming stock workflow hint.",
    iconName: "ShieldAlert",
    color: "text-red-500",
  },
  staging: {
    id: "staging",
    label: "Staging",
    description: "Temporary staging, prep, or cross-docking workflow hint.",
    iconName: "Flag",
    color: "text-lime-400",
  },
  transit: {
    id: "transit",
    label: "Transit",
    description: "In-motion or transport workflow hint inside the branch.",
    iconName: "Car",
    color: "text-amber-500",
  },
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
