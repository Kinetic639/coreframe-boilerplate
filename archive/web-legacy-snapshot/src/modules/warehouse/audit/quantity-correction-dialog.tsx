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
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Package, Save, AlertTriangle } from "lucide-react";

interface QuantityCorrectionDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  product: any;
  onSave: (correction: { newQuantity: number; reason: string }) => void;
}

export function QuantityCorrectionDialog({
  open,
  onOpenChange,
  product,
  onSave,
}: QuantityCorrectionDialogProps) {
  const [newQuantity, setNewQuantity] = React.useState<string>("");
  const [reason, setReason] = React.useState("");

  React.useEffect(() => {
    if (product) {
      setNewQuantity(product.totalQuantity?.toString() || "0");
      setReason("");
    }
  }, [product]);

  if (!product) return null;

  const handleSave = () => {
    const quantity = parseFloat(newQuantity) || 0;
    onSave({
      newQuantity: quantity,
      reason,
    });
    onOpenChange(false);
  };

  const difference = parseFloat(newQuantity) - (product.totalQuantity || 0);
  const unitPrice = product.inventory?.purchase_price || 0;
  const valueChange = difference * unitPrice;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Package className="h-5 w-5" />
            Korekta ilości produktu
          </DialogTitle>
          <DialogDescription>
            Wprowadź ręczną korektę ilości produktu bez przeprowadzania pełnego audytu
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Product Info */}
          <Card>
            <CardContent className="pt-4">
              <div className="space-y-2">
                <h3 className="font-semibold">{product.name}</h3>
                <div className="flex items-center gap-2">
                  {product.sku && <Badge variant="outline">{product.sku}</Badge>}
                  <span className="text-sm text-muted-foreground">
                    Obecna ilość: {product.totalQuantity || 0} {product.default_unit}
                  </span>
                </div>
                {product.inventory && (
                  <div className="text-sm text-muted-foreground">
                    Cena jednostkowa: {product.inventory.purchase_price.toFixed(2)} zł
                  </div>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Correction Form */}
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="new-quantity">Nowa ilość *</Label>
              <Input
                id="new-quantity"
                type="number"
                step="0.01"
                value={newQuantity}
                onChange={(e) => setNewQuantity(e.target.value)}
                placeholder="Wprowadź nową ilość"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="reason">Powód korekty *</Label>
              <Textarea
                id="reason"
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                placeholder="Opisz powód korekty (np. uszkodzenie, błąd inwentaryzacji, zwrot...)"
                rows={3}
              />
            </div>

            {/* Difference Preview */}
            {newQuantity && parseFloat(newQuantity) !== (product.totalQuantity || 0) && (
              <div className="rounded-lg bg-muted/20 p-3">
                <div className="mb-2 text-sm font-medium">Podgląd korekty:</div>
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <span className="text-muted-foreground">Różnica:</span>
                    <span
                      className={`ml-2 font-medium ${
                        difference > 0 ? "text-green-600" : "text-red-600"
                      }`}
                    >
                      {difference > 0 ? "+" : ""}
                      {difference.toFixed(2)} {product.default_unit}
                    </span>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Zmiana wartości:</span>
                    <span
                      className={`ml-2 font-medium ${
                        valueChange > 0 ? "text-green-600" : "text-red-600"
                      }`}
                    >
                      {valueChange > 0 ? "+" : ""}
                      {valueChange.toFixed(2)} zł
                    </span>
                  </div>
                </div>
              </div>
            )}

            {/* Warning */}
            <div className="flex items-start gap-3 rounded-lg border border-yellow-200 bg-yellow-50 p-3">
              <AlertTriangle className="mt-0.5 h-5 w-5 text-yellow-600" />
              <div className="text-sm">
                <div className="font-medium text-yellow-800">Uwaga:</div>
                <p className="mt-1 text-yellow-700">
                  Korekta zostanie zapisana w historii zmian i wpłynie na stan magazynowy produktu.
                </p>
              </div>
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Anuluj
          </Button>
          <Button onClick={handleSave} disabled={!newQuantity || !reason.trim()}>
            <Save className="mr-2 h-4 w-4" />
            Zapisz korektę
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
