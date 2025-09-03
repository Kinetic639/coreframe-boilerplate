"use client";

import { useCallback, useEffect, useState } from "react";
import { useAppStore } from "@/lib/stores/app-store";
import { createClient } from "@/utils/supabase/client";
import { toast } from "react-toastify";

export function useLocations() {
  const { activeBranchId, locations, setLocations } = useAppStore();

  const [isLoading, setIsLoading] = useState(false);

  const loadLocationsForBranch = useCallback(
    async (branchId: string) => {
      if (!branchId) {
        setLocations([]);
        return [];
      }

      setIsLoading(true);
      try {
        const supabase = createClient();
        const { data, error } = await supabase
          .from("locations")
          .select("*")
          .eq("branch_id", branchId)
          .is("deleted_at", null)
          .order("sort_order", { ascending: true })
          .order("created_at", { ascending: true });

        if (error) {
          console.error("Error loading locations:", error);
          toast.error("Failed to load locations");
          setLocations([]);
          return [];
        } else {
          setLocations(data || []);
          console.log("🔍 Locations loaded into store:", data?.length || 0);
          return data || [];
        }
      } catch (error) {
        console.error("Error loading locations:", error);
        toast.error("Failed to load locations");
        setLocations([]);
        return [];
      } finally {
        setIsLoading(false);
      }
    },
    [setLocations]
  );

  const refreshLocations = useCallback(async () => {
    if (activeBranchId) {
      return await loadLocationsForBranch(activeBranchId);
    }
    return [];
  }, [activeBranchId, loadLocationsForBranch]);

  // Auto-load locations when branch changes (like LocationManager)
  useEffect(() => {
    console.log("🔍 useLocations effect triggered, activeBranchId:", activeBranchId);
    if (activeBranchId) {
      loadLocationsForBranch(activeBranchId);
    } else {
      setLocations([]);
    }
  }, [activeBranchId, loadLocationsForBranch, setLocations]);

  return {
    locations,
    refreshLocations,
    loadLocationsForBranch,
    isLoading,
  };
}
