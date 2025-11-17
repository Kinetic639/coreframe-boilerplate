/**
 * Add/Edit Product Supplier Dialog
 * Phase 0: Purchase Orders Implementation
 * Phase 1: Packaging & Ordering Constraints (Updated)
 */

"use client";

import * as React from "react";
import { useForm } from "react-hook-form";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { toast } from "react-toastify";
import { Loader2, Package, AlertCircle } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import type {
  ProductSupplierFormData,
  ProductSupplierWithRelations,
} from "../../types/product-suppliers";
import { PACKAGE_UNITS } from "../../types/packaging";
import {
  addSupplierToProductAction,
  updateSupplierAction,
} from "../actions/product-suppliers-actions";
import { supplierService } from "../../suppliers/api";
import type { BusinessAccount } from "../../suppliers/api";
import { useAppStore } from "@/lib/stores/app-store";

interface AddProductSupplierDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
  productId: string;
  supplier?: ProductSupplierWithRelations | null;
}

export function AddProductSupplierDialog({
  open,
  onOpenChange,
  onSuccess,
  productId,
  supplier,
}: AddProductSupplierDialogProps) {
  const { activeOrgId } = useAppStore();
  const [isSubmitting, setIsSubmitting] = React.useState(false);
  const [suppliers, setSuppliers] = React.useState<BusinessAccount[]>([]);
  const [loadingSuppliers, setLoadingSuppliers] = React.useState(false);

  const isEditMode = !!supplier;

  const {
    register,
    handleSubmit,
    setValue,
    watch,
    reset,
    formState: { errors },
  } = useForm<ProductSupplierFormData>({
    defaultValues: {
      supplier_id: supplier?.supplier_id || "",
      supplier_sku: supplier?.supplier_sku || "",
      supplier_product_name: supplier?.supplier_product_name || "",
      supplier_product_description: supplier?.supplier_product_description || "",
      unit_price: supplier?.unit_price || 0,
      currency_code: supplier?.currency_code || "PLN",
      price_valid_from: supplier?.price_valid_from || new Date().toISOString().split("T")[0],
      price_valid_until: supplier?.price_valid_until || "",
      lead_time_days: supplier?.lead_time_days ?? 0,
      min_order_qty: supplier?.min_order_qty ?? 1,
      order_multiple: supplier?.order_multiple ?? 1,
      is_preferred: supplier?.is_preferred ?? false,
      is_active: supplier?.is_active ?? true,
      priority_rank: supplier?.priority_rank ?? 0,
      notes: supplier?.notes || "",
      // Phase 1: Packaging fields
      package_unit: supplier?.package_unit || "",
      package_quantity: supplier?.package_quantity || undefined,
      allow_partial_package: supplier?.allow_partial_package ?? true,
      min_order_quantity: supplier?.min_order_quantity || undefined,
      order_in_multiples_of: supplier?.order_in_multiples_of || undefined,
      supplier_lead_time_days: supplier?.supplier_lead_time_days || undefined,
      supplier_price: supplier?.supplier_price || undefined,
    },
  });

  const selectedSupplierId = watch("supplier_id");
  const isPreferred = watch("is_preferred");
  const packageQuantity = watch("package_quantity");
  const allowPartialPackage = watch("allow_partial_package");

  // Load suppliers (vendors)
  React.useEffect(() => {
    if (open && activeOrgId && !isEditMode) {
      setLoadingSuppliers(true);
      supplierService
        .getSuppliers({ active: true, partner_type: "vendor" }, activeOrgId) // Pass organizationId explicitly
        .then((result) => setSuppliers(result.suppliers))
        .catch((error) => {
          console.error("Failed to load suppliers:", error);
          toast.error("Failed to load suppliers");
        })
        .finally(() => setLoadingSuppliers(false));
    }
  }, [open, activeOrgId, isEditMode]);

  // Reset form when dialog opens/closes
  React.useEffect(() => {
    if (open) {
      reset({
        supplier_id: supplier?.supplier_id || "",
        supplier_sku: supplier?.supplier_sku || "",
        supplier_product_name: supplier?.supplier_product_name || "",
        supplier_product_description: supplier?.supplier_product_description || "",
        unit_price: supplier?.unit_price || 0,
        currency_code: supplier?.currency_code || "PLN",
        price_valid_from: supplier?.price_valid_from || new Date().toISOString().split("T")[0],
        price_valid_until: supplier?.price_valid_until || "",
        lead_time_days: supplier?.lead_time_days ?? 0,
        min_order_qty: supplier?.min_order_qty ?? 1,
        order_multiple: supplier?.order_multiple ?? 1,
        is_preferred: supplier?.is_preferred ?? false,
        is_active: supplier?.is_active ?? true,
        priority_rank: supplier?.priority_rank ?? 0,
        notes: supplier?.notes || "",
        // Phase 1: Packaging fields
        package_unit: supplier?.package_unit || "",
        package_quantity: supplier?.package_quantity || undefined,
        allow_partial_package: supplier?.allow_partial_package ?? true,
        min_order_quantity: supplier?.min_order_quantity || undefined,
        order_in_multiples_of: supplier?.order_in_multiples_of || undefined,
        supplier_lead_time_days: supplier?.supplier_lead_time_days || undefined,
        supplier_price: supplier?.supplier_price || undefined,
      });
    }
  }, [open, supplier, reset]);

  const onSubmit = async (data: ProductSupplierFormData) => {
    setIsSubmitting(true);
    try {
      if (isEditMode && supplier) {
        const result = await updateSupplierAction(supplier.id, data);
        if (!result.success) {
          throw new Error(result.error || "Failed to update supplier");
        }
        toast.success("Supplier updated successfully");
      } else {
        const result = await addSupplierToProductAction(productId, data);
        if (!result.success) {
          throw new Error(result.error || "Failed to add supplier");
        }
        toast.success("Supplier added successfully");
      }

      onSuccess();
      onOpenChange(false);
      reset();
    } catch (error) {
      console.error("Error saving supplier:", error);
      toast.error(error instanceof Error ? error.message : "Failed to save supplier");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] max-w-2xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{isEditMode ? "Edit Supplier" : "Add Supplier to Product"}</DialogTitle>
          <DialogDescription>
            {isEditMode
              ? "Update supplier relationship details"
              : "Add a new supplier for this product with pricing and ordering information"}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
          {/* Supplier Selection */}
          {!isEditMode && (
            <div className="space-y-2">
              <Label htmlFor="supplier_id">
                Supplier <span className="text-red-500">*</span>
              </Label>
              {loadingSuppliers ? (
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Loading suppliers...
                </div>
              ) : (
                <Select
                  value={selectedSupplierId}
                  onValueChange={(value) => setValue("supplier_id", value)}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select a supplier" />
                  </SelectTrigger>
                  <SelectContent>
                    {suppliers.map((s) => (
                      <SelectItem key={s.id} value={s.id}>
                        {s.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
              {errors.supplier_id && (
                <p className="text-sm text-red-500">{errors.supplier_id.message}</p>
              )}
            </div>
          )}

          {/* Supplier-Specific Product Info */}
          <div className="space-y-4">
            <h3 className="text-sm font-medium">Supplier Product Information</h3>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="supplier_sku">Supplier SKU</Label>
                <Input id="supplier_sku" {...register("supplier_sku")} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="supplier_product_name">Supplier Product Name</Label>
                <Input id="supplier_product_name" {...register("supplier_product_name")} />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="supplier_product_description">Description</Label>
              <Textarea
                id="supplier_product_description"
                {...register("supplier_product_description")}
                rows={2}
              />
            </div>
          </div>

          {/* Pricing */}
          <div className="space-y-4">
            <h3 className="text-sm font-medium">Pricing</h3>
            <div className="grid gap-4 sm:grid-cols-3">
              <div className="space-y-2">
                <Label htmlFor="unit_price">
                  Unit Price <span className="text-red-500">*</span>
                </Label>
                <Input
                  id="unit_price"
                  type="number"
                  step="0.01"
                  {...register("unit_price", {
                    required: "Unit price is required",
                    min: { value: 0, message: "Price must be positive" },
                    valueAsNumber: true,
                  })}
                />
                {errors.unit_price && (
                  <p className="text-sm text-red-500">{errors.unit_price.message}</p>
                )}
              </div>
              <div className="space-y-2">
                <Label htmlFor="currency_code">Currency</Label>
                <Select
                  value={watch("currency_code")}
                  onValueChange={(value) => setValue("currency_code", value)}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="PLN">PLN</SelectItem>
                    <SelectItem value="EUR">EUR</SelectItem>
                    <SelectItem value="USD">USD</SelectItem>
                    <SelectItem value="GBP">GBP</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="price_valid_from">Valid From</Label>
                <Input id="price_valid_from" type="date" {...register("price_valid_from")} />
              </div>
            </div>
          </div>

          {/* Ordering Parameters */}
          <div className="space-y-4">
            <h3 className="text-sm font-medium">Ordering Parameters (Legacy)</h3>
            <div className="grid gap-4 sm:grid-cols-3">
              <div className="space-y-2">
                <Label htmlFor="lead_time_days">Lead Time (days)</Label>
                <Input
                  id="lead_time_days"
                  type="number"
                  {...register("lead_time_days", { valueAsNumber: true })}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="min_order_qty">Min Order Qty (Legacy)</Label>
                <Input
                  id="min_order_qty"
                  type="number"
                  step="0.001"
                  {...register("min_order_qty", { valueAsNumber: true })}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="order_multiple">Order Multiple (Legacy)</Label>
                <Input
                  id="order_multiple"
                  type="number"
                  step="0.001"
                  {...register("order_multiple", { valueAsNumber: true })}
                />
              </div>
            </div>
          </div>

          {/* Phase 1: Packaging & Ordering Constraints */}
          <div className="space-y-4 rounded-lg border border-green-200 bg-green-50/50 p-4">
            <div className="flex items-center gap-2">
              <Package className="h-5 w-5 text-green-600" />
              <h3 className="text-sm font-medium text-green-900">
                Packaging & Ordering Constraints
              </h3>
            </div>
            <Alert>
              <AlertCircle className="h-4 w-4" />
              <AlertDescription className="text-xs">
                Configure supplier-specific packaging rules. These constraints will be automatically
                applied when calculating order quantities.
              </AlertDescription>
            </Alert>

            {/* Packaging Information */}
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="package_unit">Package Unit</Label>
                <Select
                  value={watch("package_unit") || ""}
                  onValueChange={(value) => setValue("package_unit", value)}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select package type" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="">None</SelectItem>
                    {Object.entries(PACKAGE_UNITS).map(([key, label]) => (
                      <SelectItem key={key} value={key}>
                        {label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground">E.g., Box, Case, Pallet, Drum</p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="package_quantity">Units per Package</Label>
                <Input
                  id="package_quantity"
                  type="number"
                  step="0.001"
                  placeholder="E.g., 12"
                  {...register("package_quantity", { valueAsNumber: true })}
                />
                <p className="text-xs text-muted-foreground">How many base units in one package?</p>
              </div>
            </div>

            {/* Partial Package Option */}
            {packageQuantity && packageQuantity > 0 && (
              <div className="flex items-center space-x-2 rounded-md border border-green-200 bg-white p-3">
                <Checkbox
                  id="allow_partial_package"
                  checked={allowPartialPackage}
                  onCheckedChange={(checked) => setValue("allow_partial_package", !!checked)}
                />
                <div className="flex-1">
                  <Label htmlFor="allow_partial_package" className="cursor-pointer font-normal">
                    Allow partial packages
                  </Label>
                  <p className="text-xs text-muted-foreground">
                    {allowPartialPackage
                      ? "Can order individual units (e.g., 15 pieces instead of 2 full boxes)"
                      : "Must order full packages only"}
                  </p>
                </div>
              </div>
            )}

            {/* Ordering Constraints */}
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="min_order_quantity">Minimum Order Quantity</Label>
                <Input
                  id="min_order_quantity"
                  type="number"
                  step="0.001"
                  placeholder="E.g., 50"
                  {...register("min_order_quantity", { valueAsNumber: true })}
                />
                <p className="text-xs text-muted-foreground">Minimum units that must be ordered</p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="order_in_multiples_of">Order in Multiples Of</Label>
                <Input
                  id="order_in_multiples_of"
                  type="number"
                  step="0.001"
                  placeholder="E.g., 10"
                  {...register("order_in_multiples_of", { valueAsNumber: true })}
                />
                <p className="text-xs text-muted-foreground">E.g., must order in multiples of 10</p>
              </div>
            </div>

            {/* Supplier-Specific Lead Time and Price */}
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="supplier_lead_time_days">Supplier Lead Time (days)</Label>
                <Input
                  id="supplier_lead_time_days"
                  type="number"
                  placeholder="Optional"
                  {...register("supplier_lead_time_days", { valueAsNumber: true })}
                />
                <p className="text-xs text-muted-foreground">
                  Overrides product's global lead time
                </p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="supplier_price">Supplier Price (optional)</Label>
                <Input
                  id="supplier_price"
                  type="number"
                  step="0.01"
                  placeholder="Optional"
                  {...register("supplier_price", { valueAsNumber: true })}
                />
                <p className="text-xs text-muted-foreground">
                  Price per base unit (if different from unit_price)
                </p>
              </div>
            </div>
          </div>

          {/* Preferences */}
          <div className="space-y-4">
            <h3 className="text-sm font-medium">Preferences</h3>
            <div className="flex items-center space-x-2">
              <Checkbox
                id="is_preferred"
                checked={isPreferred}
                onCheckedChange={(checked) => setValue("is_preferred", !!checked)}
              />
              <Label htmlFor="is_preferred" className="cursor-pointer">
                Set as preferred supplier
              </Label>
            </div>
            <div className="space-y-2">
              <Label htmlFor="priority_rank">Priority Rank (0 = highest)</Label>
              <Input
                id="priority_rank"
                type="number"
                {...register("priority_rank", { valueAsNumber: true })}
              />
            </div>
          </div>

          {/* Notes */}
          <div className="space-y-2">
            <Label htmlFor="notes">Notes</Label>
            <Textarea id="notes" {...register("notes")} rows={3} />
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {isEditMode ? "Update Supplier" : "Add Supplier"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
