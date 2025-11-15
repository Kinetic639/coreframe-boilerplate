"use client";

import React from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ShoppingCart, Clock, CheckCircle, AlertCircle, DollarSign } from "lucide-react";
import { useAppStore } from "@/lib/stores/app-store";
import { getPurchaseOrderStatisticsAction } from "../actions/purchase-orders-actions";
import type { PurchaseOrderStatistics } from "../../types/purchase-orders";
import { formatCurrency } from "../../types/purchase-orders";

export function PurchaseOrdersStats() {
  const { activeOrgId } = useAppStore();
  const [stats, setStats] = React.useState<PurchaseOrderStatistics | null>(null);
  const [loading, setLoading] = React.useState(true);

  React.useEffect(() => {
    if (!activeOrgId) return;

    const loadStats = async () => {
      setLoading(true);
      try {
        const result = await getPurchaseOrderStatisticsAction(activeOrgId);
        if (result.success && result.data) {
          setStats(result.data);
        }
      } catch (error) {
        console.error("Failed to load purchase order statistics:", error);
      } finally {
        setLoading(false);
      }
    };

    loadStats();
  }, [activeOrgId]);

  if (loading || !stats) {
    return (
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {[1, 2, 3, 4].map((i) => (
          <Card key={i}>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">
                <div className="h-4 w-24 animate-pulse rounded bg-muted" />
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="h-8 w-32 animate-pulse rounded bg-muted" />
            </CardContent>
          </Card>
        ))}
      </div>
    );
  }

  return (
    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
      {/* Total Purchase Orders */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Total Purchase Orders</CardTitle>
          <ShoppingCart className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">{stats.total_pos}</div>
          <p className="text-xs text-muted-foreground">
            {stats.pending_approval_count} pending approval
          </p>
        </CardContent>
      </Card>

      {/* Active Orders */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Active Orders</CardTitle>
          <Clock className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">
            {stats.approved_count + stats.partially_received_count}
          </div>
          <p className="text-xs text-muted-foreground">
            {stats.expected_this_week} expected this week
          </p>
        </CardContent>
      </Card>

      {/* Received */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Received</CardTitle>
          <CheckCircle className="h-4 w-4 text-green-600" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">{stats.received_count}</div>
          <p className="text-xs text-muted-foreground">
            {stats.partially_received_count} partially received
          </p>
        </CardContent>
      </Card>

      {/* Total Value */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Total Value</CardTitle>
          <DollarSign className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">{formatCurrency(stats.total_value)}</div>
          <p className="text-xs text-muted-foreground">
            {formatCurrency(stats.total_unpaid)} unpaid
          </p>
        </CardContent>
      </Card>

      {/* Overdue */}
      {stats.overdue_count > 0 && (
        <Card className="border-red-200 bg-red-50">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-red-900">Overdue</CardTitle>
            <AlertCircle className="h-4 w-4 text-red-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-900">{stats.overdue_count}</div>
            <p className="text-xs text-red-700">Orders past expected delivery</p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
