"use client";

import * as React from "react";
import { useTranslations } from "next-intl";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { useSKUGeneratorStore } from "@/lib/stores/sku-generator-store";
import type { GeneratedVariant } from "@/modules/warehouse/types/product-groups";

interface SKUGeneratorDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  baseName: string;
  attributes: Array<{ name: string; sampleValue: string }>; // e.g., [{name: "Color", sampleValue: "Red"}, {name: "Size", sampleValue: "Medium"}]
  variants: GeneratedVariant[];
  onApply: (updatedVariants: GeneratedVariant[]) => void; // Callback with SKUs applied to all variants
}

export function SKUGeneratorDialog({
  open,
  onOpenChange,
  baseName,
  attributes,
  variants,
  onApply,
}: SKUGeneratorDialogProps) {
  const t = useTranslations("productGroups.skuGenerator");
  const { config, previewSKU, setConfig, updateAttributeConfig, generatePreview, reset } =
    useSKUGeneratorStore();

  // Initialize attribute configs when dialog opens
  React.useEffect(() => {
    if (open && attributes.length > 0) {
      const initialAttributeConfigs = attributes.map((attr) => ({
        attributeName: attr.name,
        include: true,
        displayFormat: "first" as const,
        letterCase: "upper" as const,
      }));

      setConfig({ includeAttributes: initialAttributeConfigs });

      // Generate initial preview
      generatePreview(
        baseName,
        attributes.map((a) => ({ name: a.name, value: a.sampleValue }))
      );
    }
  }, [open, attributes, baseName]);

  // Regenerate preview whenever config changes
  React.useEffect(() => {
    if (open && attributes.length > 0) {
      generatePreview(
        baseName,
        attributes.map((a) => ({ name: a.name, value: a.sampleValue }))
      );
    }
  }, [config, open]);

  const handleGenerate = () => {
    // Import the service to generate SKUs for all variants
    import("@/modules/warehouse/api/variant-generation-service").then(
      ({ variantGenerationService }) => {
        const updatedVariants = variantGenerationService.generateSKUsForAllVariants(
          baseName,
          variants,
          config
        );
        onApply(updatedVariants);
        onOpenChange(false);
      }
    );
  };

  const handleClose = () => {
    reset();
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>{t("title", { baseName })}</DialogTitle>
          <DialogDescription>{t("description")}</DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Configuration Table */}
          <div className="rounded-md border">
            <table className="w-full">
              <thead>
                <tr className="border-b bg-muted/50">
                  <th className="p-3 text-left text-sm font-medium">
                    {t("table.selectAttribute")}
                  </th>
                  <th className="p-3 text-left text-sm font-medium">{t("table.show")}</th>
                  <th className="p-3 text-left text-sm font-medium">{t("table.letterCase")}</th>
                  <th className="p-3 text-left text-sm font-medium">{t("table.separator")}</th>
                </tr>
              </thead>
              <tbody>
                {/* Base Name Row */}
                <tr className="border-b">
                  <td className="p-3">
                    <div className="flex items-center space-x-2">
                      <Checkbox
                        checked={config.includeBaseName}
                        onCheckedChange={(checked) =>
                          setConfig({ includeBaseName: checked as boolean })
                        }
                      />
                      <Label>Item Group Name</Label>
                    </div>
                  </td>
                  <td className="p-3">
                    <Select
                      value={config.baseNameFormat}
                      onValueChange={(value: any) => setConfig({ baseNameFormat: value })}
                      disabled={!config.includeBaseName}
                    >
                      <SelectTrigger className="w-32">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="first">{t("format.first")}</SelectItem>
                        <SelectItem value="last">{t("format.last")}</SelectItem>
                        <SelectItem value="full">{t("format.full")}</SelectItem>
                      </SelectContent>
                    </Select>
                  </td>
                  <td className="p-3">
                    <Select
                      value={config.baseNameCase}
                      onValueChange={(value: any) => setConfig({ baseNameCase: value })}
                      disabled={!config.includeBaseName}
                    >
                      <SelectTrigger className="w-32">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="upper">{t("case.upper")}</SelectItem>
                        <SelectItem value="lower">{t("case.lower")}</SelectItem>
                        <SelectItem value="title">{t("case.title")}</SelectItem>
                      </SelectContent>
                    </Select>
                  </td>
                  <td className="p-3" rowSpan={attributes.length + 1}>
                    <Select
                      value={config.separator}
                      onValueChange={(value: any) => setConfig({ separator: value })}
                    >
                      <SelectTrigger className="w-20">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="-">-</SelectItem>
                        <SelectItem value="_">_</SelectItem>
                        <SelectItem value=" ">Space</SelectItem>
                        <SelectItem value="">None</SelectItem>
                      </SelectContent>
                    </Select>
                  </td>
                </tr>

                {/* Attribute Rows */}
                {attributes.map((attr, index) => {
                  const attrConfig = config.includeAttributes.find(
                    (a) => a.attributeName === attr.name
                  );

                  return (
                    <tr key={attr.name} className={index < attributes.length - 1 ? "border-b" : ""}>
                      <td className="p-3">
                        <div className="flex items-center space-x-2">
                          <Checkbox
                            checked={attrConfig?.include ?? true}
                            onCheckedChange={(checked) =>
                              updateAttributeConfig(attr.name, { include: checked as boolean })
                            }
                          />
                          <Label>{attr.name}</Label>
                        </div>
                      </td>
                      <td className="p-3">
                        <Select
                          value={attrConfig?.displayFormat ?? "first"}
                          onValueChange={(value: any) =>
                            updateAttributeConfig(attr.name, { displayFormat: value })
                          }
                          disabled={!attrConfig?.include}
                        >
                          <SelectTrigger className="w-32">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="first">{t("format.first")}</SelectItem>
                            <SelectItem value="last">{t("format.last")}</SelectItem>
                            <SelectItem value="full">{t("format.full")}</SelectItem>
                          </SelectContent>
                        </Select>
                      </td>
                      <td className="p-3">
                        <Select
                          value={attrConfig?.letterCase ?? "upper"}
                          onValueChange={(value: any) =>
                            updateAttributeConfig(attr.name, { letterCase: value })
                          }
                          disabled={!attrConfig?.include}
                        >
                          <SelectTrigger className="w-32">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="upper">{t("case.upper")}</SelectItem>
                            <SelectItem value="lower">{t("case.lower")}</SelectItem>
                            <SelectItem value="title">{t("case.title")}</SelectItem>
                          </SelectContent>
                        </Select>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* SKU Preview */}
          <Card>
            <CardContent className="p-4">
              <Label className="text-sm font-medium">{t("preview.title")}</Label>
              <div className="mt-2 rounded-md bg-muted p-3 font-mono text-lg">
                {previewSKU || t("preview.empty")}
              </div>
              <p className="mt-2 text-xs text-muted-foreground">{t("preview.description")}</p>
            </CardContent>
          </Card>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={handleClose}>
            {t("actions.cancel")}
          </Button>
          <Button onClick={handleGenerate}>{t("actions.generate")}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
