/**
 * QR label layout configuration.
 * Shared between the client designer and server PDF generator — no framework imports.
 */

export interface LabelDimension {
  width: number; // mm
  height: number; // mm
}

export type TextAlign = "left" | "center" | "right";
export type TextPosition = "right" | "left" | "above" | "below";
export type LogoBackgroundStyle = "brand" | "circle" | "square";
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

export interface TextLayerConfig {
  show: boolean;
  /** Font size in PDF points */
  size: number;
  bold: boolean;
  align: TextAlign;
}

export interface QrStyleConfig {
  frameShape: QrFrameShape;
  dotStyle: QrDotStyle;
  cornerSquareStyle: QrCornerSquareStyle;
  cornerDotStyle: QrCornerDotStyle;
}

export interface LabelConfig {
  dimension: LabelDimension;
  /** Overlay the Ambra logo in the QR centre */
  includeLogo: boolean;
  /** White clearance shape rendered behind the centre logo */
  logoBackgroundStyle: LogoBackgroundStyle;
  /** QR image height as a fraction of the label height (0.4 – 0.95) */
  qrHeightRatio: number;
  qrStyle: QrStyleConfig;
  showBorder: boolean;
  textPosition: TextPosition;
  primaryText: TextLayerConfig;
  secondaryText: TextLayerConfig;
  tertiaryText: TextLayerConfig;
  /** Append a truncated token below the text block */
  includeTokenPreview: boolean;
}

export interface GridSpec {
  cols: number;
  rows: number;
  perPage: number;
}

export const A4_W_MM = 210;
export const A4_H_MM = 297;
export const GRID_MARGIN_MM = 5;

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
  if (config.textPosition === "above" || config.textPosition === "below") {
    return {
      width: config.dimension.height,
      height: config.dimension.width,
    };
  }

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
  includeLogo: true,
  logoBackgroundStyle: "brand",
  qrHeightRatio: 0.8,
  qrStyle: {
    frameShape: "square",
    dotStyle: "rounded",
    cornerSquareStyle: "extra-rounded",
    cornerDotStyle: "dot",
  },
  showBorder: true,
  textPosition: "right",
  primaryText: { show: true, size: 7, bold: true, align: "left" },
  secondaryText: { show: true, size: 6, bold: false, align: "left" },
  tertiaryText: { show: false, size: 5, bold: false, align: "left" },
  includeTokenPreview: false,
};
