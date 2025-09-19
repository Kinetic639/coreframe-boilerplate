"use client";

import * as React from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Loader2, BarChart3, Package, TrendingUp } from "lucide-react";
import { motion } from "framer-motion";
import { useVariantAnalytics } from "@/modules/warehouse/hooks/use-variants";

interface VariantCompareDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  variantIds: string[];
  onClose?: () => void;
}

export function VariantCompareDialog({
  open,
  onOpenChange,
  variantIds,
  onClose,
}: VariantCompareDialogProps) {
  const { compareVariants, comparisonData, isComparing, error, clearComparisonData } =
    useVariantAnalytics();

  React.useEffect(() => {
    if (open && variantIds.length > 0) {
      compareVariants(variantIds);
    }
  }, [open, variantIds, compareVariants]);

  React.useEffect(() => {
    if (!open) {
      clearComparisonData();
      onClose?.();
    }
  }, [open, clearComparisonData, onClose]);

  const handleClose = () => {
    onOpenChange(false);
  };

  if (isComparing) {
    return (
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-2xl">
          <div className="flex items-center justify-center py-8">
            <div className="text-center">
              <Loader2 className="mx-auto mb-4 h-8 w-8 animate-spin" />
              <p>Porównywanie wariantów...</p>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    );
  }

  if (error) {
    return (
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Błąd porównywania</DialogTitle>
          </DialogHeader>
          <div className="py-4">
            <p className="text-red-600">{error}</p>
          </div>
          <div className="flex justify-end">
            <Button onClick={handleClose}>Zamknij</Button>
          </div>
        </DialogContent>
      </Dialog>
    );
  }

  if (!comparisonData) {
    return null;
  }

  const { variants, comparison_matrix } = comparisonData;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] max-w-6xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <BarChart3 className="h-5 w-5" />
            Porównanie wariantów
          </DialogTitle>
          <DialogDescription>Porównanie {variants.length} wybranych wariantów</DialogDescription>
        </DialogHeader>

        <ScrollArea className="max-h-[70vh]">
          <div className="space-y-6">
            {/* Basic Information Comparison */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Package className="h-4 w-4" />
                  Podstawowe informacje
                </CardTitle>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Właściwość</TableHead>
                      {variants.map((variant, index) => (
                        <TableHead key={variant.id} className="text-center">
                          <div className="space-y-1">
                            <div className="font-medium">{variant.name}</div>
                            <Badge variant="outline" className="text-xs">
                              Wariant {index + 1}
                            </Badge>
                          </div>
                        </TableHead>
                      ))}
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    <TableRow>
                      <TableCell className="font-medium">SKU</TableCell>
                      {variants.map((variant) => (
                        <TableCell key={variant.id} className="text-center font-mono text-sm">
                          {variant.sku || "-"}
                        </TableCell>
                      ))}
                    </TableRow>
                    <TableRow>
                      <TableCell className="font-medium">Kod kreskowy</TableCell>
                      {variants.map((variant) => (
                        <TableCell key={variant.id} className="text-center font-mono text-sm">
                          {variant.barcode || "-"}
                        </TableCell>
                      ))}
                    </TableRow>
                    <TableRow>
                      <TableCell className="font-medium">Status</TableCell>
                      {variants.map((variant) => (
                        <TableCell key={variant.id} className="text-center">
                          <Badge variant={variant.status === "active" ? "default" : "secondary"}>
                            {variant.status === "active" ? "Aktywny" : "Nieaktywny"}
                          </Badge>
                        </TableCell>
                      ))}
                    </TableRow>
                  </TableBody>
                </Table>
              </CardContent>
            </Card>

            {/* Attributes Comparison */}
            {Object.keys(comparison_matrix).length > 0 && (
              <Card>
                <CardHeader>
                  <CardTitle>Porównanie atrybutów</CardTitle>
                </CardHeader>
                <CardContent>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Atrybut</TableHead>
                        {variants.map((variant, index) => (
                          <TableHead key={variant.id} className="text-center">
                            Wariant {index + 1}
                          </TableHead>
                        ))}
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {Object.entries(comparison_matrix).map(([attributeKey, values]) => (
                        <TableRow key={attributeKey}>
                          <TableCell className="font-medium">{attributeKey}</TableCell>
                          {(values as any[]).map((value, index) => (
                            <TableCell key={index} className="text-center">
                              {value ? (
                                <Badge variant="outline">{String(value)}</Badge>
                              ) : (
                                <span className="text-muted-foreground">-</span>
                              )}
                            </TableCell>
                          ))}
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>
            )}

            {/* Stock Comparison */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <TrendingUp className="h-4 w-4" />
                  Stan magazynowy
                </CardTitle>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Metryka</TableHead>
                      {variants.map((variant, index) => (
                        <TableHead key={variant.id} className="text-center">
                          Wariant {index + 1}
                        </TableHead>
                      ))}
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    <TableRow>
                      <TableCell className="font-medium">Stan na ręce</TableCell>
                      {variants.map((variant) => {
                        const totalStock =
                          variant.stock_snapshots?.reduce(
                            (sum, s) => sum + (s.quantity_on_hand || 0),
                            0
                          ) || 0;
                        return (
                          <TableCell key={variant.id} className="text-center font-medium">
                            {totalStock} szt.
                          </TableCell>
                        );
                      })}
                    </TableRow>
                    <TableRow>
                      <TableCell className="font-medium">Zarezerwowane</TableCell>
                      {variants.map((variant) => {
                        const totalReserved =
                          variant.stock_snapshots?.reduce(
                            (sum, s) => sum + (s.quantity_reserved || 0),
                            0
                          ) || 0;
                        return (
                          <TableCell key={variant.id} className="text-center">
                            {totalReserved} szt.
                          </TableCell>
                        );
                      })}
                    </TableRow>
                    <TableRow>
                      <TableCell className="font-medium">Wartość stanu</TableCell>
                      {variants.map((variant) => {
                        const totalValue =
                          variant.stock_snapshots?.reduce(
                            (sum, s) => sum + (s.total_value || 0),
                            0
                          ) || 0;
                        return (
                          <TableCell key={variant.id} className="text-center">
                            {totalValue.toFixed(2)} PLN
                          </TableCell>
                        );
                      })}
                    </TableRow>
                    <TableRow>
                      <TableCell className="font-medium">Liczba lokalizacji</TableCell>
                      {variants.map((variant) => (
                        <TableCell key={variant.id} className="text-center">
                          {variant.stock_snapshots?.length || 0}
                        </TableCell>
                      ))}
                    </TableRow>
                  </TableBody>
                </Table>
              </CardContent>
            </Card>

            {/* Visual Comparison Grid */}
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
              {variants.map((variant, index) => (
                <motion.div
                  key={variant.id}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: index * 0.1 }}
                >
                  <Card className="h-full">
                    <CardHeader>
                      <CardTitle className="text-sm">{variant.name}</CardTitle>
                      <div className="flex gap-1">
                        <Badge variant="outline" className="text-xs">
                          {variant.sku || "Brak SKU"}
                        </Badge>
                        <Badge
                          variant={variant.status === "active" ? "default" : "secondary"}
                          className="text-xs"
                        >
                          {variant.status === "active" ? "Aktywny" : "Nieaktywny"}
                        </Badge>
                      </div>
                    </CardHeader>
                    <CardContent className="space-y-3">
                      {/* Stock summary */}
                      <div className="rounded-lg bg-muted p-3 text-center">
                        <div className="text-2xl font-bold">
                          {variant.stock_snapshots?.reduce(
                            (sum, s) => sum + (s.quantity_on_hand || 0),
                            0
                          ) || 0}
                        </div>
                        <div className="text-sm text-muted-foreground">sztuk na stanie</div>
                      </div>

                      {/* Key attributes */}
                      <div className="space-y-1">
                        {variant.attributes?.slice(0, 3).map((attr: any) => (
                          <div key={attr.attribute_key} className="flex justify-between text-sm">
                            <span className="text-muted-foreground">{attr.attribute_key}:</span>
                            <span className="font-medium">
                              {attr.value_text ||
                                attr.value_number ||
                                (attr.value_boolean !== null
                                  ? attr.value_boolean
                                    ? "Tak"
                                    : "Nie"
                                  : "-")}
                            </span>
                          </div>
                        ))}
                      </div>
                    </CardContent>
                  </Card>
                </motion.div>
              ))}
            </div>
          </div>
        </ScrollArea>

        <div className="flex justify-end pt-4">
          <Button onClick={handleClose}>Zamknij</Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
