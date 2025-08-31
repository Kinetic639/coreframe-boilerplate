"use client";

import { useState } from "react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { LabelTemplate, LabelTemplateField } from "@/lib/types/qr-system";

interface InteractiveLabelCanvasProps {
  template: LabelTemplate;
  selectedField?: LabelTemplateField | null;
  onFieldSelect?: (field: LabelTemplateField) => void;
  onFieldAdd?: (fieldType: "text" | "blank") => void;
  viewMode: "edit" | "preview";
}

export function InteractiveLabelCanvas({
  template,
  selectedField,
  onFieldSelect,
  viewMode,
}: InteractiveLabelCanvasProps) {
  const [zoomLevel, setZoomLevel] = useState(1);

  // Convert mm to CSS pixels with zoom factor applied directly
  const mmToPx = (mm: number) => mm * 3.7795275591 * zoomLevel;

  // Calculate dimensions and layout
  const isQROnly = template.qr_position === "center" && !template.show_additional_info;
  const layoutDirection = template.layout_direction || "row";
  const itemsAlignment = template.items_alignment || "center";

  const labelWidth = isQROnly
    ? mmToPx(
        template.qr_size_mm +
          (template.label_padding_left || 2) +
          (template.label_padding_right || 2) +
          4
      )
    : mmToPx(template.width_mm);
  const labelHeight = isQROnly
    ? labelWidth
    : template.show_additional_info && template.fields?.length
      ? "auto"
      : mmToPx(template.height_mm);

  // Convert layout direction to CSS flexDirection
  const getFlexDirection = (direction: string) => {
    switch (direction) {
      case "column":
        return "column";
      case "column-reverse":
        return "column-reverse";
      case "row-reverse":
        return "row-reverse";
      default:
        return "row";
    }
  };

  // Convert alignment to CSS alignment
  const getAlignItems = (alignment: string, direction: string) => {
    const isColumn = direction.includes("column");
    switch (alignment) {
      case "start":
        return isColumn ? "flex-start" : "flex-start";
      case "end":
        return isColumn ? "flex-end" : "flex-end";
      default:
        return "center";
    }
  };

  const getJustifyContent = (alignment: string, direction: string) => {
    const isColumn = direction.includes("column");
    switch (alignment) {
      case "start":
        return isColumn ? "flex-start" : "flex-start";
      case "end":
        return isColumn ? "flex-end" : "flex-end";
      default:
        return "center";
    }
  };

  const labelStyle = {
    width: isQROnly ? `${labelWidth}px` : "fit-content",
    minWidth: `${labelWidth}px`,
    height: labelHeight,
    minHeight: isQROnly ? `${labelWidth}px` : `${mmToPx(template.height_mm)}px`,
    backgroundColor: template.background_color,
    border: template.border_enabled
      ? `${template.border_width * zoomLevel}px solid ${template.border_color}`
      : "none",
    paddingTop: `${mmToPx(template.label_padding_top || 2)}px`,
    paddingRight: `${mmToPx(template.label_padding_right || 2)}px`,
    paddingBottom: `${mmToPx(template.label_padding_bottom || 2)}px`,
    paddingLeft: `${mmToPx(template.label_padding_left || 2)}px`,
    position: "relative" as const,
    display: "flex",
    flexDirection: isQROnly ? "row" : getFlexDirection(layoutDirection),
    alignItems: isQROnly ? "center" : getAlignItems(itemsAlignment, layoutDirection),
    justifyContent: isQROnly ? "center" : getJustifyContent(itemsAlignment, layoutDirection),
    gap: isQROnly ? "0px" : `${mmToPx(2)}px`,
  };

  const qrStyle = {
    width: `${mmToPx(template.qr_size_mm)}px`,
    height: `${mmToPx(template.qr_size_mm)}px`,
    backgroundColor: "#fff",
    border: "1px solid #ccc",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    fontSize: "10px",
    color: "#666",
    flexShrink: 0,
  };

  const fieldsContainerStyle = {
    display: "flex",
    flexDirection: "column" as const,
    gap: `${mmToPx(template.field_vertical_gap || 2)}px`,
    flex: layoutDirection.includes("column") ? 0 : 1, // Don't flex in column layouts
    justifyContent: "center",
    minHeight: "fit-content",
    height: layoutDirection.includes("column") ? "auto" : "100%",
    minWidth: 0, // Allow shrinking
    overflow: "visible", // Allow content overflow
  };

  const getFieldStyle = (field: LabelTemplateField, isSelected: boolean) => ({
    width: "100%",
    minHeight: `${mmToPx(field.height_mm)}px`,
    height: "auto",
    backgroundColor:
      field.background_color === "transparent" ? "transparent" : field.background_color,
    border: field.border_enabled
      ? `${field.border_width * zoomLevel}px solid ${field.border_color}`
      : viewMode === "edit"
        ? `${1 * zoomLevel}px dashed #ccc`
        : "none",
    paddingTop: `${mmToPx(field.padding_top || 2)}px`,
    paddingRight: `${mmToPx(field.padding_right || 2)}px`,
    paddingBottom: `${mmToPx(field.padding_bottom || 2)}px`,
    paddingLeft: `${mmToPx(field.padding_left || 2)}px`,
    color: field.text_color,
    fontSize: `${field.font_size * zoomLevel}px`,
    fontWeight: field.font_weight,
    textAlign: field.text_align as any,
    display: "flex",
    alignItems:
      field.vertical_align === "top"
        ? "flex-start"
        : field.vertical_align === "bottom"
          ? "flex-end"
          : "center",
    cursor: viewMode === "edit" ? "pointer" : "default",
    outline: isSelected && viewMode === "edit" ? `${2 * zoomLevel}px solid #3b82f6` : "none",
    outlineOffset: `${2 * zoomLevel}px`,
    position: "relative" as const,
    wordWrap: "break-word" as const,
    overflowWrap: "break-word" as const,
    overflow: "hidden",
  });

  const renderQRCode = () => (
    <div style={qrStyle}>
      {/* Realistic QR code representation */}
      <div
        style={{
          width: "100%",
          height: "100%",
          backgroundColor: "#fff",
          position: "relative",
          display: "grid",
          gridTemplate: "repeat(25, 1fr) / repeat(25, 1fr)",
          gap: 0,
        }}
      >
        {/* Generate QR code pattern */}
        {Array.from({ length: 625 }, (_, i) => {
          const row = Math.floor(i / 25);
          const col = i % 25;

          // Finder patterns (corners)
          const isFinderPattern =
            (row < 7 && col < 7) || (row < 7 && col >= 18) || (row >= 18 && col < 7);

          // Timing patterns
          const isTimingPattern =
            (row === 6 && col >= 8 && col <= 16) || (col === 6 && row >= 8 && row <= 16);

          // Data pattern (pseudo-random)
          const isData =
            !isFinderPattern &&
            !isTimingPattern &&
            ((row + col) % 3 === 0 || (row * col + row + col) % 5 === 0);

          const shouldBeFilled = isFinderPattern || isTimingPattern || isData;

          return (
            <div
              key={i}
              style={{
                backgroundColor: shouldBeFilled ? "#000" : "#fff",
                width: "100%",
                height: "100%",
              }}
            />
          );
        })}

        {/* Finder pattern squares */}
        {[
          { top: 0, left: 0 },
          { top: 0, right: 0 },
          { bottom: 0, left: 0 },
        ].map((pos, idx) => (
          <div
            key={idx}
            style={{
              position: "absolute",
              width: "28%",
              height: "28%",
              border: "8% solid #000",
              backgroundColor: "#fff",
              ...pos,
            }}
          >
            <div
              style={{
                width: "35%",
                height: "35%",
                backgroundColor: "#000",
                position: "absolute",
                top: "50%",
                left: "50%",
                transform: "translate(-50%, -50%)",
              }}
            />
          </div>
        ))}
      </div>
    </div>
  );

  const renderField = (field: LabelTemplateField) => {
    const isSelected = selectedField?.id === field.id;
    const labelPosition = field.label_position || "inside-top-left";
    const hasLabel = field.show_label && field.label_text;

    // Calculate label space requirements
    const labelFontSize = (field.label_font_size || 10) * zoomLevel;
    const labelSpace = hasLabel ? labelFontSize + 4 * zoomLevel : 0; // font size + padding

    const getFieldWithLabelStyle = () => {
      const baseStyle = getFieldStyle(field, isSelected);

      // Create a flex container that reserves space for labels
      const containerStyle: any = {
        ...baseStyle,
        display: "flex",
        position: "relative",
      };

      // Adjust layout based on label position - don't modify padding, just set flex direction
      if (hasLabel) {
        if (labelPosition.includes("top")) {
          containerStyle.flexDirection = "column";
        } else if (labelPosition.includes("bottom")) {
          containerStyle.flexDirection = "column-reverse";
        } else if (labelPosition.includes("center")) {
          // For center positions, we'll overlay the label but ensure content doesn't interfere
          containerStyle.minHeight = `${Math.max(mmToPx(field.height_mm), labelSpace * 1.5)}px`;
        }
      }

      return containerStyle;
    };

    const getLabelStyle = () => {
      if (!hasLabel) return {};

      const labelStyle: any = {
        fontSize: `${labelFontSize}px`,
        color: field.label_color || "#666",
        flexShrink: 0,
        lineHeight: 1.2,
        whiteSpace: "nowrap",
        overflow: "hidden",
        textOverflow: "ellipsis",
      };

      // Position the label within the field
      if (labelPosition.includes("top") || labelPosition.includes("bottom")) {
        // For top/bottom, label takes dedicated space with small margin
        labelStyle.alignSelf = labelPosition.includes("left")
          ? "flex-start"
          : labelPosition.includes("right")
            ? "flex-end"
            : "center";
        labelStyle.marginBottom = labelPosition.includes("top") ? `${1 * zoomLevel}px` : 0;
        labelStyle.marginTop = labelPosition.includes("bottom") ? `${1 * zoomLevel}px` : 0;
      } else {
        // For center positions, use absolute positioning
        labelStyle.position = "absolute";
        labelStyle.zIndex = 2;

        // Vertical positioning
        if (labelPosition.includes("center-center")) {
          labelStyle.top = "50%";
          labelStyle.transform = "translateY(-50%)";
        }

        // Horizontal positioning
        if (labelPosition.includes("left")) {
          labelStyle.left = `${2 * zoomLevel}px`;
        } else if (labelPosition.includes("right")) {
          labelStyle.right = `${2 * zoomLevel}px`;
        } else if (labelPosition.includes("center")) {
          labelStyle.left = "50%";
          labelStyle.transform = labelPosition.includes("center-center")
            ? "translate(-50%, -50%)"
            : "translateX(-50%)";
        }
      }

      return labelStyle;
    };

    const getContentStyle = () => {
      const contentStyle: any = {
        flex: 1,
        display: "flex",
        alignItems:
          field.vertical_align === "top"
            ? "flex-start"
            : field.vertical_align === "bottom"
              ? "flex-end"
              : "center",
        justifyContent:
          field.text_align === "left"
            ? "flex-start"
            : field.text_align === "right"
              ? "flex-end"
              : "center",
        minHeight: "inherit",
        position: "relative",
      };

      // Adjust content positioning if label is in center and might overlap
      if (hasLabel && labelPosition.includes("center")) {
        contentStyle.zIndex = 1;
        // Add some transparency or adjust positioning if label overlaps content
        if (labelPosition === "inside-center-center") {
          contentStyle.opacity = 0.8;
        }
      }

      return contentStyle;
    };

    return (
      <div key={field.id} style={getFieldWithLabelStyle()} onClick={() => onFieldSelect?.(field)}>
        {/* Label */}
        {hasLabel && <div style={getLabelStyle()}>{field.label_text}</div>}

        {/* Field Content */}
        <div style={getContentStyle()}>
          {field.field_type === "text" && field.field_value ? (
            <span>{field.field_value}</span>
          ) : field.field_type === "blank" ? (
            <div
              style={{
                borderBottom: `${1 * zoomLevel}px solid ${field.text_color}`,
                width: "100%",
                height: `${1 * zoomLevel}px`,
                alignSelf: "flex-end",
                marginBottom: `${2 * zoomLevel}px`,
              }}
            />
          ) : null}
        </div>
      </div>
    );
  };

  return (
    <div className="flex max-w-full flex-col items-center space-y-4">
      {/* Canvas Container */}
      <Card className="max-w-full overflow-auto bg-white p-4 shadow-lg">
        <div
          className="flex items-center justify-center"
          style={{
            padding: "20px",
          }}
        >
          <div style={labelStyle}>
            {isQROnly ? (
              renderQRCode()
            ) : (
              <>
                {/* Render QR code and fields based on layout direction */}
                {(layoutDirection === "row" || layoutDirection === "column") && renderQRCode()}

                {template.show_additional_info && template.fields && template.fields.length > 0 && (
                  <div style={fieldsContainerStyle}>
                    {template.fields.sort((a, b) => a.sort_order - b.sort_order).map(renderField)}
                  </div>
                )}

                {(layoutDirection === "row-reverse" || layoutDirection === "column-reverse") &&
                  renderQRCode()}
              </>
            )}
          </div>
        </div>
      </Card>

      {/* Controls */}
      <div className="flex flex-col items-center space-y-4">
        {/* Zoom Control */}
        <div className="flex items-center gap-4">
          <Label className="text-sm font-medium">Zoom: {Math.round(zoomLevel * 100)}%</Label>
          <Slider
            value={[zoomLevel]}
            onValueChange={([value]) => setZoomLevel(value)}
            max={6}
            min={0.5}
            step={0.1}
            className="w-32"
          />
        </div>

        {/* Label Info */}
        <div className="flex items-center gap-4 text-sm text-muted-foreground">
          <Badge variant="outline">
            {template.width_mm}×{template.height_mm}mm
          </Badge>
          <Badge variant="outline">{template.dpi} DPI</Badge>
          {selectedField && (
            <Badge variant="default" className="bg-primary">
              {selectedField.field_name}
            </Badge>
          )}
          {!template.show_additional_info && <Badge variant="secondary">Tylko kod QR</Badge>}
        </div>
      </div>
    </div>
  );
}
