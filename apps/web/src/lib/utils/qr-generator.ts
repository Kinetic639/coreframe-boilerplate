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
      : process.env.NEXT_PUBLIC_APP_URL || "https://www.ambra-system.com");
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
 * Calculate optimal label height based on actual content
 */
function calculateOptimalLabelHeight(
  template: LabelTemplate,
  previewData: LabelPreviewData,
  labelWidth: number
): number {
  const padding = 16; // Base padding around the label
  const margin = 4; // Margin between sections

  // Calculate QR code size (based on template settings)
  const qrSize = Math.min(labelWidth * 0.4, calculateQRPixelSize(template));

  // If no text is shown, height is just QR + padding
  if (!template.show_label_text || !previewData.displayText) {
    return qrSize + padding * 2;
  }

  // Calculate text content height
  const textHeight = calculateTextContentHeight(template, previewData, labelWidth);

  // Determine layout direction based on text position
  const isHorizontal =
    template.label_text_position === "left" || template.label_text_position === "right";

  if (isHorizontal) {
    // Side-by-side layout: height is the maximum of QR or text content
    return Math.max(qrSize, textHeight) + padding * 2;
  } else {
    // Vertical layout: height is QR + text + margin between sections
    return qrSize + textHeight + margin + padding * 2;
  }
}

/**
 * Calculate the height needed for text content
 */
function calculateTextContentHeight(
  template: LabelTemplate,
  previewData: LabelPreviewData,
  labelWidth: number
): number {
  // Create a temporary canvas to measure text
  const tempCanvas = document.createElement("canvas");
  const tempCtx = tempCanvas.getContext("2d")!;

  tempCtx.font = `${template.label_text_size}px Arial`;

  let totalHeight = 0;
  const lineHeight = template.label_text_size + 2;
  const margin = 8;

  // Calculate available width for text (considering horizontal layouts)
  const isHorizontal =
    template.label_text_position === "left" || template.label_text_position === "right";
  const maxWidth = isHorizontal
    ? labelWidth * 0.6 - margin * 2 // Leave space for QR in horizontal layout
    : labelWidth - margin * 2; // Full width in vertical layout

  if (previewData.displayText) {
    const lines = wrapText(tempCtx, previewData.displayText, maxWidth);
    totalHeight += lines.length * lineHeight + template.label_text_size; // Add initial line height offset
  }

  if (template.show_code && previewData.codeText) {
    totalHeight += Math.max(8, template.label_text_size - 2) + 4; // Code text height + spacing
  }

  return Math.max(totalHeight, template.label_text_size * 2); // Minimum height for text section
}

/**
 * Generate label preview data for canvas rendering with dynamic height adjustment
 */
export async function generateLabelPreview(previewData: LabelPreviewData): Promise<string> {
  // Ensure this runs only on the client side
  if (typeof window === "undefined") {
    throw new Error("generateLabelPreview can only be called on the client side");
  }
  const template = previewData.template;
  const { width } = calculateLabelPixelSize(template);

  // Calculate actual content height needed
  const actualHeight = calculateOptimalLabelHeight(template, previewData, width);

  // Create canvas with dynamic height
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = actualHeight;
  const ctx = canvas.getContext("2d")!;

  // Set background
  ctx.fillStyle = template.background_color;
  ctx.fillRect(0, 0, width, actualHeight);

  // Draw border if enabled
  if (template.border_enabled) {
    ctx.strokeStyle = template.border_color;
    ctx.lineWidth = template.border_width;
    ctx.strokeRect(0, 0, width, actualHeight);
  }

  // Calculate section dimensions based on layout with dynamic height
  const sections = calculateSectionLayout(template, width, actualHeight);

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
  const padding = 8; // Padding from label edges
  const margin = 4; // Margin between sections

  // Calculate available space
  const availableWidth = labelWidth - padding * 2;
  const availableHeight = labelHeight - padding * 2;

  // Determine layout direction based on data section position
  const isHorizontal =
    template.label_text_position === "left" || template.label_text_position === "right";

  if (isHorizontal) {
    // Horizontal layout (side by side) - centered vertically
    const totalAvailableWidth = availableWidth - margin;

    let qrWidth: number, dataWidth: number;

    // Calculate section widths based on balance setting
    switch (template.section_balance) {
      case "qr-priority":
        qrWidth = Math.floor(totalAvailableWidth * 0.6);
        dataWidth = totalAvailableWidth - qrWidth;
        break;
      case "data-priority":
        dataWidth = Math.floor(totalAvailableWidth * 0.7);
        qrWidth = totalAvailableWidth - dataWidth;
        break;
      case "equal":
      default:
        qrWidth = Math.floor(totalAvailableWidth * 0.4);
        dataWidth = totalAvailableWidth - qrWidth;
        break;
    }

    if (template.label_text_position === "left") {
      // Data section on left, QR on right
      return {
        dataSection: {
          x: padding,
          y: padding,
          width: dataWidth,
          height: availableHeight,
        },
        qrSection: {
          x: padding + dataWidth + margin,
          y: padding,
          width: qrWidth,
          height: availableHeight,
        },
      };
    } else {
      // QR section on left, data on right (default)
      return {
        qrSection: {
          x: padding,
          y: padding,
          width: qrWidth,
          height: availableHeight,
        },
        dataSection: {
          x: padding + qrWidth + margin,
          y: padding,
          width: dataWidth,
          height: availableHeight,
        },
      };
    }
  } else {
    // Vertical layout (stacked)
    const qrSize = Math.min(availableWidth, calculateQRPixelSize(template));
    const qrHeight = qrSize + 10; // QR size + some padding
    const dataHeight = availableHeight - qrHeight - margin;

    if (template.label_text_position === "top") {
      // Data section on top, QR on bottom
      return {
        dataSection: {
          x: padding,
          y: padding,
          width: availableWidth,
          height: dataHeight,
        },
        qrSection: {
          x: padding,
          y: padding + dataHeight + margin,
          width: availableWidth,
          height: qrHeight,
        },
      };
    } else {
      // QR section on top, data on bottom (default)
      return {
        qrSection: {
          x: padding,
          y: padding,
          width: availableWidth,
          height: qrHeight,
        },
        dataSection: {
          x: padding,
          y: padding + qrHeight + margin,
          width: availableWidth,
          height: dataHeight,
        },
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
  // Calculate appropriate QR size that fits well in the section
  const maxQRSize = Math.min(section.width, section.height) * 0.9;
  const templateQRSize = calculateQRPixelSize(template);
  const qrSize = Math.min(maxQRSize, templateQRSize);

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
 * Draw additional data within its designated section with proper centering
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

  // Calculate total content height to center it vertically
  let totalContentHeight = 0;
  const lineHeight = template.label_text_size + 2;

  let lines: string[] = [];
  if (previewData.displayText) {
    lines = wrapText(ctx, previewData.displayText, maxWidth);
    totalContentHeight += lines.length * lineHeight;
  }

  if (template.show_code && previewData.codeText) {
    totalContentHeight += Math.max(8, template.label_text_size - 2) + 4;
  }

  // Center content vertically within the section
  const startY = section.y + (section.height - totalContentHeight) / 2 + template.label_text_size;
  let currentY = Math.max(startY, section.y + margin + template.label_text_size);

  // Draw main display text
  if (previewData.displayText && lines.length > 0) {
    ctx.textAlign = "left";

    for (const line of lines) {
      if (currentY > section.y + section.height - margin) break; // Don't overflow section
      ctx.fillText(line, section.x + margin, currentY);
      currentY += lineHeight;
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
