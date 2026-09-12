import { render, screen } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";

/**
 * Zone 5 -- external review correction: a genuine storage-read failure must
 * not render identically to "zero received lines" (both previously
 * collapsed to an empty array). This test proves the three real outcomes
 * are distinguished, and that a read failure never fails the whole
 * RepairOrder detail page or leaks a raw error message.
 */

vi.mock("next/navigation", () => ({ notFound: vi.fn() }));
vi.mock("@/i18n/navigation", () => ({
  redirect: vi.fn(),
  Link: ({ children, href }: { children: React.ReactNode; href: string }) => (
    <a href={href}>{children}</a>
  ),
}));
vi.mock("next-intl/server", () => ({
  getLocale: async () => "en",
  getTranslations: async () => (key: string) => key,
}));
vi.mock("@/server/loaders/v2/load-dashboard-context.v2", () => ({
  loadDashboardContextV2: vi.fn(),
}));
vi.mock("@/lib/utils/permissions", () => ({ checkPermission: () => true }));
vi.mock("@/utils/supabase/server", () => ({ createClient: async () => ({}) }));

const getByIdForWorkshop = vi.fn();
vi.mock("@/server/services/repair-orders.service", () => ({
  RepairOrdersService: { getByIdForWorkshop: (...args: unknown[]) => getByIdForWorkshop(...args) },
}));

const getReceivedLines = vi.fn();
vi.mock("@/server/services/repair-order-storage.service", () => ({
  RepairOrderStorageService: {
    getReceivedLines: (...args: unknown[]) => getReceivedLines(...args),
  },
}));

vi.mock("../../_components/repair-order-status-badge", () => ({
  RepairOrderStatusBadge: ({ status }: { status: string }) => <span>{status}</span>,
}));
vi.mock("../../../warehouse/_components/repair-order-putaway-panel", () => ({
  RepairOrderPutawayPanel: () => <div data-testid="putaway-panel-stub">Putaway panel</div>,
}));

import { loadDashboardContextV2 } from "@/server/loaders/v2/load-dashboard-context.v2";
import RepairOrderDetailPage from "../page";

function mockOrderFound() {
  getByIdForWorkshop.mockResolvedValue({
    success: true,
    data: {
      zlNumber: "ZL/1",
      orderNumber: "ORD-1",
      vin: "VIN123",
      identityStatus: "confirmed",
      advisorDisplayName: "Advisor",
      status: "open",
      createdAt: "2026-01-01T00:00:00Z",
      updatedAt: "2026-01-01T00:00:00Z",
    },
  });
}

describe("RepairOrderDetailPage -- received-lines load error vs. empty", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(loadDashboardContextV2).mockResolvedValue({
      app: { activeOrgId: "org-1", activeBranchId: "branch-1" },
      user: { permissionSnapshot: {} },
    } as never);
  });

  it("SUCCESS + no received lines -> no putaway panel, no error shown", async () => {
    mockOrderFound();
    getReceivedLines.mockResolvedValue({ success: true, data: [] });

    const page = await RepairOrderDetailPage({ params: Promise.resolve({ id: "ro-1" }) });
    render(page);

    expect(screen.queryByTestId("putaway-panel-stub")).not.toBeInTheDocument();
    expect(screen.queryByTestId("received-lines-error")).not.toBeInTheDocument();
    // The rest of the page still rendered normally.
    expect(screen.getByTestId("repair-order-detail-card")).toBeInTheDocument();
  });

  it("SUCCESS + received lines -> putaway panel shown, no error", async () => {
    mockOrderFound();
    getReceivedLines.mockResolvedValue({
      success: true,
      data: [
        {
          repairOrderLineId: "rol-1",
          variantId: "v-1",
          unitId: "u-1",
          sku: "SKU-1",
          productName: "Bumper",
          availableAtReceiving: 3,
        },
      ],
    });

    const page = await RepairOrderDetailPage({ params: Promise.resolve({ id: "ro-1" }) });
    render(page);

    expect(screen.getByTestId("putaway-panel-stub")).toBeInTheDocument();
    expect(screen.queryByTestId("received-lines-error")).not.toBeInTheDocument();
  });

  it("ERROR -> compact local error shown, no putaway panel, rest of the page still renders, raw error not leaked", async () => {
    mockOrderFound();
    getReceivedLines.mockResolvedValue({
      success: false,
      error: 'relation "repair_order_line_locations_typo" does not exist -- raw internal detail',
    });

    const page = await RepairOrderDetailPage({ params: Promise.resolve({ id: "ro-1" }) });
    render(page);

    expect(screen.queryByTestId("putaway-panel-stub")).not.toBeInTheDocument();
    const errorEl = screen.getByTestId("received-lines-error");
    expect(errorEl).toBeInTheDocument();
    expect(errorEl.textContent).not.toContain("repair_order_line_locations_typo");
    expect(errorEl.textContent).toMatch(/could not load receiving stock/i);
    // The rest of the RepairOrder detail page still rendered -- a storage
    // read failure must never fail the whole page.
    expect(screen.getByTestId("repair-order-detail-card")).toBeInTheDocument();
  });
});
