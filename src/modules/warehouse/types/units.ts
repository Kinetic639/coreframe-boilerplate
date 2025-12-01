import type { Tables } from "@/types/supabase";

// Database type
export type UnitOfMeasure = Tables<"units_of_measure">;

// Form data for creating/updating units
export interface CreateUnitData {
  name: string;
  symbol?: string;
  organization_id: string;
}

export interface UpdateUnitData {
  id: string;
  name?: string;
  symbol?: string;
}

// Helper unit suggestions by locale
export interface UnitSuggestion {
  name: string;
  symbol: string;
}

export interface UnitSuggestions {
  quantity: UnitSuggestion[];
  weight: UnitSuggestion[];
  length: UnitSuggestion[];
  volume: UnitSuggestion[];
}
