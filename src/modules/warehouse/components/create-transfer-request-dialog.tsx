"use client";

import { useState } from "react";
import { useForm, useFieldArray } from "react-hook-form";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Loader2, AlertCircle, Plus, Trash2, Package } from "lucide-react";
import { toast } from "react-toastify";
import { createTransferRequest } from "@/app/actions/warehouse/create-transfer-request";
import { submitTransfer } from "@/app/actions/warehouse/submit-transfer";
import type {
  CreateTransferRequestInput,
  TransferPriority,
} from "../types/inter-warehouse-transfers";

interface CreateTransferRequestDialogProps {
  organizationId: string;
  branchId: string;
  branches: Array<{ id: string; name: string }>;
  locations: Array<{ id: string; name: string; code: string; branch_id: string }>;
  onSuccess?: (transferId: string) => void;
  trigger?: React.ReactNode;
}

interface FormData {
  from_branch_id: string;
  to_branch_id: string;
  priority: TransferPriority;
  expected_date: string;
  shipping_method: string;
  notes: string;
  items: Array<{
    product_id: string;
    variant_id?: string;
    quantity: number;
    unit_id: string;
    from_location_id: string;
    to_location_id: string;
  }>;
}

export function CreateTransferRequestDialog({
  organizationId,
  branchId,
  branches,
  locations,
  onSuccess,
  trigger,
}: CreateTransferRequestDialogProps) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string>("");
  const [submitAfterCreate, setSubmitAfterCreate] = useState(false);

  const { register, handleSubmit, watch, setValue, control, reset } = useForm<FormData>({
    defaultValues: {
      from_branch_id: branchId,
      to_branch_id: "",
      priority: "normal",
      expected_date: "",
      shipping_method: "",
      notes: "",
      items: [
        {
          product_id: "",
          quantity: 1,
          unit_id: "",
          from_location_id: "",
          to_location_id: "",
        },
      ],
    },
  });

  const { fields, append, remove } = useFieldArray({
    control,
    name: "items",
  });

  const fromBranchId = watch("from_branch_id");
  const toBranchId = watch("to_branch_id");

  // Filter locations by branch
  const fromLocations = locations.filter((loc) => loc.branch_id === fromBranchId);
  const toLocations = locations.filter((loc) => loc.branch_id === toBranchId);

  const onSubmit = async (data: FormData) => {
    try {
      setLoading(true);
      setError("");

      // Validate branches are different
      if (data.from_branch_id === data.to_branch_id) {
        setError("Source and destination branches must be different");
        setLoading(false);
        return;
      }

      // Validate items
      if (data.items.length === 0) {
        setError("At least one item is required");
        setLoading(false);
        return;
      }

      const input: CreateTransferRequestInput = {
        organization_id: organizationId,
        from_branch_id: data.from_branch_id,
        to_branch_id: data.to_branch_id,
        priority: data.priority,
        expected_date: data.expected_date || undefined,
        shipping_method: data.shipping_method || undefined,
        notes: data.notes || undefined,
        items: data.items.map((item) => ({
          product_id: item.product_id,
          variant_id: item.variant_id || undefined,
          quantity: Number(item.quantity),
          unit_id: item.unit_id,
          from_location_id: item.from_location_id,
          to_location_id: item.to_location_id,
        })),
      };

      // Create transfer request
      const result = await createTransferRequest(input);

      if (!result.success || !result.transfer_id) {
        setError(result.error || "Failed to create transfer request");
        setLoading(false);
        return;
      }

      // Submit if requested
      if (submitAfterCreate && result.transfer_id) {
        const submitResult = await submitTransfer(result.transfer_id);
        if (!submitResult.success) {
          toast.warning("Transfer created but not submitted: " + submitResult.error);
        } else {
          toast.success("Transfer request created and submitted for approval");
        }
      } else {
        toast.success("Transfer request created as draft");
      }

      setOpen(false);
      reset();
      onSuccess?.(result.transfer_id);
    } catch (err) {
      console.error("Error creating transfer request:", err);
      setError(err instanceof Error ? err.message : "Unknown error");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {trigger || (
          <Button>
            <Package className="mr-2 h-4 w-4" />
            Create Transfer
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Create Inter-Warehouse Transfer</DialogTitle>
          <DialogDescription>
            Transfer stock between warehouses. The transfer will go through approval workflow.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
          {error && (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          {/* Transfer Details */}
          <div className="space-y-4">
            <h3 className="font-semibold">Transfer Details</h3>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="from_branch_id">From Warehouse *</Label>
                <Select
                  value={fromBranchId}
                  onValueChange={(value) => setValue("from_branch_id", value)}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select source warehouse" />
                  </SelectTrigger>
                  <SelectContent>
                    {branches.map((branch) => (
                      <SelectItem key={branch.id} value={branch.id}>
                        {branch.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label htmlFor="to_branch_id">To Warehouse *</Label>
                <Select
                  value={toBranchId}
                  onValueChange={(value) => setValue("to_branch_id", value)}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select destination warehouse" />
                  </SelectTrigger>
                  <SelectContent>
                    {branches
                      .filter((b) => b.id !== fromBranchId)
                      .map((branch) => (
                        <SelectItem key={branch.id} value={branch.id}>
                          {branch.name}
                        </SelectItem>
                      ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="priority">Priority</Label>
                <Select
                  value={watch("priority")}
                  onValueChange={(value: TransferPriority) => setValue("priority", value)}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="normal">Normal</SelectItem>
                    <SelectItem value="high">High</SelectItem>
                    <SelectItem value="urgent">Urgent</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label htmlFor="expected_date">Expected Date</Label>
                <Input type="date" {...register("expected_date")} />
              </div>
            </div>

            <div>
              <Label htmlFor="shipping_method">Shipping Method</Label>
              <Input
                {...register("shipping_method")}
                placeholder="e.g., Own Transport, DHL, Courier"
              />
            </div>

            <div>
              <Label htmlFor="notes">Notes</Label>
              <Textarea
                {...register("notes")}
                placeholder="Additional information about this transfer..."
                rows={3}
              />
            </div>
          </div>

          {/* Items */}
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="font-semibold">Items to Transfer</h3>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() =>
                  append({
                    product_id: "",
                    quantity: 1,
                    unit_id: "",
                    from_location_id: "",
                    to_location_id: "",
                  })
                }
              >
                <Plus className="mr-2 h-4 w-4" />
                Add Item
              </Button>
            </div>

            {fields.map((field, index) => (
              <div key={field.id} className="border rounded-lg p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium">Item {index + 1}</span>
                  {fields.length > 1 && (
                    <Button type="button" variant="ghost" size="sm" onClick={() => remove(index)}>
                      <Trash2 className="h-4 w-4 text-red-500" />
                    </Button>
                  )}
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="col-span-2">
                    <Label>Product ID *</Label>
                    <Input
                      {...register(`items.${index}.product_id`, { required: true })}
                      placeholder="Product UUID"
                    />
                  </div>

                  <div>
                    <Label>Quantity *</Label>
                    <Input
                      type="number"
                      {...register(`items.${index}.quantity`, {
                        required: true,
                        min: 1,
                        valueAsNumber: true,
                      })}
                      min={1}
                      step={1}
                    />
                  </div>

                  <div>
                    <Label>Unit ID *</Label>
                    <Input
                      {...register(`items.${index}.unit_id`, { required: true })}
                      placeholder="Unit UUID"
                    />
                  </div>

                  <div>
                    <Label>From Location *</Label>
                    <Select
                      value={watch(`items.${index}.from_location_id`)}
                      onValueChange={(value) => setValue(`items.${index}.from_location_id`, value)}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select source location" />
                      </SelectTrigger>
                      <SelectContent>
                        {fromLocations.map((loc) => (
                          <SelectItem key={loc.id} value={loc.id}>
                            {loc.code} - {loc.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div>
                    <Label>To Location *</Label>
                    <Select
                      value={watch(`items.${index}.to_location_id`)}
                      onValueChange={(value) => setValue(`items.${index}.to_location_id`, value)}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select destination location" />
                      </SelectTrigger>
                      <SelectContent>
                        {toLocations.map((loc) => (
                          <SelectItem key={loc.id} value={loc.id}>
                            {loc.code} - {loc.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </div>
            ))}
          </div>

          <DialogFooter>
            <div className="flex items-center gap-2 w-full justify-between">
              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="submit-after"
                  checked={submitAfterCreate}
                  onChange={(e) => setSubmitAfterCreate(e.target.checked)}
                  className="h-4 w-4"
                />
                <Label htmlFor="submit-after" className="text-sm font-normal cursor-pointer">
                  Submit for approval immediately
                </Label>
              </div>
              <div className="flex gap-2">
                <Button type="button" variant="outline" onClick={() => setOpen(false)}>
                  Cancel
                </Button>
                <Button type="submit" disabled={loading}>
                  {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  Create Transfer
                </Button>
              </div>
            </div>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
