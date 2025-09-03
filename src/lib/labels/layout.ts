// Layout helpers for precise mm-based PDF generation

export const MM_PER_INCH = 25.4;

export function mmToIn(mm: number): number {
  return mm / MM_PER_INCH;
}

export function mmToPt(mm: number): number {
  // 1 point = 1/72 inch
  return (mm * 72) / MM_PER_INCH;
}

export function ptToMm(pt: number): number {
  return (pt * MM_PER_INCH) / 72;
}

// Obliczanie rozmiaru komórki dla grida
export function computeCellSize(
  pageWidthMm: number,
  pageHeightMm: number,
  marginMm: number,
  columns: number,
  rows: number,
  gutterXmm: number,
  gutterYmm: number
) {
  const usableWidth = pageWidthMm - 2 * marginMm - (columns - 1) * gutterXmm;
  const usableHeight = pageHeightMm - 2 * marginMm - (rows - 1) * gutterYmm;
  const cellWidthMm = usableWidth / columns;
  const cellHeightMm = usableHeight / rows;
  return { cellWidthMm, cellHeightMm };
}

// Walidacja zgodności rozmiaru template z gridem
export function validateTemplateFitsGrid(
  templateWidthMm: number,
  templateHeightMm: number,
  cellWidthMm: number,
  cellHeightMm: number,
  tolerance = 0.2
): { fits: boolean; errors: string[] } {
  const errors: string[] = [];

  const widthDiff = Math.abs(templateWidthMm - cellWidthMm);
  const heightDiff = Math.abs(templateHeightMm - cellHeightMm);

  if (widthDiff > tolerance) {
    errors.push(
      `Template width (${templateWidthMm}mm) doesn't fit cell width (${cellWidthMm}mm). Difference: ${widthDiff.toFixed(2)}mm`
    );
  }

  if (heightDiff > tolerance) {
    errors.push(
      `Template height (${templateHeightMm}mm) doesn't fit cell height (${cellHeightMm}mm). Difference: ${heightDiff.toFixed(2)}mm`
    );
  }

  return {
    fits: errors.length === 0,
    errors,
  };
}

// Obliczanie pozycji komórki w gridzie
export function getCellPosition(
  cellIndex: number,
  columns: number,
  rows: number,
  marginMm: number,
  cellWidthMm: number,
  cellHeightMm: number,
  gutterXmm: number,
  gutterYmm: number
) {
  const row = Math.floor(cellIndex / columns);
  const col = cellIndex % columns;

  const x = marginMm + col * (cellWidthMm + gutterXmm);
  const y = marginMm + row * (cellHeightMm + gutterYmm);

  return { x, y, row, col };
}

// Obliczanie liczby stron potrzebnych dla danych
export function calculatePagesNeeded(dataCount: number, labelsPerPage: number): number {
  return Math.ceil(dataCount / labelsPerPage);
}

// Generowanie CSS dla @page
export function generatePageCSS(widthMm: number, heightMm: number, marginMm = 0): string {
  return `
    @page {
      size: ${widthMm}mm ${heightMm}mm;
      margin: ${marginMm}mm;
    }
  `;
}

// CSS dla debug grida (siatka co 5mm)
export function generateDebugGridCSS(widthMm: number, heightMm: number): string {
  const gridSize = 5; // co 5mm
  const verticalLines = Math.floor(widthMm / gridSize);
  const horizontalLines = Math.floor(heightMm / gridSize);

  let css = `
    .debug-grid {
      position: absolute;
      top: 0;
      left: 0;
      width: ${widthMm}mm;
      height: ${heightMm}mm;
      pointer-events: none;
      z-index: 1000;
    }
    
    .debug-grid::before {
      content: '';
      position: absolute;
      top: 0;
      left: 0;
      width: 100%;
      height: 100%;
      background-image: 
  `;

  // Pionowe linie
  const verticalGradient = Array.from({ length: verticalLines }, (_, i) => {
    const pos = (((i + 1) * gridSize) / widthMm) * 100;
    return `linear-gradient(90deg, transparent ${pos - 0.1}%, rgba(255,0,0,0.3) ${pos}%, rgba(255,0,0,0.3) ${pos + 0.1}%, transparent ${pos + 0.2}%)`;
  });

  // Poziome linie
  const horizontalGradient = Array.from({ length: horizontalLines }, (_, i) => {
    const pos = (((i + 1) * gridSize) / heightMm) * 100;
    return `linear-gradient(0deg, transparent ${pos - 0.1}%, rgba(255,0,0,0.3) ${pos}%, rgba(255,0,0,0.3) ${pos + 0.1}%, transparent ${pos + 0.2}%)`;
  });

  css += [...verticalGradient, ...horizontalGradient].join(",\n        ");
  css += ";\n    }\n  ";

  return css;
}

// Konwersja pozycji z kreatora (pixele 300dpi) na mm
export function convertCreatorPositionToMm(positionPx: number, dpi: number = 300): number {
  // position w kreatorze może być w pikselach przy określonym DPI
  return (positionPx * MM_PER_INCH) / dpi;
}

// Konwersja rozmiaru z kreatora na mm
export function convertCreatorSizeToMm(sizePx: number, dpi: number = 300): number {
  return (sizePx * MM_PER_INCH) / dpi;
}

// Safe area - obszar bezpieczny wewnątrz etykiety
export function applySafeArea(
  containerWidthMm: number,
  containerHeightMm: number,
  safeAreaMm: number
) {
  return {
    contentWidthMm: containerWidthMm - 2 * safeAreaMm,
    contentHeightMm: containerHeightMm - 2 * safeAreaMm,
    contentX: safeAreaMm,
    contentY: safeAreaMm,
  };
}

// Pozycjonowanie QR kodu na podstawie istniejących opcji
export function calculateQRPosition(
  qrPosition: string | null | undefined,
  containerWidthMm: number,
  containerHeightMm: number,
  qrSizeMm: number,
  paddingMm: number = 2
): { x: number; y: number } {
  const position = qrPosition || "left";

  switch (position) {
    case "top-left":
      return { x: paddingMm, y: paddingMm };
    case "top-right":
      return { x: containerWidthMm - qrSizeMm - paddingMm, y: paddingMm };
    case "bottom-left":
      return { x: paddingMm, y: containerHeightMm - qrSizeMm - paddingMm };
    case "bottom-right":
      return {
        x: containerWidthMm - qrSizeMm - paddingMm,
        y: containerHeightMm - qrSizeMm - paddingMm,
      };
    case "left":
      return { x: paddingMm, y: (containerHeightMm - qrSizeMm) / 2 };
    case "right":
      return { x: containerWidthMm - qrSizeMm - paddingMm, y: (containerHeightMm - qrSizeMm) / 2 };
    case "center":
    default:
      return { x: (containerWidthMm - qrSizeMm) / 2, y: (containerHeightMm - qrSizeMm) / 2 };
  }
}

// Kalkulacja przestrzeni dla pól tekstowych
export function calculateFieldsArea(
  templateWidthMm: number,
  templateHeightMm: number,
  qrPosition: string | null | undefined,
  qrSizeMm: number,
  layoutDirection: string | null | undefined,
  paddingMm: number = 2
) {
  const direction = layoutDirection || "row";
  const qrPos = qrPosition || "left";

  let fieldsX = paddingMm;
  let fieldsY = paddingMm;
  let fieldsWidth = templateWidthMm - 2 * paddingMm;
  let fieldsHeight = templateHeightMm - 2 * paddingMm;

  // Dostosuj obszar pól w zależności od pozycji QR
  switch (direction) {
    case "row": // QR po lewej, pola po prawej
      if (qrPos.includes("left")) {
        fieldsX = qrSizeMm + 2 * paddingMm;
        fieldsWidth = templateWidthMm - qrSizeMm - 3 * paddingMm;
      } else if (qrPos.includes("right")) {
        fieldsWidth = templateWidthMm - qrSizeMm - 3 * paddingMm;
      }
      break;

    case "row-reverse": // QR po prawej, pola po lewej
      if (qrPos.includes("right")) {
        fieldsWidth = templateWidthMm - qrSizeMm - 3 * paddingMm;
      } else if (qrPos.includes("left")) {
        fieldsX = paddingMm;
        fieldsWidth = templateWidthMm - qrSizeMm - 3 * paddingMm;
      }
      break;

    case "column": // QR u góry, pola na dole
      if (qrPos.includes("top")) {
        fieldsY = qrSizeMm + 2 * paddingMm;
        fieldsHeight = templateHeightMm - qrSizeMm - 3 * paddingMm;
      } else if (qrPos.includes("bottom")) {
        fieldsHeight = templateHeightMm - qrSizeMm - 3 * paddingMm;
      }
      break;

    case "column-reverse": // QR na dole, pola u góry
      if (qrPos.includes("bottom")) {
        fieldsHeight = templateHeightMm - qrSizeMm - 3 * paddingMm;
      } else if (qrPos.includes("top")) {
        fieldsY = paddingMm;
        fieldsHeight = templateHeightMm - qrSizeMm - 3 * paddingMm;
      }
      break;
  }

  return {
    x: fieldsX,
    y: fieldsY,
    width: Math.max(fieldsWidth, 10), // min 10mm
    height: Math.max(fieldsHeight, 10), // min 10mm
  };
}

// Calculate optimal label dimensions based on content
export interface LabelField {
  field_value: string;
  font_size: number;
  field_name: string;
  text_align?: string;
  width_mm?: number;
  height_mm?: number;
}

export function calculateDynamicLabelSize(
  fields: LabelField[],
  qrSizeMm: number = 15,
  layoutDirection: string = "row",
  paddingMm: number = 2,
  minWidthMm: number = 50, // Increased minimum width for better readability
  minHeightMm: number = 30, // Increased minimum height for better readability
  maxWidthMm: number = 90, // Reduced max to fit better on A4
  maxHeightMm: number = 60 // Reduced max to fit better on A4
): { width: number; height: number; fieldsNeedReflow: boolean } {
  if (!fields || fields.length === 0) {
    // No fields - just QR + padding
    return {
      width: Math.max(qrSizeMm + 2 * paddingMm, minWidthMm),
      height: Math.max(qrSizeMm + 2 * paddingMm, minHeightMm),
      fieldsNeedReflow: false,
    };
  }

  // Estimate text dimensions (improved calculation for better readability)
  const estimateTextWidth = (text: string, fontSize: number): number => {
    // Improved estimation: 0.65 * fontSize per character for better spacing
    const charWidth = fontSize * 0.65 * 0.352778; // Convert pt to mm
    const textWidth = text.length * charWidth;
    // Add some padding for readability and ensure minimum reasonable width
    return Math.max(textWidth + 4, 20); // Minimum 20mm width for text
  };

  const estimateTextHeight = (text: string, fontSize: number, maxWidth: number): number => {
    const charWidth = fontSize * 0.65 * 0.352778;
    const charsPerLine = Math.floor((maxWidth - 4) / charWidth); // Account for padding
    const lines = Math.max(1, Math.ceil(text.length / charsPerLine));
    const lineHeight = fontSize * 1.4 * 0.352778; // More generous line height in mm
    return lines * lineHeight + 2; // Add padding
  };

  // Calculate content dimensions
  let maxFieldWidth = 0;
  let totalFieldHeight = 0;
  let fieldsNeedReflow = false;

  fields.forEach((field, index) => {
    const text = field.field_value || field.field_name || "Sample text";
    const fontSize = field.font_size || 10;

    // If field has explicit dimensions, use them
    if (field.width_mm && field.height_mm) {
      maxFieldWidth = Math.max(maxFieldWidth, field.width_mm);
      totalFieldHeight += field.height_mm;
      return;
    }

    // Otherwise calculate based on text
    const textWidth = estimateTextWidth(text, fontSize);
    const availableWidth = Math.min(textWidth, maxWidthMm * 0.7); // Leave room for QR
    const textHeight = estimateTextHeight(text, fontSize, availableWidth);

    maxFieldWidth = Math.max(maxFieldWidth, textWidth);
    totalFieldHeight += textHeight;

    // Add spacing between fields
    if (index > 0) {
      totalFieldHeight += 2; // 2mm spacing
    }

    // Check if text is too long for reasonable width
    if (textWidth > maxWidthMm * 0.7) {
      fieldsNeedReflow = true;
    }
  });

  // Calculate label dimensions based on layout
  let labelWidth: number;
  let labelHeight: number;

  const direction = layoutDirection || "row";

  if (direction === "row" || direction === "row-reverse") {
    // Horizontal layout: QR + fields side by side
    labelWidth = qrSizeMm + maxFieldWidth + 3 * paddingMm;
    labelHeight = Math.max(qrSizeMm, totalFieldHeight) + 2 * paddingMm;
  } else {
    // Vertical layout: QR and fields stacked
    labelWidth = Math.max(qrSizeMm, maxFieldWidth) + 2 * paddingMm;
    labelHeight = qrSizeMm + totalFieldHeight + 3 * paddingMm;
  }

  // Apply constraints
  labelWidth = Math.max(minWidthMm, Math.min(maxWidthMm, labelWidth));
  labelHeight = Math.max(minHeightMm, Math.min(maxHeightMm, labelHeight));

  return {
    width: Math.round(labelWidth),
    height: Math.round(labelHeight),
    fieldsNeedReflow,
  };
}

// Calculate optimal grid layout for A4 paper
export function calculateOptimalA4Grid(
  labelWidthMm: number,
  labelHeightMm: number,
  marginMm: number = 8, // Increased margin for better printing
  gutterMm: number = 3 // Increased gutter for better separation
): { columns: number; rows: number; fits: boolean; wastedSpace: number } {
  const A4_WIDTH_MM = 210;
  const A4_HEIGHT_MM = 297;

  const usableWidth = A4_WIDTH_MM - 2 * marginMm;
  const usableHeight = A4_HEIGHT_MM - 2 * marginMm;

  // Try different grid configurations (limited to practical ranges)
  let bestConfig = { columns: 1, rows: 1, fits: false, wastedSpace: 100 };

  for (let cols = 1; cols <= 4; cols++) {
    // Limit to max 4 columns for readability
    for (let rows = 1; rows <= 8; rows++) {
      // Limit to max 8 rows
      const totalWidthNeeded = cols * labelWidthMm + (cols - 1) * gutterMm;
      const totalHeightNeeded = rows * labelHeightMm + (rows - 1) * gutterMm;

      if (totalWidthNeeded <= usableWidth && totalHeightNeeded <= usableHeight) {
        const usedArea = cols * rows * labelWidthMm * labelHeightMm;
        const totalArea = usableWidth * usableHeight;
        const wastedSpace = ((totalArea - usedArea) / totalArea) * 100;

        // Prefer fewer labels per page for better readability
        // Weight efficiency by label size (bigger labels are preferred)
        const labelArea = labelWidthMm * labelHeightMm;
        const efficiency = labelArea * 0.5 + cols * rows * 0.3 - wastedSpace * 0.01;
        const currentEfficiency =
          bestConfig.columns * bestConfig.rows * labelWidthMm * labelHeightMm * 0.5 +
          bestConfig.columns * bestConfig.rows * 0.3 -
          bestConfig.wastedSpace * 0.01;

        if (!bestConfig.fits || efficiency > currentEfficiency) {
          bestConfig = {
            columns: cols,
            rows: rows,
            fits: true,
            wastedSpace: Math.round(wastedSpace),
          };
        }
      }
    }
  }

  return bestConfig;
}
