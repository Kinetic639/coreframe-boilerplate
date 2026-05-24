"use client";

import { useCallback, useEffect, useMemo, useState, useTransition } from "react";
import Image from "next/image";
import { useTranslations } from "next-intl";
import {
  ArrowLeft,
  ChevronDown,
  ImageIcon,
  PackagePlus,
  Plus,
  Star,
  Trash2,
  Wand2,
  X,
} from "lucide-react";
import { Link, useRouter } from "@/i18n/navigation";
import {
  archiveInventorySkuTemplateAction,
  assignInventoryVariantGalleryImageAction,
  checkInventorySkuCollisionsAction,
  createInventoryBrandAction,
  createEnhancedInventoryProductAction,
  createInventorySkuTemplateAction,
  createInventoryManufacturerAction,
  createInventoryUnitAction,
  updateInventorySkuTemplateAction,
  uploadInventoryItemImageAction,
} from "@/app/actions/warehouse/inventory";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/utils";
import {
  AddCustomFieldSelect,
  Cell,
  CustomFieldControl,
  Field,
  HeaderCopyAction,
  MasterDataField,
  QuickCreateCustomField,
  Separator,
  SkuSourceCombobox,
  TokenCell,
  TokenInput,
  VariantImagePicker,
} from "./product-create-controls";
import { labelClass, requiredLabelClass, selectClass } from "./product-create-styles";
import { InventoryRichTextFormField } from "../../_components/inventory-rich-text";
import {
  MAX_ITEM_IMAGE_BYTES,
  customFieldValue,
  imageFilesFromDataTransfer,
  isSkuRule,
  makeSku,
  moneyOrNull,
  newAttribute,
  newSkuRule,
  product,
  safeParseTokens,
  textOrNull,
  transformSkuPart,
  variantOptionsKey,
  type AttributeDraft,
  type CustomFieldOption,
  type CustomFieldPayload,
  type ProductImageDraft,
  type SkuRule,
  type SkuSourceOption,
  type UploadedImageRecord,
  type VariantDraftRow,
} from "./product-create-utils";

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

type SkuTemplateOption = {
  id: string;
  name: string;
  description: string | null;
  rules: unknown[];
  is_default: boolean;
};

type TaxRateOption = {
  id: string;
  name: string;
  code: string;
  rate_percent: number;
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
  taxRates: TaxRateOption[];
};

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
  taxRates,
}: InventoryProductCreateClientProps) {
  const t = useTranslations("warehouseInventory.create");
  const tc = useTranslations("warehouseInventory.common");
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
  const [skuTarget, setSkuTarget] = useState<"simple" | "variants">("variants");
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
  const [customFieldOptions, setCustomFieldOptions] = useState<CustomFieldOption[]>(customFields);
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
  const [selectedProductCustomFieldIds, setSelectedProductCustomFieldIds] = useState<string[]>([]);
  const [selectedVariantCustomFieldIds, setSelectedVariantCustomFieldIds] = useState<string[]>([]);
  const allProductCustomFields = useMemo(
    () => customFieldOptions.filter((field) => field.entity_type === "product"),
    [customFieldOptions]
  );
  const allVariantCustomFields = useMemo(
    () => customFieldOptions.filter((field) => field.entity_type === "variant"),
    [customFieldOptions]
  );
  const productCustomFields = useMemo(
    () =>
      allProductCustomFields.filter((field) => selectedProductCustomFieldIds.includes(field.id)),
    [allProductCustomFields, selectedProductCustomFieldIds]
  );
  const variantCustomFields = useMemo(
    () =>
      allVariantCustomFields.filter((field) => selectedVariantCustomFieldIds.includes(field.id)),
    [allVariantCustomFields, selectedVariantCustomFieldIds]
  );
  const groupedProductCustomFields = useMemo(
    () =>
      Object.entries(
        productCustomFields.reduce<Record<string, CustomFieldOption[]>>((groups, field) => {
          const key = field.section_name?.trim() || t("customFields");
          groups[key] = [...(groups[key] ?? []), field];
          return groups;
        }, {})
      ),
    [productCustomFields, t]
  );
  const selectedSkuTemplate = useMemo(
    () => skuTemplateOptions.find((template) => template.id === selectedSkuTemplateId) ?? null,
    [selectedSkuTemplateId, skuTemplateOptions]
  );
  const defaultTaxRate = useMemo(() => taxRates.find((tax) => tax.is_default) ?? null, [taxRates]);

  useEffect(() => {
    setUnitOptions(units);
  }, [units]);

  useEffect(() => {
    setBrandOptions(brands);
  }, [brands]);

  useEffect(() => {
    setManufacturerOptions(manufacturers);
  }, [manufacturers]);

  useEffect(() => {
    setCustomFieldOptions(customFields);
  }, [customFields]);

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

  const skuSourceOptions = useMemo(() => {
    const options: SkuSourceOption[] = [{ value: "product_name", label: t("itemGroupName") }];
    if (skuTarget === "variants") {
      options.push(
        ...activeAttributes.map((attribute) => ({
          value: `attribute:${attribute.name}`,
          label: attribute.name,
        }))
      );
    }
    options.push({ value: "custom", label: t("customText") });
    return options;
  }, [activeAttributes, skuTarget, t]);

  const openSkuGenerator = useCallback(
    (target: "simple" | "variants" = "variants") => {
      setSkuTarget(target);
      setSkuCollisionMessage(null);
      setSkuRules((rules) => {
        if (target === "simple") {
          const simpleRules = rules.filter((rule) => rule.source !== "attribute");
          return simpleRules.length > 0
            ? simpleRules
            : [
                newSkuRule({ source: "product_name", mode: "first", length: "3", separator: "-" }),
                newSkuRule({ source: "sequence", mode: "full", length: "", separator: "" }),
              ];
        }

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
    },
    [activeAttributes]
  );

  const buildSkuFromOptions = useCallback(
    (options: Record<string, string>, index: number) => {
      const parts = skuRules
        .map((rule) => {
          const rawValue =
            rule.source === "product_name"
              ? productName
              : rule.source === "attribute"
                ? (options[rule.attributeName || activeAttributes[0]?.name] ?? "")
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
    },
    [activeAttributes, productName, skuRules]
  );

  const buildSkuForRow = useCallback(
    (row: VariantDraftRow, index: number) => buildSkuFromOptions(row.options, index),
    [buildSkuFromOptions]
  );

  const skuPreview = useMemo(
    () =>
      skuTarget === "simple"
        ? buildSkuFromOptions({}, 0)
        : variants[0]
          ? buildSkuForRow(variants[0], 0)
          : makeSku([productName, "1"]),
    [buildSkuForRow, buildSkuFromOptions, productName, skuTarget, variants]
  );

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

  const updateVariant = useCallback((id: string, patch: Partial<VariantDraftRow>) => {
    setVariants((rows) => rows.map((row) => (row.id === id ? { ...row, ...patch } : row)));
  }, []);

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

  const fillDown = useCallback(
    (key: keyof Pick<VariantDraftRow, "purchase_price" | "sales_price" | "reorder_point">) => {
      setVariants((rows) => {
        const first = rows.find((row) => row[key].trim())?.[key] ?? "";
        return rows.map((row) => ({ ...row, [key]: row[key].trim() ? row[key] : first }));
      });
    },
    []
  );

  const applySkuGenerator = useCallback(() => {
    if (skuTarget === "simple") {
      setProductSku(buildSkuFromOptions({}, 0));
      setShowSkuModal(false);
      return;
    }

    setVariants((rows) =>
      rows.map((row, index) => ({
        ...row,
        sku: buildSkuForRow(row, index),
      }))
    );
    setShowSkuModal(false);
  }, [buildSkuForRow, buildSkuFromOptions, skuTarget]);

  const checkSkuCollisions = useCallback(async () => {
    setSkuCollisionMessage(null);
    const skus =
      skuTarget === "simple"
        ? [buildSkuFromOptions({}, 0)].filter(Boolean)
        : variants.map((row, index) => buildSkuForRow(row, index)).filter(Boolean);
    if (skus.length === 0) return;
    const result = await checkInventorySkuCollisionsAction({ skus });
    if (!result.success || !("data" in result)) {
      setSkuCollisionMessage("error" in result ? result.error : t("skuCollisionFailed"));
      return;
    }
    setSkuCollisionMessage(
      result.data.length
        ? `Existing SKUs: ${result.data.map((collision) => collision.sku).join(", ")}`
        : t("noSkuCollisions")
    );
  }, [buildSkuForRow, buildSkuFromOptions, skuTarget, variants]);

  const saveSkuTemplate = async () => {
    const name = skuTemplateName.trim();
    if (!name) {
      setSkuCollisionMessage(t("templateNameRequired"));
      return;
    }
    const result = await createInventorySkuTemplateAction({
      name,
      rules: skuRules,
      is_default: skuTemplateOptions.length === 0,
    });
    if (!result.success || !("data" in result)) {
      setSkuCollisionMessage("error" in result ? result.error : t("templateSaveFailed"));
      return;
    }
    setSkuTemplateOptions((templates) => [
      ...templates.filter((template) => template.id !== result.data.id),
      result.data,
    ]);
    setSelectedSkuTemplateId(result.data.id);
    setSkuTemplateName("");
    setSkuCollisionMessage(t("templateSaved"));
  };

  const updateSkuTemplate = async (makeDefault = false) => {
    if (!selectedSkuTemplate) {
      setSkuCollisionMessage(t("templateSelectUpdate"));
      return;
    }
    const name = skuTemplateName.trim() || selectedSkuTemplate.name;
    const result = await updateInventorySkuTemplateAction({
      id: selectedSkuTemplate.id,
      name,
      description: selectedSkuTemplate.description,
      rules: skuRules,
      is_default: makeDefault || selectedSkuTemplate.is_default,
    });
    if (!result.success || !("data" in result)) {
      setSkuCollisionMessage("error" in result ? result.error : t("templateUpdateFailed"));
      return;
    }
    setSkuTemplateOptions((templates) =>
      templates.map((template) =>
        template.id === selectedSkuTemplate.id
          ? {
              ...template,
              name,
              rules: skuRules,
              is_default: makeDefault || selectedSkuTemplate.is_default,
            }
          : makeDefault
            ? { ...template, is_default: false }
            : template
      )
    );
    setSkuTemplateName("");
    setSkuCollisionMessage(makeDefault ? t("templateUpdatedDefault") : t("templateUpdated"));
  };

  const archiveSkuTemplate = async () => {
    if (!selectedSkuTemplate) {
      setSkuCollisionMessage(t("templateSelectArchive"));
      return;
    }
    const result = await archiveInventorySkuTemplateAction({ id: selectedSkuTemplate.id });
    if (!result.success) {
      setSkuCollisionMessage("error" in result ? result.error : t("templateArchiveFailed"));
      return;
    }
    setSkuTemplateOptions((templates) =>
      templates.filter((template) => template.id !== selectedSkuTemplate.id)
    );
    setSelectedSkuTemplateId("");
    setSkuTemplateName("");
    setSkuCollisionMessage(t("templateArchived"));
  };

  const addProductImages = (files: FileList | File[] | null) => {
    if (!files) return [];
    const fileList = Array.from(files);
    const selected = fileList
      .filter((file) => file.type.startsWith("image/") && file.size <= MAX_ITEM_IMAGE_BYTES)
      .map((file) => ({
        file,
        preview: URL.createObjectURL(file),
      }));
    if (
      fileList.some((file) => !file.type.startsWith("image/") || file.size > MAX_ITEM_IMAGE_BYTES)
    ) {
      setMessage(t("imageSkipped"));
    }
    const accepted = selected.slice(0, Math.max(15 - productImages.length, 0));
    if (accepted.length > 0) {
      setProductImages((current) => [...current, ...accepted].slice(0, 15));
    }
    return accepted;
  };

  const onProductImages = (files: FileList | null) => {
    addProductImages(files);
  };

  const handleProductImageDrop = async (event: React.DragEvent<HTMLElement>) => {
    event.preventDefault();
    event.stopPropagation();
    addProductImages(await imageFilesFromDataTransfer(event.dataTransfer));
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
        throw new Error("error" in result ? result.error : t("imageUploadFailed"));
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
          image_id: image.id,
          sort_order: imageIndex,
          is_primary: imageIndex === 0,
        });
        if (!result.success)
          throw new Error("error" in result ? result.error : t("variantImageAssignFailed"));
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
        name: itemName || tc("default"),
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
      if (!itemName) issues.push(t("nameRequired"));
      if (!baseUnitId) issues.push(t("unitRequired"));
      if (mode === "variants" && duplicateAttributeNames.length > 0) {
        issues.push(`Variant attributes must be unique: ${duplicateAttributeNames.join(", ")}.`);
      }
      if (mode === "variants" && rows.length === 0) {
        issues.push(t("variantAttributeRequired"));
      }
      const duplicateSku = rows
        .map((row) => row.sku.trim().toLowerCase())
        .filter(Boolean)
        .find((sku, index, all) => all.indexOf(sku) !== index);
      if (duplicateSku) {
        issues.push(t("variantSkuUnique"));
      }
      if (rows.some((row) => !row.name.trim())) {
        issues.push(t("variantNameRequired"));
      }
      if (rows.some((row) => !row.sku.trim())) {
        issues.push(t("variantSkuRequired"));
      }
      const collisionResult = rows.some((row) => row.sku.trim())
        ? await checkInventorySkuCollisionsAction({
            skus: rows.map((row) => row.sku.trim()).filter(Boolean),
          })
        : null;
      if (collisionResult && (!collisionResult.success || !("data" in collisionResult))) {
        issues.push(
          "error" in collisionResult ? collisionResult.error : t("skuCollisionBeforeSaveFailed")
        );
      } else if (collisionResult && "data" in collisionResult && collisionResult.data.length) {
        issues.push(
          `SKU already exists: ${collisionResult.data.map((collision) => collision.sku).join(", ")}.`
        );
      }
      if (includeOpeningStock && !String(formData.get("opening_location_id") ?? "")) {
        issues.push(t("openingStockLocation"));
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
          issues.push(t("unitConversionInvalid"));
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
      if (mode === "variants") {
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
      if (mode === "variants") {
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
        sales_account_code: textOrNull(formData.get("sales_account_code")),
        purchase_account_code: textOrNull(formData.get("purchase_account_code")),
        tax_code: textOrNull(formData.get("tax_code")),
        tax_rate_percent: moneyOrNull(String(formData.get("tax_rate_percent") ?? "")),
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
        setMessage("error" in result ? result.error : tc("unexpectedError"));
        return;
      }

      if (!("data" in result)) {
        setMessage(t("createFailed"));
        return;
      }

      try {
        await uploadImages(result.data.product_id, result.data.variant_ids);
      } catch (error) {
        setMessage(error instanceof Error ? error.message : t("imageSaveFailed"));
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
        result.success ? t("unitCreated") : "error" in result ? result.error : tc("unexpectedError")
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
        result.success
          ? t("brandCreated")
          : "error" in result
            ? result.error
            : tc("unexpectedError")
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
          ? t("manufacturerCreated")
          : "error" in result
            ? result.error
            : tc("unexpectedError")
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
          <h1 className="text-2xl font-semibold tracking-normal">{t("title")}</h1>
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
              <p className="font-medium">{t("fixFields")}</p>
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
                <label className={labelClass}>{tc("type")}</label>
                <div className="flex gap-6 text-sm">
                  <label className="flex items-center gap-2">
                    <input type="radio" name="product_type" value="stocked" defaultChecked />
                    {t("goods")}
                  </label>
                  <label className="flex items-center gap-2">
                    <input type="radio" name="product_type" value="service" />
                    {t("service")}
                  </label>
                </div>
              </div>

              <div className="grid items-center gap-3 md:grid-cols-[170px_1fr]">
                <label className={requiredLabelClass}>{t("nameLabel")}</label>
                <Input
                  name="name"
                  value={productName}
                  onChange={(event) => setProductName(event.target.value)}
                  required
                  className="h-9"
                />
              </div>
              <div className="grid items-center gap-3 md:grid-cols-[170px_1fr]">
                <label className={labelClass}>{tc("sku")}</label>
                <div className="grid gap-1">
                  <div className="flex gap-2">
                    <Input
                      name="sku"
                      value={productSku}
                      disabled={mode === "variants"}
                      placeholder={mode === "variants" ? t("variantSkuHint") : undefined}
                      onChange={(event) => setProductSku(event.target.value)}
                      className="h-9"
                    />
                    <TooltipProvider delayDuration={150}>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Button
                            type="button"
                            variant="outline"
                            size="icon"
                            className="h-9 w-9 shrink-0"
                            disabled={mode === "variants"}
                            onClick={() => openSkuGenerator("simple")}
                            aria-label={t("generateSku")}
                          >
                            <Wand2 className="h-4 w-4" />
                          </Button>
                        </TooltipTrigger>
                        <TooltipContent>{t("generateSku")}</TooltipContent>
                      </Tooltip>
                    </TooltipProvider>
                  </div>
                  {mode === "variants" ? (
                    <p className="text-xs text-muted-foreground">{t("variantRowsUseSku")}</p>
                  ) : null}
                </div>
              </div>

              <div className="grid items-center gap-3 md:grid-cols-[170px_1fr]">
                <label className={requiredLabelClass}>{t("unitLabel")}</label>
                <div className="flex gap-2">
                  <select
                    name="base_unit_id"
                    value={selectedUnitId}
                    onChange={(event) => setSelectedUnitId(event.target.value)}
                    className={cn(selectClass, "min-w-0 flex-1")}
                    required
                  >
                    <option value="">{t("selectUnit")}</option>
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
                          aria-label={t("addUnit")}
                          aria-expanded={showQuickAddUnit}
                          onClick={() => setShowQuickAddUnit((open) => !open)}
                        >
                          <Plus className="h-4 w-4" />
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent>{t("addUnit")}</TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                </div>
              </div>

              {showQuickAddUnit ? (
                <div className="grid items-center gap-3 md:grid-cols-[170px_1fr]">
                  <span />
                  <div className="grid gap-2 rounded-md border border-border bg-muted/20 p-3 md:grid-cols-[1fr_1fr_150px_auto]">
                    <Input
                      placeholder={t("unitCode")}
                      value={unitDraft.code}
                      onChange={(event) =>
                        setUnitDraft((draft) => ({ ...draft, code: event.target.value }))
                      }
                      className="h-9"
                    />
                    <Input
                      placeholder={t("unitName")}
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
                      {tc("add")}
                    </Button>
                  </div>
                </div>
              ) : null}

              <div className="grid items-center gap-3 md:grid-cols-[170px_1fr]">
                <span />
                <label className="flex items-center gap-2 text-sm">
                  <input type="checkbox" name="returnable" defaultChecked />
                  {t("returnableItem")}
                </label>
              </div>

              <InventoryRichTextFormField name="description" label={tc("description")} />

              <div className="grid items-start gap-3 md:grid-cols-[170px_1fr]">
                <label className={labelClass}>{tc("tags")}</label>
                <TokenInput
                  value={tagTokens}
                  onChange={setTagTokens}
                  placeholder={t("typeTagEnter")}
                  suggestions={tags.map((tag) => tag.name)}
                />
              </div>
            </div>

            <label
              className="flex min-h-48 cursor-pointer flex-col items-center justify-center rounded-md border border-dashed border-border bg-muted/30 p-6 text-center text-sm text-muted-foreground transition-colors hover:bg-muted/50"
              onDragEnter={(event) => {
                event.preventDefault();
                event.stopPropagation();
              }}
              onDragOver={(event) => {
                event.preventDefault();
                event.stopPropagation();
                event.dataTransfer.dropEffect = "copy";
              }}
              onDragLeave={(event) => {
                event.preventDefault();
                event.stopPropagation();
              }}
              onDrop={handleProductImageDrop}
            >
              <ImageIcon className="mb-3 h-10 w-10 text-muted-foreground" />
              <span>{t("imageDrop")}</span>
              <span className="text-primary">{tc("browseImages")}</span>
              <span className="mt-3 text-xs">{t("imageLimit")}</span>
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
                          aria-label={tc("setPrimaryImage")}
                        >
                          <Star className="h-3 w-3" />
                        </button>
                      </TooltipTrigger>
                      <TooltipContent>
                        {index === 0 ? tc("primaryImage") : tc("setPrimaryImage")}
                      </TooltipContent>
                    </Tooltip>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <button
                          type="button"
                          className="absolute -right-1 -top-1 grid h-5 w-5 place-items-center rounded-full border border-border bg-background text-muted-foreground shadow-sm hover:text-destructive"
                          onClick={() => removeProductImage(image.preview)}
                          aria-label={tc("removeImage")}
                        >
                          <X className="h-3 w-3" />
                        </button>
                      </TooltipTrigger>
                      <TooltipContent>{tc("removeImage")}</TooltipContent>
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
                {t("salesInformation")}
              </h2>
              <Field label={t("sellingPrice")} name="sales_price" prefix="PLN" type="number" />
              <Field
                label={t("salesAccount")}
                name="sales_account_code"
                placeholder={t("salesAccountPlaceholder")}
              />
              <div className="grid items-center gap-3 md:grid-cols-[170px_1fr]">
                <label className="text-sm">{t("taxRate")}</label>
                <select
                  name="tax_preset"
                  className={selectClass}
                  defaultValue={defaultTaxRate?.id ?? ""}
                  onChange={(event) => {
                    const selected = taxRates.find((tax) => tax.id === event.currentTarget.value);
                    const form = event.currentTarget.form;
                    const codeInput = form?.elements.namedItem(
                      "tax_code"
                    ) as HTMLInputElement | null;
                    const rateInput = form?.elements.namedItem(
                      "tax_rate_percent"
                    ) as HTMLInputElement | null;
                    if (codeInput) codeInput.value = selected?.code ?? "";
                    if (rateInput) rateInput.value = selected ? String(selected.rate_percent) : "";
                  }}
                >
                  <option value="">{t("noTaxPreset")}</option>
                  {taxRates.map((tax) => (
                    <option key={tax.id} value={tax.id}>
                      {tax.name} ({tax.rate_percent}%)
                    </option>
                  ))}
                </select>
              </div>
              <div className="grid gap-3 md:grid-cols-[170px_1fr_160px]">
                <label className="pt-2 text-sm">{t("taxCodeRate")}</label>
                <Input
                  name="tax_code"
                  placeholder={t("taxCodePlaceholder")}
                  defaultValue={defaultTaxRate?.code ?? ""}
                />
                <Input
                  name="tax_rate_percent"
                  type="number"
                  step="0.0001"
                  min={0}
                  placeholder="%"
                  defaultValue={defaultTaxRate ? String(defaultTaxRate.rate_percent) : ""}
                />
              </div>
              <InventoryRichTextFormField name="sales_description" label={tc("description")} />
            </div>
            <div className="grid gap-4">
              <h2 className="flex items-center gap-2 text-lg font-medium">
                <input type="checkbox" defaultChecked />
                {t("purchaseInformation")}
              </h2>
              <Field label={t("costPrice")} name="purchase_price" prefix="PLN" type="number" />
              <Field
                label={t("purchaseAccount")}
                name="purchase_account_code"
                placeholder={t("purchaseAccountPlaceholder")}
              />
              <div className="grid items-center gap-3 md:grid-cols-[170px_1fr]">
                <label className="text-sm">{t("preferredVendor")}</label>
                <select name="preferred_supplier_id" className={selectClass}>
                  <option value="">{t("selectVendor")}</option>
                  {suppliers.map((supplier) => (
                    <option key={supplier.id} value={supplier.id}>
                      {supplier.name}
                    </option>
                  ))}
                </select>
              </div>
              <InventoryRichTextFormField name="purchase_description" label={tc("description")} />
            </div>
          </section>

          <Separator />

          <section className="grid gap-4">
            <div className="grid gap-4 lg:grid-cols-2">
              <Field
                label={t("dimensions")}
                name="length_value"
                placeholder={t("length")}
                type="number"
              />
              <Field label=" " name="width_value" placeholder={t("width")} type="number" />
              <Field label=" " name="height_value" placeholder={t("height")} type="number" />
              <Field label={t("dimensionUnit")} name="dimension_unit" placeholder="cm" />
              <Field label={t("weight")} name="weight_value" type="number" />
              <Field label={t("weightUnit")} name="weight_unit" placeholder="kg" />
              <MasterDataField
                label={t("manufacturer")}
                name="manufacturer_name"
                options={manufacturerOptions}
                showQuickAdd={showQuickAddManufacturer}
                draft={manufacturerDraft}
                onDraftChange={setManufacturerDraft}
                onToggleQuickAdd={() => setShowQuickAddManufacturer((value) => !value)}
                onCreate={createManufacturer}
              />
              <MasterDataField
                label={t("brand")}
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
              <Field label={tc("barcode")} name="barcode" />
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
              {t("trackInventory")}
            </label>
            <div className="grid gap-4 lg:grid-cols-2">
              <Field label={t("reorderPoint")} name="reorder_point" type="number" />
              <div className="grid items-center gap-3 md:grid-cols-[170px_1fr]">
                <label className="text-sm">{t("openingStock")}</label>
                <label className="flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={includeOpeningStock}
                    onChange={(event) => setIncludeOpeningStock(event.target.checked)}
                  />
                  {t("includeOpeningStock")}
                </label>
              </div>
              {includeOpeningStock ? (
                <>
                  <Field label={t("openingStock")} name="opening_quantity" type="number" />
                  <Field label={t("ratePerUnit")} name="opening_unit_cost" type="number" />
                  <div className="grid items-center gap-3 md:grid-cols-[170px_1fr]">
                    <label className="text-sm">{tc("location")}</label>
                    <select name="opening_location_id" className={selectClass}>
                      <option value="">{t("selectLocation")}</option>
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
              <h2 className="text-lg font-medium">{tc("unit")}</h2>
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
                {t("addConversion")}
              </Button>
            </div>
            {unitConversions.length > 0 ? (
              <div className="overflow-hidden rounded-md border border-border">
                <div className="grid grid-cols-[1fr_1fr_160px_160px_44px] bg-muted/40 px-3 py-2 text-xs font-semibold uppercase text-muted-foreground">
                  <span>{t("from")}</span>
                  <span>{t("to")}</span>
                  <span>{t("factor")}</span>
                  <span>{t("rounding")}</span>
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
                      <option value="">{t("fromUnit")}</option>
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
                      <option value="">{t("toUnit")}</option>
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
                      <option value="half_up">{t("halfUp")}</option>
                      <option value="up">{t("up")}</option>
                      <option value="down">{t("down")}</option>
                    </select>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="h-9 w-9"
                      onClick={() =>
                        setUnitConversions((rows) => rows.filter((row) => row.id !== conversion.id))
                      }
                      aria-label={t("removeUnitConversion")}
                    >
                      <X className="h-4 w-4 text-destructive" />
                    </Button>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">{t("unitConversionHelp")}</p>
            )}
          </section>

          <Separator />

          <section className="grid gap-4">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <h2 className="text-lg font-medium">{t("customFields")}</h2>
                <p className="text-sm text-muted-foreground">{t("customFieldsHelp")}</p>
              </div>
              <Button asChild variant="ghost" size="sm">
                <Link href="/dashboard/warehouse/settings">{t("manageFields")}</Link>
              </Button>
            </div>

            <div
              className={cn(
                "grid gap-3",
                mode === "variants" ? "md:grid-cols-2" : "md:grid-cols-1"
              )}
            >
              <div className="grid gap-3">
                <AddCustomFieldSelect
                  label={t("addProductField")}
                  fields={allProductCustomFields.filter(
                    (field) => !selectedProductCustomFieldIds.includes(field.id)
                  )}
                  onAdd={(fieldId) =>
                    setSelectedProductCustomFieldIds((current) => [...current, fieldId])
                  }
                />
                <QuickCreateCustomField
                  entityType="product"
                  existingFields={allProductCustomFields}
                  onCreated={(field) => {
                    setCustomFieldOptions((current) => [...current, field]);
                    setSelectedProductCustomFieldIds((current) => [...current, field.id]);
                  }}
                />
              </div>
              {mode === "variants" ? (
                <div className="grid gap-3">
                  <AddCustomFieldSelect
                    label={t("addVariantColumn")}
                    fields={allVariantCustomFields.filter(
                      (field) => !selectedVariantCustomFieldIds.includes(field.id)
                    )}
                    onAdd={(fieldId) =>
                      setSelectedVariantCustomFieldIds((current) => [...current, fieldId])
                    }
                  />
                  <QuickCreateCustomField
                    entityType="variant"
                    existingFields={allVariantCustomFields}
                    onCreated={(field) => {
                      setCustomFieldOptions((current) => [...current, field]);
                      setSelectedVariantCustomFieldIds((current) => [...current, field.id]);
                    }}
                  />
                </div>
              ) : null}
            </div>

            {productCustomFields.length > 0 ? (
              groupedProductCustomFields.map(([section, fields]) => (
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
              ))
            ) : (
              <p className="rounded-md border border-dashed border-border px-3 py-3 text-sm text-muted-foreground">
                {t("noCustomFieldsSelected")}
              </p>
            )}
          </section>

          <Separator />

          <section className="grid gap-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-6">
                <h2 className="text-lg font-medium">{tc("variants")}</h2>
                <label className="flex items-center gap-2 text-sm">
                  <input
                    type="radio"
                    checked={mode === "simple"}
                    onChange={() => setMode("simple")}
                  />
                  {t("simpleItem")}
                </label>
                <label className="flex items-center gap-2 text-sm">
                  <input
                    type="radio"
                    checked={mode === "variants"}
                    onChange={() => setMode("variants")}
                  />
                  {t("itemWithVariants")}
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
                        placeholder={tc("attributes")}
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
                        placeholder={t("typeValueEnter")}
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
                      {t("attributeNamesUnique", { names: duplicateAttributeNames.join(", ") })}
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
                      {t("addAttribute")}
                    </Button>
                  </div>
                </div>

                <div className="flex items-center justify-between gap-3 border-t border-border bg-muted/30 px-3 py-3">
                  <div className="text-sm">
                    {t("selectItemType")}
                    <label className="ml-4">
                      <input
                        type="radio"
                        checked={trackInventory}
                        onChange={() => setTrackInventory(true)}
                      />{" "}
                      {t("inventoryType")}
                    </label>
                    <label className="ml-4">
                      <input
                        type="radio"
                        checked={!trackInventory}
                        onChange={() => setTrackInventory(false)}
                      />{" "}
                      {t("nonInventoryType")}
                    </label>
                  </div>
                  <label className="flex items-center gap-2 text-sm">
                    <input
                      type="checkbox"
                      checked={includeOpeningStock}
                      onChange={(event) => setIncludeOpeningStock(event.target.checked)}
                    />
                    {t("includeOpeningStock")}
                  </label>
                </div>

                <div className="overflow-x-auto rounded-md border border-border">
                  <table className="w-full min-w-[1280px] border-collapse text-sm">
                    <thead className="bg-muted/40 text-xs uppercase text-muted-foreground">
                      <tr className="border-b border-border">
                        <th className="px-2 py-2 text-left">{tc("image")}</th>
                        <th className="px-2 py-2 text-left">{t("itemName")}</th>
                        <th className="px-2 py-2 text-left">
                          SKU
                          <button
                            type="button"
                            className="ml-2 text-primary"
                            onClick={() => openSkuGenerator("variants")}
                          >
                            {t("generateSku")}
                          </button>
                        </th>
                        <th className="px-2 py-2 text-left">
                          <HeaderCopyAction
                            label={t("costPrice")}
                            onCopy={() => fillDown("purchase_price")}
                          />
                        </th>
                        <th className="px-2 py-2 text-left">
                          <HeaderCopyAction
                            label={t("sellingPrice")}
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
                            label={t("reorderPoint")}
                            onCopy={() => fillDown("reorder_point")}
                          />
                        </th>
                        {includeOpeningStock ? (
                          <th className="px-2 py-2 text-left">{t("openingStock")}</th>
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
              <h2 className="text-xl font-medium">
                {skuTarget === "simple"
                  ? t("generateSkuTitleSimple")
                  : t("generateSkuTitleVariants")}
              </h2>
              <button
                type="button"
                className="grid h-9 w-9 place-items-center rounded-md text-foreground hover:bg-muted"
                onClick={() => setShowSkuModal(false)}
                aria-label={t("closeSkuGenerator")}
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="max-h-[calc(90vh-56px)] overflow-y-auto">
              <div className="grid gap-7 px-6 py-8">
                <p className="flex items-center gap-1 text-sm text-muted-foreground">
                  {t("selectSkuFields")}
                  <span className="grid h-4 w-4 place-items-center rounded-full border border-muted-foreground text-[10px] text-muted-foreground">
                    ?
                  </span>
                </p>

                <div className="grid gap-3 rounded-md border border-border bg-muted/20 p-3 md:grid-cols-[minmax(220px,1fr)_minmax(220px,1fr)_auto_auto] md:items-end">
                  <label className="grid gap-1 text-sm">
                    {t("template")}
                    <select
                      value={selectedSkuTemplateId}
                      className={cn(selectClass, "pr-9")}
                      onChange={(event) => setSelectedSkuTemplateId(event.target.value)}
                    >
                      <option value="">{t("manualRules")}</option>
                      {skuTemplateOptions.map((template) => (
                        <option key={template.id} value={template.id}>
                          {template.name}
                          {template.is_default ? t("templateDefaultSuffix") : ""}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className="grid gap-1 text-sm">
                    {t("saveCurrentRules")}
                    <Input
                      value={skuTemplateName}
                      placeholder={t("templateName")}
                      onChange={(event) => setSkuTemplateName(event.target.value)}
                    />
                  </label>
                  <Button type="button" variant="outline" onClick={saveSkuTemplate}>
                    {t("saveTemplate")}
                  </Button>
                  <Button type="button" variant="outline" onClick={checkSkuCollisions}>
                    {t("checkSkus")}
                  </Button>
                  {selectedSkuTemplate ? (
                    <div className="flex flex-wrap gap-2 md:col-span-4">
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => updateSkuTemplate()}
                      >
                        {t("updateSelectedTemplate")}
                      </Button>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => updateSkuTemplate(true)}
                      >
                        {t("setAsDefault")}
                      </Button>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        className="text-destructive hover:text-destructive"
                        onClick={archiveSkuTemplate}
                      >
                        {t("archiveTemplate")}
                      </Button>
                    </div>
                  ) : null}
                  {skuCollisionMessage ? (
                    <p className="text-sm text-muted-foreground md:col-span-4">
                      {skuCollisionMessage}
                    </p>
                  ) : null}
                </div>

                <div className="grid gap-0">
                  <div className="grid grid-cols-[minmax(180px,1.1fr)_205px_180px_150px_28px] gap-x-3 bg-muted/40 text-xs font-semibold uppercase text-muted-foreground">
                    <div className="px-3 py-3">{t("selectAttribute")}</div>
                    <div className="px-3 py-3">{t("show")}</div>
                    <div className="px-3 py-3">{t("letterCase")}</div>
                    <div className="px-3 py-3">{t("separator")}</div>
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
                              placeholder={t("customText")}
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
                                  <option value="first">{t("first")}</option>
                                  <option value="last">{t("last")}</option>
                                  <option value="full">{t("full")}</option>
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
                                <option value="upper">{t("upperCase")}</option>
                                <option value="lower">{t("lowerCase")}</option>
                                <option value="title">{t("titleCase")}</option>
                                <option value="keep">{t("keepCase")}</option>
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
                              aria-label={t("clearLetterCase")}
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
                                aria-label={t("clearSeparator")}
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
                                  aria-label={t("separatorPreset")}
                                >
                                  <option value="-">-</option>
                                  <option value="_">_</option>
                                  <option value="/">/</option>
                                  <option value="none">{tc("none")}</option>
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
                            aria-label={t("removeSkuRule")}
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
                      skuTarget === "simple"
                        ? newSkuRule({ source: "custom", customText: "", separator: "-" })
                        : newSkuRule({
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
                  {t("addRule")}
                </button>

                <div className="grid gap-3">
                  <h3 className="text-base font-medium">{t("skuPreview")}</h3>
                  <div className="grid min-h-28 place-items-center rounded-md border border-dashed border-amber-500/80 bg-amber-50/70 px-6 py-8 text-center text-2xl font-semibold text-foreground dark:bg-amber-950/20">
                    {skuPreview || "BRA-001"}
                  </div>
                </div>
              </div>

              <div className="flex gap-3 border-t border-border px-6 py-5">
                <Button type="button" onClick={applySkuGenerator}>
                  {t("generateSkuAction")}
                </Button>
                <Button type="button" variant="outline" onClick={() => setShowSkuModal(false)}>
                  {tc("cancel")}
                </Button>
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </form>
  );
}
