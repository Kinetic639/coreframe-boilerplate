"use client";

// =============================================
// Stock Movement Card Component
// Displays movement summary in a card format
// =============================================

import { Card, CardContent, CardFooter, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ArrowRight, Package, MapPin, Calendar, User } from "lucide-react";
import { MovementStatusBadge } from "./movement-status-badge";
import type { StockMovementWithRelations } from "../types/stock-movements";
import { formatDate } from "@/lib/utils";

interface StockMovementCardProps {
  movement: StockMovementWithRelations;
  onClick?: () => void;
  className?: string;
}

export function StockMovementCard({ movement, onClick, className = "" }: StockMovementCardProps) {
  const isClickable = !!onClick;

  return (
    <Card
      className={`${isClickable ? "cursor-pointer hover:shadow-md transition-shadow" : ""} ${className}`}
      onClick={onClick}
    >
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Package className="h-4 w-4 text-muted-foreground" />
            <span className="font-mono text-sm font-medium">{movement.movement_number}</span>
          </div>
          <MovementStatusBadge status={movement.status} />
        </div>
      </CardHeader>

      <CardContent className="space-y-3">
        {/* Product Info */}
        <div>
          <p className="font-medium">{movement.product?.name || "Unknown Product"}</p>
          {movement.variant && (
            <p className="text-sm text-muted-foreground">{movement.variant.name}</p>
          )}
        </div>

        {/* Movement Type */}
        <div className="flex items-center gap-2">
          <Badge variant="outline">
            {movement.movement_type?.name || movement.movement_type_code}
          </Badge>
          {movement.movement_type?.polish_document_type && (
            <Badge variant="secondary">{movement.movement_type.polish_document_type}</Badge>
          )}
        </div>

        {/* Locations */}
        {(movement.source_location || movement.destination_location) && (
          <div className="flex items-center gap-2 text-sm">
            {movement.source_location && (
              <div className="flex items-center gap-1">
                <MapPin className="h-3 w-3" />
                <span>{movement.source_location.name}</span>
              </div>
            )}
            {movement.source_location && movement.destination_location && (
              <ArrowRight className="h-3 w-3" />
            )}
            {movement.destination_location && (
              <div className="flex items-center gap-1">
                <MapPin className="h-3 w-3" />
                <span>{movement.destination_location.name}</span>
              </div>
            )}
          </div>
        )}

        {/* Quantity */}
        <div className="text-lg font-semibold">
          {movement.quantity} {movement.unit_of_measure || "pcs"}
        </div>

        {/* Cost */}
        {movement.total_cost && (
          <div className="text-sm text-muted-foreground">
            Total: {movement.total_cost} {movement.currency || "PLN"}
          </div>
        )}
      </CardContent>

      <CardFooter className="pt-3 text-xs text-muted-foreground">
        <div className="flex items-center gap-4 w-full">
          <div className="flex items-center gap-1">
            <Calendar className="h-3 w-3" />
            <span>{formatDate(movement.occurred_at)}</span>
          </div>
          {movement.created_by_user && (
            <div className="flex items-center gap-1">
              <User className="h-3 w-3" />
              <span>{movement.created_by_user.email}</span>
            </div>
          )}
        </div>
      </CardFooter>
    </Card>
  );
}
