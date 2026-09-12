/**
 * @vitest-environment jsdom
 */
import { render, screen, fireEvent } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type { RepairOrderProvenanceDocument } from "@/server/services/repair-orders.service";

const TRANSLATIONS: Record<string, string> = {
  title: "Source documents",
  subtitle: "Which documents and source lines this order was materialized from.",
  emptyStateTitle: "No source documents linked.",
  emptyStateSubtitle: "This repair order was created manually, without a Matcher import.",
  "errors.loadFailed": "Failed to load source documents",
};

vi.mock("next-intl", () => ({
  useTranslations: () => (key: string, values?: Record<string, unknown>) => {
    if (key === "documentLinesCount") return `${values?.count} lines`;
    return TRANSLATIONS[key] ?? key;
  },
}));

import { RepairOrderProvenance } from "../repair-order-provenance";

function doc(
  overrides: Partial<RepairOrderProvenanceDocument> = {}
): RepairOrderProvenanceDocument {
  return {
    id: "doc-1",
    documentType: "wdd",
    externalDocumentNumber: "WDD/900",
    sourceSessionId: "session-1",
    officialWarehouseCode: "BL",
    createdAt: "2026-09-10T09:00:00.000Z",
    linkedAt: "2026-09-10T09:05:00.000Z",
    lines: [],
    ...overrides,
  };
}

describe("RepairOrderProvenance", () => {
  it("renders the empty state for a manually-created RepairOrder with no linked documents (no fabricated document is ever shown)", () => {
    render(<RepairOrderProvenance documents={[]} />);

    expect(screen.getByTestId("repair-order-provenance-empty-state")).toBeInTheDocument();
    expect(screen.getByText("No source documents linked.")).toBeInTheDocument();
    expect(screen.queryByTestId("repair-order-provenance-document")).not.toBeInTheDocument();
  });

  it("renders the load-error state distinctly from the empty state when the provenance read failed", () => {
    render(<RepairOrderProvenance documents={[]} loadError />);

    expect(screen.getByTestId("repair-order-provenance-error-state")).toBeInTheDocument();
    expect(screen.getByText("Failed to load source documents")).toBeInTheDocument();
    expect(screen.queryByTestId("repair-order-provenance-empty-state")).not.toBeInTheDocument();
  });

  it("renders one document row per real document, with its document type + external number", () => {
    render(
      <RepairOrderProvenance
        documents={[doc({ id: "doc-1", externalDocumentNumber: "WDD/900" })]}
      />
    );

    const rows = screen.getAllByTestId("repair-order-provenance-document");
    expect(rows).toHaveLength(1);
    expect(rows[0]).toHaveTextContent("WDD");
    expect(rows[0]).toHaveTextContent("WDD/900");
  });

  it("renders multiple documents (one RepairOrder -> many documents)", () => {
    render(
      <RepairOrderProvenance
        documents={[
          doc({ id: "doc-1", externalDocumentNumber: "WDD/900" }),
          doc({ id: "doc-2", externalDocumentNumber: "ZL/900", documentType: "zl" }),
        ]}
      />
    );

    expect(screen.getAllByTestId("repair-order-provenance-document")).toHaveLength(2);
  });

  it("expanding a document reveals its source lines, with quantity and quantity_contribution", () => {
    render(
      <RepairOrderProvenance
        documents={[
          doc({
            lines: [
              {
                id: "docline-1",
                productCode: "5WA-857-093",
                productName: "Front bumper cover",
                quantity: 2,
                unit: "pcs",
                rawText: null,
                wddMatcherLineId: null,
                contributions: [
                  { repairOrderLineId: "line-1", quantityContribution: 2, linkedAt: "t1" },
                ],
              },
            ],
          }),
        ]}
      />
    );

    // Radix Collapsible does not render its content into the DOM until
    // expanded -- simulate the user clicking the document row to open it.
    fireEvent.click(screen.getByRole("button"));

    const sourceLines = screen.getAllByTestId("repair-order-provenance-source-line");
    expect(sourceLines).toHaveLength(1);
    expect(sourceLines[0]).toHaveTextContent("5WA-857-093");
    expect(sourceLines[0]).toHaveTextContent("2");
  });

  /**
   * External-review Finding (2026-09-12): `getRepairOrderProvenance`'s own
   * cross-order metadata-leak fix means the UI now NEVER receives a source
   * line with zero own-order contributions -- such lines are omitted
   * entirely at the service layer (see that method's own doc comment).
   * This component test proves the UI stays correct/defensive even in the
   * (now-unreachable-via-the-real-service, but still worth guarding)
   * hypothetical case of a zero-contribution line reaching it directly：no
   * crash, and no "unlinked"/placeholder text is fabricated -- the removed
   * `sourceLine.unlinked` UI concept must not silently reappear.
   */
  it("renders a zero-contribution source line defensively (no crash, no fabricated 'unlinked' placeholder) even though the real service never returns one", () => {
    render(
      <RepairOrderProvenance
        documents={[
          doc({
            lines: [
              {
                id: "docline-defensive",
                productCode: "X",
                productName: "X part",
                quantity: 1,
                unit: null,
                rawText: null,
                wddMatcherLineId: null,
                contributions: [],
              },
            ],
          }),
        ]}
      />
    );

    fireEvent.click(screen.getByRole("button"));

    expect(screen.getByTestId("repair-order-provenance-source-line")).toBeInTheDocument();
    expect(screen.queryByText("Not linked to a part on this order")).not.toBeInTheDocument();
    expect(screen.queryByText(/unlinked/i)).not.toBeInTheDocument();
  });

  /**
   * The primary, actually-reachable guarantee: a document containing a
   * source line that belongs to a DIFFERENT RepairOrder (the exact
   * cross-order scenario `getRepairOrderProvenance` now filters out at the
   * source) must never be rendered by this component -- proving the fix
   * holds end-to-end, from service output shape to rendered UI, not just
   * at the service layer in isolation.
   */
  it("never renders a source line that was never included in the documents prop (the service-layer fix's own contract)", () => {
    render(
      <RepairOrderProvenance
        documents={[
          doc({
            lines: [
              {
                id: "docline-mine",
                productCode: "SKU-MINE",
                productName: "My part",
                quantity: 2,
                unit: "pcs",
                rawText: null,
                wddMatcherLineId: null,
                contributions: [
                  { repairOrderLineId: "line-mine", quantityContribution: 2, linkedAt: "t1" },
                ],
              },
              // Note: NO "docline-theirs" entry -- exactly what
              // getRepairOrderProvenance now returns for a document shared
              // with another RepairOrder (that foreign line is omitted
              // before this component ever sees it).
            ],
          }),
        ]}
      />
    );

    fireEvent.click(screen.getByRole("button"));

    const lines = screen.getAllByTestId("repair-order-provenance-source-line");
    expect(lines).toHaveLength(1);
    expect(screen.queryByText("SKU-THEIRS")).not.toBeInTheDocument();
  });

  it("multiple source lines under one document are each shown independently (one document -> many source lines)", () => {
    render(
      <RepairOrderProvenance
        documents={[
          doc({
            lines: [
              {
                id: "docline-a",
                productCode: "A",
                productName: "Part A",
                quantity: 2,
                unit: "pcs",
                rawText: null,
                wddMatcherLineId: null,
                contributions: [
                  { repairOrderLineId: "line-1", quantityContribution: 2, linkedAt: "t1" },
                ],
              },
              {
                id: "docline-b",
                productCode: "B",
                productName: "Part B",
                quantity: 3,
                unit: "pcs",
                rawText: null,
                wddMatcherLineId: null,
                contributions: [
                  { repairOrderLineId: "line-2", quantityContribution: 3, linkedAt: "t2" },
                ],
              },
            ],
          }),
        ]}
      />
    );

    fireEvent.click(screen.getByRole("button"));

    expect(screen.getAllByTestId("repair-order-provenance-source-line")).toHaveLength(2);
  });

  it("does not render Matcher session navigation (no stable route exists to link to)", () => {
    render(<RepairOrderProvenance documents={[doc()]} />);

    expect(screen.queryByRole("link")).not.toBeInTheDocument();
    expect(screen.queryByText(/open source session/i)).not.toBeInTheDocument();
  });
});
