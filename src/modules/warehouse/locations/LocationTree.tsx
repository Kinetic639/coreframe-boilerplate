"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  ChevronDown,
  ChevronRight,
  Plus,
  Edit,
  Trash2,
  Building,
  Archive,
  Package,
  Eye,
} from "lucide-react";
import { LocationModal } from "./LocationModal";
import { ImageModal } from "./ImageModal";
import { locations, Location, getTotalProductCountForLocation } from "@/lib/mockData";
import { cn } from "@/lib/utils";

interface LocationTreeProps {
  onLocationSelect: (locationId: string) => void;
}

export function LocationTree({ onLocationSelect }: LocationTreeProps) {
  const [expandedNodes, setExpandedNodes] = useState<Set<string>>(new Set(["w1", "w2"]));
  const [modalOpen, setModalOpen] = useState(false);
  const [modalMode, setModalMode] = useState<"add" | "edit">("add");
  const [selectedLocation, setSelectedLocation] = useState<Location | null>(null);
  const [parentLocationId, setParentLocationId] = useState<string | null>(null);
  const [imageModalOpen, setImageModalOpen] = useState(false);
  const [selectedImageUrl, setSelectedImageUrl] = useState<string>("");

  const toggleExpanded = (nodeId: string) => {
    const newExpanded = new Set(expandedNodes);
    if (newExpanded.has(nodeId)) {
      newExpanded.delete(nodeId);
    } else {
      newExpanded.add(nodeId);
    }
    setExpandedNodes(newExpanded);
  };

  const handleAddLocation = (parentId: string | null = null) => {
    setModalMode("add");
    setParentLocationId(parentId);
    setSelectedLocation(null);
    setModalOpen(true);
  };

  const handleEditLocation = (location: Location) => {
    setModalMode("edit");
    setSelectedLocation(location);
    setParentLocationId(null);
    setModalOpen(true);
  };

  const handleDeleteLocation = (location: Location) => {
    // In a real app, this would delete from the backend
    console.log("Delete location:", location.id);
    // For demo purposes, just log
  };

  const handleImageClick = (imageUrl: string) => {
    setSelectedImageUrl(imageUrl);
    setImageModalOpen(true);
  };

  const getLocationIcon = (location: Location) => {
    const iconName = location.customIcon;
    const color = location.customColor || "#6b7280";

    const iconProps = {
      className: "h-4 w-4",
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

  const getLevelColor = (location: Location) => {
    if (location.customColor) {
      // Convert hex to RGB for background opacity
      const hex = location.customColor.replace("#", "");
      const r = parseInt(hex.substr(0, 2), 16);
      const g = parseInt(hex.substr(2, 2), 16);
      const b = parseInt(hex.substr(4, 2), 16);
      return {
        backgroundColor: `rgba(${r}, ${g}, ${b}, 0.1)`,
        borderColor: `rgba(${r}, ${g}, ${b}, 0.3)`,
      };
    }

    switch (location.level) {
      case 1:
        return { backgroundColor: "rgb(239 246 255)", borderColor: "rgb(191 219 254)" };
      case 2:
        return { backgroundColor: "rgb(240 253 244)", borderColor: "rgb(187 247 208)" };
      case 3:
        return { backgroundColor: "rgb(255 247 237)", borderColor: "rgb(254 215 170)" };
      default:
        return { backgroundColor: "rgb(249 250 251)", borderColor: "rgb(229 231 235)" };
    }
  };

  const renderLocationNode = (location: Location, depth: number = 0) => {
    const isExpanded = expandedNodes.has(location.id);
    const hasChildren = location.children && location.children.length > 0;
    const totalProductCount = getTotalProductCountForLocation(location.id);
    const levelColors = getLevelColor(location);

    return (
      <div key={location.id} className="space-y-2">
        <div
          className={cn(
            "flex items-center justify-between rounded-lg border p-3 transition-all duration-200 hover:shadow-md"
          )}
          style={{
            marginLeft: `${depth * 24}px`,
            backgroundColor: levelColors.backgroundColor,
            borderColor: levelColors.borderColor,
          }}
        >
          <div className="flex flex-1 items-center gap-3">
            {hasChildren ? (
              <Button
                variant="ghost"
                size="sm"
                className="h-6 w-6 p-0 hover:bg-white/50"
                onClick={() => toggleExpanded(location.id)}
              >
                {isExpanded ? (
                  <ChevronDown className="h-3 w-3" />
                ) : (
                  <ChevronRight className="h-3 w-3" />
                )}
              </Button>
            ) : (
              <div className="w-6" />
            )}

            {getLocationIcon(location)}

            {location.imageUrl && (
              <div
                className="h-8 w-8 cursor-pointer overflow-hidden rounded-md border-2 border-white shadow-sm transition-transform hover:scale-105"
                onClick={(e) => {
                  e.stopPropagation();
                  handleImageClick(location.imageUrl!);
                }}
              >
                <img
                  src={location.imageUrl}
                  alt={location.name}
                  className="h-full w-full object-cover"
                />
              </div>
            )}

            <div className="flex-1 cursor-pointer" onClick={() => toggleExpanded(location.id)}>
              <div className="flex items-center gap-2">
                <span className="font-medium text-gray-900">{location.name}</span>
                {location.customColor && (
                  <div
                    className="h-3 w-3 rounded-full border border-gray-300"
                    style={{ backgroundColor: location.customColor }}
                    title={`Kolor: ${location.customColor}`}
                  />
                )}
              </div>
              {totalProductCount > 0 && (
                <Badge variant="secondary" className="mt-1 text-xs">
                  {totalProductCount} {totalProductCount === 1 ? "produkt" : "produktów"}
                  {hasChildren && " (łącznie)"}
                </Badge>
              )}
            </div>
          </div>

          <div className="flex items-center gap-1">
            <Button
              variant="ghost"
              size="sm"
              className="h-7 w-7 p-0 hover:bg-blue-100 hover:text-blue-600"
              onClick={(e) => {
                e.stopPropagation();
                onLocationSelect(location.id);
              }}
              title="Zobacz szczegóły lokalizacji"
            >
              <Eye className="h-3 w-3" />
            </Button>
            {location.level < 3 && (
              <Button
                variant="ghost"
                size="sm"
                className="h-7 w-7 p-0 hover:bg-white/70"
                onClick={(e) => {
                  e.stopPropagation();
                  handleAddLocation(location.id);
                }}
                title="Dodaj podlokalizację"
              >
                <Plus className="h-3 w-3" />
              </Button>
            )}
            <Button
              variant="ghost"
              size="sm"
              className="h-7 w-7 p-0 hover:bg-white/70"
              onClick={(e) => {
                e.stopPropagation();
                handleEditLocation(location);
              }}
              title="Edytuj lokalizację"
            >
              <Edit className="h-3 w-3" />
            </Button>
            <Button
              variant="ghost"
              size="sm"
              className="h-7 w-7 p-0 hover:bg-red-100 hover:text-red-600"
              onClick={(e) => {
                e.stopPropagation();
                handleDeleteLocation(location);
              }}
              title="Usuń lokalizację"
            >
              <Trash2 className="h-3 w-3" />
            </Button>
          </div>
        </div>

        {hasChildren && isExpanded && (
          <div className="space-y-2">
            {location.children!.map((child) => renderLocationNode(child, depth + 1))}
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold text-gray-900">Struktura Magazynów</h3>
          <p className="text-sm text-gray-600">
            Kliknij na nazwę lokalizacji aby rozwinąć/zwinąć, użyj przycisku oka aby zobaczyć
            szczegóły
          </p>
        </div>
        <Button onClick={() => handleAddLocation()} className="flex items-center gap-2">
          <Plus className="h-4 w-4" />
          Dodaj Magazyn
        </Button>
      </div>

      <div className="space-y-3">{locations.map((location) => renderLocationNode(location))}</div>

      <LocationModal
        open={modalOpen}
        onOpenChange={setModalOpen}
        mode={modalMode}
        location={selectedLocation}
        parentLocationId={parentLocationId}
      />

      <ImageModal
        open={imageModalOpen}
        onOpenChange={setImageModalOpen}
        imageUrl={selectedImageUrl}
      />
    </div>
  );
}
