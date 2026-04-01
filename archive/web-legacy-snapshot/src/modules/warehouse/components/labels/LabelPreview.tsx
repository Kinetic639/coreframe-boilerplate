"use client";

import { useEffect, useCallback, useState } from "react";
import { Card } from "@/components/ui/card";
import Image from "next/image";
import { Badge } from "@/components/ui/badge";
import { Loader2, Download, ZoomIn, ZoomOut, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { LabelPreviewData } from "@/lib/types/qr-system";
import { generateLabelPreview } from "@/lib/utils/qr-generator";

interface LabelPreviewProps {
  data: LabelPreviewData;
  className?: string;
  showControls?: boolean;
}

export function LabelPreview({ data, className = "", showControls = true }: LabelPreviewProps) {
  // const canvasRef = useRef<HTMLCanvasElement>(null) // Commented out as it's not used
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [scale, setScale] = useState(1);

  const generatePreview = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    try {
      const preview = await generateLabelPreview(data);
      setPreviewUrl(preview);
    } catch (err) {
      console.error("Error generating preview:", err);
      setError("Błąd podczas generowania podglądu");
    } finally {
      setIsLoading(false);
    }
  }, [data]);

  // Generate preview when data changes
  useEffect(() => {
    generatePreview();
  }, [generatePreview]);

  const handleDownloadPreview = () => {
    if (!previewUrl) return;

    const link = document.createElement("a");
    link.href = previewUrl;
    link.download = `label-preview-${data.qrToken}.png`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleZoomIn = () => {
    setScale((prev) => Math.min(prev + 0.25, 3));
  };

  const handleZoomOut = () => {
    setScale((prev) => Math.max(prev - 0.25, 0.25));
  };

  const handleResetZoom = () => {
    setScale(1);
  };

  const template = data.template;
  const aspectRatio = template.width_mm / template.height_mm;

  return (
    <div className={`space-y-4 ${className}`}>
      {/* Preview Controls */}
      {showControls && (
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Badge variant="outline" className="text-xs">
              {template.width_mm}×{template.height_mm}mm
            </Badge>
            <Badge variant="outline" className="text-xs">
              {template.dpi} DPI
            </Badge>
          </div>
          <div className="flex items-center gap-1">
            <Button variant="ghost" size="sm" onClick={handleZoomOut} disabled={scale <= 0.25}>
              <ZoomOut className="h-3 w-3" />
            </Button>
            <Button variant="ghost" size="sm" onClick={handleResetZoom}>
              <RotateCcw className="h-3 w-3" />
            </Button>
            <Button variant="ghost" size="sm" onClick={handleZoomIn} disabled={scale >= 3}>
              <ZoomIn className="h-3 w-3" />
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={handleDownloadPreview}
              disabled={!previewUrl}
            >
              <Download className="h-3 w-3" />
            </Button>
          </div>
        </div>
      )}

      {/* Preview Container */}
      <Card className="bg-gray-50 p-4 dark:bg-gray-900">
        <div className="relative flex min-h-[200px] items-center justify-center">
          {isLoading && (
            <div className="absolute inset-0 flex items-center justify-center bg-background/80">
              <div className="flex items-center gap-2 text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" />
                <span className="text-sm">Generowanie podglądu...</span>
              </div>
            </div>
          )}

          {error && (
            <div className="text-center text-destructive">
              <p className="text-sm">{error}</p>
              <Button variant="outline" size="sm" className="mt-2" onClick={generatePreview}>
                Spróbuj ponownie
              </Button>
            </div>
          )}

          {previewUrl && !isLoading && (
            <div className="relative">
              <Image
                src={previewUrl}
                alt="Label Preview"
                width={aspectRatio > 1 ? 300 : 200}
                height={aspectRatio > 1 ? 200 : 300}
                className="rounded border border-gray-300 shadow-sm"
                style={{
                  transform: `scale(${scale})`,
                  transformOrigin: "center",
                  transition: "transform 0.2s ease",
                }}
                unoptimized
              />

              {/* Scale indicator */}
              {scale !== 1 && (
                <Badge variant="secondary" className="absolute -right-2 -top-2 text-xs">
                  {Math.round(scale * 100)}%
                </Badge>
              )}
            </div>
          )}

          {!previewUrl && !isLoading && !error && (
            <div className="text-center text-muted-foreground">
              <p className="text-sm">Brak podglądu</p>
            </div>
          )}
        </div>
      </Card>

      {/* Label Information */}
      <div className="space-y-2 text-xs text-muted-foreground">
        <div className="flex justify-between">
          <span>QR Token:</span>
          <code className="rounded bg-muted px-1 text-xs">{data.qrToken}</code>
        </div>

        {data.displayText && (
          <div className="flex justify-between">
            <span>Tekst:</span>
            <span>{data.displayText}</span>
          </div>
        )}

        {data.codeText && (
          <div className="flex justify-between">
            <span>Kod:</span>
            <code className="rounded bg-muted px-1 text-xs">{data.codeText}</code>
          </div>
        )}

        {data.hierarchy && data.hierarchy.length > 0 && (
          <div className="flex justify-between">
            <span>Hierarchia:</span>
            <span className="max-w-40 truncate text-right">{data.hierarchy.join(" > ")}</span>
          </div>
        )}

        {data.barcode && (
          <div className="flex justify-between">
            <span>Kod kreskowy:</span>
            <code className="rounded bg-muted px-1 text-xs">{data.barcode}</code>
          </div>
        )}
      </div>

      {/* Template Settings Summary */}
      <div className="grid grid-cols-2 gap-2 border-t pt-2 text-xs text-muted-foreground">
        <div>
          <span className="font-medium">Pozycja QR:</span>
          <br />
          <span className="capitalize">{template.qr_position.replace("-", " ")}</span>
        </div>
        <div>
          <span className="font-medium">Rozmiar QR:</span>
          <br />
          <span>{template.qr_size_mm}mm</span>
        </div>

        {template.show_label_text && (
          <div>
            <span className="font-medium">Pozycja tekstu:</span>
            <br />
            <span className="capitalize">{template.label_text_position}</span>
          </div>
        )}

        <div>
          <span className="font-medium">Kolory:</span>
          <br />
          <div className="mt-1 flex items-center gap-1">
            <div
              className="h-3 w-3 rounded border"
              style={{ backgroundColor: template.background_color }}
              title="Tło"
            />
            <div
              className="h-3 w-3 rounded border"
              style={{ backgroundColor: template.text_color }}
              title="Tekst"
            />
          </div>
        </div>
      </div>
    </div>
  );
}
