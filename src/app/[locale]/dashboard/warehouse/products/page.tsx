"use client";

import * as React from "react";
import { motion } from "framer-motion";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Plus, LayoutGrid, List, Table as TableIcon } from "lucide-react";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { getMockProducts } from "@/lib/mock/products-extended";
import { ProductFilters } from "@/modules/warehouse/products/components/product-filters";
import { useProductFilters } from "@/modules/warehouse/products/hooks/use-product-filters";
import { ProductCard } from "@/modules/warehouse/products/components/product-card";
import { ProductList } from "@/modules/warehouse/products/components/product-list";
import { ProductTable } from "@/modules/warehouse/products/components/product-table";
import { PaginationControls } from "@/components/ui/pagination-controls"; // Assuming this component exists or will be created

type DisplayMode = "grid" | "list" | "table";

export default function ProductsPage() {
  const allProducts = React.useMemo(() => getMockProducts(), []);
  const [displayMode, setDisplayMode] = React.useState<DisplayMode>("grid");

  const {
    filteredData,
    currentPage,
    totalPages,
    itemsPerPage,
    handlePageChange,
    handleItemsPerPageChange,
    handleFilterChange,
  } = useProductFilters(allProducts);

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
        <Button>
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
              <ProductFilters onFilterChange={handleFilterChange} />
            </div>
            <ToggleGroup
              type="single"
              value={displayMode}
              onValueChange={(value: DisplayMode) => value && setDisplayMode(value)}
              aria-label="Wybierz tryb wyświetlania"
            >
              <ToggleGroupItem value="grid" aria-label="Widok siatki">
                <LayoutGrid className="h-4 w-4" />
              </ToggleGroupItem>
              <ToggleGroupItem value="list" aria-label="Widok listy">
                <List className="h-4 w-4" />
              </ToggleGroupItem>
              <ToggleGroupItem value="table" aria-label="Widok tabeli">
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
        <Card>
          <CardHeader>
            <CardTitle>Lista produktów ({filteredData.length})</CardTitle>
          </CardHeader>
          <CardContent>
            {filteredData.length === 0 ? (
              <div className="py-12 text-center text-muted-foreground">
                <h3 className="mb-2 text-lg font-medium">Brak produktów</h3>
                <p>Nie znaleziono produktów spełniających kryteria filtrowania.</p>
              </div>
            ) : (
              <>
                {displayMode === "grid" && (
                  <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                    {filteredData.map((product) => (
                      <ProductCard key={product.id} product={product} />
                    ))}
                  </div>
                )}
                {displayMode === "list" && (
                  <div className="space-y-4">
                    {filteredData.map((product) => (
                      <ProductList key={product.id} product={product} />
                    ))}
                  </div>
                )}
                {displayMode === "table" && <ProductTable products={filteredData} />}
                <PaginationControls
                  currentPage={currentPage}
                  totalPages={totalPages}
                  itemsPerPage={itemsPerPage}
                  onPageChange={handlePageChange}
                  onItemsPerPageChange={handleItemsPerPageChange}
                />
              </>
            )}
          </CardContent>
        </Card>
      </motion.div>
    </div>
  );
}
