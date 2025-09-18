// src/app/[locale]/dashboard/warehouse/products/templates/page.tsx
"use client";

import * as React from "react";
import { useCallback } from "react";
import { useRouter } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Plus, File, Settings, Copy, Trash2, Loader2, Edit } from "lucide-react";
import { motion } from "framer-motion";
import { useAppStore } from "@/lib/stores/app-store";
import { templateService } from "@/modules/warehouse/api/template-service";
import type { TemplateWithAttributes } from "@/modules/warehouse/types/template";
import { TemplateBasedProductForm } from "@/modules/warehouse/products/components/template-based-product-form";
import { toast } from "react-toastify";

export default function ProductTemplatesPage() {
  const router = useRouter();
  const { activeOrgId } = useAppStore();
  const [loading, setLoading] = React.useState(true);
  const [systemTemplates, setSystemTemplates] = React.useState<TemplateWithAttributes[]>([]);
  const [organizationTemplates, setOrganizationTemplates] = React.useState<
    TemplateWithAttributes[]
  >([]);
  const [showCreateProductDialog, setShowCreateProductDialog] = React.useState(false);
  const [selectedTemplateForProduct, setSelectedTemplateForProduct] =
    React.useState<TemplateWithAttributes | null>(null);

  const loadTemplates = useCallback(async () => {
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
  }, [activeOrgId]);

  React.useEffect(() => {
    loadTemplates();
  }, [loadTemplates]);

  // const _handleCloneTemplate = async (templateId: string, templateName: string) => {
  //   if (!activeOrgId) {
  //     toast.error("Brak aktywnej organizacji");
  //     return;
  //   }

  //   try {
  //     await templateService.cloneTemplate({
  //       source_template_id: templateId,
  //       target_organization_id: activeOrgId,
  //       new_name: `${templateName} (kopia)`,
  //     });
  //     toast.success("Szablon został sklonowany");
  //     loadTemplates(); // Reload templates
  //   } catch (error) {
  //     console.error("Error cloning template:", error);
  //     toast.error("Błąd podczas klonowania szablonu");
  //   }
  // };

  const handleDeleteTemplate = async (templateId: string) => {
    try {
      await templateService.deleteTemplate(templateId);
      toast.success("Szablon został usunięty");
      loadTemplates(); // Reload templates
    } catch (error) {
      console.error("Error deleting template:", error);
      toast.error("Błąd podczas usuwania szablonu");
    }
  };

  const handleCreateProductWithTemplate = (template: TemplateWithAttributes) => {
    setSelectedTemplateForProduct(template);
    setShowCreateProductDialog(true);
  };

  if (loading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin" />
        <span className="ml-2">Ładowanie szablonów...</span>
      </div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="space-y-6"
    >
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Szablony produktów</h1>
          <p className="text-muted-foreground">
            Zarządzaj szablonami do tworzenia produktów z predefiniowanymi atrybutami
          </p>
        </div>
        <Button onClick={() => router.push("/dashboard/warehouse/products/templates/create")}>
          <Plus className="mr-2 h-4 w-4" />
          Utwórz szablon
        </Button>
      </div>

      {/* System Templates */}
      <div>
        <h2 className="mb-4 text-xl font-semibold">Szablony systemowe</h2>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
          {systemTemplates.map((templateData) => {
            const template = templateData.template;
            return (
              <Card key={template.id} className="transition-shadow hover:shadow-md">
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div
                        className="flex h-8 w-8 items-center justify-center rounded-lg"
                        style={{ backgroundColor: `${template.color}20`, color: template.color }}
                      >
                        <File className="h-4 w-4" />
                      </div>
                      <div>
                        <CardTitle className="text-base">{template.name}</CardTitle>
                      </div>
                    </div>
                    <Badge variant="secondary" className="text-xs">
                      System
                    </Badge>
                  </div>
                  <p className="text-sm text-muted-foreground">{template.description}</p>
                </CardHeader>
                <CardContent className="pt-0">
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">
                      {templateData.attribute_count} atrybutów
                    </span>
                    <div className="flex gap-1">
                      {template.supported_contexts.map((context) => (
                        <Badge key={context} variant="outline" className="text-xs">
                          {context}
                        </Badge>
                      ))}
                    </div>
                  </div>
                  <div className="mt-4 flex gap-2">
                    <Button
                      variant="default"
                      size="sm"
                      className="flex-1"
                      onClick={() => handleCreateProductWithTemplate(templateData)}
                      disabled={!activeOrgId}
                    >
                      <Plus className="mr-2 h-3 w-3" />
                      Utwórz produkt
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      className="flex-1"
                      onClick={() =>
                        router.push(`/dashboard/warehouse/products/templates/clone/${template.id}`)
                      }
                      disabled={!activeOrgId}
                    >
                      <Copy className="mr-2 h-3 w-3" />
                      Klonuj
                    </Button>
                    <Button variant="ghost" size="sm">
                      <Settings className="h-3 w-3" />
                    </Button>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      </div>

      {/* Organization Templates */}
      <div>
        <h2 className="mb-4 text-xl font-semibold">Szablony organizacji</h2>
        {organizationTemplates.length > 0 ? (
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
            {organizationTemplates.map((templateData) => {
              const template = templateData.template;
              return (
                <Card key={template.id} className="transition-shadow hover:shadow-md">
                  <CardHeader className="pb-3">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <div
                          className="flex h-8 w-8 items-center justify-center rounded-lg"
                          style={{ backgroundColor: `${template.color}20`, color: template.color }}
                        >
                          <File className="h-4 w-4" />
                        </div>
                        <div>
                          <CardTitle className="text-base">{template.name}</CardTitle>
                        </div>
                      </div>
                      <Badge variant="default" className="text-xs">
                        Własny
                      </Badge>
                    </div>
                    <p className="text-sm text-muted-foreground">{template.description}</p>
                  </CardHeader>
                  <CardContent className="pt-0">
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-muted-foreground">
                        {templateData.attribute_count} atrybutów
                      </span>
                      <div className="flex gap-1">
                        {template.supported_contexts.map((context) => (
                          <Badge key={context} variant="outline" className="text-xs">
                            {context}
                          </Badge>
                        ))}
                      </div>
                    </div>
                    <div className="mt-4 flex gap-2">
                      <Button
                        variant="default"
                        size="sm"
                        onClick={() => handleCreateProductWithTemplate(templateData)}
                      >
                        <Plus className="mr-2 h-3 w-3" />
                        Utwórz produkt
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() =>
                          router.push(`/dashboard/warehouse/products/templates/edit/${template.id}`)
                        }
                      >
                        <Edit className="mr-2 h-3 w-3" />
                        Edytuj
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() =>
                          router.push(
                            `/dashboard/warehouse/products/templates/clone/${template.id}`
                          )
                        }
                      >
                        <Copy className="mr-2 h-3 w-3" />
                        Klonuj
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="text-destructive"
                        onClick={() => handleDeleteTemplate(template.id)}
                      >
                        <Trash2 className="h-3 w-3" />
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        ) : (
          <Card>
            <CardContent className="flex flex-col items-center justify-center py-12">
              <File className="mb-4 h-12 w-12 text-muted-foreground" />
              <h3 className="mb-2 font-medium">Brak szablonów organizacji</h3>
              <p className="mb-4 text-center text-sm text-muted-foreground">
                Utwórz własny szablon lub sklonuj szablon systemowy aby dostosować go do swoich
                potrzeb.
              </p>
              <Button onClick={() => router.push("/dashboard/warehouse/products/templates/create")}>
                <Plus className="mr-2 h-4 w-4" />
                Utwórz pierwszy szablon
              </Button>
            </CardContent>
          </Card>
        )}
      </div>

      {/* Product Creation Dialog */}
      <TemplateBasedProductForm
        open={showCreateProductDialog}
        onOpenChange={(open) => {
          setShowCreateProductDialog(open);
          if (!open) {
            setSelectedTemplateForProduct(null);
          }
        }}
        preSelectedTemplate={selectedTemplateForProduct}
        onSuccess={() => {
          setShowCreateProductDialog(false);
          setSelectedTemplateForProduct(null);
          // Optionally navigate to products page or refresh
          toast.success("Produkt został utworzony pomyślnie");
        }}
      />
    </motion.div>
  );
}
