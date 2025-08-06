// PDF Generation utilities for QR labels
import type { jsPDF } from "jspdf";
import type { QRLabel, LabelTemplate, LabelGenerationRequest } from "@/lib/types/qr-system";

export const generateLabelPDF = async (
  labels: QRLabel[],
  template: LabelTemplate,
  _options: Record<string, unknown> = {}
) => {
  try {
    const { jsPDF } = await import("jspdf");
    const QRCode = await import("qrcode");

    // Create PDF
    const pdf = new jsPDF({
      orientation: "portrait",
      unit: "mm",
      format: "a4",
    });

    // Calculate layout
    const pageWidth = 210; // A4 width in mm
    const pageHeight = 297; // A4 height in mm
    const margin = 10;

    // Calculate how many labels per row and column
    const labelsPerRow = Math.floor((pageWidth - 2 * margin) / template.width_mm);
    const labelsPerColumn = Math.floor((pageHeight - 2 * margin) / template.height_mm);
    const labelsPerPage = labelsPerRow * labelsPerColumn;

    let currentPage = 0;
    let labelCount = 0;

    for (let i = 0; i < labels.length; i++) {
      const label = labels[i];

      // Add new page if needed
      if (labelCount % labelsPerPage === 0) {
        if (currentPage > 0) {
          pdf.addPage();
        }
        currentPage++;
      }

      // Calculate position on current page
      const positionOnPage = labelCount % labelsPerPage;
      const row = Math.floor(positionOnPage / labelsPerRow);
      const col = positionOnPage % labelsPerRow;

      const x = margin + col * template.width_mm;
      const y = margin + row * template.height_mm;

      // Generate QR code as data URL
      const qrDataUrl = await QRCode.toDataURL(label.qr_token, {
        width: Math.floor(template.qr_size_mm * 3.78), // Convert mm to pixels (300 DPI)
        margin: 0,
        color: {
          dark: template.text_color || "#000000",
          light: template.background_color || "#FFFFFF",
        },
      });

      // Draw label background
      pdf.setFillColor(template.background_color || "#FFFFFF");
      pdf.rect(x, y, template.width_mm, template.height_mm, "F");

      // Draw border if enabled
      if (template.border_enabled) {
        pdf.setDrawColor(template.border_color || "#000000");
        pdf.setLineWidth(template.border_width || 0.5);
        pdf.rect(x, y, template.width_mm, template.height_mm, "S");
      }

      // Add QR code
      const qrSize = template.qr_size_mm;
      let qrX = x;
      let qrY = y;

      // Position QR code based on template settings
      switch (template.qr_position) {
        case "center":
          qrX = x + (template.width_mm - qrSize) / 2;
          qrY = y + (template.height_mm - qrSize) / 2;
          break;
        case "left":
          qrX = x + 2;
          qrY = y + (template.height_mm - qrSize) / 2;
          break;
        case "right":
          qrX = x + template.width_mm - qrSize - 2;
          qrY = y + (template.height_mm - qrSize) / 2;
          break;
        case "top-left":
          qrX = x + 2;
          qrY = y + 2;
          break;
        case "top-right":
          qrX = x + template.width_mm - qrSize - 2;
          qrY = y + 2;
          break;
        case "bottom-left":
          qrX = x + 2;
          qrY = y + template.height_mm - qrSize - 2;
          break;
        case "bottom-right":
          qrX = x + template.width_mm - qrSize - 2;
          qrY = y + template.height_mm - qrSize - 2;
          break;
      }

      pdf.addImage(qrDataUrl, "PNG", qrX, qrY, qrSize, qrSize);

      // Add text if enabled
      if (template.show_label_text) {
        pdf.setTextColor(template.text_color || "#000000");
        pdf.setFontSize(template.label_text_size || 12);

        const labelText = `${template.label_type.toUpperCase()}-${i + 1}`;
        const textWidth = pdf.getTextWidth(labelText);

        let textX = x;
        let textY = y + template.height_mm - 2;

        // Position text based on template settings
        switch (template.label_text_position) {
          case "center":
            textX = x + (template.width_mm - textWidth) / 2;
            textY = y + template.height_mm / 2 + 2;
            break;
          case "bottom":
            textX = x + (template.width_mm - textWidth) / 2;
            textY = y + template.height_mm - 2;
            break;
          case "right":
            textX = x + qrSize + 4;
            textY = y + template.height_mm / 2 + 2;
            break;
          case "left":
            textX = x + 2;
            textY = y + template.height_mm / 2 + 2;
            break;
          case "top":
            textX = x + (template.width_mm - textWidth) / 2;
            textY = y + 8;
            break;
        }

        pdf.text(labelText, textX, textY);
      }

      // Add code if enabled
      if (template.show_code) {
        pdf.setTextColor(template.text_color || "#000000");
        pdf.setFontSize(8);
        pdf.text(label.qr_token.substring(0, 8), x + 1, y + template.height_mm - 1);
      }

      labelCount++;
    }

    return pdf;
  } catch (error) {
    console.error("Error generating PDF:", error);
    throw error;
  }
};

export const downloadPDF = (pdf: jsPDF, filename: string) => {
  pdf.save(filename);
};

export const generateFileName = (request: LabelGenerationRequest) => {
  const timestamp = new Date().toISOString().split("T")[0];
  return request.batchName
    ? `${request.batchName}.pdf`
    : `labels_${request.labelType}_${timestamp}.pdf`;
};
