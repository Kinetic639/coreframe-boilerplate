"use client";

import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Location, getAllLocationsFlat, findLocationById } from "@/lib/mockData";
import { Building, Archive, Package, Palette, Image as ImageIcon } from "lucide-react";

interface LocationModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  mode: "add" | "edit";
  location: Location | null;
  parentLocationId: string | null;
}

const availableIcons = [
  { name: "Building", icon: Building, label: "Budynek" },
  { name: "Archive", icon: Archive, label: "Archiwum/Szafa" },
  { name: "Package", icon: Package, label: "Paczka/Półka" },
];

const availableColors = [
  "#3b82f6",
  "#10b981",
  "#f59e0b",
  "#ef4444",
  "#8b5cf6",
  "#06b6d4",
  "#84cc16",
  "#f97316",
  "#ec4899",
  "#14b8a6",
  "#a855f7",
  "#6366f1",
  "#f43f5e",
  "#22c55e",
  "#eab308",
];

export function LocationModal({
  open,
  onOpenChange,
  mode,
  location,
  parentLocationId,
}: LocationModalProps) {
  const [name, setName] = useState("");
  const [selectedParentId, setSelectedParentId] = useState<string | null>(null);
  const [selectedColor, setSelectedColor] = useState<string>("#3b82f6");
  const [selectedIcon, setSelectedIcon] = useState<string>("Building");
  const [imageUrl, setImageUrl] = useState<string>("");

  useEffect(() => {
    if (mode === "edit" && location) {
      setName(location.name);
      setSelectedParentId(location.parentId);
      setSelectedColor(location.customColor || "#3b82f6");
      setSelectedIcon(location.customIcon || getDefaultIcon(location.level));
      setImageUrl(location.imageUrl || "");
    } else if (mode === "add") {
      setName("");
      setSelectedParentId(parentLocationId);
      const level = getLocationLevel();
      setSelectedColor("#3b82f6");
      setSelectedIcon(getDefaultIcon(level));
      setImageUrl("");
    }
  }, [mode, location, parentLocationId, open]);

  const getDefaultIcon = (level: number) => {
    switch (level) {
      case 1:
        return "Building";
      case 2:
        return "Archive";
      case 3:
        return "Package";
      default:
        return "Package";
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (!name.trim()) return;

    // In a real app, this would save to the backend
    if (mode === "add") {
      console.log("Add new location:", {
        name: name.trim(),
        parentId: selectedParentId,
        customColor: selectedColor,
        customIcon: selectedIcon,
        imageUrl: imageUrl.trim() || undefined,
      });
    } else {
      console.log("Update location:", {
        id: location?.id,
        name: name.trim(),
        parentId: selectedParentId,
        customColor: selectedColor,
        customIcon: selectedIcon,
        imageUrl: imageUrl.trim() || undefined,
      });
    }

    onOpenChange(false);
  };

  const getAvailableParents = () => {
    const allLocations = getAllLocationsFlat();
    return allLocations.filter((loc) => {
      // Can't be a parent of itself
      if (mode === "edit" && location && loc.id === location.id) return false;

      // Only locations up to level 2 can have children
      if (loc.level >= 3) return false;

      return true;
    });
  };

  // const getLocationLevel = () => {
  //   if (!selectedParentId) return 1;
  //   const parent = findLocationById(selectedParentId);
  //   return parent ? parent.level + 1 : 1;
  // };

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

  const handleParentChange = (value: string) => {
    const newParentId = value === "no-parent" ? null : value;
    setSelectedParentId(newParentId);

    // Auto-select appropriate icon based on level
    const level = newParentId ? (findLocationById(newParentId)?.level || 0) + 1 : 1;
    setSelectedIcon(getDefaultIcon(level));
  };

  const currentLevel = getLocationLevel();

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>
            {mode === "add" ? "Dodaj Nową Lokalizację" : "Edytuj Lokalizację"}
          </DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="space-y-2">
            <Label htmlFor="name">Nazwa lokalizacji</Label>
            <Input
              id="name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Wprowadź nazwę lokalizacji"
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="parent">Lokalizacja nadrzędna</Label>
            <Select value={selectedParentId || "no-parent"} onValueChange={handleParentChange}>
              <SelectTrigger>
                <SelectValue placeholder="Wybierz lokalizację nadrzędną (opcjonalne)" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="no-parent">Brak (główny poziom)</SelectItem>
                {getAvailableParents().map((loc) => (
                  <SelectItem key={loc.id} value={loc.id}>
                    {loc.name} ({getLevelName(loc.level)})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="rounded-lg bg-gray-50 p-3">
            <p className="text-sm text-gray-600">
              <strong>Typ lokalizacji:</strong> {getLevelName(currentLevel)}
            </p>
          </div>

          <div className="space-y-3">
            <Label className="flex items-center gap-2">
              <Palette className="h-4 w-4" />
              Kolor lokalizacji
            </Label>
            <div className="grid grid-cols-5 gap-2">
              {availableColors.map((color) => (
                <button
                  key={color}
                  type="button"
                  className={`h-10 w-10 rounded-lg border-2 transition-all ${
                    selectedColor === color
                      ? "scale-110 border-gray-900"
                      : "border-gray-300 hover:border-gray-400"
                  }`}
                  style={{ backgroundColor: color }}
                  onClick={() => setSelectedColor(color)}
                  title={color}
                />
              ))}
            </div>
            <div className="flex items-center gap-2 text-sm text-gray-600">
              <span>Wybrany kolor:</span>
              <Badge
                variant="outline"
                className="font-mono"
                style={{ backgroundColor: selectedColor, color: "white" }}
              >
                {selectedColor}
              </Badge>
            </div>
          </div>

          <div className="space-y-3">
            <Label>Ikona lokalizacji</Label>
            <div className="grid grid-cols-3 gap-2">
              {availableIcons.map(({ name, icon: Icon, label }) => (
                <button
                  key={name}
                  type="button"
                  className={`flex flex-col items-center gap-2 rounded-lg border-2 p-3 transition-all ${
                    selectedIcon === name
                      ? "border-blue-500 bg-blue-50"
                      : "border-gray-300 hover:border-gray-400"
                  }`}
                  onClick={() => setSelectedIcon(name)}
                >
                  <Icon className="h-6 w-6" style={{ color: selectedColor }} />
                  <span className="text-xs text-gray-600">{label}</span>
                </button>
              ))}
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="imageUrl" className="flex items-center gap-2">
              <ImageIcon className="h-4 w-4" />
              URL obrazu (opcjonalne)
            </Label>
            <Input
              id="imageUrl"
              value={imageUrl}
              onChange={(e) => setImageUrl(e.target.value)}
              placeholder="https://example.com/image.jpg"
              type="url"
            />
            {imageUrl && (
              <div className="mt-2">
                <div className="mb-2 text-sm text-gray-600">Podgląd:</div>
                <div className="h-20 w-20 overflow-hidden rounded-lg border">
                  <img
                    src={imageUrl}
                    alt="Podgląd"
                    className="h-full w-full object-cover"
                    onError={(e) => {
                      (e.target as HTMLImageElement).style.display = "none";
                    }}
                  />
                </div>
              </div>
            )}
          </div>

          <div className="flex justify-end gap-2 pt-4">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Anuluj
            </Button>
            <Button type="submit">{mode === "add" ? "Dodaj" : "Zapisz"}</Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
