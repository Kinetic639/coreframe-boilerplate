"use client";

import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Loader2, Download, FileText, QrCode, MapPin } from "lucide-react";
import { LabelTemplate } from "@/lib/types/qr-system";
import { useLabelCreatorStore } from "@/lib/stores/label-creator-store";
import { toast } from "react-toastify";
import {
  GeneratePdfPayload,
  PAGE_PRESETS,
  convertToPDFTemplate,
  convertToPDFFields,
} from "@/lib/labels/types";

interface LabelGenerationDialogProps {
  templates?: LabelTemplate[];
  trigger?: React.ReactNode;
  defaultType?: "product" | "location";
  open?: boolean;
  onClose?: () => void;
  currentTemplate?: LabelTemplate;
}

export function LabelGenerationDialog({
  templates = [],
  trigger,
  defaultType = "product",
  open: externalOpen,
  onClose,
  currentTemplate,
}: LabelGenerationDialogProps) {
  // Get the current template from the store if no currentTemplate is provided
  const { currentTemplate: storeTemplate } = useLabelCreatorStore();
  console.log("DEBUG: Store template:", storeTemplate);
  console.log("DEBUG: Store template fields:", storeTemplate?.fields);
  const templateToUse = currentTemplate || storeTemplate;
  console.log("DEBUG: Final templateToUse:", templateToUse);
  console.log("DEBUG: Final templateToUse fields:", templateToUse?.fields);
  const [internalOpen, setInternalOpen] = useState(false);
  const open = externalOpen !== undefined ? externalOpen : internalOpen;
  const handleClose = () => {
    if (externalOpen !== undefined && onClose) {
      onClose();
    } else {
      setInternalOpen(false);
    }
  };

  const handleOpen = () => {
    if (externalOpen === undefined) {
      setInternalOpen(true);
    }
  };
  const [selectedTemplate, setSelectedTemplate] = useState<LabelTemplate | null>(
    templateToUse || null
  );
  const [labelType, setLabelType] = useState<"product" | "location">(
    templateToUse?.label_type === "location" ? "location" : defaultType
  );
  const [quantity, setQuantity] = useState(10);
  const [pagePreset, setPagePreset] = useState<keyof typeof PAGE_PRESETS>("A4_CUSTOM_2x5");
  const [isGenerating, setIsGenerating] = useState(false);

  const handleGenerate = async () => {
    if (!selectedTemplate) {
      toast.error("Wybierz szablon etykiety");
      return;
    }

    if (quantity <= 0 || quantity > 1000) {
      toast.error("Liczba etykiet musi być między 1 a 1000");
      return;
    }

    setIsGenerating(true);

    try {
      // Konwertuj template na format PDF zachowując wszystkie opcje kreatora
      console.log("DEBUG: selectedTemplate before conversion:", selectedTemplate);
      console.log("DEBUG: selectedTemplate.fields:", selectedTemplate.fields);
      const pdfTemplate = convertToPDFTemplate(selectedTemplate);
      pdfTemplate.fields = convertToPDFFields(selectedTemplate.fields);
      console.log("DEBUG: pdfTemplate after conversion:", pdfTemplate);
      console.log("DEBUG: pdfTemplate.fields after conversion:", pdfTemplate.fields);

      // Generuj dane etykiet - każda ma unikalny QR kod
      const labelsData = Array.from({ length: quantity }, (_, index) => {
        const qrToken = `qr_${Date.now()}_${Math.random().toString(36).substr(2, 9)}_${index}`;
        const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || window.location.origin;

        let qrUrl: string;
        if (labelType === "product") {
          qrUrl = `${baseUrl}/dashboard/warehouse/products/scan/${qrToken}`;
        } else if (labelType === "location") {
          qrUrl = `${baseUrl}/dashboard/warehouse/locations/scan/${qrToken}`;
        } else {
          qrUrl = `${baseUrl}/qr/${qrToken}`;
        }

        return {
          name: `${labelType === "product" ? "Produkt" : "Lokalizacja"} ${index + 1}`,
          qr: qrUrl,
          qrData: qrUrl,
          qr_token: qrToken,
          type: labelType,
          sku: `${labelType.toUpperCase()}-${String(index + 1).padStart(3, "0")}`,
          code: qrToken.substr(-8).toUpperCase(),
          barcode: `590123412345${String(index).padStart(1, "0")}`, // Przykładowy EAN13
          index: index + 1,
          generated_at: new Date().toISOString(),
        };
      });

      // Przygotuj payload dla API
      const payload: GeneratePdfPayload = {
        template: pdfTemplate,
        data: labelsData,
        pagePreset: PAGE_PRESETS[pagePreset],
        fontFamily: "Inter",
        embedFonts: true,
        debug: false, // Można ustawić na true dla debugowania
      };

      console.log("Generating PDF with payload:", {
        template: pdfTemplate.name,
        dataCount: labelsData.length,
        pagePreset: pagePreset,
      });

      // Wywołaj API do generowania PDF
      const response = await fetch("/api/labels/pdf", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: "Unknown error" }));
        throw new Error(errorData.error || `HTTP ${response.status}`);
      }

      // Pobierz PDF jako blob
      const pdfBlob = await response.blob();

      // Utwórz link do pobierania
      const url = window.URL.createObjectURL(pdfBlob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `${labelType}_etykiety_${quantity}_${Date.now()}.pdf`;

      // Automatycznie pobierz plik
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);

      // Wyczyść URL
      window.URL.revokeObjectURL(url);

      // Opcjonalnie: zapisz informacje o wygenerowanych etykietach
      await saveLabelBatch(labelsData, selectedTemplate.id, labelType);

      toast.success(
        `Wygenerowano ${quantity} etykiet typu "${labelType === "product" ? "produkty" : "lokalizacje"}" w formacie PDF`
      );

      handleClose();
    } catch (error) {
      console.error("Error generating labels:", error);
      toast.error(
        `Wystąpił błąd podczas generowania etykiet: ${error instanceof Error ? error.message : "Unknown error"}`
      );
    } finally {
      setIsGenerating(false);
    }
  };

  // Funkcja do zapisywania batch'a etykiet do bazy
  const saveLabelBatch = async (labelsData: any[], templateId: string, labelType: string) => {
    try {
      // TODO: Implement saving to Supabase when extended schema is ready
      console.log("Would save label batch:", {
        templateId,
        labelType,
        count: labelsData.length,
        firstLabel: labelsData[0],
      });
    } catch (error) {
      console.warn("Failed to save label batch:", error);
      // Nie przerywamy procesu generowania z powodu błędu zapisu
    }
  };

  const getTemplatesByType = () => {
    // If we have a current template (from creator), use it
    if (templateToUse) {
      return [templateToUse];
    }
    // Otherwise filter the templates list
    return templates.filter(
      (template) => template.label_type === labelType || template.label_type === "generic"
    );
  };

  const filteredTemplates = getTemplatesByType();
  const isFromCreator = !!templateToUse;

  return (
    <Dialog open={open} onOpenChange={(isOpen) => !isOpen && handleClose()}>
      {trigger && (
        <DialogTrigger asChild onClick={handleOpen}>
          {trigger}
        </DialogTrigger>
      )}
      {!trigger && externalOpen === undefined && (
        <DialogTrigger asChild>
          <Button>
            <QrCode className="mr-2 h-4 w-4" />
            Generuj etykiety
          </Button>
        </DialogTrigger>
      )}
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <QrCode className="h-5 w-5" />
            Generowanie etykiet
          </DialogTitle>
          <DialogDescription>
            Wybierz szablon, typ i liczbę etykiet do wygenerowania
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-6">
          {/* Type Selection - only show if not from creator */}
          {!isFromCreator && (
            <div className="space-y-3">
              <Label>Typ etykiet</Label>
              <div className="grid grid-cols-2 gap-3">
                <Card
                  className={`cursor-pointer transition-colors ${
                    labelType === "product"
                      ? "border-primary bg-primary/5"
                      : "hover:border-primary/50"
                  }`}
                  onClick={() => setLabelType("product")}
                >
                  <CardContent className="flex items-center gap-3 p-4">
                    <FileText className="h-5 w-5 text-primary" />
                    <div>
                      <p className="font-medium">Produkty</p>
                      <p className="text-sm text-muted-foreground">
                        Etykiety dla produktów magazynowych
                      </p>
                    </div>
                  </CardContent>
                </Card>
                <Card
                  className={`cursor-pointer transition-colors ${
                    labelType === "location"
                      ? "border-primary bg-primary/5"
                      : "hover:border-primary/50"
                  }`}
                  onClick={() => setLabelType("location")}
                >
                  <CardContent className="flex items-center gap-3 p-4">
                    <MapPin className="h-5 w-5 text-primary" />
                    <div>
                      <p className="font-medium">Lokalizacje</p>
                      <p className="text-sm text-muted-foreground">
                        Etykiety dla lokalizacji magazynowych
                      </p>
                    </div>
                  </CardContent>
                </Card>
              </div>
            </div>
          )}

          {/* Template Selection */}
          <div className="space-y-3">
            <Label>{isFromCreator ? "Szablon z kreatora" : "Szablon etykiety"}</Label>
            {filteredTemplates.length === 0 ? (
              <div className="rounded-lg border border-dashed border-gray-300 p-6 text-center">
                <p className="text-muted-foreground">
                  Brak dostępnych szablonów dla typu "
                  {labelType === "product" ? "produkty" : "lokalizacje"}"
                </p>
              </div>
            ) : (
              <div className="grid gap-3">
                {filteredTemplates.map((template) => (
                  <Card
                    key={template.id}
                    className={`${isFromCreator ? "cursor-default" : "cursor-pointer"} transition-colors ${
                      selectedTemplate?.id === template.id
                        ? "border-primary bg-primary/5"
                        : isFromCreator
                          ? "border-primary bg-primary/5"
                          : "hover:border-primary/50"
                    }`}
                    onClick={() => !isFromCreator && setSelectedTemplate(template)}
                  >
                    <CardContent className="p-4">
                      <div className="flex items-start justify-between">
                        <div className="space-y-2">
                          <div className="flex items-center gap-2">
                            <h3 className="font-medium">
                              {template.name || "Etykieta z kreatora"}
                            </h3>
                            {isFromCreator && (
                              <Badge variant="secondary" className="text-xs">
                                Aktualny szablon
                              </Badge>
                            )}
                            {template.is_default && (
                              <Badge variant="secondary" className="text-xs">
                                Domyślny
                              </Badge>
                            )}
                          </div>
                          {template.description && (
                            <p className="text-sm text-muted-foreground">{template.description}</p>
                          )}
                          <div className="flex items-center gap-4 text-xs text-muted-foreground">
                            <span>
                              Rozmiar: {template.width_mm}×{template.height_mm}mm
                            </span>
                            <span>Pola: {template.fields?.length || 0}</span>
                            {template.category && (
                              <Badge variant="outline" className="text-xs">
                                {template.category}
                              </Badge>
                            )}
                          </div>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </div>

          {/* Page Preset Selection */}
          <div className="space-y-3">
            <Label>Format strony</Label>
            <Select
              value={pagePreset}
              onValueChange={(value) => setPagePreset(value as keyof typeof PAGE_PRESETS)}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {Object.entries(PAGE_PRESETS).map(([key, preset]) => (
                  <SelectItem key={key} value={key}>
                    {preset.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">
              Wybierz format strony dla etykiet. Arkusze A4 zawierają wiele etykiet, rolki - jedną
              na stronę.
            </p>
          </div>

          {/* Quantity Selection */}
          <div className="space-y-3">
            <Label htmlFor="quantity">Liczba etykiet</Label>
            <div className="flex gap-3">
              <Input
                id="quantity"
                type="number"
                value={quantity}
                onChange={(e) => setQuantity(parseInt(e.target.value) || 1)}
                min="1"
                max="1000"
                className="flex-1"
              />
              <div className="flex gap-1">
                {[10, 25, 50, 100].map((num) => (
                  <Button
                    key={num}
                    variant="outline"
                    size="sm"
                    onClick={() => setQuantity(num)}
                    className="px-3"
                  >
                    {num}
                  </Button>
                ))}
              </div>
            </div>
            <p className="text-xs text-muted-foreground">
              Maksymalnie 1000 etykiet na raz. Dla większych ilości podziel na mniejsze partie.
            </p>
          </div>

          {/* Summary */}
          {selectedTemplate && (
            <Card>
              <CardHeader>
                <CardTitle className="text-sm">Podsumowanie</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Typ:</span>
                  <span>{labelType === "product" ? "Produkty" : "Lokalizacje"}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Szablon:</span>
                  <span>{selectedTemplate.name}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Rozmiar:</span>
                  <span>
                    {selectedTemplate.width_mm}×{selectedTemplate.height_mm}mm
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Format:</span>
                  <span>{PAGE_PRESETS[pagePreset].name}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Ilość:</span>
                  <span>{quantity} etykiet</span>
                </div>
                <Separator />
                <div className="text-xs text-muted-foreground">
                  Zostanie wygenerowany plik PDF z etykietami w dokładnych wymiarach mm, gotowy do
                  druku bez skalowania. Każda etykieta będzie zawierać unikalny kod QR.
                </div>
              </CardContent>
            </Card>
          )}
        </div>

        <div className="flex justify-end gap-3 pt-4">
          <Button variant="outline" onClick={handleClose}>
            Anuluj
          </Button>
          <Button onClick={handleGenerate} disabled={!selectedTemplate || isGenerating}>
            {isGenerating ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Generowanie...
              </>
            ) : (
              <>
                <Download className="mr-2 h-4 w-4" />
                Generuj PDF
              </>
            )}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
