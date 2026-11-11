/**
 * @vitest-environment jsdom
 *
 * "Magazyn i zamówienia" of a repair order: documents with the lines of the
 * selected one, internal orders (ZW) with their lines and Z / R / W / A squares.
 */
import { fireEvent, render, screen, within } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";

vi.mock("next-intl", () => ({
  useTranslations: () => {
    const t = (key: string, values?: Record<string, unknown>) =>
      values ? `${key}:${JSON.stringify(values)}` : key;
    t.has = () => true;
    return t;
  },
}));
vi.mock("@/i18n/navigation", () => ({
  Link: ({ children }: { children: React.ReactNode }) => <a>{children}</a>,
}));

import { RepairOrderWarehouseOrders } from "../repair-order-warehouse-orders";
import type { InternalOrderView } from "@/server/services/internal-orders.service";

const zw = (id: string, number: string, lines: Partial<InternalOrderView["lines"][number]>[]) =>
  ({
    id,
    number,
    externalNumber: `ZW/${number.split("/")[1]}00/26/3332`,
    externalZlNumber: null,
    warehouseCode: "3332",
    repairOrderId: "ro-1",
    repairOrderZl: "ZLEC/1/26/3332/BL",
    clientKind: "repair_order",
    clientName: null,
    destinationCode: null,
    status: "open",
    source: "manual",
    notes: null,
    createdAt: "2026-10-21T08:00:00Z",
    receipts: [],
    lines: lines.map((l, i) => ({
      id: `${id}-l${i}`,
      lineNumber: i + 1,
      productCode: "5E3868731",
      productName: "Klip",
      variantId: "v1",
      quantity: 10,
      ordered: true,
      repairOrderLineId: "rol-1",
      source: "manual",
      cancelledAt: null,
      cancelReason: null,
      createdAt: "2026-10-21T08:00:00Z",
      receivedQuantity: 0,
      reservedQuantity: 0,
      issuedQuantity: 0,
      ...l,
    })),
  }) as InternalOrderView;

describe("RepairOrderWarehouseOrders", () => {
  it("shows the lines of the selected document and of the selected ZW", () => {
    render(
      <RepairOrderWarehouseOrders
        locale="pl"
        documents={[
          {
            key: "receipt:PZ/1",
            number: "PZ/2026/000001",
            movementId: "mv-1",
            date: "2026-10-21T07:00:00Z",
            kind: "receipt",
            lines: [{ key: "a", part: "5E3868731 · Klip", quantity: 3, detail: "PRZ" }],
          },
        ]}
        orders={[
          zw("io-1", "ZW/1/26/3332", [{ reservedQuantity: 3 }]),
          zw("io-2", "ZW/2/26/3332", [{ issuedQuantity: 10 }]),
        ]}
      />
    );
    expect(screen.getByTestId("stock-document-lines").textContent).toContain("5E3868731 · Klip");

    // The first ZW is open: line partly reserved (R half), ordered (Z full).
    let squares = within(screen.getByTestId("internal-order-lines")).getAllByTestId("zw-square");
    expect(squares.map((s) => s.getAttribute("data-fill"))).toEqual([
      "full",
      "half",
      "none",
      "none",
    ]);

    fireEvent.click(screen.getAllByTestId("internal-order-row")[1]!);
    squares = within(screen.getByTestId("internal-order-lines")).getAllByTestId("zw-square");
    expect(squares.map((s) => s.getAttribute("data-fill"))).toEqual([
      "full",
      "none",
      "full",
      "none",
    ]);
  });

  it("says when the order has no ZW yet", () => {
    render(<RepairOrderWarehouseOrders locale="pl" documents={[]} orders={[]} />);
    expect(screen.getByText("forOrder.empty")).toBeTruthy();
  });
});
