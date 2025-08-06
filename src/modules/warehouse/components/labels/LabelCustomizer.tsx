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
import { Slider } from "@/components/ui/slider";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import { X, Save, RotateCcw, Palette, Type, Move, Square } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { LabelPreview } from "./LabelPreview";
import type { LabelTemplate, LabelPreviewData } from "@/lib/types/qr-system";
import { generateQRToken } from "@/lib/utils/qr-generator";

interface LabelCustomizerProps {
  template: LabelTemplate;
  onTemplateChange: (template: LabelTemplate) => void;
  onClose: () => void;
}

export function LabelCustomizer({ template, onTemplateChange, onClose }: LabelCustomizerProps) {
  const [customTemplate, setCustomTemplate] = useState<LabelTemplate>({ ...template });
  const [previewData, setPreviewData] = useState<LabelPreviewData | null>(null);
  const [hasChanges, setHasChanges] = useState(false);

  // Generate preview data
  useEffect(() => {
    const sampleToken = generateQRToken();
    const mockPreview: LabelPreviewData = {
      qrToken: sampleToken,
      displayText: customTemplate.label_type === "location" ? "Sample Location" : "Sample Product",
      codeText: customTemplate.label_type === "location" ? "LOC-001" : "PRD-001",
      hierarchy:
        customTemplate.label_type === "location" ? ["Warehouse A", "Zone 1", "Shelf 3"] : undefined,
      barcode: customTemplate.label_type === "product" ? "1234567890123" : undefined,
      template: customTemplate,
    };
    setPreviewData(mockPreview);
  }, [customTemplate]);

  // Track changes
  useEffect(() => {
    const changed = JSON.stringify(customTemplate) !== JSON.stringify(template);
    setHasChanges(changed);
  }, [customTemplate, template]);

  const handleSave = () => {
    onTemplateChange(customTemplate);
    setHasChanges(false);
  };

  const handleReset = () => {
    setCustomTemplate({ ...template });
    setHasChanges(false);
  };

  const updateTemplate = (updates: Partial<LabelTemplate>) => {
    setCustomTemplate((prev) => ({
      ...prev,
      ...updates,
      updated_at: new Date().toISOString(),
    }));
  };

  const qrPositions = [
    { value: "top-left", label: "Lewy górny" },
    { value: "top-right", label: "Prawy górny" },
    { value: "center", label: "Środek" },
    { value: "bottom-left", label: "Lewy dolny" },
    { value: "bottom-right", label: "Prawy dolny" },
  ];

  const textPositions = [
    { value: "top", label: "Góra" },
    { value: "bottom", label: "Dół" },
    { value: "left", label: "Lewa" },
    { value: "right", label: "Prawa" },
    { value: "none", label: "Brak" },
  ];

  return (
    <Dialog open={true} onOpenChange={onClose}>
      <DialogContent className="max-h-[90vh] max-w-6xl overflow-y-auto">
        <DialogHeader>
          <div className="flex items-center justify-between">
            <div>
              <DialogTitle>Dostosuj Szablon Etykiety</DialogTitle>
              <p className="mt-1 text-sm text-muted-foreground">
                {customTemplate.name} • {customTemplate.width_mm}×{customTemplate.height_mm}mm
              </p>
            </div>
            <div className="flex items-center gap-2">
              {hasChanges && (
                <Badge variant="outline" className="text-xs">
                  Niezapisane zmiany
                </Badge>
              )}
              <Button variant="ghost" size="sm" onClick={handleReset} disabled={!hasChanges}>
                <RotateCcw className="mr-2 h-4 w-4" />
                Reset
              </Button>
              <Button onClick={handleSave} disabled={!hasChanges}>
                <Save className="mr-2 h-4 w-4" />
                Zapisz
              </Button>
              <Button variant="ghost" size="sm" onClick={onClose}>
                <X className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </DialogHeader>

        <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-2">
          {/* Customization Panel */}
          <div className="space-y-4">
            <Tabs defaultValue="layout" className="w-full">
              <TabsList className="grid w-full grid-cols-4">
                <TabsTrigger value="layout">
                  <Move className="mr-2 h-4 w-4" />
                  Layout
                </TabsTrigger>
                <TabsTrigger value="qr">
                  <Square className="mr-2 h-4 w-4" />
                  QR
                </TabsTrigger>
                <TabsTrigger value="text">
                  <Type className="mr-2 h-4 w-4" />
                  Tekst
                </TabsTrigger>
                <TabsTrigger value="style">
                  <Palette className="mr-2 h-4 w-4" />
                  Styl
                </TabsTrigger>
              </TabsList>

              {/* Layout Tab */}
              <TabsContent value="layout" className="mt-4 space-y-4">
                <Card>
                  <CardHeader>
                    <CardTitle className="text-lg">Rozmiar Etykiety</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label htmlFor="width">Szerokość (mm)</Label>
                        <Input
                          id="width"
                          type="number"
                          value={customTemplate.width_mm}
                          onChange={(e) =>
                            updateTemplate({ width_mm: parseFloat(e.target.value) || 25 })
                          }
                          min="10"
                          max="200"
                          step="1"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="height">Wysokość (mm)</Label>
                        <Input
                          id="height"
                          type="number"
                          value={customTemplate.height_mm}
                          onChange={(e) =>
                            updateTemplate({ height_mm: parseFloat(e.target.value) || 25 })
                          }
                          min="10"
                          max="200"
                          step="1"
                        />
                      </div>
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="dpi">Rozdzielczość (DPI)</Label>
                      <Select
                        value={customTemplate.dpi.toString()}
                        onValueChange={(value) => updateTemplate({ dpi: parseInt(value) })}
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="150">150 DPI (Draft)</SelectItem>
                          <SelectItem value="300">300 DPI (Standard)</SelectItem>
                          <SelectItem value="600">600 DPI (High Quality)</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </CardContent>
                </Card>
              </TabsContent>

              {/* QR Tab */}
              <TabsContent value="qr" className="mt-4 space-y-4">
                <Card>
                  <CardHeader>
                    <CardTitle className="text-lg">Ustawienia QR Code</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="space-y-2">
                      <Label>Pozycja QR Code</Label>
                      <Select
                        value={customTemplate.qr_position}
                        onValueChange={(value) =>
                          updateTemplate({ qr_position: value as LabelTemplate["qr_position"] })
                        }
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {qrPositions.map((pos) => (
                            <SelectItem key={pos.value} value={pos.value}>
                              {pos.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="space-y-2">
                      <Label>Rozmiar QR Code: {customTemplate.qr_size_mm}mm</Label>
                      <Slider
                        value={[customTemplate.qr_size_mm]}
                        onValueChange={([value]) => updateTemplate({ qr_size_mm: value })}
                        max={Math.min(customTemplate.width_mm, customTemplate.height_mm) - 5}
                        min={10}
                        step={1}
                        className="w-full"
                      />
                    </div>
                  </CardContent>
                </Card>
              </TabsContent>

              {/* Text Tab */}
              <TabsContent value="text" className="mt-4 space-y-4">
                <Card>
                  <CardHeader>
                    <CardTitle className="text-lg">Ustawienia Tekstu</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="flex items-center justify-between">
                      <Label>Pokaż tekst etykiety</Label>
                      <Switch
                        checked={customTemplate.show_label_text}
                        onCheckedChange={(checked) => updateTemplate({ show_label_text: checked })}
                      />
                    </div>

                    {customTemplate.show_label_text && (
                      <>
                        <div className="space-y-2">
                          <Label>Pozycja tekstu</Label>
                          <Select
                            value={customTemplate.label_text_position}
                            onValueChange={(value) =>
                              updateTemplate({
                                label_text_position: value as LabelTemplate["label_text_position"],
                              })
                            }
                          >
                            <SelectTrigger>
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              {textPositions.map((pos) => (
                                <SelectItem key={pos.value} value={pos.value}>
                                  {pos.label}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>

                        <div className="space-y-2">
                          <Label>Rozmiar czcionki: {customTemplate.label_text_size}pt</Label>
                          <Slider
                            value={[customTemplate.label_text_size]}
                            onValueChange={([value]) => updateTemplate({ label_text_size: value })}
                            max={24}
                            min={6}
                            step={1}
                            className="w-full"
                          />
                        </div>
                      </>
                    )}

                    <Separator />

                    <div className="flex items-center justify-between">
                      <Label>Pokaż kod (SKU/Kod lokalizacji)</Label>
                      <Switch
                        checked={customTemplate.show_code}
                        onCheckedChange={(checked) => updateTemplate({ show_code: checked })}
                      />
                    </div>

                    {customTemplate.label_type === "location" && (
                      <div className="flex items-center justify-between">
                        <Label>Pokaż hierarchię lokalizacji</Label>
                        <Switch
                          checked={customTemplate.show_hierarchy}
                          onCheckedChange={(checked) => updateTemplate({ show_hierarchy: checked })}
                        />
                      </div>
                    )}

                    {customTemplate.label_type === "product" && (
                      <div className="flex items-center justify-between">
                        <Label>Pokaż kod kreskowy produktu</Label>
                        <Switch
                          checked={customTemplate.show_barcode}
                          onCheckedChange={(checked) => updateTemplate({ show_barcode: checked })}
                        />
                      </div>
                    )}
                  </CardContent>
                </Card>
              </TabsContent>

              {/* Style Tab */}
              <TabsContent value="style" className="mt-4 space-y-4">
                <Card>
                  <CardHeader>
                    <CardTitle className="text-lg">Kolory i Styl</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label htmlFor="bg-color">Kolor tła</Label>
                        <div className="flex gap-2">
                          <Input
                            id="bg-color"
                            type="color"
                            value={customTemplate.background_color}
                            onChange={(e) => updateTemplate({ background_color: e.target.value })}
                            className="h-10 w-12 rounded border p-1"
                          />
                          <Input
                            value={customTemplate.background_color}
                            onChange={(e) => updateTemplate({ background_color: e.target.value })}
                            placeholder="#FFFFFF"
                            className="flex-1"
                          />
                        </div>
                      </div>

                      <div className="space-y-2">
                        <Label htmlFor="text-color">Kolor tekstu</Label>
                        <div className="flex gap-2">
                          <Input
                            id="text-color"
                            type="color"
                            value={customTemplate.text_color}
                            onChange={(e) => updateTemplate({ text_color: e.target.value })}
                            className="h-10 w-12 rounded border p-1"
                          />
                          <Input
                            value={customTemplate.text_color}
                            onChange={(e) => updateTemplate({ text_color: e.target.value })}
                            placeholder="#000000"
                            className="flex-1"
                          />
                        </div>
                      </div>
                    </div>

                    <Separator />

                    <div className="flex items-center justify-between">
                      <Label>Ramka etykiety</Label>
                      <Switch
                        checked={customTemplate.border_enabled}
                        onCheckedChange={(checked) => updateTemplate({ border_enabled: checked })}
                      />
                    </div>

                    {customTemplate.border_enabled && (
                      <>
                        <div className="space-y-2">
                          <Label>Grubość ramki: {customTemplate.border_width}px</Label>
                          <Slider
                            value={[customTemplate.border_width]}
                            onValueChange={([value]) => updateTemplate({ border_width: value })}
                            max={5}
                            min={0.5}
                            step={0.5}
                            className="w-full"
                          />
                        </div>

                        <div className="space-y-2">
                          <Label htmlFor="border-color">Kolor ramki</Label>
                          <div className="flex gap-2">
                            <Input
                              id="border-color"
                              type="color"
                              value={customTemplate.border_color}
                              onChange={(e) => updateTemplate({ border_color: e.target.value })}
                              className="h-10 w-12 rounded border p-1"
                            />
                            <Input
                              value={customTemplate.border_color}
                              onChange={(e) => updateTemplate({ border_color: e.target.value })}
                              placeholder="#000000"
                              className="flex-1"
                            />
                          </div>
                        </div>
                      </>
                    )}
                  </CardContent>
                </Card>
              </TabsContent>
            </Tabs>
          </div>

          {/* Preview Panel */}
          <div className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Podgląd na Żywo</CardTitle>
              </CardHeader>
              <CardContent>
                {previewData && <LabelPreview data={previewData} showControls={false} />}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Informacje o Szablonie</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Typ:</span>
                  <Badge variant="outline" className="capitalize">
                    {customTemplate.label_type}
                  </Badge>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Kategoria:</span>
                  <Badge variant="outline" className="capitalize">
                    {customTemplate.category}
                  </Badge>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Fizyczny rozmiar:</span>
                  <span>
                    {customTemplate.width_mm}×{customTemplate.height_mm}mm
                  </span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Rozmiar pikseli (300 DPI):</span>
                  <span>
                    {Math.round(customTemplate.width_mm * 11.81)}×
                    {Math.round(customTemplate.height_mm * 11.81)}px
                  </span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Stosunek proporcji:</span>
                  <span>{(customTemplate.width_mm / customTemplate.height_mm).toFixed(2)}:1</span>
                </div>

                {customTemplate.is_system && (
                  <div className="border-t pt-2">
                    <Badge variant="secondary" className="w-full justify-center">
                      Szablon Systemowy
                    </Badge>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
