"use client";

import * as React from "react";
import { useRouter } from "@/i18n/navigation";
import { toast } from "react-toastify";
import { ArrowLeft, Plus, X, Wand2, Trash2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

import { useAppStore } from "@/lib/stores/app-store";
import { useUserStore } from "@/lib/stores/user-store";
import { optionGroupsService } from "@/modules/warehouse/api/option-groups-service";
import { variantGenerationService } from "@/modules/warehouse/api/variant-generation-service";
import { productGroupsService } from "@/modules/warehouse/api/product-groups-service";
import { SKUGeneratorDialog } from "@/modules/warehouse/components/sku-generator-dialog";

import type { OptionGroupWithValues } from "@/modules/warehouse/types/option-groups";
import type {
  GeneratedVariant,
  CreateProductGroupFormData,
} from "@/modules/warehouse/types/product-groups";

interface BasicInfo {
  name: string;
  sku: string;
  unit: string;
  sellingPrice: number;
  costPrice: number;
  reorderPoint: number;
  description?: string;
}

interface AttributeWithValues {
  optionGroup: OptionGroupWithValues;
  newValues: string[]; // Values being typed in
}

export function CreateProductGroupClient() {
  const router = useRouter();
  const { activeOrg } = useAppStore();
  const { user } = useUserStore();

  // Basic Info State
  const [basicInfo, setBasicInfo] = React.useState<BasicInfo>({
    name: "",
    sku: "",
    unit: "pcs",
    sellingPrice: 0,
    costPrice: 0,
    reorderPoint: 10,
    description: "",
  });

  // Multiple Items State
  const [multipleItems, setMultipleItems] = React.useState(false);

  // Available option groups from database
  const [availableOptionGroups, setAvailableOptionGroups] = React.useState<OptionGroupWithValues[]>(
    []
  );

  // Selected attributes with their new values
  const [selectedAttributes, setSelectedAttributes] = React.useState<AttributeWithValues[]>([]);

  // Input states for adding new values (one per attribute)
  const [newValueInputs, setNewValueInputs] = React.useState<Record<number, string>>({});

  // Generated variants
  const [generatedVariants, setGeneratedVariants] = React.useState<GeneratedVariant[]>([]);

  // SKU Generator Dialog
  const [showSKUGenerator, setShowSKUGenerator] = React.useState(false);

  // Submission state
  const [isSaving, setIsSaving] = React.useState(false);

  // Load available option groups from database
  React.useEffect(() => {
    const loadOptionGroups = async () => {
      if (!activeOrg?.organization_id) return;

      try {
        setLoadingOptionGroups(true);
        const groups = await optionGroupsService.getOptionGroups(activeOrg.organization_id);
        setAvailableOptionGroups(groups);
      } catch (error) {
        console.error("Failed to load option groups:", error);
        toast.error("Failed to load attributes");
      } finally {
        setLoadingOptionGroups(false);
      }
    };

    loadOptionGroups();
  }, [activeOrg?.organization_id]);

  // Auto-generate variants when attributes change
  React.useEffect(() => {
    if (!multipleItems || selectedAttributes.length === 0) {
      setGeneratedVariants([]);
      return;
    }

    // Convert to the format expected by variant generation service
    const selectedAttributesForGeneration = selectedAttributes.map((attr) => ({
      optionGroup: attr.optionGroup,
      selectedValueIds: attr.newValues.map((_, idx) => `new-${attr.optionGroup.id}-${idx}`),
    }));

    // Temporarily add new values to option groups
    const attributesWithNewValues = selectedAttributesForGeneration.map((attr, attrIndex) => ({
      ...attr,
      optionGroup: {
        ...attr.optionGroup,
        values: [
          ...attr.optionGroup.values,
          ...selectedAttributes[attrIndex].newValues.map((val, idx) => ({
            id: `new-${attr.optionGroup.id}-${idx}`,
            option_group_id: attr.optionGroup.id,
            value: val,
            display_order: idx,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
            deleted_at: null,
          })),
        ],
      },
    }));

    try {
      const variants = variantGenerationService.generateVariantCombinations(
        basicInfo.name || "Product",
        attributesWithNewValues,
        {
          selling: basicInfo.sellingPrice,
          cost: basicInfo.costPrice,
          reorder: basicInfo.reorderPoint,
        }
      );
      setGeneratedVariants(variants);
    } catch (error) {
      console.error("Failed to generate variants:", error);
    }
  }, [
    selectedAttributes,
    multipleItems,
    basicInfo.name,
    basicInfo.sellingPrice,
    basicInfo.costPrice,
    basicInfo.reorderPoint,
  ]);

  // Get option groups not already selected
  const availableGroups = React.useMemo(() => {
    const selectedIds = selectedAttributes.map((attr) => attr.optionGroup.id);
    return availableOptionGroups.filter((group) => !selectedIds.includes(group.id));
  }, [availableOptionGroups, selectedAttributes]);

  const handleAddAttribute = (optionGroupId: string) => {
    const optionGroup = availableOptionGroups.find((g) => g.id === optionGroupId);
    if (!optionGroup) return;

    setSelectedAttributes([...selectedAttributes, { optionGroup, newValues: [] }]);
  };

  const handleRemoveAttribute = (index: number) => {
    setSelectedAttributes(selectedAttributes.filter((_, i) => i !== index));
    // Clear input state for this attribute
    setNewValueInputs((prev) => {
      const updated = { ...prev };
      delete updated[index];
      return updated;
    });
  };

  const handleAddValue = (attrIndex: number) => {
    const value = newValueInputs[attrIndex]?.trim();
    if (!value) return;

    const updated = [...selectedAttributes];
    updated[attrIndex].newValues.push(value);
    setSelectedAttributes(updated);

    // Clear input
    setNewValueInputs((prev) => ({ ...prev, [attrIndex]: "" }));
  };

  const handleRemoveValue = (attrIndex: number, valueIndex: number) => {
    const updated = [...selectedAttributes];
    updated[attrIndex].newValues.splice(valueIndex, 1);
    setSelectedAttributes(updated);
  };

  const handleUpdateVariant = (index: number, field: keyof GeneratedVariant, value: unknown) => {
    const updated = [...generatedVariants];
    updated[index] = { ...updated[index], [field]: value };
    setGeneratedVariants(updated);
  };

  const handleDeleteVariant = (index: number) => {
    setGeneratedVariants(generatedVariants.filter((_, i) => i !== index));
  };

  const handleOpenSKUGenerator = () => {
    if (generatedVariants.length === 0) {
      toast.warning("Generate variants first");
      return;
    }
    setShowSKUGenerator(true);
  };

  const handleApplySKUs = (updatedVariants: GeneratedVariant[]) => {
    setGeneratedVariants(updatedVariants);
  };

  const handleSave = async () => {
    if (!activeOrg?.organization_id) {
      toast.error("No organization selected");
      return;
    }

    if (!user?.id) {
      toast.error("User not authenticated");
      return;
    }

    if (!basicInfo.name) {
      toast.error("Product name is required");
      return;
    }

    if (multipleItems && generatedVariants.length === 0) {
      toast.error("Please generate at least one variant");
      return;
    }

    setIsSaving(true);

    try {
      // Prepare form data
      const formData: CreateProductGroupFormData = {
        name: basicInfo.name,
        description: basicInfo.description,
        unit: basicInfo.unit,
        sellingPrice: basicInfo.sellingPrice,
        costPrice: basicInfo.costPrice,
        reorderPoint: basicInfo.reorderPoint,
        returnableItem: false,
        trackInventory: true,
        sellable: true,
        purchasable: true,
        selectedAttributes: selectedAttributes.map((attr) => ({
          optionGroup: attr.optionGroup,
          selectedValueIds: attr.newValues.map((_, idx) => `new-${attr.optionGroup.id}-${idx}`),
        })),
        generatedVariants,
      };

      const result = await productGroupsService.createProductGroup(
        formData,
        activeOrg.organization_id,
        user.id
      );

      toast.success("Product group created successfully");
      // Use window.location for navigation to non-typed routes
      window.location.href = `/dashboard/warehouse/products/groups/${result.product.id}`;
    } catch (error) {
      console.error("Failed to create product group:", error);
      toast.error("Failed to create product group");
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="space-y-6 p-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" onClick={() => router.back()}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div className="flex-1">
          <h1 className="text-3xl font-bold">New Item Group</h1>
          <p className="text-sm text-muted-foreground">
            Create a product group with multiple variants
          </p>
        </div>
        <Button onClick={handleSave} disabled={isSaving}>
          {isSaving ? "Saving..." : "Save"}
        </Button>
      </div>

      <Separator />

      {/* Basic Information */}
      <Card>
        <CardHeader>
          <CardTitle>Basic Information</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="name">Name *</Label>
              <Input
                id="name"
                value={basicInfo.name}
                onChange={(e) => setBasicInfo({ ...basicInfo, name: e.target.value })}
                placeholder="Enter product name..."
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="sku">SKU</Label>
              <Input
                id="sku"
                value={basicInfo.sku}
                onChange={(e) => setBasicInfo({ ...basicInfo, sku: e.target.value })}
                placeholder="Enter SKU..."
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="description">Description</Label>
            <Input
              id="description"
              value={basicInfo.description}
              onChange={(e) => setBasicInfo({ ...basicInfo, description: e.target.value })}
              placeholder="Enter description..."
            />
          </div>

          <div className="grid grid-cols-1 gap-4 md:grid-cols-4">
            <div className="space-y-2">
              <Label htmlFor="unit">Unit</Label>
              <Input
                id="unit"
                value={basicInfo.unit}
                onChange={(e) => setBasicInfo({ ...basicInfo, unit: e.target.value })}
                placeholder="pcs"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="sellingPrice">Selling Price</Label>
              <Input
                id="sellingPrice"
                type="number"
                step="0.01"
                value={basicInfo.sellingPrice}
                onChange={(e) =>
                  setBasicInfo({ ...basicInfo, sellingPrice: parseFloat(e.target.value) || 0 })
                }
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="costPrice">Cost Price</Label>
              <Input
                id="costPrice"
                type="number"
                step="0.01"
                value={basicInfo.costPrice}
                onChange={(e) =>
                  setBasicInfo({ ...basicInfo, costPrice: parseFloat(e.target.value) || 0 })
                }
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="reorderPoint">Reorder Point</Label>
              <Input
                id="reorderPoint"
                type="number"
                value={basicInfo.reorderPoint}
                onChange={(e) =>
                  setBasicInfo({ ...basicInfo, reorderPoint: parseInt(e.target.value) || 0 })
                }
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Multiple Items Section */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex items-center space-x-2">
            <Checkbox
              id="multipleItems"
              checked={multipleItems}
              onCheckedChange={(checked) => setMultipleItems(checked as boolean)}
            />
            <Label htmlFor="multipleItems" className="font-medium">
              Multiple Items
            </Label>
            <span className="text-sm text-muted-foreground">(Create Attributes and Options)</span>
          </div>
        </CardContent>
      </Card>

      {/* Attributes & Variants Section */}
      {multipleItems && (
        <>
          {/* Attributes */}
          <Card>
            <CardHeader>
              <CardTitle>Attributes</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Add Attribute Dropdown */}
              {availableGroups.length > 0 && (
                <div className="flex items-center gap-2">
                  <Select onValueChange={handleAddAttribute}>
                    <SelectTrigger className="flex-1">
                      <SelectValue placeholder="Select an attribute..." />
                    </SelectTrigger>
                    <SelectContent>
                      {availableGroups.map((group) => (
                        <SelectItem key={group.id} value={group.id}>
                          {group.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}

              {/* Selected Attributes */}
              {selectedAttributes.length === 0 ? (
                <div className="py-8 text-center text-muted-foreground">
                  <p className="text-sm">No attributes selected</p>
                  <p className="mt-1 text-xs">Select an attribute to get started</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {selectedAttributes.map((attribute, attrIndex) => (
                    <div key={attribute.optionGroup.id} className="space-y-2 rounded-md border p-4">
                      <div className="flex items-center justify-between">
                        <Label className="text-base font-semibold">
                          {attribute.optionGroup.name}
                        </Label>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleRemoveAttribute(attrIndex)}
                          className="h-6 w-6"
                        >
                          <X className="h-4 w-4" />
                        </Button>
                      </div>

                      {/* Display existing values as badges */}
                      <div className="flex flex-wrap gap-2">
                        {attribute.newValues.map((value, valueIndex) => (
                          <Badge key={valueIndex} variant="secondary" className="cursor-pointer">
                            {value}
                            <X
                              className="ml-1 h-3 w-3"
                              onClick={() => handleRemoveValue(attrIndex, valueIndex)}
                            />
                          </Badge>
                        ))}
                      </div>

                      {/* Input for adding new values */}
                      <div className="flex gap-2">
                        <Input
                          value={newValueInputs[attrIndex] || ""}
                          onChange={(e) =>
                            setNewValueInputs((prev) => ({ ...prev, [attrIndex]: e.target.value }))
                          }
                          placeholder="Type value and press Enter..."
                          onKeyDown={(e) => {
                            if (e.key === "Enter") {
                              e.preventDefault();
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
                </div>
              )}
            </CardContent>
          </Card>

          {/* Variants Table */}
          {generatedVariants.length > 0 && (
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle>Variants ({generatedVariants.length})</CardTitle>
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleOpenSKUGenerator}
                    className="gap-2"
                  >
                    <Wand2 className="h-4 w-4" />
                    Configure SKU Pattern
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                <div className="rounded-md border">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Variant Name</TableHead>
                        <TableHead>SKU</TableHead>
                        <TableHead>Attributes</TableHead>
                        <TableHead className="text-right">Selling Price</TableHead>
                        <TableHead className="text-right">Cost Price</TableHead>
                        <TableHead className="text-right">Reorder Point</TableHead>
                        <TableHead className="text-center">Active</TableHead>
                        <TableHead className="text-right">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {generatedVariants.map((variant, index) => (
                        <TableRow key={index}>
                          <TableCell className="font-medium">
                            <Input
                              value={variant.name}
                              onChange={(e) => handleUpdateVariant(index, "name", e.target.value)}
                              className="h-8"
                            />
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
                                handleUpdateVariant(
                                  index,
                                  "sellingPrice",
                                  parseFloat(e.target.value) || 0
                                )
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
                                handleUpdateVariant(
                                  index,
                                  "costPrice",
                                  parseFloat(e.target.value) || 0
                                )
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
                                handleUpdateVariant(
                                  index,
                                  "reorderPoint",
                                  parseInt(e.target.value) || 0
                                )
                              }
                              className="h-8 w-20 text-right"
                            />
                          </TableCell>
                          <TableCell className="text-center">
                            <Checkbox
                              checked={variant.isActive}
                              onCheckedChange={(checked) =>
                                handleUpdateVariant(index, "isActive", checked)
                              }
                            />
                          </TableCell>
                          <TableCell className="text-right">
                            <Button
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
          )}
        </>
      )}

      {/* SKU Generator Dialog */}
      <SKUGeneratorDialog
        open={showSKUGenerator}
        onOpenChange={setShowSKUGenerator}
        baseName={basicInfo.name}
        attributes={selectedAttributes.map((attr) => ({
          name: attr.optionGroup.name,
          sampleValue: attr.newValues[0] || "Sample",
        }))}
        variants={generatedVariants}
        onApply={handleApplySKUs}
      />
    </div>
  );
}
