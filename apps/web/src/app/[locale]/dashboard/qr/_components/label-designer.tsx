"use client";

import { useState, useMemo } from "react";
import { toast } from "react-toastify";
import { Download } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";
import { Checkbox } from "@/components/ui/checkbox";
import { Separator } from "@/components/ui/separator";
import {
  DEFAULT_LABEL_CONFIG,
  LABEL_PRESETS,
  computeGrid,
  A4_W_MM,
  A4_H_MM,
  GRID_MARGIN_MM,
} from "@/lib/qr/label-config";
import type { LabelConfig, TextLayerConfig } from "@/lib/qr/label-config";

// ---------------------------------------------------------------------------
// SVG preview helpers
// ---------------------------------------------------------------------------

/** Build text-stub rectangles for one label cell in the preview SVG. */
function buildTextStubs(
  config: LabelConfig,
  active: boolean,
  txStart: number,
  startY: number,
  textW: number,
  scale: number
): React.ReactElement[] {
  const elems: React.ReactElement[] = [];
  let y = startY;

  const LAYERS = [
    {
      key: "p",
      cfg: config.primaryText,
      wFrac: 0.82,
      sizeMul: 0.45,
      dark: "#1e293b",
      dim: "#cbd5e1",
    },
    {
      key: "s",
      cfg: config.secondaryText,
      wFrac: 0.62,
      sizeMul: 0.4,
      dark: "#64748b",
      dim: "#e2e8f0",
    },
    {
      key: "t",
      cfg: config.tertiaryText,
      wFrac: 0.48,
      sizeMul: 0.38,
      dark: "#94a3b8",
      dim: "#e2e8f0",
    },
  ] as const;

  for (const { key, cfg, wFrac, sizeMul, dark, dim } of LAYERS) {
    if (!cfg.show) continue;
    const h = Math.max(0.8, cfg.size * scale * sizeMul);
    elems.push(
      <rect
        key={key}
        x={txStart}
        y={y}
        width={textW * wFrac}
        height={h}
        fill={active ? dark : dim}
        rx={0.4}
      />
    );
    y += h + Math.max(0.6, h * 0.45);
  }

  if (config.includeTokenPreview) {
    const h = Math.max(0.6, 5 * scale * 0.32);
    elems.push(
      <rect
        key="tok"
        x={txStart}
        y={y + 1.5}
        width={textW}
        height={h}
        fill={active ? "#cbd5e1" : "#f1f5f9"}
        rx={0.3}
      />
    );
  }

  return elems;
}

// ---------------------------------------------------------------------------
// Section wrapper
// ---------------------------------------------------------------------------

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="space-y-3">
      <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{title}</p>
      {children}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

interface LabelDesignerProps {
  selectedIds: string[];
  canExport: boolean;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function LabelDesigner({ selectedIds, canExport }: LabelDesignerProps) {
  const [config, setConfig] = useState<LabelConfig>(DEFAULT_LABEL_CONFIG);
  const [format, setFormat] = useState<"pdf" | "zpl">("pdf");
  const [zplSize, setZplSize] = useState<"50x30" | "70x40">("50x30");
  const [isExporting, setIsExporting] = useState(false);

  // ── helpers ───────────────────────────────────────────────────────────────

  function set<K extends keyof LabelConfig>(key: K, value: LabelConfig[K]) {
    setConfig((prev) => ({ ...prev, [key]: value }));
  }

  function setTextLayer(
    layer: "primaryText" | "secondaryText" | "tertiaryText",
    key: keyof TextLayerConfig,
    value: boolean | number
  ) {
    setConfig((prev) => ({
      ...prev,
      [layer]: { ...prev[layer], [key]: value },
    }));
  }

  function clampDim(val: number, min = 10, max = 210) {
    return Math.max(min, Math.min(max, val || min));
  }

  // ── export ────────────────────────────────────────────────────────────────

  async function handleExport() {
    if (selectedIds.length === 0) {
      toast.error("Select at least one QR code to export.");
      return;
    }
    setIsExporting(true);
    try {
      const body =
        format === "pdf"
          ? { qrCodeIds: selectedIds, format: "pdf", labelConfig: config }
          : { qrCodeIds: selectedIds, format: "zpl", labelConfig: config, zplSize };

      const res = await fetch("/api/qr/export", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(body),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: "Export failed." }));
        toast.error((err as { error?: string }).error ?? "Export failed.");
        return;
      }

      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = format === "pdf" ? "qr-labels.pdf" : "qr-labels.zpl";
      a.click();
      URL.revokeObjectURL(url);
      toast.success(`Exported ${selectedIds.length} label${selectedIds.length === 1 ? "" : "s"}.`);
    } catch {
      toast.error("Export failed. Please try again.");
    } finally {
      setIsExporting(false);
    }
  }

  // ── SVG preview geometry ──────────────────────────────────────────────────

  const PREVIEW_W = 260; // px representing A4 width
  const scale = PREVIEW_W / A4_W_MM;
  const PREVIEW_H = Math.round(A4_H_MM * scale);
  const marginPx = GRID_MARGIN_MM * scale;

  const grid = useMemo(() => computeGrid(config.dimension), [config.dimension]);
  const totalPages = selectedIds.length > 0 ? Math.ceil(selectedIds.length / grid.perPage) : 1;

  const cellW = config.dimension.width * scale;
  const cellH = config.dimension.height * scale;
  const CELL_PAD = Math.max(1, cellH * 0.07);
  const qrSize = cellH * config.qrHeightRatio;
  const txStart_offset = qrSize + CELL_PAD * 2; // from cell x
  const textW = Math.max(0, cellW - txStart_offset - CELL_PAD);

  const filledCount = Math.min(selectedIds.length, grid.perPage);

  const previewCells = useMemo(() => {
    const cells = [];
    for (let row = 0; row < grid.rows; row++) {
      for (let col = 0; col < grid.cols; col++) {
        const idx = row * grid.cols + col;
        cells.push({
          x: marginPx + col * cellW,
          y: marginPx + row * cellH,
          active: idx < filledCount,
          idx,
        });
      }
    }
    return cells;
  }, [grid, marginPx, cellW, cellH, filledCount]);

  // ── render ────────────────────────────────────────────────────────────────

  return (
    <div className="grid gap-8 xl:grid-cols-[320px_1fr]">
      {/* ── Left column: controls ─────────────────────────────────────── */}
      <div className="space-y-6">
        {/* Label size */}
        <Section title="Label size">
          <div className="flex flex-wrap gap-1.5">
            {LABEL_PRESETS.map((preset) => {
              const active =
                config.dimension.width === preset.dim.width &&
                config.dimension.height === preset.dim.height;
              return (
                <Button
                  key={preset.label}
                  size="sm"
                  variant={active ? "default" : "outline"}
                  onClick={() => set("dimension", preset.dim)}
                  className="h-7 px-2.5 text-xs"
                >
                  {preset.label}
                </Button>
              );
            })}
          </div>
          <div className="flex gap-3">
            <div className="flex-1 space-y-1">
              <Label className="text-xs text-muted-foreground">Width (mm)</Label>
              <Input
                type="number"
                min={10}
                max={210}
                value={config.dimension.width}
                onChange={(e) =>
                  set("dimension", {
                    ...config.dimension,
                    width: clampDim(Number(e.target.value), 10, 210),
                  })
                }
                className="h-8"
              />
            </div>
            <div className="flex-1 space-y-1">
              <Label className="text-xs text-muted-foreground">Height (mm)</Label>
              <Input
                type="number"
                min={10}
                max={297}
                value={config.dimension.height}
                onChange={(e) =>
                  set("dimension", {
                    ...config.dimension,
                    height: clampDim(Number(e.target.value), 10, 297),
                  })
                }
                className="h-8"
              />
            </div>
          </div>
          <p className="text-xs text-muted-foreground">
            {grid.cols} col × {grid.rows} row ={" "}
            <span className="font-semibold text-foreground">{grid.perPage}</span> labels/page
          </p>
        </Section>

        <Separator />

        {/* Content */}
        <Section title="Content">
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <Label htmlFor="toggle-logo" className="text-sm cursor-pointer">
                Logo in QR centre
              </Label>
              <Switch
                id="toggle-logo"
                checked={config.includeLogo}
                onCheckedChange={(v) => set("includeLogo", v)}
              />
            </div>
            <div className="flex items-center justify-between">
              <Label htmlFor="toggle-border" className="text-sm cursor-pointer">
                Cell border
              </Label>
              <Switch
                id="toggle-border"
                checked={config.showBorder}
                onCheckedChange={(v) => set("showBorder", v)}
              />
            </div>
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label className="text-sm">
                QR size{" "}
                <span className="font-mono text-muted-foreground">
                  {Math.round(config.qrHeightRatio * 100)}%
                </span>
              </Label>
            </div>
            <Slider
              min={40}
              max={95}
              step={5}
              value={[Math.round(config.qrHeightRatio * 100)]}
              onValueChange={([v]) => set("qrHeightRatio", v / 100)}
            />
          </div>
        </Section>

        <Separator />

        {/* Text layers */}
        <Section title="Text layers">
          <div className="space-y-2.5">
            {(
              [
                ["primaryText", "Primary"],
                ["secondaryText", "Secondary"],
                ["tertiaryText", "Tertiary"],
              ] as const
            ).map(([layer, name]) => {
              const cfg = config[layer];
              return (
                <div key={layer} className="flex items-center gap-2">
                  <Checkbox
                    id={`show-${layer}`}
                    checked={cfg.show}
                    onCheckedChange={(v) => setTextLayer(layer, "show", !!v)}
                  />
                  <Label
                    htmlFor={`show-${layer}`}
                    className={`w-20 cursor-pointer text-sm ${!cfg.show ? "text-muted-foreground" : ""}`}
                  >
                    {name}
                  </Label>
                  <Input
                    type="number"
                    min={4}
                    max={24}
                    value={cfg.size}
                    onChange={(e) =>
                      setTextLayer(layer, "size", Math.max(4, Math.min(24, Number(e.target.value))))
                    }
                    className="h-7 w-14 text-xs"
                    disabled={!cfg.show}
                  />
                  <span className="text-xs text-muted-foreground">pt</span>
                  <Checkbox
                    id={`bold-${layer}`}
                    checked={cfg.bold}
                    onCheckedChange={(v) => setTextLayer(layer, "bold", !!v)}
                    disabled={!cfg.show}
                  />
                  <Label
                    htmlFor={`bold-${layer}`}
                    className={`cursor-pointer text-xs ${!cfg.show ? "text-muted-foreground" : ""}`}
                  >
                    bold
                  </Label>
                </div>
              );
            })}

            <div className="flex items-center gap-2 pt-1">
              <Checkbox
                id="token-preview"
                checked={config.includeTokenPreview}
                onCheckedChange={(v) => set("includeTokenPreview", !!v)}
              />
              <Label htmlFor="token-preview" className="cursor-pointer text-sm">
                Token preview
              </Label>
            </div>
          </div>
        </Section>

        <Separator />

        {/* Format + export */}
        <Section title="Export">
          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground">Format</Label>
            <div className="flex gap-1">
              {(["pdf", "zpl"] as const).map((f) => (
                <Button
                  key={f}
                  size="sm"
                  variant={format === f ? "default" : "outline"}
                  onClick={() => setFormat(f)}
                  className="flex-1 h-8 uppercase text-xs tracking-wide"
                >
                  {f}
                </Button>
              ))}
            </div>
          </div>

          {format === "zpl" && (
            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground">Zebra label size</Label>
              <div className="flex gap-1">
                {(["50x30", "70x40"] as const).map((s) => (
                  <Button
                    key={s}
                    size="sm"
                    variant={zplSize === s ? "default" : "outline"}
                    onClick={() => setZplSize(s)}
                    className="flex-1 h-8 text-xs"
                  >
                    {s} mm
                  </Button>
                ))}
              </div>
            </div>
          )}

          <Button
            onClick={handleExport}
            disabled={isExporting || !canExport || selectedIds.length === 0}
            className="w-full gap-2"
          >
            <Download className="h-4 w-4" />
            {isExporting
              ? "Exporting…"
              : selectedIds.length > 0
                ? `Export ${selectedIds.length} label${selectedIds.length !== 1 ? "s" : ""}`
                : "Select codes above to export"}
          </Button>

          {selectedIds.length > 0 && format === "pdf" && (
            <p className="text-center text-xs text-muted-foreground">
              {totalPages} PDF page{totalPages !== 1 ? "s" : ""}
            </p>
          )}
        </Section>
      </div>

      {/* ── Right column: live A4 preview ─────────────────────────────── */}
      <div className="flex flex-col gap-3">
        <div className="flex items-center justify-between">
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Live preview — A4
          </p>
          <p className="text-xs text-muted-foreground">
            {grid.cols} × {grid.rows} ={" "}
            <span className="font-medium text-foreground">{grid.perPage}</span>/page
            {selectedIds.length > 0 && (
              <>
                {" "}
                · <span className="font-medium text-foreground">{totalPages}</span> page
                {totalPages !== 1 ? "s" : ""} for {selectedIds.length} selected
              </>
            )}
          </p>
        </div>

        <div
          className="overflow-hidden rounded-sm border shadow-md"
          style={{ width: PREVIEW_W + 2 }}
        >
          <svg
            width={PREVIEW_W}
            height={PREVIEW_H}
            viewBox={`0 0 ${PREVIEW_W} ${PREVIEW_H}`}
            style={{ display: "block", background: "white" }}
          >
            {/* Page background */}
            <rect x={0} y={0} width={PREVIEW_W} height={PREVIEW_H} fill="white" />

            {/* Margin guide */}
            <rect
              x={marginPx}
              y={marginPx}
              width={PREVIEW_W - marginPx * 2}
              height={PREVIEW_H - marginPx * 2}
              fill="none"
              stroke="#e2e8f0"
              strokeWidth={0.5}
              strokeDasharray="2 2"
            />

            {/* Label cells */}
            {previewCells.map(({ x, y, active, idx }) => {
              const qrX = x + CELL_PAD;
              const qrY = y + (cellH - qrSize) / 2;
              const fp = qrSize * 0.22; // finder pattern outer size
              const logoSz = qrSize * 0.28;
              const lx = qrX + (qrSize - logoSz) / 2;
              const ly = qrY + (qrSize - logoSz) / 2;
              const txStart = x + CELL_PAD + qrSize + CELL_PAD;
              // Vertically centre the text stubs
              const textStartY = qrY + (qrSize - cellH * 0.5) / 2;

              return (
                <g key={idx} opacity={active ? 1 : 0.14}>
                  {/* Border */}
                  {config.showBorder && (
                    <rect
                      x={x + 0.5}
                      y={y + 0.5}
                      width={cellW - 1}
                      height={cellH - 1}
                      fill="none"
                      stroke={active ? "#94a3b8" : "#e2e8f0"}
                      strokeWidth={0.5}
                    />
                  )}

                  {/* QR placeholder */}
                  <rect
                    x={qrX}
                    y={qrY}
                    width={qrSize}
                    height={qrSize}
                    fill={active ? "#e2e8f0" : "#f8fafc"}
                    rx={0.5}
                  />

                  {/* Finder patterns — only when QR is large enough to show them */}
                  {qrSize >= 14 && (
                    <>
                      {/* Top-left */}
                      <rect x={qrX + 1} y={qrY + 1} width={fp} height={fp} fill="white" rx={0.4} />
                      <rect
                        x={qrX + 2}
                        y={qrY + 2}
                        width={fp * 0.56}
                        height={fp * 0.56}
                        fill="#374151"
                        rx={0.2}
                      />
                      {/* Top-right */}
                      <rect
                        x={qrX + qrSize - fp - 1}
                        y={qrY + 1}
                        width={fp}
                        height={fp}
                        fill="white"
                        rx={0.4}
                      />
                      <rect
                        x={qrX + qrSize - fp * 0.56 - 2}
                        y={qrY + 2}
                        width={fp * 0.56}
                        height={fp * 0.56}
                        fill="#374151"
                        rx={0.2}
                      />
                      {/* Bottom-left */}
                      <rect
                        x={qrX + 1}
                        y={qrY + qrSize - fp - 1}
                        width={fp}
                        height={fp}
                        fill="white"
                        rx={0.4}
                      />
                      <rect
                        x={qrX + 2}
                        y={qrY + qrSize - fp * 0.56 - 2}
                        width={fp * 0.56}
                        height={fp * 0.56}
                        fill="#374151"
                        rx={0.2}
                      />
                    </>
                  )}

                  {/* Logo triangle (A-shape) in QR centre */}
                  {config.includeLogo && qrSize >= 10 && (
                    <polygon
                      points={`${lx + logoSz / 2},${ly} ${lx},${ly + logoSz} ${lx + logoSz},${ly + logoSz}`}
                      fill="white"
                    />
                  )}

                  {/* Text stubs */}
                  {buildTextStubs(config, active, txStart, textStartY, textW, scale)}
                </g>
              );
            })}
          </svg>
        </div>

        {selectedIds.length > 0 && totalPages > 1 && (
          <p className="text-xs text-muted-foreground">Showing page 1 of {totalPages}</p>
        )}
      </div>
    </div>
  );
}
