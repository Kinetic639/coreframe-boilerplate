"use client";

import { memo, useDeferredValue, useEffect, useMemo, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { toast } from "react-toastify";
import {
  AlignCenter,
  AlignLeft,
  AlignRight,
  ChevronUp,
  Download,
  Eye,
  GripVertical,
  Minus,
  Plus,
  X,
} from "lucide-react";
import {
  DndContext,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  arrayMove,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { restrictToVerticalAxis } from "@dnd-kit/modifiers";
import { CSS } from "@dnd-kit/utilities";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";
import { Checkbox } from "@/components/ui/checkbox";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  DEFAULT_LABEL_CONFIG,
  computeGrid,
  getAllowedTextPositions,
  getEffectiveLabelDimension,
  createTextLine,
  MAX_TEXT_LINES,
  A4_W_MM,
  A4_H_MM,
  GRID_MARGIN_MM,
} from "@/lib/qr/label-config";
import type {
  EdgeLineStyle,
  LabelConfig,
  LabelOrientation,
  LogoBackgroundStyle,
  QrCornerDotStyle,
  QrCornerSquareStyle,
  QrDotStyle,
  QrFrameShape,
  TextAlign,
  TextCaseTransform,
  TextLineConfig,
  TextVerticalAlign,
} from "@/lib/qr/label-config";
import { QrPdfPreviewDialog } from "@/app/[locale]/dashboard/qr/_components/qr-pdf-preview-dialog";

// ---------------------------------------------------------------------------
// SVG preview helpers
// ---------------------------------------------------------------------------

const TEXT_ALIGN_OPTIONS: readonly TextAlign[] = ["left", "center", "right"];
const ORIENTATION_OPTIONS: readonly LabelOrientation[] = ["landscape", "portrait"];
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
const EDGE_LINE_STYLE_OPTIONS: readonly EdgeLineStyle[] = ["solid", "dotted", "dashed"];
const TEXT_ALIGN_ICONS: Record<TextAlign, typeof AlignLeft> = {
  left: AlignLeft,
  center: AlignCenter,
  right: AlignRight,
};
const TEXT_VERTICAL_ALIGN_OPTIONS: readonly TextVerticalAlign[] = ["start", "center", "end"];
const CASE_TRANSFORM_OPTIONS: readonly TextCaseTransform[] = ["none", "upper", "lower", "title"];
/** Visual hierarchy colors for preview lines, darkest first — mirrors PDF/ZPL rendering. */
const LINE_PREVIEW_COLORS = ["#0f172a", "#475569", "#64748b", "#94a3b8"];
function previewLineColor(index: number) {
  return LINE_PREVIEW_COLORS[Math.min(index, LINE_PREVIEW_COLORS.length - 1)];
}
const ZPL_DIMENSIONS = {
  "50x30": { width: 50, height: 30 },
  "70x40": { width: 70, height: 40 },
} as const;

function orientDimension(
  dimension: { width: number; height: number },
  orientation: LabelOrientation
) {
  if (orientation === "portrait") {
    return { width: dimension.height, height: dimension.width };
  }
  return dimension;
}

function getContentInsetPx(config: LabelConfig, scale: number) {
  const totalPaddingMm = config.innerPaddingMm + (config.showBorder ? config.outerPaddingMm : 0);
  return totalPaddingMm * scale;
}

function getPreviewDashArray(style: EdgeLineStyle) {
  if (style === "dotted") return "1.5 2";
  if (style === "dashed") return "4 2";
  return undefined;
}

function renderWatermarkLogoPreview(x: number, y: number, size: number) {
  return (
    <g opacity={0.1}>
      <path
        d={`M ${x + size / 2} ${y} L ${x} ${y + size} L ${x + size * 0.2} ${y + size} L ${x + size / 2} ${y + size * 0.48} Z`}
        fill="#0f172a"
      />
      <path
        d={`M ${x + size / 2} ${y} L ${x + size} ${y + size} L ${x + size * 0.8} ${y + size} L ${x + size / 2} ${y + size * 0.48} Z`}
        fill="#1e293b"
      />
      <path
        d={`M ${x + size / 2} ${y + size * 0.12} L ${x + size * 0.39} ${y + size * 0.36} L ${x + size / 2} ${y + size * 0.52} L ${x + size * 0.61} ${y + size * 0.36} Z`}
        fill="#475569"
      />
      <path
        d={`M ${x + size * 0.25} ${y + size * 0.62} L ${x + size / 2} ${y + size * 0.92} L ${x + size * 0.75} ${y + size * 0.62}`}
        fill="none"
        stroke="#334155"
        strokeWidth={Math.max(0.8, size * 0.035)}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </g>
  );
}

function renderFooterPreview(
  layout: {
    footerX: number;
    footerY: number;
    footerW: number;
    footerH: number;
    watermarkX: number;
    watermarkY: number;
    watermarkSize: number;
  },
  showWatermark: boolean
) {
  return (
    <g>
      {showWatermark && layout.watermarkSize > 0
        ? renderWatermarkLogoPreview(layout.watermarkX, layout.watermarkY, layout.watermarkSize)
        : null}
      {layout.footerH > 0 ? (
        <text
          x={layout.footerX + layout.footerW / 2}
          y={layout.footerY + layout.footerH * 0.7}
          fontSize={Math.max(3.7, layout.footerH * 0.46)}
          textAnchor="middle"
          fill="#64748b"
        >
          www.ambra-system.com
        </text>
      ) : null}
    </g>
  );
}

function hasVisibleText(config: LabelConfig) {
  return config.textLines.length > 0;
}

function estimatePreviewTextHeight(config: LabelConfig, scale: number) {
  const lineHeights = config.textLines.map((line) => Math.max(0.8, line.size * scale * 0.4));

  const gap = Math.max(0.6, scale * 1.2);
  const gapsCount = Math.max(0, lineHeights.length - 1);

  return lineHeights.reduce((sum, height) => sum + height, 0) + gapsCount * gap;
}

function getPreviewLayout(
  config: LabelConfig,
  cellW: number,
  cellH: number,
  pad: number,
  scale: number,
  showWatermark: boolean
): {
  qrX: number;
  qrY: number;
  qrSize: number;
  textX: number;
  textY: number;
  textW: number;
  textH: number;
  footerX: number;
  footerY: number;
  footerW: number;
  footerH: number;
  watermarkX: number;
  watermarkY: number;
  watermarkSize: number;
} {
  const innerW = Math.max(0, cellW - pad * 2);
  const innerH = Math.max(0, cellH - pad * 2);
  const gap = Math.max(1, Math.min(innerW, innerH) * 0.08);
  const showText = hasVisibleText(config);
  const footerEnabled = showText && config.footer.show;
  const footerH = footerEnabled ? Math.max(5, cellH * 0.055) : 0;
  const watermarkSize =
    footerEnabled && showWatermark ? Math.max(9, Math.min(innerW, innerH) * 0.145) : 0;
  const footerGap = footerEnabled ? Math.max(0.8, scale * 0.7) : 0;

  if (!showText) {
    const qrSize = Math.max(
      0,
      config.orientation === "portrait"
        ? Math.min(innerH, innerW * config.qrHeightRatio)
        : Math.min(innerW, innerH * config.qrHeightRatio)
    );
    const qrX = pad + (innerW - qrSize) / 2;
    const qrY = pad + Math.max(0, (innerH - qrSize) / 2);
    return {
      qrX,
      qrY,
      qrSize,
      textX: pad,
      textY: pad,
      textW: 0,
      textH: 0,
      footerX: 0,
      footerY: 0,
      footerW: 0,
      footerH: 0,
      watermarkX: 0,
      watermarkY: 0,
      watermarkSize: 0,
    };
  }

  if (config.orientation === "portrait") {
    const textContentH = estimatePreviewTextHeight(config, scale);
    const textSectionH =
      textContentH +
      (footerEnabled
        ? footerH + footerGap + (watermarkSize > 0 ? watermarkSize + footerGap : 0)
        : 0);
    const qrBudget = Math.max(0, innerH - textSectionH - gap);
    const qrSize = Math.max(0, Math.min(qrBudget, innerW * config.qrHeightRatio));
    const qrSectionH = qrSize;
    const textY = config.textPosition === "above" ? pad : pad + qrSectionH + gap;
    const qrY = config.textPosition === "above" ? pad + textSectionH + gap : pad;
    return {
      qrX: pad + (innerW - qrSize) / 2,
      qrY,
      qrSize,
      textX: pad,
      textY,
      textW: innerW,
      textH: textContentH,
      footerX: pad,
      footerY:
        textY + textContentH + footerGap + watermarkSize + (watermarkSize > 0 ? footerGap : 0),
      footerW: innerW,
      footerH,
      watermarkX: pad + innerW - watermarkSize,
      watermarkY: textY + textContentH + footerGap,
      watermarkSize,
    };
  }

  const textRegionH = Math.max(
    0,
    innerH -
      (footerEnabled
        ? footerH + footerGap + (watermarkSize > 0 ? watermarkSize + footerGap : 0)
        : 0)
  );
  const qrSize = Math.max(0, Math.min(innerW, innerH * config.qrHeightRatio));
  const textW = Math.max(0, innerW - qrSize - gap);
  const qrX = config.textPosition === "left" ? pad + textW + gap : pad;
  const textX = config.textPosition === "left" ? pad : pad + qrSize + gap;
  const qrY = pad + Math.max(0, (innerH - qrSize) / 2);

  return {
    qrX,
    qrY,
    qrSize,
    textX,
    textY: pad,
    textW,
    textH: textRegionH,
    footerX: textX,
    footerY: pad + textRegionH + footerGap + watermarkSize + (watermarkSize > 0 ? footerGap : 0),
    footerW: textW,
    footerH,
    watermarkX: textX + Math.max(0, textW - watermarkSize),
    watermarkY: pad + textRegionH + footerGap,
    watermarkSize,
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

  const lineHeights = config.textLines.map((line) => Math.max(0.8, line.size * scale * 0.4));
  const gapsCount = Math.max(0, config.textLines.length - 1);
  const gap = Math.max(0.6, scale * 1.2);
  const contentH = lineHeights.reduce((sum, height) => sum + height, 0) + gapsCount * gap;
  const offsetY =
    config.textVerticalAlign === "start"
      ? 0
      : config.textVerticalAlign === "end"
        ? Math.max(0, textH - contentH)
        : Math.max(0, (textH - contentH) / 2);
  let y = textY + offsetY;

  config.textLines.forEach((line, index) => {
    const h = lineHeights[index];
    const wFrac = Math.max(0.3, 0.85 - index * 0.12);
    const lineW = getStubWidth(textW, wFrac);
    elems.push(
      <rect
        key={line.id}
        x={getAlignedX(line.align, textX, textW, lineW)}
        y={y}
        width={lineW}
        height={h}
        fill={active ? previewLineColor(index) : "#cbd5e1"}
        rx={0.4}
      />
    );
    y += h + gap;
  });

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
  const layout = getPreviewLayout(config, cellW, cellH, pad, scale, true);
  const qrX = layout.qrX;
  const qrY = layout.qrY;
  const logoSz = layout.qrSize * 0.28;
  const lx = qrX + (layout.qrSize - logoSz) / 2;
  const ly = qrY + (layout.qrSize - logoSz) / 2;
  const borderInset = Math.max(0, config.outerPaddingMm * scale);

  return (
    <>
      {config.showBorder && (
        <rect
          x={borderInset + 0.5}
          y={borderInset + 0.5}
          width={Math.max(0, cellW - borderInset * 2 - 1)}
          height={Math.max(0, cellH - borderInset * 2 - 1)}
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
      {config.footer.show ? renderFooterPreview(layout, true) : null}
    </>
  );
}

const SingleLabelPreviewSvg = memo(function SingleLabelPreviewSvg({
  config,
  format,
  previewWidth,
  previewHeight,
  renderWidth,
  renderHeight,
  pad,
  scale,
}: {
  config: LabelConfig;
  format: "pdf" | "zpl";
  previewWidth: number;
  previewHeight: number;
  renderWidth: number;
  renderHeight: number;
  pad: number;
  scale: number;
}) {
  const layout = getPreviewLayout(
    config,
    previewWidth,
    previewHeight,
    pad,
    scale,
    format === "pdf"
  );
  const qrX = layout.qrX;
  const qrY = layout.qrY;
  const logoSz = layout.qrSize * 0.28;
  const lx = qrX + (layout.qrSize - logoSz) / 2;
  const ly = qrY + (layout.qrSize - logoSz) / 2;
  const borderInset = Math.max(0, config.outerPaddingMm * scale);

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
        stroke="#cbd5e1"
        strokeWidth={1}
        rx={6}
      />
      {config.showBorder ? (
        <rect
          x={borderInset + 0.5}
          y={borderInset + 0.5}
          width={Math.max(0, previewWidth - borderInset * 2 - 1)}
          height={Math.max(0, previewHeight - borderInset * 2 - 1)}
          fill="none"
          stroke="#475569"
          strokeWidth={1}
          rx={Math.max(3, 6 - borderInset * 0.2)}
        />
      ) : null}
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
      {config.footer.show ? renderFooterPreview(layout, format === "pdf") : null}
    </svg>
  );
});

const PageLayoutPreviewSvg = memo(function PageLayoutPreviewSvg({
  baseWidth,
  baseHeight,
  renderWidth,
  renderHeight,
  marginPx,
  cellW,
  cellH,
  cols,
  rows,
  edgeGuides,
  previewCells,
  labelDefs,
}: {
  baseWidth: number;
  baseHeight: number;
  renderWidth: number;
  renderHeight: number;
  marginPx: number;
  cellW: number;
  cellH: number;
  cols: number;
  rows: number;
  edgeGuides: LabelConfig["edgeGuides"];
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
        {edgeGuides.show ? (
          <>
            {Array.from({ length: cols + 1 }, (_, index) => {
              const x = marginPx + index * cellW;
              return (
                <line
                  key={`guide-v-${index}`}
                  x1={x}
                  y1={marginPx}
                  x2={x}
                  y2={marginPx + rows * cellH}
                  stroke={edgeGuides.color}
                  strokeOpacity={edgeGuides.opacity}
                  strokeWidth={edgeGuides.thickness}
                  strokeDasharray={getPreviewDashArray(edgeGuides.style)}
                />
              );
            })}
            {Array.from({ length: rows + 1 }, (_, index) => {
              const y = marginPx + index * cellH;
              return (
                <line
                  key={`guide-h-${index}`}
                  x1={marginPx}
                  y1={y}
                  x2={marginPx + cols * cellW}
                  y2={y}
                  stroke={edgeGuides.color}
                  strokeOpacity={edgeGuides.opacity}
                  strokeWidth={edgeGuides.thickness}
                  strokeDasharray={getPreviewDashArray(edgeGuides.style)}
                />
              );
            })}
          </>
        ) : null}
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

function EdgeLineStyleIcon({ style }: { style: EdgeLineStyle }) {
  const common = "h-0.5 w-8 rounded-full";

  if (style === "solid") {
    return <span aria-hidden className={`${common} bg-current`} />;
  }

  if (style === "dashed") {
    return (
      <span
        aria-hidden
        className={`${common} bg-[repeating-linear-gradient(to_right,currentColor_0_8px,transparent_8px_12px)]`}
      />
    );
  }

  return (
    <span
      aria-hidden
      className={`${common} bg-[repeating-linear-gradient(to_right,currentColor_0_2px,transparent_2px_6px)]`}
    />
  );
}

function SortableTextLayerRow({
  id,
  children,
}: {
  id: string;
  children: (dragHandleProps: React.HTMLAttributes<HTMLButtonElement>) => React.ReactNode;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id,
  });

  return (
    <div
      ref={setNodeRef}
      style={{
        transform: CSS.Transform.toString(transform),
        transition,
        opacity: isDragging ? 0.5 : 1,
        position: "relative",
        zIndex: isDragging ? 10 : undefined,
      }}
    >
      {children({
        ...attributes,
        ...listeners,
      } as React.HTMLAttributes<HTMLButtonElement>)}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

export interface LabelDesignerItem {
  id: string;
  primaryText: string;
}

export interface LabelDesignerField {
  key: string;
  label: string;
}

interface LabelDesignerProps {
  items: LabelDesignerItem[];
  canExport: boolean;
  format: "pdf" | "zpl";
  /** Data fields the user can bind a text line to (e.g. location name, QR token). */
  availableFields: LabelDesignerField[];
  /** POST endpoint to call on export. Defaults to the QR-platform export route. */
  exportEndpoint?: string;
  /** Key used for the id array in the export request body. */
  idsBodyKey?: string;
  /** Filename prefix for ZPL downloads / PDF preview title. */
  fileNamePrefix?: string;
  /** "export" prints/downloads labels; "template-editor" only edits + saves a default config. */
  mode?: "export" | "template-editor";
  /** Seeds the initial config instead of DEFAULT_LABEL_CONFIG. */
  initialConfig?: LabelConfig;
  /** Called in template-editor mode when the user saves the current config as the default. */
  onSaveTemplate?: (config: LabelConfig) => Promise<void>;
}

type PreviewZoom = "fit" | number;
const PRESET_PREVIEW_ZOOMS = [0.5, 0.75, 1, 1.25, 1.5] as const;
const SINGLE_DIALOG_PREVIEW_ZOOMS: readonly PreviewZoom[] = [0.5, 0.75, "fit", 1.25, 1.5];
const MIN_PREVIEW_ZOOM = 0.25;
const MAX_PREVIEW_ZOOM = 2;

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function LabelDesigner({
  items,
  canExport,
  format,
  availableFields,
  exportEndpoint = "/api/qr/export",
  idsBodyKey = "qrCodeIds",
  fileNamePrefix = "qr-labels",
  mode = "export",
  initialConfig,
  onSaveTemplate,
}: LabelDesignerProps) {
  const t = useTranslations("modules.qr.designer");
  const selectedIds = useMemo(() => items.map((item) => item.id), [items]);
  const [pdfConfig, setPdfConfig] = useState<LabelConfig>(initialConfig ?? DEFAULT_LABEL_CONFIG);
  const [zplConfig, setZplConfig] = useState<LabelConfig>({
    ...(initialConfig ?? DEFAULT_LABEL_CONFIG),
    includeLogo: false,
    showBorder: false,
    textPosition: "right",
    dimension: orientDimension(
      ZPL_DIMENSIONS["50x30"],
      (initialConfig ?? DEFAULT_LABEL_CONFIG).orientation
    ),
  });
  const [isSavingTemplate, setIsSavingTemplate] = useState(false);
  const [optionsTab, setOptionsTab] = useState<"layout" | "qr" | "text">("layout");
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
  const [pdfWidthInput, setPdfWidthInput] = useState(String(DEFAULT_LABEL_CONFIG.dimension.width));
  const [pdfHeightInput, setPdfHeightInput] = useState(
    String(DEFAULT_LABEL_CONFIG.dimension.height)
  );
  const pagePreviewViewportRef = useRef<HTMLDivElement | null>(null);
  const singlePreviewViewportRef = useRef<HTMLDivElement | null>(null);
  const textLayerSensors = useSensors(useSensor(PointerSensor));

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

  function updateTextLine(id: string, patch: Partial<TextLineConfig>) {
    updateDraftConfig((prev) => ({
      ...prev,
      textLines: prev.textLines.map((line) => (line.id === id ? { ...line, ...patch } : line)),
    }));
  }

  function addTextLine() {
    updateDraftConfig((prev) => {
      if (prev.textLines.length >= MAX_TEXT_LINES) return prev;
      const firstUnusedField = availableFields.find(
        (f) => !prev.textLines.some((line) => line.source === "field" && line.fieldKey === f.key)
      );
      return {
        ...prev,
        textLines: [
          ...prev.textLines,
          createTextLine(
            firstUnusedField
              ? { source: "field", fieldKey: firstUnusedField.key }
              : { source: "custom", customText: "" }
          ),
        ],
      };
    });
  }

  function removeTextLine(id: string) {
    updateDraftConfig((prev) => ({
      ...prev,
      textLines: prev.textLines.filter((line) => line.id !== id),
    }));
  }

  function setTextLineOrder(order: string[]) {
    updateDraftConfig((prev) => {
      const byId = new Map(prev.textLines.map((line) => [line.id, line]));
      return { ...prev, textLines: order.map((id) => byId.get(id)!).filter(Boolean) };
    });
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
  function handlePdfDimensionInput(field: "width" | "height", value: string) {
    if (field === "width") setPdfWidthInput(value);
    else setPdfHeightInput(value);

    const parsed = Number(value);
    if (!Number.isFinite(parsed) || value.trim() === "") return;

    setPdfConfig((prev) => ({
      ...prev,
      dimension: {
        ...prev.dimension,
        [field]: parsed,
      },
    }));
  }

  function handleOrientationChange(orientation: LabelOrientation) {
    updateDraftConfig((prev) => ({
      ...prev,
      orientation,
      dimension: {
        width: prev.dimension.height,
        height: prev.dimension.width,
      },
      textPosition: getAllowedTextPositions(orientation)[0],
    }));

    if (format === "pdf") {
      setPdfWidthInput(pdfHeightInput);
      setPdfHeightInput(pdfWidthInput);
    }
  }

  function handleTextLayerDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    const currentOrder = activeConfig.textLines.map((line) => line.id);
    const oldIndex = currentOrder.indexOf(active.id as string);
    const newIndex = currentOrder.indexOf(over.id as string);
    if (oldIndex === -1 || newIndex === -1) return;
    setTextLineOrder(arrayMove(currentOrder, oldIndex, newIndex));
  }

  // ── export ────────────────────────────────────────────────────────────────

  async function handleExport() {
    if (selectedIds.length === 0) {
      toast.error(t("toasts.selectOne"));
      return;
    }
    if (format === "pdf") {
      setPreviewOpen(true);
    }
    setIsExporting(true);
    try {
      const labelConfig = format === "zpl" ? zplConfig : pdfConfig;
      const body =
        format === "pdf"
          ? { [idsBodyKey]: selectedIds, format: "pdf", labelConfig }
          : { [idsBodyKey]: selectedIds, format: "zpl", labelConfig, zplSize };

      const res = await fetch(exportEndpoint, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(body),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: "Export failed." }));
        if (format === "pdf") setPreviewOpen(false);
        toast.error((err as { error?: string }).error ?? t("toasts.exportFailed"));
        return;
      }

      const blob = await res.blob();
      const url = URL.createObjectURL(blob);

      if (format === "pdf") {
        if (previewUrl) URL.revokeObjectURL(previewUrl);
        setPreviewUrl(url);
        setPreviewOpen(true);
        toast.success(t("toasts.previewReady", { count: selectedIds.length }));
        return;
      }

      const a = document.createElement("a");
      a.href = url;
      a.download = `${fileNamePrefix}.zpl`;
      a.click();
      URL.revokeObjectURL(url);
      toast.success(t("toasts.exported", { count: selectedIds.length }));
    } catch {
      if (format === "pdf") setPreviewOpen(false);
      toast.error(t("toasts.exportFailed"));
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
    () => (format === "zpl" ? zplConfig : pdfConfig),
    [pdfConfig, zplConfig, format, zplSize]
  );
  const deferredPreviewConfig = useDeferredValue(activeConfig);
  const allowedTextPositions = useMemo(
    () => getAllowedTextPositions(activeConfig.orientation),
    [activeConfig.orientation]
  );
  const pdfWidthValue = Number(pdfWidthInput);
  const pdfHeightValue = Number(pdfHeightInput);
  const pdfWidthInvalid =
    pdfWidthInput.trim() === "" || !Number.isFinite(pdfWidthValue) || pdfWidthValue < 20;
  const pdfHeightInvalid =
    pdfHeightInput.trim() === "" || !Number.isFinite(pdfHeightValue) || pdfHeightValue < 20;

  const effectiveDimension = useMemo(
    () => getEffectiveLabelDimension(activeConfig),
    [activeConfig]
  );
  const grid = useMemo(() => computeGrid(effectiveDimension), [effectiveDimension]);
  const totalPages = selectedIds.length > 0 ? Math.ceil(selectedIds.length / grid.perPage) : 1;

  const cellW = effectiveDimension.width * pdfScale;
  const cellH = effectiveDimension.height * pdfScale;

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
  const SINGLE_LABEL_PREVIEW_W = 420;
  const singleLabelPreviewH = Math.max(
    180,
    Math.round((effectiveDimension.height / effectiveDimension.width) * SINGLE_LABEL_PREVIEW_W)
  );
  const singleLabelScale = SINGLE_LABEL_PREVIEW_W / effectiveDimension.width;
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
              getContentInsetPx(deferredPreviewConfig, pdfScale),
              pdfScale
            ),
            inactive: renderPageLabelPreview(
              deferredPreviewConfig,
              false,
              cellW,
              cellH,
              getContentInsetPx(deferredPreviewConfig, pdfScale),
              pdfScale
            ),
          }
        : null,
    [shouldRenderPagePreview, deferredPreviewConfig, cellW, cellH, pdfScale]
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
      <div className="grid h-full grid-rows-[minmax(0,1fr)_auto] gap-4 overflow-hidden">
        <div className="grid min-h-0 gap-6 xl:grid-cols-[minmax(0,1fr)_280px]">
          <div className="min-h-0 overflow-hidden rounded-xl border bg-card">
            <Tabs
              value={optionsTab}
              onValueChange={(value) => setOptionsTab(value as "layout" | "qr" | "text")}
              className="flex h-full min-h-0 flex-col"
            >
              <div className="border-b p-4">
                <TabsList className="grid w-full grid-cols-3">
                  <TabsTrigger value="layout">{t("tabs.layout")}</TabsTrigger>
                  <TabsTrigger value="qr">{t("tabs.qr")}</TabsTrigger>
                  <TabsTrigger value="text">{t("tabs.text")}</TabsTrigger>
                </TabsList>
              </div>

              <div className="min-h-0 flex-1 overflow-hidden p-4 pt-0">
                <TabsContent value="layout" className="!mt-0 h-full overflow-y-auto pt-4 pr-2">
                  <Section title={t("tabs.layout")}>
                    {format === "pdf" ? (
                      <div className="grid gap-3 sm:grid-cols-2">
                        <div className="space-y-1">
                          <Label className="text-xs text-muted-foreground">
                            {t("layout.widthMm")}
                          </Label>
                          <Input
                            type="number"
                            inputMode="decimal"
                            value={pdfWidthInput}
                            onChange={(e) => handlePdfDimensionInput("width", e.target.value)}
                            className={`h-9 ${pdfWidthInvalid ? "border-destructive" : ""}`}
                          />
                          {pdfWidthInvalid ? (
                            <p className="text-xs text-destructive">{t("layout.minWidthError")}</p>
                          ) : null}
                        </div>
                        <div className="space-y-1">
                          <Label className="text-xs text-muted-foreground">
                            {t("layout.heightMm")}
                          </Label>
                          <Input
                            type="number"
                            inputMode="decimal"
                            value={pdfHeightInput}
                            onChange={(e) => handlePdfDimensionInput("height", e.target.value)}
                            className={`h-9 ${pdfHeightInvalid ? "border-destructive" : ""}`}
                          />
                          {pdfHeightInvalid ? (
                            <p className="text-xs text-destructive">{t("layout.minHeightError")}</p>
                          ) : null}
                        </div>
                      </div>
                    ) : (
                      <div className="grid grid-cols-2 gap-2">
                        {(["50x30", "70x40"] as const).map((s) => (
                          <Button
                            key={s}
                            size="sm"
                            variant={zplSize === s ? "default" : "outline"}
                            onClick={() => {
                              setZplSize(s);
                              setZplConfig((prev) => ({
                                ...prev,
                                dimension: orientDimension(ZPL_DIMENSIONS[s], prev.orientation),
                              }));
                            }}
                            className="h-9 text-xs"
                          >
                            {t("layout.zplPreset", { size: s })}
                          </Button>
                        ))}
                      </div>
                    )}

                    <div className="grid gap-4 lg:grid-cols-2">
                      <div className="space-y-2">
                        <Label className="text-xs text-muted-foreground">
                          {t("layout.orientation")}
                        </Label>
                        <div className="grid grid-cols-2 gap-1">
                          {ORIENTATION_OPTIONS.map((orientation) => (
                            <Button
                              key={orientation}
                              size="sm"
                              variant={
                                activeConfig.orientation === orientation ? "default" : "outline"
                              }
                              onClick={() => handleOrientationChange(orientation)}
                              className="h-8 text-xs capitalize"
                            >
                              {t(`layout.orientationOptions.${orientation}`)}
                            </Button>
                          ))}
                        </div>
                      </div>

                      <div className="space-y-2">
                        <Label className="text-xs text-muted-foreground">
                          {t("layout.textPosition")}
                        </Label>
                        <div className="grid grid-cols-2 gap-1">
                          {allowedTextPositions.map((position) => (
                            <Button
                              key={position}
                              size="sm"
                              variant={
                                activeConfig.textPosition === position ? "default" : "outline"
                              }
                              onClick={() => set("textPosition", position)}
                              className="h-8 text-xs capitalize"
                            >
                              {t(`layout.textPositionOptions.${position}`)}
                            </Button>
                          ))}
                        </div>
                      </div>
                    </div>

                    <div className="rounded-xl border p-4 space-y-4">
                      <div className="flex items-center justify-between">
                        <Label htmlFor="toggle-border" className="text-sm cursor-pointer">
                          {t("layout.labelBorder")}
                        </Label>
                        <Switch
                          id="toggle-border"
                          checked={activeConfig.showBorder}
                          onCheckedChange={(v) => set("showBorder", v)}
                        />
                      </div>
                      <div className="grid gap-4 lg:grid-cols-2">
                        {activeConfig.showBorder ? (
                          <div className="space-y-2">
                            <Label className="text-xs text-muted-foreground">
                              {t("layout.outerPadding")}
                              <span className="ml-1 font-mono">
                                {activeConfig.outerPaddingMm.toFixed(1)} mm
                              </span>
                            </Label>
                            <Slider
                              min={0}
                              max={10}
                              step={0.5}
                              value={[activeConfig.outerPaddingMm]}
                              onValueChange={([v]) => set("outerPaddingMm", v)}
                            />
                          </div>
                        ) : (
                          <div />
                        )}
                        <div className="space-y-2">
                          <Label className="text-xs text-muted-foreground">
                            {t("layout.innerPadding")}
                            <span className="ml-1 font-mono">
                              {activeConfig.innerPaddingMm.toFixed(1)} mm
                            </span>
                          </Label>
                          <Slider
                            min={0}
                            max={10}
                            step={0.5}
                            value={[activeConfig.innerPaddingMm]}
                            onValueChange={([v]) => set("innerPaddingMm", v)}
                          />
                        </div>
                      </div>
                    </div>

                    <div className="rounded-xl border p-4 space-y-4">
                      <div className="flex items-center justify-between">
                        <Label htmlFor="toggle-footer" className="text-sm cursor-pointer">
                          {t("layout.ambraFooter")}
                        </Label>
                        <Switch
                          id="toggle-footer"
                          checked={activeConfig.footer.show}
                          onCheckedChange={(v) =>
                            updateDraftConfig((prev) => ({
                              ...prev,
                              footer: { ...prev.footer, show: v },
                            }))
                          }
                        />
                      </div>
                    </div>

                    {format === "pdf" ? (
                      <div className="rounded-xl border p-4 space-y-4">
                        <div className="flex items-center justify-between">
                          <Label htmlFor="toggle-edge-guides" className="text-sm cursor-pointer">
                            {t("layout.edgeGuides")}
                          </Label>
                          <Switch
                            id="toggle-edge-guides"
                            checked={activeConfig.edgeGuides.show}
                            onCheckedChange={(v) =>
                              updateDraftConfig((prev) => ({
                                ...prev,
                                edgeGuides: { ...prev.edgeGuides, show: v },
                              }))
                            }
                          />
                        </div>
                        {activeConfig.edgeGuides.show ? (
                          <>
                            <div className="grid gap-4 md:grid-cols-[1fr_220px]">
                              <div className="space-y-2">
                                <Label className="text-xs text-muted-foreground">
                                  {t("layout.edgeGuideThickness")}
                                  <span className="ml-1 font-mono">
                                    {activeConfig.edgeGuides.thickness.toFixed(1)}
                                  </span>
                                </Label>
                                <Slider
                                  min={0.1}
                                  max={4}
                                  step={0.1}
                                  value={[activeConfig.edgeGuides.thickness]}
                                  onValueChange={([v]) =>
                                    updateDraftConfig((prev) => ({
                                      ...prev,
                                      edgeGuides: { ...prev.edgeGuides, thickness: v },
                                    }))
                                  }
                                />
                              </div>
                              <div className="space-y-2">
                                <Label className="text-xs text-muted-foreground">
                                  {t("layout.edgeGuideStyle")}
                                </Label>
                                <div className="grid grid-cols-3 gap-1">
                                  {EDGE_LINE_STYLE_OPTIONS.map((style) => (
                                    <Button
                                      key={style}
                                      size="sm"
                                      variant={
                                        activeConfig.edgeGuides.style === style
                                          ? "default"
                                          : "outline"
                                      }
                                      onClick={() =>
                                        updateDraftConfig((prev) => ({
                                          ...prev,
                                          edgeGuides: { ...prev.edgeGuides, style },
                                        }))
                                      }
                                      className="h-8"
                                      aria-label={t(`layout.edgeGuideStyleOptions.${style}`)}
                                      title={t(`layout.edgeGuideStyleOptions.${style}`)}
                                    >
                                      <EdgeLineStyleIcon style={style} />
                                    </Button>
                                  ))}
                                </div>
                              </div>
                            </div>
                            <div className="grid gap-4 md:grid-cols-[1fr_110px]">
                              <div className="space-y-2">
                                <Label className="text-xs text-muted-foreground">
                                  {t("layout.edgeGuideOpacity")}
                                  <span className="ml-1 font-mono">
                                    {Math.round(activeConfig.edgeGuides.opacity * 100)}%
                                  </span>
                                </Label>
                                <Slider
                                  min={0}
                                  max={1}
                                  step={0.05}
                                  value={[activeConfig.edgeGuides.opacity]}
                                  onValueChange={([v]) =>
                                    updateDraftConfig((prev) => ({
                                      ...prev,
                                      edgeGuides: { ...prev.edgeGuides, opacity: v },
                                    }))
                                  }
                                />
                              </div>
                              <div className="space-y-2">
                                <Label className="text-xs text-muted-foreground">
                                  {t("layout.edgeGuideColor")}
                                </Label>
                                <Input
                                  type="color"
                                  value={activeConfig.edgeGuides.color}
                                  onChange={(e) =>
                                    updateDraftConfig((prev) => ({
                                      ...prev,
                                      edgeGuides: { ...prev.edgeGuides, color: e.target.value },
                                    }))
                                  }
                                  className="h-9 p-1"
                                />
                              </div>
                            </div>
                          </>
                        ) : null}
                      </div>
                    ) : null}
                  </Section>
                </TabsContent>

                <TabsContent value="qr" className="!mt-0 h-full overflow-y-auto pt-4 pr-2">
                  <Section title={t("tabs.qr")}>
                    <div className="space-y-4">
                      <div className="space-y-2">
                        <div className="flex items-center justify-between">
                          <Label className="text-sm">
                            {t("qr.qrSize")}{" "}
                            <span className="font-mono text-muted-foreground">
                              {Math.round(activeConfig.qrHeightRatio * 100)}%
                            </span>
                          </Label>
                        </div>
                        <Slider
                          min={40}
                          max={100}
                          step={5}
                          value={[Math.round(activeConfig.qrHeightRatio * 100)]}
                          onValueChange={([v]) => set("qrHeightRatio", v / 100)}
                        />
                      </div>

                      <div className="grid gap-4 lg:grid-cols-2">
                        <div className="space-y-2">
                          <Label className="text-xs text-muted-foreground">
                            {t("qr.frameShape")}
                          </Label>
                          <div className="grid grid-cols-2 gap-1">
                            {QR_FRAME_SHAPE_OPTIONS.map((shape) => (
                              <Button
                                key={shape}
                                size="sm"
                                variant={
                                  activeConfig.qrStyle.frameShape === shape ? "default" : "outline"
                                }
                                onClick={() => setQrStyle("frameShape", shape)}
                                className="h-8 text-xs capitalize"
                              >
                                {t(`qr.frameShapeOptions.${shape}`)}
                              </Button>
                            ))}
                          </div>
                        </div>

                        <div className="space-y-2">
                          <Label className="text-xs text-muted-foreground">
                            {t("qr.bodyStyle")}
                          </Label>
                          <div className="grid grid-cols-2 gap-1">
                            {QR_DOT_STYLE_OPTIONS.map((style) => (
                              <Button
                                key={style}
                                size="sm"
                                variant={
                                  activeConfig.qrStyle.dotStyle === style ? "default" : "outline"
                                }
                                onClick={() => setQrStyle("dotStyle", style)}
                                className="h-8 text-xs capitalize"
                              >
                                {t(`qr.bodyStyleOptions.${style}`)}
                              </Button>
                            ))}
                          </div>
                        </div>
                      </div>

                      <div className="grid gap-4 lg:grid-cols-2">
                        <div className="space-y-2">
                          <Label className="text-xs text-muted-foreground">
                            {t("qr.finderOuterStyle")}
                          </Label>
                          <div className="grid grid-cols-2 gap-1">
                            {QR_CORNER_SQUARE_OPTIONS.map((style) => (
                              <Button
                                key={style}
                                size="sm"
                                variant={
                                  activeConfig.qrStyle.cornerSquareStyle === style
                                    ? "default"
                                    : "outline"
                                }
                                onClick={() => setQrStyle("cornerSquareStyle", style)}
                                className="h-8 text-xs capitalize"
                              >
                                {t(`qr.cornerStyleOptions.${style}`)}
                              </Button>
                            ))}
                          </div>
                        </div>

                        <div className="space-y-2">
                          <Label className="text-xs text-muted-foreground">
                            {t("qr.finderInnerStyle")}
                          </Label>
                          <div className="grid grid-cols-2 gap-1">
                            {QR_CORNER_DOT_OPTIONS.map((style) => (
                              <Button
                                key={style}
                                size="sm"
                                variant={
                                  activeConfig.qrStyle.cornerDotStyle === style
                                    ? "default"
                                    : "outline"
                                }
                                onClick={() => setQrStyle("cornerDotStyle", style)}
                                className="h-8 text-xs capitalize"
                              >
                                {t(`qr.cornerStyleOptions.${style}`)}
                              </Button>
                            ))}
                          </div>
                        </div>
                      </div>

                      <div className="rounded-xl border p-4 space-y-3">
                        <div className="flex items-center justify-between">
                          <Label htmlFor="toggle-logo" className="text-sm cursor-pointer">
                            {t("qr.logoInCenter")}
                          </Label>
                          <Switch
                            id="toggle-logo"
                            checked={activeConfig.includeLogo}
                            onCheckedChange={(v) => set("includeLogo", v)}
                          />
                        </div>
                        {activeConfig.includeLogo ? (
                          <div className="space-y-2">
                            <Label className="text-xs text-muted-foreground">
                              {t("qr.logoBackground")}
                            </Label>
                            <div className="grid grid-cols-3 gap-1">
                              {LOGO_BACKGROUND_OPTIONS.map((option) => (
                                <Button
                                  key={option}
                                  size="sm"
                                  variant={
                                    activeConfig.logoBackgroundStyle === option
                                      ? "default"
                                      : "outline"
                                  }
                                  onClick={() => set("logoBackgroundStyle", option)}
                                  className="h-8 text-xs capitalize"
                                >
                                  {t(`qr.logoBackgroundOptions.${option}`)}
                                </Button>
                              ))}
                            </div>
                          </div>
                        ) : null}
                      </div>
                    </div>
                  </Section>
                </TabsContent>

                <TabsContent value="text" className="!mt-0 h-full overflow-y-auto pt-4 pr-2">
                  <Section title={t("tabs.text")}>
                    <div className="space-y-4">
                      <div className="rounded-xl border p-4 space-y-2">
                        <Label className="text-xs text-muted-foreground">
                          {t("text.verticalAlignment")}
                        </Label>
                        <div className="grid grid-cols-3 gap-1">
                          {TEXT_VERTICAL_ALIGN_OPTIONS.map((align) => (
                            <Button
                              key={align}
                              size="sm"
                              variant={
                                activeConfig.textVerticalAlign === align ? "default" : "outline"
                              }
                              onClick={() => set("textVerticalAlign", align)}
                              className="h-8 text-xs capitalize"
                            >
                              {t(`text.verticalAlignmentOptions.${align}`)}
                            </Button>
                          ))}
                        </div>
                      </div>

                      <DndContext
                        sensors={textLayerSensors}
                        collisionDetection={closestCenter}
                        modifiers={[restrictToVerticalAxis]}
                        onDragEnd={handleTextLayerDragEnd}
                      >
                        <SortableContext
                          items={activeConfig.textLines.map((line) => line.id)}
                          strategy={verticalListSortingStrategy}
                        >
                          <div className="space-y-3">
                            {activeConfig.textLines.map((line, index) => {
                              const name = t("text.lineNumber", { index: index + 1 });
                              return (
                                <SortableTextLayerRow key={line.id} id={line.id}>
                                  {(dragHandleProps) => (
                                    <div className="rounded-lg border p-3 space-y-3">
                                      <div className="flex flex-wrap items-center gap-2">
                                        <Button
                                          type="button"
                                          size="sm"
                                          variant="ghost"
                                          className="h-8 w-8 cursor-grab p-0 active:cursor-grabbing"
                                          aria-label={t("text.reorderLine", { line: name })}
                                          title={t("text.reorderLine", { line: name })}
                                          {...dragHandleProps}
                                        >
                                          <GripVertical className="h-4 w-4" />
                                        </Button>
                                        <Label className="min-w-0 flex-1 text-sm font-medium">
                                          {name}
                                        </Label>
                                        <Button
                                          type="button"
                                          size="sm"
                                          variant="ghost"
                                          className="h-8 w-8 p-0 text-muted-foreground hover:text-destructive"
                                          aria-label={t("text.removeLine", { line: name })}
                                          title={t("text.removeLine", { line: name })}
                                          onClick={() => removeTextLine(line.id)}
                                        >
                                          <X className="h-4 w-4" />
                                        </Button>
                                      </div>

                                      <div className="grid grid-cols-2 gap-2">
                                        <Button
                                          type="button"
                                          size="sm"
                                          variant={line.source === "custom" ? "default" : "outline"}
                                          className="h-8 text-xs"
                                          onClick={() =>
                                            updateTextLine(line.id, { source: "custom" })
                                          }
                                        >
                                          {t("text.sourceCustom")}
                                        </Button>
                                        <Button
                                          type="button"
                                          size="sm"
                                          variant={line.source === "field" ? "default" : "outline"}
                                          className="h-8 text-xs"
                                          disabled={availableFields.length === 0}
                                          onClick={() =>
                                            updateTextLine(line.id, {
                                              source: "field",
                                              fieldKey:
                                                line.fieldKey || availableFields[0]?.key || "",
                                            })
                                          }
                                        >
                                          {t("text.sourceField")}
                                        </Button>
                                      </div>

                                      {line.source === "custom" ? (
                                        <div className="space-y-1">
                                          <Label
                                            htmlFor={`${format}-${line.id}-content`}
                                            className="text-xs text-muted-foreground"
                                          >
                                            {t("text.customLineLabel")}
                                          </Label>
                                          <Input
                                            id={`${format}-${line.id}-content`}
                                            value={line.customText}
                                            onChange={(e) =>
                                              updateTextLine(line.id, {
                                                customText: e.target.value,
                                              })
                                            }
                                            placeholder={t("text.customLinePlaceholder")}
                                            className="h-9"
                                          />
                                        </div>
                                      ) : (
                                        <div className="grid grid-cols-2 gap-2">
                                          <div className="space-y-1">
                                            <Label className="text-xs text-muted-foreground">
                                              {t("text.fieldLabel")}
                                            </Label>
                                            <Select
                                              value={line.fieldKey}
                                              onValueChange={(v) =>
                                                updateTextLine(line.id, { fieldKey: v })
                                              }
                                            >
                                              <SelectTrigger className="h-9">
                                                <SelectValue placeholder={t("text.fieldLabel")} />
                                              </SelectTrigger>
                                              <SelectContent>
                                                {availableFields.map((field) => (
                                                  <SelectItem key={field.key} value={field.key}>
                                                    {field.label}
                                                  </SelectItem>
                                                ))}
                                              </SelectContent>
                                            </Select>
                                          </div>
                                          <div className="space-y-1">
                                            <Label className="text-xs text-muted-foreground">
                                              {t("text.caseTransform")}
                                            </Label>
                                            <Select
                                              value={line.caseTransform}
                                              onValueChange={(v) =>
                                                updateTextLine(line.id, {
                                                  caseTransform: v as TextCaseTransform,
                                                })
                                              }
                                            >
                                              <SelectTrigger className="h-9">
                                                <SelectValue />
                                              </SelectTrigger>
                                              <SelectContent>
                                                {CASE_TRANSFORM_OPTIONS.map((option) => (
                                                  <SelectItem key={option} value={option}>
                                                    {t(`text.caseTransformOptions.${option}`)}
                                                  </SelectItem>
                                                ))}
                                              </SelectContent>
                                            </Select>
                                          </div>
                                        </div>
                                      )}

                                      <div className="flex flex-wrap items-center gap-2">
                                        <Input
                                          type="number"
                                          min={4}
                                          max={24}
                                          value={line.size}
                                          onChange={(e) =>
                                            updateTextLine(line.id, {
                                              size: Math.max(
                                                4,
                                                Math.min(24, Number(e.target.value))
                                              ),
                                            })
                                          }
                                          className="h-8 w-16 text-xs"
                                        />
                                        <span className="text-xs text-muted-foreground">
                                          {t("text.pt")}
                                        </span>
                                        <div className="flex items-center gap-2">
                                          <Checkbox
                                            id={`${format}-bold-${line.id}`}
                                            checked={line.bold}
                                            onCheckedChange={(v) =>
                                              updateTextLine(line.id, { bold: !!v })
                                            }
                                          />
                                          <Label
                                            htmlFor={`${format}-bold-${line.id}`}
                                            className="cursor-pointer text-xs"
                                          >
                                            {t("text.bold")}
                                          </Label>
                                        </div>
                                        <div className="ml-auto flex gap-1">
                                          {TEXT_ALIGN_OPTIONS.map((align) => {
                                            const Icon = TEXT_ALIGN_ICONS[align];
                                            return (
                                              <Button
                                                key={`${format}-${line.id}-${align}`}
                                                size="sm"
                                                variant={
                                                  line.align === align ? "default" : "outline"
                                                }
                                                onClick={() => updateTextLine(line.id, { align })}
                                                className="h-8 w-8 p-0"
                                                aria-label={t("text.alignLine", {
                                                  line: name,
                                                  align: t(`text.alignOptions.${align}`),
                                                })}
                                                title={t("text.alignLine", {
                                                  line: name,
                                                  align: t(`text.alignOptions.${align}`),
                                                })}
                                              >
                                                <Icon className="h-3.5 w-3.5" />
                                              </Button>
                                            );
                                          })}
                                        </div>
                                      </div>
                                    </div>
                                  )}
                                </SortableTextLayerRow>
                              );
                            })}
                          </div>
                        </SortableContext>
                      </DndContext>

                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        className="w-full gap-1.5"
                        disabled={activeConfig.textLines.length >= MAX_TEXT_LINES}
                        onClick={addTextLine}
                      >
                        <Plus className="h-3.5 w-3.5" />
                        {t("text.addLine")}
                      </Button>
                    </div>
                  </Section>
                </TabsContent>
              </div>
            </Tabs>
          </div>

          <div className="space-y-4 xl:sticky xl:top-0 xl:self-start">
            <div className="rounded-xl border bg-card p-4">
              <Section title={t("preview.title")}>
                <div className="space-y-4">
                  <div className="rounded-2xl border bg-muted/25 p-3">
                    <SingleLabelPreviewSvg
                      config={deferredPreviewConfig}
                      format={format}
                      previewWidth={SINGLE_LABEL_PREVIEW_W}
                      previewHeight={singleLabelPreviewH}
                      renderWidth={compactSingleRenderWidth}
                      renderHeight={compactSingleRenderHeight}
                      pad={getContentInsetPx(deferredPreviewConfig, singleLabelScale)}
                      scale={singleLabelScale}
                    />
                  </div>
                  <div className="space-y-2 text-sm text-muted-foreground">
                    <p>
                      {t("preview.effectiveLabel")}{" "}
                      <span className="font-medium text-foreground">
                        {effectiveDimension.width} × {effectiveDimension.height} mm
                      </span>
                    </p>
                    {format === "pdf" ? (
                      <p>
                        {t("preview.a4Packing")}{" "}
                        <span className="font-medium text-foreground">{grid.perPage}</span>/page
                      </p>
                    ) : (
                      <p>
                        {t("preview.thermalPreset")}{" "}
                        <span className="font-medium text-foreground">{zplSize} mm</span>
                      </p>
                    )}
                  </div>
                  <div className="grid gap-2">
                    <Button variant="outline" onClick={() => setSinglePreviewOpen(true)}>
                      {t("preview.openLabelPreview")}
                    </Button>
                    {format === "pdf" && (
                      <Button variant="outline" onClick={() => setLayoutPreviewOpen(true)}>
                        {t("preview.openPageLayout")}
                      </Button>
                    )}
                  </div>
                </div>
              </Section>
            </div>
          </div>
        </div>

        <div className="rounded-xl border bg-card p-4">
          {mode === "template-editor" ? (
            <div className="flex flex-col gap-3">
              <p className="text-sm text-muted-foreground">{t("exportBar.templateSummary")}</p>
              <Button
                onClick={async () => {
                  if (!onSaveTemplate) return;
                  setIsSavingTemplate(true);
                  try {
                    await onSaveTemplate(format === "zpl" ? zplConfig : pdfConfig);
                  } finally {
                    setIsSavingTemplate(false);
                  }
                }}
                disabled={isSavingTemplate || !canExport}
                className="w-full gap-2"
              >
                <Download className="h-4 w-4" />
                {isSavingTemplate ? t("exportBar.savingTemplate") : t("exportBar.saveTemplate")}
              </Button>
            </div>
          ) : (
            <div className="flex flex-col gap-3">
              <p className="text-sm text-muted-foreground">
                {format === "pdf"
                  ? t("exportBar.pdfSummary", { count: grid.perPage })
                  : t("exportBar.zplSummary", { size: zplSize })}
              </p>
              <Button
                onClick={handleExport}
                disabled={
                  isExporting ||
                  !canExport ||
                  selectedIds.length === 0 ||
                  (format === "pdf" && (pdfWidthInvalid || pdfHeightInvalid))
                }
                className="w-full gap-2"
              >
                {format === "pdf" ? <Eye className="h-4 w-4" /> : <Download className="h-4 w-4" />}
                {isExporting
                  ? format === "pdf"
                    ? t("exportBar.generatingPreview")
                    : t("exportBar.exporting")
                  : selectedIds.length > 0
                    ? format === "pdf"
                      ? t("exportBar.previewLabels", { count: selectedIds.length })
                      : t("exportBar.exportLabels", { count: selectedIds.length })
                    : t("exportBar.selectCodes")}
              </Button>
            </div>
          )}
        </div>
      </div>

      <QrPdfPreviewDialog
        open={previewOpen}
        onOpenChange={setPreviewOpen}
        blobUrl={previewUrl}
        generating={isExporting && format === "pdf"}
        fileName={`${fileNamePrefix}.pdf`}
        title={t("previewDialogTitle", { count: selectedIds.length })}
      />

      <Dialog open={singlePreviewOpen} onOpenChange={setSinglePreviewOpen}>
        <DialogContent className="flex h-[min(82vh,760px)] max-w-[min(92vw,900px)] flex-col overflow-hidden p-0">
          <DialogHeader className="border-b px-6 pt-5 pb-3">
            <div className="flex flex-wrap items-end justify-between gap-3 pr-10">
              <DialogTitle>{t("singleDialog.title")}</DialogTitle>
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
                    {option === "fit" ? t("zoom.fit") : `${Math.round(option * 100)}%`}
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
                <span className="text-xs text-muted-foreground">{t("zoom.label")}</span>
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
                  format={format}
                  previewWidth={SINGLE_LABEL_PREVIEW_W}
                  previewHeight={singleLabelPreviewH}
                  renderWidth={singlePreviewRenderWidth}
                  renderHeight={singlePreviewRenderHeight}
                  pad={getContentInsetPx(deferredPreviewConfig, singleLabelScale)}
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
                {format === "pdf" ? t("layoutDialog.pdfTitle") : t("layoutDialog.zplTitle")}
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
                    {t("layoutDialog.fixedZpl", {
                      width: ZPL_DIMENSIONS[zplSize].width,
                      height: ZPL_DIMENSIONS[zplSize].height,
                    })}
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
                  cellW={cellW}
                  cellH={cellH}
                  cols={grid.cols}
                  rows={grid.rows}
                  edgeGuides={deferredPreviewConfig.edgeGuides}
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
                        getContentInsetPx(activeConfig, thermalScale),
                        thermalScale,
                        false
                      );
                      const qrX = layout.qrX;
                      const qrY = layout.qrY;
                      const borderInset = Math.max(0, activeConfig.outerPaddingMm * thermalScale);
                      return (
                        <>
                          {activeConfig.showBorder ? (
                            <rect
                              x={borderInset + 0.5}
                              y={borderInset + 0.5}
                              width={Math.max(0, THERMAL_BASE_PREVIEW_W - borderInset * 2 - 1)}
                              height={Math.max(0, thermalBasePreviewH - borderInset * 2 - 1)}
                              fill="none"
                              stroke="#475569"
                              strokeWidth={1}
                              rx={3}
                            />
                          ) : null}
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
                          {activeConfig.footer.show ? renderFooterPreview(layout, false) : null}
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
                  {t("zoom.fit")}
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
