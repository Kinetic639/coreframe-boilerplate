import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import type {
  CreateDraftMovementInput,
  MovementFieldPolicy,
  MovementFieldPolicyBundle,
} from "@/lib/warehouse/inventory-types";
import {
  isFieldForbidden,
  isFieldRequired,
  MOVEMENT_FIELD_KEYS,
  policiesForType,
} from "@/lib/warehouse/movement-field-policy";
import type { ServiceResult } from "./inventory-movements.service";

type DraftValidationInput = Omit<CreateDraftMovementInput, "movement_type_code"> & {
  movement_type_code: string;
};

function isPresent(value: unknown) {
  if (value === null || value === undefined) return false;
  if (typeof value === "string") return value.trim().length > 0;
  if (typeof value === "number") return Number.isFinite(value);
  if (typeof value === "object") return Object.keys(value as Record<string, unknown>).length > 0;
  return true;
}

function unique(values: Array<string | null | undefined>) {
  return [...new Set(values.filter((value): value is string => Boolean(value)))];
}

function headerValue(input: DraftValidationInput, fieldKey: string) {
  switch (fieldKey) {
    case MOVEMENT_FIELD_KEYS.senderName:
      return input.sender_name;
    case MOVEMENT_FIELD_KEYS.senderDetails:
      return input.sender_details;
    case MOVEMENT_FIELD_KEYS.recipientName:
      return input.recipient_name;
    case MOVEMENT_FIELD_KEYS.recipientDetails:
      return input.recipient_details;
    case MOVEMENT_FIELD_KEYS.externalReference:
      return input.external_reference;
    case MOVEMENT_FIELD_KEYS.note:
      return input.note;
    case MOVEMENT_FIELD_KEYS.operationDate:
      return input.operation_date;
    case MOVEMENT_FIELD_KEYS.documentDate:
      return input.document_date;
    default:
      return undefined;
  }
}

function lineValue(line: DraftValidationInput["lines"][number], fieldKey: string) {
  switch (fieldKey) {
    case MOVEMENT_FIELD_KEYS.variantId:
      return line.variant_id;
    case MOVEMENT_FIELD_KEYS.unitId:
      return line.unit_id;
    case MOVEMENT_FIELD_KEYS.quantity:
      return line.quantity;
    case MOVEMENT_FIELD_KEYS.sourceLocationId:
      return line.source_location_id;
    case MOVEMENT_FIELD_KEYS.destinationLocationId:
      return line.destination_location_id;
    case "line.lot_id":
      return line.lot_id;
    case "line.serial_id":
      return line.serial_id;
    case "line.unit_cost":
      return line.unit_cost;
    case "line.total_cost":
      return line.total_cost;
    case "line.currency":
      return line.currency;
    case "line.note":
      return line.note;
    default:
      return undefined;
  }
}

function policyLabel(policy: MovementFieldPolicy) {
  return policy.label || policy.field_key;
}

async function countExisting(
  query: PromiseLike<{ data: unknown[] | null; error?: { message: string } | null }>,
  expected: number
) {
  const result = await query;
  if (result.error) return { ok: false, error: result.error.message };
  return { ok: (result.data ?? []).length === expected, error: null };
}

export class InventoryMovementFieldPoliciesService {
  static async listForOrganization(
    supabase: SupabaseClient,
    orgId: string
  ): Promise<ServiceResult<MovementFieldPolicyBundle>> {
    const { data, error } = await (supabase as any)
      .from("inventory_movement_type_field_policies")
      .select(
        "movement_type_code, policy, default_strategy, default_value, validation, display_order, field:inventory_movement_field_definitions!inner(field_key, field_scope, value_type, resolver_kind, label, label_pl, is_importable)"
      )
      .eq("organization_id", orgId)
      .is("deleted_at", null)
      .order("movement_type_code", { ascending: true })
      .order("display_order", { ascending: true });

    if (error) return { success: false, error: error.message };

    const bundle: MovementFieldPolicyBundle = {};
    for (const row of (data ?? []) as any[]) {
      const field = row.field;
      if (!field?.field_key) continue;
      const policy: MovementFieldPolicy = {
        field_key: field.field_key,
        field_scope: field.field_scope,
        value_type: field.value_type,
        resolver_kind: field.resolver_kind ?? null,
        label: field.label,
        label_pl: field.label_pl ?? null,
        is_importable: Boolean(field.is_importable),
        policy: row.policy,
        default_strategy: row.default_strategy ?? null,
        default_value: row.default_value ?? {},
        validation: row.validation ?? {},
        display_order: row.display_order ?? 0,
      };
      const code = row.movement_type_code;
      bundle[code] = [...(bundle[code] ?? []), policy];
    }

    return { success: true, data: bundle };
  }

  static validateAgainstPolicies(
    bundle: MovementFieldPolicyBundle,
    input: DraftValidationInput
  ): ServiceResult<null> {
    const policies = policiesForType(bundle, input.movement_type_code);
    if (policies.length === 0) {
      return { success: false, error: "Movement field policy is missing for this movement type" };
    }

    const errors: string[] = [];
    const headerPolicies = policies.filter((policy) => policy.field_scope === "header");
    const linePolicies = policies.filter((policy) => policy.field_scope === "line");

    for (const policy of headerPolicies) {
      const value = headerValue(input, policy.field_key);
      if (isFieldRequired(policies, policy.field_key) && !isPresent(value)) {
        errors.push(`${policyLabel(policy)} is required`);
      }
      if (isFieldForbidden(policies, policy.field_key) && isPresent(value)) {
        errors.push(`${policyLabel(policy)} cannot be supplied for this movement type`);
      }
    }

    if (!Array.isArray(input.lines) || input.lines.length === 0) {
      errors.push("At least one movement line is required");
    }
    if (input.lines.length > 500) {
      errors.push("Movement line count exceeds the allowed limit");
    }

    input.lines.forEach((line, index) => {
      for (const policy of linePolicies) {
        const value = lineValue(line, policy.field_key);
        if (isFieldRequired(policies, policy.field_key) && !isPresent(value)) {
          errors.push(`Line ${index + 1}: ${policyLabel(policy)} is required`);
        }
        if (isFieldForbidden(policies, policy.field_key) && isPresent(value)) {
          errors.push(`Line ${index + 1}: ${policyLabel(policy)} cannot be supplied`);
        }
      }

      if (!Number.isFinite(Number(line.quantity)) || Number(line.quantity) <= 0) {
        errors.push(`Line ${index + 1}: Quantity must be positive`);
      }
      if (
        line.source_location_id &&
        line.destination_location_id &&
        line.source_location_id === line.destination_location_id
      ) {
        errors.push(`Line ${index + 1}: Source and destination locations must differ`);
      }
    });

    return errors.length > 0
      ? { success: false, error: [...new Set(errors)].join("; ") }
      : { success: true, data: null };
  }

  static async validateDraftInput(
    supabase: SupabaseClient,
    orgId: string,
    branchId: string,
    input: DraftValidationInput
  ): Promise<ServiceResult<null>> {
    const policies = await this.listForOrganization(supabase, orgId);
    if (!policies.success) return policies as ServiceResult<null>;

    const policyResult = this.validateAgainstPolicies(policies.data, input);
    if (!policyResult.success) return policyResult;

    const variantIds = unique(input.lines.map((line) => line.variant_id));
    const unitIds = unique(input.lines.map((line) => line.unit_id));
    const locationIds = unique(
      input.lines.flatMap((line) => [line.source_location_id, line.destination_location_id])
    );

    if (variantIds.length > 0) {
      const result = await countExisting(
        (supabase as any)
          .from("inventory_variants")
          .select("id")
          .eq("organization_id", orgId)
          .in("id", variantIds)
          .is("deleted_at", null),
        variantIds.length
      );
      if (!result.ok) return { success: false, error: result.error ?? "Invalid product variant" };
    }

    if (unitIds.length > 0) {
      const result = await countExisting(
        (supabase as any)
          .from("inventory_units")
          .select("id")
          .eq("organization_id", orgId)
          .in("id", unitIds)
          .is("deleted_at", null),
        unitIds.length
      );
      if (!result.ok) return { success: false, error: result.error ?? "Invalid unit" };
    }

    if (locationIds.length > 0) {
      const result = await countExisting(
        (supabase as any)
          .from("warehouse_locations")
          .select("id")
          .eq("organization_id", orgId)
          .eq("branch_id", branchId)
          .in("id", locationIds)
          .is("deleted_at", null),
        locationIds.length
      );
      if (!result.ok) return { success: false, error: result.error ?? "Invalid location" };
    }

    return { success: true, data: null };
  }
}
