import type { InventoryCustomFieldDefinition } from "@/lib/warehouse/inventory-types";
import {
  csvCell,
  csvLines,
  formatTokenString,
  mergeById,
  normalizeCaseValue,
  normalizeSkuValue,
  parseCsvLine,
  parseTokenString,
  sameIdsInOrder,
  slugKey,
  type CaseNormalization,
  type SkuSpecialCharacterNormalization,
  type SkuWhitespaceNormalization,
} from "@/lib/warehouse/import-utils";

export {
  csvCell,
  csvLines,
  formatTokenString,
  mergeById,
  normalizeCaseValue,
  normalizeSkuValue,
  parseCsvLine,
  parseTokenString,
  sameIdsInOrder,
  slugKey,
};

export type ProductImportPreview = {
  rows: Array<{
    row_number: number;
    product_name: string;
    product_sku: string | null;
    variant_name: string;
    variant_sku: string;
    unit_code: string;
    errors: string[];
  }>;
  total_rows: number;
  valid_rows: number;
  invalid_rows: number;
};

export const importFields = [
  { key: "product_name", required: true },
  { key: "product_sku", required: false },
  { key: "variant_name", required: false },
  { key: "variant_sku", required: true },
  { key: "unit_code", required: true },
  { key: "product_type", required: false },
  { key: "status", required: false },
  { key: "barcode", required: false },
  { key: "purchase_price", required: false },
  { key: "sales_price", required: false },
  { key: "sales_account_code", required: false },
  { key: "purchase_account_code", required: false },
  { key: "tax_code", required: false },
  { key: "tax_rate_percent", required: false },
  { key: "reorder_point", required: false },
  { key: "tags", required: false },
  { key: "description", required: false },
] as const;

export type ImportFieldKey = (typeof importFields)[number]["key"];
export type ImportMode = "create_only" | "skip_existing";
export type ImportStructure = "simple" | "variants";
export type ImportStep = 1 | 2 | 3;
export type UnitAssignmentMode = "column" | "fallback";
export type { CaseNormalization, SkuSpecialCharacterNormalization, SkuWhitespaceNormalization };

export type ImportCustomFieldMapping = {
  id: string;
  field_id: string;
  source: string;
};

export type ImportDraftRow = Record<ImportFieldKey, string> & {
  id: string;
  source_row: number;
  customFields: Record<string, string>;
};

function normalizedHeader(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, "");
}

const importAliases: Record<ImportFieldKey, string[]> = {
  product_name: ["productname", "itemname", "name", "nazwa", "nazwatowaru", "towar"],
  product_sku: ["productsku", "itemsku", "parentsku"],
  variant_name: ["variantname", "wariant", "variant", "nazwawariantu"],
  variant_sku: ["variantsku", "sku", "nrkatalogowy", "katalogowy", "kod", "index", "indeks"],
  unit_code: ["unit", "unitcode", "jm", "jednostka"],
  product_type: ["type", "producttype", "typ"],
  status: ["status"],
  barcode: ["barcode", "kodkreskowy", "ean13"],
  purchase_price: ["purchaseprice", "costprice", "cost", "cenazakupu"],
  sales_price: ["salesprice", "sellingprice", "price", "cenasprzedazy"],
  sales_account_code: ["salesaccount", "salesaccountcode", "kontosprzedazy"],
  purchase_account_code: ["purchaseaccount", "purchaseaccountcode", "kontozakupu"],
  tax_code: ["tax", "taxcode", "vat", "vatcode", "stawkavat"],
  tax_rate_percent: ["taxrate", "taxratepercent", "vatrate", "stawkavatpercent"],
  reorder_point: ["reorderpoint", "minimumstock", "min", "stanminimalny"],
  tags: ["tags", "tagi"],
  description: ["description", "opis"],
};

export function autoMapHeaders(headers: string[]) {
  const normalized = headers.map((header) => ({
    header,
    key: normalizedHeader(header),
  }));
  return Object.fromEntries(
    importFields.map((field) => {
      const match = normalized.find((header) => importAliases[field.key].includes(header.key));
      return [field.key, match?.header ?? ""];
    })
  ) as Record<ImportFieldKey, string>;
}

export function importFieldsForStructure(structure: ImportStructure) {
  return importFields.filter(
    (field) =>
      structure === "variants" || (field.key !== "variant_name" && field.key !== "variant_sku")
  );
}

export function isImportFieldRequired(key: ImportFieldKey, structure: ImportStructure) {
  if (key === "product_name" || key === "unit_code") return true;
  if (structure === "simple") return key === "product_sku";
  return key === "variant_sku";
}

export function customFieldCsvKey(field: InventoryCustomFieldDefinition) {
  return `custom_${field.entity_type}_${field.id}`;
}

export function createImportDraftRow(patch: Partial<ImportDraftRow> = {}): ImportDraftRow {
  const base = Object.fromEntries(importFields.map((field) => [field.key, ""])) as Record<
    ImportFieldKey,
    string
  >;
  return {
    ...base,
    id: crypto.randomUUID(),
    source_row: 0,
    customFields: {},
    ...patch,
  };
}

export function rawCsvToImportRows(
  rawCsv: string,
  mapping: Record<ImportFieldKey, string>,
  structure: ImportStructure,
  options: {
    nameCase: CaseNormalization;
    skuCase: CaseNormalization;
    skuWhitespace: SkuWhitespaceNormalization;
    skuWhitespaceReplacement: string;
    skuSpecialCharacters: string;
    skuSpecialCharacterMode: SkuSpecialCharacterNormalization;
    fallbackUnitCode: string;
    customFieldMappings: ImportCustomFieldMapping[];
  }
) {
  const lines = csvLines(rawCsv);
  const headers = parseCsvLine(lines[0] ?? "");
  const headerIndex = new Map(headers.map((header, index) => [header, index]));

  return lines.slice(1).flatMap((line, index) => {
    const cells = parseCsvLine(line);
    if (!cells.some((cell) => cell.trim())) return [];
    const values = Object.fromEntries(
      importFields.map((field) => {
        const source = mapping[field.key];
        const cellIndex = source ? headerIndex.get(source) : undefined;
        return [field.key, cellIndex == null ? "" : (cells[cellIndex] ?? "").trim()];
      })
    ) as Record<ImportFieldKey, string>;
    const customFields = Object.fromEntries(
      options.customFieldMappings.flatMap((mapping) => {
        if (!mapping.field_id || !mapping.source) return [];
        const cellIndex = headerIndex.get(mapping.source);
        const value = cellIndex == null ? "" : (cells[cellIndex] ?? "").trim();
        return value ? [[mapping.field_id, value]] : [];
      })
    );

    values.product_name = normalizeCaseValue(values.product_name, options.nameCase);
    values.product_sku = normalizeSkuValue(
      values.product_sku,
      options.skuCase,
      options.skuWhitespace,
      options.skuWhitespaceReplacement,
      options.skuSpecialCharacterMode,
      options.skuSpecialCharacters
    );
    values.variant_sku = normalizeSkuValue(
      values.variant_sku,
      options.skuCase,
      options.skuWhitespace,
      options.skuWhitespaceReplacement,
      options.skuSpecialCharacterMode,
      options.skuSpecialCharacters
    );
    if (!values.unit_code && options.fallbackUnitCode) {
      values.unit_code = options.fallbackUnitCode;
    }

    if (structure === "simple") {
      const sku = values.product_sku || values.variant_sku;
      values.product_sku = sku;
      values.variant_sku = sku;
      values.variant_name = values.product_name;
    }

    return [createImportDraftRow({ ...values, source_row: index + 2, customFields })];
  });
}

export function importRowsToCsv(
  rows: ImportDraftRow[],
  structure: ImportStructure,
  customFields: InventoryCustomFieldDefinition[] = []
) {
  const headers = [
    ...importFields.map((field) => field.key),
    ...customFields.map((field) => customFieldCsvKey(field)),
  ];
  const output = [headers.join(",")];
  for (const row of rows) {
    output.push(
      headers
        .map((header) => {
          const customField = customFields.find((field) => customFieldCsvKey(field) === header);
          if (customField) return csvCell(row.customFields[customField.id] ?? "");
          const field = importFields.find((item) => item.key === header);
          if (!field) return "";
          let value = row[field.key] ?? "";
          if (structure === "simple") {
            if (field.key === "variant_name") value = row.product_name;
            if (field.key === "variant_sku") value = row.product_sku;
          }
          return csvCell(value);
        })
        .join(",")
    );
  }
  return output.join("\n");
}

export async function importFileToCsv(file: File) {
  const lowerName = file.name.toLowerCase();
  if (!lowerName.endsWith(".xlsx") && !lowerName.endsWith(".xls")) {
    throw new Error("unsupported_excel_import_file");
  }

  const XLSX = await import("xlsx");
  const workbook = XLSX.read(await file.arrayBuffer(), { type: "array" });
  const firstSheetName = workbook.SheetNames[0];
  const sheet = firstSheetName ? workbook.Sheets[firstSheetName] : null;
  if (!sheet) throw new Error("missing_excel_import_worksheet");
  const rows = XLSX.utils.sheet_to_json<Array<string | number | boolean | null>>(sheet, {
    header: 1,
    blankrows: false,
    defval: "",
  });
  return rows
    .filter((row) => row.some((cell) => String(cell ?? "").trim()))
    .map((row) => row.map((cell) => csvCell(String(cell ?? "").trim())).join(","))
    .join("\n");
}
