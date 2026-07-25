/**
 * @vitest-environment node
 */

import { describe, expect, it } from "vitest";
import type { MovementFieldPolicyBundle } from "@/lib/warehouse/inventory-types";
import { InventoryMovementFieldPoliciesService } from "../inventory-movement-field-policies.service";

function policy(field_key: string, field_scope: "header" | "line", state: any) {
  return {
    field_key,
    field_scope,
    value_type: field_key === "line.quantity" ? "number" : "uuid",
    resolver_kind: null,
    label: field_key,
    label_pl: null,
    is_importable: true,
    policy: state,
    default_strategy: null,
    default_value: {},
    validation: {},
    display_order: 1,
  };
}

const policies: MovementFieldPolicyBundle = {
  "101": [
    policy("header.sender_name", "header", "optional"),
    policy("header.recipient_name", "header", "optional"),
    policy("line.variant_id", "line", "required"),
    policy("line.unit_id", "line", "required"),
    policy("line.quantity", "line", "required"),
    policy("line.source_location_id", "line", "forbidden"),
    policy("line.destination_location_id", "line", "required"),
  ],
  "801": [
    policy("header.sender_name", "header", "forbidden"),
    policy("header.recipient_name", "header", "forbidden"),
    policy("line.variant_id", "line", "required"),
    policy("line.unit_id", "line", "required"),
    policy("line.quantity", "line", "required"),
    policy("line.source_location_id", "line", "required"),
    policy("line.destination_location_id", "line", "required"),
  ],
};

function errorOf(result: { success: boolean; error?: string }) {
  return result.error ?? "";
}

describe("InventoryMovementFieldPoliciesService", () => {
  it("allows PZ sender/recipient candidates and requires destination data", () => {
    const result = InventoryMovementFieldPoliciesService.validateAgainstPolicies(policies, {
      movement_type_code: "101",
      sender_name: "ACME",
      recipient_name: "Warehouse A",
      lines: [
        {
          variant_id: "variant-1",
          unit_id: "unit-1",
          quantity: 2,
          destination_location_id: "loc-dst",
        },
      ],
    });

    expect(result).toEqual({ success: true, data: null });
  });

  it("blocks forbidden source locations for PZ", () => {
    const result = InventoryMovementFieldPoliciesService.validateAgainstPolicies(policies, {
      movement_type_code: "101",
      lines: [
        {
          variant_id: "variant-1",
          unit_id: "unit-1",
          quantity: 2,
          source_location_id: "loc-src",
          destination_location_id: "loc-dst",
        },
      ],
    });

    expect(result.success).toBe(false);
    expect(errorOf(result)).toContain("source_location_id cannot be supplied");
  });

  it("requires MM source and destination and forbids sender/recipient", () => {
    const result = InventoryMovementFieldPoliciesService.validateAgainstPolicies(policies, {
      movement_type_code: "801",
      sender_name: "ACME",
      lines: [
        {
          variant_id: "variant-1",
          unit_id: "unit-1",
          quantity: 2,
          destination_location_id: "loc-dst",
        },
      ],
    });

    expect(result.success).toBe(false);
    expect(errorOf(result)).toContain("sender_name cannot be supplied");
    expect(errorOf(result)).toContain("source_location_id is required");
  });

  it("rejects movement types without a DB policy bundle", () => {
    const result = InventoryMovementFieldPoliciesService.validateAgainstPolicies(policies, {
      movement_type_code: "999",
      lines: [{ variant_id: "v", unit_id: "u", quantity: 1 }],
    });

    expect(result).toEqual({
      success: false,
      error: "Movement field policy is missing for this movement type",
    });
  });
});
