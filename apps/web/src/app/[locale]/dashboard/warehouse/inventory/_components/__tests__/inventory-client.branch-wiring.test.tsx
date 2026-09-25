/**
 * @vitest-environment jsdom
 *
 * InventoryClient (Inventory Balances) — branch-aware DataView wiring
 * (Zone 1 / Phase 3, updated post main-integration to the canonical
 * `scope`/`dataViewScope.branch` contract — see
 * docs/mvp/reviews/main-zone1-integration-resolution-2026-09-25/).
 *
 * Tests the CONSUMER WIRING only: does this component forward its own
 * `organizationId`/`branchId` props into <DataView scope={dataViewScope.branch(...)}>?
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { render } from "@testing-library/react";

const mockDataViewSpy = vi.fn();

vi.mock("next-intl", () => ({
  useTranslations: () => (key: string) => key,
}));

vi.mock("@/components/data-view/data-view", () => ({
  DataView: (props: Record<string, unknown>) => {
    mockDataViewSpy(props);
    return null;
  },
}));

vi.mock("@/app/actions/warehouse/inventory", () => ({
  adjustStockAction: vi.fn(),
  getInventoryBalanceAction: vi.fn(),
  issueStockAction: vi.fn(),
  listInventoryBalancesAction: vi.fn(),
  receiveStockAction: vi.fn(),
  transferStockAction: vi.fn(),
}));

import { InventoryClient } from "../inventory-client";

const initialData = { rows: [], totalCount: 0, page: 1, pageSize: 20 };
const ORG_ID = "org-1";

describe("InventoryClient (Inventory Balances) — branch-aware wiring (scope contract)", () => {
  beforeEach(() => {
    mockDataViewSpy.mockClear();
  });

  it("forwards its own organizationId/branchId props into DataView's scope", () => {
    render(
      <InventoryClient
        organizationId={ORG_ID}
        branchId="branch-a"
        initialData={initialData as never}
        variants={[]}
        locations={[]}
        canOperate={false}
        canAdjust={false}
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
      <InventoryClient
        organizationId={ORG_ID}
        branchId="branch-b"
        initialData={initialData as never}
        variants={[]}
        locations={[]}
        canOperate={false}
        canAdjust={false}
      />
    );

    expect(mockDataViewSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        scope: { kind: "branch", organizationId: ORG_ID, branchId: "branch-b" },
      })
    );
  });
});
