/**
 * @vitest-environment jsdom
 *
 * Scan-driven putaway: one scan decides the path -- an RO container (add its
 * order's parts, all preselected), a blank sticker (new container: order ->
 * parts -> location, bound to the sticker) or a location (what lies there;
 * loose putaway with the bin's fixed material preselected).
 */
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
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
  batch: vi.fn(),
  getContainer: vi.fn(),
  getLocation: vi.fn(),
  refresh: vi.fn(),
  toastError: vi.fn(),
  toastSuccess: vi.fn(),
  toastWarning: vi.fn(),
  scanLookup: { current: null as unknown },
  scanResult: { current: undefined as string | null | undefined },
}));

vi.mock("react-toastify", () => ({
  toast: { error: h.toastError, success: h.toastSuccess, warning: h.toastWarning },
}));
vi.mock("@/i18n/navigation", () => ({ useRouter: () => ({ refresh: h.refresh }) }));
vi.mock("@/app/actions/warehouse/putaway-scan", () => ({
  putawayBatchAction: (...a: unknown[]) => h.batch(...a),
  getScannedContainerAction: (...a: unknown[]) => h.getContainer(...a),
  getLocationContentsAction: (...a: unknown[]) => h.getLocation(...a),
}));
vi.mock("@/hooks/queries/warehouse", () => ({
  useWarehouseLocationsQuery: () => ({
    isLoading: false,
    data: [
      { id: "prz", code: "PRZ", name: "Strefa przyjęć", can_store_inventory: true },
      { id: "zlc", code: "ZLC-01", name: "Regał", can_store_inventory: true },
      { id: "bin", code: "R01-A-K01", name: "Kuweta", can_store_inventory: true },
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

import { ScanFlow } from "../scan-flow";

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
  zlNumber: "0042",
});
const grille = item({
  variantId: "v-grille",
  sku: "5H0853651",
  quantity: 2,
  repairOrderLineId: "rol-2",
  repairOrderId: "ro-1",
  zlNumber: "0042",
});
const fender = item({
  variantId: "v-fender",
  sku: "5H0821105",
  repairOrderLineId: "rol-3",
  repairOrderId: "ro-2",
  zlNumber: "0057",
});
const rivets = item({
  variantId: "v-rivet",
  sku: "N91158501",
  quantity: 10,
  repairOrderLineId: "rol-4",
  repairOrderId: "ro-2",
  zlNumber: "0057",
  handlingMode: "bulk",
  defaultLocation: { id: "bin", code: "R01-A-K01", name: "Kuweta" },
});
const free = item({ variantId: "v-free", sku: "FREE-1", quantity: 3 });

const orders = {
  "ro-1": { zlNumber: "0042", clientName: "Kowalski", vehicleBrand: "VW", containers: [] },
  "ro-2": { zlNumber: "0057", clientName: "Nowak", vehicleBrand: "Skoda", containers: [] },
};

function renderFlow(items = [bumper, grille, fender, rivets, free]) {
  return render(
    <ScanFlow
      open
      onOpenChange={() => {}}
      branchId="b1"
      receivingLocationId="prz"
      items={items}
      orders={orders}
    />
  );
}

async function scan(lookup: unknown) {
  h.scanLookup.current = lookup;
  fireEvent.click(screen.getByTestId("fake-scan"));
  await waitFor(() => expect(h.scanResult.current).not.toBeUndefined());
}

beforeEach(() => {
  vi.clearAllMocks();
  h.scanResult.current = undefined;
  h.batch.mockResolvedValue({
    success: true,
    data: { containerCreated: false, containerCode: "K-0042-01", lineCount: 2, qrAssigned: null },
  });
});

describe("ScanFlow", () => {
  it("container sticker: lists only that order's parts, all preselected, and adds them", async () => {
    h.getContainer.mockResolvedValue({
      success: true,
      data: {
        id: "c1",
        code: "K-0042-01",
        status: "active",
        location: { id: "zlc", code: "ZLC-01", name: "Regał" },
        repairOrderId: "ro-1",
        zlNumber: "0042",
        clientName: "Kowalski",
        vehicleBrand: "VW",
      },
    });
    renderFlow();
    await scan({ id: "qr1", assignment: { target_type: "inventory.container", target_id: "c1" } });

    expect(await screen.findByTestId("scan-flow-container")).toBeInTheDocument();
    expect(screen.getAllByTestId("part-picker-row")).toHaveLength(2);
    fireEvent.click(screen.getByTestId("scan-flow-confirm"));
    await waitFor(() => expect(h.batch).toHaveBeenCalled());
    expect(h.batch.mock.calls[0][0]).toMatchObject({
      containerId: "c1",
      locationId: null,
      newContainerRepairOrderId: null,
      lines: [
        { variantId: "v-bumper", quantity: 1, repairOrderLineId: "rol-1" },
        { variantId: "v-grille", quantity: 2, repairOrderLineId: "rol-2" },
      ],
    });
    expect(h.refresh).toHaveBeenCalled();
  });

  it("blank sticker: order first, then parts and location, bound to the sticker", async () => {
    h.batch.mockResolvedValue({
      success: true,
      data: { containerCreated: true, containerCode: "K-0042-01", lineCount: 1, qrAssigned: true },
    });
    renderFlow();
    await scan({ id: "qr-blank", assignment: null });

    expect(await screen.findByTestId("scan-flow-new")).toBeInTheDocument();
    expect(screen.getByTestId("scan-flow-confirm")).toBeDisabled();
    // Search narrows the orders by ZL digits.
    fireEvent.change(screen.getByTestId("scan-flow-order-search"), { target: { value: "42" } });
    const orderButtons = screen.getAllByTestId("scan-flow-order");
    expect(orderButtons).toHaveLength(1);
    fireEvent.click(orderButtons[0]);

    // Only this order's container parts, none preselected.
    const rows = screen.getAllByTestId("part-picker-row");
    expect(rows).toHaveLength(2);
    fireEvent.click(rows[0].querySelector("button")!);
    expect(screen.getByTestId("scan-flow-confirm")).toBeDisabled();

    fireEvent.change(screen.getByLabelText("pickLocation"), { target: { value: "zlc" } });
    fireEvent.click(screen.getByTestId("scan-flow-confirm"));
    await waitFor(() => expect(h.batch).toHaveBeenCalled());
    expect(h.batch.mock.calls[0][0]).toMatchObject({
      locationId: "zlc",
      containerId: null,
      newContainerRepairOrderId: "ro-1",
      qrCodeId: "qr-blank",
      lines: [{ variantId: "v-bumper", quantity: 1, repairOrderLineId: "rol-1" }],
    });
  });

  it("location: shows what lies there and puts loose items away, fixed-bin material preselected", async () => {
    h.getLocation.mockResolvedValue({
      success: true,
      data: {
        location: { id: "bin", code: "R01-A-K01", name: "Kuweta" },
        isReceiving: false,
        containers: [],
        loose: [
          {
            variantId: "v-rivet",
            sku: "N91158501",
            productName: "Nit",
            quantity: 40,
            reserved: 12,
          },
        ],
      },
    });
    renderFlow();
    await scan({
      id: "qr-loc",
      assignment: { target_type: "warehouse.location", target_id: "bin" },
    });

    expect(await screen.findByTestId("scan-flow-location")).toBeInTheDocument();
    expect(screen.getByText("N91158501")).toBeInTheDocument();
    fireEvent.click(screen.getByTestId("scan-flow-loose"));

    fireEvent.click(screen.getByTestId("scan-flow-confirm"));
    await waitFor(() => expect(h.batch).toHaveBeenCalled());
    expect(h.batch.mock.calls[0][0]).toMatchObject({
      locationId: "bin",
      containerId: null,
      lines: [{ variantId: "v-rivet", quantity: 10, repairOrderLineId: "rol-4" }],
    });
  });

  it("refuses the receiving zone and an assigned sticker of another kind", async () => {
    renderFlow();
    await scan({ id: "x", assignment: { target_type: "warehouse.location", target_id: "prz" } });
    expect(h.scanResult.current).toBe("scanIsReceiving");
    h.scanResult.current = undefined;
    await scan({ id: "y", assignment: { target_type: "crm.party", target_id: "p" } });
    expect(h.scanResult.current).toBe("unknownCode");
  });

  it("shows the mixed-order refusal from the server", async () => {
    h.getContainer.mockResolvedValue({
      success: true,
      data: {
        id: "c1",
        code: "K-0042-01",
        status: "active",
        location: { id: "zlc", code: "ZLC-01", name: "Regał" },
        repairOrderId: "ro-1",
        zlNumber: "0042",
        clientName: null,
        vehicleBrand: null,
      },
    });
    h.batch.mockResolvedValue({ success: false, error: "mixed_orders" });
    renderFlow();
    await scan({ id: "qr1", assignment: { target_type: "inventory.container", target_id: "c1" } });
    fireEvent.click(await screen.findByTestId("scan-flow-confirm"));
    await waitFor(() => expect(h.toastError).toHaveBeenCalledWith("mixed_orders"));
  });
});
