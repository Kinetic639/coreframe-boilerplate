import { useState, useMemo, useCallback } from "react";
import {
  ProductWithDetails,
  getMockSuppliers,
  getMockLocations,
} from "@/lib/mock/products-extended";
import { Tables } from "../../../supabase/types/types";

interface ProductFilters {
  search?: string;
  minPrice?: number;
  maxPrice?: number;
  supplierId?: string;
  locationId?: string;
  tags?: string[];
  showLowStock?: boolean;
}

interface UseProductFiltersResult {
  filteredData: ProductWithDetails[];
  currentPage: number;
  totalPages: number;
  itemsPerPage: number;
  handlePageChange: (page: number) => void;
  handleItemsPerPageChange: (items: number) => void;
  handleFilterChange: (filters: ProductFilters) => void;
  availableSuppliers: Tables<"suppliers">[];
  availableLocations: Tables<"locations">[];
}

export const useProductFilters = (products: ProductWithDetails[]): UseProductFiltersResult => {
  const [filters, setFilters] = useState<ProductFilters>({
    search: undefined,
    minPrice: undefined,
    maxPrice: undefined,
    supplierId: undefined,
    locationId: undefined,
    tags: undefined,
    showLowStock: undefined,
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
        filters.search === undefined ||
        filters.search === "" ||
        product.name.toLowerCase().includes(filters.search.toLowerCase()) ||
        product.sku?.toLowerCase().includes(filters.search.toLowerCase()) ||
        product.barcode?.toLowerCase().includes(filters.search.toLowerCase()) ||
        product.variants.some(
          (variant) =>
            variant.name.toLowerCase().includes(filters.search!.toLowerCase()) ||
            variant.sku?.toLowerCase().includes(filters.search!.toLowerCase())
        );

      const matchesPrice =
        (filters.minPrice === undefined ||
          product.variants.some(
            (v) => v.inventory_data && v.inventory_data.purchase_price >= filters.minPrice!
          )) &&
        (filters.maxPrice === undefined ||
          product.variants.some(
            (v) => v.inventory_data && v.inventory_data.purchase_price <= filters.maxPrice!
          ));

      const matchesSupplier =
        filters.supplierId === undefined ||
        filters.supplierId === "" ||
        product.suppliers.some((supplier) => supplier.id === filters.supplierId);

      const matchesLocation =
        filters.locationId === undefined ||
        filters.locationId === "" ||
        product.variants.some((variant) =>
          variant.stock_locations.some((sl) => sl.location_id === filters.locationId)
        );

      const matchesTags =
        filters.tags === undefined ||
        filters.tags.length === 0 ||
        (product.tags && product.tags.some((tag) => filters.tags!.includes(tag)));

      const matchesLowStock =
        filters.showLowStock === undefined ||
        !filters.showLowStock ||
        product.variants.some((v) => v.inventory_data && v.inventory_data.stock_quantity < 10); // Assuming low stock is < 10

      return (
        matchesSearch &&
        matchesPrice &&
        matchesSupplier &&
        matchesLocation &&
        matchesTags &&
        matchesLowStock
      );
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
