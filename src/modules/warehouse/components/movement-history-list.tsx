// =============================================
// Movement History List Component
// Timeline view of movements for a product/location
// =============================================

"use client";

import { useState, useEffect } from "react";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import { ArrowRight, ArrowDown, ArrowUp, Package } from "lucide-react";
import { MovementStatusBadge } from "./movement-status-badge";
import { stockMovementsService } from "../api/stock-movements-service";
import type { StockMovementWithRelations, StockMovementFilters } from "../types/stock-movements";
import { formatDate } from "@/lib/utils";

interface MovementHistoryListProps {
  filters: StockMovementFilters;
  maxHeight?: string;
  onMovementClick?: (movement: StockMovementWithRelations) => void;
}

export function MovementHistoryList({
  filters,
  maxHeight = "600px",
  onMovementClick,
}: MovementHistoryListProps) {
  const [movements, setMovements] = useState<StockMovementWithRelations[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchMovements() {
      try {
        setLoading(true);
        setError(null);
        const result = await stockMovementsService.getMovementsWithRelations(filters, 1, 50);
        setMovements(result.data);
      } catch (err) {
        console.error("Error fetching movements:", err);
        setError("Failed to load movement history");
      } finally {
        setLoading(false);
      }
    }

    fetchMovements();
  }, [filters]);

  const getMovementIcon = (movement: StockMovementWithRelations) => {
    if (movement.source_location_id && movement.destination_location_id) {
      return <ArrowRight className="h-4 w-4" />;
    }
    if (movement.destination_location_id) {
      return <ArrowDown className="h-4 w-4 text-green-600" />;
    }
    if (movement.source_location_id) {
      return <ArrowUp className="h-4 w-4 text-red-600" />;
    }
    return <Package className="h-4 w-4" />;
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="text-sm text-muted-foreground">Loading movements...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="text-sm text-destructive">{error}</div>
      </div>
    );
  }

  if (movements.length === 0) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="text-sm text-muted-foreground">No movements found</div>
      </div>
    );
  }

  return (
    <ScrollArea style={{ height: maxHeight }}>
      <div className="space-y-4 p-4">
        {movements.map((movement, index) => (
          <div key={movement.id}>
            <div
              className={`flex gap-4 ${onMovementClick ? "cursor-pointer hover:bg-accent rounded-lg p-2 -m-2" : ""}`}
              onClick={() => onMovementClick?.(movement)}
            >
              {/* Icon */}
              <div className="flex-shrink-0 mt-1">
                <div className="h-8 w-8 rounded-full bg-muted flex items-center justify-center">
                  {getMovementIcon(movement)}
                </div>
              </div>

              {/* Content */}
              <div className="flex-1 space-y-2">
                {/* Header */}
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-sm font-medium">
                      {movement.movement_number}
                    </span>
                    <MovementStatusBadge status={movement.status} showIcon={false} />
                  </div>
                  <span className="text-xs text-muted-foreground">
                    {formatDate(movement.occurred_at)}
                  </span>
                </div>

                {/* Movement Type */}
                <div className="flex items-center gap-2">
                  <Badge variant="outline" className="text-xs">
                    {movement.movement_type?.name || movement.movement_type_code}
                  </Badge>
                  {movement.category && (
                    <span className="text-xs text-muted-foreground capitalize">
                      {movement.category}
                    </span>
                  )}
                </div>

                {/* Product */}
                <div className="text-sm">
                  <span className="font-medium">{movement.product?.name}</span>
                  {movement.variant && (
                    <span className="text-muted-foreground"> • {movement.variant.name}</span>
                  )}
                </div>

                {/* Locations */}
                {(movement.source_location || movement.destination_location) && (
                  <div className="text-xs text-muted-foreground">
                    {movement.source_location && <span>From: {movement.source_location.name}</span>}
                    {movement.source_location && movement.destination_location && (
                      <span className="mx-2">→</span>
                    )}
                    {movement.destination_location && (
                      <span>To: {movement.destination_location.name}</span>
                    )}
                  </div>
                )}

                {/* Quantity */}
                <div className="text-sm font-semibold">
                  <span className={movement.quantity > 0 ? "text-green-600" : "text-red-600"}>
                    {movement.quantity > 0 ? "+" : ""}
                    {movement.quantity}
                  </span>
                  <span className="text-muted-foreground ml-1">
                    {movement.unit_of_measure || "pcs"}
                  </span>
                </div>

                {/* Notes */}
                {movement.notes && (
                  <p className="text-xs text-muted-foreground italic">{movement.notes}</p>
                )}
              </div>
            </div>

            {index < movements.length - 1 && <Separator className="my-4" />}
          </div>
        ))}
      </div>
    </ScrollArea>
  );
}
