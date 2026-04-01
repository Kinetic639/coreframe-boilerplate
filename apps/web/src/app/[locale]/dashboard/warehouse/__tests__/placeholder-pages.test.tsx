import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

const mockGetTranslations = vi.fn();

vi.mock("next-intl/server", () => ({
  getTranslations: (...args: unknown[]) => mockGetTranslations(...args),
}));

vi.mock("../_components/warehouse-placeholder-page", () => ({
  WarehousePlaceholderPage: ({ title, description }: { title: string; description: string }) => (
    <div>
      <h1>{title}</h1>
      <p>{description}</p>
    </div>
  ),
}));

import WarehouseAlertsPage from "../alerts/page";
import WarehouseAuditsPage from "../audits/page";
import WarehouseClientsPage from "../clients/page";
import WarehouseDeliveriesPage from "../deliveries/page";
import WarehouseInventoryPage from "../inventory/page";
import WarehouseItemsPage from "../items/page";
import WarehouseLocationsPage from "../locations/page";
import WarehousePurchasesPage from "../purchases/page";
import WarehouseSettingsPage from "../settings/page";
import WarehouseSuppliersPage from "../suppliers/page";

const cases = [
  ["alerts", WarehouseAlertsPage, "items.alerts.title"],
  ["audits", WarehouseAuditsPage, "items.audits.title"],
  ["clients", WarehouseClientsPage, "items.sales.clients"],
  ["deliveries", WarehouseDeliveriesPage, "items.deliveries.title"],
  ["inventory", WarehouseInventoryPage, "items.inventory.title"],
  ["items", WarehouseItemsPage, "items.products.title"],
  ["locations", WarehouseLocationsPage, "items.locations"],
  ["purchases", WarehousePurchasesPage, "items.purchases.title"],
  ["settings", WarehouseSettingsPage, "items.settings.title"],
  ["suppliers", WarehouseSuppliersPage, "items.suppliers.title"],
] as const;

describe("warehouse placeholder pages", () => {
  it.each(cases)("renders %s placeholder content", async (_name, Page, key) => {
    mockGetTranslations.mockResolvedValue((translationKey: string) =>
      translationKey === "placeholder.moduleShell" ? "Module shell" : key
    );

    const page = await Page();
    render(page);

    expect(screen.getByRole("heading", { name: key })).toBeInTheDocument();
    expect(screen.getByText("Module shell")).toBeInTheDocument();
  });
});
