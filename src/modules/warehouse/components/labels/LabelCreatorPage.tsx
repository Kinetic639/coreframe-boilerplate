"use client";

import { useState } from "react";
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
import { Separator } from "@/components/ui/separator";
import { Plus, Save, Download, Eye, Monitor, Smartphone } from "lucide-react";
import { LabelTemplate, LabelTemplateField } from "@/lib/types/qr-system";
import { LabelFieldEditor } from "./LabelFieldEditor";
import { LabelPreviewCanvas } from "./LabelPreviewCanvas";
import { LabelGenerationDialog } from "./LabelGenerationDialog";
import { v4 as uuidv4 } from "uuid";

const LABEL_SIZES = [
  { name: "Mała (25×15mm)", width: 25, height: 15 },
  { name: "Średnia (40×20mm)", width: 40, height: 20 },
  { name: "Duża (50×30mm)", width: 50, height: 30 },
  { name: "Bardzo duża (70×40mm)", width: 70, height: 40 },
  { name: "Niestandardowa", width: 0, height: 0 },
];

export function LabelCreatorPage() {
  const [labelTemplate, setLabelTemplate] = useState<LabelTemplate>({
    id: uuidv4(),
    name: "",
    description: "",
    label_type: "generic",
    category: "medium",
    width_mm: 40,
    height_mm: 20,
    dpi: 300,
    orientation: "portrait",
    template_config: {},
    qr_position: "left",
    qr_size_mm: 15,
    show_label_text: false,
    label_text_position: "bottom",
    label_text_size: 12,
    show_code: false,
    show_additional_info: true,
    additional_info_position: "bottom",
    background_color: "#FFFFFF",
    text_color: "#000000",
    border_enabled: true,
    border_width: 0.5,
    border_color: "#000000",
    fields: [],
    is_default: false,
    is_system: false,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  });

  const [selectedField, setSelectedField] = useState<LabelTemplateField | null>(null);
  const [previewMode, setPreviewMode] = useState<"desktop" | "mobile">("desktop");
  const [isCustomSize, setIsCustomSize] = useState(false);
  const [generationDialogOpen, setGenerationDialogOpen] = useState(false);

  const handleSizeChange = (sizeName: string) => {
    const size = LABEL_SIZES.find((s) => s.name === sizeName);
    if (size) {
      if (size.name === "Niestandardowa") {
        setIsCustomSize(true);
      } else {
        setIsCustomSize(false);
        setLabelTemplate((prev) => ({
          ...prev,
          width_mm: size.width,
          height_mm: size.height,
        }));
      }
    }
  };

  const handleOrientationChange = (orientation: "portrait" | "landscape") => {
    setLabelTemplate((prev) => ({
      ...prev,
      orientation,
    }));
  };

  const handleAdditionalInfoToggle = (showAdditionalInfo: boolean) => {
    setLabelTemplate((prev) => ({
      ...prev,
      show_additional_info: showAdditionalInfo,
      // When hiding additional info, the label becomes a simple QR square
      ...(showAdditionalInfo
        ? {}
        : {
            width_mm: Math.min(prev.width_mm, prev.height_mm),
            height_mm: Math.min(prev.width_mm, prev.height_mm),
          }),
    }));
  };

  const addField = (fieldType: "text" | "blank") => {
    const fieldCount = labelTemplate.fields?.length || 0;
    const qrSize = labelTemplate.qr_size_mm;

    // Calculate available space for fields based on QR position
    let fieldX = 2;
    let fieldY = 2;
    let fieldWidth = labelTemplate.width_mm - 4;

    // Adjust position based on QR code position to avoid overlap
    if (
      labelTemplate.qr_position === "left" ||
      labelTemplate.qr_position === "top-left" ||
      labelTemplate.qr_position === "bottom-left"
    ) {
      fieldX = qrSize + 4;
      fieldWidth = labelTemplate.width_mm - qrSize - 6;
    } else if (
      labelTemplate.qr_position === "right" ||
      labelTemplate.qr_position === "top-right" ||
      labelTemplate.qr_position === "bottom-right"
    ) {
      fieldWidth = labelTemplate.width_mm - qrSize - 6;
    }

    // Stack fields vertically with proper spacing
    if (labelTemplate.qr_position === "top-left" || labelTemplate.qr_position === "top-right") {
      fieldY = Math.max(qrSize + 4, fieldCount * 6 + 2);
    } else if (
      labelTemplate.qr_position === "bottom-left" ||
      labelTemplate.qr_position === "bottom-right"
    ) {
      fieldY = fieldCount * 6 + 2;
    } else {
      fieldY = fieldCount * 6 + 2;
    }

    const newField: LabelTemplateField = {
      id: uuidv4(),
      label_template_id: labelTemplate.id,
      field_type: fieldType,
      field_name: `Field ${fieldCount + 1}`,
      field_value: fieldType === "text" ? "Sample text" : undefined,
      position_x: fieldX,
      position_y: fieldY,
      width_mm: Math.max(fieldWidth, 10),
      height_mm: 4,
      font_size: 10,
      font_weight: "normal",
      text_align: "left",
      vertical_align: "center",
      show_label: false,
      is_required: false,
      sort_order: fieldCount + 1,
      text_color: "#000000",
      background_color: "transparent",
      border_enabled: false,
      border_width: 0.5,
      border_color: "#000000",
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    setLabelTemplate((prev) => ({
      ...prev,
      fields: [...(prev.fields || []), newField],
    }));
    setSelectedField(newField);
  };

  const updateField = (fieldId: string, updates: Partial<LabelTemplateField>) => {
    setLabelTemplate((prev) => ({
      ...prev,
      fields: prev.fields?.map((field) =>
        field.id === fieldId
          ? { ...field, ...updates, updated_at: new Date().toISOString() }
          : field
      ),
    }));

    if (selectedField?.id === fieldId) {
      setSelectedField((prev) => (prev ? { ...prev, ...updates } : null));
    }
  };

  const removeField = (fieldId: string) => {
    setLabelTemplate((prev) => ({
      ...prev,
      fields: prev.fields?.filter((field) => field.id !== fieldId),
    }));
    if (selectedField?.id === fieldId) {
      setSelectedField(null);
    }
  };

  const generateLabels = () => {
    // Check if template has a name
    if (!labelTemplate.name.trim()) {
      alert("Najpierw nadaj nazwę etykiecie!");
      return;
    }
    // Open generation dialog with current template
    setGenerationDialogOpen(true);
  };

  const saveAsTemplate = async () => {
    // TODO: Implement save as template functionality
    void labelTemplate; // Suppress unused warning until implementation
  };

  const currentSize = isCustomSize
    ? "Niestandardowa"
    : LABEL_SIZES.find(
        (s) => s.width === labelTemplate.width_mm && s.height === labelTemplate.height_mm
      )?.name || "Niestandardowa";

  return (
    <div className="container mx-auto p-6">
      <div className="mb-6">
        <h1 className="text-3xl font-bold">Kreator etykiet</h1>
        <p className="text-muted-foreground">
          Utwórz nowe etykiety z możliwością dodawania pól i dostosowywania układu
        </p>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* Configuration Panel */}
        <div className="space-y-6 lg:col-span-1">
          {/* Basic Settings */}
          <Card>
            <CardHeader>
              <CardTitle>Podstawowe ustawienia</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="name">Nazwa etykiety</Label>
                <Input
                  id="name"
                  value={labelTemplate.name}
                  onChange={(e) => setLabelTemplate((prev) => ({ ...prev, name: e.target.value }))}
                  placeholder="np. Etykiety produktów"
                />
              </div>

              <div className="space-y-2">
                <Label>Rozmiar etykiety</Label>
                <Select value={currentSize} onValueChange={handleSizeChange}>
                  <SelectTrigger>
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
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="width">Szerokość (mm)</Label>
                    <Input
                      id="width"
                      type="number"
                      value={labelTemplate.width_mm}
                      onChange={(e) =>
                        setLabelTemplate((prev) => ({
                          ...prev,
                          width_mm: parseFloat(e.target.value) || 25,
                        }))
                      }
                      min="10"
                      max="200"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="height">Wysokość (mm)</Label>
                    <Input
                      id="height"
                      type="number"
                      value={labelTemplate.height_mm}
                      onChange={(e) =>
                        setLabelTemplate((prev) => ({
                          ...prev,
                          height_mm: parseFloat(e.target.value) || 25,
                        }))
                      }
                      min="10"
                      max="200"
                    />
                  </div>
                </div>
              )}

              <div className="space-y-2">
                <Label>Orientacja</Label>
                <div className="flex gap-2">
                  <Button
                    variant={labelTemplate.orientation === "portrait" ? "default" : "outline"}
                    size="sm"
                    onClick={() => handleOrientationChange("portrait")}
                  >
                    <Monitor className="mr-2 h-4 w-4" />
                    Pionowa
                  </Button>
                  <Button
                    variant={labelTemplate.orientation === "landscape" ? "default" : "outline"}
                    size="sm"
                    onClick={() => handleOrientationChange("landscape")}
                  >
                    <Smartphone className="mr-2 h-4 w-4" />
                    Pozioma
                  </Button>
                </div>
              </div>

              <div className="flex items-center justify-between">
                <Label htmlFor="additional-info">Pokaż dodatkowe informacje</Label>
                <Switch
                  id="additional-info"
                  checked={labelTemplate.show_additional_info}
                  onCheckedChange={handleAdditionalInfoToggle}
                />
              </div>

              {!labelTemplate.show_additional_info && (
                <div className="rounded-lg bg-muted p-3 text-sm text-muted-foreground">
                  <p>Etykieta będzie zawierać tylko kwadratowy kod QR</p>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Fields Management */}
          {labelTemplate.show_additional_info && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center justify-between">
                  <span>Pola etykiety</span>
                  <Badge variant="secondary">{labelTemplate.fields?.length || 0}</Badge>
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => addField("text")}
                    className="flex-1"
                  >
                    <Plus className="mr-2 h-4 w-4" />
                    Tekst
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => addField("blank")}
                    className="flex-1"
                  >
                    <Plus className="mr-2 h-4 w-4" />
                    Puste pole
                  </Button>
                </div>

                {labelTemplate.fields && labelTemplate.fields.length > 0 && (
                  <div className="space-y-2">
                    <Label className="text-sm font-medium">Dodane pola:</Label>
                    <div className="space-y-2">
                      {labelTemplate.fields.map((field) => (
                        <div
                          key={field.id}
                          className={`flex cursor-pointer items-center justify-between rounded border p-2 transition-colors ${
                            selectedField?.id === field.id
                              ? "border-primary bg-primary/5"
                              : "border-border hover:border-primary/50"
                          }`}
                          onClick={() => setSelectedField(field)}
                        >
                          <div className="flex items-center gap-2">
                            <Badge
                              variant={field.field_type === "text" ? "default" : "outline"}
                              className="text-xs"
                            >
                              {field.field_type === "text" ? "T" : "B"}
                            </Badge>
                            <span className="text-sm">{field.field_name}</span>
                          </div>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={(e) => {
                              e.stopPropagation();
                              removeField(field.id);
                            }}
                            className="h-6 w-6 p-0"
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

          {/* Field Editor */}
          {selectedField && (
            <LabelFieldEditor
              field={selectedField}
              onUpdate={(updates) => updateField(selectedField.id, updates)}
              onRemove={() => removeField(selectedField.id)}
            />
          )}
        </div>

        {/* Preview Panel */}
        <div className="space-y-6 lg:col-span-2">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center justify-between">
                <span>Podgląd etykiety</span>
                <div className="flex items-center gap-2">
                  <Button
                    variant={previewMode === "desktop" ? "default" : "outline"}
                    size="sm"
                    onClick={() => setPreviewMode("desktop")}
                  >
                    <Monitor className="h-4 w-4" />
                  </Button>
                  <Button
                    variant={previewMode === "mobile" ? "default" : "outline"}
                    size="sm"
                    onClick={() => setPreviewMode("mobile")}
                  >
                    <Smartphone className="h-4 w-4" />
                  </Button>
                </div>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <LabelPreviewCanvas
                template={labelTemplate}
                selectedField={selectedField}
                onFieldSelect={setSelectedField}
                mode={previewMode}
              />
            </CardContent>
          </Card>

          {/* Action Buttons */}
          <Card>
            <CardContent className="pt-6">
              <div className="flex flex-wrap gap-3">
                <Button onClick={saveAsTemplate} variant="outline">
                  <Save className="mr-2 h-4 w-4" />
                  Zapisz jako szablon
                </Button>
                <Button onClick={generateLabels}>
                  <Download className="mr-2 h-4 w-4" />
                  Generuj etykiety
                </Button>
                <Button variant="outline">
                  <Eye className="mr-2 h-4 w-4" />
                  Pełny podgląd
                </Button>
              </div>

              <Separator className="my-4" />

              <div className="text-sm text-muted-foreground">
                <h4 className="mb-2 font-medium">Informacje o etykiecie:</h4>
                <ul className="space-y-1">
                  <li>
                    Rozmiar: {labelTemplate.width_mm}×{labelTemplate.height_mm}mm
                  </li>
                  <li>
                    Orientacja: {labelTemplate.orientation === "portrait" ? "pionowa" : "pozioma"}
                  </li>
                  <li>Rozdzielczość: {labelTemplate.dpi} DPI</li>
                  <li>Liczba pól: {labelTemplate.fields?.length || 0}</li>
                  {!labelTemplate.show_additional_info && <li>Typ: tylko kod QR (kwadrat)</li>}
                </ul>
              </div>
            </CardContent>
          </Card>
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
