"use client";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  ArrowLeft,
  MapPin,
  Package,
  QrCode,
  Building,
  Archive,
  Image as ImageIcon,
} from "lucide-react";
import { ProductList } from "./ProductList";
import { ImageModal } from "./ImageModal";
import { useState } from "react";
import {
  findLocationById,
  getLocationPath,
  getTotalProductCountForLocation,
  getProductsByLocationId,
  qrCodes,
} from "@/lib/mockData";

interface LocationDetailProps {
  locationId: string | null;
  onBack: () => void;
}

export function LocationDetail({ locationId, onBack }: LocationDetailProps) {
  const [imageModalOpen, setImageModalOpen] = useState(false);

  if (!locationId) {
    return (
      <div className="py-8 text-center">
        <p className="text-gray-500">Nie wybrano lokalizacji</p>
        <Button onClick={onBack} className="mt-4">
          Powrót do listy
        </Button>
      </div>
    );
  }

  const location = findLocationById(locationId);
  if (!location) {
    return (
      <div className="py-8 text-center">
        <p className="text-red-500">Lokalizacja nie została znaleziona</p>
        <Button onClick={onBack} className="mt-4">
          Powrót do listy
        </Button>
      </div>
    );
  }

  const locationPath = getLocationPath(locationId);
  const directProducts = getProductsByLocationId(locationId);
  const totalProductCount = getTotalProductCountForLocation(locationId);
  const assignedQRCodes = qrCodes.filter((qr) => qr.assignedLocationId === locationId);

  const getLevelBadgeColor = (level: number) => {
    switch (level) {
      case 1:
        return "bg-blue-100 text-blue-800";
      case 2:
        return "bg-green-100 text-green-800";
      case 3:
        return "bg-orange-100 text-orange-800";
      default:
        return "bg-gray-100 text-gray-800";
    }
  };

  const getLevelName = (level: number) => {
    switch (level) {
      case 1:
        return "Magazyn";
      case 2:
        return "Szafa/Regał";
      case 3:
        return "Półka";
      default:
        return "Lokalizacja";
    }
  };

  const getLocationIcon = () => {
    const iconName = location.customIcon;
    const color = location.customColor || "#6b7280";

    const iconProps = {
      className: "h-5 w-5",
      style: { color },
    };

    switch (iconName) {
      case "Building":
        return <Building {...iconProps} />;
      case "Archive":
        return <Archive {...iconProps} />;
      case "Package":
        return <Package {...iconProps} />;
      default:
        switch (location.level) {
          case 1:
            return <Building {...iconProps} />;
          case 2:
            return <Archive {...iconProps} />;
          case 3:
            return <Package {...iconProps} />;
          default:
            return <Package {...iconProps} />;
        }
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Button variant="outline" onClick={onBack} className="flex items-center gap-2">
          <ArrowLeft className="h-4 w-4" />
          Powrót
        </Button>
        <div className="flex flex-1 items-center gap-3">
          {getLocationIcon()}
          {location.imageUrl && (
            <div
              className="h-10 w-10 cursor-pointer overflow-hidden rounded-lg border-2 border-white shadow-md transition-transform hover:scale-105"
              onClick={() => setImageModalOpen(true)}
            >
              <img
                src={location.imageUrl}
                alt={location.name}
                className="h-full w-full object-cover"
              />
            </div>
          )}
          <div className="flex-1">
            <div className="flex items-center gap-2">
              <h3 className="text-lg font-semibold text-gray-900">{location.name}</h3>
              {location.customColor && (
                <div
                  className="h-4 w-4 rounded-full border border-gray-300"
                  style={{ backgroundColor: location.customColor }}
                  title={`Kolor: ${location.customColor}`}
                />
              )}
            </div>
            <p className="text-sm text-gray-600">{locationPath}</p>
          </div>
        </div>
      </div>

      {/* Location Info */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <MapPin className="h-5 w-5 text-blue-600" />
            Informacje o Lokalizacji
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-4">
            <div className="space-y-2">
              <div className="text-sm font-medium text-gray-500">Typ lokalizacji</div>
              <Badge className={getLevelBadgeColor(location.level)}>
                {getLevelName(location.level)}
              </Badge>
            </div>

            <div className="space-y-2">
              <div className="text-sm font-medium text-gray-500">Produkty bezpośrednie</div>
              <div className="flex items-center gap-2">
                <Package className="h-4 w-4 text-gray-400" />
                <span className="font-semibold">{directProducts.length}</span>
              </div>
            </div>

            <div className="space-y-2">
              <div className="text-sm font-medium text-gray-500">Produkty łącznie</div>
              <div className="flex items-center gap-2">
                <Package className="h-4 w-4 text-blue-400" />
                <span className="font-semibold text-blue-600">{totalProductCount}</span>
              </div>
            </div>

            <div className="space-y-2">
              <div className="text-sm font-medium text-gray-500">Przypisane kody QR</div>
              <div className="flex items-center gap-2">
                <QrCode className="h-4 w-4 text-gray-400" />
                <span className="font-semibold">{assignedQRCodes.length}</span>
              </div>
            </div>
          </div>

          {assignedQRCodes.length > 0 && (
            <div className="mt-4 border-t pt-4">
              <div className="mb-2 text-sm font-medium text-gray-500">Kody QR:</div>
              <div className="flex flex-wrap gap-2">
                {assignedQRCodes.map((qr) => (
                  <Badge key={qr.id} variant="outline" className="font-mono">
                    {qr.id}
                  </Badge>
                ))}
              </div>
            </div>
          )}

          {location.imageUrl && (
            <div className="mt-4 border-t pt-4">
              <div className="mb-2 text-sm font-medium text-gray-500">Obraz lokalizacji:</div>
              <Button
                variant="outline"
                onClick={() => setImageModalOpen(true)}
                className="flex items-center gap-2"
              >
                <ImageIcon className="h-4 w-4" />
                Zobacz pełny rozmiar
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Products */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Package className="h-5 w-5 text-green-600" />
            Produkty w tej lokalizacji
            {totalProductCount > directProducts.length && (
              <Badge variant="secondary" className="ml-2">
                {directProducts.length} bezpośrednich z {totalProductCount} łącznie
              </Badge>
            )}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {directProducts.length > 0 ? (
            <ProductList products={directProducts} />
          ) : (
            <div className="py-8 text-center text-gray-500">
              <Package className="mx-auto mb-3 h-12 w-12 opacity-50" />
              <p>Brak produktów bezpośrednio w tej lokalizacji</p>
              {totalProductCount > 0 && (
                <p className="mt-1 text-sm">
                  Ale znajduje się {totalProductCount} produktów w podlokalizacjach
                </p>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      <ImageModal
        open={imageModalOpen}
        onOpenChange={setImageModalOpen}
        imageUrl={location.imageUrl || ""}
      />
    </div>
  );
}
