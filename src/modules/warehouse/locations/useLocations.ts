"use client";

import useSWR from "swr";
import { loadLocations } from "../api/load-locations";
import type { Tables } from "../../../supabase/types/types";

export type LocationRow = Tables<"locations">;

export function useLocations() {
  const { data, error, isLoading, mutate } = useSWR<LocationRow[]>(
    "locations",
    loadLocations,
  );

  return {
    locations: data ?? [],
    isLoading,
    error,
    mutate,
  };
}
