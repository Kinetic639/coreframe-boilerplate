/**
 * @vitest-environment jsdom
 *
 * InventoryProductsClient — branch-aware DataView wiring (Zone 1 / Phase 3,
 * updated post main-integration to the canonical `scope`/`dataViewScope.branch`
 * contract — see docs/mvp/reviews/main-zone1-integration-resolution-2026-09-25/).
 *
 * Tests the CONSUMER WIRING only: does this component forward its own
 * `organizationId`/`branchId` props into <DataView scope={dataViewScope.branch(...)}>?
 * This closes the same originally-discovered bug (a static query key across
 * a branch switch) — now via the canonical `scope` mechanism instead of a
 * static `INVENTORY_PRODUCTS_QUERY_KEY` array.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { render } from "@testing-library/react";
import React from "react";

const mockDataViewSpy = vi.fn();

vi.mock("next-intl", () => ({
  useTranslations: () => (key: string) => key,
}));

vi.mock("@/i18n/navigation", () => ({
  Link: ({ children }: { children: React.ReactNode }) => <>{children}</>,
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
const ORG_ID = "org-1";

describe("InventoryProductsClient — branch-aware wiring (scope contract)", () => {
  beforeEach(() => {
    mockDataViewSpy.mockClear();
  });

  it("forwards its own organizationId/branchId props into DataView's scope", () => {
    render(
      <InventoryProductsClient
        organizationId={ORG_ID}
        branchId="branch-a"
        initialData={initialData as never}
        customFields={[]}
        canManageProducts={false}
        canImportProducts={false}
      />
    );

    expect(mockDataViewSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        scope: { kind: "branch", organizationId: ORG_ID, branchId: "branch-a" },
      })
    );
  });

  it("forwards a different scope when the branchId prop changes", () => {
    render(
      <InventoryProductsClient
        organizationId={ORG_ID}
        branchId="branch-b"
        initialData={initialData as never}
        customFields={[]}
        canManageProducts={false}
        canImportProducts={false}
      />
    );

    expect(mockDataViewSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        scope: { kind: "branch", organizationId: ORG_ID, branchId: "branch-b" },
      })
    );
  });
});
