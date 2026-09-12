/**
 * @vitest-environment jsdom
 */
import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi, beforeEach } from "vitest";
import type { RepairOrderLineReadModel } from "@/server/services/repair-orders.service";

const mockGetTranslations = vi.fn();

vi.mock("next-intl/server", () => ({
  getTranslations: (...args: unknown[]) => mockGetTranslations(...args),
}));

const TRANSLATIONS: Record<string, string> = {
  title: "Parts lines",
  subtitle: "The durable order-line list for this repair order.",
  "columns.sku": "SKU",
  "columns.description": "Part / Description",
  "columns.ordered": "Ordered",
  "columns.received": "Received",
  "columns.outstanding": "Outstanding",
  "columns.available": "Available",
  "columns.unit": "Unit",
  emptyStateTitle: "No parts lines yet.",
  emptyStateSubtitle: "Lines are created automatically once materialized.",
  "errors.loadFailed": "Failed to load parts lines",
};

import { RepairOrderLinesList } from "../repair-order-lines-list";

function line(overrides: Partial<RepairOrderLineReadModel> = {}): RepairOrderLineReadModel {
  return {
    id: "line-1",
    repairOrderId: "ro-1",
    variantId: null,
    sku: "5WA-857-093",
    productName: "Front bumper cover",
    orderedQuantity: 2,
    unit: "pcs",
    receivedQuantity: 0,
    issuedQuantity: 0,
    outstandingToReceive: 2,
    availableForIssue: 0,
    status: "pending",
    ...overrides,
  };
}

describe("RepairOrderLinesList", () => {
  beforeEach(() => {
    mockGetTranslations.mockImplementation(async () => (key: string) => TRANSLATIONS[key] ?? key);
  });

  it("renders the empty state when there are no lines (no fake/demo lines are ever rendered)", async () => {
    const el = await RepairOrderLinesList({ lines: [] });
    render(el);

    expect(screen.getByTestId("repair-order-lines-empty-state")).toBeInTheDocument();
    expect(screen.getByText("No parts lines yet.")).toBeInTheDocument();
    expect(screen.queryByTestId("repair-order-line-row")).not.toBeInTheDocument();
  });

  it("renders one row per real line, with SKU/part/quantity columns", async () => {
    const el = await RepairOrderLinesList({ lines: [line()] });
    render(el);

    const rows = screen.getAllByTestId("repair-order-line-row");
    expect(rows).toHaveLength(1);
    expect(screen.getAllByText("5WA-857-093").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Front bumper cover").length).toBeGreaterThan(0);
  });

  it("derived quantity columns (ordered/received/outstanding/available) render the correct real values", async () => {
    const el = await RepairOrderLinesList({
      lines: [
        line({
          orderedQuantity: 5,
          receivedQuantity: 5,
          outstandingToReceive: 0,
          availableForIssue: 2,
          issuedQuantity: 3,
        }),
      ],
    });
    render(el);

    // Desktop table row's numeric cells.
    const rows = screen.getAllByTestId("repair-order-line-row");
    const cells = rows[0].querySelectorAll("td");
    const texts = Array.from(cells).map((c) => c.textContent);
    expect(texts).toContain("5"); // ordered
    expect(texts).toContain("0"); // outstanding
    expect(texts).toContain("2"); // available
  });

  it("same-SKU lines render as separate rows, each with its own independent quantities", async () => {
    const el = await RepairOrderLinesList({
      lines: [
        line({ id: "line-A", sku: "SKU-X", orderedQuantity: 2, outstandingToReceive: 2 }),
        line({ id: "line-B", sku: "SKU-X", orderedQuantity: 3, outstandingToReceive: 3 }),
      ],
    });
    render(el);

    const rows = screen.getAllByTestId("repair-order-line-row");
    expect(rows).toHaveLength(2);
    // Both desktop rows carry the same SKU text, but as two distinct rows
    // -- never collapsed into one "SKU-X, ordered 5" row.
    expect(rows[0].textContent).toContain("SKU-X");
    expect(rows[1].textContent).toContain("SKU-X");
    const orderedCellsA = Array.from(rows[0].querySelectorAll("td")).map((c) => c.textContent);
    const orderedCellsB = Array.from(rows[1].querySelectorAll("td")).map((c) => c.textContent);
    expect(orderedCellsA).toContain("2");
    expect(orderedCellsB).toContain("3");
    // Never rendered anywhere (desktop or mobile) as a merged "5".
    expect(screen.queryByText("5")).not.toBeInTheDocument();
  });

  it("renders a truthful em-dash for a null SKU rather than fabricating a value", async () => {
    const el = await RepairOrderLinesList({ lines: [line({ sku: null })] });
    render(el);

    const row = screen.getByTestId("repair-order-line-row");
    expect(row.textContent).toContain("—");
  });

  it("does not render a source-document column (that belongs to Phase 9's provenance view, not this list)", async () => {
    const el = await RepairOrderLinesList({ lines: [line()] });
    render(el);

    expect(screen.queryByText(/source document/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/document/i)).not.toBeInTheDocument();
  });

  it("does not render the raw persisted line status as a status indicator", async () => {
    const el = await RepairOrderLinesList({ lines: [line({ status: "pending" })] });
    render(el);

    // "pending" must not appear anywhere in the rendered output as a
    // status badge/label for this phase.
    expect(screen.queryByText(/pending/i)).not.toBeInTheDocument();
  });

  it("renders both the desktop table and mobile card representations for the same data (responsive, not two different data sources)", async () => {
    const el = await RepairOrderLinesList({ lines: [line()] });
    render(el);

    expect(screen.getAllByTestId("repair-order-line-row")).toHaveLength(1);
    expect(screen.getAllByTestId("repair-order-line-card")).toHaveLength(1);
  });

  /**
   * Fix (external review): a failed lines read previously collapsed into
   * the exact same empty-state UI as a genuinely empty order -- factually
   * misleading (the caller cannot tell "confirmed zero lines" apart from
   * "we don't actually know"). loadError is a distinct, explicit UI state.
   */
  describe("loadError state (query failed, distinct from a genuinely empty order)", () => {
    it("1. a successful empty result (loadError: false, lines: []) renders the real empty state", async () => {
      const el = await RepairOrderLinesList({ lines: [], loadError: false });
      render(el);

      expect(screen.getByTestId("repair-order-lines-empty-state")).toBeInTheDocument();
      expect(screen.queryByTestId("repair-order-lines-error-state")).not.toBeInTheDocument();
    });

    it("2. a failed lines read (loadError: true) renders the load-error state with the normalized, translated message", async () => {
      const el = await RepairOrderLinesList({ lines: [], loadError: true });
      render(el);

      const errorState = screen.getByTestId("repair-order-lines-error-state");
      expect(errorState).toBeInTheDocument();
      expect(errorState).toHaveTextContent("Failed to load parts lines");
    });

    it("3. a failed lines read does NOT render the empty-state message (the two states are never conflated)", async () => {
      const el = await RepairOrderLinesList({ lines: [], loadError: true });
      render(el);

      expect(screen.queryByTestId("repair-order-lines-empty-state")).not.toBeInTheDocument();
      expect(screen.queryByText("No parts lines yet.")).not.toBeInTheDocument();
    });

    it("4. a normal populated result (loadError: false, real lines) renders the line list unchanged, not the error state", async () => {
      const el = await RepairOrderLinesList({ lines: [line()], loadError: false });
      render(el);

      expect(screen.getAllByTestId("repair-order-line-row")).toHaveLength(1);
      expect(screen.queryByTestId("repair-order-lines-error-state")).not.toBeInTheDocument();
      expect(screen.queryByTestId("repair-order-lines-empty-state")).not.toBeInTheDocument();
    });

    it("defaults to non-error behavior when loadError is omitted (backward-compatible prop)", async () => {
      const el = await RepairOrderLinesList({ lines: [line()] });
      render(el);

      expect(screen.getAllByTestId("repair-order-line-row")).toHaveLength(1);
      expect(screen.queryByTestId("repair-order-lines-error-state")).not.toBeInTheDocument();
    });
  });
});
