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
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import {
  Package,
  DollarSign,
  FileText,
  Wand2,
  Plus,
  File,
  CheckCircle,
  ArrowRight,
  ArrowLeft,
  Layers,
  Settings,
  List,
  Grid3X3,
} from "lucide-react";
import {
  productService,
  CreateProductData,
  UpdateProductData,
} from "@/modules/warehouse/api/products";
import { templateService } from "@/modules/warehouse/api/template-service";
import { useAppStore } from "@/lib/stores/app-store";
import { Tables } from "../../../../../supabase/types/types";
import type { TemplateWithAttributes } from "@/modules/warehouse/types/template";
import { TemplateBuilder } from "@/modules/warehouse/components/templates/TemplateBuilder";
import { ProductContextViews } from "./product-context-views";
import { VariantCreationInterface } from "./variant-creation-interface";
import { toast } from "react-toastify";

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

type CreationMode = "fresh" | "template";

interface NewProductFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  product?: any; // For editing existing product
  onSuccess?: () => void;
  defaultMode?: CreationMode;
}

export function NewProductFormDialog({
  open,
  onOpenChange,
  product,
  onSuccess,
  defaultMode = "fresh",
}: NewProductFormDialogProps) {
  const { activeBranchId, activeOrgId, isLoaded } = useAppStore();
  const [availableLocations, setAvailableLocations] = React.useState<Tables<"locations">[]>([]);
  const [isLoadingData, setIsLoadingData] = React.useState(false);
  const [isSubmitting, setIsSubmitting] = React.useState(false);
  const [creationMode, setCreationMode] = React.useState<CreationMode>(defaultMode);
  const [availableTemplates, setAvailableTemplates] = React.useState<TemplateWithAttributes[]>([]);
  const [selectedTemplate, setSelectedTemplate] = React.useState<TemplateWithAttributes | null>(
    null
  );
  const [showTemplateBuilder, setShowTemplateBuilder] = React.useState(false);
  const [showSaveAsTemplate, setShowSaveAsTemplate] = React.useState(false);
  const [createdProduct, setCreatedProduct] = React.useState<any>(null);
  const [showContextViews, setShowContextViews] = React.useState(false);
  const [showVariantCreation, setShowVariantCreation] = React.useState(false);
  const [currentStep, setCurrentStep] = React.useState<"create" | "context" | "variants">("create");

  const isEditing = !!product;

  // Load locations and templates when dialog opens
  React.useEffect(() => {
    if (!activeBranchId || !activeOrgId || !isLoaded || !open) return;

    const loadData = async () => {
      setIsLoadingData(true);
      try {
        // Load locations
        const locations = await productService.getLocationsByBranch(activeBranchId);
        setAvailableLocations(locations);

        // Load templates for template selection
        const templates = await templateService.getAllTemplates(activeOrgId);
        const allTemplates = [...templates.system_templates, ...templates.organization_templates];
        setAvailableTemplates(allTemplates);
      } catch (error) {
        console.error("Error loading data:", error);
      } finally {
        setIsLoadingData(false);
      }
    };

    loadData();
  }, [activeBranchId, activeOrgId, isLoaded, open]);

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
          variant_sku: data.sku,
          variant_barcode: data.barcode,
        };
        await productService.updateProduct(updateData);
      } else {
        // Create new product - template-optional creation
        const createData: CreateProductData = {
          template_id: selectedTemplate?.template.id || null, // Template-optional: can be null
          name: data.name,
          description: data.description,
          variant_sku: data.sku,
          variant_barcode: data.barcode,
          variant_name: data.name, // Use product name as default variant name
          organization_id: activeOrgId!, // Required field
        };
        const result = await productService.createProduct(createData);
        setCreatedProduct(result);

        // Show save as template option if created from fresh mode
        if (creationMode === "fresh") {
          setShowSaveAsTemplate(true);
          return; // Don't close dialog yet, let user decide about template
        }

        // After creating product, offer context configuration and variant creation
        setCurrentStep("context");
      }

      // Success - close dialog and refresh
      handleClose();
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
    setCreationMode(defaultMode);
    setSelectedTemplate(null);
    setShowTemplateBuilder(false);
    setShowSaveAsTemplate(false);
    setCreatedProduct(null);
    setShowContextViews(false);
    setShowVariantCreation(false);
    setCurrentStep("create");
  };

  const handleModeChange = (mode: CreationMode) => {
    setCreationMode(mode);
    setSelectedTemplate(null);
    setShowTemplateBuilder(false);
  };

  const handleTemplateSelect = (template: TemplateWithAttributes) => {
    setSelectedTemplate(template);
    setShowTemplateBuilder(true);
  };

  const handleSaveAsTemplate = async (templateData: { name: string; description?: string }) => {
    if (!createdProduct || !activeOrgId) return;

    try {
      await productService.saveProductAsTemplate(createdProduct.id, {
        ...templateData,
        organization_id: activeOrgId,
      });
      toast.success("Product saved as template successfully!");
    } catch (error) {
      console.error("Error saving as template:", error);
      toast.error("Failed to save as template");
    } finally {
      handleClose();
      onSuccess?.();
    }
  };

  const handleSkipTemplate = () => {
    // After skipping template save, move to context configuration
    setShowSaveAsTemplate(false);
    setCurrentStep("context");
  };

  const handleContinueToVariants = () => {
    setCurrentStep("variants");
  };

  const handleFinishSetup = () => {
    handleClose();
    onSuccess?.();
  };

  // Show template builder for template-based creation
  if (showTemplateBuilder && selectedTemplate) {
    return (
      <Dialog open={open} onOpenChange={handleClose}>
        <DialogContent className="max-h-[90vh] max-w-4xl overflow-y-auto">
          <TemplateBuilder
            builderType="product"
            productMode="create"
            baseTemplate={selectedTemplate}
            onSave={(result) => {
              setCreatedProduct(result);
              toast.success("Product created successfully!");
              handleClose();
              onSuccess?.();
            }}
            onCancel={() => {
              setShowTemplateBuilder(false);
              setSelectedTemplate(null);
            }}
          />
        </DialogContent>
      </Dialog>
    );
  }

  // Show save as template dialog
  if (showSaveAsTemplate && createdProduct) {
    return (
      <Dialog open={open} onOpenChange={handleClose}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle>Save as Template?</DialogTitle>
            <DialogDescription>
              Your product was created successfully! Would you like to save it as a template for
              future use?
            </DialogDescription>
          </DialogHeader>
          <SaveAsTemplateForm
            onSave={handleSaveAsTemplate}
            onSkip={handleSkipTemplate}
            productName={createdProduct.name}
          />
        </DialogContent>
      </Dialog>
    );
  }

  // Show context management workflow
  if (currentStep === "context" && createdProduct) {
    return (
      <Dialog open={open} onOpenChange={handleClose}>
        <DialogContent className="max-h-[90vh] max-w-4xl overflow-hidden">
          <DialogHeader>
            <DialogTitle>Configure Product Contexts</DialogTitle>
            <DialogDescription>
              Set up your product for different business contexts like warehouse, ecommerce, B2B,
              and POS.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="flex items-center justify-between rounded-lg border bg-muted/50 p-4">
              <div>
                <h3 className="font-medium">Product Created Successfully!</h3>
                <p className="text-sm text-muted-foreground">
                  {createdProduct.name} is ready. Now configure it for different business contexts.
                </p>
              </div>
              <Badge variant="default" className="gap-1">
                <CheckCircle className="h-3 w-3" />
                Created
              </Badge>
            </div>

            {/* Context Configuration Options */}
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <Card
                className="cursor-pointer hover:shadow-md"
                onClick={() => setShowContextViews(true)}
              >
                <CardContent className="p-4">
                  <div className="flex items-center gap-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-blue-100">
                      <Layers className="h-5 w-5 text-blue-600" />
                    </div>
                    <div>
                      <h4 className="font-medium">Context-Specific Data</h4>
                      <p className="text-sm text-muted-foreground">
                        Set different prices, descriptions for each context
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card className="hover:shadow-md">
                <CardContent className="p-4">
                  <div className="flex items-center gap-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-purple-100">
                      <Settings className="h-5 w-5 text-purple-600" />
                    </div>
                    <div>
                      <h4 className="font-medium">Field Configuration</h4>
                      <p className="text-sm text-muted-foreground">
                        Configure field behavior and API visibility
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>

            <div className="flex items-center justify-between pt-4">
              <Button variant="outline" onClick={handleFinishSetup}>
                Skip Context Setup
              </Button>
              <Button onClick={handleContinueToVariants}>
                Continue to Variants
                <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    );
  }

  // Show variant creation workflow
  if (currentStep === "variants" && createdProduct) {
    return (
      <Dialog open={open} onOpenChange={handleClose}>
        <DialogContent className="max-h-[90vh] max-w-4xl overflow-hidden">
          <DialogHeader>
            <DialogTitle>Create Product Variants</DialogTitle>
            <DialogDescription>
              Add variants like different sizes, colors, or configurations for {createdProduct.name}
              .
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="flex items-center justify-between rounded-lg border bg-muted/50 p-4">
              <div>
                <h3 className="font-medium">Ready for Variants</h3>
                <p className="text-sm text-muted-foreground">
                  Create variants to offer different options of your product.
                </p>
              </div>
              <Badge variant="secondary">Optional</Badge>
            </div>

            {/* Variant Creation Options */}
            <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
              <Card
                className="cursor-pointer hover:shadow-md"
                onClick={() => setShowVariantCreation(true)}
              >
                <CardContent className="p-4">
                  <div className="flex items-center gap-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-green-100">
                      <Package className="h-5 w-5 text-green-600" />
                    </div>
                    <div>
                      <h4 className="font-medium">Single Variant</h4>
                      <p className="text-sm text-muted-foreground">Add one variant manually</p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card
                className="cursor-pointer hover:shadow-md"
                onClick={() => setShowVariantCreation(true)}
              >
                <CardContent className="p-4">
                  <div className="flex items-center gap-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-orange-100">
                      <List className="h-5 w-5 text-orange-600" />
                    </div>
                    <div>
                      <h4 className="font-medium">Bulk Creation</h4>
                      <p className="text-sm text-muted-foreground">
                        Create multiple variants at once
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card
                className="cursor-pointer hover:shadow-md"
                onClick={() => setShowVariantCreation(true)}
              >
                <CardContent className="p-4">
                  <div className="flex items-center gap-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-indigo-100">
                      <Grid3X3 className="h-5 w-5 text-indigo-600" />
                    </div>
                    <div>
                      <h4 className="font-medium">Attribute Matrix</h4>
                      <p className="text-sm text-muted-foreground">
                        Generate all size/color combinations
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>

            <div className="flex items-center justify-between pt-4">
              <Button variant="outline" onClick={() => setCurrentStep("context")}>
                <ArrowLeft className="mr-2 h-4 w-4" />
                Back to Context
              </Button>
              <Button onClick={handleFinishSetup}>Finish Setup</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    );
  }

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
          {!isEditing && (
            <div className="mb-6">
              <CreationModeSelector
                mode={creationMode}
                onModeChange={handleModeChange}
                templatesCount={availableTemplates.length}
              />
            </div>
          )}

          {!isEditing && creationMode === "template" ? (
            <TemplateSelector
              templates={availableTemplates}
              selectedTemplate={selectedTemplate}
              onTemplateSelect={handleTemplateSelect}
              isLoading={isLoadingData}
            />
          ) : (
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
          )}
        </ScrollArea>

        <DialogFooter>
          <Button type="button" variant="outline" onClick={handleClose}>
            Anuluj
          </Button>
          {!isEditing && creationMode === "template" ? (
            <Button
              onClick={() => selectedTemplate && handleTemplateSelect(selectedTemplate)}
              disabled={!selectedTemplate || isSubmitting}
            >
              <Wand2 className="mr-2 h-4 w-4" />
              Create with Template
            </Button>
          ) : (
            <Button onClick={form.handleSubmit(onSubmit)} disabled={isSubmitting || isLoadingData}>
              {isSubmitting ? "Zapisywanie..." : isEditing ? "Zapisz zmiany" : "Dodaj produkt"}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>

      {/* Nested Dialogs */}
      {showContextViews && createdProduct && (
        <ProductContextViews productId={createdProduct.id} onDataChange={() => {}} />
      )}

      {showVariantCreation && createdProduct && (
        <VariantCreationInterface
          open={showVariantCreation}
          onOpenChange={setShowVariantCreation}
          productId={createdProduct.id}
          existingVariants={[]}
          onVariantsCreated={() => {
            setShowVariantCreation(false);
            handleFinishSetup();
          }}
          defaultMode="single"
        />
      )}
    </Dialog>
  );
}

// Creation Mode Selector Component
interface CreationModeSelectorProps {
  mode: CreationMode;
  onModeChange: (mode: CreationMode) => void;
  templatesCount: number;
}

function CreationModeSelector({ mode, onModeChange, templatesCount }: CreationModeSelectorProps) {
  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-lg">How would you like to create your product?</CardTitle>
        <CardDescription>Choose to start fresh or use a pre-built template</CardDescription>
      </CardHeader>
      <CardContent>
        <Tabs value={mode} onValueChange={(value) => onModeChange(value as CreationMode)}>
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="fresh" className="flex items-center gap-2">
              <Plus className="h-4 w-4" />
              Start Fresh
            </TabsTrigger>
            <TabsTrigger value="template" className="flex items-center gap-2">
              <FileText className="h-4 w-4" />
              Use Template
            </TabsTrigger>
          </TabsList>
          <TabsContent value="fresh" className="mt-4">
            <div className="rounded-lg border p-3">
              <p className="text-sm text-muted-foreground">
                Create a product from scratch with custom fields. You can save it as a template
                later.
              </p>
            </div>
          </TabsContent>
          <TabsContent value="template" className="mt-4">
            <div className="rounded-lg border p-3">
              <p className="text-sm text-muted-foreground">
                Use a pre-built template with predefined fields and structure.
                {templatesCount > 0
                  ? ` ${templatesCount} templates available.`
                  : " No templates available yet."}
              </p>
            </div>
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
}

// Template Selector Component
interface TemplateSelectorProps {
  templates: TemplateWithAttributes[];
  selectedTemplate: TemplateWithAttributes | null;
  onTemplateSelect: (template: TemplateWithAttributes) => void;
  isLoading: boolean;
}

function TemplateSelector({
  templates,
  selectedTemplate,
  onTemplateSelect,
  isLoading,
}: TemplateSelectorProps) {
  if (isLoading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center py-8">
          <div className="text-center">
            <Package className="mx-auto h-8 w-8 animate-pulse text-muted-foreground" />
            <p className="mt-2 text-sm text-muted-foreground">Loading templates...</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (templates.length === 0) {
    return (
      <Card>
        <CardContent className="flex flex-col items-center justify-center py-8">
          <FileText className="h-12 w-12 text-muted-foreground" />
          <h3 className="mt-4 text-lg font-medium">No templates available</h3>
          <p className="mt-2 text-center text-sm text-muted-foreground">
            Create your first template or switch to "Start Fresh" mode.
          </p>
        </CardContent>
      </Card>
    );
  }

  const systemTemplates = templates.filter((t) => t.template.is_system);
  const orgTemplates = templates.filter((t) => !t.template.is_system);

  return (
    <div className="space-y-4">
      {systemTemplates.length > 0 && (
        <div>
          <h3 className="mb-3 font-medium">System Templates</h3>
          <div className="grid gap-3">
            {systemTemplates.map((templateData) => (
              <TemplateCard
                key={templateData.template.id}
                template={templateData}
                isSelected={selectedTemplate?.template.id === templateData.template.id}
                onSelect={() => onTemplateSelect(templateData)}
              />
            ))}
          </div>
        </div>
      )}

      {orgTemplates.length > 0 && (
        <div>
          <h3 className="mb-3 font-medium">Organization Templates</h3>
          <div className="grid gap-3">
            {orgTemplates.map((templateData) => (
              <TemplateCard
                key={templateData.template.id}
                template={templateData}
                isSelected={selectedTemplate?.template.id === templateData.template.id}
                onSelect={() => onTemplateSelect(templateData)}
              />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// Template Card Component
interface TemplateCardProps {
  template: TemplateWithAttributes;
  isSelected: boolean;
  onSelect: () => void;
}

function TemplateCard({ template, isSelected, onSelect }: TemplateCardProps) {
  const { template: tmpl } = template;

  return (
    <Card
      className={`cursor-pointer transition-all hover:shadow-md ${
        isSelected ? "border-primary bg-primary/5" : "hover:border-primary/50"
      }`}
      onClick={onSelect}
    >
      <CardContent className="p-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div
              className="flex h-10 w-10 items-center justify-center rounded-lg"
              style={{ backgroundColor: `${tmpl.color}20`, color: tmpl.color }}
            >
              <File className="h-5 w-5" />
            </div>
            <div className="flex-1">
              <div className="flex items-center gap-2">
                <h4 className="font-medium">{tmpl.name}</h4>
                <Badge variant={tmpl.is_system ? "secondary" : "default"} className="text-xs">
                  {tmpl.is_system ? "System" : "Custom"}
                </Badge>
              </div>
              <p className="text-sm text-muted-foreground">{tmpl.description}</p>
              <div className="mt-1 flex items-center gap-2 text-xs text-muted-foreground">
                <span>{template.attribute_count} attributes</span>
                <span>•</span>
                <div className="flex gap-1">
                  {tmpl.supported_contexts.slice(0, 2).map((context) => (
                    <Badge key={context} variant="outline" className="text-xs">
                      {context}
                    </Badge>
                  ))}
                  {tmpl.supported_contexts.length > 2 && (
                    <Badge variant="outline" className="text-xs">
                      +{tmpl.supported_contexts.length - 2}
                    </Badge>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

// Save as Template Form Component
interface SaveAsTemplateFormProps {
  onSave: (data: { name: string; description?: string }) => void;
  onSkip: () => void;
  productName: string;
}

function SaveAsTemplateForm({ onSave, onSkip, productName }: SaveAsTemplateFormProps) {
  const [templateName, setTemplateName] = React.useState(`${productName} Template`);
  const [templateDescription, setTemplateDescription] = React.useState("");
  const [isSubmitting, setIsSubmitting] = React.useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!templateName.trim()) return;

    setIsSubmitting(true);
    try {
      await onSave({
        name: templateName.trim(),
        description: templateDescription.trim() || undefined,
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="space-y-2">
        <label htmlFor="templateName" className="text-sm font-medium">
          Template Name *
        </label>
        <Input
          id="templateName"
          value={templateName}
          onChange={(e) => setTemplateName(e.target.value)}
          placeholder="Enter template name"
          required
        />
      </div>
      <div className="space-y-2">
        <label htmlFor="templateDescription" className="text-sm font-medium">
          Description
        </label>
        <Textarea
          id="templateDescription"
          value={templateDescription}
          onChange={(e) => setTemplateDescription(e.target.value)}
          placeholder="Describe what this template is for..."
          rows={3}
        />
      </div>
      <div className="flex gap-2 pt-2">
        <Button type="button" variant="outline" onClick={onSkip} className="flex-1">
          Skip
        </Button>
        <Button type="submit" disabled={!templateName.trim() || isSubmitting} className="flex-1">
          {isSubmitting ? "Saving..." : "Save Template"}
        </Button>
      </div>
    </form>
  );
}
