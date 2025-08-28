"use client";

import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Separator } from "@/components/ui/separator";
import {
  FileText,
  Save,
  Eye,
  ArrowLeft,
  Palette,
  Ruler,
  QrCode,
  Type,
  Loader2,
} from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { LabelPreview } from "@/modules/warehouse/components/labels/LabelPreview";
import type { LabelTemplate, LabelPreviewData } from "@/lib/types/qr-system";
import { generateQRToken } from "@/lib/utils/qr-generator";

export default function CreateTemplatePage() {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(false);
  const [previewData, setPreviewData] = useState<LabelPreviewData | null>(null);

  // Form state
  const [formData, setFormData] = useState({
    name: "",
    description: "",
    label_type: "location" as "location" | "product" | "generic",
    category: "custom" as "small" | "medium" | "large" | "custom",
    width_mm: 50,
    height_mm: 25,
    dpi: 300,
    qr_position: "center" as LabelTemplate["qr_position"],
    qr_size_mm: 15,
    show_label_text: true,
    label_text_position: "bottom" as LabelTemplate["label_text_position"],
    label_text_size: 12,
    show_code: false,
    // New layout properties
    layout_direction: "column" as "row" | "column",
    section_balance: "equal" as "equal" | "qr-priority" | "data-priority",
    background_color: "#FFFFFF",
    text_color: "#000000",
    border_enabled: true,
    border_width: 0.5,
    border_color: "#000000",
    is_default: false,
  });

  // Preset dimensions for different categories
  const categoryPresets = {
    small: { width_mm: 25, height_mm: 25, qr_size_mm: 15 },
    medium: { width_mm: 50, height_mm: 25, qr_size_mm: 20 },
    large: { width_mm: 75, height_mm: 50, qr_size_mm: 25 },
    custom: {}, // No preset for custom
  };

  // Update preview when form data changes
  useEffect(() => {
    const template: LabelTemplate = {
      id: "preview",
      ...formData,
      template_config: {},
      is_system: false,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    const sampleToken = generateQRToken();
    const mockPreview: LabelPreviewData = {
      qrToken: sampleToken,
      displayText:
        formData.label_type === "location" ? "Przykładowa Lokalizacja" : "Przykładowy Produkt",
      codeText: formData.label_type === "location" ? "LOC-001" : "PRD-001",
      template,
    };
    setPreviewData(mockPreview);
  }, [formData]);

  const handleInputChange = (field: string, value: any) => {
    setFormData((prev) => {
      const updated = { ...prev, [field]: value };

      // Auto-set layout direction based on data section position
      if (field === "label_text_position") {
        if (value === "left" || value === "right") {
          updated.layout_direction = "row";
        } else if (value === "top" || value === "bottom") {
          updated.layout_direction = "column";
        }
      }

      return updated;
    });
  };

  // Handle category preset selection
  const handleCategoryChange = (category: string) => {
    const preset = categoryPresets[category as keyof typeof categoryPresets];
    if (preset && Object.keys(preset).length > 0) {
      // Apply preset dimensions
      setFormData((prev) => ({
        ...prev,
        category,
        ...preset,
      }));
    } else {
      // Just update category for custom
      setFormData((prev) => ({ ...prev, category }));
    }
  };

  const handleSubmit = async () => {
    // Validate required fields
    if (!formData.name || !formData.width_mm || !formData.height_mm) {
      toast.error("Uzupełnij wymagane pola", {
        description: "Nazwa, szerokość i wysokość są wymagane",
      });
      return;
    }

    setIsLoading(true);

    try {
      const response = await fetch("/api/labels/templates", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(formData),
      });

      const data = await response.json();

      if (data.success) {
        toast.success("Szablon został utworzony!", {
          description: "Możesz go teraz używać do generowania etykiet",
        });
        router.push("/dashboard/warehouse/labels/templates");
      } else {
        toast.error("Błąd podczas tworzenia szablonu", {
          description: data.error || "Spróbuj ponownie",
        });
      }
    } catch (error) {
      console.error("Error creating template:", error);
      toast.error("Błąd podczas tworzenia szablonu", {
        description: "Sprawdź połączenie i spróbuj ponownie",
      });
    } finally {
      setIsLoading(false);
    }
  };
  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Button variant="outline" asChild>
          <Link href="/dashboard/warehouse/labels/templates">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Powrót
          </Link>
        </Button>
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Nowy Szablon Etykiety</h1>
          <p className="text-muted-foreground">
            Stwórz własny szablon etykiety QR dostosowany do Twoich potrzeb
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* Configuration Form */}
        <div className="space-y-6 lg:col-span-2">
          {/* Basic Information */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <FileText className="h-5 w-5" />
                Podstawowe Informacje
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="template-name">Nazwa szablonu</Label>
                  <Input
                    id="template-name"
                    placeholder="np. Moja Etykieta Produktu"
                    value={formData.name}
                    onChange={(e) => handleInputChange("name", e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="template-type">Typ etykiety</Label>
                  <Select
                    value={formData.label_type}
                    onValueChange={(value) => handleInputChange("label_type", value)}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Wybierz typ" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="location">Lokalizacja</SelectItem>
                      <SelectItem value="product">Produkt</SelectItem>
                      <SelectItem value="generic">Uniwersalna</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="template-description">Opis</Label>
                <Textarea
                  id="template-description"
                  placeholder="Krótki opis szablonu i jego przeznaczenia"
                  rows={3}
                  value={formData.description}
                  onChange={(e) => handleInputChange("description", e.target.value)}
                />
              </div>
            </CardContent>
          </Card>

          {/* Dimensions */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Ruler className="h-5 w-5" />
                Wymiary i Format
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
                <div className="space-y-2">
                  <Label htmlFor="width">Szerokość (mm)</Label>
                  <Input
                    id="width"
                    type="number"
                    placeholder="50"
                    min="10"
                    max="200"
                    value={formData.width_mm}
                    onChange={(e) => handleInputChange("width_mm", parseInt(e.target.value) || 0)}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="height">Wysokość (mm)</Label>
                  <Input
                    id="height"
                    type="number"
                    placeholder="25"
                    min="10"
                    max="200"
                    value={formData.height_mm}
                    onChange={(e) => handleInputChange("height_mm", parseInt(e.target.value) || 0)}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="dpi">Rozdzielczość (DPI)</Label>
                  <Select
                    value={formData.dpi.toString()}
                    onValueChange={(value) => handleInputChange("dpi", parseInt(value))}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="300" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="150">150 DPI</SelectItem>
                      <SelectItem value="300">300 DPI</SelectItem>
                      <SelectItem value="600">600 DPI</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="category">Kategoria</Label>
                  <Select value={formData.category} onValueChange={handleCategoryChange}>
                    <SelectTrigger>
                      <SelectValue placeholder="Wybierz" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="small">Małe (25×25mm)</SelectItem>
                      <SelectItem value="medium">Średnie (50×25mm)</SelectItem>
                      <SelectItem value="large">Duże (75×50mm)</SelectItem>
                      <SelectItem value="custom">Niestandardowe</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* QR Code Settings */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <QrCode className="h-5 w-5" />
                Ustawienia QR
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="qr-position">Pozycja QR</Label>
                  <Select
                    value={formData.qr_position}
                    onValueChange={(value) => handleInputChange("qr_position", value)}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Wybierz pozycję" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="center">Środek</SelectItem>
                      <SelectItem value="left">Lewo</SelectItem>
                      <SelectItem value="right">Prawo</SelectItem>
                      <SelectItem value="top-left">Lewy górny</SelectItem>
                      <SelectItem value="top-right">Prawy górny</SelectItem>
                      <SelectItem value="bottom-left">Lewy dolny</SelectItem>
                      <SelectItem value="bottom-right">Prawy dolny</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="qr-size">Rozmiar QR (mm)</Label>
                  <Input
                    id="qr-size"
                    type="number"
                    placeholder="15"
                    min="5"
                    max="50"
                    value={formData.qr_size_mm}
                    onChange={(e) =>
                      handleInputChange("qr_size_mm", parseInt(e.target.value) || 15)
                    }
                  />
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Section Layout */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Type className="h-5 w-5" />
                Proporcje sekcji
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="section-balance">Rozkład miejsca na etykiecie</Label>
                <Select
                  value={formData.section_balance}
                  onValueChange={(value) => handleInputChange("section_balance", value)}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Wybierz proporcje" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="equal">Równe (1:1)</SelectItem>
                    <SelectItem value="qr-priority">QR większy</SelectItem>
                    <SelectItem value="data-priority">Dane większe</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </CardContent>
          </Card>

          {/* Additional Data Section */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Type className="h-5 w-5" />
                Dodatkowe Informacje
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-4">
                <div className="flex items-center space-x-2">
                  <Switch
                    id="show-text"
                    checked={formData.show_label_text}
                    onCheckedChange={(checked) => handleInputChange("show_label_text", checked)}
                  />
                  <Label htmlFor="show-text">Pokazuj tekst etykiety</Label>
                </div>
                <div className="flex items-center space-x-2">
                  <Switch
                    id="show-code"
                    checked={formData.show_code}
                    onCheckedChange={(checked) => handleInputChange("show_code", checked)}
                  />
                  <Label htmlFor="show-code">Pokazuj kod identyfikacyjny</Label>
                </div>
              </div>

              <Separator />

              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="data-position">Pozycja sekcji danych</Label>
                  <Select
                    value={formData.label_text_position}
                    onValueChange={(value) => handleInputChange("label_text_position", value)}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Wybierz pozycję" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="top">Góra (QR na dole)</SelectItem>
                      <SelectItem value="bottom">Dół (QR na górze)</SelectItem>
                      <SelectItem value="left">Lewo (QR po prawej)</SelectItem>
                      <SelectItem value="right">Prawo (QR po lewej)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="text-size">Rozmiar tekstu</Label>
                  <Select
                    value={formData.label_text_size.toString()}
                    onValueChange={(value) => handleInputChange("label_text_size", parseInt(value))}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="12" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="8">8pt</SelectItem>
                      <SelectItem value="10">10pt</SelectItem>
                      <SelectItem value="12">12pt</SelectItem>
                      <SelectItem value="14">14pt</SelectItem>
                      <SelectItem value="16">16pt</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Colors and Styling */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Palette className="h-5 w-5" />
                Kolory i Stylizacja
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
                <div className="space-y-2">
                  <Label htmlFor="bg-color">Kolor tła</Label>
                  <div className="flex gap-2">
                    <Input
                      id="bg-color"
                      type="color"
                      value={formData.background_color}
                      onChange={(e) => handleInputChange("background_color", e.target.value)}
                      className="w-16"
                    />
                    <Input
                      value={formData.background_color}
                      onChange={(e) => handleInputChange("background_color", e.target.value)}
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
                      value={formData.text_color}
                      onChange={(e) => handleInputChange("text_color", e.target.value)}
                      className="w-16"
                    />
                    <Input
                      value={formData.text_color}
                      onChange={(e) => handleInputChange("text_color", e.target.value)}
                      className="flex-1"
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="border-color">Kolor ramki</Label>
                  <div className="flex gap-2">
                    <Input
                      id="border-color"
                      type="color"
                      value={formData.border_color}
                      onChange={(e) => handleInputChange("border_color", e.target.value)}
                      className="w-16"
                    />
                    <Input
                      value={formData.border_color}
                      onChange={(e) => handleInputChange("border_color", e.target.value)}
                      className="flex-1"
                    />
                  </div>
                </div>
              </div>

              <Separator />

              <div className="space-y-4">
                <div className="flex items-center space-x-2">
                  <Switch
                    id="enable-border"
                    checked={formData.border_enabled}
                    onCheckedChange={(checked) => handleInputChange("border_enabled", checked)}
                  />
                  <Label htmlFor="enable-border">Włącz ramkę</Label>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="border-width">Grubość ramki (mm)</Label>
                  <Input
                    id="border-width"
                    type="number"
                    placeholder="0.5"
                    min="0"
                    max="5"
                    step="0.1"
                    value={formData.border_width}
                    onChange={(e) =>
                      handleInputChange("border_width", parseFloat(e.target.value) || 0.5)
                    }
                  />
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Live Preview */}
        <div className="lg:col-span-1">
          <Card className="sticky top-6">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Eye className="h-5 w-5" />
                Podgląd na Żywo
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {/* Preview Area */}
                <div className="flex min-h-[200px] items-center justify-center rounded-lg bg-muted/30 p-8">
                  {previewData ? (
                    <LabelPreview data={previewData} showControls={false} />
                  ) : (
                    <div className="rounded border-2 border-dashed border-muted-foreground/50 bg-white p-4">
                      <div className="space-y-2 text-center">
                        <div className="mx-auto h-16 w-16 rounded bg-gray-200"></div>
                        <div className="text-xs text-gray-500">Przykładowy QR</div>
                        <div className="text-xs font-medium">Nazwa Etykiety</div>
                      </div>
                    </div>
                  )}
                </div>

                {/* Preview Info */}
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Wymiary:</span>
                    <span>
                      {formData.width_mm}×{formData.height_mm}mm
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Rozdzielczość:</span>
                    <span>{formData.dpi} DPI</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Rozmiar QR:</span>
                    <span>{formData.qr_size_mm}mm</span>
                  </div>
                </div>

                {/* Actions */}
                <div className="space-y-2">
                  <Button className="w-full" onClick={handleSubmit} disabled={isLoading}>
                    {isLoading ? (
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    ) : (
                      <Save className="mr-2 h-4 w-4" />
                    )}
                    Zapisz Szablon
                  </Button>
                  {previewData && (
                    <Button variant="outline" className="w-full">
                      <Eye className="mr-2 h-4 w-4" />
                      Pełny Podgląd
                    </Button>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
