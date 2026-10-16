/**
 * @vitest-environment jsdom
 *
 * Stage E6 — reservation and block tables on screens: what each row shows
 * (document, part, order, location, R in containers, reason, age), the
 * search of the list pages, and the D / R / B badges.
 */
import { render, screen, fireEvent, within } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";

vi.mock("next-intl", () => ({
  useTranslations: () => {
    const t = (key: string, values?: Record<string, unknown>) =>
      values ? `${key}:${JSON.stringify(values)}` : key;
    t.has = () => true;
    t.raw = (key: string) => ({ title: key, description: key, confirm: key, reservedNote: key });
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

import {
  BlockLinesTable,
  BlocksList,
  ReservationLinesTable,
  ReservationsList,
  StockStates,
} from "../stock-commitments";
import type { ReservationLineView } from "@/server/services/inventory-reservations.service";
import type { BlockLineView } from "@/server/services/inventory-blocks.service";

const reservation = (over: Partial<ReservationLineView> = {}): ReservationLineView => ({
  reservationLineId: "rl1",
  reservationId: "r1",
  reservationNumber: "REZ/2026/000100",
  repairOrderLineId: "rol1",
  variantId: "v1",
  locationId: "l1",
  openQuantity: 1,
  allocatedQuantity: 2,
  createdAt: new Date().toISOString(),
  sku: "7L6868243",
  productId: "p1",
  productName: "KLIP",
  unitCode: "szt",
  locationCode: "R-02",
  locationName: "Regał",
  locationPurpose: null,
  repairOrderId: "ro1",
  zlNumber: "ZL/175389/26/3112/BL",
  clientName: "COMPET",
  partName: "KLIP",
  ...over,
});

const block = (over: Partial<BlockLineView> = {}): BlockLineView => ({
  blockLineId: "bl1",
  blockId: "b1",
  blockNumber: "BLK/2026/000005",
  reasonCode: "supplier_complaint",
  description: "uszkodzone w transporcie",
  referenceType: null,
  referenceNumber: "HD-0087",
  variantId: "v1",
  locationId: "l9",
  openQuantity: 3,
  createdAt: new Date(Date.now() - 3 * 86_400_000).toISOString(),
  sku: "7L6868243",
  productId: "p1",
  productName: "KLIP",
  unitCode: "szt",
  locationCode: "REKL",
  locationName: "Reklamacje",
  ...over,
});

describe("ReservationLinesTable", () => {
  it("shows the document, part, order, location, total R and what is in a container", () => {
    render(<ReservationLinesTable lines={[reservation()]} canOperate />);
    const row = screen.getByTestId("reservation-line");
    expect(within(row).getByText("REZ/2026/000100")).toBeTruthy();
    expect(within(row).getByText("ZL/175389/26/3112/BL")).toBeTruthy();
    expect(within(row).getByText("R-02 · Regał")).toBeTruthy();
    expect(row.textContent).toContain("3 szt");
    expect(row.textContent).toContain('reservations.inContainer:{"quantity":"2"}');
    expect(within(row).getByTestId("reservation-actions")).toBeTruthy();
  });

  it("offers no operations without the operate permission, or when everything is in a container", () => {
    const { rerender } = render(
      <ReservationLinesTable lines={[reservation()]} canOperate={false} />
    );
    expect(screen.queryByTestId("reservation-actions")).toBeNull();
    rerender(<ReservationLinesTable lines={[reservation({ openQuantity: 0 })]} canOperate />);
    expect(screen.queryByTestId("reservation-actions")).toBeNull();
  });

  it("says when nothing is reserved", () => {
    render(<ReservationLinesTable lines={[]} canOperate />);
    expect(screen.getByText("reservations.empty")).toBeTruthy();
  });
});

describe("BlockLinesTable", () => {
  it("shows the block document, reason, description, reference, location and age", () => {
    render(<BlockLinesTable lines={[block()]} canOperate branchId="b" />);
    const row = screen.getByTestId("block-line");
    expect(within(row).getByText("BLK/2026/000005")).toBeTruthy();
    expect(within(row).getByText("reasons.supplier_complaint")).toBeTruthy();
    expect(within(row).getByText("uszkodzone w transporcie")).toBeTruthy();
    expect(within(row).getByText("HD-0087")).toBeTruthy();
    expect(within(row).getByText("REKL · Reklamacje")).toBeTruthy();
    expect(row.textContent).toContain('days:{"count":3}');
  });
});

describe("list pages", () => {
  it("reservations: searching by ZL or part narrows the list", () => {
    render(
      <ReservationsList
        lines={[
          reservation(),
          reservation({
            reservationLineId: "rl2",
            zlNumber: "ZL/9/26/3112/BL",
            sku: "AAA",
            productName: "Listwa",
          }),
        ]}
        canOperate={false}
      />
    );
    expect(screen.getAllByTestId("reservation-line")).toHaveLength(2);
    fireEvent.change(screen.getByTestId("commitments-filter"), { target: { value: "listwa" } });
    expect(screen.getAllByTestId("reservation-line")).toHaveLength(1);
  });

  it("blocks: searching by the complaint reference finds the block", () => {
    render(
      <BlocksList
        lines={[
          block(),
          block({ blockLineId: "bl2", referenceNumber: "HD-0001", description: null }),
        ]}
        canOperate={false}
        branchId="b"
      />
    );
    fireEvent.change(screen.getByTestId("commitments-filter"), { target: { value: "0087" } });
    expect(screen.getAllByTestId("block-line")).toHaveLength(1);
  });
});

describe("StockStates", () => {
  it("always shows D, and R / B only when there are any", () => {
    const { rerender } = render(<StockStates available={4} reserved={0} blocked={0} />);
    expect(screen.getByTestId("stock-states").textContent).toBe("D 4");
    rerender(<StockStates available={2} reserved={2} blocked={3} />);
    const text = screen.getByTestId("stock-states").textContent ?? "";
    expect(text).toContain("R 2");
    expect(text).toContain("B 3");
  });
});
