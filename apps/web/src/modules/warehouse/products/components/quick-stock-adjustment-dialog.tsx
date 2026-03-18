"use client";

import * as React from "react";
import { useForm } from "react-hook-form";
import { toast } from "react-toastify";
import { Package, Plus, Minus } from "lucide-react";

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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Card, CardContent } from "@/components/ui/card";

import type { ProductVariantWithDetails } from "@/modules/warehouse/types/products";

interface QuickStockAdjustmentDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  variant: ProductVariantWithDetails | null;
  currentStock: number;
  onSuccess: () => void;
}

interface StockAdjustmentFormData {
  adjustment_type: "increase" | "decrease";
  quantity: number;
  reason: string;
  notes?: string;
  location_id?: string;
}

export function QuickStockAdjustmentDialog({
  open,
  onOpenChange,
  variant,
  currentStock,
  onSuccess,
}: QuickStockAdjustmentDialogProps) {
  const {
    register,
    handleSubmit,
    reset,
    watch,
    setValue,
    formState: { errors, isSubmitting },
  } = useForm<StockAdjustmentFormData>({
    defaultValues: {
      adjustment_type: "increase",
      quantity: 0,
      reason: "adjustment_positive",
    },
  });

  const adjustmentType = watch("adjustment_type");
  const quantity = watch("quantity");

  const newStock = React.useMemo(() => {
    if (adjustmentType === "increase") {
      return currentStock + (quantity || 0);
    } else {
      return currentStock - (quantity || 0);
    }
  }, [currentStock, adjustmentType, quantity]);

  React.useEffect(() => {
    if (open) {
      reset({
        adjustment_type: "increase",
        quantity: 0,
        reason: "adjustment_positive",
        notes: "",
      });
    }
  }, [open, reset]);

  const onSubmit = async (data: StockAdjustmentFormData) => {
    if (!variant) return;

    try {
      const { createClient } = await import("@/utils/supabase/client");
      const { useAppStore } = await import("@/lib/stores/app-store");
      const { useUserStore } = await import("@/lib/stores/user-store");

      const supabase = createClient();
      const { activeOrg, activeBranch } = useAppStore.getState();
      const { user } = useUserStore.getState();

      if (!activeOrg?.organization_id || !user?.id) {
        throw new Error("Missing required context");
      }

      // Calculate the actual quantity change (positive or negative)
      const quantityChange = data.adjustment_type === "increase" ? data.quantity : -data.quantity;

      // Create stock movement
      const { error: movementError } = await supabase.from("stock_movements").insert({
        organization_id: activeOrg.organization_id,
        branch_id: activeBranch?.branch_id || null,
        location_id: data.location_id || null,
        product_id: variant.product_id,
        variant_id: variant.id,
        movement_type: data.reason,
        quantity: quantityChange,
        notes: data.notes || null,
        user_id: user.id,
        created_at: new Date().toISOString(),
      });

      if (movementError) throw movementError;

      // Update or create stock snapshot
      const { error: snapshotError } = await supabase.rpc("upsert_stock_snapshot", {
        p_organization_id: activeOrg.organization_id,
        p_branch_id: activeBranch?.branch_id || null,
        p_location_id: data.location_id || null,
        p_product_id: variant.product_id,
        p_variant_id: variant.id,
        p_quantity_change: quantityChange,
      });

      if (snapshotError) throw snapshotError;

      toast.success(`Stock adjusted: ${quantityChange > 0 ? "+" : ""}${quantityChange} units`);
      onSuccess();
      onOpenChange(false);
    } catch (error) {
      console.error("Failed to adjust stock:", error);
      toast.error("Failed to adjust stock");
    }
  };

  if (!variant) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Quick Stock Adjustment</DialogTitle>
          <DialogDescription>Adjust stock for {variant.name}</DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          {/* Current Stock Display */}
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Current Stock</p>
                  <p className="text-2xl font-bold">{currentStock}</p>
                </div>
                <Package className="h-8 w-8 text-muted-foreground" />
              </div>
              <div className="mt-3 flex items-center justify-between border-t pt-3">
                <p className="text-sm text-muted-foreground">New Stock</p>
                <p className="text-xl font-semibold">{newStock}</p>
              </div>
            </CardContent>
          </Card>

          {/* Adjustment Type */}
          <div className="space-y-2">
            <Label>Adjustment Type</Label>
            <RadioGroup
              value={adjustmentType}
              onValueChange={(value) =>
                setValue("adjustment_type", value as "increase" | "decrease")
              }
              className="grid grid-cols-2 gap-4"
            >
              <div>
                <RadioGroupItem value="increase" id="increase" className="peer sr-only" />
                <Label
                  htmlFor="increase"
                  className="flex cursor-pointer flex-col items-center justify-between rounded-md border-2 border-muted bg-popover p-4 hover:bg-accent hover:text-accent-foreground peer-data-[state=checked]:border-primary [&:has([data-state=checked])]:border-primary"
                >
                  <Plus className="mb-2 h-6 w-6" />
                  <span className="text-sm font-medium">Increase</span>
                </Label>
              </div>
              <div>
                <RadioGroupItem value="decrease" id="decrease" className="peer sr-only" />
                <Label
                  htmlFor="decrease"
                  className="flex cursor-pointer flex-col items-center justify-between rounded-md border-2 border-muted bg-popover p-4 hover:bg-accent hover:text-accent-foreground peer-data-[state=checked]:border-primary [&:has([data-state=checked])]:border-primary"
                >
                  <Minus className="mb-2 h-6 w-6" />
                  <span className="text-sm font-medium">Decrease</span>
                </Label>
              </div>
            </RadioGroup>
          </div>

          {/* Quantity */}
          <div className="space-y-2">
            <Label htmlFor="quantity">Quantity *</Label>
            <Input
              id="quantity"
              type="number"
              {...register("quantity", {
                required: "Quantity is required",
                valueAsNumber: true,
                min: { value: 1, message: "Quantity must be at least 1" },
              })}
              placeholder="Enter quantity..."
            />
            {errors.quantity && (
              <p className="text-sm text-destructive">{errors.quantity.message}</p>
            )}
          </div>

          {/* Reason */}
          <div className="space-y-2">
            <Label htmlFor="reason">Reason *</Label>
            <Select value={watch("reason")} onValueChange={(value) => setValue("reason", value)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {adjustmentType === "increase" ? (
                  <>
                    <SelectItem value="purchase">Purchase / Receiving</SelectItem>
                    <SelectItem value="adjustment_positive">Stock Count Adjustment</SelectItem>
                    <SelectItem value="found">Found Item</SelectItem>
                    <SelectItem value="return">Customer Return</SelectItem>
                  </>
                ) : (
                  <>
                    <SelectItem value="sale">Sale</SelectItem>
                    <SelectItem value="adjustment_negative">Stock Count Adjustment</SelectItem>
                    <SelectItem value="damaged">Damaged / Defective</SelectItem>
                    <SelectItem value="lost">Lost / Missing</SelectItem>
                    <SelectItem value="theft">Theft</SelectItem>
                  </>
                )}
              </SelectContent>
            </Select>
          </div>

          {/* Notes */}
          <div className="space-y-2">
            <Label htmlFor="notes">Notes (optional)</Label>
            <Textarea
              id="notes"
              {...register("notes")}
              placeholder="Add any additional notes..."
              rows={3}
            />
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={isSubmitting}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? "Adjusting..." : "Adjust Stock"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
