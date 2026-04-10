import React from "react";
import { Document, Page, View, Text, Image, StyleSheet } from "@react-pdf/renderer";
import { PDFLabelTemplate, PDFLabelField, LabelDataRecord } from "./types";

interface PDFLabelProps {
  template: PDFLabelTemplate;
  data: LabelDataRecord[];
  pageSize?: "A4" | "Letter";
  labelsPerPage?: number;
  qrCodeMap?: Map<string, string>;
}

interface SingleLabelProps {
  template: PDFLabelTemplate;
  data: LabelDataRecord;
  qrDataUrl?: string;
}

// Convert mm to points (1mm = 2.834645669 points)
const mmToPt = (mm: number): number => mm * 2.834645669;

// Single label component - this renders exactly one label
const SingleLabel: React.FC<SingleLabelProps> = ({ template, data, qrDataUrl }) => {
  const labelWidth = mmToPt(template.width_mm);
  const labelHeight = mmToPt(template.height_mm);

  // Create styles for the label container
  const labelStyles = StyleSheet.create({
    container: {
      width: labelWidth,
      height: labelHeight,
      backgroundColor: template.background_color || "#FFFFFF",
      border: template.border_enabled
        ? `${mmToPt(template.border_width || 0.5)}pt solid ${template.border_color || "#000000"}`
        : "none",
      position: "relative",
    },
    content: {
      position: "relative",
      width: "100%",
      height: "100%",
    },
    qrCode: {
      position: "absolute",
      width: mmToPt(template.qr_size_mm || 15),
      height: mmToPt(template.qr_size_mm || 15),
    },
    field: {
      position: "absolute",
      display: "flex",
      justifyContent: "flex-start",
      alignItems: "center",
    },
  });

  // Calculate QR position (if not explicitly stored)
  const getQRPosition = () => {
    const qrSize = mmToPt(template.qr_size_mm || 15);
    const padding = mmToPt(2);

    // Check for stored position first
    const qrConfig = (template.template_config as any)?.qr || {};
    if (qrConfig.position_x !== undefined && qrConfig.position_y !== undefined) {
      return {
        left: mmToPt(qrConfig.position_x),
        top: mmToPt(qrConfig.position_y),
      };
    }

    // Fall back to calculated position based on qr_position
    const position = template.qr_position || "left";
    switch (position) {
      case "top-left":
        return { left: padding, top: padding };
      case "top-right":
        return { left: labelWidth - qrSize - padding, top: padding };
      case "bottom-left":
        return { left: padding, top: labelHeight - qrSize - padding };
      case "bottom-right":
        return { left: labelWidth - qrSize - padding, top: labelHeight - qrSize - padding };
      case "right":
        return { left: labelWidth - qrSize - padding, top: (labelHeight - qrSize) / 2 };
      case "center":
        return { left: (labelWidth - qrSize) / 2, top: (labelHeight - qrSize) / 2 };
      case "left":
      default:
        return { left: padding, top: (labelHeight - qrSize) / 2 };
    }
  };

  const qrPosition = getQRPosition();

  return (
    <View style={labelStyles.container}>
      <View style={labelStyles.content}>
        {/* Render QR Code */}
        {qrDataUrl && (
          <Image
            style={[
              labelStyles.qrCode,
              {
                left: qrPosition.left,
                top: qrPosition.top,
              },
            ]}
            src={qrDataUrl}
          />
        )}

        {/* Render Fields - ALWAYS render if fields exist */}
        {template.fields &&
          template.fields.length > 0 &&
          template.fields.map((field, index) => {
            return (
              <LabelField key={field.id || index} field={field} data={data} template={template} />
            );
          })}
      </View>
    </View>
  );
};

// Individual field component
const LabelField: React.FC<{
  field: PDFLabelField;
  data: LabelDataRecord;
  template: PDFLabelTemplate;
}> = ({ field, data, template }) => {
  // Handle different field types
  if (field.field_type === "blank") {
    // Render blank line
    const fieldStyles = StyleSheet.create({
      container: {
        position: "absolute",
        left: mmToPt(field.position_x),
        top: mmToPt(field.position_y),
        width: mmToPt(field.width_mm),
        height: mmToPt(field.height_mm),
        borderBottom: `${mmToPt(0.5)} solid ${template.text_color || "#000000"}`,
        display: "flex",
        alignItems: "flex-end",
      },
    });

    return <View style={fieldStyles.container} />;
  }

  if (field.field_type !== "text") {
    console.log(`Skipping field type: ${field.field_type}`);
    return null;
  }

  // Get display text - use field_value, field_name, or default
  let displayText = field.field_value || field.field_name || "Sample text";

  // Replace variables in text
  Object.keys(data).forEach((key) => {
    displayText = displayText.replace(`{${key}}`, String(data[key] || ""));
  });

  const fieldStyles = StyleSheet.create({
    container: {
      position: "absolute",
      left: mmToPt(field.position_x),
      top: mmToPt(field.position_y),
      width: mmToPt(field.width_mm),
      height: mmToPt(field.height_mm),
      backgroundColor:
        field.background_color && field.background_color !== "transparent"
          ? field.background_color
          : undefined,
      border: field.border_enabled
        ? `${mmToPt(field.border_width || 0.5)}pt solid ${field.border_color || "#000000"}`
        : undefined,
      display: "flex",
      justifyContent:
        field.text_align === "center"
          ? "center"
          : field.text_align === "right"
            ? "flex-end"
            : "flex-start",
      alignItems:
        field.vertical_align === "top"
          ? "flex-start"
          : field.vertical_align === "bottom"
            ? "flex-end"
            : "center",
      padding: mmToPt(1), // Small padding for readability
    },
    text: {
      fontSize: Math.max(field.font_size || 10, 8), // Minimum readable font size
      fontWeight: field.font_weight === "bold" ? "bold" : "normal",
      color: field.text_color || template.text_color || "#000000",
      lineHeight: 1.2,
    },
  });

  return (
    <View style={fieldStyles.container}>
      <Text style={fieldStyles.text}>{displayText}</Text>
    </View>
  );
};

// Main PDF document component
const PDFLabelDocument: React.FC<PDFLabelProps> = ({
  template,
  data,
  pageSize = "A4",
  labelsPerPage = 6,
  qrCodeMap,
}) => {
  // Calculate grid layout for labels
  const pageWidth = pageSize === "A4" ? 595 : 612; // A4 width in points
  const pageHeight = pageSize === "A4" ? 842 : 792; // A4 height in points
  const margin = 40; // 40pt margin

  const labelWidthPt = mmToPt(template.width_mm);
  const labelHeightPt = mmToPt(template.height_mm);

  // Calculate how many labels fit on a page
  const availableWidth = pageWidth - 2 * margin;
  const availableHeight = pageHeight - 2 * margin;
  const gutter = 20; // 20pt gutter between labels

  const cols = Math.floor((availableWidth + gutter) / (labelWidthPt + gutter));
  const rows = Math.floor((availableHeight + gutter) / (labelHeightPt + gutter));
  const actualLabelsPerPage = Math.min(labelsPerPage, cols * rows);

  const pageStyles = StyleSheet.create({
    page: {
      flexDirection: "row",
      flexWrap: "wrap",
      padding: margin,
      gap: gutter,
    },
    labelWrapper: {
      marginBottom: gutter,
      marginRight: gutter,
    },
  });

  // Calculate number of pages needed
  const totalPages = Math.ceil(data.length / actualLabelsPerPage);

  // Get QR code from the pre-generated map
  const getQRDataUrl = (qrData: string): string => {
    if (qrCodeMap && qrCodeMap.has(qrData)) {
      return qrCodeMap.get(qrData)!;
    }
    // Fallback placeholder
    return `data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8/5+hHgAHggJ/PchI7wAAAABJRU5ErkJggg==`;
  };

  return (
    <Document>
      {Array.from({ length: totalPages }, (_, pageIndex) => {
        const startIndex = pageIndex * actualLabelsPerPage;
        const endIndex = Math.min(startIndex + actualLabelsPerPage, data.length);
        const pageData = data.slice(startIndex, endIndex);

        return (
          <Page
            key={pageIndex}
            size={pageSize === "Letter" ? "LETTER" : "A4"}
            style={pageStyles.page}
          >
            {pageData.map((labelData, labelIndex) => {
              const qrData = labelData.qr || labelData.qrData || `QR-${Date.now()}-${labelIndex}`;
              const qrDataUrl = getQRDataUrl(qrData);

              return (
                <View key={labelIndex} style={pageStyles.labelWrapper}>
                  <SingleLabel template={template} data={labelData} qrDataUrl={qrDataUrl} />
                </View>
              );
            })}
          </Page>
        );
      })}
    </Document>
  );
};

export { PDFLabelDocument, SingleLabel };
export type { PDFLabelProps, SingleLabelProps };
