/**
 * @vitest-environment jsdom
 *
 * Zone 5 — product handling card: read-only view without products.manage,
 * save disabled until something changes.
 */
import { render, screen } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";

vi.mock("next-intl", () => ({
  useTranslations: () => (key: string, values?: Record<string, unknown>) =>
    values ? `${key}:${JSON.stringify(values)}` : key,
}));
vi.mock("react-toastify", () => ({ toast: { error: vi.fn(), success: vi.fn() } }));
vi.mock("@/i18n/navigation", () => ({ useRouter: () => ({ refresh: vi.fn() }) }));
vi.mock("@/app/actions/warehouse/receiving", () => ({ saveProductHandlingAction: vi.fn() }));
vi.mock("@/hooks/queries/warehouse", () => ({
  useWarehouseLocationsQuery: () => ({
    data: [{ id: "bin", code: "SZ-02", name: "Kuweta", can_store_inventory: true }],
  }),
}));

import { ProductHandlingCard } from "../product-handling-card";

describe("ProductHandlingCard", () => {
  it("is read-only without products.manage and shows the fixed bin", () => {
    render(
      <ProductHandlingCard
        productId="p"
        branchId="b"
        branchName="CNP Piaseczno"
        handlingMode="bulk"
        defaultLocationId="bin"
        canManage={false}
      />
    );
    expect(screen.queryByTestId("product-handling-save")).not.toBeInTheDocument();
    expect(screen.getByText("mode.bulk")).toBeInTheDocument();
    expect(screen.getByText("SZ-02 · Kuweta")).toBeInTheDocument();
  });

  it("keeps save disabled until the handling changes", () => {
    render(
      <ProductHandlingCard
        productId="p"
        branchId="b"
        branchName="CNP Piaseczno"
        handlingMode="standard"
        defaultLocationId={null}
        canManage
      />
    );
    expect(screen.getByTestId("product-handling-save")).toBeDisabled();
  });
});
