"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import Image from "next/image";
import {
  ArrowLeft,
  Check,
  ChevronDown,
  ChevronsUpDown,
  Copy,
  ImageIcon,
  PackagePlus,
  Plus,
  Star,
  Trash2,
  X,
} from "lucide-react";
import { Link, useRouter } from "@/i18n/navigation";
import {
  assignInventoryVariantGalleryImageAction,
  checkInventorySkuCollisionsAction,
  createInventoryBrandAction,
  createEnhancedInventoryProductAction,
  createInventorySkuTemplateAction,
  createInventoryManufacturerAction,
  createInventoryUnitAction,
  uploadInventoryItemImageAction,
} from "@/app/actions/warehouse/inventory";
import { Button } from "@/components/ui/button";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/utils";

type UnitOption = {
  id: string;
  code: string;
  name: string;
};

type SupplierOption = {
  id: string;
  name: string;
};

type OptionGroupOption = {
  id: string;
  name: string;
  values: Array<{ id: string; value: string }>;
};

type LocationOption = {
  id: string;
  name: string;
  code: string | null;
};

type TagOption = {
  id: string;
  name: string;
  color: string | null;
};

type MasterDataOption = {
  id: string;
  name: string;
};

type CustomFieldOption = {
  id: string;
  entity_type: "product" | "variant" | "lot" | "serial";
  name: string;
  field_key: string;
  field_type: "text" | "number" | "date" | "boolean" | "select" | "multi_select";
  is_required: boolean;
  options: string[];
  display_order: number;
  section_name?: string | null;
  help_text?: string | null;
  placeholder?: string | null;
};

type SkuTemplateOption = {
  id: string;
  name: string;
  description: string | null;
  rules: unknown[];
  is_default: boolean;
};

type InventoryProductCreateClientProps = {
  units: UnitOption[];
  suppliers: SupplierOption[];
  optionGroups: OptionGroupOption[];
  locations: LocationOption[];
  tags: TagOption[];
  customFields: CustomFieldOption[];
  brands: MasterDataOption[];
  manufacturers: MasterDataOption[];
  skuTemplates: SkuTemplateOption[];
};

type AttributeDraft = {
  id: string;
  name: string;
  values: string[];
};

type SkuRule = {
  id: string;
  source: "product_name" | "attribute" | "sequence" | "custom";
  attributeName: string;
  customText: string;
  mode: "full" | "first" | "last";
  length: string;
  letterCase: "upper" | "lower" | "title" | "keep";
  separator: string;
};

type SkuSourceOption = {
  value: string;
  label: string;
};

type ProductImageDraft = {
  file: File;
  preview: string;
};

type UploadedImageRecord = {
  id: string;
  storage_path: string | null;
  public_url: string | null;
  file_name: string | null;
  content_type: string | null;
  file_size: number | null;
};

type VariantDraftRow = {
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

type CustomFieldPayload = {
  field_id: string;
  entity_type: "product" | "variant";
  variant_sku?: string | null;
  value_text?: string | null;
  value_number?: number | null;
  value_date?: string | null;
  value_boolean?: boolean | null;
  value_json?: unknown;
};

const selectClass =
  "h-9 rounded-md border border-input bg-background px-3 text-sm text-foreground shadow-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2";
const textareaClass =
  "rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground shadow-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2";
const labelClass = "text-sm text-foreground";
const requiredLabelClass = "text-sm text-destructive";

function newAttribute(name = "", values: string[] = []): AttributeDraft {
  return { id: crypto.randomUUID(), name, values };
}

function newSkuRule(patch: Partial<SkuRule> = {}): SkuRule {
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

function isSkuRule(value: unknown): value is SkuRule {
  if (!value || typeof value !== "object") return false;
  const candidate = value as Partial<SkuRule>;
  return Boolean(candidate.id && candidate.source && candidate.mode && candidate.letterCase);
}

function product(values: string[][]) {
  return values.reduce<string[][]>(
    (acc, valuesForAttribute) =>
      acc.flatMap((row) => valuesForAttribute.map((value) => [...row, value])),
    [[]]
  );
}

function moneyOrNull(value: string) {
  return value.trim() ? Number(value) : null;
}

function textOrNull(value: FormDataEntryValue | null) {
  const text = String(value ?? "").trim();
  return text || null;
}

function customFieldValue(
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

function makeSku(parts: string[]) {
  return parts
    .map((part) => part.trim().slice(0, 3).toUpperCase())
    .filter(Boolean)
    .join("-");
}

function variantOptionsKey(options: Record<string, string>) {
  return Object.entries(options)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([attribute, value]) => `${attribute}:${value}`)
    .join("|");
}

function titleCase(value: string) {
  return value.toLowerCase().replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function transformSkuPart(value: string, rule: SkuRule) {
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

function safeParseTokens(value: string) {
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

export function InventoryProductCreateClient({
  units,
  suppliers,
  optionGroups,
  locations,
  tags,
  customFields,
  brands,
  manufacturers,
  skuTemplates,
}: InventoryProductCreateClientProps) {
  const router = useRouter();
  const [message, setMessage] = useState<string | null>(null);
  const [validationIssues, setValidationIssues] = useState<string[]>([]);
  const [isPending, startTransition] = useTransition();
  const [productName, setProductName] = useState("");
  const [productSku, setProductSku] = useState("");
  const [mode, setMode] = useState<"simple" | "variants">("simple");
  const [trackInventory, setTrackInventory] = useState(true);
  const [includeOpeningStock, setIncludeOpeningStock] = useState(false);
  const [showSkuModal, setShowSkuModal] = useState(false);
  const [skuRules, setSkuRules] = useState<SkuRule[]>([
    newSkuRule({ source: "product_name", mode: "first", length: "3", separator: "-" }),
    newSkuRule({ source: "attribute", mode: "first", length: "3", separator: "-" }),
    newSkuRule({ source: "sequence", mode: "full", length: "", separator: "" }),
  ]);
  const [attributes, setAttributes] = useState<AttributeDraft[]>([newAttribute()]);
  const [variants, setVariants] = useState<VariantDraftRow[]>([]);
  const [unitOptions, setUnitOptions] = useState<UnitOption[]>(units);
  const [brandOptions, setBrandOptions] = useState<MasterDataOption[]>(brands);
  const [manufacturerOptions, setManufacturerOptions] = useState<MasterDataOption[]>(manufacturers);
  const [selectedUnitId, setSelectedUnitId] = useState("");
  const [productImages, setProductImages] = useState<ProductImageDraft[]>([]);
  const [unitDraft, setUnitDraft] = useState({ code: "", name: "", kind: "count" });
  const [brandDraft, setBrandDraft] = useState("");
  const [manufacturerDraft, setManufacturerDraft] = useState("");
  const [showQuickAddUnit, setShowQuickAddUnit] = useState(false);
  const [showQuickAddBrand, setShowQuickAddBrand] = useState(false);
  const [showQuickAddManufacturer, setShowQuickAddManufacturer] = useState(false);
  const [tagTokens, setTagTokens] = useState<string[]>([]);
  const [skuTemplateOptions, setSkuTemplateOptions] = useState<SkuTemplateOption[]>(skuTemplates);
  const [selectedSkuTemplateId, setSelectedSkuTemplateId] = useState(
    skuTemplates.find((template) => template.is_default)?.id ?? ""
  );
  const [skuTemplateName, setSkuTemplateName] = useState("");
  const [skuCollisionMessage, setSkuCollisionMessage] = useState<string | null>(null);
  const [unitConversions, setUnitConversions] = useState<
    Array<{
      id: string;
      from_unit_id: string;
      to_unit_id: string;
      factor: string;
      rounding_mode: "half_up" | "up" | "down";
    }>
  >([]);
  const [productCustomTokens, setProductCustomTokens] = useState<Record<string, string[]>>({});
  const productCustomFields = customFields.filter((field) => field.entity_type === "product");
  const variantCustomFields = customFields.filter((field) => field.entity_type === "variant");
  const groupedProductCustomFields = useMemo(
    () =>
      Object.entries(
        productCustomFields.reduce<Record<string, CustomFieldOption[]>>((groups, field) => {
          const key = field.section_name?.trim() || "Custom fields";
          groups[key] = [...(groups[key] ?? []), field];
          return groups;
        }, {})
      ),
    [productCustomFields]
  );

  useEffect(() => {
    setUnitOptions(units);
  }, [units]);

  useEffect(() => {
    setBrandOptions(brands);
  }, [brands]);

  useEffect(() => {
    setManufacturerOptions(manufacturers);
  }, [manufacturers]);

  const activeAttributes = useMemo(
    () =>
      attributes
        .map((attribute) => ({
          ...attribute,
          name: attribute.name.trim(),
          values: attribute.values.map((value) => value.trim()).filter(Boolean),
        }))
        .filter((attribute) => attribute.name && attribute.values.length > 0),
    [attributes]
  );

  const duplicateAttributeNames = useMemo(() => {
    const seen = new Set<string>();
    const duplicates = new Map<string, string>();

    for (const attribute of activeAttributes) {
      const key = attribute.name.toLowerCase();
      if (seen.has(key)) {
        duplicates.set(key, attribute.name);
      } else {
        seen.add(key);
      }
    }

    return Array.from(duplicates.values());
  }, [activeAttributes]);

  const skuSourceOptions = useMemo(
    () => [
      { value: "product_name", label: "Item Group Name" },
      ...activeAttributes.map((attribute) => ({
        value: `attribute:${attribute.name}`,
        label: attribute.name,
      })),
      { value: "custom", label: "Custom Text" },
    ],
    [activeAttributes]
  );

  const openSkuGenerator = () => {
    setSkuRules((rules) => {
      const hasUnresolvedAttribute = rules.some(
        (rule) =>
          rule.source === "attribute" &&
          !activeAttributes.some((attribute) => attribute.name === rule.attributeName)
      );

      if (!hasUnresolvedAttribute) return rules;

      return [
        newSkuRule({ source: "product_name", mode: "first", length: "3", separator: "-" }),
        ...activeAttributes.map((attribute) =>
          newSkuRule({
            source: "attribute",
            attributeName: attribute.name,
            mode: "first",
            length: "3",
            separator: "-",
          })
        ),
      ];
    });
    setShowSkuModal(true);
  };

  const buildSkuForRow = (row: VariantDraftRow, index: number) => {
    const parts = skuRules
      .map((rule) => {
        const rawValue =
          rule.source === "product_name"
            ? productName
            : rule.source === "attribute"
              ? (row.options[rule.attributeName || activeAttributes[0]?.name] ?? "")
              : rule.source === "sequence"
                ? String(index + 1)
                : rule.customText;
        const value = transformSkuPart(rawValue, rule);
        return value ? { value, separator: rule.separator } : null;
      })
      .filter((part): part is { value: string; separator: string } => part !== null);

    return parts
      .map((part, index) => `${part.value}${index < parts.length - 1 ? part.separator : ""}`)
      .join("");
  };

  const skuPreview = variants[0] ? buildSkuForRow(variants[0], 0) : makeSku([productName, "1"]);

  useEffect(() => {
    if (mode === "variants") setProductSku("");
  }, [mode]);

  useEffect(() => {
    if (!selectedSkuTemplateId) return;
    const template = skuTemplateOptions.find((item) => item.id === selectedSkuTemplateId);
    if (!template || !Array.isArray(template.rules)) return;
    const nextRules = template.rules.filter(isSkuRule);
    if (nextRules.length > 0) setSkuRules(nextRules);
  }, [selectedSkuTemplateId, skuTemplateOptions]);

  const updateVariant = (id: string, patch: Partial<VariantDraftRow>) => {
    setVariants((rows) => rows.map((row) => (row.id === id ? { ...row, ...patch } : row)));
  };

  useEffect(() => {
    if (mode !== "variants") return;
    if (activeAttributes.length === 0) {
      setVariants([]);
      return;
    }
    if (duplicateAttributeNames.length > 0) {
      setVariants([]);
      return;
    }

    const productNameForRows = productName.trim();
    const attributeCombos = product(activeAttributes.map((attribute) => attribute.values));
    setVariants((currentRows) => {
      const currentByOptions = new Map(
        currentRows.map((row) => [variantOptionsKey(row.options), row])
      );
      return attributeCombos.map((combo) => {
        const options = Object.fromEntries(
          activeAttributes.map((attribute, index) => [attribute.name, combo[index]])
        );
        const key = variantOptionsKey(options);
        const existing = currentByOptions.get(key);
        const generatedName = [productNameForRows, ...combo].filter(Boolean).join(" - ");
        const generatedSku = makeSku([productNameForRows, ...combo]);
        return {
          id: existing?.id ?? crypto.randomUUID(),
          name: existing?.name || generatedName,
          sku: existing?.sku || generatedSku,
          options,
          barcode: existing?.barcode ?? "",
          upc: existing?.upc ?? "",
          ean: existing?.ean ?? "",
          isbn: existing?.isbn ?? "",
          mpn: existing?.mpn ?? "",
          purchase_price: existing?.purchase_price ?? "",
          sales_price: existing?.sales_price ?? "",
          reorder_point: existing?.reorder_point ?? "",
          opening_quantity: existing?.opening_quantity ?? "",
          opening_unit_cost: existing?.opening_unit_cost ?? "",
          customFields: existing?.customFields ?? {},
          imagePreviews: existing?.imagePreviews ?? [],
        };
      });
    });
  }, [activeAttributes, duplicateAttributeNames, mode, productName]);

  const fillDown = (
    key: keyof Pick<VariantDraftRow, "purchase_price" | "sales_price" | "reorder_point">
  ) => {
    setVariants((rows) => {
      const first = rows.find((row) => row[key].trim())?.[key] ?? "";
      return rows.map((row) => ({ ...row, [key]: row[key].trim() ? row[key] : first }));
    });
  };

  const applySkuGenerator = () => {
    setVariants((rows) =>
      rows.map((row, index) => ({
        ...row,
        sku: buildSkuForRow(row, index),
      }))
    );
    setShowSkuModal(false);
  };

  const checkSkuCollisions = async () => {
    setSkuCollisionMessage(null);
    const skus = variants.map((row) => buildSkuForRow(row, variants.indexOf(row))).filter(Boolean);
    if (skus.length === 0) return;
    const result = await checkInventorySkuCollisionsAction({ skus });
    if (!result.success || !("data" in result)) {
      setSkuCollisionMessage("error" in result ? result.error : "Could not check SKU collisions.");
      return;
    }
    setSkuCollisionMessage(
      result.data.length
        ? `Existing SKUs: ${result.data.map((collision) => collision.sku).join(", ")}`
        : "No existing SKU collisions."
    );
  };

  const saveSkuTemplate = async () => {
    const name = skuTemplateName.trim();
    if (!name) {
      setSkuCollisionMessage("Template name is required.");
      return;
    }
    const result = await createInventorySkuTemplateAction({
      name,
      rules: skuRules,
      is_default: skuTemplateOptions.length === 0,
    });
    if (!result.success || !("data" in result)) {
      setSkuCollisionMessage("error" in result ? result.error : "Template could not be saved.");
      return;
    }
    setSkuTemplateOptions((templates) => [
      ...templates.filter((template) => template.id !== result.data.id),
      result.data,
    ]);
    setSelectedSkuTemplateId(result.data.id);
    setSkuTemplateName("");
    setSkuCollisionMessage("SKU template saved.");
  };

  const addProductImages = (files: FileList | null) => {
    if (!files) return [];
    const selected = Array.from(files).map((file) => ({
      file,
      preview: URL.createObjectURL(file),
    }));
    const accepted = selected.slice(0, Math.max(15 - productImages.length, 0));
    if (accepted.length > 0) {
      setProductImages((current) => [...current, ...accepted].slice(0, 15));
    }
    return accepted;
  };

  const onProductImages = (files: FileList | null) => {
    addProductImages(files);
  };

  const removeProductImage = (preview: string) => {
    setProductImages((images) => images.filter((image) => image.preview !== preview));
    setVariants((rows) =>
      rows.map((row) => ({
        ...row,
        imagePreviews: row.imagePreviews.filter((imagePreview) => imagePreview !== preview),
      }))
    );
  };

  const makePrimaryProductImage = (preview: string) => {
    setProductImages((images) => {
      const selected = images.find((image) => image.preview === preview);
      if (!selected) return images;
      return [selected, ...images.filter((image) => image.preview !== preview)];
    });
  };

  const uploadImages = async (productId: string, variantIds: string[]) => {
    const uploadedByPreview = new Map<string, UploadedImageRecord>();

    for (const [index, image] of productImages.entries()) {
      const formData = new FormData();
      formData.set("product_id", productId);
      formData.set("is_primary", String(index === 0));
      formData.set("file", image.file);
      const result = await uploadInventoryItemImageAction(formData);
      if (!result.success)
        throw new Error("error" in result ? result.error : "Image upload failed");
      if ("data" in result) {
        uploadedByPreview.set(image.preview, result.data as UploadedImageRecord);
      }
    }

    for (const [index, variant] of variants.entries()) {
      const variantId = variantIds[index];
      if (!variantId) continue;
      for (const [imageIndex, preview] of variant.imagePreviews.entries()) {
        const image = uploadedByPreview.get(preview);
        if (!image) continue;
        const result = await assignInventoryVariantGalleryImageAction({
          product_id: productId,
          variant_id: variantId,
          storage_path: image.storage_path,
          public_url: image.public_url,
          file_name: image.file_name,
          content_type: image.content_type,
          file_size: image.file_size,
          sort_order: imageIndex,
          is_primary: imageIndex === 0,
        });
        if (!result.success)
          throw new Error("error" in result ? result.error : "Variant image assignment failed");
      }
    }
  };

  const createProduct = (formData: FormData) => {
    setMessage(null);
    setValidationIssues([]);
    startTransition(async () => {
      const issues: string[] = [];
      const itemName = String(formData.get("name") ?? "").trim();
      const baseUnitId = String(formData.get("base_unit_id") ?? "");
      const baseSku = mode === "variants" ? "" : productSku.trim();
      const simpleVariant: VariantDraftRow = {
        id: crypto.randomUUID(),
        name: itemName || "Default",
        sku: baseSku || makeSku([itemName, "1"]),
        options: {},
        barcode: String(formData.get("barcode") ?? ""),
        upc: String(formData.get("upc") ?? ""),
        ean: String(formData.get("ean") ?? ""),
        isbn: String(formData.get("isbn") ?? ""),
        mpn: String(formData.get("mpn") ?? ""),
        purchase_price: String(formData.get("purchase_price") ?? ""),
        sales_price: String(formData.get("sales_price") ?? ""),
        reorder_point: String(formData.get("reorder_point") ?? ""),
        opening_quantity: String(formData.get("opening_quantity") ?? ""),
        opening_unit_cost: String(formData.get("opening_unit_cost") ?? ""),
        customFields: {},
        imagePreviews: [],
      };

      const rows = mode === "variants" ? variants : [simpleVariant];
      if (!itemName) issues.push("Name is required.");
      if (!baseUnitId) issues.push("Unit is required.");
      if (mode === "variants" && duplicateAttributeNames.length > 0) {
        issues.push(`Variant attributes must be unique: ${duplicateAttributeNames.join(", ")}.`);
      }
      if (mode === "variants" && rows.length === 0) {
        issues.push("Add at least one complete variant attribute option.");
      }
      const duplicateSku = rows
        .map((row) => row.sku.trim().toLowerCase())
        .filter(Boolean)
        .find((sku, index, all) => all.indexOf(sku) !== index);
      if (duplicateSku) {
        issues.push("Variant SKUs must be unique before saving.");
      }
      if (rows.some((row) => !row.name.trim())) {
        issues.push("Every generated variant needs an item name.");
      }
      if (rows.some((row) => !row.sku.trim())) {
        issues.push("Every generated variant needs a SKU.");
      }
      const collisionResult = rows.some((row) => row.sku.trim())
        ? await checkInventorySkuCollisionsAction({
            skus: rows.map((row) => row.sku.trim()).filter(Boolean),
          })
        : null;
      if (collisionResult && (!collisionResult.success || !("data" in collisionResult))) {
        issues.push(
          "error" in collisionResult
            ? collisionResult.error
            : "Could not check SKU collisions before saving."
        );
      } else if (collisionResult && "data" in collisionResult && collisionResult.data.length) {
        issues.push(
          `SKU already exists: ${collisionResult.data.map((collision) => collision.sku).join(", ")}.`
        );
      }
      if (includeOpeningStock && !String(formData.get("opening_location_id") ?? "")) {
        issues.push("Opening stock requires a destination location.");
      }
      for (const conversion of unitConversions) {
        const hasAnyValue =
          conversion.from_unit_id || conversion.to_unit_id || conversion.factor.trim();
        const factor = Number(conversion.factor);
        if (
          hasAnyValue &&
          (!conversion.from_unit_id ||
            !conversion.to_unit_id ||
            conversion.from_unit_id === conversion.to_unit_id ||
            !Number.isFinite(factor) ||
            factor <= 0)
        ) {
          issues.push("Unit conversions require different units and a positive factor.");
          break;
        }
      }
      for (const field of productCustomFields) {
        if (!field.is_required) continue;
        const value =
          field.field_type === "multi_select"
            ? productCustomTokens[field.id]?.length
            : field.field_type === "boolean"
              ? formData.get(`custom_field_${field.id}`) === "on"
              : String(formData.get(`custom_field_${field.id}`) ?? "").trim();
        if (!value) issues.push(`${field.name} is required.`);
      }
      for (const field of variantCustomFields) {
        if (!field.is_required) continue;
        const missingVariant = rows.find((row) => {
          const rawValue = row.customFields[field.id] ?? "";
          if (field.field_type === "multi_select") return safeParseTokens(rawValue).length === 0;
          return !rawValue.trim();
        });
        if (missingVariant) {
          issues.push(`${field.name} is required for every variant.`);
        }
      }
      if (issues.length > 0) {
        setValidationIssues([...new Set(issues)]);
        return;
      }
      const productCustomFieldValues: CustomFieldPayload[] = [];
      for (const field of productCustomFields) {
        const rawValue =
          field.field_type === "multi_select"
            ? JSON.stringify(productCustomTokens[field.id] ?? [])
            : field.field_type === "boolean"
              ? formData.get(`custom_field_${field.id}`) === "on"
              : String(formData.get(`custom_field_${field.id}`) ?? "");
        const value = customFieldValue(field, rawValue);
        if (value) productCustomFieldValues.push({ ...value, entity_type: "product" });
      }

      const variantCustomFieldValues: CustomFieldPayload[] = [];
      for (const row of rows) {
        for (const field of variantCustomFields) {
          const value = customFieldValue(field, row.customFields[field.id] ?? "");
          if (value) {
            variantCustomFieldValues.push({
              ...value,
              entity_type: "variant",
              variant_sku: row.sku,
            });
          }
        }
      }
      const result = await createEnhancedInventoryProductAction({
        name: itemName,
        sku: mode === "variants" ? null : baseSku || null,
        product_type: String(formData.get("product_type") ?? "stocked"),
        base_unit_id: baseUnitId,
        description: textOrNull(formData.get("description")),
        returnable: formData.get("returnable") === "on",
        brand_name: textOrNull(formData.get("brand_name")),
        manufacturer_name: textOrNull(formData.get("manufacturer_name")),
        length_value: moneyOrNull(String(formData.get("length_value") ?? "")),
        width_value: moneyOrNull(String(formData.get("width_value") ?? "")),
        height_value: moneyOrNull(String(formData.get("height_value") ?? "")),
        dimension_unit: textOrNull(formData.get("dimension_unit")),
        weight_value: moneyOrNull(String(formData.get("weight_value") ?? "")),
        weight_unit: textOrNull(formData.get("weight_unit")),
        sales_description: textOrNull(formData.get("sales_description")),
        purchase_description: textOrNull(formData.get("purchase_description")),
        preferred_supplier_id: textOrNull(formData.get("preferred_supplier_id")),
        track_inventory: trackInventory,
        opening_location_id: includeOpeningStock
          ? textOrNull(formData.get("opening_location_id"))
          : null,
        tags: tagTokens,
        unit_conversions: unitConversions
          .map((conversion) => ({
            from_unit_id: conversion.from_unit_id,
            to_unit_id: conversion.to_unit_id,
            factor: Number(conversion.factor),
            rounding_mode: conversion.rounding_mode,
          }))
          .filter(
            (conversion) =>
              conversion.from_unit_id &&
              conversion.to_unit_id &&
              conversion.from_unit_id !== conversion.to_unit_id &&
              Number.isFinite(conversion.factor) &&
              conversion.factor > 0
          ),
        custom_fields: [...productCustomFieldValues, ...variantCustomFieldValues],
        attributes:
          mode === "variants" ? activeAttributes.map(({ name, values }) => ({ name, values })) : [],
        variants: rows.map((row) => ({
          sku: row.sku,
          name: row.name,
          options: row.options,
          barcode: row.barcode || null,
          upc: row.upc || null,
          ean: row.ean || null,
          isbn: row.isbn || null,
          mpn: row.mpn || null,
          purchase_price: moneyOrNull(row.purchase_price),
          sales_price: moneyOrNull(row.sales_price),
          price_currency: "PLN",
          reorder_point: moneyOrNull(row.reorder_point),
          opening_quantity: includeOpeningStock ? moneyOrNull(row.opening_quantity) : null,
          opening_unit_cost: includeOpeningStock ? moneyOrNull(row.opening_unit_cost) : null,
        })),
      });

      if (!result.success) {
        setMessage("error" in result ? result.error : "Unexpected error");
        return;
      }

      if (!("data" in result)) {
        setMessage("Unexpected product creation response");
        return;
      }

      try {
        await uploadImages(result.data.product_id, result.data.variant_ids);
      } catch (error) {
        setMessage(error instanceof Error ? error.message : "Images could not be saved");
        return;
      }
      router.push("/dashboard/warehouse/items");
    });
  };

  const createUnit = (formData: FormData) => {
    setMessage(null);
    startTransition(async () => {
      const result = await createInventoryUnitAction({
        code: String(formData.get("unit_code") ?? ""),
        name: String(formData.get("unit_name") ?? ""),
        unit_kind: String(formData.get("unit_kind") ?? "count"),
      });
      setMessage(
        result.success ? "Unit created" : "error" in result ? result.error : "Unexpected error"
      );
      if (result.success && "data" in result) {
        setUnitOptions((current) =>
          [...current.filter((unit) => unit.id !== result.data.id), result.data].sort((a, b) =>
            a.code.localeCompare(b.code)
          )
        );
        setSelectedUnitId(result.data.id);
        setUnitDraft({ code: "", name: "", kind: "count" });
        setShowQuickAddUnit(false);
      }
    });
  };

  const createBrand = () => {
    const name = brandDraft.trim();
    if (!name) return;
    setMessage(null);
    startTransition(async () => {
      const result = await createInventoryBrandAction({ name });
      setMessage(
        result.success ? "Brand created" : "error" in result ? result.error : "Unexpected error"
      );
      if (result.success && "data" in result) {
        setBrandOptions((current) =>
          [...current.filter((brand) => brand.id !== result.data.id), result.data].sort((a, b) =>
            a.name.localeCompare(b.name)
          )
        );
        setBrandDraft("");
        setShowQuickAddBrand(false);
      }
    });
  };

  const createManufacturer = () => {
    const name = manufacturerDraft.trim();
    if (!name) return;
    setMessage(null);
    startTransition(async () => {
      const result = await createInventoryManufacturerAction({ name });
      setMessage(
        result.success
          ? "Manufacturer created"
          : "error" in result
            ? result.error
            : "Unexpected error"
      );
      if (result.success && "data" in result) {
        setManufacturerOptions((current) =>
          [
            ...current.filter((manufacturer) => manufacturer.id !== result.data.id),
            result.data,
          ].sort((a, b) => a.name.localeCompare(b.name))
        );
        setManufacturerDraft("");
        setShowQuickAddManufacturer(false);
      }
    });
  };

  return (
    <form
      action={createProduct}
      className="flex min-h-[calc(100vh-4rem)] flex-col bg-background text-foreground"
    >
      <div className="sticky top-0 z-10 border-b border-border bg-background/95 px-6 py-5 backdrop-blur">
        <div className="flex items-center justify-between gap-4">
          <h1 className="text-2xl font-semibold tracking-normal">New Item</h1>
          <Button asChild variant="ghost" size="icon">
            <Link href="/dashboard/warehouse/items">
              <X className="h-5 w-5" />
            </Link>
          </Button>
        </div>
      </div>

      <div className="flex-1 overflow-auto bg-background px-6 py-6">
        <div className="mx-auto grid max-w-7xl gap-8">
          {message ? (
            <p className="border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
              {message}
            </p>
          ) : null}
          {validationIssues.length > 0 ? (
            <div className="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
              <p className="font-medium">Fix these fields before saving:</p>
              <ul className="mt-1 list-disc pl-5">
                {validationIssues.map((issue) => (
                  <li key={issue}>{issue}</li>
                ))}
              </ul>
            </div>
          ) : null}

          <section className="grid gap-x-16 gap-y-5 lg:grid-cols-[1fr_360px]">
            <div className="grid gap-4">
              <div className="grid items-center gap-3 md:grid-cols-[170px_1fr]">
                <label className={labelClass}>Type</label>
                <div className="flex gap-6 text-sm">
                  <label className="flex items-center gap-2">
                    <input type="radio" name="product_type" value="stocked" defaultChecked />
                    Goods
                  </label>
                  <label className="flex items-center gap-2">
                    <input type="radio" name="product_type" value="service" />
                    Service
                  </label>
                </div>
              </div>

              <div className="grid items-center gap-3 md:grid-cols-[170px_1fr]">
                <label className={requiredLabelClass}>Name*</label>
                <Input
                  name="name"
                  value={productName}
                  onChange={(event) => setProductName(event.target.value)}
                  required
                  className="h-9"
                />
              </div>
              <div className="grid items-center gap-3 md:grid-cols-[170px_1fr]">
                <label className={labelClass}>SKU</label>
                <div className="grid gap-1">
                  <Input
                    name="sku"
                    value={productSku}
                    disabled={mode === "variants"}
                    placeholder={mode === "variants" ? "Variant SKUs are entered below" : undefined}
                    onChange={(event) => setProductSku(event.target.value)}
                    className="h-9"
                  />
                  {mode === "variants" ? (
                    <p className="text-xs text-muted-foreground">
                      Variant items use the SKU from each generated variant row.
                    </p>
                  ) : null}
                </div>
              </div>

              <div className="grid items-center gap-3 md:grid-cols-[170px_1fr]">
                <label className={requiredLabelClass}>Unit*</label>
                <div className="flex gap-2">
                  <select
                    name="base_unit_id"
                    value={selectedUnitId}
                    onChange={(event) => setSelectedUnitId(event.target.value)}
                    className={cn(selectClass, "min-w-0 flex-1")}
                    required
                  >
                    <option value="">Select unit</option>
                    {unitOptions.map((unit) => (
                      <option key={unit.id} value={unit.id}>
                        {unit.code} - {unit.name}
                      </option>
                    ))}
                  </select>
                  <TooltipProvider delayDuration={150}>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button
                          type="button"
                          variant="outline"
                          size="icon"
                          className="h-9 w-9"
                          aria-label="Add unit"
                          aria-expanded={showQuickAddUnit}
                          onClick={() => setShowQuickAddUnit((open) => !open)}
                        >
                          <Plus className="h-4 w-4" />
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent>Add unit</TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                </div>
              </div>

              {showQuickAddUnit ? (
                <div className="grid items-center gap-3 md:grid-cols-[170px_1fr]">
                  <span />
                  <div className="grid gap-2 rounded-md border border-border bg-muted/20 p-3 md:grid-cols-[1fr_1fr_150px_auto]">
                    <Input
                      placeholder="Unit code"
                      value={unitDraft.code}
                      onChange={(event) =>
                        setUnitDraft((draft) => ({ ...draft, code: event.target.value }))
                      }
                      className="h-9"
                    />
                    <Input
                      placeholder="Unit name"
                      value={unitDraft.name}
                      onChange={(event) =>
                        setUnitDraft((draft) => ({ ...draft, name: event.target.value }))
                      }
                      className="h-9"
                    />
                    <select
                      className={selectClass}
                      value={unitDraft.kind}
                      onChange={(event) =>
                        setUnitDraft((draft) => ({ ...draft, kind: event.target.value }))
                      }
                    >
                      <option value="count">count</option>
                      <option value="weight">weight</option>
                      <option value="length">length</option>
                      <option value="volume">volume</option>
                      <option value="time">time</option>
                      <option value="area">area</option>
                      <option value="other">other</option>
                    </select>
                    <Button
                      type="button"
                      variant="outline"
                      disabled={isPending}
                      onClick={() => {
                        const formData = new FormData();
                        formData.set("unit_code", unitDraft.code);
                        formData.set("unit_name", unitDraft.name);
                        formData.set("unit_kind", unitDraft.kind);
                        createUnit(formData);
                      }}
                    >
                      Add
                    </Button>
                  </div>
                </div>
              ) : null}

              <div className="grid items-center gap-3 md:grid-cols-[170px_1fr]">
                <span />
                <label className="flex items-center gap-2 text-sm">
                  <input type="checkbox" name="returnable" defaultChecked />
                  Returnable Item
                </label>
              </div>

              <div className="grid items-start gap-3 md:grid-cols-[170px_1fr]">
                <label className="pt-2 text-sm">Description</label>
                <textarea name="description" className={cn(textareaClass, "min-h-20")} />
              </div>

              <div className="grid items-start gap-3 md:grid-cols-[170px_1fr]">
                <label className={labelClass}>Tags</label>
                <TokenInput
                  value={tagTokens}
                  onChange={setTagTokens}
                  placeholder="Type tag and press Enter"
                  suggestions={tags.map((tag) => tag.name)}
                />
              </div>
            </div>

            <label className="flex min-h-48 cursor-pointer flex-col items-center justify-center rounded-md border border-dashed border-border bg-muted/30 p-6 text-center text-sm text-muted-foreground">
              <ImageIcon className="mb-3 h-10 w-10 text-muted-foreground" />
              <span>Drag image(s) here or</span>
              <span className="text-primary">Browse images</span>
              <span className="mt-3 text-xs">Up to 15 images, 5 MB each.</span>
              <input
                type="file"
                accept="image/*"
                multiple
                className="hidden"
                onChange={(event) => onProductImages(event.target.files)}
              />
            </label>
          </section>

          {productImages.length > 0 ? (
            <div className="ml-0 flex flex-wrap gap-2 lg:ml-[170px]">
              {productImages.map((image, index) => (
                <div key={image.preview} className="group relative h-14 w-14">
                  <Image
                    src={image.preview}
                    alt=""
                    width={56}
                    height={56}
                    unoptimized
                    className="h-14 w-14 rounded-md border border-border object-cover"
                  />
                  <TooltipProvider delayDuration={150}>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <button
                          type="button"
                          className={cn(
                            "absolute -left-1 -top-1 grid h-5 w-5 place-items-center rounded-full border border-border bg-background text-muted-foreground shadow-sm hover:text-foreground",
                            index === 0 && "text-primary"
                          )}
                          onClick={() => makePrimaryProductImage(image.preview)}
                          aria-label="Set primary image"
                        >
                          <Star className="h-3 w-3" />
                        </button>
                      </TooltipTrigger>
                      <TooltipContent>
                        {index === 0 ? "Primary image" : "Set primary image"}
                      </TooltipContent>
                    </Tooltip>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <button
                          type="button"
                          className="absolute -right-1 -top-1 grid h-5 w-5 place-items-center rounded-full border border-border bg-background text-muted-foreground shadow-sm hover:text-destructive"
                          onClick={() => removeProductImage(image.preview)}
                          aria-label="Remove image"
                        >
                          <X className="h-3 w-3" />
                        </button>
                      </TooltipTrigger>
                      <TooltipContent>Remove image</TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                </div>
              ))}
            </div>
          ) : null}

          <Separator />

          <section className="grid gap-x-16 gap-y-5 xl:grid-cols-2">
            <div className="grid gap-4">
              <h2 className="flex items-center gap-2 text-lg font-medium">
                <input type="checkbox" defaultChecked />
                Sales Information
              </h2>
              <Field label="Selling Price" name="sales_price" prefix="PLN" type="number" />
              <div className="grid items-start gap-3 md:grid-cols-[170px_1fr]">
                <label className="pt-2 text-sm">Description</label>
                <textarea name="sales_description" className={cn(textareaClass, "min-h-16")} />
              </div>
            </div>
            <div className="grid gap-4">
              <h2 className="flex items-center gap-2 text-lg font-medium">
                <input type="checkbox" defaultChecked />
                Purchase Information
              </h2>
              <Field label="Cost Price" name="purchase_price" prefix="PLN" type="number" />
              <div className="grid items-center gap-3 md:grid-cols-[170px_1fr]">
                <label className="text-sm">Preferred Vendor</label>
                <select name="preferred_supplier_id" className={selectClass}>
                  <option value="">Select vendor</option>
                  {suppliers.map((supplier) => (
                    <option key={supplier.id} value={supplier.id}>
                      {supplier.name}
                    </option>
                  ))}
                </select>
              </div>
              <div className="grid items-start gap-3 md:grid-cols-[170px_1fr]">
                <label className="pt-2 text-sm">Description</label>
                <textarea name="purchase_description" className={cn(textareaClass, "min-h-16")} />
              </div>
            </div>
          </section>

          <Separator />

          <section className="grid gap-4">
            <div className="grid gap-4 lg:grid-cols-2">
              <Field label="Dimensions" name="length_value" placeholder="Length" type="number" />
              <Field label=" " name="width_value" placeholder="Width" type="number" />
              <Field label=" " name="height_value" placeholder="Height" type="number" />
              <Field label="Dimension Unit" name="dimension_unit" placeholder="cm" />
              <Field label="Weight" name="weight_value" type="number" />
              <Field label="Weight Unit" name="weight_unit" placeholder="kg" />
              <MasterDataField
                label="Manufacturer"
                name="manufacturer_name"
                options={manufacturerOptions}
                showQuickAdd={showQuickAddManufacturer}
                draft={manufacturerDraft}
                onDraftChange={setManufacturerDraft}
                onToggleQuickAdd={() => setShowQuickAddManufacturer((value) => !value)}
                onCreate={createManufacturer}
              />
              <MasterDataField
                label="Brand"
                name="brand_name"
                options={brandOptions}
                showQuickAdd={showQuickAddBrand}
                draft={brandDraft}
                onDraftChange={setBrandDraft}
                onToggleQuickAdd={() => setShowQuickAddBrand((value) => !value)}
                onCreate={createBrand}
              />
              <Field label="UPC" name="upc" />
              <Field label="MPN" name="mpn" />
              <Field label="EAN" name="ean" />
              <Field label="ISBN" name="isbn" />
              <Field label="Barcode" name="barcode" />
            </div>
          </section>

          <Separator />

          <section className="grid gap-4">
            <label className="flex items-center gap-2 text-lg font-medium">
              <input
                type="checkbox"
                checked={trackInventory}
                onChange={(event) => setTrackInventory(event.target.checked)}
              />
              Track Inventory for this item
            </label>
            <div className="grid gap-4 lg:grid-cols-2">
              <Field label="Reorder Point" name="reorder_point" type="number" />
              <div className="grid items-center gap-3 md:grid-cols-[170px_1fr]">
                <label className="text-sm">Opening Stock</label>
                <label className="flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={includeOpeningStock}
                    onChange={(event) => setIncludeOpeningStock(event.target.checked)}
                  />
                  Include opening stock
                </label>
              </div>
              {includeOpeningStock ? (
                <>
                  <Field label="Opening Stock" name="opening_quantity" type="number" />
                  <Field label="Rate per Unit" name="opening_unit_cost" type="number" />
                  <div className="grid items-center gap-3 md:grid-cols-[170px_1fr]">
                    <label className="text-sm">Location</label>
                    <select name="opening_location_id" className={selectClass}>
                      <option value="">Select location</option>
                      {locations.map((location) => (
                        <option key={location.id} value={location.id}>
                          {location.code ? `${location.code} - ${location.name}` : location.name}
                        </option>
                      ))}
                    </select>
                  </div>
                </>
              ) : null}
            </div>
          </section>

          <Separator />

          <section className="grid gap-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <h2 className="text-lg font-medium">Units</h2>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() =>
                  setUnitConversions((rows) => [
                    ...rows,
                    {
                      id: crypto.randomUUID(),
                      from_unit_id: selectedUnitId,
                      to_unit_id: "",
                      factor: "",
                      rounding_mode: "half_up",
                    },
                  ])
                }
              >
                <Plus className="mr-2 h-4 w-4" />
                Add conversion
              </Button>
            </div>
            {unitConversions.length > 0 ? (
              <div className="overflow-hidden rounded-md border border-border">
                <div className="grid grid-cols-[1fr_1fr_160px_160px_44px] bg-muted/40 px-3 py-2 text-xs font-semibold uppercase text-muted-foreground">
                  <span>From</span>
                  <span>To</span>
                  <span>Factor</span>
                  <span>Rounding</span>
                  <span />
                </div>
                {unitConversions.map((conversion) => (
                  <div
                    key={conversion.id}
                    className="grid grid-cols-[1fr_1fr_160px_160px_44px] items-center gap-3 border-t border-border px-3 py-2"
                  >
                    <select
                      className={selectClass}
                      value={conversion.from_unit_id}
                      onChange={(event) =>
                        setUnitConversions((rows) =>
                          rows.map((row) =>
                            row.id === conversion.id
                              ? { ...row, from_unit_id: event.target.value }
                              : row
                          )
                        )
                      }
                    >
                      <option value="">From unit</option>
                      {unitOptions.map((unit) => (
                        <option key={unit.id} value={unit.id}>
                          {unit.code}
                        </option>
                      ))}
                    </select>
                    <select
                      className={selectClass}
                      value={conversion.to_unit_id}
                      onChange={(event) =>
                        setUnitConversions((rows) =>
                          rows.map((row) =>
                            row.id === conversion.id
                              ? { ...row, to_unit_id: event.target.value }
                              : row
                          )
                        )
                      }
                    >
                      <option value="">To unit</option>
                      {unitOptions.map((unit) => (
                        <option key={unit.id} value={unit.id}>
                          {unit.code}
                        </option>
                      ))}
                    </select>
                    <Input
                      value={conversion.factor}
                      type="number"
                      min="0"
                      step="0.000001"
                      className="h-9"
                      onChange={(event) =>
                        setUnitConversions((rows) =>
                          rows.map((row) =>
                            row.id === conversion.id ? { ...row, factor: event.target.value } : row
                          )
                        )
                      }
                    />
                    <select
                      className={selectClass}
                      value={conversion.rounding_mode}
                      onChange={(event) =>
                        setUnitConversions((rows) =>
                          rows.map((row) =>
                            row.id === conversion.id
                              ? {
                                  ...row,
                                  rounding_mode: event.target.value as "half_up" | "up" | "down",
                                }
                              : row
                          )
                        )
                      }
                    >
                      <option value="half_up">Half up</option>
                      <option value="up">Up</option>
                      <option value="down">Down</option>
                    </select>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="h-9 w-9"
                      onClick={() =>
                        setUnitConversions((rows) => rows.filter((row) => row.id !== conversion.id))
                      }
                      aria-label="Remove unit conversion"
                    >
                      <X className="h-4 w-4 text-destructive" />
                    </Button>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">
                Add alternate units when this item can be purchased, stocked, or counted in
                different units.
              </p>
            )}
          </section>

          <Separator />

          {productCustomFields.length > 0 ? (
            <>
              <section className="grid gap-4">
                <h2 className="text-lg font-medium">Custom Fields</h2>
                {groupedProductCustomFields.map(([section, fields]) => (
                  <div key={section} className="grid gap-3">
                    <h3 className="text-sm font-semibold uppercase text-muted-foreground">
                      {section}
                    </h3>
                    <div className="grid gap-4 lg:grid-cols-2">
                      {fields.map((field) => (
                        <CustomFieldControl
                          key={field.id}
                          field={field}
                          tokens={productCustomTokens[field.id] ?? []}
                          onTokensChange={(tokens) =>
                            setProductCustomTokens((current) => ({
                              ...current,
                              [field.id]: tokens,
                            }))
                          }
                        />
                      ))}
                    </div>
                  </div>
                ))}
              </section>

              <Separator />
            </>
          ) : null}

          <section className="grid gap-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-6">
                <h2 className="text-lg font-medium">Variants</h2>
                <label className="flex items-center gap-2 text-sm">
                  <input
                    type="radio"
                    checked={mode === "simple"}
                    onChange={() => setMode("simple")}
                  />
                  Simple item
                </label>
                <label className="flex items-center gap-2 text-sm">
                  <input
                    type="radio"
                    checked={mode === "variants"}
                    onChange={() => setMode("variants")}
                  />
                  Item with variants
                </label>
              </div>
            </div>

            {mode === "variants" ? (
              <>
                <div className="flex max-w-4xl flex-col gap-3">
                  {attributes.map((attribute) => (
                    <div
                      key={attribute.id}
                      className="grid items-center gap-3 md:grid-cols-[260px_1fr_auto]"
                    >
                      <Input
                        list="attribute-options"
                        placeholder="Attribute"
                        value={attribute.name}
                        onChange={(event) =>
                          setAttributes((rows) =>
                            rows.map((row) =>
                              row.id === attribute.id ? { ...row, name: event.target.value } : row
                            )
                          )
                        }
                      />
                      <TokenInput
                        value={attribute.values}
                        onChange={(values) =>
                          setAttributes((rows) =>
                            rows.map((row) => (row.id === attribute.id ? { ...row, values } : row))
                          )
                        }
                        placeholder="Type option and press Enter"
                        suggestions={
                          optionGroups
                            .find(
                              (group) =>
                                group.name.toLowerCase() === attribute.name.trim().toLowerCase()
                            )
                            ?.values.map((value) => value.value) ?? []
                        }
                      />
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        onClick={() =>
                          setAttributes((rows) => rows.filter((row) => row.id !== attribute.id))
                        }
                      >
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    </div>
                  ))}
                  {duplicateAttributeNames.length > 0 ? (
                    <p className="text-sm text-destructive md:pl-[260px]">
                      Attribute names must be unique: {duplicateAttributeNames.join(", ")}
                    </p>
                  ) : null}
                  <div>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => setAttributes((rows) => [...rows, newAttribute()])}
                    >
                      <Plus className="mr-2 h-4 w-4" />
                      Add Attribute
                    </Button>
                  </div>
                </div>

                <div className="flex items-center justify-between gap-3 border-t border-border bg-muted/30 px-3 py-3">
                  <div className="text-sm">
                    Select your Item Type:
                    <label className="ml-4">
                      <input
                        type="radio"
                        checked={trackInventory}
                        onChange={() => setTrackInventory(true)}
                      />{" "}
                      Inventory
                    </label>
                    <label className="ml-4">
                      <input
                        type="radio"
                        checked={!trackInventory}
                        onChange={() => setTrackInventory(false)}
                      />{" "}
                      Non-Inventory
                    </label>
                  </div>
                  <label className="flex items-center gap-2 text-sm">
                    <input
                      type="checkbox"
                      checked={includeOpeningStock}
                      onChange={(event) => setIncludeOpeningStock(event.target.checked)}
                    />
                    Include Opening Stock
                  </label>
                </div>

                <div className="overflow-x-auto rounded-md border border-border">
                  <table className="w-full min-w-[1280px] border-collapse text-sm">
                    <thead className="bg-muted/40 text-xs uppercase text-muted-foreground">
                      <tr className="border-b border-border">
                        <th className="px-2 py-2 text-left">Image</th>
                        <th className="px-2 py-2 text-left">Item Name*</th>
                        <th className="px-2 py-2 text-left">
                          SKU
                          <button
                            type="button"
                            className="ml-2 text-primary"
                            onClick={openSkuGenerator}
                          >
                            Generate SKU
                          </button>
                        </th>
                        <th className="px-2 py-2 text-left">
                          <HeaderCopyAction
                            label="Cost Price"
                            onCopy={() => fillDown("purchase_price")}
                          />
                        </th>
                        <th className="px-2 py-2 text-left">
                          <HeaderCopyAction
                            label="Selling Price"
                            onCopy={() => fillDown("sales_price")}
                          />
                        </th>
                        <th className="px-2 py-2 text-left">UPC</th>
                        <th className="px-2 py-2 text-left">EAN</th>
                        <th className="px-2 py-2 text-left">ISBN</th>
                        {variantCustomFields.map((field) => (
                          <th key={field.id} className="px-2 py-2 text-left">
                            {field.name}
                          </th>
                        ))}
                        <th className="px-2 py-2 text-left">
                          <HeaderCopyAction
                            label="Reorder Point"
                            onCopy={() => fillDown("reorder_point")}
                          />
                        </th>
                        {includeOpeningStock ? (
                          <th className="px-2 py-2 text-left">Opening Stock</th>
                        ) : null}
                        <th className="w-10" />
                      </tr>
                    </thead>
                    <tbody>
                      {variants.map((row) => (
                        <tr key={row.id} className="border-b border-border last:border-b-0">
                          <td className="px-2 py-2">
                            <VariantImagePicker
                              gallery={productImages}
                              selectedPreviews={row.imagePreviews}
                              onChange={(imagePreviews) => updateVariant(row.id, { imagePreviews })}
                              onClear={() => updateVariant(row.id, { imagePreviews: [] })}
                              onUpload={(files) => {
                                const [image] = addProductImages(files);
                                if (image)
                                  updateVariant(row.id, {
                                    imagePreviews: [...row.imagePreviews, image.preview],
                                  });
                              }}
                            />
                          </td>
                          <Cell
                            value={row.name}
                            onChange={(value) => updateVariant(row.id, { name: value })}
                          />
                          <Cell
                            value={row.sku}
                            onChange={(value) => updateVariant(row.id, { sku: value })}
                          />
                          <Cell
                            value={row.purchase_price}
                            type="number"
                            onChange={(value) => updateVariant(row.id, { purchase_price: value })}
                          />
                          <Cell
                            value={row.sales_price}
                            type="number"
                            onChange={(value) => updateVariant(row.id, { sales_price: value })}
                          />
                          <Cell
                            value={row.upc}
                            onChange={(value) => updateVariant(row.id, { upc: value })}
                          />
                          <Cell
                            value={row.ean}
                            onChange={(value) => updateVariant(row.id, { ean: value })}
                          />
                          <Cell
                            value={row.isbn}
                            onChange={(value) => updateVariant(row.id, { isbn: value })}
                          />
                          {variantCustomFields.map((field) =>
                            field.field_type === "multi_select" ? (
                              <TokenCell
                                key={field.id}
                                value={safeParseTokens(row.customFields[field.id] ?? "")}
                                onChange={(tokens) =>
                                  updateVariant(row.id, {
                                    customFields: {
                                      ...row.customFields,
                                      [field.id]: JSON.stringify(tokens),
                                    },
                                  })
                                }
                              />
                            ) : (
                              <Cell
                                key={field.id}
                                value={row.customFields[field.id] ?? ""}
                                type={
                                  field.field_type === "number"
                                    ? "number"
                                    : field.field_type === "date"
                                      ? "date"
                                      : "text"
                                }
                                onChange={(value) =>
                                  updateVariant(row.id, {
                                    customFields: { ...row.customFields, [field.id]: value },
                                  })
                                }
                              />
                            )
                          )}
                          <Cell
                            value={row.reorder_point}
                            type="number"
                            onChange={(value) => updateVariant(row.id, { reorder_point: value })}
                          />
                          {includeOpeningStock ? (
                            <Cell
                              value={row.opening_quantity}
                              type="number"
                              onChange={(value) =>
                                updateVariant(row.id, { opening_quantity: value })
                              }
                            />
                          ) : null}
                          <td className="px-2 py-2">
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon"
                              onClick={() =>
                                setVariants((rows) =>
                                  rows.filter((variant) => variant.id !== row.id)
                                )
                              }
                            >
                              <X className="h-4 w-4 text-destructive" />
                            </Button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </>
            ) : null}
          </section>
        </div>
      </div>

      <div className="sticky bottom-0 z-10 border-t border-border bg-background/95 px-6 py-3 backdrop-blur">
        <div className="mx-auto flex max-w-7xl gap-3">
          <Button type="submit" disabled={isPending}>
            <PackagePlus className="mr-2 h-4 w-4" />
            Save
          </Button>
          <Button asChild type="button" variant="outline">
            <Link href="/dashboard/warehouse/items">
              <ArrowLeft className="mr-2 h-4 w-4" />
              Cancel
            </Link>
          </Button>
        </div>
      </div>

      <datalist id="attribute-options">
        {optionGroups.map((group) => (
          <option key={group.id} value={group.name} />
        ))}
      </datalist>
      <datalist id="tag-options">
        {tags.map((tag) => (
          <option key={tag.id} value={tag.name} />
        ))}
      </datalist>
      <datalist id="brand-options" />
      <datalist id="manufacturer-options" />

      {showSkuModal ? (
        <div className="fixed inset-0 z-50 flex items-start justify-center bg-black/60 px-6 py-10">
          <div className="max-h-[90vh] w-full max-w-5xl overflow-hidden rounded-md border border-border bg-popover text-popover-foreground shadow-2xl">
            <div className="flex h-14 items-center justify-between border-b border-border px-6">
              <h2 className="text-xl font-medium">Generate SKU - item</h2>
              <button
                type="button"
                className="grid h-9 w-9 place-items-center rounded-md text-foreground hover:bg-muted"
                onClick={() => setShowSkuModal(false)}
                aria-label="Close SKU generator"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="max-h-[calc(90vh-56px)] overflow-y-auto">
              <div className="grid gap-7 px-6 py-8">
                <p className="flex items-center gap-1 text-sm text-muted-foreground">
                  Select attributes that you would like to generate the SKU from
                  <span className="grid h-4 w-4 place-items-center rounded-full border border-muted-foreground text-[10px] text-muted-foreground">
                    ?
                  </span>
                </p>

                <div className="grid gap-3 rounded-md border border-border bg-muted/20 p-3 md:grid-cols-[minmax(220px,1fr)_minmax(220px,1fr)_auto_auto] md:items-end">
                  <label className="grid gap-1 text-sm">
                    Template
                    <select
                      value={selectedSkuTemplateId}
                      className={cn(selectClass, "pr-9")}
                      onChange={(event) => setSelectedSkuTemplateId(event.target.value)}
                    >
                      <option value="">Manual rules</option>
                      {skuTemplateOptions.map((template) => (
                        <option key={template.id} value={template.id}>
                          {template.name}
                          {template.is_default ? " (default)" : ""}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className="grid gap-1 text-sm">
                    Save current rules
                    <Input
                      value={skuTemplateName}
                      placeholder="Template name"
                      onChange={(event) => setSkuTemplateName(event.target.value)}
                    />
                  </label>
                  <Button type="button" variant="outline" onClick={saveSkuTemplate}>
                    Save template
                  </Button>
                  <Button type="button" variant="outline" onClick={checkSkuCollisions}>
                    Check SKUs
                  </Button>
                  {skuCollisionMessage ? (
                    <p className="text-sm text-muted-foreground md:col-span-4">
                      {skuCollisionMessage}
                    </p>
                  ) : null}
                </div>

                <div className="grid gap-0">
                  <div className="grid grid-cols-[minmax(180px,1.1fr)_205px_180px_150px_28px] gap-x-3 bg-muted/40 text-xs font-semibold uppercase text-muted-foreground">
                    <div className="px-3 py-3">Select Attribute</div>
                    <div className="px-3 py-3">Show</div>
                    <div className="px-3 py-3">Letter Case</div>
                    <div className="px-3 py-3">Separator</div>
                    <div />
                  </div>

                  <div className="grid gap-4 py-5">
                    {skuRules.map((rule) => {
                      const sourceValue =
                        rule.source === "attribute"
                          ? `attribute:${rule.attributeName}`
                          : rule.source;

                      return (
                        <div
                          key={rule.id}
                          className="grid grid-cols-[minmax(180px,1.1fr)_205px_180px_150px_28px] items-center gap-x-3"
                        >
                          <SkuSourceCombobox
                            value={sourceValue}
                            options={skuSourceOptions}
                            onChange={(nextValue) => {
                              setSkuRules((rules) =>
                                rules.map((item) =>
                                  item.id === rule.id
                                    ? nextValue.startsWith("attribute:")
                                      ? {
                                          ...item,
                                          source: "attribute",
                                          attributeName: nextValue.replace("attribute:", ""),
                                          separator: item.separator || "-",
                                        }
                                      : {
                                          ...item,
                                          source: nextValue as SkuRule["source"],
                                          attributeName: "",
                                          separator:
                                            nextValue === "custom" ? "" : item.separator || "-",
                                        }
                                    : item
                                )
                              );
                            }}
                          />

                          {rule.source === "custom" ? (
                            <Input
                              value={rule.customText}
                              placeholder="Enter the custom text"
                              className="h-9"
                              onChange={(event) =>
                                setSkuRules((rules) =>
                                  rules.map((item) =>
                                    item.id === rule.id
                                      ? { ...item, customText: event.target.value }
                                      : item
                                  )
                                )
                              }
                            />
                          ) : (
                            <div className="flex h-9 overflow-hidden rounded-md border border-input bg-background shadow-sm">
                              <div className="relative w-28 border-r border-input">
                                <select
                                  value={rule.mode}
                                  className="h-full w-full appearance-none border-0 bg-muted/30 pl-3 pr-8 text-sm text-foreground outline-none"
                                  onChange={(event) =>
                                    setSkuRules((rules) =>
                                      rules.map((item) =>
                                        item.id === rule.id
                                          ? { ...item, mode: event.target.value as SkuRule["mode"] }
                                          : item
                                      )
                                    )
                                  }
                                >
                                  <option value="first">First</option>
                                  <option value="last">Last</option>
                                  <option value="full">Full</option>
                                </select>
                                <ChevronDown className="pointer-events-none absolute right-2 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                              </div>
                              <Input
                                value={rule.length}
                                type="number"
                                min="1"
                                className="h-full rounded-none border-0 text-right shadow-none focus-visible:ring-0 focus-visible:ring-offset-0"
                                disabled={rule.mode === "full"}
                                onChange={(event) =>
                                  setSkuRules((rules) =>
                                    rules.map((item) =>
                                      item.id === rule.id
                                        ? { ...item, length: event.target.value }
                                        : item
                                    )
                                  )
                                }
                              />
                            </div>
                          )}

                          <div className="flex h-9 overflow-hidden rounded-md border border-input bg-background shadow-sm">
                            <div className="relative min-w-0 flex-1">
                              <select
                                value={rule.letterCase}
                                className="h-full w-full appearance-none border-0 bg-background pl-3 pr-8 text-sm text-foreground outline-none"
                                onChange={(event) =>
                                  setSkuRules((rules) =>
                                    rules.map((item) =>
                                      item.id === rule.id
                                        ? {
                                            ...item,
                                            letterCase: event.target.value as SkuRule["letterCase"],
                                          }
                                        : item
                                    )
                                  )
                                }
                              >
                                <option value="upper">Upper Case</option>
                                <option value="lower">Lower Case</option>
                                <option value="title">Title Case</option>
                                <option value="keep">Keep Case</option>
                              </select>
                              <ChevronDown className="pointer-events-none absolute right-2 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                            </div>
                            <button
                              type="button"
                              className="grid w-9 place-items-center border-l border-input text-destructive hover:bg-muted"
                              onClick={() =>
                                setSkuRules((rules) =>
                                  rules.map((item) =>
                                    item.id === rule.id ? { ...item, letterCase: "keep" } : item
                                  )
                                )
                              }
                              aria-label="Clear letter case"
                            >
                              <X className="h-4 w-4" />
                            </button>
                          </div>

                          {rule.source === "custom" ? (
                            <div />
                          ) : (
                            <div className="flex h-9 overflow-hidden rounded-md border border-input bg-background shadow-sm">
                              <Input
                                value={rule.separator}
                                className="h-full rounded-none border-0 shadow-none focus-visible:ring-0 focus-visible:ring-offset-0"
                                onChange={(event) =>
                                  setSkuRules((rules) =>
                                    rules.map((item) =>
                                      item.id === rule.id
                                        ? { ...item, separator: event.target.value }
                                        : item
                                    )
                                  )
                                }
                              />
                              <button
                                type="button"
                                className="grid w-9 place-items-center border-l border-input text-destructive hover:bg-muted"
                                onClick={() =>
                                  setSkuRules((rules) =>
                                    rules.map((item) =>
                                      item.id === rule.id ? { ...item, separator: "" } : item
                                    )
                                  )
                                }
                                aria-label="Clear separator"
                              >
                                <X className="h-4 w-4" />
                              </button>
                              <div className="relative w-9 border-l border-input">
                                <select
                                  value={rule.separator || "none"}
                                  className="h-full w-full appearance-none border-0 bg-background text-transparent outline-none"
                                  onChange={(event) =>
                                    setSkuRules((rules) =>
                                      rules.map((item) =>
                                        item.id === rule.id
                                          ? {
                                              ...item,
                                              separator:
                                                event.target.value === "none"
                                                  ? ""
                                                  : event.target.value,
                                            }
                                          : item
                                      )
                                    )
                                  }
                                  aria-label="Separator preset"
                                >
                                  <option value="-">-</option>
                                  <option value="_">_</option>
                                  <option value="/">/</option>
                                  <option value="none">None</option>
                                </select>
                                <ChevronDown className="pointer-events-none absolute right-2 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                              </div>
                            </div>
                          )}

                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            className="h-9 w-9 text-destructive hover:bg-destructive/10 hover:text-destructive"
                            onClick={() =>
                              setSkuRules((rules) => rules.filter((item) => item.id !== rule.id))
                            }
                            aria-label="Remove SKU rule"
                          >
                            <X className="h-4 w-4" />
                          </Button>
                        </div>
                      );
                    })}
                  </div>
                </div>

                <button
                  type="button"
                  className="inline-flex w-fit items-center gap-2 text-sm font-medium text-primary hover:underline"
                  onClick={() =>
                    setSkuRules((rules) => [
                      ...rules,
                      newSkuRule({
                        source: "attribute",
                        attributeName:
                          activeAttributes.find(
                            (attribute) =>
                              !rules.some(
                                (rule) =>
                                  rule.source === "attribute" &&
                                  rule.attributeName === attribute.name
                              )
                          )?.name ??
                          activeAttributes[0]?.name ??
                          "",
                      }),
                    ])
                  }
                >
                  <Plus className="h-4 w-4" />
                  Add Attribute
                </button>

                <div className="grid gap-3">
                  <h3 className="text-base font-medium">SKU Preview</h3>
                  <div className="grid min-h-28 place-items-center rounded-md border border-dashed border-amber-500/80 bg-amber-50/70 px-6 py-8 text-center text-2xl font-semibold text-foreground dark:bg-amber-950/20">
                    {skuPreview || "BRA-001"}
                  </div>
                </div>
              </div>

              <div className="flex gap-3 border-t border-border px-6 py-5">
                <Button type="button" onClick={applySkuGenerator}>
                  Generate SKU
                </Button>
                <Button type="button" variant="outline" onClick={() => setShowSkuModal(false)}>
                  Cancel
                </Button>
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </form>
  );
}

function SkuSourceCombobox({
  value,
  options,
  onChange,
}: {
  value: string;
  options: SkuSourceOption[];
  onChange: (value: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const selectedLabel =
    options.find((option) => option.value === value)?.label ??
    (value === "sequence" ? "Sequence" : "Select attribute");

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          className={cn(
            "flex h-9 w-full items-center justify-between rounded-md border border-input bg-background pl-3 pr-4 text-left text-sm text-foreground shadow-sm outline-none",
            open && "ring-2 ring-ring ring-offset-2 ring-offset-background"
          )}
        >
          <span className="truncate">{selectedLabel}</span>
          <ChevronsUpDown className="ml-3 h-4 w-4 shrink-0 text-muted-foreground" />
        </button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-[--radix-popover-trigger-width] p-0">
        <Command>
          <CommandInput placeholder="Search" />
          <CommandList>
            <CommandEmpty>No attributes found.</CommandEmpty>
            <CommandGroup>
              {options.map((option) => (
                <CommandItem
                  key={option.value}
                  value={option.label}
                  onSelect={() => {
                    onChange(option.value);
                    setOpen(false);
                  }}
                  className="h-10"
                >
                  <span className="truncate">{option.label}</span>
                  <Check
                    className={cn(
                      "ml-auto h-4 w-4",
                      option.value === value ? "opacity-100" : "opacity-0"
                    )}
                  />
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}

function VariantImagePicker({
  gallery,
  selectedPreviews,
  onChange,
  onClear,
  onUpload,
}: {
  gallery: ProductImageDraft[];
  selectedPreviews: string[];
  onChange: (previews: string[]) => void;
  onClear: () => void;
  onUpload: (files: FileList | null) => void;
}) {
  const [open, setOpen] = useState(false);
  const primaryPreview = gallery[0]?.preview ?? null;
  const displayPreview = selectedPreviews[0] ?? primaryPreview;
  const isInherited = selectedPreviews.length === 0 && Boolean(primaryPreview);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          className="relative flex h-9 w-9 items-center justify-center rounded-md border border-border bg-muted/30"
          aria-label="Choose variant image"
        >
          {displayPreview ? (
            <Image
              src={displayPreview}
              alt=""
              width={36}
              height={36}
              unoptimized
              className="h-full w-full rounded-md object-cover"
            />
          ) : (
            <ImageIcon className="h-4 w-4 text-muted-foreground" />
          )}
          {isInherited ? (
            <span className="absolute -right-1 -top-1 h-2.5 w-2.5 rounded-full border border-background bg-primary" />
          ) : null}
        </button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-72 p-3">
        <div className="grid gap-3">
          <div className="flex items-center justify-between gap-3">
            <p className="text-sm font-medium">Variant images</p>
            {selectedPreviews.length > 0 ? (
              <button
                type="button"
                className="text-xs text-muted-foreground hover:text-destructive"
                onClick={onClear}
              >
                Use default
              </button>
            ) : null}
          </div>

          {gallery.length > 0 ? (
            <div className="grid grid-cols-5 gap-2">
              {gallery.map((image, index) => {
                const active = selectedPreviews.includes(image.preview);
                return (
                  <button
                    key={image.preview}
                    type="button"
                    className={cn(
                      "relative h-10 w-10 overflow-hidden rounded-md border border-border",
                      active && "ring-2 ring-primary ring-offset-2 ring-offset-background"
                    )}
                    onClick={() =>
                      onChange(
                        active
                          ? selectedPreviews.filter((preview) => preview !== image.preview)
                          : [...selectedPreviews, image.preview]
                      )
                    }
                    aria-label={index === 0 ? "Use default product image" : "Use gallery image"}
                  >
                    <Image
                      src={image.preview}
                      alt=""
                      width={40}
                      height={40}
                      unoptimized
                      className="h-full w-full object-cover"
                    />
                    {index === 0 ? (
                      <span className="absolute bottom-0 left-0 right-0 bg-background/80 text-[9px] leading-3 text-foreground">
                        Default
                      </span>
                    ) : null}
                    {active ? (
                      <span className="absolute right-0 top-0 grid h-4 w-4 place-items-center rounded-bl bg-primary text-[10px] text-primary-foreground">
                        {selectedPreviews.indexOf(image.preview) + 1}
                      </span>
                    ) : null}
                  </button>
                );
              })}
            </div>
          ) : (
            <p className="rounded-md border border-dashed border-border p-3 text-sm text-muted-foreground">
              Upload product images first, then assign one to this variant.
            </p>
          )}

          <label className="flex h-9 cursor-pointer items-center justify-center gap-2 rounded-md border border-dashed border-border text-sm text-muted-foreground hover:bg-muted/40">
            <Plus className="h-4 w-4" />
            Upload to gallery
            <input
              type="file"
              accept="image/*"
              className="hidden"
              onChange={(event) => onUpload(event.target.files)}
            />
          </label>
        </div>
      </PopoverContent>
    </Popover>
  );
}

function Field({
  label,
  name,
  prefix,
  type = "text",
  placeholder,
  required,
  list,
}: {
  label: string;
  name: string;
  prefix?: string;
  type?: string;
  placeholder?: string;
  required?: boolean;
  list?: string;
}) {
  return (
    <div className="grid items-center gap-3 md:grid-cols-[170px_1fr]">
      <label className={required || label.endsWith("*") ? requiredLabelClass : labelClass}>
        {label}
      </label>
      <div className="flex">
        {prefix ? (
          <span className="flex h-9 items-center rounded-l-md border border-r-0 border-input bg-muted px-3 text-sm text-muted-foreground">
            {prefix}
          </span>
        ) : null}
        <Input
          name={name}
          type={type}
          list={list}
          placeholder={placeholder}
          required={required}
          className={cn("h-9", prefix ? "rounded-l-none" : "")}
          step={type === "number" ? "0.01" : undefined}
          min={type === "number" ? "0" : undefined}
        />
      </div>
    </div>
  );
}

function MasterDataField({
  label,
  name,
  options,
  showQuickAdd,
  draft,
  onDraftChange,
  onToggleQuickAdd,
  onCreate,
}: {
  label: string;
  name: string;
  options: MasterDataOption[];
  showQuickAdd: boolean;
  draft: string;
  onDraftChange: (value: string) => void;
  onToggleQuickAdd: () => void;
  onCreate: () => void;
}) {
  return (
    <div className="grid items-start gap-3 md:grid-cols-[170px_1fr]">
      <label className="pt-2 text-sm text-foreground">{label}</label>
      <div className="grid gap-2">
        <div className="flex gap-2">
          <Input name={name} list={`${name}-options`} className="h-9" />
          <TooltipProvider delayDuration={150}>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  className="h-9 w-9"
                  onClick={onToggleQuickAdd}
                >
                  <Plus className="h-4 w-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>Add {label.toLowerCase()}</TooltipContent>
            </Tooltip>
          </TooltipProvider>
        </div>
        <datalist id={`${name}-options`}>
          {options.map((option) => (
            <option key={option.id} value={option.name} />
          ))}
        </datalist>
        {showQuickAdd ? (
          <div className="flex gap-2">
            <Input
              value={draft}
              placeholder={`New ${label.toLowerCase()}`}
              className="h-9"
              onChange={(event) => onDraftChange(event.target.value)}
            />
            <Button type="button" variant="outline" size="sm" onClick={onCreate}>
              Add
            </Button>
          </div>
        ) : null}
      </div>
    </div>
  );
}

function Cell({
  value,
  onChange,
  type = "text",
}: {
  value: string;
  onChange: (value: string) => void;
  type?: string;
}) {
  return (
    <td className="px-2 py-2">
      <Input
        value={value}
        type={type}
        min={type === "number" ? "0" : undefined}
        step={type === "number" ? "0.01" : undefined}
        onChange={(event) => onChange(event.target.value)}
        className="h-9"
      />
    </td>
  );
}

function HeaderCopyAction({ label, onCopy }: { label: string; onCopy: () => void }) {
  return (
    <div className="flex items-center gap-1.5 whitespace-nowrap">
      <span>{label}</span>
      <TooltipProvider delayDuration={150}>
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="h-6 w-6 rounded-sm text-muted-foreground hover:text-foreground"
              aria-label={`Copy ${label} to all rows`}
              onClick={onCopy}
            >
              <Copy className="h-3.5 w-3.5" />
            </Button>
          </TooltipTrigger>
          <TooltipContent>Copy to all rows</TooltipContent>
        </Tooltip>
      </TooltipProvider>
    </div>
  );
}

function CustomFieldControl({
  field,
  tokens = [],
  onTokensChange,
}: {
  field: CustomFieldOption;
  tokens?: string[];
  onTokensChange?: (tokens: string[]) => void;
}) {
  const name = `custom_field_${field.id}`;
  if (field.field_type === "boolean") {
    return (
      <div className="grid items-center gap-3 md:grid-cols-[170px_1fr]">
        <span className={labelClass}>{field.name}</span>
        <div className="grid gap-1">
          <label className="flex items-center gap-2 text-sm">
            <input name={name} type="checkbox" required={field.is_required} />
            Yes
          </label>
          {field.help_text ? (
            <p className="text-xs text-muted-foreground">{field.help_text}</p>
          ) : null}
        </div>
      </div>
    );
  }

  if (field.field_type === "select") {
    return (
      <div className="grid items-center gap-3 md:grid-cols-[170px_1fr]">
        <label className={field.is_required ? requiredLabelClass : labelClass}>{field.name}</label>
        <div className="grid gap-1">
          <select name={name} required={field.is_required} className={cn(selectClass, "pr-9")}>
            <option value="">Select</option>
            {field.options.map((option) => (
              <option key={option} value={option}>
                {option}
              </option>
            ))}
          </select>
          {field.help_text ? (
            <p className="text-xs text-muted-foreground">{field.help_text}</p>
          ) : null}
        </div>
      </div>
    );
  }

  if (field.field_type === "multi_select") {
    return (
      <div className="grid items-start gap-3 md:grid-cols-[170px_1fr]">
        <label className={field.is_required ? requiredLabelClass : labelClass}>{field.name}</label>
        <div className="grid gap-1">
          <TokenInput
            value={tokens}
            onChange={onTokensChange ?? (() => undefined)}
            placeholder={field.placeholder ?? "Type value and press Enter"}
            suggestions={field.options}
          />
          {field.help_text ? (
            <p className="text-xs text-muted-foreground">{field.help_text}</p>
          ) : null}
        </div>
      </div>
    );
  }

  return (
    <Field
      label={field.is_required ? `${field.name}*` : field.name}
      name={name}
      type={
        field.field_type === "number" ? "number" : field.field_type === "date" ? "date" : "text"
      }
      placeholder={field.placeholder ?? undefined}
      required={field.is_required}
    />
  );
}

function TokenCell({ value, onChange }: { value: string[]; onChange: (value: string[]) => void }) {
  return (
    <td className="min-w-64 px-2 py-2 align-top">
      <TokenInput value={value} onChange={onChange} placeholder="Enter value" compact />
    </td>
  );
}

function TokenInput({
  value,
  onChange,
  placeholder,
  suggestions = [],
  compact = false,
}: {
  value: string[];
  onChange: (value: string[]) => void;
  placeholder?: string;
  suggestions?: string[];
  compact?: boolean;
}) {
  const [draft, setDraft] = useState("");
  const normalized = new Set(value.map((item) => item.toLowerCase()));
  const availableSuggestions = suggestions.filter(
    (suggestion) => suggestion.trim() && !normalized.has(suggestion.trim().toLowerCase())
  );

  const addTokens = (rawValue: string) => {
    const nextTokens = rawValue
      .split(/[,\n]/)
      .map((item) => item.trim())
      .filter(Boolean);
    if (nextTokens.length === 0) return;

    const next = [...value];
    const seen = new Set(next.map((item) => item.toLowerCase()));
    for (const token of nextTokens) {
      const key = token.toLowerCase();
      if (seen.has(key)) continue;
      next.push(token);
      seen.add(key);
    }
    onChange(next);
    setDraft("");
  };

  const removeToken = (token: string) => {
    onChange(value.filter((item) => item !== token));
  };

  return (
    <div className="space-y-2">
      <div
        className={cn(
          "flex min-h-9 flex-wrap items-center gap-1.5 rounded-md border border-input bg-background px-2 py-1 text-sm text-foreground shadow-sm ring-offset-background focus-within:ring-2 focus-within:ring-ring focus-within:ring-offset-2",
          compact ? "min-w-56" : "w-full"
        )}
      >
        {value.map((token) => (
          <span
            key={token}
            className="inline-flex h-7 items-center gap-1 rounded-md bg-muted px-2 text-xs text-foreground"
          >
            {token}
            <button
              type="button"
              className="text-muted-foreground hover:text-foreground"
              onClick={() => removeToken(token)}
              aria-label={`Remove ${token}`}
            >
              <X className="h-3 w-3" />
            </button>
          </span>
        ))}
        <input
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter" || event.key === "Tab") {
              if (!draft.trim()) return;
              event.preventDefault();
              addTokens(draft);
            }
            if (event.key === "Backspace" && !draft && value.length > 0) {
              removeToken(value[value.length - 1]);
            }
          }}
          onBlur={() => {
            if (draft.trim()) addTokens(draft);
          }}
          onPaste={(event) => {
            const text = event.clipboardData.getData("text");
            if (!/[,\n]/.test(text)) return;
            event.preventDefault();
            addTokens(text);
          }}
          className="min-w-36 flex-1 bg-transparent px-1 py-1 outline-none placeholder:text-muted-foreground"
          placeholder={value.length === 0 ? placeholder : undefined}
        />
      </div>
      {availableSuggestions.length > 0 && !compact ? (
        <div className="flex flex-wrap gap-1">
          {availableSuggestions.slice(0, 8).map((suggestion) => (
            <button
              key={suggestion}
              type="button"
              className="rounded-md border border-border px-2 py-1 text-xs text-muted-foreground hover:bg-muted hover:text-foreground"
              onClick={() => addTokens(suggestion)}
            >
              {suggestion}
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}

function Separator() {
  return <div className="border-t border-border" />;
}
