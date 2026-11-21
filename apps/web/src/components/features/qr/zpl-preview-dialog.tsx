"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { Download, RotateCw, ZoomIn, ZoomOut } from "lucide-react";
import { BrandLoader } from "@/components/branding";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { isDotBlack, parseZplLabels, type ZplPreviewLabel } from "@/lib/qr/zpl-preview";

const MAX_PREVIEW_LABELS = 60;
/** 203 dpi printers: 8 dots per millimetre. */
const DOTS_PER_MM = 8;

interface ZplPreviewDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** The ZPL file's text; null while it is being generated. */
  zpl: string | null;
  generating?: boolean;
  /** File name for the download button; leave out to hide the button. */
  fileName?: string;
  title: string;
}

/**
 * Shows a ZPL file the way the printer lays it out: each label as the bitmap
 * sent to the head, as it comes off the roll. Rotate to read portrait labels.
 */
export function ZplPreviewDialog({
  open,
  onOpenChange,
  zpl,
  generating = false,
  fileName,
  title,
}: ZplPreviewDialogProps) {
  const t = useTranslations("modules.qr.zplPreview");
  const [rotation, setRotation] = useState(0);
  // Real size by default: closer to the print than one screen pixel per dot.
  const [realSize, setRealSize] = useState(true);
  const labels = useMemo(() => (zpl ? parseZplLabels(zpl) : []), [zpl]);
  const skipped = labels.reduce((sum, label) => sum + label.skipped, 0);

  useEffect(() => {
    if (open) setRotation(0);
  }, [open, zpl]);

  function handleDownload() {
    if (!zpl || !fileName) return;
    const url = URL.createObjectURL(new Blob([zpl], { type: "text/plain" }));
    const a = document.createElement("a");
    a.href = url;
    a.download = fileName;
    a.click();
    URL.revokeObjectURL(url);
  }

  const first = labels[0];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex h-[92vh] max-w-5xl flex-col gap-0 p-0" hideClose>
        <DialogHeader className="flex shrink-0 flex-row items-center justify-between gap-3 border-b px-4 py-3">
          <div className="min-w-0">
            <DialogTitle className="truncate text-sm font-medium">{title}</DialogTitle>
            {first ? (
              <p className="text-xs text-muted-foreground">
                {t("summary", {
                  count: labels.length,
                  width: Math.round(first.width / DOTS_PER_MM),
                  height: Math.round(first.height / DOTS_PER_MM),
                })}
              </p>
            ) : null}
          </div>
          <div className="mr-12 flex shrink-0 items-center gap-2">
            <Button
              size="sm"
              variant="outline"
              onClick={() => setRealSize((value) => !value)}
              disabled={labels.length === 0}
              title={realSize ? t("zoomHint") : t("realSizeHint")}
            >
              {realSize ? (
                <ZoomIn className="mr-1.5 h-4 w-4" />
              ) : (
                <ZoomOut className="mr-1.5 h-4 w-4" />
              )}
              {realSize ? t("zoom") : t("realSize")}
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={() => setRotation((r) => (r + 90) % 360)}
              disabled={labels.length === 0}
            >
              <RotateCw className="mr-1.5 h-4 w-4" />
              {t("rotate")}
            </Button>
            {fileName ? (
              <Button size="sm" onClick={handleDownload} disabled={!zpl}>
                <Download className="mr-1.5 h-4 w-4" />
                {t("download")}
              </Button>
            ) : null}
          </div>
        </DialogHeader>

        <div className="min-h-0 flex-1 overflow-auto bg-muted/30 p-6">
          {generating ? (
            <div className="flex h-full items-center justify-center">
              <BrandLoader
                variant="beacon_swap"
                label={t("generating")}
                showWordmark={false}
                logoClassName="h-20 w-20"
              />
            </div>
          ) : labels.length === 0 ? (
            <p className="py-16 text-center text-sm text-muted-foreground">
              {zpl ? t("empty") : null}
            </p>
          ) : (
            <div className="flex flex-col items-center gap-4">
              <p className="max-w-xl text-center text-xs text-muted-foreground">
                {rotation === 0 ? t("rollHint") : t("rotatedHint")}{" "}
                {realSize ? t("realSizeNote") : t("zoomNote")}
              </p>
              {skipped > 0 ? (
                <p className="max-w-xl text-center text-xs text-amber-600">{t("partial")}</p>
              ) : null}
              <div className="flex flex-wrap justify-center gap-4">
                {labels.slice(0, MAX_PREVIEW_LABELS).map((label, index) => (
                  <ZplLabelCanvas
                    key={index}
                    label={label}
                    rotation={rotation}
                    realSize={realSize}
                  />
                ))}
              </div>
              {labels.length > MAX_PREVIEW_LABELS ? (
                <p className="text-xs text-muted-foreground">
                  {t("more", { count: labels.length - MAX_PREVIEW_LABELS })}
                </p>
              ) : null}
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

function ZplLabelCanvas({
  label,
  rotation,
  realSize,
}: {
  label: ZplPreviewLabel;
  rotation: number;
  realSize: boolean;
}) {
  const ref = useRef<HTMLCanvasElement | null>(null);
  const sideways = rotation === 90 || rotation === 270;
  const width = sideways ? label.height : label.width;
  const height = sideways ? label.width : label.height;

  useEffect(() => {
    const canvas = ref.current;
    const ctx = canvas?.getContext("2d");
    if (!canvas || !ctx) return;
    const image = ctx.createImageData(label.width, label.height);
    image.data.fill(255);
    for (const graphic of label.graphics) {
      for (let gy = 0; gy < graphic.height; gy++) {
        const y = graphic.y + gy;
        if (y >= label.height) break;
        for (let gx = 0; gx < graphic.width; gx++) {
          const x = graphic.x + gx;
          if (x >= label.width) break;
          if (!isDotBlack(graphic, gx, gy)) continue;
          const i = (y * label.width + x) * 4;
          image.data[i] = image.data[i + 1] = image.data[i + 2] = 0;
        }
      }
    }
    const source = document.createElement("canvas");
    source.width = label.width;
    source.height = label.height;
    source.getContext("2d")?.putImageData(image, 0, 0);

    canvas.width = width;
    canvas.height = height;
    ctx.save();
    ctx.translate(width / 2, height / 2);
    ctx.rotate((rotation * Math.PI) / 180);
    ctx.drawImage(source, -label.width / 2, -label.height / 2);
    ctx.restore();
  }, [label, rotation, width, height]);

  // Real size: the label's millimetres in CSS mm, smoothed like ink on paper.
  // Zoomed: one dot per CSS pixel (about 2× real size), every dot visible.
  return (
    <canvas
      ref={ref}
      className={`h-auto max-w-full rounded-sm border bg-white shadow-sm ${
        realSize ? "" : "[image-rendering:pixelated]"
      }`}
      style={{ width: realSize ? `${width / DOTS_PER_MM}mm` : Math.min(width, 640) }}
    />
  );
}
