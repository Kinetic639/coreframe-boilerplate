import { useState, useCallback, useEffect } from "react";
import { createClient } from "@/lib/supabase/client";
import { useAppStore } from "@/lib/stores/app-store";

interface Supplier {
  id: string;
  name: string;
}

interface Location {
  id: string;
  name: string;
}

interface UseProductFiltersResult {
  currentPage: number;
  totalPages: number;
  itemsPerPage: number;
  handlePageChange: (page: number) => void;
  handleItemsPerPageChange: (items: number) => void;
  availableSuppliers: Supplier[];
  availableLocations: Location[];
}

export const useProductFilters = (_products: any[] = []): UseProductFiltersResult => {
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(10);
  const [availableSuppliers, setAvailableSuppliers] = useState<Supplier[]>([]);
  const [availableLocations, setAvailableLocations] = useState<Location[]>([]);

  const { activeBranchId, activeOrgId } = useAppStore();

  useEffect(() => {
    const fetchFiltersData = async () => {
      if (!activeOrgId || !activeBranchId) return;

      const supabase = createClient();

      try {
        // Fetch suppliers (vendors from business_accounts)
        const { data: suppliersData } = await supabase
          .from("business_accounts")
          .select("id, name")
          .eq("organization_id", activeOrgId)
          .eq("partner_type", "vendor")
          .eq("is_active", true)
          .is("deleted_at", null)
          .order("name");

        // Fetch locations for current branch
        const { data: locationsData } = await supabase
          .from("locations")
          .select("id, name")
          .eq("branch_id", activeBranchId)
          .is("deleted_at", null)
          .order("name");

        setAvailableSuppliers(suppliersData || []);
        setAvailableLocations(locationsData || []);
      } catch (error) {
        console.error("Error fetching filter data:", error);
      }
    };

    fetchFiltersData();
  }, [activeOrgId, activeBranchId]);

  const handlePageChange = useCallback((page: number) => {
    setCurrentPage(page);
  }, []);

  const handleItemsPerPageChange = useCallback((items: number) => {
    setItemsPerPage(items);
    setCurrentPage(1); // Reset to first page when items per page changes
  }, []);

  return {
    currentPage,
    totalPages: 1, // This will be handled by the main component
    itemsPerPage,
    handlePageChange,
    handleItemsPerPageChange,
    availableSuppliers,
    availableLocations,
  };
};
