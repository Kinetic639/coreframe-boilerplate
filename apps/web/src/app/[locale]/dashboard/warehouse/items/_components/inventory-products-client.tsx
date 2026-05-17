"use client";

import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import type React from "react";
import Image from "next/image";
import * as XLSX from "xlsx";
import {
  Check,
  ChevronDown,
  ChevronRight,
  Copy,
  Download,
  Edit,
  FileText,
  PackagePlus,
  Trash2,
  Upload,
  X,
} from "lucide-react";
import { Link, useRouter } from "@/i18n/navigation";
import { DataView } from "@/components/data-view/data-view";
import type {
  DataViewColumnDef,
  DataViewFilterDef,
  DataViewListParams,
  PaginatedResult,
} from "@/components/data-view/data-view.types";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Switch } from "@/components/ui/switch";
import { cn } from "@/lib/utils";
import { useUiStoreV2 } from "@/lib/stores/v2/ui-store";
import { useDataViewUrl } from "@/components/data-view/use-data-view";
import type {
  InventoryCustomFieldDefinition,
  InventoryTagRow,
  InventoryTaxRateRow,
  InventoryUnitRow,
  InventoryProductImageRow,
  InventoryProductDetail,
  InventoryProductListRow,
  InventoryProductVariantListRow,
} from "@/server/services/inventory-products.service";
import {
  createInventoryCustomFieldAction,
  createInventoryUnitAction,
  exportInventoryProductsCsvAction,
  getInventoryProductAction,
  importInventoryProductsCsvAction,
  listInventoryProductsAction,
  previewInventoryProductsCsvImportAction,
} from "@/app/actions/warehouse/inventory";

type InventoryProductsClientProps = {
  initialData: PaginatedResult<InventoryProductListRow>;
  customFields: InventoryCustomFieldDefinition[];
  canManageProducts: boolean;
  canImportProducts: boolean;
  importOnly?: boolean;
  units?: InventoryUnitRow[];
  taxRates?: InventoryTaxRateRow[];
  tags?: InventoryTagRow[];
};

const EMPTY_UNITS: InventoryUnitRow[] = [];
const EMPTY_TAX_RATES: InventoryTaxRateRow[] = [];
const EMPTY_TAGS: InventoryTagRow[] = [];

type ProductImportPreview = {
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

const statusVariant: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
  active: "default",
  archived: "secondary",
  discontinued: "destructive",
};

const importFields = [
  { key: "product_name", label: "Product name", required: true },
  { key: "product_sku", label: "Product SKU", required: false },
  { key: "variant_name", label: "Variant name", required: false },
  { key: "variant_sku", label: "Variant SKU", required: true },
  { key: "unit_code", label: "Unit", required: true },
  { key: "product_type", label: "Type", required: false },
  { key: "status", label: "Status", required: false },
  { key: "barcode", label: "Barcode", required: false },
  { key: "purchase_price", label: "Purchase price", required: false },
  { key: "sales_price", label: "Sales price", required: false },
  { key: "sales_account_code", label: "Sales account", required: false },
  { key: "purchase_account_code", label: "Purchase account", required: false },
  { key: "tax_code", label: "Tax code", required: false },
  { key: "tax_rate_percent", label: "Tax rate", required: false },
  { key: "reorder_point", label: "Reorder point", required: false },
  { key: "tags", label: "Tags", required: false },
  { key: "description", label: "Description", required: false },
] as const;

type ImportFieldKey = (typeof importFields)[number]["key"];
type ImportMode = "create_only" | "skip_existing";
type ImportStructure = "simple" | "variants";
type ImportStep = 1 | 2 | 3;
type UnitAssignmentMode = "column" | "fallback";
type CaseNormalization = "none" | "upper" | "lower" | "title";
type SkuWhitespaceNormalization = "keep" | "remove" | "replace";
type SkuSpecialCharacterNormalization = "keep" | "remove_selected" | "remove_all";

type ImportCustomFieldMapping = {
  id: string;
  field_id: string;
  source: string;
};

type ImportDraftRow = Record<ImportFieldKey, string> & {
  id: string;
  source_row: number;
  customFields: Record<string, string>;
};

function parseCsvLine(line: string) {
  const cells: string[] = [];
  let cell = "";
  let quoted = false;
  for (let index = 0; index < line.length; index += 1) {
    const char = line[index];
    const next = line[index + 1];
    if (char === '"' && quoted && next === '"') {
      cell += '"';
      index += 1;
    } else if (char === '"') {
      quoted = !quoted;
    } else if (char === "," && !quoted) {
      cells.push(cell);
      cell = "";
    } else {
      cell += char;
    }
  }
  cells.push(cell);
  return cells;
}

function csvCell(value: string) {
  return /[",\n\r]/.test(value) ? `"${value.replaceAll('"', '""')}"` : value;
}

function csvLines(csv: string) {
  return csv
    .replace(/^\uFEFF/, "")
    .split(/\r?\n/)
    .filter((line) => line.trim().length > 0);
}

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

function autoMapHeaders(headers: string[]) {
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

function importFieldsForStructure(structure: ImportStructure) {
  return importFields.filter(
    (field) =>
      structure === "variants" || (field.key !== "variant_name" && field.key !== "variant_sku")
  );
}

function isImportFieldRequired(key: ImportFieldKey, structure: ImportStructure) {
  if (key === "product_name" || key === "unit_code") return true;
  if (structure === "simple") return key === "product_sku";
  return key === "variant_sku";
}

function normalizeCaseValue(value: string, mode: CaseNormalization) {
  const text = value.trim();
  if (mode === "upper") return text.toUpperCase();
  if (mode === "lower") return text.toLowerCase();
  if (mode === "title") {
    return text
      .toLowerCase()
      .replace(/\p{L}[\p{L}\p{M}'-]*/gu, (word) => word[0].toUpperCase() + word.slice(1));
  }
  return text;
}

function normalizeSkuValue(
  value: string,
  caseMode: CaseNormalization,
  whitespaceMode: SkuWhitespaceNormalization,
  replacement: string,
  specialMode: SkuSpecialCharacterNormalization,
  specialCharacters: string
) {
  let sku = normalizeCaseValue(value, caseMode);
  if (whitespaceMode === "remove") sku = sku.replace(/\s+/g, "");
  if (whitespaceMode === "replace") sku = sku.replace(/\s+/g, replacement || "-");
  if (specialMode === "remove_selected" && specialCharacters) {
    const escaped = specialCharacters.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    sku = sku.replace(new RegExp(`[${escaped}]`, "g"), "");
  }
  if (specialMode === "remove_all") {
    sku = sku.replace(/[^\p{L}\p{N}]/gu, "");
  }
  return sku;
}

function customFieldCsvKey(field: InventoryCustomFieldDefinition) {
  return `custom_${field.entity_type}_${field.id}`;
}

function parseTokenString(value: string) {
  return value
    .split(",")
    .map((token) => token.trim())
    .filter(Boolean);
}

function formatTokenString(tokens: string[]) {
  return tokens.join(", ");
}

function slugKey(value: string) {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 80);
}

function mergeById<T extends { id: string }>(current: T[], incoming: T[]) {
  const merged = new Map<string, T>();
  current.forEach((item) => merged.set(item.id, item));
  incoming.forEach((item) => merged.set(item.id, item));
  return Array.from(merged.values());
}

function sameIdsInOrder<T extends { id: string }>(left: T[], right: T[]) {
  return left.length === right.length && left.every((item, index) => item.id === right[index]?.id);
}

function ImportMultiSelectCell({
  value,
  options,
  onChange,
  className,
  allowCreate = false,
}: {
  value: string;
  options: string[];
  onChange: (value: string) => void;
  className?: string;
  allowCreate?: boolean;
}) {
  const [draft, setDraft] = useState("");
  const selected = parseTokenString(value);
  const selectedSet = new Set(selected.map((item) => item.toLowerCase()));
  const sortedOptions = Array.from(new Set([...options, ...selected])).sort((a, b) =>
    a.localeCompare(b)
  );

  const applyTokens = (tokens: string[]) => {
    const uniqueTokens = new Map<string, string>();
    tokens
      .map((token) => token.trim())
      .filter(Boolean)
      .forEach((token) => uniqueTokens.set(token.toLowerCase(), token));
    onChange(formatTokenString(Array.from(uniqueTokens.values())));
  };

  const toggleOption = (option: string, checked: boolean) => {
    const next = checked
      ? [...selected, option]
      : selected.filter((item) => item.toLowerCase() !== option.toLowerCase());
    applyTokens(next);
  };

  const addDraftToken = () => {
    const nextToken = draft.trim();
    if (!nextToken) return;
    applyTokens([...selected, nextToken]);
    setDraft("");
  };

  return (
    <Popover>
      <PopoverTrigger asChild>
        <button
          type="button"
          className={cn(
            "flex min-h-9 w-full items-center gap-1 rounded-md border border-input bg-background px-2 py-1 text-left text-sm",
            className
          )}
        >
          {selected.length > 0 ? (
            <span className="flex min-w-0 flex-wrap gap-1">
              {selected.slice(0, 3).map((token) => (
                <span
                  key={token}
                  className="inline-flex h-6 max-w-32 items-center truncate rounded bg-muted px-2 text-xs"
                >
                  {token}
                </span>
              ))}
              {selected.length > 3 ? (
                <span className="inline-flex h-6 items-center rounded bg-muted px-2 text-xs">
                  +{selected.length - 3}
                </span>
              ) : null}
            </span>
          ) : (
            <span className="text-muted-foreground">Select</span>
          )}
          <ChevronDown className="ml-auto h-4 w-4 shrink-0 text-muted-foreground" />
        </button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-72 p-2">
        {allowCreate ? (
          <div className="mb-2">
            <input
              value={draft}
              placeholder="Type and press Enter"
              className="h-9 w-full rounded-md border border-input bg-background px-2 text-sm"
              onChange={(event) => setDraft(event.target.value)}
              onKeyDown={(event) => {
                if (event.key !== "Enter") return;
                event.preventDefault();
                addDraftToken();
              }}
              onBlur={addDraftToken}
            />
          </div>
        ) : null}
        {sortedOptions.length > 0 ? (
          <div className="max-h-64 overflow-auto pr-1">
            {sortedOptions.map((option) => {
              const checked = selectedSet.has(option.toLowerCase());
              return (
                <label
                  key={option}
                  className="flex cursor-pointer items-center gap-2 rounded px-2 py-1.5 text-sm hover:bg-muted"
                >
                  <Checkbox
                    checked={checked}
                    onCheckedChange={(nextChecked) => toggleOption(option, nextChecked === true)}
                  />
                  <span className="min-w-0 truncate">{option}</span>
                </label>
              );
            })}
          </div>
        ) : (
          <p className="px-2 py-3 text-sm text-muted-foreground">No presets available.</p>
        )}
        {selected.length > 0 ? (
          <div className="mt-2 border-t pt-2">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="h-8 w-full justify-start"
              onClick={() => onChange("")}
            >
              Clear selection
            </Button>
          </div>
        ) : null}
      </PopoverContent>
    </Popover>
  );
}

function createImportDraftRow(patch: Partial<ImportDraftRow> = {}): ImportDraftRow {
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

function rawCsvToImportRows(
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

function importRowsToCsv(
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

async function importFileToCsv(file: File) {
  const lowerName = file.name.toLowerCase();
  if (lowerName.endsWith(".xlsx") || lowerName.endsWith(".xls")) {
    const workbook = XLSX.read(await file.arrayBuffer(), { type: "array" });
    const firstSheetName = workbook.SheetNames[0];
    const sheet = firstSheetName ? workbook.Sheets[firstSheetName] : null;
    if (!sheet) throw new Error("Excel file does not contain a worksheet.");
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
  if (lowerName.endsWith(".tsv")) {
    const text = await file.text();
    return text
      .split(/\r?\n/)
      .map((line) =>
        line
          .split("\t")
          .map((cell) => csvCell(cell.trim()))
          .join(",")
      )
      .join("\n");
  }
  return file.text();
}

async function listFetcher(params: DataViewListParams) {
  const result = await listInventoryProductsAction(params);
  if (!result.success || !("data" in result))
    throw new Error("error" in result ? result.error : "Unauthorized");
  return result.data;
}

async function detailFetcher(id: string) {
  const result = await getInventoryProductAction({
    id: id.includes("::") ? id.split("::")[0] : id,
  });
  if (!result.success || !("data" in result))
    throw new Error("error" in result ? result.error : "Unauthorized");
  return result.data;
}

export function InventoryProductsClient({
  initialData,
  customFields,
  canManageProducts,
  canImportProducts,
  importOnly = false,
  units = EMPTY_UNITS,
  taxRates = EMPTY_TAX_RATES,
  tags = EMPTY_TAGS,
}: InventoryProductsClientProps) {
  const router = useRouter();
  const setFlushContent = useUiStoreV2((state) => state.setFlushContent);
  const [expandedProductIds, setExpandedProductIds] = useState<Record<string, true>>({});
  const [importMessage, setImportMessage] = useState<string | null>(null);
  const [importWizardOpen, setImportWizardOpen] = useState(importOnly);
  const [importStep, setImportStep] = useState<ImportStep>(1);
  const [importFileName, setImportFileName] = useState<string | null>(null);
  const [importStructure, setImportStructure] = useState<ImportStructure>("simple");
  const [nameCaseNormalization, setNameCaseNormalization] = useState<CaseNormalization>("none");
  const [skuCaseNormalization, setSkuCaseNormalization] = useState<CaseNormalization>("upper");
  const [skuWhitespaceNormalization, setSkuWhitespaceNormalization] =
    useState<SkuWhitespaceNormalization>("keep");
  const [skuWhitespaceReplacement, setSkuWhitespaceReplacement] = useState("-");
  const [skuSpecialCharacterNormalization, setSkuSpecialCharacterNormalization] =
    useState<SkuSpecialCharacterNormalization>("keep");
  const [skuSpecialCharacters, setSkuSpecialCharacters] = useState("-/");
  const [unitAssignmentMode, setUnitAssignmentMode] = useState<UnitAssignmentMode>("column");
  const [fallbackUnitCode, setFallbackUnitCode] = useState("");
  const [unitOptions, setUnitOptions] = useState(units);
  const [tagOptions] = useState(tags);
  const [taxRateOptions] = useState(taxRates);
  const [customFieldOptions, setCustomFieldOptions] = useState(customFields);
  const [customFieldMappings, setCustomFieldMappings] = useState<ImportCustomFieldMapping[]>([]);
  const [showQuickAddUnit, setShowQuickAddUnit] = useState(false);
  const [unitDraft, setUnitDraft] = useState({ code: "", name: "", kind: "count" });
  const [showQuickAddCustomField, setShowQuickAddCustomField] = useState(false);
  const [customFieldDraft, setCustomFieldDraft] = useState({
    name: "",
    entityType: "product" as "product" | "variant",
    fieldType: "text" as InventoryCustomFieldDefinition["field_type"],
  });
  const [importPreview, setImportPreview] = useState<ProductImportPreview | null>(null);
  const [importCsv, setImportCsv] = useState<string | null>(null);
  const [rawImportCsv, setRawImportCsv] = useState<string | null>(null);
  const [importRows, setImportRows] = useState<ImportDraftRow[]>([]);
  const [importHeaders, setImportHeaders] = useState<string[]>([]);
  const [columnMapping, setColumnMapping] = useState<Record<ImportFieldKey, string>>(() =>
    autoMapHeaders([])
  );
  const [importMode, setImportMode] = useState<ImportMode>("create_only");
  const [isImportPending, startImportTransition] = useTransition();
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    if (!importOnly) return undefined;
    setFlushContent(true);
    return () => setFlushContent(false);
  }, [importOnly, setFlushContent]);

  useEffect(() => {
    setUnitOptions((current) => {
      const next = mergeById(current, units).sort((a, b) => a.code.localeCompare(b.code));
      return sameIdsInOrder(current, next) ? current : next;
    });
  }, [units]);

  useEffect(() => {
    setCustomFieldOptions((current) => {
      const next = mergeById(current, customFields).sort(
        (a, b) => a.display_order - b.display_order
      );
      return sameIdsInOrder(current, next) ? current : next;
    });
  }, [customFields]);

  const toggleExpanded = (id: string) => {
    setExpandedProductIds((current) => {
      const next = { ...current };
      if (next[id]) delete next[id];
      else next[id] = true;
      return next;
    });
  };

  const editableImportFields = useMemo<
    Array<{ key: ImportFieldKey; label: string; copy?: boolean }>
  >(
    () =>
      importStructure === "simple"
        ? [
            { key: "product_name", label: "Item name*" },
            { key: "product_sku", label: "SKU*", copy: true },
            { key: "unit_code", label: "Unit*", copy: true },
            { key: "purchase_price", label: "Cost price", copy: true },
            { key: "sales_price", label: "Selling price", copy: true },
            { key: "barcode", label: "Barcode" },
            { key: "tax_code", label: "Tax", copy: true },
            { key: "reorder_point", label: "Reorder point", copy: true },
            { key: "tags", label: "Tags" },
            { key: "description", label: "Description" },
          ]
        : [
            { key: "product_name", label: "Product name*", copy: true },
            { key: "product_sku", label: "Product SKU", copy: true },
            { key: "variant_name", label: "Variant name" },
            { key: "variant_sku", label: "Variant SKU*", copy: true },
            { key: "unit_code", label: "Unit*", copy: true },
            { key: "purchase_price", label: "Cost price", copy: true },
            { key: "sales_price", label: "Selling price", copy: true },
            { key: "barcode", label: "Barcode" },
            { key: "tax_code", label: "Tax", copy: true },
            { key: "reorder_point", label: "Reorder point", copy: true },
            { key: "tags", label: "Tags" },
            { key: "description", label: "Description" },
          ],
    [importStructure]
  );
  const mappedCustomFields = useMemo(() => {
    const seen = new Set<string>();
    return customFieldMappings
      .map((mapping) => customFieldOptions.find((field) => field.id === mapping.field_id))
      .filter((field): field is InventoryCustomFieldDefinition => {
        if (!field || seen.has(field.id)) return false;
        seen.add(field.id);
        return true;
      });
  }, [customFieldMappings, customFieldOptions]);

  const clearImportWizard = () => {
    setImportMessage(null);
    setImportWizardOpen(false);
    setImportStep(1);
    setImportFileName(null);
    setImportPreview(null);
    setImportCsv(null);
    setRawImportCsv(null);
    setImportRows([]);
    setImportHeaders([]);
    setColumnMapping(autoMapHeaders([]));
    setUnitAssignmentMode("column");
    setFallbackUnitCode("");
    setShowQuickAddUnit(false);
    setCustomFieldMappings([]);
  };

  const cancelImport = () => {
    if (importOnly) {
      router.push("/dashboard/warehouse/items");
      return;
    }
    clearImportWizard();
  };

  const updateImportRows = (nextRows: ImportDraftRow[]) => {
    setImportRows(nextRows);
    setImportPreview(null);
    setImportCsv(importRowsToCsv(nextRows, importStructure, mappedCustomFields));
  };

  const handleImportFile = (file: File) => {
    startImportTransition(async () => {
      setImportMessage(null);
      setImportPreview(null);
      setImportCsv(null);
      setImportRows([]);
      let csv = "";
      try {
        csv = await importFileToCsv(file);
      } catch (error) {
        setImportMessage(error instanceof Error ? error.message : "Could not read import file.");
        return;
      }
      const headers = parseCsvLine(csvLines(csv)[0] ?? "");
      const mapping = autoMapHeaders(headers);
      if (!mapping.product_sku && mapping.variant_sku) {
        mapping.product_sku = mapping.variant_sku;
      }
      setRawImportCsv(csv);
      setImportFileName(file.name);
      setImportHeaders(headers);
      setColumnMapping(mapping);
      setUnitAssignmentMode(mapping.unit_code ? "column" : "fallback");
      setFallbackUnitCode("");
      setShowQuickAddUnit(false);
      setCustomFieldMappings([]);
      setImportWizardOpen(true);
      setImportStep(1);
    });
  };

  const buildImportRows = () => {
    if (!rawImportCsv) return [];
    const rows = rawCsvToImportRows(rawImportCsv, columnMapping, importStructure, {
      nameCase: nameCaseNormalization,
      skuCase: skuCaseNormalization,
      skuWhitespace: skuWhitespaceNormalization,
      skuWhitespaceReplacement,
      skuSpecialCharacters,
      skuSpecialCharacterMode: skuSpecialCharacterNormalization,
      fallbackUnitCode: unitAssignmentMode === "fallback" ? fallbackUnitCode : "",
      customFieldMappings,
    });
    setImportRows(rows);
    setImportPreview(null);
    setImportCsv(importRowsToCsv(rows, importStructure, mappedCustomFields));
    return rows;
  };

  const downloadSampleImportFile = (format: "csv" | "xlsx") => {
    const headers = importFieldsForStructure(importStructure).map((field) => field.key);
    const sample =
      importStructure === "simple"
        ? [
            "Brake pad set",
            "BP-001",
            "P",
            "stocked",
            "active",
            "",
            "120",
            "180",
            "",
            "",
            "VAT23",
            "23",
            "5",
            "brakes",
            "Front axle pads",
          ]
        : [
            "T-shirt",
            "TSHIRT",
            "T-shirt - blue - M",
            "TSHIRT-BLU-M",
            "P",
            "stocked",
            "active",
            "",
            "40",
            "80",
            "",
            "",
            "VAT23",
            "23",
            "10",
            "shirts",
            "Blue medium shirt",
          ];
    const rows = [headers, sample.slice(0, headers.length)];
    if (format === "xlsx") {
      const workbook = XLSX.utils.book_new();
      const sheet = XLSX.utils.aoa_to_sheet(rows);
      XLSX.utils.book_append_sheet(workbook, sheet, "Items");
      const data = XLSX.write(workbook, { bookType: "xlsx", type: "array" });
      const url = URL.createObjectURL(
        new Blob([data], {
          type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        })
      );
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = `ambra-items-${importStructure}-sample.xlsx`;
      anchor.click();
      URL.revokeObjectURL(url);
      return;
    }
    const csv = rows.map((row) => row.map(csvCell).join(",")).join("\n");
    const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `ambra-items-${importStructure}-sample.csv`;
    anchor.click();
    URL.revokeObjectURL(url);
  };

  const previewImportRows = (rows: ImportDraftRow[]) => {
    const csv = importRowsToCsv(rows, importStructure, mappedCustomFields);
    startImportTransition(async () => {
      const preview = await previewInventoryProductsCsvImportAction({ csv });
      if (!preview.success || !("data" in preview)) {
        setImportMessage("error" in preview ? preview.error : "Import preview failed");
        return;
      }
      setImportPreview(preview.data);
      setImportCsv(csv);
      setImportMessage(
        preview.data.invalid_rows > 0
          ? `Review ${preview.data.invalid_rows} invalid rows before importing.`
          : `Preview ready: ${preview.data.valid_rows} rows can be imported.`
      );
    });
  };

  const confirmImport = () => {
    const csv = importRowsToCsv(importRows, importStructure, mappedCustomFields);
    startImportTransition(async () => {
      const imported = await importInventoryProductsCsvAction({
        csv,
        mode: importMode,
      });
      setImportMessage(
        imported.success && "data" in imported
          ? `Imported ${imported.data.imported_products} products and ${imported.data.imported_variants} variants. Skipped ${imported.data.skipped_rows ?? 0} rows.`
          : "error" in imported
            ? imported.error
            : "Import failed"
      );
      if (imported.success) {
        if (importOnly) {
          router.push("/dashboard/warehouse/items");
        } else {
          setImportWizardOpen(false);
          setImportStep(1);
          setImportFileName(null);
          setImportPreview(null);
          setImportCsv(null);
          setRawImportCsv(null);
          setImportRows([]);
          setImportHeaders([]);
          setColumnMapping(autoMapHeaders([]));
          setCustomFieldMappings([]);
        }
      }
    });
  };

  const createUnitFromDraft = () => {
    const code = unitDraft.code.trim();
    const name = unitDraft.name.trim();
    if (!code || !name) {
      setImportMessage("Unit code and name are required.");
      return;
    }
    startImportTransition(async () => {
      const result = await createInventoryUnitAction({
        code,
        name,
        unit_kind: unitDraft.kind,
        precision: 0,
      });
      if (!result.success || !("data" in result)) {
        setImportMessage("error" in result ? result.error : "Could not create unit.");
        return;
      }
      setUnitOptions((current) =>
        [...current.filter((unit) => unit.id !== result.data.id), result.data].sort((a, b) =>
          a.code.localeCompare(b.code)
        )
      );
      setUnitAssignmentMode("fallback");
      setColumnMapping((mapping) => ({ ...mapping, unit_code: "" }));
      setFallbackUnitCode(result.data.code);
      setUnitDraft({ code: "", name: "", kind: "count" });
      setShowQuickAddUnit(false);
      setImportMessage(`Unit ${result.data.code} added.`);
    });
  };

  const createCustomFieldFromDraft = () => {
    const name = customFieldDraft.name.trim();
    if (!name) {
      setImportMessage("Custom field name is required.");
      return;
    }
    startImportTransition(async () => {
      const result = await createInventoryCustomFieldAction({
        entity_type: customFieldDraft.entityType,
        name,
        field_key: slugKey(name),
        field_type: customFieldDraft.fieldType,
        is_required: false,
        is_filterable: true,
        options: [],
        display_order: customFieldOptions.length + 1,
      });
      if (!result.success || !("data" in result)) {
        setImportMessage("error" in result ? result.error : "Could not create custom field.");
        return;
      }
      const created: InventoryCustomFieldDefinition = {
        id: result.data.id,
        entity_type: customFieldDraft.entityType,
        name,
        field_key: slugKey(name),
        field_type: customFieldDraft.fieldType,
        is_required: false,
        is_filterable: true,
        options: [],
        display_order: customFieldOptions.length + 1,
        section_name: null,
        help_text: null,
        placeholder: null,
      };
      setCustomFieldOptions((current) =>
        mergeById(current, [created]).sort((a, b) => a.display_order - b.display_order)
      );
      setCustomFieldMappings((current) => [
        ...current,
        { id: crypto.randomUUID(), field_id: created.id, source: "" },
      ]);
      setCustomFieldDraft({ name: "", entityType: "product", fieldType: "text" });
      setShowQuickAddCustomField(false);
      setImportMessage(`Custom field ${created.name} added.`);
    });
  };

  const updateImportRow = (rowId: string, patch: Partial<ImportDraftRow>) => {
    updateImportRows(importRows.map((row) => (row.id === rowId ? { ...row, ...patch } : row)));
  };

  const updateImportRowCustomField = (rowId: string, fieldId: string, value: string) => {
    updateImportRows(
      importRows.map((row) =>
        row.id === rowId ? { ...row, customFields: { ...row.customFields, [fieldId]: value } } : row
      )
    );
  };

  const renderMappingOptions = (fieldKey: ImportFieldKey) => {
    if (fieldKey === "product_name") {
      return (
        <label className="grid gap-1">
          <span className="text-xs font-medium uppercase text-muted-foreground">
            Normalize names
          </span>
          <select
            value={nameCaseNormalization}
            className="h-10 w-full rounded-md border border-input bg-background px-3 pr-10 text-sm"
            onChange={(event) => {
              setNameCaseNormalization(event.target.value as CaseNormalization);
              setImportRows([]);
              setImportPreview(null);
              setImportCsv(null);
            }}
          >
            <option value="none">None</option>
            <option value="upper">Upper case</option>
            <option value="lower">Lower case</option>
            <option value="title">Title case</option>
          </select>
        </label>
      );
    }
    if (fieldKey === "product_sku" || fieldKey === "variant_sku") {
      return (
        <div className="flex flex-wrap items-end gap-2">
          <label className="grid w-44 gap-1">
            <span className="text-xs font-medium uppercase text-muted-foreground">Letter case</span>
            <select
              value={skuCaseNormalization}
              className="h-10 rounded-md border border-input bg-background px-3 pr-9 text-sm"
              onChange={(event) => {
                setSkuCaseNormalization(event.target.value as CaseNormalization);
                setImportRows([]);
                setImportPreview(null);
                setImportCsv(null);
              }}
            >
              <option value="none">Keep case</option>
              <option value="upper">Upper case</option>
              <option value="lower">Lower case</option>
              <option value="title">Title case</option>
            </select>
          </label>
          <label className="grid w-40 gap-1">
            <span className="text-xs font-medium uppercase text-muted-foreground">Whitespace</span>
            <select
              value={skuWhitespaceNormalization}
              className="h-10 rounded-md border border-input bg-background px-3 pr-9 text-sm"
              onChange={(event) => {
                setSkuWhitespaceNormalization(event.target.value as SkuWhitespaceNormalization);
                setImportRows([]);
                setImportPreview(null);
                setImportCsv(null);
              }}
            >
              <option value="keep">Keep</option>
              <option value="remove">Remove</option>
              <option value="replace">Replace</option>
            </select>
          </label>
          {skuWhitespaceNormalization === "replace" ? (
            <label className="grid w-44 gap-1">
              <span className="text-xs font-medium uppercase text-muted-foreground">
                Replace with
              </span>
              <input
                value={skuWhitespaceReplacement}
                className="h-10 rounded-md border border-input bg-background px-3 text-sm"
                onChange={(event) => {
                  setSkuWhitespaceReplacement(event.target.value);
                  setImportRows([]);
                  setImportPreview(null);
                  setImportCsv(null);
                }}
              />
            </label>
          ) : null}
          <label className="grid w-52 gap-1">
            <span className="text-xs font-medium uppercase text-muted-foreground">
              Special characters
            </span>
            <select
              value={skuSpecialCharacterNormalization}
              className="h-10 rounded-md border border-input bg-background px-3 pr-9 text-sm"
              onChange={(event) => {
                setSkuSpecialCharacterNormalization(
                  event.target.value as SkuSpecialCharacterNormalization
                );
                setImportRows([]);
                setImportPreview(null);
                setImportCsv(null);
              }}
            >
              <option value="keep">Keep</option>
              <option value="remove_selected">Remove selected</option>
              <option value="remove_all">Remove all special</option>
            </select>
          </label>
          {skuSpecialCharacterNormalization === "remove_selected" ? (
            <label className="grid w-40 gap-1">
              <span className="text-xs font-medium uppercase text-muted-foreground">
                Remove chars
              </span>
              <input
                value={skuSpecialCharacters}
                placeholder="-/"
                className="h-10 rounded-md border border-input bg-background px-3 text-sm"
                onChange={(event) => {
                  setSkuSpecialCharacters(event.target.value);
                  setImportRows([]);
                  setImportPreview(null);
                  setImportCsv(null);
                }}
              />
            </label>
          ) : null}
        </div>
      );
    }
    if (fieldKey === "unit_code") {
      return null;
    }
    return null;
  };

  const inputClassForImportField = (fieldKey: ImportFieldKey) =>
    cn(
      "h-9 w-full rounded-md border border-input bg-background px-2 text-sm",
      fieldKey === "product_name" || fieldKey === "variant_name" || fieldKey === "description"
        ? "min-w-80"
        : fieldKey === "product_sku" || fieldKey === "variant_sku"
          ? "min-w-60"
          : fieldKey === "unit_code" || fieldKey === "tax_code" || fieldKey === "tags"
            ? "min-w-52"
            : "min-w-40"
    );

  const renderImportCell = (row: ImportDraftRow, fieldKey: ImportFieldKey) => {
    if (fieldKey === "unit_code") {
      return (
        <select
          value={row.unit_code}
          className={cn(inputClassForImportField(fieldKey), "pr-10")}
          onChange={(event) => updateImportRow(row.id, { unit_code: event.target.value })}
        >
          <option value="">Select unit</option>
          {unitOptions.map((unit) => (
            <option key={unit.id} value={unit.code}>
              {unit.code} · {unit.name}
            </option>
          ))}
        </select>
      );
    }
    if (fieldKey === "tax_code") {
      return (
        <select
          value={row.tax_code}
          className={cn(inputClassForImportField(fieldKey), "pr-10")}
          onChange={(event) => {
            const tax = taxRateOptions.find((item) => item.code === event.target.value);
            updateImportRow(row.id, {
              tax_code: event.target.value,
              tax_rate_percent: tax ? String(tax.rate_percent) : row.tax_rate_percent,
            });
          }}
        >
          <option value="">No tax</option>
          {taxRateOptions.map((tax) => (
            <option key={tax.id} value={tax.code}>
              {tax.code} · {tax.rate_percent}%
            </option>
          ))}
        </select>
      );
    }
    if (fieldKey === "tags") {
      return (
        <ImportMultiSelectCell
          value={row.tags}
          options={tagOptions.map((tag) => tag.name)}
          className="min-w-60"
          allowCreate
          onChange={(value) => updateImportRow(row.id, { tags: value })}
        />
      );
    }
    return (
      <input
        value={row[fieldKey]}
        className={inputClassForImportField(fieldKey)}
        onChange={(event) => updateImportRow(row.id, { [fieldKey]: event.target.value })}
      />
    );
  };

  const renderCustomImportCell = (row: ImportDraftRow, field: InventoryCustomFieldDefinition) => {
    const value = row.customFields[field.id] ?? "";
    if (field.field_type === "boolean") {
      return (
        <select
          value={value}
          className="h-9 w-full min-w-36 rounded-md border border-input bg-background px-2 pr-10 text-sm"
          onChange={(event) => updateImportRowCustomField(row.id, field.id, event.target.value)}
        >
          <option value="">Unset</option>
          <option value="true">True</option>
          <option value="false">False</option>
        </select>
      );
    }
    if (field.field_type === "select") {
      return (
        <select
          value={value}
          className="h-9 w-full min-w-52 rounded-md border border-input bg-background px-2 pr-10 text-sm"
          onChange={(event) => updateImportRowCustomField(row.id, field.id, event.target.value)}
        >
          <option value="">Select</option>
          {field.options.map((option) => (
            <option key={option} value={option}>
              {option}
            </option>
          ))}
        </select>
      );
    }
    if (field.field_type === "multi_select") {
      return (
        <ImportMultiSelectCell
          value={value}
          options={field.options}
          className="min-w-60"
          onChange={(nextValue) => updateImportRowCustomField(row.id, field.id, nextValue)}
        />
      );
    }
    return (
      <input
        type={
          field.field_type === "number" ? "number" : field.field_type === "date" ? "date" : "text"
        }
        value={value}
        className={cn(
          "h-9 w-full rounded-md border border-input bg-background px-2 text-sm",
          field.field_type === "text" ? "min-w-64" : "min-w-44"
        )}
        onChange={(event) => updateImportRowCustomField(row.id, field.id, event.target.value)}
      />
    );
  };

  const importMappingFields = importFieldsForStructure(importStructure);
  const missingRequiredMappings = importMappingFields.filter(
    (field) =>
      isImportFieldRequired(field.key, importStructure) &&
      !(field.key === "unit_code" && unitAssignmentMode === "fallback" && fallbackUnitCode) &&
      !columnMapping[field.key]
  );
  const importSkippedRows =
    importPreview?.rows.filter((row) =>
      row.errors.some((error) => error.toLowerCase().includes("sku already exists"))
    ).length ?? 0;
  const canConfirmImport =
    !!importPreview &&
    !!importCsv &&
    importRows.length > 0 &&
    (importMode === "create_only"
      ? importPreview.invalid_rows === 0
      : importPreview.rows.every(
          (row) =>
            row.errors.length === 0 ||
            row.errors.every((error) => error.toLowerCase().includes("sku already exists"))
        ));

  const columns = useMemo<DataViewColumnDef<InventoryProductListRow>[]>(
    () => [
      {
        key: "name",
        header: "Product",
        accessor: (row) => {
          return (
            <div className="min-w-0 py-2">
              <div className="flex min-w-0 items-center gap-3">
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded border bg-muted">
                  {row.thumbnail_url ? (
                    <Image
                      src={row.thumbnail_url}
                      alt=""
                      width={36}
                      height={36}
                      unoptimized
                      className="h-full w-full rounded object-cover"
                    />
                  ) : (
                    <PackagePlus className="h-4 w-4 text-muted-foreground" />
                  )}
                </div>
                <div className="min-w-0">
                  <div className="truncate font-medium">{row.name}</div>
                  <div className="truncate text-xs text-muted-foreground">
                    {row.is_variant_row && row.parent_product_name
                      ? `${row.parent_product_name} · ${row.sku}`
                      : row.variant_count > 1
                        ? `${row.variant_count} variants`
                        : row.sku}
                  </div>
                </div>
              </div>
            </div>
          );
        },
        sortable: true,
        defaultVisible: true,
      },
      {
        key: "product_type",
        header: "Type",
        accessor: (row) => <span className="capitalize">{row.product_type.replace("_", " ")}</span>,
        sortable: true,
        defaultVisible: true,
      },
      {
        key: "status",
        header: "Status",
        accessor: (row) => (
          <Badge variant={statusVariant[row.status] ?? "outline"}>{row.status}</Badge>
        ),
        sortable: true,
        defaultVisible: true,
      },
      {
        key: "on_hand_quantity",
        header: "On hand",
        accessor: (row) => (
          <span className="tabular-nums">
            {row.on_hand_quantity} {row.unit_code}
          </span>
        ),
        sortable: true,
        defaultVisible: true,
      },
      {
        key: "available_quantity",
        header: "Available",
        accessor: (row) => (
          <span className="tabular-nums">
            {row.available_quantity} {row.unit_code}
          </span>
        ),
        sortable: true,
        defaultVisible: true,
      },
      {
        key: "updated_at",
        header: "Updated",
        accessor: (row) => (
          <span className="text-xs text-muted-foreground">
            {new Date(row.updated_at).toLocaleString()}
          </span>
        ),
        sortable: true,
        defaultVisible: true,
      },
      ...customFields.map<DataViewColumnDef<InventoryProductListRow>>((field) => ({
        key: `custom_field:${field.id}`,
        header: field.name,
        accessor: (row) => (
          <span className="text-sm text-muted-foreground">
            {row.custom_field_values[field.id] || "-"}
          </span>
        ),
        defaultVisible: false,
      })),
    ],
    [customFields]
  );

  const filters = useMemo<DataViewFilterDef[]>(
    () => [
      {
        type: "select",
        key: "product_type",
        label: "Type",
        options: ["stocked", "consumable", "service", "serialized", "lot_tracked", "bundle"].map(
          (value) => ({ label: value.replace("_", " "), value })
        ),
      },
      {
        type: "select",
        key: "status",
        label: "Status",
        options: ["active", "archived", "discontinued"].map((value) => ({ label: value, value })),
      },
      {
        type: "boolean",
        key: "is_variant",
        label: "Is variant",
        isVisible: (filters) => filters.__group_variants === false,
      },
      ...customFields.map<DataViewFilterDef>((field) => ({
        type: "text",
        key: `custom_field:${field.id}`,
        label: field.name,
      })),
    ],
    [customFields]
  );

  return (
    <div
      className={cn(
        "flex min-h-0 flex-col",
        importOnly ? "flex-1 overflow-hidden" : "h-full gap-4"
      )}
    >
      {canImportProducts ? (
        <input
          ref={fileInputRef}
          type="file"
          accept=".csv,.tsv,.xlsx,.xls,text/csv,text/tab-separated-values,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.ms-excel"
          className="hidden"
          onChange={(event) => {
            const file = event.target.files?.[0];
            event.currentTarget.value = "";
            if (!file) return;
            handleImportFile(file);
          }}
        />
      ) : null}
      {!importOnly ? (
        <div className="flex items-center justify-between gap-3 border-b pb-4">
          <div />
          <div className="flex flex-wrap items-center gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={async () => {
                const result = await exportInventoryProductsCsvAction();
                if (!result.success || !("data" in result)) {
                  setImportMessage("error" in result ? result.error : "Export failed");
                  return;
                }
                const blob = new Blob([result.data.csv], { type: "text/csv;charset=utf-8" });
                const url = URL.createObjectURL(blob);
                const anchor = document.createElement("a");
                anchor.href = url;
                anchor.download = result.data.file_name;
                anchor.click();
                URL.revokeObjectURL(url);
              }}
            >
              <Download className="mr-2 h-4 w-4" />
              Export CSV
            </Button>
            {canImportProducts ? (
              <Button asChild variant="outline">
                <Link href="/dashboard/warehouse/items/import">
                  <Upload className="mr-2 h-4 w-4" />
                  Import file
                </Link>
              </Button>
            ) : null}
            {canManageProducts ? (
              <>
                <Button asChild variant="outline">
                  <Link href={"/dashboard/warehouse/items/custom-fields" as any}>
                    Custom fields
                  </Link>
                </Button>
                <Button asChild>
                  <Link href="/dashboard/warehouse/items/new">
                    <PackagePlus className="mr-2 h-4 w-4" />
                    Create
                  </Link>
                </Button>
              </>
            ) : null}
          </div>
        </div>
      ) : null}
      {importMessage ? (
        <div className="shrink-0 rounded-md border bg-muted/30 px-3 py-2 text-sm text-muted-foreground">
          {importMessage}
        </div>
      ) : null}
      {importWizardOpen ? (
        <div
          className={cn(
            "bg-background",
            importOnly ? "flex min-h-0 flex-1 flex-col" : "rounded-md border"
          )}
        >
          <div className="relative flex shrink-0 items-start justify-center gap-3 border-b bg-background px-5 py-4">
            <div className="min-w-0 text-center">
              <h2 className="text-xl font-semibold">
                {importStep === 1
                  ? "Items - Select File"
                  : importStep === 2
                    ? "Map Fields"
                    : "Preview"}
              </h2>
              <ImportStepper step={importStep} />
            </div>
            {!importOnly ? (
              <button
                type="button"
                className="absolute right-5 top-4 grid h-8 w-8 place-items-center rounded hover:bg-muted"
                aria-label="Close import"
                onClick={cancelImport}
              >
                <X className="h-4 w-4" />
              </button>
            ) : null}
          </div>

          <div className={cn(importOnly && "min-h-0 flex-1 overflow-auto")}>
            {importStep === 1 ? (
              <div className="mx-auto grid max-w-4xl gap-6 px-5 py-6">
                <button
                  type="button"
                  className={cn(
                    "grid min-h-56 place-items-center rounded-md border border-dashed px-6 py-8 text-center transition-colors hover:bg-muted/40",
                    rawImportCsv ? "border-primary/70" : "border-border"
                  )}
                  onClick={() => fileInputRef.current?.click()}
                  onDragOver={(event) => event.preventDefault()}
                  onDrop={(event) => {
                    event.preventDefault();
                    const file = event.dataTransfer.files?.[0];
                    if (file) handleImportFile(file);
                  }}
                >
                  <span className="grid gap-3">
                    <FileText className="mx-auto h-12 w-12 text-primary" />
                    <span className="font-medium">
                      {importFileName ?? "Drop your CSV or Excel file here"}
                    </span>
                    <span className="text-sm text-muted-foreground">
                      Maximum file size: 25 MB. File format: CSV, TSV, XLS, or XLSX.
                    </span>
                    <span className="text-sm text-primary">
                      {importFileName ? "Replace file" : "Browse file"}
                    </span>
                  </span>
                </button>

                {importFileName ? (
                  <Button
                    type="button"
                    variant="ghost"
                    className="w-fit text-destructive hover:text-destructive"
                    onClick={() => {
                      setImportFileName(null);
                      setRawImportCsv(null);
                      setImportHeaders([]);
                      setImportRows([]);
                      setImportPreview(null);
                      setImportCsv(null);
                      setColumnMapping(autoMapHeaders([]));
                    }}
                  >
                    <Trash2 className="mr-2 h-4 w-4" />
                    Remove file
                  </Button>
                ) : null}

                <p className="text-sm text-muted-foreground">
                  Download a{" "}
                  <button
                    type="button"
                    className="text-primary underline-offset-4 hover:underline"
                    onClick={() => downloadSampleImportFile("csv")}
                  >
                    sample csv file
                  </button>{" "}
                  or{" "}
                  <button
                    type="button"
                    className="text-primary underline-offset-4 hover:underline"
                    onClick={() => downloadSampleImportFile("xlsx")}
                  >
                    sample xls file
                  </button>{" "}
                  and compare it to your import file before continuing.
                </p>

                <div className="grid gap-4 rounded-md border bg-muted/20 p-4">
                  <div className="grid gap-3 md:grid-cols-[220px_1fr] md:items-start">
                    <p className="text-sm font-medium text-muted-foreground">Item structure</p>
                    <div className="grid gap-3 sm:grid-cols-2">
                      <ImportRadioCard
                        checked={importStructure === "simple"}
                        title="Simple items"
                        description="Each row becomes one item. Variant fields stay hidden."
                        onClick={() => {
                          setImportStructure("simple");
                          setColumnMapping((mapping) => ({
                            ...mapping,
                            product_sku: mapping.product_sku || mapping.variant_sku,
                          }));
                          setCustomFieldMappings((current) =>
                            current.filter((mapping) => {
                              const field = customFieldOptions.find(
                                (item) => item.id === mapping.field_id
                              );
                              return field?.entity_type === "product";
                            })
                          );
                          setImportRows([]);
                          setImportPreview(null);
                          setImportCsv(null);
                        }}
                      />
                      <ImportRadioCard
                        checked={importStructure === "variants"}
                        title="Items with variants"
                        description="Rows can share a product and import separate variant SKUs."
                        onClick={() => {
                          setImportStructure("variants");
                          setColumnMapping((mapping) =>
                            mapping.product_sku && mapping.product_sku === mapping.variant_sku
                              ? { ...mapping, product_sku: "" }
                              : mapping
                          );
                          setImportRows([]);
                          setImportPreview(null);
                          setImportCsv(null);
                        }}
                      />
                    </div>
                  </div>

                  <div className="grid gap-3 md:grid-cols-[220px_1fr] md:items-start">
                    <p className="text-sm font-medium text-muted-foreground">Duplicate handling</p>
                    <div className="grid gap-3">
                      <label className="flex gap-3">
                        <input
                          type="radio"
                          checked={importMode === "skip_existing"}
                          onChange={() => setImportMode("skip_existing")}
                        />
                        <span>
                          <span className="block text-sm font-medium">Skip duplicate SKUs</span>
                          <span className="block text-sm text-muted-foreground">
                            Existing items stay unchanged and duplicate rows are skipped.
                          </span>
                        </span>
                      </label>
                      <label className="flex gap-3">
                        <input
                          type="radio"
                          checked={importMode === "create_only"}
                          onChange={() => setImportMode("create_only")}
                        />
                        <span>
                          <span className="block text-sm font-medium">Stop on duplicate SKUs</span>
                          <span className="block text-sm text-muted-foreground">
                            Duplicates are reported during validation before import.
                          </span>
                        </span>
                      </label>
                    </div>
                  </div>

                  <label className="grid gap-1 md:grid-cols-[220px_1fr] md:items-center">
                    <span className="text-sm font-medium text-muted-foreground">
                      Character encoding
                    </span>
                    <select
                      value="utf-8"
                      className="h-10 rounded-md border border-input bg-background px-3 pr-10 text-sm"
                      disabled
                      onChange={() => undefined}
                    >
                      <option value="utf-8">UTF-8 (Unicode)</option>
                    </select>
                  </label>

                  <div className="grid gap-2 md:pl-[220px]">
                    <label className="flex items-center gap-2 text-sm">
                      <input type="checkbox" checked readOnly />
                      Execute validation rules on the imported items
                    </label>
                    <label className="flex items-center gap-2 text-sm">
                      <input type="checkbox" checked readOnly />
                      Execute workflow rules on the imported items
                    </label>
                  </div>
                </div>

                <div className="rounded-md bg-muted/40 p-4 text-sm">
                  <p className="mb-2 font-medium">Page Tips</p>
                  <ul className="list-disc space-y-1 pl-5 text-muted-foreground">
                    <li>Use the first row for column headers so Ambra can auto-map fields.</li>
                    <li>Simple item imports do not require variant columns.</li>
                    <li>You can edit values in the final preview before importing.</li>
                  </ul>
                </div>

                <div className="flex justify-between border-t pt-4">
                  <Button type="button" variant="outline" onClick={cancelImport}>
                    Cancel
                  </Button>
                  <Button
                    type="button"
                    disabled={!rawImportCsv || isImportPending}
                    onClick={() => setImportStep(2)}
                  >
                    Next
                    <ChevronRight className="ml-2 h-4 w-4" />
                  </Button>
                </div>
              </div>
            ) : null}

            {importStep === 2 ? (
              <div className="mx-auto grid w-full max-w-7xl gap-5 px-5 py-6">
                <p className="text-sm">
                  Your selected file: <span className="font-medium">{importFileName}</span>
                </p>
                <div className="rounded-md border border-blue-200 bg-blue-50 px-4 py-3 text-sm text-blue-900 dark:border-blue-500/30 dark:bg-blue-500/10 dark:text-blue-100">
                  The best match to each field on the selected file has been auto-selected.
                </div>
                <div className="rounded-md bg-muted/40 p-4">
                  <div className="flex items-center justify-between">
                    <p className="font-medium">Default Data Formats</p>
                    <Button type="button" variant="ghost" size="sm" disabled>
                      <Edit className="mr-2 h-4 w-4" />
                      Edit
                    </Button>
                  </div>
                  <p className="mt-4 text-xs text-muted-foreground">Decimal Format</p>
                  <p className="text-sm">1234567.89</p>
                </div>

                <div>
                  <h3 className="mb-3 text-lg font-medium">Item Details</h3>
                  <div className="overflow-hidden rounded-md border">
                    <div className="hidden gap-4 bg-muted px-4 py-3 text-xs font-semibold uppercase text-muted-foreground lg:grid lg:grid-cols-[180px_minmax(320px,1fr)_minmax(320px,1fr)]">
                      <span>Ambra field</span>
                      <span>Imported file headers</span>
                      <span>Options</span>
                    </div>
                    {importMappingFields.map((field) => {
                      const isSkuField = field.key === "product_sku" || field.key === "variant_sku";

                      if (field.key === "unit_code") {
                        return (
                          <div
                            key={field.key}
                            className="grid items-start gap-4 border-t px-4 py-4 lg:grid-cols-[180px_minmax(0,1fr)]"
                          >
                            <span className="text-sm text-destructive lg:pt-2">Unit*</span>
                            <div className="grid min-w-0 gap-3">
                              <div className="inline-flex w-fit overflow-hidden rounded-md border">
                                <button
                                  type="button"
                                  className={cn(
                                    "h-9 px-3 text-sm transition-colors",
                                    unitAssignmentMode === "column"
                                      ? "bg-primary text-primary-foreground"
                                      : "bg-background hover:bg-muted"
                                  )}
                                  onClick={() => {
                                    setUnitAssignmentMode("column");
                                    setFallbackUnitCode("");
                                    setShowQuickAddUnit(false);
                                    setImportRows([]);
                                    setImportPreview(null);
                                    setImportCsv(null);
                                  }}
                                >
                                  Map column
                                </button>
                                <button
                                  type="button"
                                  className={cn(
                                    "h-9 border-l px-3 text-sm transition-colors",
                                    unitAssignmentMode === "fallback"
                                      ? "bg-primary text-primary-foreground"
                                      : "bg-background hover:bg-muted"
                                  )}
                                  onClick={() => {
                                    setUnitAssignmentMode("fallback");
                                    setColumnMapping((mapping) => ({ ...mapping, unit_code: "" }));
                                    setImportRows([]);
                                    setImportPreview(null);
                                    setImportCsv(null);
                                  }}
                                >
                                  Use one unit
                                </button>
                              </div>

                              {unitAssignmentMode === "column" ? (
                                <label className="grid max-w-2xl gap-1">
                                  <span className="text-xs font-medium uppercase text-muted-foreground">
                                    Unit column
                                  </span>
                                  <select
                                    value={columnMapping.unit_code}
                                    className="h-10 w-full rounded-md border border-input bg-background px-3 pr-10 text-sm"
                                    onChange={(event) => {
                                      setColumnMapping((mapping) => ({
                                        ...mapping,
                                        unit_code: event.target.value,
                                      }));
                                      setImportRows([]);
                                      setImportPreview(null);
                                      setImportCsv(null);
                                    }}
                                  >
                                    <option value="">Select unit column</option>
                                    {importHeaders.map((header) => (
                                      <option key={header} value={header}>
                                        {header}
                                      </option>
                                    ))}
                                  </select>
                                </label>
                              ) : null}

                              {unitAssignmentMode === "fallback" ? (
                                <div className="grid max-w-3xl gap-2">
                                  <div className="grid items-end gap-2 sm:grid-cols-[minmax(220px,1fr)_auto]">
                                    <label className="grid gap-1">
                                      <span className="text-xs font-medium uppercase text-muted-foreground">
                                        Unit for all rows
                                      </span>
                                      <select
                                        value={fallbackUnitCode}
                                        className="h-10 rounded-md border border-input bg-background px-3 pr-10 text-sm"
                                        onChange={(event) => {
                                          setFallbackUnitCode(event.target.value);
                                          setImportRows([]);
                                          setImportPreview(null);
                                          setImportCsv(null);
                                        }}
                                      >
                                        <option value="">Select unit</option>
                                        {unitOptions.map((unit) => (
                                          <option key={unit.id} value={unit.code}>
                                            {unit.code} · {unit.name}
                                          </option>
                                        ))}
                                      </select>
                                    </label>
                                    {canManageProducts ? (
                                      <Button
                                        type="button"
                                        variant="outline"
                                        size="sm"
                                        className="h-10"
                                        onClick={() => setShowQuickAddUnit((current) => !current)}
                                      >
                                        Add unit
                                      </Button>
                                    ) : null}
                                  </div>
                                  {showQuickAddUnit ? (
                                    <div className="grid gap-2 rounded-md border bg-muted/20 p-3 sm:grid-cols-[1fr_1fr_140px_auto]">
                                      <input
                                        value={unitDraft.code}
                                        placeholder="Code"
                                        className="h-10 rounded-md border border-input bg-background px-3 text-sm"
                                        onChange={(event) =>
                                          setUnitDraft((draft) => ({
                                            ...draft,
                                            code: event.target.value,
                                          }))
                                        }
                                      />
                                      <input
                                        value={unitDraft.name}
                                        placeholder="Unit name"
                                        className="h-10 rounded-md border border-input bg-background px-3 text-sm"
                                        onChange={(event) =>
                                          setUnitDraft((draft) => ({
                                            ...draft,
                                            name: event.target.value,
                                          }))
                                        }
                                      />
                                      <select
                                        value={unitDraft.kind}
                                        className="h-10 rounded-md border border-input bg-background px-3 pr-10 text-sm"
                                        onChange={(event) =>
                                          setUnitDraft((draft) => ({
                                            ...draft,
                                            kind: event.target.value,
                                          }))
                                        }
                                      >
                                        {[
                                          "count",
                                          "weight",
                                          "length",
                                          "volume",
                                          "time",
                                          "area",
                                          "other",
                                        ].map((kind) => (
                                          <option key={kind} value={kind}>
                                            {kind}
                                          </option>
                                        ))}
                                      </select>
                                      <Button
                                        type="button"
                                        size="sm"
                                        className="h-10"
                                        onClick={createUnitFromDraft}
                                      >
                                        Add
                                      </Button>
                                    </div>
                                  ) : null}
                                </div>
                              ) : null}
                            </div>
                          </div>
                        );
                      }

                      return (
                        <div key={field.key} className="border-t">
                          <div className="grid items-start gap-4 px-4 py-4 lg:grid-cols-[180px_minmax(320px,1fr)_minmax(320px,1fr)]">
                            <span
                              className={cn(
                                "text-sm lg:pt-2",
                                isImportFieldRequired(field.key, importStructure) &&
                                  "text-destructive"
                              )}
                            >
                              {field.key === "product_sku" && importStructure === "simple"
                                ? "SKU"
                                : field.label}
                              {isImportFieldRequired(field.key, importStructure) ? "*" : ""}
                            </span>
                            <label className="grid gap-1">
                              <span className="text-xs font-medium uppercase text-muted-foreground lg:hidden">
                                Imported file headers
                              </span>
                              <select
                                value={columnMapping[field.key]}
                                className="h-10 w-full rounded-md border border-input bg-background px-3 pr-10 text-sm"
                                onChange={(event) => {
                                  setColumnMapping((mapping) => ({
                                    ...mapping,
                                    [field.key]: event.target.value,
                                  }));
                                  setImportRows([]);
                                  setImportPreview(null);
                                  setImportCsv(null);
                                }}
                              >
                                <option value="">Select</option>
                                {importHeaders.map((header) => (
                                  <option key={header} value={header}>
                                    {header}
                                  </option>
                                ))}
                              </select>
                            </label>
                            <div className="min-w-0">
                              {isSkuField ? null : renderMappingOptions(field.key)}
                            </div>
                          </div>
                          {isSkuField ? (
                            <div className="grid gap-2 px-4 pb-4 lg:grid-cols-[180px_minmax(0,1fr)]">
                              <span className="text-xs font-medium uppercase text-muted-foreground">
                                SKU normalization
                              </span>
                              <div className="min-w-0">{renderMappingOptions(field.key)}</div>
                            </div>
                          ) : null}
                        </div>
                      );
                    })}
                  </div>
                </div>

                <div className="rounded-md border">
                  <div className="flex items-center justify-between gap-3 bg-muted px-4 py-3">
                    <div>
                      <h3 className="font-medium">Custom fields</h3>
                      <p className="text-xs text-muted-foreground">
                        Map optional product or variant fields from the import file.
                      </p>
                    </div>
                    {canManageProducts ? (
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => setShowQuickAddCustomField((current) => !current)}
                      >
                        Add preset
                      </Button>
                    ) : null}
                  </div>
                  {showQuickAddCustomField ? (
                    <div className="grid gap-2 border-t px-4 py-3 md:grid-cols-[1fr_160px_160px_auto]">
                      <input
                        value={customFieldDraft.name}
                        placeholder="Custom field name"
                        className="h-10 rounded-md border border-input bg-background px-3 text-sm"
                        onChange={(event) =>
                          setCustomFieldDraft((draft) => ({ ...draft, name: event.target.value }))
                        }
                      />
                      <select
                        value={customFieldDraft.entityType}
                        className="h-10 rounded-md border border-input bg-background px-3 pr-10 text-sm"
                        onChange={(event) =>
                          setCustomFieldDraft((draft) => ({
                            ...draft,
                            entityType: event.target.value as "product" | "variant",
                          }))
                        }
                      >
                        <option value="product">Product</option>
                        <option value="variant">Variant</option>
                      </select>
                      <select
                        value={customFieldDraft.fieldType}
                        className="h-10 rounded-md border border-input bg-background px-3 pr-10 text-sm"
                        onChange={(event) =>
                          setCustomFieldDraft((draft) => ({
                            ...draft,
                            fieldType: event.target
                              .value as InventoryCustomFieldDefinition["field_type"],
                          }))
                        }
                      >
                        {["text", "number", "date", "boolean", "select", "multi_select"].map(
                          (type) => (
                            <option key={type} value={type}>
                              {type.replace("_", " ")}
                            </option>
                          )
                        )}
                      </select>
                      <Button
                        type="button"
                        size="sm"
                        className="h-10"
                        onClick={createCustomFieldFromDraft}
                      >
                        Add
                      </Button>
                    </div>
                  ) : null}
                  <div className="grid gap-2 border-t p-4">
                    {customFieldMappings.length === 0 ? (
                      <p className="text-sm text-muted-foreground">
                        No custom fields mapped for this import.
                      </p>
                    ) : null}
                    {customFieldMappings.map((mapping) => (
                      <div
                        key={mapping.id}
                        className="grid gap-2 md:grid-cols-[minmax(220px,1fr)_minmax(220px,1fr)_auto]"
                      >
                        <select
                          value={mapping.field_id}
                          className="h-10 rounded-md border border-input bg-background px-3 pr-10 text-sm"
                          onChange={(event) =>
                            setCustomFieldMappings((current) =>
                              current.map((item) =>
                                item.id === mapping.id
                                  ? { ...item, field_id: event.target.value }
                                  : item
                              )
                            )
                          }
                        >
                          <option value="">Select custom field</option>
                          {customFieldOptions
                            .filter((field) =>
                              importStructure === "variants"
                                ? true
                                : field.entity_type === "product"
                            )
                            .map((field) => (
                              <option key={field.id} value={field.id}>
                                {field.name} · {field.entity_type}
                              </option>
                            ))}
                        </select>
                        <select
                          value={mapping.source}
                          className="h-10 rounded-md border border-input bg-background px-3 pr-10 text-sm"
                          onChange={(event) =>
                            setCustomFieldMappings((current) =>
                              current.map((item) =>
                                item.id === mapping.id
                                  ? { ...item, source: event.target.value }
                                  : item
                              )
                            )
                          }
                        >
                          <option value="">Select import column</option>
                          {importHeaders.map((header) => (
                            <option key={header} value={header}>
                              {header}
                            </option>
                          ))}
                        </select>
                        <button
                          type="button"
                          className="grid h-10 w-10 place-items-center rounded text-destructive hover:bg-destructive/10"
                          aria-label="Remove custom field mapping"
                          onClick={() =>
                            setCustomFieldMappings((current) =>
                              current.filter((item) => item.id !== mapping.id)
                            )
                          }
                        >
                          <X className="h-4 w-4" />
                        </button>
                      </div>
                    ))}
                    <Button
                      type="button"
                      variant="outline"
                      className="w-fit"
                      onClick={() =>
                        setCustomFieldMappings((current) => [
                          ...current,
                          {
                            id: crypto.randomUUID(),
                            field_id:
                              customFieldOptions.find((field) => field.entity_type === "product")
                                ?.id ?? "",
                            source: "",
                          },
                        ])
                      }
                    >
                      Add custom field mapping
                    </Button>
                  </div>
                </div>

                {missingRequiredMappings.length > 0 ? (
                  <div className="rounded-md border border-destructive/40 bg-destructive/10 px-4 py-3 text-sm text-destructive">
                    Required mappings missing:{" "}
                    {missingRequiredMappings.map((field) => field.label).join(", ")}
                  </div>
                ) : null}

                <div className="flex justify-between border-t pt-4">
                  <Button type="button" variant="outline" onClick={() => setImportStep(1)}>
                    Previous
                  </Button>
                  <div className="flex gap-2">
                    <Button type="button" variant="outline" onClick={cancelImport}>
                      Cancel
                    </Button>
                    <Button
                      type="button"
                      disabled={missingRequiredMappings.length > 0 || isImportPending}
                      onClick={() => {
                        const rows = buildImportRows();
                        if (rows.length === 0) {
                          setImportMessage("No import rows were found in the selected file.");
                          return;
                        }
                        previewImportRows(rows);
                        setImportStep(3);
                      }}
                    >
                      Next
                      <ChevronRight className="ml-2 h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </div>
            ) : null}

            {importStep === 3 ? (
              <div className="grid gap-5 px-5 py-6">
                <div className="mx-auto grid w-full max-w-4xl gap-3">
                  <div className="rounded-md border border-blue-200 bg-blue-50 px-4 py-3 text-sm text-blue-900 dark:border-blue-500/30 dark:bg-blue-500/10 dark:text-blue-100">
                    {importPreview
                      ? importPreview.invalid_rows > 0
                        ? "Some rows need attention before import."
                        : "All items in your file are ready to be imported."
                      : "Review your rows and refresh validation before importing."}
                  </div>
                  <ImportSummaryRow
                    label="Items that are ready to be imported"
                    value={importPreview?.valid_rows ?? 0}
                    good
                  />
                  <ImportSummaryRow
                    label="Records skipped"
                    value={importSkippedRows}
                    muted={importSkippedRows === 0}
                  />
                  <ImportSummaryRow
                    label="Rows with errors"
                    value={importPreview?.invalid_rows ?? 0}
                    muted={(importPreview?.invalid_rows ?? 0) === 0}
                  />
                </div>

                <div className="overflow-hidden rounded-md border bg-background">
                  <div className="flex flex-wrap items-center justify-between gap-3 border-b px-3 py-2">
                    <div>
                      <p className="font-medium">Final item changes</p>
                      <p className="text-xs text-muted-foreground">
                        Edit values before import. Refresh validation after changes.
                      </p>
                    </div>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      disabled={isImportPending || importRows.length === 0}
                      onClick={() => previewImportRows(importRows)}
                    >
                      Refresh validation
                    </Button>
                  </div>
                  <div className="overflow-auto">
                    <table className="min-w-[1900px] text-sm">
                      <thead className="bg-muted text-xs uppercase text-muted-foreground">
                        <tr>
                          <th className="w-16 px-3 py-2 text-left">Row</th>
                          {editableImportFields.map((field) => (
                            <th key={field.key} className="px-3 py-2 text-left">
                              <span className="flex items-center gap-1.5">
                                {field.label}
                                {field.copy ? (
                                  <ImportCopyButton
                                    label={field.label}
                                    onClick={() => {
                                      const source =
                                        importRows.find((row) => row[field.key])?.[field.key] ?? "";
                                      updateImportRows(
                                        importRows.map((row) => ({ ...row, [field.key]: source }))
                                      );
                                    }}
                                  />
                                ) : null}
                              </span>
                            </th>
                          ))}
                          {mappedCustomFields.map((field) => (
                            <th key={field.id} className="px-3 py-2 text-left">
                              <span className="flex items-center gap-1.5">
                                {field.name}
                                <span className="rounded bg-background px-1.5 py-0.5 text-[10px] capitalize text-muted-foreground">
                                  {field.entity_type}
                                </span>
                              </span>
                            </th>
                          ))}
                          <th className="min-w-56 px-3 py-2 text-left">Status</th>
                          <th className="w-12 px-3 py-2" />
                        </tr>
                      </thead>
                      <tbody>
                        {importRows.map((row, index) => {
                          const previewRow = importPreview?.rows[index];
                          return (
                            <tr key={row.id} className="border-t">
                              <td className="px-3 py-2 text-muted-foreground">{row.source_row}</td>
                              {editableImportFields.map((field) => (
                                <td key={field.key} className="px-3 py-2">
                                  {renderImportCell(row, field.key)}
                                </td>
                              ))}
                              {mappedCustomFields.map((field) => (
                                <td key={field.id} className="px-3 py-2">
                                  {renderCustomImportCell(row, field)}
                                </td>
                              ))}
                              <td className="px-3 py-2">
                                {previewRow?.errors.length ? (
                                  <span className="text-xs text-destructive">
                                    {previewRow.errors.join(", ")}
                                  </span>
                                ) : previewRow ? (
                                  <span className="text-xs text-emerald-600">Ready</span>
                                ) : (
                                  <span className="text-xs text-muted-foreground">
                                    Needs validation
                                  </span>
                                )}
                              </td>
                              <td className="px-3 py-2 text-right">
                                <button
                                  type="button"
                                  className="grid h-8 w-8 place-items-center rounded text-destructive hover:bg-destructive/10"
                                  aria-label="Remove row"
                                  onClick={() =>
                                    updateImportRows(
                                      importRows.filter((current) => current.id !== row.id)
                                    )
                                  }
                                >
                                  <X className="h-4 w-4" />
                                </button>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>

                <div className="flex justify-between border-t pt-4">
                  <Button type="button" variant="outline" onClick={() => setImportStep(2)}>
                    Previous
                  </Button>
                  <div className="flex gap-2">
                    <Button type="button" variant="outline" onClick={cancelImport}>
                      Cancel
                    </Button>
                    <Button
                      type="button"
                      disabled={isImportPending || !canConfirmImport}
                      onClick={confirmImport}
                    >
                      Import
                    </Button>
                  </div>
                </div>
              </div>
            ) : null}
          </div>
        </div>
      ) : null}

      {!importOnly ? (
        <DataView<InventoryProductListRow, InventoryProductDetail>
          entity="inventory-products"
          columns={columns}
          filters={filters}
          initialData={initialData}
          queryKey={["inventory-products"]}
          listFetcher={listFetcher}
          detailFetcher={detailFetcher}
          getRowId={(row) => row.row_id}
          renderCompactItem={(row) => <ProductSidebarItem product={row} />}
          renderExpandedRow={(row) =>
            !row.is_variant_row && row.variant_count > 1 && expandedProductIds[row.id] ? (
              <ExpandedVariantRows product={row} />
            ) : null
          }
          renderRowControl={(row) => {
            if (row.is_variant_row || row.variant_count <= 1) return null;
            const isExpanded = !!expandedProductIds[row.id];
            return (
              <button
                type="button"
                className="grid h-8 w-8 place-items-center rounded hover:bg-muted"
                aria-label={isExpanded ? "Hide variants" : "Show variants"}
                aria-expanded={isExpanded}
                onClick={() => toggleExpanded(row.id)}
              >
                {isExpanded ? (
                  <ChevronDown className="h-4 w-4 text-muted-foreground" />
                ) : (
                  <ChevronRight className="h-4 w-4 text-muted-foreground" />
                )}
              </button>
            );
          }}
          renderToolbarControls={() => <VariantGroupingControl />}
          renderDetail={(detail) => (
            <ProductDetailPanel
              detail={detail}
              customFields={customFields}
              canManageProducts={canManageProducts}
            />
          )}
          className="min-h-0 flex-1"
        />
      ) : null}
    </div>
  );
}

function ImportStepper({ step }: { step: ImportStep }) {
  const steps: Array<{ id: ImportStep; label: string }> = [
    { id: 1, label: "Configure" },
    { id: 2, label: "Map Fields" },
    { id: 3, label: "Preview" },
  ];

  return (
    <div className="mt-4 flex flex-wrap items-center justify-center gap-3 text-sm">
      {steps.map((item, index) => {
        const done = step > item.id;
        const active = step === item.id;
        return (
          <span key={item.id} className="flex items-center gap-3">
            <span className="flex items-center gap-2">
              <span
                className={cn(
                  "grid h-7 w-7 place-items-center rounded-full border text-xs font-semibold",
                  done && "border-emerald-600 bg-emerald-600 text-white",
                  active && "border-primary bg-primary text-primary-foreground",
                  !done && !active && "border-muted-foreground/30 text-muted-foreground"
                )}
              >
                {done ? <Check className="h-4 w-4" /> : item.id}
              </span>
              <span className={cn(active ? "font-medium" : "text-muted-foreground")}>
                {item.label}
              </span>
            </span>
            {index < steps.length - 1 ? <span className="h-px w-10 bg-border" /> : null}
          </span>
        );
      })}
    </div>
  );
}

function ImportRadioCard({
  checked,
  title,
  description,
  onClick,
}: {
  checked: boolean;
  title: string;
  description: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      className={cn(
        "rounded-md border p-3 text-left transition-colors hover:bg-muted/50",
        checked && "border-primary bg-primary/5"
      )}
      onClick={onClick}
    >
      <span className="flex items-start gap-3">
        <span
          className={cn(
            "mt-0.5 grid h-4 w-4 place-items-center rounded-full border",
            checked && "border-primary"
          )}
        >
          {checked ? <span className="h-2 w-2 rounded-full bg-primary" /> : null}
        </span>
        <span>
          <span className="block text-sm font-medium">{title}</span>
          <span className="mt-1 block text-sm text-muted-foreground">{description}</span>
        </span>
      </span>
    </button>
  );
}

function ImportSummaryRow({
  label,
  value,
  good,
  muted,
}: {
  label: string;
  value: number;
  good?: boolean;
  muted?: boolean;
}) {
  return (
    <div className="flex items-center justify-between border-b py-3 text-sm">
      <span className={cn("font-medium", muted && "text-muted-foreground")}>{label}</span>
      <span className={cn(good && "text-emerald-600", muted && "text-muted-foreground")}>
        {value}
      </span>
    </div>
  );
}

function ImportCopyButton({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <button
      type="button"
      className="grid h-6 w-6 place-items-center rounded hover:bg-background"
      aria-label={`Copy first ${label} value to all rows`}
      title={`Copy first ${label} value to all rows`}
      onClick={onClick}
    >
      <Copy className="h-3.5 w-3.5" />
    </button>
  );
}

function ProductSidebarItem({ product }: { product: InventoryProductListRow }) {
  return (
    <span className="flex min-w-0 items-center gap-3">
      <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded border bg-muted">
        {product.thumbnail_url ? (
          <Image
            src={product.thumbnail_url}
            alt=""
            width={32}
            height={32}
            unoptimized
            className="h-full w-full rounded object-cover"
          />
        ) : (
          <PackagePlus className="h-4 w-4 text-muted-foreground" />
        )}
      </span>
      <span className="min-w-0">
        <span className="block truncate font-medium">{product.name}</span>
        <span className="block truncate text-xs text-muted-foreground">
          {product.is_variant_row && product.parent_product_name
            ? `${product.parent_product_name} · ${product.sku}`
            : product.variant_count > 1
              ? `${product.variant_count} variants`
              : product.sku}
        </span>
      </span>
    </span>
  );
}

function VariantGroupingControl() {
  const { urlState } = useDataViewUrl();
  const grouped = urlState.filters.__group_variants !== false;

  return (
    <label className="flex h-8 shrink-0 items-center gap-2 rounded-md border px-2 text-xs">
      <Switch
        checked={grouped}
        onCheckedChange={(checked) => {
          const next = { ...urlState.filters };
          if (checked) {
            delete next.__group_variants;
            delete next.is_variant;
          } else {
            next.__group_variants = false;
          }
          urlState.setFilters(next);
        }}
        className="h-4 w-7 [&>span]:h-3 [&>span]:w-3 [&>span]:data-[state=checked]:translate-x-3"
        aria-label="Group variants"
      />
      <span>Group variants</span>
    </label>
  );
}

function ExpandedVariantRows({ product }: { product: InventoryProductListRow }) {
  return (
    <div className="border-t bg-muted/20 px-14 py-3">
      <div className="overflow-hidden rounded-md border bg-background">
        <div className="grid grid-cols-[48px_minmax(220px,1fr)_160px_180px_120px_120px_120px] gap-3 border-b bg-muted/40 px-3 py-2 text-xs font-semibold uppercase text-muted-foreground">
          <span>Image</span>
          <span>Variant</span>
          <span>SKU</span>
          <span>Attributes</span>
          <span className="text-right">On hand</span>
          <span className="text-right">Available</span>
          <span>Status</span>
        </div>
        {product.variants.map((variant) => (
          <div
            key={variant.id}
            className="grid grid-cols-[48px_minmax(220px,1fr)_160px_180px_120px_120px_120px] items-center gap-3 border-b px-3 py-2 text-sm last:border-b-0"
          >
            <ProductImageThumb src={variant.thumbnail_url} className="h-9 w-9" />
            <span className="truncate font-medium">{variant.name}</span>
            <span className="truncate text-muted-foreground">{variant.sku}</span>
            <VariantOptionSummary variant={variant} />
            <span className="text-right tabular-nums">
              {variant.on_hand_quantity} {product.unit_code}
            </span>
            <span className="text-right tabular-nums">
              {variant.available_quantity} {product.unit_code}
            </span>
            <span>{variant.status}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function ProductDetailPanel({
  detail,
  customFields,
  canManageProducts,
}: {
  detail: InventoryProductDetail;
  customFields: InventoryCustomFieldDefinition[];
  canManageProducts: boolean;
}) {
  const [selectedImageId, setSelectedImageId] = useState<string | null>(null);
  const [expandedVariantIds, setExpandedVariantIds] = useState<Record<string, true>>({});
  const hasVisibleVariants = detail.variant_count > 1;
  const simpleVariant = hasVisibleVariants ? null : detail.variants[0];
  const productImages = detail.images
    .filter((image) => !image.variant_id)
    .sort((a, b) => Number(b.is_primary) - Number(a.is_primary) || a.sort_order - b.sort_order);
  const selectedImage =
    productImages.find((image) => image.id === selectedImageId) ??
    productImages.find((image) => image.is_primary) ??
    productImages[0];
  const selectedImageUrl = imageUrl(selectedImage) ?? detail.thumbnail_url;
  const customFieldRows = customFields
    .map((field) => ({ field, value: detail.custom_field_values[field.id] }))
    .filter((row) => row.value);

  return (
    <div className="space-y-5">
      <section className="grid gap-5 xl:grid-cols-[minmax(220px,300px)_1fr]">
        <div className="space-y-3">
          <div className="grid aspect-square max-h-[300px] place-items-center overflow-hidden rounded-md border bg-muted/30">
            {selectedImageUrl ? (
              <Image
                src={selectedImageUrl}
                alt=""
                width={300}
                height={300}
                unoptimized
                className="h-full w-full object-cover"
              />
            ) : (
              <PackagePlus className="h-10 w-10 text-muted-foreground" />
            )}
          </div>
          {productImages.length > 0 ? (
            <div className="flex flex-wrap gap-2">
              {productImages.map((image) => {
                const url = imageUrl(image);
                if (!url) return null;
                const active = (selectedImage?.id ?? null) === image.id;
                return (
                  <button
                    key={image.id}
                    type="button"
                    className={cn(
                      "h-12 w-12 overflow-hidden rounded border bg-muted",
                      active && "border-primary ring-1 ring-primary"
                    )}
                    onClick={() => setSelectedImageId(image.id)}
                    aria-label="Preview product image"
                  >
                    <Image
                      src={url}
                      alt=""
                      width={48}
                      height={48}
                      unoptimized
                      className="h-full w-full object-cover"
                    />
                  </button>
                );
              })}
            </div>
          ) : null}
        </div>

        <div className="min-w-0 space-y-4">
          <div>
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="min-w-0">
                <h2 className="truncate text-xl font-semibold">{detail.name}</h2>
                <p className="text-sm text-muted-foreground">
                  {hasVisibleVariants ? `${detail.variant_count} variants` : detail.sku || "No SKU"}
                </p>
              </div>
              <Badge variant={statusVariant[detail.status] ?? "outline"}>{detail.status}</Badge>
            </div>
            <p className="mt-3 text-sm text-muted-foreground">
              {detail.description ?? "No description"}
            </p>
            <TagChips tags={detail.tags} className="mt-3" />
          </div>

          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            <DetailFact label="Type" value={detail.product_type.replace("_", " ")} />
            <DetailFact label="Unit" value={detail.unit_code || "-"} />
            <DetailFact label="On hand" value={`${detail.on_hand_quantity} ${detail.unit_code}`} />
            <DetailFact
              label="Available"
              value={`${detail.available_quantity} ${detail.unit_code}`}
            />
            <DetailFact label="Brand" value={detail.brand_name ?? "Not set"} />
            <DetailFact label="Manufacturer" value={detail.manufacturer_name ?? "Not set"} />
            <DetailFact label="Sales account" value={detail.sales_account_code ?? "Not set"} />
            <DetailFact
              label="Purchase account"
              value={detail.purchase_account_code ?? "Not set"}
            />
            <DetailFact label="Tax code" value={detail.tax_code ?? "Not set"} />
            <DetailFact
              label="Tax rate"
              value={detail.tax_rate_percent == null ? "Not set" : `${detail.tax_rate_percent}%`}
            />
            <DetailFact label="Dimensions" value={formatDimensions(detail)} />
            <DetailFact label="Weight" value={formatWeight(detail)} />
            <DetailFact label="Returnable" value={detail.returnable ? "Yes" : "No"} />
          </div>

          {simpleVariant ? (
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
              <DetailFact label="Barcode" value={simpleVariant.barcode ?? "Not set"} />
              <DetailFact label="Purchase" value={formatPrice(simpleVariant, "purchase_price")} />
              <DetailFact label="Sales" value={formatPrice(simpleVariant, "sales_price")} />
              <DetailFact
                label="Reorder point"
                value={
                  simpleVariant.reorder_point == null ? "Not set" : simpleVariant.reorder_point
                }
              />
            </div>
          ) : null}
        </div>
      </section>

      {customFieldRows.length > 0 ? (
        <section className="rounded-md border p-3">
          <p className="mb-3 text-xs font-semibold uppercase text-muted-foreground">
            Custom fields
          </p>
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {customFieldRows.map(({ field, value }) => (
              <DetailFact key={field.id} label={field.name} value={value} />
            ))}
          </div>
        </section>
      ) : null}

      {detail.sales_description || detail.purchase_description ? (
        <section className="grid gap-3 md:grid-cols-2">
          <DescriptionBlock title="Sales description" value={detail.sales_description} />
          <DescriptionBlock title="Purchase description" value={detail.purchase_description} />
        </section>
      ) : null}

      {hasVisibleVariants ? (
        <section>
          <p className="mb-2 text-xs font-semibold uppercase text-muted-foreground">Variants</p>
          <div className="overflow-hidden rounded-md border">
            {detail.variants.map((variant) => {
              const variantImages = detail.images.filter(
                (image) => image.variant_id === variant.id
              );
              const variantCustomFieldRows = customFields
                .filter((field) => field.entity_type === "variant")
                .map((field) => ({ field, value: variant.custom_field_values[field.id] }))
                .filter((row) => row.value);
              const expanded = !!expandedVariantIds[variant.id];
              return (
                <div key={variant.id} className="border-b last:border-b-0">
                  <button
                    type="button"
                    className="grid w-full grid-cols-[44px_1fr_auto] items-center gap-3 px-3 py-2 text-left text-sm hover:bg-muted/50"
                    onClick={() =>
                      setExpandedVariantIds((current) => {
                        const next = { ...current };
                        if (next[variant.id]) delete next[variant.id];
                        else next[variant.id] = true;
                        return next;
                      })
                    }
                    aria-expanded={expanded}
                  >
                    <ProductImageThumb src={variant.thumbnail_url} className="h-9 w-9" />
                    <span className="min-w-0">
                      <span className="block truncate font-medium">{variant.name}</span>
                      <span className="block truncate text-xs text-muted-foreground">
                        {variant.sku}
                      </span>
                      <VariantOptionSummary variant={variant} className="mt-1" />
                    </span>
                    <span className="flex items-center gap-3">
                      <span className="hidden text-right text-xs text-muted-foreground sm:block">
                        {variant.available_quantity} {detail.unit_code} available
                      </span>
                      {expanded ? (
                        <ChevronDown className="h-4 w-4 text-muted-foreground" />
                      ) : (
                        <ChevronRight className="h-4 w-4 text-muted-foreground" />
                      )}
                    </span>
                  </button>
                  {expanded ? (
                    <div className="grid gap-3 border-t bg-muted/20 p-3 md:grid-cols-[minmax(160px,220px)_1fr]">
                      <VariantImageGallery
                        images={variantImages}
                        fallback={variant.thumbnail_url}
                      />
                      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                        <DetailFact
                          label="On hand"
                          value={`${variant.on_hand_quantity} ${detail.unit_code}`}
                        />
                        <DetailFact
                          label="Available"
                          value={`${variant.available_quantity} ${detail.unit_code}`}
                        />
                        <DetailFact
                          label="Reorder point"
                          value={variant.reorder_point == null ? "Not set" : variant.reorder_point}
                        />
                        <DetailFact label="Status" value={variant.status} />
                        <DetailFact label="Barcode" value={variant.barcode ?? "Not set"} />
                        <DetailFact
                          label="Purchase"
                          value={formatPrice(variant, "purchase_price")}
                        />
                        <DetailFact label="Sales" value={formatPrice(variant, "sales_price")} />
                        <DetailFact
                          label="Attributes"
                          value={
                            variant.option_values.length > 0
                              ? variant.option_values
                                  .map((option) => `${option.option_group_name}: ${option.value}`)
                                  .join(", ")
                              : "Not set"
                          }
                        />
                        {variantCustomFieldRows.map(({ field, value }) => (
                          <DetailFact key={field.id} label={field.name} value={value} />
                        ))}
                      </div>
                    </div>
                  ) : null}
                </div>
              );
            })}
          </div>
        </section>
      ) : null}

      <div className="flex gap-2">
        <Button asChild size="sm">
          <Link
            href={{
              pathname: "/dashboard/warehouse/items/[productId]",
              params: { productId: detail.id },
            }}
          >
            Open profile
          </Link>
        </Button>
        {canManageProducts ? (
          <Button asChild size="sm" variant="outline">
            <Link
              href={{
                pathname: "/dashboard/warehouse/items/[productId]/edit",
                params: { productId: detail.id },
              }}
            >
              <Edit className="mr-2 h-4 w-4" />
              Edit
            </Link>
          </Button>
        ) : null}
      </div>
    </div>
  );
}

function ProductImageThumb({ src, className }: { src: string | null; className?: string }) {
  return (
    <span
      className={cn(
        "grid shrink-0 place-items-center overflow-hidden rounded border bg-muted",
        className
      )}
    >
      {src ? (
        <Image
          src={src}
          alt=""
          width={48}
          height={48}
          unoptimized
          className="h-full w-full object-cover"
        />
      ) : (
        <PackagePlus className="h-4 w-4 text-muted-foreground" />
      )}
    </span>
  );
}

function VariantImageGallery({
  images,
  fallback,
}: {
  images: InventoryProductImageRow[];
  fallback: string | null;
}) {
  const urls = images.map(imageUrl).filter((url): url is string => Boolean(url));
  const primary = urls[0] ?? fallback;

  return (
    <div className="space-y-2">
      <div className="grid aspect-square max-h-52 place-items-center overflow-hidden rounded-md border bg-background">
        {primary ? (
          <Image
            src={primary}
            alt=""
            width={220}
            height={220}
            unoptimized
            className="h-full w-full object-cover"
          />
        ) : (
          <PackagePlus className="h-8 w-8 text-muted-foreground" />
        )}
      </div>
      {urls.length > 1 ? (
        <div className="flex flex-wrap gap-1.5">
          {urls.slice(0, 8).map((url) => (
            <Image
              key={url}
              src={url}
              alt=""
              width={36}
              height={36}
              unoptimized
              className="h-9 w-9 rounded border object-cover"
            />
          ))}
        </div>
      ) : null}
    </div>
  );
}

function VariantOptionSummary({
  variant,
  className,
}: {
  variant: InventoryProductVariantListRow;
  className?: string;
}) {
  if (variant.option_values.length === 0) {
    return <span className={cn("text-xs text-muted-foreground", className)}>No attributes</span>;
  }

  return (
    <span className={cn("flex flex-wrap gap-1", className)}>
      {variant.option_values.map((option) => (
        <span
          key={`${variant.id}-${option.option_group_id}`}
          className="rounded border bg-background px-1.5 py-0.5 text-[11px] text-muted-foreground"
        >
          {option.option_group_name}: <span className="text-foreground">{option.value}</span>
        </span>
      ))}
    </span>
  );
}

function DetailFact({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="min-w-0 rounded-md border bg-muted/20 px-3 py-2">
      <p className="text-[11px] font-semibold uppercase text-muted-foreground">{label}</p>
      <div className="mt-1 truncate text-sm">{value}</div>
    </div>
  );
}

function TagChips({ tags, className }: { tags: string[]; className?: string }) {
  if (tags.length === 0) return null;

  return (
    <div className={cn("flex flex-wrap gap-1.5", className)}>
      {tags.map((tag) => (
        <Badge key={tag} variant="secondary" className="rounded-md text-xs">
          {tag}
        </Badge>
      ))}
    </div>
  );
}

function DescriptionBlock({ title, value }: { title: string; value: string | null }) {
  return (
    <div className="rounded-md border p-3">
      <p className="mb-2 text-xs font-semibold uppercase text-muted-foreground">{title}</p>
      <p className="text-sm text-muted-foreground">{value ?? "Not set"}</p>
    </div>
  );
}

function imageUrl(image: InventoryProductImageRow | undefined) {
  return image?.public_url ?? image?.storage_path ?? null;
}

function formatDimensions(detail: InventoryProductDetail) {
  if (!detail.length_value && !detail.width_value && !detail.height_value) return "Not set";
  return `${detail.length_value ?? "-"} x ${detail.width_value ?? "-"} x ${detail.height_value ?? "-"} ${detail.dimension_unit ?? ""}`.trim();
}

function formatWeight(detail: InventoryProductDetail) {
  if (!detail.weight_value) return "Not set";
  return `${detail.weight_value} ${detail.weight_unit ?? ""}`.trim();
}

function formatPrice(
  variant: InventoryProductVariantListRow,
  key: "purchase_price" | "sales_price"
) {
  const value = variant[key];
  if (value == null) return "Not set";
  return `${value} ${variant.price_currency ?? ""}`.trim();
}
