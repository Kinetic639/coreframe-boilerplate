import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import React from "react";
import { VarianceReviewScreen } from "../index";
import type { EnrichedCountLine, ReviewSessionInfo } from "../types";

vi.mock("@/app/actions/warehouse/inventory/count-sessions", () => ({
  updateInventoryCountLineAction: vi.fn(),
  bulkApproveCountLinesAction: vi.fn(),
  approveInventoryCountSessionAction: vi.fn(),
  getInventoryCountSessionAction: vi.fn(),
}));

vi.mock("react-toastify", () => ({
  toast: { success: vi.fn(), error: vi.fn() },
}));

vi.mock("next-intl", () => ({
  useTranslations: () => (key: string, values?: Record<string, unknown>) => {
    if (values) return `${key}:${JSON.stringify(values)}`;
    return key;
  },
}));

vi.mock("@/i18n/navigation", () => ({
  useRouter: () => ({ push: vi.fn() }),
}));

import { updateInventoryCountLineAction } from "@/app/actions/warehouse/inventory/count-sessions";

function makeWrapper() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return function Wrapper({ children }: { children: React.ReactNode }) {
    return React.createElement(QueryClientProvider, { client: queryClient }, children);
  };
}

function makeLine(overrides: Partial<EnrichedCountLine> = {}): EnrichedCountLine {
  return {
    id: "line-1",
    count_session_id: "session-1",
    sequence_no: 1,
    variant_id: "variant-1",
    location_id: "loc-1",
    lot_id: null,
    serial_id: null,
    expected_quantity: 10,
    counted_quantity: 10,
    variance_quantity: 0,
    unit_id: "unit-1",
    status: "counted",
    source: "generated",
    reason_code: null,
    note: null,
    counted_by: null,
    counted_at: null,
    sku: "SKU-1",
    productName: "Widget",
    unitCode: "pcs",
    locationCode: "A-01",
    locationName: "Aisle A",
    ...overrides,
  };
}

const SESSION: ReviewSessionInfo = {
  id: "session-1",
  count_number: "CNT-0001",
  status: "submitted",
  scope: { count_type: "location", require_reason_for_variance: true },
};

beforeEach(() => vi.clearAllMocks());

describe("VarianceReviewScreen", () => {
  it("renders the matches group with the initial line", () => {
    render(<VarianceReviewScreen session={SESSION} initialLines={[makeLine()]} />, {
      wrapper: makeWrapper(),
    });
    expect(screen.getByText("SKU-1")).toBeInTheDocument();
  });

  it("shows the empty state when there are no lines", () => {
    render(<VarianceReviewScreen session={SESSION} initialLines={[]} />, {
      wrapper: makeWrapper(),
    });
    expect(screen.getByText("emptyState")).toBeInTheDocument();
  });

  it("regression: approving a line updates the UI immediately without remounting", async () => {
    vi.mocked(updateInventoryCountLineAction).mockResolvedValue({
      success: true,
      data: { id: "line-1" },
    });

    render(<VarianceReviewScreen session={SESSION} initialLines={[makeLine()]} />, {
      wrapper: makeWrapper(),
    });

    // Zero-variance match line has no reason requirement, so "approve" is
    // immediately clickable.
    await userEvent.click(screen.getByText("approve"));

    await waitFor(() => {
      expect(updateInventoryCountLineAction).toHaveBeenCalledWith(
        expect.objectContaining({ id: "line-1", status: "approved" })
      );
    });

    // After the mutation's optimistic patch lands in the query cache this
    // screen subscribes to, the line flips to its approved compact card
    // (shows the match badge) without a reload — the regression test for
    // the "approve button doesn't update" bug.
    await waitFor(() => {
      expect(screen.getByText("matchBadge")).toBeInTheDocument();
    });
  });
});
