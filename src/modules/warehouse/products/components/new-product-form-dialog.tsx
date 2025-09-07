"use client";

import * as React from "react";
import { useForm } from "react-hook-form";
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
import { Package, DollarSign } from "lucide-react";
import {
  productService,
  CreateProductData,
  UpdateProductData,
} from "@/modules/warehouse/api/products";
import { useAppStore } from "@/lib/stores/app-store";
import { Tables } from "../../../../../supabase/types/types";

// Simple form schema for basic product creation
const productFormSchema = z.object({
  name: z.string().min(1, "Nazwa produktu jest wymagana"),
  description: z.string().optional(),
  sku: z.string().optional(),
  barcode: z.string().optional(),
  default_unit: z.string().default("szt."),
  purchase_price: z.coerce.number().min(0, "Cena musi być dodatnia").optional(),
  vat_rate: z.coerce.number().min(0).max(100).default(23),
  weight: z.coerce.number().min(0).optional(),
  packaging_type: z.string().optional(),
  initial_quantity: z.coerce.number().min(0).default(0),
  location_id: z.string().optional(),
});

type ProductFormData = z.infer<typeof productFormSchema>;

interface NewProductFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  product?: any; // For editing existing product
  onSuccess?: () => void;
}

export function NewProductFormDialog({
  open,
  onOpenChange,
  product,
  onSuccess,
}: NewProductFormDialogProps) {
  const { activeBranchId, isLoaded } = useAppStore();
  const [availableLocations, setAvailableLocations] = React.useState<Tables<"locations">[]>([]);
  const [isLoadingData, setIsLoadingData] = React.useState(false);
  const [isSubmitting, setIsSubmitting] = React.useState(false);

  const isEditing = !!product;

  // Load locations when branch is available
  React.useEffect(() => {
    if (!activeBranchId || !isLoaded || !open) return;

    const loadLocations = async () => {
      setIsLoadingData(true);
      try {
        const locations = await productService.getLocationsByBranch(activeBranchId);
        setAvailableLocations(locations);
      } catch (error) {
        console.error("Error loading locations:", error);
      } finally {
        setIsLoadingData(false);
      }
    };

    loadLocations();
  }, [activeBranchId, isLoaded, open]);

  const form = useForm<ProductFormData>({
    resolver: zodResolver(productFormSchema),
    defaultValues: {
      name: product?.name || "",
      description: product?.description || "",
      sku: product?.sku || "",
      barcode: product?.barcode || "",
      default_unit: product?.default_unit || "szt.",
      purchase_price: product?.inventory_data?.purchase_price || 0,
      vat_rate: product?.inventory_data?.vat_rate || 23,
      weight: product?.inventory_data?.weight || 0,
      packaging_type: product?.inventory_data?.packaging_type || "",
      initial_quantity: 0,
      location_id: "",
    },
  });

  const onSubmit = async (data: ProductFormData) => {
    if (!activeBranchId) {
      console.error("No active branch selected");
      return;
    }

    setIsSubmitting(true);
    try {
      if (isEditing) {
        // Update existing product
        const updateData: UpdateProductData = {
          id: product.id,
          name: data.name,
          description: data.description,
          sku: data.sku,
          barcode: data.barcode,
          default_unit: data.default_unit,
          purchase_price: data.purchase_price,
          vat_rate: data.vat_rate,
          weight: data.weight,
          packaging_type: data.packaging_type,
        };
        await productService.updateProduct(updateData);
      } else {
        // Create new product
        const createData: CreateProductData = {
          name: data.name,
          description: data.description,
          sku: data.sku,
          barcode: data.barcode,
          default_unit: data.default_unit,
          purchase_price: data.purchase_price,
          vat_rate: data.vat_rate,
          weight: data.weight,
          packaging_type: data.packaging_type,
          initial_quantity: data.initial_quantity,
          location_id: data.location_id,
          variant_name: data.name, // Use product name as default variant name
        };
        await productService.createProduct(createData);
      }

      // Success - close dialog and refresh
      onOpenChange(false);
      form.reset();
      onSuccess?.();
    } catch (error) {
      console.error(`Error ${isEditing ? "updating" : "creating"} product:`, error);
      // You can add a toast notification here
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleClose = () => {
    onOpenChange(false);
    form.reset();
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-h-[90vh] overflow-hidden sm:max-w-[600px]">
        <DialogHeader>
          <DialogTitle>{isEditing ? "Edytuj produkt" : "Dodaj nowy produkt"}</DialogTitle>
          <DialogDescription>
            {isEditing ? "Zaktualizuj informacje o produkcie." : "Dodaj nowy produkt do magazynu."}
          </DialogDescription>
        </DialogHeader>

        <ScrollArea className="max-h-[60vh] overflow-y-auto px-1">
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
              {/* Basic Product Info */}
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
                      <FormLabel>SKU</FormLabel>
                      <FormControl>
                        <Input placeholder="Kod produktu" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                <FormField
                  control={form.control}
                  name="barcode"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Kod kreskowy (EAN)</FormLabel>
                      <FormControl>
                        <Input placeholder="Kod kreskowy" {...field} />
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
                      <FormLabel>Jednostka</FormLabel>
                      <FormControl>
                        <Input placeholder="szt., kg, litr" {...field} />
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
                      <Textarea
                        placeholder="Szczegółowy opis produktu..."
                        className="min-h-[80px]"
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {/* Inventory Data */}
              <div className="space-y-4 rounded-lg border p-4">
                <h3 className="font-semibold">Dane inwentarzowe</h3>

                <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                  <FormField
                    control={form.control}
                    name="purchase_price"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Cena zakupu (PLN)</FormLabel>
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
                    name="vat_rate"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Stawka VAT (%)</FormLabel>
                        <FormControl>
                          <Input type="number" min="0" max="100" placeholder="23" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                  <FormField
                    control={form.control}
                    name="weight"
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
                    name="packaging_type"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Typ opakowania</FormLabel>
                        <FormControl>
                          <Input placeholder="Karton, Folia, Plastik" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
              </div>

              {/* Initial Stock - Only for new products */}
              {!isEditing && (
                <div className="space-y-4 rounded-lg border p-4">
                  <h3 className="font-semibold">Stan początkowy</h3>

                  <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                    <FormField
                      control={form.control}
                      name="location_id"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Lokalizacja</FormLabel>
                          <Select onValueChange={field.onChange} value={field.value}>
                            <FormControl>
                              <SelectTrigger>
                                <SelectValue placeholder="Wybierz lokalizację" />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              {availableLocations.map((location) => (
                                <SelectItem key={location.id} value={location.id}>
                                  {location.name} {location.code && `(${location.code})`}
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
                      name="initial_quantity"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Ilość początkowa</FormLabel>
                          <FormControl>
                            <Input type="number" min="0" placeholder="0" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>
                </div>
              )}
            </form>
          </Form>
        </ScrollArea>

        <DialogFooter>
          <Button type="button" variant="outline" onClick={handleClose}>
            Anuluj
          </Button>
          <Button onClick={form.handleSubmit(onSubmit)} disabled={isSubmitting || isLoadingData}>
            {isSubmitting ? "Zapisywanie..." : isEditing ? "Zapisz zmiany" : "Dodaj produkt"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
