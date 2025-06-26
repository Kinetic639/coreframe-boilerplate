"use client";

import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { QrCode, MapPin } from "lucide-react";
import { LocationTree } from "./LocationTree";
import { QRScanner } from "./QRScanner";
import { LocationDetail } from "./LocationDetail";

type View = "tree" | "qr" | "detail";

export function LocationManager() {
  const [currentView, setCurrentView] = useState<View>("tree");
  const [selectedLocationId, setSelectedLocationId] = useState<string | null>(null);

  const handleLocationSelect = (locationId: string) => {
    setSelectedLocationId(locationId);
    setCurrentView("detail");
  };

  const handleQRScan = (locationId: string) => {
    setSelectedLocationId(locationId);
    setCurrentView("detail");
  };

  const renderContent = () => {
    switch (currentView) {
      case "tree":
        return <LocationTree onLocationSelect={handleLocationSelect} />;
      case "qr":
        return <QRScanner onLocationFound={handleQRScan} onBack={() => setCurrentView("tree")} />;
      case "detail":
        return (
          <LocationDetail locationId={selectedLocationId} onBack={() => setCurrentView("tree")} />
        );
      default:
        return <LocationTree onLocationSelect={handleLocationSelect} />;
    }
  };

  return (
    <div className="space-y-6">
      {/* Navigation */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              <MapPin className="h-5 w-5 text-blue-600" />
              {currentView === "tree" && "Drzewo Lokalizacji"}
              {currentView === "qr" && "Skaner Kodów QR"}
              {currentView === "detail" && "Szczegóły Lokalizacji"}
            </CardTitle>
            <div className="flex gap-2">
              <Button
                variant={currentView === "tree" ? "default" : "outline"}
                onClick={() => setCurrentView("tree")}
                className="flex items-center gap-2"
              >
                <MapPin className="h-4 w-4" />
                Lokalizacje
              </Button>
              <Button
                variant={currentView === "qr" ? "default" : "outline"}
                onClick={() => setCurrentView("qr")}
                className="flex items-center gap-2"
              >
                <QrCode className="h-4 w-4" />
                Skaner QR
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>{renderContent()}</CardContent>
      </Card>
    </div>
  );
}
