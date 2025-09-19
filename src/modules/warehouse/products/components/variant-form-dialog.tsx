"use client";

import * as React from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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
import { Switch } from "@/components/ui/switch";
import { Separator } from "@/components/ui/separator";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Loader2, Plus, X } from "lucide-react";
import { toast } from "react-toastify";
import type { ProductWithDetails } from "@/modules/warehouse/types/flexible-products";
import type { CreateVariantData } from "@/modules/warehouse/types/flexible-products";
import { useVariants } from "@/modules/warehouse/hooks/use-variants";

interface VariantFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  product: ProductWithDetails;
  variant?: any | null;
  onSuccess?: () => void;
}

export function VariantFormDialog({
  open,
  onOpenChange,
  product,
  variant,
  onSuccess,
}: VariantFormDialogProps) {
  const isEditing = !!variant;
  const [formData, setFormData] = React.useState<Partial<CreateVariantData>>({
    product_id: product.id,
    name: "",
    sku: "",
    barcode: "",
    is_default: false,
    status: "active",
    attributes: {},
  });

  const [customAttributes, setCustomAttributes] = React.useState<
    Array<{ key: string; value: string; type: "text" | "number" | "boolean" }>
  >([]);

  const { createVariant, updateVariant, isCreating, isUpdating, error, clearError } = useVariants();

  // Initialize form data when variant changes
  React.useEffect(() => {
    if (variant) {
      setFormData({
        product_id: product.id,
        name: variant.name || "",
        sku: variant.sku || "",
        barcode: variant.barcode || "",
        is_default: variant.is_default || false,
        status: variant.status || "active",
        attributes: {},
      });

      // Convert variant attributes to custom attributes
      if (variant.attributes) {
        const attrs = variant.attributes.map((attr: any) => ({
          key: attr.attribute_key,
          value:
            attr.value_text ||
            attr.value_number?.toString() ||
            attr.value_boolean?.toString() ||
            "",
          type: attr.value_text
            ? "text"
            : attr.value_number !== null
              ? "number"
              : ("boolean" as const),
        }));
        setCustomAttributes(attrs);
      }
    } else {
      setFormData({
        product_id: product.id,
        name: "",
        sku: "",
        barcode: "",
        is_default: false,
        status: "active",
        attributes: {},
      });
      setCustomAttributes([]);
    }
  }, [variant, product.id]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    clearError();

    try {
      // Prepare attributes
      const attributes: Record<string, any> = {};
      customAttributes.forEach((attr) => {
        if (attr.key && attr.value) {
          attributes[attr.key] = {
            type: attr.type,
            value:
              attr.type === "number"
                ? Number(attr.value)
                : attr.type === "boolean"
                  ? attr.value === "true"
                  : attr.value,
          };
        }
      });

      const variantData: CreateVariantData = {
        ...formData,
        attributes,
      } as CreateVariantData;

      if (isEditing) {
        await updateVariant(variant.id, variantData);
        toast.success("Wariant został zaktualizowany");
      } else {
        await createVariant(variantData);
        toast.success("Wariant został utworzony");
      }

      onSuccess?.();
    } catch (error) {
      console.error("Error saving variant:", error);
    }
  };

  const addCustomAttribute = () => {
    setCustomAttributes([...customAttributes, { key: "", value: "", type: "text" }]);
  };

  const removeCustomAttribute = (index: number) => {
    setCustomAttributes(customAttributes.filter((_, i) => i !== index));
  };

  const updateCustomAttribute = (index: number, field: string, value: string) => {
    const updated = [...customAttributes];
    updated[index] = { ...updated[index], [field]: value };
    setCustomAttributes(updated);
  };

  const isLoading = isCreating || isUpdating;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] max-w-2xl">
        <DialogHeader>
          <DialogTitle>{isEditing ? "Edytuj wariant" : "Dodaj nowy wariant"}</DialogTitle>
          <DialogDescription>
            {isEditing
              ? "Modyfikuj szczegóły wariantu produktu."
              : "Dodaj nowy wariant do produktu z określonymi atrybutami."}
          </DialogDescription>
        </DialogHeader>

        <ScrollArea className="max-h-[60vh] px-1">
          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Basic Information */}
            <div className="space-y-4">
              <h3 className="text-sm font-medium">Podstawowe informacje</h3>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="name">Nazwa wariantu *</Label>
                  <Input
                    id="name"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    placeholder="np. Czerwony - Rozmiar M"
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="sku">SKU</Label>
                  <Input
                    id="sku"
                    value={formData.sku}
                    onChange={(e) => setFormData({ ...formData, sku: e.target.value })}
                    placeholder="np. PROD-001-RED-M"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="barcode">Kod kreskowy</Label>
                  <Input
                    id="barcode"
                    value={formData.barcode}
                    onChange={(e) => setFormData({ ...formData, barcode: e.target.value })}
                    placeholder="np. 1234567890123"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="status">Status</Label>
                  <Select
                    value={formData.status}
                    onValueChange={(value) => setFormData({ ...formData, status: value })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="active">Aktywny</SelectItem>
                      <SelectItem value="inactive">Nieaktywny</SelectItem>
                      <SelectItem value="draft">Szkic</SelectItem>
                      <SelectItem value="archived">Zarchiwizowany</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="flex items-center space-x-2">
                <Switch
                  id="is_default"
                  checked={formData.is_default}
                  onCheckedChange={(checked) => setFormData({ ...formData, is_default: checked })}
                />
                <Label htmlFor="is_default">Domyślny wariant</Label>
              </div>
            </div>

            <Separator />

            {/* Custom Attributes */}
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-medium">Atrybuty wariantu</h3>
                <Button type="button" variant="outline" size="sm" onClick={addCustomAttribute}>
                  <Plus className="mr-1 h-4 w-4" />
                  Dodaj atrybut
                </Button>
              </div>

              {customAttributes.length === 0 ? (
                <div className="py-6 text-center text-muted-foreground">
                  <p>Brak dodatkowych atrybutów</p>
                  <p className="text-sm">
                    Kliknij "Dodaj atrybut" aby dodać właściwości tego wariantu
                  </p>
                </div>
              ) : (
                <div className="space-y-3">
                  {customAttributes.map((attr, index) => (
                    <div key={index} className="grid grid-cols-12 items-end gap-2">
                      <div className="col-span-4">
                        <Label className="text-xs">Nazwa atrybutu</Label>
                        <Input
                          value={attr.key}
                          onChange={(e) => updateCustomAttribute(index, "key", e.target.value)}
                          placeholder="np. kolor, rozmiar"
                          className="text-sm"
                        />
                      </div>
                      <div className="col-span-3">
                        <Label className="text-xs">Typ</Label>
                        <Select
                          value={attr.type}
                          onValueChange={(value) => updateCustomAttribute(index, "type", value)}
                        >
                          <SelectTrigger className="text-sm">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="text">Tekst</SelectItem>
                            <SelectItem value="number">Liczba</SelectItem>
                            <SelectItem value="boolean">Tak/Nie</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="col-span-4">
                        <Label className="text-xs">Wartość</Label>
                        {attr.type === "boolean" ? (
                          <Select
                            value={attr.value}
                            onValueChange={(value) => updateCustomAttribute(index, "value", value)}
                          >
                            <SelectTrigger className="text-sm">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="true">Tak</SelectItem>
                              <SelectItem value="false">Nie</SelectItem>
                            </SelectContent>
                          </Select>
                        ) : (
                          <Input
                            type={attr.type === "number" ? "number" : "text"}
                            value={attr.value}
                            onChange={(e) => updateCustomAttribute(index, "value", e.target.value)}
                            placeholder={attr.type === "number" ? "0" : "Wartość"}
                            className="text-sm"
                          />
                        )}
                      </div>
                      <div className="col-span-1">
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={() => removeCustomAttribute(index)}
                          className="h-9 w-9 p-0"
                        >
                          <X className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {error && <div className="rounded-md bg-red-50 p-3 text-sm text-red-600">{error}</div>}
          </form>
        </ScrollArea>

        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={isLoading}
          >
            Anuluj
          </Button>
          <Button type="submit" onClick={handleSubmit} disabled={isLoading || !formData.name}>
            {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            {isEditing ? "Zapisz zmiany" : "Utwórz wariant"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
