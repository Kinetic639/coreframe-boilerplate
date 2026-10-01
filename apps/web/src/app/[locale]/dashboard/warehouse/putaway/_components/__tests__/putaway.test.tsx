/**
 * @vitest-environment jsdom
 *
 * Zone 5 — "Do rozlokowania": grouping per ZL with free stock last, the
 * per-item suggestion (RO container / new container / fixed bin), and the
 * putaway dialog (scan a location sticker -> confirm -> refresh, refusals).
 */
import { render, screen, fireEvent, waitFor, within } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import type { ReceivingPendingItem } from "@/server/services/inventory-receiving.service";

vi.mock("next-intl", () => ({
  useTranslations: () => {
    const t = (key: string, values?: Record<string, unknown>) =>
      values ? `${key}:${JSON.stringify(values)}` : key;
    t.has = () => true;
    return t;
  },
}));

const h = vi.hoisted(() => ({
  putaway: vi.fn(),
  refresh: vi.fn(),
  toastError: vi.fn(),
  toastSuccess: vi.fn(),
  scanLookup: { current: null as unknown },
  scanResult: { current: undefined as string | null | undefined },
}));

vi.mock("react-toastify", () => ({ toast: { error: h.toastError, success: h.toastSuccess } }));
vi.mock("@/i18n/navigation", () => ({ useRouter: () => ({ refresh: h.refresh }) }));
vi.mock("@/app/actions/warehouse/receiving", () => ({
  putawayFromReceivingAction: (...args: unknown[]) => h.putaway(...args),
}));
vi.mock("@/hooks/queries/warehouse", () => ({
  useWarehouseLocationsQuery: () => ({
    isLoading: false,
    data: [
      { id: "prz", code: "PRZ", name: "Strefa przyjęć", can_store_inventory: true },
      { id: "zlc", code: "ZLC-01", name: "Regał", can_store_inventory: true },
      { id: "bin", code: "SZ-02", name: "Kuweta", can_store_inventory: true },
    ],
  }),
}));
vi.mock("@/components/features/qr/qr-camera-scanner", () => ({
  QrCameraScanner: ({ onScanned }: { onScanned: (l: unknown) => Promise<string | null> }) => (
    <button
      data-testid="fake-scan"
      onClick={async () => {
        h.scanResult.current = await onScanned(h.scanLookup.current);
      }}
    >
      scan
    </button>
  ),
}));

import { PutawayBoard } from "../putaway-board";

function item(over: Partial<ReceivingPendingItem>): ReceivingPendingItem {
  return {
    variantId: "v1",
    productId: "p1",
    sku: "SKU",
    productName: "Part",
    unitId: "u",
    unitCode: "szt",
    quantity: 1,
    documentNumber: "PZ/2026/000010",
    repairOrderLineId: null,
    repairOrderId: null,
    zlNumber: null,
    vehicleBrand: null,
    handlingMode: "standard",
    defaultLocation: null,
    container: null,
    ...over,
  };
}

const bumper = item({
  variantId: "v-bumper",
  sku: "5H0807221",
  repairOrderLineId: "rol-1",
  repairOrderId: "ro-1",
  zlNumber: "184213",
  container: {
    id: "c2",
    code: "K-184213-02",
    locationId: "zlc",
    locationCode: "ZLC-01",
    locationName: "Regał",
  },
});
const clips = item({
  variantId: "v-clips",
  sku: "WHT005263",
  quantity: 20,
  repairOrderLineId: "rol-2",
  repairOrderId: "ro-1",
  zlNumber: "184213",
  handlingMode: "bulk",
  defaultLocation: { id: "bin", code: "SZ-02", name: "Kuweta" },
});
const fender = item({
  variantId: "v-fender",
  sku: "5H0821105",
  repairOrderLineId: "rol-3",
  repairOrderId: "ro-2",
  zlNumber: "184257",
});
const free = item({ variantId: "v-free", sku: "FREE-1", quantity: 3 });

function renderBoard(items: ReceivingPendingItem[], canOperate = true) {
  return render(
    <PutawayBoard
      branchId="b1"
      receivingLocationId="prz"
      items={items}
      loadError={false}
      canOperate={canOperate}
    />
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  h.scanResult.current = undefined;
});

describe("PutawayBoard", () => {
  it("groups per ZL, free stock last, with the right suggestion per item", () => {
    renderBoard([free, bumper, clips, fender]);
    const groups = screen.getAllByTestId("putaway-group");
    expect(groups).toHaveLength(2);
    expect(within(groups[0]).getByText("ZL 184213")).toBeInTheDocument();
    expect(screen.getByTestId("putaway-group-free")).toBeInTheDocument();

    const suggestions = screen.getAllByTestId("putaway-suggestion").map((n) => n.textContent);
    expect(suggestions).toContain(
      'suggest.container:{"code":"K-184213-02","location":"ZLC-01 · Regał"}'
    );
    expect(suggestions).toContain('suggest.bulkFixed:{"location":"SZ-02 · Kuweta"}');
    expect(suggestions).toContain("suggest.newContainer");
    expect(suggestions).toContain("suggest.free");
    expect(screen.getAllByTestId("putaway-bulk-badge")).toHaveLength(1);
  });

  it("shows the empty state when nothing waits", () => {
    renderBoard([]);
    expect(screen.getByTestId("putaway-empty")).toBeInTheDocument();
  });

  it("explains a missing receiving zone", () => {
    render(
      <PutawayBoard
        branchId="b1"
        receivingLocationId={null}
        items={[]}
        loadError={false}
        canOperate
      />
    );
    expect(screen.getByTestId("putaway-no-receiving")).toBeInTheDocument();
  });

  it("hides the putaway button without operate permission", () => {
    renderBoard([bumper], false);
    expect(screen.queryByTestId("putaway-open")).not.toBeInTheDocument();
  });
});

describe("PutawayDialog", () => {
  function openFor(target: ReceivingPendingItem) {
    renderBoard([target]);
    fireEvent.click(screen.getByTestId("putaway-open"));
  }

  it("preselects the RO container's location and confirms into that container", async () => {
    h.putaway.mockResolvedValue({
      success: true,
      data: { mode: "container", containerCode: "K-184213-02", containerCreated: false },
    });
    openFor(bumper);
    expect(screen.getByTestId("putaway-outcome")).toHaveTextContent(
      'outcome.intoContainer:{"code":"K-184213-02"}'
    );
    fireEvent.click(screen.getByTestId("putaway-confirm"));
    await waitFor(() =>
      expect(h.putaway).toHaveBeenCalledWith({
        variantId: "v-bumper",
        quantity: 1,
        destinationLocationId: "zlc",
        repairOrderLineId: "rol-1",
      })
    );
    await waitFor(() => expect(h.refresh).toHaveBeenCalled());
    expect(h.toastSuccess).toHaveBeenCalledWith(
      'doneContainer:{"code":"K-184213-02","location":"ZLC-01 · Regał"}'
    );
  });

  it("a scanned location sticker becomes the destination (new RO container there)", async () => {
    h.putaway.mockResolvedValue({
      success: true,
      data: { mode: "container", containerCode: "K-184257-01", containerCreated: true },
    });
    openFor(fender);
    expect(screen.getByTestId("putaway-confirm")).toBeDisabled();
    h.scanLookup.current = {
      id: "q",
      token: "t",
      label: null,
      status: "active",
      assignment: { target_type: "warehouse.location", target_id: "zlc" },
    };
    fireEvent.click(screen.getByTestId("putaway-scan"));
    fireEvent.click(screen.getByTestId("fake-scan"));
    await waitFor(() => expect(h.scanResult.current).toBeNull());
    expect(screen.getByTestId("putaway-outcome")).toHaveTextContent("outcome.newContainer");
    fireEvent.click(screen.getByTestId("putaway-confirm"));
    await waitFor(() =>
      expect(h.toastSuccess).toHaveBeenCalledWith(
        'doneNewContainer:{"code":"K-184257-01","location":"ZLC-01 · Regał"}'
      )
    );
  });

  it("refuses the receiving zone and non-location stickers", async () => {
    openFor(fender);
    fireEvent.click(screen.getByTestId("putaway-scan"));
    h.scanLookup.current = {
      id: "q",
      token: "t",
      label: null,
      status: "active",
      assignment: { target_type: "warehouse.location", target_id: "prz" },
    };
    fireEvent.click(screen.getByTestId("fake-scan"));
    await waitFor(() => expect(h.scanResult.current).toBe("scanIsReceiving"));
    h.scanLookup.current = {
      id: "q",
      token: "t",
      label: null,
      status: "active",
      assignment: { target_type: "inventory.container", target_id: "c2" },
    };
    fireEvent.click(screen.getByTestId("fake-scan"));
    await waitFor(() => expect(h.scanResult.current).toBe("scanNotLocation"));
  });

  it("bulk material goes to its fixed bin, reserved, with partial quantity allowed", async () => {
    h.putaway.mockResolvedValue({ success: true, data: { mode: "bulk" } });
    openFor(clips);
    expect(screen.getByTestId("putaway-outcome")).toHaveTextContent("outcome.bulkReserved");
    fireEvent.change(screen.getByTestId("putaway-qty"), { target: { value: "25" } });
    expect(screen.getByTestId("putaway-confirm")).toBeDisabled();
    fireEvent.change(screen.getByTestId("putaway-qty"), { target: { value: "15" } });
    fireEvent.click(screen.getByTestId("putaway-confirm"));
    await waitFor(() =>
      expect(h.putaway).toHaveBeenCalledWith({
        variantId: "v-clips",
        quantity: 15,
        destinationLocationId: "bin",
        repairOrderLineId: "rol-2",
      })
    );
  });

  it("shows the translated error and keeps the list on a rejected putaway", async () => {
    h.putaway.mockResolvedValue({ success: false, error: "not_enough" });
    openFor(bumper);
    fireEvent.click(screen.getByTestId("putaway-confirm"));
    await waitFor(() => expect(h.toastError).toHaveBeenCalledWith("not_enough"));
    expect(h.refresh).not.toHaveBeenCalled();
  });
});
