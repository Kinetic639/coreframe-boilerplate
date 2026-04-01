"use client";

import { useState, useEffect, useCallback } from "react";
import {
  getProductLocations,
  type ProductLocation,
} from "@/app/actions/warehouse/get-product-locations";
import { MapPin, RefreshCw, Package, Lock } from "lucide-react";
import * as Icons from "lucide-react";
import { Progress } from "@/components/ui/progress";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import Link from "next/link";

interface ProductLocationBreakdownProps {
  productId: string;
  organizationId: string;
  branchId?: string;
}

export function ProductLocationBreakdown({
  productId,
  organizationId,
  branchId,
}: ProductLocationBreakdownProps) {
  const [locations, setLocations] = useState<ProductLocation[]>([]);
  const [totalQuantity, setTotalQuantity] = useState(0);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);

  const loadLocations = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const result = await getProductLocations(productId, organizationId, branchId);

      if (result.error) {
        setError(result.error);
      } else {
        setLocations(result.data);
        setTotalQuantity(result.totalQuantity);
        setLastUpdated(new Date());
      }
    } catch (err) {
      setError("Failed to load location breakdown");
      console.error(err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [productId, organizationId, branchId]);

  useEffect(() => {
    loadLocations();
  }, [loadLocations]);

  const handleRefresh = () => {
    setRefreshing(true);
    loadLocations();
  };

  if (loading) {
    return (
      <div className="rounded-lg border p-6">
        <h3 className="mb-4 text-base font-semibold">Stock by Location</h3>
        <div className="flex items-center justify-center py-8">
          <div className="text-sm text-muted-foreground">Loading locations...</div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-lg border p-6">
        <h3 className="mb-4 text-base font-semibold">Stock by Location</h3>
        <div className="flex items-center justify-center py-8">
          <div className="text-sm text-destructive">{error}</div>
        </div>
      </div>
    );
  }

  if (locations.length === 0) {
    return (
      <div className="rounded-lg border p-6">
        <h3 className="mb-4 text-base font-semibold">Stock by Location</h3>
        <div className="flex flex-col items-center justify-center py-8 text-center">
          <MapPin className="mb-3 h-12 w-12 text-muted-foreground/50" />
          <p className="text-sm text-muted-foreground">No stock recorded for this product</p>
        </div>
      </div>
    );
  }

  const totalAvailable = locations.reduce((sum, loc) => sum + loc.available_quantity, 0);
  const totalReserved = locations.reduce((sum, loc) => sum + loc.reserved_quantity, 0);

  return (
    <div className="rounded-lg border p-6">
      {/* Header with Refresh */}
      <div className="mb-4 flex items-center justify-between">
        <h3 className="text-base font-semibold">Stock by Location</h3>
        <div className="flex items-center gap-2">
          {lastUpdated && (
            <span className="text-xs text-muted-foreground">
              Updated {lastUpdated.toLocaleTimeString()}
            </span>
          )}
          <Button
            variant="ghost"
            size="sm"
            onClick={handleRefresh}
            disabled={refreshing}
            className="h-8 w-8 p-0"
          >
            <RefreshCw className={`h-4 w-4 ${refreshing ? "animate-spin" : ""}`} />
          </Button>
        </div>
      </div>

      <div className="space-y-4">
        {locations.map((loc) => {
          const percentage = totalQuantity > 0 ? (loc.quantity_on_hand / totalQuantity) * 100 : 0;
          const IconComponent = (Icons as any)[loc.location.icon_name] || MapPin;
          const reservationPercentage =
            loc.quantity_on_hand > 0 ? (loc.reserved_quantity / loc.quantity_on_hand) * 100 : 0;

          return (
            <Link
              key={loc.location_id}
              href={`/dashboard/warehouse/locations/${loc.location_id}`}
              className="block rounded-lg border p-4 transition-colors hover:bg-accent/50"
            >
              <div className="mb-3 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div
                    className="flex h-10 w-10 items-center justify-center rounded-lg text-white"
                    style={{ backgroundColor: loc.location.color || "#6b7280" }}
                  >
                    <IconComponent className="h-5 w-5" />
                  </div>
                  <div>
                    <div className="font-medium">{loc.location.name}</div>
                    <div className="text-xs text-muted-foreground">{loc.location.code}</div>
                  </div>
                </div>
                <div className="text-right">
                  <div className="flex items-center gap-2">
                    <div className="text-lg font-bold text-green-600">{loc.available_quantity}</div>
                    {loc.reserved_quantity > 0 && (
                      <Badge variant="secondary" className="text-xs">
                        <Lock className="mr-1 h-3 w-3" />
                        {loc.reserved_quantity}
                      </Badge>
                    )}
                  </div>
                  <div className="text-xs text-muted-foreground">
                    Available • {percentage.toFixed(1)}%
                  </div>
                </div>
              </div>
              <Progress value={percentage} className="h-2" />

              {/* Detailed Breakdown */}
              <div className="mt-3 grid grid-cols-3 gap-2 rounded-md bg-muted/30 p-2">
                <div className="text-center">
                  <div className="flex items-center justify-center gap-1 text-xs text-muted-foreground">
                    <Package className="h-3 w-3" />
                    <span>On Hand</span>
                  </div>
                  <div className="text-sm font-semibold">{loc.quantity_on_hand}</div>
                </div>
                <div className="text-center">
                  <div className="flex items-center justify-center gap-1 text-xs text-muted-foreground">
                    <Lock className="h-3 w-3" />
                    <span>Reserved</span>
                  </div>
                  <div className="text-sm font-semibold text-orange-600">
                    {loc.reserved_quantity}
                    {reservationPercentage > 0 && (
                      <span className="ml-1 text-xs text-muted-foreground">
                        ({reservationPercentage.toFixed(0)}%)
                      </span>
                    )}
                  </div>
                </div>
                <div className="text-center">
                  <div className="flex items-center justify-center gap-1 text-xs text-muted-foreground">
                    <span>Available</span>
                  </div>
                  <div className="text-sm font-semibold text-green-600">
                    {loc.available_quantity}
                  </div>
                </div>
              </div>

              {loc.total_value && loc.total_value > 0 && (
                <div className="mt-2 text-right text-xs text-muted-foreground">
                  Value: {loc.total_value.toFixed(2)} PLN
                </div>
              )}
            </Link>
          );
        })}
      </div>

      {/* Summary Footer */}
      <div className="mt-4 rounded-lg bg-muted/30 p-4">
        <div className="mb-2 font-medium">Summary</div>
        <div className="grid grid-cols-4 gap-4 text-center">
          <div>
            <div className="text-xs text-muted-foreground">Locations</div>
            <div className="text-lg font-bold">{locations.length}</div>
          </div>
          <div>
            <div className="flex items-center justify-center gap-1 text-xs text-muted-foreground">
              <Package className="h-3 w-3" />
              <span>On Hand</span>
            </div>
            <div className="text-lg font-bold">{totalQuantity}</div>
          </div>
          <div>
            <div className="flex items-center justify-center gap-1 text-xs text-muted-foreground">
              <Lock className="h-3 w-3" />
              <span>Reserved</span>
            </div>
            <div className="text-lg font-bold text-orange-600">{totalReserved}</div>
          </div>
          <div>
            <div className="text-xs text-muted-foreground">Available</div>
            <div className="text-lg font-bold text-green-600">{totalAvailable}</div>
          </div>
        </div>
      </div>
    </div>
  );
}
