import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import React from "react";
import { ReorderSuggestionsPanel } from "../reorder-suggestions-panel";
import type { EnrichedReorderReportRow } from "@/lib/warehouse/count-session-types";

vi.mock("@/app/actions/warehouse/inventory/count-sessions", () => ({
  getReorderReportAction: vi.fn(),
  setReorderSuggestionActionAction: vi.fn(),
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

import {
  getReorderReportAction,
  setReorderSuggestionActionAction,
} from "@/app/actions/warehouse/inventory/count-sessions";

function makeWrapper() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return function Wrapper({ children }: { children: React.ReactNode }) {
    return React.createElement(QueryClientProvider, { client: queryClient }, children);
  };
}

function makeRow(overrides: Partial<EnrichedReorderReportRow> = {}): EnrichedReorderReportRow {
  return {
    variant_id: "v1",
    location_id: null,
    on_hand_quantity: 2,
    reorder_point: 5,
    min_quantity: 1,
    suggested_order_quantity: 10,
    preferred_supplier_id: "sup-1",
    sku: "SKU-1",
    productName: "Widget",
    unitCode: "pcs",
    locationCode: null,
    locationName: null,
    supplierName: "Acme Supplies",
    actionStatus: null,
    ...overrides,
  };
}

const BRANCH_ID = "branch-1";

beforeEach(() => vi.clearAllMocks());

describe("ReorderSuggestionsPanel", () => {
  it("renders rows grouped by supplier from initialRows", () => {
    render(<ReorderSuggestionsPanel initialRows={[makeRow()]} branchId={BRANCH_ID} />, {
      wrapper: makeWrapper(),
    });
    expect(screen.getByText("SKU-1")).toBeInTheDocument();
    expect(screen.getByText("Acme Supplies")).toBeInTheDocument();
  });

  it("shows the empty state when there are no rows", () => {
    render(<ReorderSuggestionsPanel initialRows={[]} branchId={BRANCH_ID} />, {
      wrapper: makeWrapper(),
    });
    expect(screen.getByText("empty")).toBeInTheDocument();
  });

  it("regression: accepting a suggestion flips the button to 'Accepted' immediately without remounting", async () => {
    vi.mocked(setReorderSuggestionActionAction).mockResolvedValue({
      success: true,
      data: { id: "action-1" },
    });
    // Simulates the refetch triggered by the mutation's cache invalidation
    // returning the now-accepted row.
    vi.mocked(getReorderReportAction).mockResolvedValue({
      success: true,
      data: [makeRow({ actionStatus: "accepted" })],
    });

    render(<ReorderSuggestionsPanel initialRows={[makeRow()]} branchId={BRANCH_ID} />, {
      wrapper: makeWrapper(),
    });

    await userEvent.click(screen.getByText("accept"));

    await waitFor(() => {
      expect(setReorderSuggestionActionAction).toHaveBeenCalledWith(
        expect.objectContaining({ variant_id: "v1", status: "accepted" })
      );
    });

    // The mutation invalidates the reorder-report query this panel
    // subscribes to; after refetch the button flips to "accepted" without a
    // page reload — the regression test for the accept/ignore staleness bug.
    await waitFor(() => {
      expect(screen.getByText("accepted")).toBeInTheDocument();
    });
  });
});
