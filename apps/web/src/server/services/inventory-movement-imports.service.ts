import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import type {
  InventoryMovementType,
  MovementImportPreview,
  MovementImportPreviewLine,
  MovementImportSource,
  MovementFieldPolicy,
} from "@/lib/warehouse/inventory-types";
import { isFieldRequired, MOVEMENT_FIELD_KEYS } from "@/lib/warehouse/movement-field-policy";
import { InventoryMovementsService, type ServiceResult } from "./inventory-movements.service";
import { InventoryMovementFieldPoliciesService } from "./inventory-movement-field-policies.service";
import { MovementImportSourceRegistry } from "./movement-import-adapters/registry";
import type { CanonicalMovementImportLine } from "./movement-import-adapters/types";

type MovementTypeRow = InventoryMovementType & {
  requires_source_location: boolean;
  requires_destination_location: boolean;
};

type ResolverContext = {
  variantsByToken: Map<string, Array<{ id: string; sku: string | null }>>;
  unitsByToken: Map<string, { id: string; code: string | null }>;
  locationsByToken: Map<string, Array<{ id: string; code: string | null; name: string | null }>>;
};

function serviceError(result: ServiceResult<unknown>) {
  return (result as { success: false; error: string }).error;
}

function normalizeToken(value: string | null | undefined) {
  return (value ?? "").trim().toLowerCase();
}

function fingerprint(value: string | null | undefined) {
  return (value ?? "")
    .trim()
    .toUpperCase()
    .replace(/[^\p{L}\p{N}]/gu, "");
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

function resolveUnique<T extends { id: string }>(
  candidates: Map<string, T[]>,
  rawValue: string | null | undefined
): { id: string | null; error: string | null } {
  const key = fingerprint(rawValue);
  if (!key) return { id: null, error: null };
  const matches = candidates.get(key) ?? [];
  if (matches.length === 1) return { id: matches[0].id, error: null };
  if (matches.length > 1) return { id: null, error: "Matched multiple records" };
  return { id: null, error: null };
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
    const [variantsRes, unitsRes, locationsRes] = await Promise.all([
      (supabase as any)
        .from("inventory_variants")
        .select("id, sku, barcode")
        .eq("organization_id", orgId)
        .eq("status", "active")
        .is("deleted_at", null),
      (supabase as any)
        .from("inventory_units")
        .select("id, code")
        .eq("organization_id", orgId)
        .is("deleted_at", null),
      (supabase as any)
        .from("warehouse_locations")
        .select("id, code, name")
        .eq("organization_id", orgId)
        .eq("branch_id", branchId)
        .eq("can_store_inventory", true)
        .is("deleted_at", null),
    ]);
    if (variantsRes.error) return { success: false, error: variantsRes.error.message };
    if (unitsRes.error) return { success: false, error: unitsRes.error.message };
    if (locationsRes.error) return { success: false, error: locationsRes.error.message };

    const variantsByToken = new Map<string, Array<{ id: string; sku: string | null }>>();
    for (const variant of variantsRes.data ?? []) {
      for (const raw of [variant.sku, variant.barcode]) {
        const key = fingerprint(raw);
        if (!key) continue;
        const items = variantsByToken.get(key) ?? [];
        items.push({ id: variant.id, sku: variant.sku });
        variantsByToken.set(key, items);
      }
    }

    const unitsByToken = new Map<string, { id: string; code: string | null }>();
    for (const unit of unitsRes.data ?? []) {
      const key = normalizeToken(unit.code);
      if (key) unitsByToken.set(key, { id: unit.id, code: unit.code });
    }

    const locationsByToken = new Map<
      string,
      Array<{ id: string; code: string | null; name: string | null }>
    >();
    for (const location of locationsRes.data ?? []) {
      for (const raw of [location.code, location.name]) {
        const key = normalizeToken(raw);
        if (!key) continue;
        const items = locationsByToken.get(key) ?? [];
        items.push({ id: location.id, code: location.code, name: location.name });
        locationsByToken.set(key, items);
      }
    }

    return { success: true, data: { variantsByToken, unitsByToken, locationsByToken } };
  }

  private static resolveLocation(rawValue: string | null, resolver: ResolverContext) {
    const normalized = normalizeToken(rawValue);
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
    const variant = resolveUnique(resolver.variantsByToken, line.rawProductCode);
    if (variant.error) errors.push(`Product ${variant.error.toLowerCase()}`);

    const unitId = resolver.unitsByToken.get(normalizeToken(line.rawUnit))?.id ?? null;
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
      variant_id: variant.id,
      unit_id: unitId,
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
      raw_source_location: rawSourceLocation ?? null,
      raw_destination_location: rawDestinationLocation ?? null,
      raw_metadata: line.rawMetadata,
      ...resolved,
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
            lines,
          };
        }),
      },
    };
  }
}
