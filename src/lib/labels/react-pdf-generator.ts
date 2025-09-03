import { renderToBuffer } from "@react-pdf/renderer";
import { createElement } from "react";
import { PDFLabelDocument } from "./PDFLabelComponent";
import { GeneratePdfPayload, PDFLabelTemplate, LabelDataRecord } from "./types";

export interface ReactPDFGenerateOptions {
  template: PDFLabelTemplate;
  data: LabelDataRecord[];
  pageSize?: "A4" | "Letter";
  labelsPerPage?: number;
}

/**
 * Generate PDF buffer using React-PDF components
 */
export async function generatePDFFromReactComponents(
  options: ReactPDFGenerateOptions
): Promise<Buffer> {
  const { template, data, pageSize = "A4", labelsPerPage } = options;

  console.log(
    `Generating PDF with React-PDF: ${data.length} labels, ${template.width_mm}x${template.height_mm}mm each`
  );
  console.log(`Template fields: ${template.fields?.length || 0} fields`);
  console.log(`Template show_additional_info: ${template.show_additional_info}`);
  console.log(`Template name: ${template.name}`);

  // Log template fields for debugging
  if (template.fields && template.fields.length > 0) {
    console.log("=== TEMPLATE FIELDS DEBUG ===");
    template.fields.forEach((field, index) => {
      console.log(`Field ${index + 1}:`, {
        name: field.field_name,
        type: field.field_type,
        value: field.field_value,
        position: `(${field.position_x}mm, ${field.position_y}mm)`,
        size: `${field.width_mm}x${field.height_mm}mm`,
        font_size: field.font_size,
      });
    });
    console.log("=== END TEMPLATE FIELDS ===");
  } else {
    console.log("❌ NO FIELDS FOUND IN TEMPLATE!");
    console.log("Template object keys:", Object.keys(template));
  }

  try {
    // Pre-generate all QR codes
    console.log("Pre-generating QR codes...");
    const qrCodeMap = await generateAllQRCodes(data);

    // Create the React element with QR codes
    const pdfElement = createElement(PDFLabelDocument, {
      template,
      data,
      pageSize,
      labelsPerPage,
      qrCodeMap,
    });

    // Render to buffer
    const pdfBuffer = await renderToBuffer(pdfElement);

    console.log(`Successfully generated PDF buffer: ${pdfBuffer.length} bytes`);
    return pdfBuffer;
  } catch (error) {
    console.error("React-PDF generation failed:", error);
    throw new Error(
      `React-PDF generation failed: ${error instanceof Error ? error.message : "Unknown error"}`
    );
  }
}

/**
 * Convert the old GeneratePdfPayload format to ReactPDFGenerateOptions
 */
export function convertToReactPDFOptions(payload: GeneratePdfPayload): ReactPDFGenerateOptions {
  const { template, data, pagePreset } = payload;

  // Determine page size
  let pageSize: "A4" | "Letter" = "A4";
  let labelsPerPage = 6; // Default

  if (pagePreset.kind === "sheet") {
    // Check if it's A4-ish dimensions
    if (
      pagePreset.page.widthMm >= 200 &&
      pagePreset.page.widthMm <= 220 &&
      pagePreset.page.heightMm >= 280 &&
      pagePreset.page.heightMm <= 310
    ) {
      pageSize = "A4";
    } else {
      pageSize = "Letter";
    }

    // Calculate labels per page from grid
    labelsPerPage = pagePreset.grid.columns * pagePreset.grid.rows;
  } else {
    // Roll format - 1 label per page
    labelsPerPage = 1;
  }

  return {
    template,
    data,
    pageSize,
    labelsPerPage,
  };
}

/**
 * Enhanced QR code generation using the qrcode library
 */
export async function generateQRCodeDataURL(data: string): Promise<string> {
  try {
    // Import qrcode dynamically
    const QRCode = await import("qrcode");
    return await QRCode.toDataURL(data, {
      width: 200,
      margin: 0,
      color: {
        dark: "#000000",
        light: "#FFFFFF",
      },
      errorCorrectionLevel: "M",
    });
  } catch (error) {
    console.error("QR code generation failed:", error);
    // Return a simple placeholder if QR generation fails
    return `data:image/png;base64,iVBORw0KGgoAAAANSUhEUGAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8/5+hHgAHggJ/PchI7wAAAABJRU5ErkJggg==`;
  }
}

/**
 * Pre-generate all QR codes for the label data
 */
export async function generateAllQRCodes(data: LabelDataRecord[]): Promise<Map<string, string>> {
  const qrMap = new Map<string, string>();
  const uniqueQRs = new Set<string>();

  // Collect all unique QR data
  data.forEach((record) => {
    const qrData = record.qr || record.qrData || `QR-${Date.now()}-${Math.random()}`;
    uniqueQRs.add(qrData);
  });

  // Generate all QR codes
  for (const qrData of uniqueQRs) {
    const dataUrl = await generateQRCodeDataURL(qrData);
    qrMap.set(qrData, dataUrl);
  }

  console.log(`Generated ${qrMap.size} unique QR codes`);
  return qrMap;
}

/**
 * Wrapper function that maintains compatibility with existing API
 */
export async function renderLabelsReactPDF(payload: GeneratePdfPayload): Promise<Buffer> {
  const options = convertToReactPDFOptions(payload);
  return generatePDFFromReactComponents(options);
}
