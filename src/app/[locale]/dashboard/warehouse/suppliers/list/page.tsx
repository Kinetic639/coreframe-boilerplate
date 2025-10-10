"use client";

import * as React from "react";
import { motion } from "framer-motion";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Plus } from "lucide-react";
import { SuppliersAdvancedTable } from "@/modules/warehouse/suppliers/components/suppliers-advanced-table";
import { NewSupplierFormDialog } from "@/modules/warehouse/suppliers/components/new-supplier-form-dialog";
import { supplierService, SupplierWithContacts } from "@/modules/warehouse/suppliers/api";
import { toast } from "react-toastify";
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

export default function SuppliersListPage() {
  const [isFormOpen, setIsFormOpen] = React.useState(false);
  const [selectedSupplier, setSelectedSupplier] = React.useState<SupplierWithContacts | undefined>(
    undefined
  );
  const [supplierToDelete, setSupplierToDelete] = React.useState<SupplierWithContacts | undefined>(
    undefined
  );
  const [isDeleting, setIsDeleting] = React.useState(false);

  // Supplier data state
  const [suppliers, setSuppliers] = React.useState<SupplierWithContacts[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);

  const handleAddNew = () => {
    setSelectedSupplier(undefined);
    setIsFormOpen(true);
  };

  const handleSupplierSuccess = () => {
    loadSuppliers();
  };

  const handleEdit = (supplier: SupplierWithContacts) => {
    setSelectedSupplier(supplier);
    setIsFormOpen(true);
  };

  const handleDelete = (supplier: SupplierWithContacts) => {
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
      const result = await supplierService.getSuppliers({
        limit: 1000, // Load all suppliers for client-side filtering
      });
      setSuppliers(result.suppliers);
    } catch (err) {
      console.error("Error loading suppliers:", err);
      setError("Błąd podczas ładowania dostawców");
      setSuppliers([]);
    } finally {
      setLoading(false);
    }
  }, []);

  // Load suppliers on mount
  React.useEffect(() => {
    loadSuppliers();
  }, [loadSuppliers]);

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
        <Button onClick={handleAddNew} size="lg">
          <Plus className="mr-2 h-4 w-4" />
          Dodaj dostawcę
        </Button>
      </motion.div>

      {/* Advanced Data Table */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
      >
        <Card>
          <CardContent className="p-6">
            <SuppliersAdvancedTable
              suppliers={suppliers}
              loading={loading}
              error={error}
              onEdit={handleEdit}
              onDelete={handleDelete}
            />
          </CardContent>
        </Card>
      </motion.div>

      {/* Dialogs */}
      <NewSupplierFormDialog
        open={isFormOpen}
        onOpenChange={setIsFormOpen}
        supplier={selectedSupplier}
        onSuccess={handleSupplierSuccess}
      />

      <AlertDialog open={!!supplierToDelete} onOpenChange={() => setSupplierToDelete(undefined)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Czy na pewno chcesz usunąć dostawcę?</AlertDialogTitle>
            <AlertDialogDescription>
              Ta akcja nie może być cofnięta. Dostawca &quot;{supplierToDelete?.name}&quot; zostanie
              oznaczony jako usunięty.
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
