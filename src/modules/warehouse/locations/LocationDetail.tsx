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
import { useState, useEffect } from "react";
import { loadLocations } from "../api/locations";
import { Tables } from "../../../../supabase/types/types";
import { useAppContext } from "@/lib/hooks/us-app-context";

interface LocationDetailProps {
  locationId: string | null;
  onBack: () => void;
}

export function LocationDetail({ locationId, onBack }: LocationDetailProps) {
  const { activeOrgId } = useAppContext();
  const [imageModalOpen, setImageModalOpen] = useState(false);
  const [locations, setLocations] = useState<Tables<"locations">[]>([]);
  const [location, setLocation] = useState<Tables<"locations"> | null>(null);

  useEffect(() => {
    const fetchData = async () => {
      if (!activeOrgId || !locationId) return;
      const data = await loadLocations(activeOrgId);
      setLocations(data);
      setLocation(data.find((l) => l.id === locationId) || null);
    };
    fetchData();
  }, [activeOrgId, locationId]);

  if (!locationId) {
    return (
      <div className="py-8 text-center">
        <p className="text-[color:var(--font-color)]/70">Nie wybrano lokalizacji</p>
        <Button onClick={onBack} className="mt-4">
          Powrót do listy
        </Button>
      </div>
    );
  }

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

  const getLocationPath = (id: string): string => {
    const map = new Map(locations.map((l) => [l.id, l]));
    const path: string[] = [];
    let current = map.get(id);
    while (current) {
      path.unshift(current.name);
      current = current.parent_id ? map.get(current.parent_id) : undefined;
    }
    return path.join(" > ");
  };

  const locationPath = getLocationPath(locationId);

  const getLevelBadgeColor = (color?: string | null) => {
    return {
      backgroundColor:
        color || "color-mix(in srgb, var(--theme-color) 20%, white)",
      color: color ? "#fff" : "color-mix(in srgb, var(--theme-color) 90%, black)",
    } as React.CSSProperties;
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
    const iconName = location.icon_name as string | null;
    const color = location.color || "#6b7280";

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
          {location.image_url && (
            <div
              className="h-10 w-10 cursor-pointer overflow-hidden rounded-lg border-2 border-white shadow-md transition-transform hover:scale-105"
              onClick={() => setImageModalOpen(true)}
            >
              <img
                src={location.image_url}
                alt={location.name}
                className="h-full w-full object-cover"
              />
            </div>
          )}
          <div className="flex-1">
            <div className="flex items-center gap-2">
              <h3 className="text-lg font-semibold text-[color:var(--font-color)]">{location.name}</h3>
              {location.color && (
                <div
                  className="h-4 w-4 rounded-full border border-gray-300"
                  style={{ backgroundColor: location.color }}
                  title={`Kolor: ${location.color}`}
                />
              )}
            </div>
            <p className="text-sm text-[color:var(--font-color)]/70">{locationPath}</p>
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
          <div className="space-y-2">
            <div className="text-sm font-medium text-[color:var(--font-color)]/70">Typ lokalizacji</div>
            <Badge style={getLevelBadgeColor(location.color)}>
              {getLevelName(location.level)}
            </Badge>
          </div>


          {location.image_url && (
            <div className="mt-4 border-t pt-4">
              <div className="mb-2 text-sm font-medium text-[color:var(--font-color)]/70">Obraz lokalizacji:</div>
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

      <ImageModal
        open={imageModalOpen}
        onOpenChange={setImageModalOpen}
        imageUrl={location.image_url || ""}
      />
    </div>
  );
}
