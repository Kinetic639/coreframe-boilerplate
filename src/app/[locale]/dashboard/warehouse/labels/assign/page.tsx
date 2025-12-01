"use client";

import { useState, useEffect, useCallback } from "react";
import { useSearchParams } from "next/navigation";
import { useLocations } from "@/lib/hooks/use-locations";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Checkbox } from "@/components/ui/checkbox";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  QrCode,
  Package,
  MapPin,
  Search,
  ArrowLeft,
  Loader2,
  CheckCircle,
  AlertCircle,
} from "lucide-react";
import { QRScanner } from "@/components/ui/qr-scanner";
import { Link } from "@/i18n/navigation";
import { useRouter } from "@/i18n/navigation";
import { toast } from "react-toastify";
import { createClient } from "@/lib/supabase/client";

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

export default function LabelAssignPage() {
  const searchParams = useSearchParams();
  const router = useRouter();

  const qrToken = searchParams.get("qr");
  const entityType = searchParams.get("type") as "product" | "location";
  const entityId = searchParams.get("entity");

  const [step, setStep] = useState<"scan" | "select" | "confirm">("scan");
  const [selectedQrToken, setSelectedQrToken] = useState<string | null>(qrToken || null);
  const [selectedEntity, setSelectedEntity] = useState<Product | Location | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [entities, setEntities] = useState<(Product | Location)[]>([]);
  const [loading, setLoading] = useState(false);
  const [isAssigning, setIsAssigning] = useState(false);
  const [showScanner, setShowScanner] = useState(false);
  const [hideAssigned, setHideAssigned] = useState(true); // Hide assigned QR codes by default
  const [showOverrideDialog, setShowOverrideDialog] = useState(false);
  const [pendingEntity, setPendingEntity] = useState<Product | Location | null>(null);

  const supabase = createClient();
  const { locations: storeLocations } = useLocations();

  // Load entity by ID if provided
  const loadEntity = useCallback(
    async (id: string) => {
      setLoading(true);
      try {
        if (entityType === "location") {
          const { data: location, error } = await supabase
            .from("locations")
            .select("id, name, code, level, has_qr_assigned, qr_label_id")
            .eq("id", id)
            .single();

          if (error) {
            console.error("Error loading location:", error);
            toast.error("Nie można załadować lokalizacji");
            return;
          }

          if (location) {
            setSelectedEntity(location as Location);
          }
        } else if (entityType === "product") {
          const { data: product, error } = await supabase
            .from("products")
            .select("id, name, code, sku, has_qr_assigned, qr_label_id")
            .eq("id", id)
            .single();

          if (error) {
            console.error("Error loading product:", error);
            toast.error("Nie można załadować produktu");
            return;
          }

          if (product) {
            setSelectedEntity(product as Product);
          }
        }
      } catch (error) {
        console.error("Error loading entity:", error);
        toast.error("Wystąpił błąd podczas ładowania");
      } finally {
        setLoading(false);
      }
    },
    [entityType, supabase]
  );

  // Search for entities
  const searchEntities = useCallback(async () => {
    setLoading(true);
    try {
      if (entityType === "location") {
        // Get QR assignment status for all locations by querying qr_labels table
        const { data: qrLabels, error: qrError } = await supabase
          .from("qr_labels")
          .select("entity_id")
          .eq("entity_type", "location")
          .eq("is_active", true);

        if (qrError) {
          console.error("Error fetching QR assignments:", qrError);
        }

        // Create a Set of location IDs that have QR assignments
        const assignedLocationIds = new Set(qrLabels?.map((label) => label.entity_id) || []);

        console.log("🔍 Debug - Assigned location IDs:", assignedLocationIds);
        console.log("🔍 Debug - Store locations sample:", storeLocations.slice(0, 3));

        // Start with all locations or filter by search query
        const filteredLocations = !searchQuery
          ? storeLocations
          : storeLocations.filter(
              (location) =>
                location.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                location.code?.toLowerCase().includes(searchQuery.toLowerCase())
            );

        // Map locations with correct QR assignment status
        const locationEntities: Location[] = filteredLocations.map((location) => ({
          id: location.id,
          name: location.name,
          code: location.code || undefined,
          level: location.level,
          has_qr_assigned: assignedLocationIds.has(location.id),
          qr_label_id: undefined, // We'll populate this if needed
        }));

        console.log("🔍 Debug - Location entities sample:", locationEntities.slice(0, 3));

        // Apply hideAssigned filter if enabled
        const finalEntities = hideAssigned
          ? locationEntities.filter((location) => !location.has_qr_assigned)
          : locationEntities;

        console.log(
          "🔍 Debug - Final entities after filter:",
          finalEntities.length,
          "hideAssigned:",
          hideAssigned
        );

        setEntities(finalEntities);
      } else if (entityType === "product") {
        // Get QR assignment status for all products by querying qr_labels table
        const { data: qrLabels, error: qrError } = await supabase
          .from("qr_labels")
          .select("entity_id")
          .eq("entity_type", "product")
          .eq("is_active", true);

        if (qrError) {
          console.error("Error fetching product QR assignments:", qrError);
        }

        // Create a Set of product IDs that have QR assignments
        const assignedProductIds = new Set(qrLabels?.map((label) => label.entity_id) || []);

        let query = supabase.from("products").select("id, name, code, sku");

        if (searchQuery) {
          // Search products based on query
          query = query
            .or(
              `name.ilike.%${searchQuery}%,code.ilike.%${searchQuery}%,sku.ilike.%${searchQuery}%`
            )
            .limit(20);
        } else {
          // Show all products initially (limited to 50)
          query = query.limit(50);
        }

        const { data: products, error } = await query;

        if (error) {
          console.error("Error loading products:", error);
          toast.error(
            searchQuery ? "Błąd podczas wyszukiwania produktów" : "Błąd podczas ładowania produktów"
          );
          return;
        }

        // Map products with correct QR assignment status
        const productEntities: Product[] = (products || []).map((product) => ({
          id: product.id,
          name: product.name,
          code: product.code || undefined,
          sku: product.sku || undefined,
          has_qr_assigned: assignedProductIds.has(product.id),
          qr_label_id: undefined,
        }));

        // Apply hideAssigned filter if enabled
        const finalEntities = hideAssigned
          ? productEntities.filter((product) => !product.has_qr_assigned)
          : productEntities;

        setEntities(finalEntities);
      }
    } catch (error) {
      console.error("Error searching entities:", error);
      toast.error("Wystąpił błąd podczas wyszukiwania");
    } finally {
      setLoading(false);
    }
  }, [searchQuery, entityType, storeLocations, supabase, hideAssigned]);

  // Initialize component state
  useEffect(() => {
    if (entityId) {
      loadEntity(entityId);
    }

    // Determine initial step based on available parameters
    if (qrToken && entityId) {
      setStep("confirm");
    } else if (qrToken) {
      setStep("select");
    } else if (entityId) {
      setStep("scan");
    } else {
      setStep("scan");
    }
  }, [entityId, qrToken, loadEntity]);

  // Search entities when query changes
  useEffect(() => {
    const debounceTimer = setTimeout(searchEntities, 300);
    return () => clearTimeout(debounceTimer);
  }, [searchEntities]);

  // Load initial entities when step changes to select
  useEffect(() => {
    if (step === "select") {
      searchEntities();
    }
  }, [step, searchEntities]);

  const handleQrScan = (token: string) => {
    if (!token) {
      toast.error("Nieprawidłowy kod QR");
      return;
    }

    setSelectedQrToken(token);

    if (selectedEntity) {
      setStep("confirm");
    } else {
      setStep("select");
    }
  };

  const handleEntitySelect = (entity: Product | Location) => {
    // Check if entity already has QR assigned
    if (entity.has_qr_assigned) {
      // Show confirmation dialog for override
      setPendingEntity(entity);
      setShowOverrideDialog(true);
    } else {
      // Entity is available, proceed with selection
      setSelectedEntity(entity);

      if (selectedQrToken) {
        setStep("confirm");
      } else {
        setStep("scan");
      }
    }
  };

  const handleConfirmOverride = () => {
    // User confirmed override, proceed with selection
    if (pendingEntity) {
      setSelectedEntity(pendingEntity);

      if (selectedQrToken) {
        setStep("confirm");
      } else {
        setStep("scan");
      }
    }

    // Close dialog and clear pending entity
    setShowOverrideDialog(false);
    setPendingEntity(null);
  };

  const handleCancelOverride = () => {
    // User cancelled, close dialog and clear pending entity
    setShowOverrideDialog(false);
    setPendingEntity(null);
  };

  const handleAssignment = async () => {
    if (!selectedEntity || !selectedQrToken) {
      toast.error("Wybierz element i zeskanuj kod QR");
      return;
    }

    setIsAssigning(true);
    try {
      const response = await fetch("/api/labels/assign", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          entityType,
          entityId: selectedEntity.id,
          qrToken: selectedQrToken,
          generateNew: false,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "Assignment failed");
      }

      // Redirect to success page
      router.push({
        pathname: "/dashboard/warehouse/labels/assign/success",
        query: { entity: selectedEntity.id, type: entityType },
      });
    } catch (error) {
      console.error("Error assigning QR:", error);
      const errorMessage = error instanceof Error ? error.message : "Unknown error";
      // Redirect to error page
      router.push({
        pathname: "/dashboard/warehouse/labels/assign/error",
        query: { message: errorMessage },
      });
    } finally {
      setIsAssigning(false);
    }
  };

  // Error state for invalid parameters
  if (!entityType || (entityType !== "product" && entityType !== "location")) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="mx-auto max-w-2xl">
          <Card>
            <CardHeader className="text-center">
              <CardTitle className="text-red-600">Błąd parametrów</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4 text-center">
              <p className="text-muted-foreground">Nieprawidłowe parametry przypisania etykiety.</p>
              <Button asChild variant="outline">
                <Link href="/dashboard/warehouse/labels">
                  <ArrowLeft className="mr-2 h-4 w-4" />
                  Powrót do etykiet
                </Link>
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="mx-auto max-w-2xl space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold">Przypisanie etykiety QR</h1>
            <p className="text-muted-foreground">
              Przypisz kod QR do {entityType === "product" ? "produktu" : "lokalizacji"}
            </p>
          </div>
          <Button variant="ghost" asChild>
            <Link href="/dashboard/warehouse/labels">
              <ArrowLeft className="mr-2 h-4 w-4" />
              Anuluj
            </Link>
          </Button>
        </div>

        {/* Progress Steps */}
        <div className="flex items-center justify-center space-x-4">
          <div
            className={`flex items-center ${step === "scan" ? "text-primary" : "text-muted-foreground"}`}
          >
            <div
              className={`flex h-8 w-8 items-center justify-center rounded-full ${
                step === "scan" ? "bg-primary text-primary-foreground" : "bg-muted"
              }`}
            >
              1
            </div>
            <span className="ml-2">Skanuj QR</span>
          </div>
          <div className="h-0.5 w-8 bg-border"></div>
          <div
            className={`flex items-center ${step === "select" ? "text-primary" : "text-muted-foreground"}`}
          >
            <div
              className={`flex h-8 w-8 items-center justify-center rounded-full ${
                step === "select" ? "bg-primary text-primary-foreground" : "bg-muted"
              }`}
            >
              2
            </div>
            <span className="ml-2">Wybierz element</span>
          </div>
          <div className="h-0.5 w-8 bg-border"></div>
          <div
            className={`flex items-center ${step === "confirm" ? "text-primary" : "text-muted-foreground"}`}
          >
            <div
              className={`flex h-8 w-8 items-center justify-center rounded-full ${
                step === "confirm" ? "bg-primary text-primary-foreground" : "bg-muted"
              }`}
            >
              3
            </div>
            <span className="ml-2">Potwierdź</span>
          </div>
        </div>

        {/* Step Content */}
        {step === "scan" && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <QrCode className="h-5 w-5" />
                Skanuj kod QR
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="text-center">
                <p className="mb-4 text-muted-foreground">
                  Zeskanuj kod QR etykiety, którą chcesz przypisać, lub wprowadź token ręcznie.
                </p>

                {selectedQrToken && (
                  <Alert className="mb-4">
                    <CheckCircle className="h-4 w-4" />
                    <AlertDescription>
                      Kod QR zeskanowany: <code>{selectedQrToken}</code>
                    </AlertDescription>
                  </Alert>
                )}

                <div className="space-y-4">
                  <div>
                    <Label htmlFor="qr-token">Token QR</Label>
                    <Input
                      id="qr-token"
                      value={selectedQrToken || ""}
                      onChange={(e) => setSelectedQrToken(e.target.value)}
                      placeholder="Wprowadź token QR lub zeskanuj poniżej"
                    />
                  </div>

                  <div className="flex gap-2">
                    <Button
                      onClick={() => setShowScanner(!showScanner)}
                      variant="outline"
                      className="flex-1"
                    >
                      <QrCode className="mr-2 h-4 w-4" />
                      {showScanner ? "Ukryj skaner" : "Pokaż skaner"}
                    </Button>

                    <Button
                      onClick={() => handleQrScan(selectedQrToken || "")}
                      disabled={!selectedQrToken}
                      className="flex-1"
                    >
                      Kontynuuj
                    </Button>
                  </div>

                  {showScanner && (
                    <div className="rounded-lg border p-4">
                      <QRScanner
                        onScan={handleQrScan}
                        onError={(error) => {
                          console.error("QR Scanner error:", error);
                          toast.error("Błąd skanera QR");
                        }}
                      />
                    </div>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {step === "select" && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                {entityType === "location" ? (
                  <MapPin className="h-5 w-5" />
                ) : (
                  <Package className="h-5 w-5" />
                )}
                Wybierz {entityType === "product" ? "produkt" : "lokalizację"}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {selectedEntity && (
                <Alert
                  className={`mb-4 ${selectedEntity.has_qr_assigned ? "border-amber-200 bg-amber-50" : "border-green-200 bg-green-50"}`}
                >
                  {selectedEntity.has_qr_assigned ? (
                    <AlertCircle className="h-4 w-4 text-amber-600" />
                  ) : (
                    <CheckCircle className="h-4 w-4 text-green-600" />
                  )}
                  <AlertDescription
                    className={selectedEntity.has_qr_assigned ? "text-amber-800" : "text-green-800"}
                  >
                    <div className="flex items-center gap-2">
                      <span>
                        Wybrano: <strong>{selectedEntity.name}</strong>
                        {selectedEntity.code && ` (${selectedEntity.code})`}
                      </span>
                      {selectedEntity.has_qr_assigned && (
                        <Badge variant="destructive" className="text-xs">
                          Ma już QR
                        </Badge>
                      )}
                    </div>
                    {selectedEntity.has_qr_assigned && (
                      <p className="mt-1 text-sm text-amber-700">
                        Uwaga: Ten {entityType === "product" ? "produkt" : "lokalizacja"} ma już
                        przypisany kod QR. Nowe przypisanie zastąpi poprzednie.
                      </p>
                    )}
                  </AlertDescription>
                </Alert>
              )}

              <div className="space-y-4">
                <div>
                  <Label htmlFor="search">
                    Wyszukaj {entityType === "product" ? "produkt" : "lokalizację"}
                  </Label>
                  <div className="relative">
                    <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                    <Input
                      id="search"
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      placeholder={`Wyszukaj ${entityType === "product" ? "produkt" : "lokalizację"} po nazwie lub kodzie`}
                      className="pl-10"
                    />
                  </div>
                </div>

                <div className="flex items-center space-x-2">
                  <Checkbox
                    id="hide-assigned"
                    checked={hideAssigned}
                    onCheckedChange={(checked) => setHideAssigned(checked === true)}
                  />
                  <Label htmlFor="hide-assigned" className="cursor-pointer text-sm font-normal">
                    Ukryj {entityType === "product" ? "produkty" : "lokalizacje"} z już przypisanymi
                    kodami QR
                  </Label>
                </div>
              </div>

              {loading && (
                <div className="flex items-center justify-center py-4">
                  <Loader2 className="h-6 w-6 animate-spin" />
                </div>
              )}

              {entities.length > 0 ? (
                <div className="space-y-2">
                  <p className="text-sm text-muted-foreground">
                    {searchQuery
                      ? `Znaleziono ${entities.length} ${entityType === "product" ? "produktów" : "lokalizacji"}`
                      : `Pokazano ${entities.length} ${entityType === "product" ? "produktów" : "lokalizacji"}`}
                    {hideAssigned && (
                      <span className="ml-1 text-green-600">• bez przypisanych QR</span>
                    )}
                  </p>
                  <div className="max-h-64 space-y-2 overflow-y-auto">
                    {entities.map((entity) => (
                      <div
                        key={entity.id}
                        onClick={() => handleEntitySelect(entity)}
                        className={`cursor-pointer rounded border p-3 transition-colors hover:bg-muted ${
                          selectedEntity?.id === entity.id ? "border-primary bg-muted" : ""
                        }`}
                      >
                        <div className="flex items-center justify-between">
                          <div>
                            <div className="font-medium">{entity.name}</div>
                            {entity.code && (
                              <div className="text-sm text-muted-foreground">
                                Kod: {entity.code}
                              </div>
                            )}
                            {entityType === "location" && (
                              <div className="text-xs text-muted-foreground">
                                Poziom: {(entity as Location).level}
                              </div>
                            )}
                          </div>
                          <div className="flex flex-col gap-1">
                            {entity.has_qr_assigned ? (
                              <Badge variant="destructive" className="text-xs">
                                ⚠️ Ma już QR
                              </Badge>
                            ) : (
                              <Badge variant="secondary" className="text-xs">
                                ✅ Dostępne
                              </Badge>
                            )}
                            {selectedEntity?.id === entity.id && (
                              <Badge variant="default" className="text-xs">
                                📍 Wybrane
                              </Badge>
                            )}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ) : (
                !loading && (
                  <div className="py-8 text-center text-muted-foreground">
                    {searchQuery
                      ? `Nie znaleziono ${entityType === "product" ? "produktów" : "lokalizacji"} pasujących do wyszukiwania "${searchQuery}"`
                      : `Brak dostępnych ${entityType === "product" ? "produktów" : "lokalizacji"}`}
                  </div>
                )
              )}

              <div className="flex gap-2 pt-4">
                <Button variant="outline" onClick={() => setStep("scan")}>
                  Wstecz
                </Button>
                <Button
                  onClick={() => setStep("confirm")}
                  disabled={!selectedEntity}
                  className="flex-1"
                >
                  Kontynuuj
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {step === "confirm" && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <CheckCircle className="h-5 w-5" />
                Potwierdź przypisanie
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-4">
                <div className="rounded-lg bg-muted p-4">
                  <h4 className="mb-2 font-semibold">Podsumowanie przypisania:</h4>
                  <div className="space-y-2">
                    <div>
                      <span className="text-muted-foreground">Kod QR:</span>
                      <code className="ml-2 rounded bg-background px-2 py-1">
                        {selectedQrToken}
                      </code>
                    </div>
                    <div>
                      <span className="text-muted-foreground">
                        {entityType === "product" ? "Produkt:" : "Lokalizacja:"}
                      </span>
                      <span className="ml-2 font-medium">{selectedEntity?.name}</span>
                      {selectedEntity?.code && (
                        <Badge variant="outline" className="ml-2">
                          {selectedEntity.code}
                        </Badge>
                      )}
                    </div>
                  </div>
                </div>

                {selectedEntity?.has_qr_assigned && (
                  <Alert>
                    <AlertCircle className="h-4 w-4" />
                    <AlertDescription>
                      Ten {entityType === "product" ? "produkt" : "lokalizacja"} ma już przypisany
                      kod QR. Przypisanie nowego kodu zastąpi poprzedni.
                    </AlertDescription>
                  </Alert>
                )}
              </div>

              <div className="flex gap-2 pt-4">
                <Button variant="outline" onClick={() => setStep("select")}>
                  Wstecz
                </Button>
                <Button
                  onClick={handleAssignment}
                  disabled={isAssigning || !selectedEntity || !selectedQrToken}
                  className="flex-1"
                >
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
            </CardContent>
          </Card>
        )}
      </div>

      {/* Override Confirmation Dialog */}
      <AlertDialog open={showOverrideDialog} onOpenChange={setShowOverrideDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <AlertCircle className="h-5 w-5 text-amber-600" />
              Potwierdzenie nadpisania
            </AlertDialogTitle>
            <AlertDialogDescription>
              <div className="space-y-3">
                <p>
                  {entityType === "product" ? "Produkt" : "Lokalizacja"}{" "}
                  <strong>{pendingEntity?.name}</strong>
                  {pendingEntity?.code && ` (${pendingEntity.code})`} ma już przypisany kod QR.
                </p>

                <div className="rounded-lg border border-amber-200 bg-amber-50 p-3">
                  <p className="text-sm text-amber-800">
                    <strong>Uwaga:</strong> Przypisanie nowego kodu QR spowoduje zastąpienie
                    poprzedniego przypisania. Ta operacja nie może zostać cofnięta.
                  </p>
                </div>

                <p className="text-sm">
                  Czy na pewno chcesz kontynuować i nadpisać istniejące przypisanie?
                </p>
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={handleCancelOverride}>Anuluj</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleConfirmOverride}
              className="bg-amber-600 hover:bg-amber-700"
            >
              Tak, nadpisz przypisanie
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
