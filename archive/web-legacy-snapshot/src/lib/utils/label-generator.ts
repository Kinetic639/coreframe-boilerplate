import { jsPDF } from "jspdf";
import QRCode from "qrcode";
import { LabelTemplate, LabelTemplateField } from "@/lib/types/qr-system";

export interface LabelGenerationOptions {
  template: LabelTemplate;
  quantity: number;
  labelType: "product" | "location";
  labelsData?: Array<{
    id: string;
    qrToken: string;
    name: string;
    additionalData?: Record<string, string | number | boolean>;
  }>;
}

export interface GeneratedLabelData {
  qrToken: string;
  qrUrl: string;
  name?: string;
  additionalData?: Record<string, string | number | boolean>;
}

export class LabelGenerator {
  private mmToPt(mm: number): number {
    return (mm * 72) / 25.4; // Convert mm to points (1 pt = 1/72 inch, 1 inch = 25.4mm)
  }

  private generateQRToken(): string {
    return `qr_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  private generateQRUrl(qrToken: string, labelType: "product" | "location"): string {
    const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000";

    if (labelType === "product") {
      return `${baseUrl}/dashboard/warehouse/products/scan/${qrToken}`;
    } else if (labelType === "location") {
      return `${baseUrl}/dashboard/warehouse/locations/scan/${qrToken}`;
    } else {
      return `${baseUrl}/qr/${qrToken}`;
    }
  }

  async generateLabelPDF(options: LabelGenerationOptions): Promise<{
    pdf: jsPDF;
    labelsData: GeneratedLabelData[];
  }> {
    const { template, quantity, labelType, labelsData } = options;

    // Generate labels data if not provided
    let labels: GeneratedLabelData[];
    if (labelsData) {
      labels = labelsData.map((item) => ({
        qrToken: item.qrToken,
        qrUrl: (item as any).qrUrl || this.generateQRUrl(item.qrToken, labelType as any),
        name: item.name,
        additionalData: item.additionalData,
      }));
    } else {
      labels = this.generateLabelsData(quantity, labelType);
    }

    // Create PDF
    const pdf = new jsPDF({
      orientation: "portrait",
      unit: "pt",
      format: "a4",
    });

    // Calculate how many labels fit on one page
    const pageWidth = 595; // A4 width in points
    const pageHeight = 842; // A4 height in points
    const labelWidth = this.mmToPt(template.width_mm);
    const labelHeight = this.mmToPt(template.height_mm);

    // Add some margins
    const margin = 20;
    const spacing = 5;

    const labelsPerRow = Math.floor((pageWidth - 2 * margin + spacing) / (labelWidth + spacing));
    const rowsPerPage = Math.floor((pageHeight - 2 * margin + spacing) / (labelHeight + spacing));
    const labelsPerPage = labelsPerRow * rowsPerPage;

    let labelIndex = 0;

    for (let i = 0; i < labels.length; i++) {
      const labelData = labels[i];

      // Check if we need a new page
      if (labelIndex >= labelsPerPage) {
        pdf.addPage();
        labelIndex = 0;
      }

      // Calculate position on page
      const row = Math.floor(labelIndex / labelsPerRow);
      const col = labelIndex % labelsPerRow;

      const x = margin + col * (labelWidth + spacing);
      const y = margin + row * (labelHeight + spacing);

      // Draw label
      await this.drawLabel(pdf, template, labelData, x, y);

      labelIndex++;
    }

    return { pdf, labelsData: labels };
  }

  private generateLabelsData(
    quantity: number,
    labelType: "product" | "location"
  ): GeneratedLabelData[] {
    const labels: GeneratedLabelData[] = [];

    for (let i = 0; i < quantity; i++) {
      const qrToken = this.generateQRToken();
      const qrUrl = this.generateQRUrl(qrToken, labelType);

      labels.push({
        qrToken,
        qrUrl,
        name: `${labelType === "product" ? "Product" : "Location"} ${i + 1}`,
        additionalData: {
          type: labelType,
          generated_at: new Date().toISOString(),
          index: i + 1,
        },
      });
    }

    return labels;
  }

  private async drawLabel(
    pdf: jsPDF,
    template: LabelTemplate,
    labelData: GeneratedLabelData,
    x: number,
    y: number
  ): Promise<void> {
    const labelWidth = this.mmToPt(template.width_mm);
    const labelHeight = this.mmToPt(template.height_mm);

    // Draw background
    if (template.background_color && template.background_color !== "#FFFFFF") {
      pdf.setFillColor(template.background_color);
      pdf.rect(x, y, labelWidth, labelHeight, "F");
    }

    // Draw border
    if (template.border_enabled && template.border_color && template.border_width) {
      pdf.setDrawColor(template.border_color);
      pdf.setLineWidth(template.border_width);
      pdf.rect(x, y, labelWidth, labelHeight);
    }

    // Use simple positioning approach like the preview canvas
    await this.drawLabelWithSimpleLayout(pdf, template, labelData, x, y);
  }

  private async drawLabelWithSimpleLayout(
    pdf: jsPDF,
    template: LabelTemplate,
    labelData: GeneratedLabelData,
    baseX: number,
    baseY: number
  ): Promise<void> {
    const labelWidth = this.mmToPt(template.width_mm);
    const labelHeight = this.mmToPt(template.height_mm);

    if (!template.show_additional_info) {
      // QR-only label - center the QR code
      const margin = this.mmToPt(2);
      const availableSize = Math.min(labelWidth, labelHeight) - margin * 2;
      const qrSize = Math.min(availableSize, this.mmToPt(template.qr_size_mm));

      const qrX = baseX + (labelWidth - qrSize) / 2;
      const qrY = baseY + (labelHeight - qrSize) / 2;
      await this.drawQRCodeAt(pdf, labelData, qrX, qrY, qrSize);
      return;
    }

    // Draw QR code using the same positioning logic as preview canvas
    await this.drawQRCodeSimple(pdf, template, labelData, baseX, baseY);

    // Draw fields using absolute positioning from template
    if (template.fields) {
      for (const field of template.fields) {
        await this.drawFieldSimple(pdf, field, labelData, baseX, baseY);
      }
    }
  }

  private async drawQRCodeSimple(
    pdf: jsPDF,
    template: LabelTemplate,
    labelData: GeneratedLabelData,
    baseX: number,
    baseY: number
  ): Promise<void> {
    const qrSize = this.mmToPt(template.qr_size_mm);
    let qrX = baseX;
    let qrY = baseY;

    // Position QR code based on qr_position (matching preview canvas logic)
    const position = template.qr_position || "left";
    switch (position) {
      case "top-left":
        qrX = baseX + this.mmToPt(2);
        qrY = baseY + this.mmToPt(2);
        break;
      case "top-right":
        qrX = baseX + this.mmToPt(template.width_mm) - qrSize - this.mmToPt(2);
        qrY = baseY + this.mmToPt(2);
        break;
      case "bottom-left":
        qrX = baseX + this.mmToPt(2);
        qrY = baseY + this.mmToPt(template.height_mm) - qrSize - this.mmToPt(2);
        break;
      case "bottom-right":
        qrX = baseX + this.mmToPt(template.width_mm) - qrSize - this.mmToPt(2);
        qrY = baseY + this.mmToPt(template.height_mm) - qrSize - this.mmToPt(2);
        break;
      case "left":
        qrX = baseX + this.mmToPt(2);
        qrY = baseY + (this.mmToPt(template.height_mm) - qrSize) / 2;
        break;
      case "right":
        qrX = baseX + this.mmToPt(template.width_mm) - qrSize - this.mmToPt(2);
        qrY = baseY + (this.mmToPt(template.height_mm) - qrSize) / 2;
        break;
      case "center":
      default:
        qrX = baseX + (this.mmToPt(template.width_mm) - qrSize) / 2;
        qrY = baseY + (this.mmToPt(template.height_mm) - qrSize) / 2;
        break;
    }

    await this.drawQRCodeAt(pdf, labelData, qrX, qrY, qrSize);
  }

  private async drawFieldSimple(
    pdf: jsPDF,
    field: LabelTemplateField,
    labelData: GeneratedLabelData,
    baseX: number,
    baseY: number
  ): Promise<void> {
    const fieldX = baseX + this.mmToPt(field.position_x);
    const fieldY = baseY + this.mmToPt(field.position_y);
    const fieldWidth = this.mmToPt(field.width_mm);
    const fieldHeight = this.mmToPt(field.height_mm);

    await this.drawFieldAt(pdf, field, labelData, fieldX, fieldY, fieldWidth, fieldHeight);
  }

  private async drawQRCodeAt(
    pdf: jsPDF,
    labelData: GeneratedLabelData,
    qrX: number,
    qrY: number,
    qrSize: number
  ): Promise<void> {
    try {
      // Generate QR code as data URL
      const qrDataUrl = await QRCode.toDataURL(labelData.qrUrl, {
        width: Math.ceil(qrSize * 4), // Generate at higher resolution
        margin: 0,
        color: {
          dark: "#000000",
          light: "#FFFFFF",
        },
        errorCorrectionLevel: "M",
      });

      // Add QR code to PDF
      pdf.addImage(qrDataUrl, "PNG", qrX, qrY, qrSize, qrSize);
    } catch (error) {
      console.error("Error generating QR code:", error);
      // Fallback: draw a simple placeholder rectangle
      pdf.setFillColor("#cccccc");
      pdf.rect(qrX, qrY, qrSize, qrSize, "F");
      pdf.setFontSize(8);
      pdf.setTextColor("#666666");
      pdf.text("QR", qrX + qrSize / 2, qrY + qrSize / 2, { align: "center" });
    }
  }

  private async drawFieldsVertically(
    pdf: jsPDF,
    fields: LabelTemplateField[],
    labelData: GeneratedLabelData,
    fieldsX: number,
    fieldsY: number,
    fieldsWidth: number,
    fieldsHeight: number,
    fieldVerticalGap: number
  ): Promise<void> {
    const fieldHeight = this.mmToPt(4); // Default field height

    // Sort fields by sort_order
    const sortedFields = fields.sort((a, b) => (a.sort_order || 0) - (b.sort_order || 0));

    let currentY = fieldsY;

    for (const field of sortedFields) {
      await this.drawFieldAt(pdf, field, labelData, fieldsX, currentY, fieldsWidth, fieldHeight);
      currentY += fieldHeight + fieldVerticalGap;

      // Stop if we've exceeded the available space
      if (currentY + fieldHeight > fieldsY + fieldsHeight) {
        break;
      }
    }
  }

  private async drawFieldAt(
    pdf: jsPDF,
    field: LabelTemplateField,
    labelData: GeneratedLabelData,
    fieldX: number,
    fieldY: number,
    fieldWidth: number,
    fieldHeight: number
  ): Promise<void> {
    // Draw field background
    if (field.background_color && field.background_color !== "transparent") {
      pdf.setFillColor(field.background_color);
      pdf.rect(fieldX, fieldY, fieldWidth, fieldHeight, "F");
    }

    // Draw field border
    if (field.border_enabled && field.border_color && field.border_width) {
      pdf.setDrawColor(field.border_color);
      pdf.setLineWidth(field.border_width);
      pdf.rect(fieldX, fieldY, fieldWidth, fieldHeight);
    }

    // Draw field content
    if (field.field_type === "text" && field.field_value) {
      pdf.setTextColor(field.text_color || "#000000");
      pdf.setFontSize(field.font_size || 10);

      // Replace template variables
      let displayText = field.field_value;
      displayText = displayText.replace("{name}", labelData.name || "");
      displayText = displayText.replace("{qr_token}", labelData.qrToken);
      displayText = displayText.replace("{type}", String(labelData.additionalData?.type || ""));

      // Calculate text position
      const fontSize = field.font_size || 10;
      let textX = fieldX;
      let textY = fieldY + fontSize;

      // Adjust for alignment
      switch (field.text_align) {
        case "center":
          textX = fieldX + fieldWidth / 2;
          break;
        case "right":
          textX = fieldX + fieldWidth - 5;
          break;
        default:
          textX = fieldX + 5;
          break;
      }

      switch (field.vertical_align) {
        case "center":
          textY = fieldY + fieldHeight / 2 + fontSize / 3;
          break;
        case "bottom":
          textY = fieldY + fieldHeight - 5;
          break;
        default:
          textY = fieldY + fontSize + 2;
          break;
      }

      pdf.text(displayText, textX, textY, {
        align: field.text_align as "left" | "center" | "right" | "justify",
        maxWidth: fieldWidth - 10,
      });
    } else if (field.field_type === "blank") {
      // Draw a line for blank fields
      pdf.setDrawColor(field.text_color || "#000000");
      pdf.setLineWidth(0.5);
      pdf.line(
        fieldX + 5,
        fieldY + fieldHeight - 3,
        fieldX + fieldWidth - 5,
        fieldY + fieldHeight - 3
      );
    }

    // Draw field label if enabled
    if (field.show_label && field.label_text) {
      pdf.setTextColor("#666666");
      pdf.setFontSize(Math.max((field.font_size || 10) - 2, 8));
      pdf.text(field.label_text, fieldX, fieldY - 2);
    }
  }

  async downloadPDF(pdf: jsPDF, filename: string = `labels_${Date.now()}.pdf`): Promise<void> {
    pdf.save(filename);
  }

  getBlobUrl(pdf: jsPDF): string {
    const blob = pdf.output("blob");
    return URL.createObjectURL(blob);
  }
}
