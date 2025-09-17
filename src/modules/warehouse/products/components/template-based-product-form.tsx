// src/modules/warehouse/products/components/template-based-product-form.tsx
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
// Select components are handled by the form library
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
// Separator not used in this component
import { Checkbox } from "@/components/ui/checkbox";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { CalendarIcon, File, Loader2, ArrowLeft, ArrowRight } from "lucide-react";
import { cn } from "@/lib/utils";
import { format } from "date-fns";
import { useAppStore } from "@/lib/stores/app-store";
import { templateService } from "@/modules/warehouse/api/template-service";
import { flexibleProductService } from "@/modules/warehouse/api/flexible-products";
import type {
  TemplateWithAttributes,
  ProductAttributeDefinition,
} from "@/modules/warehouse/types/template";
import { toast } from "react-toastify";

interface TemplateBasedProductFormProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess?: () => void;
}

type FormStep = "template" | "product";

// Dynamic form schema based on template attributes
function createDynamicSchema(attributes: ProductAttributeDefinition[]) {
  const schema: Record<string, z.ZodTypeAny> = {};

  attributes.forEach((attr) => {
    let fieldSchema: z.ZodTypeAny;

    switch (attr.data_type) {
      case "text":
        fieldSchema = z.string();
        break;
      case "number":
        fieldSchema = z.coerce.number();
        break;
      case "boolean":
        fieldSchema = z.boolean();
        break;
      case "date":
        fieldSchema = z.date();
        break;
      case "json":
        fieldSchema = z.any();
        break;
      default:
        fieldSchema = z.string();
    }

    if (!attr.is_required) {
      fieldSchema = fieldSchema.optional();
    }

    schema[attr.slug] = fieldSchema;
  });

  return z.object(schema);
}

export function TemplateBasedProductForm({
  open,
  onOpenChange,
  onSuccess,
}: TemplateBasedProductFormProps) {
  const { activeOrgId } = useAppStore();
  const [currentStep, setCurrentStep] = React.useState<FormStep>("template");
  const [loading, setLoading] = React.useState(false);
  const [submitting, setSubmitting] = React.useState(false);

  // Templates state
  const [systemTemplates, setSystemTemplates] = React.useState<TemplateWithAttributes[]>([]);
  const [organizationTemplates, setOrganizationTemplates] = React.useState<
    TemplateWithAttributes[]
  >([]);
  const [selectedTemplate, setSelectedTemplate] = React.useState<TemplateWithAttributes | null>(
    null
  );

  // Dynamic form - create a default schema to avoid null checks
  const defaultSchema = z.object({});
  const [formSchema, setFormSchema] = React.useState<z.ZodObject<any>>(defaultSchema);

  // Create form at component level with default schema
  const form = useForm({
    resolver: zodResolver(formSchema),
    defaultValues: {},
  });

  // Load templates when dialog opens
  React.useEffect(() => {
    if (open && activeOrgId) {
      loadTemplates();
    }
  }, [open, activeOrgId]);

  const loadTemplates = async () => {
    try {
      setLoading(true);
      const templates = await templateService.getAllTemplates(activeOrgId || undefined);
      setSystemTemplates(templates.system_templates);
      setOrganizationTemplates(templates.organization_templates);
    } catch (error) {
      console.error("Error loading templates:", error);
      toast.error("Błąd podczas ładowania szablonów");
    } finally {
      setLoading(false);
    }
  };

  const handleTemplateSelect = (templateData: TemplateWithAttributes) => {
    setSelectedTemplate(templateData);
    setCurrentStep("product");
  };

  // Update form schema and values when template is selected
  React.useEffect(() => {
    if (selectedTemplate) {
      // Create dynamic schema based on template attributes
      const schema = createDynamicSchema(selectedTemplate.attributes);
      setFormSchema(schema);

      // Create default values
      const defaultValues: Record<string, any> = {};
      selectedTemplate.attributes.forEach((attr) => {
        if (attr.default_value !== undefined && attr.default_value !== null) {
          defaultValues[attr.slug] = attr.default_value;
        } else {
          switch (attr.data_type) {
            case "text":
              defaultValues[attr.slug] = "";
              break;
            case "number":
              defaultValues[attr.slug] = 0;
              break;
            case "boolean":
              defaultValues[attr.slug] = false;
              break;
            case "date":
              defaultValues[attr.slug] = new Date();
              break;
            case "json":
              defaultValues[attr.slug] = {};
              break;
            default:
              defaultValues[attr.slug] = "";
          }
        }
      });

      // Reset the form with new schema and default values
      form.reset(defaultValues);
    }
  }, [selectedTemplate, form]);

  const handleBack = () => {
    setCurrentStep("template");
    setSelectedTemplate(null);
    setFormSchema(defaultSchema);
    form.reset();
  };

  const onSubmit = async (data: Record<string, any>) => {
    if (!selectedTemplate || !activeOrgId) return;

    try {
      setSubmitting(true);

      // Transform form data into product attributes
      const attributesObject: Record<string, any> = {};

      Object.entries(data).forEach(([key, value]) => {
        const attrDef = selectedTemplate.attributes.find((attr) => attr.slug === key);
        if (!attrDef || value === undefined || value === null) return;

        let processedValue: any = value;

        // Handle different data types
        switch (attrDef.data_type) {
          case "date":
            processedValue = value instanceof Date ? value.toISOString() : value;
            break;
          case "json":
            try {
              processedValue = typeof value === "string" ? JSON.parse(value) : value;
            } catch {
              processedValue = value;
            }
            break;
          default:
            processedValue = value;
        }

        attributesObject[key] = processedValue;
      });

      // Extract product name from attributes (required)
      const productName =
        attributesObject["name"] || attributesObject["product_name"] || "Nowy produkt";
      if (!productName || typeof productName !== "string") {
        toast.error("Nazwa produktu jest wymagana");
        return;
      }

      // Create product
      await flexibleProductService.createProduct({
        name: productName,
        description: attributesObject["description"] || "",
        organization_id: activeOrgId,
        template_id: selectedTemplate.template.id,
        status: "active",
        attributes: attributesObject,
      });

      toast.success("Produkt został utworzony");
      handleClose();
      onSuccess?.();
    } catch (error) {
      console.error("Error creating product:", error);
      toast.error("Błąd podczas tworzenia produktu");
    } finally {
      setSubmitting(false);
    }
  };

  const handleClose = () => {
    setCurrentStep("template");
    setSelectedTemplate(null);
    setFormSchema(defaultSchema);
    form.reset();
    onOpenChange(false);
  };

  const renderFormField = (attr: ProductAttributeDefinition, form: any) => {
    const currentLocale = "pl"; // Default to Polish

    // Handle label with proper null checking
    const label: string =
      attr.label && typeof attr.label === "object"
        ? attr.label[currentLocale] || attr.label["en"] || attr.slug
        : String(attr.label || attr.slug);

    const placeholder =
      attr.placeholder && typeof attr.placeholder === "object"
        ? attr.placeholder[currentLocale] || attr.placeholder["en"] || ""
        : "";

    const helpText =
      attr.help_text && typeof attr.help_text === "object"
        ? attr.help_text[currentLocale] || attr.help_text["en"] || ""
        : "";

    return (
      <FormField
        key={attr.slug}
        control={form.control}
        name={attr.slug}
        render={({ field }) => (
          <FormItem>
            <FormLabel className="flex items-center gap-2">
              {label}
              {attr.is_required && <span className="text-red-500">*</span>}
              <Badge variant="outline" className="text-xs">
                {attr.context_scope}
              </Badge>
            </FormLabel>
            <FormControl>
              {attr.data_type === "text" && attr.input_type === "textarea" ? (
                <Textarea placeholder={placeholder} className="min-h-[80px]" {...field} />
              ) : attr.data_type === "number" ? (
                <Input type="number" placeholder={placeholder} {...field} />
              ) : attr.data_type === "boolean" ? (
                <div className="flex items-center space-x-2">
                  <Checkbox checked={field.value} onCheckedChange={field.onChange} />
                  <span className="text-sm">{placeholder}</span>
                </div>
              ) : attr.data_type === "date" ? (
                <Popover>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      className={cn(
                        "w-full justify-start text-left font-normal",
                        !field.value && "text-muted-foreground"
                      )}
                    >
                      <CalendarIcon className="mr-2 h-4 w-4" />
                      {field.value ? format(field.value, "PPP") : <span>{placeholder}</span>}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0">
                    <Calendar
                      mode="single"
                      selected={field.value}
                      onSelect={field.onChange}
                      initialFocus
                    />
                  </PopoverContent>
                </Popover>
              ) : attr.data_type === "json" ? (
                <Textarea
                  placeholder={placeholder || "Enter JSON data"}
                  className="min-h-[80px] font-mono"
                  {...field}
                  onChange={(e) => {
                    field.onChange(e.target.value);
                  }}
                />
              ) : (
                <Input type="text" placeholder={placeholder} {...field} />
              )}
            </FormControl>
            {helpText && <p className="text-xs text-muted-foreground">{helpText}</p>}
            <FormMessage />
          </FormItem>
        )}
      />
    );
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-h-[90vh] overflow-hidden sm:max-w-[800px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <File className="h-5 w-5" />
            {currentStep === "template" ? "Wybierz szablon produktu" : "Utwórz produkt"}
          </DialogTitle>
          <DialogDescription>
            {currentStep === "template"
              ? "Wybierz szablon, który definiuje strukturę i atrybuty produktu."
              : `Wypełnij dane produktu bazując na szablonie: ${selectedTemplate?.template.name}`}
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 overflow-hidden">
          {currentStep === "template" ? (
            <ScrollArea className="max-h-[60vh] pr-4">
              {loading ? (
                <div className="flex items-center justify-center py-12">
                  <Loader2 className="h-8 w-8 animate-spin" />
                  <span className="ml-2">Ładowanie szablonów...</span>
                </div>
              ) : (
                <div className="space-y-6">
                  {/* System Templates */}
                  {systemTemplates.length > 0 && (
                    <div>
                      <h3 className="mb-3 text-lg font-semibold">Szablony systemowe</h3>
                      <div className="grid gap-3">
                        {systemTemplates.map((templateData) => {
                          const template = templateData.template;
                          return (
                            <Card
                              key={template.id}
                              className="cursor-pointer transition-colors hover:bg-muted/50"
                              onClick={() => handleTemplateSelect(templateData)}
                            >
                              <CardContent className="p-4">
                                <div className="flex items-center justify-between">
                                  <div className="flex items-center gap-3">
                                    <div
                                      className="flex h-10 w-10 items-center justify-center rounded-lg"
                                      style={{
                                        backgroundColor: `${template.color}20`,
                                        color: template.color,
                                      }}
                                    >
                                      <File className="h-5 w-5" />
                                    </div>
                                    <div>
                                      <h4 className="font-medium">{template.name}</h4>
                                      <p className="text-sm text-muted-foreground">
                                        {template.description}
                                      </p>
                                    </div>
                                  </div>
                                  <div className="flex items-center gap-2">
                                    <Badge variant="secondary" className="text-xs">
                                      {templateData.attribute_count} atrybutów
                                    </Badge>
                                    <ArrowRight className="h-4 w-4 text-muted-foreground" />
                                  </div>
                                </div>
                              </CardContent>
                            </Card>
                          );
                        })}
                      </div>
                    </div>
                  )}

                  {/* Organization Templates */}
                  {organizationTemplates.length > 0 && (
                    <div>
                      <h3 className="mb-3 text-lg font-semibold">Szablony organizacji</h3>
                      <div className="grid gap-3">
                        {organizationTemplates.map((templateData) => {
                          const template = templateData.template;
                          return (
                            <Card
                              key={template.id}
                              className="cursor-pointer transition-colors hover:bg-muted/50"
                              onClick={() => handleTemplateSelect(templateData)}
                            >
                              <CardContent className="p-4">
                                <div className="flex items-center justify-between">
                                  <div className="flex items-center gap-3">
                                    <div
                                      className="flex h-10 w-10 items-center justify-center rounded-lg"
                                      style={{
                                        backgroundColor: `${template.color}20`,
                                        color: template.color,
                                      }}
                                    >
                                      <File className="h-5 w-5" />
                                    </div>
                                    <div>
                                      <h4 className="font-medium">{template.name}</h4>
                                      <p className="text-sm text-muted-foreground">
                                        {template.description}
                                      </p>
                                    </div>
                                  </div>
                                  <div className="flex items-center gap-2">
                                    <Badge variant="default" className="text-xs">
                                      Własny
                                    </Badge>
                                    <Badge variant="secondary" className="text-xs">
                                      {templateData.attribute_count} atrybutów
                                    </Badge>
                                    <ArrowRight className="h-4 w-4 text-muted-foreground" />
                                  </div>
                                </div>
                              </CardContent>
                            </Card>
                          );
                        })}
                      </div>
                    </div>
                  )}

                  {systemTemplates.length === 0 && organizationTemplates.length === 0 && (
                    <div className="py-12 text-center">
                      <File className="mx-auto mb-4 h-12 w-12 text-muted-foreground" />
                      <h3 className="mb-2 font-medium">Brak dostępnych szablonów</h3>
                      <p className="text-sm text-muted-foreground">
                        Utwórz szablon produktu lub skontaktuj się z administratorem.
                      </p>
                    </div>
                  )}
                </div>
              )}
            </ScrollArea>
          ) : selectedTemplate && form && formSchema ? (
            <ScrollArea className="max-h-[60vh] pr-4">
              <Form {...form}>
                <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
                  {/* Template Info */}
                  <Card>
                    <CardHeader className="pb-3">
                      <div className="flex items-center gap-3">
                        <div
                          className="flex h-8 w-8 items-center justify-center rounded-lg"
                          style={{
                            backgroundColor: `${selectedTemplate.template.color}20`,
                            color: selectedTemplate.template.color,
                          }}
                        >
                          <File className="h-4 w-4" />
                        </div>
                        <div>
                          <h4 className="font-medium">{selectedTemplate.template.name}</h4>
                          <p className="text-sm text-muted-foreground">
                            {selectedTemplate.template.description}
                          </p>
                        </div>
                      </div>
                    </CardHeader>
                  </Card>

                  {/* Dynamic Form Fields */}
                  <div className="space-y-4">
                    {selectedTemplate.attributes
                      .sort((a, b) => a.display_order - b.display_order)
                      .map((attr) => renderFormField(attr, form))}
                  </div>
                </form>
              </Form>
            </ScrollArea>
          ) : null}
        </div>

        <DialogFooter>
          {currentStep === "product" && (
            <Button type="button" variant="outline" onClick={handleBack} disabled={submitting}>
              <ArrowLeft className="mr-2 h-4 w-4" />
              Wstecz
            </Button>
          )}
          <Button type="button" variant="outline" onClick={handleClose}>
            Anuluj
          </Button>
          {currentStep === "product" && form && (
            <Button onClick={form.handleSubmit(onSubmit)} disabled={submitting}>
              {submitting ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Tworzenie...
                </>
              ) : (
                "Utwórz produkt"
              )}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
