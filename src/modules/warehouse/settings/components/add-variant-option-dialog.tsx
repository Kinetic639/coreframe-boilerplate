"use client";

import * as React from "react";
import { Button } from "@/components/ui/button";
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
import type { VariantOptionGroup } from "../../types/variant-options";
import { useTranslations } from "next-intl";

interface OptionGroupPreset {
  name: string;
  description: string;
  values: string[];
}

interface OptionGroupPresets {
  dimensions: OptionGroupPreset;
  size: OptionGroupPreset;
  color: OptionGroupPreset;
  coating: OptionGroupPreset;
  panType: OptionGroupPreset;
  storageCapacity: OptionGroupPreset;
  material: OptionGroupPreset;
  weight: OptionGroupPreset;
}

const PRESET_GROUPS: Record<string, OptionGroupPresets> = {
  en: {
    dimensions: {
      name: "Dimensions",
      description: "Product dimensions",
      values: ['1"x4"x8\'', '2"x4"x8\'', '2"x6"x8\'', '4"x4"x10\''],
    },
    size: {
      name: "Size",
      description: "Clothing or product sizes",
      values: ["XS", "S", "M", "L", "XL", "XXL"],
    },
    color: {
      name: "Color",
      description: "Product colors",
      values: ["Red", "Blue", "Green", "Black", "White", "Gray"],
    },
    coating: {
      name: "Coating",
      description: "Surface coating type",
      values: ["Regular", "Non-Stick"],
    },
    panType: {
      name: "Pan Type",
      description: "Types of pans",
      values: [
        '10" Sautee Pan',
        "20 cm Sautee Pan",
        "8 QT Clad Stock Pot",
        "20 cm 3 L Sauce Pan",
        "16 cm 1.7 L Sauce Pan",
      ],
    },
    storageCapacity: {
      name: "Storage Capacity",
      description: "Storage or memory capacity",
      values: ["256GB", "512GB", "1TB", "2TB"],
    },
    material: {
      name: "Material",
      description: "Product material",
      values: ["Wood", "Metal", "Plastic", "Glass", "Fabric"],
    },
    weight: {
      name: "Weight",
      description: "Product weight ranges",
      values: ["Light", "Medium", "Heavy"],
    },
  },
  pl: {
    dimensions: {
      name: "Wymiary",
      description: "Wymiary produktu",
      values: ['1"x4"x8\'', '2"x4"x8\'', '2"x6"x8\'', '4"x4"x10\''],
    },
    size: {
      name: "Rozmiar",
      description: "Rozmiary odzieży lub produktu",
      values: ["XS", "S", "M", "L", "XL", "XXL"],
    },
    color: {
      name: "Kolor",
      description: "Kolory produktu",
      values: ["Czerwony", "Niebieski", "Zielony", "Czarny", "Biały", "Szary"],
    },
    coating: {
      name: "Powłoka",
      description: "Typ powłoki powierzchni",
      values: ["Standardowa", "Nieprzywierająca"],
    },
    panType: {
      name: "Typ patelni",
      description: "Rodzaje patelni",
      values: [
        'Patelnia 10"',
        "Patelnia 20 cm",
        "Garnek 8 QT",
        "Rondel 20 cm 3 L",
        "Rondel 16 cm 1.7 L",
      ],
    },
    storageCapacity: {
      name: "Pojemność pamięci",
      description: "Pojemność pamięci masowej",
      values: ["256GB", "512GB", "1TB", "2TB"],
    },
    material: {
      name: "Materiał",
      description: "Materiał produktu",
      values: ["Drewno", "Metal", "Plastik", "Szkło", "Tkanina"],
    },
    weight: {
      name: "Waga",
      description: "Zakresy wagi produktu",
      values: ["Lekki", "Średni", "Ciężki"],
    },
  },
};

interface AddVariantOptionDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (data: { name: string; description?: string; values?: string[] }) => Promise<void>;
  existingGroups: VariantOptionGroup[];
}

export function AddVariantOptionDialog({
  open,
  onOpenChange,
  onSubmit,
  existingGroups,
}: AddVariantOptionDialogProps) {
  const t = useTranslations("modules.warehouse.items.settings.variantOptions.quickPick");
  const [selectedLang, setSelectedLang] = React.useState<"en" | "pl">("pl");
  const [addedGroups, setAddedGroups] = React.useState<Set<string>>(new Set());

  const presets = PRESET_GROUPS[selectedLang];

  const isGroupExists = (name: string) => {
    return existingGroups.some((g) => g.name.toLowerCase() === name.toLowerCase());
  };

  async function quickAddGroup(preset: OptionGroupPreset) {
    if (isGroupExists(preset.name)) return;

    try {
      setAddedGroups((prev) => new Set(prev).add(preset.name));
      await onSubmit({
        name: preset.name,
        description: preset.description,
        values: preset.values,
      });
    } catch (error) {
      console.error("Failed to add group:", error);
      setAddedGroups((prev) => {
        const newSet = new Set(prev);
        newSet.delete(preset.name);
        return newSet;
      });
    }
  }

  React.useEffect(() => {
    if (!open) {
      setAddedGroups(new Set());
    }
  }, [open]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex max-h-[85vh] max-w-3xl flex-col gap-0 p-0">
        <DialogHeader className="flex-shrink-0 border-b px-6 pb-4 pt-6">
          <DialogTitle className="text-lg font-medium">{t("title")}</DialogTitle>
          <DialogDescription className="text-sm">{t("description")}</DialogDescription>
        </DialogHeader>

        <div className="min-h-0 flex-1 overflow-y-auto px-6 py-4">
          {/* Language Selector */}
          <div className="mb-4">
            <label className="text-xs font-medium">{t("language")}</label>
            <Select value={selectedLang} onValueChange={(v) => setSelectedLang(v as "en" | "pl")}>
              <SelectTrigger className="h-8 w-32 text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="en">English</SelectItem>
                <SelectItem value="pl">Polski</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Preset Groups Grid */}
          <div className="grid grid-cols-2 gap-2">
            {Object.entries(presets).map(([key, preset]) => {
              const exists = isGroupExists(preset.name);
              const added = addedGroups.has(preset.name);

              return (
                <button
                  key={key}
                  onClick={() => !exists && quickAddGroup(preset)}
                  disabled={exists || added}
                  className={`
                    relative rounded-md border px-3 py-2.5 text-left
                    transition-colors
                    ${
                      exists || added
                        ? "cursor-not-allowed border-muted bg-muted/50 opacity-60"
                        : "cursor-pointer hover:border-accent-foreground hover:bg-accent"
                    }
                  `}
                >
                  <div className="text-sm font-medium leading-tight">{preset.name}</div>
                  <div className="mt-0.5 text-xs leading-tight text-muted-foreground">
                    {preset.description}
                  </div>
                  <div className="mt-1.5 text-xs text-muted-foreground">
                    {preset.values.length} {t("valuesCount")}
                  </div>
                  {/* Display preset values */}
                  <div className="mt-2 flex flex-wrap gap-1">
                    {preset.values.slice(0, 6).map((value, idx) => (
                      <span
                        key={idx}
                        className="inline-block rounded border bg-background px-1.5 py-0.5 text-[10px]"
                      >
                        {value}
                      </span>
                    ))}
                    {preset.values.length > 6 && (
                      <span className="inline-block px-1.5 py-0.5 text-[10px] text-muted-foreground">
                        +{preset.values.length - 6}
                      </span>
                    )}
                  </div>
                  {(exists || added) && (
                    <div className="absolute right-2 top-2">
                      <Check className="h-3 w-3 text-green-600" />
                    </div>
                  )}
                </button>
              );
            })}
          </div>
        </div>

        <DialogFooter className="flex-shrink-0 border-t px-6 py-4">
          <Button variant="outline" onClick={() => onOpenChange(false)} size="sm">
            {t("done")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
