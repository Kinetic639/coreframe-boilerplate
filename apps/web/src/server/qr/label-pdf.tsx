import "server-only";

import React from "react";
import {
  Document,
  Page,
  View,
  Text,
  Image,
  Svg,
  Path,
  StyleSheet,
  renderToBuffer,
} from "@react-pdf/renderer";
import type { LabelConfig } from "@/lib/qr/label-config";
import { computeGrid, GRID_MARGIN_MM } from "@/lib/qr/label-config";

// ---------------------------------------------------------------------------
// Public types
// ---------------------------------------------------------------------------

export type QrLabelSize = "50x30" | "70x40" | "a4-grid";

export interface QrLabelPdfItem {
  qrCodeId: string;
  token: string;
  /** Pre-generated base64 PNG data URL (`data:image/png;base64,...`) */
  qrDataUrl: string;
  /** Main label line — typically the location name */
  primaryText: string;
  /** Second line — e.g. location code */
  secondaryText?: string;
  /** Third line — e.g. module/type context */
  tertiaryText?: string;
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
}: {
  dataUrl: string;
  size: number;
  includeLogo?: boolean;
}) {
  if (!includeLogo) {
    return <Image style={{ width: size, height: size }} src={dataUrl} />;
  }
  const logoSize = Math.round(size * 0.28);
  const offset = (size - logoSize) / 2;

  return (
    <View style={{ width: size, height: size }}>
      <Image
        style={{ width: size, height: size, position: "absolute", top: 0, left: 0 }}
        src={dataUrl}
      />
      <View
        style={{
          position: "absolute",
          top: offset,
          left: offset,
          width: logoSize,
          height: logoSize,
        }}
      >
        {/* Single SVG: white A-shaped background then logo paths on top */}
        <Svg style={{ width: logoSize, height: logoSize }} viewBox="0 0 56 56">
          {/* White triangle (A silhouette) with rounded corners — provides background clearance */}
          <Path
            d="M28 5 L5 53 L51 53 Z"
            fill="white"
            stroke="white"
            strokeWidth={5}
            strokeLinejoin="round"
          />
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
    fontSize: 7,
    fontWeight: "bold",
    color: "#111111",
    marginBottom: mm(0.5),
  },
  secondary: {
    fontSize: 6,
    color: "#444444",
    marginBottom: mm(0.3),
  },
  tertiary: {
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

function LabelCellV2({ item, config, cellWPt, cellHPt }: LabelCellV2Props) {
  const qrSizePt = cellHPt * config.qrHeightRatio;
  const borderStyle = config.showBorder
    ? { borderWidth: 0.5, borderColor: "#cccccc", borderStyle: "solid" as const }
    : {};

  return (
    <View
      style={{
        width: cellWPt,
        height: cellHPt,
        flexDirection: "row",
        alignItems: "center",
        padding: mm(1.5),
        overflow: "hidden",
        ...borderStyle,
      }}
    >
      <QrWithLogo dataUrl={item.qrDataUrl} size={qrSizePt} includeLogo={config.includeLogo} />
      <View style={{ flex: 1, marginLeft: mm(1.5), justifyContent: "center" }}>
        {config.primaryText.show && item.primaryText ? (
          <Text
            style={{
              fontSize: config.primaryText.size,
              fontWeight: config.primaryText.bold ? "bold" : "normal",
              color: "#111111",
              marginBottom: mm(0.4),
            }}
          >
            {item.primaryText}
          </Text>
        ) : null}
        {config.secondaryText.show && item.secondaryText ? (
          <Text
            style={{
              fontSize: config.secondaryText.size,
              fontWeight: config.secondaryText.bold ? "bold" : "normal",
              color: "#444444",
              marginBottom: mm(0.3),
            }}
          >
            {item.secondaryText}
          </Text>
        ) : null}
        {config.tertiaryText.show && item.tertiaryText ? (
          <Text
            style={{
              fontSize: config.tertiaryText.size,
              fontWeight: config.tertiaryText.bold ? "bold" : "normal",
              color: "#888888",
              marginBottom: mm(0.2),
            }}
          >
            {item.tertiaryText}
          </Text>
        ) : null}
        {config.includeTokenPreview ? (
          <Text style={{ fontSize: 5, color: "#aaaaaa", marginTop: mm(0.5) }}>
            {item.token.slice(0, 10)}
          </Text>
        ) : null}
      </View>
    </View>
  );
}

function ConfigA4Document({ items, config }: { items: QrLabelPdfItem[]; config: LabelConfig }) {
  const { cols, perPage } = computeGrid(config.dimension);
  const cellWPt = mm(config.dimension.width);
  const cellHPt = mm(config.dimension.height);
  const marginPt = mm(GRID_MARGIN_MM);

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
  return renderToBuffer(<ConfigA4Document items={items} config={config} />);
}
