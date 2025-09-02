"use client";

import { useState, useEffect, useCallback } from "react";
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
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  Loader2,
  QrCode,
  Package,
  MapPin,
  Search,
  AlertCircle,
  CheckCircle,
  X,
} from "lucide-react";
import { QRScanner } from "@/components/ui/qr-scanner";
import { toast } from "react-toastify";

interface Product {
  id: string;
  name: string;
  code?: string;
  sku?: string;
  has_qr_assigned?: boolean;
  qr_label_id?: string;
}

interface Location {
  id: string;
  name: string;
  code?: string;
  level: number;
  has_qr_assigned?: boolean;
  qr_label_id?: string;
}

interface LabelAssignmentDialogProps {
  open: boolean;
  onClose: () => void;
  entityType: "product" | "location";
  entityId?: string;
  qrToken?: string; // If scanning a label to assign
}

export function LabelAssignmentDialog({
  open,
  onClose,
  entityType,
  entityId,
  qrToken: initialQrToken,
}: LabelAssignmentDialogProps) {
  const [step, setStep] = useState<"scan" | "select" | "confirm">("scan");
  const [qrToken, setQrToken] = useState<string | null>(initialQrToken || null);
  const [selectedEntity, setSelectedEntity] = useState<Product | Location | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [entities, setEntities] = useState<(Product | Location)[]>([]);
  const [loading, setLoading] = useState(false);
  const [isAssigning, setIsAssigning] = useState(false);
  const [showScanner, setShowScanner] = useState(false);

  const loadEntity = useCallback(
    async (id: string) => {
      setLoading(true);
      try {
        // TODO: Implement loading single entity from Supabase
        // For now, mock data
        if (entityType === "product") {
          setSelectedEntity({
            id,
            name: `Product ${id}`,
            code: `P${id}`,
            sku: `SKU${id}`,
            has_qr_assigned: false,
          });
        } else {
          setSelectedEntity({
            id,
            name: `Location ${id}`,
            code: `L${id}`,
            level: 1,
            has_qr_assigned: false,
          });
        }
      } catch (error) {
        console.error("Error loading entity:", error);
        toast.error("Nie udało się załadować danych");
      } finally {
        setLoading(false);
      }
    },
    [entityType]
  );

  const loadEntities = useCallback(async () => {
    setLoading(true);
    try {
      // TODO: Implement loading entities from Supabase
      // For now, mock data
      const mockEntities = Array.from({ length: 10 }, (_, i) => {
        if (entityType === "product") {
          return {
            id: `prod-${i}`,
            name: `Product ${i + 1}`,
            code: `P${i + 1}`,
            sku: `SKU${i + 1}`,
            has_qr_assigned: Math.random() > 0.7,
          };
        } else {
          return {
            id: `loc-${i}`,
            name: `Location ${i + 1}`,
            code: `L${i + 1}`,
            level: Math.floor(i / 3) + 1,
            has_qr_assigned: Math.random() > 0.7,
          };
        }
      });

      setEntities(mockEntities);
    } catch (error) {
      console.error("Error loading entities:", error);
      toast.error("Nie udało się załadować danych");
    } finally {
      setLoading(false);
    }
  }, [entityType]);

  useEffect(() => {
    if (open) {
      if (entityId) {
        // Pre-selected entity, go directly to scan step
        loadEntity(entityId);
        setStep("scan");
      } else if (initialQrToken) {
        // Pre-scanned QR, go to select step
        setQrToken(initialQrToken);
        setStep("select");
      } else {
        // Start from scratch
        setStep("scan");
      }
      loadEntities();
    } else {
      // Reset state when dialog closes
      setStep("scan");
      setQrToken(null);
      setSelectedEntity(null);
      setSearchQuery("");
      setEntities([]);
      setShowScanner(false);
    }
  }, [open, entityId, initialQrToken, loadEntity, loadEntities]);

  const handleQRScan = async (scannedToken: string) => {
    setShowScanner(false);

    // Extract QR token from URL if needed
    let token = scannedToken;
    if (scannedToken.includes("/qr/")) {
      const parts = scannedToken.split("/qr/");
      token = parts[parts.length - 1];
    }

    setQrToken(token);

    if (selectedEntity) {
      // Entity already selected, go to confirm
      setStep("confirm");
    } else {
      // Need to select entity
      setStep("select");
    }
  };

  const handleEntitySelect = (entity: Product | Location) => {
    setSelectedEntity(entity);

    if (qrToken) {
      // QR already scanned, go to confirm
      setStep("confirm");
    } else {
      // Need to scan QR
      setStep("scan");
    }
  };

  const handleAssignment = async () => {
    if (!selectedEntity || !qrToken) {
      toast.error("Wybierz element i zeskanuj kod QR");
      return;
    }

    setIsAssigning(true);
    try {
      // TODO: Implement assignment in Supabase

      // Simulate API call
      await new Promise((resolve) => setTimeout(resolve, 1500));

      toast.success(
        `Kod QR został przypisany do ${entityType === "product" ? "produktu" : "lokalizacji"} ${selectedEntity.name}`
      );

      onClose();
    } catch (error) {
      console.error("Error assigning QR:", error);
      toast.error("Nie udało się przypisać kodu QR");
    } finally {
      setIsAssigning(false);
    }
  };

  const filteredEntities = entities.filter(
    (entity) =>
      entity.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (entity.code && entity.code.toLowerCase().includes(searchQuery.toLowerCase())) ||
      ("sku" in entity &&
        entity.sku &&
        entity.sku.toLowerCase().includes(searchQuery.toLowerCase()))
  );

  const renderStepContent = () => {
    switch (step) {
      case "scan":
        return (
          <div className="space-y-6">
            {selectedEntity && (
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-sm">
                    {entityType === "product" ? (
                      <Package className="h-4 w-4" />
                    ) : (
                      <MapPin className="h-4 w-4" />
                    )}
                    Wybrano: {selectedEntity.name}
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-1 text-sm text-muted-foreground">
                    {selectedEntity.code && <p>Kod: {selectedEntity.code}</p>}
                    {"sku" in selectedEntity && selectedEntity.sku && (
                      <p>SKU: {selectedEntity.sku}</p>
                    )}
                    {"level" in selectedEntity && <p>Poziom: {selectedEntity.level}</p>}
                  </div>
                </CardContent>
              </Card>
            )}

            <div className="text-center">
              <p className="mb-2 text-lg font-semibold">Zeskanuj kod QR etykiety</p>
              <p className="mb-6 text-muted-foreground">
                {selectedEntity
                  ? "Zeskanuj kod QR etykiety, którą chcesz przypisać"
                  : "Zeskanuj kod QR etykiety do przypisania"}
              </p>

              <div className="flex justify-center gap-3">
                <Button onClick={() => setShowScanner(true)} className="flex items-center gap-2">
                  <QrCode className="h-4 w-4" />
                  Uruchom skaner
                </Button>
                {!selectedEntity && (
                  <Button variant="outline" onClick={() => setStep("select")}>
                    Lub wybierz {entityType === "product" ? "produkt" : "lokalizację"}
                  </Button>
                )}
              </div>
            </div>

            {showScanner && (
              <QRScanner
                onScan={handleQRScan}
                onClose={() => setShowScanner(false)}
                onError={(error) => {
                  console.error("Scanner error:", error);
                  setShowScanner(false);
                }}
              />
            )}
          </div>
        );

      case "select":
        return (
          <div className="space-y-6">
            {qrToken && (
              <Alert>
                <QrCode className="h-4 w-4" />
                <AlertDescription>
                  Zeskanowano kod QR: <code className="rounded bg-muted px-1">{qrToken}</code>
                </AlertDescription>
              </Alert>
            )}

            <div>
              <Label htmlFor="search">
                Wyszukaj {entityType === "product" ? "produkt" : "lokalizację"}
              </Label>
              <div className="relative mt-2">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 transform text-muted-foreground" />
                <Input
                  id="search"
                  placeholder={`Wpisz nazwę, kod ${entityType === "product" ? "lub SKU" : ""}`}
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-10"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label className="text-sm font-medium">
                Dostępne {entityType === "product" ? "produkty" : "lokalizacje"}
              </Label>
              <div className="max-h-96 overflow-y-auto rounded-lg border">
                {loading ? (
                  <div className="flex items-center justify-center p-8">
                    <Loader2 className="h-6 w-6 animate-spin" />
                  </div>
                ) : filteredEntities.length === 0 ? (
                  <div className="p-8 text-center text-muted-foreground">
                    Nie znaleziono {entityType === "product" ? "produktów" : "lokalizacji"}
                  </div>
                ) : (
                  <div className="space-y-1 p-2">
                    {filteredEntities.map((entity) => (
                      <div
                        key={entity.id}
                        className={`flex cursor-pointer items-center justify-between rounded border p-3 transition-colors ${
                          selectedEntity?.id === entity.id
                            ? "border-primary bg-primary/5"
                            : "hover:border-primary/50"
                        }`}
                        onClick={() => handleEntitySelect(entity)}
                      >
                        <div className="flex items-center gap-3">
                          {entityType === "product" ? (
                            <Package className="h-4 w-4 text-muted-foreground" />
                          ) : (
                            <MapPin className="h-4 w-4 text-muted-foreground" />
                          )}
                          <div>
                            <p className="font-medium">{entity.name}</p>
                            <div className="flex items-center gap-2 text-xs text-muted-foreground">
                              {entity.code && <span>Kod: {entity.code}</span>}
                              {"sku" in entity && entity.sku && <span>SKU: {entity.sku}</span>}
                              {"level" in entity && <span>Poziom: {entity.level}</span>}
                            </div>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          {entity.has_qr_assigned && (
                            <Badge variant="secondary" className="text-xs">
                              <QrCode className="mr-1 h-3 w-3" />
                              Przypisany
                            </Badge>
                          )}
                          {selectedEntity?.id === entity.id && (
                            <CheckCircle className="h-4 w-4 text-primary" />
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            <div className="flex justify-between">
              <Button variant="outline" onClick={() => setStep("scan")}>
                Wróć do skanowania
              </Button>
              <Button onClick={() => setStep("confirm")} disabled={!selectedEntity || !qrToken}>
                Dalej
              </Button>
            </div>
          </div>
        );

      case "confirm":
        return (
          <div className="space-y-6">
            <div className="text-center">
              <CheckCircle className="mx-auto mb-4 h-16 w-16 text-green-500" />
              <h3 className="mb-2 text-lg font-semibold">Potwierdź przypisanie</h3>
              <p className="text-muted-foreground">Sprawdź dane przed przypisaniem kodu QR</p>
            </div>

            <Card>
              <CardHeader>
                <CardTitle className="text-sm">Szczegóły przypisania</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label className="text-xs text-muted-foreground">KOD QR</Label>
                  <div className="flex items-center gap-2 rounded bg-muted p-2">
                    <QrCode className="h-4 w-4" />
                    <code className="text-sm">{qrToken}</code>
                  </div>
                </div>

                <Separator />

                <div className="space-y-2">
                  <Label className="text-xs text-muted-foreground">
                    {entityType === "product" ? "PRODUKT" : "LOKALIZACJA"}
                  </Label>
                  <div className="flex items-center gap-2 rounded bg-muted p-2">
                    {entityType === "product" ? (
                      <Package className="h-4 w-4" />
                    ) : (
                      <MapPin className="h-4 w-4" />
                    )}
                    <div>
                      <p className="font-medium">{selectedEntity?.name}</p>
                      <div className="flex gap-2 text-xs text-muted-foreground">
                        {selectedEntity?.code && <span>Kod: {selectedEntity.code}</span>}
                        {"sku" in selectedEntity! && selectedEntity.sku && (
                          <span>SKU: {selectedEntity.sku}</span>
                        )}
                        {"level" in selectedEntity! && <span>Poziom: {selectedEntity.level}</span>}
                      </div>
                    </div>
                  </div>
                </div>

                {selectedEntity?.has_qr_assigned && (
                  <Alert>
                    <AlertCircle className="h-4 w-4" />
                    <AlertDescription>
                      Uwaga: Ten element ma już przypisany kod QR. Nowe przypisanie zastąpi
                      poprzednie.
                    </AlertDescription>
                  </Alert>
                )}
              </CardContent>
            </Card>

            <div className="flex justify-between">
              <Button variant="outline" onClick={() => setStep(selectedEntity ? "scan" : "select")}>
                Wróć
              </Button>
              <Button onClick={handleAssignment} disabled={isAssigning}>
                {isAssigning ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Przypisuję...
                  </>
                ) : (
                  "Przypisz kod QR"
                )}
              </Button>
            </div>
          </div>
        );

      default:
        return null;
    }
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-h-[90vh] max-w-2xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <QrCode className="h-5 w-5" />
            Przypisanie kodu QR
          </DialogTitle>
          <DialogDescription>
            Przypisz kod QR do {entityType === "product" ? "produktu" : "lokalizacji"}
          </DialogDescription>
        </DialogHeader>

        {renderStepContent()}

        {/* Close button always visible */}
        <Button variant="ghost" size="sm" onClick={onClose} className="absolute right-4 top-4">
          <X className="h-4 w-4" />
        </Button>
      </DialogContent>
    </Dialog>
  );
}
