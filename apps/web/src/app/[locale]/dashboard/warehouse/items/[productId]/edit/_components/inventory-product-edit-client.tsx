"use client";

import { useMemo, useState, useTransition } from "react";
import Image from "next/image";
import { ArrowLeft, ImageIcon, Plus, Save, Star, Trash2, X } from "lucide-react";
import { Link, useRouter } from "@/i18n/navigation";
import {
  createInventoryBrandAction,
  createInventoryManufacturerAction,
  setInventoryCustomFieldValueAction,
  updateInventoryProductAction,
  updateInventoryProductImagesAction,
  uploadInventoryItemImageAction,
} from "@/app/actions/warehouse/inventory";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type {
  InventoryCustomFieldDefinition,
  InventoryMasterDataRow,
  InventoryProductDetail,
  InventoryProductImageRow,
  InventoryProductUnitConversionRow,
} from "@/server/services/inventory-products.service";
import { cn } from "@/utils";

type UnitOption = { id: string; code: string; name: string };
type SupplierOption = { id: string; name: string };
type CustomFieldTarget = "product" | "variant";

const selectClass =
  "h-9 rounded-md border border-input bg-background px-3 text-sm text-foreground shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring";
const textareaClass =
  "rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring";

function n(value: number | null) {
  return value == null ? "" : String(value);
}

function textOrNull(value: FormDataEntryValue | null) {
  const text = String(value ?? "").trim();
  return text || null;
}

function numberOrNull(value: FormDataEntryValue | null) {
  const text = String(value ?? "").trim();
  if (!text) return null;
  const number = Number(text);
  return Number.isFinite(number) ? number : null;
}

function safeParseTokens(value: string) {
  if (!value.trim()) return [];
  try {
    const parsed = JSON.parse(value);
    if (Array.isArray(parsed)) return parsed.map((item) => String(item).trim()).filter(Boolean);
  } catch {
    // Legacy comma-separated values are still accepted.
  }
  return value
    .split(/[,\n]/)
    .map((item) => item.trim())
    .filter(Boolean);
}

function customFieldPayload(
  field: InventoryCustomFieldDefinition,
  value: string | boolean | string[],
  target: { product_id?: string | null; variant_id?: string | null }
) {
  const base = {
    field_id: field.id,
    product_id: target.product_id ?? null,
    variant_id: target.variant_id ?? null,
    lot_id: null,
    serial_id: null,
  };
  if (field.field_type === "boolean") return { ...base, value_boolean: Boolean(value) };
  if (field.field_type === "number") {
    const number = Number(value);
    return Number.isFinite(number) ? { ...base, value_number: number } : base;
  }
  if (field.field_type === "date") return value ? { ...base, value_date: String(value) } : base;
  if (field.field_type === "multi_select") {
    const tokens = Array.isArray(value) ? value : safeParseTokens(String(value));
    return tokens.length ? { ...base, value_json: tokens } : base;
  }
  return value ? { ...base, value_text: String(value) } : base;
}

export function InventoryProductEditClient({
  product,
  units,
  suppliers,
  brands,
  manufacturers,
  customFields,
}: {
  product: InventoryProductDetail;
  units: UnitOption[];
  suppliers: SupplierOption[];
  brands: InventoryMasterDataRow[];
  manufacturers: InventoryMasterDataRow[];
  customFields: InventoryCustomFieldDefinition[];
}) {
  const router = useRouter();
  const [message, setMessage] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const [tags, setTags] = useState(product.tags);
  const [tagDraft, setTagDraft] = useState("");
  const [images, setImages] = useState(product.images.filter((image) => !image.variant_id));
  const [variantImages, setVariantImages] = useState(
    product.images.filter((image) => image.variant_id)
  );
  const [unitConversions, setUnitConversions] = useState<
    Array<InventoryProductUnitConversionRow & { draftId: string; factorText: string }>
  >(
    product.unit_conversions.map((conversion) => ({
      ...conversion,
      draftId: conversion.id,
      factorText: String(conversion.factor),
    }))
  );
  const [brandOptions, setBrandOptions] = useState(brands);
  const [manufacturerOptions, setManufacturerOptions] = useState(manufacturers);
  const [brandDraft, setBrandDraft] = useState("");
  const [manufacturerDraft, setManufacturerDraft] = useState("");
  const productCustomFields = customFields.filter((field) => field.entity_type === "product");
  const variantCustomFields = customFields.filter((field) => field.entity_type === "variant");
  const [productCustomTokens, setProductCustomTokens] = useState<Record<string, string[]>>(() =>
    Object.fromEntries(
      productCustomFields
        .filter((field) => field.field_type === "multi_select")
        .map((field) => [field.id, safeParseTokens(product.custom_field_values[field.id] ?? "")])
    )
  );
  const [variantCustomValues, setVariantCustomValues] = useState<
    Record<string, Record<string, string>>
  >(() =>
    Object.fromEntries(
      product.variants.map((variant) => [variant.id, { ...variant.custom_field_values }])
    )
  );
  const [variantCustomTokens, setVariantCustomTokens] = useState<
    Record<string, Record<string, string[]>>
  >(() =>
    Object.fromEntries(
      product.variants.map((variant) => [
        variant.id,
        Object.fromEntries(
          variantCustomFields
            .filter((field) => field.field_type === "multi_select")
            .map((field) => [
              field.id,
              safeParseTokens(variant.custom_field_values[field.id] ?? ""),
            ])
        ),
      ])
    )
  );

  const primaryImageId = useMemo(
    () => images.find((image) => image.is_primary)?.id ?? images[0]?.id ?? null,
    [images]
  );

  const save = (formData: FormData) => {
    setMessage(null);
    startTransition(async () => {
      const result = await updateInventoryProductAction({
        id: product.id,
        name: String(formData.get("name") ?? ""),
        description: textOrNull(formData.get("description")),
        status: String(formData.get("status") ?? "active"),
        product_type: String(formData.get("product_type") ?? "stocked"),
        base_unit_id: String(formData.get("base_unit_id") ?? product.base_unit_id),
        returnable: formData.get("returnable") === "on",
        brand_name: textOrNull(formData.get("brand_name")),
        manufacturer_name: textOrNull(formData.get("manufacturer_name")),
        length_value: numberOrNull(formData.get("length_value")),
        width_value: numberOrNull(formData.get("width_value")),
        height_value: numberOrNull(formData.get("height_value")),
        dimension_unit: textOrNull(formData.get("dimension_unit")),
        weight_value: numberOrNull(formData.get("weight_value")),
        weight_unit: textOrNull(formData.get("weight_unit")),
        sales_description: textOrNull(formData.get("sales_description")),
        purchase_description: textOrNull(formData.get("purchase_description")),
        preferred_supplier_id: textOrNull(formData.get("preferred_supplier_id")),
        tags,
        unit_conversions: unitConversions
          .map((conversion) => ({
            from_unit_id: conversion.from_unit_id,
            to_unit_id: conversion.to_unit_id,
            factor: Number(conversion.factorText),
            rounding_mode: conversion.rounding_mode,
          }))
          .filter(
            (conversion) =>
              conversion.from_unit_id && conversion.to_unit_id && conversion.factor > 0
          ),
      });
      setMessage(
        result.success ? "Product saved" : "error" in result ? result.error : "Unexpected error"
      );
      if (!result.success) return;

      for (const field of productCustomFields) {
        const value =
          field.field_type === "multi_select"
            ? (productCustomTokens[field.id] ?? [])
            : field.field_type === "boolean"
              ? formData.get(`custom_field_${field.id}`) === "on"
              : String(formData.get(`custom_field_${field.id}`) ?? "");
        const customResult = await setInventoryCustomFieldValueAction(
          customFieldPayload(field, value, { product_id: product.id })
        );
        if (!customResult.success) {
          setMessage("error" in customResult ? customResult.error : "Custom field save failed");
          return;
        }
      }

      for (const variant of product.variants) {
        for (const field of variantCustomFields) {
          const value =
            field.field_type === "multi_select"
              ? (variantCustomTokens[variant.id]?.[field.id] ?? [])
              : field.field_type === "boolean"
                ? variantCustomValues[variant.id]?.[field.id] === "true" ||
                  variantCustomValues[variant.id]?.[field.id] === "Yes"
                : (variantCustomValues[variant.id]?.[field.id] ?? "");
          const customResult = await setInventoryCustomFieldValueAction(
            customFieldPayload(field, value, { variant_id: variant.id })
          );
          if (!customResult.success) {
            setMessage("error" in customResult ? customResult.error : "Custom field save failed");
            return;
          }
        }
      }

      router.refresh();
    });
  };

  const uploadImages = (files: FileList | null) => {
    if (!files) return;
    const imageFiles = Array.from(files).filter((file) => file.type.startsWith("image/"));
    startTransition(async () => {
      for (const file of imageFiles.slice(0, 15 - images.length)) {
        const formData = new FormData();
        formData.set("product_id", product.id);
        formData.set("is_primary", String(images.length === 0));
        formData.set("file", file);
        const result = await uploadInventoryItemImageAction(formData);
        if (!result.success || !("data" in result)) {
          setMessage("error" in result ? result.error : "Image upload failed");
          return;
        }
        setImages((current) => [
          ...current,
          {
            product_id: product.id,
            variant_id: null,
            sort_order: current.length,
            is_primary: current.length === 0,
            ...result.data,
          } as InventoryProductImageRow,
        ]);
      }
    });
  };

  const handleImageDrop = (event: React.DragEvent<HTMLElement>) => {
    event.preventDefault();
    event.stopPropagation();
    uploadImages(event.dataTransfer.files);
  };

  const syncImages = (nextImages: InventoryProductImageRow[]) => {
    setImages(nextImages);
    startTransition(async () => {
      const result = await updateInventoryProductImagesAction({
        product_id: product.id,
        images: nextImages.map((image, index) => ({
          id: image.id,
          sort_order: index,
          is_primary: image.id === primaryImageId,
        })),
      });
      if (!result.success) setMessage("error" in result ? result.error : "Image update failed");
    });
  };

  const setPrimaryImage = (imageId: string) => {
    const nextImages = images.map((image) => ({ ...image, is_primary: image.id === imageId }));
    setImages(nextImages);
    startTransition(async () => {
      const result = await updateInventoryProductImagesAction({
        product_id: product.id,
        images: [{ id: imageId, is_primary: true }],
      });
      if (!result.success) setMessage("error" in result ? result.error : "Image update failed");
    });
  };

  const removeImage = (imageId: string) => {
    setImages((current) => current.filter((image) => image.id !== imageId));
    startTransition(async () => {
      const result = await updateInventoryProductImagesAction({
        product_id: product.id,
        images: [{ id: imageId, deleted: true }],
      });
      if (!result.success) setMessage("error" in result ? result.error : "Image update failed");
    });
  };

  const uploadVariantImages = (variantId: string, files: FileList | null) => {
    if (!files) return;
    const currentImages = variantImages.filter((image) => image.variant_id === variantId);
    startTransition(async () => {
      for (const file of Array.from(files).slice(0, 15 - currentImages.length)) {
        const formData = new FormData();
        formData.set("product_id", product.id);
        formData.set("variant_id", variantId);
        formData.set("is_primary", String(currentImages.length === 0));
        formData.set("file", file);
        const result = await uploadInventoryItemImageAction(formData);
        if (!result.success || !("data" in result)) {
          setMessage("error" in result ? result.error : "Variant image upload failed");
          return;
        }
        setVariantImages((current) => [
          ...current,
          {
            product_id: product.id,
            variant_id: variantId,
            sort_order: current.filter((image) => image.variant_id === variantId).length,
            is_primary: currentImages.length === 0,
            ...result.data,
          } as InventoryProductImageRow,
        ]);
      }
    });
  };

  const setPrimaryVariantImage = (variantId: string, imageId: string) => {
    setVariantImages((current) =>
      current.map((image) =>
        image.variant_id === variantId ? { ...image, is_primary: image.id === imageId } : image
      )
    );
    startTransition(async () => {
      const result = await updateInventoryProductImagesAction({
        product_id: product.id,
        variant_id: variantId,
        images: [{ id: imageId, is_primary: true }],
      });
      if (!result.success)
        setMessage("error" in result ? result.error : "Variant image update failed");
    });
  };

  const removeVariantImage = (variantId: string, imageId: string) => {
    setVariantImages((current) => current.filter((image) => image.id !== imageId));
    startTransition(async () => {
      const result = await updateInventoryProductImagesAction({
        product_id: product.id,
        variant_id: variantId,
        images: [{ id: imageId, deleted: true }],
      });
      if (!result.success)
        setMessage("error" in result ? result.error : "Variant image update failed");
    });
  };

  const createBrand = () => {
    const name = brandDraft.trim();
    if (!name) return;
    startTransition(async () => {
      const result = await createInventoryBrandAction({ name });
      if (result.success && "data" in result) {
        setBrandOptions((current) =>
          [...current, result.data].sort((a, b) => a.name.localeCompare(b.name))
        );
        setBrandDraft("");
      } else {
        setMessage("error" in result ? result.error : "Brand could not be created");
      }
    });
  };

  const createManufacturer = () => {
    const name = manufacturerDraft.trim();
    if (!name) return;
    startTransition(async () => {
      const result = await createInventoryManufacturerAction({ name });
      if (result.success && "data" in result) {
        setManufacturerOptions((current) =>
          [...current, result.data].sort((a, b) => a.name.localeCompare(b.name))
        );
        setManufacturerDraft("");
      } else {
        setMessage("error" in result ? result.error : "Manufacturer could not be created");
      }
    });
  };

  return (
    <form
      action={save}
      className="flex min-h-[calc(100vh-4rem)] flex-col bg-background text-foreground"
    >
      <div className="mx-auto grid w-full max-w-7xl gap-6 px-6 py-6">
        <div className="flex items-center justify-between gap-3">
          <div>
            <h1 className="text-2xl font-semibold">Edit product</h1>
            <p className="text-sm text-muted-foreground">{product.sku}</p>
          </div>
          <Button asChild type="button" variant="outline">
            <Link
              href={{
                pathname: "/dashboard/warehouse/items/[productId]",
                params: { productId: product.id },
              }}
            >
              <ArrowLeft className="mr-2 h-4 w-4" />
              Product
            </Link>
          </Button>
        </div>

        {message ? (
          <p className="rounded-md border border-border bg-muted/30 px-3 py-2 text-sm">{message}</p>
        ) : null}

        <section className="grid gap-4 lg:grid-cols-[1fr_320px]">
          <div className="grid gap-4">
            <FormField label="Name" name="name" defaultValue={product.name} required />
            <FormField label="SKU" value={product.sku} disabled />
            <div className="grid items-center gap-3 md:grid-cols-[170px_1fr]">
              <label className="text-sm">Type</label>
              <select
                name="product_type"
                defaultValue={product.product_type}
                className={selectClass}
              >
                {["stocked", "consumable", "service", "serialized", "lot_tracked", "bundle"].map(
                  (type) => (
                    <option key={type} value={type}>
                      {type.replace("_", " ")}
                    </option>
                  )
                )}
              </select>
            </div>
            <div className="grid items-center gap-3 md:grid-cols-[170px_1fr]">
              <label className="text-sm">Base unit</label>
              <select
                name="base_unit_id"
                defaultValue={product.base_unit_id}
                className={selectClass}
              >
                {units.map((unit) => (
                  <option key={unit.id} value={unit.id}>
                    {unit.code} - {unit.name}
                  </option>
                ))}
              </select>
            </div>
            <div className="grid items-start gap-3 md:grid-cols-[170px_1fr]">
              <label className="pt-2 text-sm">Description</label>
              <textarea
                name="description"
                defaultValue={product.description ?? ""}
                className={cn(textareaClass, "min-h-20")}
              />
            </div>
            <div className="grid items-start gap-3 md:grid-cols-[170px_1fr]">
              <label className="pt-2 text-sm">Tags</label>
              <TagsInput
                tags={tags}
                draft={tagDraft}
                onDraftChange={setTagDraft}
                onChange={setTags}
              />
            </div>
            <label className="flex items-center gap-2 text-sm md:ml-[170px]">
              <input type="checkbox" name="returnable" defaultChecked={product.returnable} />
              Returnable item
            </label>
          </div>

          <div className="grid gap-3">
            <label
              className="flex min-h-36 cursor-pointer flex-col items-center justify-center rounded-md border border-dashed border-border bg-muted/30 p-4 text-center text-sm text-muted-foreground transition-colors hover:bg-muted/50"
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
              onDrop={handleImageDrop}
            >
              <ImageIcon className="mb-2 h-8 w-8" />
              Browse images
              <input
                type="file"
                accept="image/*"
                multiple
                className="hidden"
                onChange={(event) => uploadImages(event.target.files)}
              />
            </label>
            {images.length > 0 ? (
              <div className="grid grid-cols-5 gap-2">
                {images.map((image, index) => {
                  const url = image.public_url ?? image.storage_path;
                  return (
                    <div key={image.id} className="relative h-14 w-14">
                      {url ? (
                        <Image
                          src={url}
                          alt=""
                          width={56}
                          height={56}
                          unoptimized
                          className="h-14 w-14 rounded-md object-cover"
                        />
                      ) : null}
                      <button
                        type="button"
                        className="absolute -left-1 -top-1 grid h-5 w-5 place-items-center rounded-full border bg-background"
                        onClick={() => setPrimaryImage(image.id)}
                        aria-label="Set primary image"
                      >
                        <Star className={cn("h-3 w-3", image.is_primary && "text-primary")} />
                      </button>
                      <button
                        type="button"
                        className="absolute -right-1 -top-1 grid h-5 w-5 place-items-center rounded-full border bg-background text-destructive"
                        onClick={() => removeImage(image.id)}
                        aria-label="Remove image"
                      >
                        <X className="h-3 w-3" />
                      </button>
                      <div className="absolute bottom-0 left-0 right-0 flex justify-center gap-1 bg-background/80">
                        <button
                          type="button"
                          disabled={index === 0}
                          className="text-[10px] disabled:opacity-30"
                          onClick={() => {
                            const next = [...images];
                            [next[index - 1], next[index]] = [next[index], next[index - 1]];
                            syncImages(next);
                          }}
                        >
                          Up
                        </button>
                        <button
                          type="button"
                          disabled={index === images.length - 1}
                          className="text-[10px] disabled:opacity-30"
                          onClick={() => {
                            const next = [...images];
                            [next[index], next[index + 1]] = [next[index + 1], next[index]];
                            syncImages(next);
                          }}
                        >
                          Down
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : null}
            {product.variant_count > 1 ? (
              <div className="grid gap-3 rounded-md border border-border p-3">
                <h3 className="text-sm font-medium">Variant galleries</h3>
                {product.variants.map((variant) => {
                  const rows = variantImages.filter((image) => image.variant_id === variant.id);
                  return (
                    <div
                      key={variant.id}
                      className="grid gap-2 border-t border-border pt-3 first:border-t-0 first:pt-0"
                    >
                      <div className="flex items-center justify-between gap-3">
                        <div className="min-w-0">
                          <p className="truncate text-sm font-medium">{variant.name}</p>
                          <p className="truncate text-xs text-muted-foreground">{variant.sku}</p>
                        </div>
                        <label className="inline-flex h-8 cursor-pointer items-center gap-2 rounded-md border border-border px-2 text-xs hover:bg-muted">
                          <Plus className="h-3.5 w-3.5" />
                          Add
                          <input
                            type="file"
                            accept="image/*"
                            multiple
                            className="hidden"
                            onChange={(event) =>
                              uploadVariantImages(variant.id, event.target.files)
                            }
                          />
                        </label>
                      </div>
                      {rows.length > 0 ? (
                        <div className="flex flex-wrap gap-2">
                          {rows.map((image) => {
                            const url = image.public_url ?? image.storage_path;
                            return (
                              <div key={image.id} className="relative h-12 w-12">
                                {url ? (
                                  <Image
                                    src={url}
                                    alt=""
                                    width={48}
                                    height={48}
                                    unoptimized
                                    className="h-12 w-12 rounded-md object-cover"
                                  />
                                ) : null}
                                <button
                                  type="button"
                                  className="absolute -left-1 -top-1 grid h-5 w-5 place-items-center rounded-full border bg-background"
                                  onClick={() => setPrimaryVariantImage(variant.id, image.id)}
                                  aria-label="Set primary variant image"
                                >
                                  <Star
                                    className={cn("h-3 w-3", image.is_primary && "text-primary")}
                                  />
                                </button>
                                <button
                                  type="button"
                                  className="absolute -right-1 -top-1 grid h-5 w-5 place-items-center rounded-full border bg-background text-destructive"
                                  onClick={() => removeVariantImage(variant.id, image.id)}
                                  aria-label="Remove variant image"
                                >
                                  <X className="h-3 w-3" />
                                </button>
                              </div>
                            );
                          })}
                        </div>
                      ) : (
                        <p className="text-xs text-muted-foreground">
                          Uses product gallery until variant images are added.
                        </p>
                      )}
                    </div>
                  );
                })}
              </div>
            ) : null}
          </div>
        </section>

        {productCustomFields.length > 0 || variantCustomFields.length > 0 ? (
          <section className="grid gap-4">
            <div>
              <h2 className="text-lg font-medium">Custom fields</h2>
              <p className="text-sm text-muted-foreground">
                Product fields apply to the item. Variant fields apply to each stock-bearing
                variant.
              </p>
            </div>

            {productCustomFields.length > 0 ? (
              <div className="grid gap-4 rounded-md border border-border p-4 lg:grid-cols-2">
                {productCustomFields.map((field) => (
                  <CustomFieldControl
                    key={field.id}
                    field={field}
                    target="product"
                    defaultValue={product.custom_field_values[field.id] ?? ""}
                    tokens={productCustomTokens[field.id] ?? []}
                    onTokensChange={(tokens) =>
                      setProductCustomTokens((current) => ({ ...current, [field.id]: tokens }))
                    }
                  />
                ))}
              </div>
            ) : null}

            {variantCustomFields.length > 0 ? (
              <div className="overflow-x-auto rounded-md border border-border">
                <table className="min-w-full text-sm">
                  <thead className="bg-muted/40 text-xs uppercase text-muted-foreground">
                    <tr>
                      <th className="whitespace-nowrap px-3 py-2 text-left">Variant</th>
                      <th className="whitespace-nowrap px-3 py-2 text-left">SKU</th>
                      {variantCustomFields.map((field) => (
                        <th key={field.id} className="min-w-48 px-3 py-2 text-left">
                          {field.name}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {product.variants.map((variant) => (
                      <tr key={variant.id} className="border-t border-border">
                        <td className="whitespace-nowrap px-3 py-2 font-medium">{variant.name}</td>
                        <td className="whitespace-nowrap px-3 py-2 text-muted-foreground">
                          {variant.sku}
                        </td>
                        {variantCustomFields.map((field) => (
                          <td key={field.id} className="px-3 py-2 align-top">
                            <CustomFieldControl
                              field={field}
                              target="variant"
                              compact
                              defaultValue={variant.custom_field_values[field.id] ?? ""}
                              value={variantCustomValues[variant.id]?.[field.id] ?? ""}
                              tokens={variantCustomTokens[variant.id]?.[field.id] ?? []}
                              onValueChange={(value) =>
                                setVariantCustomValues((current) => ({
                                  ...current,
                                  [variant.id]: {
                                    ...(current[variant.id] ?? {}),
                                    [field.id]: value,
                                  },
                                }))
                              }
                              onTokensChange={(tokens) =>
                                setVariantCustomTokens((current) => ({
                                  ...current,
                                  [variant.id]: {
                                    ...(current[variant.id] ?? {}),
                                    [field.id]: tokens,
                                  },
                                }))
                              }
                            />
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : null}
          </section>
        ) : null}

        <section className="grid gap-4 xl:grid-cols-2">
          <div className="grid gap-4">
            <h2 className="text-lg font-medium">Sales</h2>
            <div className="grid items-start gap-3 md:grid-cols-[170px_1fr]">
              <label className="pt-2 text-sm">Description</label>
              <textarea
                name="sales_description"
                defaultValue={product.sales_description ?? ""}
                className={cn(textareaClass, "min-h-16")}
              />
            </div>
          </div>
          <div className="grid gap-4">
            <h2 className="text-lg font-medium">Purchase</h2>
            <div className="grid items-center gap-3 md:grid-cols-[170px_1fr]">
              <label className="text-sm">Preferred vendor</label>
              <select
                name="preferred_supplier_id"
                defaultValue={product.preferred_supplier_id ?? ""}
                className={selectClass}
              >
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
              <textarea
                name="purchase_description"
                defaultValue={product.purchase_description ?? ""}
                className={cn(textareaClass, "min-h-16")}
              />
            </div>
          </div>
        </section>

        <section className="grid gap-4 lg:grid-cols-2">
          <FormField
            label="Length"
            name="length_value"
            defaultValue={n(product.length_value)}
            type="number"
          />
          <FormField
            label="Width"
            name="width_value"
            defaultValue={n(product.width_value)}
            type="number"
          />
          <FormField
            label="Height"
            name="height_value"
            defaultValue={n(product.height_value)}
            type="number"
          />
          <FormField
            label="Dimension unit"
            name="dimension_unit"
            defaultValue={product.dimension_unit ?? ""}
          />
          <FormField
            label="Weight"
            name="weight_value"
            defaultValue={n(product.weight_value)}
            type="number"
          />
          <FormField
            label="Weight unit"
            name="weight_unit"
            defaultValue={product.weight_unit ?? ""}
          />
          <MasterField
            label="Brand"
            name="brand_name"
            options={brandOptions}
            defaultValue={product.brand_name ?? ""}
            draft={brandDraft}
            onDraftChange={setBrandDraft}
            onCreate={createBrand}
          />
          <MasterField
            label="Manufacturer"
            name="manufacturer_name"
            options={manufacturerOptions}
            defaultValue={product.manufacturer_name ?? ""}
            draft={manufacturerDraft}
            onDraftChange={setManufacturerDraft}
            onCreate={createManufacturer}
          />
        </section>

        <section className="grid gap-3">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-medium">Unit conversions</h2>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() =>
                setUnitConversions((current) => [
                  ...current,
                  {
                    id: crypto.randomUUID(),
                    draftId: crypto.randomUUID(),
                    product_id: product.id,
                    from_unit_id: product.base_unit_id,
                    to_unit_id: "",
                    factor: 0,
                    factorText: "",
                    rounding_mode: "half_up",
                  },
                ])
              }
            >
              <Plus className="mr-2 h-4 w-4" />
              Add conversion
            </Button>
          </div>
          {unitConversions.map((conversion) => (
            <div
              key={conversion.draftId}
              className="grid grid-cols-[1fr_1fr_160px_160px_44px] gap-3"
            >
              <UnitSelect
                units={units}
                value={conversion.from_unit_id}
                onChange={(value) =>
                  setUnitConversions((rows) =>
                    rows.map((row) =>
                      row.draftId === conversion.draftId ? { ...row, from_unit_id: value } : row
                    )
                  )
                }
              />
              <UnitSelect
                units={units}
                value={conversion.to_unit_id}
                onChange={(value) =>
                  setUnitConversions((rows) =>
                    rows.map((row) =>
                      row.draftId === conversion.draftId ? { ...row, to_unit_id: value } : row
                    )
                  )
                }
              />
              <Input
                value={conversion.factorText}
                type="number"
                className="h-9"
                onChange={(event) =>
                  setUnitConversions((rows) =>
                    rows.map((row) =>
                      row.draftId === conversion.draftId
                        ? { ...row, factorText: event.target.value }
                        : row
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
                      row.draftId === conversion.draftId
                        ? { ...row, rounding_mode: event.target.value as "half_up" | "up" | "down" }
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
                onClick={() =>
                  setUnitConversions((rows) =>
                    rows.filter((row) => row.draftId !== conversion.draftId)
                  )
                }
              >
                <Trash2 className="h-4 w-4 text-destructive" />
              </Button>
            </div>
          ))}
        </section>
      </div>

      <div className="sticky bottom-0 border-t bg-background/95 px-6 py-3 backdrop-blur">
        <div className="mx-auto flex max-w-7xl gap-3">
          <Button type="submit" disabled={isPending}>
            <Save className="mr-2 h-4 w-4" />
            Save
          </Button>
          <Button asChild type="button" variant="outline">
            <Link href="/dashboard/warehouse/items">
              <ArrowLeft className="mr-2 h-4 w-4" />
              Products
            </Link>
          </Button>
        </div>
      </div>
    </form>
  );
}

function FormField({
  label,
  name,
  defaultValue,
  value,
  type = "text",
  required,
  disabled,
}: {
  label: string;
  name?: string;
  defaultValue?: string;
  value?: string;
  type?: string;
  required?: boolean;
  disabled?: boolean;
}) {
  return (
    <div className="grid items-center gap-3 md:grid-cols-[170px_1fr]">
      <label className="text-sm">{label}</label>
      <Input
        name={name}
        defaultValue={defaultValue}
        value={value}
        type={type}
        required={required}
        disabled={disabled}
        className="h-9"
      />
    </div>
  );
}

function UnitSelect({
  units,
  value,
  onChange,
}: {
  units: UnitOption[];
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <select
      className={selectClass}
      value={value}
      onChange={(event) => onChange(event.target.value)}
    >
      <option value="">Select unit</option>
      {units.map((unit) => (
        <option key={unit.id} value={unit.id}>
          {unit.code}
        </option>
      ))}
    </select>
  );
}

function CustomFieldControl({
  field,
  target,
  defaultValue = "",
  value,
  tokens = [],
  onValueChange,
  onTokensChange,
  compact = false,
}: {
  field: InventoryCustomFieldDefinition;
  target: CustomFieldTarget;
  defaultValue?: string;
  value?: string;
  tokens?: string[];
  onValueChange?: (value: string) => void;
  onTokensChange?: (tokens: string[]) => void;
  compact?: boolean;
}) {
  const name = target === "product" ? `custom_field_${field.id}` : undefined;
  const label = field.is_required ? `${field.name}*` : field.name;
  const inputValue = value ?? defaultValue;

  if (field.field_type === "boolean") {
    const checked =
      target === "variant" ? inputValue === "true" || inputValue === "Yes" : undefined;
    return (
      <label className={cn("flex items-center gap-2 text-sm", !compact && "md:col-span-1")}>
        <input
          name={name}
          type="checkbox"
          defaultChecked={
            target === "product" ? defaultValue === "Yes" || defaultValue === "true" : undefined
          }
          checked={target === "variant" ? checked : undefined}
          onChange={(event) => onValueChange?.(String(event.target.checked))}
        />
        {label}
      </label>
    );
  }

  if (field.field_type === "multi_select") {
    return (
      <FieldShell label={label} compact={compact}>
        <TokenInput
          value={tokens}
          onChange={onTokensChange ?? (() => undefined)}
          placeholder={field.placeholder ?? "Type value and press Enter"}
          suggestions={field.options}
          compact={compact}
        />
      </FieldShell>
    );
  }

  if (field.field_type === "select") {
    return (
      <FieldShell label={label} compact={compact}>
        <select
          name={name}
          defaultValue={target === "product" ? defaultValue : undefined}
          value={target === "variant" ? inputValue : undefined}
          required={field.is_required}
          className={cn(selectClass, "w-full pr-9")}
          onChange={(event) => onValueChange?.(event.target.value)}
        >
          <option value="">Select</option>
          {field.options.map((option) => (
            <option key={option} value={option}>
              {option}
            </option>
          ))}
        </select>
      </FieldShell>
    );
  }

  return (
    <FieldShell label={label} compact={compact}>
      <Input
        name={name}
        type={
          field.field_type === "number" ? "number" : field.field_type === "date" ? "date" : "text"
        }
        defaultValue={target === "product" ? defaultValue : undefined}
        value={target === "variant" ? inputValue : undefined}
        required={field.is_required}
        placeholder={field.placeholder ?? undefined}
        className="h-9"
        onChange={(event) => onValueChange?.(event.target.value)}
      />
    </FieldShell>
  );
}

function FieldShell({
  label,
  compact,
  children,
}: {
  label: string;
  compact?: boolean;
  children: React.ReactNode;
}) {
  if (compact) return <div className="grid min-w-48 gap-1">{children}</div>;
  return (
    <div className="grid items-center gap-3 md:grid-cols-[170px_1fr]">
      <label className="text-sm">{label}</label>
      {children}
    </div>
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

  return (
    <div className="space-y-2">
      <div
        className={cn(
          "flex min-h-9 flex-wrap items-center gap-1.5 rounded-md border border-input bg-background px-2 py-1 text-sm shadow-sm focus-within:ring-2 focus-within:ring-ring",
          compact ? "min-w-48" : "w-full"
        )}
      >
        {value.map((token) => (
          <span
            key={token}
            className="inline-flex h-7 items-center gap-1 rounded-md bg-muted px-2 text-xs"
          >
            {token}
            <button
              type="button"
              className="rounded-sm text-muted-foreground hover:text-destructive"
              onClick={() => onChange(value.filter((item) => item !== token))}
              aria-label={`Remove ${token}`}
            >
              <X className="h-3 w-3" />
            </button>
          </span>
        ))}
        <input
          value={draft}
          placeholder={value.length === 0 ? placeholder : ""}
          className="h-7 min-w-32 flex-1 bg-transparent outline-none placeholder:text-muted-foreground"
          onChange={(event) => setDraft(event.target.value)}
          onBlur={() => {
            if (draft.trim()) addTokens(draft);
          }}
          onKeyDown={(event) => {
            if (event.key === "Enter" || event.key === "Tab") {
              if (!draft.trim()) return;
              event.preventDefault();
              addTokens(draft);
            }
            if (event.key === "Backspace" && !draft && value.length > 0) {
              onChange(value.slice(0, -1));
            }
          }}
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

function TagsInput({
  tags,
  draft,
  onDraftChange,
  onChange,
}: {
  tags: string[];
  draft: string;
  onDraftChange: (value: string) => void;
  onChange: (value: string[]) => void;
}) {
  const addDraft = () => {
    const nextTags = draft
      .split(/[,\n]/)
      .map((tag) => tag.trim())
      .filter(Boolean);
    if (nextTags.length === 0) return;

    const next = [...tags];
    const seen = new Set(next.map((tag) => tag.toLowerCase()));
    for (const tag of nextTags) {
      const key = tag.toLowerCase();
      if (seen.has(key)) continue;
      next.push(tag);
      seen.add(key);
    }
    onChange(next);
    onDraftChange("");
  };

  return (
    <div className="flex min-h-9 flex-wrap items-center gap-1.5 rounded-md border border-input bg-background px-2 py-1 text-sm shadow-sm focus-within:ring-2 focus-within:ring-ring">
      {tags.map((tag) => (
        <span
          key={tag}
          className="inline-flex h-7 items-center gap-1 rounded-md bg-muted px-2 text-xs"
        >
          {tag}
          <button
            type="button"
            className="rounded-sm text-muted-foreground hover:text-destructive"
            onClick={() => onChange(tags.filter((item) => item !== tag))}
            aria-label={`Remove ${tag}`}
          >
            <X className="h-3 w-3" />
          </button>
        </span>
      ))}
      <input
        value={draft}
        placeholder={tags.length === 0 ? "Type tag and press Enter" : ""}
        className="h-7 min-w-40 flex-1 bg-transparent outline-none placeholder:text-muted-foreground"
        onChange={(event) => onDraftChange(event.target.value)}
        onBlur={addDraft}
        onKeyDown={(event) => {
          if (event.key === "Enter") {
            event.preventDefault();
            addDraft();
          }
          if (event.key === "Backspace" && !draft && tags.length > 0) {
            onChange(tags.slice(0, -1));
          }
        }}
      />
    </div>
  );
}

function MasterField({
  label,
  name,
  options,
  defaultValue,
  draft,
  onDraftChange,
  onCreate,
}: {
  label: string;
  name: string;
  options: InventoryMasterDataRow[];
  defaultValue: string;
  draft: string;
  onDraftChange: (value: string) => void;
  onCreate: () => void;
}) {
  return (
    <div className="grid items-start gap-3 md:grid-cols-[170px_1fr]">
      <label className="pt-2 text-sm">{label}</label>
      <div className="grid gap-2">
        <Input
          name={name}
          list={`${name}-edit-options`}
          defaultValue={defaultValue}
          className="h-9"
        />
        <datalist id={`${name}-edit-options`}>
          {options.map((option) => (
            <option key={option.id} value={option.name} />
          ))}
        </datalist>
        <div className="flex gap-2">
          <Input
            value={draft}
            placeholder={`New ${label.toLowerCase()}`}
            className="h-9"
            onChange={(event) => onDraftChange(event.target.value)}
          />
          <Button type="button" variant="outline" onClick={onCreate}>
            Add
          </Button>
        </div>
      </div>
    </div>
  );
}
