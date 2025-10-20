"use client";

import * as React from "react";
import { useTranslations } from "next-intl";
import { Wand2, Trash2 } from "lucide-react";

import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

import type { GeneratedVariant } from "../../types/product-groups";

interface VariantsBulkEditorProps {
  variants: GeneratedVariant[];
  onVariantsChange: (variants: GeneratedVariant[]) => void;
  onOpenSKUGenerator: () => void;
}

export function VariantsBulkEditor({
  variants,
  onVariantsChange,
  onOpenSKUGenerator,
}: VariantsBulkEditorProps) {
  const t = useTranslations("productGroups.variantsTable");

  const [editingVariantIndex, setEditingVariantIndex] = React.useState<number | null>(null);
  const [selectedVariantIndices, setSelectedVariantIndices] = React.useState<number[]>([]);

  const handleUpdateVariant = (index: number, field: keyof GeneratedVariant, value: unknown) => {
    const updated = [...variants];
    updated[index] = { ...updated[index], [field]: value };
    onVariantsChange(updated);
  };

  const handleToggleVariantActive = (index: number) => {
    handleUpdateVariant(index, "isActive", !variants[index].isActive);
  };

  const handleDeleteVariant = (index: number) => {
    const updated = variants.filter((_, i) => i !== index);
    onVariantsChange(updated);
  };

  const handleSelectVariant = (index: number) => {
    if (selectedVariantIndices.includes(index)) {
      setSelectedVariantIndices(selectedVariantIndices.filter((i) => i !== index));
    } else {
      setSelectedVariantIndices([...selectedVariantIndices, index]);
    }
  };

  const handleSelectAll = () => {
    if (selectedVariantIndices.length === variants.length) {
      setSelectedVariantIndices([]);
    } else {
      setSelectedVariantIndices(variants.map((_, index) => index));
    }
  };

  const handleBulkUpdatePrice = (field: "sellingPrice" | "costPrice" | "reorderPoint") => {
    if (selectedVariantIndices.length === 0) return;

    const value = prompt(`Enter new ${field} for ${selectedVariantIndices.length} variants:`);
    if (value === null) return;

    const numValue = parseFloat(value);
    if (isNaN(numValue)) return;

    const updated = [...variants];
    selectedVariantIndices.forEach((index) => {
      updated[index] = { ...updated[index], [field]: numValue };
    });

    onVariantsChange(updated);
    setSelectedVariantIndices([]);
  };

  if (variants.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>{t("title")}</CardTitle>
          <CardDescription>{t("description")}</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="py-8 text-center text-muted-foreground">
            <p className="text-sm">{t("noVariants")}</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle>{t("title")}</CardTitle>
            <CardDescription>
              {variants.length} {t("description")}
            </CardDescription>
          </div>
          <div className="flex items-center gap-2">
            {selectedVariantIndices.length > 0 && (
              <div className="flex items-center gap-2">
                <Badge variant="secondary">{selectedVariantIndices.length} selected</Badge>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => handleBulkUpdatePrice("sellingPrice")}
                >
                  {t("copyToAll")} Price
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => handleBulkUpdatePrice("costPrice")}
                >
                  {t("copyToAll")} Cost
                </Button>
              </div>
            )}
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={onOpenSKUGenerator}
              className="gap-2"
            >
              <Wand2 className="h-4 w-4" />
              Configure SKU Pattern
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <div className="rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-12">
                  <Checkbox
                    checked={selectedVariantIndices.length === variants.length}
                    onCheckedChange={handleSelectAll}
                  />
                </TableHead>
                <TableHead>{t("variantName")}</TableHead>
                <TableHead>{t("sku")}</TableHead>
                <TableHead>{t("attributes")}</TableHead>
                <TableHead className="text-right">{t("sellingPrice")}</TableHead>
                <TableHead className="text-right">{t("costPrice")}</TableHead>
                <TableHead className="text-right">{t("reorderPoint")}</TableHead>
                <TableHead className="text-center">{t("active")}</TableHead>
                <TableHead className="text-right">{t("actions")}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {variants.map((variant, index) => (
                <TableRow key={index}>
                  <TableCell>
                    <Checkbox
                      checked={selectedVariantIndices.includes(index)}
                      onCheckedChange={() => handleSelectVariant(index)}
                    />
                  </TableCell>
                  <TableCell className="font-medium">
                    {editingVariantIndex === index ? (
                      <Input
                        value={variant.name}
                        onChange={(e) => handleUpdateVariant(index, "name", e.target.value)}
                        onBlur={() => setEditingVariantIndex(null)}
                        autoFocus
                        className="h-8"
                      />
                    ) : (
                      <span
                        className="cursor-pointer hover:underline"
                        onClick={() => setEditingVariantIndex(index)}
                      >
                        {variant.name}
                      </span>
                    )}
                  </TableCell>
                  <TableCell>
                    <Input
                      value={variant.sku}
                      onChange={(e) => handleUpdateVariant(index, "sku", e.target.value)}
                      className="h-8 w-32"
                    />
                  </TableCell>
                  <TableCell>
                    <div className="flex flex-wrap gap-1">
                      {variant.attributeValues.map((attr, attrIndex) => (
                        <Badge key={attrIndex} variant="outline" className="text-xs">
                          {attr.optionValueName}
                        </Badge>
                      ))}
                    </div>
                  </TableCell>
                  <TableCell className="text-right">
                    <Input
                      type="number"
                      step="0.01"
                      value={variant.sellingPrice}
                      onChange={(e) =>
                        handleUpdateVariant(index, "sellingPrice", parseFloat(e.target.value) || 0)
                      }
                      className="h-8 w-24 text-right"
                    />
                  </TableCell>
                  <TableCell className="text-right">
                    <Input
                      type="number"
                      step="0.01"
                      value={variant.costPrice}
                      onChange={(e) =>
                        handleUpdateVariant(index, "costPrice", parseFloat(e.target.value) || 0)
                      }
                      className="h-8 w-24 text-right"
                    />
                  </TableCell>
                  <TableCell className="text-right">
                    <Input
                      type="number"
                      step="1"
                      value={variant.reorderPoint}
                      onChange={(e) =>
                        handleUpdateVariant(index, "reorderPoint", parseInt(e.target.value) || 0)
                      }
                      className="h-8 w-20 text-right"
                    />
                  </TableCell>
                  <TableCell className="text-center">
                    <Checkbox
                      checked={variant.isActive}
                      onCheckedChange={() => handleToggleVariantActive(index)}
                    />
                  </TableCell>
                  <TableCell className="text-right">
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      onClick={() => handleDeleteVariant(index)}
                    >
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </CardContent>
    </Card>
  );
}
