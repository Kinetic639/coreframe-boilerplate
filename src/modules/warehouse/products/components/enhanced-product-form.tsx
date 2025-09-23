"use client";

import * as React from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
// Select components are not used in this component
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  ContextSwitcher,
  ContextIndicator,
  useContextStore,
} from "@/modules/warehouse/components/context/context-switcher";
import { ProductContextViews } from "./product-context-views";
import { VariantCreationInterface } from "./variant-creation-interface";
import { DynamicFormFields } from "@/components/ui/dynamic-form-field";
import { useFormStateStore } from "@/lib/stores/form-state-store";
import { useTemplateStore } from "@/lib/stores/template-store";
import { useProductStore } from "@/lib/stores/product-store";
import { useAppStore } from "@/lib/stores/app-store";
import {
  Loader2,
  Save,
  X,
  ArrowLeft,
  Package,
  Layers,
  Settings,
  List,
  Grid3X3,
} from "lucide-react";
import { toast } from "react-toastify";
import type { ProductWithDetails } from "@/modules/warehouse/types/flexible-products";

interface EnhancedProductFormProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  product?: ProductWithDetails | null;
  onSuccess?: () => void;
}

type FormStep = "template" | "basic" | "attributes" | "context" | "variants" | "review";

export function EnhancedProductForm({
  open,
  onOpenChange,
  product,
  onSuccess,
}: EnhancedProductFormProps) {
  const [currentStep, setCurrentStep] = React.useState<FormStep>("template");
  const [selectedTemplateId, setSelectedTemplateId] = React.useState<string>("");
  const [productName, setProductName] = React.useState("");
  const [productDescription, setProductDescription] = React.useState("");
  const [createdProduct, setCreatedProduct] = React.useState<any>(null);
  const [showContextDialog, setShowContextDialog] = React.useState(false);
  const [showVariantDialog, setShowVariantDialog] = React.useState(false);

  const { activeOrgId } = useAppStore();
  const { currentContext } = useContextStore();
  const {
    systemTemplates,
    organizationTemplates,
    isLoadingSystem,
    isLoadingOrganization,
    loadSystemTemplates,
    loadOrganizationTemplates,
  } = useTemplateStore();

  const {
    template,
    fields,
    isValid,
    // isSubmitting, // Not used in this component
    submitError,
    initializeForm,
    setFieldValue,
    validateForm,
    getFormValues,
    clearForm,
  } = useFormStateStore();

  const { createProduct, updateProduct, isCreatingProduct, isUpdatingProduct } = useProductStore();

  const isEditing = Boolean(product);
  const isLoading = isCreatingProduct || isUpdatingProduct;

  // Load templates when dialog opens
  React.useEffect(() => {
    if (open && activeOrgId) {
      loadSystemTemplates();
      loadOrganizationTemplates(activeOrgId);
    }
  }, [open, activeOrgId, loadSystemTemplates, loadOrganizationTemplates]);

  // Initialize form when editing existing product
  React.useEffect(() => {
    if (isEditing && product && open) {
      setProductName(product.name);
      setProductDescription(product.description || "");
      setSelectedTemplateId(product.template_id);
      setCurrentStep("basic");

      // Initialize form with existing attributes
      if (product.template && product.attributes) {
        const attributeValues: Record<string, any> = {};
        product.attributes.forEach((attr) => {
          if (attr.context_scope === currentContext) {
            if (attr.value_text) attributeValues[attr.attribute_key] = attr.value_text;
            else if (attr.value_number !== null)
              attributeValues[attr.attribute_key] = attr.value_number;
            else if (attr.value_boolean !== null)
              attributeValues[attr.attribute_key] = attr.value_boolean;
            else if (attr.value_date) attributeValues[attr.attribute_key] = attr.value_date;
            else if (attr.value_json) attributeValues[attr.attribute_key] = attr.value_json;
          }
        });

        // Convert the database template to the expected template format
        const templateForForm = {
          ...product.template,
          is_active: true,
          supported_contexts: [currentContext],
          settings: {},
          attribute_definitions: [],
        };
        initializeForm(templateForForm, currentContext as any, "edit", attributeValues, product.id);
      }
    } else if (!isEditing && open) {
      // Reset for new product creation
      setProductName("");
      setProductDescription("");
      setSelectedTemplateId("");
      setCurrentStep("template");
      clearForm();
    }
  }, [isEditing, product, open, currentContext, initializeForm, clearForm]);

  const allTemplates = React.useMemo(() => {
    return [...systemTemplates, ...organizationTemplates];
  }, [systemTemplates, organizationTemplates]);

  const handleTemplateSelect = (templateId: string) => {
    setSelectedTemplateId(templateId);
    const selectedTemplate = allTemplates.find((t) => t.template.id === templateId);

    if (selectedTemplate) {
      initializeForm(
        selectedTemplate.template,
        currentContext as any,
        isEditing ? "edit" : "create"
      );
      setCurrentStep("basic");
    }
  };

  const handleNext = async () => {
    switch (currentStep) {
      case "template":
        if (!selectedTemplateId) {
          toast.error("Please select a template");
          return;
        }
        setCurrentStep("basic");
        break;
      case "basic":
        if (!productName.trim()) {
          toast.error("Product name is required");
          return;
        }
        setCurrentStep("attributes");
        break;
      case "attributes":
        const isFormValid = await validateForm();
        if (!isFormValid) {
          toast.error("Please fix validation errors");
          return;
        }
        setCurrentStep("context");
        break;
      case "context":
        setCurrentStep("variants");
        break;
      case "variants":
        setCurrentStep("review");
        break;
      case "review":
        await handleSubmit();
        break;
    }
  };

  const handleBack = () => {
    switch (currentStep) {
      case "basic":
        setCurrentStep("template");
        break;
      case "attributes":
        setCurrentStep("basic");
        break;
      case "context":
        setCurrentStep("attributes");
        break;
      case "variants":
        setCurrentStep("context");
        break;
      case "review":
        setCurrentStep("variants");
        break;
    }
  };

  const handleSubmit = async () => {
    try {
      if (!activeOrgId) {
        toast.error("No active organization");
        return;
      }

      const attributeValues = getFormValues();

      // Convert form values to attribute format
      const attributes: Record<string, any> = {};
      Object.entries(attributeValues).forEach(([key, value]) => {
        attributes[key] = { type: "text", value }; // Simplified for now
      });

      if (isEditing && product) {
        await updateProduct(product.id, {
          id: product.id,
          name: productName,
          description: productDescription,
          attributes,
        });
        toast.success("Product updated successfully");
      } else {
        const result = await createProduct({
          template_id: selectedTemplateId,
          name: productName,
          description: productDescription,
          organization_id: activeOrgId,
          status: "active",
          attributes,
          variant_name: productName, // Use product name as default variant name
        });
        setCreatedProduct(result);
        toast.success("Product created successfully");
      }

      onSuccess?.();
      handleClose();
    } catch (error) {
      console.error("Error saving product:", error);
      toast.error("Failed to save product");
    }
  };

  const handleClose = () => {
    setCurrentStep("template");
    setSelectedTemplateId("");
    setProductName("");
    setProductDescription("");
    clearForm();
    onOpenChange(false);
  };

  const renderStepContent = () => {
    switch (currentStep) {
      case "template":
        return (
          <div className="space-y-4">
            <div>
              <h3 className="text-lg font-medium">Choose Product Template</h3>
              <p className="text-sm text-muted-foreground">
                Select a template that defines the attributes and structure for your product.
              </p>
            </div>

            <ContextIndicator className="mb-4" />

            {isLoadingSystem || isLoadingOrganization ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="h-8 w-8 animate-spin" />
              </div>
            ) : (
              <ScrollArea className="h-96">
                <div className="grid gap-3">
                  {systemTemplates.length > 0 && (
                    <>
                      <div className="flex items-center gap-2">
                        <Badge variant="secondary">System Templates</Badge>
                      </div>
                      {systemTemplates.map((template) => (
                        <Card
                          key={template.template.id}
                          className={`cursor-pointer transition-colors hover:bg-muted/50 ${
                            selectedTemplateId === template.template.id ? "ring-2 ring-primary" : ""
                          }`}
                          onClick={() => handleTemplateSelect(template.template.id)}
                        >
                          <CardHeader className="pb-2">
                            <CardTitle className="text-base">{template.template.name}</CardTitle>
                            {template.template.description && (
                              <CardDescription className="text-sm">
                                {template.template.description}
                              </CardDescription>
                            )}
                          </CardHeader>
                          <CardContent>
                            <div className="flex items-center gap-2">
                              <Badge variant="outline" className="text-xs">
                                {template.attribute_count} attributes
                              </Badge>
                              {template.template.category && (
                                <Badge variant="outline" className="text-xs">
                                  {template.template.category}
                                </Badge>
                              )}
                            </div>
                          </CardContent>
                        </Card>
                      ))}
                    </>
                  )}

                  {organizationTemplates.length > 0 && (
                    <>
                      <Separator className="my-4" />
                      <div className="flex items-center gap-2">
                        <Badge variant="secondary">Organization Templates</Badge>
                      </div>
                      {organizationTemplates.map((template) => (
                        <Card
                          key={template.template.id}
                          className={`cursor-pointer transition-colors hover:bg-muted/50 ${
                            selectedTemplateId === template.template.id ? "ring-2 ring-primary" : ""
                          }`}
                          onClick={() => handleTemplateSelect(template.template.id)}
                        >
                          <CardHeader className="pb-2">
                            <CardTitle className="text-base">{template.template.name}</CardTitle>
                            {template.template.description && (
                              <CardDescription className="text-sm">
                                {template.template.description}
                              </CardDescription>
                            )}
                          </CardHeader>
                          <CardContent>
                            <div className="flex items-center gap-2">
                              <Badge variant="outline" className="text-xs">
                                {template.attribute_count} attributes
                              </Badge>
                              {template.template.category && (
                                <Badge variant="outline" className="text-xs">
                                  {template.template.category}
                                </Badge>
                              )}
                            </div>
                          </CardContent>
                        </Card>
                      ))}
                    </>
                  )}

                  {allTemplates.length === 0 && (
                    <div className="py-8 text-center text-muted-foreground">
                      <Package className="mx-auto mb-4 h-12 w-12" />
                      <p>No templates available. Create a template first.</p>
                    </div>
                  )}
                </div>
              </ScrollArea>
            )}
          </div>
        );

      case "basic":
        return (
          <div className="space-y-4">
            <div>
              <h3 className="text-lg font-medium">Basic Information</h3>
              <p className="text-sm text-muted-foreground">
                Enter the basic details for your product.
              </p>
            </div>

            <ContextIndicator className="mb-4" />

            <div className="space-y-4">
              <div>
                <Label htmlFor="name">Product Name *</Label>
                <Input
                  id="name"
                  value={productName}
                  onChange={(e) => setProductName(e.target.value)}
                  placeholder="Enter product name"
                  required
                />
              </div>

              <div>
                <Label htmlFor="description">Description</Label>
                <Textarea
                  id="description"
                  value={productDescription}
                  onChange={(e) => setProductDescription(e.target.value)}
                  placeholder="Enter product description"
                  rows={4}
                />
              </div>
            </div>
          </div>
        );

      case "attributes":
        return (
          <div className="space-y-4">
            <div>
              <h3 className="text-lg font-medium">Product Attributes</h3>
              <p className="text-sm text-muted-foreground">
                Configure attributes specific to the{" "}
                <ContextIndicator showName={false} className="inline" /> context.
              </p>
            </div>

            <ContextSwitcher variant="badges" />

            {template && template.attribute_definitions && (
              <ScrollArea className="h-96">
                <DynamicFormFields
                  attributes={template.attribute_definitions}
                  values={Object.keys(fields).reduce(
                    (acc, key) => ({
                      ...acc,
                      [key]: fields[key].value,
                    }),
                    {}
                  )}
                  errors={Object.keys(fields).reduce(
                    (acc, key) => ({
                      ...acc,
                      [key]: fields[key].error,
                    }),
                    {}
                  )}
                  onChange={setFieldValue}
                  context={currentContext}
                  locale="pl"
                />
              </ScrollArea>
            )}

            {submitError && (
              <div className="rounded border bg-red-50 p-3 text-sm text-red-600">{submitError}</div>
            )}
          </div>
        );

      case "context":
        return (
          <div className="space-y-4">
            <div>
              <h3 className="text-lg font-medium">Context Configuration</h3>
              <p className="text-sm text-muted-foreground">
                Configure how your product appears in different business contexts.
              </p>
            </div>

            {/* Context Configuration Options */}
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <Card
                className="cursor-pointer hover:shadow-md"
                onClick={() => setShowContextDialog(true)}
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

            <div className="rounded-lg border bg-muted/50 p-4">
              <p className="text-sm text-muted-foreground">
                This step is optional. You can configure context-specific data later from the
                product detail page.
              </p>
            </div>
          </div>
        );

      case "variants":
        return (
          <div className="space-y-4">
            <div>
              <h3 className="text-lg font-medium">Product Variants</h3>
              <p className="text-sm text-muted-foreground">
                Create variants like different sizes, colors, or configurations.
              </p>
            </div>

            {/* Variant Creation Options */}
            <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
              <Card
                className="cursor-pointer hover:shadow-md"
                onClick={() => setShowVariantDialog(true)}
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
                onClick={() => setShowVariantDialog(true)}
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
                onClick={() => setShowVariantDialog(true)}
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

            <div className="rounded-lg border bg-muted/50 p-4">
              <p className="text-sm text-muted-foreground">
                This step is optional. You can create variants later from the product detail page.
              </p>
            </div>
          </div>
        );

      case "review":
        return (
          <div className="space-y-4">
            <div>
              <h3 className="text-lg font-medium">Review Product</h3>
              <p className="text-sm text-muted-foreground">
                Review your product details before saving.
              </p>
            </div>

            <Card>
              <CardHeader>
                <CardTitle className="text-base">Basic Information</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                <div>
                  <Label className="text-sm font-medium">Name</Label>
                  <p className="text-sm text-muted-foreground">{productName}</p>
                </div>
                {productDescription && (
                  <div>
                    <Label className="text-sm font-medium">Description</Label>
                    <p className="text-sm text-muted-foreground">{productDescription}</p>
                  </div>
                )}
                <div>
                  <Label className="text-sm font-medium">Template</Label>
                  <p className="text-sm text-muted-foreground">
                    {allTemplates.find((t) => t.template.id === selectedTemplateId)?.template.name}
                  </p>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-base">Attributes</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {Object.entries(getFormValues()).map(([key, value]) => (
                    <div key={key} className="flex justify-between">
                      <Label className="text-sm font-medium capitalize">
                        {key.replace(/_/g, " ")}
                      </Label>
                      <span className="text-sm text-muted-foreground">
                        {typeof value === "object" ? JSON.stringify(value) : String(value)}
                      </span>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>
        );

      default:
        return null;
    }
  };

  const canProceed = () => {
    switch (currentStep) {
      case "template":
        return selectedTemplateId !== "";
      case "basic":
        return productName.trim() !== "";
      case "attributes":
        return isValid;
      default:
        return true;
    }
  };

  const getNextButtonText = () => {
    switch (currentStep) {
      case "review":
        return isEditing ? "Update Product" : "Create Product";
      default:
        return "Next";
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="flex max-h-[90vh] max-w-4xl flex-col">
        <DialogHeader>
          <DialogTitle>{isEditing ? "Edit Product" : "Create New Product"}</DialogTitle>
          <DialogDescription>
            {isEditing
              ? "Update the product details and attributes."
              : "Create a new flexible product using templates."}
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 overflow-hidden">{renderStepContent()}</div>

        <div className="flex items-center justify-between border-t pt-4">
          <div className="flex items-center gap-2">
            {currentStep !== "template" && (
              <Button variant="outline" onClick={handleBack}>
                <ArrowLeft className="mr-2 h-4 w-4" />
                Back
              </Button>
            )}
          </div>

          <div className="flex items-center gap-2">
            <Button variant="outline" onClick={handleClose}>
              <X className="mr-2 h-4 w-4" />
              Cancel
            </Button>
            <Button onClick={handleNext} disabled={!canProceed() || isLoading}>
              {isLoading ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : currentStep === "review" ? (
                <Save className="mr-2 h-4 w-4" />
              ) : null}
              {getNextButtonText()}
            </Button>
          </div>
        </div>
      </DialogContent>

      {/* Nested Dialogs */}
      {showContextDialog && createdProduct && (
        <ProductContextViews productId={createdProduct.id} onDataChange={() => {}} />
      )}

      {showVariantDialog && createdProduct && (
        <VariantCreationInterface
          open={showVariantDialog}
          onOpenChange={setShowVariantDialog}
          productId={createdProduct.id}
          existingVariants={[]}
          onVariantsCreated={() => {
            setShowVariantDialog(false);
          }}
          defaultMode="single"
        />
      )}
    </Dialog>
  );
}
