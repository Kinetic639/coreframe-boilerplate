"use server";

import { createClient } from "@/utils/supabase/server";
import { eventService } from "@/server/services/event.service";
import {
  WAREHOUSE_PRODUCTS_READ,
  WAREHOUSE_PRODUCTS_MANAGE,
  WAREHOUSE_PRODUCTS_ARCHIVE,
  WAREHOUSE_INVENTORY_READ,
  WAREHOUSE_INVENTORY_OPERATE,
  WAREHOUSE_INVENTORY_ADJUST,
  WAREHOUSE_INVENTORY_REVERSE,
  WAREHOUSE_PROCUREMENT_MANAGE,
  WAREHOUSE_PRICING_MANAGE,
  WAREHOUSE_REPORTS_READ,
  WAREHOUSE_IMPORTS_MANAGE,
} from "@/lib/constants/permissions";
import { InventoryProductsService } from "@/server/services/inventory-products.service";
import { InventoryProductImportsService } from "@/server/services/inventory-product-imports.service";
import { InventoryBalancesService } from "@/server/services/inventory-balances.service";
import { InventoryMovementsService } from "@/server/services/inventory-movements.service";
import { InventoryEnterpriseService } from "@/server/services/inventory-enterprise.service";
import type { CreateDraftMovementInput } from "@/lib/warehouse/inventory-types";
import {
  hasPermission,
  mapUnexpected,
  normalizeListParams,
  requireActiveBranch,
  requireWarehouseContext,
  userIdFrom,
  type WarehouseAuth,
} from "./action-context";
import {
  archiveInventoryProductSchema,
  archiveInventoryTagSchema,
  archiveInventoryTaxRateSchema,
  archiveInventoryUnitConversionSchema,
  archiveInventoryUnitSchema,
  addCollectionItemSchema,
  acceptBranchTransferSchema,
  assignInventoryVariantGalleryImageSchema,
  approveCountSessionSchema,
  adjustStockSchema,
  checkInventorySkuCollisionsSchema,
  createBranchTransferSchema,
  createAllocationSchema,
  createCollectionSchema,
  createCountSessionSchema,
  createCustomFieldSchema,
  archiveCustomFieldSchema,
  createDraftMovementSchema,
  createEnhancedInventoryProductSchema,
  createInventoryExportJobSchema,
  createInventoryImportJobSchema,
  createInventoryMasterDataSchema,
  createInventoryProductSchema,
  createInventorySkuTemplateSchema,
  createInventoryTagSchema,
  createInventoryTaxRateSchema,
  archiveInventorySkuTemplateSchema,
  createInventoryUnitSchema,
  createLotSchema,
  createOptionGroupSchema,
  createOptionValueSchema,
  createProductUnitConversionSchema,
  createPurchaseOrderSchema,
  createReservationSchema,
  createSerialSchema,
  createSupplierSchema,
  createUnitConversionSchema,
  createValuationSnapshotSchema,
  dataViewListParamsSchema,
  declineBranchTransferSchema,
  generateVariantsSchema,
  getByIdSchema,
  issueStockSchema,
  postMovementSchema,
  productCsvTextSchema,
  productCsvImportSchema,
  previewInventorySkuSchema,
  receivePurchaseOrderSchema,
  receiveStockSchema,
  releaseAllocationSchema,
  releaseReservationSchema,
  reverseMovementSchema,
  saveInventoryViewSchema,
  setCustomFieldValueSchema,
  transferStockSchema,
  updateCountLineSchema,
  updateVariantPricingSchema,
  updateInventoryVariantSchema,
  updateInventoryVariantOptionsSchema,
  updateInventoryProductSchema,
  updateInventoryProductImagesSchema,
  updateCustomFieldSchema,
  updateInventorySkuTemplateSchema,
} from "./schemas";
import { validateInventoryImageFile } from "./image-upload-policy";

export async function listInventoryProductsAction(rawInput: unknown) {
  try {
    const auth = await requireWarehouseContext();
    if (!auth.success) return auth;
    if (!hasPermission(auth, WAREHOUSE_PRODUCTS_READ)) {
      return { success: false, error: "Unauthorized" };
    }

    const parsed = dataViewListParamsSchema.safeParse(rawInput);
    if (!parsed.success) return { success: false, error: parsed.error.errors[0].message };

    const supabase = await createClient();
    return InventoryProductsService.listProducts(
      supabase,
      auth.context.app.activeOrgId,
      normalizeListParams(parsed.data),
      auth.context.app.activeBranchId
    );
  } catch (error) {
    return mapUnexpected(error);
  }
}

export async function getInventoryProductAction(rawInput: unknown) {
  try {
    const auth = await requireWarehouseContext();
    if (!auth.success) return auth;
    if (!hasPermission(auth, WAREHOUSE_PRODUCTS_READ)) {
      return { success: false, error: "Unauthorized" };
    }

    const parsed = getByIdSchema.safeParse(rawInput);
    if (!parsed.success) return { success: false, error: parsed.error.errors[0].message };

    const supabase = await createClient();
    return InventoryProductsService.getProductDetail(
      supabase,
      auth.context.app.activeOrgId,
      parsed.data.id,
      auth.context.app.activeBranchId
    );
  } catch (error) {
    return mapUnexpected(error);
  }
}

export async function createInventoryProductAction(rawInput: unknown) {
  try {
    const auth = await requireWarehouseContext();
    if (!auth.success) return auth;
    if (!hasPermission(auth, WAREHOUSE_PRODUCTS_MANAGE)) {
      return { success: false, error: "Unauthorized" };
    }

    const parsed = createInventoryProductSchema.safeParse(rawInput);
    if (!parsed.success) return { success: false, error: parsed.error.errors[0].message };

    const userId = userIdFrom(auth);
    if (!userId) return { success: false, error: "User identity unavailable" };

    const supabase = await createClient();
    const result = await InventoryProductsService.createProduct(
      supabase,
      auth.context.app.activeOrgId,
      {
        name: parsed.data.name!,
        product_type: parsed.data.product_type!,
        base_unit_id: parsed.data.base_unit_id!,
        sku: parsed.data.sku ?? null,
        description: parsed.data.description ?? null,
        returnable: parsed.data.returnable,
        brand_name: parsed.data.brand_name,
        manufacturer_name: parsed.data.manufacturer_name,
        length_value: parsed.data.length_value,
        width_value: parsed.data.width_value,
        height_value: parsed.data.height_value,
        dimension_unit: parsed.data.dimension_unit,
        weight_value: parsed.data.weight_value,
        weight_unit: parsed.data.weight_unit,
        sales_description: parsed.data.sales_description,
        purchase_description: parsed.data.purchase_description,
        preferred_supplier_id: parsed.data.preferred_supplier_id,
        sales_account_code: parsed.data.sales_account_code,
        purchase_account_code: parsed.data.purchase_account_code,
        tax_code: parsed.data.tax_code,
        tax_rate_percent: parsed.data.tax_rate_percent,
      },
      userId
    );

    if (result.success) {
      await eventService.emit({
        actionKey: "warehouse.inventory.product.created",
        actorType: "user",
        actorUserId: userId,
        organizationId: auth.context.app.activeOrgId,
        branchId: auth.context.app.activeBranchId ?? null,
        entityType: "inventory_product",
        entityId: result.data.product_id,
        eventTier: "baseline",
        metadata: {
          product_id: result.data.product_id,
          variant_id: result.data.variant_id,
          sku: result.data.sku,
        },
      });
    }

    return result;
  } catch (error) {
    return mapUnexpected(error);
  }
}

export async function createEnhancedInventoryProductAction(rawInput: unknown) {
  try {
    const auth = await requireWarehouseContext();
    if (!auth.success) return auth;
    if (!hasPermission(auth, WAREHOUSE_PRODUCTS_MANAGE)) {
      return { success: false, error: "Unauthorized" };
    }

    const parsed = createEnhancedInventoryProductSchema.safeParse(rawInput);
    if (!parsed.success) return { success: false, error: parsed.error.errors[0].message };

    if (
      parsed.data.track_inventory &&
      (parsed.data.opening_location_id ||
        parsed.data.variants.some((variant) => variant.opening_quantity))
    ) {
      if (!hasPermission(auth, WAREHOUSE_INVENTORY_OPERATE)) {
        return { success: false, error: "Opening stock requires inventory operate permission" };
      }
      const branch = requireActiveBranch(auth);
      if (!branch.success) return branch;
    }

    const userId = userIdFrom(auth);
    if (!userId) return { success: false, error: "User identity unavailable" };

    const supabase = await createClient();
    const result = await InventoryProductsService.createEnhancedProduct(
      supabase,
      auth.context.app.activeOrgId,
      {
        name: parsed.data.name!,
        product_type: parsed.data.product_type!,
        base_unit_id: parsed.data.base_unit_id!,
        sku: parsed.data.sku ?? null,
        description: parsed.data.description ?? null,
        returnable: parsed.data.returnable,
        brand_name: parsed.data.brand_name,
        manufacturer_name: parsed.data.manufacturer_name,
        length_value: parsed.data.length_value,
        width_value: parsed.data.width_value,
        height_value: parsed.data.height_value,
        dimension_unit: parsed.data.dimension_unit,
        weight_value: parsed.data.weight_value,
        weight_unit: parsed.data.weight_unit,
        sales_description: parsed.data.sales_description,
        purchase_description: parsed.data.purchase_description,
        preferred_supplier_id: parsed.data.preferred_supplier_id,
        sales_account_code: parsed.data.sales_account_code,
        purchase_account_code: parsed.data.purchase_account_code,
        tax_code: parsed.data.tax_code,
        tax_rate_percent: parsed.data.tax_rate_percent,
        attributes: (parsed.data.attributes ?? []).map((attribute) => ({
          name: attribute.name!,
          values: attribute.values ?? [],
        })),
        variants: (parsed.data.variants ?? []).map((variant) => ({
          sku: variant.sku!,
          name: variant.name!,
          options: variant.options,
          option_value_ids: variant.option_value_ids,
          barcode: variant.barcode,
          upc: variant.upc,
          ean: variant.ean,
          isbn: variant.isbn,
          mpn: variant.mpn,
          purchase_price: variant.purchase_price,
          sales_price: variant.sales_price,
          price_currency: variant.price_currency,
          reorder_point: variant.reorder_point,
          opening_quantity: variant.opening_quantity,
          opening_unit_cost: variant.opening_unit_cost,
        })),
        track_inventory: parsed.data.track_inventory,
        opening_location_id: parsed.data.opening_location_id,
        branch_id: auth.context.app.activeBranchId ?? null,
        tags: parsed.data.tags,
        unit_conversions: parsed.data.unit_conversions.map((conversion) => ({
          from_unit_id: conversion.from_unit_id!,
          to_unit_id: conversion.to_unit_id!,
          factor: conversion.factor!,
          rounding_mode: conversion.rounding_mode,
        })),
        custom_fields: (parsed.data.custom_fields ?? [])
          .filter((field) => field.field_id && field.entity_type)
          .map((field) => ({
            field_id: field.field_id!,
            entity_type: field.entity_type!,
            variant_sku: field.variant_sku,
            value_text: field.value_text,
            value_number: field.value_number,
            value_date: field.value_date,
            value_boolean: field.value_boolean,
            value_json: field.value_json,
          })),
      },
      userId
    );

    if (result.success) {
      await eventService.emit({
        actionKey: "warehouse.inventory.product.created",
        actorType: "user",
        actorUserId: userId,
        organizationId: auth.context.app.activeOrgId,
        branchId: auth.context.app.activeBranchId ?? null,
        entityType: "inventory_product",
        entityId: result.data.product_id,
        eventTier: "enhanced",
        metadata: {
          product_id: result.data.product_id,
          variant_ids: result.data.variant_ids,
          sku: result.data.sku,
        },
      });
    }

    return result;
  } catch (error) {
    return mapUnexpected(error);
  }
}

export async function uploadInventoryItemImageAction(formData: FormData) {
  try {
    const auth = await requireWarehouseContext();
    if (!auth.success) return auth;
    if (!hasPermission(auth, WAREHOUSE_PRODUCTS_MANAGE)) {
      return { success: false, error: "Unauthorized" };
    }

    const productId = String(formData.get("product_id") ?? "");
    const variantId = String(formData.get("variant_id") ?? "") || null;
    const isPrimary = String(formData.get("is_primary") ?? "false") === "true";
    const file = formData.get("file");
    if (!productId) return { success: false, error: "Product id is required" };
    if (!(file instanceof File)) return { success: false, error: "Image file is required" };

    const userId = userIdFrom(auth);
    if (!userId) return { success: false, error: "User identity unavailable" };

    const supabase = await createClient();
    const validation = await validateInventoryImageFile(file);
    if (!validation.success) return validation;

    const target = await InventoryProductsService.verifyImageTarget(
      supabase,
      auth.context.app.activeOrgId,
      productId,
      variantId
    );
    if (!target.success) return target;

    const safeName = `${crypto.randomUUID()}.${validation.data.extension}`;
    const path = `${auth.context.app.activeOrgId}/${productId}/${variantId ?? "product"}/${safeName}`;
    const { error: uploadError } = await supabase.storage
      .from("inventory-item-images")
      .upload(path, file, { upsert: false, contentType: validation.data.mime_type });
    if (uploadError) return { success: false, error: uploadError.message };

    const { data: urlData } = supabase.storage.from("inventory-item-images").getPublicUrl(path);
    const record = await InventoryProductsService.addImageRecord(
      supabase,
      auth.context.app.activeOrgId,
      {
        product_id: productId,
        variant_id: variantId,
        storage_path: path,
        public_url: urlData.publicUrl,
        file_name: validation.data.file_name,
        content_type: validation.data.mime_type,
        file_size: validation.data.file_size,
        is_primary: isPrimary,
        actor_user_id: userId,
      }
    );
    if (!record.success) {
      await supabase.storage.from("inventory-item-images").remove([path]);
      return record;
    }
    await emitInventoryEvent(auth, userId, {
      actionKey: "warehouse.inventory.product.image.uploaded",
      entityType: "inventory_product_image",
      entityId: record.data.id,
      metadata: {
        product_id: productId,
        variant_id: variantId,
        image_id: record.data.id,
        is_primary: isPrimary,
        file_name: validation.data.file_name,
        content_type: validation.data.mime_type,
        file_size: validation.data.file_size,
      },
    });
    return record;
  } catch (error) {
    return mapUnexpected(error);
  }
}

export async function assignInventoryVariantGalleryImageAction(rawInput: unknown) {
  try {
    const auth = await requireWarehouseContext();
    if (!auth.success) return auth;
    if (!hasPermission(auth, WAREHOUSE_PRODUCTS_MANAGE)) {
      return { success: false, error: "Unauthorized" };
    }

    const parsed = assignInventoryVariantGalleryImageSchema.safeParse(rawInput);
    if (!parsed.success) return { success: false, error: parsed.error.errors[0].message };

    const userId = userIdFrom(auth);
    if (!userId) return { success: false, error: "User identity unavailable" };

    const supabase = await createClient();
    const result = await InventoryProductsService.assignExistingImageToVariant(
      supabase,
      auth.context.app.activeOrgId,
      {
        product_id: parsed.data.product_id,
        variant_id: parsed.data.variant_id,
        image_id: parsed.data.image_id,
        sort_order: parsed.data.sort_order ?? 0,
        is_primary: parsed.data.is_primary ?? false,
        actor_user_id: userId,
      }
    );
    if (result.success) {
      await emitInventoryEvent(auth, userId, {
        actionKey: "warehouse.inventory.product.image.assigned",
        entityType: "inventory_product_image",
        entityId: parsed.data.image_id,
        metadata: {
          product_id: parsed.data.product_id,
          variant_id: parsed.data.variant_id,
          image_id: parsed.data.image_id,
          is_primary: parsed.data.is_primary ?? false,
          sort_order: parsed.data.sort_order ?? 0,
        },
      });
    }
    return result;
  } catch (error) {
    return mapUnexpected(error);
  }
}

export async function updateInventoryProductImagesAction(rawInput: unknown) {
  try {
    const auth = await requireWarehouseContext();
    if (!auth.success) return auth;
    if (!hasPermission(auth, WAREHOUSE_PRODUCTS_MANAGE)) {
      return { success: false, error: "Unauthorized" };
    }

    const parsed = updateInventoryProductImagesSchema.safeParse(rawInput);
    if (!parsed.success) return { success: false, error: parsed.error.errors[0].message };

    const userId = userIdFrom(auth);
    const supabase = await createClient();
    const deletedCount = parsed.data.images.filter((image) => image.deleted).length;
    if (parsed.data.variant_id) {
      const result = await InventoryProductsService.updateVariantImages(
        supabase,
        auth.context.app.activeOrgId,
        parsed.data.product_id,
        parsed.data.variant_id,
        parsed.data.images.map((image) => ({
          id: image.id!,
          sort_order: image.sort_order,
          is_primary: image.is_primary,
          deleted: image.deleted,
        }))
      );
      if (result.success) {
        await emitInventoryEvent(auth, userId, {
          actionKey: "warehouse.inventory.product.images.updated",
          entityType: "inventory_product",
          entityId: parsed.data.product_id,
          metadata: {
            product_id: parsed.data.product_id,
            variant_id: parsed.data.variant_id,
            image_count: parsed.data.images.length,
            deleted_count: deletedCount,
          },
        });
      }
      return result;
    }

    const result = await InventoryProductsService.updateProductImages(
      supabase,
      auth.context.app.activeOrgId,
      parsed.data.product_id,
      parsed.data.images.map((image) => ({
        id: image.id!,
        sort_order: image.sort_order,
        is_primary: image.is_primary,
        deleted: image.deleted,
      }))
    );
    if (result.success) {
      await emitInventoryEvent(auth, userId, {
        actionKey: "warehouse.inventory.product.images.updated",
        entityType: "inventory_product",
        entityId: parsed.data.product_id,
        metadata: {
          product_id: parsed.data.product_id,
          image_count: parsed.data.images.length,
          deleted_count: deletedCount,
        },
      });
    }
    return result;
  } catch (error) {
    return mapUnexpected(error);
  }
}

export async function checkInventorySkuCollisionsAction(rawInput: unknown) {
  try {
    const auth = await requireWarehouseContext();
    if (!auth.success) return auth;
    if (!hasPermission(auth, WAREHOUSE_PRODUCTS_READ)) {
      return { success: false, error: "Unauthorized" };
    }

    const parsed = checkInventorySkuCollisionsSchema.safeParse(rawInput);
    if (!parsed.success) return { success: false, error: parsed.error.errors[0].message };

    const supabase = await createClient();
    return InventoryProductsService.checkSkuCollisions(
      supabase,
      auth.context.app.activeOrgId,
      parsed.data.skus,
      parsed.data.exclude_variant_ids
    );
  } catch (error) {
    return mapUnexpected(error);
  }
}

export async function createInventorySkuTemplateAction(rawInput: unknown) {
  try {
    const auth = await requireWarehouseContext();
    if (!auth.success) return auth;
    if (!hasPermission(auth, WAREHOUSE_PRODUCTS_MANAGE)) {
      return { success: false, error: "Unauthorized" };
    }

    const parsed = createInventorySkuTemplateSchema.safeParse(rawInput);
    if (!parsed.success) return { success: false, error: parsed.error.errors[0].message };
    const userId = userIdFrom(auth);
    if (!userId) return { success: false, error: "User identity unavailable" };

    const supabase = await createClient();
    const result = await InventoryProductsService.createSkuTemplate(
      supabase,
      auth.context.app.activeOrgId,
      {
        name: parsed.data.name,
        description: parsed.data.description,
        rules: parsed.data.rules,
        is_default: parsed.data.is_default,
      },
      userId
    );
    if (result.success) {
      await emitInventoryEvent(auth, userId, {
        actionKey: "warehouse.inventory.settings.sku_template.created",
        entityType: "inventory_sku_template",
        entityId: result.data.id,
        metadata: {
          sku_template_id: result.data.id,
          name: result.data.name,
          is_default: result.data.is_default,
        },
      });
    }
    return result;
  } catch (error) {
    return mapUnexpected(error);
  }
}

export async function previewInventoryProductsCsvImportAction(rawInput: unknown) {
  try {
    const auth = await requireWarehouseContext();
    if (!auth.success) return auth;
    if (
      !hasPermission(auth, WAREHOUSE_IMPORTS_MANAGE) &&
      !hasPermission(auth, WAREHOUSE_PRODUCTS_MANAGE)
    ) {
      return { success: false, error: "Unauthorized" };
    }

    const parsed = productCsvTextSchema.safeParse(rawInput);
    if (!parsed.success) return { success: false, error: parsed.error.errors[0].message };

    const supabase = await createClient();
    return InventoryProductImportsService.previewProductCsvImport(
      supabase,
      auth.context.app.activeOrgId,
      parsed.data.csv
    );
  } catch (error) {
    return mapUnexpected(error);
  }
}

export async function importInventoryProductsCsvAction(rawInput: unknown) {
  try {
    const auth = await requireWarehouseContext();
    if (!auth.success) return auth;
    if (
      !hasPermission(auth, WAREHOUSE_IMPORTS_MANAGE) &&
      !hasPermission(auth, WAREHOUSE_PRODUCTS_MANAGE)
    ) {
      return { success: false, error: "Unauthorized" };
    }

    const parsed = productCsvImportSchema.safeParse(rawInput);
    if (!parsed.success) return { success: false, error: parsed.error.errors[0].message };
    const userId = userIdFrom(auth);
    if (!userId) return { success: false, error: "User identity unavailable" };

    const supabase = await createClient();
    const result = await InventoryProductImportsService.importProductsFromCsv(
      supabase,
      auth.context.app.activeOrgId,
      parsed.data.csv,
      userId,
      parsed.data.mode
    );
    if (result.success) {
      await emitInventoryEvent(auth, userId, {
        actionKey: "warehouse.inventory.import.completed",
        entityType: "inventory_import_job",
        entityId: result.data.job_id,
        metadata: {
          job_id: result.data.job_id,
          imported_products: result.data.imported_products,
          imported_variants: result.data.imported_variants,
          skipped_rows: result.data.skipped_rows,
          mode: parsed.data.mode,
        },
      });
    }
    return result;
  } catch (error) {
    return mapUnexpected(error);
  }
}

export async function updateInventorySkuTemplateAction(rawInput: unknown) {
  try {
    const auth = await requireWarehouseContext();
    if (!auth.success) return auth;
    if (!hasPermission(auth, WAREHOUSE_PRODUCTS_MANAGE))
      return { success: false, error: "Unauthorized" };
    const parsed = updateInventorySkuTemplateSchema.safeParse(rawInput);
    if (!parsed.success) return { success: false, error: parsed.error.errors[0].message };
    const userId = userIdFrom(auth);
    if (!userId) return { success: false, error: "User identity unavailable" };
    const supabase = await createClient();
    const result = await InventoryProductsService.updateSkuTemplate(
      supabase,
      auth.context.app.activeOrgId,
      {
        id: parsed.data.id!,
        name: parsed.data.name,
        description: parsed.data.description,
        rules: parsed.data.rules,
        is_default: parsed.data.is_default,
      },
      userId
    );
    if (result.success) {
      await emitInventoryEvent(auth, userId, {
        actionKey: "warehouse.inventory.settings.sku_template.updated",
        entityType: "inventory_sku_template",
        entityId: result.data.id,
        metadata: {
          sku_template_id: result.data.id,
          name: result.data.name,
          is_default: result.data.is_default,
          updated_fields: Object.keys(parsed.data).filter((key) => key !== "id"),
        },
      });
    }
    return result;
  } catch (error) {
    return mapUnexpected(error);
  }
}

export async function archiveInventorySkuTemplateAction(rawInput: unknown) {
  try {
    const auth = await requireWarehouseContext();
    if (!auth.success) return auth;
    if (!hasPermission(auth, WAREHOUSE_PRODUCTS_MANAGE))
      return { success: false, error: "Unauthorized" };
    const parsed = archiveInventorySkuTemplateSchema.safeParse(rawInput);
    if (!parsed.success) return { success: false, error: parsed.error.errors[0].message };
    const userId = userIdFrom(auth);
    if (!userId) return { success: false, error: "User identity unavailable" };
    const supabase = await createClient();
    const result = await InventoryProductsService.archiveSkuTemplate(
      supabase,
      auth.context.app.activeOrgId,
      parsed.data.id!,
      userId
    );
    if (result.success) {
      await emitInventoryEvent(auth, userId, {
        actionKey: "warehouse.inventory.settings.sku_template.archived",
        entityType: "inventory_sku_template",
        entityId: parsed.data.id!,
        metadata: { sku_template_id: parsed.data.id! },
      });
    }
    return result;
  } catch (error) {
    return mapUnexpected(error);
  }
}

export async function exportInventoryProductsCsvAction() {
  try {
    const auth = await requireWarehouseContext();
    if (!auth.success) return auth;
    if (!hasPermission(auth, WAREHOUSE_PRODUCTS_READ)) {
      return { success: false, error: "Unauthorized" };
    }

    const userId = userIdFrom(auth);
    if (!userId) return { success: false, error: "User identity unavailable" };

    const supabase = await createClient();
    const result = await InventoryProductImportsService.exportProductsCsv(
      supabase,
      auth.context.app.activeOrgId,
      userId
    );
    if (result.success) {
      await emitInventoryEvent(auth, userId, {
        actionKey: "warehouse.inventory.export.completed",
        entityType: "inventory_export_job",
        entityId: result.data.job_id,
        metadata: { job_id: result.data.job_id, file_name: result.data.file_name },
      });
    }
    return result;
  } catch (error) {
    return mapUnexpected(error);
  }
}

export async function createInventoryUnitAction(rawInput: unknown) {
  try {
    const auth = await requireWarehouseContext();
    if (!auth.success) return auth;
    if (!hasPermission(auth, WAREHOUSE_PRODUCTS_MANAGE)) {
      return { success: false, error: "Unauthorized" };
    }

    const parsed = createInventoryUnitSchema.safeParse(rawInput);
    if (!parsed.success) return { success: false, error: parsed.error.errors[0].message };

    const userId = userIdFrom(auth);
    if (!userId) return { success: false, error: "User identity unavailable" };

    const supabase = await createClient();
    const result = await InventoryProductsService.createUnit(
      supabase,
      auth.context.app.activeOrgId,
      {
        code: parsed.data.code!,
        name: parsed.data.name!,
        unit_kind: parsed.data.unit_kind!,
        precision: parsed.data.precision,
      },
      userId
    );
    if (result.success) {
      await emitInventoryEvent(auth, userId, {
        actionKey: "warehouse.inventory.settings.unit.created",
        entityType: "inventory_unit",
        entityId: result.data.id,
        metadata: {
          unit_id: result.data.id,
          code: result.data.code,
          name: result.data.name,
          unit_kind: parsed.data.unit_kind!,
        },
      });
    }
    return result;
  } catch (error) {
    return mapUnexpected(error);
  }
}

export async function archiveInventoryUnitAction(rawInput: unknown) {
  try {
    const auth = await requireWarehouseContext();
    if (!auth.success) return auth;
    if (!hasPermission(auth, WAREHOUSE_PRODUCTS_MANAGE)) {
      return { success: false, error: "Unauthorized" };
    }

    const parsed = archiveInventoryUnitSchema.safeParse(rawInput);
    if (!parsed.success) return { success: false, error: parsed.error.errors[0].message };

    const userId = userIdFrom(auth);
    if (!userId) return { success: false, error: "User identity unavailable" };

    const supabase = await createClient();
    const result = await InventoryProductsService.archiveUnit(
      supabase,
      auth.context.app.activeOrgId,
      parsed.data.id,
      userId
    );
    if (result.success) {
      await emitInventoryEvent(auth, userId, {
        actionKey: "warehouse.inventory.settings.unit.archived",
        entityType: "inventory_unit",
        entityId: parsed.data.id,
        metadata: { unit_id: parsed.data.id },
      });
    }
    return result;
  } catch (error) {
    return mapUnexpected(error);
  }
}

export async function createInventoryTaxRateAction(rawInput: unknown) {
  try {
    const auth = await requireWarehouseContext();
    if (!auth.success) return auth;
    if (!hasPermission(auth, WAREHOUSE_PRODUCTS_MANAGE)) {
      return { success: false, error: "Unauthorized" };
    }

    const parsed = createInventoryTaxRateSchema.safeParse(rawInput);
    if (!parsed.success) return { success: false, error: parsed.error.errors[0].message };

    const userId = userIdFrom(auth);
    if (!userId) return { success: false, error: "User identity unavailable" };

    const supabase = await createClient();
    const result = await InventoryProductsService.createTaxRate(
      supabase,
      auth.context.app.activeOrgId,
      {
        name: parsed.data.name,
        code: parsed.data.code,
        rate_percent: parsed.data.rate_percent,
        is_default: parsed.data.is_default,
      },
      userId
    );
    if (result.success) {
      await emitInventoryEvent(auth, userId, {
        actionKey: "warehouse.inventory.settings.tax_rate.created",
        entityType: "inventory_tax_rate",
        entityId: result.data.id,
        metadata: {
          tax_rate_id: result.data.id,
          code: result.data.code,
          name: result.data.name,
          rate_percent: result.data.rate_percent,
          is_default: result.data.is_default,
        },
      });
    }
    return result;
  } catch (error) {
    return mapUnexpected(error);
  }
}

export async function archiveInventoryTaxRateAction(rawInput: unknown) {
  try {
    const auth = await requireWarehouseContext();
    if (!auth.success) return auth;
    if (!hasPermission(auth, WAREHOUSE_PRODUCTS_MANAGE)) {
      return { success: false, error: "Unauthorized" };
    }

    const parsed = archiveInventoryTaxRateSchema.safeParse(rawInput);
    if (!parsed.success) return { success: false, error: parsed.error.errors[0].message };

    const userId = userIdFrom(auth);
    if (!userId) return { success: false, error: "User identity unavailable" };

    const supabase = await createClient();
    const result = await InventoryProductsService.archiveTaxRate(
      supabase,
      auth.context.app.activeOrgId,
      parsed.data.id,
      userId
    );
    if (result.success) {
      await emitInventoryEvent(auth, userId, {
        actionKey: "warehouse.inventory.settings.tax_rate.archived",
        entityType: "inventory_tax_rate",
        entityId: parsed.data.id,
        metadata: { tax_rate_id: parsed.data.id },
      });
    }
    return result;
  } catch (error) {
    return mapUnexpected(error);
  }
}

export async function createInventoryTagAction(rawInput: unknown) {
  try {
    const auth = await requireWarehouseContext();
    if (!auth.success) return auth;
    if (!hasPermission(auth, WAREHOUSE_PRODUCTS_MANAGE)) {
      return { success: false, error: "Unauthorized" };
    }

    const parsed = createInventoryTagSchema.safeParse(rawInput);
    if (!parsed.success) return { success: false, error: parsed.error.errors[0].message };

    const userId = userIdFrom(auth);
    if (!userId) return { success: false, error: "User identity unavailable" };

    const supabase = await createClient();
    const result = await InventoryProductsService.createTag(
      supabase,
      auth.context.app.activeOrgId,
      {
        name: parsed.data.name,
        color: parsed.data.color,
      },
      userId
    );
    if (result.success) {
      await emitInventoryEvent(auth, userId, {
        actionKey: "warehouse.inventory.settings.tag.created",
        entityType: "inventory_tag",
        entityId: result.data.id,
        metadata: {
          tag_id: result.data.id,
          name: result.data.name,
          color: result.data.color,
        },
      });
    }
    return result;
  } catch (error) {
    return mapUnexpected(error);
  }
}

export async function archiveInventoryTagAction(rawInput: unknown) {
  try {
    const auth = await requireWarehouseContext();
    if (!auth.success) return auth;
    if (!hasPermission(auth, WAREHOUSE_PRODUCTS_MANAGE)) {
      return { success: false, error: "Unauthorized" };
    }

    const parsed = archiveInventoryTagSchema.safeParse(rawInput);
    if (!parsed.success) return { success: false, error: parsed.error.errors[0].message };

    const userId = userIdFrom(auth);
    const supabase = await createClient();
    const result = await InventoryProductsService.archiveTag(
      supabase,
      auth.context.app.activeOrgId,
      parsed.data.id
    );
    if (result.success) {
      await emitInventoryEvent(auth, userId, {
        actionKey: "warehouse.inventory.settings.tag.archived",
        entityType: "inventory_tag",
        entityId: parsed.data.id,
        metadata: { tag_id: parsed.data.id },
      });
    }
    return result;
  } catch (error) {
    return mapUnexpected(error);
  }
}

export async function createInventoryBrandAction(rawInput: unknown) {
  try {
    const auth = await requireWarehouseContext();
    if (!auth.success) return auth;
    if (!hasPermission(auth, WAREHOUSE_PRODUCTS_MANAGE)) {
      return { success: false, error: "Unauthorized" };
    }

    const parsed = createInventoryMasterDataSchema.safeParse(rawInput);
    if (!parsed.success) return { success: false, error: parsed.error.errors[0].message };

    const userId = userIdFrom(auth);
    if (!userId) return { success: false, error: "User identity unavailable" };

    const supabase = await createClient();
    return InventoryProductsService.createBrand(
      supabase,
      auth.context.app.activeOrgId,
      parsed.data.name,
      userId
    );
  } catch (error) {
    return mapUnexpected(error);
  }
}

export async function createInventoryManufacturerAction(rawInput: unknown) {
  try {
    const auth = await requireWarehouseContext();
    if (!auth.success) return auth;
    if (!hasPermission(auth, WAREHOUSE_PRODUCTS_MANAGE)) {
      return { success: false, error: "Unauthorized" };
    }

    const parsed = createInventoryMasterDataSchema.safeParse(rawInput);
    if (!parsed.success) return { success: false, error: parsed.error.errors[0].message };

    const userId = userIdFrom(auth);
    if (!userId) return { success: false, error: "User identity unavailable" };

    const supabase = await createClient();
    return InventoryProductsService.createManufacturer(
      supabase,
      auth.context.app.activeOrgId,
      parsed.data.name,
      userId
    );
  } catch (error) {
    return mapUnexpected(error);
  }
}

export async function updateInventoryProductAction(rawInput: unknown) {
  try {
    const auth = await requireWarehouseContext();
    if (!auth.success) return auth;
    if (!hasPermission(auth, WAREHOUSE_PRODUCTS_MANAGE)) {
      return { success: false, error: "Unauthorized" };
    }

    const parsed = updateInventoryProductSchema.safeParse(rawInput);
    if (!parsed.success) return { success: false, error: parsed.error.errors[0].message };

    const userId = userIdFrom(auth);
    if (!userId) return { success: false, error: "User identity unavailable" };

    const supabase = await createClient();
    const result = await InventoryProductsService.updateProduct(
      supabase,
      auth.context.app.activeOrgId,
      {
        id: parsed.data.id!,
        name: parsed.data.name,
        description: parsed.data.description,
        status: parsed.data.status,
        product_type: parsed.data.product_type,
        base_unit_id: parsed.data.base_unit_id,
        returnable: parsed.data.returnable,
        brand_name: parsed.data.brand_name,
        manufacturer_name: parsed.data.manufacturer_name,
        length_value: parsed.data.length_value,
        width_value: parsed.data.width_value,
        height_value: parsed.data.height_value,
        dimension_unit: parsed.data.dimension_unit,
        weight_value: parsed.data.weight_value,
        weight_unit: parsed.data.weight_unit,
        sales_description: parsed.data.sales_description,
        purchase_description: parsed.data.purchase_description,
        preferred_supplier_id: parsed.data.preferred_supplier_id,
        sales_account_code: parsed.data.sales_account_code,
        purchase_account_code: parsed.data.purchase_account_code,
        tax_code: parsed.data.tax_code,
        tax_rate_percent: parsed.data.tax_rate_percent,
        tags: parsed.data.tags,
        unit_conversions: parsed.data.unit_conversions?.map((conversion) => ({
          from_unit_id: conversion.from_unit_id!,
          to_unit_id: conversion.to_unit_id!,
          factor: conversion.factor!,
          rounding_mode: conversion.rounding_mode,
        })),
      },
      userId,
      auth.context.app.activeBranchId
    );

    if (result.success) {
      await eventService.emit({
        actionKey: "warehouse.inventory.product.updated",
        actorType: "user",
        actorUserId: userId,
        organizationId: auth.context.app.activeOrgId,
        branchId: auth.context.app.activeBranchId ?? null,
        entityType: "inventory_product",
        entityId: parsed.data.id,
        eventTier: "baseline",
        metadata: {
          product_id: parsed.data.id,
          updated_fields: Object.keys(parsed.data).filter((k) => k !== "id"),
        },
      });
    }

    return result;
  } catch (error) {
    return mapUnexpected(error);
  }
}

export async function archiveInventoryProductAction(rawInput: unknown) {
  try {
    const auth = await requireWarehouseContext();
    if (!auth.success) return auth;
    if (!hasPermission(auth, WAREHOUSE_PRODUCTS_ARCHIVE)) {
      return { success: false, error: "Unauthorized" };
    }

    const parsed = archiveInventoryProductSchema.safeParse(rawInput);
    if (!parsed.success) return { success: false, error: parsed.error.errors[0].message };

    const userId = userIdFrom(auth);
    if (!userId) return { success: false, error: "User identity unavailable" };

    const supabase = await createClient();
    const result = await InventoryProductsService.archiveProduct(
      supabase,
      auth.context.app.activeOrgId,
      parsed.data.id,
      userId
    );

    if (result.success) {
      await eventService.emit({
        actionKey: "warehouse.inventory.product.archived",
        actorType: "user",
        actorUserId: userId,
        organizationId: auth.context.app.activeOrgId,
        branchId: auth.context.app.activeBranchId ?? null,
        entityType: "inventory_product",
        entityId: parsed.data.id,
        eventTier: "enhanced",
        metadata: { product_id: parsed.data.id },
      });
    }

    return result;
  } catch (error) {
    return mapUnexpected(error);
  }
}

export async function listInventoryBalancesAction(rawInput: unknown) {
  try {
    const auth = await requireWarehouseContext();
    if (!auth.success) return auth;
    if (!hasPermission(auth, WAREHOUSE_INVENTORY_READ)) {
      return { success: false, error: "Unauthorized" };
    }

    const branch = requireActiveBranch(auth);
    if (!branch.success) return branch;

    const parsed = dataViewListParamsSchema.safeParse(rawInput);
    if (!parsed.success) return { success: false, error: parsed.error.errors[0].message };

    const supabase = await createClient();
    return InventoryBalancesService.listBalances(
      supabase,
      auth.context.app.activeOrgId,
      branch.branchId,
      normalizeListParams(parsed.data)
    );
  } catch (error) {
    return mapUnexpected(error);
  }
}

export async function getInventoryBalanceAction(rawInput: unknown) {
  try {
    const auth = await requireWarehouseContext();
    if (!auth.success) return auth;
    if (!hasPermission(auth, WAREHOUSE_INVENTORY_READ)) {
      return { success: false, error: "Unauthorized" };
    }
    const branch = requireActiveBranch(auth);
    if (!branch.success) return branch;

    const parsed = getByIdSchema.safeParse(rawInput);
    if (!parsed.success) return { success: false, error: parsed.error.errors[0].message };

    const supabase = await createClient();
    return InventoryBalancesService.getBalanceDetail(
      supabase,
      auth.context.app.activeOrgId,
      branch.branchId,
      parsed.data.id
    );
  } catch (error) {
    return mapUnexpected(error);
  }
}

export async function listInventoryMovementsAction(rawInput: unknown) {
  try {
    const auth = await requireWarehouseContext();
    if (!auth.success) return auth;
    if (!hasPermission(auth, WAREHOUSE_INVENTORY_READ)) {
      return { success: false, error: "Unauthorized" };
    }
    const branch = requireActiveBranch(auth);
    if (!branch.success) return branch;

    const parsed = dataViewListParamsSchema.safeParse(rawInput);
    if (!parsed.success) return { success: false, error: parsed.error.errors[0].message };

    const supabase = await createClient();
    return InventoryMovementsService.listMovements(
      supabase,
      auth.context.app.activeOrgId,
      branch.branchId,
      normalizeListParams(parsed.data)
    );
  } catch (error) {
    return mapUnexpected(error);
  }
}

export async function getInventoryMovementAction(rawInput: unknown) {
  try {
    const auth = await requireWarehouseContext();
    if (!auth.success) return auth;
    if (!hasPermission(auth, WAREHOUSE_INVENTORY_READ)) {
      return { success: false, error: "Unauthorized" };
    }
    const branch = requireActiveBranch(auth);
    if (!branch.success) return branch;

    const parsed = getByIdSchema.safeParse(rawInput);
    if (!parsed.success) return { success: false, error: parsed.error.errors[0].message };

    const supabase = await createClient();
    return InventoryMovementsService.getMovementDetail(
      supabase,
      auth.context.app.activeOrgId,
      branch.branchId,
      parsed.data.id
    );
  } catch (error) {
    return mapUnexpected(error);
  }
}

export async function createDraftMovementAction(rawInput: unknown) {
  try {
    const auth = await requireWarehouseContext();
    if (!auth.success) return auth;
    const parsed = createDraftMovementSchema.safeParse(rawInput);
    if (!parsed.success) return { success: false, error: parsed.error.errors[0].message };

    const requiredPermission =
      parsed.data.movement_kind === "adjustment"
        ? WAREHOUSE_INVENTORY_ADJUST
        : WAREHOUSE_INVENTORY_OPERATE;
    if (!hasPermission(auth, requiredPermission)) {
      return { success: false, error: "Unauthorized" };
    }
    const branch = requireActiveBranch(auth);
    if (!branch.success) return branch;

    const userId = userIdFrom(auth);
    if (!userId) return { success: false, error: "User identity unavailable" };

    const supabase = await createClient();
    return InventoryMovementsService.createDraftMovement(
      supabase,
      auth.context.app.activeOrgId,
      branch.branchId,
      {
        movement_kind: parsed.data.movement_kind!,
        adjustment_direction: parsed.data.adjustment_direction ?? null,
        lines: parsed.data.lines!.map((line) => ({
          variant_id: line.variant_id!,
          source_location_id: line.source_location_id ?? null,
          destination_location_id: line.destination_location_id ?? null,
          lot_id: line.lot_id ?? null,
          serial_id: line.serial_id ?? null,
          unit_id: line.unit_id!,
          quantity: line.quantity!,
          unit_cost: line.unit_cost ?? null,
          total_cost: line.total_cost ?? null,
          currency: line.currency ?? null,
          note: line.note ?? null,
        })),
        reason_id: parsed.data.reason_id ?? null,
        note: parsed.data.note ?? null,
        reference_type: parsed.data.reference_type ?? null,
        reference_id: parsed.data.reference_id ?? null,
        idempotency_key: parsed.data.idempotency_key ?? null,
      },
      userId
    );
  } catch (error) {
    return mapUnexpected(error);
  }
}

export async function postMovementAction(rawInput: unknown) {
  try {
    const auth = await requireWarehouseContext();
    if (!auth.success) return auth;
    if (
      !hasPermission(auth, WAREHOUSE_INVENTORY_OPERATE) &&
      !hasPermission(auth, WAREHOUSE_INVENTORY_ADJUST)
    ) {
      return { success: false, error: "Unauthorized" };
    }

    const parsed = postMovementSchema.safeParse(rawInput);
    if (!parsed.success) return { success: false, error: parsed.error.errors[0].message };

    const userId = userIdFrom(auth);
    if (!userId) return { success: false, error: "User identity unavailable" };

    const supabase = await createClient();
    const result = await InventoryMovementsService.postMovement(supabase, parsed.data.id, userId);
    if (result.success) {
      await emitMovementEvent(auth, userId, "warehouse.inventory.movement.posted", result.data);
    }
    return result;
  } catch (error) {
    return mapUnexpected(error);
  }
}

export async function reverseMovementAction(rawInput: unknown) {
  try {
    const auth = await requireWarehouseContext();
    if (!auth.success) return auth;
    if (!hasPermission(auth, WAREHOUSE_INVENTORY_REVERSE)) {
      return { success: false, error: "Unauthorized" };
    }

    const parsed = reverseMovementSchema.safeParse(rawInput);
    if (!parsed.success) return { success: false, error: parsed.error.errors[0].message };

    const userId = userIdFrom(auth);
    if (!userId) return { success: false, error: "User identity unavailable" };

    const supabase = await createClient();
    const result = await InventoryMovementsService.reverseMovement(
      supabase,
      parsed.data.id,
      userId,
      parsed.data.note
    );
    if (result.success) {
      await emitMovementEvent(auth, userId, "warehouse.inventory.movement.reversed", result.data);
    }
    return result;
  } catch (error) {
    return mapUnexpected(error);
  }
}

export async function receiveStockAction(rawInput: unknown) {
  const parsed = receiveStockSchema.safeParse(rawInput);
  if (!parsed.success) return { success: false, error: parsed.error.errors[0].message };
  return createAndPostOperation({
    movement_kind: "receipt",
    lines: [
      {
        variant_id: parsed.data.variant_id,
        destination_location_id: parsed.data.destination_location_id,
        unit_id: parsed.data.unit_id,
        quantity: parsed.data.quantity,
      },
    ],
    note: parsed.data.note,
  });
}

export async function issueStockAction(rawInput: unknown) {
  const parsed = issueStockSchema.safeParse(rawInput);
  if (!parsed.success) return { success: false, error: parsed.error.errors[0].message };
  return createAndPostOperation({
    movement_kind: "issue",
    lines: [
      {
        variant_id: parsed.data.variant_id,
        source_location_id: parsed.data.source_location_id,
        unit_id: parsed.data.unit_id,
        quantity: parsed.data.quantity,
      },
    ],
    note: parsed.data.note,
  });
}

export async function transferStockAction(rawInput: unknown) {
  const parsed = transferStockSchema.safeParse(rawInput);
  if (!parsed.success) return { success: false, error: parsed.error.errors[0].message };
  return createAndPostOperation({
    movement_kind: "transfer",
    lines: [
      {
        variant_id: parsed.data.variant_id,
        source_location_id: parsed.data.source_location_id,
        destination_location_id: parsed.data.destination_location_id,
        unit_id: parsed.data.unit_id,
        quantity: parsed.data.quantity,
      },
    ],
    note: parsed.data.note,
  });
}

export async function adjustStockAction(rawInput: unknown) {
  const parsed = adjustStockSchema.safeParse(rawInput);
  if (!parsed.success) return { success: false, error: parsed.error.errors[0].message };
  return createAndPostOperation({
    movement_kind: "adjustment",
    adjustment_direction: parsed.data.adjustment_direction,
    lines: [
      {
        variant_id: parsed.data.variant_id,
        source_location_id:
          parsed.data.adjustment_direction === "decrease" ? parsed.data.location_id : null,
        destination_location_id:
          parsed.data.adjustment_direction === "increase" ? parsed.data.location_id : null,
        unit_id: parsed.data.unit_id,
        quantity: parsed.data.quantity,
      },
    ],
    note: parsed.data.note,
  });
}

export async function createInventoryOptionGroupAction(rawInput: unknown) {
  try {
    const auth = await requireWarehouseContext();
    if (!auth.success) return auth;
    if (!hasPermission(auth, WAREHOUSE_PRODUCTS_MANAGE))
      return { success: false, error: "Unauthorized" };
    const parsed = createOptionGroupSchema.safeParse(rawInput);
    if (!parsed.success) return { success: false, error: parsed.error.errors[0].message };
    const userId = userIdFrom(auth);
    const supabase = await createClient();
    return InventoryEnterpriseService.createOptionGroup(supabase, auth.context.app.activeOrgId, {
      name: parsed.data.name!,
      display_order: parsed.data.display_order,
      actor_user_id: userId,
    });
  } catch (error) {
    return mapUnexpected(error);
  }
}

export async function createInventoryOptionValueAction(rawInput: unknown) {
  try {
    const auth = await requireWarehouseContext();
    if (!auth.success) return auth;
    if (!hasPermission(auth, WAREHOUSE_PRODUCTS_MANAGE))
      return { success: false, error: "Unauthorized" };
    const parsed = createOptionValueSchema.safeParse(rawInput);
    if (!parsed.success) return { success: false, error: parsed.error.errors[0].message };
    const userId = userIdFrom(auth);
    const supabase = await createClient();
    return InventoryEnterpriseService.createOptionValue(supabase, auth.context.app.activeOrgId, {
      option_group_id: parsed.data.option_group_id!,
      value: parsed.data.value!,
      display_order: parsed.data.display_order,
      actor_user_id: userId,
    });
  } catch (error) {
    return mapUnexpected(error);
  }
}

export async function generateInventoryVariantsAction(rawInput: unknown) {
  try {
    const auth = await requireWarehouseContext();
    if (!auth.success) return auth;
    if (!hasPermission(auth, WAREHOUSE_PRODUCTS_MANAGE))
      return { success: false, error: "Unauthorized" };
    const parsed = generateVariantsSchema.safeParse(rawInput);
    if (!parsed.success) return { success: false, error: parsed.error.errors[0].message };
    const userId = userIdFrom(auth);
    const supabase = await createClient();
    return InventoryEnterpriseService.generateVariants(supabase, auth.context.app.activeOrgId, {
      product_id: parsed.data.product_id!,
      variants: (parsed.data.variants ?? []).map((variant) => ({
        sku: variant.sku!,
        name: variant.name!,
        option_value_ids: variant.option_value_ids ?? [],
        barcode: variant.barcode,
        purchase_price: variant.purchase_price,
        sales_price: variant.sales_price,
        price_currency: variant.price_currency,
      })),
      actor_user_id: userId,
    });
  } catch (error) {
    return mapUnexpected(error);
  }
}

export async function updateInventoryVariantPricingAction(rawInput: unknown) {
  try {
    const auth = await requireWarehouseContext();
    if (!auth.success) return auth;
    if (!hasPermission(auth, WAREHOUSE_PRICING_MANAGE))
      return { success: false, error: "Unauthorized" };
    const parsed = updateVariantPricingSchema.safeParse(rawInput);
    if (!parsed.success) return { success: false, error: parsed.error.errors[0].message };
    const userId = userIdFrom(auth);
    const supabase = await createClient();
    return InventoryEnterpriseService.updateVariantPricing(
      supabase,
      auth.context.app.activeOrgId,
      parsed.data.variant_id!,
      {
        purchase_price: parsed.data.purchase_price,
        sales_price: parsed.data.sales_price,
        price_currency: parsed.data.price_currency,
        actor_user_id: userId,
      }
    );
  } catch (error) {
    return mapUnexpected(error);
  }
}

export async function updateInventoryVariantAction(rawInput: unknown) {
  try {
    const auth = await requireWarehouseContext();
    if (!auth.success) return auth;
    if (!hasPermission(auth, WAREHOUSE_PRODUCTS_MANAGE))
      return { success: false, error: "Unauthorized" };
    const parsed = updateInventoryVariantSchema.safeParse(rawInput);
    if (!parsed.success) return { success: false, error: parsed.error.errors[0].message };
    const userId = userIdFrom(auth);
    const supabase = await createClient();

    const collisions = await InventoryProductsService.checkSkuCollisions(
      supabase,
      auth.context.app.activeOrgId,
      [parsed.data.sku],
      [parsed.data.variant_id!]
    );
    if (!collisions.success) return collisions;
    if (collisions.data.length > 0) {
      return {
        success: false,
        error: `SKU already exists: ${collisions.data.map((collision) => collision.sku).join(", ")}`,
      };
    }

    return InventoryEnterpriseService.updateVariantDetails(
      supabase,
      auth.context.app.activeOrgId,
      parsed.data.variant_id!,
      {
        sku: parsed.data.sku,
        name: parsed.data.name,
        status: parsed.data.status,
        barcode: parsed.data.barcode,
        purchase_price: parsed.data.purchase_price,
        sales_price: parsed.data.sales_price,
        price_currency: parsed.data.price_currency,
        reorder_point: parsed.data.reorder_point,
        preferred_supplier_id: parsed.data.preferred_supplier_id,
        actor_user_id: userId,
      }
    );
  } catch (error) {
    return mapUnexpected(error);
  }
}

export async function updateInventoryVariantOptionsAction(rawInput: unknown) {
  try {
    const auth = await requireWarehouseContext();
    if (!auth.success) return auth;
    if (!hasPermission(auth, WAREHOUSE_PRODUCTS_MANAGE))
      return { success: false, error: "Unauthorized" };
    const parsed = updateInventoryVariantOptionsSchema.safeParse(rawInput);
    if (!parsed.success) return { success: false, error: parsed.error.errors[0].message };
    const userId = userIdFrom(auth);
    if (!userId) return { success: false, error: "User identity unavailable" };
    const supabase = await createClient();
    const options = (parsed.data.options ?? [])
      .map((option) => ({
        name: option.name?.trim() ?? "",
        value: option.value?.trim() ?? "",
      }))
      .filter((option): option is { name: string; value: string } =>
        Boolean(option.name && option.value)
      );
    return InventoryProductsService.replaceVariantOptions(
      supabase,
      auth.context.app.activeOrgId,
      parsed.data.variant_id!,
      options,
      userId
    );
  } catch (error) {
    return mapUnexpected(error);
  }
}

export async function createInventoryLotAction(rawInput: unknown) {
  try {
    const auth = await requireWarehouseContext();
    if (!auth.success) return auth;
    if (!hasPermission(auth, WAREHOUSE_INVENTORY_OPERATE))
      return { success: false, error: "Unauthorized" };
    const parsed = createLotSchema.safeParse(rawInput);
    if (!parsed.success) return { success: false, error: parsed.error.errors[0].message };
    const userId = userIdFrom(auth);
    const supabase = await createClient();
    return InventoryEnterpriseService.createLot(supabase, auth.context.app.activeOrgId, {
      product_id: parsed.data.product_id!,
      variant_id: parsed.data.variant_id!,
      lot_number: parsed.data.lot_number!,
      manufactured_at: parsed.data.manufactured_at,
      expires_at: parsed.data.expires_at,
      supplier_reference: parsed.data.supplier_reference,
      actor_user_id: userId,
    });
  } catch (error) {
    return mapUnexpected(error);
  }
}

export async function createInventorySerialAction(rawInput: unknown) {
  try {
    const auth = await requireWarehouseContext();
    if (!auth.success) return auth;
    if (!hasPermission(auth, WAREHOUSE_INVENTORY_OPERATE))
      return { success: false, error: "Unauthorized" };
    const parsed = createSerialSchema.safeParse(rawInput);
    if (!parsed.success) return { success: false, error: parsed.error.errors[0].message };
    const userId = userIdFrom(auth);
    const supabase = await createClient();
    return InventoryEnterpriseService.createSerial(supabase, auth.context.app.activeOrgId, {
      product_id: parsed.data.product_id!,
      variant_id: parsed.data.variant_id!,
      serial_number: parsed.data.serial_number!,
      lot_id: parsed.data.lot_id,
      current_branch_id: parsed.data.current_branch_id,
      current_location_id: parsed.data.current_location_id,
      actor_user_id: userId,
    });
  } catch (error) {
    return mapUnexpected(error);
  }
}

export async function createInventoryReservationAction(rawInput: unknown) {
  try {
    const auth = await requireWarehouseContext();
    if (!auth.success) return auth;
    if (!hasPermission(auth, WAREHOUSE_INVENTORY_OPERATE))
      return { success: false, error: "Unauthorized" };
    const branch = requireActiveBranch(auth);
    if (!branch.success) return branch;
    const parsed = createReservationSchema.safeParse(rawInput);
    if (!parsed.success) return { success: false, error: parsed.error.errors[0].message };
    const userId = userIdFrom(auth);
    const supabase = await createClient();
    return InventoryEnterpriseService.createReservation(
      supabase,
      auth.context.app.activeOrgId,
      branch.branchId,
      {
        lines: (parsed.data.lines ?? []).map((line) => ({
          variant_id: line.variant_id!,
          location_id: line.location_id!,
          quantity: line.quantity!,
          lot_id: line.lot_id,
          serial_id: line.serial_id,
        })),
        reference_type: parsed.data.reference_type,
        reference_id: parsed.data.reference_id,
        reference_number: parsed.data.reference_number,
        expires_at: parsed.data.expires_at,
        notes: parsed.data.notes,
        actor_user_id: userId,
      }
    );
  } catch (error) {
    return mapUnexpected(error);
  }
}

export async function releaseInventoryReservationAction(rawInput: unknown) {
  try {
    const auth = await requireWarehouseContext();
    if (!auth.success) return auth;
    if (!hasPermission(auth, WAREHOUSE_INVENTORY_OPERATE))
      return { success: false, error: "Unauthorized" };
    const parsed = releaseReservationSchema.safeParse(rawInput);
    if (!parsed.success) return { success: false, error: parsed.error.errors[0].message };
    const supabase = await createClient();
    return InventoryEnterpriseService.releaseReservation(
      supabase,
      parsed.data.id,
      userIdFrom(auth)
    );
  } catch (error) {
    return mapUnexpected(error);
  }
}

export async function createInventoryAllocationAction(rawInput: unknown) {
  try {
    const auth = await requireWarehouseContext();
    if (!auth.success) return auth;
    if (!hasPermission(auth, WAREHOUSE_INVENTORY_OPERATE))
      return { success: false, error: "Unauthorized" };
    const branch = requireActiveBranch(auth);
    if (!branch.success) return branch;
    const parsed = createAllocationSchema.safeParse(rawInput);
    if (!parsed.success) return { success: false, error: parsed.error.errors[0].message };
    const userId = userIdFrom(auth);
    const supabase = await createClient();
    return InventoryEnterpriseService.createAllocation(
      supabase,
      auth.context.app.activeOrgId,
      branch.branchId,
      {
        lines: (parsed.data.lines ?? []).map((line) => ({
          variant_id: line.variant_id!,
          location_id: line.location_id!,
          quantity: line.quantity!,
          lot_id: line.lot_id,
          serial_id: line.serial_id,
          reservation_line_id: line.reservation_line_id,
        })),
        reservation_id: parsed.data.reservation_id,
        reference_type: parsed.data.reference_type,
        reference_id: parsed.data.reference_id,
        reference_number: parsed.data.reference_number,
        actor_user_id: userId,
      }
    );
  } catch (error) {
    return mapUnexpected(error);
  }
}

export async function releaseInventoryAllocationAction(rawInput: unknown) {
  try {
    const auth = await requireWarehouseContext();
    if (!auth.success) return auth;
    if (!hasPermission(auth, WAREHOUSE_INVENTORY_OPERATE))
      return { success: false, error: "Unauthorized" };
    const parsed = releaseAllocationSchema.safeParse(rawInput);
    if (!parsed.success) return { success: false, error: parsed.error.errors[0].message };
    const supabase = await createClient();
    return InventoryEnterpriseService.releaseAllocation(supabase, parsed.data.id, userIdFrom(auth));
  } catch (error) {
    return mapUnexpected(error);
  }
}

export async function createInventorySupplierAction(rawInput: unknown) {
  try {
    const auth = await requireWarehouseContext();
    if (!auth.success) return auth;
    if (!hasPermission(auth, WAREHOUSE_PROCUREMENT_MANAGE)) {
      return { success: false, error: "Unauthorized" };
    }
    const parsed = createSupplierSchema.safeParse(rawInput);
    if (!parsed.success) return { success: false, error: parsed.error.errors[0].message };
    const userId = userIdFrom(auth);
    const supabase = await createClient();
    return InventoryEnterpriseService.createSupplier(supabase, auth.context.app.activeOrgId, {
      name: parsed.data.name!,
      email: parsed.data.email,
      phone: parsed.data.phone,
      actor_user_id: userId,
    });
  } catch (error) {
    return mapUnexpected(error);
  }
}

export async function createInventoryPurchaseOrderAction(rawInput: unknown) {
  try {
    const auth = await requireWarehouseContext();
    if (!auth.success) return auth;
    if (!hasPermission(auth, WAREHOUSE_PROCUREMENT_MANAGE)) {
      return { success: false, error: "Unauthorized" };
    }
    const branch = requireActiveBranch(auth);
    if (!branch.success) return branch;
    const parsed = createPurchaseOrderSchema.safeParse(rawInput);
    if (!parsed.success) return { success: false, error: parsed.error.errors[0].message };
    const userId = userIdFrom(auth);
    const supabase = await createClient();
    return InventoryEnterpriseService.createPurchaseOrder(
      supabase,
      auth.context.app.activeOrgId,
      branch.branchId,
      {
        supplier_id: parsed.data.supplier_id!,
        expected_delivery_date: parsed.data.expected_delivery_date,
        delivery_location_id: parsed.data.delivery_location_id,
        currency: parsed.data.currency,
        notes: parsed.data.notes,
        lines: (parsed.data.lines ?? []).map((line) => ({
          variant_id: line.variant_id!,
          unit_id: line.unit_id!,
          quantity: line.quantity!,
          unit_cost: line.unit_cost,
        })),
        actor_user_id: userId,
      }
    );
  } catch (error) {
    return mapUnexpected(error);
  }
}

export async function receiveInventoryPurchaseOrderAction(rawInput: unknown) {
  try {
    const auth = await requireWarehouseContext();
    if (!auth.success) return auth;
    if (!hasPermission(auth, WAREHOUSE_PROCUREMENT_MANAGE)) {
      return { success: false, error: "Unauthorized" };
    }
    const parsed = receivePurchaseOrderSchema.safeParse(rawInput);
    if (!parsed.success) return { success: false, error: parsed.error.errors[0].message };
    const supabase = await createClient();
    return InventoryEnterpriseService.receivePurchaseOrder(supabase, {
      purchase_order_id: parsed.data.purchase_order_id!,
      lines: (parsed.data.lines ?? []).map((line) => ({
        purchase_order_line_id: line.purchase_order_line_id!,
        quantity: line.quantity!,
        destination_location_id: line.destination_location_id,
      })),
      actor_user_id: userIdFrom(auth),
    });
  } catch (error) {
    return mapUnexpected(error);
  }
}

export async function previewInventorySkuAction(rawInput: unknown) {
  try {
    const auth = await requireWarehouseContext();
    if (!auth.success) return auth;
    if (!hasPermission(auth, WAREHOUSE_PRODUCTS_READ))
      return { success: false, error: "Unauthorized" };
    const parsed = previewInventorySkuSchema.safeParse(rawInput);
    if (!parsed.success) return { success: false, error: parsed.error.errors[0].message };
    const supabase = await createClient();
    return InventoryEnterpriseService.previewSku(supabase, auth.context.app.activeOrgId, {
      product_name: parsed.data.product_name!,
      product_type: parsed.data.product_type!,
    });
  } catch (error) {
    return mapUnexpected(error);
  }
}

export async function createInventoryUnitConversionAction(rawInput: unknown) {
  try {
    const auth = await requireWarehouseContext();
    if (!auth.success) return auth;
    if (!hasPermission(auth, WAREHOUSE_PRODUCTS_MANAGE))
      return { success: false, error: "Unauthorized" };
    const parsed = createUnitConversionSchema.safeParse(rawInput);
    if (!parsed.success) return { success: false, error: parsed.error.errors[0].message };
    const userId = userIdFrom(auth);
    const supabase = await createClient();
    const result = await InventoryEnterpriseService.createUnitConversion(
      supabase,
      auth.context.app.activeOrgId,
      {
        from_unit_id: parsed.data.from_unit_id!,
        to_unit_id: parsed.data.to_unit_id!,
        factor: parsed.data.factor!,
        actor_user_id: userId,
      }
    );
    if (result.success) {
      await emitInventoryEvent(auth, userId, {
        actionKey: "warehouse.inventory.settings.unit_conversion.created",
        entityType: "inventory_unit_conversion",
        entityId: result.data.id,
        metadata: {
          unit_conversion_id: result.data.id,
          from_unit_id: parsed.data.from_unit_id!,
          to_unit_id: parsed.data.to_unit_id!,
          factor: parsed.data.factor!,
        },
      });
    }
    return result;
  } catch (error) {
    return mapUnexpected(error);
  }
}

export async function archiveInventoryUnitConversionAction(rawInput: unknown) {
  try {
    const auth = await requireWarehouseContext();
    if (!auth.success) return auth;
    if (!hasPermission(auth, WAREHOUSE_PRODUCTS_MANAGE))
      return { success: false, error: "Unauthorized" };

    const parsed = archiveInventoryUnitConversionSchema.safeParse(rawInput);
    if (!parsed.success) return { success: false, error: parsed.error.errors[0].message };

    const userId = userIdFrom(auth);
    if (!userId) return { success: false, error: "User identity unavailable" };

    const supabase = await createClient();
    const result = await InventoryProductsService.archiveUnitConversion(
      supabase,
      auth.context.app.activeOrgId,
      parsed.data.id,
      userId
    );
    if (result.success) {
      await emitInventoryEvent(auth, userId, {
        actionKey: "warehouse.inventory.settings.unit_conversion.archived",
        entityType: "inventory_unit_conversion",
        entityId: parsed.data.id,
        metadata: { unit_conversion_id: parsed.data.id },
      });
    }
    return result;
  } catch (error) {
    return mapUnexpected(error);
  }
}

export async function createInventoryProductUnitConversionAction(rawInput: unknown) {
  try {
    const auth = await requireWarehouseContext();
    if (!auth.success) return auth;
    if (!hasPermission(auth, WAREHOUSE_PRODUCTS_MANAGE))
      return { success: false, error: "Unauthorized" };
    const parsed = createProductUnitConversionSchema.safeParse(rawInput);
    if (!parsed.success) return { success: false, error: parsed.error.errors[0].message };
    const supabase = await createClient();
    return InventoryEnterpriseService.createProductUnitConversion(
      supabase,
      auth.context.app.activeOrgId,
      {
        product_id: parsed.data.product_id!,
        from_unit_id: parsed.data.from_unit_id!,
        to_unit_id: parsed.data.to_unit_id!,
        factor: parsed.data.factor!,
        rounding_mode: parsed.data.rounding_mode!,
        actor_user_id: userIdFrom(auth),
      }
    );
  } catch (error) {
    return mapUnexpected(error);
  }
}

export async function createInventoryCustomFieldAction(rawInput: unknown) {
  try {
    const auth = await requireWarehouseContext();
    if (!auth.success) return auth;
    if (!hasPermission(auth, WAREHOUSE_PRODUCTS_MANAGE))
      return { success: false, error: "Unauthorized" };
    const parsed = createCustomFieldSchema.safeParse(rawInput);
    if (!parsed.success) return { success: false, error: parsed.error.errors[0].message };
    const userId = userIdFrom(auth);
    const supabase = await createClient();
    const result = await InventoryEnterpriseService.createCustomField(
      supabase,
      auth.context.app.activeOrgId,
      {
        entity_type: parsed.data.entity_type!,
        name: parsed.data.name!,
        field_key: parsed.data.field_key!,
        field_type: parsed.data.field_type!,
        is_required: parsed.data.is_required,
        is_filterable: parsed.data.is_filterable,
        options: parsed.data.options,
        display_order: parsed.data.display_order,
        actor_user_id: userId,
      }
    );
    if (result.success) {
      await emitInventoryEvent(auth, userId, {
        actionKey: "warehouse.inventory.settings.custom_field.created",
        entityType: "inventory_custom_field",
        entityId: result.data.id,
        metadata: {
          custom_field_id: result.data.id,
          entity_type: parsed.data.entity_type!,
          field_key: parsed.data.field_key!,
          field_type: parsed.data.field_type!,
          name: parsed.data.name!,
        },
      });
    }
    return result;
  } catch (error) {
    return mapUnexpected(error);
  }
}

export async function archiveInventoryCustomFieldAction(rawInput: unknown) {
  try {
    const auth = await requireWarehouseContext();
    if (!auth.success) return auth;
    if (!hasPermission(auth, WAREHOUSE_PRODUCTS_MANAGE))
      return { success: false, error: "Unauthorized" };
    const parsed = archiveCustomFieldSchema.safeParse(rawInput);
    if (!parsed.success) return { success: false, error: parsed.error.errors[0].message };
    const userId = userIdFrom(auth);
    const supabase = await createClient();
    const result = await InventoryEnterpriseService.archiveCustomField(
      supabase,
      auth.context.app.activeOrgId,
      parsed.data.id!,
      userId
    );
    if (result.success) {
      await emitInventoryEvent(auth, userId, {
        actionKey: "warehouse.inventory.settings.custom_field.archived",
        entityType: "inventory_custom_field",
        entityId: parsed.data.id!,
        metadata: { custom_field_id: parsed.data.id! },
      });
    }
    return result;
  } catch (error) {
    return mapUnexpected(error);
  }
}

export async function updateInventoryCustomFieldAction(rawInput: unknown) {
  try {
    const auth = await requireWarehouseContext();
    if (!auth.success) return auth;
    if (!hasPermission(auth, WAREHOUSE_PRODUCTS_MANAGE))
      return { success: false, error: "Unauthorized" };
    const parsed = updateCustomFieldSchema.safeParse(rawInput);
    if (!parsed.success) return { success: false, error: parsed.error.errors[0].message };
    const userId = userIdFrom(auth);
    const supabase = await createClient();
    const result = await InventoryEnterpriseService.updateCustomField(
      supabase,
      auth.context.app.activeOrgId,
      {
        id: parsed.data.id!,
        name: parsed.data.name,
        is_required: parsed.data.is_required,
        is_filterable: parsed.data.is_filterable,
        options: parsed.data.options,
        display_order: parsed.data.display_order,
      }
    );
    if (result.success) {
      await emitInventoryEvent(auth, userId, {
        actionKey: "warehouse.inventory.settings.custom_field.updated",
        entityType: "inventory_custom_field",
        entityId: parsed.data.id!,
        metadata: {
          custom_field_id: parsed.data.id!,
          updated_fields: Object.keys(parsed.data).filter((key) => key !== "id"),
        },
      });
    }
    return result;
  } catch (error) {
    return mapUnexpected(error);
  }
}

export async function setInventoryCustomFieldValueAction(rawInput: unknown) {
  try {
    const auth = await requireWarehouseContext();
    if (!auth.success) return auth;
    if (!hasPermission(auth, WAREHOUSE_PRODUCTS_MANAGE))
      return { success: false, error: "Unauthorized" };
    const parsed = setCustomFieldValueSchema.safeParse(rawInput);
    if (!parsed.success) return { success: false, error: parsed.error.errors[0].message };
    const supabase = await createClient();
    return InventoryEnterpriseService.setCustomFieldValue(supabase, auth.context.app.activeOrgId, {
      field_id: parsed.data.field_id!,
      product_id: parsed.data.product_id,
      variant_id: parsed.data.variant_id,
      lot_id: parsed.data.lot_id,
      serial_id: parsed.data.serial_id,
      value_text: parsed.data.value_text,
      value_number: parsed.data.value_number,
      value_date: parsed.data.value_date,
      value_boolean: parsed.data.value_boolean,
      value_json: parsed.data.value_json,
      actor_user_id: userIdFrom(auth),
    });
  } catch (error) {
    return mapUnexpected(error);
  }
}

export async function createInventoryCollectionAction(rawInput: unknown) {
  try {
    const auth = await requireWarehouseContext();
    if (!auth.success) return auth;
    if (!hasPermission(auth, WAREHOUSE_PRODUCTS_MANAGE))
      return { success: false, error: "Unauthorized" };
    const parsed = createCollectionSchema.safeParse(rawInput);
    if (!parsed.success) return { success: false, error: parsed.error.errors[0].message };
    const supabase = await createClient();
    return InventoryEnterpriseService.createCollection(supabase, auth.context.app.activeOrgId, {
      name: parsed.data.name!,
      description: parsed.data.description,
      collection_type: parsed.data.collection_type,
      filter_json: parsed.data.filter_json,
      actor_user_id: userIdFrom(auth),
    });
  } catch (error) {
    return mapUnexpected(error);
  }
}

export async function addInventoryCollectionItemAction(rawInput: unknown) {
  try {
    const auth = await requireWarehouseContext();
    if (!auth.success) return auth;
    if (!hasPermission(auth, WAREHOUSE_PRODUCTS_MANAGE))
      return { success: false, error: "Unauthorized" };
    const parsed = addCollectionItemSchema.safeParse(rawInput);
    if (!parsed.success) return { success: false, error: parsed.error.errors[0].message };
    const supabase = await createClient();
    return InventoryEnterpriseService.addCollectionItem(supabase, auth.context.app.activeOrgId, {
      collection_id: parsed.data.collection_id!,
      product_id: parsed.data.product_id!,
      actor_user_id: userIdFrom(auth),
    });
  } catch (error) {
    return mapUnexpected(error);
  }
}

export async function saveInventoryViewAction(rawInput: unknown) {
  try {
    const auth = await requireWarehouseContext();
    if (!auth.success) return auth;
    if (!hasPermission(auth, WAREHOUSE_PRODUCTS_READ))
      return { success: false, error: "Unauthorized" };
    const parsed = saveInventoryViewSchema.safeParse(rawInput);
    if (!parsed.success) return { success: false, error: parsed.error.errors[0].message };
    const userId = userIdFrom(auth);
    if (!userId) return { success: false, error: "User identity unavailable" };
    const supabase = await createClient();
    return InventoryEnterpriseService.saveView(supabase, auth.context.app.activeOrgId, userId, {
      entity: parsed.data.entity!,
      name: parsed.data.name!,
      config: parsed.data.config!,
      is_shared: parsed.data.is_shared,
    });
  } catch (error) {
    return mapUnexpected(error);
  }
}

export async function createInventoryImportJobAction(rawInput: unknown) {
  try {
    const auth = await requireWarehouseContext();
    if (!auth.success) return auth;
    if (!hasPermission(auth, WAREHOUSE_IMPORTS_MANAGE))
      return { success: false, error: "Unauthorized" };
    const parsed = createInventoryImportJobSchema.safeParse(rawInput);
    if (!parsed.success) return { success: false, error: parsed.error.errors[0].message };
    const supabase = await createClient();
    return InventoryEnterpriseService.createImportJob(
      supabase,
      auth.context.app.activeOrgId,
      auth.context.app.activeBranchId ?? null,
      {
        import_type: parsed.data.import_type!,
        file_name: parsed.data.file_name,
        storage_path: parsed.data.storage_path,
        mapping: parsed.data.mapping,
        actor_user_id: userIdFrom(auth),
      }
    );
  } catch (error) {
    return mapUnexpected(error);
  }
}

export async function createInventoryExportJobAction(rawInput: unknown) {
  try {
    const auth = await requireWarehouseContext();
    if (!auth.success) return auth;
    if (
      !hasPermission(auth, WAREHOUSE_REPORTS_READ) &&
      !hasPermission(auth, WAREHOUSE_IMPORTS_MANAGE)
    ) {
      return { success: false, error: "Unauthorized" };
    }
    const parsed = createInventoryExportJobSchema.safeParse(rawInput);
    if (!parsed.success) return { success: false, error: parsed.error.errors[0].message };
    const supabase = await createClient();
    return InventoryEnterpriseService.createExportJob(
      supabase,
      auth.context.app.activeOrgId,
      auth.context.app.activeBranchId ?? null,
      {
        export_type: parsed.data.export_type!,
        filters: parsed.data.filters,
        actor_user_id: userIdFrom(auth),
      }
    );
  } catch (error) {
    return mapUnexpected(error);
  }
}

export async function createInventoryValuationSnapshotAction(rawInput: unknown) {
  try {
    const auth = await requireWarehouseContext();
    if (!auth.success) return auth;
    if (!hasPermission(auth, WAREHOUSE_REPORTS_READ))
      return { success: false, error: "Unauthorized" };
    const parsed = createValuationSnapshotSchema.safeParse(rawInput);
    if (!parsed.success) return { success: false, error: parsed.error.errors[0].message };
    const supabase = await createClient();
    return InventoryEnterpriseService.createValuationSnapshot(
      supabase,
      auth.context.app.activeOrgId,
      auth.context.app.activeBranchId ?? null,
      parsed.data.snapshot_date
    );
  } catch (error) {
    return mapUnexpected(error);
  }
}

export async function listInventoryBranchTransfersAction() {
  try {
    const auth = await requireWarehouseContext();
    if (!auth.success) return auth;
    if (!hasPermission(auth, WAREHOUSE_INVENTORY_READ))
      return { success: false, error: "Unauthorized" };
    const branch = requireActiveBranch(auth);
    if (!branch.success) return branch;
    const supabase = await createClient();
    return InventoryEnterpriseService.listBranchTransfers(
      supabase,
      auth.context.app.activeOrgId,
      branch.branchId
    );
  } catch (error) {
    return mapUnexpected(error);
  }
}

export async function createInventoryBranchTransferAction(rawInput: unknown) {
  try {
    const auth = await requireWarehouseContext();
    if (!auth.success) return auth;
    if (!hasPermission(auth, WAREHOUSE_INVENTORY_OPERATE))
      return { success: false, error: "Unauthorized" };
    const branch = requireActiveBranch(auth);
    if (!branch.success) return branch;
    const parsed = createBranchTransferSchema.safeParse(rawInput);
    if (!parsed.success) return { success: false, error: parsed.error.errors[0].message };
    const userId = userIdFrom(auth);
    const supabase = await createClient();
    const result = await InventoryEnterpriseService.createBranchTransfer(
      supabase,
      auth.context.app.activeOrgId,
      branch.branchId,
      {
        destination_branch_id: parsed.data.destination_branch_id!,
        lines: (parsed.data.lines ?? []).map((line) => ({
          variant_id: line.variant_id!,
          source_location_id: line.source_location_id!,
          lot_id: line.lot_id,
          serial_id: line.serial_id,
          unit_id: line.unit_id!,
          quantity: line.quantity!,
        })),
        notes: parsed.data.notes,
        actor_user_id: userId,
      }
    );
    const transferId = textFromRecord(result.success ? result.data : null, ["transfer_id", "id"]);
    if (result.success && transferId) {
      await emitInventoryEvent(auth, userId, {
        actionKey: "warehouse.inventory.branch_transfer.created",
        entityType: "inventory_branch_transfer",
        entityId: transferId,
        branchId: branch.branchId,
        metadata: {
          transfer_id: transferId,
          source_branch_id: branch.branchId,
          destination_branch_id: parsed.data.destination_branch_id!,
          line_count: parsed.data.lines?.length ?? 0,
        },
      });
    }
    return result;
  } catch (error) {
    return mapUnexpected(error);
  }
}

export async function acceptInventoryBranchTransferAction(rawInput: unknown) {
  try {
    const auth = await requireWarehouseContext();
    if (!auth.success) return auth;
    if (!hasPermission(auth, WAREHOUSE_INVENTORY_OPERATE))
      return { success: false, error: "Unauthorized" };
    const parsed = acceptBranchTransferSchema.safeParse(rawInput);
    if (!parsed.success) return { success: false, error: parsed.error.errors[0].message };
    const userId = userIdFrom(auth);
    const supabase = await createClient();
    const result = await InventoryEnterpriseService.acceptBranchTransfer(
      supabase,
      parsed.data.id!,
      parsed.data.destination_location_id!,
      userId
    );
    if (result.success) {
      await emitInventoryEvent(auth, userId, {
        actionKey: "warehouse.inventory.branch_transfer.accepted",
        entityType: "inventory_branch_transfer",
        entityId: parsed.data.id!,
        metadata: {
          transfer_id: parsed.data.id!,
          destination_location_id: parsed.data.destination_location_id!,
        },
      });
    }
    return result;
  } catch (error) {
    return mapUnexpected(error);
  }
}

export async function declineInventoryBranchTransferAction(rawInput: unknown) {
  try {
    const auth = await requireWarehouseContext();
    if (!auth.success) return auth;
    if (!hasPermission(auth, WAREHOUSE_INVENTORY_OPERATE))
      return { success: false, error: "Unauthorized" };
    const parsed = declineBranchTransferSchema.safeParse(rawInput);
    if (!parsed.success) return { success: false, error: parsed.error.errors[0].message };
    const userId = userIdFrom(auth);
    const supabase = await createClient();
    const result = await InventoryEnterpriseService.declineBranchTransfer(
      supabase,
      parsed.data.id!,
      parsed.data.decline_reason ?? null,
      userId
    );
    if (result.success) {
      await emitInventoryEvent(auth, userId, {
        actionKey: "warehouse.inventory.branch_transfer.declined",
        entityType: "inventory_branch_transfer",
        entityId: parsed.data.id!,
        metadata: {
          transfer_id: parsed.data.id!,
          has_decline_reason: Boolean(parsed.data.decline_reason),
        },
      });
    }
    return result;
  } catch (error) {
    return mapUnexpected(error);
  }
}

export async function createInventoryCountSessionAction(rawInput: unknown) {
  try {
    const auth = await requireWarehouseContext();
    if (!auth.success) return auth;
    if (!hasPermission(auth, WAREHOUSE_INVENTORY_ADJUST))
      return { success: false, error: "Unauthorized" };
    const branch = requireActiveBranch(auth);
    if (!branch.success) return branch;
    const parsed = createCountSessionSchema.safeParse(rawInput);
    if (!parsed.success) return { success: false, error: parsed.error.errors[0].message };
    const userId = userIdFrom(auth);
    const supabase = await createClient();
    const result = await InventoryEnterpriseService.createCountSession(
      supabase,
      auth.context.app.activeOrgId,
      branch.branchId,
      {
        scope: parsed.data.scope,
        notes: parsed.data.notes,
        actor_user_id: userId,
      }
    );
    const countSessionId = textFromRecord(result.success ? result.data : null, [
      "count_session_id",
      "id",
    ]);
    if (result.success && countSessionId) {
      await emitInventoryEvent(auth, userId, {
        actionKey: "warehouse.inventory.count_session.created",
        entityType: "inventory_count_session",
        entityId: countSessionId,
        branchId: branch.branchId,
        metadata: {
          count_session_id: countSessionId,
          scope: parsed.data.scope,
        },
      });
    }
    return result;
  } catch (error) {
    return mapUnexpected(error);
  }
}

export async function updateInventoryCountLineAction(rawInput: unknown) {
  try {
    const auth = await requireWarehouseContext();
    if (!auth.success) return auth;
    if (!hasPermission(auth, WAREHOUSE_INVENTORY_ADJUST))
      return { success: false, error: "Unauthorized" };
    const parsed = updateCountLineSchema.safeParse(rawInput);
    if (!parsed.success) return { success: false, error: parsed.error.errors[0].message };
    const userId = userIdFrom(auth);
    const supabase = await createClient();
    const result = await InventoryEnterpriseService.updateCountLine(supabase, parsed.data.id!, {
      counted_quantity: parsed.data.counted_quantity!,
      note: parsed.data.note,
      actor_user_id: userId,
    });
    if (result.success) {
      await emitInventoryEvent(auth, userId, {
        actionKey: "warehouse.inventory.count_line.updated",
        entityType: "inventory_count_line",
        entityId: parsed.data.id!,
        metadata: {
          count_line_id: parsed.data.id!,
          counted_quantity: parsed.data.counted_quantity!,
        },
      });
    }
    return result;
  } catch (error) {
    return mapUnexpected(error);
  }
}

export async function approveInventoryCountSessionAction(rawInput: unknown) {
  try {
    const auth = await requireWarehouseContext();
    if (!auth.success) return auth;
    if (!hasPermission(auth, WAREHOUSE_INVENTORY_ADJUST))
      return { success: false, error: "Unauthorized" };
    const parsed = approveCountSessionSchema.safeParse(rawInput);
    if (!parsed.success) return { success: false, error: parsed.error.errors[0].message };
    const userId = userIdFrom(auth);
    const supabase = await createClient();
    const result = await InventoryEnterpriseService.approveCountSession(
      supabase,
      parsed.data.id!,
      userId
    );
    if (result.success) {
      await emitInventoryEvent(auth, userId, {
        actionKey: "warehouse.inventory.count_session.approved",
        entityType: "inventory_count_session",
        entityId: parsed.data.id!,
        metadata: { count_session_id: parsed.data.id! },
      });
    }
    return result;
  } catch (error) {
    return mapUnexpected(error);
  }
}

async function createAndPostOperation(input: CreateDraftMovementInput) {
  try {
    const auth = await requireWarehouseContext();
    if (!auth.success) return auth;

    const requiredPermission =
      input.movement_kind === "adjustment"
        ? WAREHOUSE_INVENTORY_ADJUST
        : WAREHOUSE_INVENTORY_OPERATE;
    if (!hasPermission(auth, requiredPermission)) {
      return { success: false, error: "Unauthorized" };
    }

    const branch = requireActiveBranch(auth);
    if (!branch.success) return branch;

    const userId = userIdFrom(auth);
    if (!userId) return { success: false, error: "User identity unavailable" };

    const supabase = await createClient();
    const draft = await InventoryMovementsService.createDraftMovement(
      supabase,
      auth.context.app.activeOrgId,
      branch.branchId,
      { ...input, idempotency_key: crypto.randomUUID() },
      userId
    );
    if (!draft.success) return draft;

    const posted = await InventoryMovementsService.postMovement(
      supabase,
      draft.data.movement_id,
      userId
    );
    if (posted.success) {
      await emitMovementEvent(auth, userId, "warehouse.inventory.movement.posted", posted.data);
    }
    return posted;
  } catch (error) {
    return mapUnexpected(error);
  }
}

async function emitInventoryEvent(
  auth: Extract<Awaited<ReturnType<typeof requireWarehouseContext>>, { success: true }>,
  userId: string | null | undefined,
  input: {
    actionKey: string;
    entityType: string;
    entityId: string;
    eventTier?: "baseline" | "enhanced" | "forensic";
    metadata?: Record<string, unknown>;
    branchId?: string | null;
  }
) {
  if (!userId) return;
  await eventService.emit({
    actionKey: input.actionKey,
    actorType: "user",
    actorUserId: userId,
    organizationId: auth.context.app.activeOrgId,
    branchId: input.branchId ?? auth.context.app.activeBranchId ?? null,
    entityType: input.entityType,
    entityId: input.entityId,
    eventTier: input.eventTier ?? "enhanced",
    metadata: input.metadata ?? {},
  });
}

function textFromRecord(value: unknown, keys: string[]) {
  if (!value || typeof value !== "object") return null;
  const record = value as Record<string, unknown>;
  for (const key of keys) {
    const candidate = record[key];
    if (typeof candidate === "string" && candidate.trim()) return candidate;
  }
  return null;
}

async function emitMovementEvent(
  auth: Extract<Awaited<ReturnType<typeof requireWarehouseContext>>, { success: true }>,
  userId: string,
  actionKey: "warehouse.inventory.movement.posted" | "warehouse.inventory.movement.reversed",
  movement: { movement_id: string; movement_number: string; status: string }
) {
  await eventService.emit({
    actionKey,
    actorType: "user",
    actorUserId: userId,
    organizationId: auth.context.app.activeOrgId,
    branchId: auth.context.app.activeBranchId ?? null,
    entityType: "inventory_movement",
    entityId: movement.movement_id,
    eventTier: actionKey.endsWith(".reversed") ? "enhanced" : "baseline",
    metadata: {
      movement_id: movement.movement_id,
      movement_number: movement.movement_number,
      status: movement.status,
    },
  });
}
