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
vi.mock("@/i18n/navigation", () => ({
  useRouter: () => ({ refresh: h.refresh }),
  Link: ({
    href,
    children,
  }: {
    href: { pathname: string; params: { movementId: string } };
    children: React.ReactNode;
  }) => <a href={href.pathname.replace("[movementId]", href.params.movementId)}>{children}</a>,
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

function renderBoard(
  items: ReceivingPendingItem[],
  canOperate = true,
  view: "documents" | "parts" = "parts"
) {
  const result = render(
    <PutawayBoard
      branchId="b1"
      receivingLocationId="prz"
      items={items}
      loadError={false}
      canOperate={canOperate}
    />
  );
  // The board opens per document; most tests look at the flat part list.
  const toggle = screen.queryByTestId("putaway-view-parts");
  if (view === "parts" && toggle) fireEvent.click(toggle);
  return result;
}

function source(movementId: string | null, documentNumber: string | null, quantity: number) {
  return {
    movementId,
    documentNumber,
    movementTypeCode: movementId ? "101" : null,
    movementTypeName: movementId ? "Przyjęcie zewnętrzne" : null,
    postedAt: movementId ? `2026-10-${movementId === "m-new" ? "15" : "14"}T10:00:00Z` : null,
    externalReference: movementId === "m-new" ? "SVWMS-20261015-A36777EC" : null,
    quantity,
  };
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

  it("opens on the documents that brought stock in, newest first, then shows a document's parts", () => {
    const fromNew = { ...bumper, sources: [source("m-new", "PZ/2026/000007", 1)] };
    // Free stock split between two receipts.
    const split = {
      ...free,
      sources: [source("m-new", "PZ/2026/000007", 2), source("m-old", "PZ/2026/000001", 1)],
    };
    const unknown = { ...fender, sources: [source(null, null, 1)] };
    renderBoard([fromNew, split, unknown], true, "documents");

    const cards = screen.getAllByTestId("putaway-document-card");
    expect(cards.map((c) => c.textContent)).toEqual([
      expect.stringContaining("PZ/2026/000007"),
      expect.stringContaining("PZ/2026/000001"),
      expect.stringContaining("documents.unknown"),
    ]);
    expect(cards[0].textContent).toContain('documents.orders:{"list":"184213"}');
    expect(cards[0].textContent).toContain("documents.free");
    expect(cards[0].textContent).toContain('documents.lines:{"count":2}');
    expect(screen.queryByTestId("putaway-item")).not.toBeInTheDocument();

    fireEvent.click(cards[0]);
    const doc = screen.getByTestId("putaway-document");
    expect(within(doc).getByText("PZ/2026/000007")).toBeInTheDocument();
    expect(within(doc).getByRole("link").getAttribute("href")).toBe(
      "/dashboard/warehouse/inventory/movements/m-new"
    );
    const rows = within(doc).getAllByTestId("putaway-item");
    expect(rows).toHaveLength(2);
    // The free item shows only this document's share.
    expect(rows.map((r) => r.textContent).join(" ")).toContain("2 szt");

    fireEvent.click(screen.getByTestId("putaway-document-back"));
    expect(screen.getAllByTestId("putaway-document-card")).toHaveLength(3);
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

  it("a repair-order part does not go onto a shelf by a location scan: it opens its order's containers", () => {
    openFor(bumper);
    expect(screen.queryByTestId("putaway-dialog")).not.toBeInTheDocument();
    expect(screen.getByTestId("scan-flow-order-step")).toBeInTheDocument();
    expect(screen.getByTestId("scan-flow-order-new-sticker")).toBeInTheDocument();
    expect(screen.getByTestId("scan-flow-order-new-oversize")).toBeInTheDocument();
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
