import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import type {
  EnhancedCustomFieldValueInput,
  InventoryCustomFieldDefinition,
  InventoryProductImportPreview,
  ProductCsvImportMode,
} from "@/lib/warehouse/inventory-types";
import { InventoryProductsService, type ServiceResult } from "./inventory-products.service";

function serviceError(result: ServiceResult<unknown>) {
  return (result as { success: false; error: string }).error;
}

function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = "";
  let inQuotes = false;

  for (let index = 0; index < text.length; index += 1) {
    const char = text[index];
    const next = text[index + 1];
    if (char === '"' && inQuotes && next === '"') {
      cell += '"';
      index += 1;
      continue;
    }
    if (char === '"') {
      inQuotes = !inQuotes;
      continue;
    }
    if (char === "," && !inQuotes) {
      row.push(cell);
      cell = "";
      continue;
    }
    if ((char === "\n" || char === "\r") && !inQuotes) {
      if (char === "\r" && next === "\n") index += 1;
      row.push(cell);
      rows.push(row);
      row = [];
      cell = "";
      continue;
    }
    cell += char;
  }

  row.push(cell);
  if (row.some((value) => value.trim())) rows.push(row);
  return rows;
}

function csvEscape(value: unknown) {
  const text = String(value ?? "");
  return /[",\n\r]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text;
}

function numberOrNull(value: string | undefined) {
  if (!value?.trim()) return null;
  const number = Number(value.replace(",", "."));
  return Number.isFinite(number) ? number : null;
}

function safeSplitTokens(value: string) {
  return value
    .split(/[|,\n]/)
    .map((item) => item.trim())
    .filter(Boolean);
}

function skuCollisionFingerprint(value: string | null | undefined) {
  return (value ?? "")
    .trim()
    .toUpperCase()
    .replace(/[^\p{L}\p{N}]/gu, "");
}

function customFieldInputFromCsv(
  definition: InventoryCustomFieldDefinition,
  rawValue: string | undefined,
  entityType: "product" | "variant",
  variantSku?: string | null
): EnhancedCustomFieldValueInput | null {
  const value = rawValue?.trim() ?? "";
  if (!value) return null;
  const input: EnhancedCustomFieldValueInput = {
    field_id: definition.id,
    entity_type: entityType,
    variant_sku: entityType === "variant" ? variantSku : null,
  };
  if (definition.field_type === "number") {
    const number = numberOrNull(value);
    if (number == null) return null;
    return { ...input, value_number: number };
  }
  if (definition.field_type === "date") {
    return { ...input, value_date: value };
  }
  if (definition.field_type === "boolean") {
    const normalized = value.toLowerCase();
    return {
      ...input,
      value_boolean: ["true", "1", "yes", "y", "tak"].includes(normalized),
    };
  }
  if (definition.field_type === "multi_select") {
    return { ...input, value_json: safeSplitTokens(value) };
  }
  return { ...input, value_text: value };
}

export class InventoryProductImportsService {
  static async previewProductCsvImport(
    supabase: SupabaseClient,
    orgId: string,
    csvText: string
  ): Promise<ServiceResult<InventoryProductImportPreview>> {
    const rows = parseCsv(csvText);
    if (rows.length === 0) {
      return { success: false, error: "Import file is empty" };
    }

    const [header, ...records] = rows;
    const headers = header.map((value) => value.trim().toLowerCase());
    const rowObjects = records
      .filter((record) => record.some((value) => value.trim()))
      .map((record, index) => ({
        row_number: index + 2,
        values: Object.fromEntries(
          headers.map((name, cellIndex) => [name, record[cellIndex]?.trim() ?? ""])
        ),
      }));

    const skuValues = rowObjects
      .map((row) => row.values.variant_sku || row.values.sku || row.values.product_sku || "")
      .filter(Boolean);
    const [unitsResult, collisionsResult, existingVariantsResult] = await Promise.all([
      InventoryProductsService.listUnits(supabase, orgId),
      InventoryProductsService.checkSkuCollisions(supabase, orgId, skuValues),
      (supabase as any)
        .from("inventory_variants")
        .select("sku")
        .eq("organization_id", orgId)
        .is("deleted_at", null),
    ]);
    if (!unitsResult.success) return { success: false, error: serviceError(unitsResult) };
    if (!collisionsResult.success) return { success: false, error: serviceError(collisionsResult) };
    if (existingVariantsResult.error)
      return { success: false, error: existingVariantsResult.error.message };

    const existingUnitCodes = new Set(unitsResult.data.map((unit) => unit.code.toLowerCase()));
    const existingSkus = new Set(
      collisionsResult.data.map((collision) => collision.sku.toLowerCase())
    );
    const existingSkuFingerprints = new Set(
      ((existingVariantsResult.data ?? []) as Array<{ sku: string | null }>)
        .map((variant) => skuCollisionFingerprint(variant.sku))
        .filter(Boolean)
    );
    const duplicateSkus = new Set(
      skuValues
        .map((sku) => skuCollisionFingerprint(sku))
        .filter(Boolean)
        .filter((sku, index, all) => all.indexOf(sku) !== index)
    );

    const previewRows = rowObjects.map(({ row_number, values }) => {
      const productName = values.product_name || values.name || values.item_name || "";
      const productSku = values.product_sku || null;
      const variantName = values.variant_name || productName;
      const variantSku = values.variant_sku || values.sku || productSku || "";
      const unitCode = values.unit_code || values.unit || "";
      const errors: string[] = [];
      if (!productName) errors.push("Missing product_name");
      if (!variantName) errors.push("Missing variant_name");
      if (!variantSku) errors.push("Missing variant_sku");
      if (!unitCode) errors.push("Missing unit_code");
      if (unitCode && !existingUnitCodes.has(unitCode.toLowerCase()))
        errors.push(`Unknown unit_code: ${unitCode}`);
      const variantSkuFingerprint = skuCollisionFingerprint(variantSku);
      if (
        variantSku &&
        (existingSkus.has(variantSku.toLowerCase()) ||
          existingSkuFingerprints.has(variantSkuFingerprint))
      )
        errors.push(`SKU already exists: ${variantSku}`);
      if (variantSku && duplicateSkus.has(variantSkuFingerprint))
        errors.push(`Duplicate SKU in file: ${variantSku}`);
      return {
        row_number,
        product_name: productName,
        product_sku: productSku,
        variant_name: variantName,
        variant_sku: variantSku,
        unit_code: unitCode,
        errors,
      };
    });

    return {
      success: true,
      data: {
        rows: previewRows,
        total_rows: previewRows.length,
        valid_rows: previewRows.filter((row) => row.errors.length === 0).length,
        invalid_rows: previewRows.filter((row) => row.errors.length > 0).length,
      },
    };
  }

  static async importProductsFromCsv(
    supabase: SupabaseClient,
    orgId: string,
    csvText: string,
    userId: string,
    mode: ProductCsvImportMode = "create_only"
  ): Promise<
    ServiceResult<{
      imported_products: number;
      imported_variants: number;
      skipped_rows: number;
      job_id: string;
    }>
  > {
    const preview = await InventoryProductImportsService.previewProductCsvImport(
      supabase,
      orgId,
      csvText
    );
    if (!preview.success) return { success: false, error: serviceError(preview) };
    const invalid = preview.data.rows.find(
      (row) =>
        row.errors.length > 0 &&
        !(
          mode === "skip_existing" &&
          row.errors.every((error) => error.startsWith("SKU already exists"))
        )
    );
    if (invalid) {
      return {
        success: false,
        error: `Import has validation errors on row ${invalid.row_number}: ${invalid.errors.join(", ")}`,
      };
    }

    const client = supabase as any;
    const { data: job, error: jobError } = await client
      .from("inventory_import_jobs")
      .insert({
        organization_id: orgId,
        import_type: "products",
        status: "processing",
        file_name: "products.csv",
        summary: { total_rows: preview.data.total_rows, mode },
        created_by: userId,
      })
      .select("id")
      .single();
    if (jobError) return { success: false, error: jobError.message };

    const rows = parseCsv(csvText);
    const [header, ...records] = rows;
    const headers = header.map((value) => value.trim().toLowerCase());
    const units = await InventoryProductsService.listUnits(supabase, orgId);
    if (!units.success) return { success: false, error: serviceError(units) };
    const unitByCode = new Map(units.data.map((unit) => [unit.code.toLowerCase(), unit.id]));
    const customFields = await InventoryProductsService.listCustomFields(supabase, orgId, [
      "product",
      "variant",
    ]);
    if (!customFields.success) return { success: false, error: serviceError(customFields) };
    const customFieldById = new Map(
      customFields.data.map((field) => [field.id.toLowerCase(), field])
    );
    const customColumns = headers.flatMap((headerName) => {
      const match = /^custom_(product|variant)_([0-9a-f-]{36})$/i.exec(headerName);
      if (!match) return [];
      const definition = customFieldById.get(match[2].toLowerCase());
      if (!definition || definition.entity_type !== match[1]) return [];
      return [{ headerName, definition }];
    });

    const groups = new Map<string, Array<Record<string, string>>>();
    for (const record of records) {
      if (!record.some((value) => value.trim())) continue;
      const row = Object.fromEntries(
        headers.map((name, cellIndex) => [name, record[cellIndex]?.trim() ?? ""])
      );
      const productName = row.product_name || row.name || row.item_name || "";
      const productSku = row.product_sku || "";
      const key = `${productSku.toLowerCase()}::${productName.toLowerCase()}`;
      groups.set(key, [...(groups.get(key) ?? []), row]);
    }

    let importedProducts = 0;
    let importedVariants = 0;
    let skippedRows = 0;
    for (const groupRows of groups.values()) {
      const importableRows =
        mode === "skip_existing"
          ? groupRows.filter((row) => {
              const sku = (row.variant_sku || row.sku || row.product_sku || "").toLowerCase();
              const previewRow = preview.data.rows.find(
                (item) => item.variant_sku.toLowerCase() === sku
              );
              return !previewRow?.errors.some((error) => error.startsWith("SKU already exists"));
            })
          : groupRows;
      skippedRows += groupRows.length - importableRows.length;
      if (importableRows.length === 0) continue;
      const first = importableRows[0];
      const productName = first.product_name || first.name || first.item_name || "";
      const unitCode = first.unit_code || first.unit || "";
      const baseUnitId = unitByCode.get(unitCode.toLowerCase());
      if (!baseUnitId) continue;

      const variants = importableRows.map((row) => ({
        sku: row.variant_sku || row.sku || row.product_sku,
        name: row.variant_name || row.product_name || row.name || row.item_name,
        barcode: row.barcode || null,
        upc: row.upc || null,
        ean: row.ean || null,
        isbn: row.isbn || null,
        mpn: row.mpn || null,
        purchase_price: numberOrNull(row.purchase_price || row.cost_price),
        sales_price: numberOrNull(row.sales_price || row.selling_price),
        price_currency: row.currency || "PLN",
        reorder_point: numberOrNull(row.reorder_point),
        options: {},
      }));
      const productCustomFields = customColumns.flatMap(({ headerName, definition }) => {
        if (definition.entity_type !== "product") return [];
        const input = customFieldInputFromCsv(definition, first[headerName], "product");
        return input ? [input] : [];
      });
      const variantCustomFields = importableRows.flatMap((row) => {
        const variantSku = row.variant_sku || row.sku || row.product_sku;
        return customColumns.flatMap(({ headerName, definition }) => {
          if (definition.entity_type !== "variant") return [];
          const input = customFieldInputFromCsv(definition, row[headerName], "variant", variantSku);
          return input ? [input] : [];
        });
      });

      const result = await InventoryProductsService.createEnhancedProduct(
        supabase,
        orgId,
        {
          name: productName,
          product_type: first.product_type || "stocked",
          base_unit_id: baseUnitId,
          sku: first.product_sku || null,
          description: first.description || null,
          returnable: (first.returnable || "true").toLowerCase() !== "false",
          brand_name: first.brand || null,
          manufacturer_name: first.manufacturer || null,
          sales_account_code: first.sales_account_code || first.sales_account || null,
          purchase_account_code: first.purchase_account_code || first.purchase_account || null,
          tax_code: first.tax_code || first.tax || null,
          tax_rate_percent: numberOrNull(
            first.tax_rate_percent || first.tax_rate || first.vat_rate
          ),
          tags: safeSplitTokens(first.tags || ""),
          custom_fields: [...productCustomFields, ...variantCustomFields],
          variants,
          track_inventory: false,
        },
        userId
      );
      if (!result.success) {
        await client
          .from("inventory_import_jobs")
          .update({
            status: "failed",
            error_message: serviceError(result),
            completed_at: new Date().toISOString(),
          })
          .eq("id", (job as { id: string }).id);
        return { success: false, error: serviceError(result) };
      }
      importedProducts += 1;
      importedVariants += result.data.variant_ids.length;
    }

    await client
      .from("inventory_import_jobs")
      .update({
        status: "completed",
        summary: {
          imported_products: importedProducts,
          imported_variants: importedVariants,
          skipped_rows: skippedRows,
          mode,
        },
        completed_at: new Date().toISOString(),
      })
      .eq("id", (job as { id: string }).id);

    return {
      success: true,
      data: {
        imported_products: importedProducts,
        imported_variants: importedVariants,
        skipped_rows: skippedRows,
        job_id: (job as { id: string }).id,
      },
    };
  }

  static async exportProductsCsv(
    supabase: SupabaseClient,
    orgId: string,
    userId: string
  ): Promise<ServiceResult<{ csv: string; file_name: string; job_id: string }>> {
    const client = supabase as any;
    const { data: job, error: jobError } = await client
      .from("inventory_export_jobs")
      .insert({
        organization_id: orgId,
        export_type: "products",
        status: "processing",
        created_by: userId,
      })
      .select("id")
      .single();
    if (jobError) return { success: false, error: jobError.message };

    const products = await InventoryProductsService.listProducts(supabase, orgId, {
      search: "",
      sort: { field: "name", direction: "asc" },
      page: 1,
      pageSize: 200,
      filters: {},
    });
    if (!products.success) return { success: false, error: serviceError(products) };

    const header = [
      "product_name",
      "product_sku",
      "product_type",
      "unit_code",
      "variant_name",
      "variant_sku",
      "barcode",
      "purchase_price",
      "sales_price",
      "sales_account_code",
      "purchase_account_code",
      "tax_code",
      "tax_rate_percent",
      "reorder_point",
      "tags",
    ];
    const lines = [header.join(",")];
    for (const product of products.data.rows) {
      for (const variant of product.variants) {
        lines.push(
          [
            product.name,
            product.sku,
            product.product_type,
            product.unit_code,
            variant.name,
            variant.sku,
            variant.barcode ?? "",
            variant.purchase_price ?? "",
            variant.sales_price ?? "",
            product.sales_account_code ?? "",
            product.purchase_account_code ?? "",
            product.tax_code ?? "",
            product.tax_rate_percent ?? "",
            variant.reorder_point ?? "",
            product.tags.join("|"),
          ]
            .map(csvEscape)
            .join(",")
        );
      }
    }
    const csv = `${lines.join("\n")}\n`;
    await client
      .from("inventory_export_jobs")
      .update({
        status: "completed",
        summary: { exported_rows: lines.length - 1 },
        completed_at: new Date().toISOString(),
      })
      .eq("id", (job as { id: string }).id);

    return {
      success: true,
      data: {
        csv,
        file_name: `inventory-products-${new Date().toISOString().slice(0, 10)}.csv`,
        job_id: (job as { id: string }).id,
      },
    };
  }
}
