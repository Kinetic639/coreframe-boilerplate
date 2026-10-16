/**
 * @vitest-environment jsdom
 *
 * Item card: stock per location opens to every reservation and block there.
 */
import { render, screen, fireEvent, within } from "@testing-library/react";
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
vi.mock("@/app/actions/warehouse/reservations", () => ({}));
vi.mock("@/app/actions/warehouse/blocks", () => ({}));
vi.mock("@/hooks/queries/warehouse", () => ({ useWarehouseLocationsQuery: () => ({ data: [] }) }));

import { StockByLocationTable } from "../stock-by-location-table";
import type { InventoryBalanceListRow } from "@/lib/warehouse/inventory-types";

const row = (over: Partial<InventoryBalanceListRow>): InventoryBalanceListRow => ({
  id: "b1",
  variant_id: "v1",
  sku: "7L6868243",
  product_name: "KLIP",
  location_id: "prz",
  location_name: "Strefa przyjęć",
  location_code: "PRZ",
  on_hand_quantity: 10,
  available_quantity: 3,
  reserved_total_quantity: 5,
  blocked_quantity: 2,
  unit_code: "szt",
  average_unit_cost: 1,
  total_value: 10,
  currency: "PLN",
  last_movement_id: null,
  last_movement_number: null,
  last_movement_at: null,
  updated_at: "2026-10-16T10:00:00Z",
  ...over,
});

const reservation = (id: string, zl: string, qty: number) => ({
  reservationLineId: id,
  reservationId: `r-${id}`,
  reservationNumber: `REZ/2026/${id}`,
  repairOrderLineId: `rol-${id}`,
  variantId: "v1",
  locationId: "prz",
  openQuantity: qty,
  allocatedQuantity: 0,
  createdAt: new Date().toISOString(),
  sku: "7L6868243",
  productId: "p1",
  productName: "KLIP",
  unitCode: "szt",
  locationCode: "PRZ",
  locationName: "Strefa przyjęć",
  locationPurpose: "receiving",
  repairOrderId: `ro-${id}`,
  zlNumber: zl,
  clientName: null,
  partName: null,
});

const labels = Object.fromEntries(
  [
    "title",
    "empty",
    "sku",
    "location",
    "onHand",
    "available",
    "reserved",
    "blocked",
    "avgCost",
    "value",
    "lastMovement",
    "total",
  ].map((k) => [k, k])
) as never;

describe("StockByLocationTable", () => {
  it("a location opens to each reservation (which order) and each block", () => {
    render(
      <StockByLocationTable
        rows={[
          row({}),
          row({
            id: "b2",
            location_id: "r2",
            location_code: "R-02",
            reserved_total_quantity: 0,
            blocked_quantity: 0,
          }),
        ]}
        reservations={[
          reservation("000001", "ZL/1/26/3112/BL", 2),
          reservation("000002", "ZL/2/26/3112/BL", 3),
        ]}
        blocks={[
          {
            blockLineId: "bl1",
            blockId: "b",
            blockNumber: "BLK/2026/000001",
            reasonCode: "damaged",
            description: null,
            referenceType: null,
            referenceNumber: null,
            variantId: "v1",
            locationId: "prz",
            openQuantity: 2,
            createdAt: new Date().toISOString(),
            sku: null,
            productId: null,
            productName: null,
            unitCode: "szt",
            locationCode: "PRZ",
            locationName: "Strefa przyjęć",
          },
        ]}
        showSku={false}
        locale="pl"
        labels={labels}
        canOperate={false}
        branchId="br"
      />
    );
    // Only the location with R/B can be opened.
    expect(screen.getAllByTestId("stock-location-toggle")).toHaveLength(1);
    fireEvent.click(screen.getByTestId("stock-location-toggle"));
    const breakdown = screen.getByTestId("stock-location-breakdown");
    const lines = within(breakdown).getAllByTestId("reservation-line");
    expect(lines.map((l) => l.textContent)).toEqual([
      expect.stringContaining("ZL/1/26/3112/BL"),
      expect.stringContaining("ZL/2/26/3112/BL"),
    ]);
    expect(within(breakdown).getByTestId("block-line").textContent).toContain("BLK/2026/000001");
    expect(breakdown.textContent).toContain('"available":"3"');
  });
});
