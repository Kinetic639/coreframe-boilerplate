"use client";

import { LabelTemplate } from "@/lib/types/qr-system";
import { QRCodeComponent } from "@/components/ui/qr-code";

interface TemplateMiniatureProps {
  template: LabelTemplate;
  width?: number;
  height?: number;
  onClick?: () => void;
}

export function TemplateMiniature({
  template,
  width = 80,
  height = 50,
  onClick,
}: TemplateMiniatureProps) {
  // Scale calculation based on actual template size
  const actualWidth = Number(template.width_mm);
  const actualHeight = Number(template.height_mm);
  const scale = Math.min(width / actualWidth, height / actualHeight, 2);

  const scaledWidth = actualWidth * scale;
  const scaledHeight = actualHeight * scale;

  const mmToPx = (mm: number) => mm * scale;

  const layoutDirection = template.layout_direction || "row";
  const isQROnly =
    !template.show_additional_info || !template.fields || template.fields.length === 0;

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

  const containerStyle: React.CSSProperties = {
    width: `${scaledWidth}px`,
    height: `${scaledHeight}px`,
    backgroundColor: template.background_color || "#FFFFFF",
    border: template.border_enabled
      ? `${(template.border_width || 0.5) * scale}px solid ${template.border_color || "#000000"}`
      : "1px solid #e2e8f0",
    display: "flex",
    flexDirection: getFlexDirection(layoutDirection),
    alignItems: "center",
    justifyContent: "center",
    padding: `${mmToPx(2)}px`,
    fontSize: `${8 * scale}px`,
    color: template.text_color || "#000000",
    cursor: onClick ? "pointer" : "default",
    transition: "all 0.2s ease",
  };

  const qrSize = Math.min(
    (template.qr_size_mm || 15) * scale,
    scaledWidth * 0.4,
    scaledHeight * 0.8
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
          gap: `${1 * scale}px`,
          flex: 1,
          minWidth: 0,
        }}
      >
        {sortedFields.map((field, index) => (
          <div
            key={field.id || index}
            style={{
              fontSize: `${(field.font_size || 10) * scale * 0.8}px`,
              fontWeight: field.font_weight || "normal",
              color: field.text_color || template.text_color || "#000000",
              backgroundColor:
                field.background_color !== "transparent" ? field.background_color : undefined,
              padding: `${1 * scale}px`,
              textAlign: (field.text_align as any) || "left",
              overflow: "hidden",
              textOverflow: "ellipsis",
              whiteSpace: "nowrap",
              maxWidth: "100%",
            }}
          >
            {field.field_value || field.field_name}
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
          {layoutDirection.includes("row") && renderMiniQR()}
          {template.show_additional_info && renderFields()}
          {layoutDirection.includes("column") && renderMiniQR()}
        </>
      )}
    </div>
  );
}
