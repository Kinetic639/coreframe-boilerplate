"use client";

import * as React from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { MapPin, Package, AlertTriangle, CheckCircle } from "lucide-react";
import { LocationTreeItem } from "@/lib/types/location-tree";
import { calculateAuditStats } from "@/lib/mock/audit";

interface AuditStartDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  location: LocationTreeItem | null;
  branchId: string;
  onConfirm: () => void;
}

export function AuditStartDialog({
  open,
  onOpenChange,
  location,
  branchId,
  onConfirm,
}: AuditStartDialogProps) {
  const stats = React.useMemo(() => {
    if (!location) return null;
    return calculateAuditStats([location.id], branchId);
  }, [location, branchId]);

  if (!location || !stats) return null;

  const handleConfirm = () => {
    onConfirm();
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <MapPin className="h-5 w-5" />
            Rozpocznij audyt magazynowy
          </DialogTitle>
          <DialogDescription>
            Potwierdź rozpoczęcie audytu dla wybranej lokalizacji i wszystkich jej podlokalizacji.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Location Info */}
          <Card>
            <CardContent className="pt-4">
              <div className="flex items-center gap-3">
                <div
                  className="flex h-10 w-10 items-center justify-center rounded-lg text-white"
                  style={{ backgroundColor: location.color || "#6b7280" }}
                >
                  <MapPin className="h-5 w-5" />
                </div>
                <div>
                  <h3 className="font-semibold">{location.name}</h3>
                  {location.code && (
                    <Badge variant="outline" className="mt-1 text-xs">
                      {location.code}
                    </Badge>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Audit Stats */}
          <div className="grid grid-cols-3 gap-4">
            <div className="rounded-lg bg-muted/20 p-3 text-center">
              <div className="text-2xl font-bold text-primary">{stats.totalLocations}</div>
              <div className="text-sm text-muted-foreground">Lokalizacji</div>
            </div>
            <div className="rounded-lg bg-muted/20 p-3 text-center">
              <div className="text-2xl font-bold text-primary">{stats.totalProducts}</div>
              <div className="text-sm text-muted-foreground">Produktów</div>
            </div>
            <div className="rounded-lg bg-muted/20 p-3 text-center">
              <div className="text-2xl font-bold text-primary">~{stats.estimatedDuration}min</div>
              <div className="text-sm text-muted-foreground">Szacowany czas</div>
            </div>
          </div>

          {/* Important Notes */}
          <div className="space-y-3">
            <div className="flex items-start gap-3 rounded-lg border border-yellow-200 bg-yellow-50 p-3">
              <AlertTriangle className="mt-0.5 h-5 w-5 text-yellow-600" />
              <div className="text-sm">
                <div className="font-medium text-yellow-800">Ważne informacje:</div>
                <ul className="mt-1 space-y-1 text-yellow-700">
                  <li>• Audyt obejmie wszystkie zagnieżdżone lokalizacje</li>
                  <li>• Nie można cofnąć audytu po rozpoczęciu</li>
                  <li>• Przygotuj się na fizyczne sprawdzenie produktów</li>
                </ul>
              </div>
            </div>

            <div className="flex items-start gap-3 rounded-lg border border-green-200 bg-green-50 p-3">
              <CheckCircle className="mt-0.5 h-5 w-5 text-green-600" />
              <div className="text-sm">
                <div className="font-medium text-green-800">Co będzie sprawdzane:</div>
                <ul className="mt-1 space-y-1 text-green-700">
                  <li>• Ilości produktów w każdej lokalizacji</li>
                  <li>• Porównanie stanu systemowego z fizycznym</li>
                  <li>• Automatyczne korekty różnic</li>
                </ul>
              </div>
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Anuluj
          </Button>
          <Button onClick={handleConfirm}>
            <Package className="mr-2 h-4 w-4" />
            Rozpocznij audyt
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
