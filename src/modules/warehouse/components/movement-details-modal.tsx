// =============================================
// Movement Details Modal Component
// Full movement information display
// =============================================

"use client";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Button } from "@/components/ui/button";
import {
  Package,
  MapPin,
  FileText,
  DollarSign,
  Hash,
  Clock,
  CheckCircle2,
  XCircle,
} from "lucide-react";
import { MovementStatusBadge } from "./movement-status-badge";
import type { StockMovementWithRelations } from "../types/stock-movements";
import { formatDate } from "@/lib/utils";

interface MovementDetailsModalProps {
  movement: StockMovementWithRelations | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onApprove?: (id: string) => void;
  onCancel?: (id: string) => void;
}

export function MovementDetailsModal({
  movement,
  open,
  onOpenChange,
  onApprove,
  onCancel,
}: MovementDetailsModalProps) {
  if (!movement) return null;

  const canApprove = movement.status === "pending" && movement.requires_approval;
  const canCancel = movement.status === "pending" || movement.status === "approved";

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Package className="h-5 w-5" />
            Movement Details
          </DialogTitle>
          <DialogDescription>
            Complete information about stock movement {movement.movement_number}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6">
          {/* Status and Type */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="text-lg font-mono font-semibold">{movement.movement_number}</span>
              <MovementStatusBadge status={movement.status} />
            </div>
            <div className="flex gap-2">
              <Badge variant="outline">
                {movement.movement_type?.name || movement.movement_type_code}
              </Badge>
              {movement.movement_type?.polish_document_type && (
                <Badge variant="secondary">{movement.movement_type.polish_document_type}</Badge>
              )}
            </div>
          </div>

          <Separator />

          {/* Product Information */}
          <div className="space-y-3">
            <h3 className="font-semibold flex items-center gap-2">
              <Package className="h-4 w-4" />
              Product Information
            </h3>
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <p className="text-muted-foreground">Product</p>
                <p className="font-medium">{movement.product?.name || "Unknown"}</p>
              </div>
              {movement.variant && (
                <div>
                  <p className="text-muted-foreground">Variant</p>
                  <p className="font-medium">{movement.variant.name}</p>
                </div>
              )}
              <div>
                <p className="text-muted-foreground">Quantity</p>
                <p className="font-medium">
                  {movement.quantity} {movement.unit_of_measure || "pcs"}
                </p>
              </div>
              <div>
                <p className="text-muted-foreground">Category</p>
                <p className="font-medium capitalize">{movement.category}</p>
              </div>
            </div>
          </div>

          <Separator />

          {/* Location Information */}
          {(movement.source_location || movement.destination_location) && (
            <>
              <div className="space-y-3">
                <h3 className="font-semibold flex items-center gap-2">
                  <MapPin className="h-4 w-4" />
                  Location Information
                </h3>
                <div className="grid grid-cols-2 gap-4 text-sm">
                  {movement.source_location && (
                    <div>
                      <p className="text-muted-foreground">Source Location</p>
                      <p className="font-medium">
                        {movement.source_location.name}
                        <span className="text-muted-foreground ml-2">
                          ({movement.source_location.code})
                        </span>
                      </p>
                    </div>
                  )}
                  {movement.destination_location && (
                    <div>
                      <p className="text-muted-foreground">Destination Location</p>
                      <p className="font-medium">
                        {movement.destination_location.name}
                        <span className="text-muted-foreground ml-2">
                          ({movement.destination_location.code})
                        </span>
                      </p>
                    </div>
                  )}
                </div>
              </div>
              <Separator />
            </>
          )}

          {/* Financial Information */}
          {(movement.unit_cost || movement.total_cost) && (
            <>
              <div className="space-y-3">
                <h3 className="font-semibold flex items-center gap-2">
                  <DollarSign className="h-4 w-4" />
                  Financial Information
                </h3>
                <div className="grid grid-cols-2 gap-4 text-sm">
                  {movement.unit_cost && (
                    <div>
                      <p className="text-muted-foreground">Unit Cost</p>
                      <p className="font-medium">
                        {movement.unit_cost} {movement.currency || "PLN"}
                      </p>
                    </div>
                  )}
                  {movement.total_cost && (
                    <div>
                      <p className="text-muted-foreground">Total Cost</p>
                      <p className="font-medium">
                        {movement.total_cost} {movement.currency || "PLN"}
                      </p>
                    </div>
                  )}
                </div>
              </div>
              <Separator />
            </>
          )}

          {/* Tracking Information */}
          {(movement.batch_number ||
            movement.serial_number ||
            movement.lot_number ||
            movement.expiry_date) && (
            <>
              <div className="space-y-3">
                <h3 className="font-semibold flex items-center gap-2">
                  <Hash className="h-4 w-4" />
                  Tracking Information
                </h3>
                <div className="grid grid-cols-2 gap-4 text-sm">
                  {movement.batch_number && (
                    <div>
                      <p className="text-muted-foreground">Batch Number</p>
                      <p className="font-medium">{movement.batch_number}</p>
                    </div>
                  )}
                  {movement.serial_number && (
                    <div>
                      <p className="text-muted-foreground">Serial Number</p>
                      <p className="font-medium">{movement.serial_number}</p>
                    </div>
                  )}
                  {movement.lot_number && (
                    <div>
                      <p className="text-muted-foreground">Lot Number</p>
                      <p className="font-medium">{movement.lot_number}</p>
                    </div>
                  )}
                  {movement.expiry_date && (
                    <div>
                      <p className="text-muted-foreground">Expiry Date</p>
                      <p className="font-medium">{formatDate(movement.expiry_date)}</p>
                    </div>
                  )}
                </div>
              </div>
              <Separator />
            </>
          )}

          {/* Timestamps */}
          <div className="space-y-3">
            <h3 className="font-semibold flex items-center gap-2">
              <Clock className="h-4 w-4" />
              Timestamps
            </h3>
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <p className="text-muted-foreground">Occurred At</p>
                <p className="font-medium">{formatDate(movement.occurred_at)}</p>
              </div>
              <div>
                <p className="text-muted-foreground">Created At</p>
                <p className="font-medium">{formatDate(movement.created_at)}</p>
              </div>
              {movement.approved_at && (
                <div>
                  <p className="text-muted-foreground">Approved At</p>
                  <p className="font-medium">{formatDate(movement.approved_at)}</p>
                </div>
              )}
              {movement.completed_at && (
                <div>
                  <p className="text-muted-foreground">Completed At</p>
                  <p className="font-medium">{formatDate(movement.completed_at)}</p>
                </div>
              )}
              {movement.cancelled_at && (
                <div>
                  <p className="text-muted-foreground">Cancelled At</p>
                  <p className="font-medium">{formatDate(movement.cancelled_at)}</p>
                </div>
              )}
            </div>
          </div>

          {/* Notes */}
          {movement.notes && (
            <>
              <Separator />
              <div className="space-y-2">
                <h3 className="font-semibold flex items-center gap-2">
                  <FileText className="h-4 w-4" />
                  Notes
                </h3>
                <p className="text-sm text-muted-foreground">{movement.notes}</p>
              </div>
            </>
          )}

          {/* Cancellation Reason */}
          {movement.cancellation_reason && (
            <>
              <Separator />
              <div className="space-y-2">
                <h3 className="font-semibold flex items-center gap-2 text-destructive">
                  <XCircle className="h-4 w-4" />
                  Cancellation Reason
                </h3>
                <p className="text-sm text-muted-foreground">{movement.cancellation_reason}</p>
              </div>
            </>
          )}

          {/* Action Buttons */}
          {(canApprove || canCancel) && (
            <>
              <Separator />
              <div className="flex gap-2 justify-end">
                {canCancel && onCancel && (
                  <Button variant="destructive" onClick={() => onCancel(movement.id)}>
                    <XCircle className="mr-2 h-4 w-4" />
                    Cancel Movement
                  </Button>
                )}
                {canApprove && onApprove && (
                  <Button onClick={() => onApprove(movement.id)}>
                    <CheckCircle2 className="mr-2 h-4 w-4" />
                    Approve Movement
                  </Button>
                )}
              </div>
            </>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
