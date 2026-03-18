"use client";

import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Plus, Save, Download, Eye, Edit, Settings, Star, Loader2, Copy } from "lucide-react";
import { LabelTemplate } from "@/lib/types/qr-system";
import { InteractiveLabelCanvas } from "./InteractiveLabelCanvas";
import { LabelFieldEditor } from "./LabelFieldEditor";
import { LabelGenerationDialog } from "./LabelGenerationDialog";
import { useLabelCreatorStore } from "@/lib/stores/label-creator-store";
import { v4 as uuidv4 } from "uuid";
import { toast } from "react-toastify";

const LABEL_SIZES = [
  { name: "Mała (25×15mm)", width: 25, height: 15 },
  { name: "Średnia (40×20mm)", width: 40, height: 20 },
  { name: "Duża (50×30mm)", width: 50, height: 30 },
  { name: "Bardzo duża (70×40mm)", width: 70, height: 40 },
  { name: "Niestandardowa", width: 0, height: 0 },
];

interface WYSIWYGLabelCreatorProps {
  templateId?: string; // If provided, load this template for editing
  onSaved?: (template: LabelTemplate) => void; // Callback when template is saved
}

export function WYSIWYGLabelCreator({ templateId, onSaved }: WYSIWYGLabelCreatorProps = {}) {
  // Use the store for state management
  const {
    currentTemplate: labelTemplate,
    selectedField,
    viewMode,
    isCustomSize,
    generationDialogOpen,
    isLoadingTemplate,
    isSavingTemplate,
    originalTemplateId,
    isEditingTemplate,
    updateTemplate,
    setSelectedField,
    setViewMode,
    setIsCustomSize,
    setGenerationDialogOpen,
    addField,
    updateField,
    removeField,
    moveField,
    loadTemplate,
    setLoadingStates,
  } = useLabelCreatorStore();

  // Local loading state for template loading
  const [localIsLoadingTemplate, setLocalIsLoadingTemplate] = useState(!!templateId);

  // Load template if templateId is provided
  useEffect(() => {
    if (templateId && localIsLoadingTemplate) {
      const loadTemplateData = async () => {
        setLoadingStates({ isLoadingTemplate: true });
        try {
          const response = await fetch(`/api/labels/templates/${templateId}`);
          const data = await response.json();

          if (data.success && data.template) {
            // Map database template to our LabelTemplate interface with defaults
            const template = data.template;
            const config = template.template_config || {};

            const mappedTemplate: LabelTemplate = {
              ...labelTemplate, // Keep current defaults
              ...template, // Override with database data
              // Extract fields from template_config and provide defaults
              field_vertical_gap: config.field_vertical_gap ?? template.field_vertical_gap ?? 2,
              label_padding_top: config.label_padding_top ?? template.label_padding_top ?? 2,
              label_padding_right: config.label_padding_right ?? template.label_padding_right ?? 2,
              label_padding_bottom:
                config.label_padding_bottom ?? template.label_padding_bottom ?? 2,
              label_padding_left: config.label_padding_left ?? template.label_padding_left ?? 2,
              items_alignment: config.items_alignment ?? template.items_alignment ?? "center",
              // Ensure required fields have defaults
              show_additional_info: template.show_additional_info ?? true,
              additional_info_position: template.additional_info_position ?? "bottom",
              layout_direction: template.layout_direction ?? "row",
              section_balance: template.section_balance ?? "equal",
              orientation: template.orientation ?? "portrait",
              fields: template.fields ?? [],
            };

            loadTemplate(mappedTemplate);
            setLoadingStates({
              isEditingTemplate: true,
              originalTemplateId: data.template.id,
            });

            toast.success("Szablon został załadowany do edycji");
          } else {
            toast.error(
              `Nie udało się załadować szablonu: ${data.error || "Szablon nie znaleziony"}`
            );
          }
        } catch (error) {
          console.error("Error loading template:", error);
          toast.error("Błąd podczas ładowania szablonu. Sprawdź połączenie i spróbuj ponownie.");
        } finally {
          setLoadingStates({ isLoadingTemplate: false });
          setLocalIsLoadingTemplate(false);
        }
      };

      loadTemplateData();
    }
  }, [templateId, localIsLoadingTemplate, labelTemplate, loadTemplate, setLoadingStates]);

  const handleSizeChange = (sizeName: string) => {
    const size = LABEL_SIZES.find((s) => s.name === sizeName);
    if (size) {
      if (size.name === "Niestandardowa") {
        setIsCustomSize(true);
      } else {
        setIsCustomSize(false);
        updateTemplate({
          width_mm: size.width,
          height_mm: size.height,
        });
      }
    }
  };

  const handleAdditionalInfoToggle = (showAdditionalInfo: boolean) => {
    if (showAdditionalInfo) {
      // When enabling additional info, restore to standard rectangle size
      const standardSize = LABEL_SIZES.find((s) => s.name === "Średnia (40×20mm)");
      updateTemplate({
        show_additional_info: showAdditionalInfo,
        width_mm: standardSize?.width || 40,
        height_mm: standardSize?.height || 20,
      });
    } else {
      // When hiding additional info, make it a square
      const squareSize = Math.min(
        (labelTemplate as any).width_mm,
        (labelTemplate as any).height_mm
      );
      updateTemplate({
        show_additional_info: showAdditionalInfo,
        width_mm: squareSize,
        height_mm: squareSize,
      });
    }
  };

  const generateLabels = () => {
    // Check if template has a name
    if (!(labelTemplate as any).name.trim()) {
      toast.error("Najpierw nadaj nazwę etykiecie!");
      return;
    }
    // Open generation dialog with current template
    setGenerationDialogOpen(true);
  };

  const saveAsTemplate = async (saveAsNew = false) => {
    if (!(labelTemplate as any).name.trim()) {
      toast.error("Nazwa szablonu jest wymagana. Wprowadź nazwę szablonu przed zapisaniem.");
      return;
    }

    setLoadingStates({ isSavingTemplate: true });
    try {
      const isUpdating = isEditingTemplate && originalTemplateId && !saveAsNew;

      let response;
      if (isUpdating) {
        // Update existing template
        response = await fetch(`/api/labels/templates/${originalTemplateId}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(labelTemplate),
        });
      } else {
        // Create new template
        const templateData = { ...labelTemplate };
        if (saveAsNew) {
          // Generate new ID and name for "Save as New"
          templateData.id = uuidv4();
          templateData.name = `${templateData.name} (kopia)`;
        }

        response = await fetch("/api/labels/templates", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(templateData),
        });
      }

      const data = await response.json();
      if (data.success) {
        if (isUpdating) {
          toast.success("Szablon został zaktualizowany!");
        } else {
          toast.success("Szablon został zapisany! Możesz go teraz używać do generowania etykiet.");
          // Switch to edit mode for the new template
          setLoadingStates({
            originalTemplateId: data.template.id,
            isEditingTemplate: true,
          });
          updateTemplate({ id: data.template.id });
        }
        onSaved?.(labelTemplate);
      } else {
        toast.error(`Błąd podczas zapisywania szablonu: ${data.error || "Spróbuj ponownie"}`);
      }
    } catch (error) {
      console.error("Error saving template:", error);
      toast.error("Błąd podczas zapisywania szablonu. Sprawdź połączenie i spróbuj ponownie.");
    } finally {
      setLoadingStates({ isSavingTemplate: false });
    }
  };

  const currentSize = isCustomSize
    ? "Niestandardowa"
    : LABEL_SIZES.find(
        (s) =>
          s.width === (labelTemplate as any).width_mm &&
          s.height === (labelTemplate as any).height_mm
      )?.name || "Niestandardowa";

  if (isLoadingTemplate || localIsLoadingTemplate) {
    return (
      <div className="container mx-auto flex h-screen items-center justify-center p-6">
        <div className="text-center">
          <Loader2 className="mx-auto h-8 w-8 animate-spin text-muted-foreground" />
          <p className="mt-2 text-muted-foreground">Ładowanie szablonu...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto flex max-h-screen flex-col p-6">
      {/* Header */}
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Kreator etykiet</h1>
          <p className="text-muted-foreground">Projektuj etykiety w trybie WYSIWYG</p>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex items-center rounded-lg border p-1">
            <Button
              variant={viewMode === "edit" ? "default" : "ghost"}
              size="sm"
              onClick={() => setViewMode("edit")}
              className="px-3"
            >
              <Edit className="mr-2 h-4 w-4" />
              Edycja
            </Button>
            <Button
              variant={viewMode === "preview" ? "default" : "ghost"}
              size="sm"
              onClick={() => setViewMode("preview")}
              className="px-3"
            >
              <Eye className="mr-2 h-4 w-4" />
              Podgląd
            </Button>
          </div>
          <div className="flex gap-2">
            {isEditingTemplate && originalTemplateId && (
              <Button
                onClick={() => saveAsTemplate(true)}
                variant="outline"
                disabled={isSavingTemplate}
                size="sm"
              >
                <Copy className="mr-2 h-4 w-4" />
                Zapisz jako nowy
              </Button>
            )}
            <Button
              onClick={() => saveAsTemplate(false)}
              variant="outline"
              disabled={isSavingTemplate}
            >
              {isSavingTemplate ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <Save className="mr-2 h-4 w-4" />
              )}
              {isSavingTemplate ? "Zapisywanie..." : isEditingTemplate ? "Zapisz" : "Zapisz wzór"}
            </Button>
          </div>
          <Button onClick={generateLabels}>
            <Download className="mr-2 h-4 w-4" />
            Generuj etykiety
          </Button>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex min-h-0 flex-1 gap-6">
        {/* Canvas Area */}
        <div className="flex min-w-0 flex-1 flex-col">
          <InteractiveLabelCanvas
            template={labelTemplate}
            selectedField={selectedField}
            onFieldSelect={setSelectedField}
            onFieldAdd={addField}
            viewMode={viewMode}
          />
        </div>

        {/* Right Sidebar */}
        <div className="w-80 flex-shrink-0 rounded-lg border bg-background">
          <div className="p-4">
            <Tabs defaultValue="basic">
              <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger value="basic" className="flex items-center gap-2">
                  <Settings className="h-4 w-4" />
                  Podstawowe
                </TabsTrigger>
                <TabsTrigger
                  value="field"
                  className="flex items-center gap-2"
                  disabled={!selectedField}
                >
                  <Edit className="h-4 w-4" />
                  Pole
                </TabsTrigger>
              </TabsList>

              {/* Basic Settings Tab */}
              <TabsContent
                value="basic"
                className="mt-4 max-h-[calc(100vh-200px)] space-y-4 overflow-y-auto"
              >
                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-sm">Etykieta</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="space-y-2">
                      <Label htmlFor="name" className="text-sm">
                        Nazwa
                      </Label>
                      <Input
                        id="name"
                        value={(labelTemplate as any).name}
                        onChange={(e) => updateTemplate({ name: e.target.value })}
                        placeholder="np. Etykiety produktów"
                        className="h-8"
                      />
                    </div>

                    <div className="space-y-2">
                      <Label className="text-sm">Rozmiar</Label>
                      <Select value={currentSize} onValueChange={handleSizeChange}>
                        <SelectTrigger className="h-8">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {LABEL_SIZES.map((size) => (
                            <SelectItem key={size.name} value={size.name}>
                              {size.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    {isCustomSize && (
                      <div className="grid grid-cols-2 gap-2">
                        <div className="space-y-1">
                          <Label htmlFor="width" className="text-xs">
                            Szerokość (mm)
                          </Label>
                          <Input
                            id="width"
                            type="number"
                            value={(labelTemplate as any).width_mm}
                            onChange={(e) =>
                              updateTemplate({
                                width_mm: parseFloat(e.target.value) || 25,
                              })
                            }
                            className="h-8"
                          />
                        </div>
                        <div className="space-y-1">
                          <Label htmlFor="height" className="text-xs">
                            Wysokość (mm)
                          </Label>
                          <Input
                            id="height"
                            type="number"
                            value={(labelTemplate as any).height_mm}
                            onChange={(e) =>
                              updateTemplate({
                                height_mm: parseFloat(e.target.value) || 25,
                              })
                            }
                            className="h-8"
                          />
                        </div>
                      </div>
                    )}

                    <div className="flex items-center justify-between">
                      <Label htmlFor="additional-info" className="text-sm">
                        Dodatkowe informacje
                      </Label>
                      <Switch
                        id="additional-info"
                        checked={(labelTemplate as any).show_additional_info}
                        onCheckedChange={handleAdditionalInfoToggle}
                      />
                    </div>

                    {!(labelTemplate as any).show_additional_info && (
                      <div className="rounded bg-muted p-2 text-xs text-muted-foreground">
                        Tylko kod QR (kwadrat)
                      </div>
                    )}

                    {(labelTemplate as any).show_additional_info && (
                      <>
                        <div className="space-y-2">
                          <Label htmlFor="field-gap" className="text-sm">
                            Odstęp między polami (mm)
                          </Label>
                          <Input
                            id="field-gap"
                            type="number"
                            value={(labelTemplate as any).field_vertical_gap || 2}
                            onChange={(e) =>
                              updateTemplate({
                                field_vertical_gap: parseFloat(e.target.value) || 2,
                              } as any)
                            }
                            min="0"
                            max="10"
                            step="0.5"
                            className="h-8"
                          />
                        </div>

                        <div className="space-y-2">
                          <Label htmlFor="layout-direction" className="text-sm">
                            Układ elementów
                          </Label>
                          <Select
                            value={(labelTemplate as any).layout_direction || "row"}
                            onValueChange={(
                              value: "row" | "column" | "row-reverse" | "column-reverse"
                            ) => updateTemplate({ layout_direction: value })}
                          >
                            <SelectTrigger className="h-8">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="row">Poziomo (QR lewo)</SelectItem>
                              <SelectItem value="row-reverse">
                                Poziomo odwrotnie (QR prawo)
                              </SelectItem>
                              <SelectItem value="column">Pionowo (QR góra)</SelectItem>
                              <SelectItem value="column-reverse">
                                Pionowo odwrotnie (QR dół)
                              </SelectItem>
                            </SelectContent>
                          </Select>
                        </div>

                        <div className="space-y-2">
                          <Label htmlFor="items-alignment" className="text-sm">
                            Wyrównanie elementów
                          </Label>
                          <Select
                            value={(labelTemplate as any).items_alignment || "center"}
                            onValueChange={(value: "start" | "center" | "end") =>
                              updateTemplate({ items_alignment: value } as any)
                            }
                          >
                            <SelectTrigger className="h-8">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="start">Początek</SelectItem>
                              <SelectItem value="center">Środek</SelectItem>
                              <SelectItem value="end">Koniec</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                      </>
                    )}

                    <div className="space-y-4">
                      <div className="flex items-center justify-between">
                        <Label htmlFor="label-border" className="text-sm">
                          Ramka etykiety
                        </Label>
                        <Switch
                          id="label-border"
                          checked={(labelTemplate as any).border_enabled}
                          onCheckedChange={(checked) => updateTemplate({ border_enabled: checked })}
                        />
                      </div>

                      {(labelTemplate as any).border_enabled && (
                        <div className="grid grid-cols-2 gap-2">
                          <div className="space-y-1">
                            <Label htmlFor="border-width" className="text-xs">
                              Grubość ramki
                            </Label>
                            <Input
                              id="border-width"
                              type="number"
                              value={(labelTemplate as any).border_width}
                              onChange={(e) =>
                                updateTemplate({
                                  border_width: parseFloat(e.target.value) || 0.5,
                                })
                              }
                              min="0.5"
                              max="5"
                              step="0.5"
                              className="h-8"
                            />
                          </div>
                          <div className="space-y-1">
                            <Label htmlFor="border-color" className="text-xs">
                              Kolor ramki
                            </Label>
                            <Input
                              id="border-color"
                              type="color"
                              value={(labelTemplate as any).border_color}
                              onChange={(e) =>
                                updateTemplate({
                                  border_color: e.target.value,
                                })
                              }
                              className="h-8"
                            />
                          </div>
                        </div>
                      )}

                      <div className="space-y-2">
                        <Label className="text-sm">Marginesy etykiety (mm)</Label>
                        <div className="grid grid-cols-2 gap-2">
                          <div className="space-y-1">
                            <Label className="text-xs">Góra</Label>
                            <Input
                              type="number"
                              value={(labelTemplate as any).label_padding_top || 2}
                              onChange={(e) =>
                                updateTemplate({
                                  label_padding_top: parseFloat(e.target.value) || 2,
                                } as any)
                              }
                              min="0"
                              max="10"
                              step="0.5"
                              className="h-8"
                            />
                          </div>
                          <div className="space-y-1">
                            <Label className="text-xs">Dół</Label>
                            <Input
                              type="number"
                              value={(labelTemplate as any).label_padding_bottom || 2}
                              onChange={(e) =>
                                updateTemplate({
                                  label_padding_bottom: parseFloat(e.target.value) || 2,
                                } as any)
                              }
                              min="0"
                              max="10"
                              step="0.5"
                              className="h-8"
                            />
                          </div>
                          <div className="space-y-1">
                            <Label className="text-xs">Lewo</Label>
                            <Input
                              type="number"
                              value={(labelTemplate as any).label_padding_left || 2}
                              onChange={(e) =>
                                updateTemplate({
                                  label_padding_left: parseFloat(e.target.value) || 2,
                                } as any)
                              }
                              min="0"
                              max="10"
                              step="0.5"
                              className="h-8"
                            />
                          </div>
                          <div className="space-y-1">
                            <Label className="text-xs">Prawo</Label>
                            <Input
                              type="number"
                              value={(labelTemplate as any).label_padding_right || 2}
                              onChange={(e) =>
                                updateTemplate({
                                  label_padding_right: parseFloat(e.target.value) || 2,
                                } as any)
                              }
                              min="0"
                              max="10"
                              step="0.5"
                              className="h-8"
                            />
                          </div>
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                {/* Fields Section - only show when additional info is enabled */}
                {(labelTemplate as any).show_additional_info && (
                  <Card>
                    <CardHeader className="pb-3">
                      <div className="flex items-center justify-between">
                        <CardTitle className="text-sm">Pola</CardTitle>
                        <Badge variant="secondary" className="text-xs">
                          {(labelTemplate as any).fields?.length || 0}
                        </Badge>
                      </div>
                    </CardHeader>
                    <CardContent className="space-y-3">
                      <div className="grid grid-cols-2 gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => addField("text")}
                          className="h-8 text-xs"
                        >
                          <Plus className="mr-1 h-3 w-3" />
                          Tekst
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => addField("blank")}
                          className="h-8 text-xs"
                        >
                          <Plus className="mr-1 h-3 w-3" />
                          Puste
                        </Button>
                      </div>

                      {(labelTemplate as any).fields &&
                        (labelTemplate as any).fields.length > 0 && (
                          <div className="space-y-2">
                            <Label className="text-xs text-muted-foreground">Dodane pola:</Label>
                            <div className="max-h-32 space-y-1 overflow-y-auto">
                              {(labelTemplate as any).fields
                                .sort((a, b) => a.sort_order - b.sort_order)
                                .map((field, index) => (
                                  <div
                                    key={field.id}
                                    className={`flex cursor-pointer items-center gap-2 rounded border p-2 text-xs transition-colors ${
                                      selectedField?.id === field.id
                                        ? "border-primary bg-primary/5"
                                        : "border-border hover:border-primary/50"
                                    }`}
                                    onClick={() => setSelectedField(field)}
                                  >
                                    {/* Drag handle */}
                                    <div className="flex flex-col gap-0.5">
                                      <Button
                                        variant="ghost"
                                        size="sm"
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          moveField(field.id, "up");
                                        }}
                                        disabled={index === 0}
                                        className="h-3 w-4 p-0 text-muted-foreground hover:text-foreground"
                                      >
                                        ↑
                                      </Button>
                                      <Button
                                        variant="ghost"
                                        size="sm"
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          moveField(field.id, "down");
                                        }}
                                        disabled={
                                          index === (labelTemplate as any).fields.length - 1
                                        }
                                        className="h-3 w-4 p-0 text-muted-foreground hover:text-foreground"
                                      >
                                        ↓
                                      </Button>
                                    </div>

                                    {/* Field info */}
                                    <div className="flex min-w-0 flex-1 items-center gap-2">
                                      <Badge
                                        variant={
                                          field.field_type === "text" ? "default" : "outline"
                                        }
                                        className="flex-shrink-0 text-xs"
                                      >
                                        {field.field_type === "text" ? "T" : "B"}
                                      </Badge>
                                      <span className="truncate">{field.field_name}</span>
                                    </div>

                                    {/* Required toggle */}
                                    <Button
                                      variant="ghost"
                                      size="sm"
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        updateField(field.id, { is_required: !field.is_required });
                                      }}
                                      className={`h-5 w-5 p-0 ${
                                        field.is_required
                                          ? "text-amber-600 hover:text-amber-700"
                                          : "text-muted-foreground hover:text-amber-600"
                                      }`}
                                      title={
                                        field.is_required ? "Pole wymagane" : "Pole opcjonalne"
                                      }
                                    >
                                      <Star
                                        className={`h-3 w-3 ${field.is_required ? "fill-current" : ""}`}
                                      />
                                    </Button>

                                    {/* Delete button */}
                                    <Button
                                      variant="ghost"
                                      size="sm"
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        removeField(field.id);
                                      }}
                                      className="h-5 w-5 p-0 hover:bg-destructive hover:text-destructive-foreground"
                                      title="Usuń pole"
                                    >
                                      ×
                                    </Button>
                                  </div>
                                ))}
                            </div>
                          </div>
                        )}
                    </CardContent>
                  </Card>
                )}
              </TabsContent>

              {/* Field Settings Tab */}
              <TabsContent value="field" className="mt-4 max-h-[calc(100vh-200px)] overflow-y-auto">
                {selectedField ? (
                  <LabelFieldEditor
                    field={selectedField}
                    onUpdate={(updates) => updateField(selectedField.id, updates)}
                    onRemove={() => removeField(selectedField.id)}
                  />
                ) : (
                  <div className="py-8 text-center text-muted-foreground">
                    <p className="text-sm">Wybierz pole z etykiety aby je edytować</p>
                  </div>
                )}
              </TabsContent>
            </Tabs>
          </div>
        </div>
      </div>

      {/* Label Generation Dialog */}
      <LabelGenerationDialog
        templates={[labelTemplate]}
        open={generationDialogOpen}
        onClose={() => setGenerationDialogOpen(false)}
        currentTemplate={labelTemplate}
      />
    </div>
  );
}
