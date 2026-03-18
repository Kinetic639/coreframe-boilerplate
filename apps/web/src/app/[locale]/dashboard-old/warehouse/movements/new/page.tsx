// =============================================
// Create Movement Page
// Dedicated page for creating new stock movements
// =============================================

"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { ArrowLeft, Loader2, AlertCircle, CheckCircle2 } from "lucide-react";
import { MovementTypeSelector } from "@/modules/warehouse/components/movement-type-selector";
import { createMovement } from "@/app/actions/warehouse/create-movement";
import { toast } from "react-toastify";
import { useAppStore } from "@/lib/stores/app-store";
import type { CreateStockMovementData } from "@/modules/warehouse/types/stock-movements";

export default function NewMovementPage() {
  const router = useRouter();
  const { activeOrg, activeBranch } = useAppStore();

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
      organization_id: activeOrg?.organization_id || "",
      branch_id: activeBranch?.id || "",
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

      const result = await createMovement(data);

      if (!result.success) {
        setErrors(result.errors);
        setWarnings(result.warnings);
        toast.error("Failed to create movement");
        return;
      }

      if (result.warnings.length > 0) {
        setWarnings(result.warnings);
      }

      toast.success(`Movement created successfully: ${result.movement_number}`);
      router.push(`/dashboard/warehouse/movements/${result.id}`);
    } catch (error) {
      console.error("Error creating movement:", error);
      toast.error("An error occurred while creating the movement");
    } finally {
      setLoading(false);
    }
  };

  if (!activeOrg || !activeBranch) {
    return (
      <div className="container mx-auto p-6">
        <div className="text-center text-muted-foreground">
          Please select an organization and branch
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" onClick={() => router.back()}>
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <div>
          <h1 className="text-3xl font-bold">Create Stock Movement</h1>
          <p className="text-muted-foreground">Create a new stock movement for {activeOrg.name}</p>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Movement Details</CardTitle>
          <CardDescription>
            Fill in the details for the new stock movement. Fields marked with * are required.
          </CardDescription>
        </CardHeader>

        <CardContent>
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
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
                allowManualEntryOnly={true}
              />
              {formErrors.movement_type_code && (
                <p className="text-sm text-destructive">{formErrors.movement_type_code.message}</p>
              )}
            </div>

            {/* Product ID */}
            <div className="space-y-2">
              <Label htmlFor="product_id">Product ID *</Label>
              <Input
                id="product_id"
                {...register("product_id", { required: "Product is required" })}
                placeholder="Enter product ID or search..."
              />
              {formErrors.product_id && (
                <p className="text-sm text-destructive">{formErrors.product_id.message}</p>
              )}
            </div>

            {/* Variant ID */}
            <div className="space-y-2">
              <Label htmlFor="variant_id">Variant ID (Optional)</Label>
              <Input
                id="variant_id"
                {...register("variant_id")}
                placeholder="Enter variant ID if applicable"
              />
            </div>

            {/* Quantity and Unit */}
            <div className="grid grid-cols-2 gap-4">
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

              <div className="space-y-2">
                <Label htmlFor="unit_of_measure">Unit of Measure</Label>
                <Input
                  id="unit_of_measure"
                  {...register("unit_of_measure")}
                  placeholder="pcs, kg, m, etc."
                />
              </div>
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

            {/* Tracking */}
            <div className="grid grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label htmlFor="batch_number">Batch Number</Label>
                <Input id="batch_number" {...register("batch_number")} placeholder="Batch #" />
              </div>

              <div className="space-y-2">
                <Label htmlFor="serial_number">Serial Number</Label>
                <Input id="serial_number" {...register("serial_number")} placeholder="Serial #" />
              </div>

              <div className="space-y-2">
                <Label htmlFor="lot_number">Lot Number</Label>
                <Input id="lot_number" {...register("lot_number")} placeholder="Lot #" />
              </div>
            </div>

            {/* Reference */}
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="reference_type">Reference Type</Label>
                <Input
                  id="reference_type"
                  {...register("reference_type")}
                  placeholder="e.g., purchase_order"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="reference_number">Reference Number</Label>
                <Input
                  id="reference_number"
                  {...register("reference_number")}
                  placeholder="Reference #"
                />
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

            {/* Actions */}
            <div className="flex gap-2 justify-end">
              <Button type="button" variant="outline" onClick={() => router.back()}>
                Cancel
              </Button>
              <Button type="button" variant="outline" onClick={() => reset()}>
                Reset
              </Button>
              <Button type="submit" disabled={loading}>
                {loading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Creating...
                  </>
                ) : (
                  <>
                    <CheckCircle2 className="mr-2 h-4 w-4" />
                    Create Movement
                  </>
                )}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
