"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { salesOrdersService } from "../../api/sales-orders-service";
import type { SalesOrderWithItems, SalesOrderStatus } from "../../types/sales-orders";
import { SALES_ORDER_STATUS_LABELS, SALES_ORDER_STATUS_COLORS } from "../../types/sales-orders";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Eye, Search } from "lucide-react";
import { useAppStore } from "@/lib/stores/app-store";
import { format } from "date-fns";

export function SalesOrdersList() {
  const router = useRouter();
  const { activeOrg, activeBranch } = useAppStore();

  const [orders, setOrders] = useState<SalesOrderWithItems[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Filters
  const [statusFilter, setStatusFilter] = useState<SalesOrderStatus | "all">("all");
  const [searchQuery, setSearchQuery] = useState("");

  const loadOrders = useCallback(async () => {
    if (!activeOrg?.organization_id) return;

    try {
      setLoading(true);
      setError(null);

      const response = await salesOrdersService.getSalesOrders(
        activeOrg.organization_id,
        activeBranch?.branch_id || null,
        {
          status: statusFilter === "all" ? undefined : statusFilter,
          search: searchQuery || undefined,
        }
      );

      setOrders(response.orders);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load orders");
      console.error("Error loading sales orders:", err);
    } finally {
      setLoading(false);
    }
  }, [activeOrg, activeBranch, statusFilter, searchQuery]);

  useEffect(() => {
    loadOrders();
  }, [loadOrders]);

  function handleSearch() {
    loadOrders();
  }

  function formatCurrency(amount: number | null): string {
    if (amount === null) return "PLN 0.00";
    return `PLN ${amount.toFixed(2)}`;
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-muted-foreground">Loading orders...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center h-64 gap-4">
        <div className="text-destructive">{error}</div>
        <Button onClick={loadOrders}>Retry</Button>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Filters */}
      <div className="flex gap-4">
        <div className="flex-1">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search by order number or customer name..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleSearch()}
              className="pl-10"
            />
          </div>
        </div>
        <Select
          value={statusFilter}
          onValueChange={(value) => setStatusFilter(value as SalesOrderStatus | "all")}
        >
          <SelectTrigger className="w-[180px]">
            <SelectValue placeholder="Filter by status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Statuses</SelectItem>
            <SelectItem value="draft">Draft</SelectItem>
            <SelectItem value="pending">Pending</SelectItem>
            <SelectItem value="confirmed">Confirmed</SelectItem>
            <SelectItem value="processing">Processing</SelectItem>
            <SelectItem value="fulfilled">Fulfilled</SelectItem>
            <SelectItem value="cancelled">Cancelled</SelectItem>
          </SelectContent>
        </Select>
        <Button onClick={handleSearch}>Search</Button>
      </div>

      {/* Orders Table */}
      {orders.length === 0 ? (
        <div className="flex items-center justify-center h-64 border rounded-lg">
          <div className="text-center">
            <p className="text-muted-foreground">No sales orders found</p>
            <p className="text-sm text-muted-foreground mt-1">
              Create your first order to get started
            </p>
          </div>
        </div>
      ) : (
        <div className="border rounded-lg">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Order Number</TableHead>
                <TableHead>Customer</TableHead>
                <TableHead>Order Date</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Items</TableHead>
                <TableHead className="text-right">Total</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {orders.map((order) => (
                <TableRow key={order.id}>
                  <TableCell className="font-medium">{order.order_number}</TableCell>
                  <TableCell>{order.customer_name}</TableCell>
                  <TableCell>{format(new Date(order.order_date), "MMM dd, yyyy")}</TableCell>
                  <TableCell>
                    <Badge variant={SALES_ORDER_STATUS_COLORS[order.status]}>
                      {SALES_ORDER_STATUS_LABELS[order.status]}
                    </Badge>
                  </TableCell>
                  <TableCell>{order.items?.length || 0}</TableCell>
                  <TableCell className="text-right font-medium">
                    {formatCurrency(order.total_amount)}
                  </TableCell>
                  <TableCell className="text-right">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => router.push(`/dashboard/warehouse/sales-orders/${order.id}`)}
                    >
                      <Eye className="h-4 w-4" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      {/* Summary */}
      {orders.length > 0 && (
        <div className="text-sm text-muted-foreground">
          Showing {orders.length} order{orders.length !== 1 ? "s" : ""}
        </div>
      )}
    </div>
  );
}
