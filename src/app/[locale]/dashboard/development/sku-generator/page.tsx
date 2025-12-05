"use client";

import * as React from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Plus, X, Wand2 } from "lucide-react";
import { SKUGeneratorDialog } from "@/modules/warehouse/components/sku-generator-dialog";
import type { GeneratedVariant, SelectedAttribute } from "@/modules/warehouse/types/product-groups";
import type { OptionGroupWithValues } from "@/modules/warehouse/types/option-groups";

export default function SKUGeneratorTestingPage() {
  const [productName, setProductName] = React.useState("T-Shirt");
  const [attributes, setAttributes] = React.useState<Array<{ name: string; values: string[] }>>([
    { name: "Color", values: ["Red", "Blue", "Green"] },
    { name: "Size", values: ["S", "M", "L", "XL"] },
  ]);
  const [newAttrName, setNewAttrName] = React.useState("");
  const [newAttrValues, setNewAttrValues] = React.useState<Record<number, string>>({});
  const [generatedVariants, setGeneratedVariants] = React.useState<GeneratedVariant[]>([]);
  const [showSKUGenerator, setShowSKUGenerator] = React.useState(false);

  const handleAddAttribute = () => {
    if (!newAttrName.trim()) return;
    setAttributes([...attributes, { name: newAttrName, values: [] }]);
    setNewAttrName("");
  };

  const handleAddValue = (attrIndex: number) => {
    const value = newAttrValues[attrIndex] || "";
    if (!value.trim()) return;
    const updated = [...attributes];
    updated[attrIndex].values.push(value);
    setAttributes(updated);
    // Clear only this attribute's input
    setNewAttrValues((prev) => ({ ...prev, [attrIndex]: "" }));
  };

  const handleRemoveAttribute = (index: number) => {
    setAttributes(attributes.filter((_, i) => i !== index));
  };

  const handleRemoveValue = (attrIndex: number, valueIndex: number) => {
    const updated = [...attributes];
    updated[attrIndex].values = updated[attrIndex].values.filter((_, i) => i !== valueIndex);
    setAttributes(updated);
  };

  const handleGenerateVariants = () => {
    // Create mock SelectedAttribute structure
    const selectedAttributes: SelectedAttribute[] = attributes.map((attr) => ({
      optionGroup: {
        id: `mock-${attr.name}`,
        name: attr.name,
        description: null,
        organization_id: "mock-org",
        display_order: 0,
        is_template: false,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        deleted_at: null,
        values: attr.values.map((val, idx) => ({
          id: `mock-${attr.name}-${idx}`,
          option_group_id: `mock-${attr.name}`,
          value: val,
          display_order: idx,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
          deleted_at: null,
        })),
      } as OptionGroupWithValues,
      selectedValueIds: attr.values.map((_, idx) => `mock-${attr.name}-${idx}`),
    }));

    const variants = variantGenerationService.generateVariantCombinations(
      productName,
      selectedAttributes,
      { selling: 19.99, cost: 10.0, reorder: 10 }
    );

    setGeneratedVariants(variants);
  };

  const handleOpenSKUGenerator = () => {
    if (generatedVariants.length === 0) {
      handleGenerateVariants();
    }
    setShowSKUGenerator(true);
  };

  const handleApplySKUs = (updatedVariants: GeneratedVariant[]) => {
    setGeneratedVariants(updatedVariants);
  };

  const combinationsCount = attributes.reduce(
    (total, attr) => (attr.values.length > 0 ? total * attr.values.length : total),
    1
  );

  return (
    <div className="space-y-6 p-6">
      <div>
        <h1 className="text-2xl font-bold">SKU Generator Testing Tool</h1>
        <p className="text-sm text-muted-foreground">
          Test the SKU generation algorithm and pattern configuration
        </p>
      </div>

      {/* Product Name */}
      <Card>
        <CardHeader>
          <CardTitle>Product Name</CardTitle>
          <CardDescription>Base name for the product group</CardDescription>
        </CardHeader>
        <CardContent>
          <Input
            value={productName}
            onChange={(e) => setProductName(e.target.value)}
            placeholder="Enter product name..."
          />
        </CardContent>
      </Card>

      {/* Attributes Configuration */}
      <Card>
        <CardHeader>
          <CardTitle>Attributes & Options</CardTitle>
          <CardDescription>
            Configure attributes and their values (like Color, Size, etc.)
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Existing Attributes */}
          {attributes.map((attr, attrIndex) => (
            <div key={attrIndex} className="space-y-2 rounded-md border p-4">
              <div className="flex items-center justify-between">
                <Label className="text-base font-semibold">{attr.name}</Label>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => handleRemoveAttribute(attrIndex)}
                  className="h-6 w-6"
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>

              {/* Values */}
              <div className="flex flex-wrap gap-2">
                {attr.values.map((value, valueIndex) => (
                  <Badge key={valueIndex} variant="secondary" className="cursor-pointer">
                    {value}
                    <X
                      className="ml-1 h-3 w-3"
                      onClick={() => handleRemoveValue(attrIndex, valueIndex)}
                    />
                  </Badge>
                ))}
              </div>

              {/* Add Value */}
              <div className="flex gap-2">
                <Input
                  value={newAttrValues[attrIndex] || ""}
                  onChange={(e) =>
                    setNewAttrValues((prev) => ({ ...prev, [attrIndex]: e.target.value }))
                  }
                  placeholder="Add value..."
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      handleAddValue(attrIndex);
                    }
                  }}
                />
                <Button onClick={() => handleAddValue(attrIndex)} size="sm">
                  <Plus className="h-4 w-4" />
                </Button>
              </div>
            </div>
          ))}

          {/* Add New Attribute */}
          <div className="flex gap-2">
            <Input
              value={newAttrName}
              onChange={(e) => setNewAttrName(e.target.value)}
              placeholder="New attribute name (e.g., Material)..."
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  handleAddAttribute();
                }
              }}
            />
            <Button onClick={handleAddAttribute}>
              <Plus className="mr-2 h-4 w-4" />
              Add Attribute
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Generation Controls */}
      <Card>
        <CardHeader>
          <CardTitle>Generation</CardTitle>
          <CardDescription>Generate variants and configure SKU patterns</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium">Combinations</p>
              <p className="text-2xl font-bold">{combinationsCount}</p>
              <p className="text-xs text-muted-foreground">
                {attributes.map((a) => `${a.values.length} ${a.name}`).join(" × ")}
              </p>
            </div>

            <div className="flex gap-2">
              <Button onClick={handleGenerateVariants} variant="outline">
                Generate Variants
              </Button>
              <Button onClick={handleOpenSKUGenerator} disabled={attributes.length === 0}>
                <Wand2 className="mr-2 h-4 w-4" />
                Configure SKU Pattern
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Generated Variants */}
      {generatedVariants.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Generated Variants ({generatedVariants.length})</CardTitle>
            <CardDescription>All variant combinations with SKUs</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {generatedVariants.map((variant, index) => (
                <div
                  key={index}
                  className="flex items-center justify-between rounded-md border p-3"
                >
                  <div>
                    <p className="font-medium">{variant.name}</p>
                    <p className="text-sm text-muted-foreground">
                      {variant.attributeValues
                        .map((av) => `${av.optionGroupName}: ${av.optionValueName}`)
                        .join(", ")}
                    </p>
                  </div>
                  <div>
                    {variant.sku ? (
                      <Badge variant="default" className="font-mono">
                        {variant.sku}
                      </Badge>
                    ) : (
                      <Badge variant="outline">No SKU</Badge>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Algorithm Info */}
      <Card>
        <CardHeader>
          <CardTitle>Algorithm Information</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-sm">
          <div>
            <strong>Cartesian Product:</strong> Generates all possible combinations of attribute
            values.
          </div>
          <div>
            <strong>Formula:</strong> Total Combinations = Value1 Count × Value2 Count × ... ×
            ValueN Count
          </div>
          <div>
            <strong>SKU Pattern:</strong> Configurable format with first/last/full text,
            upper/lower/title case, and custom separator.
          </div>
          <div>
            <strong>Example:</strong> "T-Shirt" with Color [Red, Blue] and Size [S, M] = 4 variants
            (Red-S, Red-M, Blue-S, Blue-M)
          </div>
        </CardContent>
      </Card>

      {/* SKU Generator Dialog */}
      <SKUGeneratorDialog
        open={showSKUGenerator}
        onOpenChange={setShowSKUGenerator}
        baseName={productName}
        attributes={attributes.map((attr) => ({
          name: attr.name,
          sampleValue: attr.values[0] || "Sample",
        }))}
        variants={generatedVariants}
        onApply={handleApplySKUs}
      />
    </div>
  );
}
