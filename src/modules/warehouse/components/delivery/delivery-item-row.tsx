"use client";

import { X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { DeliveryItem } from "@/modules/warehouse/types/deliveries";

interface DeliveryItemRowProps {
  item: DeliveryItem;
  productName: string;
  productSku: string;
  onUpdateQuantity: (quantity: number) => void;
  onUpdateCost: (cost: number) => void;
  onRemove: () => void;
  disabled?: boolean;
}

export function DeliveryItemRow({
  item,
  productName,
  productSku,
  onUpdateQuantity,
  onUpdateCost,
  onRemove,
  disabled,
}: DeliveryItemRowProps) {
  return (
    <tr className="border-b last:border-0 hover:bg-muted/30">
      {/* Product */}
      <td className="px-4 py-3">
        <div className="space-y-1">
          <div className="font-medium text-sm">{productName}</div>
          <div className="text-xs text-muted-foreground">{productSku}</div>
        </div>
      </td>

      {/* Quantity */}
      <td className="px-4 py-3 text-right">
        <Input
          type="number"
          min="0.01"
          step="0.01"
          value={item.expected_quantity}
          onChange={(e) => onUpdateQuantity(parseFloat(e.target.value) || 0)}
          disabled={disabled}
          className="w-24 text-right ml-auto"
        />
      </td>

      {/* Unit Cost */}
      <td className="px-4 py-3 text-right">
        <Input
          type="number"
          min="0"
          step="0.01"
          value={item.unit_cost || 0}
          onChange={(e) => onUpdateCost(parseFloat(e.target.value) || 0)}
          disabled={disabled}
          className="w-24 text-right ml-auto"
        />
      </td>

      {/* Total */}
      <td className="px-4 py-3 text-right">
        <span className="text-sm font-medium">
          {item.total_cost ? item.total_cost.toFixed(2) : "0.00"} PLN
        </span>
      </td>

      {/* Remove */}
      <td className="px-4 py-3">
        {!disabled && (
          <Button
            variant="ghost"
            size="icon"
            onClick={onRemove}
            className="h-8 w-8 text-destructive hover:text-destructive"
          >
            <X className="h-4 w-4" />
          </Button>
        )}
      </td>
    </tr>
  );
}
