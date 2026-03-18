// =============================================
// Create Movement Dialog Component
// Form for creating new stock movements
// =============================================

"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Loader2, AlertCircle, Plus } from "lucide-react";
import { MovementTypeSelector } from "./movement-type-selector";
import { toast } from "react-toastify";
import type { CreateStockMovementData, MovementCategory } from "../types/stock-movements";

interface CreateMovementDialogProps {
  organizationId: string;
  branchId: string;
  productId?: string;
  category?: MovementCategory;
  onSuccess?: (movementId: string) => void;
  trigger?: React.ReactNode;
}

export function CreateMovementDialog({
  organizationId,
  branchId,
  productId,
  category,
  onSuccess,
  trigger,
}: CreateMovementDialogProps) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState<string[]>([]);
  const [warnings, setWarnings] = useState<string[]>([]);

  const {
    register,
    handleSubmit,
    watch,
    setValue,
    reset,
    formState: { errors: formErrors },
  } = useForm<CreateStockMovementData>({
    defaultValues: {
      organization_id: organizationId,
      branch_id: branchId,
      product_id: productId || "",
      quantity: 1,
      currency: "PLN",
    },
  });

  const movementTypeCode = watch("movement_type_code");

  const onSubmit = async (data: CreateStockMovementData) => {
    try {
      setLoading(true);
      setErrors([]);
      setWarnings([]);

      // Call server action to create movement
      const response = await fetch("/api/warehouse/movements/create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });

      const result = await response.json();

      if (!response.ok) {
        if (result.errors) {
          setErrors(result.errors);
        }
        if (result.warnings) {
          setWarnings(result.warnings);
        }
        toast.error("Failed to create movement");
        return;
      }

      toast.success("Movement created successfully");
      reset();
      setOpen(false);
      onSuccess?.(result.id);
    } catch (error) {
      console.error("Error creating movement:", error);
      toast.error("An error occurred while creating the movement");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {trigger || (
          <Button>
            <Plus className="mr-2 h-4 w-4" />
            Create Movement
          </Button>
        )}
      </DialogTrigger>

      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Create Stock Movement</DialogTitle>
          <DialogDescription>
            Create a new stock movement. All fields marked with * are required.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          {/* Errors */}
          {errors.length > 0 && (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>
                <ul className="list-disc list-inside space-y-1">
                  {errors.map((error, index) => (
                    <li key={index}>{error}</li>
                  ))}
                </ul>
              </AlertDescription>
            </Alert>
          )}

          {/* Warnings */}
          {warnings.length > 0 && (
            <Alert>
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>
                <ul className="list-disc list-inside space-y-1">
                  {warnings.map((warning, index) => (
                    <li key={index}>{warning}</li>
                  ))}
                </ul>
              </AlertDescription>
            </Alert>
          )}

          {/* Movement Type */}
          <div className="space-y-2">
            <Label htmlFor="movement_type_code">Movement Type *</Label>
            <MovementTypeSelector
              value={movementTypeCode}
              onChange={(value) => setValue("movement_type_code", value)}
              category={category}
              allowManualEntryOnly={true}
            />
            {formErrors.movement_type_code && (
              <p className="text-sm text-destructive">{formErrors.movement_type_code.message}</p>
            )}
          </div>

          {/* Product ID (if not pre-filled) */}
          {!productId && (
            <div className="space-y-2">
              <Label htmlFor="product_id">Product ID *</Label>
              <Input
                id="product_id"
                {...register("product_id", { required: "Product is required" })}
                placeholder="Enter product ID"
              />
              {formErrors.product_id && (
                <p className="text-sm text-destructive">{formErrors.product_id.message}</p>
              )}
            </div>
          )}

          {/* Quantity */}
          <div className="space-y-2">
            <Label htmlFor="quantity">Quantity *</Label>
            <Input
              id="quantity"
              type="number"
              step="0.0001"
              {...register("quantity", {
                required: "Quantity is required",
                min: { value: 0.0001, message: "Quantity must be greater than 0" },
              })}
              placeholder="Enter quantity"
            />
            {formErrors.quantity && (
              <p className="text-sm text-destructive">{formErrors.quantity.message}</p>
            )}
          </div>

          {/* Unit of Measure */}
          <div className="space-y-2">
            <Label htmlFor="unit_of_measure">Unit of Measure</Label>
            <Input
              id="unit_of_measure"
              {...register("unit_of_measure")}
              placeholder="pcs, kg, m, etc."
            />
          </div>

          {/* Locations */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="source_location_id">Source Location</Label>
              <Input
                id="source_location_id"
                {...register("source_location_id")}
                placeholder="Source location ID"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="destination_location_id">Destination Location</Label>
              <Input
                id="destination_location_id"
                {...register("destination_location_id")}
                placeholder="Destination location ID"
              />
            </div>
          </div>

          {/* Cost */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="unit_cost">Unit Cost</Label>
              <Input
                id="unit_cost"
                type="number"
                step="0.01"
                {...register("unit_cost", { valueAsNumber: true })}
                placeholder="0.00"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="currency">Currency</Label>
              <Input id="currency" {...register("currency")} placeholder="PLN" />
            </div>
          </div>

          {/* Notes */}
          <div className="space-y-2">
            <Label htmlFor="notes">Notes</Label>
            <Textarea
              id="notes"
              {...register("notes")}
              placeholder="Additional notes or comments"
              rows={3}
            />
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={loading}>
              {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Create Movement
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
