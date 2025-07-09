import { useState, useMemo, useCallback } from "react";
import {
  ProductWithDetails,
  getMockSuppliers,
  getMockLocations,
} from "@/lib/mock/products-extended";
import { Tables } from "../../../supabase/types/types";

interface ProductFilters {
  search: string;
  minPrice: number | "";
  maxPrice: number | "";
  supplierId: string | "";
  locationId: string | "";
}

interface UseProductFiltersResult {
  filteredData: ProductWithDetails[];
  currentPage: number;
  totalPages: number;
  itemsPerPage: number;
  handlePageChange: (page: number) => void;
  handleItemsPerPageChange: (items: number) => void;
  handleFilterChange: (filters: Partial<ProductFilters>) => void;
  availableSuppliers: Tables<"suppliers">[];
  availableLocations: Tables<"locations">[];
}

export const useProductFilters = (products: ProductWithDetails[]): UseProductFiltersResult => {
  const [filters, setFilters] = useState<ProductFilters>({
    search: "",
    minPrice: "",
    maxPrice: "",
    supplierId: "",
    locationId: "",
  });
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(10);

  const availableSuppliers = useMemo(() => getMockSuppliers(), []);
  const availableLocations = useMemo(() => getMockLocations(), []);

  const handleFilterChange = useCallback((newFilters: Partial<ProductFilters>) => {
    setFilters((prevFilters) => ({ ...prevFilters, ...newFilters }));
    setCurrentPage(1); // Reset to first page on filter change
  }, []);

  const handlePageChange = useCallback((page: number) => {
    setCurrentPage(page);
  }, []);

  const handleItemsPerPageChange = useCallback((items: number) => {
    setItemsPerPage(items);
    setCurrentPage(1); // Reset to first page when items per page changes
  }, []);

  const filteredProducts = useMemo(() => {
    return products.filter((product) => {
      const matchesSearch =
        filters.search === "" ||
        product.name.toLowerCase().includes(filters.search.toLowerCase()) ||
        product.sku?.toLowerCase().includes(filters.search.toLowerCase()) ||
        product.barcode?.toLowerCase().includes(filters.search.toLowerCase()) ||
        product.variants.some(
          (variant) =>
            variant.name.toLowerCase().includes(filters.search.toLowerCase()) ||
            variant.sku?.toLowerCase().includes(filters.search.toLowerCase())
        );

      const matchesPrice =
        (filters.minPrice === "" ||
          product.variants.some(
            (v) => v.inventory_data && v.inventory_data.purchase_price >= filters.minPrice
          )) &&
        (filters.maxPrice === "" ||
          product.variants.some(
            (v) => v.inventory_data && v.inventory_data.purchase_price <= filters.maxPrice
          ));

      const matchesSupplier =
        filters.supplierId === "" ||
        product.suppliers.some((supplier) => supplier.id === filters.supplierId);

      const matchesLocation =
        filters.locationId === "" ||
        product.variants.some((variant) =>
          variant.stock_locations.some((sl) => sl.location_id === filters.locationId)
        );

      return matchesSearch && matchesPrice && matchesSupplier && matchesLocation;
    });
  }, [products, filters]);

  const totalPages = useMemo(
    () => Math.ceil(filteredProducts.length / itemsPerPage),
    [filteredProducts.length, itemsPerPage]
  );

  const paginatedProducts = useMemo(() => {
    const startIndex = (currentPage - 1) * itemsPerPage;
    const endIndex = startIndex + itemsPerPage;
    return filteredProducts.slice(startIndex, endIndex);
  }, [filteredProducts, currentPage, itemsPerPage]);

  return {
    filteredData: paginatedProducts,
    currentPage,
    totalPages,
    itemsPerPage,
    handlePageChange,
    handleItemsPerPageChange,
    handleFilterChange,
    availableSuppliers,
    availableLocations,
  };
};
