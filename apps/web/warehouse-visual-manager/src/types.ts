export type LocationType = "warehouse" | "storage" | "obstacle";

export interface Geometry {
  x: number; // meters
  y: number; // meters
  width: number; // meters
  height: number; // meters
  rotation: number;
}

export interface LocationNode {
  id: string;
  parentId: string | null;
  rootLocationId: string;
  name: string;
  slug: string;
  fullPath: string;
  type: LocationType;
  description?: string;
  level: number;
  sortOrder: number;
  geometry?: Geometry;
  divisionMode?: "horizontal" | "vertical" | null;
  divisionCount?: number | null;
  deletedAt?: number;
  createdAt: number;
  updatedAt: number;
}

export interface GridConfig {
  show: boolean;
  interval: number; // meters
}

export interface AppState {
  locations: LocationNode[];
  selectedLocationId: string | null;
  hoveredLocationId: string | null;
  zoom: number;
  pan: { x: number; y: number };
}

export const METER_TO_PIXEL = 20;
