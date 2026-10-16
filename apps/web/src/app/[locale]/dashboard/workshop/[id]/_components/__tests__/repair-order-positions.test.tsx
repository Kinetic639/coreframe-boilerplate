/**
 * @vitest-environment jsdom
 *
 * Stage E7 — "Pozycje" of a repair order: per part needed / reserved (incl.
 * containers) / issued / missing, where it lies, its state, and whether the
 * order is complete.
 */
import { render, screen } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";

vi.mock("next-intl", () => ({
  useTranslations: () => {
    const t = (key: string, values?: Record<string, unknown>) =>
      values ? `${key}:${JSON.stringify(values)}` : key;
    t.has = () => true;
    t.raw = () => ({});
    return t;
  },
}));
vi.mock("react-toastify", () => ({ toast: { error: vi.fn(), success: vi.fn() } }));
vi.mock("@/i18n/navigation", () => ({
  useRouter: () => ({ refresh: vi.fn() }),
  Link: ({ children }: { children: React.ReactNode }) => <a>{children}</a>,
}));
vi.mock("@/app/actions/warehouse/reservations", () => ({
  findRepairOrderLinesNeedingAction: vi.fn(),
  releaseReservationLinesAction: vi.fn(),
  reserveForRepairOrderAction: vi.fn(),
  transferReservationAction: vi.fn(),
}));
vi.mock("@/app/actions/warehouse/blocks", () => ({
  blockStockAction: vi.fn(),
  issueBlockedStockAction: vi.fn(),
  moveBlockedStockAction: vi.fn(),
  unblockStockAction: vi.fn(),
}));
vi.mock("@/hooks/queries/warehouse", () => ({ useWarehouseLocationsQuery: () => ({ data: [] }) }));

import { RepairOrderPositions, summarizeLine, type PositionLine } from "../repair-order-positions";
import type { ReservationLineView } from "@/server/services/inventory-reservations.service";

const line = (over: Partial<PositionLine> = {}): PositionLine => ({
  id: "l1",
  variantId: "v1",
  sku: "7L6868243",
  productName: "KLIP",
  orderedQuantity: 6,
  unit: "szt",
  ...over,
});

const res = (over: Partial<ReservationLineView> = {}): ReservationLineView => ({
  reservationLineId: "rl1",
  reservationId: "r1",
  reservationNumber: "REZ/2026/000100",
  repairOrderLineId: "l1",
  variantId: "v1",
  locationId: "loc",
  openQuantity: 0,
  allocatedQuantity: 0,
  createdAt: new Date().toISOString(),
  sku: null,
  productId: null,
  productName: null,
  unitCode: null,
  locationCode: "PRZ",
  locationName: "Strefa przyjęć",
  locationPurpose: "receiving",
  repairOrderId: "ro",
  zlNumber: "ZL/1",
  clientName: null,
  partName: null,
  ...over,
});

describe("summarizeLine", () => {
  it("nothing yet: missing", () => {
    const s = summarizeLine(line(), [], 0);
    expect(s).toMatchObject({ reserved: 0, issued: 0, missing: 6, status: "missing" });
  });
  it("reserved in the receiving zone", () => {
    const s = summarizeLine(line(), [res({ openQuantity: 6 })], 0);
    expect(s).toMatchObject({
      reserved: 6,
      missing: 0,
      status: "reserved_receiving",
      places: ["PRZ · Strefa przyjęć"],
    });
  });
  it("all in a container", () => {
    const s = summarizeLine(
      line(),
      [res({ allocatedQuantity: 6, locationPurpose: null, locationCode: "R-01" })],
      0
    );
    expect(s.status).toBe("in_container");
  });
  it("partly reserved, partly issued", () => {
    const s = summarizeLine(line(), [res({ openQuantity: 2, locationPurpose: null })], 1);
    expect(s).toMatchObject({ reserved: 2, issued: 1, missing: 3, status: "partial" });
  });
  it("everything issued", () => {
    expect(summarizeLine(line(), [], 6).status).toBe("issued");
  });
});

describe("RepairOrderPositions", () => {
  it("one row per part, the missing count and the order's completeness", () => {
    render(
      <RepairOrderPositions
        repairOrderId="ro"
        lines={[line(), line({ id: "l2", sku: "A1", productName: "Listwa", orderedQuantity: 1 })]}
        issuedByLine={{ l2: 1 }}
        reservations={[res({ openQuantity: 4 })]}
        available={[]}
        canOperate
        loadError={false}
      />
    );
    expect(screen.getAllByTestId("position-row")).toHaveLength(2);
    expect(screen.getAllByTestId("position-status").map((s) => s.textContent)).toEqual([
      "positions.statuses.partial",
      "positions.statuses.issued",
    ]);
    expect(screen.getByTestId("positions-incomplete").textContent).toContain('"count":1');
    // Nothing available on stock for the missing part: reserving is not offered.
    expect(screen.getByTestId("positions-reserve")).toHaveProperty("disabled", true);
  });

  it("offers 'reserve from stock' when a missing part is available", () => {
    render(
      <RepairOrderPositions
        repairOrderId="ro"
        lines={[line()]}
        issuedByLine={{}}
        reservations={[]}
        available={[
          {
            variantId: "v1",
            locationId: "R-02",
            locationCode: "R-02",
            locationName: null,
            available: 3,
          },
        ]}
        canOperate
        loadError={false}
      />
    );
    expect(screen.getByTestId("positions-reserve")).toHaveProperty("disabled", false);
  });

  it("says when the order is complete", () => {
    render(
      <RepairOrderPositions
        repairOrderId="ro"
        lines={[line()]}
        issuedByLine={{}}
        reservations={[res({ allocatedQuantity: 6 })]}
        available={[]}
        canOperate={false}
        loadError={false}
      />
    );
    expect(screen.getByTestId("positions-complete")).toBeTruthy();
    expect(screen.queryByTestId("positions-reserve")).toBeNull();
  });
});

describe("RepairOrderPositions -- reservations could not be read", () => {
  it("says the state is unknown instead of showing every part as missing", () => {
    render(
      <RepairOrderPositions
        repairOrderId="ro"
        lines={[line()]}
        issuedByLine={{}}
        reservations={[]}
        available={[]}
        canOperate
        loadError={false}
        stockLoadError
      />
    );
    expect(screen.getByTestId("positions-stock-error")).toBeTruthy();
    expect(screen.queryByTestId("position-status")).toBeNull();
  });
});
