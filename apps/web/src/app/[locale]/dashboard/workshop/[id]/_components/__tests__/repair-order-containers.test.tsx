/**
 * @vitest-environment jsdom
 *
 * Phase 10D — RepairOrderContainers (the order's container list + create
 * form). Hooks and permissions are mocked wholesale.
 */
import { render, screen, fireEvent } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("next-intl", () => ({
  useTranslations: () => {
    const t = (key: string, values?: Record<string, unknown>) =>
      values ? `${key}:${JSON.stringify(values)}` : key;
    t.has = () => true;
    return t;
  },
}));

const h = vi.hoisted(() => ({
  canOperate: { current: true },
  createMutate: vi.fn(),
  refresh: vi.fn(),
}));

vi.mock("@/hooks/v2/use-permissions", () => ({
  usePermissions: () => ({
    can: () => h.canOperate.current,
    cannot: () => !h.canOperate.current,
    canAny: () => h.canOperate.current,
    canAll: () => h.canOperate.current,
  }),
}));

vi.mock("@/hooks/queries/workshop", () => ({
  useCreateRepairOrderContainerMutation: () => ({ mutate: h.createMutate, isPending: false }),
}));

vi.mock("@/hooks/queries/warehouse", () => ({
  useWarehouseLocationsQuery: () => ({
    data: [{ id: "loc-zlc", name: "Półka ZLC-01", code: "ZLC-01" }],
  }),
}));
vi.mock("@/i18n/navigation", () => ({
  useRouter: () => ({ refresh: h.refresh, push: vi.fn(), replace: vi.fn() }),
  Link: ({ children, ...props }: { children: React.ReactNode; href: unknown }) => (
    <a data-href={JSON.stringify(props.href)}>{children}</a>
  ),
}));

import { RepairOrderContainers } from "../repair-order-containers";

const RO_ID = "ro-1";
const containerSummary = {
  id: "c-1",
  code: "K-184213-01",
  status: "active",
  currentLocation: { id: "loc-zlc", name: "Półka ZLC-01", code: "ZLC-01" },
  lineCount: 2,
  totalQuantity: 11,
};

beforeEach(() => {
  vi.clearAllMocks();
  h.canOperate.current = true;
});

describe("RepairOrderContainers", () => {
  it("shows the empty state when the order has no containers", () => {
    render(
      <RepairOrderContainers
        repairOrderId={RO_ID}
        branchId="b-1"
        containers={[]}
        suggestedCode="K-184213-01"
      />
    );
    expect(screen.getByTestId("repair-order-containers-empty")).toBeInTheDocument();
  });

  it("lists containers with code, location and a link to the container screen", () => {
    render(
      <RepairOrderContainers
        repairOrderId={RO_ID}
        branchId="b-1"
        containers={[containerSummary]}
        suggestedCode="K-184213-02"
      />
    );
    expect(screen.getAllByText("K-184213-01").length).toBeGreaterThan(0);
    expect(screen.getAllByText("ZLC-01 · Półka ZLC-01").length).toBeGreaterThan(0);
    const links = document.querySelectorAll("a[data-href]");
    expect([...links].some((a) => a.getAttribute("data-href")!.includes('"id":"c-1"'))).toBe(true);
  });

  it("shows a load error instead of a misleading empty state", () => {
    render(
      <RepairOrderContainers
        repairOrderId={RO_ID}
        branchId="b-1"
        containers={[]}
        loadError
        suggestedCode="K-184213-01"
      />
    );
    expect(screen.getByTestId("repair-order-containers-error")).toBeInTheDocument();
    expect(screen.queryByTestId("repair-order-containers-empty")).not.toBeInTheDocument();
  });

  it("hides the create control without warehouse.inventory.operate", () => {
    h.canOperate.current = false;
    render(
      <RepairOrderContainers
        repairOrderId={RO_ID}
        branchId="b-1"
        containers={[]}
        suggestedCode="K-184213-01"
      />
    );
    expect(screen.queryByTestId("repair-order-container-open-form")).not.toBeInTheDocument();
  });

  it("prefills the suggested code in the create form", () => {
    render(
      <RepairOrderContainers
        repairOrderId={RO_ID}
        branchId="b-1"
        containers={[]}
        suggestedCode="K-184213-01"
      />
    );
    fireEvent.click(screen.getByTestId("repair-order-container-open-form"));
    expect(screen.getByTestId("repair-order-container-code")).toHaveValue("K-184213-01");
    // No location chosen yet -> create is disabled, nothing sent.
    expect(screen.getByTestId("repair-order-container-submit")).toBeDisabled();
    expect(h.createMutate).not.toHaveBeenCalled();
  });
});
