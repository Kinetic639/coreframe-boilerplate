"use client";

import { useState, useEffect } from "react";
import { createClient } from "@/utils/supabase/client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Warehouse, Package, AlertTriangle, TrendingUp, TrendingDown } from "lucide-react";
import { useAppStore } from "@/lib/stores/app-store";

interface BranchStock {
  branch_id: string;
  branch_name: string;
  quantity_on_hand: number;
  reserved_quantity: number;
  available_quantity: number;
  locations_count: number;
  last_movement_at: string | null;
}

interface ProductAvailabilityTabProps {
  productId: string;
  productName: string;
}

export function ProductAvailabilityTab({ productId, productName }: ProductAvailabilityTabProps) {
  const { activeOrgId } = useAppStore();
  const [loading, setLoading] = useState(true);
  const [branchStocks, setBranchStocks] = useState<BranchStock[]>([]);
  const [totalStock, setTotalStock] = useState({
    quantity_on_hand: 0,
    reserved_quantity: 0,
    available_quantity: 0,
  });

  useEffect(() => {
    if (activeOrgId && productId) {
      loadBranchStocks();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeOrgId, productId]);

  const loadBranchStocks = async () => {
    setLoading(true);
    try {
      const supabase = createClient();

      // Get stock data by branch using the warehouse-level view
      const { data, error } = await supabase
        .from("product_available_inventory_by_branch")
        .select(
          `
          branch_id,
          quantity_on_hand,
          reserved_quantity,
          available_quantity,
          locations_count,
          last_movement_at,
          branches!inner(id, name)
        `
        )
        .eq("product_id", productId)
        .eq("organization_id", activeOrgId);

      if (error) {
        console.error("Error loading branch stocks:", error);
        return;
      }

      // Transform data
      const stocks: BranchStock[] =
        data?.map((item: any) => ({
          branch_id: item.branch_id,
          branch_name: item.branches.name,
          quantity_on_hand: item.quantity_on_hand || 0,
          reserved_quantity: item.reserved_quantity || 0,
          available_quantity: item.available_quantity || 0,
          locations_count: item.locations_count || 0,
          last_movement_at: item.last_movement_at,
        })) || [];

      // Calculate totals
      const totals = stocks.reduce(
        (acc, stock) => ({
          quantity_on_hand: acc.quantity_on_hand + stock.quantity_on_hand,
          reserved_quantity: acc.reserved_quantity + stock.reserved_quantity,
          available_quantity: acc.available_quantity + stock.available_quantity,
        }),
        { quantity_on_hand: 0, reserved_quantity: 0, available_quantity: 0 }
      );

      setBranchStocks(stocks);
      setTotalStock(totals);
    } catch (error) {
      console.error("Error loading branch stocks:", error);
    } finally {
      setLoading(false);
    }
  };

  const getStockStatusColor = (available: number) => {
    if (available === 0) return "text-red-600";
    if (available < 10) return "text-yellow-600";
    return "text-green-600";
  };

  const getStockStatusBadge = (available: number) => {
    if (available === 0) return <Badge variant="destructive">Out of Stock</Badge>;
    if (available < 10) return <Badge variant="secondary">Low Stock</Badge>;
    return <Badge variant="default">In Stock</Badge>;
  };

  const formatDate = (dateString: string | null) => {
    if (!dateString) return "Never";
    const date = new Date(dateString);
    return date.toLocaleDateString() + " " + date.toLocaleTimeString();
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="text-center text-muted-foreground">Loading availability...</div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardHeader className="pb-3">
            <CardDescription>Total On Hand</CardDescription>
            <CardTitle className="text-3xl">{totalStock.quantity_on_hand.toFixed(2)}</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Package className="h-4 w-4" />
              <span>Across all warehouses</span>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardDescription>Reserved</CardDescription>
            <CardTitle className="text-3xl text-yellow-600">
              {totalStock.reserved_quantity.toFixed(2)}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <AlertTriangle className="h-4 w-4" />
              <span>For orders</span>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardDescription>Available</CardDescription>
            <CardTitle className={`text-3xl ${getStockStatusColor(totalStock.available_quantity)}`}>
              {totalStock.available_quantity.toFixed(2)}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              {totalStock.available_quantity > totalStock.quantity_on_hand / 2 ? (
                <TrendingUp className="h-4 w-4" />
              ) : (
                <TrendingDown className="h-4 w-4" />
              )}
              <span>To sell/use</span>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Warehouse Breakdown */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Warehouse className="h-5 w-5" />
            Warehouse Breakdown
          </CardTitle>
          <CardDescription>Stock levels across all warehouses for {productName}</CardDescription>
        </CardHeader>
        <CardContent>
          {branchStocks.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <Package className="h-12 w-12 mx-auto mb-2 opacity-50" />
              <p>No stock found in any warehouse</p>
              <p className="text-sm">This product may not be stocked yet</p>
            </div>
          ) : (
            <div className="space-y-4">
              {branchStocks.map((stock) => (
                <div
                  key={stock.branch_id}
                  className="flex items-center justify-between p-4 border rounded-lg hover:bg-accent/50 transition-colors"
                >
                  <div className="flex items-center gap-4 flex-1">
                    <div className="flex-shrink-0">
                      <Warehouse className="h-5 w-5 text-muted-foreground" />
                    </div>

                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <h4 className="font-medium">{stock.branch_name}</h4>
                        {getStockStatusBadge(stock.available_quantity)}
                      </div>

                      <div className="grid grid-cols-3 gap-4 text-sm text-muted-foreground">
                        <div>
                          <span className="font-medium">On Hand:</span>{" "}
                          <span className="text-foreground">
                            {stock.quantity_on_hand.toFixed(2)}
                          </span>
                        </div>
                        <div>
                          <span className="font-medium">Reserved:</span>{" "}
                          <span className="text-foreground">
                            {stock.reserved_quantity.toFixed(2)}
                          </span>
                        </div>
                        <div>
                          <span className="font-medium">Available:</span>{" "}
                          <span
                            className={`font-semibold ${getStockStatusColor(stock.available_quantity)}`}
                          >
                            {stock.available_quantity.toFixed(2)}
                          </span>
                        </div>
                      </div>

                      <div className="mt-2 flex items-center gap-4 text-xs text-muted-foreground">
                        <span>{stock.locations_count} location(s)</span>
                        <span>•</span>
                        <span>Last movement: {formatDate(stock.last_movement_at)}</span>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}

          <div className="mt-6 p-4 bg-blue-50 border border-blue-200 rounded-lg">
            <h4 className="text-sm font-medium text-blue-900 mb-2">
              💡 About Warehouse-Level Stock
            </h4>
            <ul className="text-sm text-blue-700 space-y-1 ml-4 list-disc">
              <li>
                <strong>On Hand:</strong> Total physical stock across all bins in the warehouse
              </li>
              <li>
                <strong>Reserved:</strong> Stock allocated to orders (not available for new sales)
              </li>
              <li>
                <strong>Available:</strong> On Hand - Reserved (available to promise)
              </li>
              <li>Stock is aggregated from all storage locations within each warehouse</li>
            </ul>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
