import { Tables } from "@/lib/types";

export const mockLocations: Tables<"locations">[] = [
  // Level 0 - Root locations
  {
    id: "1",
    name: "Magazyn Główny",
    code: "MG-001",
    description: "Główny magazyn firmy",
    level: 0,
    parent_id: null,
    sort_order: 1,
    color: "#3b82f6",
    icon_name: "Warehouse",
    image_url:
      "https://images.pexels.com/photos/4481259/pexels-photo-4481259.jpeg?auto=compress&cs=tinysrgb&w=400",
    branch_id: "550e8400-e29b-41d4-a716-446655440001",
    organization_id: "550e8400-e29b-41d4-a716-446655440002",
    created_at: "2024-01-01T00:00:00.000Z",
    updated_at: "2024-01-01T00:00:00.000Z",
    deleted_at: null,
  },
  {
    id: "2",
    name: "Magazyn Pomocniczy",
    code: "MP-001",
    description: "Magazyn pomocniczy dla nadwyżek",
    level: 0,
    parent_id: null,
    sort_order: 2,
    color: "#10b981",
    icon_name: "Building",
    image_url:
      "https://images.pexels.com/photos/4481942/pexels-photo-4481942.jpeg?auto=compress&cs=tinysrgb&w=400",
    branch_id: "550e8400-e29b-41d4-a716-446655440001",
    organization_id: "550e8400-e29b-41d4-a716-446655440002",
    created_at: "2024-01-01T00:00:00.000Z",
    updated_at: "2024-01-01T00:00:00.000Z",
    deleted_at: null,
  },

  // Level 1 - Sections in main warehouse
  {
    id: "3",
    name: "Sekcja A",
    code: "MG-A",
    description: "Sekcja A - Lakiery i farby",
    level: 1,
    parent_id: "1",
    sort_order: 1,
    color: "#f59e0b",
    icon_name: "Grid3X3",
    image_url:
      "https://images.pexels.com/photos/4481942/pexels-photo-4481942.jpeg?auto=compress&cs=tinysrgb&w=400",
    branch_id: "550e8400-e29b-41d4-a716-446655440001",
    organization_id: "550e8400-e29b-41d4-a716-446655440002",
    created_at: "2024-01-01T00:00:00.000Z",
    updated_at: "2024-01-01T00:00:00.000Z",
    deleted_at: null,
  },
  {
    id: "4",
    name: "Sekcja B",
    code: "MG-B",
    description: "Sekcja B - Narzędzia",
    level: 1,
    parent_id: "1",
    sort_order: 2,
    color: "#8b5cf6",
    icon_name: "Grid3X3",
    image_url:
      "https://images.pexels.com/photos/4481942/pexels-photo-4481942.jpeg?auto=compress&cs=tinysrgb&w=400",
    branch_id: "550e8400-e29b-41d4-a716-446655440001",
    organization_id: "550e8400-e29b-41d4-a716-446655440002",
    created_at: "2024-01-01T00:00:00.000Z",
    updated_at: "2024-01-01T00:00:00.000Z",
    deleted_at: null,
  },
  {
    id: "5",
    name: "Sekcja C",
    code: "MG-C",
    description: "Sekcja C - Materiały ścierne",
    level: 1,
    parent_id: "1",
    sort_order: 3,
    color: "#ef4444",
    icon_name: "Grid3X3",
    image_url:
      "https://images.pexels.com/photos/4481942/pexels-photo-4481942.jpeg?auto=compress&cs=tinysrgb&w=400",
    branch_id: "550e8400-e29b-41d4-a716-446655440001",
    organization_id: "550e8400-e29b-41d4-a716-446655440002",
    created_at: "2024-01-01T00:00:00.000Z",
    updated_at: "2024-01-01T00:00:00.000Z",
    deleted_at: null,
  },

  // Level 2 - Specific locations in sections
  {
    id: "6",
    name: "Regał A1",
    code: "MG-A-R1",
    description: "Pierwszy regał w sekcji A",
    level: 2,
    parent_id: "3",
    sort_order: 1,
    color: "#f59e0b",
    icon_name: "Package",
    image_url:
      "https://images.pexels.com/photos/4481942/pexels-photo-4481942.jpeg?auto=compress&cs=tinysrgb&w=400",
    branch_id: "550e8400-e29b-41d4-a716-446655440001",
    organization_id: "550e8400-e29b-41d4-a716-446655440002",
    created_at: "2024-01-01T00:00:00.000Z",
    updated_at: "2024-01-01T00:00:00.000Z",
    deleted_at: null,
  },
  {
    id: "7",
    name: "Regał A2",
    code: "MG-A-R2",
    description: "Drugi regał w sekcji A",
    level: 2,
    parent_id: "3",
    sort_order: 2,
    color: "#f59e0b",
    icon_name: "Package",
    image_url:
      "https://images.pexels.com/photos/4481942/pexels-photo-4481942.jpeg?auto=compress&cs=tinysrgb&w=400",
    branch_id: "550e8400-e29b-41d4-a716-446655440001",
    organization_id: "550e8400-e29b-41d4-a716-446655440002",
    created_at: "2024-01-01T00:00:00.000Z",
    updated_at: "2024-01-01T00:00:00.000Z",
    deleted_at: null,
  },
  {
    id: "8",
    name: "Regał B1",
    code: "MG-B-R1",
    description: "Pierwszy regał w sekcji B",
    level: 2,
    parent_id: "4",
    sort_order: 1,
    color: "#8b5cf6",
    icon_name: "Package",
    image_url:
      "https://images.pexels.com/photos/4481942/pexels-photo-4481942.jpeg?auto=compress&cs=tinysrgb&w=400",
    branch_id: "550e8400-e29b-41d4-a716-446655440001",
    organization_id: "550e8400-e29b-41d4-a716-446655440002",
    created_at: "2024-01-01T00:00:00.000Z",
    updated_at: "2024-01-01T00:00:00.000Z",
    deleted_at: null,
  },
  {
    id: "9",
    name: "Regał C1",
    code: "MG-C-R1",
    description: "Pierwszy regał w sekcji C",
    level: 2,
    parent_id: "5",
    sort_order: 1,
    color: "#ef4444",
    icon_name: "Package",
    image_url:
      "https://images.pexels.com/photos/4481942/pexels-photo-4481942.jpeg?auto=compress&cs=tinysrgb&w=400",
    branch_id: "550e8400-e29b-41d4-a716-446655440001",
    organization_id: "550e8400-e29b-41d4-a716-446655440002",
    created_at: "2024-01-01T00:00:00.000Z",
    updated_at: "2024-01-01T00:00:00.000Z",
    deleted_at: null,
  },

  // Level 1 - Section in auxiliary warehouse
  {
    id: "10",
    name: "Strefa Nadwyżek",
    code: "MP-N",
    description: "Strefa dla nadwyżek magazynowych",
    level: 1,
    parent_id: "2",
    sort_order: 1,
    color: "#10b981",
    icon_name: "Archive",
    image_url:
      "https://images.pexels.com/photos/4481942/pexels-photo-4481942.jpeg?auto=compress&cs=tinysrgb&w=400",
    branch_id: "550e8400-e29b-41d4-a716-446655440001",
    organization_id: "550e8400-e29b-41d4-a716-446655440002",
    created_at: "2024-01-01T00:00:00.000Z",
    updated_at: "2024-01-01T00:00:00.000Z",
    deleted_at: null,
  },
];

// Mock function to get product count for a location
import { mockStockLocations } from "./products";

export function getLocationProductCount(locationId: string): number {
  return mockStockLocations
    .filter((stock) => stock.location_id === locationId)
    .reduce((total, stock) => total + stock.quantity, 0);
}
