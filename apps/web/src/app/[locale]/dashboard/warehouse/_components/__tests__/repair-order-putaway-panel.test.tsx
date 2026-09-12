import { render, screen, fireEvent, waitFor, within } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";

/**
 * Zone 5 Phase 5/7 -- component tests for RepairOrderPutawayPanel (external
 * review correction: previously zero component tests existed). Covers the
 * 9 scenarios the review specifically asked for: KNOWN actionable, UNKNOWN
 * never confident, batch payload construction, partial quantity, manual
 * destination selection, API failure, no-selection guard, success, and
 * that error messages are surfaced as-is (normalization itself is proven
 * at the action layer in repair-order-receiving.test.ts -- this file
 * proves the panel doesn't further mangle or re-interpret them).
 */

vi.mock("react-toastify", () => ({ toast: { error: vi.fn(), success: vi.fn() } }));

const getRepairOrderStorageSuggestionsAction = vi.fn();
const putawayRepairOrderStockAction = vi.fn();
vi.mock("@/app/actions/warehouse/repair-order-receiving", () => ({
  getRepairOrderStorageSuggestionsAction: (...args: unknown[]) =>
    getRepairOrderStorageSuggestionsAction(...args),
  putawayRepairOrderStockAction: (...args: unknown[]) => putawayRepairOrderStockAction(...args),
}));

const listLocationsAction = vi.fn();
vi.mock("@/app/actions/warehouse/locations", () => ({
  listLocationsAction: () => listLocationsAction(),
}));

import { RepairOrderPutawayPanel, type PutawayLineInput } from "../repair-order-putaway-panel";
import { toast } from "react-toastify";

const lineA: PutawayLineInput = {
  repairOrderLineId: "rol-1",
  variantId: "var-1",
  unitId: "unit-1",
  sku: "SKU-1",
  productName: "Bumper",
  availableAtReceiving: 5,
};
const lineB: PutawayLineInput = {
  repairOrderLineId: "rol-2",
  variantId: "var-2",
  unitId: "unit-2",
  sku: "SKU-2",
  productName: "Door handle",
  availableAtReceiving: 3,
};

function setup(suggestions: unknown[] = [], locations: unknown[] = []) {
  getRepairOrderStorageSuggestionsAction.mockResolvedValue({ success: true, data: suggestions });
  listLocationsAction.mockResolvedValue({ success: true, data: locations });
}

describe("RepairOrderPutawayPanel", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("A. a KNOWN suggestion renders a working [Put here] button", async () => {
    setup([
      {
        locationId: "loc-A",
        locationCode: "A-01",
        locationName: "Bin A-01",
        distinctRepairOrderLines: 1,
        currentQuantity: 5,
        variants: [],
        containerSummary: null,
        attributionStatus: "known",
      },
    ]);
    putawayRepairOrderStockAction.mockResolvedValue({ success: true, data: {} });

    render(
      <RepairOrderPutawayPanel
        repairOrderId="ro-1"
        repairOrderLabel="ZL/1"
        receivedLines={[lineA]}
      />
    );

    await waitFor(() =>
      expect(screen.getByTestId("putaway-suggestion-known-loc-A")).toBeInTheDocument()
    );
    fireEvent.click(screen.getByTestId(`putaway-line-checkbox-${lineA.repairOrderLineId}`));
    fireEvent.click(
      within(screen.getByTestId("putaway-suggestion-known-loc-A")).getByText("Put here")
    );

    await waitFor(() => expect(putawayRepairOrderStockAction).toHaveBeenCalledTimes(1));
    expect(putawayRepairOrderStockAction.mock.calls[0][0].destination_location_id).toBe("loc-A");
  });

  it("B. an UNKNOWN suggestion is NEVER rendered as a confident [Put here] target", async () => {
    setup([
      {
        locationId: "loc-A",
        locationCode: "A-01",
        locationName: "Bin A-01",
        distinctRepairOrderLines: 1,
        currentQuantity: 5,
        variants: [],
        containerSummary: null,
        attributionStatus: "known",
      },
      {
        locationId: "loc-B",
        locationCode: "B-02",
        locationName: "Bin B-02",
        distinctRepairOrderLines: 2,
        currentQuantity: 9,
        variants: [],
        containerSummary: null,
        attributionStatus: "unknown",
      },
    ]);

    render(
      <RepairOrderPutawayPanel
        repairOrderId="ro-1"
        repairOrderLabel="ZL/1"
        receivedLines={[lineA]}
      />
    );

    await waitFor(() =>
      expect(screen.getByTestId("putaway-suggestions-unknown-banner")).toBeInTheDocument()
    );
    expect(screen.queryByTestId("putaway-suggestion-known-loc-B")).not.toBeInTheDocument();
    // The banner communicates uncertainty, not a confident location card.
    expect(screen.getByTestId("putaway-suggestions-unknown-banner").textContent).toMatch(
      /requires verification/i
    );
  });

  it("C/D. batch selection with partial quantity builds the correct per-line payload", async () => {
    setup([], [{ id: "loc-manual", code: "B-02", name: "Bin B-02", can_store_inventory: true }]);
    putawayRepairOrderStockAction.mockResolvedValue({ success: true, data: {} });

    render(
      <RepairOrderPutawayPanel
        repairOrderId="ro-1"
        repairOrderLabel="ZL/1"
        receivedLines={[lineA, lineB]}
      />
    );
    await waitFor(() => expect(listLocationsAction).toHaveBeenCalled());

    fireEvent.click(screen.getByTestId(`putaway-line-checkbox-${lineA.repairOrderLineId}`));
    fireEvent.click(screen.getByTestId(`putaway-line-checkbox-${lineB.repairOrderLineId}`));
    // Partial quantity on line A: 3 of 5 available.
    fireEvent.change(screen.getByTestId(`putaway-line-qty-${lineA.repairOrderLineId}`), {
      target: { value: "3" },
    });

    fireEvent.change(screen.getByTestId("putaway-manual-location-select"), {
      target: { value: "loc-manual" },
    });
    fireEvent.click(screen.getByText("Put here", { selector: "button" }));

    await waitFor(() => expect(putawayRepairOrderStockAction).toHaveBeenCalledTimes(1));
    const payload = putawayRepairOrderStockAction.mock.calls[0][0];
    expect(payload.destination_location_id).toBe("loc-manual");
    expect(payload.lines).toHaveLength(2);
    expect(payload.lines).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ repair_order_line_id: "rol-1", quantity: 3 }),
        expect.objectContaining({ repair_order_line_id: "rol-2", quantity: 3 }), // full quantity, unedited
      ])
    );
  });

  it("E. the manual destination selector shows location code/name, never a raw UUID input", async () => {
    setup([], [{ id: "loc-manual", code: "B-02", name: "Bin B-02", can_store_inventory: true }]);

    render(
      <RepairOrderPutawayPanel
        repairOrderId="ro-1"
        repairOrderLabel="ZL/1"
        receivedLines={[lineA]}
      />
    );

    await waitFor(() => expect(listLocationsAction).toHaveBeenCalled());
    const select = await screen.findByTestId("putaway-manual-location-select");
    expect(select.tagName).toBe("SELECT");
    expect(screen.getByText("B-02 — Bin B-02")).toBeInTheDocument();
    // No raw-UUID text input anywhere in the destination area.
    expect(screen.queryByPlaceholderText(/location id/i)).not.toBeInTheDocument();
  });

  it("F. an API failure surfaces the action's own (already-normalized) error message, unmodified", async () => {
    setup([], [{ id: "loc-x", code: "X-01", name: "Bin X-01", can_store_inventory: true }]);
    putawayRepairOrderStockAction.mockResolvedValue({
      success: false,
      error:
        "Putaway failed due to an unexpected server error. Please try again or contact support.",
    });

    render(
      <RepairOrderPutawayPanel
        repairOrderId="ro-1"
        repairOrderLabel="ZL/1"
        receivedLines={[lineA]}
      />
    );
    await waitFor(() => expect(getRepairOrderStorageSuggestionsAction).toHaveBeenCalled());

    fireEvent.click(screen.getByTestId(`putaway-line-checkbox-${lineA.repairOrderLineId}`));
    fireEvent.change(screen.getByTestId("putaway-manual-location-select"), {
      target: { value: "loc-x" },
    });
    fireEvent.click(screen.getByText("Put here", { selector: "button" }));

    await waitFor(() =>
      expect(toast.error).toHaveBeenCalledWith(
        "Putaway failed due to an unexpected server error. Please try again or contact support."
      )
    );
  });

  it("G. submitting with no line selected is blocked client-side (no API call)", async () => {
    setup([], [{ id: "loc-x", code: "X-01", name: "Bin X-01", can_store_inventory: true }]);
    render(
      <RepairOrderPutawayPanel
        repairOrderId="ro-1"
        repairOrderLabel="ZL/1"
        receivedLines={[lineA]}
      />
    );
    await waitFor(() => expect(getRepairOrderStorageSuggestionsAction).toHaveBeenCalled());

    fireEvent.change(screen.getByTestId("putaway-manual-location-select"), {
      target: { value: "loc-x" },
    });
    fireEvent.click(screen.getByText("Put here", { selector: "button" }));

    expect(toast.error).toHaveBeenCalledWith("Select at least one received line to put away.");
    expect(putawayRepairOrderStockAction).not.toHaveBeenCalled();
  });

  it("H. successful completion clears selection and shows a success toast", async () => {
    setup([], [{ id: "loc-x", code: "X-01", name: "Bin X-01", can_store_inventory: true }]);
    putawayRepairOrderStockAction.mockResolvedValue({ success: true, data: {} });
    render(
      <RepairOrderPutawayPanel
        repairOrderId="ro-1"
        repairOrderLabel="ZL/1"
        receivedLines={[lineA]}
      />
    );
    await waitFor(() => expect(getRepairOrderStorageSuggestionsAction).toHaveBeenCalled());

    fireEvent.click(screen.getByTestId(`putaway-line-checkbox-${lineA.repairOrderLineId}`));
    fireEvent.change(screen.getByTestId("putaway-manual-location-select"), {
      target: { value: "loc-x" },
    });
    fireEvent.click(screen.getByText("Put here", { selector: "button" }));

    await waitFor(() => expect(toast.success).toHaveBeenCalledWith("Stock put away."));
    expect(
      (screen.getByTestId(`putaway-line-checkbox-${lineA.repairOrderLineId}`) as HTMLInputElement)
        .checked
    ).toBe(false);
  });

  it("I. no capacity/percentage figure is ever rendered", async () => {
    setup([
      {
        locationId: "loc-A",
        locationCode: "A-01",
        locationName: "Bin A-01",
        distinctRepairOrderLines: 1,
        currentQuantity: 5,
        variants: [],
        containerSummary: null,
        attributionStatus: "known",
      },
    ]);
    render(
      <RepairOrderPutawayPanel
        repairOrderId="ro-1"
        repairOrderLabel="ZL/1"
        receivedLines={[lineA]}
      />
    );
    await waitFor(() =>
      expect(screen.getByTestId("putaway-suggestion-known-loc-A")).toBeInTheDocument()
    );
    expect(screen.queryByText(/%/)).not.toBeInTheDocument();
    expect(screen.queryByText(/capacity/i)).not.toBeInTheDocument();
  });
});
