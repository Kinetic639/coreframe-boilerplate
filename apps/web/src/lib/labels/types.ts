// Extended types for PDF label generation - compatible with existing LabelTemplate system
import { LabelTemplate, LabelTemplateField } from "@/lib/types/qr-system";

export type Mm = number; // milimetry

// Rozszerzenie istniejących typów o opcje PDF
export interface PDFLabelTemplate extends LabelTemplate {
  // Nowe opcje PDF - zachowujemy wszystkie istniejące
  bleedMm?: Mm; // domyślnie 0–2 mm
  safeAreaMm?: Mm; // np. 2 mm

  // Label padding properties (commonly used but missing from base interface)
  label_padding_top?: number;
  label_padding_right?: number;
  label_padding_bottom?: number;
  label_padding_left?: number;
  field_vertical_gap?: Mm; // odstęp między polami w mm

  // Dodatkowe opcje layoutu dla PDF
  items_alignment?: "start" | "center" | "end"; // wyrównanie elementów

  // Opcje czcionek dla PDF
  font_family?: string; // np. "Inter"
  embed_fonts?: boolean; // domyślnie true

  // Debug mode
  debug_grid?: boolean; // siatka co 5mm
}

export interface PDFLabelField extends LabelTemplateField {
  // Wszystkie istniejące opcje + dodatkowe dla PDF

  // Paddingsy pola (dodatkowe do istniejących)
  field_padding_top?: number | null;
  field_padding_right?: number | null;
  field_padding_bottom?: number | null;
  field_padding_left?: number | null;

  // Dodatkowe opcje formatowania tekstu
  line_height?: number | null;
  letter_spacing?: number | null;
  text_transform?: "none" | "uppercase" | "lowercase" | "capitalize" | null;
  text_decoration?: "none" | "underline" | "line-through" | null;

  // Opcje dla kodów kreskowych/QR (gdy field_type będzie rozszerzony)
  barcode_symbology?: "code128" | "ean13" | "ean8" | "code39" | null;
  qr_error_correction?: "L" | "M" | "Q" | "H" | null;
}

// Rozszerzenie field_type o nowe typy
export type ExtendedFieldType = LabelTemplateField["field_type"] | "barcode" | "qrcode" | "image";

export interface LabelDataRecord {
  [key: string]: string; // wartości dla pól: np. name, sku, barcode, qrData, imageUrl
}

export interface PagePresetSheet {
  // wiele etykiet na stronie (np. A4 + siatka Avery)
  kind: "sheet";
  page: { widthMm: Mm; heightMm: Mm; marginMm: Mm };
  grid: {
    columns: number;
    rows: number;
    gutterXmm: Mm;
    gutterYmm: Mm;
  };
}

export interface PagePresetRoll {
  // 1 etykieta = 1 strona (rolka)
  kind: "roll";
}

export type PagePreset = PagePresetSheet | PagePresetRoll;

export interface GeneratePdfPayload {
  template: PDFLabelTemplate;
  data: LabelDataRecord[]; // każdy element = 1 etykieta
  pagePreset: PagePreset; // arkusz lub rolka
  fontFamily?: string; // np. "Inter"
  embedFonts?: boolean; // domyślnie true
  debug?: boolean; // tryb debug z siatką
}

// Presety stron - popularne rozmiary etykiet
export const PAGE_PRESETS = {
  // Arkusze A4
  A4_AVERY_L7163: {
    kind: "sheet" as const,
    name: "A4 Avery L7163 (2x7, 99.1×38.1mm)",
    page: { widthMm: 210, heightMm: 297, marginMm: 4.75 },
    grid: { columns: 2, rows: 7, gutterXmm: 2.5, gutterYmm: 0 },
  },
  A4_AVERY_L7160: {
    kind: "sheet" as const,
    name: "A4 Avery L7160 (3x7, 63.5×38.1mm)",
    page: { widthMm: 210, heightMm: 297, marginMm: 5 },
    grid: { columns: 3, rows: 7, gutterXmm: 2.5, gutterYmm: 0 },
  },
  A4_CUSTOM_2x5: {
    kind: "sheet" as const,
    name: "A4 Custom 2×5",
    page: { widthMm: 210, heightMm: 297, marginMm: 5 },
    grid: { columns: 2, rows: 5, gutterXmm: 5, gutterYmm: 5 },
  },

  // Rolki
  ROLL_100x50: {
    kind: "roll" as const,
    name: "Rolka 100×50mm",
  },
  ROLL_100x75: {
    kind: "roll" as const,
    name: "Rolka 100×75mm",
  },
  ROLL_80x40: {
    kind: "roll" as const,
    name: "Rolka 80×40mm",
  },
} as const;

// Konwersja z istniejącego template na PDF template
export function convertToPDFTemplate(template: LabelTemplate): PDFLabelTemplate {
  console.log("🔄 convertToPDFTemplate input:", template);
  console.log("🔄 convertToPDFTemplate input fields:", template.fields?.length || 0);

  const result = {
    ...template,
    // Domyślne wartości PDF
    bleedMm: 0,
    safeAreaMm: 2,
    font_family: "Inter",
    embed_fonts: true,
    debug_grid: false,
    items_alignment: "center" as "start" | "center" | "end",
    field_vertical_gap: (template as any).field_vertical_gap || 2,
  };

  console.log("🔄 convertToPDFTemplate result fields:", result.fields?.length || 0);
  return result;
}

// Konwersja pól
export function convertToPDFFields(fields?: LabelTemplateField[]): PDFLabelField[] {
  console.log("🔄 convertToPDFFields input:", fields?.length || 0, "fields");
  if (fields) {
    fields.forEach((field, index) => {
      console.log(
        `🔄 Field ${index + 1}: ${field.field_name} (${field.field_type}) - "${field.field_value}"`
      );
    });
  }
  if (!fields) return [];

  return fields.map((field) => ({
    ...field,
    // Domyślne wartości dla PDF
    line_height: 1.2,
    letter_spacing: 0,
    text_transform: "none",
    text_decoration: "none",
    qr_error_correction: "M",
    barcode_symbology: "code128",
  }));
}

// Typy odpowiedzi API
export interface GeneratePdfResponse {
  success: boolean;
  pdfUrl?: string;
  error?: string;
  templateUsed?: PDFLabelTemplate;
  labelsGenerated?: number;
}

// Rozszerzenia dla istniejących interfejsów
export interface LabelBatchExtended {
  id: string;
  batch_name: string;
  template_id: string;
  pdf_template?: PDFLabelTemplate; // Zapisany template użyty do generowania
  page_preset?: PagePreset; // Zapisany preset strony
  labels_data?: LabelDataRecord[]; // Zapisane dane etykiet
  generated_pdf_path?: string;
  created_at: string;
  updated_at: string;
}
