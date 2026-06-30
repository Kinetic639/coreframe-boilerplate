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
export type TextLineSource = "custom" | "field";
export type TextCaseTransform = "none" | "upper" | "lower" | "title";
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

/**
 * A single printable line on the label.
 *
 * `source: "custom"` — the user types arbitrary text (customText), case is
 * exactly what they typed.
 * `source: "field"` — the line is bound to a data field supplied by the
 * caller (e.g. location name, location code, QR token, scan URL); the
 * caseTransform controls how that field's value is rendered, since the
 * underlying data may not already be in the desired case.
 */
export interface TextLineConfig {
  id: string;
  source: TextLineSource;
  customText: string;
  fieldKey: string;
  caseTransform: TextCaseTransform;
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
  textLines: TextLineConfig[];
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
export const MAX_TEXT_LINES = 8;

/**
 * Canonical field keys callers can bind a text line to. Every LabelDesigner
 * caller maps its own data onto these keys when building export items
 * (e.g. QR codes use their `.label` for "primary"; locations use their
 * `.name`). Keeps DEFAULT_LABEL_CONFIG meaningful across all label contexts.
 */
export const PRIMARY_FIELD_KEY = "primary";
export const SECONDARY_FIELD_KEY = "secondary";
export const TOKEN_FIELD_KEY = "token";
export const SCAN_URL_FIELD_KEY = "scanUrl";

export function applyCaseTransform(text: string, transform: TextCaseTransform): string {
  switch (transform) {
    case "upper":
      return text.toUpperCase();
    case "lower":
      return text.toLowerCase();
    case "title":
      return text.replace(/\w\S*/g, (word) => word[0].toUpperCase() + word.slice(1).toLowerCase());
    default:
      return text;
  }
}

function makeTextLine(
  partial: Partial<TextLineConfig> & Pick<TextLineConfig, "id">
): TextLineConfig {
  return {
    source: "custom",
    customText: "",
    fieldKey: "",
    caseTransform: "none",
    size: 6,
    bold: false,
    align: "left",
    ...partial,
  };
}

export function createTextLine(
  overrides: Partial<Omit<TextLineConfig, "id">> = {}
): TextLineConfig {
  return makeTextLine({ id: crypto.randomUUID(), ...overrides });
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
  textLines: [
    makeTextLine({
      id: "default-primary",
      source: "field",
      fieldKey: PRIMARY_FIELD_KEY,
      size: 7,
      bold: true,
    }),
    makeTextLine({
      id: "default-secondary",
      source: "field",
      fieldKey: SECONDARY_FIELD_KEY,
      size: 6,
    }),
  ],
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
