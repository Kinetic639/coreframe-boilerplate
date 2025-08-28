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
import { ProductCard } from "@/modules/warehouse/products/components/product-card";
import { ProductList } from "@/modules/warehouse/products/components/product-list";
import { ProductTable } from "@/modules/warehouse/products/components/product-table";
import { NewProductFormDialog } from "@/modules/warehouse/products/components/new-product-form-dialog";
import { productService, ProductWithVariants } from "@/modules/warehouse/api/products";
import { useAppStore } from "@/lib/stores/app-store";
import { PaginationControls } from "@/components/ui/pagination-controls";
import { useSearchParams } from "next/navigation";

type DisplayMode = "grid" | "list" | "table";

export default function ProductsPage() {
  const { activeBranchId, isLoaded } = useAppStore();
  const [displayMode, setDisplayMode] = React.useState<DisplayMode>("grid");
  const [isFormOpen, setIsFormOpen] = React.useState(false);
  const [selectedProduct, setSelectedProduct] = React.useState<ProductWithVariants | undefined>(
    undefined
  );

  // Product data state
  const [products, setProducts] = React.useState<ProductWithVariants[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);

  // Pagination state
  const [currentPage, setCurrentPage] = React.useState(1);
  const [itemsPerPage, setItemsPerPage] = React.useState(12);
  const [totalProducts, setTotalProducts] = React.useState(0);

  // Filter state
  const searchParams = useSearchParams();
  const [currentFilters, setCurrentFilters] = React.useState<any>({});

  const handleAddNew = () => {
    setSelectedProduct(undefined);
    setIsFormOpen(true);
  };

  const handleProductSuccess = () => {
    // Refresh the product list
    loadProducts();
    // console.log("Product operation completed successfully");
  };

  // Load products from Supabase
  const loadProducts = React.useCallback(async () => {
    if (!activeBranchId || !isLoaded) return;

    setLoading(true);
    setError(null);

    try {
      const filters = {
        search: currentFilters.search,
        minPrice: currentFilters.minPrice,
        maxPrice: currentFilters.maxPrice,
        supplierId: currentFilters.supplierId,
        locationId: currentFilters.locationId,
        showLowStock: currentFilters.showLowStock,
        limit: itemsPerPage,
        offset: (currentPage - 1) * itemsPerPage,
      };

      const result = await productService.getProductsByBranch(activeBranchId, filters);
      setProducts(result.products);
      setTotalProducts(result.total);
    } catch (err) {
      console.error("Error loading products:", err);
      setError("Błąd podczas ładowania produktów");
      setProducts([]);
    } finally {
      setLoading(false);
    }
  }, [activeBranchId, isLoaded, currentFilters, currentPage, itemsPerPage]);

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
                        <ProductCard key={product.id} product={product} />
                      ))}
                    </div>
                  )}
                  {displayMode === "list" && (
                    <div className="space-y-4">
                      {products.map((product) => (
                        <ProductList key={product.id} product={product} />
                      ))}
                    </div>
                  )}
                  {displayMode === "table" && <ProductTable products={products} />}
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
      <NewProductFormDialog
        open={isFormOpen}
        onOpenChange={setIsFormOpen}
        product={selectedProduct}
        onSuccess={handleProductSuccess}
      />
    </div>
  );
}
