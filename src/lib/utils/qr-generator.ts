import QRCode from "qrcode";
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
  format?: "QRCode" | "Code128" | "EAN13" | "UPC";
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
      : process.env.NEXT_PUBLIC_APP_URL || "");
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
 * Generate label preview data for canvas rendering
 */
export async function generateLabelPreview(previewData: LabelPreviewData): Promise<string> {
  const template = previewData.template;
  const { width, height } = calculateLabelPixelSize(template);
  const qrSize = calculateQRPixelSize(template);

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

  // Calculate QR position
  const { qrX, qrY } = calculateQRPosition(template, width, height, qrSize);
  ctx.drawImage(qrImage, qrX, qrY, qrSize, qrSize);

  // Draw text if enabled
  if (
    template.show_label_text &&
    previewData.displayText &&
    template.label_text_position !== "none"
  ) {
    drawLabelText(ctx, template, previewData.displayText, width, height, qrX, qrY, qrSize);
  }

  // Draw code if enabled
  if (template.show_code && previewData.codeText) {
    drawCodeText(ctx, template, previewData.codeText, width, height, qrX, qrY, qrSize);
  }

  // Draw hierarchy if enabled
  if (template.show_hierarchy && previewData.hierarchy && previewData.hierarchy.length > 0) {
    drawHierarchyText(ctx, template, previewData.hierarchy, width, height, qrX, qrY, qrSize);
  }

  // Draw barcode if enabled and available
  if (template.show_barcode && previewData.barcode) {
    await drawBarcode(ctx, template, previewData.barcode, width, height, qrX, qrY, qrSize);
  }

  return canvas.toDataURL();
}

/**
 * Calculate QR code position based on template settings
 */
function calculateQRPosition(
  template: LabelTemplate,
  labelWidth: number,
  labelHeight: number,
  qrSize: number
): { qrX: number; qrY: number } {
  const margin = 10; // Base margin in pixels

  switch (template.qr_position) {
    case "top-left":
      return { qrX: margin, qrY: margin };
    case "top-right":
      return { qrX: labelWidth - qrSize - margin, qrY: margin };
    case "bottom-left":
      return { qrX: margin, qrY: labelHeight - qrSize - margin };
    case "bottom-right":
      return { qrX: labelWidth - qrSize - margin, qrY: labelHeight - qrSize - margin };
    case "center":
    default:
      return {
        qrX: (labelWidth - qrSize) / 2,
        qrY: (labelHeight - qrSize) / 2,
      };
  }
}

/**
 * Draw label text on canvas
 */
function drawLabelText(
  ctx: CanvasRenderingContext2D,
  template: LabelTemplate,
  text: string,
  labelWidth: number,
  labelHeight: number,
  _qrX: number,
  _qrY: number,
  _qrSize: number
) {
  ctx.fillStyle = template.text_color;
  ctx.font = `${template.label_text_size}px Arial`;
  ctx.textAlign = "center";

  let textX: number;
  let textY: number;

  switch (template.label_text_position) {
    case "top":
      textX = labelWidth / 2;
      textY = 20;
      break;
    case "bottom":
      textX = labelWidth / 2;
      textY = labelHeight - 10;
      break;
    case "left":
      ctx.textAlign = "left";
      textX = 10;
      textY = labelHeight / 2;
      break;
    case "right":
      ctx.textAlign = "right";
      textX = labelWidth - 10;
      textY = labelHeight / 2;
      break;
    default:
      return;
  }

  // Truncate text if too long
  const maxWidth = labelWidth - 20;
  let displayText = text;
  while (ctx.measureText(displayText).width > maxWidth && displayText.length > 0) {
    displayText = displayText.substring(0, displayText.length - 1) + "...";
  }

  ctx.fillText(displayText, textX, textY);
}

/**
 * Draw code text (SKU, location code) on canvas
 */
function drawCodeText(
  ctx: CanvasRenderingContext2D,
  template: LabelTemplate,
  code: string,
  labelWidth: number,
  labelHeight: number,
  _qrX: number,
  qrY: number,
  qrSize: number
) {
  ctx.fillStyle = template.text_color;
  ctx.font = `${Math.max(8, template.label_text_size - 2)}px monospace`;
  ctx.textAlign = "center";

  // Position code text near the QR code
  const textY = qrY + qrSize + 15;
  ctx.fillText(code, labelWidth / 2, textY);
}

/**
 * Draw hierarchy text (for locations) on canvas
 */
function drawHierarchyText(
  ctx: CanvasRenderingContext2D,
  template: LabelTemplate,
  hierarchy: string[],
  labelWidth: number,
  labelHeight: number,
  _qrX: number,
  _qrY: number,
  _qrSize: number
) {
  const hierarchyText = hierarchy.join(" > ");
  ctx.fillStyle = template.text_color;
  ctx.font = `${Math.max(6, template.label_text_size - 4)}px Arial`;
  ctx.textAlign = "center";

  const textY = labelHeight - 5;

  // Truncate hierarchy if too long
  const maxWidth = labelWidth - 10;
  let displayText = hierarchyText;
  while (ctx.measureText(displayText).width > maxWidth && displayText.length > 0) {
    displayText = displayText.substring(0, displayText.length - 1) + "...";
  }

  ctx.fillText(displayText, labelWidth / 2, textY);
}

/**
 * Draw barcode on canvas
 */
async function drawBarcode(
  ctx: CanvasRenderingContext2D,
  template: LabelTemplate,
  barcodeText: string,
  labelWidth: number,
  labelHeight: number,
  _qrX: number,
  qrY: number,
  qrSize: number
) {
  try {
    const { svg } = await generateBarcode(barcodeText, { scale: 2 });

    // Convert SVG to image and draw on canvas
    // This is a simplified version - in production you might want to use a library
    // that can properly render SVG to canvas
    const svgBlob = new Blob([svg], { type: "image/svg+xml" });
    const svgUrl = URL.createObjectURL(svgBlob);

    const img = new Image();
    await new Promise((resolve) => {
      img.onload = resolve;
      img.src = svgUrl;
    });

    // Position barcode below QR code
    const barcodeY = qrY + qrSize + 30;
    const barcodeWidth = Math.min(labelWidth - 20, img.width);
    const barcodeHeight = (img.height * barcodeWidth) / img.width;
    const barcodeX = (labelWidth - barcodeWidth) / 2;

    ctx.drawImage(img, barcodeX, barcodeY, barcodeWidth, barcodeHeight);

    URL.revokeObjectURL(svgUrl);
  } catch (error) {
    console.error("Error drawing barcode:", error);
  }
}
