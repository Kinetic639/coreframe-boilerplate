"use client";

import React from "react";
import { useRouter } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Edit,
  Send,
  CheckCircle,
  XCircle,
  FileText,
  Package,
  DollarSign,
  User,
} from "lucide-react";
import { toast } from "react-toastify";
import { useAppStore } from "@/lib/stores/app-store";
import {
  getPurchaseOrderByIdAction,
  submitPurchaseOrderAction,
  approvePurchaseOrderAction,
  rejectPurchaseOrderAction,
  cancelPurchaseOrderAction,
  closePurchaseOrderAction,
} from "../actions/purchase-orders-actions";
import type {
  PurchaseOrderWithRelations,
  PurchaseOrderStatus,
  PaymentStatus,
} from "../../types/purchase-orders";
import {
  PO_STATUS_LABELS,
  PO_STATUS_COLORS,
  PAYMENT_STATUS_LABELS,
  PAYMENT_STATUS_COLORS,
  formatCurrency,
  canEditPurchaseOrder,
  canApprovePurchaseOrder,
  canCancelPurchaseOrder,
  canReceivePurchaseOrder,
  canClosePurchaseOrder,
  calculateCompletionPercentage,
} from "../../types/purchase-orders";

interface PurchaseOrderDetailsProps {
  purchaseOrderId: string;
}

export function PurchaseOrderDetails({ purchaseOrderId }: PurchaseOrderDetailsProps) {
  const router = useRouter();
  const { activeOrgId } = useAppStore();
  const [po, setPo] = React.useState<PurchaseOrderWithRelations | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [actionLoading, setActionLoading] = React.useState(false);
  const [rejectReason, setRejectReason] = React.useState("");
  const [cancelReason, setCancelReason] = React.useState("");

  const loadPurchaseOrder = React.useCallback(async () => {
    if (!activeOrgId) return;

    setLoading(true);
    try {
      const result = await getPurchaseOrderByIdAction(purchaseOrderId, activeOrgId);
      if (result.success && result.data) {
        setPo(result.data);
      } else {
        toast.error(result.error || "Purchase order not found");
        router.push("/dashboard-old/warehouse/purchases");
      }
    } catch (error) {
      console.error("Failed to load purchase order:", error);
      toast.error("Failed to load purchase order");
    } finally {
      setLoading(false);
    }
  }, [purchaseOrderId, activeOrgId, router]);

  React.useEffect(() => {
    loadPurchaseOrder();
  }, [loadPurchaseOrder]);

  const handleSubmit = async () => {
    if (!po || !activeOrgId) return;

    setActionLoading(true);
    try {
      const result = await submitPurchaseOrderAction(po.id, activeOrgId);
      if (result.success) {
        toast.success("Purchase order submitted for approval");
        loadPurchaseOrder();
      } else {
        toast.error(result.error || "Failed to submit purchase order");
      }
    } catch {
      toast.error("Failed to submit purchase order");
    } finally {
      setActionLoading(false);
    }
  };

  const handleApprove = async () => {
    if (!po || !activeOrgId) return;

    setActionLoading(true);
    try {
      const result = await approvePurchaseOrderAction(po.id, activeOrgId);
      if (result.success) {
        toast.success("Purchase order approved");
        loadPurchaseOrder();
      } else {
        toast.error(result.error || "Failed to approve purchase order");
      }
    } catch {
      toast.error("Failed to approve purchase order");
    } finally {
      setActionLoading(false);
    }
  };

  const handleReject = async () => {
    if (!po || !activeOrgId || !rejectReason.trim()) {
      toast.error("Please provide a rejection reason");
      return;
    }

    setActionLoading(true);
    try {
      const result = await rejectPurchaseOrderAction(po.id, activeOrgId, rejectReason);
      if (result.success) {
        toast.success("Purchase order rejected");
        setRejectReason("");
        loadPurchaseOrder();
      } else {
        toast.error(result.error || "Failed to reject purchase order");
      }
    } catch {
      toast.error("Failed to reject purchase order");
    } finally {
      setActionLoading(false);
    }
  };

  const handleCancel = async () => {
    if (!po || !activeOrgId || !cancelReason.trim()) {
      toast.error("Please provide a cancellation reason");
      return;
    }

    setActionLoading(true);
    try {
      const result = await cancelPurchaseOrderAction(po.id, activeOrgId, cancelReason);
      if (result.success) {
        toast.success("Purchase order cancelled");
        setCancelReason("");
        loadPurchaseOrder();
      } else {
        toast.error(result.error || "Failed to cancel purchase order");
      }
    } catch {
      toast.error("Failed to cancel purchase order");
    } finally {
      setActionLoading(false);
    }
  };

  const handleClose = async () => {
    if (!po || !activeOrgId) return;

    setActionLoading(true);
    try {
      const result = await closePurchaseOrderAction(po.id, activeOrgId);
      if (result.success) {
        toast.success("Purchase order closed");
        loadPurchaseOrder();
      } else {
        toast.error(result.error || "Failed to close purchase order");
      }
    } catch {
      toast.error("Failed to close purchase order");
    } finally {
      setActionLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="space-y-6">
        {[1, 2, 3].map((i) => (
          <Card key={i}>
            <CardHeader>
              <div className="h-6 w-48 animate-pulse rounded bg-muted" />
            </CardHeader>
            <CardContent>
              <div className="h-32 animate-pulse rounded bg-muted" />
            </CardContent>
          </Card>
        ))}
      </div>
    );
  }

  if (!po) {
    return null;
  }

  const statusColor = PO_STATUS_COLORS[po.status as PurchaseOrderStatus];
  const paymentColor = PAYMENT_STATUS_COLORS[po.payment_status as PaymentStatus];

  return (
    <div className="space-y-6">
      {/* Header with Actions */}
      <Card>
        <CardHeader>
          <div className="flex items-start justify-between">
            <div>
              <div className="mb-2 flex items-center gap-3">
                <CardTitle className="text-2xl">{po.po_number}</CardTitle>
                <Badge
                  className={`${statusColor === "gray" ? "bg-gray-100 text-gray-800" : statusColor === "yellow" ? "bg-yellow-100 text-yellow-800" : statusColor === "blue" ? "bg-blue-100 text-blue-800" : statusColor === "orange" ? "bg-orange-100 text-orange-800" : statusColor === "green" ? "bg-green-100 text-green-800" : statusColor === "red" ? "bg-red-100 text-red-800" : "bg-slate-100 text-slate-800"}`}
                >
                  {PO_STATUS_LABELS[po.status]}
                </Badge>
                <Badge
                  className={`${paymentColor === "red" ? "bg-red-100 text-red-800" : paymentColor === "yellow" ? "bg-yellow-100 text-yellow-800" : "bg-green-100 text-green-800"}`}
                >
                  {PAYMENT_STATUS_LABELS[po.payment_status]}
                </Badge>
              </div>
              <p className="text-muted-foreground">
                Created on {new Date(po.created_at).toLocaleString()}
              </p>
            </div>

            <div className="flex gap-2">
              {canEditPurchaseOrder(po.status as PurchaseOrderStatus) && (
                <Button variant="outline" size="sm">
                  <Edit className="mr-2 h-4 w-4" />
                  Edit
                </Button>
              )}

              {po.status === "draft" && (
                <Button size="sm" onClick={handleSubmit} disabled={actionLoading}>
                  <Send className="mr-2 h-4 w-4" />
                  Submit for Approval
                </Button>
              )}

              {canApprovePurchaseOrder(po.status as PurchaseOrderStatus) && (
                <>
                  <Button size="sm" onClick={handleApprove} disabled={actionLoading}>
                    <CheckCircle className="mr-2 h-4 w-4" />
                    Approve
                  </Button>
                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <Button variant="outline" size="sm" disabled={actionLoading}>
                        <XCircle className="mr-2 h-4 w-4" />
                        Reject
                      </Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle>Reject Purchase Order</AlertDialogTitle>
                        <AlertDialogDescription>
                          Please provide a reason for rejecting this purchase order.
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <div className="space-y-2">
                        <Label>Rejection Reason</Label>
                        <Textarea
                          value={rejectReason}
                          onChange={(e) => setRejectReason(e.target.value)}
                          placeholder="Enter reason for rejection..."
                          rows={3}
                        />
                      </div>
                      <AlertDialogFooter>
                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                        <AlertDialogAction onClick={handleReject}>Reject</AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                </>
              )}

              {canReceivePurchaseOrder(po.status as PurchaseOrderStatus) && (
                <Button
                  size="sm"
                  onClick={() => router.push(`/dashboard/warehouse/purchases/${po.id}/receive`)}
                >
                  <Package className="mr-2 h-4 w-4" />
                  Receive Items
                </Button>
              )}

              {canClosePurchaseOrder(po.status as PurchaseOrderStatus) && (
                <Button variant="outline" size="sm" onClick={handleClose} disabled={actionLoading}>
                  Close Order
                </Button>
              )}

              {canCancelPurchaseOrder(po.status as PurchaseOrderStatus) && (
                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button variant="destructive" size="sm" disabled={actionLoading}>
                      <XCircle className="mr-2 h-4 w-4" />
                      Cancel
                    </Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>Cancel Purchase Order</AlertDialogTitle>
                      <AlertDialogDescription>
                        Please provide a reason for cancelling this purchase order.
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <div className="space-y-2">
                      <Label>Cancellation Reason</Label>
                      <Textarea
                        value={cancelReason}
                        onChange={(e) => setCancelReason(e.target.value)}
                        placeholder="Enter reason for cancellation..."
                        rows={3}
                      />
                    </div>
                    <AlertDialogFooter>
                      <AlertDialogCancel>Cancel</AlertDialogCancel>
                      <AlertDialogAction onClick={handleCancel} className="bg-red-600">
                        Cancel Order
                      </AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              )}
            </div>
          </div>
        </CardHeader>
      </Card>

      {/* General Information */}
      <div className="grid gap-6 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <FileText className="h-5 w-5" />
              Order Information
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex justify-between">
              <span className="text-muted-foreground">PO Number:</span>
              <span className="font-medium">{po.po_number}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">PO Date:</span>
              <span>{new Date(po.po_date).toLocaleDateString()}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Expected Delivery:</span>
              <span>
                {po.expected_delivery_date
                  ? new Date(po.expected_delivery_date).toLocaleDateString()
                  : "Not set"}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Payment Terms:</span>
              <span>{po.payment_terms || "Not specified"}</span>
            </div>
            {po.supplier_reference && (
              <div className="flex justify-between">
                <span className="text-muted-foreground">Supplier Reference:</span>
                <span>{po.supplier_reference}</span>
              </div>
            )}
            {po.status === "cancelled" && po.cancellation_reason && (
              <div className="space-y-2 rounded-lg border border-red-200 bg-red-50 p-3">
                <div className="text-sm font-medium text-red-900">Cancellation Reason:</div>
                <div className="text-sm text-red-700">{po.cancellation_reason}</div>
                {po.cancelled_at && (
                  <div className="text-xs text-red-600">
                    Cancelled on {new Date(po.cancelled_at).toLocaleString()}
                  </div>
                )}
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <User className="h-5 w-5" />
              Supplier Information
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div>
              <span className="text-muted-foreground">Name:</span>
              <p className="font-medium">{po.supplier_name}</p>
            </div>
            {po.supplier_email && (
              <div>
                <span className="text-muted-foreground">Email:</span>
                <p>{po.supplier_email}</p>
              </div>
            )}
            {po.supplier_phone && (
              <div>
                <span className="text-muted-foreground">Phone:</span>
                <p>{po.supplier_phone}</p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Items */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Package className="h-5 w-5" />
            Order Items
          </CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Product</TableHead>
                <TableHead>SKU</TableHead>
                <TableHead className="text-right">Ordered</TableHead>
                <TableHead className="text-right">Received</TableHead>
                <TableHead className="text-right">Pending</TableHead>
                <TableHead className="text-right">Unit Price</TableHead>
                <TableHead className="text-right">Total</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {po.items?.map((item) => {
                const completion = calculateCompletionPercentage(
                  item.quantity_ordered,
                  item.quantity_received
                );

                return (
                  <TableRow key={item.id}>
                    <TableCell>
                      <div>
                        <div className="font-medium">{item.product_name}</div>
                        {item.variant_name && (
                          <div className="text-xs text-muted-foreground">{item.variant_name}</div>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="text-sm">
                        {item.product_sku}
                        {item.supplier_sku && (
                          <div className="text-xs text-muted-foreground">
                            Supplier: {item.supplier_sku}
                          </div>
                        )}
                      </div>
                    </TableCell>
                    <TableCell className="text-right">{item.quantity_ordered}</TableCell>
                    <TableCell className="text-right">
                      <div>
                        {item.quantity_received}
                        <div className="text-xs text-muted-foreground">{completion}%</div>
                      </div>
                    </TableCell>
                    <TableCell className="text-right">{item.quantity_pending}</TableCell>
                    <TableCell className="text-right">
                      {formatCurrency(item.unit_price, po.currency_code)}
                    </TableCell>
                    <TableCell className="text-right font-medium">
                      {formatCurrency(item.line_total, po.currency_code)}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Totals */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <DollarSign className="h-5 w-5" />
            Order Summary
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Subtotal:</span>
              <span>{formatCurrency(po.subtotal, po.currency_code)}</span>
            </div>
            {po.discount_amount > 0 && (
              <div className="flex justify-between">
                <span className="text-muted-foreground">Discount:</span>
                <span className="text-red-600">
                  -{formatCurrency(po.discount_amount, po.currency_code)}
                </span>
              </div>
            )}
            <div className="flex justify-between">
              <span className="text-muted-foreground">Tax:</span>
              <span>{formatCurrency(po.tax_amount, po.currency_code)}</span>
            </div>
            {po.shipping_cost > 0 && (
              <div className="flex justify-between">
                <span className="text-muted-foreground">Shipping:</span>
                <span>{formatCurrency(po.shipping_cost, po.currency_code)}</span>
              </div>
            )}
            <div className="flex justify-between border-t pt-2 text-lg font-bold">
              <span>Total:</span>
              <span>{formatCurrency(po.total_amount, po.currency_code)}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Amount Paid:</span>
              <span className="text-green-600">
                {formatCurrency(po.amount_paid, po.currency_code)}
              </span>
            </div>
            {po.total_amount - po.amount_paid > 0 && (
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Amount Due:</span>
                <span className="font-medium text-red-600">
                  {formatCurrency(po.total_amount - po.amount_paid, po.currency_code)}
                </span>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Notes */}
      {(po.notes || po.internal_notes) && (
        <Card>
          <CardHeader>
            <CardTitle>Notes</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {po.notes && (
              <div>
                <h4 className="mb-1 font-medium">Notes (visible to supplier):</h4>
                <p className="text-sm text-muted-foreground">{po.notes}</p>
              </div>
            )}
            {po.internal_notes && (
              <div>
                <h4 className="mb-1 font-medium">Internal Notes:</h4>
                <p className="text-sm text-muted-foreground">{po.internal_notes}</p>
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
