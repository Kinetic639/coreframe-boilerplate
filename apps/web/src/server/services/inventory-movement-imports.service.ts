import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import type {
  InventoryMovementType,
  MovementImportExceptionGroup,
  MovementImportPreview,
  MovementImportPreviewLine,
  MovementImportSource,
  MovementFieldPolicy,
} from "@/lib/warehouse/inventory-types";
import { isFieldRequired, MOVEMENT_FIELD_KEYS } from "@/lib/warehouse/movement-field-policy";
import {
  normalizeImportedProductName,
  normalizeImportedSku,
  normalizeImportedUnitCode,
  normalizeImportToken,
} from "@/lib/warehouse/import-utils";
import { InventoryMovementsService, type ServiceResult } from "./inventory-movements.service";
import { InventoryMovementFieldPoliciesService } from "./inventory-movement-field-policies.service";
import { MovementImportSourceRegistry } from "./movement-import-adapters/registry";
import type { CanonicalMovementImportLine } from "./movement-import-adapters/types";
import {
  WarehouseImportResolverService,
  type WarehouseImportResolverContext,
} from "./warehouse-import-resolver.service";

type MovementTypeRow = InventoryMovementType & {
  requires_source_location: boolean;
  requires_destination_location: boolean;
};

type ResolverContext = {
  warehouse: WarehouseImportResolverContext;
  locationsByToken: Map<string, Array<{ id: string; code: string | null; name: string | null }>>;
};

function serviceError(result: ServiceResult<unknown>) {
  return (result as { success: false; error: string }).error;
}

function validationErrors(
  line: {
    variant_id: string | null;
    unit_id: string | null;
    source_location_id: string | null;
    destination_location_id: string | null;
    quantity: number | null;
  },
  policies: MovementFieldPolicy[]
) {
  const errors: string[] = [];
  if (!line.variant_id) errors.push("Product could not be resolved");
  if (!line.unit_id) errors.push("Unit could not be resolved");
  if (!line.quantity || line.quantity <= 0) errors.push("Quantity is required");
  if (isFieldRequired(policies, MOVEMENT_FIELD_KEYS.sourceLocationId) && !line.source_location_id)
    errors.push("Source location is required");
  if (
    isFieldRequired(policies, MOVEMENT_FIELD_KEYS.destinationLocationId) &&
    !line.destination_location_id
  )
    errors.push("Destination location is required");
  if (
    line.source_location_id &&
    line.destination_location_id &&
    line.source_location_id === line.destination_location_id
  ) {
    errors.push("Source and destination locations must differ");
  }
  return errors;
}

function exceptionGroupKey(type: MovementImportExceptionGroup["type"], value: string | null) {
  return `${type}:${value ?? ""}`;
}

function buildExceptionGroups(lines: MovementImportPreviewLine[]): MovementImportExceptionGroup[] {
  const groups = new Map<string, MovementImportExceptionGroup>();

  for (const line of lines) {
    if (line.product_resolution_status === "missing") {
      const key = exceptionGroupKey("missing_product", line.normalized_product_code);
      const current = groups.get(key) ?? {
        type: "missing_product" as const,
        key: line.normalized_product_code ?? "",
        raw_value: line.raw_product_code,
        normalized_value: line.normalized_product_code,
        row_count: 0,
        line_ids: [],
      };
      current.row_count += 1;
      current.line_ids.push(line.source_line_id);
      groups.set(key, current);
    }
    if (line.product_resolution_status === "ambiguous") {
      const key = exceptionGroupKey("ambiguous_product", line.normalized_product_code);
      const current = groups.get(key) ?? {
        type: "ambiguous_product" as const,
        key: line.normalized_product_code ?? "",
        raw_value: line.raw_product_code,
        normalized_value: line.normalized_product_code,
        row_count: 0,
        line_ids: [],
      };
      current.row_count += 1;
      current.line_ids.push(line.source_line_id);
      groups.set(key, current);
    }
    if (line.unit_resolution_status === "missing") {
      const key = exceptionGroupKey("missing_unit", line.normalized_unit_code);
      const current = groups.get(key) ?? {
        type: "missing_unit" as const,
        key: line.normalized_unit_code ?? "",
        raw_value: line.raw_unit,
        normalized_value: line.normalized_unit_code,
        row_count: 0,
        line_ids: [],
      };
      current.row_count += 1;
      current.line_ids.push(line.source_line_id);
      groups.set(key, current);
    }
    if (line.unit_resolution_status === "ambiguous") {
      const key = exceptionGroupKey("ambiguous_unit", line.normalized_unit_code);
      const current = groups.get(key) ?? {
        type: "ambiguous_unit" as const,
        key: line.normalized_unit_code ?? "",
        raw_value: line.raw_unit,
        normalized_value: line.normalized_unit_code,
        row_count: 0,
        line_ids: [],
      };
      current.row_count += 1;
      current.line_ids.push(line.source_line_id);
      groups.set(key, current);
    }
  }

  return Array.from(groups.values()).sort(
    (left, right) =>
      left.type.localeCompare(right.type) ||
      (left.normalized_value ?? "").localeCompare(right.normalized_value ?? "", "pl", {
        numeric: true,
        sensitivity: "base",
      })
  );
}

export class InventoryMovementImportsService {
  static async listSources(
    supabase?: SupabaseClient,
    orgId?: string,
    branchId?: string,
    movementTypeCode?: string
  ): Promise<ServiceResult<MovementImportSource[]>> {
    const adapters = MovementImportSourceRegistry.listAdapters(movementTypeCode);
    const sources: MovementImportSource[] = [];

    for (const adapter of adapters) {
      let inputFields = adapter.inputFields;
      if (supabase && orgId && branchId && movementTypeCode && adapter.loadSourceFields) {
        const fields = await adapter.loadSourceFields(supabase, orgId, branchId, movementTypeCode);
        if (!fields.success) return fields as ServiceResult<MovementImportSource[]>;
        inputFields = fields.data;
      }
      sources.push({
        source_type: adapter.sourceType,
        label: adapter.label,
        description: adapter.description,
        supported_movement_type_codes: adapter.supportedMovementTypeCodes,
        input_fields: inputFields,
      });
    }

    return { success: true, data: sources };
  }

  private static async getMovementType(
    supabase: SupabaseClient,
    orgId: string,
    movementTypeCode: string
  ): Promise<ServiceResult<MovementTypeRow>> {
    const result = await InventoryMovementsService.listMovementTypes(supabase, orgId);
    if (!result.success) return result as ServiceResult<MovementTypeRow>;
    const type = result.data.find((item) => item.code === movementTypeCode);
    if (!type) return { success: false, error: "Movement type not found" };
    return { success: true, data: type as MovementTypeRow };
  }

  private static async buildResolverContext(
    supabase: SupabaseClient,
    orgId: string,
    branchId: string
  ): Promise<ServiceResult<ResolverContext>> {
    const [warehouseResolver, locationsRes] = await Promise.all([
      WarehouseImportResolverService.buildContext(supabase, orgId),
      (supabase as any)
        .from("warehouse_locations")
        .select("id, code, name")
        .eq("organization_id", orgId)
        .eq("branch_id", branchId)
        .eq("can_store_inventory", true)
        .is("deleted_at", null),
    ]);
    if (!warehouseResolver.success) return warehouseResolver as ServiceResult<ResolverContext>;
    if (locationsRes.error) return { success: false, error: locationsRes.error.message };

    const locationsByToken = new Map<
      string,
      Array<{ id: string; code: string | null; name: string | null }>
    >();
    for (const location of locationsRes.data ?? []) {
      for (const raw of [location.code, location.name]) {
        const key = normalizeImportToken(raw);
        if (!key) continue;
        const items = locationsByToken.get(key) ?? [];
        items.push({ id: location.id, code: location.code, name: location.name });
        locationsByToken.set(key, items);
      }
    }

    return {
      success: true,
      data: { warehouse: warehouseResolver.data, locationsByToken },
    };
  }

  private static resolveLocation(rawValue: string | null, resolver: ResolverContext) {
    const normalized = normalizeImportToken(rawValue);
    if (!normalized) return { id: null, error: null };
    const matches = resolver.locationsByToken.get(normalized) ?? [];
    if (matches.length === 1) return { id: matches[0].id, error: null };
    if (matches.length > 1) return { id: null, error: "Location matched multiple records" };
    return { id: null, error: null };
  }

  private static resolveLine(
    line: CanonicalMovementImportLine,
    policies: MovementFieldPolicy[],
    resolver: ResolverContext
  ): MovementImportPreviewLine {
    const errors: string[] = [];
    const normalizedProductCode = normalizeImportedSku(line.rawProductCode) || null;
    const normalizedProductName = normalizeImportedProductName(line.rawProductName) || null;
    const normalizedUnitCode = normalizeImportedUnitCode(line.rawUnit) || null;
    const variant = WarehouseImportResolverService.resolveVariant(
      resolver.warehouse,
      normalizedProductCode
    );
    if (variant.status === "ambiguous") errors.push("Product matched multiple records");

    const unit = WarehouseImportResolverService.resolveUnit(resolver.warehouse, normalizedUnitCode);
    if (!variant.value?.unit_id && unit.status === "ambiguous")
      errors.push("Unit matched multiple records");
    const resolvedUnitId = variant.value?.unit_id ?? unit.value?.id ?? null;
    const unitResolutionStatus = variant.value?.unit_id ? "resolved" : unit.status;
    const rawSourceLocation =
      line.rawSourceLocation ??
      (isFieldRequired(policies, MOVEMENT_FIELD_KEYS.sourceLocationId) &&
      !isFieldRequired(policies, MOVEMENT_FIELD_KEYS.destinationLocationId)
        ? line.rawLocation
        : null);
    const rawDestinationLocation =
      line.rawDestinationLocation ??
      (isFieldRequired(policies, MOVEMENT_FIELD_KEYS.destinationLocationId)
        ? line.rawLocation
        : null);
    const sourceLocation = this.resolveLocation(rawSourceLocation ?? null, resolver);
    const destinationLocation = this.resolveLocation(rawDestinationLocation ?? null, resolver);
    if (sourceLocation.error) errors.push(`Source ${sourceLocation.error.toLowerCase()}`);
    if (destinationLocation.error)
      errors.push(`Destination ${destinationLocation.error.toLowerCase()}`);

    const resolved = {
      variant_id: variant.value?.id ?? null,
      unit_id: resolvedUnitId,
      source_location_id: sourceLocation.id,
      destination_location_id: destinationLocation.id,
      quantity: line.rawQuantity,
    };
    errors.push(...validationErrors(resolved, policies));

    return {
      line_number: line.lineNumber,
      source_line_id: line.sourceLineId,
      raw_product_code: line.rawProductCode,
      raw_product_name: line.rawProductName,
      raw_unit: line.rawUnit,
      raw_quantity: line.rawQuantity,
      normalized_product_code: normalizedProductCode,
      normalized_product_name: normalizedProductName,
      normalized_unit_code: normalizedUnitCode,
      raw_source_location: rawSourceLocation ?? null,
      raw_destination_location: rawDestinationLocation ?? null,
      raw_metadata: line.rawMetadata,
      ...resolved,
      product_resolution_status: variant.status,
      unit_resolution_status: unitResolutionStatus,
      validation_errors: [...new Set(errors)],
    };
  }

  static async previewFromSource(
    supabase: SupabaseClient,
    orgId: string,
    branchId: string,
    input: {
      source_type: string;
      source_input: Record<string, unknown>;
      movement_type_code: string;
    }
  ): Promise<ServiceResult<MovementImportPreview>> {
    const adapter = MovementImportSourceRegistry.getAdapter(input.source_type);
    if (!adapter) return { success: false, error: "Unsupported movement import source" };
    if (!adapter.supportedMovementTypeCodes.includes(input.movement_type_code)) {
      return {
        success: false,
        error: "Selected import source does not support this movement type",
      };
    }

    const movementType = await this.getMovementType(supabase, orgId, input.movement_type_code);
    if (!movementType.success) return { success: false, error: serviceError(movementType) };
    const policyBundle = await InventoryMovementFieldPoliciesService.listForOrganization(
      supabase,
      orgId
    );
    if (!policyBundle.success) return { success: false, error: serviceError(policyBundle) };
    const policies = policyBundle.data[movementType.data.code] ?? [];
    if (policies.length === 0) {
      return { success: false, error: "Movement field policy is missing for this movement type" };
    }

    const resolver = await this.buildResolverContext(supabase, orgId, branchId);
    if (!resolver.success) return { success: false, error: serviceError(resolver) };

    const sourceDocs = await adapter.loadCanonicalDocuments(
      supabase,
      orgId,
      branchId,
      input.source_input
    );
    if (!sourceDocs.success) return { success: false, error: serviceError(sourceDocs) };

    return {
      success: true,
      data: {
        source_type: adapter.sourceType,
        source_label: adapter.label,
        movement_type_code: movementType.data.code,
        documents: sourceDocs.data.map((document) => {
          const lines = document.lines.map((line) =>
            this.resolveLine(line, policies, resolver.data)
          );
          const errors = [...new Set(lines.flatMap((line) => line.validation_errors))];
          const exceptionGroups = buildExceptionGroups(lines);
          return {
            source_document_id: document.sourceDocumentId,
            source_document_number: document.sourceDocumentNumber,
            source_metadata: document.sourceMetadata,
            movement_type_code: movementType.data.code,
            external_reference: document.externalReference,
            sender_name: document.senderName,
            sender_details: (document.senderDetails as any) ?? null,
            recipient_name: document.recipientName,
            recipient_details: (document.recipientDetails as any) ?? null,
            validation_errors: errors,
            exception_groups: exceptionGroups,
            lines,
          };
        }),
      },
    };
  }
}
