/**
 * Product Purchase Orders Tab
 * Displays all purchase orders containing this product
 */

"use client";

import * as React from "react";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { ExternalLink, Package } from "lucide-react";
import { toast } from "react-toastify";
import { useAppStore } from "@/lib/stores/app-store";
import { getProductPurchaseOrdersAction } from "../actions/product-purchase-orders-actions";
import type { PurchaseOrderWithRelations } from "../../types/purchase-orders";
import { PO_STATUS_LABELS, PO_STATUS_COLORS, formatCurrency } from "../../types/purchase-orders";

interface ProductPurchaseOrdersTabProps {
  productId: string;
}

interface PurchaseOrderItemSummary extends PurchaseOrderWithRelations {
  item_quantity_ordered: number;
  item_quantity_received: number;
  item_quantity_pending: number;
  item_unit_price: number;
  item_line_total: number;
}

export function ProductPurchaseOrdersTab({ productId }: ProductPurchaseOrdersTabProps) {
  const { activeOrgId } = useAppStore();
  const [purchaseOrders, setPurchaseOrders] = React.useState<PurchaseOrderItemSummary[]>([]);
  const [loading, setLoading] = React.useState(true);

  const loadPurchaseOrders = React.useCallback(async () => {
    if (!activeOrgId) return;

    setLoading(true);
    try {
      const result = await getProductPurchaseOrdersAction(productId, activeOrgId);
      if (result.success && result.data) {
        setPurchaseOrders(result.data);
      } else {
        throw new Error(result.error || "Failed to load purchase orders");
      }
    } catch (error) {
      console.error("Error loading purchase orders:", error);
      toast.error("Failed to load purchase orders");
    } finally {
      setLoading(false);
    }
  }, [productId, activeOrgId]);

  React.useEffect(() => {
    loadPurchaseOrders();
  }, [loadPurchaseOrders]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-8">
        <div className="text-sm text-muted-foreground">Loading purchase orders...</div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-medium">Purchase Orders</h3>
          <p className="text-sm text-muted-foreground">
            All purchase orders containing this product
          </p>
        </div>
      </div>

      {purchaseOrders.length === 0 ? (
        <div className="rounded-lg border border-dashed p-8 text-center">
          <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-muted">
            <Package className="h-6 w-6 text-muted-foreground" />
          </div>
          <h3 className="mb-1 text-sm font-medium">No purchase orders found</h3>
          <p className="mb-4 text-sm text-muted-foreground">
            This product has not been included in any purchase orders yet
          </p>
        </div>
      ) : (
        <div className="rounded-lg border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>PO Number</TableHead>
                <TableHead>Date</TableHead>
                <TableHead>Supplier</TableHead>
                <TableHead className="text-right">Qty Ordered</TableHead>
                <TableHead className="text-right">Qty Received</TableHead>
                <TableHead className="text-right">Qty Pending</TableHead>
                <TableHead className="text-right">Unit Price</TableHead>
                <TableHead className="text-right">Line Total</TableHead>
                <TableHead className="text-center">Status</TableHead>
                <TableHead className="w-[70px]"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {purchaseOrders.map((po) => (
                <TableRow key={po.id}>
                  <TableCell className="font-medium">
                    <Link
                      href={`/dashboard/warehouse/purchases/${po.id}`}
                      className="hover:underline"
                    >
                      {po.po_number}
                    </Link>
                  </TableCell>
                  <TableCell>{new Date(po.po_date).toLocaleDateString()}</TableCell>
                  <TableCell>
                    <div className="font-medium">{po.supplier_name}</div>
                  </TableCell>
                  <TableCell className="text-right">{po.item_quantity_ordered}</TableCell>
                  <TableCell className="text-right">{po.item_quantity_received}</TableCell>
                  <TableCell className="text-right">
                    <span className={po.item_quantity_pending > 0 ? "font-medium" : ""}>
                      {po.item_quantity_pending}
                    </span>
                  </TableCell>
                  <TableCell className="text-right">
                    {formatCurrency(po.item_unit_price, po.currency_code)}
                  </TableCell>
                  <TableCell className="text-right font-medium">
                    {formatCurrency(po.item_line_total, po.currency_code)}
                  </TableCell>
                  <TableCell className="text-center">
                    <Badge
                      variant={PO_STATUS_COLORS[po.status as keyof typeof PO_STATUS_COLORS] as any}
                    >
                      {PO_STATUS_LABELS[po.status as keyof typeof PO_STATUS_LABELS]}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <Link href={`/dashboard/warehouse/purchases/${po.id}`}>
                      <Button variant="ghost" size="icon">
                        <ExternalLink className="h-4 w-4" />
                      </Button>
                    </Link>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      {purchaseOrders.length > 0 && (
        <div className="flex items-center justify-between text-sm text-muted-foreground">
          <div>
            {purchaseOrders.length} purchase order(s) •{" "}
            {purchaseOrders.filter((po) => po.item_quantity_pending > 0).length} with pending
            quantities
          </div>
        </div>
      )}
    </div>
  );
}
