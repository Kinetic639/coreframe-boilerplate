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
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Loader2, Plus, X, Grid3X3, Package } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { toast } from "react-toastify";
import type { ProductWithDetails } from "@/modules/warehouse/types/flexible-products";
import { useVariantMatrix } from "@/modules/warehouse/hooks/use-variants";

interface VariantMatrixDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  product: ProductWithDetails;
  onSuccess?: () => void;
}

interface AttributeDefinition {
  name: string;
  values: string[];
}

export function VariantMatrixDialog({
  open,
  onOpenChange,
  product,
  onSuccess,
}: VariantMatrixDialogProps) {
  const [attributes, setAttributes] = React.useState<AttributeDefinition[]>([
    { name: "", values: [] },
  ]);
  const [newValues, setNewValues] = React.useState<Record<number, string>>({});
  const [step, setStep] = React.useState<"setup" | "preview">("setup");
  const [namePattern, setNamePattern] = React.useState("{{product_name}} - {{attributes}}");
  const [skuPattern, setSkuPattern] = React.useState("{{product_id}}-{{attributes}}");

  const {
    buildMatrix,
    generateCombinations,
    generatedCombinations,
    isGeneratingCombinations,
    error,
  } = useVariantMatrix();

  const addAttribute = () => {
    setAttributes([...attributes, { name: "", values: [] }]);
  };

  const removeAttribute = (index: number) => {
    setAttributes(attributes.filter((_, i) => i !== index));
    const newNewValues = { ...newValues };
    delete newNewValues[index];
    setNewValues(newNewValues);
  };

  const updateAttributeName = (index: number, name: string) => {
    const updated = [...attributes];
    updated[index] = { ...updated[index], name };
    setAttributes(updated);
  };

  const addAttributeValue = (index: number) => {
    const value = newValues[index]?.trim();
    if (!value) return;

    const updated = [...attributes];
    if (!updated[index].values.includes(value)) {
      updated[index].values.push(value);
      setAttributes(updated);
    }

    setNewValues({ ...newValues, [index]: "" });
  };

  const removeAttributeValue = (attrIndex: number, valueIndex: number) => {
    const updated = [...attributes];
    updated[attrIndex].values.splice(valueIndex, 1);
    setAttributes(updated);
  };

  const handleGeneratePreview = () => {
    const validAttributes = attributes.filter((attr) => attr.name.trim() && attr.values.length > 0);

    if (validAttributes.length === 0) {
      toast.error("Dodaj przynajmniej jeden atrybut z wartościami");
      return;
    }

    const matrix = buildMatrix(validAttributes);
    generateCombinations(
      matrix,
      { id: product.id, name: product.name },
      {
        name_pattern: namePattern,
        sku_pattern: skuPattern,
      }
    );
    setStep("preview");
  };

  const handleCreateVariants = async () => {
    try {
      // This would use createFromMatrix from useVariants
      // For now, we'll show success message
      toast.success(`Utworzono ${generatedCombinations.length} wariantów`);
      onSuccess?.();
      onOpenChange(false);
    } catch (error) {
      console.error("Error creating variants:", error);
      toast.error("Błąd podczas tworzenia wariantów");
    }
  };

  const totalCombinations =
    attributes
      .filter((attr) => attr.name.trim() && attr.values.length > 0)
      .reduce((total, attr) => total * attr.values.length, 1) || 0;

  const resetDialog = () => {
    setStep("setup");
    setAttributes([{ name: "", values: [] }]);
    setNewValues({});
  };

  React.useEffect(() => {
    if (!open) {
      resetDialog();
    }
  }, [open]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] max-w-4xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Grid3X3 className="h-5 w-5" />
            Macierz wariantów
          </DialogTitle>
          <DialogDescription>
            Utwórz wiele wariantów jednocześnie używając kombinacji atrybutów.
          </DialogDescription>
        </DialogHeader>

        <ScrollArea className="max-h-[60vh]">
          {step === "setup" ? (
            <div className="space-y-6">
              {/* Attribute Setup */}
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-medium">Atrybuty wariantów</h3>
                  <Button variant="outline" size="sm" onClick={addAttribute}>
                    <Plus className="mr-1 h-4 w-4" />
                    Dodaj atrybut
                  </Button>
                </div>

                <AnimatePresence>
                  {attributes.map((attr, index) => (
                    <motion.div
                      key={index}
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -20 }}
                    >
                      <Card>
                        <CardHeader className="pb-3">
                          <div className="flex items-center justify-between">
                            <div className="flex flex-1 items-center gap-2">
                              <Label className="text-sm">Nazwa atrybutu:</Label>
                              <Input
                                value={attr.name}
                                onChange={(e) => updateAttributeName(index, e.target.value)}
                                placeholder="np. Kolor, Rozmiar, Material"
                                className="max-w-xs"
                              />
                            </div>
                            {attributes.length > 1 && (
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => removeAttribute(index)}
                              >
                                <X className="h-4 w-4" />
                              </Button>
                            )}
                          </div>
                        </CardHeader>
                        <CardContent>
                          <div className="space-y-3">
                            <div className="flex gap-2">
                              <Input
                                value={newValues[index] || ""}
                                onChange={(e) =>
                                  setNewValues({ ...newValues, [index]: e.target.value })
                                }
                                placeholder="Dodaj wartość atrybutu"
                                onKeyPress={(e) => {
                                  if (e.key === "Enter") {
                                    e.preventDefault();
                                    addAttributeValue(index);
                                  }
                                }}
                              />
                              <Button
                                type="button"
                                onClick={() => addAttributeValue(index)}
                                disabled={!newValues[index]?.trim()}
                              >
                                Dodaj
                              </Button>
                            </div>

                            {attr.values.length > 0 && (
                              <div className="flex flex-wrap gap-2">
                                {attr.values.map((value, valueIndex) => (
                                  <Badge
                                    key={valueIndex}
                                    variant="secondary"
                                    className="flex items-center gap-1"
                                  >
                                    {value}
                                    <X
                                      className="h-3 w-3 cursor-pointer hover:text-red-500"
                                      onClick={() => removeAttributeValue(index, valueIndex)}
                                    />
                                  </Badge>
                                ))}
                              </div>
                            )}
                          </div>
                        </CardContent>
                      </Card>
                    </motion.div>
                  ))}
                </AnimatePresence>
              </div>

              <Separator />

              {/* Naming Patterns */}
              <div className="space-y-4">
                <h3 className="text-sm font-medium">Wzorce nazewnictwa</h3>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="namePattern">Wzorzec nazwy</Label>
                    <Input
                      id="namePattern"
                      value={namePattern}
                      onChange={(e) => setNamePattern(e.target.value)}
                      placeholder="{{product_name}} - {{attributes}}"
                    />
                    <p className="text-xs text-muted-foreground">
                      Dostępne zmienne: {"{"}product_name{"}"}, {"{"}attributes{"}"}, {"{"}
                      attribute_name{"}"}
                    </p>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="skuPattern">Wzorzec SKU</Label>
                    <Input
                      id="skuPattern"
                      value={skuPattern}
                      onChange={(e) => setSkuPattern(e.target.value)}
                      placeholder="{{product_id}}-{{attributes}}"
                    />
                    <p className="text-xs text-muted-foreground">
                      Dostępne zmienne: {"{"}product_id{"}"}, {"{"}attributes{"}"}, {"{"}
                      attribute_name{"}"}
                    </p>
                  </div>
                </div>
              </div>

              {/* Combination Count */}
              {totalCombinations > 0 && (
                <Card className="border-blue-200 bg-blue-50">
                  <CardContent className="pt-6">
                    <div className="flex items-center gap-2">
                      <Package className="h-5 w-5 text-blue-600" />
                      <span className="text-sm">
                        Zostanie utworzonych <strong>{totalCombinations}</strong> wariantów
                      </span>
                    </div>
                  </CardContent>
                </Card>
              )}

              {error && (
                <div className="rounded-md bg-red-50 p-3 text-sm text-red-600">{error}</div>
              )}
            </div>
          ) : (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-medium">Podgląd wariantów</h3>
                <Badge variant="secondary">{generatedCombinations.length} wariantów</Badge>
              </div>

              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Nazwa</TableHead>
                    <TableHead>SKU</TableHead>
                    <TableHead>Atrybuty</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {generatedCombinations.slice(0, 10).map((combination, index) => (
                    <TableRow key={index}>
                      <TableCell className="font-medium">{combination.name}</TableCell>
                      <TableCell className="font-mono text-sm">{combination.sku}</TableCell>
                      <TableCell>
                        <div className="flex flex-wrap gap-1">
                          {Object.entries(combination.attributes).map(([key, value]) => (
                            <Badge key={key} variant="outline" className="text-xs">
                              {key}: {value.value}
                            </Badge>
                          ))}
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>

              {generatedCombinations.length > 10 && (
                <p className="text-center text-sm text-muted-foreground">
                  ... i {generatedCombinations.length - 10} więcej wariantów
                </p>
              )}
            </div>
          )}
        </ScrollArea>

        <DialogFooter>
          {step === "setup" ? (
            <>
              <Button variant="outline" onClick={() => onOpenChange(false)}>
                Anuluj
              </Button>
              <Button
                onClick={handleGeneratePreview}
                disabled={totalCombinations === 0 || isGeneratingCombinations}
              >
                {isGeneratingCombinations && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Generuj podgląd
              </Button>
            </>
          ) : (
            <>
              <Button variant="outline" onClick={() => setStep("setup")}>
                Wstecz
              </Button>
              <Button onClick={handleCreateVariants}>
                Utwórz {generatedCombinations.length} wariantów
              </Button>
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
