"use client";

import * as React from "react";
import { Suspense } from "react";
import { motion } from "framer-motion";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Plus, LayoutGrid, List, Table as TableIcon } from "lucide-react";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { SupplierFilters } from "@/modules/warehouse/suppliers/components/supplier-filters";
import { SupplierCard } from "@/modules/warehouse/suppliers/components/supplier-card";
import { SupplierList } from "@/modules/warehouse/suppliers/components/supplier-list";
import { SupplierTable } from "@/modules/warehouse/suppliers/components/supplier-table";
import { NewSupplierFormDialog } from "@/modules/warehouse/suppliers/components/new-supplier-form-dialog";
import { supplierService, Supplier } from "@/modules/warehouse/suppliers/api";
import { PaginationControls } from "@/components/ui/pagination-controls";
import { useSearchParams } from "next/navigation";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "sonner";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

type DisplayMode = "grid" | "list" | "table";

function SupplierLoadingSkeleton() {
  return (
    <div className="space-y-4">
      {Array.from({ length: 6 }).map((_, i) => (
        <div key={i} className="flex items-center space-x-4 p-4">
          <Skeleton className="h-12 w-12 rounded" />
          <div className="space-y-2">
            <Skeleton className="h-4 w-[200px]" />
            <Skeleton className="h-4 w-[150px]" />
          </div>
        </div>
      ))}
    </div>
  );
}

export default function SuppliersListPage() {
  const [displayMode, setDisplayMode] = React.useState<DisplayMode>("list");
  const [isFormOpen, setIsFormOpen] = React.useState(false);
  const [selectedSupplier, setSelectedSupplier] = React.useState<Supplier | undefined>(undefined);
  const [supplierToDelete, setSupplierToDelete] = React.useState<Supplier | undefined>(undefined);
  const [isDeleting, setIsDeleting] = React.useState(false);

  // Supplier data state
  const [suppliers, setSuppliers] = React.useState<any[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);

  // Pagination state
  const [currentPage, setCurrentPage] = React.useState(1);
  const [itemsPerPage, setItemsPerPage] = React.useState(12);
  const [totalSuppliers, setTotalSuppliers] = React.useState(0);

  // Filter state
  const searchParams = useSearchParams();
  const [currentFilters, setCurrentFilters] = React.useState<{
    search?: string;
    active?: boolean;
    preferred?: boolean;
  }>({});

  const handleAddNew = () => {
    setSelectedSupplier(undefined);
    setIsFormOpen(true);
  };

  const handleSupplierSuccess = () => {
    loadSuppliers();
  };

  const handleEdit = (supplier: Supplier) => {
    setSelectedSupplier(supplier);
    setIsFormOpen(true);
  };

  const handleDelete = (supplier: Supplier) => {
    setSupplierToDelete(supplier);
  };

  const confirmDelete = async () => {
    if (!supplierToDelete) return;

    setIsDeleting(true);
    try {
      await supplierService.deleteSupplier(supplierToDelete.id);
      toast.success("Dostawca został usunięty");
      loadSuppliers();
    } catch (error) {
      console.error("Error deleting supplier:", error);
      toast.error("Błąd podczas usuwania dostawcy");
    } finally {
      setIsDeleting(false);
      setSupplierToDelete(undefined);
    }
  };

  // Load suppliers from Supabase
  const loadSuppliers = React.useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const filters = {
        search: currentFilters.search,
        active: currentFilters.active,
        preferred: currentFilters.preferred,
        limit: itemsPerPage,
        offset: (currentPage - 1) * itemsPerPage,
      };

      const result = await supplierService.getSuppliers(filters);
      setSuppliers(result.suppliers);
      setTotalSuppliers(result.total);
    } catch (err) {
      console.error("Error loading suppliers:", err);
      setError("Błąd podczas ładowania dostawców");
      setSuppliers([]);
    } finally {
      setLoading(false);
    }
  }, [currentFilters, currentPage, itemsPerPage]);

  // Load suppliers when dependencies change
  React.useEffect(() => {
    loadSuppliers();
  }, [loadSuppliers]);

  // Handle pagination
  const handlePageChange = (page: number) => {
    setCurrentPage(page);
  };

  const handleItemsPerPageChange = (newItemsPerPage: number) => {
    setItemsPerPage(newItemsPerPage);
    setCurrentPage(1); // Reset to first page
  };

  const totalPages = Math.ceil(totalSuppliers / itemsPerPage);

  // Update filters from URL params
  React.useEffect(() => {
    const filtersFromUrl = {
      search: searchParams.get("search") || undefined,
      active: searchParams.get("active") === "true" || undefined,
      preferred: searchParams.get("preferred") === "true" || undefined,
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
          <h1 className="text-3xl font-bold tracking-tight">Dostawcy</h1>
          <p className="text-muted-foreground">Zarządzanie dostawcami i kontaktami biznesowymi</p>
        </div>
        <Button onClick={handleAddNew}>
          <Plus className="mr-2 h-4 w-4" />
          Dodaj dostawcę
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
              <SupplierFilters onFilterChange={setCurrentFilters} />
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

      {/* Supplier Listing */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2 }}
      >
        <Suspense fallback={<SupplierLoadingSkeleton />}>
          <Card>
            <CardHeader>
              <CardTitle>Lista dostawców ({loading ? "..." : totalSuppliers})</CardTitle>
            </CardHeader>
            <CardContent>
              {loading ? (
                <SupplierLoadingSkeleton />
              ) : error ? (
                <div className="py-12 text-center text-muted-foreground">
                  <h3 className="mb-2 text-lg font-medium text-red-600">Błąd</h3>
                  <p>{error}</p>
                  <Button onClick={loadSuppliers} variant="outline" className="mt-4">
                    Spróbuj ponownie
                  </Button>
                </div>
              ) : suppliers.length === 0 ? (
                <div className="py-12 text-center text-muted-foreground">
                  <h3 className="mb-2 text-lg font-medium">Brak dostawców</h3>
                  <p>
                    {currentFilters.search || currentFilters.active || currentFilters.preferred
                      ? "Nie znaleziono dostawców spełniających kryteria filtrowania."
                      : "Nie dodano jeszcze żadnych dostawców."}
                  </p>
                  {!currentFilters.search &&
                    !currentFilters.active &&
                    !currentFilters.preferred && (
                      <Button onClick={handleAddNew} className="mt-4">
                        <Plus className="mr-2 h-4 w-4" />
                        Dodaj pierwszego dostawcę
                      </Button>
                    )}
                </div>
              ) : (
                <>
                  {displayMode === "grid" && (
                    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                      {suppliers.map((supplier) => (
                        <SupplierCard
                          key={supplier.id}
                          supplier={supplier as any}
                          onEdit={handleEdit}
                          onDelete={handleDelete}
                        />
                      ))}
                    </div>
                  )}
                  {displayMode === "list" && (
                    <div className="space-y-4">
                      {suppliers.map((supplier) => (
                        <SupplierList
                          key={supplier.id}
                          supplier={supplier as any}
                          onEdit={handleEdit}
                          onDelete={handleDelete}
                        />
                      ))}
                    </div>
                  )}
                  {displayMode === "table" && (
                    <SupplierTable
                      suppliers={suppliers as any}
                      onEdit={handleEdit}
                      onDelete={handleDelete}
                    />
                  )}
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
      <NewSupplierFormDialog
        open={isFormOpen}
        onOpenChange={setIsFormOpen}
        supplier={selectedSupplier as any}
        onSuccess={handleSupplierSuccess}
      />

      <AlertDialog open={!!supplierToDelete} onOpenChange={() => setSupplierToDelete(undefined)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Czy na pewno chcesz usunąć dostawcę?</AlertDialogTitle>
            <AlertDialogDescription>
              Ta akcja nie może być cofnięta. Dostawca "{supplierToDelete?.name}" zostanie oznaczony
              jako usunięty.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isDeleting}>Anuluj</AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmDelete}
              disabled={isDeleting}
              className="bg-red-600 hover:bg-red-700"
            >
              {isDeleting ? "Usuwanie..." : "Usuń dostawcę"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
