"use client";

import { memo, useDeferredValue, useEffect, useMemo, useRef, useState } from "react";
import { toast } from "react-toastify";
import {
  AlignCenter,
  AlignLeft,
  AlignRight,
  ChevronUp,
  Download,
  Eye,
  Minus,
  Plus,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";
import { Checkbox } from "@/components/ui/checkbox";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import {
  DEFAULT_LABEL_CONFIG,
  computeGrid,
  getEffectiveLabelDimension,
  A4_W_MM,
  A4_H_MM,
  GRID_MARGIN_MM,
} from "@/lib/qr/label-config";
import type {
  LabelConfig,
  LogoBackgroundStyle,
  QrCornerDotStyle,
  QrCornerSquareStyle,
  QrDotStyle,
  QrFrameShape,
  TextAlign,
  TextLayerConfig,
  TextPosition,
} from "@/lib/qr/label-config";
import { QrPdfPreviewDialog } from "@/app/[locale]/dashboard/qr/_components/qr-pdf-preview-dialog";

// ---------------------------------------------------------------------------
// SVG preview helpers
// ---------------------------------------------------------------------------

const TEXT_POSITION_OPTIONS: readonly TextPosition[] = ["right", "left", "above", "below"];
const TEXT_ALIGN_OPTIONS: readonly TextAlign[] = ["left", "center", "right"];
const LOGO_BACKGROUND_OPTIONS: readonly LogoBackgroundStyle[] = ["brand", "circle", "square"];
const QR_FRAME_SHAPE_OPTIONS: readonly QrFrameShape[] = ["square", "circle"];
const QR_DOT_STYLE_OPTIONS: readonly QrDotStyle[] = [
  "square",
  "dots",
  "rounded",
  "classy",
  "classy-rounded",
  "extra-rounded",
];
const QR_CORNER_SQUARE_OPTIONS: readonly QrCornerSquareStyle[] = [
  "square",
  "dot",
  "extra-rounded",
  "dots",
  "rounded",
  "classy",
  "classy-rounded",
];
const QR_CORNER_DOT_OPTIONS: readonly QrCornerDotStyle[] = [
  "dot",
  "square",
  "dots",
  "rounded",
  "classy",
  "classy-rounded",
  "extra-rounded",
];
const TEXT_ALIGN_ICONS: Record<TextAlign, typeof AlignLeft> = {
  left: AlignLeft,
  center: AlignCenter,
  right: AlignRight,
};
const ZPL_DIMENSIONS = {
  "50x30": { width: 50, height: 30 },
  "70x40": { width: 70, height: 40 },
} as const;

function hasVisibleText(config: LabelConfig) {
  return (
    config.primaryText.show ||
    config.secondaryText.show ||
    config.tertiaryText.show ||
    config.includeTokenPreview
  );
}

function estimatePreviewTextHeight(config: LabelConfig, scale: number) {
  const visibleLayers = [
    config.primaryText.show ? config.primaryText.size * scale * 0.45 : 0,
    config.secondaryText.show ? config.secondaryText.size * scale * 0.4 : 0,
    config.tertiaryText.show ? config.tertiaryText.size * scale * 0.38 : 0,
  ].filter(Boolean);

  const tokenHeight = config.includeTokenPreview ? Math.max(0.6, 5 * scale * 0.32) : 0;
  const gap = Math.max(0.6, scale * 1.2);
  const gapsCount = Math.max(
    0,
    visibleLayers.length - 1 + (config.includeTokenPreview && visibleLayers.length > 0 ? 1 : 0)
  );

  return (
    visibleLayers.reduce((sum, height) => sum + Math.max(0.8, height), 0) +
    tokenHeight +
    gapsCount * gap
  );
}

function getPreviewLayout(
  config: LabelConfig,
  cellW: number,
  cellH: number,
  pad: number,
  scale: number
): {
  qrX: number;
  qrY: number;
  qrSize: number;
  textX: number;
  textY: number;
  textW: number;
  textH: number;
} {
  const innerW = Math.max(0, cellW - pad * 2);
  const innerH = Math.max(0, cellH - pad * 2);
  const gap = Math.max(1, Math.min(innerW, innerH) * 0.08);
  const showText = hasVisibleText(config);

  if (!showText) {
    const qrSize = Math.max(0, Math.min(innerW, innerH) * config.qrHeightRatio);
    return {
      qrX: pad + (innerW - qrSize) / 2,
      qrY: pad + (innerH - qrSize) / 2,
      qrSize,
      textX: pad,
      textY: pad,
      textW: 0,
      textH: 0,
    };
  }

  if (config.textPosition === "above" || config.textPosition === "below") {
    const neededTextH = estimatePreviewTextHeight(config, scale) + gap;
    const qrBudget = Math.max(0, innerH - neededTextH);
    const qrSize = Math.max(0, Math.min(innerW, qrBudget, innerH * config.qrHeightRatio));
    const textH = Math.max(0, innerH - qrSize - gap);
    const textY = config.textPosition === "above" ? pad : pad + qrSize + gap;
    const qrY = config.textPosition === "above" ? pad + textH + gap : pad;
    return {
      qrX: pad + (innerW - qrSize) / 2,
      qrY,
      qrSize,
      textX: pad,
      textY,
      textW: innerW,
      textH,
    };
  }

  const qrSize = Math.max(0, Math.min(innerH, innerH * config.qrHeightRatio));
  const textW = Math.max(0, innerW - qrSize - gap);
  const qrX = config.textPosition === "left" ? pad + textW + gap : pad;
  const textX = config.textPosition === "left" ? pad : pad + qrSize + gap;

  return {
    qrX,
    qrY: pad + (innerH - qrSize) / 2,
    qrSize,
    textX,
    textY: pad,
    textW,
    textH: innerH,
  };
}

function getStubWidth(textW: number, fraction: number) {
  return Math.max(0, textW * fraction);
}

function getAlignedX(align: TextAlign, blockX: number, blockW: number, lineW: number) {
  if (align === "center") return blockX + (blockW - lineW) / 2;
  if (align === "right") return blockX + blockW - lineW;
  return blockX;
}

function renderLogoPreview(
  style: LogoBackgroundStyle,
  x: number,
  y: number,
  size: number
): React.ReactElement {
  const insetRatio = style === "brand" ? 0.1 : style === "circle" ? 0.19 : 0.18;
  const innerPad = size * insetRatio;
  const innerX = x + innerPad;
  const innerY = y + innerPad;
  const innerW = size - innerPad * 2;
  const innerH = size - innerPad * 2;
  const apexX = innerX + innerW / 2;
  const apexY = innerY + innerH * 0.06;
  const leftBaseX = innerX + innerW * 0.08;
  const rightBaseX = innerX + innerW * 0.92;
  const baseY = innerY + innerH * 0.94;
  const centerY = innerY + innerH * 0.58;
  const notchHalfW = innerW * 0.12;

  return (
    <>
      {style === "brand" ? (
        <polygon
          points={`${x + size / 2},${y} ${x},${y + size} ${x + size},${y + size}`}
          fill="white"
        />
      ) : null}
      {style === "circle" ? (
        <circle cx={x + size / 2} cy={y + size / 2} r={size * 0.48} fill="white" />
      ) : null}
      {style === "square" ? (
        <rect x={x} y={y} width={size} height={size} rx={size * 0.12} fill="white" />
      ) : null}
      <polygon
        points={`${apexX},${apexY} ${leftBaseX},${baseY} ${innerX + innerW * 0.34},${baseY} ${apexX},${centerY}`}
        fill="#111111"
      />
      <polygon
        points={`${apexX},${apexY} ${apexX},${centerY} ${innerX + innerW * 0.66},${baseY} ${rightBaseX},${baseY}`}
        fill="#111111"
      />
      <polygon
        points={`${apexX},${innerY + innerH * 0.22} ${apexX - notchHalfW},${centerY} ${apexX + notchHalfW},${centerY}`}
        fill="white"
      />
    </>
  );
}

function getQrModuleRadius(
  style: QrDotStyle | QrCornerDotStyle | QrCornerSquareStyle,
  size: number
) {
  if (style === "square") return size * 0.08;
  if (style === "rounded") return size * 0.24;
  if (style === "extra-rounded" || style === "dot" || style === "dots") return size * 0.48;
  if (style === "classy" || style === "classy-rounded") return size * 0.34;
  return size * 0.12;
}

function renderQrModule(
  style: QrDotStyle | QrCornerDotStyle | QrCornerSquareStyle,
  x: number,
  y: number,
  size: number,
  color: string,
  key: string
) {
  if (style === "dots" || style === "dot") {
    return <circle key={key} cx={x + size / 2} cy={y + size / 2} r={size * 0.34} fill={color} />;
  }

  if (style === "classy" || style === "classy-rounded") {
    const rx = style === "classy-rounded" ? size * 0.34 : size * 0.2;
    return (
      <rect
        key={key}
        x={x + size * 0.12}
        y={y + size * 0.2}
        width={size * 0.76}
        height={size * 0.6}
        rx={rx}
        fill={color}
      />
    );
  }

  return (
    <rect
      key={key}
      x={x + size * 0.08}
      y={y + size * 0.08}
      width={size * 0.84}
      height={size * 0.84}
      rx={getQrModuleRadius(style, size)}
      fill={color}
    />
  );
}

function renderFinderPattern(
  style: QrCornerSquareStyle,
  dotStyle: QrCornerDotStyle,
  x: number,
  y: number,
  size: number,
  color: string
) {
  const outerPad = size * 0.06;
  const innerPad = size * 0.24;
  const corePad = size * 0.38;

  return (
    <>
      {renderQrModule(
        style,
        x + outerPad,
        y + outerPad,
        size - outerPad * 2,
        color,
        `${x}-${y}-outer`
      )}
      <rect
        x={x + innerPad}
        y={y + innerPad}
        width={size - innerPad * 2}
        height={size - innerPad * 2}
        rx={size * 0.12}
        fill="white"
      />
      {renderQrModule(
        dotStyle,
        x + corePad,
        y + corePad,
        size - corePad * 2,
        color,
        `${x}-${y}-core`
      )}
    </>
  );
}

function buildQrBodyPreview(
  config: LabelConfig,
  x: number,
  y: number,
  size: number
): React.ReactElement[] {
  const elems: React.ReactElement[] = [];
  const moduleCount = 7;
  const moduleSize = size / moduleCount;
  const dark = "#334155";
  const skipFinder = (row: number, col: number) =>
    (row < 2 && col < 2) ||
    (row < 2 && col >= moduleCount - 2) ||
    (row >= moduleCount - 2 && col < 2);

  for (let row = 0; row < moduleCount; row++) {
    for (let col = 0; col < moduleCount; col++) {
      if (skipFinder(row, col)) continue;
      if ((row + col) % 2 !== 0 && !(row === 3 || col === 3)) continue;

      elems.push(
        renderQrModule(
          config.qrStyle.dotStyle,
          x + col * moduleSize,
          y + row * moduleSize,
          moduleSize,
          dark,
          `qr-${row}-${col}`
        )
      );
    }
  }

  const finderSize = moduleSize * 2;
  elems.push(
    <g key="finder-tl">
      {renderFinderPattern(
        config.qrStyle.cornerSquareStyle,
        config.qrStyle.cornerDotStyle,
        x,
        y,
        finderSize,
        dark
      )}
    </g>
  );
  elems.push(
    <g key="finder-tr">
      {renderFinderPattern(
        config.qrStyle.cornerSquareStyle,
        config.qrStyle.cornerDotStyle,
        x + size - finderSize,
        y,
        finderSize,
        dark
      )}
    </g>
  );
  elems.push(
    <g key="finder-bl">
      {renderFinderPattern(
        config.qrStyle.cornerSquareStyle,
        config.qrStyle.cornerDotStyle,
        x,
        y + size - finderSize,
        finderSize,
        dark
      )}
    </g>
  );

  return elems;
}

/** Build text-stub rectangles for one label cell in the preview SVG. */
function buildTextStubs(
  config: LabelConfig,
  active: boolean,
  textX: number,
  textY: number,
  textW: number,
  textH: number,
  scale: number
): React.ReactElement[] {
  const elems: React.ReactElement[] = [];
  if (textW <= 0 || textH <= 0) return elems;

  const visibleLayers = [
    {
      key: "p",
      cfg: config.primaryText,
      wFrac: 0.82,
      sizeMul: 0.45,
      dark: "#0f172a",
      dim: "#475569",
    },
    {
      key: "s",
      cfg: config.secondaryText,
      wFrac: 0.62,
      sizeMul: 0.4,
      dark: "#475569",
      dim: "#64748b",
    },
    {
      key: "t",
      cfg: config.tertiaryText,
      wFrac: 0.48,
      sizeMul: 0.38,
      dark: "#64748b",
      dim: "#94a3b8",
    },
  ].filter(({ cfg }) => cfg.show);

  const tokenHeight = config.includeTokenPreview ? Math.max(0.6, 5 * scale * 0.32) : 0;
  const layerHeights = visibleLayers.map(({ cfg, sizeMul }) =>
    Math.max(0.8, cfg.size * scale * sizeMul)
  );
  const gapsCount = Math.max(
    0,
    visibleLayers.length - 1 + (config.includeTokenPreview && visibleLayers.length > 0 ? 1 : 0)
  );
  const gap = Math.max(0.6, scale * 1.2);
  const contentH =
    layerHeights.reduce((sum, height) => sum + height, 0) + tokenHeight + gapsCount * gap;
  let y = textY + Math.max(0, (textH - contentH) / 2);

  for (const [index, layer] of visibleLayers.entries()) {
    const h = layerHeights[index];
    const lineW = getStubWidth(textW, layer.wFrac);
    elems.push(
      <rect
        key={layer.key}
        x={getAlignedX(layer.cfg.align, textX, textW, lineW)}
        y={y}
        width={lineW}
        height={h}
        fill={active ? layer.dark : layer.dim}
        rx={0.4}
      />
    );
    y += h + gap;
  }

  if (config.includeTokenPreview) {
    const tokenW = getStubWidth(textW, 0.9);
    elems.push(
      <rect
        key="tok"
        x={textX}
        y={y}
        width={tokenW}
        height={tokenHeight}
        fill={active ? "#64748b" : "#94a3b8"}
        rx={0.3}
      />
    );
  }

  return elems;
}

function renderPageLabelPreview(
  config: LabelConfig,
  active: boolean,
  cellW: number,
  cellH: number,
  pad: number,
  scale: number
) {
  const layout = getPreviewLayout(config, cellW, cellH, pad, scale);
  const qrX = layout.qrX;
  const qrY = layout.qrY;
  const logoSz = layout.qrSize * 0.28;
  const lx = qrX + (layout.qrSize - logoSz) / 2;
  const ly = qrY + (layout.qrSize - logoSz) / 2;

  return (
    <>
      {config.showBorder && (
        <rect
          x={0.5}
          y={0.5}
          width={cellW - 1}
          height={cellH - 1}
          fill="none"
          stroke={active ? "#475569" : "#64748b"}
          strokeWidth={0.5}
        />
      )}

      <rect
        x={qrX}
        y={qrY}
        width={layout.qrSize}
        height={layout.qrSize}
        fill={active ? "#94a3b8" : "#cbd5e1"}
        rx={config.qrStyle.frameShape === "circle" ? layout.qrSize / 2 : 0.5}
      />

      {layout.qrSize >= 14 ? buildQrBodyPreview(config, qrX, qrY, layout.qrSize) : null}

      {config.includeLogo && layout.qrSize >= 10
        ? renderLogoPreview(config.logoBackgroundStyle, lx, ly, logoSz)
        : null}

      {buildTextStubs(
        config,
        active,
        layout.textX,
        layout.textY,
        layout.textW,
        layout.textH,
        scale
      )}
    </>
  );
}

const SingleLabelPreviewSvg = memo(function SingleLabelPreviewSvg({
  config,
  previewWidth,
  previewHeight,
  renderWidth,
  renderHeight,
  pad,
  scale,
}: {
  config: LabelConfig;
  previewWidth: number;
  previewHeight: number;
  renderWidth: number;
  renderHeight: number;
  pad: number;
  scale: number;
}) {
  const layout = getPreviewLayout(config, previewWidth, previewHeight, pad, scale);
  const qrX = layout.qrX;
  const qrY = layout.qrY;
  const logoSz = layout.qrSize * 0.28;
  const lx = qrX + (layout.qrSize - logoSz) / 2;
  const ly = qrY + (layout.qrSize - logoSz) / 2;

  return (
    <svg
      width={renderWidth}
      height={renderHeight}
      viewBox={`0 0 ${previewWidth} ${previewHeight}`}
      style={{ display: "block", background: "white", margin: "0 auto" }}
    >
      <rect
        x={0.5}
        y={0.5}
        width={previewWidth - 1}
        height={previewHeight - 1}
        fill="white"
        stroke={config.showBorder ? "#475569" : "#cbd5e1"}
        strokeWidth={1}
        rx={6}
      />
      <rect
        x={qrX}
        y={qrY}
        width={layout.qrSize}
        height={layout.qrSize}
        fill="#94a3b8"
        rx={config.qrStyle.frameShape === "circle" ? layout.qrSize / 2 : 3}
      />
      {layout.qrSize >= 14 ? buildQrBodyPreview(config, qrX, qrY, layout.qrSize) : null}
      {config.includeLogo && layout.qrSize >= 10
        ? renderLogoPreview(config.logoBackgroundStyle, lx, ly, logoSz)
        : null}
      {buildTextStubs(config, true, layout.textX, layout.textY, layout.textW, layout.textH, scale)}
    </svg>
  );
});

const PageLayoutPreviewSvg = memo(function PageLayoutPreviewSvg({
  baseWidth,
  baseHeight,
  renderWidth,
  renderHeight,
  marginPx,
  previewCells,
  labelDefs,
}: {
  baseWidth: number;
  baseHeight: number;
  renderWidth: number;
  renderHeight: number;
  marginPx: number;
  previewCells: Array<{ x: number; y: number; active: boolean; idx: number }>;
  labelDefs: { active: React.ReactNode; inactive: React.ReactNode } | null;
}) {
  if (!labelDefs) return null;

  return (
    <div
      className="overflow-hidden rounded-sm border bg-white shadow-md"
      style={{ width: renderWidth + 2 }}
    >
      <svg
        width={renderWidth}
        height={renderHeight}
        viewBox={`0 0 ${baseWidth} ${baseHeight}`}
        style={{ display: "block", background: "white" }}
      >
        <rect x={0} y={0} width={baseWidth} height={baseHeight} fill="white" />
        <rect
          x={marginPx}
          y={marginPx}
          width={baseWidth - marginPx * 2}
          height={baseHeight - marginPx * 2}
          fill="none"
          stroke="#cbd5e1"
          strokeWidth={0.5}
          strokeDasharray="2 2"
        />
        <defs>
          <g id="qr-page-label-active">{labelDefs.active}</g>
          <g id="qr-page-label-inactive">{labelDefs.inactive}</g>
        </defs>

        {previewCells.map(({ x, y, active, idx }) => (
          <g key={idx} opacity={active ? 1 : 0.42}>
            <use href={active ? "#qr-page-label-active" : "#qr-page-label-inactive"} x={x} y={y} />
          </g>
        ))}
      </svg>
    </div>
  );
});

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

type PreviewZoom = "fit" | number;
const PRESET_PREVIEW_ZOOMS = [0.5, 0.75, 1, 1.25, 1.5] as const;
const SINGLE_DIALOG_PREVIEW_ZOOMS: readonly PreviewZoom[] = [0.5, 0.75, "fit", 1.25, 1.5];
const MIN_PREVIEW_ZOOM = 0.25;
const MAX_PREVIEW_ZOOM = 2;

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function LabelDesigner({ selectedIds, canExport }: LabelDesignerProps) {
  const [pdfConfig, setPdfConfig] = useState<LabelConfig>(DEFAULT_LABEL_CONFIG);
  const [zplConfig, setZplConfig] = useState<LabelConfig>({
    ...DEFAULT_LABEL_CONFIG,
    includeLogo: false,
    showBorder: false,
    textPosition: "right",
    dimension: ZPL_DIMENSIONS["50x30"],
  });
  const [format, setFormat] = useState<"pdf" | "zpl">("pdf");
  const [zplSize, setZplSize] = useState<"50x30" | "70x40">("50x30");
  const [isExporting, setIsExporting] = useState(false);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [layoutPreviewOpen, setLayoutPreviewOpen] = useState(false);
  const [singlePreviewOpen, setSinglePreviewOpen] = useState(false);
  const [pagePreviewZoom, setPagePreviewZoom] = useState<PreviewZoom>("fit");
  const [singlePreviewZoom, setSinglePreviewZoom] = useState<PreviewZoom>("fit");
  const [pageZoomInput, setPageZoomInput] = useState("100");
  const [isEditingPageZoomInput, setIsEditingPageZoomInput] = useState(false);
  const [pagePreviewViewportSize, setPagePreviewViewportSize] = useState({ width: 0, height: 0 });
  const [singlePreviewViewportSize, setSinglePreviewViewportSize] = useState({
    width: 0,
    height: 0,
  });
  const pagePreviewViewportRef = useRef<HTMLDivElement | null>(null);
  const singlePreviewViewportRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    return () => {
      if (previewUrl) URL.revokeObjectURL(previewUrl);
    };
  }, [previewUrl]);

  useEffect(() => {
    const refs = [
      {
        element: pagePreviewViewportRef.current,
        setSize: setPagePreviewViewportSize,
      },
      {
        element: singlePreviewViewportRef.current,
        setSize: setSinglePreviewViewportSize,
      },
    ].filter(
      (item): item is { element: HTMLDivElement; setSize: typeof setPagePreviewViewportSize } =>
        Boolean(item.element)
    );

    if (refs.length === 0) return;

    const observers = refs.map(({ element, setSize }) => {
      const observer = new ResizeObserver((entries) => {
        const entry = entries[0];
        if (!entry) return;
        setSize({
          width: entry.contentRect.width,
          height: entry.contentRect.height,
        });
      });
      observer.observe(element);
      return observer;
    });

    return () => observers.forEach((observer) => observer.disconnect());
  }, []);

  // ── helpers ───────────────────────────────────────────────────────────────

  function updateDraftConfig(updater: (prev: LabelConfig) => LabelConfig) {
    if (format === "pdf") {
      setPdfConfig(updater);
      return;
    }
    setZplConfig(updater);
  }

  function set<K extends keyof LabelConfig>(key: K, value: LabelConfig[K]) {
    updateDraftConfig((prev) => ({ ...prev, [key]: value }));
  }

  function setTextLayer(
    layer: "primaryText" | "secondaryText" | "tertiaryText",
    key: keyof TextLayerConfig,
    value: boolean | number | TextAlign
  ) {
    updateDraftConfig((prev) => ({
      ...prev,
      [layer]: { ...prev[layer], [key]: value },
    }));
  }

  function setQrStyle<K extends keyof LabelConfig["qrStyle"]>(
    key: K,
    value: LabelConfig["qrStyle"][K]
  ) {
    updateDraftConfig((prev) => ({
      ...prev,
      qrStyle: { ...prev.qrStyle, [key]: value },
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
    if (format === "pdf") {
      setPreviewOpen(true);
    }
    setIsExporting(true);
    try {
      const labelConfig =
        format === "zpl" ? { ...zplConfig, dimension: ZPL_DIMENSIONS[zplSize] } : pdfConfig;
      const body =
        format === "pdf"
          ? { qrCodeIds: selectedIds, format: "pdf", labelConfig }
          : { qrCodeIds: selectedIds, format: "zpl", labelConfig, zplSize };

      const res = await fetch("/api/qr/export", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(body),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: "Export failed." }));
        if (format === "pdf") setPreviewOpen(false);
        toast.error((err as { error?: string }).error ?? "Export failed.");
        return;
      }

      const blob = await res.blob();
      const url = URL.createObjectURL(blob);

      if (format === "pdf") {
        if (previewUrl) URL.revokeObjectURL(previewUrl);
        setPreviewUrl(url);
        setPreviewOpen(true);
        toast.success(
          `Prepared preview for ${selectedIds.length} label${selectedIds.length === 1 ? "" : "s"}.`
        );
        return;
      }

      const a = document.createElement("a");
      a.href = url;
      a.download = "qr-labels.zpl";
      a.click();
      URL.revokeObjectURL(url);
      toast.success(`Exported ${selectedIds.length} label${selectedIds.length === 1 ? "" : "s"}.`);
    } catch {
      if (format === "pdf") setPreviewOpen(false);
      toast.error("Export failed. Please try again.");
    } finally {
      setIsExporting(false);
    }
  }

  // ── SVG preview geometry ──────────────────────────────────────────────────

  const PDF_BASE_PREVIEW_W = 520;
  const pdfScale = PDF_BASE_PREVIEW_W / A4_W_MM;
  const PDF_BASE_PREVIEW_H = Math.round(A4_H_MM * pdfScale);
  const marginPx = GRID_MARGIN_MM * pdfScale;

  const activeConfig = useMemo(
    () =>
      format === "zpl"
        ? {
            ...zplConfig,
            dimension: ZPL_DIMENSIONS[zplSize],
            textPosition: "right" as const,
          }
        : pdfConfig,
    [pdfConfig, zplConfig, format, zplSize]
  );
  const deferredPreviewConfig = useDeferredValue(activeConfig);

  const effectiveDimension = useMemo(
    () => getEffectiveLabelDimension(activeConfig),
    [activeConfig]
  );
  const grid = useMemo(() => computeGrid(effectiveDimension), [effectiveDimension]);
  const totalPages = selectedIds.length > 0 ? Math.ceil(selectedIds.length / grid.perPage) : 1;

  const cellW = effectiveDimension.width * pdfScale;
  const cellH = effectiveDimension.height * pdfScale;
  const CELL_PAD = Math.max(1, cellH * 0.07);

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

  const THERMAL_BASE_PREVIEW_W = 520;
  const thermalBasePreviewH = Math.max(
    180,
    Math.round((effectiveDimension.height / effectiveDimension.width) * THERMAL_BASE_PREVIEW_W)
  );
  const thermalCellPad = Math.max(6, thermalBasePreviewH * 0.08);
  const SINGLE_LABEL_PREVIEW_W = 420;
  const singleLabelPreviewH = Math.max(
    180,
    Math.round((effectiveDimension.height / effectiveDimension.width) * SINGLE_LABEL_PREVIEW_W)
  );
  const singleLabelScale = SINGLE_LABEL_PREVIEW_W / effectiveDimension.width;
  const singleLabelPad = Math.max(8, singleLabelPreviewH * 0.08);
  const pagePreviewBaseWidth = format === "pdf" ? PDF_BASE_PREVIEW_W : THERMAL_BASE_PREVIEW_W;
  const pagePreviewBaseHeight = format === "pdf" ? PDF_BASE_PREVIEW_H : thermalBasePreviewH;
  const pageFitScale =
    pagePreviewViewportSize.width > 0 && pagePreviewViewportSize.height > 0
      ? Math.min(
          (pagePreviewViewportSize.width - 40) / pagePreviewBaseWidth,
          (pagePreviewViewportSize.height - 40) / pagePreviewBaseHeight
        )
      : 1;
  const appliedPagePreviewScale =
    pagePreviewZoom === "fit" ? Math.max(0.25, pageFitScale) : pagePreviewZoom;
  const pagePreviewRenderWidth = Math.max(
    140,
    Math.round(pagePreviewBaseWidth * appliedPagePreviewScale)
  );
  const pagePreviewRenderHeight = Math.max(
    140,
    Math.round(pagePreviewBaseHeight * appliedPagePreviewScale)
  );
  const singleFitScale =
    singlePreviewViewportSize.width > 0 && singlePreviewViewportSize.height > 0
      ? Math.min(
          (singlePreviewViewportSize.width - 24) / SINGLE_LABEL_PREVIEW_W,
          (singlePreviewViewportSize.height - 24) / singleLabelPreviewH
        )
      : 1;
  const appliedSinglePreviewScale =
    singlePreviewZoom === "fit" ? Math.max(0.25, singleFitScale) : singlePreviewZoom;
  const singlePreviewRenderWidth = Math.max(
    160,
    Math.round(SINGLE_LABEL_PREVIEW_W * appliedSinglePreviewScale)
  );
  const singlePreviewRenderHeight = Math.max(
    120,
    Math.round(singleLabelPreviewH * appliedSinglePreviewScale)
  );
  const compactSingleRenderWidth = 220;
  const compactSingleRenderHeight = Math.max(
    96,
    Math.round((singleLabelPreviewH / SINGLE_LABEL_PREVIEW_W) * compactSingleRenderWidth)
  );
  const layoutDialogWidth =
    format === "pdf"
      ? Math.min(920, Math.max(700, pagePreviewRenderWidth + 132))
      : Math.min(1200, Math.max(860, pagePreviewRenderWidth + 140));
  const currentPageZoomPercent = Math.round(appliedPagePreviewScale * 100);
  const currentSingleZoomPercent = Math.round(appliedSinglePreviewScale * 100);
  const shouldRenderPagePreview = layoutPreviewOpen && format === "pdf";
  const deferredPageLabelDefs = useMemo(
    () =>
      shouldRenderPagePreview
        ? {
            active: renderPageLabelPreview(
              deferredPreviewConfig,
              true,
              cellW,
              cellH,
              CELL_PAD,
              pdfScale
            ),
            inactive: renderPageLabelPreview(
              deferredPreviewConfig,
              false,
              cellW,
              cellH,
              CELL_PAD,
              pdfScale
            ),
          }
        : null,
    [shouldRenderPagePreview, deferredPreviewConfig, cellW, cellH, CELL_PAD, pdfScale]
  );

  useEffect(() => {
    if (!isEditingPageZoomInput) {
      setPageZoomInput(String(currentPageZoomPercent));
    }
  }, [currentPageZoomPercent, isEditingPageZoomInput]);

  function clampPreviewZoom(value: number) {
    if (!Number.isFinite(value)) return MIN_PREVIEW_ZOOM;
    return Math.max(MIN_PREVIEW_ZOOM, Math.min(MAX_PREVIEW_ZOOM, value));
  }

  function setExplicitPreviewZoom(valuePercent: number, setZoom: (zoom: PreviewZoom) => void) {
    setZoom(clampPreviewZoom(valuePercent / 100));
  }

  function commitPageZoomInput() {
    const parsed = Number(pageZoomInput);
    if (Number.isFinite(parsed) && pageZoomInput.trim() !== "") {
      setExplicitPreviewZoom(parsed, setPagePreviewZoom);
    } else {
      setPageZoomInput(String(currentPageZoomPercent));
    }
    setIsEditingPageZoomInput(false);
  }

  function setNextPreviewZoom(
    direction: "in" | "out",
    zoom: PreviewZoom,
    appliedScale: number,
    setZoom: (zoom: PreviewZoom) => void
  ) {
    const currentNumeric = zoom === "fit" ? appliedScale : zoom;
    const delta = direction === "in" ? 0.05 : -0.05;
    setZoom(Number(clampPreviewZoom(currentNumeric + delta).toFixed(2)));
  }

  // ── render ────────────────────────────────────────────────────────────────

  return (
    <>
      <div className="h-full overflow-hidden">
        <div className="grid h-full gap-6 xl:grid-cols-[minmax(0,1fr)_280px]">
          <div className="min-h-0 overflow-y-auto pr-2">
            <div className="space-y-4">
              <div className="rounded-xl border bg-card p-4">
                <Section title="Output type">
                  <div className="flex gap-1">
                    {(["pdf", "zpl"] as const).map((f) => (
                      <Button
                        key={f}
                        size="sm"
                        variant={format === f ? "default" : "outline"}
                        onClick={() => setFormat(f)}
                        className="flex-1 h-9 uppercase text-xs tracking-wide"
                      >
                        {f}
                      </Button>
                    ))}
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {format === "pdf"
                      ? "PDF labels are fully custom and auto-packed onto A4. This editor keeps its own settings."
                      : "ZPL uses fixed thermal label sizes for Zebra printers and keeps its own independent settings."}
                  </p>
                </Section>
              </div>

              <div className="rounded-xl border bg-card p-4">
                <Section title={format === "pdf" ? "Label size" : "Thermal label size"}>
                  {format === "pdf" ? (
                    <>
                      <div className="grid gap-3 sm:grid-cols-2">
                        <div className="space-y-1">
                          <Label className="text-xs text-muted-foreground">Width (mm)</Label>
                          <Input
                            type="number"
                            min={10}
                            max={210}
                            value={pdfConfig.dimension.width}
                            onChange={(e) =>
                              set("dimension", {
                                ...pdfConfig.dimension,
                                width: clampDim(Number(e.target.value), 10, 210),
                              })
                            }
                            className="h-9"
                          />
                        </div>
                        <div className="space-y-1">
                          <Label className="text-xs text-muted-foreground">Height (mm)</Label>
                          <Input
                            type="number"
                            min={10}
                            max={297}
                            value={pdfConfig.dimension.height}
                            onChange={(e) =>
                              set("dimension", {
                                ...pdfConfig.dimension,
                                height: clampDim(Number(e.target.value), 10, 297),
                              })
                            }
                            className="h-9"
                          />
                        </div>
                      </div>
                      <div className="flex flex-wrap gap-x-6 gap-y-2 text-xs text-muted-foreground">
                        <p>
                          Effective label:{" "}
                          <span className="font-medium text-foreground">
                            {effectiveDimension.width} × {effectiveDimension.height} mm
                          </span>
                        </p>
                        <p>
                          A4 fit:{" "}
                          <span className="font-medium text-foreground">{grid.perPage}</span>{" "}
                          labels/page
                        </p>
                      </div>
                    </>
                  ) : (
                    <>
                      <div className="grid grid-cols-2 gap-2">
                        {(["50x30", "70x40"] as const).map((s) => (
                          <Button
                            key={s}
                            size="sm"
                            variant={zplSize === s ? "default" : "outline"}
                            onClick={() => {
                              setZplSize(s);
                              setZplConfig((prev) => ({ ...prev, dimension: ZPL_DIMENSIONS[s] }));
                            }}
                            className="h-9 text-xs"
                          >
                            {s} mm
                          </Button>
                        ))}
                      </div>
                      <p className="text-xs text-muted-foreground">
                        Current thermal preset:{" "}
                        <span className="font-medium text-foreground">
                          {ZPL_DIMENSIONS[zplSize].width} × {ZPL_DIMENSIONS[zplSize].height} mm
                        </span>
                      </p>
                    </>
                  )}
                </Section>
              </div>

              <div className="rounded-xl border bg-card p-4">
                <Section title="QR content">
                  <div className="space-y-4">
                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <Label className="text-sm">
                          QR size{" "}
                          <span className="font-mono text-muted-foreground">
                            {Math.round(activeConfig.qrHeightRatio * 100)}%
                          </span>
                        </Label>
                      </div>
                      <Slider
                        min={40}
                        max={95}
                        step={5}
                        value={[Math.round(activeConfig.qrHeightRatio * 100)]}
                        onValueChange={([v]) => set("qrHeightRatio", v / 100)}
                      />
                    </div>

                    <div className="flex items-center gap-2">
                      <Checkbox
                        id={`token-preview-${format}`}
                        checked={activeConfig.includeTokenPreview}
                        onCheckedChange={(v) => set("includeTokenPreview", !!v)}
                      />
                      <Label htmlFor={`token-preview-${format}`} className="cursor-pointer text-sm">
                        Token preview
                      </Label>
                    </div>

                    {format === "pdf" ? (
                      <>
                        <div className="grid gap-4 lg:grid-cols-2">
                          <div className="space-y-2">
                            <Label className="text-xs text-muted-foreground">QR frame shape</Label>
                            <div className="grid grid-cols-2 gap-1">
                              {QR_FRAME_SHAPE_OPTIONS.map((shape) => (
                                <Button
                                  key={shape}
                                  size="sm"
                                  variant={
                                    pdfConfig.qrStyle.frameShape === shape ? "default" : "outline"
                                  }
                                  onClick={() => setQrStyle("frameShape", shape)}
                                  className="h-8 text-xs capitalize"
                                >
                                  {shape}
                                </Button>
                              ))}
                            </div>
                          </div>

                          <div className="space-y-2">
                            <Label className="text-xs text-muted-foreground">QR body style</Label>
                            <div className="grid grid-cols-2 gap-1">
                              {QR_DOT_STYLE_OPTIONS.map((style) => (
                                <Button
                                  key={style}
                                  size="sm"
                                  variant={
                                    pdfConfig.qrStyle.dotStyle === style ? "default" : "outline"
                                  }
                                  onClick={() => setQrStyle("dotStyle", style)}
                                  className="h-8 text-xs capitalize"
                                >
                                  {style}
                                </Button>
                              ))}
                            </div>
                          </div>
                        </div>

                        <div className="grid gap-4 lg:grid-cols-2">
                          <div className="space-y-2">
                            <Label className="text-xs text-muted-foreground">
                              Finder outer style
                            </Label>
                            <div className="grid grid-cols-2 gap-1">
                              {QR_CORNER_SQUARE_OPTIONS.map((style) => (
                                <Button
                                  key={style}
                                  size="sm"
                                  variant={
                                    pdfConfig.qrStyle.cornerSquareStyle === style
                                      ? "default"
                                      : "outline"
                                  }
                                  onClick={() => setQrStyle("cornerSquareStyle", style)}
                                  className="h-8 text-xs capitalize"
                                >
                                  {style}
                                </Button>
                              ))}
                            </div>
                          </div>

                          <div className="space-y-2">
                            <Label className="text-xs text-muted-foreground">
                              Finder inner style
                            </Label>
                            <div className="grid grid-cols-2 gap-1">
                              {QR_CORNER_DOT_OPTIONS.map((style) => (
                                <Button
                                  key={style}
                                  size="sm"
                                  variant={
                                    pdfConfig.qrStyle.cornerDotStyle === style
                                      ? "default"
                                      : "outline"
                                  }
                                  onClick={() => setQrStyle("cornerDotStyle", style)}
                                  className="h-8 text-xs capitalize"
                                >
                                  {style}
                                </Button>
                              ))}
                            </div>
                          </div>
                        </div>
                      </>
                    ) : (
                      <p className="text-xs text-muted-foreground">
                        These QR controls are stored separately for ZPL, so changing thermal labels
                        will not alter your PDF label design.
                      </p>
                    )}
                  </div>
                </Section>
              </div>

              {format === "pdf" ? (
                <>
                  <div className="rounded-xl border bg-card p-4">
                    <Section title="PDF layout">
                      <div className="grid gap-4 lg:grid-cols-2">
                        <div className="space-y-3">
                          <div className="flex items-center justify-between">
                            <Label htmlFor="toggle-logo" className="text-sm cursor-pointer">
                              Logo in QR centre
                            </Label>
                            <Switch
                              id="toggle-logo"
                              checked={pdfConfig.includeLogo}
                              onCheckedChange={(v) => set("includeLogo", v)}
                            />
                          </div>
                          {pdfConfig.includeLogo && (
                            <div className="space-y-2">
                              <Label className="text-xs text-muted-foreground">
                                Logo background
                              </Label>
                              <div className="grid grid-cols-3 gap-1">
                                {LOGO_BACKGROUND_OPTIONS.map((option) => (
                                  <Button
                                    key={option}
                                    size="sm"
                                    variant={
                                      pdfConfig.logoBackgroundStyle === option
                                        ? "default"
                                        : "outline"
                                    }
                                    onClick={() => set("logoBackgroundStyle", option)}
                                    className="h-8 text-xs capitalize"
                                  >
                                    {option}
                                  </Button>
                                ))}
                              </div>
                            </div>
                          )}
                          <div className="flex items-center justify-between">
                            <Label htmlFor="toggle-border" className="text-sm cursor-pointer">
                              Cell border
                            </Label>
                            <Switch
                              id="toggle-border"
                              checked={pdfConfig.showBorder}
                              onCheckedChange={(v) => set("showBorder", v)}
                            />
                          </div>
                        </div>

                        <div className="space-y-2">
                          <Label className="text-xs text-muted-foreground">Text position</Label>
                          <div className="grid grid-cols-2 gap-1">
                            {TEXT_POSITION_OPTIONS.map((position) => (
                              <Button
                                key={position}
                                size="sm"
                                variant={
                                  pdfConfig.textPosition === position ? "default" : "outline"
                                }
                                onClick={() => set("textPosition", position)}
                                className="h-8 text-xs capitalize"
                              >
                                {position}
                              </Button>
                            ))}
                          </div>
                        </div>
                      </div>
                    </Section>
                  </div>

                  <div className="rounded-xl border bg-card p-4">
                    <Section title="Text layers">
                      <div className="space-y-3">
                        {(
                          [
                            ["primaryText", "Primary"],
                            ["secondaryText", "Secondary"],
                            ["tertiaryText", "Tertiary"],
                          ] as const
                        ).map(([layer, name]) => {
                          const cfg = pdfConfig[layer];
                          return (
                            <div key={layer} className="rounded-lg border p-3">
                              <div className="flex flex-wrap items-center gap-2">
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
                                    setTextLayer(
                                      layer,
                                      "size",
                                      Math.max(4, Math.min(24, Number(e.target.value)))
                                    )
                                  }
                                  className="h-8 w-16 text-xs"
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
                                <div className="ml-auto flex gap-1">
                                  {TEXT_ALIGN_OPTIONS.map((align) => {
                                    const Icon = TEXT_ALIGN_ICONS[align];
                                    return (
                                      <Button
                                        key={`${layer}-${align}`}
                                        size="sm"
                                        variant={cfg.align === align ? "default" : "outline"}
                                        onClick={() => setTextLayer(layer, "align", align)}
                                        className="h-8 w-8 p-0"
                                        disabled={!cfg.show}
                                        aria-label={`${name} text align ${align}`}
                                        title={`${name} text align ${align}`}
                                      >
                                        <Icon className="h-3.5 w-3.5" />
                                      </Button>
                                    );
                                  })}
                                </div>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </Section>
                  </div>
                </>
              ) : (
                <div className="rounded-xl border bg-card p-4">
                  <Section title="Thermal layout">
                    <p className="text-sm text-muted-foreground">
                      ZPL uses its own independent settings and keeps a simpler fixed printer
                      layout. PDF-only options like free text positioning, logo overlays, and text
                      layers stay in the PDF editor only.
                    </p>
                  </Section>
                </div>
              )}

              <div className="rounded-xl border bg-card p-4">
                <Section title="Export">
                  <p className="text-sm text-muted-foreground">
                    {format === "pdf"
                      ? `Current PDF design fits ${grid.perPage} labels per A4 page.`
                      : `Current thermal design will export Zebra ZPL sized for ${zplSize} mm labels.`}
                  </p>
                  <Button
                    onClick={handleExport}
                    disabled={isExporting || !canExport || selectedIds.length === 0}
                    className="w-full gap-2"
                  >
                    {format === "pdf" ? (
                      <Eye className="h-4 w-4" />
                    ) : (
                      <Download className="h-4 w-4" />
                    )}
                    {isExporting
                      ? format === "pdf"
                        ? "Generating preview…"
                        : "Exporting…"
                      : selectedIds.length > 0
                        ? format === "pdf"
                          ? `Preview ${selectedIds.length} label${selectedIds.length !== 1 ? "s" : ""}`
                          : `Export ${selectedIds.length} label${selectedIds.length !== 1 ? "s" : ""}`
                        : "Select codes above to export"}
                  </Button>
                </Section>
              </div>
            </div>
          </div>

          <div className="space-y-4 xl:sticky xl:top-0 xl:self-start">
            <div className="rounded-xl border bg-card p-4">
              <Section title="Preview">
                <div className="space-y-4">
                  <div className="rounded-2xl border bg-muted/25 p-3">
                    <SingleLabelPreviewSvg
                      config={deferredPreviewConfig}
                      previewWidth={SINGLE_LABEL_PREVIEW_W}
                      previewHeight={singleLabelPreviewH}
                      renderWidth={compactSingleRenderWidth}
                      renderHeight={compactSingleRenderHeight}
                      pad={singleLabelPad}
                      scale={singleLabelScale}
                    />
                  </div>
                  <div className="space-y-2 text-sm text-muted-foreground">
                    <p>
                      Label size:{" "}
                      <span className="font-medium text-foreground">
                        {effectiveDimension.width} × {effectiveDimension.height} mm
                      </span>
                    </p>
                    {format === "pdf" ? (
                      <p>
                        A4 packing:{" "}
                        <span className="font-medium text-foreground">{grid.perPage}</span>/page
                      </p>
                    ) : (
                      <p>
                        Thermal preset:{" "}
                        <span className="font-medium text-foreground">{zplSize} mm</span>
                      </p>
                    )}
                  </div>
                  <div className="grid gap-2">
                    <Button variant="outline" onClick={() => setSinglePreviewOpen(true)}>
                      Open label preview
                    </Button>
                    {format === "pdf" && (
                      <Button variant="outline" onClick={() => setLayoutPreviewOpen(true)}>
                        Open page layout
                      </Button>
                    )}
                  </div>
                </div>
              </Section>
            </div>
          </div>
        </div>
      </div>

      <QrPdfPreviewDialog
        open={previewOpen}
        onOpenChange={setPreviewOpen}
        blobUrl={previewUrl}
        generating={isExporting && format === "pdf"}
        fileName="qr-labels.pdf"
        title={`QR labels preview (${selectedIds.length})`}
      />

      <Dialog open={singlePreviewOpen} onOpenChange={setSinglePreviewOpen}>
        <DialogContent className="flex h-[min(82vh,760px)] max-w-[min(92vw,900px)] flex-col overflow-hidden p-0">
          <DialogHeader className="border-b px-6 pt-5 pb-3">
            <div className="flex flex-wrap items-end justify-between gap-3 pr-10">
              <DialogTitle>Single label preview</DialogTitle>
              <div className="text-sm text-muted-foreground">
                {effectiveDimension.width} × {effectiveDimension.height} mm
              </div>
            </div>
          </DialogHeader>

          <div className="flex min-h-0 flex-1 flex-col px-6 pb-6 pt-4">
            <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-1 rounded-lg border bg-background p-1">
                <Button
                  type="button"
                  size="icon"
                  variant="ghost"
                  className="h-8 w-8"
                  onClick={() =>
                    setNextPreviewZoom(
                      "out",
                      singlePreviewZoom,
                      appliedSinglePreviewScale,
                      setSinglePreviewZoom
                    )
                  }
                >
                  <Minus className="h-4 w-4" />
                </Button>
                {SINGLE_DIALOG_PREVIEW_ZOOMS.map((option) => (
                  <Button
                    key={`single-dialog-${String(option)}`}
                    type="button"
                    size="sm"
                    variant={singlePreviewZoom === option ? "default" : "ghost"}
                    className="h-8 px-2 text-[11px]"
                    onClick={() => setSinglePreviewZoom(option)}
                  >
                    {option === "fit" ? "Fit" : `${Math.round(option * 100)}%`}
                  </Button>
                ))}
                <Button
                  type="button"
                  size="icon"
                  variant="ghost"
                  className="h-8 w-8"
                  onClick={() =>
                    setNextPreviewZoom(
                      "in",
                      singlePreviewZoom,
                      appliedSinglePreviewScale,
                      setSinglePreviewZoom
                    )
                  }
                >
                  <Plus className="h-4 w-4" />
                </Button>
              </div>

              <div className="flex min-w-[220px] items-center gap-2">
                <span className="text-xs text-muted-foreground">Zoom</span>
                <Slider
                  min={25}
                  max={200}
                  step={1}
                  value={[currentSingleZoomPercent]}
                  onValueChange={([value]) => setExplicitPreviewZoom(value, setSinglePreviewZoom)}
                />
              </div>
            </div>

            <div
              ref={singlePreviewViewportRef}
              className="flex min-h-0 flex-1 items-start justify-center overflow-auto rounded-xl bg-muted/25 p-4"
            >
              <div className="rounded-2xl border bg-card p-4 shadow-sm">
                <SingleLabelPreviewSvg
                  config={deferredPreviewConfig}
                  previewWidth={SINGLE_LABEL_PREVIEW_W}
                  previewHeight={singleLabelPreviewH}
                  renderWidth={singlePreviewRenderWidth}
                  renderHeight={singlePreviewRenderHeight}
                  pad={singleLabelPad}
                  scale={singleLabelScale}
                />
              </div>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={layoutPreviewOpen} onOpenChange={setLayoutPreviewOpen}>
        <DialogContent
          className="flex h-[min(88vh,980px)] max-w-none flex-col overflow-hidden p-0"
          style={{ width: `min(92vw, ${layoutDialogWidth}px)` }}
        >
          <DialogHeader className="border-b px-6 pt-5 pb-3">
            <div className="flex flex-wrap items-end justify-between gap-3 pr-10">
              <DialogTitle>
                {format === "pdf" ? "Page layout preview" : "Printer sheet preview"}
              </DialogTitle>
              <div className="text-sm text-muted-foreground">
                {format === "pdf" ? (
                  <>
                    {grid.cols} × {grid.rows} ={" "}
                    <span className="font-medium text-foreground">{grid.perPage}</span>/page
                    {selectedIds.length > 0 && (
                      <>
                        {" "}
                        · <span className="font-medium text-foreground">{totalPages}</span> page
                        {totalPages !== 1 ? "s" : ""} for {selectedIds.length} selected
                      </>
                    )}
                  </>
                ) : (
                  <>
                    Fixed {ZPL_DIMENSIONS[zplSize].width} × {ZPL_DIMENSIONS[zplSize].height} mm
                    Zebra label
                  </>
                )}
              </div>
            </div>
          </DialogHeader>

          <div className="relative flex min-h-0 flex-1 flex-col px-4 pb-4 pt-4">
            <div
              ref={pagePreviewViewportRef}
              className="flex min-h-0 flex-1 items-start justify-center overflow-auto rounded-xl bg-white p-2 ring-1 ring-border"
            >
              {format === "pdf" ? (
                <PageLayoutPreviewSvg
                  baseWidth={PDF_BASE_PREVIEW_W}
                  baseHeight={PDF_BASE_PREVIEW_H}
                  renderWidth={pagePreviewRenderWidth}
                  renderHeight={pagePreviewRenderHeight}
                  marginPx={marginPx}
                  previewCells={shouldRenderPagePreview ? previewCells : []}
                  labelDefs={deferredPageLabelDefs}
                />
              ) : (
                <div
                  className="overflow-hidden rounded-sm border bg-white shadow-md"
                  style={{ width: pagePreviewRenderWidth + 2 }}
                >
                  <svg
                    width={pagePreviewRenderWidth}
                    height={pagePreviewRenderHeight}
                    viewBox={`0 0 ${THERMAL_BASE_PREVIEW_W} ${thermalBasePreviewH}`}
                    style={{ display: "block", background: "white" }}
                  >
                    <rect
                      x={0}
                      y={0}
                      width={THERMAL_BASE_PREVIEW_W}
                      height={thermalBasePreviewH}
                      fill="#e2e8f0"
                    />
                    <rect
                      x={0.5}
                      y={0.5}
                      width={THERMAL_BASE_PREVIEW_W - 1}
                      height={thermalBasePreviewH - 1}
                      fill="white"
                      stroke="#64748b"
                      strokeWidth={1}
                      rx={3}
                    />
                    {(() => {
                      const thermalScale = THERMAL_BASE_PREVIEW_W / effectiveDimension.width;
                      const layout = getPreviewLayout(
                        activeConfig,
                        THERMAL_BASE_PREVIEW_W,
                        thermalBasePreviewH,
                        thermalCellPad,
                        thermalScale
                      );
                      const qrX = layout.qrX;
                      const qrY = layout.qrY;
                      return (
                        <>
                          <rect
                            x={qrX}
                            y={qrY}
                            width={layout.qrSize}
                            height={layout.qrSize}
                            fill="#94a3b8"
                            rx={
                              activeConfig.qrStyle.frameShape === "circle" ? layout.qrSize / 2 : 2
                            }
                          />
                          {layout.qrSize >= 14
                            ? buildQrBodyPreview(activeConfig, qrX, qrY, layout.qrSize)
                            : null}
                          {buildTextStubs(
                            activeConfig,
                            true,
                            layout.textX,
                            layout.textY,
                            layout.textW,
                            layout.textH,
                            thermalScale
                          )}
                        </>
                      );
                    })()}
                  </svg>
                </div>
              )}
            </div>

            <div className="pointer-events-none absolute bottom-7 right-7 z-10 flex justify-end">
              <div className="pointer-events-auto flex items-center gap-1 rounded-lg border bg-background/94 px-2 py-1 shadow-sm backdrop-blur-sm">
                <Button
                  type="button"
                  size="icon"
                  variant="ghost"
                  className="h-6 w-6"
                  onClick={() =>
                    setNextPreviewZoom(
                      "out",
                      pagePreviewZoom,
                      appliedPagePreviewScale,
                      setPagePreviewZoom
                    )
                  }
                >
                  <Minus className="h-3 w-3" />
                </Button>

                <Button
                  type="button"
                  size="sm"
                  variant={pagePreviewZoom === "fit" ? "default" : "ghost"}
                  className="h-6 px-2 text-[10px]"
                  onClick={() => setPagePreviewZoom("fit")}
                >
                  Fit
                </Button>

                <div className="flex items-center gap-1 rounded-md border bg-background px-1.5">
                  <Input
                    type="text"
                    inputMode="numeric"
                    pattern="[0-9]*"
                    value={pageZoomInput}
                    onFocus={(e) => {
                      setIsEditingPageZoomInput(true);
                      e.currentTarget.select();
                    }}
                    onChange={(e) => {
                      const nextValue = e.target.value.replace(/[^\d]/g, "");
                      setPageZoomInput(nextValue);
                    }}
                    onBlur={commitPageZoomInput}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        e.preventDefault();
                        commitPageZoomInput();
                      }
                      if (e.key === "Escape") {
                        e.preventDefault();
                        setPageZoomInput(String(currentPageZoomPercent));
                        setIsEditingPageZoomInput(false);
                      }
                    }}
                    className="h-6 w-14 border-0 bg-transparent px-0 text-center text-[8px] shadow-none focus-visible:ring-0"
                  />
                  <span className="text-[8px] text-muted-foreground">%</span>
                </div>

                <div className="w-[112px] px-1">
                  <Slider
                    min={25}
                    max={200}
                    step={1}
                    value={[currentPageZoomPercent]}
                    onValueChange={([value]) => setExplicitPreviewZoom(value, setPagePreviewZoom)}
                  />
                </div>

                <Popover>
                  <PopoverTrigger asChild>
                    <Button type="button" size="icon" variant="ghost" className="h-6 w-6">
                      <ChevronUp className="h-3 w-3" />
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent align="end" side="top" className="w-auto p-2">
                    <div className="flex gap-1">
                      {PRESET_PREVIEW_ZOOMS.map((option) => (
                        <Button
                          key={`page-preset-${option}`}
                          type="button"
                          size="sm"
                          variant={pagePreviewZoom === option ? "default" : "outline"}
                          className="h-7 px-2 text-[10px]"
                          onClick={() => setPagePreviewZoom(option)}
                        >
                          {Math.round(option * 100)}%
                        </Button>
                      ))}
                    </div>
                  </PopoverContent>
                </Popover>

                <Button
                  type="button"
                  size="icon"
                  variant="ghost"
                  className="h-6 w-6"
                  onClick={() =>
                    setNextPreviewZoom(
                      "in",
                      pagePreviewZoom,
                      appliedPagePreviewScale,
                      setPagePreviewZoom
                    )
                  }
                >
                  <Plus className="h-3 w-3" />
                </Button>
              </div>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
