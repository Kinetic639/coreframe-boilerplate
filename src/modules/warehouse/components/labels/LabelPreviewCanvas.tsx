"use client";

import { useEffect, useRef } from "react";
import { LabelTemplate, LabelTemplateField } from "@/lib/types/qr-system";

interface LabelPreviewCanvasProps {
  template: LabelTemplate;
  selectedField?: LabelTemplateField | null;
  onFieldSelect?: (field: LabelTemplateField) => void;
  mode?: "desktop" | "mobile";
}

export function LabelPreviewCanvas({
  template,
  selectedField,
  onFieldSelect,
  mode = "desktop",
}: LabelPreviewCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // Calculate scale based on mode and container size
  const calculateScale = () => {
    if (!containerRef.current) return 1;

    const containerWidth = containerRef.current.clientWidth;
    const maxWidth = mode === "mobile" ? 300 : 500;
    const availableWidth = Math.min(containerWidth - 40, maxWidth); // 40px for padding

    // Convert mm to pixels at 300 DPI (standard for print)
    const mmToPx = (mm: number) => (mm * template.dpi) / 25.4;
    const labelWidthPx = mmToPx(template.width_mm);

    return Math.min(availableWidth / labelWidthPx, 4); // Max 4x scale
  };

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const scale = calculateScale();

    // Convert mm to pixels at 300 DPI
    const mmToPx = (mm: number) => (mm * template.dpi) / 25.4;

    const labelWidth = mmToPx(template.width_mm);
    const labelHeight = mmToPx(template.height_mm);

    // Set canvas size
    canvas.width = labelWidth * scale;
    canvas.height = labelHeight * scale;

    // Scale the context for drawing
    ctx.scale(scale, scale);

    // Clear canvas
    ctx.clearRect(0, 0, labelWidth, labelHeight);

    // Draw background
    ctx.fillStyle = template.background_color;
    ctx.fillRect(0, 0, labelWidth, labelHeight);

    // Draw border if enabled
    if (template.border_enabled) {
      ctx.strokeStyle = template.border_color;
      ctx.lineWidth = template.border_width;
      ctx.strokeRect(0, 0, labelWidth, labelHeight);
    }

    // Draw QR code if additional info is shown
    if (template.show_additional_info) {
      drawQRCode(ctx, template, mmToPx);
    } else {
      // For QR-only labels, center the QR code
      drawCenteredQRCode(ctx, template, mmToPx, labelWidth, labelHeight);
    }

    // Draw fields if additional info is shown
    if (template.show_additional_info && template.fields) {
      template.fields
        .sort((a, b) => a.sort_order - b.sort_order)
        .forEach((field) => {
          drawField(ctx, field, mmToPx, selectedField?.id === field.id);
        });
    }
  }, [template, selectedField, mode]);

  const drawQRCode = (
    ctx: CanvasRenderingContext2D,
    template: LabelTemplate,
    mmToPx: (mm: number) => number
  ) => {
    const qrSize = mmToPx(template.qr_size_mm);
    let qrX = 0;
    let qrY = 0;

    // Position QR code based on qr_position
    switch (template.qr_position) {
      case "top-left":
        qrX = mmToPx(2);
        qrY = mmToPx(2);
        break;
      case "top-right":
        qrX = mmToPx(template.width_mm) - qrSize - mmToPx(2);
        qrY = mmToPx(2);
        break;
      case "bottom-left":
        qrX = mmToPx(2);
        qrY = mmToPx(template.height_mm) - qrSize - mmToPx(2);
        break;
      case "bottom-right":
        qrX = mmToPx(template.width_mm) - qrSize - mmToPx(2);
        qrY = mmToPx(template.height_mm) - qrSize - mmToPx(2);
        break;
      case "left":
        qrX = mmToPx(2);
        qrY = (mmToPx(template.height_mm) - qrSize) / 2;
        break;
      case "right":
        qrX = mmToPx(template.width_mm) - qrSize - mmToPx(2);
        qrY = (mmToPx(template.height_mm) - qrSize) / 2;
        break;
      case "center":
      default:
        qrX = (mmToPx(template.width_mm) - qrSize) / 2;
        qrY = (mmToPx(template.height_mm) - qrSize) / 2;
        break;
    }

    // Draw white background for QR code
    ctx.fillStyle = "#FFFFFF";
    ctx.fillRect(qrX, qrY, qrSize, qrSize);

    // Generate realistic QR pattern
    const moduleSize = qrSize / 25; // Use 25x25 for better resolution
    ctx.fillStyle = "#000000";

    // Create a more realistic QR code pattern
    const pattern = generateQRPattern(25);

    for (let row = 0; row < 25; row++) {
      for (let col = 0; col < 25; col++) {
        if (pattern[row][col]) {
          ctx.fillRect(qrX + col * moduleSize, qrY + row * moduleSize, moduleSize, moduleSize);
        }
      }
    }

    // Draw finder patterns (corner squares)
    drawFinderPattern(ctx, qrX, qrY, moduleSize);
    drawFinderPattern(ctx, qrX + 18 * moduleSize, qrY, moduleSize);
    drawFinderPattern(ctx, qrX, qrY + 18 * moduleSize, moduleSize);
  };

  const generateQRPattern = (size: number): boolean[][] => {
    const pattern: boolean[][] = Array(size)
      .fill(null)
      .map(() => Array(size).fill(false));

    // Add some realistic QR patterns
    for (let i = 0; i < size; i++) {
      for (let j = 0; j < size; j++) {
        // Skip finder pattern areas
        if (isFinderPatternArea(i, j)) continue;

        // Add some pseudo-random data patterns
        if ((i + j) % 3 === 0 || (i * j) % 7 === 0 || (i - j) % 5 === 0) {
          pattern[i][j] = true;
        }
      }
    }

    // Add timing patterns
    for (let i = 8; i < 17; i++) {
      pattern[6][i] = i % 2 === 0;
      pattern[i][6] = i % 2 === 0;
    }

    return pattern;
  };

  const isFinderPatternArea = (row: number, col: number): boolean => {
    return (
      (row < 9 && col < 9) || // Top-left
      (row < 9 && col >= 16) || // Top-right
      (row >= 16 && col < 9) // Bottom-left
    );
  };

  const drawFinderPattern = (
    ctx: CanvasRenderingContext2D,
    x: number,
    y: number,
    moduleSize: number
  ) => {
    // Outer black square (7x7)
    ctx.fillStyle = "#000000";
    ctx.fillRect(x, y, 7 * moduleSize, 7 * moduleSize);

    // Inner white square (5x5)
    ctx.fillStyle = "#FFFFFF";
    ctx.fillRect(x + moduleSize, y + moduleSize, 5 * moduleSize, 5 * moduleSize);

    // Center black square (3x3)
    ctx.fillStyle = "#000000";
    ctx.fillRect(x + 2 * moduleSize, y + 2 * moduleSize, 3 * moduleSize, 3 * moduleSize);
  };

  const drawCenteredQRCode = (
    ctx: CanvasRenderingContext2D,
    template: LabelTemplate,
    mmToPx: (mm: number) => number,
    labelWidth: number,
    labelHeight: number
  ) => {
    // For QR-only labels, use the smaller dimension minus some margin
    const margin = mmToPx(2);
    const availableSize = Math.min(labelWidth, labelHeight) - margin * 2;
    const qrSize = Math.min(availableSize, mmToPx(template.qr_size_mm));

    const qrX = (labelWidth - qrSize) / 2;
    const qrY = (labelHeight - qrSize) / 2;

    // Draw white background for QR code
    ctx.fillStyle = "#FFFFFF";
    ctx.fillRect(qrX, qrY, qrSize, qrSize);

    // Generate realistic QR pattern (same as above)
    const moduleSize = qrSize / 25;
    ctx.fillStyle = "#000000";

    const pattern = generateQRPattern(25);

    for (let row = 0; row < 25; row++) {
      for (let col = 0; col < 25; col++) {
        if (pattern[row][col]) {
          ctx.fillRect(qrX + col * moduleSize, qrY + row * moduleSize, moduleSize, moduleSize);
        }
      }
    }

    // Draw finder patterns (corner squares)
    drawFinderPattern(ctx, qrX, qrY, moduleSize);
    drawFinderPattern(ctx, qrX + 18 * moduleSize, qrY, moduleSize);
    drawFinderPattern(ctx, qrX, qrY + 18 * moduleSize, moduleSize);
  };

  const drawField = (
    ctx: CanvasRenderingContext2D,
    field: LabelTemplateField,
    mmToPx: (mm: number) => number,
    isSelected: boolean
  ) => {
    const x = mmToPx(field.position_x);
    const y = mmToPx(field.position_y);
    const width = mmToPx(field.width_mm);
    const height = mmToPx(field.height_mm);

    // Draw field background if not transparent
    if (field.background_color !== "transparent") {
      ctx.fillStyle = field.background_color;
      ctx.fillRect(x, y, width, height);
    }

    // Draw field border if enabled
    if (field.border_enabled) {
      ctx.strokeStyle = field.border_color;
      ctx.lineWidth = field.border_width;
      ctx.strokeRect(x, y, width, height);
    }

    // Draw selection highlight if selected
    if (isSelected) {
      ctx.strokeStyle = "#3b82f6"; // Primary blue
      ctx.lineWidth = 2;
      ctx.setLineDash([5, 3]);
      ctx.strokeRect(x - 2, y - 2, width + 4, height + 4);
      ctx.setLineDash([]);
    }

    // Draw field content
    ctx.fillStyle = field.text_color;
    ctx.font = `${field.font_weight} ${field.font_size}px sans-serif`;

    if (field.field_type === "text" && field.field_value) {
      // Draw text content
      const textX =
        x +
        (field.text_align === "center" ? width / 2 : field.text_align === "right" ? width - 5 : 5);
      const textY =
        y +
        (field.vertical_align === "center"
          ? height / 2 + field.font_size / 3
          : field.vertical_align === "bottom"
            ? height - 5
            : field.font_size + 2);

      ctx.textAlign = (field.text_align as CanvasTextAlign) || "left";
      ctx.textBaseline =
        field.vertical_align === "top"
          ? "top"
          : field.vertical_align === "bottom"
            ? "bottom"
            : "middle";

      // Handle text wrapping if needed
      const maxWidth = width - 10;
      const words = field.field_value.split(" ");
      let line = "";
      let currentY = textY;

      for (const word of words) {
        const testLine = line + word + " ";
        const metrics = ctx.measureText(testLine);
        const testWidth = metrics.width;

        if (testWidth > maxWidth && line !== "") {
          ctx.fillText(line, textX, currentY);
          line = word + " ";
          currentY += field.font_size + 2;
        } else {
          line = testLine;
        }
      }
      ctx.fillText(line, textX, currentY);
    } else if (field.field_type === "blank") {
      // Draw line for blank field
      const lineY = y + height - 3;
      ctx.strokeStyle = field.text_color;
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(x + 5, lineY);
      ctx.lineTo(x + width - 5, lineY);
      ctx.stroke();
    }

    // Draw field label if enabled
    if (field.show_label && field.label_text) {
      ctx.font = `normal ${Math.max(field.font_size - 2, 8)}px sans-serif`;
      ctx.fillStyle = "#666666";
      ctx.textAlign = "left";
      ctx.textBaseline = "top";
      ctx.fillText(field.label_text, x, y - 12);
    }
  };

  const handleCanvasClick = (event: React.MouseEvent<HTMLCanvasElement>) => {
    if (!template.fields || !onFieldSelect) return;

    const canvas = canvasRef.current;
    if (!canvas) return;

    const rect = canvas.getBoundingClientRect();
    const scale = calculateScale();
    const mmToPx = (mm: number) => (mm * template.dpi) / 25.4;

    const clickX = (event.clientX - rect.left) / scale;
    const clickY = (event.clientY - rect.top) / scale;

    // Check which field was clicked
    for (const field of template.fields) {
      const fieldX = mmToPx(field.position_x);
      const fieldY = mmToPx(field.position_y);
      const fieldWidth = mmToPx(field.width_mm);
      const fieldHeight = mmToPx(field.height_mm);

      if (
        clickX >= fieldX &&
        clickX <= fieldX + fieldWidth &&
        clickY >= fieldY &&
        clickY <= fieldY + fieldHeight
      ) {
        onFieldSelect(field);
        return;
      }
    }
  };

  return (
    <div
      ref={containerRef}
      className="flex min-h-[200px] items-center justify-center rounded-lg border-2 border-dashed border-gray-300 bg-gray-50 p-4"
    >
      <div className="relative">
        <canvas
          ref={canvasRef}
          onClick={handleCanvasClick}
          className="cursor-pointer rounded border border-gray-300 bg-white shadow-sm"
          style={{
            maxWidth: mode === "mobile" ? "300px" : "500px",
            height: "auto",
          }}
        />
        <div className="absolute -bottom-8 left-0 right-0 text-center text-xs text-muted-foreground">
          {template.width_mm}×{template.height_mm}mm
          {selectedField && (
            <span className="ml-2 font-medium text-primary">• {selectedField.field_name}</span>
          )}
        </div>
      </div>
    </div>
  );
}
