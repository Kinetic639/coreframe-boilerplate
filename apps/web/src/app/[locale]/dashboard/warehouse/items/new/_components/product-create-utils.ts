export type CustomFieldOption = {
  id: string;
  entity_type: "product" | "variant" | "lot" | "serial";
  name: string;
  field_key: string;
  field_type: "text" | "number" | "date" | "boolean" | "select" | "multi_select";
  is_required: boolean;
  is_filterable?: boolean;
  options: string[];
  display_order: number;
  section_name?: string | null;
  help_text?: string | null;
  placeholder?: string | null;
};

export type AttributeDraft = {
  id: string;
  name: string;
  values: string[];
};

export type SkuRule = {
  id: string;
  source: "product_name" | "attribute" | "sequence" | "custom";
  attributeName: string;
  customText: string;
  mode: "full" | "first" | "last";
  length: string;
  letterCase: "upper" | "lower" | "title" | "keep";
  separator: string;
};

export type SkuSourceOption = {
  value: string;
  label: string;
};

export type ProductImageDraft = {
  file: File;
  preview: string;
};

export type UploadedImageRecord = {
  id: string;
  storage_path: string | null;
  public_url: string | null;
  file_name: string | null;
  content_type: string | null;
  file_size: number | null;
};

export type VariantDraftRow = {
  id: string;
  name: string;
  sku: string;
  options: Record<string, string>;
  barcode: string;
  upc: string;
  ean: string;
  isbn: string;
  mpn: string;
  purchase_price: string;
  sales_price: string;
  reorder_point: string;
  opening_quantity: string;
  opening_unit_cost: string;
  customFields: Record<string, string>;
  imagePreviews: string[];
};

export type CustomFieldPayload = {
  field_id: string;
  entity_type: "product" | "variant";
  variant_sku?: string | null;
  value_text?: string | null;
  value_number?: number | null;
  value_date?: string | null;
  value_boolean?: boolean | null;
  value_json?: unknown;
};

export const MAX_ITEM_IMAGE_BYTES = 5 * 1024 * 1024;

type DroppedFileSystemEntry = {
  isFile: boolean;
  isDirectory: boolean;
  file?: (success: (file: File) => void, error?: (error: DOMException) => void) => void;
  createReader?: () => {
    readEntries: (
      success: (entries: DroppedFileSystemEntry[]) => void,
      error?: (error: DOMException) => void
    ) => void;
  };
};

type DataTransferItemWithEntry = DataTransferItem & {
  webkitGetAsEntry?: () => DroppedFileSystemEntry | null;
};

export function newAttribute(name = "", values: string[] = []): AttributeDraft {
  return { id: crypto.randomUUID(), name, values };
}

export function newSkuRule(patch: Partial<SkuRule> = {}): SkuRule {
  return {
    id: crypto.randomUUID(),
    source: "attribute",
    attributeName: "",
    customText: "",
    mode: "first",
    length: "3",
    letterCase: "upper",
    separator: "-",
    ...patch,
  };
}

export function fieldKeyFromName(name: string) {
  const key = name
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
  return key || `field_${Date.now()}`;
}

export function isSkuRule(value: unknown): value is SkuRule {
  if (!value || typeof value !== "object") return false;
  const candidate = value as Partial<SkuRule>;
  return Boolean(candidate.id && candidate.source && candidate.mode && candidate.letterCase);
}

export function product(values: string[][]) {
  return values.reduce<string[][]>(
    (acc, valuesForAttribute) =>
      acc.flatMap((row) => valuesForAttribute.map((value) => [...row, value])),
    [[]]
  );
}

export function moneyOrNull(value: string) {
  return value.trim() ? Number(value) : null;
}

export function textOrNull(value: FormDataEntryValue | null) {
  const text = String(value ?? "").trim();
  return text || null;
}

export function customFieldValue(
  field: CustomFieldOption,
  value: string | boolean
): Omit<CustomFieldPayload, "entity_type"> | null {
  if (field.field_type === "boolean") {
    return { field_id: field.id, value_boolean: Boolean(value) };
  }
  if (field.field_type === "number") {
    const number = Number(value);
    return Number.isFinite(number) ? { field_id: field.id, value_number: number } : null;
  }
  if (field.field_type === "date") {
    return value ? { field_id: field.id, value_date: String(value) } : null;
  }
  if (field.field_type === "multi_select") {
    const values = safeParseTokens(String(value));
    return values.length ? { field_id: field.id, value_json: values } : null;
  }
  return String(value).trim() ? { field_id: field.id, value_text: String(value).trim() } : null;
}

export function makeSku(parts: string[]) {
  return parts
    .map((part) => part.trim().slice(0, 3).toUpperCase())
    .filter(Boolean)
    .join("-");
}

export function variantOptionsKey(options: Record<string, string>) {
  return Object.entries(options)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([attribute, value]) => `${attribute}:${value}`)
    .join("|");
}

export function titleCase(value: string) {
  return value.toLowerCase().replace(/\b\w/g, (letter) => letter.toUpperCase());
}

export function transformSkuPart(value: string, rule: SkuRule) {
  const trimmed = value.trim();
  const length = Number(rule.length);
  const sized =
    Number.isFinite(length) && length > 0 && rule.mode !== "full"
      ? rule.mode === "first"
        ? trimmed.slice(0, length)
        : trimmed.slice(Math.max(trimmed.length - length, 0))
      : trimmed;

  if (rule.letterCase === "upper") return sized.toUpperCase();
  if (rule.letterCase === "lower") return sized.toLowerCase();
  if (rule.letterCase === "title") return titleCase(sized);
  return sized;
}

export function safeParseTokens(value: string) {
  if (!value.trim()) return [];
  try {
    const parsed = JSON.parse(value);
    if (Array.isArray(parsed)) {
      return parsed.map((item) => String(item).trim()).filter(Boolean);
    }
  } catch {
    // Fall back to splitting pasted legacy comma-separated values.
  }
  return value
    .split(/[,\n]/)
    .map((item) => item.trim())
    .filter(Boolean);
}

async function filesFromEntry(entry: DroppedFileSystemEntry): Promise<File[]> {
  if (entry.isFile && entry.file) {
    return new Promise((resolve) =>
      entry.file?.(
        (file) => resolve([file]),
        () => resolve([])
      )
    );
  }

  if (!entry.isDirectory || !entry.createReader) return [];
  const reader = entry.createReader();
  const files: File[] = [];

  while (true) {
    const entries = await new Promise<DroppedFileSystemEntry[]>((resolve) =>
      reader.readEntries(resolve, () => resolve([]))
    );
    if (entries.length === 0) break;
    const nested = await Promise.all(entries.map(filesFromEntry));
    files.push(...nested.flat());
  }

  return files;
}

export async function imageFilesFromDataTransfer(dataTransfer: DataTransfer): Promise<File[]> {
  const entries: DroppedFileSystemEntry[] = [];
  for (const item of Array.from(dataTransfer.items ?? [])) {
    const entry = (item as DataTransferItemWithEntry).webkitGetAsEntry?.() as
      | DroppedFileSystemEntry
      | null
      | undefined;
    if (entry) entries.push(entry);
  }

  if (entries.length === 0) return Array.from(dataTransfer.files ?? []);

  const files = await Promise.all(entries.map(filesFromEntry));
  return files.flat();
}
