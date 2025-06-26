"use client";

import { useState, useEffect } from "react";
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
import { loadLocations, deleteLocation } from "../api/locations";
import { Tables } from "../../../../supabase/types/types";
import { useAppContext } from "@/lib/hooks/us-app-context";

type Location = Tables<"locations"> & {
  children?: Location[];
};
import { cn } from "@/lib/utils";

interface LocationTreeProps {
  onLocationSelect: (locationId: string) => void;
}

export function LocationTree({ onLocationSelect }: LocationTreeProps) {
  const { activeOrgId } = useAppContext();
  const [locations, setLocations] = useState<Location[]>([]);
  const [expandedNodes, setExpandedNodes] = useState<Set<string>>(new Set());
  const [modalOpen, setModalOpen] = useState(false);
  const [modalMode, setModalMode] = useState<"add" | "edit">("add");
  const [selectedLocation, setSelectedLocation] = useState<Location | null>(null);
  const [parentLocationId, setParentLocationId] = useState<string | null>(null);
  const [imageModalOpen, setImageModalOpen] = useState(false);
  const [selectedImageUrl, setSelectedImageUrl] = useState<string>("");

  useEffect(() => {
    const fetchData = async () => {
      if (!activeOrgId) return;
      const data = await loadLocations(activeOrgId);
      setLocations(buildTree(data));
    };

    fetchData();
  }, [activeOrgId]);

  const buildTree = (list: Tables<"locations">[]): Location[] => {
    const map = new Map<string, Location>();
    const roots: Location[] = [];
    list.forEach((loc) => {
      map.set(loc.id, { ...loc, children: [] });
    });
    map.forEach((loc) => {
      if (loc.parent_id) {
        const parent = map.get(loc.parent_id);
        if (parent) parent.children!.push(loc);
        else roots.push(loc);
      } else {
        roots.push(loc);
      }
    });
    return roots;
  };

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

  const handleDeleteLocation = async (location: Location) => {
    await deleteLocation(location.id);
    if (activeOrgId) {
      const data = await loadLocations(activeOrgId);
      setLocations(buildTree(data));
    }
  };

  const handleImageClick = (imageUrl: string) => {
    setSelectedImageUrl(imageUrl);
    setImageModalOpen(true);
  };

  const getLocationIcon = (location: Location) => {
    const iconName = location.icon_name as string | null;
    const color = location.color || "#6b7280";

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
    if (location.color) {
      const hex = location.color.replace("#", "");
      const r = parseInt(hex.substr(0, 2), 16);
      const g = parseInt(hex.substr(2, 2), 16);
      const b = parseInt(hex.substr(4, 2), 16);
      return {
        backgroundColor: `rgba(${r}, ${g}, ${b}, 0.1)`,
        borderColor: `rgba(${r}, ${g}, ${b}, 0.3)`,
      };
    }

    return {
      backgroundColor: "color-mix(in srgb, var(--theme-color) 10%, white)",
      borderColor: "color-mix(in srgb, var(--theme-color) 30%, white)",
    };
  };

  const renderLocationNode = (location: Location, depth: number = 0) => {
    const isExpanded = expandedNodes.has(location.id);
    const hasChildren = location.children && location.children.length > 0;
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

            {location.image_url && (
              <div
                className="h-8 w-8 cursor-pointer overflow-hidden rounded-md border-2 border-white shadow-sm transition-transform hover:scale-105"
                onClick={(e) => {
                  e.stopPropagation();
                  handleImageClick(location.image_url!);
                }}
              >
                <img
                  src={location.image_url}
                  alt={location.name}
                  className="h-full w-full object-cover"
                />
              </div>
            )}

            <div className="flex-1 cursor-pointer" onClick={() => toggleExpanded(location.id)}>
              <div className="flex items-center gap-2">
                <span className="font-medium text-[color:var(--font-color)]">{location.name}</span>
              {location.color && (
                <div
                  className="h-3 w-3 rounded-full border border-gray-300"
                    style={{ backgroundColor: location.color }}
                    title={`Kolor: ${location.color}`}
                />
              )}
              </div>
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
          <h3 className="text-lg font-semibold text-[color:var(--font-color)]">Struktura Magazynów</h3>
          <p className="text-sm text-[color:var(--font-color)]/70">
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
        locations={locations}
        onSaved={async () => {
          if (activeOrgId) {
            const data = await loadLocations(activeOrgId);
            setLocations(buildTree(data));
          }
        }}
      />

      <ImageModal
        open={imageModalOpen}
        onOpenChange={setImageModalOpen}
        imageUrl={selectedImageUrl}
      />
    </div>
  );
}
