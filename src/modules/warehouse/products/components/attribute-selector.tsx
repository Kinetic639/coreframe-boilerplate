"use client";

import * as React from "react";
import { useTranslations } from "next-intl";
import { X, Plus } from "lucide-react";

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";

import type { OptionGroupWithValues } from "../../types/option-groups";
import type { SelectedAttribute } from "../../types/product-groups";

interface AttributeSelectorProps {
  availableAttributes: OptionGroupWithValues[];
  selectedAttributes: SelectedAttribute[];
  onAttributesChange: (attributes: SelectedAttribute[]) => void;
  maxAttributes?: number;
}

export function AttributeSelector({
  availableAttributes,
  selectedAttributes,
  onAttributesChange,
  maxAttributes = 3,
}: AttributeSelectorProps) {
  const t = useTranslations("productGroups.attributes");

  const [selectedGroupId, setSelectedGroupId] = React.useState<string>("");

  // Get available option groups (not already selected)
  const availableGroups = React.useMemo(() => {
    const selectedGroupIds = selectedAttributes.map((attr) => attr.optionGroup.id);
    return availableAttributes.filter((group) => !selectedGroupIds.includes(group.id));
  }, [availableAttributes, selectedAttributes]);

  const handleAddAttribute = () => {
    if (!selectedGroupId) return;

    const optionGroup = availableAttributes.find((g) => g.id === selectedGroupId);
    if (!optionGroup) return;

    const newAttribute: SelectedAttribute = {
      optionGroup,
      selectedValueIds: [], // Start with no values selected
    };

    onAttributesChange([...selectedAttributes, newAttribute]);
    setSelectedGroupId("");
  };

  const handleRemoveAttribute = (attributeIndex: number) => {
    const updated = selectedAttributes.filter((_, index) => index !== attributeIndex);
    onAttributesChange(updated);
  };

  const handleToggleValue = (attributeIndex: number, valueId: string) => {
    const updated = [...selectedAttributes];
    const attribute = updated[attributeIndex];

    if (attribute.selectedValueIds.includes(valueId)) {
      // Remove value
      attribute.selectedValueIds = attribute.selectedValueIds.filter((id) => id !== valueId);
    } else {
      // Add value
      attribute.selectedValueIds = [...attribute.selectedValueIds, valueId];
    }

    onAttributesChange(updated);
  };

  const handleSelectAllValues = (attributeIndex: number) => {
    const updated = [...selectedAttributes];
    const attribute = updated[attributeIndex];
    attribute.selectedValueIds = attribute.optionGroup.values.map((v) => v.id);
    onAttributesChange(updated);
  };

  const handleDeselectAllValues = (attributeIndex: number) => {
    const updated = [...selectedAttributes];
    const attribute = updated[attributeIndex];
    attribute.selectedValueIds = [];
    onAttributesChange(updated);
  };

  const canAddMore = selectedAttributes.length < maxAttributes;

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t("title")}</CardTitle>
        <CardDescription>{t("description")}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Add Attribute Control */}
        {canAddMore && availableGroups.length > 0 && (
          <div className="flex items-center gap-2">
            <Select value={selectedGroupId} onValueChange={setSelectedGroupId}>
              <SelectTrigger className="flex-1">
                <SelectValue placeholder={t("selectAttribute")} />
              </SelectTrigger>
              <SelectContent>
                {availableGroups.map((group) => (
                  <SelectItem key={group.id} value={group.id}>
                    {group.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button
              type="button"
              variant="outline"
              size="icon"
              onClick={handleAddAttribute}
              disabled={!selectedGroupId}
            >
              <Plus className="h-4 w-4" />
            </Button>
          </div>
        )}

        {/* Selected Attributes */}
        {selectedAttributes.length === 0 ? (
          <div className="py-8 text-center text-muted-foreground">
            <p className="text-sm">{t("noAttributes")}</p>
            <p className="mt-1 text-xs">{t("noAttributesDescription")}</p>
          </div>
        ) : (
          <div className="space-y-4">
            {selectedAttributes.map((attribute, attributeIndex) => (
              <Card key={attribute.optionGroup.id} className="border-muted">
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-base">{attribute.optionGroup.name}</CardTitle>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      onClick={() => handleRemoveAttribute(attributeIndex)}
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
                  <CardDescription className="flex items-center gap-2 text-xs">
                    <span>
                      {attribute.selectedValueIds.length} / {attribute.optionGroup.values.length}{" "}
                      {t("selectValues")}
                    </span>
                    <span>•</span>
                    <Button
                      type="button"
                      variant="link"
                      size="sm"
                      className="h-auto p-0 text-xs"
                      onClick={() => handleSelectAllValues(attributeIndex)}
                    >
                      Select All
                    </Button>
                    <span>•</span>
                    <Button
                      type="button"
                      variant="link"
                      size="sm"
                      className="h-auto p-0 text-xs"
                      onClick={() => handleDeselectAllValues(attributeIndex)}
                    >
                      Clear
                    </Button>
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4">
                    {attribute.optionGroup.values.map((value) => {
                      const isSelected = attribute.selectedValueIds.includes(value.id);
                      return (
                        <div
                          key={value.id}
                          className="flex cursor-pointer items-center space-x-2 rounded-md border p-3 hover:bg-accent"
                          onClick={() => handleToggleValue(attributeIndex, value.id)}
                        >
                          <Checkbox
                            id={`${attribute.optionGroup.id}-${value.id}`}
                            checked={isSelected}
                            onCheckedChange={() => handleToggleValue(attributeIndex, value.id)}
                          />
                          <Label
                            htmlFor={`${attribute.optionGroup.id}-${value.id}`}
                            className="flex-1 cursor-pointer text-sm font-normal"
                          >
                            {value.value}
                          </Label>
                        </div>
                      );
                    })}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}

        {/* Max attributes reached message */}
        {!canAddMore && (
          <div className="py-2 text-center text-sm text-muted-foreground">
            Maximum {maxAttributes} attributes reached
          </div>
        )}
      </CardContent>
    </Card>
  );
}
