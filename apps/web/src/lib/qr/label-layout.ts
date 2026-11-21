/**
 * Where the QR code, the text and the footer sit on one label. Shared by the
 * PDF, the ZPL bitmap and the designer preview, so all three agree. Works in
 * millimetres on the label as read (portrait labels are rotated for ZPL later).
 * No framework imports.
 */

import type { LabelConfig, LabelFooterSize, QrAlign } from "@/lib/qr/label-config";

export interface LabelBox {
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface LabelLayout {
  qr: { x: number; y: number; size: number };
  /** Area for the text lines; lines are aligned inside it by textVerticalAlign. */
  text: LabelBox | null;
  /** Reserved strip at the bottom of the text area. */
  footer: LabelBox | null;
  /** Faint logo above the footer, at the right of the text area (PDF only). */
  watermark: { x: number; y: number; size: number } | null;
}

export interface LabelLayoutInput {
  /** Label size as read, in mm. */
  width: number;
  height: number;
  /** Height of the text lines in mm, measured by the caller's renderer; 0 for none. */
  textHeight: number;
  /** Whether there are text lines (the footer goes with the text). */
  hasText: boolean;
  /** Reserve room for the watermark logo. */
  watermark: boolean;
}

export const LABEL_GAP_MM = 1.5;
export const FOOTER_GAP_MM = 0.8;
export const FOOTER_HEIGHT_MM: Record<LabelFooterSize, number> = {
  small: 2.4,
  medium: 3.2,
  large: 4.2,
};
/** Footer text height as a share of the footer strip. */
export const FOOTER_FONT_RATIO = 0.62;
/** Width of "www.ambra-system.com" in font sizes, for shrinking it to fit. */
export const FOOTER_TEXT_EMS = 10.5;

export function labelPaddingMm(config: LabelConfig): number {
  return config.innerPaddingMm + (config.showBorder ? config.outerPaddingMm : 0);
}

function aligned(align: QrAlign, start: number, free: number): number {
  const room = Math.max(0, free);
  if (align === "start") return start;
  if (align === "end") return start + room;
  return start + room / 2;
}

export function computeLabelLayout(config: LabelConfig, input: LabelLayoutInput): LabelLayout {
  const pad = labelPaddingMm(config);
  const innerW = Math.max(0, input.width - pad * 2);
  const innerH = Math.max(0, input.height - pad * 2);
  const stacked = config.orientation === "portrait";
  const qrAlign = config.qrAlign ?? "center";

  if (!input.hasText) {
    const size = Math.max(
      0,
      stacked
        ? Math.min(innerH, innerW * config.qrHeightRatio)
        : Math.min(innerW, innerH * config.qrHeightRatio)
    );
    // The QR's free axis is across the label: horizontal when stacked, vertical when side by side.
    return {
      qr: stacked
        ? { x: aligned(qrAlign, pad, innerW - size), y: pad + (innerH - size) / 2, size }
        : { x: pad + (innerW - size) / 2, y: aligned(qrAlign, pad, innerH - size), size },
      text: null,
      footer: null,
      watermark: null,
    };
  }

  const footerH = config.footer.show ? FOOTER_HEIGHT_MM[config.footer.size ?? "small"] : 0;
  const watermarkSize =
    footerH > 0 && input.watermark ? Math.max(3.2, Math.min(innerW, innerH) * 0.145) : 0;
  const reserved =
    footerH > 0
      ? footerH + FOOTER_GAP_MM + (watermarkSize > 0 ? watermarkSize + FOOTER_GAP_MM : 0)
      : 0;

  let qr: LabelLayout["qr"];
  let area: LabelBox;

  if (stacked) {
    const textFirst = config.textPosition === "above" || config.textPosition === "left";
    const available = Math.max(0, innerH - reserved);
    const size = Math.max(
      0,
      Math.min(innerW * config.qrHeightRatio, available - input.textHeight - LABEL_GAP_MM)
    );
    const textH = Math.max(0, available - size - LABEL_GAP_MM);
    const x = aligned(qrAlign, pad, innerW - size);
    if (textFirst) {
      area = { x: pad, y: pad, w: innerW, h: textH + reserved };
      qr = { x, y: pad + textH + LABEL_GAP_MM, size };
    } else {
      qr = { x, y: pad, size };
      area = { x: pad, y: pad + size + LABEL_GAP_MM, w: innerW, h: textH + reserved };
    }
    // The footer belongs at the bottom of the label even when the text is above the QR.
    const footerY = pad + innerH - footerH;
    return {
      qr,
      text: { x: pad, y: area.y, w: innerW, h: textH },
      footer: footerH > 0 ? { x: pad, y: footerY, w: innerW, h: footerH } : null,
      watermark:
        watermarkSize > 0
          ? {
              x: pad + innerW - watermarkSize,
              y: footerY - FOOTER_GAP_MM - watermarkSize,
              size: watermarkSize,
            }
          : null,
    };
  }

  const textLeft = config.textPosition === "left" || config.textPosition === "above";
  const size = Math.max(0, Math.min(innerW, innerH * config.qrHeightRatio));
  const textW = Math.max(0, innerW - size - LABEL_GAP_MM);
  const textX = textLeft ? pad : pad + size + LABEL_GAP_MM;
  qr = {
    x: textLeft ? pad + textW + LABEL_GAP_MM : pad,
    y: aligned(qrAlign, pad, innerH - size),
    size,
  };
  const footerY = pad + innerH - footerH;
  return {
    qr,
    text: { x: textX, y: pad, w: textW, h: Math.max(0, innerH - reserved) },
    footer: footerH > 0 ? { x: textX, y: footerY, w: textW, h: footerH } : null,
    watermark:
      watermarkSize > 0
        ? {
            x: textX + Math.max(0, textW - watermarkSize),
            y: footerY - FOOTER_GAP_MM - watermarkSize,
            size: watermarkSize,
          }
        : null,
  };
}
