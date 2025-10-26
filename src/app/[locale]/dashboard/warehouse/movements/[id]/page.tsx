// =============================================
// Movement Details Page
// Detailed view of a single stock movement
// =============================================

"use client";

import { useState, useEffect } from "react";
import { useRouter, useParams } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import {
  ArrowLeft,
  CheckCircle2,
  XCircle,
  Package,
  MapPin,
  DollarSign,
  Hash,
  Clock,
  User,
  FileText,
} from "lucide-react";
import { MovementStatusBadge } from "@/modules/warehouse/components/movement-status-badge";
import { getMovementById } from "@/app/actions/warehouse/get-movements";
import { approveMovement } from "@/app/actions/warehouse/approve-movement";
import { cancelMovement } from "@/app/actions/warehouse/cancel-movement";
import { toast } from "react-toastify";
import type { StockMovementWithRelations } from "@/modules/warehouse/types/stock-movements";
import { formatDate } from "@/lib/utils";

export default function MovementDetailsPage() {
  const router = useRouter();
  const params = useParams();
  const movementId = params.id as string;

  const [movement, setMovement] = useState<StockMovementWithRelations | null>(null);
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState(false);

  useEffect(() => {
    loadMovement();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [movementId]);

  const loadMovement = async () => {
    try {
      setLoading(true);
      const result = await getMovementById(movementId);

      if (result.success && result.data) {
        setMovement(result.data);
      } else {
        toast.error(result.error || "Failed to load movement");
        router.push("/dashboard/warehouse/movements");
      }
    } catch (error) {
      console.error("Error loading movement:", error);
      toast.error("An error occurred while loading the movement");
    } finally {
      setLoading(false);
    }
  };

  const handleApprove = async () => {
    if (!movement) return;

    try {
      setProcessing(true);
      const result = await approveMovement(movement.id);

      if (result.success) {
        toast.success("Movement approved successfully");
        await loadMovement();
      } else {
        toast.error(result.error || "Failed to approve movement");
      }
    } catch (error) {
      console.error("Error approving movement:", error);
      toast.error("An error occurred while approving the movement");
    } finally {
      setProcessing(false);
    }
  };

  const handleCancel = async () => {
    if (!movement) return;

    const reason = prompt("Please enter a cancellation reason:");
    if (!reason) return;

    try {
      setProcessing(true);
      const result = await cancelMovement({ movementId: movement.id, reason });

      if (result.success) {
        toast.success("Movement cancelled successfully");
        await loadMovement();
      } else {
        toast.error(result.error || "Failed to cancel movement");
      }
    } catch (error) {
      console.error("Error cancelling movement:", error);
      toast.error("An error occurred while cancelling the movement");
    } finally {
      setProcessing(false);
    }
  };

  if (loading) {
    return (
      <div className="container mx-auto p-6">
        <div className="text-center py-12">
          <div className="text-muted-foreground">Loading movement details...</div>
        </div>
      </div>
    );
  }

  if (!movement) {
    return (
      <div className="container mx-auto p-6">
        <div className="text-center py-12">
          <div className="text-muted-foreground">Movement not found</div>
        </div>
      </div>
    );
  }

  const canApprove = movement.status === "pending" && movement.requires_approval;
  const canCancel = movement.status === "pending" || movement.status === "approved";

  return (
    <div className="container mx-auto p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => router.back()}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div>
            <h1 className="text-3xl font-bold flex items-center gap-2">
              <Package className="h-8 w-8" />
              {movement.movement_number}
            </h1>
            <p className="text-muted-foreground">Stock Movement Details</p>
          </div>
        </div>

        <div className="flex gap-2">
          {canCancel && (
            <Button variant="destructive" onClick={handleCancel} disabled={processing}>
              <XCircle className="mr-2 h-4 w-4" />
              Cancel Movement
            </Button>
          )}
          {canApprove && (
            <Button onClick={handleApprove} disabled={processing}>
              <CheckCircle2 className="mr-2 h-4 w-4" />
              Approve Movement
            </Button>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Main Details */}
        <div className="lg:col-span-2 space-y-6">
          {/* Status and Type */}
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle>Movement Information</CardTitle>
                <MovementStatusBadge status={movement.status} />
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-sm text-muted-foreground">Movement Type</p>
                  <div className="flex gap-2 mt-1">
                    <Badge variant="outline">
                      {movement.movement_type?.name || movement.movement_type_code}
                    </Badge>
                    {movement.movement_type?.polish_document_type && (
                      <Badge variant="secondary">
                        {movement.movement_type.polish_document_type}
                      </Badge>
                    )}
                  </div>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Category</p>
                  <p className="font-medium capitalize mt-1">{movement.category}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Product Information */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Package className="h-5 w-5" />
                Product Information
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-sm text-muted-foreground">Product</p>
                  <p className="font-medium">{movement.product?.name || "Unknown"}</p>
                </div>
                {movement.variant && (
                  <div>
                    <p className="text-sm text-muted-foreground">Variant</p>
                    <p className="font-medium">{movement.variant.name}</p>
                  </div>
                )}
                <div>
                  <p className="text-sm text-muted-foreground">Quantity</p>
                  <p className="text-2xl font-bold">
                    {movement.quantity} {movement.unit_of_measure || "pcs"}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Location Information */}
          {(movement.source_location || movement.destination_location) && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <MapPin className="h-5 w-5" />
                  Location Information
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 gap-4">
                  {movement.source_location && (
                    <div>
                      <p className="text-sm text-muted-foreground">Source Location</p>
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
                      <p className="text-sm text-muted-foreground">Destination Location</p>
                      <p className="font-medium">
                        {movement.destination_location.name}
                        <span className="text-muted-foreground ml-2">
                          ({movement.destination_location.code})
                        </span>
                      </p>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Financial Information */}
          {(movement.unit_cost || movement.total_cost) && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <DollarSign className="h-5 w-5" />
                  Financial Information
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 gap-4">
                  {movement.unit_cost && (
                    <div>
                      <p className="text-sm text-muted-foreground">Unit Cost</p>
                      <p className="font-medium">
                        {movement.unit_cost} {movement.currency || "PLN"}
                      </p>
                    </div>
                  )}
                  {movement.total_cost && (
                    <div>
                      <p className="text-sm text-muted-foreground">Total Cost</p>
                      <p className="text-xl font-bold">
                        {movement.total_cost} {movement.currency || "PLN"}
                      </p>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Notes */}
          {movement.notes && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <FileText className="h-5 w-5" />
                  Notes
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground">{movement.notes}</p>
              </CardContent>
            </Card>
          )}
        </div>

        {/* Sidebar */}
        <div className="space-y-6">
          {/* Timestamps */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Clock className="h-5 w-5" />
                Timeline
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-sm">
              <div>
                <p className="text-muted-foreground">Occurred At</p>
                <p className="font-medium">{formatDate(movement.occurred_at)}</p>
              </div>
              <Separator />
              <div>
                <p className="text-muted-foreground">Created At</p>
                <p className="font-medium">{formatDate(movement.created_at)}</p>
              </div>
              {movement.approved_at && (
                <>
                  <Separator />
                  <div>
                    <p className="text-muted-foreground">Approved At</p>
                    <p className="font-medium">{formatDate(movement.approved_at)}</p>
                  </div>
                </>
              )}
              {movement.completed_at && (
                <>
                  <Separator />
                  <div>
                    <p className="text-muted-foreground">Completed At</p>
                    <p className="font-medium">{formatDate(movement.completed_at)}</p>
                  </div>
                </>
              )}
            </CardContent>
          </Card>

          {/* Tracking */}
          {(movement.batch_number || movement.serial_number || movement.lot_number) && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Hash className="h-5 w-5" />
                  Tracking
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2 text-sm">
                {movement.batch_number && (
                  <div>
                    <p className="text-muted-foreground">Batch</p>
                    <p className="font-medium font-mono">{movement.batch_number}</p>
                  </div>
                )}
                {movement.serial_number && (
                  <div>
                    <p className="text-muted-foreground">Serial</p>
                    <p className="font-medium font-mono">{movement.serial_number}</p>
                  </div>
                )}
                {movement.lot_number && (
                  <div>
                    <p className="text-muted-foreground">Lot</p>
                    <p className="font-medium font-mono">{movement.lot_number}</p>
                  </div>
                )}
              </CardContent>
            </Card>
          )}

          {/* Users */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <User className="h-5 w-5" />
                Users
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-sm">
              {movement.created_by_user && (
                <div>
                  <p className="text-muted-foreground">Created By</p>
                  <p className="font-medium">{movement.created_by_user.email}</p>
                </div>
              )}
              {movement.approved_by_user && (
                <div>
                  <p className="text-muted-foreground">Approved By</p>
                  <p className="font-medium">{movement.approved_by_user.email}</p>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
