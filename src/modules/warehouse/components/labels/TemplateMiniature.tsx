"use client";

import { LabelTemplate } from "@/lib/types/qr-system";
import { QRCodeComponent } from "@/components/ui/qr-code";

interface TemplateMiniatureProps {
  template: LabelTemplate;
  width?: number; // deprecated - use maxWidth
  height?: number; // deprecated - use maxHeight
  maxWidth?: number;
  maxHeight?: number;
  onClick?: () => void;
}

export function TemplateMiniature({
  template,
  width = 120,
  height = 80,
  maxWidth,
  maxHeight,
  onClick,
}: TemplateMiniatureProps) {
  // Use new maxWidth/maxHeight or fallback to legacy width/height
  const containerMaxWidth = maxWidth || width;
  const containerMaxHeight = maxHeight || height;

  // Scale calculation based on actual template size with better constraints
  const actualWidth = Number(template.width_mm);
  const actualHeight = Number(template.height_mm);

  // Calculate scale to fit within container bounds while maintaining aspect ratio
  const aspectRatio = actualWidth / actualHeight;

  // Determine final dimensions based on aspect ratio and constraints
  let finalWidth: number;
  let finalHeight: number;

  if (aspectRatio > containerMaxWidth / containerMaxHeight) {
    // Width-constrained
    finalWidth = containerMaxWidth;
    finalHeight = containerMaxWidth / aspectRatio;
  } else {
    // Height-constrained
    finalHeight = containerMaxHeight;
    finalWidth = containerMaxHeight * aspectRatio;
  }

  const scale = finalWidth / actualWidth;

  // Use the calculated dimensions to maintain proper proportions
  const scaledWidth = finalWidth;
  const scaledHeight = finalHeight;

  const mmToPx = (mm: number) => mm * scale;

  const layoutDirection = template.layout_direction || "row";

  // Extract properties from template_config if needed
  const config = template.template_config || {};
  const itemsAlignment = config.items_alignment || template.items_alignment || "center";
  const fieldVerticalGap = config.field_vertical_gap || template.field_vertical_gap || 2;

  const isQROnly = template.qr_position === "center" && !template.show_additional_info;

  const getFlexDirection = (direction: string) => {
    switch (direction) {
      case "column":
        return "column" as const;
      case "row-reverse":
        return "row-reverse" as const;
      case "column-reverse":
        return "column-reverse" as const;
      default:
        return "row" as const;
    }
  };

  // Convert alignment to CSS alignment
  const getAlignItems = (alignment: string) => {
    switch (alignment) {
      case "start":
        return "flex-start" as const;
      case "end":
        return "flex-end" as const;
      default:
        return "center" as const;
    }
  };

  const getJustifyContent = (alignment: string) => {
    switch (alignment) {
      case "start":
        return "flex-start" as const;
      case "end":
        return "flex-end" as const;
      default:
        return "center" as const;
    }
  };

  const containerStyle: React.CSSProperties = {
    width: `${scaledWidth}px`,
    height: `${scaledHeight}px`,
    backgroundColor: template.background_color || "#FFFFFF",
    border: template.border_enabled
      ? `${Math.max((template.border_width || 0.5) * scale, 1)}px solid ${template.border_color || "#000000"}`
      : "1px solid #e2e8f0",
    display: "flex",
    flexDirection: isQROnly ? "row" : getFlexDirection(layoutDirection),
    alignItems: isQROnly ? "center" : getAlignItems(itemsAlignment, layoutDirection),
    justifyContent: isQROnly ? "center" : getJustifyContent(itemsAlignment, layoutDirection),
    padding: `${Math.max(mmToPx(1), 1)}px`,
    fontSize: `${Math.max(8 * scale, 8)}px`,
    color: template.text_color || "#000000",
    cursor: onClick ? "pointer" : "default",
    transition: "all 0.2s ease",
    gap: isQROnly ? "0px" : `${Math.max(mmToPx(0.5), 1)}px`,
    boxSizing: "border-box",
    flexShrink: 0, // Prevent the container itself from shrinking
  };

  const qrSize = Math.min(
    (template.qr_size_mm || 15) * scale,
    isQROnly
      ? Math.min(scaledWidth * 0.8, scaledHeight * 0.8)
      : Math.min(scaledWidth * 0.45, scaledHeight * 0.9)
  );

  const renderMiniQR = () => {
    const qrToken = `MINI${template.id.slice(0, 4).toUpperCase()}`;
    return (
      <div style={{ flexShrink: 0 }}>
        <QRCodeComponent
          value={qrToken}
          size={qrSize}
          style={{
            width: `${qrSize}px`,
            height: `${qrSize}px`,
          }}
        />
      </div>
    );
  };

  const renderFields = () => {
    if (!template.show_additional_info || !template.fields || template.fields.length === 0)
      return null;

    const sortedFields = template.fields
      .sort((a, b) => (a.sort_order || 0) - (b.sort_order || 0))
      .slice(0, 3); // Show max 3 fields in miniature

    return (
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          gap: `${mmToPx(fieldVerticalGap)}px`,
          flex: layoutDirection.includes("column") ? 0 : 1,
          justifyContent: "center",
          minHeight: "fit-content",
          height: layoutDirection.includes("column") ? "auto" : "100%",
          minWidth: 0,
          overflow: "visible",
        }}
      >
        {sortedFields.map((field, index) => (
          <div
            key={field.id || index}
            style={{
              width: "100%",
              height: `${mmToPx(field.height_mm)}px`,
              backgroundColor:
                field.background_color === "transparent" ? "transparent" : field.background_color,
              border: field.border_enabled
                ? `${Math.max(field.border_width * scale, 0.5)}px solid ${field.border_color}`
                : "none",
              padding: `${Math.max(mmToPx(field.padding_top || 1), 1)}px ${Math.max(mmToPx(field.padding_right || 1), 1)}px ${Math.max(mmToPx(field.padding_bottom || 1), 1)}px ${Math.max(mmToPx(field.padding_left || 1), 1)}px`,
              color: field.text_color,
              fontSize: `${Math.max((field.font_size || 10) * scale * 0.8, 7)}px`,
              fontWeight: field.font_weight,
              textAlign: (field.text_align as any) || "left",
              display: "flex",
              alignItems:
                field.vertical_align === "top"
                  ? "flex-start"
                  : field.vertical_align === "bottom"
                    ? "flex-end"
                    : "center",
              wordWrap: "break-word" as const,
              overflowWrap: "break-word" as const,
              overflow: "hidden",
              textOverflow: "ellipsis",
              lineHeight: "1.1",
              boxSizing: "border-box",
            }}
          >
            {field.field_value || field.field_name || `Field ${index + 1}`}
          </div>
        ))}
      </div>
    );
  };

  return (
    <div style={containerStyle} onClick={onClick} className={onClick ? "hover:shadow-md" : ""}>
      {isQROnly ? (
        renderMiniQR()
      ) : (
        <>
          {/* Render QR code and fields based on layout direction */}
          {(layoutDirection === "row" || layoutDirection === "column") && renderMiniQR()}

          {template.show_additional_info &&
            template.fields &&
            template.fields.length > 0 &&
            renderFields()}

          {(layoutDirection === "row-reverse" || layoutDirection === "column-reverse") &&
            renderMiniQR()}
        </>
      )}
    </div>
  );
}
