/**
 * ZPL label generator for Zebra GK420t (203 dpi).
 *
 * 203 dpi ≈ 8 dots per mm.
 * Each label is one ^XA...^XZ block.
 * Concatenate all blocks for a multi-label print job.
 *
 * Supported sizes: 50×30 mm and 70×40 mm only.
 * a4-grid is a PDF concept — not applicable to thermal printers.
 */

export type ZplLabelSize = "50x30" | "70x40";

export interface ZplLabelItem {
  /** The opaque token encoded into the QR barcode. */
  token: string;
  /** Human label printed as text on the sticker (optional). */
  label?: string | null;
  /** When true, first 8 chars of token are printed beneath the QR. */
  includeTokenPreview?: boolean;
}

// 203 dpi: 1 mm = 8 dots (203 / 25.4 ≈ 7.992)
const DOTS_PER_MM = 8;

const SIZE_CONFIG = {
  "50x30": { widthMm: 50, heightMm: 30, qrMag: 4 },
  "70x40": { widthMm: 70, heightMm: 40, qrMag: 5 },
} as const;

function mm(value: number): number {
  return Math.round(value * DOTS_PER_MM);
}

function singleLabel(item: ZplLabelItem, size: ZplLabelSize): string {
  const { widthMm, heightMm, qrMag } = SIZE_CONFIG[size];
  const wDots = mm(widthMm);
  const hDots = mm(heightMm);

  const margin = mm(1.5);
  const qrX = margin;
  const qrY = margin;

  // Estimated QR width: modules × magnification.
  // For 22-char base64url with error correction H, QR is ~33 modules wide.
  const estimatedQrDots = 33 * qrMag;

  const lines: string[] = [];
  lines.push("^XA");
  lines.push(`^PW${wDots}`);
  lines.push(`^LL${hDots}`);

  // QR barcode — error correction H (HA = High, Auto mask)
  lines.push(`^FO${qrX},${qrY}^BQN,2,${qrMag}^FDHA,${item.token}^FS`);

  // Text block to the right of the QR
  const textX = qrX + estimatedQrDots + mm(2);
  const availableTextWidth = wDots - textX - margin;

  if (availableTextWidth > mm(5)) {
    const labelFontSize = size === "50x30" ? 22 : 28;
    const previewFontSize = size === "50x30" ? 18 : 22;

    let textY = qrY;

    if (item.label) {
      // Wrap long labels by truncating to fit
      const maxChars = Math.floor(availableTextWidth / (labelFontSize * 0.6));
      const displayLabel =
        item.label.length > maxChars ? item.label.slice(0, maxChars - 1) + "…" : item.label;
      lines.push(`^FO${textX},${textY}^A0N,${labelFontSize},${labelFontSize}^FD${displayLabel}^FS`);
      textY += labelFontSize + mm(1);
    }

    if (item.includeTokenPreview) {
      const preview = item.token.slice(0, 8);
      lines.push(`^FO${textX},${textY}^A0N,${previewFontSize},${previewFontSize}^FD${preview}^FS`);
    }
  }

  lines.push("^XZ");
  return lines.join("\n");
}

/**
 * Generate a ZPL string containing one label block per item.
 * Returns the full ZPL document as a plain string (UTF-8, text/plain).
 *
 * @throws when items array is empty
 */
export function generateZplLabels(items: ZplLabelItem[], size: ZplLabelSize): string {
  if (items.length === 0) throw new Error("Cannot generate ZPL with no labels.");
  return items.map((item) => singleLabel(item, size)).join("\n");
}
