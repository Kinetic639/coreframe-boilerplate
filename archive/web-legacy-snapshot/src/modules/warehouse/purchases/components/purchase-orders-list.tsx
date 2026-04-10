"use client";

import React from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Search, Eye, Edit, MoreHorizontal, FileText } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useAppStore } from "@/lib/stores/app-store";
import { getPurchaseOrdersAction } from "../actions/purchase-orders-actions";
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
  daysUntilDelivery,
  isDeliveryOverdue,
} from "../../types/purchase-orders";

export function PurchaseOrdersList() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { activeOrgId } = useAppStore();

  const [purchaseOrders, setPurchaseOrders] = React.useState<PurchaseOrderWithRelations[]>([]);
  const [total, setTotal] = React.useState(0);
  const [loading, setLoading] = React.useState(true);

  // Filters
  const [searchTerm, setSearchTerm] = React.useState(searchParams.get("search") || "");
  const [statusFilter, setStatusFilter] = React.useState<PurchaseOrderStatus | "all">(
    (searchParams.get("status") as PurchaseOrderStatus) || "all"
  );
  const [paymentStatusFilter, setPaymentStatusFilter] = React.useState<PaymentStatus | "all">(
    (searchParams.get("payment_status") as PaymentStatus) || "all"
  );

  // Load purchase orders
  const loadPurchaseOrders = React.useCallback(async () => {
    if (!activeOrgId) return;

    setLoading(true);
    try {
      const filters: any = {
        limit: 50,
        sort_by: "po_date",
        sort_order: "desc",
      };

      if (searchTerm) {
        filters.search = searchTerm;
      }

      if (statusFilter !== "all") {
        filters.status = [statusFilter];
      }

      if (paymentStatusFilter !== "all") {
        filters.payment_status = [paymentStatusFilter];
      }

      const result = await getPurchaseOrdersAction(activeOrgId, filters);

      if (result.success && result.data) {
        setPurchaseOrders(result.data.purchase_orders);
        setTotal(result.data.total);
      }
    } catch (error) {
      console.error("Failed to load purchase orders:", error);
    } finally {
      setLoading(false);
    }
  }, [activeOrgId, searchTerm, statusFilter, paymentStatusFilter]);

  React.useEffect(() => {
    loadPurchaseOrders();
  }, [loadPurchaseOrders]);

  const getStatusBadgeColor = (status: PurchaseOrderStatus) => {
    const colorMap: Record<string, string> = {
      gray: "bg-gray-100 text-gray-800",
      yellow: "bg-yellow-100 text-yellow-800",
      blue: "bg-blue-100 text-blue-800",
      orange: "bg-orange-100 text-orange-800",
      green: "bg-green-100 text-green-800",
      red: "bg-red-100 text-red-800",
      slate: "bg-slate-100 text-slate-800",
    };
    return colorMap[PO_STATUS_COLORS[status]] || "bg-gray-100 text-gray-800";
  };

  const getPaymentBadgeColor = (status: PaymentStatus) => {
    const colorMap: Record<string, string> = {
      red: "bg-red-100 text-red-800",
      yellow: "bg-yellow-100 text-yellow-800",
      green: "bg-green-100 text-green-800",
    };
    return colorMap[PAYMENT_STATUS_COLORS[status]] || "bg-gray-100 text-gray-800";
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Purchase Orders</CardTitle>
      </CardHeader>
      <CardContent>
        {/* Filters */}
        <div className="mb-6 flex flex-col gap-4 sm:flex-row">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Search by PO number, supplier..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10"
            />
          </div>
          <Select
            value={statusFilter}
            onValueChange={(value) => setStatusFilter(value as PurchaseOrderStatus | "all")}
          >
            <SelectTrigger className="w-full sm:w-[200px]">
              <SelectValue placeholder="Filter by status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Statuses</SelectItem>
              <SelectItem value="draft">Draft</SelectItem>
              <SelectItem value="pending">Pending Approval</SelectItem>
              <SelectItem value="approved">Approved</SelectItem>
              <SelectItem value="partially_received">Partially Received</SelectItem>
              <SelectItem value="received">Received</SelectItem>
              <SelectItem value="cancelled">Cancelled</SelectItem>
              <SelectItem value="closed">Closed</SelectItem>
            </SelectContent>
          </Select>
          <Select
            value={paymentStatusFilter}
            onValueChange={(value) => setPaymentStatusFilter(value as PaymentStatus | "all")}
          >
            <SelectTrigger className="w-full sm:w-[200px]">
              <SelectValue placeholder="Payment status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Payment Status</SelectItem>
              <SelectItem value="unpaid">Unpaid</SelectItem>
              <SelectItem value="partially_paid">Partially Paid</SelectItem>
              <SelectItem value="paid">Paid</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Table */}
        {loading ? (
          <div className="space-y-3">
            {[1, 2, 3, 4, 5].map((i) => (
              <div key={i} className="h-16 animate-pulse rounded bg-muted" />
            ))}
          </div>
        ) : purchaseOrders.length === 0 ? (
          <div className="flex h-64 flex-col items-center justify-center gap-2 rounded-lg border border-dashed">
            <FileText className="h-12 w-12 text-muted-foreground" />
            <p className="text-lg font-medium">No purchase orders found</p>
            <p className="text-sm text-muted-foreground">
              Create your first purchase order to get started
            </p>
          </div>
        ) : (
          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>PO Number</TableHead>
                  <TableHead>Date</TableHead>
                  <TableHead>Supplier</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Payment</TableHead>
                  <TableHead>Expected Delivery</TableHead>
                  <TableHead className="text-right">Total</TableHead>
                  <TableHead></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {purchaseOrders.map((po) => {
                  const deliveryDays = daysUntilDelivery(po.expected_delivery_date);
                  const overdue = isDeliveryOverdue(
                    po.expected_delivery_date,
                    po.status as PurchaseOrderStatus
                  );

                  return (
                    <TableRow key={po.id} className="cursor-pointer hover:bg-muted/50">
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
                        <div>
                          <div className="font-medium">{po.supplier_name}</div>
                          {po.supplier_reference && (
                            <div className="text-xs text-muted-foreground">
                              Ref: {po.supplier_reference}
                            </div>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge className={getStatusBadgeColor(po.status as PurchaseOrderStatus)}>
                          {PO_STATUS_LABELS[po.status as PurchaseOrderStatus]}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <Badge className={getPaymentBadgeColor(po.payment_status as PaymentStatus)}>
                          {PAYMENT_STATUS_LABELS[po.payment_status as PaymentStatus]}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        {po.expected_delivery_date ? (
                          <div className={overdue ? "text-red-600" : ""}>
                            {new Date(po.expected_delivery_date).toLocaleDateString()}
                            {deliveryDays !== null && (
                              <div className="text-xs text-muted-foreground">
                                {overdue
                                  ? `${Math.abs(deliveryDays)} days overdue`
                                  : `in ${deliveryDays} days`}
                              </div>
                            )}
                          </div>
                        ) : (
                          <span className="text-muted-foreground">Not set</span>
                        )}
                      </TableCell>
                      <TableCell className="text-right font-medium">
                        {formatCurrency(po.total_amount, po.currency_code)}
                      </TableCell>
                      <TableCell>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" className="h-8 w-8 p-0">
                              <MoreHorizontal className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuLabel>Actions</DropdownMenuLabel>
                            <DropdownMenuItem
                              onClick={() => router.push(`/dashboard/warehouse/purchases/${po.id}`)}
                            >
                              <Eye className="mr-2 h-4 w-4" />
                              View Details
                            </DropdownMenuItem>
                            {po.status === "draft" && (
                              <DropdownMenuItem
                                onClick={() =>
                                  router.push(`/dashboard/warehouse/purchases/${po.id}/edit`)
                                }
                              >
                                <Edit className="mr-2 h-4 w-4" />
                                Edit
                              </DropdownMenuItem>
                            )}
                            <DropdownMenuSeparator />
                            <DropdownMenuItem disabled>
                              <FileText className="mr-2 h-4 w-4" />
                              Download PDF
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        )}

        {/* Results count */}
        {!loading && purchaseOrders.length > 0 && (
          <div className="mt-4 text-sm text-muted-foreground">
            Showing {purchaseOrders.length} of {total} purchase orders
          </div>
        )}
      </CardContent>
    </Card>
  );
}
