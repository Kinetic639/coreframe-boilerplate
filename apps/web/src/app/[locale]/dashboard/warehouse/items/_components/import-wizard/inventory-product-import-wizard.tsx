"use client";

import { useCallback, useEffect, useMemo, useRef, useState, useTransition } from "react";
import { useTranslations } from "next-intl";
import { Check, ChevronRight, Edit, FileText, Trash2, X } from "lucide-react";
import { useRouter } from "@/i18n/navigation";
import { Button } from "@/components/ui/button";
import { ImportCopyButton } from "@/components/warehouse/import-copy-button";
import { WarehouseImportReviewTable } from "@/components/warehouse/import-review-table";
import { cn } from "@/lib/utils";
import { useUiStoreV2 } from "@/lib/stores/v2/ui-store";
import type {
  InventoryCustomFieldDefinition,
  InventoryTagRow,
  InventoryTaxRateRow,
  InventoryUnitRow,
} from "@/lib/warehouse/inventory-types";
import {
  createInventoryCustomFieldAction,
  createInventoryUnitAction,
  importInventoryProductsCsvAction,
  previewInventoryProductsCsvImportAction,
} from "@/app/actions/warehouse/inventory";
import { ImportMultiSelectCell } from "./import-multi-select-cell";
import {
  autoMapHeaders,
  csvLines,
  importFieldsForStructure,
  importFileToCsv,
  importRowsToCsv,
  isImportFieldRequired,
  mergeById,
  parseCsvLine,
  rawCsvToImportRows,
  sameIdsInOrder,
  slugKey,
  type CaseNormalization,
  type ImportCustomFieldMapping,
  type ImportDraftRow,
  type ImportFieldKey,
  type ImportMode,
  type ImportStep,
  type ImportStructure,
  type ProductImportPreview,
  type SkuSpecialCharacterNormalization,
  type SkuWhitespaceNormalization,
  type UnitAssignmentMode,
} from "./import-utils";

type InventoryProductImportWizardProps = {
  customFields: InventoryCustomFieldDefinition[];
  canManageProducts: boolean;
  canImportProducts: boolean;
  units?: InventoryUnitRow[];
  taxRates?: InventoryTaxRateRow[];
  tags?: InventoryTagRow[];
};

const EMPTY_UNITS: InventoryUnitRow[] = [];
const EMPTY_TAX_RATES: InventoryTaxRateRow[] = [];
const EMPTY_TAGS: InventoryTagRow[] = [];

export function InventoryProductImportWizard({
  customFields,
  canManageProducts,
  canImportProducts,
  units = EMPTY_UNITS,
  taxRates = EMPTY_TAX_RATES,
  tags = EMPTY_TAGS,
}: InventoryProductImportWizardProps) {
  const t = useTranslations("warehouseInventory.import");
  const tc = useTranslations("warehouseInventory.common");
  const tCreate = useTranslations("warehouseInventory.create");
  const tFieldTypes = useTranslations("warehouseInventory.fieldTypes");
  const tSettings = useTranslations("warehouseInventory.settings");
  const router = useRouter();
  const setFlushContent = useUiStoreV2((state) => state.setFlushContent);
  const importOnly = true;
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

  const editableImportFields = useMemo<
    Array<{ key: ImportFieldKey; label: string; copy?: boolean }>
  >(
    () =>
      importStructure === "simple"
        ? [
            { key: "product_name", label: t("itemNameRequired") },
            { key: "product_sku", label: t("productSkuRequired"), copy: true },
            { key: "unit_code", label: t("unitRequired"), copy: true },
            { key: "purchase_price", label: t("costPrice"), copy: true },
            { key: "sales_price", label: t("sellingPrice"), copy: true },
            { key: "barcode", label: t("barcode") },
            { key: "tax_code", label: t("tax"), copy: true },
            { key: "reorder_point", label: t("reorderPoint"), copy: true },
            { key: "tags", label: t("tags") },
            { key: "description", label: t("description") },
          ]
        : [
            { key: "product_name", label: t("productNameRequired"), copy: true },
            { key: "product_sku", label: t("productSku"), copy: true },
            { key: "variant_name", label: t("variantName") },
            { key: "variant_sku", label: t("variantSkuRequired"), copy: true },
            { key: "unit_code", label: t("unitRequired"), copy: true },
            { key: "purchase_price", label: t("costPrice"), copy: true },
            { key: "sales_price", label: t("sellingPrice"), copy: true },
            { key: "barcode", label: t("barcode") },
            { key: "tax_code", label: t("tax"), copy: true },
            { key: "reorder_point", label: t("reorderPoint"), copy: true },
            { key: "tags", label: t("tags") },
            { key: "description", label: t("description") },
          ],
    [importStructure, t]
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

  const resetImportDraft = useCallback(() => {
    setImportRows([]);
    setImportPreview(null);
    setImportCsv(null);
  }, [t]);

  const clearImportWizard = useCallback(() => {
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
  }, []);

  const cancelImport = useCallback(() => {
    if (importOnly) {
      router.push("/dashboard/warehouse/items");
      return;
    }
    clearImportWizard();
  }, [clearImportWizard, importOnly, router]);

  const updateImportRows = useCallback(
    (nextRows: ImportDraftRow[]) => {
      setImportRows(nextRows);
      setImportPreview(null);
      setImportCsv(importRowsToCsv(nextRows, importStructure, mappedCustomFields));
    },
    [importStructure, mappedCustomFields]
  );

  const handleImportFile = useCallback((file: File) => {
    startImportTransition(async () => {
      setImportMessage(null);
      setImportPreview(null);
      setImportCsv(null);
      setImportRows([]);
      let csv = "";
      try {
        csv = await importFileToCsv(file);
      } catch (error) {
        const code = error instanceof Error ? error.message : "";
        setImportMessage(
          code === "unsupported_excel_import_file"
            ? t("unsupportedFileType")
            : code === "missing_excel_import_worksheet"
              ? t("missingWorksheet")
              : t("readFailed")
        );
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
  }, []);

  const buildImportRows = useCallback(() => {
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
  }, [
    columnMapping,
    customFieldMappings,
    fallbackUnitCode,
    importStructure,
    mappedCustomFields,
    nameCaseNormalization,
    rawImportCsv,
    skuCaseNormalization,
    skuSpecialCharacterNormalization,
    skuSpecialCharacters,
    skuWhitespaceNormalization,
    skuWhitespaceReplacement,
    unitAssignmentMode,
  ]);

  const downloadSampleImportFile = useCallback(async () => {
    const headers = importFieldsForStructure(importStructure).map((field) => field.key);
    const sample =
      importStructure === "simple"
        ? [
            t("sampleSimpleName"),
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
            t("sampleSimpleTag"),
            t("sampleSimpleDescription"),
          ]
        : [
            t("sampleVariantProductName"),
            "TSHIRT",
            t("sampleVariantName"),
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
            t("sampleVariantTag"),
            t("sampleVariantDescription"),
          ];
    const rows = [headers, sample.slice(0, headers.length)];
    const XLSX = await import("xlsx");
    const workbook = XLSX.utils.book_new();
    const sheet = XLSX.utils.aoa_to_sheet(rows);
    XLSX.utils.book_append_sheet(workbook, sheet, t("sampleSheetName"));
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
  }, [importStructure, t]);

  const previewImportRows = useCallback(
    (rows: ImportDraftRow[]) => {
      const csv = importRowsToCsv(rows, importStructure, mappedCustomFields);
      startImportTransition(async () => {
        const preview = await previewInventoryProductsCsvImportAction({ csv });
        if (!preview.success || !("data" in preview)) {
          setImportMessage("error" in preview ? preview.error : t("previewFailed"));
          return;
        }
        setImportPreview(preview.data);
        setImportCsv(csv);
        setImportMessage(
          preview.data.invalid_rows > 0
            ? t("reviewInvalidRows", { count: preview.data.invalid_rows })
            : t("previewReady", { count: preview.data.valid_rows })
        );
      });
    },
    [importStructure, mappedCustomFields, t]
  );

  const confirmImport = useCallback(() => {
    const csv = importRowsToCsv(importRows, importStructure, mappedCustomFields);
    startImportTransition(async () => {
      const imported = await importInventoryProductsCsvAction({
        csv,
        mode: importMode,
      });
      setImportMessage(
        imported.success && "data" in imported
          ? t("importedSummary", {
              products: imported.data.imported_products,
              variants: imported.data.imported_variants,
              skipped: imported.data.skipped_rows ?? 0,
            })
          : "error" in imported
            ? imported.error
            : t("importFailed")
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
  }, [importMode, importOnly, importRows, importStructure, mappedCustomFields, router, t]);

  const createUnitFromDraft = useCallback(() => {
    const code = unitDraft.code.trim();
    const name = unitDraft.name.trim();
    if (!code || !name) {
      setImportMessage(t("unitRequiredMessage"));
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
        setImportMessage("error" in result ? result.error : t("unitCreateFailed"));
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
      setImportMessage(t("unitAdded", { code: result.data.code }));
    });
  }, [t, unitDraft.code, unitDraft.kind, unitDraft.name]);

  const createCustomFieldFromDraft = useCallback(() => {
    const name = customFieldDraft.name.trim();
    if (!name) {
      setImportMessage(t("customFieldRequiredMessage"));
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
        setImportMessage("error" in result ? result.error : t("customFieldCreateFailed"));
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
      setImportMessage(t("customFieldAdded", { name: created.name }));
    });
  }, [
    customFieldDraft.entityType,
    customFieldDraft.fieldType,
    customFieldDraft.name,
    customFieldOptions.length,
    t,
  ]);

  const updateImportRow = useCallback(
    (rowId: string, patch: Partial<ImportDraftRow>) => {
      updateImportRows(importRows.map((row) => (row.id === rowId ? { ...row, ...patch } : row)));
    },
    [importRows, updateImportRows]
  );

  const updateImportRowCustomField = useCallback(
    (rowId: string, fieldId: string, value: string) => {
      updateImportRows(
        importRows.map((row) =>
          row.id === rowId
            ? { ...row, customFields: { ...row.customFields, [fieldId]: value } }
            : row
        )
      );
    },
    [importRows, updateImportRows]
  );

  const renderMappingOptions = useCallback(
    (fieldKey: ImportFieldKey) => {
      if (fieldKey === "product_name") {
        return (
          <label className="grid gap-1">
            <span className="text-xs font-medium uppercase text-muted-foreground">
              {t("normalizeNames")}
            </span>
            <select
              value={nameCaseNormalization}
              className="h-10 w-full rounded-md border border-input bg-background px-3 pr-10 text-sm"
              onChange={(event) => {
                setNameCaseNormalization(event.target.value as CaseNormalization);
                resetImportDraft();
              }}
            >
              <option value="none">{t("none")}</option>
              <option value="upper">{t("upperCase")}</option>
              <option value="lower">{t("lowerCase")}</option>
              <option value="title">{t("titleCase")}</option>
            </select>
          </label>
        );
      }
      if (fieldKey === "product_sku" || fieldKey === "variant_sku") {
        return (
          <div className="flex flex-wrap items-end gap-2">
            <label className="grid w-44 gap-1">
              <span className="text-xs font-medium uppercase text-muted-foreground">
                {t("letterCase")}
              </span>
              <select
                value={skuCaseNormalization}
                className="h-10 rounded-md border border-input bg-background px-3 pr-9 text-sm"
                onChange={(event) => {
                  setSkuCaseNormalization(event.target.value as CaseNormalization);
                  resetImportDraft();
                }}
              >
                <option value="none">{t("keepCase")}</option>
                <option value="upper">{t("upperCase")}</option>
                <option value="lower">{t("lowerCase")}</option>
                <option value="title">{t("titleCase")}</option>
              </select>
            </label>
            <label className="grid w-40 gap-1">
              <span className="text-xs font-medium uppercase text-muted-foreground">
                {t("whitespace")}
              </span>
              <select
                value={skuWhitespaceNormalization}
                className="h-10 rounded-md border border-input bg-background px-3 pr-9 text-sm"
                onChange={(event) => {
                  setSkuWhitespaceNormalization(event.target.value as SkuWhitespaceNormalization);
                  resetImportDraft();
                }}
              >
                <option value="keep">{t("keep")}</option>
                <option value="remove">{t("remove")}</option>
                <option value="replace">{t("replace")}</option>
              </select>
            </label>
            {skuWhitespaceNormalization === "replace" ? (
              <label className="grid w-44 gap-1">
                <span className="text-xs font-medium uppercase text-muted-foreground">
                  {t("replaceWith")}
                </span>
                <input
                  value={skuWhitespaceReplacement}
                  className="h-10 rounded-md border border-input bg-background px-3 text-sm"
                  onChange={(event) => {
                    setSkuWhitespaceReplacement(event.target.value);
                    resetImportDraft();
                  }}
                />
              </label>
            ) : null}
            <label className="grid w-52 gap-1">
              <span className="text-xs font-medium uppercase text-muted-foreground">
                {t("specialCharacters")}
              </span>
              <select
                value={skuSpecialCharacterNormalization}
                className="h-10 rounded-md border border-input bg-background px-3 pr-9 text-sm"
                onChange={(event) => {
                  setSkuSpecialCharacterNormalization(
                    event.target.value as SkuSpecialCharacterNormalization
                  );
                  resetImportDraft();
                }}
              >
                <option value="keep">{t("keep")}</option>
                <option value="remove_selected">{t("removeSelected")}</option>
                <option value="remove_all">{t("removeAllSpecial")}</option>
              </select>
            </label>
            {skuSpecialCharacterNormalization === "remove_selected" ? (
              <label className="grid w-40 gap-1">
                <span className="text-xs font-medium uppercase text-muted-foreground">
                  {t("removeChars")}
                </span>
                <input
                  value={skuSpecialCharacters}
                  placeholder="-/"
                  className="h-10 rounded-md border border-input bg-background px-3 text-sm"
                  onChange={(event) => {
                    setSkuSpecialCharacters(event.target.value);
                    resetImportDraft();
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
    },
    [
      nameCaseNormalization,
      resetImportDraft,
      skuCaseNormalization,
      skuSpecialCharacterNormalization,
      skuSpecialCharacters,
      skuWhitespaceNormalization,
      skuWhitespaceReplacement,
      t,
    ]
  );

  const inputClassForImportField = useCallback(
    (fieldKey: ImportFieldKey) =>
      cn(
        "h-9 w-full rounded-md border border-input bg-background px-2 text-sm",
        fieldKey === "product_name" || fieldKey === "variant_name" || fieldKey === "description"
          ? "min-w-80"
          : fieldKey === "product_sku" || fieldKey === "variant_sku"
            ? "min-w-60"
            : fieldKey === "unit_code" || fieldKey === "tax_code" || fieldKey === "tags"
              ? "min-w-52"
              : "min-w-40"
      ),
    []
  );

  const renderImportCell = useCallback(
    (row: ImportDraftRow, fieldKey: ImportFieldKey) => {
      if (fieldKey === "unit_code") {
        return (
          <select
            value={row.unit_code}
            className={cn(inputClassForImportField(fieldKey), "pr-10")}
            onChange={(event) => updateImportRow(row.id, { unit_code: event.target.value })}
          >
            <option value="">{tCreate("selectUnit")}</option>
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
            <option value="">{t("noTax")}</option>
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
    },
    [inputClassForImportField, t, tCreate, tagOptions, taxRateOptions, unitOptions, updateImportRow]
  );

  const renderCustomImportCell = useCallback(
    (row: ImportDraftRow, field: InventoryCustomFieldDefinition) => {
      const value = row.customFields[field.id] ?? "";
      if (field.field_type === "boolean") {
        return (
          <select
            value={value}
            className="h-9 w-full min-w-36 rounded-md border border-input bg-background px-2 pr-10 text-sm"
            onChange={(event) => updateImportRowCustomField(row.id, field.id, event.target.value)}
          >
            <option value="">{tc("unset")}</option>
            <option value="true">{tc("yes")}</option>
            <option value="false">{tc("no")}</option>
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
            <option value="">{tc("select")}</option>
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
    },
    [tc, updateImportRowCustomField]
  );

  const importMappingFields = useMemo(
    () => importFieldsForStructure(importStructure),
    [importStructure]
  );
  const importFieldLabel = useCallback(
    (key: ImportFieldKey) => {
      const labels: Record<ImportFieldKey, string> = {
        product_name: t("productName"),
        product_sku: t("productSku"),
        variant_name: t("variantName"),
        variant_sku: tc("sku"),
        unit_code: tc("unit"),
        product_type: tc("type"),
        status: tc("status"),
        barcode: t("barcode"),
        purchase_price: t("costPrice"),
        sales_price: t("sellingPrice"),
        sales_account_code: tCreate("salesAccount"),
        purchase_account_code: tCreate("purchaseAccount"),
        tax_code: t("taxCode"),
        tax_rate_percent: tCreate("taxRate"),
        reorder_point: t("reorderPoint"),
        tags: t("tags"),
        description: t("description"),
      };
      return labels[key];
    },
    [t, tCreate, tc]
  );
  const missingRequiredMappings = useMemo(
    () =>
      importMappingFields.filter(
        (field) =>
          isImportFieldRequired(field.key, importStructure) &&
          !(field.key === "unit_code" && unitAssignmentMode === "fallback" && fallbackUnitCode) &&
          !columnMapping[field.key]
      ),
    [columnMapping, fallbackUnitCode, importMappingFields, importStructure, unitAssignmentMode]
  );
  const importSkippedRows = useMemo(
    () =>
      importPreview?.rows.filter((row) =>
        row.errors.some((error) => error.toLowerCase().includes("sku already exists"))
      ).length ?? 0,
    [importPreview?.rows]
  );
  const canConfirmImport = useMemo(
    () =>
      !!importPreview &&
      !!importCsv &&
      importRows.length > 0 &&
      (importMode === "create_only"
        ? importPreview.invalid_rows === 0
        : importPreview.rows.every(
            (row) =>
              row.errors.length === 0 ||
              row.errors.every((error) => error.toLowerCase().includes("sku already exists"))
          )),
    [importCsv, importMode, importPreview, importRows.length]
  );

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      {canImportProducts ? (
        <input
          ref={fileInputRef}
          type="file"
          accept=".xlsx,.xls,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.ms-excel"
          className="hidden"
          onChange={(event) => {
            const file = event.target.files?.[0];
            event.currentTarget.value = "";
            if (!file) return;
            handleImportFile(file);
          }}
        />
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
                  ? t("selectFileTitle")
                  : importStep === 2
                    ? t("mapFieldsTitle")
                    : t("previewTitle")}
              </h2>
              <ImportStepper step={importStep} />
            </div>
            {!importOnly ? (
              <button
                type="button"
                className="absolute right-5 top-4 grid h-8 w-8 place-items-center rounded hover:bg-muted"
                aria-label={t("closeImport")}
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
                    <span className="font-medium">{importFileName ?? t("dropFile")}</span>
                    <span className="text-sm text-muted-foreground">{t("fileLimits")}</span>
                    <span className="text-sm text-primary">
                      {importFileName ? t("replaceFile") : t("browseFile")}
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
                    {t("removeFile")}
                  </Button>
                ) : null}

                <p className="text-sm text-muted-foreground">
                  {t("samplePrefix")}
                  <button
                    type="button"
                    className="text-primary underline-offset-4 hover:underline"
                    onClick={() => void downloadSampleImportFile()}
                  >
                    {t("sampleLink")}
                  </button>{" "}
                  {t("sampleSuffix")}
                </p>

                <div className="grid gap-4 rounded-md border bg-muted/20 p-4">
                  <div className="grid gap-3 md:grid-cols-[220px_1fr] md:items-start">
                    <p className="text-sm font-medium text-muted-foreground">
                      {t("itemStructure")}
                    </p>
                    <div className="grid gap-3 sm:grid-cols-2">
                      <ImportRadioCard
                        checked={importStructure === "simple"}
                        title={t("simpleItems")}
                        description={t("simpleItemsHelp")}
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
                        title={t("variantItems")}
                        description={t("variantItemsHelp")}
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
                    <p className="text-sm font-medium text-muted-foreground">
                      {t("duplicateHandling")}
                    </p>
                    <div className="grid gap-3">
                      <label className="flex gap-3">
                        <input
                          type="radio"
                          checked={importMode === "skip_existing"}
                          onChange={() => setImportMode("skip_existing")}
                        />
                        <span>
                          <span className="block text-sm font-medium">
                            {t("skipDuplicateSkus")}
                          </span>
                          <span className="block text-sm text-muted-foreground">
                            {t("skipDuplicateSkusHelp")}
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
                          <span className="block text-sm font-medium">
                            {t("stopDuplicateSkus")}
                          </span>
                          <span className="block text-sm text-muted-foreground">
                            {t("stopDuplicateSkusHelp")}
                          </span>
                        </span>
                      </label>
                    </div>
                  </div>

                  <label className="grid gap-1 md:grid-cols-[220px_1fr] md:items-center">
                    <span className="text-sm font-medium text-muted-foreground">
                      {t("characterEncoding")}
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
                      {t("validationRules")}
                    </label>
                    <label className="flex items-center gap-2 text-sm">
                      <input type="checkbox" checked readOnly />
                      {t("workflowRules")}
                    </label>
                  </div>
                </div>

                <div className="rounded-md bg-muted/40 p-4 text-sm">
                  <p className="mb-2 font-medium">{t("pageTips")}</p>
                  <ul className="list-disc space-y-1 pl-5 text-muted-foreground">
                    <li>{t("tipHeaders")}</li>
                    <li>{t("tipSimple")}</li>
                    <li>{t("tipPreview")}</li>
                  </ul>
                </div>

                <div className="flex justify-between border-t pt-4">
                  <Button type="button" variant="outline" onClick={cancelImport}>
                    {tc("cancel")}
                  </Button>
                  <Button
                    type="button"
                    disabled={!rawImportCsv || isImportPending}
                    onClick={() => setImportStep(2)}
                  >
                    {t("next")}
                    <ChevronRight className="ml-2 h-4 w-4" />
                  </Button>
                </div>
              </div>
            ) : null}

            {importStep === 2 ? (
              <div className="mx-auto grid w-full max-w-7xl gap-5 px-5 py-6">
                <p className="text-sm">
                  {t("selectedFile")} <span className="font-medium">{importFileName}</span>
                </p>
                <div className="rounded-md border border-blue-200 bg-blue-50 px-4 py-3 text-sm text-blue-900 dark:border-blue-500/30 dark:bg-blue-500/10 dark:text-blue-100">
                  {t("autoMapped")}
                </div>
                <div className="rounded-md bg-muted/40 p-4">
                  <div className="flex items-center justify-between">
                    <p className="font-medium">{t("defaultFormats")}</p>
                    <Button type="button" variant="ghost" size="sm" disabled>
                      <Edit className="mr-2 h-4 w-4" />
                      {tc("edit")}
                    </Button>
                  </div>
                  <p className="mt-4 text-xs text-muted-foreground">{t("decimalFormat")}</p>
                  <p className="text-sm">1234567.89</p>
                </div>

                <div>
                  <h3 className="mb-3 text-lg font-medium">{t("itemDetails")}</h3>
                  <div className="overflow-hidden rounded-md border">
                    <div className="hidden gap-4 bg-muted px-4 py-3 text-xs font-semibold uppercase text-muted-foreground lg:grid lg:grid-cols-[180px_minmax(320px,1fr)_minmax(320px,1fr)]">
                      <span>{t("ambraField")}</span>
                      <span>{t("importedHeaders")}</span>
                      <span>{t("options")}</span>
                    </div>
                    {importMappingFields.map((field) => {
                      const isSkuField = field.key === "product_sku" || field.key === "variant_sku";

                      if (field.key === "unit_code") {
                        return (
                          <div
                            key={field.key}
                            className="grid items-start gap-4 border-t px-4 py-4 lg:grid-cols-[180px_minmax(0,1fr)]"
                          >
                            <span className="text-sm text-destructive lg:pt-2">{t("unit")}</span>
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
                                  {t("mapColumn")}
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
                                  {t("useOneUnit")}
                                </button>
                              </div>

                              {unitAssignmentMode === "column" ? (
                                <label className="grid max-w-2xl gap-1">
                                  <span className="text-xs font-medium uppercase text-muted-foreground">
                                    {t("unitColumn")}
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
                                    <option value="">{t("selectUnitColumn")}</option>
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
                                        {t("unitForAllRows")}
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
                                        <option value="">{tCreate("selectUnit")}</option>
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
                                        {t("addUnit")}
                                      </Button>
                                    ) : null}
                                  </div>
                                  {showQuickAddUnit ? (
                                    <div className="grid gap-2 rounded-md border bg-muted/20 p-3 sm:grid-cols-[1fr_1fr_140px_auto]">
                                      <input
                                        value={unitDraft.code}
                                        placeholder={t("unitCode")}
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
                                        placeholder={t("unitName")}
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
                                            {tSettings(kind)}
                                          </option>
                                        ))}
                                      </select>
                                      <Button
                                        type="button"
                                        size="sm"
                                        className="h-10"
                                        onClick={createUnitFromDraft}
                                      >
                                        {tc("add")}
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
                                ? tc("sku")
                                : importFieldLabel(field.key)}
                              {isImportFieldRequired(field.key, importStructure) ? "*" : ""}
                            </span>
                            <label className="grid gap-1">
                              <span className="text-xs font-medium uppercase text-muted-foreground lg:hidden">
                                {t("importedHeaders")}
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
                                <option value="">{t("select")}</option>
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
                                {t("skuNormalization")}
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
                      <h3 className="font-medium">{t("customFields")}</h3>
                      <p className="text-xs text-muted-foreground">{t("customFieldsHelp")}</p>
                    </div>
                    {canManageProducts ? (
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => setShowQuickAddCustomField((current) => !current)}
                      >
                        {t("addPreset")}
                      </Button>
                    ) : null}
                  </div>
                  {showQuickAddCustomField ? (
                    <div className="grid gap-2 border-t px-4 py-3 md:grid-cols-[1fr_160px_160px_auto]">
                      <input
                        value={customFieldDraft.name}
                        placeholder={t("customFieldName")}
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
                        <option value="product">{tc("product")}</option>
                        <option value="variant">{tc("variant")}</option>
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
                              {tFieldTypes(type)}
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
                        {tc("add")}
                      </Button>
                    </div>
                  ) : null}
                  <div className="grid gap-2 border-t p-4">
                    {customFieldMappings.length === 0 ? (
                      <p className="text-sm text-muted-foreground">{t("noCustomFieldsMapped")}</p>
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
                          <option value="">{t("selectCustomField")}</option>
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
                          <option value="">{t("selectImportColumn")}</option>
                          {importHeaders.map((header) => (
                            <option key={header} value={header}>
                              {header}
                            </option>
                          ))}
                        </select>
                        <button
                          type="button"
                          className="grid h-10 w-10 place-items-center rounded text-destructive hover:bg-destructive/10"
                          aria-label={t("removeCustomFieldMapping")}
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
                      {t("addCustomFieldMapping")}
                    </Button>
                  </div>
                </div>

                {missingRequiredMappings.length > 0 ? (
                  <div className="rounded-md border border-destructive/40 bg-destructive/10 px-4 py-3 text-sm text-destructive">
                    {t("requiredMappingsMissing", {
                      fields: missingRequiredMappings
                        .map((field) => importFieldLabel(field.key))
                        .join(", "),
                    })}
                  </div>
                ) : null}

                <div className="flex justify-between border-t pt-4">
                  <Button type="button" variant="outline" onClick={() => setImportStep(1)}>
                    {t("previous")}
                  </Button>
                  <div className="flex gap-2">
                    <Button type="button" variant="outline" onClick={cancelImport}>
                      {tc("cancel")}
                    </Button>
                    <Button
                      type="button"
                      disabled={missingRequiredMappings.length > 0 || isImportPending}
                      onClick={() => {
                        const rows = buildImportRows();
                        if (rows.length === 0) {
                          setImportMessage(t("noRows"));
                          return;
                        }
                        previewImportRows(rows);
                        setImportStep(3);
                      }}
                    >
                      {t("next")}
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
                        ? t("readyWithIssues")
                        : t("readyAll")
                      : t("reviewRefresh")}
                  </div>
                  <ImportSummaryRow
                    label={t("readyCount")}
                    value={importPreview?.valid_rows ?? 0}
                    good
                  />
                  <ImportSummaryRow
                    label={t("recordsSkipped")}
                    value={importSkippedRows}
                    muted={importSkippedRows === 0}
                  />
                  <ImportSummaryRow
                    label={t("rowsWithErrors")}
                    value={importPreview?.invalid_rows ?? 0}
                    muted={(importPreview?.invalid_rows ?? 0) === 0}
                  />
                </div>

                <WarehouseImportReviewTable
                  title={t("finalChanges")}
                  description={t("finalChangesHelp")}
                  rows={importRows}
                  rowKey={(row) => row.id}
                  minWidth="min-w-[1900px]"
                  toolbar={
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      disabled={isImportPending || importRows.length === 0}
                      onClick={() => previewImportRows(importRows)}
                    >
                      {t("refreshValidation")}
                    </Button>
                  }
                  columns={[
                    {
                      key: "row",
                      header: t("row"),
                      className: "w-16 text-muted-foreground",
                      render: (row) => row.source_row,
                    },
                    ...editableImportFields.map((field) => ({
                      key: field.key,
                      header: (
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
                      ),
                      render: (row: ImportDraftRow) => renderImportCell(row, field.key),
                    })),
                    ...mappedCustomFields.map((field) => ({
                      key: field.id,
                      header: (
                        <span className="flex items-center gap-1.5">
                          {field.name}
                          <span className="rounded bg-background px-1.5 py-0.5 text-[10px] capitalize text-muted-foreground">
                            {field.entity_type}
                          </span>
                        </span>
                      ),
                      render: (row: ImportDraftRow) => renderCustomImportCell(row, field),
                    })),
                    {
                      key: "status",
                      header: t("status"),
                      className: "min-w-56",
                      render: (_row, index) => {
                        const previewRow = importPreview?.rows[index];
                        return previewRow?.errors.length ? (
                          <span className="text-xs text-destructive">
                            {previewRow.errors.join(", ")}
                          </span>
                        ) : previewRow ? (
                          <span className="text-xs text-emerald-600">{t("ready")}</span>
                        ) : (
                          <span className="text-xs text-muted-foreground">
                            {t("needsValidation")}
                          </span>
                        );
                      },
                    },
                    {
                      key: "remove",
                      header: "",
                      className: "w-12 text-right",
                      render: (row) => (
                        <button
                          type="button"
                          className="grid h-8 w-8 place-items-center rounded text-destructive hover:bg-destructive/10"
                          aria-label={t("removeRow")}
                          onClick={() =>
                            updateImportRows(importRows.filter((current) => current.id !== row.id))
                          }
                        >
                          <X className="h-4 w-4" />
                        </button>
                      ),
                    },
                  ]}
                />

                <div className="flex justify-between border-t pt-4">
                  <Button type="button" variant="outline" onClick={() => setImportStep(2)}>
                    {t("previous")}
                  </Button>
                  <div className="flex gap-2">
                    <Button type="button" variant="outline" onClick={cancelImport}>
                      {tc("cancel")}
                    </Button>
                    <Button
                      type="button"
                      disabled={isImportPending || !canConfirmImport}
                      onClick={confirmImport}
                    >
                      {t("import")}
                    </Button>
                  </div>
                </div>
              </div>
            ) : null}
          </div>
        </div>
      ) : null}
    </div>
  );
}

function ImportStepper({ step }: { step: ImportStep }) {
  const t = useTranslations("warehouseInventory.import");
  const steps: Array<{ id: ImportStep; label: string }> = [
    { id: 1, label: t("configure") },
    { id: 2, label: t("mapFields") },
    { id: 3, label: t("preview") },
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
