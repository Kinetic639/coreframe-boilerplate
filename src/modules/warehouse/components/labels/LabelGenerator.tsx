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
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import { Plus, Eye, Settings, Layers } from "lucide-react";
import { LabelPreview } from "./LabelPreview";
import { LabelCustomizer } from "./LabelCustomizer";
import { BatchLabelCreator } from "./BatchLabelCreator";
import type {
  LabelTemplate,
  LabelGenerationRequest,
  LabelPreviewData,
} from "@/lib/types/qr-system";
import { generateQRToken } from "@/lib/utils/qr-generator";

interface LabelGeneratorProps {
  templates: LabelTemplate[];
  onGenerate: (request: LabelGenerationRequest) => Promise<void>;
  isLoading?: boolean;
}

export function LabelGenerator({ templates, onGenerate, isLoading = false }: LabelGeneratorProps) {
  const [selectedTemplate, setSelectedTemplate] = useState<LabelTemplate | null>(null);
  const [labelType, setLabelType] = useState<"location" | "product" | "generic">("location");
  const [quantity, setQuantity] = useState(1);
  const [batchMode, setBatchMode] = useState(false);
  const [batchName, setBatchName] = useState("");
  const [previewData, setPreviewData] = useState<LabelPreviewData | null>(null);
  const [showCustomizer, setShowCustomizer] = useState(false);

  // Filter templates by type
  const filteredTemplates = templates.filter(
    (t) => t.label_type === labelType || t.label_type === "generic"
  );

  // Set default template when type changes
  useEffect(() => {
    const defaultTemplate = filteredTemplates.find((t) => t.is_default) || filteredTemplates[0];
    if (defaultTemplate) {
      setSelectedTemplate(defaultTemplate);
    }
  }, [labelType, filteredTemplates]);

  // Generate preview data when template changes
  useEffect(() => {
    if (selectedTemplate) {
      const sampleToken = generateQRToken();
      const mockPreview: LabelPreviewData = {
        qrToken: sampleToken,
        displayText: labelType === "location" ? "Sample Location" : "Sample Product",
        codeText: labelType === "location" ? "LOC-001" : "PRD-001",
        hierarchy: labelType === "location" ? ["Warehouse A", "Zone 1", "Shelf 3"] : undefined,
        barcode: labelType === "product" ? "1234567890123" : undefined,
        template: selectedTemplate,
      };
      setPreviewData(mockPreview);
    }
  }, [selectedTemplate, labelType]);

  const handleGenerate = async () => {
    if (!selectedTemplate) return;

    const request: LabelGenerationRequest = {
      templateId: selectedTemplate.id,
      labelType,
      quantity: batchMode ? quantity : 1,
      batchName: batchMode ? batchName : undefined,
    };

    await onGenerate(request);
  };

  const handleTemplateSelect = (templateId: string) => {
    const template = templates.find((t) => t.id === templateId);
    if (template) {
      setSelectedTemplate(template);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Generator Etykiet QR</h1>
          <p className="text-muted-foreground">Twórz etykiety QR dla lokalizacji i produktów</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => setShowCustomizer(!showCustomizer)}>
            <Settings className="mr-2 h-4 w-4" />
            Dostosuj
          </Button>
          <Button onClick={handleGenerate} disabled={!selectedTemplate || isLoading}>
            {batchMode ? <Layers className="mr-2 h-4 w-4" /> : <Plus className="mr-2 h-4 w-4" />}
            {batchMode ? `Generuj ${quantity} etykiet` : "Generuj etykietę"}
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* Configuration Panel */}
        <div className="space-y-6 lg:col-span-2">
          <Card>
            <CardHeader>
              <CardTitle>Konfiguracja Etykiety</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Label Type Selection */}
              <div className="space-y-2">
                <Label>Typ Etykiety</Label>
                <Select
                  value={labelType}
                  onValueChange={(value) =>
                    setLabelType(value as "location" | "product" | "generic")
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="location">Lokalizacja</SelectItem>
                    <SelectItem value="product">Produkt</SelectItem>
                    <SelectItem value="generic">Uniwersalna</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <Separator />

              {/* Template Selection */}
              <div className="space-y-3">
                <Label>Szablon Etykiety</Label>
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  {filteredTemplates.map((template) => (
                    <Card
                      key={template.id}
                      className={`cursor-pointer transition-all ${
                        selectedTemplate?.id === template.id
                          ? "bg-primary/5 ring-2 ring-primary"
                          : "hover:bg-muted/50"
                      }`}
                      onClick={() => handleTemplateSelect(template.id)}
                    >
                      <CardContent className="p-4">
                        <div className="flex items-start justify-between">
                          <div className="space-y-1">
                            <h4 className="text-sm font-medium">{template.name}</h4>
                            <p className="text-xs text-muted-foreground">
                              {template.width_mm}×{template.height_mm}mm
                            </p>
                          </div>
                          <div className="flex gap-1">
                            {template.is_default && (
                              <Badge variant="secondary" className="text-xs">
                                Domyślny
                              </Badge>
                            )}
                            {template.is_system && (
                              <Badge variant="outline" className="text-xs">
                                System
                              </Badge>
                            )}
                          </div>
                        </div>
                        <p className="mt-2 text-xs text-muted-foreground">{template.description}</p>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </div>

              <Separator />

              {/* Batch Mode Toggle */}
              <div className="flex items-center justify-between">
                <div className="space-y-1">
                  <Label>Tryb Partii</Label>
                  <p className="text-sm text-muted-foreground">
                    Generuj wiele etykiet jednocześnie
                  </p>
                </div>
                <Switch checked={batchMode} onCheckedChange={setBatchMode} />
              </div>

              {/* Batch Configuration */}
              {batchMode && (
                <div className="space-y-4 rounded-lg bg-muted/30 p-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="quantity">Ilość</Label>
                      <Input
                        id="quantity"
                        type="number"
                        value={quantity}
                        onChange={(e) => setQuantity(Math.max(1, parseInt(e.target.value) || 1))}
                        min="1"
                        max="1000"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="batch-name">Nazwa Partii</Label>
                      <Input
                        id="batch-name"
                        value={batchName}
                        onChange={(e) => setBatchName(e.target.value)}
                        placeholder="np. Etykiety-2024-01"
                      />
                    </div>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Batch Creator Component */}
          {batchMode && selectedTemplate && (
            <BatchLabelCreator
              template={selectedTemplate}
              labelType={labelType}
              onGenerate={onGenerate}
              isLoading={isLoading}
            />
          )}
        </div>

        {/* Preview Panel */}
        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Eye className="h-4 w-4" />
                Podgląd Etykiety
              </CardTitle>
            </CardHeader>
            <CardContent>
              {previewData ? (
                <LabelPreview data={previewData} />
              ) : (
                <div className="flex aspect-square items-center justify-center rounded-lg bg-muted">
                  <p className="text-sm text-muted-foreground">
                    Wybierz szablon, aby zobaczyć podgląd
                  </p>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Template Info */}
          {selectedTemplate && (
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Informacje o Szablonie</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Rozmiar:</span>
                  <span>
                    {selectedTemplate.width_mm}×{selectedTemplate.height_mm}mm
                  </span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Rozdzielczość:</span>
                  <span>{selectedTemplate.dpi} DPI</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Pozycja QR:</span>
                  <span className="capitalize">{selectedTemplate.qr_position}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Rozmiar QR:</span>
                  <span>{selectedTemplate.qr_size_mm}mm</span>
                </div>

                <Separator />

                <div className="space-y-2">
                  <p className="text-sm font-medium">Elementy etykiety:</p>
                  <div className="flex flex-wrap gap-1">
                    {selectedTemplate.show_label_text && (
                      <Badge variant="outline" className="text-xs">
                        Tekst
                      </Badge>
                    )}
                    {selectedTemplate.show_code && (
                      <Badge variant="outline" className="text-xs">
                        Kod
                      </Badge>
                    )}
                    {selectedTemplate.show_hierarchy && (
                      <Badge variant="outline" className="text-xs">
                        Hierarchia
                      </Badge>
                    )}
                    {selectedTemplate.show_barcode && (
                      <Badge variant="outline" className="text-xs">
                        Kod kreskowy
                      </Badge>
                    )}
                    {selectedTemplate.border_enabled && (
                      <Badge variant="outline" className="text-xs">
                        Ramka
                      </Badge>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      </div>

      {/* Customizer Panel */}
      {showCustomizer && selectedTemplate && (
        <LabelCustomizer
          template={selectedTemplate}
          onTemplateChange={setSelectedTemplate}
          onClose={() => setShowCustomizer(false)}
        />
      )}
    </div>
  );
}
