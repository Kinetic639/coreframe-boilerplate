import * as QRCode from "qrcode";

import {
  GeneratePdfPayload,
  PDFLabelTemplate,
  PDFLabelField,
  LabelDataRecord,
  PagePreset,
} from "./types";
import {
  generatePageCSS,
  generateDebugGridCSS,
  computeCellSize,
  getCellPosition,
  calculatePagesNeeded,
  calculateQRPosition,
} from "./layout";

// HTML template z pełną kompatybilnością z istniejącym kreatorem
export async function renderLabelsHtml(payload: GeneratePdfPayload): Promise<string> {
  const {
    template: originalTemplate,
    data,
    pagePreset,
    fontFamily = "Inter",
    embedFonts = true,
    debug = false,
  } = payload;

  // Calculate dynamic dimensions based on content
  const template = { ...originalTemplate };
  let actualPagePreset = pagePreset;

  // SKIP dynamic sizing - use EXACT dimensions from creator
  console.log(
    `Using EXACT template dimensions from creator: ${template.width_mm}x${template.height_mm}mm`
  );

  // Force larger labels for A4 - make them actually readable and usable!
  if (
    pagePreset.kind === "sheet" &&
    pagePreset.page.widthMm === 210 &&
    pagePreset.page.heightMm === 297
  ) {
    // Force minimum label size for readability
    const minLabelWidth = 70; // At least 70mm wide
    const minLabelHeight = 40; // At least 40mm tall

    if (template.width_mm < minLabelWidth) {
      template.width_mm = minLabelWidth;
      console.log(`Forced label width to ${minLabelWidth}mm for readability`);
    }
    if (template.height_mm < minLabelHeight) {
      template.height_mm = minLabelHeight;
      console.log(`Forced label height to ${minLabelHeight}mm for readability`);
    }

    // Use fewer labels per page so they're actually readable - 2x3 max
    console.log("Using readable A4 grid: 2x3 labels per page");
    actualPagePreset = {
      kind: "sheet",
      page: { widthMm: 210, heightMm: 297, marginMm: 15 },
      grid: {
        columns: 2,
        rows: 3,
        gutterXmm: 10,
        gutterYmm: 15,
      },
    };
  }

  // SKIP validation completely - just use what the user created
  console.log(
    `Skipping validation - using exact creator template: ${template.width_mm}x${template.height_mm}mm with ${template.fields?.length || 0} fields`
  );

  const labelsPerPage =
    actualPagePreset.kind === "roll"
      ? 1
      : actualPagePreset.grid.columns * actualPagePreset.grid.rows;
  const pagesNeeded = calculatePagesNeeded(data.length, labelsPerPage);

  // Pre-generuj wszystkie QR kody i kody kreskowe
  const generatedAssets = await generateAllAssets(template, data);

  let html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Labels - ${template.name}</title>
  ${generateStyleSheet(template, actualPagePreset, fontFamily, embedFonts, debug)}
</head>
<body>`;

  // Generuj strony
  for (let pageIndex = 0; pageIndex < pagesNeeded; pageIndex++) {
    if (pageIndex > 0) {
      html += '<div class="page-break"></div>';
    }

    html += await renderPage(
      template,
      data,
      actualPagePreset,
      pageIndex,
      labelsPerPage,
      generatedAssets,
      debug
    );
  }

  html += `
</body>
</html>`;

  return html;
}

// Generowanie CSS z pełną kompatybilnością
function generateStyleSheet(
  template: PDFLabelTemplate,
  pagePreset: PagePreset,
  fontFamily: string,
  embedFonts: boolean,
  debug: boolean
): string {
  const pageWidthMm = pagePreset.kind === "roll" ? template.width_mm : pagePreset.page.widthMm;
  const pageHeightMm = pagePreset.kind === "roll" ? template.height_mm : pagePreset.page.heightMm;

  const css = `
    <style>
      ${generatePageCSS(pageWidthMm, pageHeightMm, 0)}
      
      * {
        margin: 0;
        padding: 0;
        box-sizing: border-box;
      }
      
      body {
        font-family: ${fontFamily}, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
        background: white;
        color: ${template.text_color || "#000000"};
        line-height: 1;
      }
      
      .page {
        width: ${pageWidthMm}mm;
        height: ${pageHeightMm}mm;
        position: relative;
        page-break-after: always;
      }
      
      .page:last-child {
        page-break-after: avoid;
      }
      
      .page-break {
        page-break-before: always;
        height: 0;
      }
      
      .label-container {
        position: absolute;
        width: ${template.width_mm}mm;
        height: ${template.height_mm}mm;
        background: ${template.background_color || "#FFFFFF"};
        overflow: hidden;
      }
      
      ${
        template.border_enabled
          ? `
        .label-container {
          border: ${template.border_width || 0.5}mm solid ${template.border_color || "#000000"};
        }
      `
          : ""
      }
      
      .label-content {
        position: absolute;
        top: 0;
        right: 0;
        bottom: 0;
        left: 0;
        width: 100%;
        height: 100%;
      }
      
      .qr-code {
        position: absolute;
        display: block;
      }
      
      .label-field {
        position: absolute;
        display: flex;
        overflow: hidden;
      }
      
      .field-text {
        width: 100%;
        height: 100%;
        display: flex;
        align-items: center;
        line-height: 1.3;
      }
      
      .field-blank-line {
        border-bottom: 0.5mm solid ${template.text_color || "#000000"};
        width: calc(100% - 2mm);
        margin: 0 1mm;
        align-self: flex-end;
        margin-bottom: 1mm;
      }
      
      ${debug ? generateDebugGridCSS(template.width_mm, template.height_mm) : ""}
      
      @media print {
        body { -webkit-print-color-adjust: exact !important; color-adjust: exact !important; }
        .page { page-break-inside: avoid; }
      }
      
      /* Font embedding - placeholder for actual fonts */
      ${
        embedFonts
          ? `
        @font-face {
          font-family: 'Inter';
          src: url('/fonts/Inter-Regular.woff2') format('woff2');
          font-weight: 400;
          font-style: normal;
          font-display: swap;
        }
        @font-face {
          font-family: 'Inter';
          src: url('/fonts/Inter-Bold.woff2') format('woff2');
          font-weight: 700;
          font-style: normal;
          font-display: swap;
        }
      `
          : ""
      }
    </style>
  `;

  return css;
}

// Renderowanie pojedynczej strony
async function renderPage(
  template: PDFLabelTemplate,
  data: LabelDataRecord[],
  pagePreset: PagePreset,
  pageIndex: number,
  labelsPerPage: number,
  generatedAssets: Map<string, string>,
  debug: boolean
): Promise<string> {
  const startIndex = pageIndex * labelsPerPage;
  const endIndex = Math.min(startIndex + labelsPerPage, data.length);
  const pageData = data.slice(startIndex, endIndex);

  if (pagePreset.kind === "roll") {
    // Rolka - 1 etykieta na stronę
    return `
      <div class="page">
        ${debug ? '<div class="debug-grid"></div>' : ""}
        ${await renderLabel(template, pageData[0] || {}, 0, 0, generatedAssets)}
      </div>
    `;
  } else {
    // Arkusz - grid etykiet
    const { cellWidthMm, cellHeightMm } = computeCellSize(
      pagePreset.page.widthMm,
      pagePreset.page.heightMm,
      pagePreset.page.marginMm,
      pagePreset.grid.columns,
      pagePreset.grid.rows,
      pagePreset.grid.gutterXmm,
      pagePreset.grid.gutterYmm
    );

    let html = `<div class="page">`;

    if (debug) {
      html += '<div class="debug-grid"></div>';
    }

    for (let i = 0; i < pageData.length; i++) {
      const { x, y } = getCellPosition(
        i,
        pagePreset.grid.columns,
        pagePreset.grid.rows,
        pagePreset.page.marginMm,
        cellWidthMm,
        cellHeightMm,
        pagePreset.grid.gutterXmm,
        pagePreset.grid.gutterYmm
      );

      html += await renderLabel(template, pageData[i], x, y, generatedAssets);
    }

    html += "</div>";
    return html;
  }
}

// Renderowanie pojedynczej etykiety z pełną kompatybilnością z kreatorem
async function renderLabel(
  template: PDFLabelTemplate,
  labelData: LabelDataRecord,
  offsetX: number,
  offsetY: number,
  generatedAssets: Map<string, string>
): Promise<string> {
  const labelStyle = `
    left: ${offsetX}mm;
    top: ${offsetY}mm;
  `;

  let html = `<div class="label-container" style="${labelStyle}">`;
  html += '<div class="label-content">';

  // QR kod (jeśli pokazywany) - use exact position from template or calculate
  if (template.show_additional_info || !template.show_additional_info) {
    const qrData = labelData.qr || labelData.qrData || `QR-${Date.now()}`;
    const qrKey = `qr:${qrData}`;
    const qrDataUrl = generatedAssets.get(qrKey);

    if (qrDataUrl) {
      // Check if QR has explicit position stored in template config
      const qrConfig = (template.template_config as any)?.qr || {};
      let qrX, qrY;

      if (qrConfig.position_x !== undefined && qrConfig.position_y !== undefined) {
        // Use exact position from template config
        qrX = qrConfig.position_x;
        qrY = qrConfig.position_y;
        console.log(`Using stored QR position: ${qrX}mm, ${qrY}mm`);
      } else {
        // Fall back to calculated position
        const qrSize = Math.max(template.qr_size_mm || 15, 20); // Minimum 20mm QR size
        const qrPosition = calculateQRPosition(
          template.qr_position,
          template.width_mm,
          template.height_mm,
          qrSize,
          2
        );
        qrX = qrPosition.x;
        qrY = qrPosition.y;
        console.log(`Using calculated QR position: ${qrX}mm, ${qrY}mm`);
      }

      html += `
        <img 
          class="qr-code" 
          src="${qrDataUrl}" 
          style="
            left: ${qrX}mm;
            top: ${qrY}mm;
            width: ${Math.max(template.qr_size_mm || 15, 20)}mm;
            height: ${Math.max(template.qr_size_mm || 15, 20)}mm;
          "
          alt="QR Code"
        />
      `;
    }
  }

  // Pola tekstowe i inne (jeśli dodatkowowe info jest pokazywane)
  console.log(
    `Label rendering - show_additional_info: ${template.show_additional_info}, fields count: ${template.fields?.length || 0}`
  );
  if (template.show_additional_info && template.fields) {
    const sortedFields = template.fields.sort((a, b) => (a.sort_order || 0) - (b.sort_order || 0));
    console.log(`Rendering ${sortedFields.length} fields for label`);

    for (const field of sortedFields) {
      console.log(
        `Rendering field: ${field.field_name} at (${field.position_x}mm, ${field.position_y}mm) size ${field.width_mm}x${field.height_mm}mm, font: ${field.font_size}pt`
      );
      html += await renderField(field, labelData, template, generatedAssets);
    }
  } else {
    console.log(
      `Not rendering fields - show_additional_info: ${template.show_additional_info}, has fields: ${!!template.fields}, fields length: ${template.fields?.length}`
    );
  }

  html += "</div>";
  html += "</div>";

  return html;
}

// Renderowanie pojedynczego pola z pełną kompatybilnością
async function renderField(
  field: PDFLabelField,
  labelData: LabelDataRecord,
  template: PDFLabelTemplate,
  generatedAssets: Map<string, string>
): Promise<string> {
  const fieldStyle = `
    left: ${field.position_x}mm;
    top: ${field.position_y}mm;
    width: ${field.width_mm}mm;
    height: ${field.height_mm}mm;
    ${field.background_color && field.background_color !== "transparent" ? `background: ${field.background_color};` : ""}
    ${field.border_enabled ? `border: ${field.border_width || 0.5}mm solid ${field.border_color || "#000000"};` : ""}
  `;

  let html = `<div class="label-field" style="${fieldStyle}">`;

  if (field.field_type === "text" && field.field_value) {
    // Zamień zmienne w tekście
    let displayText = field.field_value;
    Object.keys(labelData).forEach((key) => {
      displayText = displayText.replace(`{${key}}`, String(labelData[key] || ""));
    });

    // Force larger font sizes for readability
    const minFontSize = 12; // Minimum readable font size
    const fontSize = Math.max(field.font_size || 10, minFontSize);

    const textStyle = `
      font-size: ${fontSize}pt;
      font-weight: ${field.font_weight || "normal"};
      color: ${field.text_color || template.text_color || "#000000"};
      text-align: ${field.text_align || "left"};
      ${field.text_transform && field.text_transform !== "none" ? `text-transform: ${field.text_transform};` : ""}
      ${field.text_decoration && field.text_decoration !== "none" ? `text-decoration: ${field.text_decoration};` : ""}
      ${field.letter_spacing ? `letter-spacing: ${field.letter_spacing}pt;` : ""}
      line-height: 1.3;
    `;

    // Wyrównanie pionowe
    let alignItems = "center";
    if (field.vertical_align === "top") alignItems = "flex-start";
    else if (field.vertical_align === "bottom") alignItems = "flex-end";

    html += `
      <div class="field-text" style="align-items: ${alignItems};">
        <span style="${textStyle}">${displayText}</span>
      </div>
    `;
  } else if (field.field_type === "blank") {
    // Linia dla pustych pól
    html += '<div class="field-blank-line"></div>';
  } else if (field.field_type === "qr_code") {
    // Dodatkowy QR kod w polu
    const qrData = labelData[field.field_name] || labelData.qr || `QR-${field.field_name}`;
    const qrKey = `qr:${qrData}`;
    const qrDataUrl = generatedAssets.get(qrKey);

    if (qrDataUrl) {
      html += `
        <img 
          src="${qrDataUrl}" 
          style="width: 100%; height: 100%; object-fit: contain;"
          alt="QR Code"
        />
      `;
    }
  }

  html += "</div>";
  return html;
}

// Pre-generowanie wszystkich QR kodów
async function generateAllAssets(
  template: PDFLabelTemplate,
  data: LabelDataRecord[]
): Promise<Map<string, string>> {
  const assets = new Map<string, string>();
  const uniqueQRs = new Set<string>();

  // Zbierz wszystkie unikalne QR kody
  data.forEach((record) => {
    // Główny QR kod etykiety
    const mainQR = record.qr || record.qrData || `QR-${Date.now()}-${Math.random()}`;
    uniqueQRs.add(mainQR);

    // QR kody z pól
    template.fields?.forEach((field) => {
      if (field.field_type === "qr_code") {
        const fieldQR = record[field.field_name] || record.qr || `QR-${field.field_name}`;
        uniqueQRs.add(fieldQR);
      }
    });
  });

  // Generuj QR kody
  for (const qrData of uniqueQRs) {
    try {
      const dataUrl = await QRCode.toDataURL(qrData, {
        width: 200,
        margin: 0,
        color: {
          dark: "#000000",
          light: "#FFFFFF",
        },
        errorCorrectionLevel: "M",
      });
      assets.set(`qr:${qrData}`, dataUrl);
    } catch (error) {
      console.error(`Error generating QR code for: ${qrData}`, error);
    }
  }

  return assets;
}
