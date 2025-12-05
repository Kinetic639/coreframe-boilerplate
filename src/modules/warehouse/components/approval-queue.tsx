// =============================================
// Approval Queue Component
// List of movements pending approval
// =============================================

"use client";

import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { CheckCircle2, XCircle, Clock, Package, User } from "lucide-react";
import { toast } from "react-toastify";
import type { StockMovementWithRelations } from "../types/stock-movements";
import { formatDate } from "@/lib/utils";

interface ApprovalQueueProps {
  organizationId: string;
  branchId?: string;
  onApprove?: (movementId: string) => void;
  onReject?: (movementId: string) => void;
  maxItems?: number;
}

export function ApprovalQueue({
  organizationId,
  branchId,
  onApprove,
  onReject,
  maxItems = 10,
}: ApprovalQueueProps) {
  const [movements, setMovements] = useState<StockMovementWithRelations[]>([]);
  const [loading, setLoading] = useState(true);
  const [processingId, setProcessingId] = useState<string | null>(null);

  useEffect(() => {
    loadPendingApprovals();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [organizationId, branchId]);

  const loadPendingApprovals = async () => {
    try {
      setLoading(true);
      const data = await stockMovementsService.getPendingApprovals(organizationId, branchId);
      setMovements(data.slice(0, maxItems));
    } catch (error) {
      console.error("Error loading pending approvals:", error);
      toast.error("Failed to load pending approvals");
    } finally {
      setLoading(false);
    }
  };

  const handleApprove = async (movementId: string) => {
    try {
      setProcessingId(movementId);

      // Call server action for approval
      const response = await fetch("/api/warehouse/movements/approve", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: movementId }),
      });

      if (!response.ok) {
        throw new Error("Failed to approve movement");
      }

      toast.success("Movement approved successfully");
      onApprove?.(movementId);
      await loadPendingApprovals();
    } catch (error) {
      console.error("Error approving movement:", error);
      toast.error("Failed to approve movement");
    } finally {
      setProcessingId(null);
    }
  };

  const handleReject = async (movementId: string) => {
    try {
      setProcessingId(movementId);

      // Call server action for cancellation
      const response = await fetch("/api/warehouse/movements/cancel", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: movementId,
          reason: "Rejected during approval process",
        }),
      });

      if (!response.ok) {
        throw new Error("Failed to reject movement");
      }

      toast.success("Movement rejected");
      onReject?.(movementId);
      await loadPendingApprovals();
    } catch (error) {
      console.error("Error rejecting movement:", error);
      toast.error("Failed to reject movement");
    } finally {
      setProcessingId(null);
    }
  };

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Clock className="h-5 w-5" />
            Pending Approvals
          </CardTitle>
          <CardDescription>Movements awaiting approval</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="text-sm text-muted-foreground text-center py-8">Loading...</div>
        </CardContent>
      </Card>
    );
  }

  if (movements.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Clock className="h-5 w-5" />
            Pending Approvals
          </CardTitle>
          <CardDescription>Movements awaiting approval</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="text-sm text-muted-foreground text-center py-8">
            No movements pending approval
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Clock className="h-5 w-5" />
          Pending Approvals
          <Badge variant="secondary">{movements.length}</Badge>
        </CardTitle>
        <CardDescription>Movements awaiting approval</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {movements.map((movement) => (
            <div
              key={movement.id}
              className="flex items-center justify-between p-4 border rounded-lg"
            >
              <div className="flex-1 space-y-2">
                {/* Header */}
                <div className="flex items-center gap-2">
                  <Package className="h-4 w-4 text-muted-foreground" />
                  <span className="font-mono text-sm font-medium">{movement.movement_number}</span>
                  <Badge variant="outline" className="text-xs">
                    {movement.movement_type?.name || movement.movement_type_code}
                  </Badge>
                </div>

                {/* Product */}
                <div className="text-sm">
                  <span className="font-medium">{movement.product?.name}</span>
                  {movement.variant && (
                    <span className="text-muted-foreground"> • {movement.variant.name}</span>
                  )}
                </div>

                {/* Quantity */}
                <div className="text-sm font-semibold">
                  {movement.quantity} {movement.unit_of_measure || "pcs"}
                </div>

                {/* Metadata */}
                <div className="flex items-center gap-4 text-xs text-muted-foreground">
                  <div className="flex items-center gap-1">
                    <Clock className="h-3 w-3" />
                    {formatDate(movement.occurred_at)}
                  </div>
                  {movement.created_by_user && (
                    <div className="flex items-center gap-1">
                      <User className="h-3 w-3" />
                      {movement.created_by_user.email}
                    </div>
                  )}
                </div>
              </div>

              {/* Actions */}
              <div className="flex gap-2 ml-4">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => handleReject(movement.id)}
                  disabled={processingId === movement.id}
                >
                  <XCircle className="h-4 w-4 mr-1" />
                  Reject
                </Button>
                <Button
                  size="sm"
                  onClick={() => handleApprove(movement.id)}
                  disabled={processingId === movement.id}
                >
                  <CheckCircle2 className="h-4 w-4 mr-1" />
                  Approve
                </Button>
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
