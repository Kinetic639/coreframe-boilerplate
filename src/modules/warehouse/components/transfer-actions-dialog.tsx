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
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Loader2, AlertCircle, CheckCircle, Truck, PackageCheck, XCircle } from "lucide-react";
import { toast } from "react-toastify";
import { approveTransfer } from "@/app/actions/warehouse/approve-transfer";
import { shipTransfer } from "@/app/actions/warehouse/ship-transfer";
import { receiveTransfer } from "@/app/actions/warehouse/receive-transfer";
import { cancelTransfer } from "@/app/actions/warehouse/cancel-transfer";
import type {
  TransferRequestWithRelations,
  ApproveTransferInput,
  ShipTransferInput,
  ReceiveTransferInput,
} from "../types/inter-warehouse-transfers";

type ActionType = "approve" | "ship" | "receive" | "cancel";

interface TransferActionsDialogProps {
  transfer: TransferRequestWithRelations;
  action: ActionType;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess?: () => void;
}

export function TransferActionsDialog({
  transfer,
  action,
  open,
  onOpenChange,
  onSuccess,
}: TransferActionsDialogProps) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string>("");

  const { register, handleSubmit, reset } = useForm();

  const handleApprove = async (data: ApproveTransferInput) => {
    try {
      setLoading(true);
      setError("");

      const result = await approveTransfer(transfer.id, data);

      if (!result.success) {
        setError(result.error || "Failed to approve transfer");
        return;
      }

      toast.success("Transfer approved successfully");
      onOpenChange(false);
      reset();
      onSuccess?.();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error");
    } finally {
      setLoading(false);
    }
  };

  const handleShip = async (data: ShipTransferInput) => {
    try {
      setLoading(true);
      setError("");

      const result = await shipTransfer(transfer.id, data);

      if (!result.success) {
        setError(result.error || "Failed to ship transfer");
        return;
      }

      toast.success(`Transfer shipped - ${result.movement_ids?.length || 0} movements created`);
      onOpenChange(false);
      reset();
      onSuccess?.();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error");
    } finally {
      setLoading(false);
    }
  };

  const handleReceive = async (data: { notes?: string }) => {
    try {
      setLoading(true);
      setError("");

      // Build receive input with all items at expected quantity
      const input: ReceiveTransferInput = {
        items: transfer.items.map((item) => ({
          item_id: item.id,
          received_quantity: item.quantity,
          notes: "",
        })),
        notes: data.notes,
      };

      const result = await receiveTransfer(transfer.id, input);

      if (!result.success) {
        setError(result.error || "Failed to receive transfer");
        return;
      }

      toast.success(`Transfer received - ${result.movement_ids?.length || 0} movements created`);
      onOpenChange(false);
      reset();
      onSuccess?.();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error");
    } finally {
      setLoading(false);
    }
  };

  const handleCancel = async (data: { reason: string }) => {
    try {
      setLoading(true);
      setError("");

      const result = await cancelTransfer(transfer.id, data.reason);

      if (!result.success) {
        setError(result.error || "Failed to cancel transfer");
        return;
      }

      toast.success("Transfer cancelled");
      onOpenChange(false);
      reset();
      onSuccess?.();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error");
    } finally {
      setLoading(false);
    }
  };

  const getDialogConfig = () => {
    switch (action) {
      case "approve":
        return {
          icon: <CheckCircle className="h-5 w-5 text-green-500" />,
          title: "Approve Transfer",
          description: "Approve this transfer request. Stock will be reserved.",
          onSubmit: handleApprove,
        };
      case "ship":
        return {
          icon: <Truck className="h-5 w-5 text-blue-500" />,
          title: "Ship Transfer",
          description: "Mark transfer as shipped. Stock movements will be created.",
          onSubmit: handleShip,
        };
      case "receive":
        return {
          icon: <PackageCheck className="h-5 w-5 text-purple-500" />,
          title: "Receive Transfer",
          description: "Confirm receipt of transferred items. Stock will be updated.",
          onSubmit: handleReceive,
        };
      case "cancel":
        return {
          icon: <XCircle className="h-5 w-5 text-red-500" />,
          title: "Cancel Transfer",
          description: "Cancel this transfer request. This action cannot be undone.",
          onSubmit: handleCancel,
        };
    }
  };

  const config = getDialogConfig();

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            {config.icon}
            {config.title}
          </DialogTitle>
          <DialogDescription>{config.description}</DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit(config.onSubmit as any)} className="space-y-4">
          {error && (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          {/* Transfer Summary */}
          <div className="rounded-lg bg-muted p-3 text-sm space-y-1">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Transfer:</span>
              <span className="font-medium">{transfer.transfer_number}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">From:</span>
              <span className="font-medium">{transfer.from_branch?.name}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">To:</span>
              <span className="font-medium">{transfer.to_branch?.name}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Items:</span>
              <span className="font-medium">{transfer.items.length}</span>
            </div>
          </div>

          {/* Action-specific fields */}
          {action === "approve" && (
            <>
              <div>
                <Label htmlFor="expected_date">Expected Date</Label>
                <Input type="date" {...register("expected_date")} />
              </div>
              <div>
                <Label htmlFor="notes">Notes</Label>
                <Textarea
                  {...register("notes")}
                  rows={3}
                  placeholder="Optional approval notes..."
                />
              </div>
            </>
          )}

          {action === "ship" && (
            <>
              <div>
                <Label htmlFor="carrier">Carrier</Label>
                <Input {...register("carrier")} placeholder="e.g., DHL, FedEx, Own Transport" />
              </div>
              <div>
                <Label htmlFor="tracking_number">Tracking Number</Label>
                <Input {...register("tracking_number")} placeholder="Optional tracking number" />
              </div>
              <div>
                <Label htmlFor="shipping_method">Shipping Method</Label>
                <Input {...register("shipping_method")} placeholder="e.g., Express, Standard" />
              </div>
              <div>
                <Label htmlFor="notes">Notes</Label>
                <Textarea
                  {...register("notes")}
                  rows={3}
                  placeholder="Optional shipping notes..."
                />
              </div>
            </>
          )}

          {action === "receive" && (
            <div>
              <Label htmlFor="notes">Receipt Notes</Label>
              <Textarea
                {...register("notes")}
                rows={3}
                placeholder="Any notes about the received items..."
              />
              <p className="text-sm text-muted-foreground mt-2">
                All items will be received at their expected quantities. Use the full transfer
                details page for partial receipts.
              </p>
            </div>
          )}

          {action === "cancel" && (
            <div>
              <Label htmlFor="reason">
                Cancellation Reason <span className="text-red-500">*</span>
              </Label>
              <Textarea
                {...register("reason", { required: true })}
                rows={3}
                placeholder="Explain why this transfer is being cancelled..."
              />
            </div>
          )}

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={loading}>
              {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {action === "approve" && "Approve Transfer"}
              {action === "ship" && "Ship Transfer"}
              {action === "receive" && "Receive Transfer"}
              {action === "cancel" && "Cancel Transfer"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
