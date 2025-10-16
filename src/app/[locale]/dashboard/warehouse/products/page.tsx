"use client";

import * as React from "react";
import { Suspense } from "react";
import { ProductLoadingSkeleton } from "@/modules/warehouse/products/components/product-loading-skeleton";
import { motion } from "framer-motion";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Plus, LayoutGrid, List, Table as TableIcon } from "lucide-react";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { ProductFilters } from "@/modules/warehouse/products/components/product-filters";
import { SimpleProductCard } from "@/modules/warehouse/products/components/simple-product-card";
import { SimpleProductList } from "@/modules/warehouse/products/components/simple-product-list";
import { SimpleProductTable } from "@/modules/warehouse/products/components/simple-product-table";
import { CreateProductDialog } from "@/modules/warehouse/products/components/create-product-dialog";
import { productsService } from "@/modules/warehouse/api/products-service";
import type { ProductWithDetails } from "@/modules/warehouse/types/products";
import { useAppStore } from "@/lib/stores/app-store";
import { PaginationControls } from "@/components/ui/pagination-controls";
import { useSearchParams } from "next/navigation";

type DisplayMode = "grid" | "list" | "table";

interface ProductFiltersState {
  search?: string;
  product_type?: string[];
  status?: string[];
  category_id?: string[];
  brand?: string[];
  manufacturer?: string[];
  preferred_vendor_id?: string[];
  min_price?: number;
  max_price?: number;
}

export default function ProductsPage() {
  const { activeOrgId, isLoaded } = useAppStore();
  const [displayMode, setDisplayMode] = React.useState<DisplayMode>("grid");
  const [isCreateDialogOpen, setIsCreateDialogOpen] = React.useState(false);

  // Product data state
  const [products, setProducts] = React.useState<ProductWithDetails[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);

  // Pagination state
  const [currentPage, setCurrentPage] = React.useState(1);
  const [itemsPerPage, setItemsPerPage] = React.useState(12);
  const [totalProducts, setTotalProducts] = React.useState(0);

  // Filter state
  const searchParams = useSearchParams();
  const [currentFilters, setCurrentFilters] = React.useState<ProductFiltersState>({});

  const handleAddNew = () => {
    setIsCreateDialogOpen(true);
  };

  // const handleAddNewOld = () => {
  //   setSelectedProduct(undefined);
  //   setIsFormOpen(true);
  // };

  // Load products from Supabase
  const loadProducts = React.useCallback(async () => {
    if (!activeOrgId || !isLoaded) return;

    setLoading(true);
    setError(null);

    try {
      const filters = {
        search: currentFilters.search,
        product_type: currentFilters.product_type,
        status: currentFilters.status,
        category_id: currentFilters.category_id,
        brand: currentFilters.brand,
        manufacturer: currentFilters.manufacturer,
        preferred_vendor_id: currentFilters.preferred_vendor_id,
        min_price: currentFilters.min_price,
        max_price: currentFilters.max_price,
        limit: itemsPerPage,
        offset: (currentPage - 1) * itemsPerPage,
      };

      const result = await productsService.getProducts(activeOrgId, filters);
      setProducts(result.products);
      setTotalProducts(result.total_count);
    } catch (err) {
      console.error("Error loading products:", err);
      setError("Błąd podczas ładowania produktów");
      setProducts([]);
    } finally {
      setLoading(false);
    }
  }, [activeOrgId, isLoaded, currentFilters, currentPage, itemsPerPage]);

  // Load products when dependencies change
  React.useEffect(() => {
    loadProducts();
  }, [loadProducts]);

  // Handle pagination
  const handlePageChange = (page: number) => {
    setCurrentPage(page);
  };

  const handleItemsPerPageChange = (newItemsPerPage: number) => {
    setItemsPerPage(newItemsPerPage);
    setCurrentPage(1); // Reset to first page
  };

  const totalPages = Math.ceil(totalProducts / itemsPerPage);

  // Update filters from URL params
  React.useEffect(() => {
    const filtersFromUrl = {
      search: searchParams.get("search") || undefined,
      minPrice: searchParams.get("minPrice")
        ? parseFloat(searchParams.get("minPrice")!)
        : undefined,
      maxPrice: searchParams.get("maxPrice")
        ? parseFloat(searchParams.get("maxPrice")!)
        : undefined,
      supplierId: searchParams.get("supplierId") || undefined,
      locationId: searchParams.get("locationId") || undefined,
      showLowStock: searchParams.get("showLowStock") === "true" || undefined,
    };
    setCurrentFilters(filtersFromUrl);
    setCurrentPage(1); // Reset to first page when filters change
  }, [searchParams]);

  return (
    <div className="space-y-6">
      {/* Create Product Dialog */}
      <CreateProductDialog
        open={isCreateDialogOpen}
        onOpenChange={setIsCreateDialogOpen}
        onSuccess={loadProducts}
      />

      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex items-center justify-between"
      >
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Produkty magazynowe</h1>
          <p className="text-muted-foreground">
            Zarządzanie produktami, wariantami i stanami magazynowymi
          </p>
        </div>
        <Button onClick={handleAddNew}>
          <Plus className="mr-2 h-4 w-4" />
          Dodaj produkt
        </Button>
      </motion.div>

      {/* Filters and Display Mode Toggle */}
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
      >
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-lg">Filtrowanie i widok</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-4 md:flex-row md:items-end">
            <div className="flex-grow">
              <ProductFilters onFilterChange={setCurrentFilters} />
            </div>
            <ToggleGroup
              type="single"
              value={displayMode}
              onValueChange={(value: DisplayMode) => value && setDisplayMode(value)}
              aria-label="Wybierz tryb wyświetlania"
            >
              <ToggleGroupItem value="grid" aria-label="Widok siatki" className="rounded-l-[6px]">
                <LayoutGrid className="h-4 w-4" />
              </ToggleGroupItem>
              <ToggleGroupItem value="list" aria-label="Widok listy">
                <List className="h-4 w-4" />
              </ToggleGroupItem>
              <ToggleGroupItem value="table" aria-label="Widok tabeli" className="rounded-r-[6px]">
                <TableIcon className="h-4 w-4" />
              </ToggleGroupItem>
            </ToggleGroup>
          </CardContent>
        </Card>
      </motion.div>

      {/* Product Listing */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2 }}
      >
        <Suspense fallback={<ProductLoadingSkeleton />}>
          <Card>
            <CardHeader>
              <CardTitle>Lista produktów ({loading ? "..." : totalProducts})</CardTitle>
            </CardHeader>
            <CardContent>
              {loading ? (
                <ProductLoadingSkeleton />
              ) : error ? (
                <div className="py-12 text-center text-muted-foreground">
                  <h3 className="mb-2 text-lg font-medium text-red-600">Błąd</h3>
                  <p>{error}</p>
                  <Button onClick={loadProducts} variant="outline" className="mt-4">
                    Spróbuj ponownie
                  </Button>
                </div>
              ) : products.length === 0 ? (
                <div className="py-12 text-center text-muted-foreground">
                  <h3 className="mb-2 text-lg font-medium">Brak produktów</h3>
                  <p>
                    {currentFilters.search ||
                    currentFilters.minPrice ||
                    currentFilters.maxPrice ||
                    currentFilters.supplierId ||
                    currentFilters.locationId ||
                    currentFilters.showLowStock
                      ? "Nie znaleziono produktów spełniających kryteria filtrowania."
                      : "Nie dodano jeszcze żadnych produktów do tego oddziału."}
                  </p>
                  {!currentFilters.search &&
                    !currentFilters.minPrice &&
                    !currentFilters.maxPrice &&
                    !currentFilters.supplierId &&
                    !currentFilters.locationId &&
                    !currentFilters.showLowStock && (
                      <Button onClick={handleAddNew} className="mt-4">
                        <Plus className="mr-2 h-4 w-4" />
                        Dodaj pierwszy produkt
                      </Button>
                    )}
                </div>
              ) : (
                <>
                  {displayMode === "grid" && (
                    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                      {products.map((product) => (
                        <SimpleProductCard key={product.id} product={product} />
                      ))}
                    </div>
                  )}
                  {displayMode === "list" && (
                    <div className="space-y-4">
                      {products.map((product) => (
                        <SimpleProductList key={product.id} product={product} />
                      ))}
                    </div>
                  )}
                  {displayMode === "table" && <SimpleProductTable products={products} />}
                  {totalPages > 1 && (
                    <PaginationControls
                      currentPage={currentPage}
                      totalPages={totalPages}
                      itemsPerPage={itemsPerPage}
                      onPageChange={handlePageChange}
                      onItemsPerPageChange={handleItemsPerPageChange}
                    />
                  )}
                </>
              )}
            </CardContent>
          </Card>
        </Suspense>
      </motion.div>
    </div>
  );
}
