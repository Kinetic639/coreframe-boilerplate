"use client";

import * as React from "react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Check } from "lucide-react";
import type { UnitSuggestions } from "../../types/units";

// Proper translations for unit suggestions
const UNIT_SUGGESTIONS: Record<string, UnitSuggestions> = {
  en: {
    quantity: [
      { name: "Piece", symbol: "pcs" },
      { name: "Dozen", symbol: "dz" },
      { name: "Pack", symbol: "pk" },
      { name: "Box", symbol: "box" },
      { name: "Carton", symbol: "ctn" },
      { name: "Pallet", symbol: "plt" },
      { name: "Pair", symbol: "pr" },
      { name: "Set", symbol: "set" },
    ],
    weight: [
      { name: "Kilogram", symbol: "kg" },
      { name: "Gram", symbol: "g" },
      { name: "Milligram", symbol: "mg" },
      { name: "Ton", symbol: "t" },
      { name: "Pound", symbol: "lb" },
      { name: "Ounce", symbol: "oz" },
    ],
    length: [
      { name: "Meter", symbol: "m" },
      { name: "Centimeter", symbol: "cm" },
      { name: "Millimeter", symbol: "mm" },
      { name: "Kilometer", symbol: "km" },
      { name: "Inch", symbol: "in" },
      { name: "Foot", symbol: "ft" },
      { name: "Yard", symbol: "yd" },
    ],
    volume: [
      { name: "Liter", symbol: "L" },
      { name: "Milliliter", symbol: "mL" },
      { name: "Cubic meter", symbol: "m³" },
      { name: "Gallon", symbol: "gal" },
      { name: "Fluid ounce", symbol: "fl oz" },
    ],
  },
  pl: {
    quantity: [
      { name: "Sztuka", symbol: "szt" },
      { name: "Tuzin", symbol: "tuz" },
      { name: "Opakowanie", symbol: "op" },
      { name: "Pudełko", symbol: "pud" },
      { name: "Karton", symbol: "kart" },
      { name: "Paleta", symbol: "pal" },
      { name: "Para", symbol: "pr" },
      { name: "Komplet", symbol: "kpl" },
    ],
    weight: [
      { name: "Kilogram", symbol: "kg" },
      { name: "Gram", symbol: "g" },
      { name: "Miligram", symbol: "mg" },
      { name: "Tona", symbol: "t" },
      { name: "Funt", symbol: "lb" },
    ],
    length: [
      { name: "Metr", symbol: "m" },
      { name: "Centymetr", symbol: "cm" },
      { name: "Milimetr", symbol: "mm" },
      { name: "Kilometr", symbol: "km" },
      { name: "Cal", symbol: "cal" },
    ],
    volume: [
      { name: "Litr", symbol: "L" },
      { name: "Mililitr", symbol: "mL" },
      { name: "Metr sześcienny", symbol: "m³" },
      { name: "Galon", symbol: "gal" },
    ],
  },
};

interface AddUnitDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (data: { name: string; symbol?: string }) => Promise<void>;
  existingUnits: Array<{ name: string; symbol?: string | null }>;
}

export function AddUnitDialog({ open, onOpenChange, onSubmit, existingUnits }: AddUnitDialogProps) {
  const [selectedLang, setSelectedLang] = React.useState<"en" | "pl">("pl");
  const [addedUnits, setAddedUnits] = React.useState<Set<string>>(new Set());

  const suggestions = UNIT_SUGGESTIONS[selectedLang];

  // Check if unit already exists
  const isUnitExists = (name: string) => {
    return existingUnits.some((u) => u.name.toLowerCase() === name.toLowerCase());
  };

  // Quick add unit - don't close dialog
  async function quickAddUnit(unit: { name: string; symbol: string }) {
    if (isUnitExists(unit.name)) return;

    try {
      // Mark as being added immediately to prevent double-clicks
      setAddedUnits((prev) => new Set(prev).add(unit.name));
      await onSubmit(unit);
    } catch (error) {
      console.error("Failed to add unit:", error);
      // Remove from added if failed
      setAddedUnits((prev) => {
        const newSet = new Set(prev);
        newSet.delete(unit.name);
        return newSet;
      });
    }
  }

  // Reset state when dialog closes
  React.useEffect(() => {
    if (!open) {
      setAddedUnits(new Set());
    }
  }, [open]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex max-h-[85vh] max-w-3xl flex-col gap-0 p-0">
        <DialogHeader className="flex-shrink-0 border-b px-6 pb-4 pt-6">
          <DialogTitle className="text-lg font-medium">Quick Pick Units</DialogTitle>
          <DialogDescription className="text-sm">
            Select from common units to quickly add them
          </DialogDescription>
        </DialogHeader>

        <div className="min-h-0 flex-1 overflow-y-auto px-6 py-4">
          {/* Language Selector */}
          <div className="mb-4">
            <Label className="text-xs font-medium">Language</Label>
            <Select value={selectedLang} onValueChange={(v) => setSelectedLang(v as "en" | "pl")}>
              <SelectTrigger className="h-8 w-32 text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="en">English</SelectItem>
                <SelectItem value="pl">Polish</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Quick Pick Grid */}
          <div className="space-y-3">
            {Object.entries(suggestions).map(([type, units]) => (
              <div key={type}>
                <h4 className="mb-1.5 text-[10px] font-medium uppercase text-muted-foreground">
                  {type}
                </h4>
                <div className="grid grid-cols-4 gap-1.5">
                  {units.map((unit) => {
                    const exists = isUnitExists(unit.name);
                    const added = addedUnits.has(unit.name);

                    return (
                      <button
                        key={unit.symbol}
                        onClick={() => !exists && quickAddUnit(unit)}
                        disabled={exists || added}
                        className={`
                          relative rounded border px-2 py-1.5 text-left
                          transition-colors
                          ${
                            exists || added
                              ? "cursor-not-allowed border-muted bg-muted/50 opacity-60"
                              : "cursor-pointer hover:border-accent-foreground hover:bg-accent"
                          }
                        `}
                      >
                        <div className="text-xs font-medium leading-tight">{unit.name}</div>
                        <div className="text-[10px] leading-tight text-muted-foreground">
                          {unit.symbol}
                        </div>
                        {(exists || added) && (
                          <div className="absolute right-0.5 top-0.5">
                            <Check className="h-2.5 w-2.5 text-green-600" />
                          </div>
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        </div>

        <DialogFooter className="flex-shrink-0 border-t px-6 py-4">
          <Button variant="outline" onClick={() => onOpenChange(false)} size="sm">
            Done
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
