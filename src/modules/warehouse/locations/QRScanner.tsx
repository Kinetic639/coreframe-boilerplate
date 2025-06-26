"use client";

import { useState, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, QrCode, AlertCircle, CheckCircle, MapPin } from "lucide-react";
import { createClient } from "@/utils/supabase/client";
import { useLocations, LocationRow } from "./useLocations";

interface QRScannerProps {
  onLocationFound: (locationId: string) => void;
  onBack: () => void;
}

export function QRScanner({ onLocationFound, onBack }: QRScannerProps) {
  const [qrCode, setQrCode] = useState("");
  const [scanResult, setScanResult] = useState<{
    found: boolean;
    locationId?: string;
    message: string;
  } | null>(null);
  const [showAssignForm, setShowAssignForm] = useState(false);
  const [selectedLocationId, setSelectedLocationId] = useState("");
  const [newLocationName, setNewLocationName] = useState("");
  const [newLocationParent, setNewLocationParent] = useState<string | null>(null);
  const [assignmentMode, setAssignmentMode] = useState<"existing" | "new">("existing");
  const supabase = createClient();
  const { locations, mutate } = useLocations();
  const locationMap = useMemo(() => {
    const map = new Map<string, LocationRow>();
    locations.forEach((l) => map.set(l.id, l));
    return map;
  }, [locations]);

  const getLocationPath = (id: string) => {
    const parts: string[] = [];
    let current = locationMap.get(id);
    while (current) {
      parts.unshift(current.name);
      if (!current.parent_id) break;
      current = locationMap.get(current.parent_id);
    }
    return parts.join(" > ");
  };

  const handleScan = () => {
    if (!qrCode.trim()) return;

    const location = locations.find((l) => l.code === qrCode.trim());

    if (location) {
      setScanResult({
        found: true,
        locationId: location.id,
        message: `Kod QR przypisany do lokalizacji: ${location.name}`,
      });
      setShowAssignForm(false);
    } else {
      setScanResult({
        found: false,
        message: `Kod QR "${qrCode}" nie jest przypisany do żadnej lokalizacji.`,
      });
      setShowAssignForm(true);
    }
  };

  const handleAssignToExisting = async () => {
    if (!selectedLocationId) return;

    await supabase.from("locations").update({ code: qrCode }).eq("id", selectedLocationId);
    mutate();

    setScanResult({
      found: true,
      locationId: selectedLocationId,
      message: `Kod QR "${qrCode}" został przypisany do lokalizacji.`,
    });
    setShowAssignForm(false);
  };

  const handleCreateNewLocation = async () => {
    if (!newLocationName.trim()) return;

    let level = 1;
    if (newLocationParent) {
      const parent = locationMap.get(newLocationParent);
      if (parent) level = parent.level + 1;
    }

    const { data } = await supabase
      .from("locations")
      .insert({
        name: newLocationName.trim(),
        parent_id: newLocationParent,
        level,
        code: qrCode,
      })
      .select()
      .single();

    mutate();

    setScanResult({
      found: true,
      locationId: data?.id,
      message: `Utworzono nową lokalizację "${newLocationName}" i przypisano kod QR "${qrCode}".`,
    });
    setShowAssignForm(false);
  };

  const handleGoToLocation = () => {
    if (scanResult?.locationId) {
      onLocationFound(scanResult.locationId);
    }
  };

  const getAvailableLocations = () => locations;

  const getAvailableParents = () => locations.filter((loc) => loc.level < 3);

  const handleNewLocationParentChange = (value: string) => {
    setNewLocationParent(value === "no-parent" ? null : value);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="outline" onClick={onBack} className="flex items-center gap-2">
          <ArrowLeft className="h-4 w-4" />
          Powrót
        </Button>
        <div>
          <h3 className="text-lg font-semibold text-gray-900">Skaner Kodów QR</h3>
          <p className="text-sm text-gray-600">
            Wprowadź kod QR aby sprawdzić przypisanie do lokalizacji
          </p>
        </div>
      </div>

      {/* QR Code Input */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <QrCode className="h-5 w-5 text-blue-600" />
            Skanowanie Kodu QR
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="qrcode">Kod QR</Label>
            <div className="flex gap-2">
              <Input
                id="qrcode"
                value={qrCode}
                onChange={(e) => setQrCode(e.target.value)}
                placeholder="Wprowadź kod QR (np. QR-001)"
                className="flex-1"
              />
              <Button onClick={handleScan} disabled={!qrCode.trim()}>
                Skanuj
              </Button>
            </div>
          </div>

          <div className="text-xs text-gray-500">
            Dostępne kody do testów: QR-001, QR-002, QR-003, QR-004, QR-005
          </div>
        </CardContent>
      </Card>

      {/* Scan Result */}
      {scanResult && (
        <Card>
          <CardContent className="pt-6">
            <Alert
              className={
                scanResult.found ? "border-green-200 bg-green-50" : "border-orange-200 bg-orange-50"
              }
            >
              <div className="flex items-start gap-2">
                {scanResult.found ? (
                  <CheckCircle className="mt-0.5 h-4 w-4 text-green-600" />
                ) : (
                  <AlertCircle className="mt-0.5 h-4 w-4 text-orange-600" />
                )}
                <div className="flex-1">
                  <AlertDescription>
                    {scanResult.message}
                    {scanResult.found && scanResult.locationId && (
                      <div className="mt-2">
                        <Badge variant="outline" className="text-xs">
                          {getLocationPath(scanResult.locationId)}
                        </Badge>
                      </div>
                    )}
                  </AlertDescription>
                  {scanResult.found && scanResult.locationId && (
                    <div className="mt-3">
                      <Button
                        onClick={handleGoToLocation}
                        className="flex items-center gap-2"
                        size="sm"
                      >
                        <MapPin className="h-4 w-4" />
                        Przejdź do lokalizacji
                      </Button>
                    </div>
                  )}
                </div>
              </div>
            </Alert>
          </CardContent>
        </Card>
      )}

      {/* Assignment Form */}
      {showAssignForm && (
        <Card>
          <CardHeader>
            <CardTitle>Przypisz Kod QR</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-3">
              <Label>Wybierz opcję:</Label>
              <div className="grid grid-cols-2 gap-3">
                <Button
                  variant={assignmentMode === "existing" ? "default" : "outline"}
                  onClick={() => setAssignmentMode("existing")}
                  className="justify-start"
                >
                  Przypisz do istniejącej
                </Button>
                <Button
                  variant={assignmentMode === "new" ? "default" : "outline"}
                  onClick={() => setAssignmentMode("new")}
                  className="justify-start"
                >
                  Utwórz nową lokalizację
                </Button>
              </div>
            </div>

            {assignmentMode === "existing" && (
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="location">Wybierz lokalizację</Label>
                  <Select value={selectedLocationId} onValueChange={setSelectedLocationId}>
                    <SelectTrigger>
                      <SelectValue placeholder="Wybierz lokalizację" />
                    </SelectTrigger>
                    <SelectContent>
                      {getAvailableLocations().map((location) => (
                        <SelectItem key={location.id} value={location.id}>
                          {getLocationPath(location.id)}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <Button
                  onClick={handleAssignToExisting}
                  disabled={!selectedLocationId}
                  className="w-full"
                >
                  Przypisz do wybranej lokalizacji
                </Button>
              </div>
            )}

            {assignmentMode === "new" && (
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="newName">Nazwa nowej lokalizacji</Label>
                  <Input
                    id="newName"
                    value={newLocationName}
                    onChange={(e) => setNewLocationName(e.target.value)}
                    placeholder="Wprowadź nazwę lokalizacji"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="newParent">Lokalizacja nadrzędna</Label>
                  <Select
                    value={newLocationParent || "no-parent"}
                    onValueChange={handleNewLocationParentChange}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Wybierz lokalizację nadrzędną (opcjonalne)" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="no-parent">Brak (główny poziom)</SelectItem>
                      {getAvailableParents().map((location) => (
                        <SelectItem key={location.id} value={location.id}>
                          {getLocationPath(location.id)}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <Button
                  onClick={handleCreateNewLocation}
                  disabled={!newLocationName.trim()}
                  className="w-full"
                >
                  Utwórz lokalizację i przypisz kod
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
