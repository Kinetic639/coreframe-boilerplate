/**
 * @vitest-environment jsdom
 *
 * Zone 5 — "Rozlokowanie": what waits in the receiving zone in the order it
 * is worked through (fixed locations first, orders that already lie
 * somewhere, new orders, free stock), orders collapsed to a header with
 * where they lie and one action per order, the PZ of each part, and the
 * single-part putaway dialog (scan a location -> confirm -> refresh).
 */
import { render, screen, fireEvent, waitFor, within } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import type { ReceivingPendingItem } from "@/server/services/inventory-receiving.service";
import type { RepairOrderInfo } from "../putaway-utils";

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
vi.mock("@/i18n/navigation", () => ({
  useRouter: () => ({ refresh: h.refresh }),
  Link: ({
    href,
    children,
    ...rest
  }: {
    href: string | { pathname: string; params?: Record<string, string> };
    children: React.ReactNode;
  }) => (
    <a href={typeof href === "string" ? href : href.pathname} {...rest}>
      {children}
    </a>
  ),
}));
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
  SharedCameraProvider: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  useSharedCamera: () => null,
  resolveScannedQr: vi.fn(),
  QrCameraScanner: ({
    onScanned,
    onBack,
    backLabel,
  }: {
    onScanned: (l: unknown) => Promise<string | null>;
    onBack: () => void;
    backLabel?: string;
  }) => (
    <>
      <button
        data-testid="fake-scan"
        onClick={async () => {
          h.scanResult.current = await onScanned(h.scanLookup.current);
        }}
      >
        scan
      </button>
      <button onClick={onBack}>{backLabel}</button>
    </>
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
    internalOrder: null,
    handlingMode: "standard",
    defaultLocation: null,
    container: null,
    ...over,
  };
}

function source(movementId: string, documentNumber: string, quantity: number) {
  return {
    movementId,
    documentNumber,
    movementTypeCode: "101",
    movementTypeName: "Przyjęcie zewnętrzne",
    postedAt: "2026-10-15T10:00:00Z",
    externalReference: null,
    quantity,
  };
}

const pz7 = [source("m7", "PZ/2026/000007", 1)];

const bumper = item({
  variantId: "v-bumper",
  sku: "5H0807221",
  repairOrderLineId: "rol-1",
  repairOrderId: "ro-1",
  zlNumber: "184213",
  sources: pz7,
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
  sources: pz7,
});
const fender = item({
  variantId: "v-fender",
  sku: "5H0821105",
  repairOrderLineId: "rol-3",
  repairOrderId: "ro-2",
  zlNumber: "184257",
  sources: pz7,
});
const free = item({
  variantId: "v-free",
  sku: "FREE-1",
  quantity: 3,
  sources: [source("m1", "PZ/2026/000001", 3)],
});

const orders: Record<string, RepairOrderInfo> = {
  "ro-1": {
    zlNumber: "184213",
    clientName: "COMPET",
    vehicleBrand: "VW",
    containers: [
      {
        id: "c2",
        code: "K-184213-02",
        status: "active",
        location: { id: "zlc", code: "ZLC-01", name: "Regał" },
      },
    ],
    looseLocations: [],
  },
  "ro-2": { zlNumber: "184257", clientName: "Nowak", vehicleBrand: null, containers: [] },
};

function renderBoard(items: ReceivingPendingItem[], canOperate = true) {
  return render(
    <PutawayBoard
      branchId="b1"
      organizationId="o1"
      receivingLocationId="prz"
      items={items}
      orders={orders}
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
  it("lists fixed locations first, then free stock, orders that lie somewhere, new orders", () => {
    renderBoard([free, fender, bumper, clips]);
    const board = screen.getByTestId("putaway-board");
    const order = [
      "putaway-section-fixed",
      "putaway-section-free",
      "putaway-section-placed",
      "putaway-section-new",
    ].map((id) => screen.getByTestId(id));
    for (let i = 1; i < order.length; i++) {
      expect(
        order[i - 1].compareDocumentPosition(order[i]) & Node.DOCUMENT_POSITION_FOLLOWING
      ).toBeTruthy();
    }
    // The bulk part of 184213 waits under its fixed bin, not under its order.
    expect(within(order[0]).getByText(/WHT005263/)).toBeInTheDocument();
    expect(within(order[0]).getByText("SZ-02 · Kuweta")).toBeInTheDocument();
    expect(within(order[1]).getByText(/FREE-1/)).toBeInTheDocument();
    expect(within(order[2]).getByText("ZL 184213")).toBeInTheDocument();
    expect(within(order[3]).getByText("ZL 184257")).toBeInTheDocument();
    expect(screen.queryByText("title")).toBeNull();
    expect(screen.queryByText("subtitle")).toBeNull();
    expect(board).toBeInTheDocument();
  });

  it("an order is a header with its containers; its parts and one action open below it", () => {
    renderBoard([bumper]);
    const card = screen.getByTestId("putaway-order");
    expect(within(card).getByTestId("putaway-order-places").textContent).toContain(
      "K-184213-02 · ZLC-01"
    );
    expect(within(card).queryByTestId("putaway-item")).toBeNull();
    // No per-part button for order parts.
    expect(screen.queryByTestId("putaway-open")).toBeNull();

    fireEvent.click(within(card).getByTestId("putaway-order-toggle"));
    expect(within(card).getAllByTestId("putaway-item")).toHaveLength(1);
    expect(within(card).getByTestId("putaway-order-add").textContent).toContain(
      '"code":"K-184213-02"'
    );
  });

  it("adding to the order's container opens the scan sheet on that container with its parts ticked", () => {
    renderBoard([bumper]);
    fireEvent.click(screen.getByTestId("putaway-order-toggle"));
    fireEvent.click(screen.getByTestId("putaway-order-add"));
    expect(screen.getByTestId("scan-flow-container")).toBeInTheDocument();
    expect(screen.getByTestId("scan-flow-confirm").textContent).toContain('"count":1');
  });

  it("shows the PZ of each part, and a filter when several deliveries wait", () => {
    renderBoard([free, clips]);
    const metas = screen.getAllByTestId("putaway-item-meta").map((m) => m.textContent);
    expect(metas.join(" ")).toContain("PZ/2026/000007");
    expect(metas.join(" ")).toContain("PZ/2026/000001");

    const filters = screen.getAllByTestId("putaway-document-filter");
    expect(filters).toHaveLength(3);
    fireEvent.click(filters.find((f) => f.textContent === "PZ/2026/000001")!);
    expect(screen.queryByTestId("putaway-section-fixed")).toBeNull();
    expect(screen.getByTestId("putaway-section-free")).toBeInTheDocument();
  });

  it("links to the putaway history instead of a second tab", () => {
    renderBoard([free]);
    expect(screen.getByTestId("putaway-history-link").getAttribute("href")).toBe(
      "/dashboard/warehouse/putaway/changes"
    );
    expect(screen.queryByTestId("putaway-tab-changes")).toBeNull();
  });

  it("shows the empty state when nothing waits", () => {
    renderBoard([]);
    expect(screen.getByTestId("putaway-empty")).toBeInTheDocument();
  });

  it("explains a missing receiving zone", () => {
    render(
      <PutawayBoard
        branchId="b1"
        organizationId="o1"
        receivingLocationId={null}
        items={[]}
        loadError={false}
        canOperate
      />
    );
    expect(screen.getByTestId("putaway-no-receiving")).toBeInTheDocument();
  });

  it("hides every action without operate permission", () => {
    renderBoard([free, bumper], false);
    expect(screen.queryByTestId("putaway-open")).not.toBeInTheDocument();
    fireEvent.click(screen.getByTestId("putaway-order-toggle"));
    expect(screen.queryByTestId("putaway-order-add")).not.toBeInTheDocument();
  });
});

describe("PutawayDialog", () => {
  function openFor(target: ReceivingPendingItem) {
    renderBoard([target]);
    fireEvent.click(screen.getByTestId("putaway-open"));
  }

  it('"po kolei": one button walks the free items, each opens on the scanner; skip and next', async () => {
    h.putaway.mockResolvedValue({ success: true, data: { mode: "free" } });
    const free2 = item({ variantId: "v-free-2", sku: "FREE-2", quantity: 2 });
    const free3 = item({ variantId: "v-free-3", sku: "FREE-3", quantity: 1 });
    renderBoard([free, free2, free3]);
    fireEvent.click(screen.getByTestId("putaway-section-free-title-walk"));

    // Item 1 of 3, straight on the scanner: skip it.
    expect(screen.getByTestId("putaway-sequence").textContent).toBe(
      'position:{"index":1,"total":3}'
    );
    expect(screen.getByTestId("fake-scan")).toBeInTheDocument();
    fireEvent.click(screen.getByText("scanBack"));
    fireEvent.click(screen.getByTestId("putaway-skip"));

    // Item 2: scan a location, "put away, next".
    expect(screen.getByTestId("putaway-sequence").textContent).toBe(
      'position:{"index":2,"total":3}'
    );
    h.scanLookup.current = {
      id: "q",
      token: "t",
      label: null,
      status: "active",
      assignment: { target_type: "warehouse.location", target_id: "zlc" },
    };
    fireEvent.click(screen.getByTestId("fake-scan"));
    await waitFor(() => expect(h.scanResult.current).toBeNull());
    expect(screen.getByTestId("putaway-confirm").textContent).toBe("confirmNext");
    fireEvent.click(screen.getByTestId("putaway-confirm"));
    await waitFor(() =>
      expect(h.putaway).toHaveBeenCalledWith({
        variantId: "v-free-2",
        quantity: 2,
        destinationLocationId: "zlc",
        repairOrderLineId: null,
      })
    );

    // Item 3 is the last one: plain "confirm", then the walk ends.
    await waitFor(() =>
      expect(screen.getByTestId("putaway-sequence").textContent).toBe(
        'position:{"index":3,"total":3}'
      )
    );
    h.scanResult.current = undefined;
    fireEvent.click(screen.getByTestId("fake-scan"));
    await waitFor(() => expect(h.scanResult.current).toBeNull());
    expect(screen.getByTestId("putaway-confirm").textContent).toBe("confirm");
    fireEvent.click(screen.getByTestId("putaway-confirm"));
    await waitFor(() => expect(screen.queryByTestId("putaway-sequence")).toBeNull());
    expect(h.putaway).toHaveBeenCalledTimes(2);
  });

  it("free stock: a scanned location sticker becomes the destination", async () => {
    h.putaway.mockResolvedValue({ success: true, data: { mode: "free" } });
    openFor(free);
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
    expect(screen.getByTestId("putaway-outcome")).toHaveTextContent("outcome.loose");
    fireEvent.click(screen.getByTestId("putaway-confirm"));
    await waitFor(() =>
      expect(h.putaway).toHaveBeenCalledWith({
        variantId: "v-free",
        quantity: 3,
        destinationLocationId: "zlc",
        repairOrderLineId: null,
      })
    );
    await waitFor(() =>
      expect(h.toastSuccess).toHaveBeenCalledWith('doneLocation:{"location":"ZLC-01 · Regał"}')
    );
  });

  it("refuses the receiving zone and non-location stickers", async () => {
    openFor(free);
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
    openFor(clips);
    fireEvent.click(screen.getByTestId("putaway-confirm"));
    await waitFor(() => expect(h.toastError).toHaveBeenCalledWith("not_enough"));
    expect(h.refresh).not.toHaveBeenCalled();
  });
});

describe("PutawayBoard — internal orders", () => {
  it("lists parts held under a ZW in their own section, with nothing to put away", () => {
    renderBoard([
      item({
        variantId: "v-zw",
        sku: "657807217",
        repairOrderLineId: null,
        repairOrderId: null,
        zlNumber: null,
        internalOrder: {
          lineId: "iol-1",
          id: "io-1",
          number: "ZW/1/26/3142",
          externalNumber: "ZW/466/26/3142",
          client: "3642 Blacharnia Audi (83570)",
          destination: "WYSOG",
          transfer: null,
        },
      }),
    ]);
    const section = screen.getByTestId("putaway-section-internal");
    expect(section.textContent).toContain("ZW/1/26/3142");
    expect(section.textContent).toContain("board.internalFor");
    expect(section.textContent).toContain("3642 Blacharnia Audi (83570)");
    expect(within(section).queryByTestId("putaway-open")).toBeNull();
    expect(screen.queryByTestId("putaway-section-free")).toBeNull();
  });
});

describe("PutawayBoard — internal orders on their way", () => {
  it("says a ZW part is in transit and offers no second shipment", () => {
    renderBoard([
      item({
        variantId: "v-zw",
        repairOrderLineId: null,
        repairOrderId: null,
        internalOrder: {
          lineId: "iol-1",
          id: "io-1",
          number: "ZW/1/26/3142",
          externalNumber: null,
          client: null,
          destination: "WYSOG",
          transfer: { id: "bt-1", number: "BT-000003", status: "in_transit" },
        },
      }),
    ]);
    expect(screen.getByTestId("putaway-internal-transfer").textContent).toContain(
      "board.internalInTransit"
    );
    expect(screen.queryByTestId("putaway-internal-ship")).toBeNull();
  });
});
