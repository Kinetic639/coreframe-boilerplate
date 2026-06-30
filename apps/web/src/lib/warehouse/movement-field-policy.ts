import type {
  MovementFieldPolicy,
  MovementFieldPolicyBundle,
  MovementFieldPolicyState,
} from "./inventory-types";

export const MOVEMENT_FIELD_KEYS = {
  senderName: "header.sender_name",
  senderDetails: "header.sender_details",
  recipientName: "header.recipient_name",
  recipientDetails: "header.recipient_details",
  externalReference: "header.external_reference",
  note: "header.note",
  operationDate: "header.operation_date",
  documentDate: "header.document_date",
  variantId: "line.variant_id",
  unitId: "line.unit_id",
  quantity: "line.quantity",
  sourceLocationId: "line.source_location_id",
  destinationLocationId: "line.destination_location_id",
} as const;

const USER_SUPPLIED_POLICIES = new Set<MovementFieldPolicyState>(["required", "optional"]);

export function policiesForType(
  bundle: MovementFieldPolicyBundle | undefined,
  movementTypeCode: string
): MovementFieldPolicy[] {
  return bundle?.[movementTypeCode] ?? [];
}

export function policyForField(
  policies: MovementFieldPolicy[],
  fieldKey: string
): MovementFieldPolicy | null {
  return policies.find((policy) => policy.field_key === fieldKey) ?? null;
}

export function fieldPolicyState(
  policies: MovementFieldPolicy[],
  fieldKey: string
): MovementFieldPolicyState | null {
  return policyForField(policies, fieldKey)?.policy ?? null;
}

export function canSupplyField(policies: MovementFieldPolicy[], fieldKey: string): boolean {
  const state = fieldPolicyState(policies, fieldKey);
  return state ? USER_SUPPLIED_POLICIES.has(state) : false;
}

export function isFieldRequired(policies: MovementFieldPolicy[], fieldKey: string): boolean {
  return fieldPolicyState(policies, fieldKey) === "required";
}

export function isFieldForbidden(policies: MovementFieldPolicy[], fieldKey: string): boolean {
  const state = fieldPolicyState(policies, fieldKey);
  return state === "forbidden" || state === "hidden" || state === "system";
}

export function movementPolicyCapabilities(
  bundle: MovementFieldPolicyBundle | undefined,
  movementTypeCode: string
) {
  const policies = policiesForType(bundle, movementTypeCode);
  return {
    policies,
    requiresSourceLocation: isFieldRequired(policies, MOVEMENT_FIELD_KEYS.sourceLocationId),
    requiresDestinationLocation: isFieldRequired(
      policies,
      MOVEMENT_FIELD_KEYS.destinationLocationId
    ),
    allowsSender: canSupplyField(policies, MOVEMENT_FIELD_KEYS.senderName),
    requiresSender: isFieldRequired(policies, MOVEMENT_FIELD_KEYS.senderName),
    allowsRecipient: canSupplyField(policies, MOVEMENT_FIELD_KEYS.recipientName),
    requiresRecipient: isFieldRequired(policies, MOVEMENT_FIELD_KEYS.recipientName),
    requiresExternalReference: isFieldRequired(policies, MOVEMENT_FIELD_KEYS.externalReference),
    requiresNote: isFieldRequired(policies, MOVEMENT_FIELD_KEYS.note),
  };
}
