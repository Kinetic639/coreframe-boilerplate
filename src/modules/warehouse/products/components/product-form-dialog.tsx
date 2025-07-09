// src/modules/warehouse/products/components/product-form-dialog.tsx
"use client";

import * as React from "react";
import { useForm, useFieldArray } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { PlusCircle, MinusCircle, Package, DollarSign, Ruler } from "lucide-react";
import {
  getMockSuppliers,
  getMockLocations,
  ProductWithDetails,
} from "@/lib/mock/products-extended";

// Zod Schemas
const productStockLocationSchema = z.object({
  location_id: z.string().min(1, "Lokalizacja jest wymagana"),
  quantity: z.preprocess((val) => Number(val), z.number().min(0, "Ilość musi być dodatnia")),
});

const productInventoryDataSchema = z.object({
  purchase_price: z.preprocess(
    (val) => Number(val),
    z.number().min(0, "Cena zakupu musi być dodatnia").optional()
  ),
  vat_rate: z.preprocess((val) => Number(val), z.number().min(0).max(100).optional()),
  weight: z.preprocess((val) => Number(val), z.number().min(0).optional()),
  dimensions: z.string().optional(), // Simplified, could be object
  packaging_type: z.string().optional(),
});

const productVariantSchema = z.object({
  name: z.string().min(1, "Nazwa wariantu jest wymagana"),
  sku: z.string().optional(),
  attributes: z.string().optional(), // e.g., "color: red, size: M"
  inventory: productInventoryDataSchema.optional(),
  stock_locations: z.array(productStockLocationSchema).optional(),
});

const productFormSchema = z.object({
  name: z.string().min(1, "Nazwa produktu jest wymagana"),
  sku: z.string().optional(),
  barcode: z.string().optional(),
  description: z.string().optional(),
  default_unit: z.string().optional(),
  supplier_id: z.string().optional(),
  variants: z.array(productVariantSchema).min(1, "Wymagany jest co najmniej jeden wariant"),
});

type ProductFormData = z.infer<typeof productFormSchema>;

interface ProductFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  product?: ProductWithDetails; // For editing existing product
  onSave: (data: ProductFormData) => void;
}

export function ProductFormDialog({ open, onOpenChange, product, onSave }: ProductFormDialogProps) {
  const isEditing = !!product;

  const availableSuppliers = React.useMemo(() => getMockSuppliers(), []);
  const availableLocations = React.useMemo(() => getMockLocations(), []);

  const form = useForm<ProductFormData>({
    resolver: zodResolver(productFormSchema),
    defaultValues: {
      name: product?.name || "",
      sku: product?.sku || "",
      barcode: product?.barcode || "",
      description: product?.description || "",
      default_unit: product?.default_unit || "pcs",
      supplier_id: product?.suppliers?.[0]?.id || "", // Assuming first supplier for default
      variants: product?.variants?.length
        ? product.variants.map((v) => ({
            name: v.name,
            sku: v.sku || "",
            attributes: v.attributes ? JSON.stringify(v.attributes) : "",
            inventory: v.inventory_data
              ? {
                  purchase_price: v.inventory_data.purchase_price || 0,
                  vat_rate: v.inventory_data.vat_rate || 23,
                  weight: v.inventory_data.weight || 0,
                  dimensions: v.inventory_data.dimensions
                    ? JSON.stringify(v.inventory_data.dimensions)
                    : "",
                  packaging_type: v.inventory_data.packaging_type || "",
                }
              : undefined,
            stock_locations: v.stock_locations.map((sl) => ({
              location_id: sl.location_id || "",
              quantity: sl.quantity,
            })),
          }))
        : [
            {
              name: "Standard",
              sku: "",
              attributes: "",
              inventory: {
                purchase_price: 0,
                vat_rate: 23,
                weight: 0,
                dimensions: "",
                packaging_type: "",
              },
              stock_locations: [{ location_id: "", quantity: 0 }],
            },
          ],
    },
  });

  const {
    fields: variantFields,
    append: appendVariant,
    remove: removeVariant,
  } = useFieldArray({
    control: form.control,
    name: "variants",
  });

  const onSubmit = (data: ProductFormData) => {
    console.log("Form Data:", data);
    onSave(data);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex max-h-[90vh] flex-col p-0 sm:max-w-[800px]">
        <ScrollArea className="flex-1 overflow-y-auto px-6 py-4">
          <DialogHeader>
            <DialogTitle>{isEditing ? "Edytuj produkt" : "Dodaj nowy produkt"}</DialogTitle>
            <DialogDescription>
              {isEditing
                ? "Zaktualizuj informacje o produkcie i jego wariantach."
                : "Dodaj nowy produkt do magazynu, wraz z wariantami i danymi inwentarzowymi."}
            </DialogDescription>
          </DialogHeader>

          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
              {/* Product Basic Info */}
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                <FormField
                  control={form.control}
                  name="name"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Nazwa produktu *</FormLabel>
                      <FormControl>
                        <Input placeholder="Nazwa produktu" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="sku"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>SKU produktu</FormLabel>
                      <FormControl>
                        <Input placeholder="Główny SKU produktu" {...field} />
                      </FormControl>
                      <FormDescription>Unikalny kod produktu</FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="barcode"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Kod kreskowy (EAN)</FormLabel>
                      <FormControl>
                        <Input placeholder="Kod kreskowy produktu" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="default_unit"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Jednostka domyślna</FormLabel>
                      <FormControl>
                        <Input placeholder="np. szt., kg, litr" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
              <FormField
                control={form.control}
                name="description"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Opis produktu</FormLabel>
                    <FormControl>
                      <Textarea placeholder="Szczegółowy opis produktu..." {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="supplier_id"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Dostawca domyślny</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Wybierz dostawcę" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="no-supplier">Brak</SelectItem>
                        {availableSuppliers.map((supplier) => (
                          <SelectItem key={supplier.id} value={supplier.id}>
                            {supplier.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {/* Product Variants */}
              <div className="space-y-4 rounded-lg border p-4">
                <h3 className="text-lg font-semibold">Warianty produktu</h3>
                {variantFields.map((variant, index) => (
                  <div key={variant.id} className="relative rounded-md border p-4">
                    <h4 className="mb-4 text-base font-medium">Wariant {index + 1}</h4>
                    <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                      <FormField
                        control={form.control}
                        name={`variants.${index}.name`}
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Nazwa wariantu *</FormLabel>
                            <FormControl>
                              <Input placeholder="np. Czerwony, Rozmiar M" {...field} />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={form.control}
                        name={`variants.${index}.sku`}
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>SKU wariantu</FormLabel>
                            <FormControl>
                              <Input placeholder="SKU wariantu" {...field} />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={form.control}
                        name={`variants.${index}.attributes`}
                        render={({ field }) => (
                          <FormItem className="md:col-span-2">
                            <FormLabel>Atrybuty (JSON/tekst)</FormLabel>
                            <FormControl>
                              <Input placeholder='np. { "color": "red", "size": "M" }' {...field} />
                            </FormControl>
                            <FormDescription>
                              Atrybuty wariantu, np. kolor, rozmiar. Możesz użyć formatu JSON.
                            </FormDescription>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </div>

                    {/* Inventory Data for Variant */}
                    <div className="mt-6 space-y-4 rounded-md border bg-muted/20 p-4">
                      <h5 className="text-md font-semibold">Dane inwentarzowe</h5>
                      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                        <FormField
                          control={form.control}
                          name={`variants.${index}.inventory.purchase_price`}
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Cena zakupu</FormLabel>
                              <FormControl>
                                <div className="relative">
                                  <DollarSign className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                                  <Input
                                    type="number"
                                    step="0.01"
                                    placeholder="0.00"
                                    className="pl-10"
                                    {...field}
                                  />
                                </div>
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                        <FormField
                          control={form.control}
                          name={`variants.${index}.inventory.vat_rate`}
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Stawka VAT (%)</FormLabel>
                              <FormControl>
                                <Input type="number" step="1" placeholder="23" {...field} />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                        <FormField
                          control={form.control}
                          name={`variants.${index}.inventory.weight`}
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Waga (kg)</FormLabel>
                              <FormControl>
                                <div className="relative">
                                  <Package className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                                  <Input
                                    type="number"
                                    step="0.01"
                                    placeholder="0.00"
                                    className="pl-10"
                                    {...field}
                                  />
                                </div>
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                        <FormField
                          control={form.control}
                          name={`variants.${index}.inventory.dimensions`}
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Wymiary (dł. x szer. x wys.)</FormLabel>
                              <FormControl>
                                <div className="relative">
                                  <Ruler className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                                  <Input
                                    placeholder="np. 10x10x10 cm"
                                    className="pl-10"
                                    {...field}
                                  />
                                </div>
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                        <FormField
                          control={form.control}
                          name={`variants.${index}.inventory.packaging_type`}
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Typ opakowania</FormLabel>
                              <FormControl>
                                <Input placeholder="np. Karton, Folia" {...field} />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                      </div>
                    </div>

                    {/* Stock Locations for Variant */}
                    <div className="mt-6 space-y-4 rounded-md border bg-muted/20 p-4">
                      <h5 className="text-md font-semibold">Stany magazynowe</h5>
                      {form.watch(`variants.${index}.stock_locations`)?.map((stock, stockIndex) => (
                        <div key={stockIndex} className="flex items-end gap-2">
                          <FormField
                            control={form.control}
                            name={`variants.${index}.stock_locations.${stockIndex}.location_id`}
                            render={({ field }) => (
                              <FormItem className="flex-grow">
                                <FormLabel>Lokalizacja</FormLabel>
                                <Select onValueChange={field.onChange} value={field.value}>
                                  <FormControl>
                                    <SelectTrigger>
                                      <SelectValue placeholder="Wybierz lokalizację" />
                                    </SelectTrigger>
                                  </FormControl>
                                  <SelectContent>
                                    {availableLocations.map((loc) => (
                                      <SelectItem key={loc.id} value={loc.id}>
                                        {loc.name} ({loc.code})
                                      </SelectItem>
                                    ))}
                                  </SelectContent>
                                </Select>
                                <FormMessage />
                              </FormItem>
                            )}
                          />
                          <FormField
                            control={form.control}
                            name={`variants.${index}.stock_locations.${stockIndex}.quantity`}
                            render={({ field }) => (
                              <FormItem className="w-24">
                                <FormLabel>Ilość</FormLabel>
                                <FormControl>
                                  <Input type="number" step="1" placeholder="0" {...field} />
                                </FormControl>
                                <FormMessage />
                              </FormItem>
                            )}
                          />
                          {form.watch(`variants.${index}.stock_locations`)!.length > 1 && (
                            <Button
                              type="button"
                              variant="destructive"
                              size="icon"
                              onClick={() => {
                                const currentStockLocations = form.getValues(
                                  `variants.${index}.stock_locations`
                                );
                                const newStockLocations = currentStockLocations?.filter(
                                  (_, i) => i !== stockIndex
                                );
                                form.setValue(
                                  `variants.${index}.stock_locations`,
                                  newStockLocations
                                );
                              }}
                            >
                              <MinusCircle className="h-4 w-4" />
                            </Button>
                          )}
                        </div>
                      ))}
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          const currentStockLocations =
                            form.getValues(`variants.${index}.stock_locations`) || [];
                          form.setValue(`variants.${index}.stock_locations`, [
                            ...currentStockLocations,
                            { location_id: "", quantity: 0 },
                          ]);
                        }}
                      >
                        <PlusCircle className="mr-2 h-4 w-4" /> Dodaj lokalizację magazynową
                      </Button>
                    </div>

                    {variantFields.length > 1 && (
                      <Button
                        type="button"
                        variant="destructive"
                        size="sm"
                        className="absolute right-4 top-4"
                        onClick={() => removeVariant(index)}
                      >
                        <MinusCircle className="mr-2 h-4 w-4" /> Usuń wariant
                      </Button>
                    )}
                  </div>
                ))}
                <Button
                  type="button"
                  variant="outline"
                  onClick={() =>
                    appendVariant({
                      name: "",
                      sku: "",
                      attributes: "",
                      inventory: {
                        purchase_price: 0,
                        vat_rate: 23,
                        weight: 0,
                        dimensions: "",
                        packaging_type: "",
                      },
                      stock_locations: [{ location_id: "", quantity: 0 }],
                    })
                  }
                >
                  <PlusCircle className="mr-2 h-4 w-4" /> Dodaj kolejny wariant
                </Button>
              </div>

              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                  Anuluj
                </Button>
                <Button type="submit">{isEditing ? "Zapisz zmiany" : "Dodaj produkt"}</Button>
              </DialogFooter>
            </form>
          </Form>
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
}
