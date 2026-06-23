/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export enum LocationType {
  WAREHOUSE = "warehouse",
  ZONE = "zone",
  AISLE = "aisle",
  RACK = "rack",
  SHELF = "shelf",
  BIN = "bin",
  DRAWER = "drawer",
  PALLET_POSITION = "pallet_position",
  WORKBENCH = "workbench",
  RECEIVING = "receiving",
  SHIPPING = "shipping",
  RETURNS = "returns",
  QC = "qc",
  QUARANTINE = "quarantine",
  VIRTUAL = "virtual",
  VEHICLE = "vehicle",
  STAGING_AREA = "staging_area",
  OFFICE_STORAGE = "office_storage",
  BULK_STORAGE = "bulk_storage",
  OTHER = "other",
  POSITION = "position",
}

export enum MappingStatus {
  UNMAPPED = "unmapped",
  MAPPED = "mapped",
  PARTIAL = "partially_mapped",
}

export enum ViewMode {
  TOP_DOWN = "top-down",
  FRONT = "front",
}

export enum VisualNodeRole {
  LOCATION_REPRESENTATION = "location_representation",
  UNASSIGNED_STORAGE = "unassigned_storage",
  INFRASTRUCTURE = "infrastructure",
  ANNOTATION = "annotation",
  OBSTACLE = "obstacle",
}

export interface Dimensions {
  width: number;
  height: number;
  depth: number;
}

export interface PhysicalMetadata {
  width?: number; // cm
  height?: number; // cm
  depth?: number; // cm
  weightCapacity?: number; // kg
}

export interface LocationAssignment {
  defaultSKU?: string;
  allowedCategories?: string[];
  preferredItems?: string[];
}

export interface LocationWarning {
  id: string;
  severity: "info" | "warning" | "critical";
  code: string;
  title: string;
  description?: string;
}

export enum LocationRole {
  WAREHOUSE = "WAREHOUSE",
  ZONE = "ZONE",
  AISLE = "AISLE",
  RACK = "RACK",
  SHELF = "SHELF",
  BIN = "BIN",
  STAGING = "STAGING",
  RECEIVING = "RECEIVING",
  SHIPPING = "SHIPPING",
  RETURNS = "RETURNS",
  QUARANTINE = "QUARANTINE",
  TRANSIT = "TRANSIT",
  ADJUSTMENT = "ADJUSTMENT",
  VIRTUAL = "VIRTUAL",
  STORAGE = "STORAGE",
  OTHER = "OTHER",
}

export type PhysicalLocationKind = "warehouse" | "zone" | "aisle" | "rack" | "shelf" | "bin";

export type LocationStockPolicy = "none" | "stockable";

export type LocationOperationProfile =
  | "standard"
  | "receiving"
  | "shipping"
  | "returns"
  | "quarantine"
  | "staging"
  | "transit";

export interface LocationCapabilities {
  canStoreInventory: boolean;
  canReceive: boolean;
  canPick: boolean;
  canShip: boolean;
  canReserve: boolean;
  isVirtual: boolean;
  isTemporary: boolean;
}

export interface LogicalLocation {
  id: string;
  branchId?: string;
  parentId: string | null;
  code: string;
  name: string;
  description?: string;
  pathCode?: string;
  pathName?: string;
  status?: "active" | "inactive" | "archived" | "locked";
  role?: LocationRole;
  physicalKind?: PhysicalLocationKind;
  stockPolicy?: LocationStockPolicy;
  operationProfile?: LocationOperationProfile;
  capabilities?: LocationCapabilities;
  physical?: {
    qrCode?: string;
    notes?: string;
  };
  // UI and legacy fields
  icon?: string;
  color?: string;
  isVirtual?: boolean;
  sortOrder?: number;
  physicalMetadata?: PhysicalMetadata;
  assignment?: LocationAssignment;
  stockCount?: number;
  skuCount?: number;
  aggregatedStockCount?: number;
  aggregatedSkuCount?: number;
  warnings?: LocationWarning[];
  createdAt?: string;
  updatedAt?: string;
  deletedAt?: string;
  // Extra fields for rich locations
  locationCategory?: LocationType;
  canStoreInventory?: boolean;
  isReceivable?: boolean;
  isPickable?: boolean;
}

export interface LocationInventoryLine {
  id: string;
  locationId: string;
  variantId: string;
  sku: string;
  productName: string;
  unitCode: string;
  onHandQuantity: number;
  availableQuantity: number;
  reservedQuantity: number;
  allocatedQuantity: number;
  lastMovementNumber?: string | null;
  containerId?: string | null;
  containerCode?: string | null;
}

export interface LocationMovementLine {
  id: string;
  movementId: string;
  movementNumber: string;
  movementKind: "receipt" | "issue" | "transfer" | "adjustment" | "opening_balance" | string;
  status: string;
  variantId: string;
  sku: string;
  productName: string;
  unitCode: string;
  quantity: number;
  sourceLocationId: string | null;
  sourceLocationName: string | null;
  destinationLocationId: string | null;
  destinationLocationName: string | null;
  containerId?: string | null;
  containerCode?: string | null;
  createdAt: string;
  postedAt: string | null;
}

export interface ContainerLine {
  id: string;
  containerId: string;
  variantId: string;
  unitId: string;
  quantity: number;
  sku: string;
  productName: string;
  unitCode: string;
}

export interface LocationContainer {
  id: string;
  code: string;
  type: string;
  status: string;
  currentLocationId: string;
  currentLocationName?: string | null;
  referenceType?: string | null;
  referenceId?: string | null;
  lines: ContainerLine[];
  createdAt: string;
  updatedAt: string;
}

export interface LocationPutawayRule {
  id: string;
  branchId: string;
  productId?: string | null;
  variantId?: string | null;
  productCategory?: string | null;
  destinationLocationId: string;
  priority: number;
  isActive: boolean;
}

export type AmbraLocationInventorySnapshot = {
  balances: LocationInventoryLine[];
  movements: LocationMovementLine[];
  containers: LocationContainer[];
  putawayRules: LocationPutawayRule[];
};

export interface LayoutSplitDivider {
  id: string;
  type: "solid" | "gap" | "frame";
  thickness: number; // cm
  color?: string;
  opacity?: number;
  material?: "wood" | "metal" | "plastic" | "empty" | "custom";
  lineStyle?: "solid" | "dashed" | "dotted";
  locked?: boolean;
  label?: string;
}

export interface StructureNode {
  id: string;
  type: "container" | "cell";
  split?: "horizontal" | "vertical"; // split direction for containers
  splitType?: "rows" | "columns" | "shelves" | "bins" | "drawers" | "positions";
  size: number; // relative weight/ratio
  children?: StructureNode[];
  locationId?: string | null;
  label?: string; // Full structural name
  displayLabel?: string; // Short code (R1, K05, etc)
  color?: string;
  skin?: string;
  locked?: boolean;
  dividers?: (LayoutSplitDivider | null)[]; // N-1 dividers between N children
  frame?: {
    top?: LayoutSplitDivider;
    bottom?: LayoutSplitDivider;
    left?: LayoutSplitDivider;
    right?: LayoutSplitDivider;
  };
  style?: VisualNodeStyle;
}

export type ZonePattern =
  | "solid"
  | "stripes-thin"
  | "stripes-wide"
  | "dots"
  | "grid"
  | "diagonal-thin"
  | "diagonal-wide";
export type ZoneType =
  | "no_access"
  | "elevator"
  | "stairs"
  | "operational"
  | "storage"
  | "infrastructure"
  | "quarantine";

export interface VisualNodeStyle {
  cornerRadiusTopLeft?: number;
  cornerRadiusTopRight?: number;
  cornerRadiusBottomRight?: number;
  cornerRadiusBottomLeft?: number;
  isCornerRadiusLocked?: boolean;
  fill?: string;
  variant?: string;
}

export interface VisualNodePreview {
  visibleInPreview?: boolean;
  selectableInPreview?: boolean;
  visibleInPreviewTree?: boolean;
}

export interface VisualNode {
  id: string;
  layoutId: string;
  locationId: string | null; // Link to LogicalLocation
  type?: "rectangle" | "circle" | "industrial" | "zone";
  label: string;
  x?: number; // cm
  y?: number; // cm
  z?: number; // cm
  rotation?: number;
  width?: number; // cm
  height?: number; // cm
  depth?: number; // cm
  color?: string;
  viewMode?: ViewMode;
  parentId?: string | null; // For nested visuals like bins in a cabinet
  supportsFrontView?: boolean;
  frontSetupDone?: boolean;
  frontSide?: "top" | "bottom" | "left" | "right";
  front?: { isConfigured: boolean; splitTreeId?: string };
  structure?: StructureNode;
  style?: VisualNodeStyle;
  supportsInteriorView?: boolean;
  zonePattern?: ZonePattern;
  secondaryColor?: string;
  primaryOpacity?: number;
  secondaryOpacity?: number;
  blockPlacement?: boolean;
  zoneType?: ZoneType;
  opacity?: number;
  locked?: boolean;
  nodeRole?: VisualNodeRole;
  preview?: VisualNodePreview;
  // Legacy / rich layout fields
  visualizationType?: string;
  xMm?: number;
  yMm?: number;
  zMm?: number;
  rotationDeg?: number;
  widthMm?: number;
  heightMm?: number;
  depthMm?: number;
  viewType?: ViewType;
  parentVisualNodeId?: string | null;
}

export interface Layout {
  id: string;
  branchId: string;
  rootLocationId?: string | null;
  name: string;
  status: "draft" | "published";
  lastEdited: string;
  thumbnail?: string;
}

export interface Branch {
  id: string;
  name: string;
}

export enum ViewType {
  FRONT = "front",
  TOP_DOWN = "top-down",
}

export interface SplitTreeEntry {
  id: string;
  layoutId: string;
  parentVisualNodeId: string;
  viewType: ViewType;
  root: any;
}

export interface PreviewPayload {
  layout: Layout;
  locations: LogicalLocation[];
  visualNodes: VisualNode[];
  splitTrees: SplitTreeEntry[];
}
