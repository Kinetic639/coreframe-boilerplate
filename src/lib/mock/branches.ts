import { Tables } from "../../../supabase/types/types";

export interface BranchWithLocations {
  branch: Tables<"branches">;
  locations: Tables<"locations">[];
}

// Mock branches for the GCZ organization
export const mockBranches: Tables<"branches">[] = [
  {
    id: "550e8400-e29b-41d4-a716-446655440001",
    name: "Oddział Główny - Warszawa",
    organization_id: "550e8400-e29b-41d4-a716-446655440002", // GCZ organization
    slug: "warszawa-main",
    created_at: "2023-01-15T00:00:00.000Z",
    deleted_at: null,
  },
  {
    id: "550e8400-e29b-41d4-a716-446655440003",
    name: "Oddział Kraków",
    organization_id: "550e8400-e29b-41d4-a716-446655440002",
    slug: "krakow",
    created_at: "2023-02-01T00:00:00.000Z",
    deleted_at: null,
  },
  {
    id: "550e8400-e29b-41d4-a716-446655440004",
    name: "Oddział Gdańsk",
    organization_id: "550e8400-e29b-41d4-a716-446655440002",
    slug: "gdansk",
    created_at: "2023-02-15T00:00:00.000Z",
    deleted_at: null,
  },
  {
    id: "550e8400-e29b-41d4-a716-446655440005",
    name: "Oddział Wrocław",
    organization_id: "550e8400-e29b-41d4-a716-446655440002",
    slug: "wroclaw",
    created_at: "2023-03-01T00:00:00.000Z",
    deleted_at: null,
  },
];

// Locations for Warsaw branch (main branch)
const warsawLocations: Tables<"locations">[] = [
  {
    id: "war-1",
    name: "Magazyn Główny Warszawa",
    code: "WAR-MG-001",
    description: "Główny magazyn w Warszawie - centrum dystrybucji GCZ",
    level: 0,
    parent_id: null,
    sort_order: 1,
    color: "#3b82f6",
    icon_name: "Warehouse",
    image_url:
      "https://images.pexels.com/photos/4481259/pexels-photo-4481259.jpeg?auto=compress&cs=tinysrgb&w=400",
    branch_id: "550e8400-e29b-41d4-a716-446655440001",
    organization_id: "550e8400-e29b-41d4-a716-446655440002",
    created_at: "2023-01-15T00:00:00.000Z",
    updated_at: "2024-01-15T00:00:00.000Z",
    deleted_at: null,
  },
  {
    id: "war-2",
    name: "Sekcja A - Lakiery i Farby",
    code: "WAR-A",
    description: "Sekcja lakierów, farb i produktów kolorowych",
    level: 1,
    parent_id: "war-1",
    sort_order: 1,
    color: "#f59e0b",
    icon_name: "Palette",
    image_url: null,
    branch_id: "550e8400-e29b-41d4-a716-446655440001",
    organization_id: "550e8400-e29b-41d4-a716-446655440002",
    created_at: "2023-01-15T00:00:00.000Z",
    updated_at: "2024-01-15T00:00:00.000Z",
    deleted_at: null,
  },
  {
    id: "war-3",
    name: "Sekcja B - Narzędzia i Sprzęt",
    code: "WAR-B",
    description: "Sekcja narzędzi lakierniczych i sprzętu warsztatowego",
    level: 1,
    parent_id: "war-1",
    sort_order: 2,
    color: "#8b5cf6",
    icon_name: "Wrench",
    image_url: null,
    branch_id: "550e8400-e29b-41d4-a716-446655440001",
    organization_id: "550e8400-e29b-41d4-a716-446655440002",
    created_at: "2023-01-15T00:00:00.000Z",
    updated_at: "2024-01-15T00:00:00.000Z",
    deleted_at: null,
  },
  {
    id: "war-4",
    name: "Sekcja C - Materiały Ścierne",
    code: "WAR-C",
    description: "Sekcja materiałów ściernych i akcesoriów",
    level: 1,
    parent_id: "war-1",
    sort_order: 3,
    color: "#ef4444",
    icon_name: "Disc",
    image_url: null,
    branch_id: "550e8400-e29b-41d4-a716-446655440001",
    organization_id: "550e8400-e29b-41d4-a716-446655440002",
    created_at: "2023-01-15T00:00:00.000Z",
    updated_at: "2024-01-15T00:00:00.000Z",
    deleted_at: null,
  },
  {
    id: "war-5",
    name: "Regał A1 - Lakiery Podstawowe",
    code: "WAR-A-R1",
    description: "Pierwszy regał w sekcji A - lakiery podstawowe",
    level: 2,
    parent_id: "war-2",
    sort_order: 1,
    color: "#f59e0b",
    icon_name: "Package",
    image_url: null,
    branch_id: "550e8400-e29b-41d4-a716-446655440001",
    organization_id: "550e8400-e29b-41d4-a716-446655440002",
    created_at: "2023-01-15T00:00:00.000Z",
    updated_at: "2024-01-15T00:00:00.000Z",
    deleted_at: null,
  },
  {
    id: "war-6",
    name: "Regał A2 - Lakiery Specjalne",
    code: "WAR-A-R2",
    description: "Drugi regał w sekcji A - lakiery specjalne i metaliczne",
    level: 2,
    parent_id: "war-2",
    sort_order: 2,
    color: "#f59e0b",
    icon_name: "Package",
    image_url: null,
    branch_id: "550e8400-e29b-41d4-a716-446655440001",
    organization_id: "550e8400-e29b-41d4-a716-446655440002",
    created_at: "2023-01-15T00:00:00.000Z",
    updated_at: "2024-01-15T00:00:00.000Z",
    deleted_at: null,
  },
];

// Locations for Krakow branch
const krakowLocations: Tables<"locations">[] = [
  {
    id: "kra-1",
    name: "Centrum Dystrybucyjne Kraków",
    code: "KRA-CD-001",
    description: "Centrum dystrybucyjne GCZ w Krakowie",
    level: 0,
    parent_id: null,
    sort_order: 1,
    color: "#10b981",
    icon_name: "Building",
    image_url:
      "https://images.pexels.com/photos/4481942/pexels-photo-4481942.jpeg?auto=compress&cs=tinysrgb&w=400",
    branch_id: "550e8400-e29b-41d4-a716-446655440003",
    organization_id: "550e8400-e29b-41d4-a716-446655440002",
    created_at: "2023-02-01T00:00:00.000Z",
    updated_at: "2024-01-10T00:00:00.000Z",
    deleted_at: null,
  },
  {
    id: "kra-2",
    name: "Strefa Przyjęć",
    code: "KRA-SP",
    description: "Strefa przyjęć towarów od dostawców",
    level: 1,
    parent_id: "kra-1",
    sort_order: 1,
    color: "#06b6d4",
    icon_name: "Inbox",
    image_url: null,
    branch_id: "550e8400-e29b-41d4-a716-446655440003",
    organization_id: "550e8400-e29b-41d4-a716-446655440002",
    created_at: "2023-02-01T00:00:00.000Z",
    updated_at: "2024-01-10T00:00:00.000Z",
    deleted_at: null,
  },
  {
    id: "kra-3",
    name: "Strefa Wysyłek",
    code: "KRA-SW",
    description: "Strefa kompletacji i wysyłek do klientów",
    level: 1,
    parent_id: "kra-1",
    sort_order: 2,
    color: "#f97316",
    icon_name: "Send",
    image_url: null,
    branch_id: "550e8400-e29b-41d4-a716-446655440003",
    organization_id: "550e8400-e29b-41d4-a716-446655440002",
    created_at: "2023-02-01T00:00:00.000Z",
    updated_at: "2024-01-10T00:00:00.000Z",
    deleted_at: null,
  },
  {
    id: "kra-4",
    name: "Sala Szkoleniowa",
    code: "KRA-SS",
    description: "Sala szkoleniowa dla klientów i partnerów",
    level: 1,
    parent_id: "kra-1",
    sort_order: 3,
    color: "#8b5cf6",
    icon_name: "GraduationCap",
    image_url: null,
    branch_id: "550e8400-e29b-41d4-a716-446655440003",
    organization_id: "550e8400-e29b-41d4-a716-446655440002",
    created_at: "2023-02-01T00:00:00.000Z",
    updated_at: "2024-01-10T00:00:00.000Z",
    deleted_at: null,
  },
];

// Locations for Gdansk branch
const gdanskLocations: Tables<"locations">[] = [
  {
    id: "gda-1",
    name: "Terminal Portowy Gdańsk",
    code: "GDA-TP-001",
    description: "Terminal portowy GCZ w Gdańsku - hub importowy",
    level: 0,
    parent_id: null,
    sort_order: 1,
    color: "#0ea5e9",
    icon_name: "Ship",
    image_url:
      "https://images.pexels.com/photos/4481942/pexels-photo-4481942.jpeg?auto=compress&cs=tinysrgb&w=400",
    branch_id: "550e8400-e29b-41d4-a716-446655440004",
    organization_id: "550e8400-e29b-41d4-a716-446655440002",
    created_at: "2023-02-15T00:00:00.000Z",
    updated_at: "2024-01-05T00:00:00.000Z",
    deleted_at: null,
  },
  {
    id: "gda-2",
    name: "Kontener A - Import",
    code: "GDA-KA",
    description: "Kontener magazynowy A - produkty importowane",
    level: 1,
    parent_id: "gda-1",
    sort_order: 1,
    color: "#84cc16",
    icon_name: "Container",
    image_url: null,
    branch_id: "550e8400-e29b-41d4-a716-446655440004",
    organization_id: "550e8400-e29b-41d4-a716-446655440002",
    created_at: "2023-02-15T00:00:00.000Z",
    updated_at: "2024-01-05T00:00:00.000Z",
    deleted_at: null,
  },
  {
    id: "gda-3",
    name: "Kontener B - Eksport",
    code: "GDA-KB",
    description: "Kontener magazynowy B - produkty na eksport",
    level: 1,
    parent_id: "gda-1",
    sort_order: 2,
    color: "#ec4899",
    icon_name: "Container",
    image_url: null,
    branch_id: "550e8400-e29b-41d4-a716-446655440004",
    organization_id: "550e8400-e29b-41d4-a716-446655440002",
    created_at: "2023-02-15T00:00:00.000Z",
    updated_at: "2024-01-05T00:00:00.000Z",
    deleted_at: null,
  },
  {
    id: "gda-4",
    name: "Chłodnia Specjalistyczna",
    code: "GDA-CH",
    description: "Magazyn chłodniczy dla produktów wrażliwych na temperaturę",
    level: 1,
    parent_id: "gda-1",
    sort_order: 3,
    color: "#06b6d4",
    icon_name: "Snowflake",
    image_url: null,
    branch_id: "550e8400-e29b-41d4-a716-446655440004",
    organization_id: "550e8400-e29b-41d4-a716-446655440002",
    created_at: "2023-02-15T00:00:00.000Z",
    updated_at: "2024-01-05T00:00:00.000Z",
    deleted_at: null,
  },
  {
    id: "gda-5",
    name: "Strefa Kwarantanny",
    code: "GDA-KW",
    description: "Strefa kwarantanny dla nowych dostaw",
    level: 1,
    parent_id: "gda-1",
    sort_order: 4,
    color: "#f59e0b",
    icon_name: "Shield",
    image_url: null,
    branch_id: "550e8400-e29b-41d4-a716-446655440004",
    organization_id: "550e8400-e29b-41d4-a716-446655440002",
    created_at: "2023-02-15T00:00:00.000Z",
    updated_at: "2024-01-05T00:00:00.000Z",
    deleted_at: null,
  },
];

// Locations for Wroclaw branch
const wroclawLocations: Tables<"locations">[] = [
  {
    id: "wro-1",
    name: "Magazyn Automatyczny Wrocław",
    code: "WRO-MA-001",
    description: "Zautomatyzowany magazyn GCZ we Wrocławiu - Industry 4.0",
    level: 0,
    parent_id: null,
    sort_order: 1,
    color: "#a855f7",
    icon_name: "Bot",
    image_url:
      "https://images.pexels.com/photos/4481942/pexels-photo-4481942.jpeg?auto=compress&cs=tinysrgb&w=400",
    branch_id: "550e8400-e29b-41d4-a716-446655440005",
    organization_id: "550e8400-e29b-41d4-a716-446655440002",
    created_at: "2023-03-01T00:00:00.000Z",
    updated_at: "2023-12-20T00:00:00.000Z",
    deleted_at: null,
  },
  {
    id: "wro-2",
    name: "Linia Automatyczna A",
    code: "WRO-LA",
    description: "Automatyczna linia A - sortowanie i pakowanie",
    level: 1,
    parent_id: "wro-1",
    sort_order: 1,
    color: "#14b8a6",
    icon_name: "Zap",
    image_url: null,
    branch_id: "550e8400-e29b-41d4-a716-446655440005",
    organization_id: "550e8400-e29b-41d4-a716-446655440002",
    created_at: "2023-03-01T00:00:00.000Z",
    updated_at: "2023-12-20T00:00:00.000Z",
    deleted_at: null,
  },
  {
    id: "wro-3",
    name: "Linia Automatyczna B",
    code: "WRO-LB",
    description: "Automatyczna linia B - kontrola jakości",
    level: 1,
    parent_id: "wro-1",
    sort_order: 2,
    color: "#f59e0b",
    icon_name: "Zap",
    image_url: null,
    branch_id: "550e8400-e29b-41d4-a716-446655440005",
    organization_id: "550e8400-e29b-41d4-a716-446655440002",
    created_at: "2023-03-01T00:00:00.000Z",
    updated_at: "2023-12-20T00:00:00.000Z",
    deleted_at: null,
  },
  {
    id: "wro-4",
    name: "Centrum Kontroli",
    code: "WRO-CK",
    description: "Centrum kontroli systemów automatycznych",
    level: 1,
    parent_id: "wro-1",
    sort_order: 3,
    color: "#ef4444",
    icon_name: "MonitorSpeaker",
    image_url: null,
    branch_id: "550e8400-e29b-41d4-a716-446655440005",
    organization_id: "550e8400-e29b-41d4-a716-446655440002",
    created_at: "2023-03-01T00:00:00.000Z",
    updated_at: "2023-12-20T00:00:00.000Z",
    deleted_at: null,
  },
];

// Map branches to their locations
export const branchLocationsMap: Record<string, Tables<"locations">[]> = {
  "550e8400-e29b-41d4-a716-446655440001": warsawLocations,
  "550e8400-e29b-41d4-a716-446655440003": krakowLocations,
  "550e8400-e29b-41d4-a716-446655440004": gdanskLocations,
  "550e8400-e29b-41d4-a716-446655440005": wroclawLocations,
};

// Product counts for each location by branch (updated with more realistic numbers)
export const branchProductCounts: Record<string, Record<string, number>> = {
  "550e8400-e29b-41d4-a716-446655440001": {
    "war-1": 1245,
    "war-2": 456,
    "war-3": 278,
    "war-4": 189,
    "war-5": 145,
    "war-6": 167,
  },
  "550e8400-e29b-41d4-a716-446655440003": {
    "kra-1": 689,
    "kra-2": 167,
    "kra-3": 234,
    "kra-4": 0, // Training room has no products
  },
  "550e8400-e29b-41d4-a716-446655440004": {
    "gda-1": 1298,
    "gda-2": 389,
    "gda-3": 234,
    "gda-4": 175,
    "gda-5": 89,
  },
  "550e8400-e29b-41d4-a716-446655440005": {
    "wro-1": 2156,
    "wro-2": 734,
    "wro-3": 622,
    "wro-4": 0, // Control center has no products
  },
};

export function getLocationsByBranch(branchId: string): Tables<"locations">[] {
  return branchLocationsMap[branchId] || [];
}

export function getLocationProductCountByBranch(branchId: string, locationId: string): number {
  return branchProductCounts[branchId]?.[locationId] || 0;
}

export function getBranchById(branchId: string): Tables<"branches"> | undefined {
  return mockBranches.find((branch) => branch.id === branchId);
}

export function getAllLocations(): Tables<"locations">[] {
  return Object.values(branchLocationsMap).flat();
}

export function getTotalProductCountByBranch(branchId: string): number {
  const counts = branchProductCounts[branchId];
  if (!counts) return 0;

  return Object.values(counts).reduce((total, count) => total + count, 0);
}
