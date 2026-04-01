"use client";

import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Truck, Clock, CheckCircle, BarChart3 } from "lucide-react";
import { QRScanner } from "@/modules/warehouse/components/scanning/QRScanner";
import type { ScannerResult } from "@/lib/types/qr-system";
import { toast } from "sonner";

interface ScannedItem {
  id: string;
  code: string;
  type: "qr_code" | "barcode";
  productName?: string;
  sku?: string;
  expectedQuantity?: number;
  scannedQuantity: number;
  status: "found" | "not_found" | "excess" | "shortage";
  scannedAt: Date;
}

interface DeliveryOperation {
  id: string;
  name: string;
  supplier: string;
  expectedItems: number;
  scannedItems: number;
  status: "active" | "completed" | "paused";
  startedAt: Date;
}

const mockDeliveryOperation: DeliveryOperation = {
  id: "1",
  name: "Dostawa lakierów i narzędzi",
  supplier: "ABC Supplier Ltd",
  expectedItems: 45,
  scannedItems: 23,
  status: "active",
  startedAt: new Date(),
};

export default function DeliveryScanningPage() {
  const [operation, setOperation] = useState<DeliveryOperation>(mockDeliveryOperation);
  const [scannedItems, setScannedItems] = useState<ScannedItem[]>([]);
  const [isScanning, setIsScanning] = useState(true);
  const [currentItem, setCurrentItem] = useState<ScannedItem | null>(null);

  const handleScanResult = (result: ScannerResult) => {
    // Simulate product lookup
    const mockProduct = {
      name:
        result.type === "qr_code"
          ? "Produkt QR - " + result.code.slice(-8)
          : "Lakier Premium - " + result.code.slice(-6),
      sku:
        result.type === "qr_code"
          ? "QR-" + result.code.slice(-8).toUpperCase()
          : "LAK-" + result.code.slice(-6),
      expectedQuantity: Math.floor(Math.random() * 10) + 1,
    };

    const newItem: ScannedItem = {
      id: Date.now().toString(),
      code: result.code,
      type: result.type,
      productName: mockProduct.name,
      sku: mockProduct.sku,
      expectedQuantity: mockProduct.expectedQuantity,
      scannedQuantity: 1,
      status: "found",
      scannedAt: new Date(),
    };

    // Check if item already exists
    const existingItemIndex = scannedItems.findIndex((item) => item.code === result.code);

    if (existingItemIndex >= 0) {
      const updatedItems = [...scannedItems];
      updatedItems[existingItemIndex].scannedQuantity += 1;

      // Update status based on quantity
      const item = updatedItems[existingItemIndex];
      if (item.expectedQuantity) {
        if (item.scannedQuantity === item.expectedQuantity) {
          item.status = "found";
        } else if (item.scannedQuantity > item.expectedQuantity) {
          item.status = "excess";
        } else {
          item.status = "shortage";
        }
      }

      setScannedItems(updatedItems);
      setCurrentItem(updatedItems[existingItemIndex]);

      toast.success(`Zaktualizowano ilość: ${item.productName}`, {
        description: `Nowa ilość: ${item.scannedQuantity}`,
      });
    } else {
      setScannedItems((prev) => [newItem, ...prev]);
      setCurrentItem(newItem);

      // Update operation progress
      setOperation((prev) => ({
        ...prev,
        scannedItems: prev.scannedItems + 1,
      }));

      toast.success(`Zeskanowano: ${newItem.productName}`, {
        description: `SKU: ${newItem.sku}`,
      });
    }
  };

  const handleQuantityUpdate = (itemId: string, newQuantity: number) => {
    const updatedItems = scannedItems.map((item) => {
      if (item.id === itemId) {
        const updatedItem = { ...item, scannedQuantity: newQuantity };

        // Update status
        if (item.expectedQuantity) {
          if (newQuantity === item.expectedQuantity) {
            updatedItem.status = "found";
          } else if (newQuantity > item.expectedQuantity) {
            updatedItem.status = "excess";
          } else {
            updatedItem.status = "shortage";
          }
        }

        return updatedItem;
      }
      return item;
    });

    setScannedItems(updatedItems);
  };

  const handleCompleteDelivery = () => {
    setOperation((prev) => ({ ...prev, status: "completed" }));
    toast.success("Dostawa została zakończona!", {
      description: `Zeskanowano ${scannedItems.length} różnych produktów`,
    });
  };

  const getStatusColor = (status: ScannedItem["status"]) => {
    switch (status) {
      case "found":
        return "bg-green-100 text-green-800 border-green-200";
      case "not_found":
        return "bg-red-100 text-red-800 border-red-200";
      case "excess":
        return "bg-orange-100 text-orange-800 border-orange-200";
      case "shortage":
        return "bg-yellow-100 text-yellow-800 border-yellow-200";
      default:
        return "bg-gray-100 text-gray-800 border-gray-200";
    }
  };

  const getStatusLabel = (status: ScannedItem["status"]) => {
    switch (status) {
      case "found":
        return "OK";
      case "not_found":
        return "Nie znaleziono";
      case "excess":
        return "Nadmiar";
      case "shortage":
        return "Niedobór";
      default:
        return status;
    }
  };

  const progress =
    operation.expectedItems > 0 ? (operation.scannedItems / operation.expectedItems) * 100 : 0;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Skanowanie Dostawy</h1>
          <p className="text-muted-foreground">Skanuj produkty w przychodzącej dostawie</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => setIsScanning(!isScanning)}>
            {isScanning ? "Zatrzymaj Skanowanie" : "Wznów Skanowanie"}
          </Button>
          <Button onClick={handleCompleteDelivery} disabled={operation.status === "completed"}>
            <CheckCircle className="mr-2 h-4 w-4" />
            Zakończ Dostawę
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* Scanner Panel */}
        <div className="space-y-6 lg:col-span-2">
          {/* Delivery Info */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Truck className="h-5 w-5" />
                {operation.name}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">Dostawca:</span>
                <span className="font-medium">{operation.supplier}</span>
              </div>

              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">Postęp:</span>
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium">
                    {operation.scannedItems}/{operation.expectedItems}
                  </span>
                  <Badge variant="outline">{progress.toFixed(0)}%</Badge>
                </div>
              </div>

              <div className="h-3 w-full rounded-full bg-secondary">
                <div
                  className="h-3 rounded-full bg-primary transition-all duration-300"
                  style={{ width: `${Math.min(progress, 100)}%` }}
                />
              </div>

              <div className="flex justify-between text-xs text-muted-foreground">
                <span className="flex items-center gap-1">
                  <Clock className="h-3 w-3" />
                  Rozpoczęto: {operation.startedAt.toLocaleTimeString()}
                </span>
                <Badge
                  variant={operation.status === "active" ? "default" : "secondary"}
                  className="text-xs"
                >
                  {operation.status === "active"
                    ? "Aktywna"
                    : operation.status === "completed"
                      ? "Zakończona"
                      : "Wstrzymana"}
                </Badge>
              </div>
            </CardContent>
          </Card>

          {/* Scanner */}
          {isScanning && operation.status === "active" && (
            <QRScanner
              onScanResult={handleScanResult}
              onError={(error) => toast.error(error)}
              config={{
                continuousScanning: true,
                beepOnSuccess: true,
                vibrateOnSuccess: true,
              }}
            />
          )}

          {operation.status === "completed" && (
            <Alert>
              <CheckCircle className="h-4 w-4" />
              <AlertDescription>
                Dostawa została zakończona. Wszystkie zeskanowane produkty zostały dodane do
                inwentarza.
              </AlertDescription>
            </Alert>
          )}
        </div>

        {/* Scanned Items Panel */}
        <div className="space-y-6">
          {/* Current Item */}
          {currentItem && (
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Ostatnio Zeskanowany</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div>
                  <h4 className="font-medium">{currentItem.productName}</h4>
                  <p className="text-sm text-muted-foreground">SKU: {currentItem.sku}</p>
                </div>

                <div className="flex items-center justify-between">
                  <span className="text-sm">Typ:</span>
                  <Badge variant="outline">
                    {currentItem.type === "qr_code" ? "QR Code" : "Kod kreskowy"}
                  </Badge>
                </div>

                <div className="flex items-center justify-between">
                  <span className="text-sm">Status:</span>
                  <Badge className={getStatusColor(currentItem.status)}>
                    {getStatusLabel(currentItem.status)}
                  </Badge>
                </div>

                <Separator />

                <div className="space-y-2">
                  <Label htmlFor="manual-quantity">Ilość:</Label>
                  <div className="flex gap-2">
                    <Input
                      id="manual-quantity"
                      type="number"
                      value={currentItem.scannedQuantity}
                      onChange={(e) =>
                        handleQuantityUpdate(currentItem.id, parseInt(e.target.value) || 1)
                      }
                      min="1"
                      className="w-20"
                    />
                    {currentItem.expectedQuantity && (
                      <span className="flex items-center text-sm text-muted-foreground">
                        / {currentItem.expectedQuantity}
                      </span>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Summary Stats */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-lg">
                <BarChart3 className="h-4 w-4" />
                Podsumowanie
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">Unikalne produkty:</span>
                <Badge variant="outline">{scannedItems.length}</Badge>
              </div>

              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">Całkowita ilość:</span>
                <Badge variant="outline">
                  {scannedItems.reduce((sum, item) => sum + item.scannedQuantity, 0)}
                </Badge>
              </div>

              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">OK:</span>
                <Badge className="border-green-200 bg-green-100 text-green-800">
                  {scannedItems.filter((item) => item.status === "found").length}
                </Badge>
              </div>

              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">Problemy:</span>
                <Badge className="border-orange-200 bg-orange-100 text-orange-800">
                  {scannedItems.filter((item) => item.status !== "found").length}
                </Badge>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Scanned Items List */}
      {scannedItems.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Zeskanowane Produkty</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="max-h-60 space-y-2 overflow-y-auto">
              {scannedItems.map((item) => (
                <div
                  key={item.id}
                  className="flex items-center justify-between rounded-lg bg-muted/30 p-3"
                >
                  <div className="flex-1">
                    <h4 className="text-sm font-medium">{item.productName}</h4>
                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                      <span>{item.sku}</span>
                      <span>•</span>
                      <span>{item.scannedAt.toLocaleTimeString()}</span>
                      <Badge variant="outline" className="text-xs">
                        {item.type === "qr_code" ? "QR" : "Barcode"}
                      </Badge>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium">
                      {item.scannedQuantity}
                      {item.expectedQuantity && ` / ${item.expectedQuantity}`}
                    </span>
                    <Badge className={getStatusColor(item.status)}>
                      {getStatusLabel(item.status)}
                    </Badge>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
