"use client";

import * as React from "react";
import { SuppliersAdvancedTable } from "@/modules/warehouse/suppliers/components/suppliers-advanced-table";
import { type ClientWithContacts } from "../api";

interface ClientsTableProps {
  clients: ClientWithContacts[];
  loading: boolean;
  error: string | null;
  onEdit: (client: ClientWithContacts) => void;
  onDelete: (client: ClientWithContacts) => void;
}

export function ClientsTable({ clients, loading, error, onEdit, onDelete }: ClientsTableProps) {
  // Override the suppliers table messages for clients
  if (loading) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4" />
          <p className="text-muted-foreground">Loading clients...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="text-center">
          <p className="text-destructive">{error}</p>
        </div>
      </div>
    );
  }

  if (clients.length === 0) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="text-center">
          <p className="text-muted-foreground text-lg mb-2">No clients found</p>
          <p className="text-sm text-muted-foreground">Add your first client to get started</p>
        </div>
      </div>
    );
  }

  // Use the suppliers table component for rendering
  return (
    <SuppliersAdvancedTable
      suppliers={clients}
      loading={false}
      error={null}
      onEdit={onEdit}
      onDelete={onDelete}
    />
  );
}
