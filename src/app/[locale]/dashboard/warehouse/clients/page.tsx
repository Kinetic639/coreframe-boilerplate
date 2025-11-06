// =============================================
// Clients List Page (Customers)
// Uses business_accounts table with partner_type = 'customer'
// =============================================

"use client";

import * as React from "react";
import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Plus } from "lucide-react";
import { SuppliersAdvancedTable } from "@/modules/warehouse/suppliers/components/suppliers-advanced-table";
import { NewSupplierFormDialog } from "@/modules/warehouse/suppliers/components/new-supplier-form-dialog";
import { clientService, type ClientWithContacts } from "@/modules/warehouse/clients/api";
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

export default function ClientsPage() {
  const [isFormOpen, setIsFormOpen] = React.useState(false);
  const [selectedClient, setSelectedClient] = React.useState<ClientWithContacts | undefined>(
    undefined
  );
  const [clientToDelete, setClientToDelete] = React.useState<ClientWithContacts | undefined>(
    undefined
  );
  const [isDeleting, setIsDeleting] = React.useState(false);

  // Client data state
  const [clients, setClients] = React.useState<ClientWithContacts[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);

  const handleAddNew = () => {
    setSelectedClient(undefined);
    setIsFormOpen(true);
  };

  const handleClientSuccess = () => {
    loadClients();
  };

  const handleEdit = (client: ClientWithContacts) => {
    setSelectedClient(client);
    setIsFormOpen(true);
  };

  const handleDelete = (client: ClientWithContacts) => {
    setClientToDelete(client);
  };

  const confirmDelete = async () => {
    if (!clientToDelete) return;

    setIsDeleting(true);
    try {
      await clientService.deleteClient(clientToDelete.id);
      toast.success("Client deleted successfully");
      loadClients();
    } catch (error) {
      console.error("Error deleting client:", error);
      toast.error("Error deleting client");
    } finally {
      setIsDeleting(false);
      setClientToDelete(undefined);
    }
  };

  // Load clients from Supabase
  const loadClients = React.useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const result = await clientService.getClients({
        limit: 1000, // Load all clients for client-side filtering
      });
      setClients(result.clients);
    } catch (err) {
      console.error("Error loading clients:", err);
      setError("Error loading clients");
      setClients([]);
    } finally {
      setLoading(false);
    }
  }, []);

  // Load clients on mount
  React.useEffect(() => {
    loadClients();
  }, [loadClients]);

  return (
    <div className="space-y-6">
      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex items-center justify-between"
      >
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Clients</h1>
          <p className="text-muted-foreground">Manage your clients and customers</p>
        </div>
        <Button onClick={handleAddNew} size="default">
          <Plus className="mr-2 h-4 w-4" />
          Add Client
        </Button>
      </motion.div>

      {/* Clients Table */}
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.1 }}>
        <SuppliersAdvancedTable
          suppliers={clients}
          loading={loading}
          error={error}
          onEdit={handleEdit}
          onDelete={handleDelete}
        />
      </motion.div>

      {/* Add/Edit Dialog */}
      <NewSupplierFormDialog
        open={isFormOpen}
        onOpenChange={setIsFormOpen}
        supplier={selectedClient}
        onSuccess={() => {
          handleClientSuccess();
          setIsFormOpen(false);
        }}
      />

      {/* Delete Confirmation Dialog */}
      <AlertDialog
        open={!!clientToDelete}
        onOpenChange={(open) => !open && setClientToDelete(undefined)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Are you sure?</AlertDialogTitle>
            <AlertDialogDescription>
              This will delete the client &quot;{clientToDelete?.name}&quot;. This action cannot be
              undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isDeleting}>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={confirmDelete} disabled={isDeleting}>
              {isDeleting ? "Deleting..." : "Delete"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
