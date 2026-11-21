import "server-only";

import React from "react";
import path from "path";
import {
  Document,
  Page,
  View,
  Text,
  Image,
  Svg,
  Path,
  Circle,
  Rect,
  Line,
  StyleSheet,
  Font,
  renderToBuffer,
} from "@react-pdf/renderer";
import type { LabelConfig } from "@/lib/qr/label-config";
import { computeLabelLayout, FOOTER_FONT_RATIO, FOOTER_TEXT_EMS } from "@/lib/qr/label-layout";
import {
  computeGrid,
  getEffectiveLabelDimension,
  applyCaseTransform,
  GRID_MARGIN_MM,
} from "@/lib/qr/label-config";

// ---------------------------------------------------------------------------
// Font registration — the default PDF standard fonts (Helvetica) only cover
// WinAnsi encoding and silently mangle Polish diacritics (ł, ą, ę, ó, ś, ...).
// Register a real Unicode-coverage font so label text renders correctly.
// ---------------------------------------------------------------------------

let fontsRegisteredPromise: Promise<void> | null = null;

function ensureFontsRegistered(): Promise<void> {
  if (!fontsRegisteredPromise) {
    fontsRegisteredPromise = (async () => {
      if (process.env.NODE_ENV === "test") return;
      // Node.js's built-in fetch (undici) does not support file:// URLs, so we
      // read the TTFs ourselves and pass them as base64 data URLs instead.
      const { readFile } = await import("fs/promises");
      const fontsDir = path.join(process.cwd(), "public", "fonts");
      const [regular, bold] = await Promise.all([
        readFile(path.join(fontsDir, "Roboto-Regular.ttf")),
        readFile(path.join(fontsDir, "Roboto-Bold.ttf")),
      ]);
      Font.register({
        family: "Roboto",
        fonts: [
          { src: `data:font/truetype;base64,${regular.toString("base64")}`, fontWeight: "normal" },
          { src: `data:font/truetype;base64,${bold.toString("base64")}`, fontWeight: "bold" },
        ],
      });
      Font.registerHyphenationCallback((word) => [word]);
    })();
  }
  return fontsRegisteredPromise;
}

// ---------------------------------------------------------------------------
// Font helpers
// ---------------------------------------------------------------------------

/** undefined in test env so react-pdf never issues a font fetch that MSW would block */
const ROBOTO = process.env.NODE_ENV === "test" ? undefined : "Roboto";

// ---------------------------------------------------------------------------
// Public types
// ---------------------------------------------------------------------------

export type QrLabelSize = "50x30" | "70x40" | "a4-grid";

export interface QrLabelPdfItem {
  qrCodeId: string;
  token: string;
  /** Pre-generated QR image data URL (PNG or SVG) */
  qrDataUrl: string;
  /** Main label line — typically the location name. Used by the legacy fixed-template generator (generateQrLabelsPdf). */
  primaryText: string;
  /** Second line — e.g. location code. Used by the legacy fixed-template generator. */
  secondaryText?: string;
  /** Third line — e.g. module/type context. Used by the legacy fixed-template generator. */
  tertiaryText?: string;
  /**
   * Resolvable data fields for config-driven text lines (generateQrLabelsPdfWithConfig).
   * Keys are caller-defined (e.g. "primary", "secondary", "token", "scanUrl").
   */
  fields?: Record<string, string>;
}

export interface GenerateQrLabelsPdfInput {
  items: QrLabelPdfItem[];
  size: QrLabelSize;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Convert mm to PDF points (1 mm = 2.83465 pt) */
const mm = (value: number) => value * 2.83465;
// ---------------------------------------------------------------------------
// Ambra logo overlay — pure SVG paths from BrandStampPureBw
// Rendered as a centered circle over the QR image (error correction H handles obscured area).
// ---------------------------------------------------------------------------

function QrWithLogo({
  dataUrl,
  size,
  includeLogo = true,
  logoBackgroundStyle = "brand",
}: {
  dataUrl: string;
  size: number;
  includeLogo?: boolean;
  logoBackgroundStyle?: LabelConfig["logoBackgroundStyle"];
}) {
  if (!includeLogo) {
    return <Image style={{ width: size, height: size }} src={dataUrl} />;
  }
  const backgroundSize = Math.round(size * 0.3);
  const backgroundOffset = (size - backgroundSize) / 2;
  const logoInsetRatio =
    logoBackgroundStyle === "brand" ? 0.1 : logoBackgroundStyle === "circle" ? 0.19 : 0.18;
  const logoSize = Math.round(backgroundSize * (1 - logoInsetRatio * 2));
  const logoOffset = backgroundOffset + (backgroundSize - logoSize) / 2;

  return (
    <View style={{ width: size, height: size }}>
      <Image
        style={{ width: size, height: size, position: "absolute", top: 0, left: 0 }}
        src={dataUrl}
      />
      <View
        style={{
          position: "absolute",
          top: backgroundOffset,
          left: backgroundOffset,
          width: backgroundSize,
          height: backgroundSize,
        }}
      >
        <Svg style={{ width: backgroundSize, height: backgroundSize }} viewBox="0 0 56 56">
          {logoBackgroundStyle === "brand" ? (
            <Path
              d="M28 5 L5 53 L51 53 Z"
              fill="white"
              stroke="white"
              strokeWidth={5}
              strokeLinejoin="round"
            />
          ) : null}
          {logoBackgroundStyle === "circle" ? <Circle cx="28" cy="28" r="23" fill="white" /> : null}
          {logoBackgroundStyle === "square" ? (
            <Rect x="7" y="7" width="42" height="42" rx="5" ry="5" fill="white" />
          ) : null}
        </Svg>
      </View>
      <View
        style={{
          position: "absolute",
          top: logoOffset,
          left: logoOffset,
          width: logoSize,
          height: logoSize,
        }}
      >
        <Svg style={{ width: logoSize, height: logoSize }} viewBox="0 0 56 56">
          <Path d="M28 5 L5 53 L16 53 L28 29 Z" fill="#000000" />
          <Path d="M28 5 L51 53 L40 53 L28 29 Z" fill="#000000" />
          <Path d="M28 7.5 L22 20 L28 29 L34 20 Z" fill="#ffffff" />
          <Path
            d="M10.3 29.6 L13.1 33 M42.9 33 L45.7 29.6"
            stroke="#000000"
            strokeWidth={2}
            strokeLinecap="round"
            fill="none"
          />
          <Path
            d="M14 34 L28 51 L42 34"
            stroke="#000000"
            strokeWidth={2}
            strokeLinejoin="round"
            strokeLinecap="round"
            fill="none"
          />
          <Path
            d="M14.4 34.5 L20.9 42.2 M35.1 42.2 L41.6 34.5"
            stroke="#ffffff"
            strokeWidth={1.45}
            strokeLinejoin="round"
            strokeLinecap="round"
            fill="none"
          />
        </Svg>
      </View>
    </View>
  );
}

// ---------------------------------------------------------------------------
// Individual label component (shared across all sizes)
// ---------------------------------------------------------------------------

interface LabelCellProps {
  item: QrLabelPdfItem;
  width: number;
  height: number;
  /** QR image size in pt */
  qrSize: number;
}

const S = StyleSheet.create({
  cell: {
    flexDirection: "row",
    alignItems: "center",
    borderWidth: 0.5,
    borderColor: "#cccccc",
    borderStyle: "solid",
    padding: mm(1.5),
    overflow: "hidden",
  },
  qrImage: {
    flexShrink: 0, // kept for future direct Image use
  },
  textBlock: {
    flex: 1,
    marginLeft: mm(2),
    justifyContent: "center",
  },
  primary: {
    fontFamily: ROBOTO,
    fontSize: 7,
    fontWeight: "bold",
    color: "#111111",
    marginBottom: mm(0.5),
  },
  secondary: {
    fontFamily: ROBOTO,
    fontSize: 6,
    color: "#444444",
    marginBottom: mm(0.3),
  },
  tertiary: {
    fontFamily: ROBOTO,
    fontSize: 5,
    color: "#888888",
  },
});

function LabelCell({ item, width, height, qrSize }: LabelCellProps) {
  return (
    <View style={[S.cell, { width, height }]}>
      <QrWithLogo dataUrl={item.qrDataUrl} size={qrSize} />
      <View style={S.textBlock}>
        <Text style={S.primary}>{item.primaryText}</Text>
        {item.secondaryText ? <Text style={S.secondary}>{item.secondaryText}</Text> : null}
        {item.tertiaryText ? <Text style={S.tertiary}>{item.tertiaryText}</Text> : null}
      </View>
    </View>
  );
}

// ---------------------------------------------------------------------------
// Per-size document components
// ---------------------------------------------------------------------------

/** 50×30 mm — one label per page */
function Label50x30Document({ items }: { items: QrLabelPdfItem[] }) {
  const w = mm(50);
  const h = mm(30);
  return (
    <Document>
      {items.map((item) => (
        <Page key={item.qrCodeId} size={[w, h]} style={{ margin: 0, padding: 0 }}>
          <LabelCell item={item} width={w} height={h} qrSize={mm(24)} />
        </Page>
      ))}
    </Document>
  );
}

/** 70×40 mm — one label per page */
function Label70x40Document({ items }: { items: QrLabelPdfItem[] }) {
  const w = mm(70);
  const h = mm(40);
  return (
    <Document>
      {items.map((item) => (
        <Page key={item.qrCodeId} size={[w, h]} style={{ margin: 0, padding: 0 }}>
          <LabelCell item={item} width={w} height={h} qrSize={mm(34)} />
        </Page>
      ))}
    </Document>
  );
}

/**
 * A4 grid — 4 columns × 7 rows = 28 labels per page.
 * Cell size: ~50mm × ~41mm so labels remain scan-friendly at scale.
 */
const GRID_COLS = 4;
const GRID_ROWS = 7;
const LABELS_PER_PAGE = GRID_COLS * GRID_ROWS;

const A4_W = mm(210);
const A4_H = mm(297);
const A4_MARGIN = mm(5);
const CELL_W = (A4_W - A4_MARGIN * 2) / GRID_COLS;
const CELL_H = (A4_H - A4_MARGIN * 2) / GRID_ROWS;
const GRID_QR_SIZE = CELL_H * 0.75; // QR takes 75% of cell height

const gridStyles = StyleSheet.create({
  page: {
    flexDirection: "column",
    padding: A4_MARGIN,
  },
  row: {
    flexDirection: "row",
  },
});

function A4GridDocument({ items }: { items: QrLabelPdfItem[] }) {
  const pages: QrLabelPdfItem[][] = [];
  for (let i = 0; i < items.length; i += LABELS_PER_PAGE) {
    pages.push(items.slice(i, i + LABELS_PER_PAGE));
  }

  return (
    <Document>
      {pages.map((pageItems, pageIdx) => {
        const rows: QrLabelPdfItem[][] = [];
        for (let i = 0; i < pageItems.length; i += GRID_COLS) {
          rows.push(pageItems.slice(i, i + GRID_COLS));
        }
        return (
          <Page key={pageIdx} size="A4" style={gridStyles.page}>
            {rows.map((row, rowIdx) => (
              <View key={rowIdx} style={gridStyles.row}>
                {row.map((item) => (
                  <LabelCell
                    key={item.qrCodeId}
                    item={item}
                    width={CELL_W}
                    height={CELL_H}
                    qrSize={GRID_QR_SIZE}
                  />
                ))}
              </View>
            ))}
          </Page>
        );
      })}
    </Document>
  );
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Generates a PDF buffer containing QR labels at the requested size.
 *
 * @throws if `input.items` is empty
 * @throws if `renderToBuffer` fails (propagated to caller)
 */
export async function generateQrLabelsPdf(input: GenerateQrLabelsPdfInput): Promise<Buffer> {
  if (input.items.length === 0) {
    throw new Error("Cannot generate a PDF with no labels.");
  }

  await ensureFontsRegistered();

  let document: React.ReactElement;

  switch (input.size) {
    case "50x30":
      document = <Label50x30Document items={input.items} />;
      break;
    case "70x40":
      document = <Label70x40Document items={input.items} />;
      break;
    case "a4-grid":
      document = <A4GridDocument items={input.items} />;
      break;
    default: {
      const _exhaustive: never = input.size;
      throw new Error(`Unsupported label size: ${_exhaustive}`);
    }
  }

  return renderToBuffer(document);
}

// ---------------------------------------------------------------------------
// Config-driven generator (used by /api/qr/export with LabelConfig)
// ---------------------------------------------------------------------------

interface LabelCellV2Props {
  item: QrLabelPdfItem;
  config: LabelConfig;
  cellWPt: number;
  cellHPt: number;
}

const LINE_COLORS = ["#111111", "#444444", "#888888", "#aaaaaa"];

function getVisibleTextLines(item: QrLabelPdfItem, config: LabelConfig) {
  const lines: Array<{
    key: string;
    text: string;
    size: number;
    weight: "bold" | "normal";
    color: string;
    align: "left" | "center" | "right";
    marginBottom: number;
  }> = [];

  config.textLines.forEach((line, index) => {
    const raw = line.source === "custom" ? line.customText : (item.fields?.[line.fieldKey] ?? "");
    const text = applyCaseTransform(raw.trim(), line.caseTransform);
    if (!text) return;

    lines.push({
      key: line.id,
      text,
      size: line.size,
      weight: line.bold ? "bold" : "normal",
      color: LINE_COLORS[Math.min(index, LINE_COLORS.length - 1)],
      align: line.align,
      marginBottom: mm(0.3),
    });
  });

  return lines;
}

function estimatePdfTextHeight(lines: Array<{ size: number; marginBottom: number }>) {
  return lines.reduce((sum, line, index) => {
    return sum + line.size + (index === lines.length - 1 ? 0 : line.marginBottom);
  }, 0);
}

function getPdfDashArray(style: LabelConfig["edgeGuides"]["style"]) {
  if (style === "dotted") return "1 2";
  if (style === "dashed") return "3 2";
  return undefined;
}

/** Footer text size: a share of the strip, shrunk to fit the strip's width. */
function footerFontSize(width: number, height: number) {
  return Math.min(height * FOOTER_FONT_RATIO, width / FOOTER_TEXT_EMS);
}

function LabelFooterUrl({ widthPt, heightPt }: { widthPt: number; heightPt: number }) {
  return (
    <View style={{ width: widthPt, height: heightPt, justifyContent: "center" }}>
      <Text
        style={{
          fontFamily: ROBOTO,
          fontSize: footerFontSize(widthPt, heightPt),
          color: "#666666",
          textAlign: "center",
        }}
      >
        www.ambra-system.com
      </Text>
    </View>
  );
}

function LabelWatermarkLogo({ sizePt }: { sizePt: number }) {
  return (
    <Svg style={{ width: sizePt, height: sizePt }} viewBox="0 0 56 56">
      <Path d="M28 5 L5 53 L16 53 L28 29 Z" fill="#0f172a" fillOpacity={0.1} />
      <Path d="M28 5 L51 53 L40 53 L28 29 Z" fill="#1e293b" fillOpacity={0.1} />
      <Path d="M28 7.5 L22 20 L28 29 L34 20 Z" fill="#475569" fillOpacity={0.1} />
      <Path
        d="M14 34 L28 51 L42 34"
        stroke="#334155"
        strokeOpacity={0.1}
        strokeWidth={2}
        strokeLinejoin="round"
        strokeLinecap="round"
        fill="none"
      />
    </Svg>
  );
}

function LabelCellV2({ item, config, cellWPt, cellHPt }: LabelCellV2Props) {
  const lines = getVisibleTextLines(item, config);
  const hasText = lines.length > 0;
  const textHeightPt = hasText ? estimatePdfTextHeight(lines) : 0;
  const borderInsetPt = mm(config.outerPaddingMm);
  const ptPerMm = mm(1);
  const layout = computeLabelLayout(config, {
    width: cellWPt / ptPerMm,
    height: cellHPt / ptPerMm,
    textHeight: textHeightPt / ptPerMm,
    hasText,
    watermark: true,
  });
  const qr = { x: mm(layout.qr.x), y: mm(layout.qr.y), size: mm(layout.qr.size) };

  return (
    <View style={{ width: cellWPt, height: cellHPt, overflow: "hidden" }}>
      {config.showBorder ? (
        <View
          style={{
            position: "absolute",
            top: borderInsetPt,
            left: borderInsetPt,
            width: Math.max(0, cellWPt - borderInsetPt * 2),
            height: Math.max(0, cellHPt - borderInsetPt * 2),
            borderWidth: 0.5,
            borderColor: "#cccccc",
            borderStyle: "solid",
          }}
        />
      ) : null}
      <View
        style={{ position: "absolute", left: qr.x, top: qr.y, width: qr.size, height: qr.size }}
      >
        <QrWithLogo
          dataUrl={item.qrDataUrl}
          size={qr.size}
          includeLogo={config.includeLogo}
          logoBackgroundStyle={config.logoBackgroundStyle}
        />
      </View>
      {layout.text ? (
        <View
          style={{
            position: "absolute",
            left: mm(layout.text.x),
            top: mm(layout.text.y),
            width: mm(layout.text.w),
            height: mm(layout.text.h),
            justifyContent:
              config.textVerticalAlign === "start"
                ? "flex-start"
                : config.textVerticalAlign === "end"
                  ? "flex-end"
                  : "center",
          }}
        >
          {lines.map((line, index) => (
            <Text
              key={line.key}
              style={{
                fontFamily: ROBOTO,
                fontSize: line.size,
                fontWeight: line.weight,
                color: line.color,
                textAlign: line.align,
                marginBottom: index === lines.length - 1 ? 0 : line.marginBottom,
              }}
            >
              {line.text}
            </Text>
          ))}
        </View>
      ) : null}
      {layout.watermark ? (
        <View
          style={{
            position: "absolute",
            left: mm(layout.watermark.x),
            top: mm(layout.watermark.y),
            width: mm(layout.watermark.size),
            height: mm(layout.watermark.size),
          }}
        >
          <LabelWatermarkLogo sizePt={mm(layout.watermark.size)} />
        </View>
      ) : null}
      {layout.footer ? (
        <View
          style={{
            position: "absolute",
            left: mm(layout.footer.x),
            top: mm(layout.footer.y),
            width: mm(layout.footer.w),
            height: mm(layout.footer.h),
          }}
        >
          <LabelFooterUrl widthPt={mm(layout.footer.w)} heightPt={mm(layout.footer.h)} />
        </View>
      ) : null}
    </View>
  );
}

function ConfigA4Document({ items, config }: { items: QrLabelPdfItem[]; config: LabelConfig }) {
  const effectiveDimension = getEffectiveLabelDimension(config);
  const { cols, rows, perPage } = computeGrid(effectiveDimension);
  const cellWPt = mm(effectiveDimension.width);
  const cellHPt = mm(effectiveDimension.height);
  const marginPt = mm(GRID_MARGIN_MM);
  const guideDashArray = getPdfDashArray(config.edgeGuides.style);
  const gridWidthPt = cellWPt * cols;
  const gridHeightPt = cellHPt * rows;

  const pages: QrLabelPdfItem[][] = [];
  for (let i = 0; i < items.length; i += perPage) {
    pages.push(items.slice(i, i + perPage));
  }

  return (
    <Document>
      {pages.map((pageItems, pageIdx) => {
        const rowGroups: QrLabelPdfItem[][] = [];
        for (let i = 0; i < pageItems.length; i += cols) {
          rowGroups.push(pageItems.slice(i, i + cols));
        }
        return (
          <Page key={pageIdx} size="A4" style={{ flexDirection: "column", padding: marginPt }}>
            {config.edgeGuides.show ? (
              <Svg
                style={{
                  position: "absolute",
                  top: marginPt,
                  left: marginPt,
                  width: gridWidthPt,
                  height: gridHeightPt,
                }}
                viewBox={`0 0 ${gridWidthPt} ${gridHeightPt}`}
              >
                {Array.from({ length: cols + 1 }, (_, index) => {
                  const x = index * cellWPt;
                  return (
                    <Line
                      key={`v-${index}`}
                      x1={x}
                      y1={0}
                      x2={x}
                      y2={gridHeightPt}
                      stroke={config.edgeGuides.color}
                      strokeOpacity={config.edgeGuides.opacity}
                      strokeWidth={config.edgeGuides.thickness}
                      strokeDasharray={guideDashArray}
                    />
                  );
                })}
                {Array.from({ length: rows + 1 }, (_, index) => {
                  const y = index * cellHPt;
                  return (
                    <Line
                      key={`h-${index}`}
                      x1={0}
                      y1={y}
                      x2={gridWidthPt}
                      y2={y}
                      stroke={config.edgeGuides.color}
                      strokeOpacity={config.edgeGuides.opacity}
                      strokeWidth={config.edgeGuides.thickness}
                      strokeDasharray={guideDashArray}
                    />
                  );
                })}
              </Svg>
            ) : null}
            {rowGroups.map((rowItems, rowIdx) => (
              <View key={rowIdx} style={{ flexDirection: "row" }}>
                {rowItems.map((item) => (
                  <LabelCellV2
                    key={item.qrCodeId}
                    item={item}
                    config={config}
                    cellWPt={cellWPt}
                    cellHPt={cellHPt}
                  />
                ))}
              </View>
            ))}
          </Page>
        );
      })}
    </Document>
  );
}

/**
 * Generates a PDF buffer using the rich LabelConfig.
 * Output is always A4 with a computed grid based on `config.dimension`.
 *
 * @throws if `items` is empty
 */
export async function generateQrLabelsPdfWithConfig(
  items: QrLabelPdfItem[],
  config: LabelConfig
): Promise<Buffer> {
  if (items.length === 0) {
    throw new Error("Cannot generate a PDF with no labels.");
  }
  await ensureFontsRegistered();
  return renderToBuffer(<ConfigA4Document items={items} config={config} />);
}
