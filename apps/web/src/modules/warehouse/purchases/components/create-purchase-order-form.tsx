"use client";

import React from "react";
import { useRouter } from "next/navigation";
import { useForm, useFieldArray } from "react-hook-form";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
import { Trash2, Save, Send } from "lucide-react";
import { toast } from "react-toastify";
import { useAppStore } from "@/lib/stores/app-store";
import {
  createPurchaseOrderAction,
  submitPurchaseOrderAction,
} from "../actions/purchase-orders-actions";
import type { PurchaseOrderFormData } from "../../types/purchase-orders";
import type { BusinessAccount } from "../../suppliers/api";
import { supplierService } from "../../suppliers/api";
import { ProductSelector } from "./product-selector";

export function CreatePurchaseOrderForm() {
  const router = useRouter();
  const { activeOrgId, activeBranchId } = useAppStore();
  const [isSubmitting, setIsSubmitting] = React.useState(false);
  const [suppliers, setSuppliers] = React.useState<BusinessAccount[]>([]);
  const [loadingSuppliers, setLoadingSuppliers] = React.useState(false);

  const {
    register,
    control,
    handleSubmit,
    watch,
    setValue,
    formState: { errors },
  } = useForm<PurchaseOrderFormData>({
    defaultValues: {
      supplier_id: "",
      po_date: new Date().toISOString().split("T")[0],
      expected_delivery_date: "",
      delivery_location_id: "",
      payment_terms: "Net 30",
      shipping_cost: 0,
      discount_amount: 0,
      notes: "",
      internal_notes: "",
      items: [],
    },
  });

  const { fields, append, remove } = useFieldArray({
    control,
    name: "items",
  });

  const items = watch("items");

  // Load suppliers
  React.useEffect(() => {
    if (!activeOrgId) return;

    const loadSuppliers = async () => {
      setLoadingSuppliers(true);
      try {
        const result = await supplierService.getSuppliers(
          { active: true, partner_type: "vendor" },
          activeOrgId
        );
        setSuppliers(result.suppliers);
      } catch (error) {
        console.error("Failed to load suppliers:", error);
        toast.error("Failed to load suppliers");
      } finally {
        setLoadingSuppliers(false);
      }
    };

    loadSuppliers();
  }, [activeOrgId]);

  // Calculate totals
  const subtotal = items.reduce((sum, item) => {
    const itemSubtotal = item.quantity_ordered * item.unit_price;
    return sum + itemSubtotal;
  }, 0);

  const totalDiscount =
    items.reduce((sum, item) => {
      const itemDiscount =
        (item.quantity_ordered * item.unit_price * (item.discount_percent || 0)) / 100;
      return sum + itemDiscount;
    }, 0) + (watch("discount_amount") || 0);

  const totalTax = items.reduce((sum, item) => {
    const itemSubtotal = item.quantity_ordered * item.unit_price;
    const itemAfterDiscount = itemSubtotal - (itemSubtotal * (item.discount_percent || 0)) / 100;
    const itemTax = (itemAfterDiscount * (item.tax_rate || 0)) / 100;
    return sum + itemTax;
  }, 0);

  const shippingCost = watch("shipping_cost") || 0;
  const total = subtotal - totalDiscount + totalTax + shippingCost;

  const onSubmit = async (data: PurchaseOrderFormData, submitForApproval: boolean = false) => {
    if (!activeOrgId) {
      toast.error("No active organization selected");
      return;
    }

    if (data.items.length === 0) {
      toast.error("Please add at least one item to the purchase order");
      return;
    }

    setIsSubmitting(true);
    try {
      const result = await createPurchaseOrderAction(activeOrgId, activeBranchId, data);

      if (!result.success || !result.data) {
        throw new Error(result.error || "Failed to create purchase order");
      }

      toast.success("Purchase order created successfully");

      // If submitting for approval, do that now
      if (submitForApproval) {
        const submitResult = await submitPurchaseOrderAction(result.data.id, activeOrgId);
        if (submitResult.success) {
          toast.success("Purchase order submitted for approval");
        }
      }

      router.push(`/dashboard/warehouse/purchases/${result.data.id}`);
    } catch (error) {
      console.error("Failed to create purchase order:", error);
      toast.error(error instanceof Error ? error.message : "Failed to create purchase order");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleAddItem = (productData: any) => {
    append({
      product_id: productData.product_id,
      product_variant_id: productData.product_variant_id,
      product_supplier_id: productData.product_supplier_id,
      quantity_ordered: productData.quantity || 1,
      unit_price: productData.unit_price || 0,
      tax_rate: productData.tax_rate || 23, // Default VAT in Poland
      discount_percent: 0,
      expected_location_id: productData.expected_location_id,
      notes: "",
    });
  };

  return (
    <form className="space-y-6">
      {/* Supplier & General Info */}
      <Card>
        <CardHeader>
          <CardTitle>General Information</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="supplier_id">
                Supplier <span className="text-red-500">*</span>
              </Label>
              <Select
                value={watch("supplier_id")}
                onValueChange={(value) => setValue("supplier_id", value)}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select supplier" />
                </SelectTrigger>
                <SelectContent>
                  {loadingSuppliers ? (
                    <SelectItem value="loading" disabled>
                      Loading suppliers...
                    </SelectItem>
                  ) : suppliers.length === 0 ? (
                    <SelectItem value="none" disabled>
                      No suppliers found
                    </SelectItem>
                  ) : (
                    suppliers.map((supplier) => (
                      <SelectItem key={supplier.id} value={supplier.id}>
                        {supplier.name}
                      </SelectItem>
                    ))
                  )}
                </SelectContent>
              </Select>
              {errors.supplier_id && (
                <p className="text-sm text-red-500">{errors.supplier_id.message}</p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="po_date">PO Date</Label>
              <Input type="date" {...register("po_date")} />
            </div>

            <div className="space-y-2">
              <Label htmlFor="expected_delivery_date">Expected Delivery Date</Label>
              <Input type="date" {...register("expected_delivery_date")} />
            </div>

            <div className="space-y-2">
              <Label htmlFor="payment_terms">Payment Terms</Label>
              <Input placeholder="e.g., Net 30, COD, 50% upfront" {...register("payment_terms")} />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="notes">Notes (visible to supplier)</Label>
            <Textarea placeholder="Any special instructions..." {...register("notes")} rows={2} />
          </div>

          <div className="space-y-2">
            <Label htmlFor="internal_notes">Internal Notes (not visible to supplier)</Label>
            <Textarea
              placeholder="Internal notes about this order..."
              {...register("internal_notes")}
              rows={2}
            />
          </div>
        </CardContent>
      </Card>

      {/* Items */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>Order Items</CardTitle>
            <ProductSelector
              supplierId={watch("supplier_id")}
              onSelect={handleAddItem}
              disabled={!watch("supplier_id")}
            />
          </div>
        </CardHeader>
        <CardContent>
          {fields.length === 0 ? (
            <div className="flex h-32 items-center justify-center rounded-lg border border-dashed">
              <p className="text-muted-foreground">
                No items added yet. Click "Add Product" to get started.
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              {fields.map((field, index) => (
                <div key={field.id} className="rounded-lg border p-4">
                  <div className="mb-3 flex items-start justify-between">
                    <h4 className="font-medium">Item {index + 1}</h4>
                    <Button type="button" variant="ghost" size="sm" onClick={() => remove(index)}>
                      <Trash2 className="h-4 w-4 text-red-500" />
                    </Button>
                  </div>

                  <div className="grid gap-4 md:grid-cols-4">
                    <div className="space-y-2">
                      <Label>Quantity</Label>
                      <Input
                        type="number"
                        step="0.001"
                        {...register(`items.${index}.quantity_ordered` as const, {
                          valueAsNumber: true,
                          min: 0.001,
                        })}
                      />
                    </div>

                    <div className="space-y-2">
                      <Label>Unit Price</Label>
                      <Input
                        type="number"
                        step="0.01"
                        {...register(`items.${index}.unit_price` as const, {
                          valueAsNumber: true,
                          min: 0,
                        })}
                      />
                    </div>

                    <div className="space-y-2">
                      <Label>Tax Rate (%)</Label>
                      <Input
                        type="number"
                        step="1"
                        {...register(`items.${index}.tax_rate` as const, {
                          valueAsNumber: true,
                          min: 0,
                          max: 100,
                        })}
                      />
                    </div>

                    <div className="space-y-2">
                      <Label>Discount (%)</Label>
                      <Input
                        type="number"
                        step="1"
                        {...register(`items.${index}.discount_percent` as const, {
                          valueAsNumber: true,
                          min: 0,
                          max: 100,
                        })}
                      />
                    </div>
                  </div>

                  <div className="mt-2 text-right text-sm">
                    <span className="text-muted-foreground">Line Total: </span>
                    <span className="font-medium">
                      {new Intl.NumberFormat("pl-PL", {
                        style: "currency",
                        currency: "PLN",
                      }).format(
                        items[index].quantity_ordered *
                          items[index].unit_price *
                          (1 - (items[index].discount_percent || 0) / 100) *
                          (1 + (items[index].tax_rate || 0) / 100)
                      )}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Totals */}
      <Card>
        <CardHeader>
          <CardTitle>Order Summary</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="shipping_cost">Shipping Cost</Label>
                <Input
                  type="number"
                  step="0.01"
                  {...register("shipping_cost", { valueAsNumber: true })}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="discount_amount">Additional Discount</Label>
                <Input
                  type="number"
                  step="0.01"
                  {...register("discount_amount", { valueAsNumber: true })}
                />
              </div>
            </div>

            <div className="rounded-lg border p-4">
              <div className="space-y-2">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Subtotal:</span>
                  <span>
                    {new Intl.NumberFormat("pl-PL", { style: "currency", currency: "PLN" }).format(
                      subtotal
                    )}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Total Discount:</span>
                  <span className="text-red-600">
                    -
                    {new Intl.NumberFormat("pl-PL", { style: "currency", currency: "PLN" }).format(
                      totalDiscount
                    )}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Total Tax:</span>
                  <span>
                    {new Intl.NumberFormat("pl-PL", { style: "currency", currency: "PLN" }).format(
                      totalTax
                    )}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Shipping:</span>
                  <span>
                    {new Intl.NumberFormat("pl-PL", { style: "currency", currency: "PLN" }).format(
                      shippingCost
                    )}
                  </span>
                </div>
                <div className="flex justify-between border-t pt-2 text-lg font-bold">
                  <span>Total:</span>
                  <span>
                    {new Intl.NumberFormat("pl-PL", { style: "currency", currency: "PLN" }).format(
                      total
                    )}
                  </span>
                </div>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Actions */}
      <div className="flex justify-end gap-3">
        <Button
          type="button"
          variant="outline"
          onClick={() => router.push("/dashboard-old/warehouse/purchases")}
          disabled={isSubmitting}
        >
          Cancel
        </Button>
        <Button
          type="button"
          variant="outline"
          onClick={handleSubmit((data) => onSubmit(data, false))}
          disabled={isSubmitting}
        >
          <Save className="mr-2 h-4 w-4" />
          Save as Draft
        </Button>
        <Button
          type="button"
          onClick={handleSubmit((data) => onSubmit(data, true))}
          disabled={isSubmitting}
        >
          <Send className="mr-2 h-4 w-4" />
          {isSubmitting ? "Creating..." : "Create & Submit for Approval"}
        </Button>
      </div>
    </form>
  );
}
