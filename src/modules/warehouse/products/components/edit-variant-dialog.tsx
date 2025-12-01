"use client";

import * as React from "react";
import { useForm } from "react-hook-form";
import { toast } from "react-toastify";

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
import { Checkbox } from "@/components/ui/checkbox";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

import type { ProductVariantWithDetails } from "@/modules/warehouse/types/products";

interface EditVariantDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  variant: ProductVariantWithDetails | null;
  onSuccess: () => void;
}

interface EditVariantFormData {
  name: string;
  sku: string;
  selling_price: number;
  cost_price: number;
  reorder_point: number;
  upc?: string;
  ean?: string;
  isbn?: string;
  is_active: boolean;
}

export function EditVariantDialog({
  open,
  onOpenChange,
  variant,
  onSuccess,
}: EditVariantDialogProps) {
  const {
    register,
    handleSubmit,
    reset,
    setValue,
    watch,
    formState: { errors, isSubmitting },
  } = useForm<EditVariantFormData>();

  const isActive = watch("is_active");

  // Initialize form when variant changes
  React.useEffect(() => {
    if (variant && open) {
      reset({
        name: variant.name,
        sku: variant.sku || "",
        selling_price: variant.selling_price || 0,
        cost_price: variant.cost_price || 0,
        reorder_point: variant.reorder_point || 0,
        upc: variant.upc || "",
        ean: variant.ean || "",
        isbn: variant.isbn || "",
        is_active: variant.is_active,
      });
    }
  }, [variant, open, reset]);

  const onSubmit = async (data: EditVariantFormData) => {
    if (!variant) return;

    try {
      const { createClient } = await import("@/lib/supabase/client");
      const supabase = createClient();

      const { error } = await supabase
        .from("product_variants")
        .update({
          name: data.name,
          sku: data.sku || null,
          selling_price: data.selling_price,
          cost_price: data.cost_price,
          reorder_point: data.reorder_point,
          upc: data.upc || null,
          ean: data.ean || null,
          isbn: data.isbn || null,
          is_active: data.is_active,
          updated_at: new Date().toISOString(),
        })
        .eq("id", variant.id);

      if (error) throw error;

      toast.success("Variant updated successfully");
      onSuccess();
      onOpenChange(false);
    } catch (error) {
      console.error("Failed to update variant:", error);
      toast.error("Failed to update variant");
    }
  };

  if (!variant) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Edit Variant</DialogTitle>
          <DialogDescription>Update variant details for {variant.name}</DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
          <Tabs defaultValue="basic" className="w-full">
            <TabsList className="grid w-full grid-cols-3">
              <TabsTrigger value="basic">Basic Info</TabsTrigger>
              <TabsTrigger value="pricing">Pricing</TabsTrigger>
              <TabsTrigger value="identifiers">Identifiers</TabsTrigger>
            </TabsList>

            <TabsContent value="basic" className="space-y-4 mt-4">
              <div className="space-y-2">
                <Label htmlFor="name">Variant Name *</Label>
                <Input
                  id="name"
                  {...register("name", { required: "Name is required" })}
                  placeholder="e.g., Red - Small"
                />
                {errors.name && <p className="text-sm text-destructive">{errors.name.message}</p>}
              </div>

              <div className="space-y-2">
                <Label htmlFor="sku">SKU *</Label>
                <Input
                  id="sku"
                  {...register("sku", { required: "SKU is required" })}
                  placeholder="e.g., TSHIRT-RED-S"
                />
                {errors.sku && <p className="text-sm text-destructive">{errors.sku.message}</p>}
                <p className="text-xs text-muted-foreground">
                  Must be unique across all products and variants
                </p>
              </div>

              <div className="flex items-center space-x-2">
                <Checkbox
                  id="is_active"
                  checked={isActive}
                  onCheckedChange={(checked) => setValue("is_active", checked as boolean)}
                />
                <Label htmlFor="is_active" className="font-normal">
                  Active (available for sale)
                </Label>
              </div>
            </TabsContent>

            <TabsContent value="pricing" className="space-y-4 mt-4">
              <div className="grid gap-4 md:grid-cols-3">
                <div className="space-y-2">
                  <Label htmlFor="selling_price">Selling Price</Label>
                  <Input
                    id="selling_price"
                    type="number"
                    step="0.01"
                    {...register("selling_price", {
                      valueAsNumber: true,
                      min: { value: 0, message: "Price cannot be negative" },
                    })}
                    placeholder="0.00"
                  />
                  {errors.selling_price && (
                    <p className="text-sm text-destructive">{errors.selling_price.message}</p>
                  )}
                </div>

                <div className="space-y-2">
                  <Label htmlFor="cost_price">Cost Price</Label>
                  <Input
                    id="cost_price"
                    type="number"
                    step="0.01"
                    {...register("cost_price", {
                      valueAsNumber: true,
                      min: { value: 0, message: "Cost cannot be negative" },
                    })}
                    placeholder="0.00"
                  />
                  {errors.cost_price && (
                    <p className="text-sm text-destructive">{errors.cost_price.message}</p>
                  )}
                </div>

                <div className="space-y-2">
                  <Label htmlFor="reorder_point">Reorder Point</Label>
                  <Input
                    id="reorder_point"
                    type="number"
                    {...register("reorder_point", {
                      valueAsNumber: true,
                      min: { value: 0, message: "Reorder point cannot be negative" },
                    })}
                    placeholder="0"
                  />
                  {errors.reorder_point && (
                    <p className="text-sm text-destructive">{errors.reorder_point.message}</p>
                  )}
                  <p className="text-xs text-muted-foreground">
                    Alert when stock falls below this level
                  </p>
                </div>
              </div>
            </TabsContent>

            <TabsContent value="identifiers" className="space-y-4 mt-4">
              <div className="space-y-2">
                <Label htmlFor="upc">UPC (Universal Product Code)</Label>
                <Input
                  id="upc"
                  {...register("upc")}
                  placeholder="e.g., 012345678905"
                  maxLength={12}
                />
                <p className="text-xs text-muted-foreground">
                  12-digit barcode used primarily in North America
                </p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="ean">EAN (European Article Number)</Label>
                <Input
                  id="ean"
                  {...register("ean")}
                  placeholder="e.g., 5901234123457"
                  maxLength={13}
                />
                <p className="text-xs text-muted-foreground">
                  13-digit barcode used internationally
                </p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="isbn">ISBN (International Standard Book Number)</Label>
                <Input
                  id="isbn"
                  {...register("isbn")}
                  placeholder="e.g., 978-3-16-148410-0"
                  maxLength={17}
                />
                <p className="text-xs text-muted-foreground">For books only (10 or 13 digits)</p>
              </div>
            </TabsContent>
          </Tabs>

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
              {isSubmitting ? "Saving..." : "Save Changes"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
