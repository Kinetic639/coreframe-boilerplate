import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import React from "react";
import { GuidedCountScreen } from "../index";
import type { EnrichedCountLine, GuidedCountSessionInfo } from "../types";

vi.mock("@/app/actions/warehouse/inventory/count-sessions", () => ({
  updateInventoryCountLineAction: vi.fn(),
  updateInventoryCountSessionStatusAction: vi.fn(),
}));

vi.mock("@/app/actions/qr/assign", () => ({
  getQrCodeByTokenAction: vi.fn(),
}));

vi.mock("react-toastify", () => ({
  toast: { success: vi.fn(), error: vi.fn(), info: vi.fn(), warning: vi.fn() },
}));

vi.mock("next-intl", () => ({
  useTranslations: () => (key: string, values?: Record<string, unknown>) => {
    if (values) return `${key}:${JSON.stringify(values)}`;
    return key;
  },
}));

const pushMock = vi.fn();
vi.mock("@/i18n/navigation", () => ({
  useRouter: () => ({ push: pushMock }),
}));

import { updateInventoryCountLineAction } from "@/app/actions/warehouse/inventory/count-sessions";

function makeWrapper() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  function Wrapper({ children }: { children: React.ReactNode }) {
    return React.createElement(QueryClientProvider, { client: queryClient }, children);
  }
  return Wrapper;
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
    counted_quantity: null,
    variance_quantity: null,
    unit_id: "unit-1",
    status: "pending",
    source: "generated",
    reason_code: null,
    note: null,
    counted_by: null,
    counted_at: null,
    sku: "SKU-1",
    productName: "Widget",
    unitCode: "pcs",
    locationCode: "A-01",
    locationName: "Aisle A, Shelf 1",
    ...overrides,
  };
}

const SESSION: GuidedCountSessionInfo = {
  id: "session-1",
  status: "counting",
  scope: {
    count_type: "location",
    show_expected_quantity: true,
    require_reason_for_variance: true,
  },
};

const LOCATIONS = [{ id: "loc-1", code: "A-01", name: "Aisle A, Shelf 1" }];

beforeEach(() => vi.clearAllMocks());

describe("GuidedCountScreen", () => {
  it("renders the current line's SKU and name", () => {
    render(<GuidedCountScreen session={SESSION} lines={[makeLine()]} locations={LOCATIONS} />, {
      wrapper: makeWrapper(),
    });
    expect(screen.getByText("SKU-1")).toBeInTheDocument();
    expect(screen.getByText("Widget")).toBeInTheDocument();
  });

  it("renders the empty state when there are no lines", () => {
    render(<GuidedCountScreen session={SESSION} lines={[]} locations={LOCATIONS} />, {
      wrapper: makeWrapper(),
    });
    expect(screen.getByText("emptySessionTitle")).toBeInTheDocument();
  });

  it("opens the reason modal when saving a variance without a reason (require_reason_for_variance)", async () => {
    render(<GuidedCountScreen session={SESSION} lines={[makeLine()]} locations={LOCATIONS} />, {
      wrapper: makeWrapper(),
    });

    const input = screen.getByPlaceholderText("quantityPlaceholder");
    await userEvent.clear(input);
    await userEvent.type(input, "5");

    await userEvent.click(screen.getByText("saveAndNext"));

    expect(screen.getByText("reasonRequiredTitle")).toBeInTheDocument();
    expect(updateInventoryCountLineAction).not.toHaveBeenCalled();
  });

  it("saves directly without a reason modal when counted quantity matches expected", async () => {
    vi.mocked(updateInventoryCountLineAction).mockResolvedValue({
      success: true,
      data: { id: "line-1" },
    });

    render(<GuidedCountScreen session={SESSION} lines={[makeLine()]} locations={LOCATIONS} />, {
      wrapper: makeWrapper(),
    });

    const input = screen.getByPlaceholderText("quantityPlaceholder");
    await userEvent.clear(input);
    await userEvent.type(input, "10");

    await userEvent.click(screen.getByText("saveAndNext"));

    await waitFor(() => {
      expect(updateInventoryCountLineAction).toHaveBeenCalledWith(
        expect.objectContaining({ id: "line-1", counted_quantity: 10, status: "counted" })
      );
    });
  });
});
