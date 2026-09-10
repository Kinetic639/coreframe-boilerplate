import { describe, it, expect } from "vitest";
import {
  isRepairOrderIdentityStatus,
  isRepairOrderStatus,
  isRepairOrderLineStatus,
  isWorkshopSourceDocumentType,
  isRepairOrderLineMovementRelationType,
  canTransitionRepairOrderStatus,
  computeRepairOrderLineQuantities,
} from "../repair-orders";

describe("Zone 3 repair-orders domain literal-union type guards", () => {
  it("accepts every value in the live identity_status CHECK constraint", () => {
    expect(isRepairOrderIdentityStatus("resolved")).toBe(true);
    expect(isRepairOrderIdentityStatus("unresolved")).toBe(true);
    expect(isRepairOrderIdentityStatus("pending")).toBe(false);
  });

  it("accepts every value in the live (corrected) status CHECK constraint, including archived", () => {
    expect(isRepairOrderStatus("open")).toBe(true);
    expect(isRepairOrderStatus("closed")).toBe(true);
    expect(isRepairOrderStatus("archived")).toBe(true);
    // Explicitly rejects states the work order said not to introduce.
    expect(isRepairOrderStatus("in_progress")).toBe(false);
    expect(isRepairOrderStatus("cancelled")).toBe(false);
    expect(isRepairOrderStatus("completed")).toBe(false);
  });

  it("accepts every value in the live repair_order_lines.status CHECK constraint", () => {
    expect(isRepairOrderLineStatus("pending")).toBe(true);
    expect(isRepairOrderLineStatus("partially_received")).toBe(true);
    expect(isRepairOrderLineStatus("received")).toBe(true);
    expect(isRepairOrderLineStatus("closed")).toBe(true);
    expect(isRepairOrderLineStatus("open")).toBe(false);
  });

  it("accepts every value in the live document_type CHECK constraint", () => {
    expect(isWorkshopSourceDocumentType("zl")).toBe(true);
    expect(isWorkshopSourceDocumentType("zw")).toBe(true);
    expect(isWorkshopSourceDocumentType("wdd")).toBe(true);
    expect(isWorkshopSourceDocumentType("zlec")).toBe(false);
  });

  it("accepts every value in the live relation_type CHECK constraint", () => {
    expect(isRepairOrderLineMovementRelationType("receipt")).toBe(true);
    expect(isRepairOrderLineMovementRelationType("issue")).toBe(true);
    expect(isRepairOrderLineMovementRelationType("reversal")).toBe(true);
    expect(isRepairOrderLineMovementRelationType("transfer")).toBe(false);
  });
});

describe("canTransitionRepairOrderStatus", () => {
  it("allows open -> closed regardless of manage_all", () => {
    expect(canTransitionRepairOrderStatus("open", "closed", false)).toBe(true);
    expect(canTransitionRepairOrderStatus("open", "closed", true)).toBe(true);
  });

  it("allows closed -> open (reopen) regardless of manage_all", () => {
    expect(canTransitionRepairOrderStatus("closed", "open", false)).toBe(true);
  });

  it("blocks any transition to archived without manage_all", () => {
    expect(canTransitionRepairOrderStatus("open", "archived", false)).toBe(false);
    expect(canTransitionRepairOrderStatus("closed", "archived", false)).toBe(false);
  });

  it("allows transition to archived with manage_all", () => {
    expect(canTransitionRepairOrderStatus("open", "archived", true)).toBe(true);
    expect(canTransitionRepairOrderStatus("closed", "archived", true)).toBe(true);
  });

  it("treats archived as terminal -- no transition out of it", () => {
    expect(canTransitionRepairOrderStatus("archived", "open", true)).toBe(false);
    expect(canTransitionRepairOrderStatus("archived", "closed", true)).toBe(false);
  });

  it("rejects a no-op transition to the same status", () => {
    expect(canTransitionRepairOrderStatus("open", "open", true)).toBe(false);
    expect(canTransitionRepairOrderStatus("closed", "closed", true)).toBe(false);
  });
});

describe("computeRepairOrderLineQuantities", () => {
  it("reproduces the architecture doc's exact worked example", () => {
    // ordered=5 across 3 receipt batches totaling 5 (2+2+1), issued=3 across
    // 2 issue batches (2+1) -> outstanding_to_receive=0, available_for_issue=2.
    const result = computeRepairOrderLineQuantities(5, [
      { applied_quantity: 2, relation_type: "receipt" },
      { applied_quantity: 2, relation_type: "receipt" },
      { applied_quantity: 1, relation_type: "receipt" },
      { applied_quantity: 2, relation_type: "issue" },
      { applied_quantity: 1, relation_type: "issue" },
    ]);

    expect(result).toEqual({
      ordered_quantity: 5,
      received_quantity: 5,
      issued_quantity: 3,
      outstanding_to_receive: 0,
      available_for_issue: 2,
    });
  });

  it("handles a partial receipt with nothing issued yet", () => {
    const result = computeRepairOrderLineQuantities(10, [
      { applied_quantity: 4, relation_type: "receipt" },
    ]);

    expect(result.received_quantity).toBe(4);
    expect(result.issued_quantity).toBe(0);
    expect(result.outstanding_to_receive).toBe(6);
    expect(result.available_for_issue).toBe(4);
  });

  it("never infers quantities from SKU/line identity -- only from the movement links passed in", () => {
    // Two independent lines sharing a SKU must never influence each other's
    // computed quantities -- this is enforced structurally by the function
    // only ever seeing the movement links explicitly passed for ONE line.
    const lineA = computeRepairOrderLineQuantities(3, [
      { applied_quantity: 3, relation_type: "receipt" },
    ]);
    const lineB = computeRepairOrderLineQuantities(3, []);

    expect(lineA.received_quantity).toBe(3);
    expect(lineB.received_quantity).toBe(0);
  });

  it("does not count reversal rows toward received or issued (undecided semantics, not guessed)", () => {
    const result = computeRepairOrderLineQuantities(5, [
      { applied_quantity: 5, relation_type: "receipt" },
      { applied_quantity: 2, relation_type: "reversal" },
    ]);

    expect(result.received_quantity).toBe(5);
    expect(result.issued_quantity).toBe(0);
  });

  it("returns zeroed quantities with no movement links", () => {
    const result = computeRepairOrderLineQuantities(7, []);
    expect(result).toEqual({
      ordered_quantity: 7,
      received_quantity: 0,
      issued_quantity: 0,
      outstanding_to_receive: 7,
      available_for_issue: 0,
    });
  });
});
