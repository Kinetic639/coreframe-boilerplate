"use client";

import { useState, useEffect } from "react";
import {
  getProductLocations,
  type ProductLocation,
} from "@/app/actions/warehouse/get-product-locations";
import { MapPin } from "lucide-react";
import * as Icons from "lucide-react";
import { Progress } from "@/components/ui/progress";
import Link from "next/link";

interface ProductLocationBreakdownProps {
  productId: string;
  organizationId: string;
}

export function ProductLocationBreakdown({
  productId,
  organizationId,
}: ProductLocationBreakdownProps) {
  const [locations, setLocations] = useState<ProductLocation[]>([]);
  const [totalQuantity, setTotalQuantity] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function loadLocations() {
      try {
        setLoading(true);
        setError(null);
        const result = await getProductLocations(productId, organizationId);

        if (result.error) {
          setError(result.error);
        } else {
          setLocations(result.data);
          setTotalQuantity(result.totalQuantity);
        }
      } catch (err) {
        setError("Failed to load location breakdown");
        console.error(err);
      } finally {
        setLoading(false);
      }
    }

    loadLocations();
  }, [productId, organizationId]);

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

  return (
    <div className="rounded-lg border p-6">
      <h3 className="mb-4 text-base font-semibold">Stock by Location</h3>
      <div className="space-y-4">
        {locations.map((loc) => {
          const percentage = totalQuantity > 0 ? (loc.available_quantity / totalQuantity) * 100 : 0;
          const IconComponent = (Icons as any)[loc.location.icon_name] || MapPin;

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
                  <div className="text-lg font-bold">{loc.available_quantity}</div>
                  <div className="text-xs text-muted-foreground">{percentage.toFixed(1)}%</div>
                </div>
              </div>
              <Progress value={percentage} className="h-2" />
              <div className="mt-2 flex items-center justify-between text-xs text-muted-foreground">
                <span>{loc.reserved_quantity > 0 && `Reserved: ${loc.reserved_quantity}`}</span>
                <span>
                  {loc.total_value && loc.total_value > 0
                    ? `Value: ${loc.total_value.toFixed(2)} PLN`
                    : ""}
                </span>
              </div>
            </Link>
          );
        })}
      </div>

      {/* Summary Footer */}
      <div className="mt-4 flex items-center justify-between rounded-lg bg-muted/30 p-3 text-sm">
        <span className="font-medium">Total</span>
        <div className="flex items-center gap-4">
          <span className="text-muted-foreground">
            {locations.length} location{locations.length !== 1 ? "s" : ""}
          </span>
          <span className="font-bold">{totalQuantity} units</span>
        </div>
      </div>
    </div>
  );
}
