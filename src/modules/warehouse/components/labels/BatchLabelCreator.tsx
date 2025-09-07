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
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Layers, FileText, Grid3x3, Square, Calculator, Info } from "lucide-react";
import type { LabelTemplate, LabelGenerationRequest } from "@/lib/types/qr-system";

interface BatchLabelCreatorProps {
  template: LabelTemplate;
  labelType: "location" | "product" | "generic";
  onGenerate: (request: LabelGenerationRequest) => Promise<void>;
  isLoading?: boolean;
}

interface SheetLayout {
  id: string;
  name: string;
  columns: number;
  rows: number;
  description: string;
  paperSize: string;
}

const sheetLayouts: SheetLayout[] = [
  {
    id: "single",
    name: "Pojedyncza etykieta",
    columns: 1,
    rows: 1,
    description: "Jedna etykieta na stronę",
    paperSize: "A4",
  },
  {
    id: "grid_2x2",
    name: "Siatka 2×2",
    columns: 2,
    rows: 2,
    description: "4 etykiety na stronę",
    paperSize: "A4",
  },
  {
    id: "grid_3x3",
    name: "Siatka 3×3",
    columns: 3,
    rows: 3,
    description: "9 etykiet na stronę",
    paperSize: "A4",
  },
  {
    id: "grid_4x6",
    name: "Siatka 4×6",
    columns: 4,
    rows: 6,
    description: "24 etykiety na stronę (małe)",
    paperSize: "A4",
  },
  {
    id: "grid_5x8",
    name: "Siatka 5×8",
    columns: 5,
    rows: 8,
    description: "40 etykiet na stronę (bardzo małe)",
    paperSize: "A4",
  },
  {
    id: "custom",
    name: "Niestandardowy",
    columns: 0,
    rows: 0,
    description: "Określ własny układ",
    paperSize: "A4",
  },
];

export function BatchLabelCreator({
  template,
  labelType,
  onGenerate,
  isLoading = false,
}: BatchLabelCreatorProps) {
  const [quantity, setQuantity] = useState(50);
  const [batchName, setBatchName] = useState("");
  const [batchDescription, setBatchDescription] = useState("");
  const [selectedLayout, setSelectedLayout] = useState<SheetLayout>(sheetLayouts[1]); // 2x2 by default
  const [customColumns, setCustomColumns] = useState(3);
  const [customRows, setCustomRows] = useState(3);

  const layout =
    selectedLayout.id === "custom"
      ? { ...selectedLayout, columns: customColumns, rows: customRows }
      : selectedLayout;

  const labelsPerSheet = layout.columns * layout.rows;
  const totalSheets = Math.ceil(quantity / labelsPerSheet);
  const estimatedPrintTime = Math.ceil(totalSheets * 0.5); // 30 seconds per sheet

  const handleGenerate = async () => {
    const request: LabelGenerationRequest = {
      templateId: template.id,
      labelType,
      quantity,
      batchName: batchName || `Partia ${labelType} - ${new Date().toLocaleDateString()}`,
      batchDescription: batchDescription || undefined,
    };

    await onGenerate(request);
  };

  const generateBatchName = () => {
    const date = new Date().toISOString().split("T")[0];
    const typeLabel = labelType === "location" ? "LOC" : labelType === "product" ? "PRD" : "GEN";
    const layoutName = layout.name.replace("Siatka ", "").replace(" etykiety na stronę", "");
    setBatchName(`${typeLabel}_${layoutName}_${date}_${quantity}szt`);
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Layers className="h-5 w-5" />
          Konfiguracja Partii Etykiet
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Basic Settings */}
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="quantity">Ilość etykiet</Label>
            <Input
              id="quantity"
              type="number"
              value={quantity}
              onChange={(e) => setQuantity(Math.max(1, parseInt(e.target.value) || 1))}
              min="1"
              max="10000"
            />
            <p className="text-xs text-muted-foreground">
              Maksymalnie 10,000 etykiet w jednej partii
            </p>
          </div>

          <div className="space-y-2">
            <Label>Układ na stronie</Label>
            <Select
              value={selectedLayout.id}
              onValueChange={(value) => {
                const layout = sheetLayouts.find((l) => l.id === value);
                if (layout) setSelectedLayout(layout);
              }}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {sheetLayouts.map((layout) => (
                  <SelectItem key={layout.id} value={layout.id}>
                    <div className="flex items-center gap-2">
                      <Grid3x3 className="h-4 w-4" />
                      <div>
                        <div className="font-medium">{layout.name}</div>
                        <div className="text-xs text-muted-foreground">{layout.description}</div>
                      </div>
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* Custom Layout Settings */}
        {selectedLayout.id === "custom" && (
          <div className="space-y-4 rounded-lg bg-muted/30 p-4">
            <h4 className="flex items-center gap-2 font-medium">
              <Grid3x3 className="h-4 w-4" />
              Niestandardowy układ
            </h4>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="custom-columns">Kolumny</Label>
                <Input
                  id="custom-columns"
                  type="number"
                  value={customColumns}
                  onChange={(e) =>
                    setCustomColumns(Math.max(1, Math.min(10, parseInt(e.target.value) || 1)))
                  }
                  min="1"
                  max="10"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="custom-rows">Wiersze</Label>
                <Input
                  id="custom-rows"
                  type="number"
                  value={customRows}
                  onChange={(e) =>
                    setCustomRows(Math.max(1, Math.min(15, parseInt(e.target.value) || 1)))
                  }
                  min="1"
                  max="15"
                />
              </div>
            </div>
          </div>
        )}

        <Separator />

        {/* Batch Details */}
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <Label htmlFor="batch-name">Nazwa partii</Label>
            <Button variant="outline" size="sm" onClick={generateBatchName} disabled={isLoading}>
              Generuj automatycznie
            </Button>
          </div>
          <Input
            id="batch-name"
            value={batchName}
            onChange={(e) => setBatchName(e.target.value)}
            placeholder="np. Etykiety_Lokalizacji_2024_01_15"
          />

          <div className="space-y-2">
            <Label htmlFor="batch-description">Opis partii (opcjonalnie)</Label>
            <Textarea
              id="batch-description"
              value={batchDescription}
              onChange={(e) => setBatchDescription(e.target.value)}
              placeholder="Dodatkowe informacje o partii etykiet..."
              rows={3}
            />
          </div>
        </div>

        <Separator />

        {/* Summary */}
        <div className="space-y-4">
          <h4 className="flex items-center gap-2 font-medium">
            <Calculator className="h-4 w-4" />
            Podsumowanie
          </h4>

          <div className="grid grid-cols-2 gap-4 text-sm md:grid-cols-4">
            <div className="space-y-1">
              <p className="text-muted-foreground">Ilość etykiet:</p>
              <p className="text-lg font-medium">{quantity}</p>
            </div>

            <div className="space-y-1">
              <p className="text-muted-foreground">Etykiet na stronę:</p>
              <p className="text-lg font-medium">{labelsPerSheet}</p>
            </div>

            <div className="space-y-1">
              <p className="text-muted-foreground">Ilość stron:</p>
              <p className="text-lg font-medium">{totalSheets}</p>
            </div>

            <div className="space-y-1">
              <p className="text-muted-foreground">Czas druku:</p>
              <p className="text-lg font-medium">~{estimatedPrintTime} min</p>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <p className="text-sm text-muted-foreground">Szablon etykiety:</p>
              <div className="flex items-center gap-2">
                <Badge variant="outline">{template.name}</Badge>
                <Badge variant="secondary">
                  {template.width_mm}×{template.height_mm}mm
                </Badge>
              </div>
            </div>

            <div className="space-y-2">
              <p className="text-sm text-muted-foreground">Format papieru:</p>
              <div className="flex items-center gap-2">
                <Badge variant="outline">{layout.paperSize}</Badge>
                <Badge variant="secondary">
                  {layout.columns}×{layout.rows}
                </Badge>
              </div>
            </div>
          </div>
        </div>

        {/* Warnings */}
        {quantity > 1000 && (
          <Alert>
            <Info className="h-4 w-4" />
            <AlertDescription>
              Duża partia ({quantity} etykiet) może zająć więcej czasu do wygenerowania i
              wydrukowania. Rozważ podział na mniejsze partie jeśli nie potrzebujesz wszystkich
              etykiet od razu.
            </AlertDescription>
          </Alert>
        )}

        {labelsPerSheet > 20 && template.width_mm < 30 && (
          <Alert>
            <Info className="h-4 w-4" />
            <AlertDescription>
              Wybrano bardzo gęsty układ ({labelsPerSheet} etykiet/strona) z małymi etykietami.
              Upewnij się, że Twoja drukarka obsługuje taką rozdzielczość.
            </AlertDescription>
          </Alert>
        )}

        <Separator />

        {/* Action Buttons */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <FileText className="h-4 w-4" />
            <span>Wygenerowany zostanie plik PDF gotowy do druku</span>
          </div>

          <div className="flex gap-2">
            <Button variant="outline" onClick={() => {}} disabled={isLoading}>
              <Square className="mr-2 h-4 w-4" />
              Podgląd
            </Button>

            <Button onClick={handleGenerate} disabled={isLoading || !batchName.trim()}>
              {isLoading ? (
                <>
                  <div className="mr-2 h-4 w-4 animate-spin rounded-full border-2 border-background border-t-foreground" />
                  Generowanie...
                </>
              ) : (
                <>
                  <Layers className="mr-2 h-4 w-4" />
                  Generuj Partię
                </>
              )}
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
