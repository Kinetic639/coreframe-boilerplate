/**
 * Product Suppliers Tab
 * Phase 0: Purchase Orders Implementation
 * Phase 1: Packaging & Ordering Constraints (Updated)
 * Displays all suppliers for a product with pricing and ordering information
 */

"use client";

import * as React from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Plus, MoreVertical, Star, Edit, Trash2, TrendingUp, Clock, Package } from "lucide-react";
import { toast } from "react-toastify";
import type { ProductSupplierWithRelations } from "../../types/product-suppliers";
import {
  getProductSuppliersAction,
  removeSupplierAction,
  setPreferredSupplierAction,
} from "../actions/product-suppliers-actions";
import { AddProductSupplierDialog } from "./add-product-supplier-dialog";

interface ProductSuppliersTabProps {
  productId: string;
}

export function ProductSuppliersTab({ productId }: ProductSuppliersTabProps) {
  const [suppliers, setSuppliers] = React.useState<ProductSupplierWithRelations[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [isAddDialogOpen, setIsAddDialogOpen] = React.useState(false);
  const [editingSupplier, setEditingSupplier] = React.useState<ProductSupplierWithRelations | null>(
    null
  );

  const loadSuppliers = React.useCallback(async () => {
    setLoading(true);
    try {
      const result = await getProductSuppliersAction(productId, false); // Include inactive
      if (result.success && result.data) {
        setSuppliers(result.data);
      } else {
        throw new Error(result.error || "Failed to load suppliers");
      }
    } catch (error) {
      console.error("Error loading suppliers:", error);
      toast.error("Failed to load suppliers");
    } finally {
      setLoading(false);
    }
  }, [productId]);

  React.useEffect(() => {
    loadSuppliers();
  }, [loadSuppliers]);

  const handleAdd = () => {
    setEditingSupplier(null);
    setIsAddDialogOpen(true);
  };

  const handleEdit = (supplier: ProductSupplierWithRelations) => {
    setEditingSupplier(supplier);
    setIsAddDialogOpen(true);
  };

  const handleRemove = async (supplier: ProductSupplierWithRelations) => {
    if (!confirm(`Remove ${supplier.supplier.name} as a supplier?`)) return;

    try {
      const result = await removeSupplierAction(supplier.id);
      if (!result.success) {
        throw new Error(result.error || "Failed to remove supplier");
      }
      toast.success("Supplier removed successfully");
      loadSuppliers();
    } catch (error) {
      console.error("Error removing supplier:", error);
      toast.error(error instanceof Error ? error.message : "Failed to remove supplier");
    }
  };

  const handleSetPreferred = async (supplier: ProductSupplierWithRelations) => {
    try {
      const result = await setPreferredSupplierAction(productId, supplier.supplier_id);
      if (!result.success) {
        throw new Error(result.error || "Failed to set preferred supplier");
      }
      toast.success(`${supplier.supplier.name} set as preferred supplier`);
      loadSuppliers();
    } catch (error) {
      console.error("Error setting preferred supplier:", error);
      toast.error(error instanceof Error ? error.message : "Failed to set preferred supplier");
    }
  };

  const formatCurrency = (amount: number, currency: string) => {
    return new Intl.NumberFormat("pl-PL", {
      style: "currency",
      currency: currency || "PLN",
    }).format(amount);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-8">
        <div className="text-sm text-muted-foreground">Loading suppliers...</div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <AddProductSupplierDialog
        open={isAddDialogOpen}
        onOpenChange={setIsAddDialogOpen}
        onSuccess={loadSuppliers}
        productId={productId}
        supplier={editingSupplier}
      />

      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-medium">Suppliers</h3>
          <p className="text-sm text-muted-foreground">
            Manage suppliers and pricing for this product
          </p>
        </div>
        <Button onClick={handleAdd} size="sm">
          <Plus className="mr-2 h-4 w-4" />
          Add Supplier
        </Button>
      </div>

      {suppliers.length === 0 ? (
        <div className="rounded-lg border border-dashed p-8 text-center">
          <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-muted">
            <TrendingUp className="h-6 w-6 text-muted-foreground" />
          </div>
          <h3 className="mb-1 text-sm font-medium">No suppliers configured</h3>
          <p className="mb-4 text-sm text-muted-foreground">
            Add suppliers to track pricing and ordering information
          </p>
          <Button onClick={handleAdd} variant="outline" size="sm">
            <Plus className="mr-2 h-4 w-4" />
            Add First Supplier
          </Button>
        </div>
      ) : (
        <div className="rounded-lg border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Supplier</TableHead>
                <TableHead>Supplier SKU</TableHead>
                <TableHead className="text-right">Unit Price</TableHead>
                <TableHead className="text-center">Lead Time</TableHead>
                <TableHead className="text-center">Packaging</TableHead>
                <TableHead className="text-center">Status</TableHead>
                <TableHead className="w-[70px]"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {suppliers.map((supplier) => (
                <TableRow key={supplier.id}>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      {supplier.is_preferred && (
                        <Star className="h-4 w-4 fill-yellow-400 text-yellow-400" />
                      )}
                      <div>
                        <div className="font-medium">{supplier.supplier.name}</div>
                        {supplier.supplier_product_name && (
                          <div className="text-xs text-muted-foreground">
                            {supplier.supplier_product_name}
                          </div>
                        )}
                      </div>
                    </div>
                  </TableCell>
                  <TableCell>
                    <span className="text-sm text-muted-foreground">
                      {supplier.supplier_sku || "-"}
                    </span>
                  </TableCell>
                  <TableCell className="text-right">
                    <span className="font-medium">
                      {formatCurrency(supplier.unit_price, supplier.currency_code)}
                    </span>
                  </TableCell>
                  <TableCell className="text-center">
                    <div className="flex items-center justify-center gap-1 text-sm text-muted-foreground">
                      <Clock className="h-3 w-3" />
                      {supplier.supplier_lead_time_days || supplier.lead_time_days} days
                    </div>
                  </TableCell>
                  <TableCell className="text-center">
                    {supplier.package_unit && supplier.package_quantity ? (
                      <div className="flex items-center justify-center gap-1 text-sm">
                        <Package className="h-3 w-3 text-green-600" />
                        <span className="font-medium">
                          {supplier.package_quantity} / {supplier.package_unit}
                        </span>
                        {!supplier.allow_partial_package && (
                          <Badge variant="outline" className="ml-1 text-xs">
                            Full only
                          </Badge>
                        )}
                      </div>
                    ) : supplier.min_order_quantity ? (
                      <span className="text-xs text-muted-foreground">
                        MOQ: {supplier.min_order_quantity}
                      </span>
                    ) : (
                      <span className="text-xs text-muted-foreground">-</span>
                    )}
                  </TableCell>
                  <TableCell className="text-center">
                    <Badge variant={supplier.is_active ? "default" : "secondary"}>
                      {supplier.is_active ? "Active" : "Inactive"}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon">
                          <MoreVertical className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={() => handleEdit(supplier)}>
                          <Edit className="mr-2 h-4 w-4" />
                          Edit
                        </DropdownMenuItem>
                        {!supplier.is_preferred && (
                          <DropdownMenuItem onClick={() => handleSetPreferred(supplier)}>
                            <Star className="mr-2 h-4 w-4" />
                            Set as Preferred
                          </DropdownMenuItem>
                        )}
                        <DropdownMenuItem
                          className="text-red-600"
                          onClick={() => handleRemove(supplier)}
                        >
                          <Trash2 className="mr-2 h-4 w-4" />
                          Remove
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      {suppliers.length > 0 && (
        <div className="flex items-center justify-between text-sm text-muted-foreground">
          <div>
            {suppliers.filter((s) => s.is_active).length} active supplier(s) •{" "}
            {suppliers.filter((s) => s.is_preferred).length} preferred
          </div>
        </div>
      )}
    </div>
  );
}
