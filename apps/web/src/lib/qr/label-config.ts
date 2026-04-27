/**
 * QR label layout configuration.
 * Shared between the client designer and server PDF generator — no framework imports.
 */

export interface LabelDimension {
  width: number; // mm
  height: number; // mm
}

export type TextAlign = "left" | "center" | "right";
export type TextVerticalAlign = "start" | "center" | "end";
export type TextPosition = "right" | "left" | "above" | "below";
export type LabelOrientation = "landscape" | "portrait";
export type LogoBackgroundStyle = "brand" | "circle" | "square";
export type TextLayerKey = "primaryText" | "secondaryText" | "tertiaryText" | "tokenText";
export type QrFrameShape = "square" | "circle";
export type QrDotStyle =
  | "square"
  | "dots"
  | "rounded"
  | "classy"
  | "classy-rounded"
  | "extra-rounded";
export type QrCornerSquareStyle =
  | "square"
  | "dot"
  | "extra-rounded"
  | "dots"
  | "rounded"
  | "classy"
  | "classy-rounded";
export type QrCornerDotStyle =
  | "dot"
  | "square"
  | "dots"
  | "rounded"
  | "classy"
  | "classy-rounded"
  | "extra-rounded";
export type EdgeLineStyle = "solid" | "dotted" | "dashed";

export interface TextLayerConfig {
  show: boolean;
  /** Font size in PDF points */
  size: number;
  bold: boolean;
  align: TextAlign;
}

export interface LabelTextContentConfig {
  secondaryText: string;
  tertiaryText: string;
}

export interface QrStyleConfig {
  frameShape: QrFrameShape;
  dotStyle: QrDotStyle;
  cornerSquareStyle: QrCornerSquareStyle;
  cornerDotStyle: QrCornerDotStyle;
}

export interface EdgeGuideConfig {
  show: boolean;
  thickness: number;
  style: EdgeLineStyle;
  color: string;
  opacity: number;
}

export interface LabelFooterConfig {
  show: boolean;
}

export interface LabelConfig {
  dimension: LabelDimension;
  orientation: LabelOrientation;
  /** Overlay the Ambra logo in the QR centre */
  includeLogo: boolean;
  /** White clearance shape rendered behind the centre logo */
  logoBackgroundStyle: LogoBackgroundStyle;
  /** QR image fraction of the controlling content axis (height in landscape, width in portrait). */
  qrHeightRatio: number;
  qrStyle: QrStyleConfig;
  showBorder: boolean;
  outerPaddingMm: number;
  innerPaddingMm: number;
  textPosition: TextPosition;
  textVerticalAlign: TextVerticalAlign;
  textLayerOrder: TextLayerKey[];
  primaryText: TextLayerConfig;
  secondaryText: TextLayerConfig;
  tertiaryText: TextLayerConfig;
  tokenText: TextLayerConfig;
  textContent: LabelTextContentConfig;
  edgeGuides: EdgeGuideConfig;
  footer: LabelFooterConfig;
}

export interface GridSpec {
  cols: number;
  rows: number;
  perPage: number;
}

export const A4_W_MM = 210;
export const A4_H_MM = 297;
export const GRID_MARGIN_MM = 5;
export const TEXT_LAYER_KEYS: readonly TextLayerKey[] = [
  "primaryText",
  "secondaryText",
  "tertiaryText",
  "tokenText",
];

export function getOrderedTextLayerKeys(
  config: Pick<LabelConfig, "textLayerOrder">
): TextLayerKey[] {
  const seen = new Set<TextLayerKey>();
  const ordered: TextLayerKey[] = [];

  for (const key of config.textLayerOrder) {
    if (!seen.has(key) && TEXT_LAYER_KEYS.includes(key)) {
      seen.add(key);
      ordered.push(key);
    }
  }

  for (const key of TEXT_LAYER_KEYS) {
    if (!seen.has(key)) ordered.push(key);
  }

  return ordered;
}

export interface LabelPreset {
  label: string;
  dim: LabelDimension;
}

export const LABEL_PRESETS: readonly LabelPreset[] = [
  { label: "30×20", dim: { width: 30, height: 20 } },
  { label: "50×30", dim: { width: 50, height: 30 } },
  { label: "70×40", dim: { width: 70, height: 40 } },
  { label: "100×60", dim: { width: 100, height: 60 } },
];

export function getEffectiveLabelDimension(config: LabelConfig): LabelDimension {
  return config.dimension;
}

export function computeGrid(dim: LabelDimension): GridSpec {
  const usableW = A4_W_MM - GRID_MARGIN_MM * 2;
  const usableH = A4_H_MM - GRID_MARGIN_MM * 2;
  const cols = Math.max(1, Math.floor(usableW / dim.width));
  const rows = Math.max(1, Math.floor(usableH / dim.height));
  return { cols, rows, perPage: cols * rows };
}

export const DEFAULT_LABEL_CONFIG: LabelConfig = {
  dimension: { width: 50, height: 30 },
  orientation: "landscape",
  includeLogo: true,
  logoBackgroundStyle: "brand",
  qrHeightRatio: 1,
  qrStyle: {
    frameShape: "square",
    dotStyle: "rounded",
    cornerSquareStyle: "extra-rounded",
    cornerDotStyle: "dot",
  },
  showBorder: true,
  outerPaddingMm: 1.5,
  innerPaddingMm: 1.5,
  textPosition: "right",
  textVerticalAlign: "center",
  textLayerOrder: [...TEXT_LAYER_KEYS],
  primaryText: { show: true, size: 7, bold: true, align: "left" },
  secondaryText: { show: true, size: 6, bold: false, align: "left" },
  tertiaryText: { show: false, size: 5, bold: false, align: "left" },
  tokenText: { show: false, size: 5, bold: false, align: "left" },
  textContent: {
    secondaryText: "",
    tertiaryText: "",
  },
  edgeGuides: {
    show: true,
    thickness: 0.5,
    style: "dashed",
    color: "#94a3b8",
    opacity: 0.9,
  },
  footer: {
    show: true,
  },
};

export function getAllowedTextPositions(
  orientation: LabelOrientation
): readonly [TextPosition, TextPosition] {
  return orientation === "portrait" ? ["above", "below"] : ["right", "left"];
}
