"use client";

import * as React from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Plus,
  MoreHorizontal,
  Edit,
  Trash2,
  Copy,
  Package,
  BarChart3,
  Grid3X3,
  Target,
} from "lucide-react";
import { motion } from "framer-motion";
import { toast } from "react-toastify";
import type { ProductWithDetails } from "@/modules/warehouse/types/flexible-products";
import { useVariants } from "@/modules/warehouse/hooks/use-variants";
import { VariantFormDialog } from "./variant-form-dialog";
import { VariantMatrixDialog } from "./variant-matrix-dialog";
import { VariantCompareDialog } from "./variant-compare-dialog";

interface VariantManagementCardProps {
  product: ProductWithDetails;
  onProductUpdate?: () => void;
}

export function VariantManagementCard({ product, onProductUpdate }: VariantManagementCardProps) {
  const [selectedVariants, setSelectedVariants] = React.useState<string[]>([]);
  const [editingVariant, setEditingVariant] = React.useState<any>(null);
  const [showVariantForm, setShowVariantForm] = React.useState(false);
  const [showMatrixDialog, setShowMatrixDialog] = React.useState(false);
  const [showCompareDialog, setShowCompareDialog] = React.useState(false);

  const { deleteVariant, isDeleting } = useVariants();

  const handleDeleteVariant = async (variantId: string) => {
    if (!confirm("Czy na pewno chcesz usunąć ten wariant? Ta akcja jest nieodwracalna.")) {
      return;
    }

    try {
      await deleteVariant(variantId);
      toast.success("Wariant został usunięty");
      onProductUpdate?.();
    } catch (error) {
      console.error("Error deleting variant:", error);
    }
  };

  const handleEditVariant = (variant: any) => {
    setEditingVariant(variant);
    setShowVariantForm(true);
  };

  const handleVariantSuccess = () => {
    setShowVariantForm(false);
    setEditingVariant(null);
    onProductUpdate?.();
  };

  const formatAttributeValue = (attr: any) => {
    if (attr.value_text) return attr.value_text;
    if (attr.value_number !== null) return attr.value_number;
    if (attr.value_boolean !== null) return attr.value_boolean ? "Tak" : "Nie";
    if (attr.value_date) return attr.value_date;
    if (attr.value_json) return JSON.stringify(attr.value_json);
    return "-";
  };

  return (
    <>
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Package className="h-5 w-5" />
              <CardTitle>Warianty produktu</CardTitle>
              <Badge variant="secondary">{product.variants?.length || 0}</Badge>
            </div>
            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm" onClick={() => setShowMatrixDialog(true)}>
                <Grid3X3 className="mr-1 h-4 w-4" />
                Macierz
              </Button>
              {selectedVariants.length > 1 && (
                <Button variant="outline" size="sm" onClick={() => setShowCompareDialog(true)}>
                  <BarChart3 className="mr-1 h-4 w-4" />
                  Porównaj ({selectedVariants.length})
                </Button>
              )}
              <Button
                size="sm"
                onClick={() => {
                  setEditingVariant(null);
                  setShowVariantForm(true);
                }}
              >
                <Plus className="mr-1 h-4 w-4" />
                Dodaj wariant
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {!product.variants || product.variants.length === 0 ? (
            <div className="py-8 text-center">
              <Package className="mx-auto mb-4 h-12 w-12 text-muted-foreground" />
              <h3 className="mb-2 text-lg font-medium">Brak wariantów</h3>
              <p className="mb-4 text-muted-foreground">
                Ten produkt nie ma jeszcze żadnych wariantów. Dodaj pierwszy wariant aby rozpocząć.
              </p>
              <Button onClick={() => setShowVariantForm(true)}>
                <Plus className="mr-2 h-4 w-4" />
                Dodaj pierwszy wariant
              </Button>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-12">
                    <input
                      type="checkbox"
                      checked={selectedVariants.length === product.variants.length}
                      onChange={(e) => {
                        if (e.target.checked) {
                          setSelectedVariants(product.variants.map((v) => v.id));
                        } else {
                          setSelectedVariants([]);
                        }
                      }}
                      className="rounded"
                    />
                  </TableHead>
                  <TableHead>Nazwa</TableHead>
                  <TableHead>SKU</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Atrybuty</TableHead>
                  <TableHead>Stan magazynowy</TableHead>
                  <TableHead className="w-16"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {product.variants.map((variant, index) => (
                  <motion.tr
                    key={variant.id}
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: index * 0.1 }}
                    className="hover:bg-muted/50"
                  >
                    <TableCell>
                      <input
                        type="checkbox"
                        checked={selectedVariants.includes(variant.id)}
                        onChange={(e) => {
                          if (e.target.checked) {
                            setSelectedVariants([...selectedVariants, variant.id]);
                          } else {
                            setSelectedVariants(selectedVariants.filter((id) => id !== variant.id));
                          }
                        }}
                        className="rounded"
                      />
                    </TableCell>
                    <TableCell className="font-medium">
                      <div className="flex items-center gap-2">
                        {variant.name}
                        {variant.is_default && (
                          <Badge variant="outline" className="text-xs">
                            Domyślny
                          </Badge>
                        )}
                      </div>
                    </TableCell>
                    <TableCell className="font-mono text-sm">{variant.sku || "-"}</TableCell>
                    <TableCell>
                      <Badge variant={variant.status === "active" ? "default" : "secondary"}>
                        {variant.status === "active" ? "Aktywny" : "Nieaktywny"}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <div className="flex max-w-xs flex-wrap gap-1">
                        {variant.attributes?.slice(0, 3).map((attr) => (
                          <Badge key={attr.id} variant="outline" className="text-xs">
                            {attr.attribute_key}: {formatAttributeValue(attr)}
                          </Badge>
                        ))}
                        {variant.attributes && variant.attributes.length > 3 && (
                          <Badge variant="outline" className="text-xs">
                            +{variant.attributes.length - 3} więcej
                          </Badge>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      {variant.stock_snapshots && variant.stock_snapshots.length > 0 ? (
                        <div className="text-sm">
                          <div className="font-medium">
                            {variant.stock_snapshots.reduce(
                              (sum, s) => sum + (s.quantity_on_hand || 0),
                              0
                            )}{" "}
                            szt.
                          </div>
                          <div className="text-muted-foreground">
                            {variant.stock_snapshots.length} lokalizacji
                          </div>
                        </div>
                      ) : (
                        <span className="text-muted-foreground">Brak danych</span>
                      )}
                    </TableCell>
                    <TableCell>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="sm">
                            <MoreHorizontal className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onClick={() => handleEditVariant(variant)}>
                            <Edit className="mr-2 h-4 w-4" />
                            Edytuj
                          </DropdownMenuItem>
                          <DropdownMenuItem>
                            <Copy className="mr-2 h-4 w-4" />
                            Duplikuj
                          </DropdownMenuItem>
                          <DropdownMenuItem>
                            <Target className="mr-2 h-4 w-4" />
                            Zarządzaj stanem
                          </DropdownMenuItem>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem
                            onClick={() => handleDeleteVariant(variant.id)}
                            className="text-red-600"
                            disabled={isDeleting}
                          >
                            <Trash2 className="mr-2 h-4 w-4" />
                            Usuń
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </motion.tr>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Dialogs */}
      <VariantFormDialog
        open={showVariantForm}
        onOpenChange={setShowVariantForm}
        product={product}
        variant={editingVariant}
        onSuccess={handleVariantSuccess}
      />

      <VariantMatrixDialog
        open={showMatrixDialog}
        onOpenChange={setShowMatrixDialog}
        product={product}
        onSuccess={onProductUpdate}
      />

      <VariantCompareDialog
        open={showCompareDialog}
        onOpenChange={setShowCompareDialog}
        variantIds={selectedVariants}
        onClose={() => setSelectedVariants([])}
      />
    </>
  );
}
