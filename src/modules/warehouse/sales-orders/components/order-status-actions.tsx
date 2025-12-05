"use client";

/**
 * Order Status Actions Component
 * Handles status transitions for sales orders with reservation integration
 */

import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { toast } from "react-toastify";
import { CheckCircle2, XCircle, AlertCircle } from "lucide-react";

import { VALID_STATUS_TRANSITIONS, SALES_ORDER_STATUS_LABELS } from "../../types/sales-orders";
import type { SalesOrderStatus } from "../../types/sales-orders";

interface OrderStatusActionsProps {
  orderId: string;
  organizationId: string;
  userId: string;
  currentStatus: SalesOrderStatus;
  onStatusChanged?: () => void;
}

export function OrderStatusActions({
  orderId,
  organizationId,
  userId,
  currentStatus,
  onStatusChanged,
}: OrderStatusActionsProps) {
  const [updating, setUpdating] = useState(false);
  const [showDialog, setShowDialog] = useState(false);
  const [selectedStatus, setSelectedStatus] = useState<SalesOrderStatus | null>(null);
  const [cancellationReason, setCancellationReason] = useState("");

  // Get allowed transitions for current status
  const allowedTransitions = VALID_STATUS_TRANSITIONS[currentStatus] || [];

  if (allowedTransitions.length === 0) {
    return null; // No transitions available (fulfilled/cancelled)
  }

  const handleStatusChange = (newStatus: SalesOrderStatus) => {
    setSelectedStatus(newStatus);
    setShowDialog(true);
  };

  const confirmStatusChange = async () => {
    if (!selectedStatus) return;

    setUpdating(true);
    try {
      const result = await salesOrdersService.updateOrderStatus(
        orderId,
        selectedStatus,
        organizationId,
        userId,
        selectedStatus === "cancelled" ? cancellationReason : undefined
      );

      if (result.success) {
        toast.success(`Order status updated to ${SALES_ORDER_STATUS_LABELS[selectedStatus]}`);

        // Show reservation info based on transition
        if (selectedStatus === "confirmed") {
          toast.info("Stock reservations have been created for all order items");
        } else if (selectedStatus === "cancelled") {
          toast.info("Stock reservations have been cancelled");
        }

        setShowDialog(false);
        setSelectedStatus(null);
        setCancellationReason("");

        if (onStatusChanged) {
          onStatusChanged();
        }
      } else {
        toast.error(result.error || "Failed to update order status");
      }
    } catch (error) {
      console.error("Error updating order status:", error);
      toast.error("An error occurred while updating order status");
    } finally {
      setUpdating(false);
    }
  };

  const getStatusIcon = (status: SalesOrderStatus) => {
    switch (status) {
      case "confirmed":
        return <CheckCircle2 className="h-4 w-4" />;
      case "cancelled":
        return <XCircle className="h-4 w-4" />;
      default:
        return <AlertCircle className="h-4 w-4" />;
    }
  };

  const getStatusDescription = (status: SalesOrderStatus) => {
    switch (status) {
      case "confirmed":
        return "⚠️ IMPORTANT: This will create stock reservations for all order items. Items without assigned locations will be SKIPPED and will NOT be reserved. Make sure all items have locations assigned before confirming.";
      case "processing":
        return "Mark this order as being processed. Inventory will remain reserved.";
      case "fulfilled":
        return "Mark this order as fulfilled. This will release all stock reservations.";
      case "cancelled":
        return "Cancel this order. All stock reservations will be cancelled and inventory will be released.";
      default:
        return `Change order status to ${SALES_ORDER_STATUS_LABELS[status]}`;
    }
  };

  return (
    <>
      {/* Status Action Buttons */}
      <div className="flex items-center gap-2">
        {allowedTransitions.map((status) => (
          <Button
            key={status}
            size="sm"
            variant={status === "cancelled" ? "destructive" : "default"}
            onClick={() => handleStatusChange(status)}
            disabled={updating}
          >
            {getStatusIcon(status)}
            <span className="ml-2">{SALES_ORDER_STATUS_LABELS[status]}</span>
          </Button>
        ))}
      </div>

      {/* Confirmation Dialog */}
      <AlertDialog open={showDialog} onOpenChange={setShowDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              Change Status to {selectedStatus && SALES_ORDER_STATUS_LABELS[selectedStatus]}?
            </AlertDialogTitle>
            <AlertDialogDescription>
              {selectedStatus && getStatusDescription(selectedStatus)}
            </AlertDialogDescription>
          </AlertDialogHeader>

          {selectedStatus === "cancelled" && (
            <div className="space-y-2">
              <Label htmlFor="cancellation-reason">Cancellation Reason</Label>
              <Textarea
                id="cancellation-reason"
                placeholder="Enter reason for cancellation..."
                value={cancellationReason}
                onChange={(e) => setCancellationReason(e.target.value)}
                rows={3}
              />
            </div>
          )}

          <AlertDialogFooter>
            <AlertDialogCancel disabled={updating}>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={confirmStatusChange} disabled={updating}>
              {updating ? "Updating..." : "Confirm"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
