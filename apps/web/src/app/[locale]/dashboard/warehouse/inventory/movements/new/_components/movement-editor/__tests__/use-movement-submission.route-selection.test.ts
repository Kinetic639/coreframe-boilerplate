import { renderHook, waitFor } from "@testing-library/react";
import { describe, expect, it, vi, beforeEach } from "vitest";

/**
 * Zone 5 Phase 4 wiring -- proves route selection in useMovementSubmission:
 * a Save & Post of a NEW, type-101 movement with at least one
 * source_line_id-carrying line goes through receiveRepairOrderStockAction;
 * every other case (no source_line_id, a different movement type, or edit
 * mode) goes through the existing, unmodified generic actions.
 */

const createAndPostMovementAction = vi.fn();
const createDraftMovementAction = vi.fn();
const saveDraftMovementAction = vi.fn();
const saveAndPostDraftMovementAction = vi.fn();
const receiveRepairOrderStockAction = vi.fn();

vi.mock("@/app/actions/warehouse/inventory", () => ({
  createAndPostMovementAction: (...args: unknown[]) => createAndPostMovementAction(...args),
  createDraftMovementAction: (...args: unknown[]) => createDraftMovementAction(...args),
  saveDraftMovementAction: (...args: unknown[]) => saveDraftMovementAction(...args),
  saveAndPostDraftMovementAction: (...args: unknown[]) => saveAndPostDraftMovementAction(...args),
}));
vi.mock("@/app/actions/warehouse/repair-order-receiving", () => ({
  receiveRepairOrderStockAction: (...args: unknown[]) => receiveRepairOrderStockAction(...args),
}));
vi.mock("next-intl", () => ({
  useTranslations: () => (key: string) => key,
}));
vi.mock("@/i18n/navigation", () => ({
  useRouter: () => ({ push: vi.fn() }),
}));
vi.mock("react-toastify", () => ({
  toast: { error: vi.fn(), success: vi.fn() },
}));

// Imported after mocks are registered.
import { useMovementSubmission } from "../use-movement-submission";
import type { LineDraft, ValidationResult } from "../types";

function makeLine(overrides: Partial<LineDraft> = {}): LineDraft {
  return {
    key: "k1",
    origin: "manual",
    variant_id: "variant-1",
    unit_id: "unit-1",
    sku: "SKU-1",
    product_name: "Test product",
    unit_code: "ea",
    brand_name: null,
    barcode: null,
    quantity: "2",
    on_hand_at_source: null,
    source_location_id: "",
    destination_location_id: "loc-recv",
    note: null,
    ...overrides,
  };
}

const validValidation: ValidationResult = { isValid: true, allErrors: [] } as ValidationResult;

describe("useMovementSubmission -- Zone 5 route selection", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    createAndPostMovementAction.mockResolvedValue({
      success: true,
      data: { document_number: "PZ/1" },
    });
    receiveRepairOrderStockAction.mockResolvedValue({
      success: true,
      data: { document_number: "PZ/2" },
    });
  });

  it("A. routes a NEW 101 Save&Post with a source_line_id-carrying line through receiveRepairOrderStockAction", async () => {
    const lines = [makeLine({ source_line_id: "matcher-line-1" })];
    const { result } = renderHook(() =>
      useMovementSubmission(
        "create",
        "101",
        false,
        "",
        null,
        "",
        null,
        "",
        "",
        "",
        "loc-recv",
        lines,
        validValidation
      )
    );

    result.current.submit(true);

    await waitFor(() => expect(receiveRepairOrderStockAction).toHaveBeenCalledTimes(1));
    expect(createAndPostMovementAction).not.toHaveBeenCalled();
    const payload = receiveRepairOrderStockAction.mock.calls[0][0];
    expect(payload.lines[0]).toMatchObject({
      variant_id: "variant-1",
      unit_id: "unit-1",
      quantity: 2,
      source_line_id: "matcher-line-1",
    });
  });

  it("B. an ordinary 101 (no source_line_id on any line) still goes through the unchanged generic path", async () => {
    const lines = [makeLine({ source_line_id: null })];
    const { result } = renderHook(() =>
      useMovementSubmission(
        "create",
        "101",
        false,
        "",
        null,
        "",
        null,
        "",
        "",
        "",
        "loc-recv",
        lines,
        validValidation
      )
    );

    result.current.submit(true);

    await waitFor(() => expect(createAndPostMovementAction).toHaveBeenCalledTimes(1));
    expect(receiveRepairOrderStockAction).not.toHaveBeenCalled();
  });

  it("C. a different movement type (e.g. 801) with a source_line_id never routes to receive_repair_order_stock", async () => {
    const lines = [makeLine({ source_line_id: "matcher-line-1", source_location_id: "loc-a" })];
    const { result } = renderHook(() =>
      useMovementSubmission(
        "create",
        "801",
        true,
        "",
        null,
        "",
        null,
        "",
        "",
        "loc-a",
        "loc-b",
        lines,
        validValidation
      )
    );

    result.current.submit(true);

    await waitFor(() => expect(createAndPostMovementAction).toHaveBeenCalledTimes(1));
    expect(receiveRepairOrderStockAction).not.toHaveBeenCalled();
  });

  it("D. edit mode never routes to receive_repair_order_stock, even for a 101 with a source_line_id", async () => {
    saveAndPostDraftMovementAction.mockResolvedValue({
      success: true,
      data: { document_number: "PZ/3" },
    });
    const lines = [makeLine({ source_line_id: "matcher-line-1" })];
    const { result } = renderHook(() =>
      useMovementSubmission(
        "edit",
        "101",
        false,
        "",
        null,
        "",
        null,
        "",
        "",
        "",
        "loc-recv",
        lines,
        validValidation,
        {
          movementId: "m-1",
          movementTypeCode: "101",
          draftNumber: "DRF-1",
          documentDate: "",
          operationDate: "",
          senderName: "",
          recipientName: "",
          externalReference: "",
          note: "",
          lines: [],
        }
      )
    );

    result.current.submit(true);

    await waitFor(() => expect(saveAndPostDraftMovementAction).toHaveBeenCalledTimes(1));
    expect(receiveRepairOrderStockAction).not.toHaveBeenCalled();
  });

  it("E. Save Draft (andPost=false) on a RepairOrder-resolvable 101 still uses the generic draft path (disclosed scope limit -- receive_repair_order_stock only supports create+post)", async () => {
    createDraftMovementAction.mockResolvedValue({ success: true, data: { draft_number: "DRF-1" } });
    const lines = [makeLine({ source_line_id: "matcher-line-1" })];
    const { result } = renderHook(() =>
      useMovementSubmission(
        "create",
        "101",
        false,
        "",
        null,
        "",
        null,
        "",
        "",
        "",
        "loc-recv",
        lines,
        validValidation
      )
    );

    result.current.submit(false);

    await waitFor(() => expect(createDraftMovementAction).toHaveBeenCalledTimes(1));
    expect(receiveRepairOrderStockAction).not.toHaveBeenCalled();
  });
});
