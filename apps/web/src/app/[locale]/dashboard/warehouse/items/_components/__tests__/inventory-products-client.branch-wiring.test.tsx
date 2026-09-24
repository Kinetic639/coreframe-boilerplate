/**
 * @vitest-environment jsdom
 *
 * InventoryProductsClient — branch-aware DataView wiring (Zone 1 / Phase 3)
 *
 * Tests the CONSUMER WIRING only: does this component read the live active
 * branch from the store and forward it to <DataView branchId={...}>? Also
 * covers the exact newly-discovered bug from the pre-implementation audit —
 * `INVENTORY_PRODUCTS_QUERY_KEY` staying static across a branch switch.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { render } from "@testing-library/react";
import React from "react";

const { mockDataViewSpy, mockActiveBranchId } = vi.hoisted(() => ({
  mockDataViewSpy: vi.fn(),
  mockActiveBranchId: { current: "branch-a" as string | null },
}));

vi.mock("next-intl", () => ({
  useTranslations: () => (key: string) => key,
}));

vi.mock("@/i18n/navigation", () => ({
  Link: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

vi.mock("@/lib/stores/v2/app-store", () => ({
  useAppStoreV2: (selector: (state: { activeBranchId: string | null }) => unknown) =>
    selector({ activeBranchId: mockActiveBranchId.current }),
}));

vi.mock("@/components/data-view/data-view", () => ({
  DataView: (props: Record<string, unknown>) => {
    mockDataViewSpy(props);
    return null;
  },
}));

vi.mock("@/app/actions/warehouse/inventory", () => ({
  exportInventoryProductsCsvAction: vi.fn(),
  getInventoryProductAction: vi.fn(),
  listInventoryProductsAction: vi.fn(),
}));

import { InventoryProductsClient } from "../inventory-products-client";

const initialData = { rows: [], totalCount: 0, page: 1, pageSize: 20 };

describe("InventoryProductsClient — branch-aware wiring", () => {
  beforeEach(() => {
    mockDataViewSpy.mockClear();
  });

  it("forwards the live active branch to DataView's branchId prop", () => {
    mockActiveBranchId.current = "branch-a";

    render(
      <InventoryProductsClient
        initialData={initialData as never}
        customFields={[]}
        canManageProducts={false}
        canImportProducts={false}
      />
    );

    expect(mockDataViewSpy).toHaveBeenCalledWith(
      expect.objectContaining({ queryKey: ["inventory-products"], branchId: "branch-a" })
    );
  });

  it("forwards a different branchId when the active branch changes", () => {
    mockActiveBranchId.current = "branch-b";

    render(
      <InventoryProductsClient
        initialData={initialData as never}
        customFields={[]}
        canManageProducts={false}
        canImportProducts={false}
      />
    );

    expect(mockDataViewSpy).toHaveBeenCalledWith(expect.objectContaining({ branchId: "branch-b" }));
  });
});
