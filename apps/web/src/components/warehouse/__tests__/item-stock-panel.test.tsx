/**
 * @vitest-environment jsdom
 *
 * Item panel of the products list: stock per location with R / B behind it,
 * loaded on the client, an explicit error when it cannot be read, and a
 * reload after a reservation / block operation.
 */
import { render, screen, waitFor, act } from "@testing-library/react";
import { beforeEach, describe, it, expect, vi } from "vitest";

const h = vi.hoisted(() => ({ load: vi.fn() }));

vi.mock("next-intl", () => ({
  useLocale: () => "pl",
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
vi.mock("@/app/actions/warehouse/item-stock", () => ({
  getItemStockBreakdownAction: (...a: unknown[]) => h.load(...a),
}));
vi.mock("@/app/actions/warehouse/reservations", () => ({}));
vi.mock("@/app/actions/warehouse/blocks", () => ({}));
vi.mock("@/hooks/queries/warehouse", () => ({ useWarehouseLocationsQuery: () => ({ data: [] }) }));

import { ItemStockPanel } from "../item-stock-panel";
import { STOCK_CHANGED_EVENT } from "../stock-commitments";

const row = {
  id: "b1",
  variant_id: "v1",
  sku: "5Q09191339B9",
  product_name: "Pierścień",
  location_id: "prz",
  location_name: "Strefa przyjęć",
  location_code: "PRZ",
  on_hand_quantity: 12,
  available_quantity: 0,
  reserved_total_quantity: 12,
  blocked_quantity: 0,
  unit_code: "szt",
  average_unit_cost: 1,
  total_value: 12,
  currency: "PLN",
  last_movement_id: null,
  last_movement_number: null,
  last_movement_at: null,
  updated_at: "2026-10-16T10:00:00Z",
};

beforeEach(() => {
  h.load.mockReset();
});

describe("ItemStockPanel", () => {
  it("loads the item's stock per location for the product", async () => {
    h.load.mockResolvedValue({
      success: true,
      data: { branchId: "br", canOperate: false, rows: [row], reservations: [], blocks: [] },
    });
    render(<ItemStockPanel productId="p1" showSku={false} />);
    expect(await screen.findByTestId("stock-location-row")).toBeTruthy();
    expect(h.load).toHaveBeenCalledWith({ productId: "p1" });
  });

  it("says when the stock cannot be read (never 'not in any location')", async () => {
    h.load.mockResolvedValue({ success: false, error: "failed" });
    render(<ItemStockPanel productId="p1" showSku={false} />);
    expect((await screen.findByTestId("item-stock-panel-error")).textContent).toBe(
      "pages.loadError"
    );
  });

  it("reloads after a reservation / block operation", async () => {
    h.load.mockResolvedValue({
      success: true,
      data: { branchId: "br", canOperate: false, rows: [row], reservations: [], blocks: [] },
    });
    render(<ItemStockPanel productId="p1" showSku={false} />);
    await screen.findByTestId("stock-location-row");
    act(() => {
      window.dispatchEvent(new Event(STOCK_CHANGED_EVENT));
    });
    await waitFor(() => expect(h.load).toHaveBeenCalledTimes(2));
  });
});
