import type { CanvasRenderingContext2D } from "canvas";
import path from "path";
import type { LabelConfig } from "@/lib/qr/label-config";
import { applyCaseTransform, zplPrintSettings } from "@/lib/qr/label-config";
import QRCode from "qrcode";
import { computeLabelLayout, FOOTER_FONT_RATIO } from "@/lib/qr/label-layout";
import { buildQrScanUrl } from "@/lib/qr/generate";

/**
 * ZPL label generator for Zebra GK420t (203 dpi).
 *
 * Instead of relying on Zebra's native QR command, we render the full label
 * as a monochrome bitmap and embed it with ^GFA, so thermal labels share the
 * logo/text layout controls of the PDF designer at fixed thermal sizes.
 *
 * The QR itself is drawn module by module on the printer's dot grid: square
 * modules of a whole number of dots, no scaling or rounded styles, and a
 * lower error correction than the PDF (M, or Q under a logo). A scaled styled
 * image gave modules of ~4.7 dots with blurred edges, which the thermal head
 * printed unevenly on a dense code.
 */

const LABEL_FONT_FAMILY = "LabelRoboto";
let fontsRegisteredPromise: Promise<void> | null = null;

/**
 * "Arial" isn't installed on this server — node-canvas silently falls back
 * to a default font lacking Polish diacritics (ł, ą, ę, ó, ś, ...), which
 * renders mangled glyphs. Register a bundled Unicode-coverage font instead.
 */
function ensureFontsRegistered(): Promise<void> {
  if (!fontsRegisteredPromise) {
    fontsRegisteredPromise = (async () => {
      const { registerFont } = await import("canvas");
      const fontsDir = path.join(process.cwd(), "public", "fonts");
      registerFont(path.join(fontsDir, "Roboto-Regular.ttf"), {
        family: LABEL_FONT_FAMILY,
        weight: "500",
      });
      registerFont(path.join(fontsDir, "Roboto-Bold.ttf"), {
        family: LABEL_FONT_FAMILY,
        weight: "700",
      });
    })();
  }
  return fontsRegisteredPromise;
}

export type ZplLabelSize = "50x30" | "70x40";

export interface ZplLabelItem {
  token: string;
  /** Resolvable data fields for config-driven text lines. Keys are caller-defined. */
  fields?: Record<string, string>;
}

const DOTS_PER_MM = 8;
/** White modules kept around the code (the label padding adds to it) */
const QR_QUIET_MODULES = 2;
const DOTS_PER_PT = 203 / 72;
const SIZE_CONFIG = {
  "50x30": { widthMm: 50, heightMm: 30 },
  "70x40": { widthMm: 70, heightMm: 40 },
} as const;

function mm(value: number): number {
  return Math.round(value * DOTS_PER_MM);
}

function pt(value: number): number {
  return Math.max(8, Math.round(value * DOTS_PER_PT));
}

function hasVisibleText(item: ZplLabelItem, config: LabelConfig) {
  return getVisibleTextLines(item, config).length > 0;
}

function estimateTextHeight(lines: Array<{ size: number }>) {
  return lines.reduce((sum, line, index) => {
    const fontSize = pt(line.size);
    const lineGap = Math.max(4, Math.round(fontSize * 0.22));
    return sum + fontSize + (index === lines.length - 1 ? 0 : lineGap);
  }, 0);
}

function getVisibleTextLines(item: ZplLabelItem, config: LabelConfig) {
  const lines: Array<{
    text: string;
    size: number;
    bold: boolean;
    align: "left" | "center" | "right";
  }> = [];

  for (const line of config.textLines) {
    const raw = line.source === "custom" ? line.customText : (item.fields?.[line.fieldKey] ?? "");
    const text = applyCaseTransform(raw.trim(), line.caseTransform);
    if (!text) continue;

    lines.push({
      text,
      size: line.size,
      bold: line.bold,
      align: line.align,
    });
  }

  return lines;
}

function getLabelLayout(width: number, height: number, config: LabelConfig, item: ZplLabelItem) {
  const lines = getVisibleTextLines(item, config);
  const layout = computeLabelLayout(config, {
    width: width / DOTS_PER_MM,
    height: height / DOTS_PER_MM,
    textHeight: estimateTextHeight(lines) / DOTS_PER_MM,
    hasText: hasVisibleText(item, config),
    watermark: false,
  });
  const dots = (value: number) => value * DOTS_PER_MM;
  return {
    qrX: dots(layout.qr.x),
    qrY: dots(layout.qr.y),
    qrSize: dots(layout.qr.size),
    textX: dots(layout.text?.x ?? 0),
    textY: dots(layout.text?.y ?? 0),
    textW: dots(layout.text?.w ?? 0),
    textH: dots(layout.text?.h ?? 0),
    lines,
    footerX: dots(layout.footer?.x ?? 0),
    footerY: dots(layout.footer?.y ?? 0),
    footerW: dots(layout.footer?.w ?? 0),
    footerH: dots(layout.footer?.h ?? 0),
  };
}

function drawFooterUrl(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  width: number,
  height: number
) {
  ctx.save();
  ctx.fillStyle = "#000000";
  const text = "www.ambra-system.com";
  let fontSize = Math.max(9, Math.round(height * FOOTER_FONT_RATIO));
  ctx.font = `${fontSize}px ${LABEL_FONT_FAMILY}`;
  while (fontSize > 9 && ctx.measureText(text).width > width) {
    fontSize -= 1;
    ctx.font = `${fontSize}px ${LABEL_FONT_FAMILY}`;
  }
  ctx.textBaseline = "middle";
  const measured = ctx.measureText(text).width;
  ctx.fillText(text, x + (width - measured) / 2, y + height / 2);
  ctx.restore();
}

function truncateToWidth(ctx: CanvasRenderingContext2D, text: string, maxWidth: number): string {
  if (ctx.measureText(text).width <= maxWidth) return text;
  const ellipsis = "…";
  let result = text;
  while (result.length > 1 && ctx.measureText(result + ellipsis).width > maxWidth) {
    result = result.slice(0, -1);
  }
  return result + ellipsis;
}

function drawLogo(
  ctx: CanvasRenderingContext2D,
  config: LabelConfig,
  x: number,
  y: number,
  size: number
) {
  const bgStyle = config.logoBackgroundStyle;
  const insetRatio = bgStyle === "brand" ? 0.1 : bgStyle === "circle" ? 0.19 : 0.18;
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

  ctx.save();
  ctx.fillStyle = "#ffffff";

  if (bgStyle === "brand") {
    ctx.beginPath();
    ctx.moveTo(x + size / 2, y);
    ctx.lineTo(x, y + size);
    ctx.lineTo(x + size, y + size);
    ctx.closePath();
    ctx.fill();
  } else if (bgStyle === "circle") {
    ctx.beginPath();
    ctx.arc(x + size / 2, y + size / 2, size * 0.48, 0, Math.PI * 2);
    ctx.fill();
  } else {
    const radius = size * 0.12;
    ctx.beginPath();
    ctx.moveTo(x + radius, y);
    ctx.lineTo(x + size - radius, y);
    ctx.quadraticCurveTo(x + size, y, x + size, y + radius);
    ctx.lineTo(x + size, y + size - radius);
    ctx.quadraticCurveTo(x + size, y + size, x + size - radius, y + size);
    ctx.lineTo(x + radius, y + size);
    ctx.quadraticCurveTo(x, y + size, x, y + size - radius);
    ctx.lineTo(x, y + radius);
    ctx.quadraticCurveTo(x, y, x + radius, y);
    ctx.closePath();
    ctx.fill();
  }

  ctx.fillStyle = "#111111";
  ctx.beginPath();
  ctx.moveTo(apexX, apexY);
  ctx.lineTo(leftBaseX, baseY);
  ctx.lineTo(innerX + innerW * 0.34, baseY);
  ctx.lineTo(apexX, centerY);
  ctx.closePath();
  ctx.fill();

  ctx.beginPath();
  ctx.moveTo(apexX, apexY);
  ctx.lineTo(apexX, centerY);
  ctx.lineTo(innerX + innerW * 0.66, baseY);
  ctx.lineTo(rightBaseX, baseY);
  ctx.closePath();
  ctx.fill();

  ctx.fillStyle = "#ffffff";
  ctx.beginPath();
  ctx.moveTo(apexX, innerY + innerH * 0.22);
  ctx.lineTo(apexX - notchHalfW, centerY);
  ctx.lineTo(apexX + notchHalfW, centerY);
  ctx.closePath();
  ctx.fill();
  ctx.restore();
}

function toMonochromeHex(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number
): { bytesPerRow: number; totalBytes: number; hex: string } {
  const { data } = ctx.getImageData(0, 0, width, height);
  const bytesPerRow = Math.ceil(width / 8);
  const totalBytes = bytesPerRow * height;
  let hex = "";

  for (let y = 0; y < height; y++) {
    for (let byteIndex = 0; byteIndex < bytesPerRow; byteIndex++) {
      let value = 0;
      for (let bit = 0; bit < 8; bit++) {
        const x = byteIndex * 8 + bit;
        if (x >= width) continue;
        const idx = (y * width + x) * 4;
        const r = data[idx];
        const g = data[idx + 1];
        const b = data[idx + 2];
        const a = data[idx + 3];
        const luminance = r * 0.299 + g * 0.587 + b * 0.114;
        const isBlack = a > 0 && luminance < 200;
        if (isBlack) value |= 1 << (7 - bit);
      }
      hex += value.toString(16).toUpperCase().padStart(2, "0");
    }
  }

  return { bytesPerRow, totalBytes, hex };
}

/**
 * Draws the QR centred in the box, every module a whole number of dots;
 * returns the square the code occupies (without its quiet zone).
 */
function drawDotGridQr(
  ctx: CanvasRenderingContext2D,
  text: string,
  boxX: number,
  boxY: number,
  boxSize: number,
  errorCorrectionLevel: "M" | "Q"
) {
  const { modules } = QRCode.create(text, { errorCorrectionLevel });
  const count = modules.size;
  const dot = Math.floor(boxSize / (count + QR_QUIET_MODULES * 2));
  if (dot < 1) return { x: boxX, y: boxY, size: 0 };
  const size = dot * count;
  const x = Math.round(boxX + (boxSize - size) / 2);
  const y = Math.round(boxY + (boxSize - size) / 2);
  const quiet = dot * QR_QUIET_MODULES;

  ctx.fillStyle = "#ffffff";
  ctx.fillRect(x - quiet, y - quiet, size + quiet * 2, size + quiet * 2);
  ctx.fillStyle = "#000000";
  for (let row = 0; row < count; row++) {
    for (let col = 0; col < count; col++) {
      if (modules.get(row, col)) ctx.fillRect(x + col * dot, y + row * dot, dot, dot);
    }
  }
  return { x, y, size };
}

async function renderLabelGraphic(item: ZplLabelItem, size: ZplLabelSize, config: LabelConfig) {
  await ensureFontsRegistered();
  const { createCanvas } = await import("canvas");
  const { widthMm, heightMm } = SIZE_CONFIG[size];
  const width = mm(widthMm);
  const height = mm(heightMm);
  const isPortraitComposition = config.orientation === "portrait";
  const renderWidth = isPortraitComposition ? height : width;
  const renderHeight = isPortraitComposition ? width : height;
  const canvas = createCanvas(width, height);
  const ctx = canvas.getContext("2d");
  const workCanvas = isPortraitComposition ? createCanvas(renderWidth, renderHeight) : canvas;
  const workCtx = workCanvas.getContext("2d");

  workCtx.fillStyle = "#ffffff";
  workCtx.fillRect(0, 0, renderWidth, renderHeight);

  if (config.showBorder) {
    const inset = mm(config.outerPaddingMm);
    workCtx.strokeStyle = "#000000";
    workCtx.lineWidth = 1;
    workCtx.strokeRect(
      inset + 0.5,
      inset + 0.5,
      Math.max(0, renderWidth - inset * 2 - 1),
      Math.max(0, renderHeight - inset * 2 - 1)
    );
  }

  const layout = getLabelLayout(renderWidth, renderHeight, config, item);
  const qr = drawDotGridQr(
    workCtx,
    buildQrScanUrl(item.token),
    layout.qrX,
    layout.qrY,
    layout.qrSize,
    config.includeLogo ? "Q" : "M"
  );

  if (config.includeLogo && qr.size > 0) {
    const logoSize = qr.size * 0.26;
    const logoX = qr.x + (qr.size - logoSize) / 2;
    const logoY = qr.y + (qr.size - logoSize) / 2;
    drawLogo(workCtx, config, logoX, logoY, logoSize);
  }

  if (layout.lines.length > 0 && layout.textW > 0) {
    const lineDefs = layout.lines.map((line) => {
      const fontSize = pt(line.size);
      const lineGap = Math.max(4, Math.round(fontSize * 0.22));
      return { ...line, fontSize, lineGap };
    });
    const contentHeight = lineDefs.reduce(
      (sum, line, index) =>
        sum + line.fontSize + (index === lineDefs.length - 1 ? 0 : line.lineGap),
      0
    );
    const yOffset =
      config.textVerticalAlign === "start"
        ? 0
        : config.textVerticalAlign === "end"
          ? Math.max(0, layout.textH - contentHeight)
          : Math.max(0, (layout.textH - contentHeight) / 2);
    let y = layout.textY + yOffset;

    for (const line of lineDefs) {
      workCtx.font = `${line.bold ? "700" : "500"} ${line.fontSize}px ${LABEL_FONT_FAMILY}`;
      workCtx.fillStyle = "#000000";
      workCtx.textBaseline = "top";
      const displayText = truncateToWidth(workCtx, line.text, layout.textW);
      const measured = workCtx.measureText(displayText).width;
      let x = layout.textX;
      if (line.align === "center") x = layout.textX + (layout.textW - measured) / 2;
      if (line.align === "right") x = layout.textX + layout.textW - measured;
      workCtx.fillText(displayText, x, y);
      y += line.fontSize + line.lineGap;
    }
  }

  if (config.footer.show && layout.footerH > 0 && layout.footerW > 0) {
    drawFooterUrl(workCtx, layout.footerX, layout.footerY, layout.footerW, layout.footerH);
  }

  if (isPortraitComposition) {
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, width, height);
    ctx.save();
    ctx.translate(width, 0);
    ctx.rotate(Math.PI / 2);
    ctx.drawImage(workCanvas, 0, 0);
    ctx.restore();
  }

  return toMonochromeHex(ctx, width, height);
}

/**
 * Speed, darkness and media commands. Without them the printer uses its own
 * defaults (often its top speed), which leaves big black areas like the QR
 * partly grey on thermal transfer printers such as the GK420d.
 */
export function zplPrintCommands(config: LabelConfig): string[] {
  const { speed, darkness, media } = zplPrintSettings(config);
  const commands = [`^PR${speed},${speed},${speed}`];
  if (darkness !== null) commands.push(`~SD${String(darkness).padStart(2, "0")}`);
  if (media === "transfer") commands.push("^MTT");
  if (media === "direct") commands.push("^MTD");
  return commands;
}

async function singleLabel(item: ZplLabelItem, size: ZplLabelSize, config: LabelConfig) {
  const { widthMm, heightMm } = SIZE_CONFIG[size];
  const width = mm(widthMm);
  const height = mm(heightMm);
  const { bytesPerRow, totalBytes, hex } = await renderLabelGraphic(item, size, config);

  return [
    "^XA",
    ...zplPrintCommands(config),
    "^CI28",
    "^LH0,0",
    `^PW${width}`,
    `^LL${height}`,
    `^FO0,0^GFA,${totalBytes},${totalBytes},${bytesPerRow},${hex}^FS`,
    "^XZ",
  ].join("\n");
}

export async function generateZplLabels(
  items: ZplLabelItem[],
  size: ZplLabelSize,
  config: LabelConfig
): Promise<string> {
  if (items.length === 0) throw new Error("Cannot generate ZPL with no labels.");
  const labels = await Promise.all(items.map((item) => singleLabel(item, size, config)));
  return labels.join("\n");
}
