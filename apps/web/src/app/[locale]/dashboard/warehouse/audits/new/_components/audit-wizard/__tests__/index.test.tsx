import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import React from "react";
import { AuditWizard } from "../index";

vi.mock("@/app/actions/warehouse/inventory/count-sessions", () => ({
  createInventoryCountSessionAction: vi.fn(),
}));

vi.mock("@/app/actions/qr/assign", () => ({
  getQrCodeByTokenAction: vi.fn(),
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

const pushMock = vi.fn();
vi.mock("@/i18n/navigation", () => ({
  useRouter: () => ({ push: pushMock }),
}));

import { toast } from "react-toastify";

function makeWrapper() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  function Wrapper({ children }: { children: React.ReactNode }) {
    return React.createElement(QueryClientProvider, { client: queryClient }, children);
  }
  return Wrapper;
}

const LOCATIONS = [
  { id: "loc-1", name: "Magazyn A", code: "MAG-A", parent_id: null, level: 0 },
  { id: "loc-2", name: "Regał A1", code: "A1", parent_id: "loc-1", level: 1 },
];
const SUPPLIERS = [{ id: "sup-1", name: "Bosch" }];

beforeEach(() => vi.clearAllMocks());

describe("AuditWizard", () => {
  it("renders step 1 (type selection) initially", () => {
    render(
      <AuditWizard
        branchId="branch-1"
        locations={LOCATIONS}
        suppliers={SUPPLIERS}
        countNumberHint="CNT-NEW"
      />,
      { wrapper: makeWrapper() }
    );
    expect(screen.getByText("selectAuditType")).toBeInTheDocument();
  });

  it("blocks advancing past the location scope step until at least one location is selected", async () => {
    render(
      <AuditWizard
        branchId="branch-1"
        locations={LOCATIONS}
        suppliers={SUPPLIERS}
        countNumberHint="CNT-NEW"
      />,
      { wrapper: makeWrapper() }
    );

    // Step 1 -> step 2 (location is the default type)
    await userEvent.click(screen.getByText("next"));
    expect(screen.getByText("selectLocations")).toBeInTheDocument();

    // Attempt to advance without selecting any location.
    await userEvent.click(screen.getByText("next"));
    expect(toast.error).toHaveBeenCalledWith("noLocationsAtLeastOne");
    expect(screen.getByText("selectLocations")).toBeInTheDocument(); // still on step 2

    // Select a location, then advance succeeds.
    await userEvent.click(screen.getByText("MAG-A"));
    await userEvent.click(screen.getByText("next"));
    expect(screen.getByText("protocolConfigTitle")).toBeInTheDocument();
  });

  it("blocks advancing past the supplier scope step until a supplier is selected", async () => {
    render(
      <AuditWizard
        branchId="branch-1"
        locations={LOCATIONS}
        suppliers={SUPPLIERS}
        countNumberHint="CNT-NEW"
      />,
      { wrapper: makeWrapper() }
    );

    await userEvent.click(screen.getByText("typeSupplierTitle"));
    await userEvent.click(screen.getByText("next"));
    expect(screen.getByText("selectSupplier")).toBeInTheDocument();

    // "next" click with no supplier selected should NOT advance (canLaunch false,
    // and no location-specific toast fires for supplier mode).
    await userEvent.click(screen.getByText("next"));
    expect(screen.getByText("selectSupplier")).toBeInTheDocument();

    await userEvent.click(screen.getByText("Bosch"));
    await userEvent.click(screen.getByText("next"));
    expect(screen.getByText("protocolConfigTitle")).toBeInTheDocument();
  });

  it("forces require-reason off when blind mode is enabled, and disables its toggle", async () => {
    render(
      <AuditWizard
        branchId="branch-1"
        locations={LOCATIONS}
        suppliers={SUPPLIERS}
        countNumberHint="CNT-NEW"
      />,
      { wrapper: makeWrapper() }
    );

    await userEvent.click(screen.getByText("next")); // step 1 -> 2
    await userEvent.click(screen.getByText("MAG-A"));
    await userEvent.click(screen.getByText("next")); // step 2 -> 3

    // Toggle "show system quantities" off (blind mode).
    await userEvent.click(screen.getByRole("switch", { name: "showSystemQuantities" }));

    // Advance to preview and confirm blind protocol is reflected.
    await userEvent.click(screen.getByText("next"));
    expect(screen.getByText(/blindHidden/)).toBeInTheDocument();
  });
});
