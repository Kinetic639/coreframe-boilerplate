// src/app/[locale]/dashboard/warehouse/products/templates/page.tsx
"use client";

import * as React from "react";
import { useCallback } from "react";
import { useRouter } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import {
  Plus,
  File,
  Settings,
  Copy,
  Trash2,
  Loader2,
  Edit,
  LayoutGrid,
  List,
  Table as TableIcon,
  ArrowDown,
  Shuffle,
  GitBranch,
} from "lucide-react";
import { motion } from "framer-motion";
import { useAppStore } from "@/lib/stores/app-store";
import { templateService } from "@/modules/warehouse/api/template-service";
import type { TemplateWithAttributes } from "@/modules/warehouse/types/template";
import { TemplateBuilder } from "@/modules/warehouse/components/templates/TemplateBuilder";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { toast } from "react-toastify";

type DisplayMode = "grid" | "list" | "table";

// Helper function to calculate inheritance statistics
const getInheritanceStats = (templateData: TemplateWithAttributes) => {
  const attributes = templateData.attributes || [];
  const total = attributes.length;
  const inheritable = attributes.filter((attr) => attr.is_inheritable !== false).length;
  const variantSpecific = attributes.filter((attr) => attr.is_variant_specific === true).length;
  const inheritByDefault = attributes.filter((attr) => attr.inherit_by_default === true).length;

  return {
    total,
    inheritable,
    variantSpecific,
    inheritByDefault,
  };
};

// Template rendering helpers
const renderTemplateCard = (
  templateData: TemplateWithAttributes,
  onCreateProduct: (template: TemplateWithAttributes) => void,
  router: any,
  onEdit?: (templateId: string) => void,
  onDelete?: (templateId: string) => void
) => {
  const template = templateData.template;
  const isSystemTemplate = template.is_system;

  return (
    <Card
      key={template.id}
      className="cursor-pointer transition-all hover:border-primary hover:bg-muted/20 hover:shadow-md"
    >
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
          <Badge variant={isSystemTemplate ? "secondary" : "default"} className="text-xs">
            {isSystemTemplate ? "System" : "Własny"}
          </Badge>
        </div>
        <p className="text-sm text-muted-foreground">{template.description}</p>
      </CardHeader>
      <CardContent className="pt-0">
        <div className="space-y-2">
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">{templateData.attribute_count} atrybutów</span>
            <div className="flex gap-1">
              {template.supported_contexts.map((context) => (
                <Badge key={context} variant="outline" className="text-xs">
                  {context}
                </Badge>
              ))}
            </div>
          </div>

          {/* Inheritance Indicators */}
          {templateData.attributes && templateData.attributes.length > 0 && (
            <div className="flex items-center gap-3 text-xs text-muted-foreground">
              {(() => {
                const stats = getInheritanceStats(templateData);
                return (
                  <>
                    <div className="flex items-center gap-1" title="Dziedziczalne atrybuty">
                      <ArrowDown className="h-3 w-3 text-green-600" />
                      <span>{stats.inheritable}</span>
                    </div>
                    <div
                      className="flex items-center gap-1"
                      title="Atrybuty specyficzne dla wariantów"
                    >
                      <GitBranch className="h-3 w-3 text-blue-600" />
                      <span>{stats.variantSpecific}</span>
                    </div>
                    <div className="flex items-center gap-1" title="Dziedziczone domyślnie">
                      <Shuffle className="h-3 w-3 text-purple-600" />
                      <span>{stats.inheritByDefault}</span>
                    </div>
                  </>
                );
              })()}
            </div>
          )}
        </div>
        <div className="mt-4 flex gap-2">
          <Button
            variant="default"
            size="sm"
            className="flex-1"
            onClick={() => onCreateProduct(templateData)}
          >
            <Plus className="mr-2 h-3 w-3" />
            Utwórz produkt
          </Button>
          {!isSystemTemplate && onEdit && (
            <Button variant="outline" size="sm" onClick={() => onEdit(template.id)}>
              <Edit className="mr-2 h-3 w-3" />
              Edytuj
            </Button>
          )}
          {!isSystemTemplate ? (
            <>
              <Button
                variant="outline"
                size="sm"
                onClick={() =>
                  router.push(`/dashboard/warehouse/products/templates/clone/${template.id}`)
                }
              >
                <Copy className="mr-2 h-3 w-3" />
                Klonuj
              </Button>
              {onDelete && (
                <Button
                  variant="ghost"
                  size="sm"
                  className="text-destructive"
                  onClick={() => onDelete(template.id)}
                >
                  <Trash2 className="h-3 w-3" />
                </Button>
              )}
            </>
          ) : (
            <>
              <Button
                variant="outline"
                size="sm"
                onClick={() =>
                  router.push(`/dashboard/warehouse/products/templates/clone/${template.id}`)
                }
              >
                <Copy className="mr-2 h-3 w-3" />
                Klonuj
              </Button>
              <Button variant="ghost" size="sm">
                <Settings className="h-3 w-3" />
              </Button>
            </>
          )}
        </div>
      </CardContent>
    </Card>
  );
};

const renderTemplateList = (
  templateData: TemplateWithAttributes,
  onCreateProduct: (template: TemplateWithAttributes) => void,
  router: any,
  onEdit?: (templateId: string) => void,
  onDelete?: (templateId: string) => void
) => {
  const template = templateData.template;
  const isSystemTemplate = template.is_system;

  return (
    <Card
      key={template.id}
      className="cursor-pointer transition-all hover:border-primary hover:bg-muted/20 hover:shadow-md"
    >
      <CardContent className="p-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div
              className="flex h-12 w-12 items-center justify-center rounded-lg"
              style={{ backgroundColor: `${template.color}20`, color: template.color }}
            >
              <File className="h-6 w-6" />
            </div>
            <div className="flex-1">
              <div className="mb-1 flex items-center gap-2">
                <h3 className="font-semibold">{template.name}</h3>
                <Badge variant={isSystemTemplate ? "secondary" : "default"} className="text-xs">
                  {isSystemTemplate ? "System" : "Własny"}
                </Badge>
              </div>
              <p className="mb-2 text-sm text-muted-foreground">{template.description}</p>
              <div className="space-y-1">
                <div className="flex items-center gap-4 text-sm text-muted-foreground">
                  <span>{templateData.attribute_count} atrybutów</span>
                  <div className="flex gap-1">
                    {template.supported_contexts.map((context) => (
                      <Badge key={context} variant="outline" className="text-xs">
                        {context}
                      </Badge>
                    ))}
                  </div>
                </div>

                {/* Inheritance Indicators for List View */}
                {templateData.attributes && templateData.attributes.length > 0 && (
                  <div className="flex items-center gap-4 text-xs text-muted-foreground">
                    {(() => {
                      const stats = getInheritanceStats(templateData);
                      return (
                        <>
                          <div className="flex items-center gap-1" title="Dziedziczalne atrybuty">
                            <ArrowDown className="h-3 w-3 text-green-600" />
                            <span>{stats.inheritable} dziedziczalne</span>
                          </div>
                          <div
                            className="flex items-center gap-1"
                            title="Atrybuty specyficzne dla wariantów"
                          >
                            <GitBranch className="h-3 w-3 text-blue-600" />
                            <span>{stats.variantSpecific} wariantowe</span>
                          </div>
                          <div className="flex items-center gap-1" title="Dziedziczone domyślnie">
                            <Shuffle className="h-3 w-3 text-purple-600" />
                            <span>{stats.inheritByDefault} domyślne</span>
                          </div>
                        </>
                      );
                    })()}
                  </div>
                )}
              </div>
            </div>
          </div>
          <div className="flex gap-2">
            <Button variant="default" size="sm" onClick={() => onCreateProduct(templateData)}>
              <Plus className="mr-2 h-3 w-3" />
              Utwórz produkt
            </Button>
            {!isSystemTemplate && onEdit && (
              <Button variant="outline" size="sm" onClick={() => onEdit(template.id)}>
                <Edit className="mr-2 h-3 w-3" />
                Edytuj
              </Button>
            )}
            <Button
              variant="outline"
              size="sm"
              onClick={() =>
                router.push(`/dashboard/warehouse/products/templates/clone/${template.id}`)
              }
            >
              <Copy className="mr-2 h-3 w-3" />
              Klonuj
            </Button>
            {!isSystemTemplate && onDelete && (
              <Button
                variant="ghost"
                size="sm"
                className="text-destructive"
                onClick={() => onDelete(template.id)}
              >
                <Trash2 className="h-3 w-3" />
              </Button>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
};

const renderTemplateTable = (
  templates: TemplateWithAttributes[],
  onCreateProduct: (template: TemplateWithAttributes) => void,
  router: any,
  onEdit?: (templateId: string) => void,
  onDelete?: (templateId: string) => void
) => {
  return (
    <div className="overflow-x-auto">
      <table className="w-full">
        <thead>
          <tr className="border-b">
            <th className="p-3 text-left font-semibold">Szablon</th>
            <th className="p-3 text-left font-semibold">Typ</th>
            <th className="p-3 text-left font-semibold">Atrybuty</th>
            <th className="p-3 text-left font-semibold">Konteksty</th>
            <th className="p-3 text-right font-semibold">Akcje</th>
          </tr>
        </thead>
        <tbody>
          {templates.map((templateData) => {
            const template = templateData.template;
            const isSystemTemplate = template.is_system;

            return (
              <tr key={template.id} className="border-b transition-colors hover:bg-muted/20">
                <td className="p-3">
                  <div className="flex items-center gap-3">
                    <div
                      className="flex h-8 w-8 items-center justify-center rounded-lg"
                      style={{ backgroundColor: `${template.color}20`, color: template.color }}
                    >
                      <File className="h-4 w-4" />
                    </div>
                    <div>
                      <div className="font-medium">{template.name}</div>
                      <div className="text-sm text-muted-foreground">{template.description}</div>
                    </div>
                  </div>
                </td>
                <td className="p-3">
                  <Badge variant={isSystemTemplate ? "secondary" : "default"} className="text-xs">
                    {isSystemTemplate ? "System" : "Własny"}
                  </Badge>
                </td>
                <td className="p-3">
                  <div className="space-y-1">
                    <div className="text-muted-foreground">
                      {templateData.attribute_count} total
                    </div>
                    {/* Inheritance Indicators for Table View */}
                    {templateData.attributes && templateData.attributes.length > 0 && (
                      <div className="flex items-center gap-3 text-xs text-muted-foreground">
                        {(() => {
                          const stats = getInheritanceStats(templateData);
                          return (
                            <>
                              <div
                                className="flex items-center gap-1"
                                title="Dziedziczalne atrybuty"
                              >
                                <ArrowDown className="h-3 w-3 text-green-600" />
                                <span>{stats.inheritable}</span>
                              </div>
                              <div
                                className="flex items-center gap-1"
                                title="Atrybuty specyficzne dla wariantów"
                              >
                                <GitBranch className="h-3 w-3 text-blue-600" />
                                <span>{stats.variantSpecific}</span>
                              </div>
                            </>
                          );
                        })()}
                      </div>
                    )}
                  </div>
                </td>
                <td className="p-3">
                  <div className="flex gap-1">
                    {template.supported_contexts.map((context) => (
                      <Badge key={context} variant="outline" className="text-xs">
                        {context}
                      </Badge>
                    ))}
                  </div>
                </td>
                <td className="p-3">
                  <div className="flex justify-end gap-1">
                    <Button
                      variant="default"
                      size="sm"
                      onClick={() => onCreateProduct(templateData)}
                    >
                      <Plus className="h-3 w-3" />
                    </Button>
                    {!isSystemTemplate && onEdit && (
                      <Button variant="outline" size="sm" onClick={() => onEdit(template.id)}>
                        <Edit className="h-3 w-3" />
                      </Button>
                    )}
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() =>
                        router.push(`/dashboard/warehouse/products/templates/clone/${template.id}`)
                      }
                    >
                      <Copy className="h-3 w-3" />
                    </Button>
                    {!isSystemTemplate && onDelete && (
                      <Button
                        variant="ghost"
                        size="sm"
                        className="text-destructive"
                        onClick={() => onDelete(template.id)}
                      >
                        <Trash2 className="h-3 w-3" />
                      </Button>
                    )}
                  </div>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
};

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
  const [displayMode, setDisplayMode] = React.useState<DisplayMode>("grid");

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

  const handleEditTemplate = (templateId: string) => {
    router.push(`/dashboard/warehouse/products/templates/edit/${templateId}`);
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
        <div className="flex gap-2">
          <Button
            variant="ghost"
            onClick={() => router.push("/dashboard/warehouse/products/templates/create")}
          >
            <Plus className="mr-2 h-4 w-4" />
            Utwórz szablon
          </Button>
          <Button
            onClick={() =>
              handleCreateProductWithTemplate({
                template: {
                  id: "",
                  name: "",
                  slug: "",
                  description: "",
                  color: "#10b981",
                  organization_id: "",
                  is_system: false,
                  is_active: true,
                  category: "custom",
                  supported_contexts: ["warehouse"],
                  settings: {},
                  created_by: null,
                  parent_template_id: null,
                  created_at: new Date().toISOString(),
                  updated_at: new Date().toISOString(),
                },
                attributes: [],
                attribute_count: 0,
              })
            }
          >
            <Plus className="mr-2 h-4 w-4" />
            Dodaj produkt
          </Button>
        </div>
      </div>

      {/* View Controls */}
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
      >
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-lg">Widok szablonów</CardTitle>
          </CardHeader>
          <CardContent className="flex justify-end">
            <ToggleGroup
              type="single"
              value={displayMode}
              onValueChange={(value: DisplayMode) => value && setDisplayMode(value)}
              aria-label="Wybierz tryb wyświetlania"
            >
              <ToggleGroupItem value="grid" aria-label="Widok siatki" className="rounded-l-[6px]">
                <LayoutGrid className="h-4 w-4" />
              </ToggleGroupItem>
              <ToggleGroupItem value="list" aria-label="Widok listy">
                <List className="h-4 w-4" />
              </ToggleGroupItem>
              <ToggleGroupItem value="table" aria-label="Widok tabeli" className="rounded-r-[6px]">
                <TableIcon className="h-4 w-4" />
              </ToggleGroupItem>
            </ToggleGroup>
          </CardContent>
        </Card>
      </motion.div>

      {/* System Templates */}
      <div>
        <h2 className="mb-4 text-xl font-semibold">Szablony systemowe</h2>
        {displayMode === "grid" && (
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
            {systemTemplates.map((templateData) =>
              renderTemplateCard(
                templateData,
                handleCreateProductWithTemplate,
                router,
                handleEditTemplate,
                handleDeleteTemplate
              )
            )}
          </div>
        )}
        {displayMode === "list" && (
          <div className="space-y-4">
            {systemTemplates.map((templateData) =>
              renderTemplateList(
                templateData,
                handleCreateProductWithTemplate,
                router,
                handleEditTemplate,
                handleDeleteTemplate
              )
            )}
          </div>
        )}
        {displayMode === "table" &&
          renderTemplateTable(
            systemTemplates,
            handleCreateProductWithTemplate,
            router,
            handleEditTemplate,
            handleDeleteTemplate
          )}
      </div>

      {/* Organization Templates */}
      <div>
        <h2 className="mb-4 text-xl font-semibold">Szablony organizacji</h2>
        {organizationTemplates.length > 0 ? (
          <>
            {displayMode === "grid" && (
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
                {organizationTemplates.map((templateData) =>
                  renderTemplateCard(
                    templateData,
                    handleCreateProductWithTemplate,
                    router,
                    handleEditTemplate,
                    handleDeleteTemplate
                  )
                )}
              </div>
            )}
            {displayMode === "list" && (
              <div className="space-y-4">
                {organizationTemplates.map((templateData) =>
                  renderTemplateList(
                    templateData,
                    handleCreateProductWithTemplate,
                    router,
                    handleEditTemplate,
                    handleDeleteTemplate
                  )
                )}
              </div>
            )}
            {displayMode === "table" &&
              renderTemplateTable(
                organizationTemplates,
                handleCreateProductWithTemplate,
                router,
                handleEditTemplate,
                handleDeleteTemplate
              )}
          </>
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
      <Dialog
        open={showCreateProductDialog}
        onOpenChange={(open) => {
          setShowCreateProductDialog(open);
          if (!open) {
            setSelectedTemplateForProduct(null);
          }
        }}
      >
        <DialogContent className="max-h-[90vh] max-w-4xl overflow-y-auto">
          {selectedTemplateForProduct && (
            <TemplateBuilder
              builderType="product"
              productMode="create"
              baseTemplate={selectedTemplateForProduct}
              onSave={() => {
                setShowCreateProductDialog(false);
                setSelectedTemplateForProduct(null);
                toast.success("Produkt został utworzony pomyślnie");
                // Optionally navigate to products page or refresh
              }}
              onCancel={() => {
                setShowCreateProductDialog(false);
                setSelectedTemplateForProduct(null);
              }}
            />
          )}
        </DialogContent>
      </Dialog>
    </motion.div>
  );
}
