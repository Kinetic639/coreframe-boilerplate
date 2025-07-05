"use client";

import * as React from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  ChevronLeft,
  Package,
  MapPin,
  Save,
  CheckCircle,
  ArrowRight,
  AlertCircle,
} from "lucide-react";
import { AuditItem } from "@/lib/types/audit";
import { useAuditStore } from "@/lib/stores/audit-store";
import { Progress } from "@/components/ui/progress";

interface AuditProcessDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onComplete: () => void;
}

export function AuditProcessDialog({ open, onOpenChange, onComplete }: AuditProcessDialogProps) {
  const { currentAudit, auditProgress, auditProducts, updateProgress, addCorrection } =
    useAuditStore();

  const [physicalQuantity, setPhysicalQuantity] = React.useState<string>("");
  const [notes, setNotes] = React.useState("");
  const [showLocationTransition, setShowLocationTransition] = React.useState(false);

  const currentProduct = auditProducts[auditProgress?.currentProductIndex || 0];
  const progressPercentage = auditProgress
    ? Math.round((auditProgress.checkedProducts / auditProgress.totalProducts) * 100)
    : 0;

  React.useEffect(() => {
    if (currentProduct) {
      setPhysicalQuantity(currentProduct.system_quantity.toString());
      setNotes("");
    }
  }, [currentProduct]);

  const handleSaveCorrection = () => {
    if (!currentProduct || !auditProgress || !currentAudit) return;

    const physical = parseFloat(physicalQuantity) || 0;
    const difference = physical - currentProduct.system_quantity;
    const valueChange = difference * currentProduct.unit_price;

    const auditItem: AuditItem = {
      id: `item-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      audit_id: currentAudit.id,
      product_id: currentProduct.id,
      location_id: currentProduct.location_id,
      system_quantity: currentProduct.system_quantity,
      physical_quantity: physical,
      difference,
      unit_price: currentProduct.unit_price,
      value_change: valueChange,
      notes: notes || undefined,
      checked_at: new Date().toISOString(),
    };

    addCorrection(auditItem);
    handleNext();
  };

  const handleNext = () => {
    if (!auditProgress) return;

    const nextProductIndex = auditProgress.currentProductIndex + 1;

    if (nextProductIndex >= auditProgress.totalProducts) {
      // Audit completed
      onComplete();
      return;
    }

    // Check if we need to move to next location

    const nextProduct = auditProducts[nextProductIndex];

    if (nextProduct.location_id !== currentProduct.location_id) {
      setShowLocationTransition(true);
      setTimeout(() => {
        setShowLocationTransition(false);
        updateProgress({
          currentProductIndex: nextProductIndex,
          currentLocationIndex: auditProgress.currentLocationIndex + 1,
        });
      }, 2000);
    } else {
      updateProgress({
        currentProductIndex: nextProductIndex,
      });
    }
  };

  const handlePrevious = () => {
    if (!auditProgress || auditProgress.currentProductIndex === 0) return;

    const prevProductIndex = auditProgress.currentProductIndex - 1;
    const prevProduct = auditProducts[prevProductIndex];

    updateProgress({
      currentProductIndex: prevProductIndex,
      currentLocationIndex:
        prevProduct.location_id !== currentProduct.location_id
          ? auditProgress.currentLocationIndex - 1
          : auditProgress.currentLocationIndex,
    });
  };

  if (!currentAudit || !auditProgress || !currentProduct) {
    return null;
  }

  if (showLocationTransition) {
    const nextProduct = auditProducts[auditProgress.currentProductIndex + 1];
    return (
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <MapPin className="h-5 w-5" />
              Przejście do kolejnej lokalizacji
            </DialogTitle>
          </DialogHeader>

          <div className="py-8 text-center">
            <div className="mb-6 flex items-center justify-center gap-4">
              <div className="text-center">
                <div className="mb-2 flex h-12 w-12 items-center justify-center rounded-full bg-green-100">
                  <CheckCircle className="h-6 w-6 text-green-600" />
                </div>
                <div className="text-sm text-muted-foreground">Obecna lokalizacja</div>
                <div className="font-medium">{currentProduct.location_id}</div>
              </div>

              <ArrowRight className="h-6 w-6 text-muted-foreground" />

              <div className="text-center">
                <div className="mb-2 flex h-12 w-12 items-center justify-center rounded-full bg-blue-100">
                  <MapPin className="h-6 w-6 text-blue-600" />
                </div>
                <div className="text-sm text-muted-foreground">Następna lokalizacja</div>
                <div className="font-medium">{nextProduct?.location_id}</div>
              </div>
            </div>

            <div className="rounded-lg border border-yellow-200 bg-yellow-50 p-4">
              <div className="mb-2 flex items-center gap-2 text-yellow-800">
                <AlertCircle className="h-5 w-5" />
                <span className="font-medium">Przejdź fizycznie do kolejnej lokalizacji</span>
              </div>
              <p className="text-sm text-yellow-700">
                Udaj się do lokalizacji <strong>{nextProduct?.location_id}</strong> aby kontynuować
                audyt.
              </p>
            </div>

            <div className="mt-6">
              <div className="animate-pulse text-sm text-muted-foreground">
                Automatyczne przejście za 2 sekundy...
              </div>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-[600px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Package className="h-5 w-5" />
            Audyt magazynowy - {currentAudit.name}
          </DialogTitle>
          <DialogDescription>
            Sprawdź fizyczną ilość produktu i wprowadź korekty jeśli to konieczne
          </DialogDescription>
        </DialogHeader>

        {/* Progress */}
        <div className="space-y-2">
          <div className="flex justify-between text-sm">
            <span>Postęp audytu</span>
            <span>
              {auditProgress.checkedProducts} / {auditProgress.totalProducts} produktów
            </span>
          </div>
          <Progress value={progressPercentage} className="h-2" />
          <div className="text-center text-sm text-muted-foreground">
            {progressPercentage}% ukończone
          </div>
        </div>

        {/* Current Product */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center justify-between text-lg">
              <span>{currentProduct.name}</span>
              <Badge variant="outline">
                {auditProgress.currentProductIndex + 1} / {auditProgress.totalProducts}
              </Badge>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label className="text-sm font-medium text-muted-foreground">SKU</Label>
                <p className="text-sm">{currentProduct.sku || "Brak"}</p>
              </div>
              <div>
                <Label className="text-sm font-medium text-muted-foreground">Lokalizacja</Label>
                <p className="text-sm">{currentProduct.location_id}</p>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label className="text-sm font-medium text-muted-foreground">Stan systemowy</Label>
                <p className="text-lg font-semibold">
                  {currentProduct.system_quantity} {currentProduct.default_unit}
                </p>
              </div>
              <div>
                <Label className="text-sm font-medium text-muted-foreground">
                  Cena jednostkowa
                </Label>
                <p className="text-lg font-semibold">{currentProduct.unit_price.toFixed(2)} zł</p>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="physical-quantity">Faktyczna ilość fizyczna *</Label>
              <Input
                id="physical-quantity"
                type="number"
                step="0.01"
                value={physicalQuantity}
                onChange={(e) => setPhysicalQuantity(e.target.value)}
                placeholder="Wprowadź faktyczną ilość"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="notes">Uwagi (opcjonalne)</Label>
              <Textarea
                id="notes"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Dodaj uwagi dotyczące różnic lub stanu produktu..."
                rows={3}
              />
            </div>

            {/* Difference Preview */}
            {physicalQuantity &&
              parseFloat(physicalQuantity) !== currentProduct.system_quantity && (
                <div className="rounded-lg bg-muted/20 p-3">
                  <div className="mb-2 text-sm font-medium">Podgląd korekty:</div>
                  <div className="grid grid-cols-2 gap-4 text-sm">
                    <div>
                      <span className="text-muted-foreground">Różnica:</span>
                      <span
                        className={`ml-2 font-medium ${
                          parseFloat(physicalQuantity) > currentProduct.system_quantity
                            ? "text-green-600"
                            : "text-red-600"
                        }`}
                      >
                        {parseFloat(physicalQuantity) > currentProduct.system_quantity ? "+" : ""}
                        {(parseFloat(physicalQuantity) - currentProduct.system_quantity).toFixed(
                          2
                        )}{" "}
                        {currentProduct.default_unit}
                      </span>
                    </div>
                    <div>
                      <span className="text-muted-foreground">Zmiana wartości:</span>
                      <span
                        className={`ml-2 font-medium ${
                          parseFloat(physicalQuantity) > currentProduct.system_quantity
                            ? "text-green-600"
                            : "text-red-600"
                        }`}
                      >
                        {parseFloat(physicalQuantity) > currentProduct.system_quantity ? "+" : ""}
                        {(
                          (parseFloat(physicalQuantity) - currentProduct.system_quantity) *
                          currentProduct.unit_price
                        ).toFixed(2)}{" "}
                        zł
                      </span>
                    </div>
                  </div>
                </div>
              )}
          </CardContent>
        </Card>

        {/* Navigation */}
        <div className="flex justify-between">
          <Button
            variant="outline"
            onClick={handlePrevious}
            disabled={auditProgress.currentProductIndex === 0}
          >
            <ChevronLeft className="mr-2 h-4 w-4" />
            Poprzedni
          </Button>

          <Button onClick={handleSaveCorrection}>
            <Save className="mr-2 h-4 w-4" />
            Zapisz i kontynuuj
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
