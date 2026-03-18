// =============================================
// Stock Movements Table Component
// Table view for stock movements list
// =============================================

"use client";

import { useTranslations } from "next-intl";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Eye } from "lucide-react";
import { MovementStatusBadge } from "./movement-status-badge";
import type { StockMovementWithRelations } from "../types/stock-movements";
import { formatDate } from "@/lib/utils";

interface StockMovementsTableProps {
  movements: StockMovementWithRelations[];
  onMovementClick?: (movement: StockMovementWithRelations) => void;
}

export function StockMovementsTable({ movements, onMovementClick }: StockMovementsTableProps) {
  const t = useTranslations("stockMovements");

  if (movements.length === 0) {
    return (
      <div className="text-center py-12">
        <div className="text-muted-foreground">{t("messages.noMovements")}</div>
      </div>
    );
  }

  return (
    <div className="rounded-md border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="w-[150px]">{t("movementNumber")}</TableHead>
            <TableHead>{t("movementType")}</TableHead>
            <TableHead>{t("product")}</TableHead>
            <TableHead className="text-right">{t("quantity")}</TableHead>
            <TableHead>{t("sourceLocation")}</TableHead>
            <TableHead>{t("destinationLocation")}</TableHead>
            <TableHead>{t("status")}</TableHead>
            <TableHead>{t("occurredAt")}</TableHead>
            <TableHead className="w-[80px]"></TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {movements.map((movement) => (
            <TableRow
              key={movement.id}
              className="cursor-pointer hover:bg-muted/50"
              onClick={() => onMovementClick?.(movement)}
            >
              <TableCell className="font-mono text-sm">{movement.movement_number}</TableCell>
              <TableCell>
                <div className="flex flex-col">
                  <span className="font-medium text-sm">
                    {movement.movement_type?.name_en || movement.movement_type_code}
                  </span>
                  <span className="text-xs text-muted-foreground">
                    {movement.movement_type?.polish_document_type}
                  </span>
                </div>
              </TableCell>
              <TableCell>
                <div className="flex flex-col">
                  <span className="font-medium">{movement.product?.name}</span>
                  <span className="text-xs text-muted-foreground">{movement.product?.sku}</span>
                  {movement.variant && (
                    <span className="text-xs text-muted-foreground">{movement.variant?.name}</span>
                  )}
                </div>
              </TableCell>
              <TableCell className="text-right font-mono">
                {movement.quantity} {movement.unit_of_measure}
              </TableCell>
              <TableCell>
                <div className="text-sm">
                  {movement.source_location?.name || (
                    <span className="text-muted-foreground">—</span>
                  )}
                </div>
              </TableCell>
              <TableCell>
                <div className="text-sm">
                  {movement.destination_location?.name || (
                    <span className="text-muted-foreground">—</span>
                  )}
                </div>
              </TableCell>
              <TableCell>
                <MovementStatusBadge status={movement.status} />
              </TableCell>
              <TableCell className="text-sm text-muted-foreground">
                {formatDate(movement.occurred_at)}
              </TableCell>
              <TableCell>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={(e) => {
                    e.stopPropagation();
                    onMovementClick?.(movement);
                  }}
                >
                  <Eye className="h-4 w-4" />
                </Button>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
