"use client";

// =============================================
// Movement Type Selector Component
// Phase 2: UI Component for selecting movement types
// Implements best practices with proper error handling and performance
// =============================================

import { useEffect, useState, useMemo } from "react";
import { useLocale, useTranslations } from "next-intl";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { movementTypesService } from "../api/movement-types-service";
import type { MovementType, MovementCategory } from "../types/movement-types";
import { MOVEMENT_CATEGORY_LABELS } from "../types/movement-types";

interface MovementTypeSelectorProps {
  value?: string;
  onChange: (code: string, movementType: MovementType | null) => void;
  category?: MovementCategory;
  allowManualEntryOnly?: boolean;
  disabled?: boolean;
  placeholder?: string;
  className?: string;
}

/**
 * Movement Type Selector Component
 * Displays movement types grouped by category with localized labels
 */
export function MovementTypeSelector({
  value,
  onChange,
  category,
  allowManualEntryOnly = false,
  disabled = false,
  placeholder,
  className,
}: MovementTypeSelectorProps) {
  const t = useTranslations("warehouse.movements");
  const locale = useLocale() as "pl" | "en";

  const [movementTypes, setMovementTypes] = useState<MovementType[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Fetch movement types
  useEffect(() => {
    const fetchMovementTypes = async () => {
      try {
        setLoading(true);
        setError(null);

        const filters = {
          category,
          allows_manual_entry: allowManualEntryOnly ? true : undefined,
        };

        const types = await movementTypesService.getMovementTypes(filters);
        setMovementTypes(types);
      } catch (err) {
        const error = err as Error;
        setError(error.message);
        console.error("Error fetching movement types:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchMovementTypes();
  }, [category, allowManualEntryOnly]);

  // Group movement types by category for display
  const groupedTypes = useMemo(() => {
    const groups: Record<MovementCategory, MovementType[]> = {
      receipt: [],
      issue: [],
      transfer: [],
      adjustment: [],
      reservation: [],
      ecommerce: [],
    };

    movementTypes.forEach((type) => {
      if (type.category) {
        groups[type.category].push(type);
      }
    });

    return groups;
  }, [movementTypes]);

  // Handle selection change
  const handleValueChange = (code: string) => {
    const selectedType = movementTypes.find((t) => t.code === code) || null;
    onChange(code, selectedType);
  };

  // Get localized name for movement type
  const getLocalizedName = (type: MovementType): string => {
    if (locale === "pl" && type.name_pl) {
      return type.name_pl;
    }
    if (locale === "en" && type.name_en) {
      return type.name_en;
    }
    return type.name;
  };

  if (loading) {
    return (
      <Select disabled>
        <SelectTrigger className={className}>
          <SelectValue placeholder={t("loadingTypes")} />
        </SelectTrigger>
      </Select>
    );
  }

  if (error) {
    return (
      <Select disabled>
        <SelectTrigger className={className}>
          <SelectValue placeholder={t("errorLoadingTypes")} />
        </SelectTrigger>
      </Select>
    );
  }

  return (
    <Select value={value} onValueChange={handleValueChange} disabled={disabled}>
      <SelectTrigger className={className}>
        <SelectValue placeholder={placeholder || t("selectMovementType")} />
      </SelectTrigger>
      <SelectContent>
        {Object.entries(groupedTypes).map(([cat, types]) => {
          if (types.length === 0) return null;

          const categoryKey = cat as MovementCategory;
          const categoryLabel = MOVEMENT_CATEGORY_LABELS[categoryKey];

          return (
            <SelectGroup key={cat}>
              <SelectLabel className="flex items-center gap-2">
                {locale === "pl" ? categoryLabel.pl : categoryLabel.en}
                <Badge variant="outline" className="ml-auto">
                  {types.length}
                </Badge>
              </SelectLabel>
              {types.map((type) => (
                <SelectItem key={type.code} value={type.code}>
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-xs text-muted-foreground">{type.code}</span>
                    <span>{getLocalizedName(type)}</span>
                    {type.polish_document_type && (
                      <Badge variant="secondary" className="ml-auto text-xs">
                        {type.polish_document_type}
                      </Badge>
                    )}
                  </div>
                </SelectItem>
              ))}
            </SelectGroup>
          );
        })}
      </SelectContent>
    </Select>
  );
}
