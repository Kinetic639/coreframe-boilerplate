// =============================================
// Inventory Dashboard Page
// Real-time stock levels and inventory overview
// =============================================

"use client";

import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
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
import { Package, Search, RefreshCw, TrendingUp, TrendingDown, AlertTriangle } from "lucide-react";
import { getInventoryLevels } from "@/app/actions/warehouse/get-inventory";
import { toast } from "react-toastify";
import { useAppStore } from "@/lib/stores/app-store";
import type { StockInventoryLevel } from "@/modules/warehouse/types/stock-movements";

export default function InventoryPage() {
  const { activeOrg, activeBranch } = useAppStore();

  const [inventoryLevels, setInventoryLevels] = useState<StockInventoryLevel[]>([]);
  const [filteredLevels, setFilteredLevels] = useState<StockInventoryLevel[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");

  useEffect(() => {
    if (activeOrg?.organization_id && activeBranch?.id) {
      loadInventory();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeOrg, activeBranch]);

  useEffect(() => {
    // Filter inventory levels based on search query
    if (searchQuery.trim() === "") {
      setFilteredLevels(inventoryLevels);
    } else {
      const query = searchQuery.toLowerCase();
      setFilteredLevels(
        inventoryLevels.filter(
          (level) =>
            level.product_id.toLowerCase().includes(query) ||
            level.location_id.toLowerCase().includes(query)
        )
      );
    }
  }, [searchQuery, inventoryLevels]);

  const loadInventory = async () => {
    if (!activeOrg?.organization_id || !activeBranch?.id) return;

    try {
      setLoading(true);
      const result = await getInventoryLevels({
        organizationId: activeOrg.organization_id,
        branchId: activeBranch.id,
      });

      if (result.success) {
        setInventoryLevels(result.data);
        setFilteredLevels(result.data);
      } else {
        toast.error(result.error || "Failed to load inventory");
      }
    } catch (error) {
      console.error("Error loading inventory:", error);
      toast.error("An error occurred while loading inventory");
    } finally {
      setLoading(false);
    }
  };

  const getStockStatus = (quantity: number) => {
    if (quantity <= 0) {
      return {
        label: "Out of Stock",
        color: "destructive",
        icon: AlertTriangle,
        className: "text-red-600",
      };
    }
    if (quantity < 10) {
      return {
        label: "Low Stock",
        color: "warning",
        icon: TrendingDown,
        className: "text-yellow-600",
      };
    }
    return {
      label: "In Stock",
      color: "success",
      icon: TrendingUp,
      className: "text-green-600",
    };
  };

  const totalProducts = inventoryLevels.length;
  const totalValue = inventoryLevels.reduce((sum, level) => sum + (level.total_value || 0), 0);
  const lowStockCount = inventoryLevels.filter((level) => level.available_quantity < 10).length;
  const outOfStockCount = inventoryLevels.filter((level) => level.available_quantity <= 0).length;

  if (!activeOrg || !activeBranch) {
    return (
      <div className="container mx-auto p-6">
        <div className="text-center text-muted-foreground">
          Please select an organization and branch
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Inventory Dashboard</h1>
          <p className="text-muted-foreground">Real-time stock levels and inventory overview</p>
        </div>
        <Button variant="outline" onClick={loadInventory} disabled={loading}>
          <RefreshCw className={`h-4 w-4 mr-2 ${loading ? "animate-spin" : ""}`} />
          Refresh
        </Button>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="pb-3">
            <CardDescription>Total Products</CardDescription>
            <CardTitle className="text-3xl">{totalProducts}</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Package className="h-4 w-4" />
              <span>Unique SKUs</span>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardDescription>Total Value</CardDescription>
            <CardTitle className="text-3xl">{totalValue.toFixed(2)} PLN</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <TrendingUp className="h-4 w-4" />
              <span>Inventory worth</span>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardDescription>Low Stock Items</CardDescription>
            <CardTitle className="text-3xl text-yellow-600">{lowStockCount}</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <TrendingDown className="h-4 w-4" />
              <span>Below minimum</span>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardDescription>Out of Stock</CardDescription>
            <CardTitle className="text-3xl text-red-600">{outOfStockCount}</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <AlertTriangle className="h-4 w-4" />
              <span>Needs restock</span>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Search and Filter */}
      <Card>
        <CardHeader>
          <CardTitle>Inventory Levels</CardTitle>
          <CardDescription>Current stock levels for all products</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-4 mb-4">
            <div className="relative flex-1">
              <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search by product ID or location..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-8"
              />
            </div>
          </div>

          {loading ? (
            <div className="text-center py-12 text-muted-foreground">
              Loading inventory levels...
            </div>
          ) : filteredLevels.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">No inventory levels found</div>
          ) : (
            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Product ID</TableHead>
                    <TableHead>Location ID</TableHead>
                    <TableHead className="text-right">Available</TableHead>
                    <TableHead className="text-right">Reserved</TableHead>
                    <TableHead className="text-right">ATP</TableHead>
                    <TableHead className="text-right">Value</TableHead>
                    <TableHead className="text-right">Avg Cost</TableHead>
                    <TableHead>Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredLevels.map((level, index) => {
                    const status = getStockStatus(level.available_quantity);
                    const StatusIcon = status.icon;

                    return (
                      <TableRow key={index}>
                        <TableCell className="font-mono text-sm">
                          {level.product_id.substring(0, 8)}...
                        </TableCell>
                        <TableCell className="font-mono text-sm">
                          {level.location_id.substring(0, 8)}...
                        </TableCell>
                        <TableCell className="text-right font-semibold">
                          {level.available_quantity}
                        </TableCell>
                        <TableCell className="text-right text-muted-foreground">
                          {level.reserved_quantity}
                        </TableCell>
                        <TableCell className="text-right font-medium">
                          {level.available_to_promise}
                        </TableCell>
                        <TableCell className="text-right">
                          {level.total_value?.toFixed(2) || "0.00"} PLN
                        </TableCell>
                        <TableCell className="text-right">
                          {level.average_cost?.toFixed(2) || "0.00"} PLN
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <StatusIcon className={`h-4 w-4 ${status.className}`} />
                            <Badge variant={status.color as any}>{status.label}</Badge>
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
