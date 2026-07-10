import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import React from "react";
import { FinalReportScreen } from "../index";
import type {
  AdjustmentLine,
  EnrichedCountLine,
  EnrichedReorderReportRow,
  FinalReportSessionInfo,
} from "../types";

vi.mock("@/app/actions/warehouse/inventory/count-sessions", () => ({
  setReorderSuggestionActionAction: vi.fn(),
  getReorderReportAction: vi.fn(),
}));

vi.mock("react-toastify", () => ({
  toast: { success: vi.fn(), error: vi.fn() },
}));

vi.mock("next-intl", () => ({
  useTranslations: () => (key: string, values?: Record<string, unknown>) => {
    if (values) return `${key}:${JSON.stringify(values)}`;
    return key;
  },
  useLocale: () => "en",
}));

vi.mock("@/i18n/navigation", () => ({
  Link: ({ children, href }: { children: React.ReactNode; href: unknown }) =>
    React.createElement("a", { href: String(href) }, children),
}));

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
    counted_quantity: 12,
    variance_quantity: 2,
    unit_id: "unit-1",
    status: "approved",
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

const SESSION: FinalReportSessionInfo = {
  id: "session-1",
  count_number: "CNT-0001",
  status: "approved",
  scope: { count_type: "location", show_expected_quantity: true },
  created_at: "2026-01-01T08:00:00Z",
  updated_at: "2026-01-01T09:00:00Z",
  approved_at: "2026-01-01T10:00:00Z",
};

const ADJUSTMENTS: AdjustmentLine[] = [];
const REORDER_ROWS: EnrichedReorderReportRow[] = [];
const REORDER_FILTER_VARIANT_IDS = new Set<string>(["variant-1"]);

beforeEach(() => vi.clearAllMocks());

describe("FinalReportScreen", () => {
  it("renders the count number and posted badge", () => {
    render(
      <FinalReportScreen
        session={SESSION}
        lines={[makeLine()]}
        adjustments={ADJUSTMENTS}
        initialReorderRows={REORDER_ROWS}
        reorderFilterVariantIds={REORDER_FILTER_VARIANT_IDS}
        branchId="branch-1"
        branchName="Main Warehouse"
        supplierName={null}
      />,
      { wrapper: makeWrapper() }
    );
    expect(screen.getByText("CNT-0001")).toBeInTheDocument();
    expect(screen.getByText("postedBadge")).toBeInTheDocument();
  });

  it("shows the empty-adjustments message when no movements were posted", () => {
    render(
      <FinalReportScreen
        session={SESSION}
        lines={[makeLine()]}
        adjustments={ADJUSTMENTS}
        initialReorderRows={REORDER_ROWS}
        reorderFilterVariantIds={REORDER_FILTER_VARIANT_IDS}
        branchId="branch-1"
        branchName={null}
        supplierName={null}
      />,
      { wrapper: makeWrapper() }
    );
    expect(screen.getByText("adjustmentsEmpty")).toBeInTheDocument();
  });

  it("shows the reorder-empty message when no rows are in scope", () => {
    render(
      <FinalReportScreen
        session={SESSION}
        lines={[makeLine()]}
        adjustments={ADJUSTMENTS}
        initialReorderRows={REORDER_ROWS}
        reorderFilterVariantIds={REORDER_FILTER_VARIANT_IDS}
        branchId="branch-1"
        branchName={null}
        supplierName={null}
      />,
      { wrapper: makeWrapper() }
    );
    expect(screen.getByText("reorderEmpty")).toBeInTheDocument();
  });
});
