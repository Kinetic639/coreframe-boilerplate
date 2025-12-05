"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import type { SalesOrderWithRelations, SalesOrderStatus } from "../../types/sales-orders";
import { SALES_ORDER_STATUS_LABELS, SALES_ORDER_STATUS_COLORS } from "../../types/sales-orders";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Separator } from "@/components/ui/separator";
import { ArrowLeft, Edit, Trash2 } from "lucide-react";
import { useAppStore } from "@/lib/stores/app-store";
import { useUserStore } from "@/lib/stores/user-store";
import { format } from "date-fns";
import { toast } from "react-toastify";
import { OrderStatusActions } from "./order-status-actions";

interface SalesOrderDetailsProps {
  orderId: string;
}

export function SalesOrderDetails({ orderId }: SalesOrderDetailsProps) {
  const router = useRouter();
  const { activeOrg } = useAppStore();
  const { user } = useUserStore();

  const [order, setOrder] = useState<SalesOrderWithRelations | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadOrder = useCallback(async () => {
    if (!activeOrg?.organization_id || !orderId) return;

    try {
      setLoading(true);
      setError(null);

      const data = await salesOrdersService.getSalesOrder(orderId, activeOrg.organization_id);

      if (!data) {
        setError("Order not found");
        return;
      }

      setOrder(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load order");
      console.error("Error loading sales order:", err);
    } finally {
      setLoading(false);
    }
  }, [orderId, activeOrg]);

  useEffect(() => {
    loadOrder();
  }, [loadOrder]);

  async function handleDelete() {
    if (!activeOrg?.organization_id || !order) return;

    if (!confirm("Are you sure you want to delete this order?")) {
      return;
    }

    try {
      const result = await salesOrdersService.deleteSalesOrder(order.id, activeOrg.organization_id);

      if (result.success) {
        toast.success("Order deleted successfully");
        router.push("/dashboard/warehouse/sales-orders");
      } else {
        toast.error(result.error || "Failed to delete order");
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to delete order");
    }
  }

  function formatCurrency(amount: number | null): string {
    if (amount === null) return "PLN 0.00";
    return `PLN ${amount.toFixed(2)}`;
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-muted-foreground">Loading order details...</div>
      </div>
    );
  }

  if (error || !order) {
    return (
      <div className="flex flex-col items-center justify-center h-64 gap-4">
        <div className="text-destructive">{error || "Order not found"}</div>
        <Button onClick={() => router.push("/dashboard/warehouse/sales-orders")}>
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back to Orders
        </Button>
      </div>
    );
  }

  const canEdit = order.status === "draft" || order.status === "pending";
  const canDelete = order.status === "draft" || order.status === "pending";

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => router.push("/dashboard/warehouse/sales-orders")}
          >
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back
          </Button>
          <div>
            <h1 className="text-3xl font-bold">{order.order_number}</h1>
            <p className="text-muted-foreground mt-1">
              Created {format(new Date(order.created_at || ""), "MMM dd, yyyy 'at' HH:mm")}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant={SALES_ORDER_STATUS_COLORS[order.status]} className="text-sm">
            {SALES_ORDER_STATUS_LABELS[order.status]}
          </Badge>

          {/* Status Transition Actions */}
          {activeOrg?.organization_id && user?.id && (
            <OrderStatusActions
              orderId={order.id}
              organizationId={activeOrg.organization_id}
              userId={user.id}
              currentStatus={order.status as SalesOrderStatus}
              onStatusChanged={loadOrder}
            />
          )}

          {canEdit && (
            <Button variant="outline" size="sm" disabled>
              <Edit className="h-4 w-4 mr-2" />
              Edit
            </Button>
          )}
          {canDelete && (
            <Button variant="destructive" size="sm" onClick={handleDelete}>
              <Trash2 className="h-4 w-4 mr-2" />
              Delete
            </Button>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Customer Information */}
        <Card>
          <CardHeader>
            <CardTitle>Customer Information</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <div>
              <div className="text-sm text-muted-foreground">Customer Name</div>
              <div className="font-medium">{order.customer_name}</div>
            </div>
            {order.customer_email && (
              <div>
                <div className="text-sm text-muted-foreground">Email</div>
                <div>{order.customer_email}</div>
              </div>
            )}
            {order.customer_phone && (
              <div>
                <div className="text-sm text-muted-foreground">Phone</div>
                <div>{order.customer_phone}</div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Order Information */}
        <Card>
          <CardHeader>
            <CardTitle>Order Information</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <div>
              <div className="text-sm text-muted-foreground">Order Date</div>
              <div className="font-medium">
                {format(new Date(order.order_date), "MMM dd, yyyy")}
              </div>
            </div>
            {order.expected_delivery_date && (
              <div>
                <div className="text-sm text-muted-foreground">Expected Delivery</div>
                <div>{format(new Date(order.expected_delivery_date), "MMM dd, yyyy")}</div>
              </div>
            )}
            <div>
              <div className="text-sm text-muted-foreground">Currency</div>
              <div>{order.currency_code || "PLN"}</div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Delivery Address */}
      {order.delivery_address_line1 && (
        <Card>
          <CardHeader>
            <CardTitle>Delivery Address</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-1">
              <div>{order.delivery_address_line1}</div>
              {order.delivery_address_line2 && <div>{order.delivery_address_line2}</div>}
              <div>
                {order.delivery_city && `${order.delivery_city}, `}
                {order.delivery_state && `${order.delivery_state} `}
                {order.delivery_postal_code}
              </div>
              <div>{order.delivery_country}</div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Order Items */}
      <Card>
        <CardHeader>
          <CardTitle>Order Items</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Product</TableHead>
                <TableHead>SKU</TableHead>
                <TableHead className="text-right">Quantity</TableHead>
                <TableHead className="text-right">Unit Price</TableHead>
                <TableHead className="text-right">Discount</TableHead>
                <TableHead className="text-right">Tax</TableHead>
                <TableHead className="text-right">Total</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {order.items && order.items.length > 0 ? (
                order.items.map((item) => (
                  <TableRow key={item.id}>
                    <TableCell>
                      <div className="font-medium">{item.product_name}</div>
                      {item.variant_name && (
                        <div className="text-sm text-muted-foreground">{item.variant_name}</div>
                      )}
                    </TableCell>
                    <TableCell>{item.product_sku || "-"}</TableCell>
                    <TableCell className="text-right">
                      {item.quantity_ordered}
                      {item.unit_of_measure && ` ${item.unit_of_measure}`}
                    </TableCell>
                    <TableCell className="text-right">{formatCurrency(item.unit_price)}</TableCell>
                    <TableCell className="text-right">
                      {item.discount_percent ? `${item.discount_percent}%` : "-"}
                    </TableCell>
                    <TableCell className="text-right">
                      {item.tax_rate ? `${item.tax_rate}%` : "-"}
                    </TableCell>
                    <TableCell className="text-right font-medium">
                      {formatCurrency(item.line_total)}
                    </TableCell>
                  </TableRow>
                ))
              ) : (
                <TableRow>
                  <TableCell colSpan={7} className="text-center text-muted-foreground">
                    No items
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>

          <Separator className="my-4" />

          {/* Totals */}
          <div className="space-y-2">
            <div className="flex justify-between text-sm">
              <div className="text-muted-foreground">Subtotal</div>
              <div>{formatCurrency(order.subtotal)}</div>
            </div>
            <div className="flex justify-between text-sm">
              <div className="text-muted-foreground">Tax</div>
              <div>{formatCurrency(order.tax_amount)}</div>
            </div>
            {order.shipping_cost && order.shipping_cost > 0 && (
              <div className="flex justify-between text-sm">
                <div className="text-muted-foreground">Shipping</div>
                <div>{formatCurrency(order.shipping_cost)}</div>
              </div>
            )}
            {order.discount_amount && order.discount_amount > 0 && (
              <div className="flex justify-between text-sm text-green-600">
                <div>Discount</div>
                <div>-{formatCurrency(order.discount_amount)}</div>
              </div>
            )}
            <Separator />
            <div className="flex justify-between text-lg font-bold">
              <div>Total</div>
              <div>{formatCurrency(order.total_amount)}</div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Notes */}
      {(order.customer_notes || order.internal_notes) && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {order.customer_notes && (
            <Card>
              <CardHeader>
                <CardTitle>Customer Notes</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm whitespace-pre-wrap">{order.customer_notes}</p>
              </CardContent>
            </Card>
          )}
          {order.internal_notes && (
            <Card>
              <CardHeader>
                <CardTitle>Internal Notes</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm whitespace-pre-wrap">{order.internal_notes}</p>
              </CardContent>
            </Card>
          )}
        </div>
      )}
    </div>
  );
}
