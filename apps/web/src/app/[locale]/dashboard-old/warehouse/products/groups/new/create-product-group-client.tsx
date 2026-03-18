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
  unit: string;
  sellingPrice: number;
  costPrice: number;
  reorderPoint: number;
  description?: string;
}

interface SelectedAttributeRow {
  optionGroupId: string;
  optionGroupName: string;
  selectedValues: string[]; // User-entered or selected values
  newValueInput: string; // Current input value
}

export function CreateProductGroupClient() {
  const router = useRouter();
  const { activeOrg } = useAppStore();
  const { user } = useUserStore();

  // Basic Info State
  const [basicInfo, setBasicInfo] = React.useState<BasicInfo>({
    name: "",
    unit: "pcs",
    sellingPrice: 0,
    costPrice: 0,
    reorderPoint: 10,
    description: "",
  });

  // Available option groups from database
  const [availableOptionGroups, setAvailableOptionGroups] = React.useState<OptionGroupWithValues[]>(
    []
  );

  // Selected attributes (rows in the attribute section)
  const [selectedAttributes, setSelectedAttributes] = React.useState<SelectedAttributeRow[]>([]);

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
        const groups = await optionGroupsService.getOptionGroups(activeOrg.organization_id);
        setAvailableOptionGroups(groups);
      } catch (error) {
        console.error("Failed to load option groups:", error);
        // Only show error toast if it's an actual error, not just empty results
        toast.error("Failed to load attributes");
      }
    };

    loadOptionGroups();
  }, [activeOrg?.organization_id]);

  // Auto-generate variants when attributes change
  React.useEffect(() => {
    if (
      selectedAttributes.length === 0 ||
      !selectedAttributes.every((attr) => attr.selectedValues.length > 0)
    ) {
      setGeneratedVariants([]);
      return;
    }

    try {
      // Create mock option groups with user-entered values
      const mockSelectedAttributes = selectedAttributes.map((attr, attrIndex) => ({
        optionGroup: {
          id: attr.optionGroupId || `temp-${attrIndex}`,
          name: attr.optionGroupName,
          organization_id: activeOrg?.organization_id || "",
          description: null,
          display_order: attrIndex,
          is_template: false,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
          deleted_at: null,
          values: attr.selectedValues.map((val, valIndex) => ({
            id: `temp-${attrIndex}-${valIndex}`,
            option_group_id: attr.optionGroupId || `temp-${attrIndex}`,
            value: val,
            display_order: valIndex,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
            deleted_at: null,
          })),
        } as OptionGroupWithValues,
        selectedValueIds: attr.selectedValues.map((_, valIndex) => `temp-${attrIndex}-${valIndex}`),
      }));

      const variants = variantGenerationService.generateVariantCombinations(
        basicInfo.name || "Product",
        mockSelectedAttributes,
        {
          selling: basicInfo.sellingPrice,
          cost: basicInfo.costPrice,
          reorder: basicInfo.reorderPoint,
        }
      );
      setGeneratedVariants(variants);
    } catch (error) {
      console.error("Failed to generate variants:", error);
      setGeneratedVariants([]);
    }
  }, [
    selectedAttributes,
    basicInfo.name,
    basicInfo.sellingPrice,
    basicInfo.costPrice,
    basicInfo.reorderPoint,
    activeOrg?.organization_id,
  ]);

  // Get option groups not already selected
  const availableGroups = React.useMemo(() => {
    const selectedIds = selectedAttributes.map((attr) => attr.optionGroupId).filter(Boolean);
    return availableOptionGroups.filter((group) => !selectedIds.includes(group.id));
  }, [availableOptionGroups, selectedAttributes]);

  const handleAddAttributeRow = () => {
    setSelectedAttributes([
      ...selectedAttributes,
      {
        optionGroupId: "",
        optionGroupName: "",
        selectedValues: [],
        newValueInput: "",
      },
    ]);
  };

  const handleSelectOptionGroup = (rowIndex: number, optionGroupId: string) => {
    const optionGroup = availableOptionGroups.find((g) => g.id === optionGroupId);
    if (!optionGroup) return;

    const updated = [...selectedAttributes];
    updated[rowIndex] = {
      ...updated[rowIndex],
      optionGroupId: optionGroup.id,
      optionGroupName: optionGroup.name,
      // Pre-fill with existing values from the option group
      selectedValues: optionGroup.values.map((v) => v.value),
    };
    setSelectedAttributes(updated);
  };

  const handleRemoveAttributeRow = (rowIndex: number) => {
    setSelectedAttributes(selectedAttributes.filter((_, i) => i !== rowIndex));
  };

  const handleAddValueToAttribute = (rowIndex: number) => {
    const attr = selectedAttributes[rowIndex];
    const value = attr.newValueInput.trim();
    if (!value) return;

    const updated = [...selectedAttributes];
    updated[rowIndex] = {
      ...updated[rowIndex],
      selectedValues: [...attr.selectedValues, value],
      newValueInput: "",
    };
    setSelectedAttributes(updated);
  };

  const handleRemoveValueFromAttribute = (rowIndex: number, valueIndex: number) => {
    const updated = [...selectedAttributes];
    updated[rowIndex].selectedValues = updated[rowIndex].selectedValues.filter(
      (_, i) => i !== valueIndex
    );
    setSelectedAttributes(updated);
  };

  const handleUpdateValueInput = (rowIndex: number, value: string) => {
    const updated = [...selectedAttributes];
    updated[rowIndex].newValueInput = value;
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
      toast.warning("Generate variants first by adding attributes and values");
      return;
    }

    // Validate that all attributes have names and values
    const invalidAttrs = selectedAttributes.filter(
      (attr) => !attr.optionGroupName || attr.selectedValues.length === 0
    );

    if (invalidAttrs.length > 0) {
      toast.error("All attributes must have a name and at least one value");
      return;
    }

    setShowSKUGenerator(true);
  };

  const handleApplySKUs = (updatedVariants: GeneratedVariant[]) => {
    setGeneratedVariants(updatedVariants);
  };

  const handleAutoGenerateSKUs = async () => {
    if (generatedVariants.length === 0) {
      toast.warning("No variants to generate SKUs for");
      return;
    }

    // Import the service dynamically
    const { variantGenerationService } =
      await import("@/modules/warehouse/api/variant-generation-service");

    // Use default config: base name + all attributes, uppercase, dash separator
    const defaultConfig = {
      includeBaseName: true,
      baseNameFormat: "first" as const,
      baseNameCase: "upper" as const,
      includeAttributes: selectedAttributes.map((attr) => ({
        attributeName: attr.optionGroupName,
        include: true,
        displayFormat: "first" as const,
        letterCase: "upper" as const,
      })),
      separator: "-" as const,
    };

    const updatedVariants = variantGenerationService.generateSKUsForAllVariants(
      basicInfo.name,
      generatedVariants,
      defaultConfig
    );

    setGeneratedVariants(updatedVariants);
    toast.success("SKUs generated successfully");
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

    if (selectedAttributes.length === 0) {
      toast.error("Please add at least one attribute");
      return;
    }

    if (generatedVariants.length === 0) {
      toast.error("Please add values to attributes to generate variants");
      return;
    }

    setIsSaving(true);

    try {
      // Build the proper data structure for the API
      const attributesForAPI = selectedAttributes.map((attr) => {
        // Find or create option group
        const existingGroup = availableOptionGroups.find((g) => g.id === attr.optionGroupId);

        return {
          optionGroup:
            existingGroup ||
            ({
              id: attr.optionGroupId || `new-${attr.optionGroupName}`,
              name: attr.optionGroupName,
              organization_id: activeOrg.organization_id,
              description: null,
              display_order: 0,
              is_template: false,
              created_at: new Date().toISOString(),
              updated_at: new Date().toISOString(),
              deleted_at: null,
              values: attr.selectedValues.map((val, idx) => ({
                id: `new-${attr.optionGroupName}-${idx}`,
                option_group_id: attr.optionGroupId || `new-${attr.optionGroupName}`,
                value: val,
                display_order: idx,
                created_at: new Date().toISOString(),
                updated_at: new Date().toISOString(),
                deleted_at: null,
              })),
            } as OptionGroupWithValues),
          selectedValueIds: attr.selectedValues.map(
            (_, idx) =>
              existingGroup?.values.find((v) => v.value === attr.selectedValues[idx])?.id ||
              `new-${attr.optionGroupName}-${idx}`
          ),
        };
      });

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
        selectedAttributes: attributesForAPI,
        generatedVariants,
      };

      const result = await productGroupsService.createProductGroup(
        formData,
        activeOrg.organization_id,
        user.id
      );

      toast.success("Product group created successfully");
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
          <div className="space-y-2">
            <Label htmlFor="name">Name *</Label>
            <Input
              id="name"
              value={basicInfo.name}
              onChange={(e) => setBasicInfo({ ...basicInfo, name: e.target.value })}
              placeholder="Enter product group name..."
            />
            <p className="text-xs text-muted-foreground">
              Product group doesn't have a SKU. Each variant will have its own SKU.
            </p>
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

      {/* Attributes Section - EXACTLY like Zoho */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>Attributes</CardTitle>
            <Button variant="outline" size="sm" onClick={handleAddAttributeRow}>
              <Plus className="mr-2 h-4 w-4" />
              Add Attribute
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {selectedAttributes.length === 0 ? (
            <div className="py-8 text-center text-muted-foreground">
              <p className="text-sm">No attributes selected</p>
              <p className="mt-1 text-xs">Click "Add Attribute" to get started</p>
            </div>
          ) : (
            <div className="space-y-4">
              {selectedAttributes.map((attr, rowIndex) => (
                <div key={rowIndex} className="space-y-3 rounded-lg border p-4">
                  <div className="flex items-center gap-3">
                    <div className="flex-1">
                      <Label className="text-xs text-muted-foreground">Attribute*</Label>
                      <Select
                        value={attr.optionGroupId}
                        onValueChange={(value) => handleSelectOptionGroup(rowIndex, value)}
                      >
                        <SelectTrigger>
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
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => handleRemoveAttributeRow(rowIndex)}
                      className="mt-5"
                    >
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  </div>

                  <div className="space-y-2">
                    <Label className="text-xs text-muted-foreground">Options*</Label>

                    {/* Display selected values as badges */}
                    <div className="flex flex-wrap gap-2 rounded-md border p-3 min-h-[50px]">
                      {attr.selectedValues.map((value, valueIndex) => (
                        <Badge key={valueIndex} variant="secondary" className="gap-1">
                          {value}
                          <button
                            type="button"
                            onClick={() => handleRemoveValueFromAttribute(rowIndex, valueIndex)}
                            className="ml-1 rounded-full hover:bg-muted"
                          >
                            <X className="h-3 w-3" />
                          </button>
                        </Badge>
                      ))}
                    </div>

                    {/* Input to add new values */}
                    <div className="flex gap-2">
                      <Input
                        value={attr.newValueInput}
                        onChange={(e) => handleUpdateValueInput(rowIndex, e.target.value)}
                        placeholder="Type a value and press Enter..."
                        onKeyDown={(e) => {
                          if (e.key === "Enter") {
                            e.preventDefault();
                            handleAddValueToAttribute(rowIndex);
                          }
                        }}
                      />
                      <Button
                        type="button"
                        variant="outline"
                        size="icon"
                        onClick={() => handleAddValueToAttribute(rowIndex)}
                      >
                        <Plus className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Variants Table - Shows ONLY when variants are generated */}
      {generatedVariants.length > 0 && (
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle>Variants ({generatedVariants.length})</CardTitle>
                <p className="text-sm text-muted-foreground mt-1">
                  All possible combinations of selected attribute values
                </p>
              </div>
              <div className="flex items-center gap-2">
                <Button
                  variant="default"
                  size="sm"
                  onClick={handleAutoGenerateSKUs}
                  className="gap-2"
                >
                  <Plus className="h-4 w-4" />
                  Generate SKUs
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleOpenSKUGenerator}
                  className="gap-2"
                >
                  <Wand2 className="h-4 w-4" />
                  Configure Pattern
                </Button>
              </div>
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
                          placeholder="SKU"
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
                            handleUpdateVariant(
                              index,
                              "reorderPoint",
                              parseInt(e.target.value) || 0
                            )
                          }
                          className="h-8 w-20 text-right"
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

      {/* SKU Generator Dialog */}
      {showSKUGenerator && (
        <SKUGeneratorDialog
          open={showSKUGenerator}
          onOpenChange={setShowSKUGenerator}
          baseName={basicInfo.name}
          attributes={selectedAttributes.map((attr) => ({
            name: attr.optionGroupName,
            sampleValue: attr.selectedValues[0] || "Sample",
          }))}
          variants={generatedVariants}
          onApply={handleApplySKUs}
        />
      )}
    </div>
  );
}
