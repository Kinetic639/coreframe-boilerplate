import * as QRCode from "qrcode";
import { writeBarcode } from "zxing-wasm/writer";
import type { LabelTemplate, LabelPreviewData } from "@/lib/types/qr-system";

export interface QRGenerationOptions {
  errorCorrectionLevel?: "L" | "M" | "Q" | "H";
  margin?: number;
  scale?: number;
  width?: number;
  color?: {
    dark?: string;
    light?: string;
  };
}

export interface BarcodeGenerationOptions {
  format?: "QRCode" | "Code128" | "EAN-13" | "UPC-A";
  scale?: number;
  margin?: number;
}

/**
 * Generate QR code as Data URL
 */
export async function generateQRCode(
  text: string,
  options: QRGenerationOptions = {}
): Promise<string> {
  const defaultOptions = {
    errorCorrectionLevel: "M" as const,
    margin: 2,
    scale: 8,
    color: {
      dark: "#000000",
      light: "#FFFFFF",
    },
    ...options,
  };

  try {
    return await QRCode.toDataURL(text, defaultOptions);
  } catch (error) {
    console.error("Error generating QR code:", error);
    throw new Error("Failed to generate QR code");
  }
}

/**
 * Generate QR code as SVG string
 */
export async function generateQRCodeSVG(
  text: string,
  options: QRGenerationOptions = {}
): Promise<string> {
  const defaultOptions = {
    errorCorrectionLevel: "M" as const,
    margin: 2,
    color: {
      dark: "#000000",
      light: "#FFFFFF",
    },
    ...options,
  };

  try {
    return await QRCode.toString(text, {
      type: "svg",
      ...defaultOptions,
    });
  } catch (error) {
    console.error("Error generating QR code SVG:", error);
    throw new Error("Failed to generate QR code SVG");
  }
}

/**
 * Generate barcode using zxing-wasm
 */
export async function generateBarcode(
  text: string,
  options: BarcodeGenerationOptions = {}
): Promise<{ svg: string; image: Blob }> {
  const defaultOptions = {
    format: "Code128" as const,
    scale: 3,
    margin: 10,
    ...options,
  };

  try {
    const result = await writeBarcode(text, defaultOptions);
    return {
      svg: result.svg,
      image: result.image,
    };
  } catch (error) {
    console.error("Error generating barcode:", error);
    throw new Error("Failed to generate barcode");
  }
}

/**
 * Create QR token - unique identifier for QR codes
 */
export function generateQRToken(): string {
  // Generate a unique token with timestamp and random string
  const timestamp = Date.now().toString(36);
  const randomStr = Math.random().toString(36).substring(2, 10);
  return `${timestamp}-${randomStr}`.toUpperCase();
}

/**
 * Generate QR code URL for the app
 */
export function generateQRCodeURL(token: string, baseUrl?: string): string {
  const base =
    baseUrl ||
    (typeof window !== "undefined"
      ? window.location.origin
      : process.env.NEXT_PUBLIC_APP_URL || "https://app.coreframe.pl");
  return `${base}/qr/${token}`;
}

/**
 * Calculate QR code size in pixels based on template settings
 */
export function calculateQRPixelSize(template: LabelTemplate): number {
  const mmToPixel = template.dpi / 25.4; // 25.4 mm per inch
  return Math.round(template.qr_size_mm * mmToPixel);
}

/**
 * Calculate label dimensions in pixels
 */
export function calculateLabelPixelSize(template: LabelTemplate): {
  width: number;
  height: number;
} {
  const mmToPixel = template.dpi / 25.4;
  return {
    width: Math.round(template.width_mm * mmToPixel),
    height: Math.round(template.height_mm * mmToPixel),
  };
}

/**
 * Generate label preview data for canvas rendering with new two-section layout
 */
export async function generateLabelPreview(previewData: LabelPreviewData): Promise<string> {
  // Ensure this runs only on the client side
  if (typeof window === "undefined") {
    throw new Error("generateLabelPreview can only be called on the client side");
  }
  const template = previewData.template;
  const { width, height } = calculateLabelPixelSize(template);

  // Create canvas
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d")!;

  // Set background
  ctx.fillStyle = template.background_color;
  ctx.fillRect(0, 0, width, height);

  // Draw border if enabled
  if (template.border_enabled) {
    ctx.strokeStyle = template.border_color;
    ctx.lineWidth = template.border_width;
    ctx.strokeRect(0, 0, width, height);
  }

  // Calculate section dimensions based on layout
  const sections = calculateSectionLayout(template, width, height);

  // Generate and draw QR code in its section
  await drawQRSection(ctx, template, previewData, sections.qrSection);

  // Draw additional data in its section
  if (template.show_label_text && previewData.displayText) {
    drawDataSection(ctx, template, previewData, sections.dataSection);
  }

  return canvas.toDataURL();
}

/**
 * Calculate section layout for two-section label design
 */
interface SectionLayout {
  qrSection: { x: number; y: number; width: number; height: number };
  dataSection: { x: number; y: number; width: number; height: number };
}

function calculateSectionLayout(
  template: LabelTemplate,
  labelWidth: number,
  labelHeight: number
): SectionLayout {
  const margin = 4; // Margin between sections

  // Determine layout direction based on data section position
  const isHorizontal =
    template.label_text_position === "left" || template.label_text_position === "right";

  if (isHorizontal) {
    // Horizontal layout (side by side)
    const totalAvailableWidth = labelWidth - margin;

    let qrWidth: number, dataWidth: number;

    // Calculate section widths based on balance setting
    switch (template.section_balance) {
      case "qr-priority":
        qrWidth = Math.floor(totalAvailableWidth * 0.7);
        dataWidth = totalAvailableWidth - qrWidth;
        break;
      case "data-priority":
        dataWidth = Math.floor(totalAvailableWidth * 0.7);
        qrWidth = totalAvailableWidth - dataWidth;
        break;
      case "equal":
      default:
        qrWidth = Math.floor(totalAvailableWidth / 2);
        dataWidth = totalAvailableWidth - qrWidth;
        break;
    }

    if (template.label_text_position === "left") {
      // Data section on left, QR on right
      return {
        dataSection: { x: 0, y: 0, width: dataWidth, height: labelHeight },
        qrSection: { x: dataWidth + margin, y: 0, width: qrWidth, height: labelHeight },
      };
    } else {
      // QR section on left, data on right
      return {
        qrSection: { x: 0, y: 0, width: qrWidth, height: labelHeight },
        dataSection: { x: qrWidth + margin, y: 0, width: dataWidth, height: labelHeight },
      };
    }
  } else {
    // Vertical layout (stacked)
    const totalAvailableHeight = labelHeight - margin;

    let qrHeight: number, dataHeight: number;

    // Calculate section heights based on balance setting
    switch (template.section_balance) {
      case "qr-priority":
        qrHeight = Math.floor(totalAvailableHeight * 0.7);
        dataHeight = totalAvailableHeight - qrHeight;
        break;
      case "data-priority":
        dataHeight = Math.floor(totalAvailableHeight * 0.7);
        qrHeight = totalAvailableHeight - dataHeight;
        break;
      case "equal":
      default:
        qrHeight = Math.floor(totalAvailableHeight / 2);
        dataHeight = totalAvailableHeight - qrHeight;
        break;
    }

    if (template.label_text_position === "top") {
      // Data section on top, QR on bottom
      return {
        dataSection: { x: 0, y: 0, width: labelWidth, height: dataHeight },
        qrSection: { x: 0, y: dataHeight + margin, width: labelWidth, height: qrHeight },
      };
    } else {
      // QR section on top, data on bottom (default)
      return {
        qrSection: { x: 0, y: 0, width: labelWidth, height: qrHeight },
        dataSection: { x: 0, y: qrHeight + margin, width: labelWidth, height: dataHeight },
      };
    }
  }
}

/**
 * Draw QR code within its designated section
 */
async function drawQRSection(
  ctx: CanvasRenderingContext2D,
  template: LabelTemplate,
  previewData: LabelPreviewData,
  section: { x: number; y: number; width: number; height: number }
) {
  const qrSize = Math.min(section.width, section.height) * 0.8; // Leave some margin within section

  // Generate QR code
  const qrUrl = generateQRCodeURL(previewData.qrToken);
  const qrDataUrl = await generateQRCode(qrUrl, {
    width: qrSize,
    color: {
      dark: template.text_color,
      light: template.background_color,
    },
    margin: 0,
  });

  // Load QR code image
  const qrImage = new Image();
  await new Promise((resolve) => {
    qrImage.onload = resolve;
    qrImage.src = qrDataUrl;
  });

  // Calculate QR position within its section based on qr_position setting
  const { qrX, qrY } = calculateQRPositionInSection(template, section, qrSize);
  ctx.drawImage(qrImage, qrX, qrY, qrSize, qrSize);
}

/**
 * Calculate QR position within its section
 */
function calculateQRPositionInSection(
  template: LabelTemplate,
  section: { x: number; y: number; width: number; height: number },
  qrSize: number
): { qrX: number; qrY: number } {
  const margin = 5;

  switch (template.qr_position) {
    case "top-left":
      return {
        qrX: section.x + margin,
        qrY: section.y + margin,
      };
    case "top-right":
      return {
        qrX: section.x + section.width - qrSize - margin,
        qrY: section.y + margin,
      };
    case "bottom-left":
      return {
        qrX: section.x + margin,
        qrY: section.y + section.height - qrSize - margin,
      };
    case "bottom-right":
      return {
        qrX: section.x + section.width - qrSize - margin,
        qrY: section.y + section.height - qrSize - margin,
      };
    case "left":
      return {
        qrX: section.x + margin,
        qrY: section.y + (section.height - qrSize) / 2,
      };
    case "right":
      return {
        qrX: section.x + section.width - qrSize - margin,
        qrY: section.y + (section.height - qrSize) / 2,
      };
    case "center":
    default:
      return {
        qrX: section.x + (section.width - qrSize) / 2,
        qrY: section.y + (section.height - qrSize) / 2,
      };
  }
}

/**
 * Draw additional data within its designated section
 */
function drawDataSection(
  ctx: CanvasRenderingContext2D,
  template: LabelTemplate,
  previewData: LabelPreviewData,
  section: { x: number; y: number; width: number; height: number }
) {
  ctx.fillStyle = template.text_color;
  ctx.font = `${template.label_text_size}px Arial`;

  const margin = 8;
  const maxWidth = section.width - margin * 2;
  let currentY = section.y + margin + template.label_text_size;

  // Draw main display text
  if (previewData.displayText) {
    ctx.textAlign = "left";
    const lines = wrapText(ctx, previewData.displayText, maxWidth);

    for (const line of lines) {
      if (currentY > section.y + section.height - margin) break; // Don't overflow section
      ctx.fillText(line, section.x + margin, currentY);
      currentY += template.label_text_size + 2;
    }
  }

  // Draw code if enabled
  if (template.show_code && previewData.codeText) {
    ctx.font = `${Math.max(8, template.label_text_size - 2)}px monospace`;
    currentY += 4;
    if (currentY <= section.y + section.height - margin) {
      ctx.fillText(previewData.codeText, section.x + margin, currentY);
    }
  }
}

/**
 * Helper function to wrap text within specified width
 */
function wrapText(ctx: CanvasRenderingContext2D, text: string, maxWidth: number): string[] {
  const words = text.split(" ");
  const lines: string[] = [];
  let currentLine = words[0];

  for (let i = 1; i < words.length; i++) {
    const word = words[i];
    const width = ctx.measureText(currentLine + " " + word).width;
    if (width < maxWidth) {
      currentLine += " " + word;
    } else {
      lines.push(currentLine);
      currentLine = word;
    }
  }
  lines.push(currentLine);
  return lines;
}
