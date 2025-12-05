// =============================================
// Stock Level Display Component
// Real-time stock indicator with visual feedback
// =============================================

"use client";

import { useState, useEffect } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Package, TrendingUp, TrendingDown, AlertTriangle } from "lucide-react";

interface StockLevelDisplayProps {
  productId: string;
  variantId?: string | null;
  locationId?: string | null;
  organizationId: string;
  branchId: string;
  showDetails?: boolean;
  minLevel?: number;
  maxLevel?: number;
  className?: string;
}

export function StockLevelDisplay({
  productId,
  variantId,
  locationId,
  organizationId,
  branchId,
  showDetails = true,
  minLevel = 0,
  maxLevel = 1000,
  className = "",
}: StockLevelDisplayProps) {
  const [stockLevel, setStockLevel] = useState<number>(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchStockLevel() {
      try {
        setLoading(true);
        setError(null);

        const level = await stockMovementsService.getStockLevel(
          productId,
          variantId || undefined,
          locationId || undefined,
          organizationId,
          branchId
        );

        setStockLevel(level);
      } catch (err) {
        console.error("Error fetching stock level:", err);
        setError("Failed to load stock level");
      } finally {
        setLoading(false);
      }
    }

    fetchStockLevel();
  }, [productId, variantId, locationId, organizationId, branchId]);

  const getStockStatus = () => {
    if (stockLevel <= 0) {
      return { label: "Out of Stock", color: "destructive", icon: AlertTriangle };
    }
    if (stockLevel < minLevel) {
      return { label: "Low Stock", color: "warning", icon: TrendingDown };
    }
    if (stockLevel > maxLevel) {
      return { label: "Overstocked", color: "secondary", icon: TrendingUp };
    }
    return { label: "In Stock", color: "success", icon: Package };
  };

  const status = getStockStatus();
  const percentage = Math.min(100, (stockLevel / maxLevel) * 100);

  if (loading) {
    return <div className={`text-sm text-muted-foreground ${className}`}>Loading stock...</div>;
  }

  if (error) {
    return <div className={`text-sm text-destructive ${className}`}>{error}</div>;
  }

  if (!showDetails) {
    return (
      <div className={`flex items-center gap-2 ${className}`}>
        <status.icon
          className={`h-4 w-4 ${
            stockLevel <= 0
              ? "text-destructive"
              : stockLevel < minLevel
                ? "text-yellow-600"
                : stockLevel > maxLevel
                  ? "text-blue-600"
                  : "text-green-600"
          }`}
        />
        <span className="font-semibold">{stockLevel}</span>
        <span className="text-sm text-muted-foreground">units</span>
      </div>
    );
  }

  return (
    <Card className={className}>
      <CardContent className="pt-6">
        <div className="space-y-4">
          {/* Header */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <status.icon className="h-5 w-5 text-muted-foreground" />
              <span className="text-sm font-medium">Stock Level</span>
            </div>
            <Badge
              variant={status.color as any}
              className={
                stockLevel <= 0
                  ? "bg-red-500 text-white"
                  : stockLevel < minLevel
                    ? "bg-yellow-500 text-white"
                    : stockLevel > maxLevel
                      ? "bg-blue-500 text-white"
                      : "bg-green-500 text-white"
              }
            >
              {status.label}
            </Badge>
          </div>

          {/* Quantity */}
          <div>
            <div className="text-3xl font-bold">{stockLevel.toLocaleString()}</div>
            <p className="text-sm text-muted-foreground">Available units</p>
          </div>

          {/* Progress Bar */}
          <div className="space-y-1">
            <Progress value={percentage} className="h-2" />
            <div className="flex justify-between text-xs text-muted-foreground">
              <span>Min: {minLevel}</span>
              <span>Max: {maxLevel}</span>
            </div>
          </div>

          {/* Stock Status Details */}
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <p className="text-muted-foreground">Below Min</p>
              <p className="font-medium">{stockLevel < minLevel ? "Yes" : "No"}</p>
            </div>
            <div>
              <p className="text-muted-foreground">% of Max</p>
              <p className="font-medium">{percentage.toFixed(1)}%</p>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
